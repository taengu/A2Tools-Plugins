// Pet Soul Tracker: souls still needed to raise each pet, and where each
// pet's souls drop (sources.js, from metabot.gg; click a pet to see them).
//
// The game sends every pet's level and soul points once, at login (decoder
// "pet-list"), then each soul as it is picked up ("soul-gained") and each
// level reached ("level-up"). The counts are kept per server (a pet collection
// is shared by all your characters on a server), so they
// survive restarts; logging in again resyncs them from the game.

// Souls a pet needs to go from level N to N + 1. The first is inferred: 26
// pets at level 0 held 1 to 4 souls, none 5 or more.
const NEEDED = [5, 25, 75];
const MAX_LEVEL = NEEDED.length;
// Souls from the start of each level to level 3: [105, 100, 75].
const TO_MAX = NEEDED.map((_, level) => NEEDED.slice(level).reduce((n, x) => n + x, 0));

const els = {
  search: document.querySelector(".search"),
  status: document.querySelector(".status"),
  summary: document.querySelector(".summary"),
  hideMax: document.querySelector(".hideMax"),
  genus: document.querySelector(".genus"),
  levels: document.querySelector(".levels"),
  regions: document.querySelector(".regions"),
  head: document.querySelector(".head"),
  list: document.querySelector(".pets"),
  empty: document.querySelector(".empty"),
};

