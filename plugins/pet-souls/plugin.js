// Pet Soul Tracker: souls still needed to raise each pet, and where each
// pet's souls drop (sources.js, from the game's own data; click a pet to see them).
// "Around you" is a map of where the monsters that drop a soul for a pet below
// level 3 spawn, with you and the monsters in range on it (maps.js, nearby.js).
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
  overall: document.querySelector(".overall span"),
  filtersButton: document.querySelector(".filtersButton"),
  filterCount: document.querySelector(".filterCount"),
  filters: document.querySelector(".filters"),
  hideMax: document.querySelector(".hideMax"),
  chestOnly: document.querySelector(".chestOnly"),
  scaleLabel: document.querySelector(".scaleLabel"),
  scale: document.querySelector(".scaleSelect"),
  layout: document.querySelector(".layoutSelect"),
  genus: document.querySelector(".genus"),
  levels: document.querySelector(".levels"),
  regions: document.querySelector(".regions"),
  head: document.querySelector(".head"),
  list: document.querySelector(".pets:not(.farmList)"),
  empty: document.querySelector(".empty"),
  farm: document.querySelector(".farm"),
  farmList: document.querySelector(".farmList"),
  farmLeft: document.querySelector(".farmLeft"),
  toFull: document.querySelector(".toFull"),
  toFarm: document.querySelector(".toFarm"),
  farmHide: document.querySelector(".farmHide"),
  farmPopup: document.querySelector(".farmPopup"),
  farmAfter: document.querySelector(".farmAfter"),
  hideAfter: document.querySelector(".hideAfterSelect"),
  controls: document.querySelector(".controls"),
  nearby: document.querySelector(".nearby"),
  nearbyWhere: document.querySelector(".nearbyWhere"),
  nearbyOn: document.querySelector(".nearbyOn"),
  allNpcs: document.querySelector(".allNpcsBox"),
  nearbyTitle: document.querySelector(".nearbyTitle"),
  nearbyCount: document.querySelector(".nearbyCount"),
  minimap: document.querySelector(".minimap"),
  zoomIn: document.querySelector(".zoomIn"),
  zoomOut: document.querySelector(".zoomOut"),
  follow: document.querySelector(".follow"),
  mapNote: document.querySelector(".mapNote"),
  mapCredit: document.querySelector(".mapCredit"),
  mapBox: document.querySelector(".mapBox"),
  popOut: document.querySelector(".popOut"),
  popIn: document.querySelector(".popIn"),
  poppedNote: document.querySelector(".poppedNote"),
  nearbyList: document.querySelector(".nearbyList"),
};

// farmed: each pet given a soul below level 3, by when (the farming pop-up).
const empty = () => ({ levels: {}, points: {}, syncedAt: 0, lastGain: null, farmed: {} });
let key = null; // storage key of the character shown
let state = empty();
let names = {};
let language = "en";
let openId = null; // the pet whose sources are shown
// How the list is sorted, and whether maxed pets show; kept across restarts.
// hiddenRegions: null until the user picks; until then the other side's maps hide.
let prefs = { sort: "left", desc: false, hideMax: true, genus: "", level: "", pinned: [], hiddenRegions: null, scale: 1, filtersOpen: false, chestOnly: false, layout: "cards", farmPopup: false, hideAfter: 20, nearby: false, allNpcs: false, mapZoom: 2, popZoom: 2, popSize: 1, mapPopped: false };
// Text size: the whole page scaled, spacing and controls with the text. 100%
// is BASE_ZOOM, a little larger than the stylesheet's own sizes.
const SCALES = [0.9, 1, 1.1, 1.25, 1.5];
const BASE_ZOOM = 1.1;
function applyScale() {
  const scale = SCALES.includes(Number(prefs.scale)) ? Number(prefs.scale) : 1;
  document.documentElement.style.zoom = String(Math.round(BASE_ZOOM * scale * 1000) / 1000);
}
// The layout, as a class on the page: the stylesheet draws each its own way.
function applyLayout() {
  const layout = LAYOUT_NAMES[prefs.layout] ? prefs.layout : "cards";
  for (const name of Object.keys(LAYOUT_NAMES)) document.body.classList.toggle(`layout-${name}`, name === layout);
  if (!els.layout.options.length) {
    els.layout.replaceChildren(...Object.entries(LAYOUT_NAMES).map(([value, label]) => Object.assign(document.createElement("option"), { value, textContent: label })));
  }
  els.layout.value = layout;
}
function renderScale() {
  els.scaleLabel.textContent = ui().textSize;
  els.scale.replaceChildren(...SCALES.map((x) => {
    const o = document.createElement("option");
    o.value = String(x);
    o.textContent = `${Math.round(x * 100)}%`;
    return o;
  }));
  els.scale.value = String(SCALES.includes(Number(prefs.scale)) ? Number(prefs.scale) : 1);
}
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
  en: { textSize: "Text size", noSource: "No source known.", noDrops: "No drops or chests listed.", spawns: (n) => `${n} spawn${n === 1 ? "" : "s"}`,
        teleport: (n, name) => `nearest teleport #${n} ${name}`, near: (name) => `near Kibelisk ${name}`,
        perOpening: (p) => `${p} per opening`, boxFrom: (x) => `The box comes from ${x}`, also: (x) => `Also drops in ${x} (hidden)`,
        map: "Map" },
  ko: { textSize: "글자 크기", noSource: "알려진 출처가 없습니다.", noDrops: "드롭이나 상자 정보가 없습니다.", spawns: (n) => `${n}곳 출현`,
        teleport: (n, name) => `가까운 텔레포트 #${n} ${name}`, near: (name) => `${name} 근처`,
        perOpening: (p) => `개봉당 ${p}`, boxFrom: (x) => `상자 획득처: ${x}`, also: (x) => `${x}에서도 드롭 (숨김)`,
        map: "지도" },
  ja: { textSize: "文字の大きさ", noSource: "入手先は不明です。", noDrops: "ドロップや箱の情報はありません。", spawns: (n) => `出現 ${n}か所`,
        teleport: (n, name) => `最寄りのテレポート #${n} ${name}`, near: (name) => `${name}付近`,
        perOpening: (p) => `開封ごとに ${p}`, boxFrom: (x) => `箱の入手先: ${x}`, also: (x) => `${x}でもドロップ（非表示）`,
        map: "地図" },
  de: { textSize: "Textgröße", noSource: "Keine Quelle bekannt.", noDrops: "Keine Drops oder Truhen bekannt.", spawns: (n) => `${n} Spawn${n === 1 ? "" : "s"}`,
        teleport: (n, name) => `nächster Teleport #${n} ${name}`, near: (name) => `nahe ${name}`,
        perOpening: (p) => `${p} pro Öffnung`, boxFrom: (x) => `Die Truhe gibt es über: ${x}`, also: (x) => `Droppt auch in ${x} (ausgeblendet)`,
        map: "Karte" },
  fr: { textSize: "Taille du texte", noSource: "Aucune source connue.", noDrops: "Aucun butin ni coffre répertorié.", spawns: (n) => `${n} apparition${n === 1 ? "" : "s"}`,
        teleport: (n, name) => `téléporteur le plus proche n° ${n} ${name}`, near: (name) => `près de ${name}`,
        perOpening: (p) => `${p} par ouverture`, boxFrom: (x) => `Le coffre s'obtient via : ${x}`, also: (x) => `Tombe aussi à ${x} (masqué)`,
        map: "Carte" },
  es: { textSize: "Tamaño del texto", noSource: "No se conoce ninguna fuente.", noDrops: "No hay botín ni cofres.", spawns: (n) => `${n} aparici${n === 1 ? "ón" : "ones"}`,
        teleport: (n, name) => `teletransporte más cercano n.º ${n} ${name}`, near: (name) => `cerca de ${name}`,
        perOpening: (p) => `${p} por apertura`, boxFrom: (x) => `El cofre se obtiene en: ${x}`, also: (x) => `También cae en ${x} (oculto)`,
        map: "Mapa" },
  pt: { textSize: "Tamanho do texto", noSource: "Nenhuma fonte conhecida.", noDrops: "Nenhum drop ou baú listado.", spawns: (n) => `${n} apari${n === 1 ? "ção" : "ções"}`,
        teleport: (n, name) => `teleporte mais próximo nº ${n} ${name}`, near: (name) => `perto de ${name}`,
        perOpening: (p) => `${p} por abertura`, boxFrom: (x) => `O baú vem de: ${x}`, also: (x) => `Também dropa em ${x} (oculto)`,
        map: "Mapa" },
  ru: { textSize: "Размер текста", noSource: "Источник неизвестен.", noDrops: "Нет данных о добыче и сундуках.", spawns: (n) => `мест появления: ${n}`,
        teleport: (n, name) => `ближайший телепорт №${n} ${name}`, near: (name) => `рядом: ${name}`,
        perOpening: (p) => `${p} за открытие`, boxFrom: (x) => `Сундук можно получить: ${x}`, also: (x) => `Также выпадает: ${x} (скрыто)`,
        map: "Карта" },
  "zh-Hant": { textSize: "文字大小", noSource: "來源不明。", noDrops: "沒有掉落或寶箱資料。", spawns: (n) => `${n} 個出現點`,
        teleport: (n, name) => `最近的傳送點 #${n} ${name}`, near: (name) => `${name}附近`,
        perOpening: (p) => `每次開啟 ${p}`, boxFrom: (x) => `寶箱來源：${x}`, also: (x) => `${x}也會掉落（已隱藏）`,
        map: "地圖" },
  "zh-Hans": { textSize: "文字大小", noSource: "来源不明。", noDrops: "没有掉落或宝箱资料。", spawns: (n) => `${n} 个出现点`,
        teleport: (n, name) => `最近的传送点 #${n} ${name}`, near: (name) => `${name}附近`,
        perOpening: (p) => `每次开启 ${p}`, boxFrom: (x) => `宝箱来源：${x}`, also: (x) => `${x}也会掉落（已隐藏）`,
        map: "地图" },
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
// A pet no monster drops: its souls come only from pet chests (the battle
// pass's), so it can't be farmed. Hidden unless asked for.
const chestOnly = (id) => {
  const src = PET_SOURCES[id];
  return !!src && !src.drops.length && src.chests.length > 0;
};
const genusName = (genus) => GENUS_NAMES[genus]?.[language] || GENUS_NAMES[genus]?.en || genus;

