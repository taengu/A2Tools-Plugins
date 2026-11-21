// The Artifact Siege, at the top of the Events tab: who holds each Abyss
// artifact (the corridors), and during the siege each Dimensional Core's HP
// or its fall. From a2tools.app, where players' meters report what they see
// (a2.abyssSiege, meter 2.0.72 on), and from this player's own meter as the
// game tells it (the "abyss" event, with the Abyss map and on entering).
//
// Read every 15 seconds while the siege is on or about to be, every 5
// minutes otherwise. Loaded after pins.js (pinState).

// The game's own names (L10N, 2026-10-18); Chinese falls back to English
// but for the map, which the plugin has.
const SIEGE_NAMES = {
 "en": {
  "map20": "Chaotic Lower Reshanta",
  "map22": "Chaotic Middle Reshanta",
  "a1": "Reshanta's Root Artifact",
  "a2": "Sulfur Tree Island Artifact",
  "a3": "Archipelago of Siel's Wings Artifact",
  "core": "Dimensional Core"
 },
 "ko": {
  "map20": "혼돈의 에레슈란타 하층",
  "map22": "혼돈의 에레슈란타 중층",
  "a1": "에레슈란타의 뿌리 아티팩트",
  "a2": "유황나무섬 아티팩트",
  "a3": "시엘의 날개 군도 아티팩트",
  "core": "차원핵"
 },
 "ja": {
  "map20": "混沌のエレシュランタ下層",
  "map22": "混沌のエレシュランタ中層",
  "a1": "エレシュランタの根のアーティファクト",
  "a2": "硫黄木の島のアーティファクト",
  "a3": "シエルの翼の群島のアーティファクト",
  "core": "次元核"
 },
 "de": {
  "map20": "Chaotische Untere Ebene von Reshanta",
  "map22": "Chaotische Mittlere Ebene von Reshanta",
  "a1": "Wurzelartefakt von Reshanta",
  "a2": "Artefakt der Schwefelbauminsel",
  "a3": "Artefakt von Siels Schwingen-Archipel",
  "core": "Dimensionskern"
 },
 "fr": {
  "map20": "Reshanta Inférieur du Chaos",
  "map22": "Reshanta Intermédiaire du Chaos",
  "a1": "Artefact des Racines de Reshanta",
  "a2": "Artefact de l'Île des Arbres de Soufre",
  "a3": "Artefact de l'Archipel des Ailes de Siel",
  "core": "Noyau dimensionnel"
 },
 "es": {
  "map20": "Reshanta Inferior del Caos",
  "map22": "Reshanta Intermedia del Caos",
  "a1": "Artefacto de Raíces de Reshanta",
  "a2": "Artefacto de la Isla del Árbol de Azufre",
  "a3": "Artefacto del Archipiélago Alas de Siel",
  "core": "Núcleo dimensional"
 },
 "pt": {
  "map20": "Piso Inferior de Reshanta do Caos",
  "map22": "Piso Intermediário de Reshanta do Caos",
  "a1": "Artefato da Raiz de Reshanta",
  "a2": "Artefato da Ilha da Árvore Sulfúrica",
  "a3": "Artefato do Arquipélago de Asas de Siel",
  "core": "Núcleo Dimensional"
 },
 "ru": {
  "map20": "Нижний уровень Арэшурата хаоса",
  "map22": "Средний уровень Арэшурата хаоса",
  "a1": "Артефакт Корней Арэшурата",
  "a2": "Артефакт Острова серного дерева",
  "a3": "Артефакт Архипелага крыльев Сиэль",
  "core": "Ядро измерения"
 }
};

