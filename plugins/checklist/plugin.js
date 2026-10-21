// Daily Checklist: your dailies and weeklies, the same items for every
// character, each character's ticks cleared at the game's resets.
//
// Automatic ticks: the game tells the client its entry counts as they change
// (`0c 61`, the list Odyle energy is the first entry of). The ids carry no
// names, so the first time a count the checklist doesn't know goes down, it
// asks which item that was; from then on a use ticks that item.
const { period, countsOf, usesOf } = globalThis.ChecklistLogic;
const $ = (sel, root = document) => root.querySelector(sel);
const KINDS = ["daily", "weekly", "once"];
// The lists that clear at a reset; one-time items stay ticked.
const RESETTING = ["daily", "weekly"];
const TITLE = { daily: "Daily", weekly: "Weekly", once: "One-time" };

// The lists to start with (from a common Aion 2 checklist). "main": only on
// the character marked as your main.
const DEFAULTS = {
  daily: [
    ["Daily Duty", "", true], ["Available Dungeons", "Run the dungeons open to you"], ["Abyss", "Daily Abyss participation"],
    ["Gathering", "Daily gathering route / materials"], ["Kinah", "Daily kinah cap"],
    ["Pet/Mount Soul Progression", "Collect souls toward 10-soul unlocks"], ["Daily Rewards", "Logins, shop, claims"],
    ["Shugo Fest Keys", "Daily Shugo Fest key"], ["Air Raid Keys", "Daily Air Raid key"], ["Daily Supply Request"],
  ],
  weekly: [
    ["Expeditions", "Weekly expedition goals"], ["Transcendence"], ["Sanctuary"], ["Abyss / AP", "Weekly Abyss points"],
    ["Weekly Shop", "Weekly purchase limits"], ["Ascension"], ["Conquest"], ["Nightmare", "Cap weekly-limited currencies"],
    ["Weekly Daily Dungeon", "", true], ["Weekly Scrolls", "Command merchant: Abyss / open world", true], ["Battlefield"],
    ["Weekly Supply Request"], ["Weekly Odyle Craft"],
  ],
  once: [
    ["Regional Quests"], ["Sealed Dungeons"], ["Strongholds"], ["Empyrean Trace Collection"], ["Region Completion"],
    ["Abyss Progression"], ["Important One-Time Rewards"], ["Collection Objectives"],
  ],
};
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const defaultItems = () =>
  Object.fromEntries(KINDS.map((k) => [k, DEFAULTS[k].map(([name, note = "", main = false]) => ({ id: newId(), name, note, main, target: 1, counter: null }))]));
const SHAPES = ["1", "0", "11", "10", "01", "21", "20"];

// ── Saved state ────────────────────────────────────────────────────────────
// items: the lists. progress: each character's ticks in the period they were
// made in. counters: each character's last entry counts. reminded: the
// period each character was last reminded of.
const state = {
  items: null, // the defaults until saved
  main: null, // your main character's key
  progress: {},
  counters: {},
  ignored: [],
  reminded: {},
  prefs: { minutes: 420, weekday: 3, remindDaily: 2, remindWeekly: 24, sound: "chime" },
  last: null,
};
const KEYS = Object.keys(state);
const dirty = new Set();
let saveTimer = 0;
function save(...keys) {
  for (const k of keys) dirty.add(k);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    for (const k of dirty) a2.storage.set(k, state[k]).catch((e) => console.warn(e));
    dirty.clear();
  }, 300);
}

// ── Who is playing ─────────────────────────────────────────────────────────
const keyOf = (c) => (c && c.name ? `${c.name}@${c.serverId ?? ""}` : null);
let me = null; // { key, name }
function setCharacter(c) {
  const key = keyOf(c);
  if (!key) return;
  me = { key, name: c.name };
  if (state.last?.key !== key) {
    state.last = me;
    save("last");
  }
  render();
}

