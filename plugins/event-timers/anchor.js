// Anchor mode: the icons line up in a grid beside an anchor the player
// places, instead of each going where it was dragged. The grid grows from
// the anchor in the direction chosen (left and down unless changed), up to
// a number of icons across (Max width) and down (Max height); when more
// would show than fit, the last place shows "+N" and names the rest. Sort by
// says which come first.
//
// World Boss Train, in anchor mode: every world boss that is up, or spawns
// within 5 minutes, joins the grid, alert or not; a group going from boss to
// boss sees the next one coming. Among those up and not being fought, the
// rarest (longest to respawn) come first.
//
// The grid is one widget, the anchor's frame: the anchor (⚓) a grip in its
// corner, the icons drawn inside it by widget.js. One window per icon, as
// outside anchor mode, made a grid that could not be packed (Windows widens
// every window to 136 px), nor moved together, nor placed at all on KDE
// Wayland, and opened a new window, and its focus trouble, at each alert.
// Loaded after pins.js: updatePins() asks anchorPlan() which icons to show,
// in what order, and anchorShow() shows them in the frame.

const ANCHOR_UI = {
  en: { anchor: "Anchor mode", anchorNote: "The anchor shows while this tab is open.",
        expand: "Fill direction", dirs: { "left-down": "Left, then down", "right-down": "Right, then down", "left-up": "Left, then up", "right-up": "Right, then up" },
        maxWidth: "Max width (icons across)", maxHeight: "Max height (icons down)", sortBy: "Sort by",
        sorts: { urgent: "Most urgent first", rarest: "Rarest first", soonest: "Soonest first" },
        sortNotes: { urgent: "Being fought (lowest HP first), then up now (rarest first), then the soonest.", rarest: "Up now, the longest to respawn first, then the soonest.", soonest: "Up now, then in the order they start." },
        train: "World Boss Train", trainNote: "Every world boss that is up, or spawns within 5 minutes, joins the grid, with an alert or not.",
        needsMeter: "Anchor mode needs meter 2.0.72 or newer.", more: (n) => `${n} more` },
  ko: { anchor: "앵커 모드", anchorNote: "이 탭이 열려 있는 동안 화면에 표시됩니다.",
        expand: "확장 방향", dirs: { "left-down": "왼쪽, 그다음 아래", "right-down": "오른쪽, 그다음 아래", "left-up": "왼쪽, 그다음 위", "right-up": "오른쪽, 그다음 위" },
        maxWidth: "최대 너비 (가로 아이콘 수)", maxHeight: "최대 높이 (세로 아이콘 수)", sortBy: "정렬",
        sorts: { urgent: "급한 순", rarest: "희귀한 순", soonest: "빠른 순" },
        sortNotes: { urgent: "전투 중(HP 낮은 순), 출현 중(희귀한 순), 그다음 곧 출현할 순서입니다.", rarest: "출현 중인 보스를 재출현이 긴 순으로, 그다음 곧 출현할 순서입니다.", soonest: "출현 중, 그다음 시작하는 순서입니다." },
        train: "월드 보스 트레인", trainNote: "출현 중이거나 5분 안에 출현하는 월드 보스를 알림과 상관없이 모두 표시합니다.",
        needsMeter: "앵커 모드는 미터 2.0.72 이상이 필요합니다.", more: (n) => `${n}개 더` },
  ja: { anchor: "アンカーモード", anchorNote: "このタブを開いている間、画面に表示されます。",
        expand: "広がる方向", dirs: { "left-down": "左、次に下", "right-down": "右、次に下", "left-up": "左、次に上", "right-up": "右、次に上" },
        maxWidth: "最大幅（横のアイコン数）", maxHeight: "最大高さ（縦のアイコン数）", sortBy: "並び順",
        sorts: { urgent: "急ぎの順", rarest: "レアな順", soonest: "早い順" },
        sortNotes: { urgent: "戦闘中（HPの低い順）、出現中（レアな順）、次に出現の早い順。", rarest: "出現中を再出現の長い順に、次に出現の早い順。", soonest: "出現中、次に始まる順。" },
        train: "ワールドボストレイン", trainNote: "出現中か5分以内に出現するワールドボスを、通知の有無にかかわらずすべて並べます。",
        needsMeter: "アンカーモードにはメーター2.0.72以降が必要です。", more: (n) => `ほか${n}件` },
  de: { anchor: "Ankermodus", anchorNote: "Sichtbar, solange dieser Tab offen ist.",
        expand: "Wachstumsrichtung", dirs: { "left-down": "Links, dann nach unten", "right-down": "Rechts, dann nach unten", "left-up": "Links, dann nach oben", "right-up": "Rechts, dann nach oben" },
        maxWidth: "Max. Breite (Symbole nebeneinander)", maxHeight: "Max. Höhe (Symbole untereinander)", sortBy: "Sortieren nach",
        sorts: { urgent: "Dringendste zuerst", rarest: "Seltenste zuerst", soonest: "Nächste zuerst" },
        sortNotes: { urgent: "Im Kampf (niedrigste HP zuerst), dann jetzt da (seltenste zuerst), dann die nächsten.", rarest: "Jetzt da, längste Respawnzeit zuerst, dann die nächsten.", soonest: "Jetzt da, dann in der Reihenfolge ihres Starts." },
        train: "Weltboss-Train", trainNote: "Jeder Weltboss, der da ist oder in 5 Minuten erscheint, kommt ins Raster, mit oder ohne Alarm.",
        needsMeter: "Der Ankermodus braucht Meter 2.0.72 oder neuer.", more: (n) => `${n} weitere` },
  fr: { anchor: "Mode ancre", anchorNote: "Visible tant que cet onglet est ouvert.",
        expand: "Sens d'extension", dirs: { "left-down": "Gauche, puis bas", "right-down": "Droite, puis bas", "left-up": "Gauche, puis haut", "right-up": "Droite, puis haut" },
        maxWidth: "Largeur max (icônes en ligne)", maxHeight: "Hauteur max (icônes en colonne)", sortBy: "Trier par",
        sorts: { urgent: "Les plus urgents d'abord", rarest: "Les plus rares d'abord", soonest: "Les plus proches d'abord" },
        sortNotes: { urgent: "Attaqués (PV les plus bas d'abord), puis présents (les plus rares d'abord), puis les plus proches.", rarest: "Présents, la plus longue réapparition d'abord, puis les plus proches.", soonest: "Présents, puis dans l'ordre où ils commencent." },
        train: "Train de boss mondiaux", trainNote: "Chaque boss mondial présent, ou qui apparaît dans 5 minutes, rejoint la grille, avec ou sans alerte.",
        needsMeter: "Le mode ancre nécessite le compteur 2.0.72 ou plus récent.", more: (n) => `${n} de plus` },
  es: { anchor: "Modo ancla", anchorNote: "Visible mientras esta pestaña está abierta.",
        expand: "Dirección de expansión", dirs: { "left-down": "Izquierda, luego abajo", "right-down": "Derecha, luego abajo", "left-up": "Izquierda, luego arriba", "right-up": "Derecha, luego arriba" },
        maxWidth: "Ancho máx. (iconos en fila)", maxHeight: "Alto máx. (iconos en columna)", sortBy: "Ordenar por",
        sorts: { urgent: "Más urgentes primero", rarest: "Más raros primero", soonest: "Más próximos primero" },
        sortNotes: { urgent: "En combate (menos PV primero), luego activos (más raros primero), luego los más próximos.", rarest: "Activos, el que más tarda en reaparecer primero, luego los más próximos.", soonest: "Activos, luego en el orden en que empiezan." },
        train: "Tren de jefes mundiales", trainNote: "Todo jefe mundial activo, o que aparezca en 5 minutos, se une a la cuadrícula, con alerta o sin ella.",
        needsMeter: "El modo ancla necesita el medidor 2.0.72 o posterior.", more: (n) => `${n} más` },
  pt: { anchor: "Modo âncora", anchorNote: "Visível enquanto esta aba está aberta.",
        expand: "Direção de expansão", dirs: { "left-down": "Esquerda, depois para baixo", "right-down": "Direita, depois para baixo", "left-up": "Esquerda, depois para cima", "right-up": "Direita, depois para cima" },
        maxWidth: "Largura máx. (ícones na linha)", maxHeight: "Altura máx. (ícones na coluna)", sortBy: "Ordenar por",
        sorts: { urgent: "Mais urgentes primeiro", rarest: "Mais raros primeiro", soonest: "Mais próximos primeiro" },
        sortNotes: { urgent: "Em combate (menos PV primeiro), depois ativos (mais raros primeiro), depois os mais próximos.", rarest: "Ativos, o que mais demora a renascer primeiro, depois os mais próximos.", soonest: "Ativos, depois na ordem em que começam." },
        train: "Trem de chefes mundiais", trainNote: "Todo chefe mundial ativo, ou que surja em 5 minutos, entra na grade, com alerta ou não.",
        needsMeter: "O modo âncora precisa do medidor 2.0.72 ou mais recente.", more: (n) => `mais ${n}` },
  ru: { anchor: "Режим якоря", anchorNote: "Видно, пока открыта эта вкладка.",
        expand: "Направление роста", dirs: { "left-down": "Влево, затем вниз", "right-down": "Вправо, затем вниз", "left-up": "Влево, затем вверх", "right-up": "Вправо, затем вверх" },
        maxWidth: "Макс. ширина (значков в ряд)", maxHeight: "Макс. высота (значков в столбец)", sortBy: "Сортировка",
        sorts: { urgent: "Сначала срочные", rarest: "Сначала редкие", soonest: "Сначала ближайшие" },
        sortNotes: { urgent: "В бою (меньше HP — раньше), затем появившиеся (сначала редкие), затем ближайшие.", rarest: "Появившиеся, с самым долгим возрождением первыми, затем ближайшие.", soonest: "Появившиеся, затем в порядке начала." },
        train: "Трейн мировых боссов", trainNote: "Каждый мировой босс, который на месте или появится в течение 5 минут, попадает в сетку, с оповещением или без.",
        needsMeter: "Для режима якоря нужен счётчик 2.0.72 или новее.", more: (n) => `ещё ${n}` },
  "zh-Hant": { anchor: "錨點模式", anchorNote: "開啟此分頁時顯示於畫面上。",
        expand: "延伸方向", dirs: { "left-down": "向左，再向下", "right-down": "向右，再向下", "left-up": "向左，再向上", "right-up": "向右，再向上" },
        maxWidth: "最大寬度（橫向圖示數）", maxHeight: "最大高度（縱向圖示數）", sortBy: "排序",
        sorts: { urgent: "最緊急優先", rarest: "最稀有優先", soonest: "最快優先" },
        sortNotes: { urgent: "戰鬥中（HP 最低優先），再來是已出現（最稀有優先），然後是最快出現的。", rarest: "已出現的依重生最久優先，然後是最快出現的。", soonest: "已出現，然後依開始順序。" },
        train: "世界首領車隊", trainNote: "已出現或 5 分鐘內出現的世界首領都會加入網格，無論是否設定提醒。",
        needsMeter: "錨點模式需要計量器 2.0.72 以上。", more: (n) => `還有 ${n} 個` },
  "zh-Hans": { anchor: "锚点模式", anchorNote: "打开此标签页时显示在画面上。",
        expand: "延伸方向", dirs: { "left-down": "向左，再向下", "right-down": "向右，再向下", "left-up": "向左，再向上", "right-up": "向右，再向上" },
        maxWidth: "最大宽度（横向图标数）", maxHeight: "最大高度（纵向图标数）", sortBy: "排序",
        sorts: { urgent: "最紧急优先", rarest: "最稀有优先", soonest: "最快优先" },
        sortNotes: { urgent: "战斗中（HP 最低优先），再是已出现（最稀有优先），然后是最快出现的。", rarest: "已出现的按重生最久优先，然后是最快出现的。", soonest: "已出现，然后按开始顺序。" },
        train: "世界首领车队", trainNote: "已出现或 5 分钟内出现的世界首领都会加入网格，无论是否设置提醒。",
        needsMeter: "锚点模式需要计量器 2.0.72 以上。", more: (n) => `还有 ${n} 个` },
};
const anchorUi = () => ANCHOR_UI[language] || ANCHOR_UI.en;

