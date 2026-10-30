// Roster / Content Overview: every character you play, with what the meter last saw of
// them (class, level, combat power, gear score, Odyle energy), kept between
// sessions. Basic energy refills while you are away, so it is shown as it
// likely is now (≈), until the game says again.
const { CAPS, nextRefill, estimate, fullAt, EVERY } = globalThis.RosterLogic;
const SERVERS = globalThis.ROSTER_SERVERS || {};
const UI = globalThis.ROSTER_UI;
const $ = (sel, root = document) => root.querySelector(sel);

// The page's words in the meter's language (i18n.js), English until it says.
let lang = "en";
let t = UI.en;

// The meter names classes in Korean: each one's place in the words' class
// list, and its colour.
const CLASSES = {
  "검성": [0, "#e0a04a"],
  "수호성": [1, "#7fa7d9"],
  "살성": [2, "#c46ad1"],
  "궁성": [3, "#7cc46a"],
  "마도성": [4, "#e06a6a"],
  "정령성": [5, "#6ad1c4"],
  "치유성": [6, "#f0d36a"],
  "호법성": [7, "#d18f6a"],
  "권성": [8, "#a3a3a3"],
};

// chars: { "<name>@<server>": { name, serverId, class, level, cp, gs,
//   energy: { basic, charged, at }, cap, seen, counts } }
// servers: { "<serverId>": { counts } } for content shared on a server.
// counts: { "<entry id>": { v: [left, extra], at } } as the game last said.
const state = { chars: {}, servers: {}, prefs: { sort: "name", tab: "roster", display: "all" } };
let current = null; // the key of who is playing now
let gameRunning = true; // meters before 2.0.65 don't say
let saveTimer = 0;
// What each key last held in storage: only a key that changed is written.
const written = {};
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    for (const key of ["chars", "prefs", "servers"]) {
      const json = JSON.stringify(state[key]);
      if (written[key] === json) continue;
      written[key] = json;
      a2.storage.set(key, state[key]).catch((e) => console.warn(e));
    }
  }, 400);
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
// What was seen again unchanged keeps when it was first seen: the meter sends
// its last values with every character event, so a count from Monday sent
// again on Wednesday is still Monday's, and its reset has passed since.
const same = (a, b) => JSON.stringify({ ...a, at: 0 }) === JSON.stringify({ ...b, at: 0 });
const kept = (prev, next) => (prev && same(prev, next) ? prev : next);