const SORTS = {
  level: (a, b) => a.level - b.level,
  name: (a, b) => a.name.localeCompare(b.name, language),
  progress: (a, b) => a.progress - b.progress,
  // Pets already at level 3 sort after every pet still to raise.
  left: (a, b) => a.rank - b.rank,
  // Closest spawn on this map of a monster that drops its souls (with the
  // map on); pets with none here after, in the usual order.
  near: (a, b) => nearOf(a.id) - nearOf(b.id),
};
// Metres from you to each pet's nearest spawn on the map you're on, worked
// out once per list render (nearestByPet); pets with none, far away.
const FAR = 1e9;
let nearest = new Map();
const nearOf = (id) => nearest.get(String(id)) ?? FAR;
function nearestByPet() {
  const out = new Map();
  const map = currentMap();
  const me = field.where(Date.now())?.pos;
  const spawns = map && PET_SPAWNS[map];
  if (!me || !spawns) return out;
  // Spawns are in metres, positions in centimetres.
  const x = me[0] / 100;
  const y = me[1] / 100;
  for (const [npc, xy] of Object.entries(spawns)) {
    const pets = NPC_DROPS[npc]?.pets;
    if (!pets?.length) continue;
    let best = FAR;
    for (let i = 0; i + 1 < xy.length; i += 2) best = Math.min(best, Math.hypot(xy[i] - x, xy[i + 1] - y));
    for (const pet of pets) if (best < (out.get(String(pet)) ?? FAR)) out.set(String(pet), best);
  }
  return out;
}
// Where the list was last sorted from: re-sorted when you've moved this far.
let nearFrom = null;
const NEAR_STEP_M = 40;