// How long each world boss takes to respawn (minutes), by world-map id:
// measured on a2tools.app from 870 kills that a meter saw, each against the
// time a map then gave for its return (2026-10-16 to 10-18). Bosses not in
// it have no measured time yet and count as least rare.
const RESPAWN_MIN = {"111003":30,"101001":30,"101002":30,"111001":30,"111002":30,"101003":30,"101007":60,"111004":60,
  "101006":90,"111006":90,"111007":120,"111009":120,"101004":120,"101019":120,"111005":120,"101017":120,"101005":120,
  "111008":120,"101015":180,"111010":180,"111011":180,"101010":180,"101009":180,"101008":180,"111017":180,"111014":180,
  "101013":240,"111015":240,"101018":240,"111012":240,"111013":240,"101016":240,"101011":240,"111018":240,"101020":360,
  "101023":360,"101012":360,"111024":360,"111016":360,"111019":360,"101014":360,"111020":360,"101022":360,"111023":360,
  "2001":720,"111021":720,"101024":720,"111022":720,"101021":720};
const respawnOf = (id) => (id.startsWith("field:") ? RESPAWN_MIN[id.slice(6)] || 0 : 0);

const ANCHOR = "anchor";
const MORE = "more";
const DIRECTIONS = ["left-down", "right-down", "left-up", "right-up"];
const SORTS = ["urgent", "rarest", "soonest"];
const GRID_MAX = 8;
// Rows are fewer: the meter makes a widget at most 800 px tall.
const ROWS_MAX = 6;
// A place in the grid, CSS px: an icon (pinSize) and the gaps the player
// set between columns and rows (4 unless changed; less than 0 packs the
// icons closer, an icon's window being wider than its badge).
const ICON_W = 80;
const GAPS = [-8, -4, 0, 2, 4, 6, 8, 12, 16, 24, 32];
const gapOf = (v) => (GAPS.includes(Number(v)) ? Number(v) : 4);
// In the grid a name and a countdown take one line each (the whole name is
// in the icon's tooltip): an icon is 80 px tall with its name, 64 without,
// and the HP line adds 16.
const CELL_H_NAMED = 86;
const CELL_H = 70;
// The tallest an icon can be (a name on two lines, and HP): the frame has
// room for rows this tall; each row is drawn only as tall as its icons.
const MAX_H_NAMED = 114;
const MAX_H = 82;
// Room above the first row for the glow.
const TOP = 14;
// The anchor's grip, in the frame's corner the grid grows from: shown only
// while placing the grid (this window's Settings tab open), with the grid's
// every place outlined.
const GRIP = 40;
// How long before it spawns a world boss joins the train (minutes): the
// player's choice, 5 unless changed.
const TRAIN_LEADS = [1, 2, 3, 5, 10, 15, 30];
const trainLead = () => (TRAIN_LEADS.includes(Number(prefs.anchorTrainLead)) ? Number(prefs.anchorTrainLead) : 5);