// ── What the meter says ────────────────────────────────────────────────────
a2.on("character", (c) => {
  // Only once the server is known: a meter started before the game says the
  // last name played before it knows where, and that made a second, empty
  // character of it (#122).
  if (!c?.name || !c.serverId) return;
  const key = `${c.name}@${c.serverId ?? ""}`;
  // 560 until more is seen: only a membership goes over it.
  const ch = (state.chars[key] ||= { name: c.name, serverId: c.serverId, cap: CAPS[1] });
  ch.name = c.name;
  if (c.serverId) ch.serverId = c.serverId;
  if (c.class) ch.class = c.class;
  if (num(c.level)) ch.level = c.level;
  // Meters before 2.0.78 send none of these: what was seen stays.
  if (num(c.combatPower)) ch.cp = c.combatPower;
  if (num(c.gearScore)) ch.gs = c.gearScore;
  const e = c.odyleEnergy;
  if (e && Number.isFinite(e.basic) && Number.isFinite(e.charged)) {
    ch.energy = kept(ch.energy, { basic: e.basic, charged: e.charged, at: Date.now() });
    // Over 560 can only be with a membership.
    if (e.basic > CAPS[1]) {
      ch.cap = CAPS[0];
      ch.memberAt = Date.now();
      // The game's own word over a cap set by hand.
      ch.capSet = false;
    }
  }
  // Content counts (meters that send them): each kept with the character or
  // its server, as the content is counted.
  const counts = c.contentCounts;
  if (counts && typeof counts === "object") {
    const at = Date.now();
    for (const x of CONTENT) {
      const v = x.id == null ? null : counts[x.id];
      if (!Array.isArray(v)) continue;
      const home = x.scope === "server" && !x.ofChars ? (state.servers[ch.serverId ?? ""] ||= {}) : ch;
      home.counts ||= {};
      home.counts[x.id] = kept(home.counts[x.id], { v: [Number(v[0]) || 0, Number(v[1]) || 0], at });
    }
  }
  // The shop's weekly limits and the crafts made (meter 2.0.78 on), once the
  // shop or the crafting window has opened: each kept the same way.
  // Kinah gained today and the week's Abyss Points, with its limit (it
  // grows each week).
  const from = { shop: c.shopLimits, craft: c.crafts, kinah: { today: c.kinahToday }, abyss: { week: c.abyssPoints } };
  for (const x of OTHER) {
    const [kind, id] = x.id.split(":");
    // An Elyos character's own recipe first: the game lists both sides'
    // recipes, the other side's at 0, which used to win (#123).
    const own = x.elyos && sideOf(ch.serverId) === "elyos" ? from[kind]?.[x.elyos] : undefined;
    const v = own ?? from[kind]?.[id] ?? (x.elyos && from[kind]?.[x.elyos]);
    if (v == null) continue;
    const home = x.scope === "server" ? (state.servers[ch.serverId ?? ""] ||= {}) : ch;
    const n = Array.isArray(v) ? v[0] : v;
    // A shop limit past its reset comes as [0, null]: the next reset isn't
    // known until the shop opens again, so the game's weekly one counts.
    const second = Array.isArray(v) && Number.isFinite(v[1]) ? v[1] : undefined;
    const seen = { v: [Number(n) || 0, 0], at: Date.now() };
    if (x.capFromGame) seen.cap = second;
    else if (second !== undefined) seen.reset = second;
    home.counts ||= {};
    home.counts[x.id] = kept(home.counts[x.id], seen);
  }
  // Abyss Corridors: passage 1000000N is the corridor of artifact 100N
  // (Reshanta's Root, Sulfur Tree Island, Siel's Wings: the two run on
  // 2026-10-25 were 10000001 and 10000002). One still to run has its usage
  // time left (2:10; contentTimes [time, seen at]), a used one comes as a
  // plain 0. Kept only when all three are known (a meter started
  // mid-session has only what changed); counted with the siege (corridors()).
  if (counts && typeof counts === "object") {
    const times = c.contentTimes || {};
    const time = (id) => Number(Array.isArray(times[id]) ? times[id][0] : times[id]);
    const states = PASSAGES.map((id) => (time(id) > 0 ? "left" : Array.isArray(counts[id]) ? "used" : null));
    if (!states.includes(null)) ch.passages = states;
    // One with time left: the passages were handed out for the holding
    // that lasts until the next siege (or, not known, the weekly reset).
    // Refreshed every 5 minutes at most, so a repeated event writes nothing.
    const until = state.servers[ch.serverId ?? ""]?.siege?.next;
    const left = ch.passagesLeft;
    if (states.includes("left") && (!left || left.until !== until || Date.now() - left.at > 300_000)) {
      ch.passagesLeft = { at: Date.now(), until };
    }
  }
  corridors(ch);
  // Seen now: kept fresh every 30 s while playing (below), so an event alone
  // doesn't write storage again.
  if (key !== current || Date.now() - (ch.seen || 0) > 300_000) ch.seen = Date.now();
  current = key;
  save();
  render();
});
// The Abyss Artifact Siege (permission "feed:boss-timers"): who holds each
// corridor's artifact, and when the holding resets. From the game as you
// enter the Abyss or open its map (a2.on("abyss")), else the site's copy
// (a2.abyssSiege). Kept per server.
function keepSiege(serverId, d) {
  if (!serverId || !d || !Array.isArray(d.artifacts)) return;
  const holders = {};
  for (const a of d.artifacts) if (a?.id) holders[a.id] = a.owner;
  const war = (d.wars || []).find((w) => w?.event === 1001);
  const next = Number(war?.until) > 0 ? Number(war.until) * 1000 : undefined;
  const server = (state.servers[serverId] ||= {});
  const siege = { holders, next, at: (Number(d.observedAt) || 0) * 1000 || Date.now() };
  if (server.siege && same(server.siege, siege)) return;
  server.siege = siege;
  for (const ch of Object.values(state.chars)) if (ch.serverId === serverId) corridors(ch);
  save();
  render();
}
a2.on("abyss", (d) => keepSiege(state.chars[current]?.serverId, d));
// The site's copy, for a server not seen in the Abyss yet this session, or
// once the siege known has passed: asked again after 10 minutes at most.
const asked = new Map();
function askSiege(serverId) {
  if (!serverId || typeof a2.abyssSiege !== "function") return;
  const siege = state.servers[serverId]?.siege;
  if (siege?.next > Date.now() && asked.has(serverId)) return;
  if (Date.now() - (asked.get(serverId) || 0) < 600_000) return;
  asked.set(serverId, Date.now());
  a2.abyssSiege(serverId).then((d) => {
    if (!d || (state.servers[serverId]?.siege?.at || 0) > (Number(d.observedAt) || 0) * 1000) return;
    keepSiege(serverId, d);
  }).catch(() => {});
}