const SIEGE_UI = {
  en: { title: "Artifact Siege", elyos: "Elyos", asmodian: "Asmodian", none: "No holder", destroyed: "Destroyed", up: "Up",
        noCore: "No report", hp: (n) => `HP ${n}%`, score: (e, a) => `Elyos ${e} – ${a} Asmodian`, reported: (t) => `Reported ${t} ago` },
  ko: { title: "아티팩트 공성전", elyos: "천족", asmodian: "마족", none: "점령 없음", destroyed: "파괴됨", up: "출현",
        noCore: "정보 없음", hp: (n) => `HP ${n}%`, score: (e, a) => `천족 ${e} – ${a} 마족`, reported: (t) => `${t} 전 보고` },
  ja: { title: "アーティファクト攻城戦", elyos: "天族", asmodian: "魔族", none: "占領なし", destroyed: "破壊", up: "出現",
        noCore: "情報なし", hp: (n) => `HP ${n}%`, score: (e, a) => `天族 ${e} – ${a} 魔族`, reported: (t) => `${t}前に報告` },
  de: { title: "Artefakt-Belagerung", elyos: "Elyos", asmodian: "Asmodier", none: "Unbesetzt", destroyed: "Zerstört", up: "Da",
        noCore: "Keine Meldung", hp: (n) => `HP ${n} %`, score: (e, a) => `Elyos ${e} – ${a} Asmodier`, reported: (t) => `Vor ${t} gemeldet` },
  fr: { title: "Siège des artefacts", elyos: "Élyséens", asmodian: "Asmodiens", none: "Sans détenteur", destroyed: "Détruit", up: "Présent",
        noCore: "Pas de signalement", hp: (n) => `PV ${n} %`, score: (e, a) => `Élyséens ${e} – ${a} Asmodiens`, reported: (t) => `Signalé il y a ${t}` },
  es: { title: "Asedio de artefactos", elyos: "Elyos", asmodian: "Asmodianos", none: "Sin dueño", destroyed: "Destruido", up: "Activo",
        noCore: "Sin informes", hp: (n) => `PV ${n} %`, score: (e, a) => `Elyos ${e} – ${a} Asmodianos`, reported: (t) => `Informado hace ${t}` },
  pt: { title: "Cerco de Artefatos", elyos: "Elyos", asmodian: "Asmodianos", none: "Sem dono", destroyed: "Destruído", up: "Ativo",
        noCore: "Sem relatos", hp: (n) => `PV ${n}%`, score: (e, a) => `Elyos ${e} – ${a} Asmodianos`, reported: (t) => `Relatado há ${t}` },
  ru: { title: "Осада артефактов", elyos: "Элийцы", asmodian: "Асмодиане", none: "Никому", destroyed: "Уничтожено", up: "На месте",
        noCore: "Нет данных", hp: (n) => `HP ${n}%`, score: (e, a) => `Элийцы ${e} – ${a} Асмодиане`, reported: (t) => `Данные ${t} назад` },
  "zh-Hant": { title: "神器攻城戰", elyos: "天族", asmodian: "魔族", none: "無人佔領", destroyed: "已摧毀", up: "已出現",
        noCore: "尚無回報", hp: (n) => `HP ${n}%`, score: (e, a) => `天族 ${e} – ${a} 魔族`, reported: (t) => `${t} 前回報` },
  "zh-Hans": { title: "神器攻城战", elyos: "天族", asmodian: "魔族", none: "无人占领", destroyed: "已摧毁", up: "已出现",
        noCore: "尚无回报", hp: (n) => `HP ${n}%`, score: (e, a) => `天族 ${e} – ${a} 魔族`, reported: (t) => `${t} 前回报` },
};
const siegeUi = () => SIEGE_UI[language] || SIEGE_UI.en;
const siegeName = (key) => (SIEGE_NAMES[language] || SIEGE_NAMES.en)[key] || SIEGE_NAMES.en[key];
// Each layer's siege (AbyssArtifactEvent) and its artifacts, in the map's
// order; the artifact names are the same on both layers.
const SIEGE_LAYERS = [
  { event: 1001, map: "map20", artifacts: [[1001, "a1"], [1002, "a2"], [1003, "a3"]] },
  { event: 2001, map: "map22", artifacts: [[2001, "a1"], [2002, "a2"], [2003, "a3"]] },
];
const SIEGE_FAST_MS = 15_000;
const SIEGE_SLOW_MS = 5 * 60_000;
// Cores are shown while the siege is on, or reported this recently.
const CORES_FRESH_S = 3 * 3600;

// What is known: artifact id -> { owner, at (unix s) }, and the site's cores.
const siege = { holders: new Map(), cores: {}, readAt: 0, server: 0 };

const siegeOn = (now) => {
  const s = typeof pinState === "function" ? pinState("artifact", now) : null;
  return !!s && (s.running || (s.start != null && s.start - now <= 10 * 60_000));
};

function takeHolders(artifacts, at) {
  for (const a of artifacts || []) {
    const id = Number(a.id);
    const when = Number(a.observedAt ?? at) || 0;
    const have = siege.holders.get(id);
    if (!have || have.at <= when) siege.holders.set(id, { owner: a.owner, at: when });
  }
}