// The frame is a widget; keeping its grip still while it resizes needs
// a2.widgets.where and place (meter 2.0.72), and is skipped without them.
const canPlace = () => canPin();
const canMove = () => canPin() && typeof a2.widgets.place === "function" && typeof a2.widgets.where === "function";
const anchorOn = () => canPlace() && iconStyle() && !!prefs.anchorMode;
const trainOn = () => anchorOn() && !!prefs.anchorTrain;
const gridSize = (v, d) => Math.max(1, Math.min(GRID_MAX, Number(v) || d));
const gridRows = () => Math.max(1, Math.min(ROWS_MAX, Number(prefs.anchorRows) || 3));

// The train's bosses, for iconPins(): each world boss without an alert of
// its own, shown while up or within TRAIN_LEAD_MS of spawning (pinVisible).
function trainPins(out, cfg) {
  if (!trainOn()) return;
  for (const b of fieldBosses()) {
    const id = `field:${b.id}`;
    // Not "Show icons even when not alerting", and no reminder: on the grid only while
    // up or about to spawn, and "Fighting" when it is.
    if (!(id in out)) out[id] = { ...cfg(id), always: false, lead: -1, fought: true, train: true };
  }
}
const trainVisible = (pin, state, until) =>
  !!pin.train && !state.killed && (state.running || (until != null && until <= trainLead() * 60_000));