// The corridors a character has done since the last siege: a side can run
// only the ones it holds, so the limit is how many, and done is how many of
// those have no time left. No time on any is all used, or the passages not
// handed out yet (on the first Abyss visit after a siege): all done only
// when one had time left in this holding, else a guess of none done (≈0)
// that the next look at the passages, or a siege arriving, rewrites.
// Without the siege known, all three count and the week's reset stands in
// for it (an estimate). An artifact no side holds closes its corridor to
// both (as far as known); one the meter can't name doesn't.
function corridors(ch) {
  const states = ch.passages;
  if (!states) return;
  askSiege(ch.serverId);
  const now = Date.now();
  const siege = state.servers[ch.serverId ?? ""]?.siege;
  const side = sideOf(ch.serverId);
  const holders = siege?.holders || {};
  const ours = PASSAGES.map((_, k) => {
    const h = holders[1001 + k];
    return !side || !h || h === side || String(h).startsWith("unknown");
  });
  const cap = ours.filter(Boolean).length;
  const done = states.filter((st, k) => ours[k] && st === "used").length;
  const prev = ch.counts?.["abyss:corridors"];
  const inPeriod = (x) => x && (x.until ?? x.reset ? now < (x.until ?? x.reset) : !resetsBetween("weekly", x.at, now));
  // None held: nothing to run, whatever the timers say.
  const sure = cap === 0 || done < cap || inPeriod(ch.passagesLeft) || (!prev?.guess && inPeriod(prev));
  ch.counts ||= {};
  ch.counts["abyss:corridors"] = sure
    ? kept(prev, { v: [done, 0], at: now, reset: siege?.next, cap })
    : kept(prev, { v: [0, 0], at: now, reset: siege?.next, cap, guess: true });
}

a2.on("game", ({ running }) => {
  gameRunning = !!running;
  if (!gameRunning && current && state.chars[current]) state.chars[current].seen = Date.now();
  if (!gameRunning) current = null;
  save();
  render();
});
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));
a2.on("language", (code) => {
  const c = String(code || "");
  lang = UI[c] ? c : UI[c.split("-")[0]] ? c.split("-")[0] : "en";
  t = UI[lang];
  fmt = new Intl.NumberFormat(lang);
  applyLanguage();
  render();
});

// ── Drawing ────────────────────────────────────────────────────────────────
let fmt = new Intl.NumberFormat("en");
function span(ms) {
  const m = Math.max(0, Math.round(ms / 60_000));
  const u = t.units;
  if (m >= 1440) return `${Math.floor(m / 1440)}${u.d}${u.sep}${Math.floor((m % 1440) / 60)}${u.h}`;
  if (m >= 60) return `${Math.floor(m / 60)}${u.h}${u.sep}${m % 60}${u.m}`;
  return `${m}${u.m}`;
}
function ago(at, now) {
  const m = Math.round((now - at) / 60_000);
  const u = t.units;
  if (m < 2) return t.justNow;
  if (m < 60) return t.ago(`${m}${u.m}`);
  if (m < 48 * 60) return t.ago(`${Math.round(m / 60)}${u.h}`);
  return t.ago(`${Math.round(m / 1440)}${u.d}`);
}
const clock = (at) => new Date(at).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" });
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const serverName = (id) => SERVERS[lang]?.[id] || SERVERS.en?.[id] || (id ? t.serverN(id) : "");

// A membership is the account's, not a character's: once any character has
// been seen over 560, every one fills to 840 (#121: one at 840/840, two on
// the same server still counted to 560, the third "full" two days late).
// The evidence holds a month, as long as a membership runs, and each
// sighting over 560 renews it; a character seen at 840 before this counts
// from its last reading.
const MEMBER_KEEP_MS = 31 * 24 * 60 * 60 * 1000;
const memberSince = (ch) => ch.memberAt || (ch.cap === CAPS[0] ? ch.energy?.at || 0 : 0);
function capFor(ch, now) {
  // Set by hand (a click on its cap): the player's word.
  if (ch.capSet) return ch.cap;
  const latest = Math.max(0, ...Object.values(state.chars).map(memberSince));
  return latest && now - latest <= MEMBER_KEEP_MS ? CAPS[0] : ch.cap ?? CAPS[1];
}

// Each character's numbers as they likely are now.
function view(key, ch, now) {
  const cap = capFor(ch, now);
  const est = estimate(ch.energy, now, cap);
  const full = fullAt(ch.energy, cap);
  return { key, ch, cap, est, full, playing: key === current && gameRunning };
}