// A character's ticks for the current period of a list, new ones at a reset.
function ticks(key, kind, now = Date.now()) {
  const start = kind === "once" ? 0 : period(kind, now, state.prefs).start;
  const p = (state.progress[key] ||= { name: key.split("@")[0] });
  if (!p[kind] || p[kind].start !== start) {
    p[kind] = { start, done: {} };
    save("progress");
  }
  return p[kind].done;
}
// The items a character has: "main only" ones only on your main (all of
// them while no main is set).
const itemsFor = (kind, key) => state.items[kind].filter((it) => !it.main || !state.main || state.main === key);
const isDone = (item, done) => (done[item.id] || 0) >= item.target;
const leftToDo = (key, kind) => {
  const done = ticks(key, kind);
  return itemsFor(kind, key).filter((it) => !isDone(it, done));
};

// ── Drawing ────────────────────────────────────────────────────────────────
let editing = false;
const counterName = (id) => `#${id - 60_000_000}`;
const span = (cls, text) => Object.assign(document.createElement("span"), { className: cls, textContent: text });

function knownCounters() {
  const ids = new Set();
  for (const per of Object.values(state.counters)) for (const id of Object.keys(per)) ids.add(Number(id));
  for (const kind of KINDS) for (const it of state.items[kind]) if (it.counter) ids.add(it.counter);
  return [...ids].sort((a, b) => a - b);
}

function itemRow(kind, item, done) {
  const li = document.createElement("li");
  li.dataset.id = item.id;
  if (editing) {
    const name = Object.assign(document.createElement("input"), { type: "text", className: "rename", value: item.name, maxLength: 60 });
    name.addEventListener("change", () => {
      item.name = name.value.trim() || item.name;
      save("items");
    });
    const target = Object.assign(document.createElement("input"), { type: "number", className: "target", min: 1, max: 99, value: item.target, title: "Times per reset" });
    target.addEventListener("change", () => {
      item.target = Math.min(99, Math.max(1, Math.round(Number(target.value) || 1)));
      save("items");
      render();
    });
    const counter = Object.assign(document.createElement("select"), { className: "counter", title: "The game counter that ticks it" });
    counter.append(new Option("Manual", ""));
    for (const id of knownCounters()) counter.append(new Option(`⚡ ${counterName(id)}`, String(id)));
    counter.value = item.counter ? String(item.counter) : "";
    counter.addEventListener("change", () => {
      item.counter = Number(counter.value) || null;
      save("items");
    });
    const remove = Object.assign(document.createElement("button"), { type: "button", className: "remove", textContent: "×", title: "Remove" });
    remove.addEventListener("click", () => {
      state.items[kind] = state.items[kind].filter((it) => it !== item);
      save("items");
      render();
    });
    const note = Object.assign(document.createElement("input"), { type: "text", className: "noteEdit", value: item.note || "", maxLength: 80, placeholder: "Note" });
    note.addEventListener("change", () => {
      item.note = note.value.trim();
      save("items");
    });
    const mainOnly = Object.assign(document.createElement("label"), { className: "mainEdit", title: "Only on your main character" });
    const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: !!item.main });
    box.addEventListener("change", () => {
      item.main = box.checked;
      save("items");
    });
    mainOnly.append(box, " Main only");
    li.classList.add("editRow");
    li.append(name, target, counter, remove, note, mainOnly);
    return li;
  }
  const n = done[item.id] || 0;
  li.classList.toggle("done", n >= item.target);
  const text = span("text", "");
  text.append(span("name", item.name));
  if (item.note) text.append(span("note", item.note));
  li.append(span("box", n >= item.target ? "✓" : ""), text);
  if (item.main) li.append(span("mainOnly", "main"));
  if (item.target > 1) li.append(span("count", `${Math.min(n, item.target)}/${item.target}`));
  if (item.counter) {
    const left = me && state.counters[me.key]?.[item.counter]?.left;
    if (typeof left === "number") li.append(span("left", `${left} left`));
    li.append(span("auto", "⚡"));
    li.title = `Ticks itself from game counter ${counterName(item.counter)}`;
  }
  return li;
}