// A pet as the list draws it.
function petOf(id) {
  const level = state.levels[id] || 0;
  const points = state.points[id] || 0;
  const target = NEEDED[level];
  return {
    id: String(id),
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
}

function render() {
  renderNearby();
  const ids = new Set([...Object.keys(state.levels), ...Object.keys(state.points)]);
  // Special pets come at their highest level and take no souls, so they are
  // left out, as are pets only found on maps not open yet (the game lists
  // them anyway). A pet missing from PET_GENUS (newer than this plugin) stays in.
  const pinned = (prefs.pinned || []).map(String);
  const pets = [...ids].filter((id) => PET_GENUS[id] !== "special" && !PET_SOURCES[id]?.unreleased)
    .filter((id) => prefs.chestOnly || !chestOnly(id) || pinned.includes(id)).map(petOf);
  const open = pets.filter((p) => p.level < MAX_LEVEL);
  const souls = open.reduce((n, p) => n + p.left, 0);
  // The souls still to go, large; the pets left beside them; under them a bar
  // of every soul picked up toward level 3 so far.
  const num = (n) => n.toLocaleString(language);
  els.summary.replaceChildren();
  if (pets.length) {
    const big = document.createElement("b");
    big.textContent = num(souls);
    const pl = document.createElement("span");
    pl.className = "petsLeft";
    pl.textContent = `${open.length} / ${pets.length} pets to go`;
    els.summary.append(big, " souls to level 3", pl);
  }
  const needed = pets.length * TO_MAX[0];
  els.overall.parentElement.hidden = !pets.length;
  els.overall.style.width = needed ? `${(100 * (needed - souls)) / needed}%` : "0";
  els.status.textContent = state.syncedAt
    ? `Synced at login ${syncedText(state.syncedAt)}`
    : "Log in to a character (or relog) to read your pets.";

  // A search matches the shown name, the English one or the id.
  const query = els.search.value.trim().toLocaleLowerCase();
  const matches = (p) =>
    !query ||
    p.name.toLocaleLowerCase().includes(query) ||
    (PET_NAMES[p.id]?.en || "").toLowerCase().includes(query) ||
    p.id === query;
  // Nearest only with the map on (it needs your position); else as before.
  const byNear = prefs.sort === "near" && prefs.nearby === true;
  if (byNear) {
    nearest = nearestByPet();
    const me = field.where(Date.now())?.pos;
    nearFrom = me ? { map: currentMap(), x: me[0], y: me[1] } : null;
  }
  const sort = byNear ? SORTS.near : prefs.sort === "near" ? SORTS.left : SORTS[prefs.sort] || SORTS.left;
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
  const active = Number(!!prefs.chestOnly) + Number(!!prefs.genus) + Number(!!prefs.level) + Number(hidden.size > 0 && !!prefs.regionsPicked);
  els.filterCount.textContent = active ? String(active) : "";
  els.filtersButton.classList.toggle("active", active > 0);
  els.filters.hidden = !prefs.filtersOpen;
  els.filtersButton.setAttribute("aria-expanded", String(!!prefs.filtersOpen));
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
  // The pet being farmed stays at the top whatever the type or level
  // filters: with a Pet type picked it was filtered out, so the list no
  // longer led with it (HomelessGuy, 2026-10-31).
  const shown = listed
    .filter((p) => (ofGenus(p) && ofLevel(p)) || p.id === farming)
    .filter((p) => matches(p) || (!query && pinned.includes(p.id)))
    .filter((p) => ofRegion(p) || pinned.includes(p.id))
    .sort((a, b) => pinRank(a) - pinRank(b) || dir * sort(a, b) || a.rank - b.rank || a.id - b.id);

  els.head.querySelector(".sortNear").hidden = prefs.nearby !== true;
  for (const button of els.head.querySelectorAll("button")) {
    const active = button.dataset.sort === prefs.sort;
    button.classList.toggle("active", active);
    button.dataset.dir = active ? (prefs.desc ? "desc" : "asc") : "";
    button.setAttribute("aria-sort", active ? (prefs.desc ? "descending" : "ascending") : "none");
  }
  els.empty.hidden = !(pets.length && !shown.length);

  els.list.replaceChildren(...shown.map((p) => rowOf(p, pinned, farming)));
  renderFarm(pinned, farming);
}

// A pet's row in the chosen layout, its sources under it while open.
function rowOf(p, pinned, farming) {
  const build = LAYOUTS[prefs.layout] || LAYOUTS.cards;
  const li = build(p, { pinned: pinned.includes(p.id), farming: p.id === farming });
  li.dataset.id = p.id;
  li.dataset.genus = p.genus;
  li.classList.toggle("max", p.level >= MAX_LEVEL);
  li.classList.toggle("farmed", p.id === farming);
  if (PET_SOURCES[p.id]) li.classList.add("hasWhere");
  if (openId === p.id) {
    li.classList.add("open");
    li.append(whereOf(p.id));
  }
  return li;
}

// ---- The farming pop-up (Filters → "Pop up while farming") ---------------
//
// A soul for a pet below level 3 shows the window with only the pets being
// farmed (a soul in the last 30 minutes), fitted to them, and hides it again
// once nothing has happened for the time chosen; the whole list stays a
// click away. Meters before 2.0.62 have no a2.window, 2.0.65 brought fit.
const win = a2.window;
const canFit = () => !!(win && typeof win.fit === "function");
const HIDE_AFTER = [10, 20, 30, 60, 0]; // seconds; 0 never
// A pet that reached level 3 stays this long, to be seen done.
const DONE_SHOWN_MS = 60 * 1000;
let view = "full"; // or "farm"
let poppedAt = 0;
// The last click, key or wheel in the window: someone using it. The mouse
// only passing over it isn't (it sits above the game, which the pointer
// crosses while playing), but keeps the pop-up up.
let usedAt = 0;
let hoveredAt = 0;
const startedAt = Date.now();

// The pets being farmed, the last given a soul first.
function farmedPets() {
  const now = Date.now();
  return Object.entries(state.farmed || {})
    .filter(([, at]) => now - at < FARMING_MS)
    .map(([id, at]) => ({ ...petOf(id), at }))
    .filter((p) => p.level < MAX_LEVEL || Date.now() - p.at < DONE_SHOWN_MS)
    .sort((a, b) => b.at - a.at);
}

function renderFarm(pinned, farming) {
  const pets = farmedPets();
  const usable = !!prefs.farmPopup && canFit();
  els.toFarm.hidden = !usable || !pets.length;
  if (!usable) {
    if (view === "farm") showFull();
    return;
  }
  const left = pets.reduce((n, p) => n + p.left, 0);
  els.farmLeft.textContent = pets.length
    ? `${pets.length} pet${pets.length === 1 ? "" : "s"} · ${left.toLocaleString(language)} souls to level 3`
    : "";
  els.farmList.replaceChildren(...pets.map((p) => rowOf(p, pinned, farming)));
  if (view === "farm") fitFarm();
}

// The page's zoom (Text size) that sizes measured on it leave out: all of it
// where they come unzoomed, none where the browser has zoomed them already
// (newer Chromium). Told apart by measuring 100 px.
function zoomLeft() {
  const zoom = Number(document.documentElement.style.zoom) || 1;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:100px;width:1px";
  document.body.append(probe);
  const measured = probe.getBoundingClientRect().height / 100;
  probe.remove();
  return measured > 0 ? zoom / measured : zoom;
}
// Measured at once: the list was just drawn, and measuring lays it out.
function fitFarm() {
  if (view !== "farm") return;
  win.fit(Math.ceil(els.farm.getBoundingClientRect().height * zoomLeft()) + 2).catch(() => {});
}
function showFarm() {
  view = "farm";
  document.body.classList.add("farmOnly");
  els.farmList.before(els.nearby);
  render();
}
function showFull() {
  if (view === "full") return;
  view = "full";
  document.body.classList.remove("farmOnly");
  els.controls.after(els.nearby);
  if (canFit()) win.fit().catch(() => {});
  render();
}
// A soul just picked up for a pet below level 3. Someone using the whole
// list (a click, a key or the wheel in the last 10 seconds) keeps it.
function popFarm() {
  if (!prefs.farmPopup || !canFit()) return;
  if (view === "full" && Date.now() - usedAt < 10_000) return;
  poppedAt = Date.now();
  showFarm();
  win.show().catch(() => {});
}
// Hidden, it is the whole list again, for when it is opened from Settings.
function hideFarm() {
  // The click on × doesn't count as using the whole list.
  usedAt = 0;
  win.hide().catch(() => {});
  showFull();
}
setInterval(() => {
  const after = Number(prefs.hideAfter) * 1000;
  if (view === "farm" && after > 0 && Date.now() - Math.max(poppedAt, usedAt, hoveredAt) > after) hideFarm();
}, 1000);
for (const type of ["pointerdown", "keydown", "wheel"]) {
  document.addEventListener(type, () => { usedAt = Date.now(); }, { passive: true });
}
document.addEventListener("pointermove", () => { hoveredAt = Date.now(); }, { passive: true });

// ---- Around you: a map of where the souls you need are ---------------------
//
// The map is the game's world map with every spawn of the monsters that drop
// a soul for a pet below level 3 (maps.js, from aion2timers.com), you on it,
// and the monsters in range as the game sends them (nearby.js), which sit on
// those spawns. Your own position only comes now and then: as your effects
// land on you (fighting, mounting, gliding: 6 in a minute of running,
// mounting and flying, 2026-10-25), a Chanter's mantras once a second, never
// for running alone. So "you" can lag: the header says how old it is. The
// monsters are placed by the game's own positions, whatever yours.
const field = new PetNearby.Field();
// Each NPC id's drops (its name, level and the pets it drops souls for), and
// each map's name, from sources.js.
const NPC_DROPS = {};
const MAP_NAMES = {};
for (const [pet, src] of Object.entries(PET_SOURCES)) {
  for (const d of src.drops) {
    if (d.mapId && d.map) MAP_NAMES[d.mapId] ||= d.map;
    if (!d.npcId) continue;
    const n = (NPC_DROPS[d.npcId] ||= { npc: d.npc, level: d.level, pets: [] });
    if (!n.pets.includes(pet)) n.pets.push(pet);
  }
}
// Older than this, the header says how old your position is.
const STALE_MS = 15_000;
const NEARBY_ROWS = 4;
const GENUS_COLOURS = { cogni: "#b99bff", fera: "#ff9f66", natura: "#74d99a", varian: "#5cc9e6" };
// Metres per screen pixel, zoomed in to out.
const ZOOMS = [0.5, 1, 2, 4, 8, 16];
// A pet still to raise: below level 3, not special.
const needs = (pet) => PET_GENUS[pet] !== "special" && !PET_SOURCES[pet]?.unreleased && (state.levels[pet] || 0) < MAX_LEVEL;
// The pets still to raise that a monster drops souls for, fewest souls left first.
const neededFrom = (npc) => (NPC_DROPS[npc]?.pets || []).filter(needs).map(petOf).sort((a, b) => a.left - b.left);
const colourOf = (pets) => GENUS_COLOURS[pets[0]?.genus] || "#8fc2ff";
const agoText = (ms) => {
  const s = Math.round(ms / 1000);
  const [n, unit] = s < 60 ? [s, "second"] : s < 3600 ? [Math.round(s / 60), "minute"] : [Math.round(s / 3600), "hour"];
  try {
    return new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "short" }).format(n);
  } catch {
    return `${n} ${unit === "second" ? "s" : unit === "minute" ? "min" : "h"}`;
  }
};