function sorted(rows) {
  const by = {
    name: (a, b) => a.ch.name.localeCompare(b.ch.name),
    cp: (a, b) => (b.ch.cp || 0) - (a.ch.cp || 0),
    gs: (a, b) => (b.ch.gs || 0) - (a.ch.gs || 0),
    energy: (a, b) => (b.est?.basic ?? -1) - (a.est?.basic ?? -1),
    full: (a, b) => (a.est?.full ? 0 : a.full ?? Infinity) - (b.est?.full ? 0 : b.full ?? Infinity),
    seen: (a, b) => (b.playing - a.playing) || (b.ch.seen || 0) - (a.ch.seen || 0),
  }[state.prefs.sort] || ((a, b) => a.ch.name.localeCompare(b.ch.name));
  return rows.sort((a, b) => by(a, b) || a.ch.name.localeCompare(b.ch.name));
}

// Display filtering never removes saved characters or changes their totals.
function visibleCharacter({ key, ch }) {
  const playing = state.chars[current];
  if (!playing) return true;
  if (state.prefs.display === "character") return key === current;
  if (state.prefs.display === "server") return ch.serverId === playing.serverId;
  if (state.prefs.display === "faction") {
    const side = sideOf(playing.serverId);
    return !side || sideOf(ch.serverId) === side;
  }
  return true;
}

function render() {
  if (state.prefs.tab !== "roster") {
    renderContent();
    return;
  }
  const now = Date.now();
  // The refill dial: how far through the 3 hours to the next +15.
  const next = nextRefill(now);
  const done = 100 - ((next - now) / EVERY) * 100;
  $(".dialFill").style.strokeDasharray = `${done} 100`;
  $(".refillIn").textContent = t.in(span(next - now));
  $(".refillIn").title = t.atYourTime(clock(next));
  const daily = nextDaily(now);
  const weekly = nextWeekly(now);
  $(".resets").replaceChildren(
    resetChip(t.dailyReset, daily, now),
    resetChip(t.weeklyReset, weekly, now),
  );

  const q = $(".search").value.trim().toLowerCase();
  const all = Object.entries(state.chars).map(([key, ch]) => view(key, ch, now));
  const rows = sorted(all.filter(visibleCharacter).filter((r) => !q || `${r.ch.name} ${serverName(r.ch.serverId)}`.toLowerCase().includes(q)));
  $(".count").textContent = all.length ? t.count(rows.length, all.length) : "";

  // Full: each refill until they spend some is lost.
  const capped = all.filter((r) => r.est?.full && !r.playing);
  $(".capped").hidden = !capped.length;
  if (capped.length) {
    $(".capped").replaceChildren(
      el("strong", null, t.cappedTitle),
      ...capped.map((r) => el("span", "cappedName", r.ch.name)),
    );
  }

  const list = $(".list");
  list.replaceChildren(...rows.map(rowOf));
  const empty = $(".empty");
  empty.hidden = rows.length > 0;
  empty.textContent = all.length ? t.noMatch : t.empty;
  const anyStats = all.some((r) => r.ch.cp || r.ch.gs || r.ch.energy);
  $(".foot").textContent = all.length && !anyStats ? t.footOld : t.foot;
}

// ── Content ────────────────────────────────────────────────────────────────
// Each content's cap and recharge, as the game's own tooltips give them
// (Nightmare, Shugo Festival, Ascension Trial, 2026-10-22); Invasion and
// Daily Duty as another roster app shows them. scope: "char" counts per
// character, "server" is shared by every character on a server. The extra
// count the game sends beside one (recharge items) comes on top.
// id: its entry in the game's entry counts (2026-10-24: Nightmare 1+1 and
// Ascension 3+1 as the game showed; Invasion 7 to 6 as a key was used).
// Daily Duty (id 0) is no entry of the game's: the meter reads the Daily
// Duty board, [completed, taken] today. Only completed is shown (taken but
// not done isn't progress); it counts up: "used".
// name: its key among the words' names.
const CONTENT = [
  { name: "nightmare", id: 4, scope: "char", cap: 14, add: 2, every: "daily" },
  { name: "shugo", id: 1, scope: "server", cap: 21, add: 3, every: "daily" },
  { name: "invasion", id: 8, scope: "server", cap: 7, add: 1, every: "daily" },
  // The limit is the server's, the sum of each character's today: each has
  // its own board (the meter sends the one logged in, 0 for one not used
  // since the reset). Kept per character, shown as the server's total.
  { name: "duty", id: 0, scope: "server", ofChars: true, cap: 5, add: 5, every: "daily", used: true },
  { name: "ascension", id: 80000001, scope: "char", cap: 3, add: 3, every: "weekly" },
  // From the passages' timers (see the character event): 0/3 on Nully with
  // three, 2/3 on Nullception with one, as the game showed (2026-10-25).
  { name: "corridors", id: "abyss:corridors", scope: "char", cap: 3, add: 3, every: "weekly", used: true, siege: true },
  // The game's tooltip: 14/14 (+3), +14 a week, applied per server; the
  // only 14+3 entry in the list (2026-10-24).
  { name: "dungeon", id: 101, scope: "server", cap: 14, add: 14, every: "weekly" },
];