function render() {
  document.body.classList.toggle("editing", editing);
  $(".edit").textContent = editing ? "Done" : "Edit";
  $(".settings").hidden = !editing;
  const who = me || state.last;
  $(".who").textContent = who ? who.name + (state.main === who.key ? " ★" : "") : "Log in to a character";
  $(".who").title = who && state.main === who.key ? "Your main" : "";
  $(".makeMain").hidden = !who;
  $(".makeMain").textContent = who && state.main === who.key ? `${who.name} is not my main` : `${who?.name ?? ""} is my main`;
  for (const kind of KINDS) {
    const section = $(`section[data-kind="${kind}"]`);
    const ul = $(".items", section);
    ul.replaceChildren();
    // Editing shows every item, main only or not.
    const items = editing || !who ? state.items[kind] : itemsFor(kind, who.key);
    const done = who ? ticks(who.key, kind) : {};
    for (const item of items) ul.append(itemRow(kind, item, done));
    if (!items.length && !editing) {
      ul.append(Object.assign(document.createElement("li"), { className: "empty", textContent: "Nothing yet: Edit to add some." }));
    }
    const count = items.filter((it) => isDone(it, done)).length;
    $(".tally", section).textContent = items.length ? `${count}/${items.length}` : "";
    section.classList.toggle("done", items.length > 0 && count === items.length);
    $(".add", section).hidden = !editing;
  }
  renderOthers(who);
  renderResets();
}

function renderOthers(who) {
  const parts = [];
  for (const [key, p] of Object.entries(state.progress)) {
    if (key === who?.key) continue;
    const tallies = RESETTING.filter((k) => itemsFor(k, key).length).map((kind) => {
      const done = ticks(key, kind);
      const items = itemsFor(kind, key);
      return `${items.filter((it) => isDone(it, done)).length}/${items.length}`;
    });
    if (tallies.length) parts.push(`${p.name} ${tallies.join(" · ")}`);
  }
  $(".others").textContent = parts.length ? `Others: ${parts.join(", ")}` : "";
}

const span2 = (ms) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
};
function renderResets() {
  const now = Date.now();
  $(".resets").textContent = RESETTING.map((k) => `${TITLE[k]} ${span2(period(k, now, state.prefs).end - now)}`).join(" · ");
}

// ── Ticking by hand ────────────────────────────────────────────────────────
function tick(kind, itemId, step) {
  const who = me || state.last;
  const item = state.items[kind].find((it) => it.id === itemId);
  if (!who || !item) return;
  const done = ticks(who.key, kind);
  const n = done[itemId] || 0;
  // One click ticks a single item off or on; one done several times counts
  // up (and from done back to none), a right click counts down.
  let next = item.target === 1 ? (n >= 1 ? 0 : 1) : n + step;
  if (item.target > 1 && step > 0 && n >= item.target) next = 0;
  done[itemId] = Math.max(0, Math.min(item.target, next));
  save("progress");
  render();
}
for (const kind of KINDS) {
  const section = $(`section[data-kind="${kind}"]`);
  const ul = $(".items", section);
  ul.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (li && !editing) tick(kind, li.dataset.id, 1);
  });
  ul.addEventListener("contextmenu", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li || editing) return;
    e.preventDefault();
    tick(kind, li.dataset.id, -1);
  });
  $(".add", section).addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("input", e.target);
    const name = input.value.trim();
    if (!name) return;
    state.items[kind].push({ id: newId(), name, note: "", main: false, target: 1, counter: null });
    input.value = "";
    save("items");
    render();
    $("input", $(`section[data-kind="${kind}"] .add`)).focus();
  });
}
$(".makeMain").addEventListener("click", () => {
  const who = me || state.last;
  if (!who) return;
  state.main = state.main === who.key ? null : who.key;
  save("main");
  render();
});
$(".edit").addEventListener("click", () => {
  editing = !editing;
  render();
});