const empty = () => ({ levels: {}, points: {}, syncedAt: 0, lastGain: null });
let key = null; // storage key of the character shown
let state = empty();
let names = {};
let language = "en";
let openId = null; // the pet whose sources are shown
// How the list is sorted, and whether maxed pets show; kept across restarts.
// hiddenRegions: null until the user picks; until then the other side's maps hide.
let prefs = { sort: "left", desc: false, hideMax: true, genus: "", level: "", pinned: [], hiddenRegions: null };
// Each side's maps. A server's number says the side, as for the meter's
// Discord status: 1xxx Elyos, 2xxx Asmodian.
const SIDE_MAPS = { elyos: ["Poeta", "Verteron", "Eltnen"], asmodian: ["Ishalgen", "Altgard", "Morheim"] };
const sideOf = (charKey) => {
  const server = Number((charKey || "").match(/^(?:server|char)-(\d+)/)?.[1]);
  return server >= 1000 && server < 2000 ? "elyos" : server >= 2000 && server < 3000 ? "asmodian" : null;
};
// The regions hidden: the user's pick, else the other side's maps.
const hiddenRegions = () => {
  // regionsPicked: an empty list saved by the version before this one wasn't a choice.
  if (prefs.regionsPicked && Array.isArray(prefs.hiddenRegions)) return prefs.hiddenRegions;
  const side = sideOf(key);
  return side ? SIDE_MAPS[side === "elyos" ? "asmodian" : "elyos"] : [];
};
// A text from sources.js in the meter's language, else English.
const text = (k) => SOURCE_TEXT[k]?.[language] ?? SOURCE_TEXT[k]?.en ?? String(k ?? "").replace(/^=/, "");
// The words around them, in each of the meter's languages.
const SOURCE_UI = {
  en: { noSource: "No source known.", noDrops: "No drops or chests listed.", spawns: (n) => `${n} spawn${n === 1 ? "" : "s"}`,
        teleport: (n, name) => `nearest teleport #${n} ${name}`, near: (name) => `near Kibelisk ${name}`,
        perOpening: (p) => `${p} per opening`, boxFrom: (x) => `The box comes from ${x}`, also: (x) => `Also drops in ${x} (hidden)` },
  ko: { noSource: "알려진 출처가 없습니다.", noDrops: "드롭이나 상자 정보가 없습니다.", spawns: (n) => `${n}곳 출현`,
        teleport: (n, name) => `가까운 텔레포트 #${n} ${name}`, near: (name) => `${name} 근처`,
        perOpening: (p) => `개봉당 ${p}`, boxFrom: (x) => `상자 획득처: ${x}`, also: (x) => `${x}에서도 드롭 (숨김)` },
  ja: { noSource: "入手先は不明です。", noDrops: "ドロップや箱の情報はありません。", spawns: (n) => `出現 ${n}か所`,
        teleport: (n, name) => `最寄りのテレポート #${n} ${name}`, near: (name) => `${name}付近`,
        perOpening: (p) => `開封ごとに ${p}`, boxFrom: (x) => `箱の入手先: ${x}`, also: (x) => `${x}でもドロップ（非表示）` },
  de: { noSource: "Keine Quelle bekannt.", noDrops: "Keine Drops oder Truhen bekannt.", spawns: (n) => `${n} Spawn${n === 1 ? "" : "s"}`,
        teleport: (n, name) => `nächster Teleport #${n} ${name}`, near: (name) => `nahe ${name}`,
        perOpening: (p) => `${p} pro Öffnung`, boxFrom: (x) => `Die Truhe gibt es über: ${x}`, also: (x) => `Droppt auch in ${x} (ausgeblendet)` },
  fr: { noSource: "Aucune source connue.", noDrops: "Aucun butin ni coffre répertorié.", spawns: (n) => `${n} apparition${n === 1 ? "" : "s"}`,
        teleport: (n, name) => `téléporteur le plus proche n° ${n} ${name}`, near: (name) => `près de ${name}`,
        perOpening: (p) => `${p} par ouverture`, boxFrom: (x) => `Le coffre s'obtient via : ${x}`, also: (x) => `Tombe aussi à ${x} (masqué)` },
  es: { noSource: "No se conoce ninguna fuente.", noDrops: "No hay botín ni cofres.", spawns: (n) => `${n} aparici${n === 1 ? "ón" : "ones"}`,
        teleport: (n, name) => `teletransporte más cercano n.º ${n} ${name}`, near: (name) => `cerca de ${name}`,
        perOpening: (p) => `${p} por apertura`, boxFrom: (x) => `El cofre se obtiene en: ${x}`, also: (x) => `También cae en ${x} (oculto)` },
  pt: { noSource: "Nenhuma fonte conhecida.", noDrops: "Nenhum drop ou baú listado.", spawns: (n) => `${n} apari${n === 1 ? "ção" : "ções"}`,
        teleport: (n, name) => `teleporte mais próximo nº ${n} ${name}`, near: (name) => `perto de ${name}`,
        perOpening: (p) => `${p} por abertura`, boxFrom: (x) => `O baú vem de: ${x}`, also: (x) => `Também dropa em ${x} (oculto)` },
  ru: { noSource: "Источник неизвестен.", noDrops: "Нет данных о добыче и сундуках.", spawns: (n) => `мест появления: ${n}`,
        teleport: (n, name) => `ближайший телепорт №${n} ${name}`, near: (name) => `рядом: ${name}`,
        perOpening: (p) => `${p} за открытие`, boxFrom: (x) => `Сундук можно получить: ${x}`, also: (x) => `Также выпадает: ${x} (скрыто)` },
  "zh-Hant": { noSource: "來源不明。", noDrops: "沒有掉落或寶箱資料。", spawns: (n) => `${n} 個出現點`,
        teleport: (n, name) => `最近的傳送點 #${n} ${name}`, near: (name) => `${name}附近`,
        perOpening: (p) => `每次開啟 ${p}`, boxFrom: (x) => `寶箱來源：${x}`, also: (x) => `${x}也會掉落（已隱藏）` },
  "zh-Hans": { noSource: "来源不明。", noDrops: "没有掉落或宝箱资料。", spawns: (n) => `${n} 个出现点`,
        teleport: (n, name) => `最近的传送点 #${n} ${name}`, near: (name) => `${name}附近`,
        perOpening: (p) => `每次开启 ${p}`, boxFrom: (x) => `宝箱来源：${x}`, also: (x) => `${x}也会掉落（已隐藏）` },
};
const ui = () => SOURCE_UI[language] || SOURCE_UI.en;
// "A, B and C" as the meter's language writes it.
const listOf = (items) => {
  try {
    return new Intl.ListFormat(language, { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
};
// A spawn's region: its map, by English name (as region choices are saved).
const regionOf = (drop) => drop.region || "";
// Each region's map name, to label its chip in the meter's language.
const REGION_MAP = {};
for (const s of Object.values(PET_SOURCES)) for (const d of s.drops) if (d.region) REGION_MAP[d.region] ||= d.map;
// The regions the sources name, Asmodian and Elyos maps first, then Reshanta.
const REGIONS = Object.keys(REGION_MAP)
  .sort((a, b) => a.includes("Reshanta") - b.includes("Reshanta") || a.localeCompare(b));
// The pet you last picked up a soul for counts as being farmed this long, and
// sorts first (after the pinned ones).
const FARMING_MS = 30 * 60 * 1000;
const GENUS_ORDER = ["cogni", "fera", "natura", "varian"];

const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});

// The game's name in the meter's language, then English; the user's own name wins.
const gameName = (id) => PET_NAMES[id]?.[language] || PET_NAMES[id]?.en || `Pet #${id}`;
const petName = (id) => names[id] || gameName(id);
const genusName = (genus) => GENUS_NAMES[genus]?.[language] || GENUS_NAMES[genus]?.en || genus;

const SORTS = {
  level: (a, b) => a.level - b.level,
  name: (a, b) => a.name.localeCompare(b.name, language),
  progress: (a, b) => a.progress - b.progress,
  // Pets already at level 3 sort after every pet still to raise.
  left: (a, b) => a.rank - b.rank,
};

function render() {
  const ids = new Set([...Object.keys(state.levels), ...Object.keys(state.points)]);
  // Special pets come at their highest level and take no souls, so they are
  // left out. A pet missing from PET_GENUS (newer than this plugin) stays in.
  const pets = [...ids].filter((id) => PET_GENUS[id] !== "special").map((id) => {
    const level = state.levels[id] || 0;
    const points = state.points[id] || 0;
    const target = NEEDED[level];
    return {
      id,
      level,
      points,
      target,
      name: petName(id),
      genus: PET_GENUS[id] || "",
      progress: target ? points / target : 1,
      // The goal is level 3, so this counts every soul still needed to get there.
      left: target === undefined ? 0 : Math.max(0, TO_MAX[level] - points),
      rank: target === undefined ? Infinity : Math.max(0, TO_MAX[level] - points),
    };
  });
  const open = pets.filter((p) => p.level < MAX_LEVEL);
  const souls = open.reduce((n, p) => n + p.left, 0);
  els.summary.textContent = pets.length
    ? `${open.length} of ${pets.length} pets still to reach level 3 · ${souls} souls to go`
    : "";
  els.status.textContent = state.syncedAt
    ? `Synced at login, ${new Date(state.syncedAt).toLocaleString()}`
    : "Log in to a character (or relog) to read your pets.";

  // A search matches the shown name, the English one or the id.
  const query = els.search.value.trim().toLocaleLowerCase();
  const matches = (p) =>
    !query ||
    p.name.toLocaleLowerCase().includes(query) ||
    (PET_NAMES[p.id]?.en || "").toLowerCase().includes(query) ||
    p.id === query;
  const sort = SORTS[prefs.sort] || SORTS.left;
  const dir = prefs.desc ? -1 : 1;
  // Picking level 3 shows those pets even while they are otherwise hidden.
  const listed = els.hideMax.checked && prefs.level !== String(MAX_LEVEL) ? open : pets;
  const ofGenus = (p) => !prefs.genus || p.genus === prefs.genus;
  const ofLevel = (p) => !prefs.level || String(Math.min(p.level, MAX_LEVEL)) === prefs.level;
  // With a region turned off, the pets whose souls drop only there leave the
  // list. Chests don't count (nearly every pet has one, from the battle pass);
  // a pet no monster is known to drop stays, as nothing says where it is.
  const hidden = new Set(hiddenRegions());
  const ofRegion = (p) => {
    const src = PET_SOURCES[p.id];
    if (!hidden.size || !src || !src.drops.length) return true;
    return src.drops.some((d) => !regionOf(d) || !hidden.has(regionOf(d)));
  };
  renderChips(els.genus, "genus", listed.filter(ofLevel).filter(ofRegion), (p) => p.genus,
    GENUS_ORDER.map((g) => [g, genusName(g)]));
  // The level row counts every pet, level 3 included, so it shows how far along each level is.
  renderChips(els.levels, "level", pets.filter(ofGenus).filter(ofRegion),
    (p) => String(Math.min(p.level, MAX_LEVEL)),
    NEEDED.map((_, l) => [String(l), `Lv ${l}`]).concat([[String(MAX_LEVEL), `Lv ${MAX_LEVEL}`]]));
  // Pinned pets first, in the order pinned; then the one being farmed; then the chosen sort.
  const pinned = (prefs.pinned || []).map(String);
  const farming = state.lastGain && Date.now() - state.lastGain.at < FARMING_MS ? String(state.lastGain.pet) : null;
  const pinRank = (p) => (pinned.includes(p.id) ? pinned.indexOf(p.id) : pinned.length + (p.id === farming ? 0 : 1));
  els.regions.replaceChildren(
    ...REGIONS.map((region) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.region = region;
      b.textContent = text(REGION_MAP[region]).replace("Chaotic ", "");
      b.title = text(REGION_MAP[region]);
      b.setAttribute("aria-pressed", String(!hidden.has(region)));
      return b;
    }),
  );
  const shown = listed
    .filter(ofGenus)
    .filter(ofLevel)
    .filter((p) => matches(p) || (!query && pinned.includes(p.id)))
    .filter((p) => ofRegion(p) || pinned.includes(p.id))
    .sort((a, b) => pinRank(a) - pinRank(b) || dir * sort(a, b) || a.rank - b.rank || a.id - b.id);

  for (const button of els.head.querySelectorAll("button")) {
    const active = button.dataset.sort === prefs.sort;
    button.classList.toggle("active", active);
    button.dataset.dir = active ? (prefs.desc ? "desc" : "asc") : "";
    button.setAttribute("aria-sort", active ? (prefs.desc ? "descending" : "ascending") : "none");
  }
  els.empty.hidden = !(pets.length && !shown.length);

  els.list.replaceChildren(
    ...shown.map((p) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "name";
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "pin";
      pin.textContent = pinned.includes(p.id) ? "★" : "☆";
      pin.title = pinned.includes(p.id) ? "Unpin" : "Pin to the top";
      pin.setAttribute("aria-pressed", String(pinned.includes(p.id)));
      name.append(pin, p.name);
      if (p.id === farming) {
        const tag = document.createElement("span");
        tag.className = "farming";
        tag.textContent = "farming";
        tag.title = "You picked up a soul for this pet in the last 30 minutes";
        name.append(tag);
      }
      name.title = `${p.name} (double-click to rename)`;
      name.addEventListener("dblclick", (e) => { if (!e.target.closest(".pin")) rename(p.id, name); });
      const level = document.createElement("span");
      level.className = "level";
      level.textContent = p.level >= MAX_LEVEL ? "MAX" : `Lv ${p.level}`;
      const bar = document.createElement("span");
      bar.className = "bar";
      const fill = document.createElement("span");
      fill.style.width = `${Math.min(100, p.progress * 100)}%`;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = p.target ? `${p.points}/${p.target}` : "";
      bar.append(fill, count);
      const left = document.createElement("span");
      left.className = "left";
      left.textContent = p.target ? String(p.left) : "";
      left.title = p.target ? `${p.left} souls to level 3` : "";
      li.append(level, name, bar, left);
      li.dataset.id = p.id;
      if (PET_SOURCES[p.id]) li.classList.add("hasWhere");
      if (openId === p.id) {
        li.classList.add("open");
        li.append(whereOf(p.id));
      }
      return li;
    }),
  );
}