// The Other tab: weekly limits from the shop and the crafting window. id:
// "shop:<item>" or "craft:<recipe>" (as the meter names them, 2026-10-25:
// the server's Odyle Energy craft 1, 2, 3 and the character's 0 to 1, as the
// game showed 3/16 and 1/4). The shop's Odyle Energy, 4 a character and 16 a
// server (BMShopGoods 1209 and 1210), replaced 20 a character (100134) and
// Rift Stones (100135) on 2026-10-29 (#123).
// Each side crafts its own recipe: 3207000N Asmodian, 3107000N Elyos (the
// game's ConversionRecipe table; #123). Kept under the Asmodian id either way.
const OTHER = [
  { name: "odyleCraft", id: "craft:32070001", elyos: "31070001", scope: "server", cap: 16, add: 16, every: "weekly", used: true },
  { name: "odyleCraft", id: "craft:32070002", elyos: "31070002", scope: "char", cap: 4, add: 4, every: "weekly", used: true },
  { name: "buyOdyle", id: "shop:1210", scope: "server", cap: 16, add: 16, every: "weekly", used: true },
  { name: "buyOdyle", id: "shop:1209", scope: "char", cap: 4, add: 4, every: "weekly", used: true },
  // The game's own: 1534 Kinah and 50659 Abyss Points of 2,000,000 as it
  // showed them (2026-10-25). The Abyss limit comes with the points.
  { name: "kinah", id: "kinah:today", scope: "char", cap: 1_000_000, add: 0, every: "daily", used: true },
  { name: "abyss", id: "abyss:week", scope: "char", cap: 2_000_000, add: 0, every: "weekly", used: true, capFromGame: true },
];
const PASSAGES = [10000001, 10000002, 10000003];
// A server's side, as its id says: 1xxx Elyos, 2xxx Asmodian.
const sideOf = (serverId) => ({ 1: "elyos", 2: "asmodian" })[String(serverId ?? "")[0]];

// The recharges between two times: daily or weekly resets passed.
function resetsBetween(every, from, to) {
  let n = 0;
  for (let t = every === "daily" ? nextDaily(from) : nextWeekly(from); t <= to && n < 60;
    t += every === "daily" ? 86_400_000 : 7 * 86_400_000) n++;
  return n;
}

// A count as it likely is now: { left, extra, gained, full }, from what the
// game last said and the recharges since (a daily reset back to its cap).
function countNow(c, seen, now) {
  if (!seen) return null;
  // Past a siege the corridors may or may not have reset: not known until
  // the game says again.
  if (c.siege && seen.reset && now >= seen.reset) return null;
  // No time on any passage and none seen this holding: likely none done.
  if (seen.guess) return { left: 0, extra: 0, gained: 0, full: false, reset: true };
  // The shop says when its count resets; else the game's daily or weekly.
  const passed = seen.reset ? (now >= seen.reset ? 1 : 0) : resetsBetween(c.every, seen.at, now);
  const [was, extra] = seen.v;
  // Taken today: none again after a reset.
  if (c.used) {
    const left = passed ? 0 : was;
    return { left, extra, gained: 0, full: left >= c.cap, reset: passed > 0 };
  }
  const grown = Math.min(c.cap, was + passed * c.add);
  const left = Math.max(was, grown);
  return { left, extra, gained: left - was, full: left >= c.cap };
}