// The map's words, in each of the meter's languages. Ages ("5 min") and
// distances come from Intl.
const MAP_UI = {
  en: { around: "Around you", showMap: "Show the map", showMapTip: "A map of where the monsters that drop a soul for a pet below level 3 spawn, with you on it",
        allMonsters: "All monsters", allMonstersTip: "Every other monster in range too, as grey dots", popOut: "Pop the map out into a window of its own",
        popped: "The map is in its own window.", putBack: "Put it back", unknown: "position not known yet", estimated: "≈ position estimated",
        old: (t) => `position ${t} old`,
        estimatedTip: "Guessed from the monsters coming into view, within about 20 to 30 m. Fight, dodge or use a skill on yourself to make it exact",
        inRange: (n) => `${n} in range`, forPets: (x) => `for ${x}`, toLv3: (name, left) => `${name} (${left} to Lv 3)`,
        noneInRange: "No monster in range drops a soul you need. The dots are where they spawn.", noneOnMap: "No monster on this map drops a soul you need.",
        noMapYet: "The map shows after your next teleport or zone change", noPicture: "No map picture for this place",
        compass4: ["N", "E", "S", "W"], compass8: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
        zoomIn: "Zoom in", zoomOut: "Zoom out", back: "Back to you", mapTip: "Drag to move, wheel to zoom, double-click to follow you again",
        mapLabel: "Map of where the monsters you need spawn, north up", drag: "Drag to move", bigger: "Bigger (then back to the smallest)",
        backIn: "Back into the Pet Soul Tracker window", credit: "Open the live map on aion2timers.com", creditLive: "Live map ↗", creditBy: "by Aion 2 Timers" },
  ko: { around: "주변", showMap: "지도 표시", showMapTip: "레벨 3 미만 펫의 영혼을 주는 몬스터가 나타나는 곳과 내 위치를 보여 주는 지도",
        allMonsters: "모든 몬스터", allMonstersTip: "범위 안의 다른 몬스터도 회색 점으로 표시", popOut: "지도를 별도 창으로 띄우기",
        popped: "지도가 별도 창에 있습니다.", putBack: "되돌리기", unknown: "위치 아직 모름", estimated: "≈ 추정 위치",
        old: (t) => `위치: ${t} 전`,
        estimatedTip: "시야에 들어오는 몬스터로 추정한 위치로, 오차는 약 20~30 m입니다. 전투, 회피 또는 자신에게 스킬을 쓰면 정확해집니다",
        inRange: (n) => `범위 안 ${n}`, forPets: (x) => `대상: ${x}`, toLv3: (name, left) => `${name} (Lv 3까지 ${left})`,
        noneInRange: "범위 안에 필요한 영혼을 주는 몬스터가 없습니다. 점은 출현 위치입니다.", noneOnMap: "이 지도에는 필요한 영혼을 주는 몬스터가 없습니다.",
        noMapYet: "다음 텔레포트나 지역 이동 후에 지도가 표시됩니다", noPicture: "이 장소의 지도 그림이 없습니다",
        compass4: ["북", "동", "남", "서"], compass8: ["북", "북동", "동", "남동", "남", "남서", "서", "북서"],
        zoomIn: "확대", zoomOut: "축소", back: "내 위치로", mapTip: "드래그로 이동, 휠로 확대/축소, 더블클릭하면 다시 나를 따라갑니다",
        mapLabel: "필요한 몬스터가 나타나는 곳의 지도 (북쪽이 위)", drag: "드래그해서 이동", bigger: "크게 (가장 크면 다시 작게)",
        backIn: "Pet Soul Tracker 창으로 되돌리기", credit: "aion2timers.com에서 실시간 지도 열기", creditLive: "실시간 지도 ↗", creditBy: "제공: Aion 2 Timers" },
  ja: { around: "周辺", showMap: "地図を表示", showMapTip: "レベル3未満のペットの魂を落とすモンスターの出現場所と、あなたの位置を示す地図",
        allMonsters: "すべてのモンスター", allMonstersTip: "範囲内のほかのモンスターも灰色の点で表示", popOut: "地図を別ウィンドウに出す",
        popped: "地図は別ウィンドウにあります。", putBack: "戻す", unknown: "位置はまだ不明", estimated: "≈ 推定位置",
        old: (t) => `位置は${t}前`,
        estimatedTip: "視界に入ったモンスターから推定した位置で、誤差は約20〜30 mです。戦闘、回避、自分へのスキル使用で正確になります",
        inRange: (n) => `範囲内 ${n}`, forPets: (x) => `対象: ${x}`, toLv3: (name, left) => `${name}（Lv 3まで${left}）`,
        noneInRange: "範囲内に必要な魂を落とすモンスターはいません。点は出現場所です。", noneOnMap: "この地図には必要な魂を落とすモンスターはいません。",
        noMapYet: "次のテレポートかエリア移動のあとに地図が表示されます", noPicture: "この場所の地図画像はありません",
        compass4: ["北", "東", "南", "西"], compass8: ["北", "北東", "東", "南東", "南", "南西", "西", "北西"],
        zoomIn: "拡大", zoomOut: "縮小", back: "自分の位置へ", mapTip: "ドラッグで移動、ホイールで拡大縮小、ダブルクリックで再び追従",
        mapLabel: "必要なモンスターの出現場所の地図（北が上）", drag: "ドラッグで移動", bigger: "大きく（最大の次は最小に戻る）",
        backIn: "Pet Soul Trackerのウィンドウに戻す", credit: "aion2timers.comでライブマップを開く", creditLive: "ライブマップ ↗", creditBy: "提供: Aion 2 Timers" },
  de: { around: "In der Nähe", showMap: "Karte zeigen", showMapTip: "Eine Karte, wo die Monster erscheinen, die eine Seele für ein Pet unter Stufe 3 droppen, mit dir darauf",
        allMonsters: "Alle Monster", allMonstersTip: "Auch alle anderen Monster in Reichweite, als graue Punkte", popOut: "Karte in ein eigenes Fenster lösen",
        popped: "Die Karte ist in einem eigenen Fenster.", putBack: "Zurückholen", unknown: "Position noch unbekannt", estimated: "≈ Position geschätzt",
        old: (t) => `Position von vor ${t}`,
        estimatedTip: "Geschätzt aus den Monstern, die in Sicht kommen, auf etwa 20 bis 30 m genau. Kämpfe, weiche aus oder wirke eine Fertigkeit auf dich, damit sie genau wird",
        inRange: (n) => `${n} in Reichweite`, forPets: (x) => `für ${x}`, toLv3: (name, left) => `${name} (${left} bis Lv 3)`,
        noneInRange: "Kein Monster in Reichweite droppt eine Seele, die du brauchst. Die Punkte zeigen, wo sie erscheinen.", noneOnMap: "Auf dieser Karte droppt kein Monster eine Seele, die du brauchst.",
        noMapYet: "Die Karte erscheint nach deinem nächsten Teleport oder Gebietswechsel", noPicture: "Kein Kartenbild für diesen Ort",
        compass4: ["N", "O", "S", "W"], compass8: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
        zoomIn: "Vergrößern", zoomOut: "Verkleinern", back: "Zurück zu dir", mapTip: "Ziehen zum Verschieben, Mausrad zum Zoomen, Doppelklick folgt dir wieder",
        mapLabel: "Karte, wo die Monster erscheinen, die du brauchst, Norden oben", drag: "Ziehen zum Verschieben", bigger: "Größer (danach wieder am kleinsten)",
        backIn: "Zurück ins Fenster von Pet Soul Tracker", credit: "Live-Karte auf aion2timers.com öffnen", creditLive: "Live-Karte ↗", creditBy: "von Aion 2 Timers" },
  fr: { around: "Autour de vous", showMap: "Afficher la carte", showMapTip: "Une carte des apparitions des monstres qui donnent une âme pour un familier sous le niveau 3, avec vous dessus",
        allMonsters: "Tous les monstres", allMonstersTip: "Tous les autres monstres à portée aussi, en points gris", popOut: "Détacher la carte dans sa propre fenêtre",
        popped: "La carte est dans sa propre fenêtre.", putBack: "La remettre", unknown: "position encore inconnue", estimated: "≈ position estimée",
        old: (t) => `position d'il y a ${t}`,
        estimatedTip: "Estimée d'après les monstres qui entrent dans votre champ de vision, à 20 ou 30 m près. Combattez, esquivez ou lancez une compétence sur vous pour la rendre exacte",
        inRange: (n) => `${n} à portée`, forPets: (x) => `pour ${x}`, toLv3: (name, left) => `${name} (${left} avant Niv. 3)`,
        noneInRange: "Aucun monstre à portée ne donne une âme dont vous avez besoin. Les points montrent où ils apparaissent.", noneOnMap: "Aucun monstre de cette carte ne donne une âme dont vous avez besoin.",
        noMapYet: "La carte s'affiche après votre prochaine téléportation ou changement de zone", noPicture: "Pas d'image de carte pour cet endroit",
        compass4: ["N", "E", "S", "O"], compass8: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
        zoomIn: "Zoom avant", zoomOut: "Zoom arrière", back: "Revenir sur vous", mapTip: "Glisser pour déplacer, molette pour zoomer, double-clic pour vous suivre à nouveau",
        mapLabel: "Carte des apparitions des monstres dont vous avez besoin, nord en haut", drag: "Glisser pour déplacer", bigger: "Plus grand (puis retour au plus petit)",
        backIn: "Revenir dans la fenêtre de Pet Soul Tracker", credit: "Ouvrir la carte en direct sur aion2timers.com", creditLive: "Carte en direct ↗", creditBy: "par Aion 2 Timers" },
  es: { around: "A tu alrededor", showMap: "Mostrar el mapa", showMapTip: "Un mapa de dónde aparecen los monstruos que sueltan un alma para una mascota por debajo del nivel 3, contigo en él",
        allMonsters: "Todos los monstruos", allMonstersTip: "También el resto de monstruos al alcance, como puntos grises", popOut: "Sacar el mapa a su propia ventana",
        popped: "El mapa está en su propia ventana.", putBack: "Devolverlo", unknown: "posición aún desconocida", estimated: "≈ posición estimada",
        old: (t) => `posición de hace ${t}`,
        estimatedTip: "Calculada a partir de los monstruos que entran a la vista, con un margen de unos 20 a 30 m. Lucha, esquiva o usa una habilidad sobre ti para que sea exacta",
        inRange: (n) => `${n} al alcance`, forPets: (x) => `para ${x}`, toLv3: (name, left) => `${name} (${left} para Nv. 3)`,
        noneInRange: "Ningún monstruo al alcance suelta un alma que necesites. Los puntos son donde aparecen.", noneOnMap: "Ningún monstruo de este mapa suelta un alma que necesites.",
        noMapYet: "El mapa aparece tras tu próximo teletransporte o cambio de zona", noPicture: "No hay imagen del mapa de este lugar",
        compass4: ["N", "E", "S", "O"], compass8: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
        zoomIn: "Acercar", zoomOut: "Alejar", back: "Volver a ti", mapTip: "Arrastra para mover, rueda para hacer zoom, doble clic para seguirte de nuevo",
        mapLabel: "Mapa de dónde aparecen los monstruos que necesitas, norte arriba", drag: "Arrastra para mover", bigger: "Más grande (luego vuelve al más pequeño)",
        backIn: "Volver a la ventana de Pet Soul Tracker", credit: "Abrir el mapa en vivo en aion2timers.com", creditLive: "Mapa en vivo ↗", creditBy: "por Aion 2 Timers" },
  pt: { around: "Ao seu redor", showMap: "Mostrar o mapa", showMapTip: "Um mapa de onde surgem os monstros que dropam uma alma para um mascote abaixo do nível 3, com você nele",
        allMonsters: "Todos os monstros", allMonstersTip: "Também os outros monstros ao alcance, como pontos cinza", popOut: "Destacar o mapa em uma janela própria",
        popped: "O mapa está em uma janela própria.", putBack: "Trazer de volta", unknown: "posição ainda desconhecida", estimated: "≈ posição estimada",
        old: (t) => `posição de ${t} atrás`,
        estimatedTip: "Estimada pelos monstros que entram no campo de visão, com margem de uns 20 a 30 m. Lute, esquive ou use uma habilidade em você para torná-la exata",
        inRange: (n) => `${n} ao alcance`, forPets: (x) => `para ${x}`, toLv3: (name, left) => `${name} (${left} até Nv. 3)`,
        noneInRange: "Nenhum monstro ao alcance dropa uma alma de que você precisa. Os pontos são onde eles surgem.", noneOnMap: "Nenhum monstro deste mapa dropa uma alma de que você precisa.",
        noMapYet: "O mapa aparece após seu próximo teleporte ou mudança de área", noPicture: "Sem imagem de mapa para este lugar",
        compass4: ["N", "L", "S", "O"], compass8: ["N", "NE", "L", "SE", "S", "SO", "O", "NO"],
        zoomIn: "Aproximar", zoomOut: "Afastar", back: "Voltar para você", mapTip: "Arraste para mover, roda para zoom, clique duplo para seguir você de novo",
        mapLabel: "Mapa de onde surgem os monstros de que você precisa, norte para cima", drag: "Arraste para mover", bigger: "Maior (depois volta ao menor)",
        backIn: "Voltar para a janela do Pet Soul Tracker", credit: "Abrir o mapa ao vivo no aion2timers.com", creditLive: "Mapa ao vivo ↗", creditBy: "por Aion 2 Timers" },
  ru: { around: "Вокруг вас", showMap: "Показывать карту", showMapTip: "Карта мест появления монстров, с которых падает душа для питомца ниже 3-го уровня, и ваше положение на ней",
        allMonsters: "Все монстры", allMonstersTip: "Остальные монстры поблизости тоже, серыми точками", popOut: "Вынести карту в отдельное окно",
        popped: "Карта в отдельном окне.", putBack: "Вернуть", unknown: "положение пока неизвестно", estimated: "≈ примерное положение",
        old: (t) => `положение ${t} назад`,
        estimatedTip: "Определено по монстрам, появляющимся в поле зрения, с точностью около 20–30 м. Сражайтесь, уклоняйтесь или примените умение на себя, чтобы оно стало точным",
        inRange: (n) => `рядом: ${n}`, forPets: (x) => `для: ${x}`, toLv3: (name, left) => `${name} (${left} до ур. 3)`,
        noneInRange: "Поблизости нет монстров, с которых падает нужная вам душа. Точки — места их появления.", noneOnMap: "На этой карте нет монстров, с которых падает нужная вам душа.",
        noMapYet: "Карта появится после следующего телепорта или смены локации", noPicture: "Для этого места нет изображения карты",
        compass4: ["С", "В", "Ю", "З"], compass8: ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"],
        zoomIn: "Приблизить", zoomOut: "Отдалить", back: "К вам", mapTip: "Перетаскивайте, чтобы сдвинуть, колесо — масштаб, двойной щелчок — снова следовать за вами",
        mapLabel: "Карта мест появления нужных монстров, север сверху", drag: "Перетащите, чтобы переместить", bigger: "Крупнее (после самого большого — снова маленький)",
        backIn: "Вернуть в окно Pet Soul Tracker", credit: "Открыть живую карту на aion2timers.com", creditLive: "Живая карта ↗", creditBy: "от Aion 2 Timers" },
  "zh-Hant": { around: "周圍", showMap: "顯示地圖", showMapTip: "顯示掉落 3 級以下寵物靈魂的怪物出現位置與你所在位置的地圖",
        allMonsters: "所有怪物", allMonstersTip: "範圍內的其他怪物也以灰點顯示", popOut: "將地圖彈出為獨立視窗",
        popped: "地圖在獨立視窗中。", putBack: "放回", unknown: "位置尚未知", estimated: "≈ 推估位置",
        old: (t) => `位置是 ${t} 前的`,
        estimatedTip: "依進入視野的怪物推估，誤差約 20 至 30 公尺。戰鬥、閃避或對自己使用技能即可取得精確位置",
        inRange: (n) => `範圍內 ${n}`, forPets: (x) => `適用：${x}`, toLv3: (name, left) => `${name}（距 Lv 3 還差 ${left}）`,
        noneInRange: "範圍內沒有掉落你所需靈魂的怪物。圓點是牠們的出現位置。", noneOnMap: "這張地圖上沒有掉落你所需靈魂的怪物。",
        noMapYet: "下次傳送或切換區域後就會顯示地圖", noPicture: "此地點沒有地圖圖片",
        compass4: ["北", "東", "南", "西"], compass8: ["北", "東北", "東", "東南", "南", "西南", "西", "西北"],
        zoomIn: "放大", zoomOut: "縮小", back: "回到你的位置", mapTip: "拖曳移動，滾輪縮放，按兩下重新跟隨你",
        mapLabel: "你需要的怪物出現位置地圖，北方在上", drag: "拖曳以移動", bigger: "放大（最大後回到最小）",
        backIn: "放回 Pet Soul Tracker 視窗", credit: "在 aion2timers.com 開啟即時地圖", creditLive: "即時地圖 ↗", creditBy: "由 Aion 2 Timers 提供" },
  "zh-Hans": { around: "周围", showMap: "显示地图", showMapTip: "显示掉落 3 级以下宠物灵魂的怪物出现位置与你所在位置的地图",
        allMonsters: "所有怪物", allMonstersTip: "范围内的其他怪物也以灰点显示", popOut: "将地图弹出为独立窗口",
        popped: "地图在独立窗口中。", putBack: "放回", unknown: "位置尚未知", estimated: "≈ 估计位置",
        old: (t) => `位置是 ${t} 前的`,
        estimatedTip: "根据进入视野的怪物估计，误差约 20 至 30 米。战斗、闪避或对自己使用技能即可获得精确位置",
        inRange: (n) => `范围内 ${n}`, forPets: (x) => `适用：${x}`, toLv3: (name, left) => `${name}（距 Lv 3 还差 ${left}）`,
        noneInRange: "范围内没有掉落你所需灵魂的怪物。圆点是它们的出现位置。", noneOnMap: "这张地图上没有掉落你所需灵魂的怪物。",
        noMapYet: "下次传送或切换区域后就会显示地图", noPicture: "此地点没有地图图片",
        compass4: ["北", "东", "南", "西"], compass8: ["北", "东北", "东", "东南", "南", "西南", "西", "西北"],
        zoomIn: "放大", zoomOut: "缩小", back: "回到你的位置", mapTip: "拖动移动，滚轮缩放，双击重新跟随你",
        mapLabel: "你需要的怪物出现位置地图，北方在上", drag: "拖动以移动", bigger: "放大（最大后回到最小）",
        backIn: "放回 Pet Soul Tracker 窗口", credit: "在 aion2timers.com 打开实时地图", creditLive: "实时地图 ↗", creditBy: "由 Aion 2 Timers 提供" },
};
const mui = () => MAP_UI[language] || MAP_UI.en;
// The words in the page's own HTML, in the meter's language.
function applyMapText() {
  const t = mui();
  const set = (node, text, title) => {
    if (text != null) node.textContent = text;
    if (title != null) node.title = title;
  };
  set(els.nearbyOn.parentElement.lastChild, ` ${t.showMap}`);
  els.nearbyOn.parentElement.title = t.showMapTip;
  set(els.allNpcs.parentElement.lastChild, ` ${t.allMonsters}`);
  els.allNpcs.parentElement.title = t.allMonstersTip;
  els.popOut.title = t.popOut;
  els.poppedNote.firstChild.textContent = `${t.popped} `;
  set(els.popIn, t.putBack);
  set(els.zoomIn, null, t.zoomIn);
  set(els.zoomOut, null, t.zoomOut);
  set(els.follow, null, t.back);
  els.minimap.title = t.mapTip;
  els.minimap.setAttribute("aria-label", t.mapLabel);
  // The credit is Aion 2 Timers' badge: its tooltip, and its two lines.
  set(els.mapCredit, null, t.credit);
  els.mapCredit.querySelector(".creditLive").textContent = t.creditLive;
  els.mapCredit.querySelector(".creditBy").textContent = t.creditBy;
}