// Where a pet's souls come from: the monsters that drop them (level, chance,
// zone and map, nearest Kibelisk) and the chests that hold them, from the
// game's own data (sources.js).
function whereOf(id) {
  const box = document.createElement("div");
  box.className = "where";
  const src = PET_SOURCES[id];
  const words = ui();
  if (!src) {
    box.textContent = words.noSource;
    return box;
  }
  const line = (cls, ...parts) => {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = parts.filter(Boolean).join(" · ");
    return div;
  };
  const hidden = new Set(hiddenRegions());
  const elsewhere = new Set();
  for (const d of src.drops) {
    if (hidden.has(regionOf(d))) {
      elsewhere.add(regionOf(d));
      continue;
    }
    box.append(line("who", text(d.npc), d.level && `Lv ${d.level}`, d.chance));
    // In the Abyss each side has Kibelisks of its own: yours, when known.
    const k = d.bySide?.[sideOf(key)] || d.kibelisk;
    // The teleport's number as the in-game map lists it, where known.
    const kib = k && `${text(k.name)} · ${k.m.toLocaleString(language)} m`;
    const kibelisk = kib && (k.teleport ? words.teleport(k.teleport, kib) : words.near(kib));
    const zones = listOf((d.zones || []).map(text)) || "?";
    box.append(line("at", zones, d.map && text(d.map), d.spawns && words.spawns(d.spawns), kibelisk));
  }
  for (const c of src.chests) {
    box.append(line("who", text(c.name), words.perOpening(c.chance)));
    if (c.from) box.append(line("at", words.boxFrom(listOf(c.from.map(text)))));
  }
  if (!src.drops.length && !src.chests.length) box.append(line("at", words.noDrops));
  if (elsewhere.size) box.append(line("at", words.also(listOf([...elsewhere].map((r) => text(REGION_MAP[r]))))));
  return box;
}