// ── Ticking from the game's entry counts ───────────────────────────────────
const linkQueue = [];
function onCounts(entries, character, at) {
  const key = keyOf(character) || me?.key;
  if (!key || !entries.length) return;
  const now = at || Date.now();
  const counts = (state.counters[key] ||= {});
  for (const { id, left } of entries) {
    const before = counts[id]?.left;
    counts[id] = { left, at: now };
    const linked = KINDS.flatMap((kind) => state.items[kind].filter((it) => it.counter === id).map((item) => ({ kind, item })));
    const uses = usesOf(before, left, now, period("daily", now, state.prefs).start);
    if (!uses) continue;
    if (linked.length) {
      for (const { kind, item } of linked) credit(key, kind, item, uses);
    } else if (!state.ignored.includes(id) && KINDS.some((k) => state.items[k].length)) {
      linkQueue.push({ id, key, uses, before, left });
    }
  }
  save("counters");
  render();
  showNextLink();
}
function credit(key, kind, item, uses) {
  const done = ticks(key, kind);
  done[item.id] = Math.min(item.target, (done[item.id] || 0) + uses);
  save("progress");
  if (key === me?.key) {
    render();
    const li = $(`section[data-kind="${kind}"] li[data-id="${item.id}"]`);
    li?.classList.add("ticked");
  }
}
for (const shape of SHAPES) {
  a2.on(`decoded:counts-${shape}`, (data, meta) => onCounts(countsOf(`counts-${shape}`, data), meta.character, meta.at));
}

// ── The banner: a counter to link, or a reminder ───────────────────────────
let banner = null; // { type: "link", entry } | { type: "remind" }
let hideAfterBanner = false;
let lastUse = 0;
for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, () => (lastUse = Date.now()), true);