// Which comes first, for Sort by. `o` is each icon's { id, fight, running,
// hp, until, killed }.
function anchorCompare(a, b) {
  const sort = SORTS.includes(prefs.anchorSort) ? prefs.anchorSort : "urgent";
  const group = (o) => {
    if (o.killed) return 3;
    if (sort === "urgent" && o.fight) return 0;
    if (o.running) return 1;
    if (o.until != null) return 2;
    return 4;
  };
  const ga = group(a.order), gb = group(b.order);
  if (ga !== gb) return ga - gb;
  if (ga === 0) return (a.order.hp ?? 100) - (b.order.hp ?? 100);
  if (ga === 1 && sort !== "soonest") {
    const r = respawnOf(b.order.id) - respawnOf(a.order.id);
    if (r) return r;
  }
  if (ga === 1 || ga === 2) return (a.order.until ?? 0) - (b.order.until ?? 0);
  return 0;
}

// Which comes first, for Sort by. `o` is each icon's { id, fight, running,
// hp, until, killed }.
function anchorCompare(a, b) {
  const sort = SORTS.includes(prefs.anchorSort) ? prefs.anchorSort : "urgent";
  const group = (o) => {
    if (o.killed) return 3;
    if (sort === "urgent" && o.fight) return 0;
    if (o.running) return 1;
    if (o.until != null) return 2;
    return 4;
  };
  const ga = group(a.order), gb = group(b.order);
  if (ga !== gb) return ga - gb;
  if (ga === 0) return (a.order.hp ?? 100) - (b.order.hp ?? 100);
  if (ga === 1 && sort !== "soonest") {
    const r = respawnOf(b.order.id) - respawnOf(a.order.id);
    if (r) return r;
  }
  if (ga === 1 || ga === 2) return (a.order.until ?? 0) - (b.order.until ?? 0);
  return 0;
}

// The icons to show, in grid order: `wanted` sorted, and those past the
// grid's room folded into "+N".
function anchorPlan(wanted) {
  if (!anchorOn()) return wanted;
  const entries = [...wanted.entries()].sort((a, b) => anchorCompare(a[1], b[1]));
  const room = gridSize(prefs.anchorCols, 4) * gridRows();
  if (entries.length <= room) return new Map(entries);
  const shown = entries.slice(0, room - 1);
  const rest = entries.slice(room - 1);
  const names = rest.map(([, e]) => `${e.data.name} · ${e.data.countdown}`);
  const n = rest.length;
  shown.push([MORE, { id: MORE, order: {}, data: { name: anchorUi().more(n), glyph: `+${n}`, tip: names.join("\n"),
    showName: false, opacity: typeof pinOpacity === "function" ? pinOpacity() : 1, countdown: anchorUi().more(n), sub: "", hp: null, running: false, due: false, effect: "nothing", kind: "more", icon: "" } }]);
  return new Map(shown);
}

