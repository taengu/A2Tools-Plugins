// Boss Callouts' rules, apart from the page so they can be tried without one.
//
// What it hears (manifest.json decoders; worked out from captures, 2026-10-26):
//   09 38  a cast bar starts: caster, skill
//   02 38  a skill goes off: caster, skill (the only sign of a skill with no cast time)
//   03 38  a skill's later hits (Vakron's staff waves): caster, source, skill
//   2A 38  a buff lands: entity, instance, abnormal, length (ms)
//   2C 38  a buff ends: entity, the first ended buff's instance
// Every entity's, players' too: the decoders can't tell a boss from a player.
// So nothing is kept but what bosses.js names: a skill or buff id with a
// boss's line or a curated mechanic. An entity id is remembered only once it
// casts one of a boss's own skills (to know which boss a buff any monster can
// get, such as Frenzy, landed on), and only for half an hour.
//
// What it says is only what the game shows: the boss's line (the client plays
// it from NpcBehaviorCase when the boss does that), the cast bar's time, the
// buff on the boss and its time. A curated mechanic (tools/boss-telegraph/
// curated.json) adds a short call for what the colour or the buff means.
(function (root) {
  const STALE_MS = 3000; // older events (queued while the window was shut) are ignored
  const REPEAT_MS = 1200; // one boss's same trigger twice in this time: once
  const SHOW_MS = 4000; // how long a call without a countdown stays up
  const SAFE_MS = 2500;
  const REMOVAL_GRACE_MS = 3000; // retain expired instance IDs for a briefly delayed confirmation
  const WAVE_GAP_MS = 400; // a wave's several projectiles: one beep
  const WAVES_FOR_MS = 8000; // waves heard this long after their skill
  const BIND_MS = 30 * 60 * 1000;
  const MARK_GAP_MS = 6000; // a sign this long after the last starts a new order
  const ORDER_SHOW_MS = 12000; // the order stays up while it plays out
  const ORDER_VOICE_GAP_MS = 2500; // let the roughly two-second sign cadence finish

  function create(data, hooks) {
    const D = data;
    const byTrigger = new Map(); // "cast:id" -> [call]
    const byPhase = new Map(); // abnormal -> [call]
    const skillBoss = new Map(); // skill -> Set(boss): who can cast it
    for (const c of D.calls) {
      const k = `${c.t}:${c.id}`;
      if (!byTrigger.has(k)) byTrigger.set(k, []);
      byTrigger.get(k).push(c);
      if (c.phase) {
        if (!byPhase.has(c.phase.a)) byPhase.set(c.phase.a, []);
        byPhase.get(c.phase.a).push(c);
      }
      if (c.t !== "abnormal") addSkill(c.id, c.b);
    }
    for (const [b, x] of Object.entries(D.bosses)) for (const s of x.s || []) addSkill(s, b);
    function addSkill(s, b) {
      if (!skillBoss.has(s)) skillBoss.set(s, new Set());
      skillBoss.get(s).add(b);
    }

    const entities = new Map(); // entity -> { boss: Set, at }
    const recent = new Map(); // "entity:t:id" -> at
    const phases = new Map(); // "entity:instance" -> { call, end, item }
    const waveFrom = new Map(); // "entity:skill" -> { call, at, last }
    const lastCall = new Map(); // "entity:call.k" -> at
    const orders = new Map(); // "entity:mark" -> { words, at }
    const previewTimers = new Set();
    let generation = 0;
    let resetAt = -Infinity;
    let items = []; // on the widget: { id, kind, text, sub, end, until }
    let seq = 0;

    const now = () => hooks.now();
    const prefs = () => hooks.prefs();
    const fresh = (at) => Number.isFinite(at) && at <= now() && now() - at <= STALE_MS;
    // Packets queued before a reset belong to the previous encounter context.
    // Same-millisecond packets are ambiguous too; previews are explicit and
    // use fresh() directly rather than crossing this live-event boundary.
    const live = (at) => fresh(at) && at > resetAt;
    const validId = (id) => Number.isSafeInteger(id) && id > 0;
    const validInstance = (id) => Number.isSafeInteger(id) && id >= 0;
    const callKey = (c, entity) => `${entity}:${c.k}`;
    const T = (i) => {
      if (i == null) return "";
      const t = D.texts[i];
      return (t && (t[hooks.lang()] || t.en)) || "";
    };
    const on = (c) => {
      const p = prefs();
      return p.enabled !== false && !(p.offBoss || {})[c.b] && !(p.offCall || {})[c.k];
    };
    const wavesOn = (c) => c.waves && (prefs().waves || {})[c.k] !== false;

    function learn(entity, skill, at) {
      const b = skillBoss.get(skill);
      if (!b) return;
      const e = entities.get(entity) || { boss: new Set(), at };
      for (const x of b) e.boss.add(x);
      e.at = at;
      entities.set(entity, e);
      if (entities.size > 200) {
        for (const [k, v] of entities) if (at - v.at > BIND_MS) entities.delete(k);
      }
    }
    // Of a trigger's calls (one per boss sharing it), the one for this entity.
    function pick(list, entity) {
      const e = entities.get(entity);
      const known = e && now() - e.at < BIND_MS ? e.boss : null;
      if (known) {
        const mine = list.find((c) => known.has(c.b));
        if (mine) return mine;
      }
      // Unknown entity: a call that needs to know its boss stays quiet.
      return list.find((c) => !c.bind) || null;
    }

    function pickPhase(list, entity, abnormal) {
      // A phase must not select the first of several boss/mechanic meanings.
      // Unique curated boss buffs can stand alone; shared meanings stay
      // unresolved, and bound buffs must match the recipient's narrow context.
      if (new Set(list.map((c) => `${c.b}:${c.k}`)).size !== 1) return null;
      const c = list[0];
      const other = byTrigger.get(`abnormal:${abnormal}`) || [];
      if (other.some((x) => x.b !== c.b)) return null;
      const e = entities.get(entity);
      const known = e && now() - e.at < BIND_MS ? e.boss : null;
      if (known && !known.has(c.b)) return null;
      if ((c.bind || c.phase.bind) && (!known || known.size !== 1 || !known.has(c.b))) return null;
      return on(c) ? c : null;
    }

    // The player's own words for a call (Settings, ✎), if any.
    const own = (c) => String((prefs().custom || {})[c.k] || "").trim();
    const actionMode = () => prefs().tellMeWhatToDo !== false;
    const actionText = (entry) => entry && (entry[hooks.lang()] || entry.en) || "";
    const actions = hooks.actions || {};
    // What the call says and shows, by the player's call style; the player's
    // own words for it instead, whatever the style.
    function words(c, preview = false) {
      const mine = own(c);
      if (mine) return { big: mine, sub: "", say: [mine] };
      const style = prefs().style || "both";
      const line = T(c.line);
      const act = T(c.act);
      const buff = c.t === "abnormal" ? T(c.n) : "";
      if (actionMode()) {
        const resolved = hooks.instruction?.(c, { preview, uncertain: !!c.uncertain });
        const instruction = !c.uncertain && (actionText(resolved?.text) || (!hooks.instruction && actionText(actions.calls?.[c.k])));
        const action = instruction || act || line || buff;
        return { big: action, sub: [preview ? resolved?.scopeLabel : "", line && line !== action ? line : ""].filter(Boolean).join(" · "), say: [action] };
      }
      if (style === "line") return { big: line || act || buff, sub: "", say: [line || act || buff] };
      if (style === "act") return { big: act || line || buff, sub: act ? "" : buff, say: [act || line || buff] };
      // both: the short call first (it's what to do), then the game's line.
      if (act && line) return { big: act, sub: line, say: [act, line] };
      return { big: act || line || buff, sub: buff && line ? buff : "", say: [act || line || buff] };
    }

    function show(item) {
      item.id = ++seq;
      const time = now();
      const priority = (x) => x.until <= time ? 0 : x.kind === "phase" ? 2 : x.sequence === true ? 1 : 0;
      // The widget shows two items. New boss lines must not push a remembered
      // sign order out of those slots before it expires. A live phase warning
      // still takes precedence; speech continues to announce every new call.
      items = [item, ...items.filter((x) => x.key !== item.key)]
        .sort((a, b) => priority(b) - priority(a)).slice(0, 3);
      hooks.show(items);
      return item;
    }
    function drop(key) {
      const n = items.length;
      items = items.filter((x) => x.key !== key);
      if (items.length !== n) hooks.show(items);
    }

    // An order the boss shows one sign at a time (Talisra's spears: Dark,
    // Dark, Light), then plays out: each sign said as it comes, the callout
    // the order so far, up until it has played out.
    function mark(c, entity, at, preview = false, resolved = null) {
      const key = `${entity}:${c.mark}`;
      const was = orders.get(key);
      const order = was && at - was.at < MARK_GAP_MS ? was : { words: [] };
      const word = own(c) || T(c.act);
      order.words.push(word);
      order.at = at;
      order.call = c;
      orders.set(key, order);
      if (orders.size > 20) for (const [k, o] of orders) if (at - o.at > 60_000) orders.delete(k);
      lastCall.set(callKey(c, entity), at);
      // These are signs for future pulses, not directions to move immediately.
      const shortSign = c.k === "talisra-dark-spear" || c.k === "talisra-light-spear";
      const instruction = shortSign ? actionText(actions.calls?.[c.k]) : actionText(resolved?.text) || actionText(actions.calls?.[c.k]);
      hooks.say(own(c) || (actionMode() && instruction) || word, "high");
      const sub = [preview ? resolved?.scopeLabel : "", actionMode() ? actionText(actions.order) : ""].filter(Boolean).join(" · ");
      show({ key: `m:${c.mark}:${entity}`, kind: "call", sequence: true, text: order.words.join(" → "), sub, end: 0, until: at + ORDER_SHOW_MS });
    }

    function fire(c, entity, at, preview = false) {
      if (!fresh(at)) return;
      if (c.mark) {
        const resolved = actionMode() && !own(c) ? hooks.instruction?.(c, { preview, uncertain: !!c.uncertain }) : null;
        return mark(c, entity, at, preview, resolved);
      }
      const w = words(c, preview);
      lastCall.set(callKey(c, entity), at);
      for (let i = 0; i < w.say.length; i++) if (w.say[i]) hooks.say(w.say[i], i === 0 ? "high" : "low");
      const end = c.lead ? at + c.lead : 0;
      show({ key: `c:${c.k}:${entity}`, kind: "call", text: w.big, sub: w.sub, end, until: Math.max(end, at + SHOW_MS) });
      if (c.waves) waveFrom.set(`${entity}:${c.id}`, { call: c, at, last: 0 });
    }

    function trigger(t, d, at) {
      const skill = Number(d.skill ?? d.abnormal);
      const entity = Number(d.caster ?? d.entity);
      if (!live(at) || !validId(skill) || !validId(entity)) return;
      if (t !== "abnormal") learn(entity, skill, at);
      const list = byTrigger.get(`${t}:${skill}`);
      if (!list) return;
      const c = pick(list, entity);
      if (!c || !on(c)) return;
      const key = `${entity}:${t}:${skill}`;
      const last = recent.get(key);
      recent.set(key, at);
      if (recent.size > 300) for (const [k, v] of recent) if (at - v > 60_000) recent.delete(k);
      if (last != null && at - last < REPEAT_MS) return;
      // Shared skills and reused entity IDs cannot safely establish which
      // boss-specific action to take. Keep their live advisory neutral; the
      // explicitly selected per-boss preview can still demonstrate its call.
      const ambiguous = new Set(list.map((x) => x.b)).size > 1;
      fire(ambiguous ? { ...c, uncertain: true } : c, entity, at);
    }

    function added(d, at) {
      const abnormal = Number(d.abnormal);
      const entity = Number(d.entity);
      const instance = Number(d.instance);
      if (!live(at) || !validId(abnormal) || !validId(entity) || !validInstance(instance)) return;
      // A curated phase: the buff on the boss, and how long it lasts.
      const ph = byPhase.get(abnormal);
      if (ph) {
        const c = pickPhase(ph, entity, abnormal);
        if (c) startPhase(c, entity, instance, at, Number(d.length) || c.phase.ms);
      }
      trigger("abnormal", d, at);
    }
    function startPhase(c, entity, instance, at, length, preview = false) {
      if (!fresh(at) || !Number.isFinite(length) || length < 0) return;
      const resolved = actionMode() && !own(c) ? hooks.instruction?.(c, { preview, uncertain: false }) : null;
      if (resolved?.suppressLegacy && !resolved.text) return;
      const key = `${entity}:${instance}`;
      const end = at + Math.min(Math.max(length, 500), 120_000);
      // The game's line style: the buff's own name; else what to do.
      const label = actionMode()
        ? own(c) || T(c.phase.label) || actionText(actions.calls?.[c.k]) || actionText(actions.watch)
        : (prefs().style === "line" && T(c.phase.n)) || T(c.phase.label) || T(c.act);
      const was = phases.get(key);
      const sub = [preview ? resolved?.scopeLabel : "", !actionMode() && prefs().style === "line" ? "" : T(c.phase.n)].filter(Boolean).join(" · ");
      const item = show({ key: `p:${c.k}:${entity}:${instance}`, kind: "phase", text: label, sub, end, until: end });
      phases.set(key, { call: c, end, item, entity });
      // Said again only when its call wasn't just heard (a cast seen before).
      const heard = lastCall.get(callKey(c, entity));
      if (!was && (heard == null || at - heard > 6000)) {
        lastCall.set(callKey(c, entity), at);
        hooks.say(label, "high");
      }
    }
    function endPhase(key, at, confirmed = false) {
      const p = phases.get(key);
      if (!p) return;
      drop(p.item.key);
      // Preserve the original countdown completion cue. A delayed page tick
      // must not announce an old estimate as a current safe window.
      if (!confirmed && now() > p.end + REMOVAL_GRACE_MS) { phases.delete(key); return; }
      phases.delete(key);
      if (now() > p.end + REMOVAL_GRACE_MS || !fresh(at) || !on(p.call)) return;
      // Any other active or awaiting-confirmation hazard on this entity keeps
      // its completion from becoming an unsafe resume-attack announcement.
      for (const q of phases.values()) if (q.entity === p.entity) return;
      const safe = T(D.safe);
      hooks.say(safe, "high");
      show({ key: `s:${p.call.k}:${p.entity}`, kind: "safe", text: safe, sub: "", end: 0, until: at + SAFE_MS });
    }
    function removed(d, at) {
      const entity = Number(d.entity), instance = Number(d.instance);
      if (!live(at) || !validId(entity) || !validInstance(instance)) return;
      endPhase(`${entity}:${instance}`, at, true);
    }

    function wave(d, at) {
      const entity = Number(d.caster);
      const skill = Number(d.skill);
      if (!live(at) || !validId(entity) || !validId(skill)) return;
      const w = waveFrom.get(`${entity}:${skill}`);
      if (!w || at - w.at > WAVES_FOR_MS || !on(w.call) || !wavesOn(w.call)) return;
      if (at - w.last < WAVE_GAP_MS) return;
      w.last = at;
      hooks.beep();
      // The call stays up while its waves come.
      let longer = false;
      for (const it of items) {
        if (it.key === `c:${w.call.k}:${entity}` && it.until < at + 2000) {
          it.until = at + 2000;
          longer = true;
        }
      }
      if (longer) hooks.show(items);
    }

    // Every 100 ms: expired estimates and old items go quietly.
    function tick() {
      const t = now();
      for (const order of orders.values()) {
        if (order.advised || t - order.at < ORDER_VOICE_GAP_MS) continue;
        // Explain the action once after a pause, without declaring the order
        // complete or inventing a pulse timer. A suspended page must not speak
        // an expired order when it resumes. Reset/disabled/custom calls stay quiet.
        order.advised = true;
        if (t - order.at >= ORDER_SHOW_MS || !on(order.call) || own(order.call) || !actionMode()) continue;
        const instruction = actionText(actions.order);
        if (instruction) hooks.say(instruction, "high");
      }
      for (const [key, p] of phases) if (p.end <= t) endPhase(key, p.end);
      const n = items.length;
      items = items.filter((x) => x.until > t);
      if (items.length !== n) hooks.show(items);
    }

    function schedulePreview(fn, delay) {
      const current = generation;
      const timer = setTimeout(() => {
        previewTimers.delete(timer);
        if (current === generation) fn();
      }, delay);
      previewTimers.add(timer);
    }

    // The test button: a made-up purple phase lasting 5 s.
    function test() {
      const c = D.calls.find((x) => x.k === "thamon-violet") || D.calls.find((x) => x.act) || D.calls[0];
      const at = now();
      const w = words(c, true);
      w.say.forEach((s, i) => s && hooks.say(s, i === 0 ? "high" : "low"));
      show({ key: "test", kind: "call", text: w.big, sub: w.sub, end: at + 1800, until: at + 1800 });
      if (c.phase) {
        lastCall.set(callKey(c, -1), at);
        schedulePreview(() => startPhase(c, -1, -1, now(), 5000, true), 1800);
      }
    }

    // ▶ on a call in the list: that call as a fight would bring it (its
    // words, the player's own if set, its countdown), and its phase after,
    // shortened to 5 s. Ignores the call being ticked off.
    function preview(k) {
      const c = D.calls.find((x) => x.k === k);
      if (!c) return;
      const at = now();
      fire(c, -1, at, true);
      if (c.phase) {
        lastCall.set(callKey(c, -1), at);
        schedulePreview(() => startPhase(c, -1, -1, now(), 5000, true), Math.min(c.lead || 1800, 3000));
      }
    }

    return {
      preview,
      cast: (d, at) => trigger("cast", d, at),
      use: (d, at) => trigger("use", d, at),
      wave,
      added,
      removed,
      tick,
      test,
      items: () => items,
      // `keepBosses`: a guide setting changed mid-fight; which entity is
      // which boss, and its phase, stay known (forgetting them silenced the
      // fight until the boss was seen again).
      clear(at = now(), { keepBosses = false } = {}) {
        const boundary = fresh(at) ? at : now();
        generation++;
        resetAt = Math.max(resetAt, boundary);
        for (const timer of previewTimers) if (typeof clearTimeout === "function") clearTimeout(timer);
        previewTimers.clear();
        if (!keepBosses) {
          entities.clear();
          phases.clear();
        }
        recent.clear();
        waveFrom.clear();
        lastCall.clear();
        orders.clear();
        seq = 0;
        items = [];
        hooks.show(items);
      },
    };
  }

  root.BossLogic = { create };
})(typeof window !== "undefined" ? window : globalThis);