async function readSiege() {
  const server = serverId();
  siege.readAt = serverNow();
  if (!server || typeof a2.abyssSiege !== "function") return;
  if (server !== siege.server) {
    siege.holders.clear();
    siege.cores = {};
    siege.server = server;
  }
  const file = await a2.abyssSiege(server).catch(() => null);
  if (!file) return;
  takeHolders(Object.entries(file.artifacts || {}).map(([id, a]) => ({ id, ...a })));
  siege.cores = file.cores || {};
  renderSiege();
}

if (typeof a2.on === "function") {
  // This player's own meter, as the game told it: fresher than the site.
  a2.on("abyss", (d) => {
    if (!d) return;
    takeHolders(d.artifacts, d.observedAt);
    renderSiege();
  });
}

// The core of an artifact, newest word first.
function coreOf(artifact) {
  let best = null;
  for (const c of Object.values(siege.cores)) {
    if (Number(c.artifact) !== artifact) continue;
    const at = Math.max(c.upAt || 0, c.diedAt || 0, c.hpAt || 0);
    if (!best || at > best.at) best = { ...c, at };
  }
  return best;
}

function renderSiege() {
  const view = document.querySelector(".view.events");
  if (!view) return;
  let box = view.querySelector(".siege");
  if (!box) {
    box = document.createElement("section");
    box.className = "siege";
    view.prepend(box);
  }
  const u = siegeUi();
  const now = serverNow();
  const on = siegeOn(now);
  const nowS = now / 1000;
  let elyos = 0, asmodian = 0, newest = 0;
  const layers = [];
  for (const layer of SIEGE_LAYERS) {
    const rows = layer.artifacts.map(([id, key]) => {
      const h = siege.holders.get(id);
      const core = coreOf(id);
      const showCore = core && (on || nowS - core.at < CORES_FRESH_S);
      return { id, key, owner: h?.owner || "none", at: h?.at || 0, core: showCore ? core : null };
    });
    // A layer nobody holds and nobody fights on (Middle Reshanta, not open
    // yet) is left out.
    if (rows.every((r) => r.owner === "none" && !r.core)) continue;
    for (const r of rows) {
      if (r.owner === "elyos") elyos++;
      if (r.owner === "asmodian") asmodian++;
      newest = Math.max(newest, r.at, r.core?.at || 0);
    }
    layers.push({ layer, rows });
  }
  box.hidden = !layers.length;
  // The folded window shows it only while the siege is on.
  box.classList.toggle("live", on);
  if (!layers.length) return;
  box.replaceChildren();
  const head = document.createElement("h2");
  head.className = "group siegeHead";
  head.textContent = `${u.title} · ${u.score(elyos, asmodian)}`;
  box.append(head);
  for (const { layer, rows } of layers) {
    const map = document.createElement("div");
    map.className = "siegeMap";
    map.textContent = layer.event === 1001 ? text("String_STR_Map_Abyss_Reshanta_A_body") : siegeName(layer.map);
    box.append(map);
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = `siegeRow owner-${r.owner}`;
      const name = document.createElement("span");
      name.className = "siegeName";
      name.textContent = siegeName(r.key);
      const owner = document.createElement("span");
      owner.className = "siegeOwner";
      owner.textContent = u[r.owner] || u.none;
      row.append(name, owner);
      if (on || r.core) {
        const core = document.createElement("span");
        core.className = "siegeCore";
        const c = r.core;
        if (!c) core.textContent = u.noCore;
        else if (c.state === "dead") {
          core.textContent = u.destroyed;
          core.classList.add("dead");
        } else if (c.hp != null) {
          core.textContent = u.hp(c.hp);
          core.style.setProperty("--hp", `${c.hp}%`);
          core.classList.add("hasHp");
        } else core.textContent = u.up;
        core.title = siegeName("core");
        row.append(core);
      }
      box.append(row);
    }
  }
  if (newest) {
    const note = document.createElement("p");
    note.className = "note siegeNote";
    note.textContent = u.reported(age(now - newest * 1000));
    box.append(note);
  }
}

// Read at start, then as often as the siege needs.
setInterval(() => {
  const now = serverNow();
  const every = siegeOn(now) ? SIEGE_FAST_MS : SIEGE_SLOW_MS;
  if (now - siege.readAt >= every) readSiege();
  else renderSiege();
}, 5000);
setTimeout(readSiege, 1500);