// The map shown: the one the game said it loaded, else (the meter started
// mid-session) the one whose spawns list the monsters in range, else the one
// last loaded on this server (prefs.lastMaps): the game says only as a map
// loads, so a meter started in a zone showed no map until a teleport.
function currentMap() {
  if (field.mapId) return field.mapId;
  const votes = {};
  for (const n of field.npcs.values()) {
    for (const [id, spawns] of Object.entries(PET_SPAWNS)) if (spawns[n.npc]) votes[id] = (votes[id] || 0) + 1;
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return best ? Number(best[0]) : (key && prefs.lastMaps?.[key]) || null;
}
// The map itself (minimap.js), in the window; the pop-out draws its own from
// the same scene.
const minimap = new PetMiniMap.MiniMap(
  { canvas: els.minimap, zoomIn: els.zoomIn, zoomOut: els.zoomOut, follow: els.follow, note: els.mapNote },
  { zoom: prefs.mapZoom, onZoom: (zoom) => { prefs.mapZoom = zoom; savePrefs(); } },
);

let nearbyTimer = 0;
// Redrawn at most 5 times a second, however many records come.
function queueNearby() {
  if (nearbyTimer) return;
  nearbyTimer = setTimeout(() => {
    nearbyTimer = 0;
    renderNearby();
  }, 200);
}
let nearbyShape = "";
let nearbyLive = { wanted: [], others: [] };
function renderNearby() {
  // Off unless turned on (Filters → Show the map).
  const on = prefs.nearby === true;
  els.nearby.hidden = !on;
  if (!on) {
    // Its pictures out of memory while it is off.
    minimap.release();
    return;
  }
  const t = mui();
  const now = Date.now();
  // Every monster in range, with its distance from you when you are known.
  const you = field.where(now);
  const me = you?.pos;
  const live = [...field.npcs.values()].map((n) => (me ? { ...n, m: PetNearby.metres(me, n.pos), deg: PetNearby.bearing(me, n.pos) } : n));
  if (me) live.sort((a, b) => a.m - b.m);
  const wanted = [];
  const others = [];
  for (const n of live) {
    const pets = neededFrom(n.npc);
    if (pets.length) wanted.push({ ...n, pets });
    else others.push(n);
  }
  nearbyLive = { wanted, others };
  // Sorted by nearest: again once you've moved on, or the map changed.
  if (prefs.sort === "near" && me) {
    const map = currentMap();
    const moved = !nearFrom || nearFrom.map !== map || Math.hypot(me[0] - nearFrom.x, me[1] - nearFrom.y) / 100 >= NEAR_STEP_M;
    // Noted now and drawn on the next tick: the list's render draws this too.
    if (moved) {
      nearFrom = { map, x: me[0], y: me[1] };
      setTimeout(render, 0);
    }
  }
  const id = currentMap();
  els.nearbyTitle.textContent = id ? (MAP_NAMES[id] ? text(MAP_NAMES[id]) : PET_MAPS[id]?.name || t.around) : t.around;
  // Exact, estimated from what came into view, or old.
  const stale = !!you && !you.estimated && now - you.at > STALE_MS;
  els.nearbyWhere.textContent = !you ? t.unknown
    : you.estimated ? t.estimated
    : stale ? t.old(agoText(now - you.at)) : "";
  els.nearbyWhere.title = you?.estimated ? t.estimatedTip : "";
  els.nearbyWhere.classList.toggle("stale", stale || !you);
  els.nearbyWhere.classList.toggle("estimated", !!you?.estimated);
  // How many spawns on this map drop a soul you need, and how many are in range.
  let spawns = 0;
  for (const [npc, points] of Object.entries(PET_SPAWNS[id] || {})) if (neededFrom(npc).length) spawns += points.length / 2;
  els.nearbyCount.textContent = `${ui().spawns(spawns.toLocaleString(language))} · ${t.inRange(wanted.length)}`;
  // What the map draws, here and in the pop-out.
  const spawnColours = {};
  for (const npc of Object.keys(PET_SPAWNS[id] || {})) {
    const pets = neededFrom(npc);
    if (pets.length) spawnColours[npc] = colourOf(pets);
  }
  const scene = {
    mapId: id,
    you: you ? { pos: you.pos, at: you.at, estimated: !!you.estimated } : null,
    wanted: wanted.map((n) => ({ pos: n.pos, colour: colourOf(n.pets) })),
    others: prefs.allNpcs ? others.map((n) => n.pos) : [],
    spawnColours,
    title: els.nearbyTitle.textContent,
    where: els.nearbyWhere.textContent,
    whereTitle: els.nearbyWhere.title,
    whereClass: stale || !you ? "stale" : you.estimated ? "estimated" : "",
    count: els.nearbyCount.textContent,
    // The map's own words, and the pop-out's.
    labels: { compass: t.compass4, noMapYet: t.noMapYet, noPicture: t.noPicture, credit: t.credit, creditLive: t.creditLive, creditBy: t.creditBy,
              zoomIn: t.zoomIn, zoomOut: t.zoomOut, back: t.back, mapTip: t.mapTip, mapLabel: t.mapLabel,
              drag: t.drag, bigger: t.bigger, backIn: t.backIn },
  };
  lastScene = scene;
  sendPop(scene);
  els.mapBox.hidden = popOpen;
  els.poppedNote.hidden = !popOpen;
  els.popOut.hidden = popOpen || !canPop();
  minimap.set(scene);

  // One row per kind of monster in range, nearest first: its name and level,
  // how many, the pets it drops souls for with the souls each still needs,
  // and the way.
  const kinds = new Map();
  for (const n of wanted) {
    const k = kinds.get(n.npc);
    if (k) k.count += 1;
    else kinds.set(n.npc, { ...n, count: 1 });
  }
  const rows = [...kinds.values()].slice(0, NEARBY_ROWS).map((k) => {
    const drop = NPC_DROPS[k.npc];
    const li = el("li");
    li.style.setProperty("--g", colourOf(k.pets));
    const who = el("span", "who");
    who.append(el("i", "dot"), el("span", "npcName", text(drop.npc)));
    if (drop.level) who.append(el("small", "", `Lv ${drop.level}`));
    if (k.count > 1) who.append(el("small", "", `×${k.count}`));
    const dist = el("span", "dist", k.m != null ? `${Math.round(k.m)} m ${t.compass8[Math.round(k.deg / 45) % 8]}` : "");
    const souls = el("span", "for", t.forPets(listOf(k.pets.map((p) => t.toLv3(p.name, p.left)))));
    souls.title = souls.textContent;
    li.append(who, dist, souls);
    return li;
  });
  if (!rows.length) {
    rows.push(el("li", "none", spawns ? t.noneInRange : t.noneOnMap));
  }
  els.nearbyList.replaceChildren(...rows);
  // The farming pop-up follows its height.
  const shape = `${rows.length}`;
  if (shape !== nearbyShape) {
    nearbyShape = shape;
    fitFarm();
  }
}

// ---- The pop-out: the map in a window of its own (a widget, meter 2.0.68 on)
//
// The widget (widget.html) draws the same map from the scene sent to it, a
// few times a second; it can be dragged anywhere by its bar and locked with
// the plugin's other widgets. Its size steps through POP_SIZES; × puts the
// map back in this window.
const POP = "map";
const POP_SIZES = [[300, 270], [380, 340], [480, 420], [600, 520], [760, 660]];
const canPop = () => !!(a2.widgets && typeof a2.widgets.open === "function");
const popSize = () => POP_SIZES[Math.max(0, Math.min(POP_SIZES.length - 1, Number(prefs.popSize) || 1))];
let popOpen = false;
async function popOut() {
  if (!canPop()) return;
  const [width, height] = popSize();
  popOpen = await a2.widgets.open(POP, { width, height }).then(() => true, () => false);
  if (!popOpen) return;
  prefs.mapPopped = true;
  savePrefs();
  renderNearby();
}
function popIn() {
  if (popOpen) a2.widgets.close(POP).catch(() => {});
  popOpen = false;
  prefs.mapPopped = false;
  savePrefs();
  renderNearby();
  fitFarm();
}
function sendPop(scene) {
  if (!popOpen) return;
  a2.widgets.send(POP, { ...scene, zoom: prefs.popZoom }).catch(() => {});
}
let lastScene = null;
a2.on("widget-message", (msg) => {
  if (msg?.name !== POP) return;
  const d = msg.data || {};
  if (d.hello && lastScene) sendPop(lastScene);
  if (d.zoom != null) {
    prefs.popZoom = d.zoom;
    savePrefs();
  }
  if (d.size != null) {
    prefs.popSize = (Number(prefs.popSize ?? 1) + 1) % POP_SIZES.length;
    savePrefs();
    popOut();
  }
  if (d.close) popIn();
});
els.popOut.addEventListener("click", popOut);
els.popIn.addEventListener("click", popIn);

// When the meter says when it read a record, that; else now.
const readAt = (meta) => (Number(meta?.at) > 0 ? Math.min(Number(meta.at), Date.now()) : Date.now());
a2.on("decoded:npc-spawn", (d, meta) => {
  field.spawn(d, readAt(meta));
  queueNearby();
});
// Any entity leaving (players too): only a monster the map shows redraws it.
a2.on("decoded:npc-gone", (d) => {
  if (field.gone(d)) queueNearby();
});
a2.on("decoded:map-load", (d, meta) => {
  field.mapLoad(d, readAt(meta));
  const k = keyFor(meta?.character) || key;
  if (k && d.map > 0 && prefs.lastMaps?.[k] !== d.map) {
    prefs.lastMaps = { ...(prefs.lastMaps || {}), [k]: d.map };
    savePrefs();
  }
  queueNearby();
});
// A record about you (kind 11), or one of your effects landing on you (kind
// 13: 4 more bytes before q, as Hidden Cube Finder reads it). One decoder
// reads both as kind 11 lays them out, so each record comes once: in a kind
// 13, x holds q in its top byte and y and z hold its x and y (its height
// isn't read; the map doesn't use it). The meter passes on only records
// whose source is you ("self").
a2.on("decoded:own-position", (d, meta) => {
  if (d.target !== d.source || d.one !== 1 || d.p !== 1) return;
  const at = readAt(meta);
  if (d.kind === 0x11 && d.q === 0) field.here(d, at);
  else if (d.kind === 0x13 && d.x >>> 24 === 0) field.here({ x: d.y, y: d.z, z: 0 }, at);
  else return;
  queueNearby();
});
// A mantra goes with you (ends 02): a Chanter's position once a second.
a2.on("decoded:mantra-tick", (d, meta) => {
  if (d.target !== d.source || d.kind !== 0x13 || d.q !== 2) return;
  field.here(d, readAt(meta));
  queueNearby();
});
a2.on("decoded:teleport", (d, meta) => {
  // Entity 0: you being teleported, not another entity's update.
  if (d.flag !== 0) return;
  field.teleport(d, readAt(meta));
  queueNearby();
});

// ---- The layouts: how each pet's row is drawn (Settings → Layout) --------

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
// Its pin, its name (double-click to rename), its genus (unless the layout
// shows it elsewhere) and, while farmed, the tag.
function nameOf(p, { pinned, farming }, { genus = true } = {}) {
  const name = el("span", "name");
  const pin = el("button", "pin", pinned ? "★" : "☆");
  pin.type = "button";
  pin.title = pinned ? "Unpin" : "Pin to the top";
  pin.setAttribute("aria-pressed", String(pinned));
  const text = el("span", "nameText", p.name);
  text.title = `${p.name}${p.genus ? ` · ${genusName(p.genus)}` : ""} (double-click to rename)`;
  text.addEventListener("dblclick", () => rename(p.id, text));
  name.append(pin, text);
  if (genus && p.genus) name.append(el("span", "genusTag", genusName(p.genus)));
  if (farming) {
    const tag = el("span", "farming", "farming");
    tag.title = "You picked up a soul for this pet in the last 30 minutes";
    name.append(tag);
  }
  return name;
}
// The way to level 3 in its three steps (5, 25 and 75 souls): the steps
// done full, the current one by its souls, the count beside it.
function stepsOf(p) {
  const souls = el("span", "souls");
  const steps = el("span", "steps");
  steps.title = p.target ? `${p.points}/${p.target} souls toward level ${p.level + 1}` : "Level 3";
  for (let l = 0; l < MAX_LEVEL; l += 1) {
    const step = el("i");
    const fill = l < p.level ? 1 : l === p.level && p.target ? p.points / p.target : 0;
    step.style.setProperty("--f", `${Math.min(100, fill * 100)}%`);
    steps.append(step);
  }
  souls.append(steps, el("span", "count", p.target ? `${p.points}/${p.target}` : "MAX"));
  return souls;
}
const leftTitle = (p) => (p.target ? `${p.left} souls to level 3` : "");

const LAYOUTS = {
  // A card: the level ring, the name and the souls left in its corner, and
  // under them the three steps.
  cards(p, flags) {
    const li = el("li");
    const left = el("span", "left");
    if (p.target) left.append(el("b", "", String(p.left)), " left");
    left.title = leftTitle(p);
    const top = el("div", "line");
    top.append(nameOf(p, flags), left);
    const main = el("div", "main");
    main.append(top, stepsOf(p));
    li.append(levelRing(p), main);
    return li;
  },
  // A card that fills with the souls toward the next level: its genus icon,
  // its level as dots, the souls left large.
  filled(p, flags) {
    const li = el("li");
    li.style.setProperty("--p", `${Math.min(100, p.progress * 100)}%`);
    const main = el("div", "main");
    const sub = el("div", "line sub");
    const pips = el("span", "pips");
    pips.title = `Level ${Math.min(p.level, MAX_LEVEL)}`;
    for (let l = 0; l < MAX_LEVEL; l += 1) pips.append(el("i", l < p.level ? "on" : ""));
    sub.append(pips, el("span", "count", p.target ? `${p.points}/${p.target}` : "MAX"));
    if (p.genus) sub.append(el("span", "genusName", genusName(p.genus)));
    const top = el("div", "line");
    top.append(nameOf(p, flags, { genus: false }));
    main.append(top, sub);
    const left = el("span", "left");
    if (p.target) left.append(el("b", "", String(p.left)), el("small", "", "to Lv 3"));
    left.title = leftTitle(p);
    li.append(genusIcon(p.genus), main, left);
    return li;
  },
  // One line: the level ring, the name, the three steps, the souls left.
  rows(p, flags) {
    const li = el("li");
    const left = el("span", "left", p.target ? String(p.left) : "");
    left.title = leftTitle(p);
    li.append(levelRing(p), nameOf(p, flags), stepsOf(p), left);
    return li;
  },
  // The table as it was: level, name, a bar of the souls toward the next
  // level, the souls left.
  classic(p, flags) {
    const li = el("li");
    const bar = el("span", "bar");
    const fill = el("span");
    fill.style.width = `${Math.min(100, p.progress * 100)}%`;
    bar.append(fill, el("span", "count", p.target ? `${p.points}/${p.target}` : ""));
    const left = el("span", "left", p.target ? String(p.left) : "");
    left.title = leftTitle(p);
    li.append(el("span", "level", p.level >= MAX_LEVEL ? "MAX" : `Lv ${p.level}`), nameOf(p, flags), bar, left);
    return li;
  },
};
const LAYOUT_NAMES = { cards: "Cards", filled: "Filled cards", rows: "Rows", classic: "Classic" };

// Each genus's mark: an eye (Cogni), a paw (Fera), a leaf (Natura), a
// spiral (Varian).
const GENUS_ICONS = {
  cogni: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  fera: "M12 13c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 2.8 2.3 1.2 0 1.8-.6 2.7-.6s1.5.6 2.7.6c1.4 0 2.8-.7 2.8-2.3C17.5 16 15 13 12 13ZM5 11.5a2 2.4 0 1 0 0 .01M19 11.5a2 2.4 0 1 0 0 .01M9 7a2 2.5 0 1 0 0 .01M15 7a2 2.5 0 1 0 0 .01",
  natura: "M5 19C5 10 10 5 20 4c0 9-5 15-13 15m-2 0 8-8",
  varian: "M12 12m-1 0a1 1 0 1 1 2 0 3 3 0 1 1-6 0 5 5 0 1 1 10 0 7 7 0 1 1-14 0 9 9 0 0 1 9-9",
};
function genusIcon(genus) {
  const NS = "http://www.w3.org/2000/svg";
  const box = el("span", "icon");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", GENUS_ICONS[genus] || "M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0");
  svg.append(path);
  box.append(svg);
  return box;
}

// A pet's level in a ring of its genus colour, the ring filling with the
// souls toward the next level (full and gold at level 3).
function levelRing(p) {
  const NS = "http://www.w3.org/2000/svg";
  const box = document.createElement("span");
  box.className = "ring";
  box.title = `Level ${Math.min(p.level, MAX_LEVEL)}`;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("aria-hidden", "true");
  const circle = (cls, part) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("class", cls);
    c.setAttribute("cx", "18");
    c.setAttribute("cy", "18");
    c.setAttribute("r", "15");
    c.setAttribute("pathLength", "100");
    if (part != null) c.setAttribute("stroke-dasharray", `${part} 100`);
    return c;
  };
  svg.append(circle("track"), circle("arc", Math.round(Math.min(1, p.progress) * 100)));
  const n = document.createElement("b");
  n.textContent = String(Math.min(p.level, MAX_LEVEL));
  box.append(svg, n);
  return box;
}