function renderContent() {
  const now = Date.now();
  const other = state.prefs.tab === "other";
  const list = other ? OTHER : CONTENT;
  const table = $(".contentTable");
  // The server and characters of who is playing, else of the last played.
  const chars = Object.entries(state.chars).map(([key, ch]) => ({ key, ch }));
  const lead = state.chars[current] || chars.slice().sort((a, b) => (b.ch.seen || 0) - (a.ch.seen || 0))[0]?.ch;
  const serverId = lead?.serverId;
  const mine = chars.filter((c) => c.ch.serverId === serverId)
    .sort((a, b) => (b.key === current) - (a.key === current) || a.ch.name.localeCompare(b.ch.name));
  const visible = mine.filter(visibleCharacter);

  const head = el("tr");
  head.append(el("th", null, t.content));
  const server = el("th", "serverCol", t.server);
  server.append(el("span", "colSub", serverName(serverId) || t.allChars));
  head.append(server);
  for (const { key, ch } of visible) {
    const th = el("th", null, ch.name);
    th.append(el("span", "colSub", key === current && gameRunning ? t.playing : ch.seen ? t.seenAgo(ago(ch.seen, now)) : ""));
    head.append(th);
  }
  const thead = el("thead");
  thead.append(head);

  const tbody = el("tbody");
  const cols = 2 + visible.length;
  for (const every of ["daily", "weekly"]) {
    const at = every === "daily" ? nextDaily(now) : nextWeekly(now);
    const group = el("tr", "group");
    const th = el("th", null, every === "daily" ? t.dailyRecharge : t.weeklyRecharge);
    th.colSpan = cols;
    th.append(el("span", "when", t.in(span(at - now))));
    th.title = t.yourTime(clock(at));
    group.append(th);
    tbody.append(group);
    const rows = list.filter((x) => x.every === every);
    if (!rows.length) {
      group.remove();
      continue;
    }
    for (const c of rows) {
      const tr = el("tr");
      const name = el("td");
      name.append(el("div", "cName", t.names[c.name]));
      const meta = el("div", "cMeta");
      meta.append(el("span", `scope ${c.scope}`, c.scope === "char" ? t.perChar : t.serverWide),
        el("span", null, c.siege ? t.perSiege(c.cap) : c.used ? (every === "weekly" ? t.perWeek(fmt.format(c.cap)) : t.perDay(fmt.format(c.cap))) : t.capLine(c.cap, c.add, every === "weekly")));
      name.append(meta);
      tr.append(name);
      const shared = c.ofChars ? sumOfChars(c, mine, now) : state.servers[serverId ?? ""]?.counts?.[c.id];
      tr.append(c.scope === "server" ? cellOf(c, shared, at, now, "serverCol") : el("td", "serverCol na"));
      for (const m of visible) tr.append(c.scope === "char" ? cellOf(c, m.ch.counts?.[c.id], at, now) : el("td", "na"));
      tbody.append(tr);
    }
  }
  table.replaceChildren(thead, tbody);
  // Meters before 2.0.78 send no counts: say so rather than only "?".
  const ids = new Set(list.map((x) => String(x.id)));
  const has = (counts) => counts && Object.keys(counts).some((id) => ids.has(id));
  const any = chars.some(({ ch }) => has(ch.counts)) || Object.values(state.servers).some((s) => has(s.counts));
  $(".placeholder").textContent = other ? (any ? t.otherNote : t.otherNone) : any ? t.placeholder : t.placeholderNone;
}

// A server's total of a count kept per character (Daily Duty): each one's
// today (none after a reset) added up, as last seen; undefined before any.
function sumOfChars(c, chars, now) {
  const today = chars.map((m) => m.ch.counts?.[c.id]).filter((seen) => seen && !countNow(c, seen, now).reset);
  if (!today.length) return undefined;
  return {
    v: [today.reduce((n, s) => n + s.v[0], 0), today.reduce((n, s) => n + s.v[1], 0)],
    at: Math.max(...today.map((s) => s.at)),
  };
}

// A count: left / cap (+extra), a bar, and when it next recharges. "?" when
// the game hasn't said it yet (or its entry isn't known).
function cellOf(c, seen, at, now, cls = "") {
  if (seen?.cap >= 0 && (seen.cap > 0 || c.siege)) c = { ...c, cap: seen.cap };
  const td = el("td", `cell ${cls}`.trim());
  // Nothing to do (your side holds no corridor's artifact): a dash.
  if (c.cap === 0 && seen) {
    td.append(el("div", "cellValue unknownValue", "—"), el("div", "bar"), el("div", "cellNote", c.siege ? t.noneHeld : ""));
    td.title = c.siege ? t.tipNoneHeld : "";
    return td;
  }
  const est = countNow(c, seen, now);
  const value = el("div", `cellValue${est ? "" : " unknownValue"}`);
  value.append(el("b", null, est ? `${est.gained || est.reset ? "≈" : ""}${fmt.format(est.left)}` : "?"), el("span", "of", ` / ${fmt.format(c.cap)}`));
  if (est?.extra && !c.used) value.append(el("span", "extra", ` +${est.extra}`));
  const bar = el("div", "bar");
  if (est) {
    const fill = el("span", "barSeen");
    fill.style.width = `${Math.min(100, ((est.left - est.gained) / c.cap) * 100)}%`;
    const grown = el("span", "barGrown");
    grown.style.width = `${Math.min(100, (est.gained / c.cap) * 100)}%`;
    bar.append(fill, grown);
  }
  const next = seen?.reset && seen.reset > now ? seen.reset : at;
  const note = c.used
    ? (c.siege ? (est && seen.reset > now ? t.untilSiege(span(seen.reset - now)) : "")
      : est?.full ? t.allDone : c.id === 0 ? t.doneToday(span(at - now)) : c.every === "daily" ? t.usedToday(span(next - now)) : t.usedWeek(span(next - now)))
    : est?.full ? t.full : t.plusIn(c.add, span(at - now));
  td.append(value, bar, el("div", `cellNote${est?.full ? " isFull" : ""}`, note));
  if (est?.full) td.classList.add("full");
  td.title = !est
    ? (c.id == null ? t.tipUnknownRecord : c.siege ? (seen ? t.tipAfterSiege : t.tipCorridorsUnknown) : t.tipNotSeen)
    : c.used
      ? (c.id !== 0 ? (est.reset ? t.tipUsedReset(seen.v[0]) : c.id.startsWith("shop:") || c.id.startsWith("craft:") ? t.tipUsed(est.left, ago(seen.at, now)) : t.tipSaid(ago(seen.at, now), 0))
        : est.reset ? t.tipDutyReset(seen.v[0]) : t.tipDutyToday(est.left, seen.v[1], ago(seen.at, now)))
    : est.gained
      ? t.tipGained(est.left - est.gained, ago(seen.at, now), est.gained, est.extra)
      : t.tipSaid(ago(seen.at, now), est.extra);
  return td;
}