// The frame: its size (CSS px) for the grid as set, and where in it the
// grip sits, which is the corner the grid grows from.
function frameLayout(named) {
  const cols = gridSize(prefs.anchorCols, 4);
  const rows = gridRows();
  const dir = DIRECTIONS.includes(prefs.anchorExpand) ? prefs.anchorExpand : "left-down";
  const gapX = gapOf(prefs.anchorGapX);
  const gapY = gapOf(prefs.anchorGapY);
  const cellW = ICON_W + gapX;
  const cellH = (named ? CELL_H_NAMED : CELL_H) + gapY;
  const width = cols * cellW + GRIP;
  const height = Math.max(rows * ((named ? MAX_H_NAMED : MAX_H) + Math.max(gapY, 0)) + TOP, GRIP + TOP);
  const grip = { x: dir.startsWith("left") ? width - GRIP : 0, y: dir.endsWith("up") ? height - GRIP : TOP };
  return { cols, rows, dir, cellW, cellH, gapX, gapY, width, height, grip, gripSize: GRIP, top: TOP };
}

// Placing the grid: this window shown, on its Settings tab. Hidden by its
// × (or its dock tab hidden), the page stays loaded and looks visible to
// itself, so the meter says (a2.on("visible"), meter 2.0.77; older meters
// never do, and it counts as shown): the frame went only when leaving
// Settings, and stayed up with the window hidden on it.
let windowShown = true;
const placing = () => windowShown && document.visibilityState === "visible"
  && document.querySelector(".view.settings")?.hidden === false;
a2.on("visible", (shown) => {
  windowShown = shown !== false;
  updatePins(Date.now());
});
// Into Settings or out of it: the anchor shows or goes at once, not at the
// next second's update.
document.addEventListener("click", (e) => {
  if (e.target instanceof Element && e.target.closest(".tab")) setTimeout(() => updatePins(Date.now()), 0);
});
document.addEventListener("visibilitychange", () => updatePins(Date.now()));

let frameOpen = false;
let frameSize = null;
let frameBusy = false;
let frameBusySince = 0;

// Show `wanted` (anchorPlan's order) in the frame, or close it when anchor
// mode is off. True when anchor mode showed them, so pins.js opens no icon
// windows of their own.
async function anchorShow(wanted) {
  if (!anchorOn()) {
    if (frameOpen) {
      frameOpen = false;
      frameSize = null;
      await answered(a2.widgets.close(ANCHOR), "close the anchor").catch((e) => noteError("anchor", e));
    }
    return false;
  }
  if (frameBusy) {
    if (Date.now() - frameBusySince < BUSY_LIMIT_MS) return true;
    noteError("anchor", `an update held ${Math.round((Date.now() - frameBusySince) / 1000)} s, let go`);
  }
  frameBusy = true;
  frameBusySince = Date.now();
  try {
    const cells = [...wanted.values()].map((e) => e.data);
    // Nothing to show and not being placed: no frame at all, so nothing on
    // screen can take a click from the game. Its empty space let clicks
    // through only where the window manager honours the meter's input
    // region (Hirai, CachyOS KDE, 2026-10-27: an invisible anchor caught
    // them). Its last layout is kept, so it comes back where it was.
    if (!cells.length && !placing()) {
      if (frameOpen) {
        frameOpen = false;
        await answered(a2.widgets.close(ANCHOR), "close the anchor").catch((e) => noteError("anchor", e));
      }
      return true;
    }
    const layout = frameLayout(cells.some((c) => c.showName));
    const size = { width: layout.width, height: layout.height };
    const same = frameSize && frameSize.width === size.width && frameSize.height === size.height
      && frameSize.grip.x === layout.grip.x && frameSize.grip.y === layout.grip.y;
    if (!frameOpen || !same) {
      // The grip stays where the player left it while the frame resizes
      // around it (it moves within the frame with the grid's direction),
      // and when it opens again at another size after being closed: the
      // frame opens at its last top left, so its new grip is put where the
      // old one was.
      const wasOpen = frameOpen;
      const before = wasOpen && frameSize && canMove() ? await answered(a2.widgets.where(ANCHOR), "ask where the anchor is").catch(() => null) : null;
      frameOpen = await answered(a2.widgets.open(ANCHOR, size), "open the anchor").then(() => true, (e) => {
        if (String(e?.message || "").includes("no answer")) noteError("anchor", e);
        return false;
      });
      if (!frameOpen) return true;
      const at = before || (!wasOpen && frameSize && !same && canMove() ? await answered(a2.widgets.where(ANCHOR), "ask where the anchor is").catch(() => null) : null);
      if (at && frameSize.grip) {
        const scale = (typeof devicePixelRatio === "number" && devicePixelRatio > 0) ? devicePixelRatio : 1;
        const x = Math.round(at.x + (frameSize.grip.x - layout.grip.x) * scale);
        const y = Math.round(at.y + (frameSize.grip.y - layout.grip.y) * scale);
        if (x !== at.x || y !== at.y) await answered(a2.widgets.place(ANCHOR, { x, y }), "move the anchor").catch(() => {});
      }
      frameSize = { ...size, grip: layout.grip };
    }
    a2.widgets.send(ANCHOR, { kind: "grid", label: anchorUi().anchor, ...layout, cells, setup: placing() }).catch(() => {});
    return true;
  } finally {
    frameBusy = false;
  }
}