// A filter row (genus or level): All, then each choice with how many of
// `pets` it holds, given the other filters.
function renderChips(row, pref, pets, valueOf, choices) {
  const counts = {};
  for (const p of pets) counts[valueOf(p)] = (counts[valueOf(p)] || 0) + 1;
  const chip = (value, label, count) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.value = value;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `(${count})`;
    b.append(label, " ", n);
    b.setAttribute("aria-pressed", String(prefs[pref] === value));
    return b;
  };
  row.dataset.pref = pref;
  row.replaceChildren(
    chip("", "All", pets.length),
    ...choices.map(([value, label]) => chip(value, label, counts[value] || 0)),
  );
}

// The sandbox allows no dialogs, so the name is edited in place.
function rename(id, span) {
  const input = document.createElement("input");
  input.className = "rename";
  input.value = names[id] || "";
  input.placeholder = gameName(id);
  input.maxLength = 40;
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    if (keep) {
      if (input.value.trim()) names[id] = input.value.trim();
      else delete names[id];
      a2.storage.set("names", names).catch(() => {});
    }
    render();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
  span.replaceWith(input);
  input.focus();
}

// A pet whose souls reach what its level needs goes up a level, its count
// starting again from 0 as the game's does (Karnif: 25 -> 0; Aberrant Bee,
// 2026-10-12: carrying the extra over came out 2 above the game's 33). The
// game's own level-up message doesn't come for every step (Brax: 24 souls
// picked up at level 0 and no level-up seen), so the counts level themselves;
// the next login's pet list corrects them either way.
function levelUp(st, pet) {
  const level = st.levels[pet] || 0;
  if (level < MAX_LEVEL && (st.points[pet] || 0) >= NEEDED[level]) {
    st.levels[pet] = level + 1;
    st.points[pet] = 0;
  }
}