// When the pet list came: the time today, else the date and time.
function syncedText(at) {
  const d = new Date(at);
  const today = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  return today ? time : `${d.toLocaleDateString(language, { month: "short", day: "numeric" })} ${time}`;
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
  const tag = (t, cls = "") => {
    const span = document.createElement("span");
    span.className = `tag ${cls}`.trim();
    span.textContent = t;
    return span;
  };
  const hidden = new Set(hiddenRegions());
  const elsewhere = new Set();
  // The monsters with the most spawns first: the easiest to find (a
  // player's request, 2026-10-19); the game data's order otherwise.
  const drops = [...src.drops].sort((x, y) => (y.spawns || 0) - (x.spawns || 0));
  for (const d of drops) {
    if (hidden.has(regionOf(d))) {
      elsewhere.add(regionOf(d));
      continue;
    }
    const who = line("who", text(d.npc));
    if (d.level) who.append(tag(`Lv ${d.level}`));
    if (d.chance) who.append(tag(d.chance, "chance"));
    box.append(who);
    // In the Abyss each side has Kibelisks of its own: yours, when known.
    const k = d.bySide?.[sideOf(key)] || d.kibelisk;
    // The teleport's number as the in-game map lists it, where known.
    const kib = k && `${text(k.name)} · ${k.m.toLocaleString(language)} m`;
    const kibelisk = kib && (k.teleport ? words.teleport(k.teleport, kib) : words.near(kib));
    const zones = listOf((d.zones || []).map(text)) || "?";
    const at = line("at", zones, d.map && text(d.map), d.spawns && words.spawns(d.spawns), kibelisk);
    const href = mapLink(d, k);
    if (href) {
      const link = document.createElement("a");
      link.href = href;
      // A folded map before the word.
      const NS = "http://www.w3.org/2000/svg";
      const icon = document.createElementNS(NS, "svg");
      icon.setAttribute("class", "mapIcon");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5");
      icon.append(path);
      link.append(icon, words.map);
      // Aion 2 Timers' map, which the address shows.
      link.title = href;
      at.append(" · ", link);
    }
    box.append(at);
  }
  for (const c of src.chests) {
    const who = line("who chest", text(c.name));
    who.append(tag(words.perOpening(c.chance), "chance"));
    box.append(who);
    if (c.from) box.append(line("at", words.boxFrom(listOf(c.from.map(text)))));
  }
  if (!src.drops.length && !src.chests.length) box.append(line("at", words.noDrops));
  if (elsewhere.size) box.append(line("at", words.also(listOf([...elsewhere].map((r) => text(REGION_MAP[r]))))));
  return box;
}