// Settings, "On screen": how alerts show (icons or this window), then, for
// icons, the Placement card: anchor mode, with a live miniature of the grid
// (the anchor in its corner, Max width x Max height places) whose corners
// set the expand direction and whose steppers set its size, as the grid
// shows in game while this tab is open. Anchor mode is the setup most
// players want, so it leads.
const SETUP_UI = {
  en: { onScreen: "On screen", display: "Time and display", across: "Across", down: "Down", fewer: "Fewer", more: "More", trainLead: "Spawning within", mins: n => `${n} min`, trainNote: n => `Every world boss up, or spawning within ${n} min, alert or not.`, gapX: "Column gap", gapY: "Row gap", gridLock: "Lock the grid", gridLockNote: "Clicks pass through to the game. Unlock to move the anchor.",
        corner: "Click a corner to set where the anchor sits.", pitch: "Line the icons up in a grid beside an anchor you place." },
  ko: { onScreen: "화면 표시", display: "시간과 표시", across: "가로", down: "세로", fewer: "줄이기", more: "늘리기", trainLead: "출현까지 남은 시간", mins: n => `${n}분`, trainNote: n => `출현 중이거나 ${n}분 안에 출현하는 모든 월드 보스.`, gapX: "열 간격", gapY: "행 간격", gridLock: "격자 잠금", gridLockNote: "클릭이 게임으로 통과됩니다. 앵커를 옮기려면 잠금을 푸세요.",
        corner: "모서리를 눌러 앵커 위치를 정하세요.", pitch: "직접 놓은 앵커 옆에 아이콘을 격자로 정렬합니다." },
  ja: { onScreen: "画面表示", display: "時刻と表示", across: "横", down: "縦", fewer: "減らす", more: "増やす", trainLead: "出現までの時間", mins: n => `${n}分`, trainNote: n => `出現中か${n}分以内に出現するすべてのワールドボス。`, gapX: "列の間隔", gapY: "行の間隔", gridLock: "格子をロック", gridLockNote: "クリックはゲームに通ります。アンカーを動かすにはロックを外します。",
        corner: "角をクリックしてアンカーの位置を決めます。", pitch: "置いたアンカーの横にアイコンを格子状に並べます。" },
  de: { onScreen: "Auf dem Bildschirm", display: "Zeit und Anzeige", across: "Breite", down: "Höhe", fewer: "Weniger", more: "Mehr", trainLead: "Erscheint innerhalb von", mins: n => `${n} Min.`, trainNote: n => `Jeder Weltboss, der da ist oder in ${n} Min. erscheint.`, gapX: "Spaltenabstand", gapY: "Zeilenabstand", gridLock: "Raster sperren", gridLockNote: "Klicks gehen zum Spiel durch. Zum Verschieben des Ankers entsperren.",
        corner: "Eine Ecke anklicken, um den Platz des Ankers zu wählen.", pitch: "Die Symbole in einem Raster neben einem Anker aufreihen, den du platzierst." },
  fr: { onScreen: "À l'écran", display: "Heure et affichage", across: "Largeur", down: "Hauteur", fewer: "Moins", more: "Plus", trainLead: "Apparition dans", mins: n => `${n} min`, trainNote: n => `Chaque boss mondial présent, ou qui apparaît dans ${n} min.`, gapX: "Écart des colonnes", gapY: "Écart des lignes", gridLock: "Verrouiller la grille", gridLockNote: "Les clics passent vers le jeu. Déverrouillez pour déplacer l'ancre.",
        corner: "Cliquez sur un coin pour placer l'ancre.", pitch: "Aligner les icônes en grille à côté d'une ancre que vous placez." },
  es: { onScreen: "En pantalla", display: "Hora y vista", across: "Ancho", down: "Alto", fewer: "Menos", more: "Más", trainLead: "Aparece en", mins: n => `${n} min`, trainNote: n => `Todo jefe mundial activo, o que aparezca en ${n} min.`, gapX: "Espacio entre columnas", gapY: "Espacio entre filas", gridLock: "Bloquear la cuadrícula", gridLockNote: "Los clics pasan al juego. Desbloquéala para mover el ancla.",
        corner: "Haz clic en una esquina para situar el ancla.", pitch: "Alinea los iconos en una cuadrícula junto a un ancla que colocas tú." },
  pt: { onScreen: "Na tela", display: "Hora e exibição", across: "Largura", down: "Altura", fewer: "Menos", more: "Mais", trainLead: "Surge em até", mins: n => `${n} min`, trainNote: n => `Todo chefe mundial ativo, ou que surja em até ${n} min.`, gapX: "Espaço entre colunas", gapY: "Espaço entre linhas", gridLock: "Travar a grade", gridLockNote: "Os cliques passam para o jogo. Destrave para mover a âncora.",
        corner: "Clique num canto para posicionar a âncora.", pitch: "Alinhe os ícones em uma grade ao lado de uma âncora que você posiciona." },
  ru: { onScreen: "На экране", display: "Время и вид", across: "В ширину", down: "В высоту", fewer: "Меньше", more: "Больше", trainLead: "Появится в течение", mins: n => `${n} мин`, trainNote: n => `Каждый мировой босс на месте или в течение ${n} мин.`, gapX: "Между столбцами", gapY: "Между рядами", gridLock: "Зафиксировать сетку", gridLockNote: "Клики проходят в игру. Снимите фиксацию, чтобы двигать якорь.",
        corner: "Щёлкните угол, чтобы выбрать место якоря.", pitch: "Выстроить значки сеткой рядом с якорем, который вы ставите сами." },
  "zh-Hant": { onScreen: "畫面顯示", display: "時間與顯示", across: "橫向", down: "縱向", fewer: "減少", more: "增加", trainLead: "出現前", mins: n => `${n} 分鐘`, trainNote: n => `已出現或 ${n} 分鐘內出現的所有世界首領。`, gapX: "欄距", gapY: "列距", gridLock: "鎖定網格", gridLockNote: "點擊會穿透到遊戲。解除鎖定才能移動錨點。",
        corner: "點擊角落以設定錨點位置。", pitch: "將圖示以網格排在你放置的錨點旁。" },
  "zh-Hans": { onScreen: "画面显示", display: "时间与显示", across: "横向", down: "纵向", fewer: "减少", more: "增加", trainLead: "出现前", mins: n => `${n} 分钟`, trainNote: n => `已出现或 ${n} 分钟内出现的所有世界首领。`, gapX: "列距", gapY: "行距", gridLock: "锁定网格", gridLockNote: "点击会穿透到游戏。解除锁定才能移动锚点。",
        corner: "点击角落以设置锚点位置。", pitch: "将图标以网格排在你放置的锚点旁。" },
};
const setupUi = () => SETUP_UI[language] || SETUP_UI.en;
// The corner the anchor sits in, for each direction the grid grows.
const CORNERS = { "left-down": "tr", "right-down": "tl", "left-up": "br", "right-up": "bl" };