function showTab(tab) {
  state.prefs.tab = ["content", "other"].includes(tab) ? tab : "roster";
  const table = state.prefs.tab !== "roster";
  document.body.classList.toggle("tab-content", table);
  $(".contentView").hidden = !table;
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === state.prefs.tab));
  render();
}
$(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  showTab(b.dataset.tab);
  save();
});

function resetChip(label, at, now) {
  const chip = el("span", "chip");
  chip.append(el("span", "chipLabel", label), el("span", "chipValue", span(at - now)));
  chip.title = t.yourTime(clock(at));
  return chip;
}
// The game's resets: 07:00 UTC daily, Wednesday 07:00 UTC weekly.
function nextDaily(now) {
  const d = new Date(now);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 7);
  if (t <= now) t += 86_400_000;
  return t;
}
function nextWeekly(now) {
  let t = nextDaily(now);
  while (new Date(t).getUTCDay() !== 3) t += 86_400_000;
  return t;
}

function rowOf(r) {
  const { ch, cap: capOf, est, full, playing } = r;
  const now = Date.now();
  const li = el("li", "row");
  li.dataset.key = r.key;
  if (playing) li.classList.add("playing");
  if (est?.full) li.classList.add("full");
  const [classAt, color] = CLASSES[ch.class] || [null, "#8a93a6"];
  const className = classAt == null ? null : t.classes[classAt];
  li.style.setProperty("--c", color);

  const who = el("div", "who");
  const badge = el("span", "badge", (className || ch.name).slice(0, 1).toUpperCase());
  badge.title = className || t.classUnknown;
  const names = el("div", "names");
  const nameLine = el("div", "name", ch.name);
  if (playing) nameLine.append(el("span", "now", t.playing));
  const sub = [className, ch.level ? t.lv(ch.level) : null, serverName(ch.serverId)].filter(Boolean).join(" · ");
  names.append(nameLine, el("div", "sub", sub));
  if (!playing && ch.seen) names.append(el("div", "seen", t.playedAgo(ago(ch.seen, now))));
  const remove = el("button", "remove", "×");
  remove.type = "button";
  remove.title = t.removeTip;
  who.append(badge, names, remove);

  const cp = el("div", `num cp${ch.cp ? "" : " none"}`, ch.cp ? fmt.format(ch.cp) : "—");
  cp.dataset.label = t.colCombat;
  const gs = el("div", `num gs${ch.gs ? "" : " none"}`, ch.gs ? fmt.format(ch.gs) : "—");
  gs.dataset.label = t.colGear;

  const energy = el("div", "energy");
  if (est) {
    const top = el("div", "energyTop");
    const value = el("span", "energyValue", `${est.gained ? "≈" : ""}${fmt.format(est.basic)}`);
    const cap = el("button", "cap", `/ ${capOf}`);
    cap.type = "button";
    cap.title = t.capTip;
    top.append(value, cap);
    const bar = el("div", "bar");
    const seenPart = el("span", "barSeen");
    seenPart.style.width = `${Math.min(100, (ch.energy.basic / capOf) * 100)}%`;
    const grownPart = el("span", "barGrown");
    grownPart.style.width = `${Math.min(100, (est.gained / capOf) * 100)}%`;
    bar.append(seenPart, grownPart);
    energy.append(top, bar);
    energy.title = est.gained
      ? t.energyGained(ch.energy.basic, ago(ch.energy.at, now), est.gained)
      : t.energySaid(ago(ch.energy.at, now));
  } else {
    energy.append(el("span", "unknown", "—"));
    energy.title = t.tipNotSeen;
  }

  const charged = el("div", `num charged${est ? "" : " none"}`, est ? fmt.format(est.charged) : "—");
  charged.dataset.label = t.colCharged;
  const fullIn = el("div", "num fullIn");
  if (!est) fullIn.append(el("span", "unknown", "—"));
  else if (est.full) fullIn.append(el("span", "isFull", t.fullLabel));
  else {
    fullIn.append(el("span", null, span(full - now)), el("span", "fullWhen", clock(full)));
  }
  fullIn.dataset.label = t.colFullIn;

  li.append(who, cp, gs, energy, charged, fullIn);
  return li;
}