// The languages the Aion 2 Timers map speaks besides English.
const MAP_LANGUAGES = new Set(["de", "fr", "es", "it", "ja", "ko", "pl", "pt", "ru", "tr"]);

// A drop's monster on the Aion 2 Timers map, opened in the browser: every
// spawn of it on its map, and the nearest teleport, measured from the spawn
// this list measures from (`at`), so the two give the same distance. Their
// teleport is the nearest of all; where this list takes your side's own
// Kibelisk (the Abyss), it is named (`to`), which leaves it unlabelled there.
// Coordinates are the game's world units, as theirs are. The name goes in
// English, as their map reads it. Spec: homelessguynabox/a2tools-integration,
// reference/map-links.md.
function mapLink(d, k) {
  if (!d.npcId) return null;
  const q = new URLSearchParams();
  if (d.mapId) q.set("map", String(d.mapId));
  q.set("pet", String(d.npcId));
  const name = SOURCE_TEXT[d.npc]?.en ?? (String(d.npc ?? "").startsWith("=") ? d.npc.slice(1) : "");
  if (name) q.set("petName", name);
  if (k?.at) {
    q.set("x", String(Math.round(k.at[0])));
    q.set("y", String(Math.round(k.at[1])));
  }
  if (k?.to && String(k.to) !== String(d.kibelisk?.to)) {
    q.set("tx", String(Math.round(k.to[0])));
    q.set("ty", String(Math.round(k.to[1])));
  }
  const lang = language.startsWith("zh") ? "zh" : MAP_LANGUAGES.has(language) ? language : "";
  if (lang) q.set("lang", lang);
  return "https://www.aion2timers.com/map/?" + q.toString();
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

// Each pet's souls in a soul-gained event.
const soulsIn = (data) => (Array.isArray(data?.souls) ? data.souls : data && data.pet != null ? [{ pet: data.pet, amount: data.amount }] : []);
// Whether the pet was below level 3: being farmed.
function gain(st, pet, amount, at = Date.now()) {
  const farmed = (st.levels[pet] || 0) < MAX_LEVEL;
  st.points[pet] = (st.points[pet] || 0) + amount;
  st.lastGain = { pet, at };
  if (farmed) {
    const now = Date.now();
    st.farmed = Object.fromEntries(Object.entries(st.farmed || {}).filter(([, t]) => now - t < FARMING_MS));
    st.farmed[pet] = at;
  }
  levelUp(st, pet);
  return farmed;
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
  // A kill can give souls for several pets at once: the packet lists each
  // (BobbySk, 2026-10-19: two pets in one, and only the first was counted).
  // Before 0.4.6 the decoder read one pet; its events still come as { pet, amount }.
  // Returns whether one was a pet being farmed.
  "decoded:soul-gained"(st, data, at) {
    let farmed = false;
    for (const { pet, amount } of soulsIn(data)) farmed = gain(st, pet, amount, at) || farmed;
    return farmed;
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
  if (event === "decoded:soul-gained") {
    for (const soul of soulsIn(data)) noteOne(st, event, soul);
    return;
  }
  noteOne(st, event, data);
}
function noteOne(st, event, data) {
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
    const at = Number(meta?.at) > 0 ? Number(meta.at) : Date.now();
    const farmed = handle[event](st, data, at);
    note(st, event, data);
    await a2.storage.set(k, st).catch(() => {});
    await a2.storage.set("last", k).catch(() => {});
    if (k !== key) await show(k);
    else render();
    // Not for the souls of before the window opened, which the meter sends
    // again as it opens.
    const live = meta?.at != null ? Date.now() - Number(meta.at) < 15_000 : Date.now() - startedAt > 5_000;
    if (farmed && live) popFarm();
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
  renderScale();
  applyMapText();
  render();
  renderNearby();
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
els.filtersButton.addEventListener("click", () => {
  prefs.filtersOpen = !prefs.filtersOpen;
  savePrefs();
  render();
});
els.layout.addEventListener("change", () => {
  prefs.layout = els.layout.value;
  savePrefs();
  applyLayout();
  render();
});
els.scale.addEventListener("change", () => {
  prefs.scale = Number(els.scale.value);
  savePrefs();
  applyScale();
});
els.chestOnly.addEventListener("change", () => {
  prefs.chestOnly = els.chestOnly.checked;
  savePrefs();
  render();
});
els.farmPopup.addEventListener("change", () => {
  prefs.farmPopup = els.farmPopup.checked;
  els.farmAfter.hidden = !prefs.farmPopup;
  savePrefs();
  render();
});
els.hideAfter.addEventListener("change", () => {
  prefs.hideAfter = Number(els.hideAfter.value);
  savePrefs();
});
els.nearbyOn.addEventListener("change", () => {
  prefs.nearby = els.nearbyOn.checked;
  savePrefs();
  // Off, the pop-out goes too.
  if (!prefs.nearby && popOpen) popIn();
  // The list too: its Nearest button comes and goes with the map.
  render();
  fitFarm();
});
els.allNpcs.addEventListener("change", () => {
  prefs.allNpcs = els.allNpcs.checked;
  savePrefs();
  renderNearby();
});
els.toFull.addEventListener("click", showFull);
els.toFarm.addEventListener("click", () => {
  poppedAt = Date.now();
  showFarm();
});
els.farmHide.addEventListener("click", hideFarm);
els.hideMax.addEventListener("change", () => {
  prefs.hideMax = els.hideMax.checked;
  savePrefs();
  render();
});
// A click on a pet shows or hides where its souls drop (a double click on
// its name still renames it).
const onListClick = (e) => {
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
};
els.list.addEventListener("click", onListClick);
els.farmList.addEventListener("click", onListClick);
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
  els.chestOnly.checked = !!prefs.chestOnly;
  els.farmPopup.checked = !!prefs.farmPopup;
  els.farmAfter.hidden = !prefs.farmPopup;
  els.nearbyOn.checked = prefs.nearby === true;
  minimap.setZoom(prefs.mapZoom);
  els.allNpcs.checked = !!prefs.allNpcs;
  if (!canFit()) {
    els.farmPopup.disabled = true;
    els.farmPopup.parentElement.title = "Needs meter 2.0.65 or later";
  }
  els.hideAfter.replaceChildren(...HIDE_AFTER.map((n) =>
    Object.assign(document.createElement("option"), { value: String(n), textContent: n ? (n < 60 ? `${n} s` : `${n / 60} min`) : "Never" })));
  els.hideAfter.value = String(HIDE_AFTER.includes(Number(prefs.hideAfter)) ? Number(prefs.hideAfter) : 20);
  applyLayout();
  applyScale();
  renderScale();
  applyMapText();
  await a2.ready();
  // The "farming" mark wears off without an event to redraw it.
  setInterval(() => { if (state.lastGain) render(); }, 60_000);
  // The map popped out last time comes back out.
  if (prefs.mapPopped && prefs.nearby === true) popOut();
  // How old your position is, as it ages.
  setInterval(() => { if (field.me || field.arrivals.length) queueNearby(); }, 1000);
  // Without a character from the meter, show the last one tracked.
  queued(async () => { if (!key) await show(await fallbackKey()); });
})();