function renderAnchorSettings(box) {
  const u = anchorUi();
  const s = setupUi();
  const view = box.closest(".view.settings");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const save = () => {
    savePrefs();
    renderAnchorSettings(box);
    updatePins(Date.now());
  };

  // Headings: "On screen" over this box, "Time and display" over the rest.
  let head = box.querySelector(".onScreenHead");
  if (!head) {
    head = el("h2", "group onScreenHead");
    box.prepend(head);
  }
  head.textContent = s.onScreen;
  const displayHead = view?.querySelector(".displayHead");
  if (displayHead) displayHead.textContent = s.display;

  // Show alerts as: two buttons for the two choices (driving the select,
  // hidden, which keeps its saving).
  const style = box.querySelector(".alertStyle");
  const styleRow = box.querySelector(".styleRow");
  let seg = box.querySelector(".styleSeg");
  if (style && styleRow && !seg) {
    seg = el("div", "seg styleSeg");
    seg.setAttribute("role", "radiogroup");
    styleRow.append(seg);
    style.hidden = true;
  }
  if (seg && style) {
    seg.replaceChildren(...[...style.options].map((o) => {
      const b = el("button", "segBtn", o.textContent);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.value === style.value));
      b.disabled = style.disabled;
      b.addEventListener("click", () => {
        if (style.value === o.value) return;
        style.value = o.value;
        style.dispatchEvent(new Event("change"));
      });
      return b;
    }));
  }

  // The Placement card, right under it.
  let card = box.querySelector(".placement");
  if (!card) {
    card = el("section", "placement");
    const top = el("label", "placementHead");
    const mode = el("input", "anchorMode switch");
    mode.type = "checkbox";
    mode.setAttribute("role", "switch");
    top.append(el("span", "placementTitle"), mode);
    const stage = el("div", "stage");
    const mini = el("div", "mini");
    const steps = el("div", "steps");
    stage.append(mini, steps);
    const sortRow = el("label", "setting sortRow");
    sortRow.append(el("span", "iconSettingLabel"), el("select", "anchorSort"));
    const trainRow = el("label", "setting trainRow");
    const train = el("input", "anchorTrain switch");
    train.type = "checkbox";
    train.setAttribute("role", "switch");
    trainRow.append(el("span", "iconSettingLabel"), train);
    const leadRow = el("label", "setting trainLeadRow");
    leadRow.append(el("span", "iconSettingLabel"), el("select", "anchorTrainLead"));
    card.append(top, el("p", "note placementNote"), stage, el("p", "note cornerNote"),
      sortRow, el("p", "note sortNote"), trainRow, leadRow, el("p", "note trainNote"));
    card.querySelector(".anchorTrainLead").addEventListener("change", (e) => { prefs.anchorTrainLead = Number(e.target.value); save(); });
    (styleRow || box.firstChild).after(card);
    mode.addEventListener("change", () => { prefs.anchorMode = mode.checked; save(); });
    card.querySelector(".anchorSort").addEventListener("change", (e) => { prefs.anchorSort = e.target.value; save(); });
    train.addEventListener("change", () => { prefs.anchorTrain = train.checked; save(); });
  }
  // The icons' lock lives here, with what it locks; it works with anchor
  // mode off too (icons placed one by one).
  const lockRow = box.querySelector(".lockRow");
  const lockNote = box.querySelector(".pinLockNote");
  const cornerNote = card.querySelector(".cornerNote");
  if (lockRow && lockRow.parentElement !== card) {
    cornerNote.after(lockRow);
    if (lockNote) lockRow.after(lockNote);
  }
  // In anchor mode the lock holds the whole grid, the anchor with it: one
  // window. Worded so.
  if (anchorOn() && lockRow) {
    lockRow.querySelector(".iconSettingLabel").textContent = s.gridLock;
    if (lockNote) lockNote.textContent = s.gridLockNote;
  }
  card.hidden = !iconStyle();
  const on = anchorOn();
  card.classList.toggle("on", on);
  card.querySelector(".placementTitle").textContent = u.anchor;
  const mode = card.querySelector(".anchorMode");
  mode.checked = !!prefs.anchorMode && canPlace();
  mode.disabled = !canPlace();
  card.querySelector(".placementNote").textContent = !canPlace() ? u.needsMeter : on ? u.anchorNote : s.pitch;

  // The miniature: the grid as set, the anchor in its corner. A corner
  // picks the direction; it is drawn even off, dimmed, to show what it does.
  const cols = gridSize(prefs.anchorCols, 4);
  const rows = gridRows();
  const dir = DIRECTIONS.includes(prefs.anchorExpand) ? prefs.anchorExpand : "left-down";
  const mini = card.querySelector(".mini");
  mini.style.setProperty("--cols", cols);
  mini.style.setProperty("--rows", rows);
  mini.dataset.corner = CORNERS[dir];
  const cells = el("div", "cells");
  for (let i = 0; i < cols * rows; i++) cells.append(el("span", "cell"));
  const corners = Object.entries(CORNERS).map(([d, c]) => {
    const b = el("button", `corner ${c}`, d === dir ? "⚓" : "");
    b.type = "button";
    b.disabled = !on;
    b.title = u.dirs[d];
    b.setAttribute("aria-label", u.dirs[d]);
    b.setAttribute("aria-pressed", String(d === dir));
    b.addEventListener("click", () => { prefs.anchorExpand = d; save(); });
    return b;
  });
  mini.replaceChildren(cells, ...corners);

  // Across and Down, and the gaps, with steppers over their values.
  const stepper = (label, value, values, set, shown = String) => {
    const row = el("div", "step");
    const less = el("button", "stepBtn", "−");
    const more = el("button", "stepBtn", "+");
    less.type = more.type = "button";
    less.setAttribute("aria-label", `${label}: ${s.fewer}`);
    more.setAttribute("aria-label", `${label}: ${s.more}`);
    const at = values.indexOf(value);
    less.disabled = !on || at <= 0;
    more.disabled = !on || at >= values.length - 1;
    less.addEventListener("click", () => { set(values[at - 1]); save(); });
    more.addEventListener("click", () => { set(values[at + 1]); save(); });
    row.append(el("span", "stepLabel", label), less, el("output", "stepValue", shown(value)), more);
    return row;
  };
  const counts = (max) => Array.from({ length: max }, (_, i) => i + 1);
  card.querySelector(".steps").replaceChildren(
    stepper(s.across, cols, counts(GRID_MAX), (v) => { prefs.anchorCols = v; }),
    stepper(s.down, rows, counts(ROWS_MAX), (v) => { prefs.anchorRows = v; }),
    stepper(s.gapX, gapOf(prefs.anchorGapX), GAPS, (v) => { prefs.anchorGapX = v; }, (v) => `${v}`),
    stepper(s.gapY, gapOf(prefs.anchorGapY), GAPS, (v) => { prefs.anchorGapY = v; }, (v) => `${v}`),
  );
  card.querySelector(".cornerNote").textContent = s.corner;

  const sort = card.querySelector(".anchorSort");
  sort.replaceChildren(...SORTS.map((x) => option(x, u.sorts[x])));
  sort.value = SORTS.includes(prefs.anchorSort) ? prefs.anchorSort : "urgent";
  card.querySelector(".sortRow .iconSettingLabel").textContent = u.sortBy;
  card.querySelector(".sortNote").textContent = "";
  card.querySelector(".trainRow .iconSettingLabel").textContent = u.train;
  card.querySelector(".anchorTrain").checked = !!prefs.anchorTrain;
  card.querySelector(".trainNote").textContent = s.trainNote(trainLead());
  const lead = card.querySelector(".anchorTrainLead");
  lead.replaceChildren(...TRAIN_LEADS.map((n) => option(n, s.mins(n))));
  lead.value = String(trainLead());
  card.querySelector(".trainLeadRow .iconSettingLabel").textContent = s.trainLead;
  for (const cls of ["cornerNote", "sortRow", "trainRow", "trainNote"]) {
    card.querySelector(`.${cls}`).hidden = !on;
  }
  card.querySelector(".sortNote").hidden = true;
  // The lookahead only with the train on.
  card.querySelector(".trainLeadRow").hidden = !on || !prefs.anchorTrain;
}