// ── Using it ───────────────────────────────────────────────────────────────
$(".list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-key]");
  if (!li) return;
  const ch = state.chars[li.dataset.key];
  if (!ch) return;
  if (e.target.closest(".cap")) {
    // From what it shows now (the account's 840 too), to the other.
    ch.cap = capFor(ch, Date.now()) === CAPS[0] ? CAPS[1] : CAPS[0];
    ch.capSet = true;
    save();
    render();
  } else if (e.target.closest(".remove")) {
    // A second click within 3 s removes it.
    const button = e.target.closest(".remove");
    if (button.classList.contains("confirm")) {
      delete state.chars[li.dataset.key];
      save();
      render();
    } else {
      button.classList.add("confirm");
      button.textContent = t.removeConfirm;
      setTimeout(() => render(), 3000);
    }
  }
});
$(".search").addEventListener("input", render);
$(".sort").addEventListener("change", (e) => {
  state.prefs.sort = e.target.value;
  save();
  render();
});
$(".display").addEventListener("change", (e) => {
  state.prefs.display = e.target.value;
  save();
  render();
});

// The page's fixed words (index.html), in the meter's language.
function applyLanguage() {
  document.documentElement.lang = lang;
  const tabs = { roster: t.tabRoster, content: t.tabContent, other: t.tabOther };
  for (const b of document.querySelectorAll(".tabs button")) b.textContent = tabs[b.dataset.tab];
  $(".refillLabel").textContent = t.nextRefill;
  $(".search").placeholder = t.search;
  $(".sort").title = t.order;
  $(".displayFilter span").textContent = t.show;
  for (const o of $(".display").options) o.textContent = t.display[o.value];
  for (const o of $(".sort").options) o.textContent = t.sort[o.value] ?? o.textContent;
  const cols = [t.colChar, t.colCombat, t.colGear, t.colBasic, t.colCharged, t.colFullIn];
  document.querySelectorAll(".head span").forEach((s, i) => (s.textContent = cols[i] ?? s.textContent));
}

// ── Start ──────────────────────────────────────────────────────────────────
(async () => {
  const [chars, prefs, servers] = await Promise.all([
    a2.storage.get("chars").catch(() => null),
    a2.storage.get("prefs").catch(() => null),
    a2.storage.get("servers").catch(() => null),
  ]);
  if (chars && typeof chars === "object") state.chars = chars;
  if (servers && typeof servers === "object") state.servers = servers;
  Object.assign(state.prefs, prefs || {});
  for (const key of ["chars", "prefs", "servers"]) written[key] = JSON.stringify(state[key]);
  // Characters kept with no server (#122): gone where the same name has its
  // server, what they had that it lacks kept with it.
  let merged = false;
  for (const [key, ch] of Object.entries(state.chars)) {
    if (ch?.serverId) continue;
    const real = Object.values(state.chars).find((other) => other !== ch && other?.serverId && other.name === ch?.name);
    if (!real) continue;
    for (const [field, value] of Object.entries(ch)) if (real[field] == null) real[field] = value;
    delete state.chars[key];
    merged = true;
  }
  if (merged) save();
  $(".sort").value = state.prefs.sort;
  if (!["all", "faction", "server", "character"].includes(state.prefs.display)) state.prefs.display = "all";
  $(".display").value = state.prefs.display;
  showTab(state.prefs.tab);
  a2.ready();
  // The countdowns, and the one playing stays "seen now" (saved every 5 min).
  let seenSaved = Date.now();
  setInterval(() => {
    if (current && gameRunning && state.chars[current]) {
      state.chars[current].seen = Date.now();
      if (Date.now() - seenSaved >= 300_000) {
        seenSaved = Date.now();
        save();
      }
    }
    // The siege known passed: the site's next one (askSiege waits 10 min
    // between asks).
    const playing = state.chars[current];
    if (playing && state.servers[playing.serverId ?? ""]?.siege?.next <= Date.now()) askSiege(playing.serverId);
    if (!document.querySelector(".remove.confirm")) render();
  }, 30_000);
})();
