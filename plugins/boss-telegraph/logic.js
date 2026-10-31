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
  const STALE_MS = 3000; // events older than this (queued while the window was shut) are not spoken
  const REPEAT_MS = 1200; // one boss's same trigger twice in this time: once
  const SHOW_MS = 4000; // how long a call without a countdown stays up
  const SAFE_MS = 2500;
  const WAVE_GAP_MS = 400; // a wave's several projectiles: one beep
  const WAVES_FOR_MS = 8000; // waves heard this long after their skill
  const BIND_MS = 30 * 60 * 1000;
  const MARK_GAP_MS = 6000; // a sign this long after the last starts a new order
  const ORDER_SHOW_MS = 12000; // the order stays up while it plays out

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
    const lastCall = new Map(); // call.k -> at
    const orders = new Map(); // "entity:mark" -> { words, at }
    let items = []; // on the widget: { id, kind, text, sub, end, until }
    let seq = 0;

    const now = () => hooks.now();
    const prefs = () => hooks.prefs();
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

    // The player's own words for a call (Settings, ✎), if any.
    const own = (c) => String((prefs().custom || {})[c.k] || "").trim();
    // What the call says and shows, by the player's call style; the player's
    // own words for it instead, whatever the style.
    function words(c) {
      const mine = own(c);
      if (mine) return { big: mine, sub: "", say: [mine] };
      const style = prefs().style || "both";
      const line = T(c.line);
      const act = T(c.act);
      const buff = c.t === "abnormal" ? T(c.n) : "";
      if (style === "line") return { big: line || act || buff, sub: "", say: [line || act || buff] };
      if (style === "act") return { big: act || line || buff, sub: act ? "" : buff, say: [act || line || buff] };
      // both: the short call first (it's what to do), then the game's line.
      if (act && line) return { big: act, sub: line, say: [act, line] };
      return { big: act || line || buff, sub: buff && line ? buff : "", say: [act || line || buff] };
    }

    function show(item) {
      item.id = ++seq;
      items = [item, ...items.filter((x) => x.key !== item.key)].slice(0, 3);
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
    function mark(c, entity, at) {
      const key = `${entity}:${c.mark}`;
      const was = orders.get(key);
      const order = was && at - was.at < MARK_GAP_MS ? was : { words: [] };
      const word = own(c) || T(c.act);
      order.words.push(word);
      order.at = at;
      orders.set(key, order);
      if (orders.size > 20) for (const [k, o] of orders) if (at - o.at > 60_000) orders.delete(k);
      lastCall.set(c.k, at);
      hooks.say(word, "high");
      show({ key: `m:${c.mark}:${entity}`, kind: "call", text: order.words.join(" → "), sub: "", end: 0, until: at + ORDER_SHOW_MS });
    }

    function fire(c, entity, at) {
      const fresh = now() - at <= STALE_MS;
      if (!fresh) return;
      if (c.mark) return mark(c, entity, at);
      const w = words(c);
      lastCall.set(c.k, at);
      for (let i = 0; i < w.say.length; i++) if (w.say[i]) hooks.say(w.say[i], i === 0 ? "high" : "low");
      const end = c.lead ? at + c.lead : 0;
      show({ key: `c:${c.k}:${entity}`, kind: "call", text: w.big, sub: w.sub, end, until: Math.max(end, at + SHOW_MS) });
      if (c.waves) waveFrom.set(`${entity}:${c.id}`, { call: c, at, last: 0 });
    }

    function trigger(t, d, at) {
      const skill = Number(d.skill ?? d.abnormal);
      const entity = Number(d.caster ?? d.entity);
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
      fire(c, entity, at);
    }

    function added(d, at) {
      const abnormal = Number(d.abnormal);
      const entity = Number(d.entity);
      // A curated phase: the buff on the boss, and how long it lasts.
      const ph = byPhase.get(abnormal);
      if (ph) {
        const c = ph.find(on);
        if (c) startPhase(c, entity, Number(d.instance), at, Number(d.length) || c.phase.ms);
      }
      trigger("abnormal", d, at);
    }
    function startPhase(c, entity, instance, at, length) {
      const key = `${entity}:${instance}`;
      const end = at + Math.min(Math.max(length, 500), 120_000);
      // The game's line style: the buff's own name; else what to do.
      const label = (prefs().style === "line" && T(c.phase.n)) || T(c.phase.label) || T(c.act);
      const was = phases.get(key);
      const sub = prefs().style === "line" ? "" : T(c.phase.n);
      const item = show({ key: `p:${c.k}:${entity}`, kind: "phase", text: label, sub, end, until: end });
      phases.set(key, { call: c, end, item, entity });
      // Said again only when its call wasn't just heard (a cast seen before).
      const heard = lastCall.get(c.k);
      if (!was && now() - at <= STALE_MS && (heard == null || at - heard > 6000)) hooks.say(label, "high");
    }
    function endPhase(key, at) {
      const p = phases.get(key);
      if (!p) return;
      phases.delete(key);
      drop(p.item.key);
      // Another of the same mechanic still running: not safe yet.
      for (const q of phases.values()) if (q.call.k === p.call.k) return;
      if (now() - at > STALE_MS) return;
      const safe = T(D.safe);
      hooks.say(safe, "high");
      show({ key: `s:${p.call.k}:${p.entity}`, kind: "safe", text: safe, sub: "", end: 0, until: at + SAFE_MS });
    }
    function removed(d, at) {
      endPhase(`${Number(d.entity)}:${Number(d.instance)}`, at);
    }

    function wave(d, at) {
      const entity = Number(d.caster);
      const skill = Number(d.skill);
      const w = waveFrom.get(`${entity}:${skill}`);
      if (!w || at - w.at > WAVES_FOR_MS || !on(w.call) || !wavesOn(w.call)) return;
      if (at - w.last < WAVE_GAP_MS) return;
      w.last = at;
      if (now() - at <= STALE_MS) hooks.beep();
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

    // Every 100 ms: phases that ran out say "safe", old items go.
    function tick() {
      const t = now();
      for (const [key, p] of phases) if (p.end <= t) endPhase(key, p.end);
      const n = items.length;
      items = items.filter((x) => x.until > t);
      if (items.length !== n) hooks.show(items);
    }

    // The test button: a made-up purple phase, 5 s, then "safe".
    function test() {
      const c = D.calls.find((x) => x.k === "thamon-violet") || D.calls.find((x) => x.act) || D.calls[0];
      const at = now();
      const w = words(c);
      w.say.forEach((s, i) => s && hooks.say(s, i === 0 ? "high" : "low"));
      show({ key: "test", kind: "call", text: w.big, sub: w.sub, end: at + 1800, until: at + 1800 });
      if (c.phase) {
        lastCall.set(c.k, at);
        setTimeout(() => startPhase(c, -1, -1, now(), 5000), 1800);
      }
    }

    // ▶ on a call in the list: that call as a fight would bring it (its
    // words, the player's own if set, its countdown), and its phase after,
    // shortened to 5 s, then "safe". Ignores the call being ticked off.
    function preview(k) {
      const c = D.calls.find((x) => x.k === k);
      if (!c) return;
      const at = now();
      fire(c, -1, at);
      if (c.phase) {
        lastCall.set(c.k, at);
        setTimeout(() => startPhase(c, -1, -1, now(), 5000), Math.min(c.lead || 1800, 3000));
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
      clear() {
        phases.clear();
        items = [];
        hooks.show(items);
      },
    };
  }

  root.BossLogic = { create };
})(typeof window !== "undefined" ? window : globalThis);
