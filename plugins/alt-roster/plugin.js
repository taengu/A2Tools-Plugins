// Roster / Content Overview: every character you play, with what the meter last saw of
// them (class, level, combat power, gear score, Odyle energy), kept between
// sessions. Basic energy refills while you are away, so it is shown as it
// likely is now (≈), until the game says again.
const { CAPS, nextRefill, estimate, fullAt, EVERY } = globalThis.RosterLogic;
const SERVERS = globalThis.ROSTER_SERVERS || {};
const $ = (sel, root = document) => root.querySelector(sel);

// The meter names classes in Korean.
const CLASSES = {
  "검성": ["Gladiator", "#e0a04a"],
  "수호성": ["Templar", "#7fa7d9"],
  "궁성": ["Ranger", "#7cc46a"],
  "살성": ["Assassin", "#c46ad1"],
  "마도성": ["Sorcerer", "#e06a6a"],
  "치유성": ["Cleric", "#f0d36a"],
  "정령성": ["Spiritmaster", "#6ad1c4"],
  "호법성": ["Chanter", "#d18f6a"],
  "권성": ["Fighter", "#a3a3a3"],
};

// chars: { "<name>@<server>": { name, serverId, class, level, cp, gs,
//   energy: { basic, charged, at }, cap, seen, counts } }
// servers: { "<serverId>": { counts } } for content shared on a server.
// counts: { "<entry id>": { v: [left, extra], at } } as the game last said.
const state = { chars: {}, servers: {}, prefs: { sort: "name", tab: "roster" } };
let current = null; // the key of who is playing now
let gameRunning = true; // meters before 2.0.65 don't say
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    a2.storage.set("chars", state.chars).catch((e) => console.warn(e));
    a2.storage.set("prefs", state.prefs).catch((e) => console.warn(e));
    a2.storage.set("servers", state.servers).catch((e) => console.warn(e));
  }, 400);
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

// ── What the meter says ────────────────────────────────────────────────────
a2.on("character", (c) => {
  if (!c?.name) return;
  const key = `${c.name}@${c.serverId ?? ""}`;
  const ch = (state.chars[key] ||= { name: c.name, serverId: c.serverId, cap: CAPS[0] });
  ch.name = c.name;
  if (c.serverId) ch.serverId = c.serverId;
  if (c.class) ch.class = c.class;
  if (num(c.level)) ch.level = c.level;
  // Meters up to 2.0.77 send none of these: what was seen stays.
  if (num(c.combatPower)) ch.cp = c.combatPower;
  if (num(c.gearScore)) ch.gs = c.gearScore;
  const e = c.odyleEnergy;
  if (e && Number.isFinite(e.basic) && Number.isFinite(e.charged)) {
    ch.energy = { basic: e.basic, charged: e.charged, at: Date.now() };
    // Over 560 can only be with a membership.
    if (e.basic > CAPS[1]) ch.cap = CAPS[0];
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
      (home.counts ||= {})[x.id] = { v: [Number(v[0]) || 0, Number(v[1]) || 0], at };
    }
  }
  ch.seen = Date.now();
  current = key;
  save();
  render();
});
a2.on("game", ({ running }) => {
  gameRunning = !!running;
  if (!gameRunning && current && state.chars[current]) state.chars[current].seen = Date.now();
  if (!gameRunning) current = null;
  save();
  render();
});
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