// What each event does to a character's counts.
const handle = {
  "decoded:pet-list"(st, data) {
    st.levels = {};
    st.points = {};
    st.syncedAt = Date.now();
    for (const { pet, level } of data.levels || []) st.levels[pet] = level;
    for (const { pet, points } of data.points || []) st.points[pet] = points;
  },
  "decoded:soul-gained"(st, { pet, amount }) {
    st.points[pet] = (st.points[pet] || 0) + amount;
    st.lastGain = { pet, at: Date.now() };
    levelUp(st, pet);
  },
  "decoded:level-up"(st, { pet, level }) {
    // The game resets a pet's points as it levels (Karnif: 25 -> 0). Already
    // levelled from its souls: the souls picked up since stay.
    if ((st.levels[pet] || 0) >= level) return;
    st.levels[pet] = level;
    st.points[pet] = 0;
  },
};

// Counts are kept per server: a pet collection is shared by every character
// on a server. Each event comes stamped with who was playing when it
// happened, so a login on another server starts that server's list rather
// than overwriting this one. No server known (a new character still in the
// tutorial): no key.
const keyFor = (character) => (Number(character?.serverId) > 0 ? `server-${Number(character.serverId)}` : null);
// Before 0.3.1 counts were kept per character, under this key.
const characterKey = (character) =>
  character?.name
    ? `char-${character.serverId || 0}-${encodeURIComponent(character.name)}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64)
    : null;
// A server's counts start from the counts a character on it had saved, the
// first time that character is seen (the plugin can't list its saved keys).
const adopt = async (k, character) => {
  const old = characterKey(character);
  if (!k || !old || loaded.has(k) || (await a2.storage.get(k).catch(() => null))) return;
  const saved = await a2.storage.get(old).catch(() => null);
  if (saved) await a2.storage.set(k, saved).catch(() => {});
};
const loaded = new Map();
const load = async (k) => {
  if (!loaded.has(k)) {
    const st = (await a2.storage.get(k).catch(() => null)) || empty();
    // Counts saved before pets levelled from their souls (a pet at level 0 with
    // 24): the souls past each step, picked up one by one, count toward the next.
    for (const pet of Object.keys(st.points || {})) {
      let level = st.levels[pet] || 0;
      while (level < MAX_LEVEL && st.points[pet] >= NEEDED[level]) {
        st.points[pet] -= NEEDED[level];
        level += 1;
      }
      st.levels[pet] = level;
    }
    loaded.set(k, st);
  }
  return loaded.get(k);
};
// When the meter doesn't know who is playing: the character seen last.
const UNNAMED_KEY = "server-unknown";
const fallbackKey = async () => key || (await a2.storage.get("last").catch(() => null)) || "char-default";
const show = async (k) => {
  key = k;
  state = await load(k);
  render();
};

// Events are handled one at a time, in order (loading a character's counts waits on storage).
let chain = Promise.resolve();
const queued = (fn) => {
  chain = chain.then(fn).catch((e) => console.error(e));
};

// The last changes, kept with the counts to trace a count that drifts from
// the game's: [time, event, pet, amount or level, level after, souls after].
const HISTORY = 200;
function note(st, event, data) {
  const pets = event === "decoded:pet-list" ? [] : [data.pet];
  const value = event === "decoded:soul-gained" ? data.amount : event === "decoded:level-up" ? data.level : null;
  const entry = [new Date().toISOString(), event.replace("decoded:", ""), pets[0] ?? null, value];
  if (pets.length) entry.push(st.levels[pets[0]] || 0, st.points[pets[0]] || 0);
  else entry.push((data.levels || []).length, (data.points || []).length);
  st.history = [...(st.history || []), entry].slice(-HISTORY);
}

for (const event of Object.keys(handle)) {
  a2.on(event, (data, meta) => queued(async () => {
    // A pet list replaces a server's counts, so one from a character with no
    // server yet (a new character in the tutorial) gets a key of its own
    // rather than the last one's: falling back there wiped Naicha's counts
    // when an alt was created (2026-10-13). Single souls still fall back,
    // for a meter started mid-session that hasn't seen who is playing.
    const k = keyFor(meta?.character)
      || (event === "decoded:pet-list" ? UNNAMED_KEY : await fallbackKey());
    await adopt(k, meta?.character);
    const st = await load(k);
    handle[event](st, data);
    note(st, event, data);
    await a2.storage.set(k, st).catch(() => {});
    await a2.storage.set("last", k).catch(() => {});
    if (k !== key) await show(k);
    else render();
  }));
}
// Who is playing as the window opens.
a2.on("character", (character) => queued(async () => {
  const k = keyFor(character);
  await adopt(k, character);
  await show(k || (await fallbackKey()));
}));
a2.on("language", (code) => {
  language = typeof code === "string" ? code : "en";
  render();
});
// The window's fold button: the list (and its column headers) only.
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));
els.search.addEventListener("input", render);
for (const row of [els.genus, els.levels]) {
  row.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-value]");
    if (!button) return;
    prefs[row.dataset.pref] = button.dataset.value;
    savePrefs();
    render();
  });
}
els.regions.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-region]");
  if (!button) return;
  const hidden = new Set(hiddenRegions());
  if (hidden.has(button.dataset.region)) hidden.delete(button.dataset.region);
  else hidden.add(button.dataset.region);
  prefs.hiddenRegions = [...hidden];
  prefs.regionsPicked = true;
  savePrefs();
  render();
});
els.hideMax.addEventListener("change", () => {
  prefs.hideMax = els.hideMax.checked;
  savePrefs();
  render();
});
// A click on a pet shows or hides where its souls drop (a double click on
// its name still renames it).
els.list.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  if (e.target.closest(".pin")) {
    const list = (prefs.pinned || []).map(String);
    prefs.pinned = list.includes(li.dataset.id) ? list.filter((id) => id !== li.dataset.id) : [...list, li.dataset.id];
    savePrefs();
    render();
    return;
  }
  if (e.detail > 1 || e.target.closest("input, a, .where")) return;
  openId = openId === li.dataset.id ? null : li.dataset.id;
  render();
});
// A column's button sorts by it; pressing it again reverses the order.
els.head.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-sort]");
  if (!button) return;
  const sort = button.dataset.sort;
  prefs.desc = prefs.sort === sort ? !prefs.desc : false;
  prefs.sort = sort;
  savePrefs();
  render();
});

(async () => {
  names = (await a2.storage.get("names").catch(() => null)) || {};
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  els.hideMax.checked = prefs.hideMax;
  await a2.ready();
  // The "farming" mark wears off without an event to redraw it.
  setInterval(() => { if (state.lastGain) render(); }, 60_000);
  // Without a character from the meter, show the last one tracked.
  queued(async () => { if (!key) await show(await fallbackKey()); });
})();