function openBanner(kind, html) {
  // Shown by the checklist, not by someone using it: hidden again after.
  if (!banner) hideAfterBanner = Date.now() - lastUse > 60_000;
  banner = kind;
  $(".bannerText").innerHTML = html;
  $(".bannerLink").hidden = kind.type !== "link";
  $(".banner").hidden = false;
  a2.window?.show().catch(() => {});
}
function closeBanner() {
  banner = null;
  $(".banner").hidden = true;
  if (showNextLink()) return;
  if (hideAfterBanner) a2.window?.hide().catch(() => {});
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function showNextLink() {
  if (banner) return true;
  const entry = linkQueue.find((e) => !state.ignored.includes(e.id) && !KINDS.some((k) => state.items[k].some((it) => it.counter === e.id)));
  if (!entry) {
    linkQueue.length = 0;
    return false;
  }
  linkQueue.splice(0, linkQueue.indexOf(entry) + 1);
  const change = typeof entry.before === "number" ? `${entry.before} → ${entry.left} left` : `${entry.left} left`;
  const select = $(".linkTo");
  select.replaceChildren();
  for (const kind of KINDS) {
    const group = Object.assign(document.createElement("optgroup"), { label: TITLE[kind] });
    for (const it of state.items[kind].filter((i) => !i.counter)) group.append(new Option(it.name, `${kind}:${it.id}`));
    if (group.children.length) select.append(group);
  }
  if (!select.options.length) return false;
  openBanner({ type: "link", entry }, `Game counter ${counterName(entry.id)} used (${esc(change)})<small>Which item was that? It will tick itself from now on.</small>`);
  return true;
}
$(".linkYes").addEventListener("click", () => {
  const { entry } = banner || {};
  const [kind, id] = $(".linkTo").value.split(":");
  const item = state.items[kind]?.find((it) => it.id === id);
  if (entry && item) {
    item.counter = entry.id;
    save("items");
    credit(entry.key, kind, item, entry.uses);
  }
  closeBanner();
});
$(".linkNo").addEventListener("click", () => {
  if (banner?.entry) {
    state.ignored.push(banner.entry.id);
    save("ignored");
  }
  closeBanner();
});
$(".bannerClose").addEventListener("click", closeBanner);

// ── Reminders before reset ─────────────────────────────────────────────────
let gameRunning = true; // meters before 2.0.65 don't say
a2.on("game", ({ running }) => {
  gameRunning = !!running;
  checkReminders();
});
function checkReminders(force = false) {
  const who = me || state.last;
  if (!who || (!gameRunning && !force) || banner) return;
  const now = Date.now();
  for (const kind of RESETTING) {
    const hours = Number(kind === "daily" ? state.prefs.remindDaily : state.prefs.remindWeekly);
    const p = period(kind, now, state.prefs);
    const reminded = (state.reminded[who.key] ||= {});
    if (!force && (!hours || now < p.end - hours * 3_600_000 || reminded[kind] === p.start)) continue;
    const left = leftToDo(who.key, kind);
    if (!left.length && !force) continue;
    // A test doesn't use up the real reminder.
    if (!force) {
      reminded[kind] = p.start;
      save("reminded");
    }
    const names = left.map((it) => esc(it.name)).join(", ") || "nothing (a test)";
    openBanner({ type: "remind" }, `${TITLE[kind]} reset in ${span2(p.end - now)}<small>${left.length} left: ${names}</small>`);
    playSound(state.prefs.sound);
    return;
  }
}

// ── Sounds (no files: notes made with Web Audio) ───────────────────────────
const SOUNDS = {
  chime: [[880, 0, 0.45, "sine", 0.25], [1320, 0.16, 0.5, "sine", 0.25]],
  bell: [[660, 0, 1.4, "sine", 0.28], [1320, 0, 0.9, "sine", 0.1], [1980, 0, 0.5, "sine", 0.05]],
  ping: [[1760, 0, 0.3, "sine", 0.22], [1760, 0.35, 0.3, "sine", 0.14]],
};
let audio = null;
function playSound(name) {
  const notes = SOUNDS[name];
  if (!notes) return;
  try {
    audio ||= new AudioContext();
    // Not awaited: in a hidden window WebKitGTK's resume() waits for the page
    // to be used, and a sound that waited for it stayed silent.
    if (audio.state !== "running") audio.resume().catch(() => {});
    for (const [freq, start, length, wave, volume] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const t = audio.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  } catch (e) {
    console.warn(e);
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
// The reset time is kept in UTC (the game's) and shown in your own time.
const pad = (n) => String(n).padStart(2, "0");
function showPrefs() {
  const local = (((state.prefs.minutes - new Date().getTimezoneOffset()) % 1440) + 1440) % 1440;
  $(".resetTime").value = `${pad(Math.floor(local / 60))}:${pad(local % 60)}`;
  $(".resetDay").value = String(state.prefs.weekday);
  $(".remindDaily").value = String(state.prefs.remindDaily);
  $(".remindWeekly").value = String(state.prefs.remindWeekly);
  $(".sound").value = state.prefs.sound;
}
$(".resetTime").addEventListener("change", (e) => {
  const [h, m] = e.target.value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return;
  state.prefs.minutes = (((h * 60 + m + new Date().getTimezoneOffset()) % 1440) + 1440) % 1440;
  save("prefs");
  render();
});
for (const [cls, key] of [["resetDay", "weekday"], ["remindDaily", "remindDaily"], ["remindWeekly", "remindWeekly"], ["sound", "sound"]]) {
  $(`.${cls}`).addEventListener("change", (e) => {
    state.prefs[key] = key === "sound" ? e.target.value : Number(e.target.value);
    save("prefs");
    render();
  });
}
$(".testAlert").addEventListener("click", () => checkReminders(true));

a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));
a2.on("character", setCharacter);

// ── Start ──────────────────────────────────────────────────────────────────
(async () => {
  const saved = await Promise.all(KEYS.map((k) => a2.storage.get(k).catch(() => null)));
  KEYS.forEach((k, i) => {
    if (saved[i] == null) return;
    state[k] = k === "prefs" ? { ...state.prefs, ...saved[i] } : saved[i];
  });
  if (!state.items) {
    state.items = defaultItems();
    save("items");
  }
  for (const k of KINDS) state.items[k] ||= [];
  showPrefs();
  render();
  a2.ready();
  setInterval(() => {
    // While editing, a redraw would drop what is being typed.
    if (editing) renderResets();
    else render();
    checkReminders();
  }, 30_000);
})();