// ── Drawing ────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat("en");
function span(ms) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}
function ago(at, now) {
  const m = Math.round((now - at) / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
const clock = (t) => new Date(t).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const serverName = (id) => SERVERS[id] || (id ? `Server ${id}` : "");

// Each character's numbers as they likely are now.
function view(key, ch, now) {
  const est = estimate(ch.energy, now, ch.cap);
  const full = fullAt(ch.energy, ch.cap);
  return { key, ch, est, full, playing: key === current && gameRunning };
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

function render() {
  if (state.prefs.tab === "content") {
    renderContent();
    return;
  }
  const now = Date.now();
  // The refill dial: how far through the 3 hours to the next +15.
  const next = nextRefill(now);
  const done = 100 - ((next - now) / EVERY) * 100;
  $(".dialFill").style.strokeDasharray = `${done} 100`;
  $(".refillIn").textContent = `in ${span(next - now)}`;
  $(".refillIn").title = `At ${clock(next)}, your time`;
  const daily = nextDaily(now);
  const weekly = nextWeekly(now);
  $(".resets").replaceChildren(
    resetChip("Daily reset", daily, now),
    resetChip("Weekly reset", weekly, now),
  );

  const q = $(".search").value.trim().toLowerCase();
  const all = Object.entries(state.chars).map(([key, ch]) => view(key, ch, now));
  const rows = sorted(all.filter((r) => !q || `${r.ch.name} ${serverName(r.ch.serverId)}`.toLowerCase().includes(q)));
  $(".count").textContent = all.length ? `${rows.length === all.length ? "" : `${rows.length} of `}${all.length} character${all.length === 1 ? "" : "s"}` : "";

  // Full: each refill until they spend some is lost.
  const capped = all.filter((r) => r.est?.full && !r.playing);
  $(".capped").hidden = !capped.length;
  if (capped.length) {
    $(".capped").replaceChildren(
      el("strong", null, "Full: the next refill is lost"),
      ...capped.map((r) => el("span", "cappedName", r.ch.name)),
    );
  }

  const list = $(".list");
  list.replaceChildren(...rows.map(rowOf));
  const empty = $(".empty");
  empty.hidden = rows.length > 0;
  empty.textContent = all.length ? "No character matches." : "Log in to a character and it shows up here. Each one you play is kept.";
  const anyStats = all.some((r) => r.ch.cp || r.ch.gs || r.ch.energy);
  $(".foot").textContent = all.length && !anyStats
    ? "Combat power, gear score and energy need a meter newer than 2.0.77."
    : "≈ estimated: +15 basic energy every 3 h while away. Click a cap to switch 840 (membership) / 560.";
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
const CONTENT = [
  { name: "Nightmare", id: 4, scope: "char", cap: 14, add: 2, every: "daily" },
  { name: "Shugo Festival", id: 1, scope: "server", cap: 21, add: 3, every: "daily" },
  { name: "Invasion", id: 8, scope: "server", cap: 7, add: 1, every: "daily" },
  // The limit is the server's, the sum of each character's today: each has
  // its own board (the meter sends the one logged in, 0 for one not used
  // since the reset). Kept per character, shown as the server's total.
  { name: "Daily Duty", id: 0, scope: "server", ofChars: true, cap: 5, add: 5, every: "daily", used: true },
  { name: "Ascension Trial", id: 80000001, scope: "char", cap: 3, add: 3, every: "weekly" },
  // The game's tooltip: 14/14 (+3), +14 a week, applied per server; the
  // only 14+3 entry in the list (2026-10-24).
  { name: "Daily Dungeon", id: 101, scope: "server", cap: 14, add: 14, every: "weekly" },
];

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
  const passed = resetsBetween(c.every, seen.at, now);
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
  const table = $(".contentTable");
  // The server and characters of who is playing, else of the last played.
  const chars = Object.entries(state.chars).map(([key, ch]) => ({ key, ch }));
  const lead = state.chars[current] || chars.slice().sort((a, b) => (b.ch.seen || 0) - (a.ch.seen || 0))[0]?.ch;
  const serverId = lead?.serverId;
  const mine = chars.filter((c) => c.ch.serverId === serverId)
    .sort((a, b) => (b.key === current) - (a.key === current) || a.ch.name.localeCompare(b.ch.name));

  const head = el("tr");
  head.append(el("th", null, "Content"));
  const server = el("th", "serverCol", "Server");
  server.append(el("span", "colSub", serverName(serverId) || "all characters"));
  head.append(server);
  for (const { key, ch } of mine) {
    const th = el("th", null, ch.name);
    th.append(el("span", "colSub", key === current && gameRunning ? "playing" : ch.seen ? `seen ${ago(ch.seen, now)}` : ""));
    head.append(th);
  }
  const thead = el("thead");
  thead.append(head);

  const tbody = el("tbody");
  const cols = 2 + mine.length;
  for (const every of ["daily", "weekly"]) {
    const at = every === "daily" ? nextDaily(now) : nextWeekly(now);
    const group = el("tr", "group");
    const th = el("th", null, every === "daily" ? "Daily recharge" : "Weekly recharge");
    th.colSpan = cols;
    th.append(el("span", "when", `in ${span(at - now)}`));
    th.title = `${clock(at)}, your time`;
    group.append(th);
    tbody.append(group);
    for (const c of CONTENT.filter((x) => x.every === every)) {
      const tr = el("tr");
      const name = el("td");
      name.append(el("div", "cName", c.name));
      const meta = el("div", "cMeta");
      meta.append(el("span", `scope ${c.scope}`, c.scope === "char" ? "PER CHARACTER" : "SERVER-WIDE"),
        el("span", null, c.used ? `${c.cap} a day` : `cap ${c.cap} · +${c.add} a ${every === "daily" ? "day" : "week"}`));
      name.append(meta);
      tr.append(name);
      const shared = c.ofChars ? sumOfChars(c, mine, now) : state.servers[serverId ?? ""]?.counts?.[c.id];
      tr.append(c.scope === "server" ? cellOf(c, shared, at, now, "serverCol") : el("td", "serverCol na"));
      for (const m of mine) tr.append(c.scope === "char" ? cellOf(c, m.ch.counts?.[c.id], at, now) : el("td", "na"));
      tbody.append(tr);
    }
  }
  table.replaceChildren(thead, tbody);
  // Meters up to 2.0.77 send no counts: say so rather than only "?".
  const any = chars.some(({ ch }) => ch.counts && Object.keys(ch.counts).length)
    || Object.values(state.servers).some((s) => s.counts && Object.keys(s.counts).length);
  $(".placeholder").textContent = any
    ? "As the game last said, per character or shared on the server. ≈ recharged since (estimated). +N: extra from recharge items."
    : "The counts need a meter newer than 2.0.77; then log in to each character once. Caps and recharge times are real.";
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
  const td = el("td", `cell ${cls}`.trim());
  const est = countNow(c, seen, now);
  const value = el("div", `cellValue${est ? "" : " unknownValue"}`);
  value.append(el("b", null, est ? `${est.gained || est.reset ? "≈" : ""}${est.left}` : "?"), el("span", "of", ` / ${c.cap}`));
  if (est?.extra && !c.used) value.append(el("span", "extra", ` +${est.extra}`));
  const bar = el("div", "bar");
  if (est) {
    const fill = el("span", "barSeen");
    fill.style.width = `${Math.min(100, ((est.left - est.gained) / c.cap) * 100)}%`;
    const grown = el("span", "barGrown");
    grown.style.width = `${Math.min(100, (est.gained / c.cap) * 100)}%`;
    bar.append(fill, grown);
  }
  const note = c.used
    ? (est?.full ? "all done" : `done today · new in ${span(at - now)}`)
    : est?.full ? "full" : `+${c.add} in ${span(at - now)}`;
  td.append(value, bar, el("div", `cellNote${est?.full ? " isFull" : ""}`, note));
  if (est?.full) td.classList.add("full");
  td.title = !est
    ? (c.id == null ? "The game's record for this isn't known yet" : "Not seen yet: log in to this character")
    : c.used
      ? (est.reset
        ? `${seen.v[0]} completed before the reset; none since, as far as known`
        : `${est.left} completed today on your characters, ${seen.v[1]} taken (the game's n/5 counts taken), as of ${ago(seen.at, now)}`)
    : est.gained
      ? `${est.left - est.gained} when last seen (${ago(seen.at, now)}), +${est.gained} recharged since${est.extra ? `; ${est.extra} extra` : ""}`
      : `As the game said ${ago(seen.at, now)}${est.extra ? `; ${est.extra} extra (recharge items)` : ""}`;
  return td;
}

function showTab(tab) {
  state.prefs.tab = tab === "content" ? "content" : "roster";
  document.body.classList.toggle("tab-content", state.prefs.tab === "content");
  $(".contentView").hidden = state.prefs.tab !== "content";
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
  chip.title = `${clock(at)}, your time`;
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
  const { ch, est, full, playing } = r;
  const now = Date.now();
  const li = el("li", "row");
  li.dataset.key = r.key;
  if (playing) li.classList.add("playing");
  if (est?.full) li.classList.add("full");
  const [className, color] = CLASSES[ch.class] || [null, "#8a93a6"];
  li.style.setProperty("--c", color);

  const who = el("div", "who");
  const badge = el("span", "badge", (className || ch.name).slice(0, 1).toUpperCase());
  badge.title = className || "Class not known yet";
  const names = el("div", "names");
  const nameLine = el("div", "name", ch.name);
  if (playing) nameLine.append(el("span", "now", "playing"));
  const sub = [className, ch.level ? `Lv ${ch.level}` : null, serverName(ch.serverId)].filter(Boolean).join(" · ");
  names.append(nameLine, el("div", "sub", sub));
  if (!playing && ch.seen) names.append(el("div", "seen", `played ${ago(ch.seen, now)}`));
  const remove = el("button", "remove", "×");
  remove.type = "button";
  remove.title = "Remove from the roster (it comes back when you play it)";
  who.append(badge, names, remove);

  const cp = el("div", `num cp${ch.cp ? "" : " none"}`, ch.cp ? fmt.format(ch.cp) : "—");
  cp.dataset.label = "Combat";
  const gs = el("div", `num gs${ch.gs ? "" : " none"}`, ch.gs ? fmt.format(ch.gs) : "—");
  gs.dataset.label = "Gear";

  const energy = el("div", "energy");
  if (est) {
    const top = el("div", "energyTop");
    const value = el("span", "energyValue", `${est.gained ? "≈" : ""}${fmt.format(est.basic)}`);
    const cap = el("button", "cap", `/ ${ch.cap}`);
    cap.type = "button";
    cap.title = "The cap: 840 with a membership, 560 without. Click to switch.";
    top.append(value, cap);
    const bar = el("div", "bar");
    const seenPart = el("span", "barSeen");
    seenPart.style.width = `${Math.min(100, (ch.energy.basic / ch.cap) * 100)}%`;
    const grownPart = el("span", "barGrown");
    grownPart.style.width = `${Math.min(100, (est.gained / ch.cap) * 100)}%`;
    bar.append(seenPart, grownPart);
    energy.append(top, bar);
    energy.title = est.gained
      ? `${ch.energy.basic} when last seen (${ago(ch.energy.at, now)}), about +${est.gained} since`
      : `As the game said ${ago(ch.energy.at, now)}`;
  } else {
    energy.append(el("span", "unknown", "—"));
    energy.title = "Not seen yet: log in to this character";
  }

  const charged = el("div", `num charged${est ? "" : " none"}`, est ? fmt.format(est.charged) : "—");
  charged.dataset.label = "Charged";
  const fullIn = el("div", "num fullIn");
  if (!est) fullIn.append(el("span", "unknown", "—"));
  else if (est.full) fullIn.append(el("span", "isFull", "Full"));
  else {
    fullIn.append(el("span", null, span(full - now)), el("span", "fullWhen", clock(full)));
  }
  fullIn.dataset.label = "Full in";

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
    ch.cap = ch.cap === CAPS[0] ? CAPS[1] : CAPS[0];
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
      button.textContent = "Remove?";
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
  $(".sort").value = state.prefs.sort;
  showTab(state.prefs.tab);
  a2.ready();
  // The countdowns, and the one playing stays "seen now".
  setInterval(() => {
    if (current && gameRunning && state.chars[current]) state.chars[current].seen = Date.now();
    if (!document.querySelector(".remove.confirm")) render();
  }, 30_000);
  setInterval(save, 300_000);
})();
