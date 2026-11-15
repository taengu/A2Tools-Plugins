// Ping: the meter's ping to the game server (a2.on("ping"), meter 2.0.73 on)
// in a widget the player drags anywhere and locks in place. This page holds
// the settings and hands each new ping to the widget, and the game's FPS
// (a2.watchFps, meter 2.0.78 on) when asked: on Windows the meter must run
// as administrator for it, and asks the player to restart so.
const $ = (s) => document.querySelector(s);
const els = { daily: $(".daily"), dailyRows: $(".daily tbody"), range: $(".range"), chart: $(".chart"), from: $(".axis .from"), to: $(".axis .to"), hover: $(".axis .hover"), stats: $(".stats"), noHistory: $(".noHistory"), value: $(".now .value"), jitter: $(".now .jitter"), cycle: $(".cycle"), jitterOld: $(".jitterOld"), fps: $(".fps"), fpsGood: $(".fpsGood"), fpsFair: $(".fpsFair"), fpsRows: [...document.querySelectorAll(".fpsRow")], fpsNote: $(".fpsNote"), fpsText: $(".fpsNote .text"), fpsAdmin: $(".fpsNote .admin"), show: $(".show"), lock: $(".lock"), background: $(".background"), bars: $(".bars"), size: $(".size"), good: $(".good"), fair: $(".fair") };

const UI = {
  en: { now: "Ping now", show: "Show the ping widget", lock: "Lock the widget", lockNote: "Clicks pass through to the game. Unlock to move it.", background: "Show the background", bars: "Show the signal bars", size: "Size", small: "Small", medium: "Medium", large: "Large", good: "Green up to", fair: "Amber up to", help: "Drag the widget anywhere. Double-click it to open this window.", old: "Needs meter 2.0.73 or newer", fps: "Show the game's FPS", fpsAdmin: "FPS needs the meter to run as administrator.", fpsAdminButton: "Run as administrator", fpsUnsupported: "FPS isn't available on this system.", fpsOld: "FPS needs meter 2.0.78 or newer.", fpsGood: "FPS green from", fpsFair: "FPS amber from", jitter: "Jitter {v} ms", cycle: "Alternate ping and jitter", cycleNote: "The widget shows the jitter 5 s after each ping, then the next ping.", jitterOld: "Jitter needs meter 2.0.99 or newer.", history: "History", r15: "15 minutes", r60: "1 hour", r360: "6 hours", r1440: "24 hours", avg: "Average", median: "Median", p95: "95% under", best: "Best", worst: "Worst", jitterAvg: "Jitter", spikes: "Over {v} ms", readings: "Readings", noHistory: "No readings in this time yet.", ago: "{v} ago", daily: "Each day", day: "Day", min: "Min", max: "Max", over: "Over {v}" },
  ko: { now: "현재 핑", show: "핑 위젯 표시", lock: "위젯 잠금", lockNote: "클릭이 게임으로 통과됩니다. 옮기려면 잠금을 푸세요.", background: "배경 표시", bars: "신호 막대 표시", size: "크기", small: "작게", medium: "보통", large: "크게", good: "초록색 최대", fair: "주황색 최대", help: "위젯을 원하는 곳으로 끌어 놓으세요. 더블클릭하면 이 창이 열립니다.", old: "미터 2.0.73 이상이 필요합니다", fps: "게임 FPS 표시", fpsAdmin: "FPS를 보려면 미터를 관리자 권한으로 실행해야 합니다.", fpsAdminButton: "관리자 권한으로 실행", fpsUnsupported: "이 시스템에서는 FPS를 볼 수 없습니다.", fpsOld: "FPS에는 미터 2.0.78 이상이 필요합니다.", fpsGood: "FPS 초록색 최소", fpsFair: "FPS 주황색 최소", jitter: "지터 {v} ms", cycle: "핑과 지터 번갈아 표시", cycleNote: "위젯이 핑을 받은 지 5초 후 지터를 보여 주고, 다음 핑이 오면 다시 핑을 보여 줍니다.", jitterOld: "지터에는 미터 2.0.99 이상이 필요합니다.", history: "기록", r15: "15분", r60: "1시간", r360: "6시간", r1440: "24시간", avg: "평균", median: "중앙값", p95: "95% 이하", best: "최저", worst: "최고", jitterAvg: "지터", spikes: "{v} ms 초과", readings: "측정 횟수", noHistory: "이 기간에는 아직 측정값이 없습니다.", ago: "{v} 전", daily: "일별", day: "날짜", min: "최저", max: "최고", over: "{v} 초과" },
  ja: { now: "現在のPing", show: "Pingウィジェットを表示", lock: "ウィジェットをロック", lockNote: "クリックがゲームに通ります。動かすにはロックを解除。", background: "背景を表示", bars: "電波バーを表示", size: "サイズ", small: "小", medium: "中", large: "大", good: "緑の上限", fair: "橙の上限", help: "ウィジェットは好きな場所にドラッグできます。ダブルクリックでこの画面を開きます。", old: "メーター2.0.73以降が必要です", fps: "ゲームのFPSを表示", fpsAdmin: "FPSの表示にはメーターを管理者として実行する必要があります。", fpsAdminButton: "管理者として実行", fpsUnsupported: "このシステムではFPSを表示できません。", fpsOld: "FPSにはメーター2.0.78以降が必要です。", fpsGood: "FPS 緑の下限", fpsFair: "FPS 橙の下限", jitter: "ジッター {v} ms", cycle: "Pingとジッターを交互に表示", cycleNote: "ウィジェットは各Pingの5秒後にジッターを表示し、次のPingで戻ります。", jitterOld: "ジッターにはメーター2.0.99以降が必要です。", history: "履歴", r15: "15分", r60: "1時間", r360: "6時間", r1440: "24時間", avg: "平均", median: "中央値", p95: "95%が以下", best: "最良", worst: "最悪", jitterAvg: "ジッター", spikes: "{v} ms超", readings: "測定回数", noHistory: "この期間の測定値はまだありません。", ago: "{v}前", daily: "日ごと", day: "日付", min: "最小", max: "最大", over: "{v}超" },
  de: { now: "Ping jetzt", show: "Ping-Widget anzeigen", lock: "Widget sperren", lockNote: "Klicks gehen zum Spiel durch. Zum Verschieben entsperren.", background: "Hintergrund anzeigen", bars: "Signalbalken anzeigen", size: "Größe", small: "Klein", medium: "Mittel", large: "Groß", good: "Grün bis", fair: "Gelb bis", help: "Zieh das Widget an eine beliebige Stelle. Doppelklick öffnet dieses Fenster.", old: "Benötigt Meter 2.0.73 oder neuer", fps: "FPS des Spiels anzeigen", fpsAdmin: "Für die FPS muss das Meter als Administrator laufen.", fpsAdminButton: "Als Administrator ausführen", fpsUnsupported: "FPS sind auf diesem System nicht verfügbar.", fpsOld: "FPS benötigen Meter 2.0.78 oder neuer.", fpsGood: "FPS grün ab", fpsFair: "FPS gelb ab", jitter: "Jitter {v} ms", cycle: "Ping und Jitter abwechseln", cycleNote: "Das Widget zeigt 5 s nach jedem Ping den Jitter, dann den nächsten Ping.", jitterOld: "Jitter benötigt Meter 2.0.99 oder neuer.", history: "Verlauf", r15: "15 Minuten", r60: "1 Stunde", r360: "6 Stunden", r1440: "24 Stunden", avg: "Durchschnitt", median: "Median", p95: "95 % unter", best: "Bester", worst: "Schlechtester", jitterAvg: "Jitter", spikes: "Über {v} ms", readings: "Messungen", noHistory: "Noch keine Messungen in diesem Zeitraum.", ago: "vor {v}", daily: "Pro Tag", day: "Tag", min: "Min.", max: "Max.", over: "Über {v}" },
  fr: { now: "Ping actuel", show: "Afficher le widget de ping", lock: "Verrouiller le widget", lockNote: "Les clics passent au jeu. Déverrouille pour le déplacer.", background: "Afficher le fond", bars: "Afficher les barres de signal", size: "Taille", small: "Petit", medium: "Moyen", large: "Grand", good: "Vert jusqu'à", fair: "Orange jusqu'à", help: "Fais glisser le widget où tu veux. Double-clique dessus pour ouvrir cette fenêtre.", old: "Nécessite le compteur 2.0.73 ou plus récent", fps: "Afficher les FPS du jeu", fpsAdmin: "Les FPS nécessitent que le compteur s'exécute en tant qu'administrateur.", fpsAdminButton: "Exécuter en tant qu'administrateur", fpsUnsupported: "Les FPS ne sont pas disponibles sur ce système.", fpsOld: "Les FPS nécessitent le compteur 2.0.78 ou plus récent.", fpsGood: "FPS vert à partir de", fpsFair: "FPS orange à partir de", jitter: "Gigue {v} ms", cycle: "Alterner ping et gigue", cycleNote: "Le widget affiche la gigue 5 s après chaque ping, puis le ping suivant.", jitterOld: "La gigue nécessite le compteur 2.0.99 ou plus récent.", history: "Historique", r15: "15 minutes", r60: "1 heure", r360: "6 heures", r1440: "24 heures", avg: "Moyenne", median: "Médiane", p95: "95 % sous", best: "Meilleur", worst: "Pire", jitterAvg: "Gigue", spikes: "Au-dessus de {v} ms", readings: "Mesures", noHistory: "Pas encore de mesure sur cette période.", ago: "il y a {v}", daily: "Par jour", day: "Jour", min: "Min.", max: "Max.", over: "Au-dessus de {v}" },
  es: { now: "Ping actual", show: "Mostrar el widget de ping", lock: "Bloquear el widget", lockNote: "Los clics pasan al juego. Desbloquéalo para moverlo.", background: "Mostrar el fondo", bars: "Mostrar las barras de señal", size: "Tamaño", small: "Pequeño", medium: "Mediano", large: "Grande", good: "Verde hasta", fair: "Ámbar hasta", help: "Arrastra el widget a donde quieras. Haz doble clic para abrir esta ventana.", old: "Necesita el medidor 2.0.73 o posterior", fps: "Mostrar los FPS del juego", fpsAdmin: "Los FPS necesitan que el medidor se ejecute como administrador.", fpsAdminButton: "Ejecutar como administrador", fpsUnsupported: "Los FPS no están disponibles en este sistema.", fpsOld: "Los FPS necesitan el medidor 2.0.78 o posterior.", fpsGood: "FPS verde desde", fpsFair: "FPS ámbar desde", jitter: "Fluctuación {v} ms", cycle: "Alternar ping y fluctuación", cycleNote: "El widget muestra la fluctuación 5 s después de cada ping y luego el siguiente ping.", jitterOld: "La fluctuación necesita el medidor 2.0.99 o posterior.", history: "Historial", r15: "15 minutos", r60: "1 hora", r360: "6 horas", r1440: "24 horas", avg: "Media", median: "Mediana", p95: "95 % por debajo de", best: "Mejor", worst: "Peor", jitterAvg: "Fluctuación", spikes: "Más de {v} ms", readings: "Mediciones", noHistory: "Aún no hay mediciones en este periodo.", ago: "hace {v}", daily: "Por día", day: "Día", min: "Mín.", max: "Máx.", over: "Más de {v}" },
  pt: { now: "Ping agora", show: "Mostrar o widget de ping", lock: "Travar o widget", lockNote: "Os cliques passam para o jogo. Destrave para movê-lo.", background: "Mostrar o fundo", bars: "Mostrar as barras de sinal", size: "Tamanho", small: "Pequeno", medium: "Médio", large: "Grande", good: "Verde até", fair: "Âmbar até", help: "Arraste o widget para onde quiser. Clique duas vezes para abrir esta janela.", old: "Requer o medidor 2.0.73 ou mais recente", fps: "Mostrar o FPS do jogo", fpsAdmin: "O FPS precisa que o medidor seja executado como administrador.", fpsAdminButton: "Executar como administrador", fpsUnsupported: "O FPS não está disponível neste sistema.", fpsOld: "O FPS requer o medidor 2.0.78 ou mais recente.", fpsGood: "FPS verde a partir de", fpsFair: "FPS âmbar a partir de", jitter: "Variação {v} ms", cycle: "Alternar ping e variação", cycleNote: "O widget mostra a variação 5 s após cada ping e depois o próximo ping.", jitterOld: "A variação requer o medidor 2.0.99 ou mais recente.", history: "Histórico", r15: "15 minutos", r60: "1 hora", r360: "6 horas", r1440: "24 horas", avg: "Média", median: "Mediana", p95: "95% abaixo de", best: "Melhor", worst: "Pior", jitterAvg: "Variação", spikes: "Acima de {v} ms", readings: "Medições", noHistory: "Ainda não há medições neste período.", ago: "há {v}", daily: "Por dia", day: "Dia", min: "Mín.", max: "Máx.", over: "Acima de {v}" },
  ru: { now: "Пинг сейчас", show: "Показывать виджет пинга", lock: "Закрепить виджет", lockNote: "Клики проходят в игру. Открепите, чтобы переместить.", background: "Показывать фон", bars: "Показывать полоски сигнала", size: "Размер", small: "Маленький", medium: "Средний", large: "Большой", good: "Зелёный до", fair: "Жёлтый до", help: "Перетащите виджет куда угодно. Двойной щелчок открывает это окно.", old: "Нужен метр 2.0.73 или новее", fps: "Показывать FPS игры", fpsAdmin: "Для FPS метр должен работать от имени администратора.", fpsAdminButton: "Запустить от имени администратора", fpsUnsupported: "FPS недоступен в этой системе.", fpsOld: "Для FPS нужен метр 2.0.78 или новее.", fpsGood: "FPS зелёный от", fpsFair: "FPS жёлтый от", jitter: "Джиттер {v} мс", cycle: "Чередовать пинг и джиттер", cycleNote: "Виджет показывает джиттер через 5 с после каждого пинга, затем следующий пинг.", jitterOld: "Для джиттера нужен метр 2.0.99 или новее.", history: "История", r15: "15 минут", r60: "1 час", r360: "6 часов", r1440: "24 часа", avg: "Среднее", median: "Медиана", p95: "95% ниже", best: "Лучший", worst: "Худший", jitterAvg: "Джиттер", spikes: "Выше {v} мс", readings: "Замеров", noHistory: "За это время замеров пока нет.", ago: "{v} назад", daily: "По дням", day: "День", min: "Мин.", max: "Макс.", over: "Выше {v}" },
  "zh-Hant": { now: "目前延遲", show: "顯示延遲小工具", lock: "鎖定小工具", lockNote: "點擊會穿透到遊戲。解鎖後才能移動。", background: "顯示背景", bars: "顯示訊號格", size: "大小", small: "小", medium: "中", large: "大", good: "綠色上限", fair: "橘色上限", help: "可將小工具拖到任何位置。按兩下開啟此視窗。", old: "需要計量器 2.0.73 或更新版本", fps: "顯示遊戲 FPS", fpsAdmin: "顯示 FPS 需要計量器以系統管理員身分執行。", fpsAdminButton: "以系統管理員身分執行", fpsUnsupported: "此系統無法顯示 FPS。", fpsOld: "FPS 需要計量器 2.0.78 或更新版本。", fpsGood: "FPS 綠色下限", fpsFair: "FPS 橘色下限", jitter: "抖動 {v} 毫秒", cycle: "輪流顯示延遲與抖動", cycleNote: "小工具在每次延遲更新 5 秒後顯示抖動，下次延遲更新時再切回。", jitterOld: "抖動需要計量器 2.0.99 或更新版本。", history: "紀錄", r15: "15 分鐘", r60: "1 小時", r360: "6 小時", r1440: "24 小時", avg: "平均", median: "中位數", p95: "95% 低於", best: "最佳", worst: "最差", jitterAvg: "抖動", spikes: "超過 {v} 毫秒", readings: "測量次數", noHistory: "這段時間還沒有測量值。", ago: "{v}前", daily: "每日", day: "日期", min: "最低", max: "最高", over: "超過 {v}" },
  "zh-Hans": { now: "当前延迟", show: "显示延迟小组件", lock: "锁定小组件", lockNote: "点击会穿透到游戏。解锁后才能移动。", background: "显示背景", bars: "显示信号格", size: "大小", small: "小", medium: "中", large: "大", good: "绿色上限", fair: "橙色上限", help: "可将小组件拖到任意位置。双击打开此窗口。", old: "需要计量器 2.0.73 或更新版本", fps: "显示游戏 FPS", fpsAdmin: "显示 FPS 需要计量器以管理员身份运行。", fpsAdminButton: "以管理员身份运行", fpsUnsupported: "此系统无法显示 FPS。", fpsOld: "FPS 需要计量器 2.0.78 或更新版本。", fpsGood: "FPS 绿色下限", fpsFair: "FPS 橙色下限", jitter: "抖动 {v} 毫秒", cycle: "轮流显示延迟与抖动", cycleNote: "小组件在每次延迟更新 5 秒后显示抖动，下次延迟更新时再切回。", jitterOld: "抖动需要计量器 2.0.99 或更新版本。", history: "记录", r15: "15 分钟", r60: "1 小时", r360: "6 小时", r1440: "24 小时", avg: "平均", median: "中位数", p95: "95% 低于", best: "最佳", worst: "最差", jitterAvg: "抖动", spikes: "超过 {v} 毫秒", readings: "测量次数", noHistory: "这段时间还没有测量值。", ago: "{v}前", daily: "每日", day: "日期", min: "最低", max: "最高", over: "超过 {v}" },
};
let words = UI.en;

const DEFAULTS = { show: true, background: true, bars: true, size: "1", good: 80, fair: 150, fps: false, fpsGood: 60, fpsFair: 30, cycle: false, range: 60 };
let prefs = { ...DEFAULTS };
let ms = null;
let heard = false;
// The jitter: the mean change between recent readings, in ms (meter 2.0.99
// on). Null until there are three readings; undefined from an older meter.
let jitter;
// What the widget shows while alternating: the ping for JITTER_AFTER after
// each reading, then the jitter until the next one, or the ping again after
// PING_AGAIN should no reading come.
const JITTER_AFTER = 5000;
const PING_AGAIN = 15000;
let showing = "ping";
let cycleTimer = null;
// The game's FPS: { fps, state } as the meter last said, while shown.
let fps = null;
// Whether AION2 is open: the widget only shows while it is. The meter says
// at start (after a2.ready) and on each change; until then, closed, so the
// widget doesn't flash up with the game shut.
let gameOpen = false;

const stateOf = (v) => (typeof v !== "number" ? "none" : v <= prefs.good ? "good" : v <= prefs.fair ? "fair" : "poor");
// The widget's window: the pill and a little room for its shadow, wider with
// the FPS in it.
const sizeOf = (scale) => ({ width: Math.round((prefs.fps ? 196 : 118) * scale), height: Math.round(38 * scale) });

function translate() {
  for (const el of document.querySelectorAll("[data-t]")) {
    const text = words[el.dataset.t];
    if (text) el.textContent = text;
  }
  if (typeof renderHistory === "function") renderHistory();
}

// The jitter to 0.1 ms under 10, whole above, so it fits the widget.
const jitterText = (v) => (v < 10 ? v.toFixed(1) : String(Math.round(v)));
const jitterTip = () => (typeof jitter === "number" ? words.jitter.replace("{v}", jitterText(jitter)) : "");

function render() {
  els.value.dataset.state = stateOf(ms);
  els.value.textContent = typeof ms === "number" ? `${ms} ms` : heard ? "– ms" : words.old;
  els.jitter.textContent = jitterTip();
  els.jitterOld.hidden = !(prefs.cycle && heard && jitter === undefined);
  // Why there is no FPS, and what to do about it.
  const state = !prefs.fps ? "" : typeof a2.watchFps !== "function" ? "old" : fps?.state || "";
  const note = { needsAdmin: words.fpsAdmin, unsupported: words.fpsUnsupported, old: words.fpsOld }[state] || "";
  els.fpsNote.hidden = !note;
  els.fpsText.textContent = note;
  els.fpsAdmin.hidden = state !== "needsAdmin";
  for (const row of els.fpsRows) row.hidden = !prefs.fps;
}

// The FPS for the widget: a number while counted, null ("–") while not (no
// game, or not allowed yet), undefined when not shown.
const fpsShown = () => (!prefs.fps ? undefined : fps?.state === "ok" ? fps.fps : null);
// Its colour: green from fpsGood, amber from fpsFair, red below (more is better).
const fpsStateOf = (v) => (typeof v !== "number" ? "none" : v >= prefs.fpsGood ? "good" : v >= prefs.fpsFair ? "fair" : "poor");

const widgetShown = () => prefs.show && gameOpen;

async function sendWidget() {
  if (!widgetShown()) return;
  const shown = showing === "jitter" && prefs.cycle && typeof jitter === "number" ? `±${jitterText(jitter)} ms` : undefined;
  await a2.widgets.send("ping", { ms, state: stateOf(ms), jitter: shown, tip: jitterTip(), scale: Number(prefs.size), background: prefs.background, bars: prefs.bars, fps: fpsShown(), fpsState: fpsStateOf(fpsShown()) }).catch(() => {});
}

async function placeWidget() {
  if (widgetShown()) {
    await a2.widgets.open("ping", sizeOf(Number(prefs.size))).catch(() => {});
    await sendWidget();
  } else {
    await a2.widgets.close("ping").catch(() => {});
  }
}

async function save() {
  await a2.storage.set("prefs", prefs).catch(() => {});
}

// Each reading shows the ping; with alternating on, the jitter fades in
// JITTER_AFTER later.
function restartCycle() {
  clearTimeout(cycleTimer);
  showing = "ping";
  if (!prefs.cycle || typeof jitter !== "number" || typeof ms !== "number") return;
  cycleTimer = setTimeout(() => {
    showing = "jitter";
    sendWidget();
    cycleTimer = setTimeout(() => {
      showing = "ping";
      sendWidget();
    }, PING_AGAIN);
  }, JITTER_AFTER);
}

// ----- History: every reading for a day, as [unix seconds, ms or null],
// for the chart and its numbers ("how bad is the server, really"). Kept in
// storage, a minute's readings at a time.
const HISTORY_SECS = 24 * 3600;
const RANGES = [15, 60, 360, 1440];
let history = [];
let historyDirty = false;
// Readings further apart than this are drawn with a gap between them (the
// game closed, the meter off).
const GAP_SECS = 60;

// Each day's summary, kept for DAYS_KEPT days: by local date ("2026-11-15"),
// { n, sum, min, max, over } with `over` the readings above amber as it was
// set then.
const DAYS_KEPT = 60;
let days = {};
const dayKey = (secs) => {
  const d = new Date(secs * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function addToDay(t, v) {
  if (typeof v !== "number") return;
  const key = dayKey(t);
  const d = days[key] || (days[key] = { n: 0, sum: 0, min: v, max: v, over: 0 });
  d.n += 1;
  d.sum += v;
  d.min = Math.min(d.min, v);
  d.max = Math.max(d.max, v);
  if (v > prefs.fair) d.over += 1;
  const keys = Object.keys(days).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - DAYS_KEPT))) delete days[old];
}

function record(v) {
  const t = Math.floor(Date.now() / 1000);
  // The meter repeats the last reading to a page that starts: not a new one.
  const last = history[history.length - 1];
  if (last && t - last[0] < 2 && last[1] === v) return;
  history.push([t, typeof v === "number" ? v : null]);
  addToDay(t, v);
  while (history.length && history[0][0] < t - HISTORY_SECS) history.shift();
  historyDirty = true;
  renderHistory();
}
setInterval(() => {
  if (!historyDirty) return;
  historyDirty = false;
  a2.storage.set("history", history).catch(() => {});
  a2.storage.set("days", days).catch(() => {});
}, 60_000);

// The numbers for readings `values` (ms, nulls left out): average, median,
// the 95th percentile, best, worst, the jitter (mean change from one reading
// to the next) and how many were over `over` ms.
function pingStats(values, over) {
  const v = values.filter((x) => typeof x === "number");
  if (!v.length) return null;
  const sorted = [...v].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  let change = 0;
  for (let i = 1; i < v.length; i++) change += Math.abs(v[i] - v[i - 1]);
  const spikes = v.filter((x) => x > over).length;
  return {
    n: v.length,
    avg: v.reduce((a, b) => a + b, 0) / v.length,
    median: at(0.5),
    p95: at(0.95),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    jitter: v.length > 1 ? change / (v.length - 1) : null,
    spikes,
    spikePct: (spikes / v.length) * 100,
  };
}

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
const clockOf = (secs) => new Date(secs * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
let chartPoints = [];

function renderHistory() {
  const minutes = RANGES.includes(Number(prefs.range)) ? Number(prefs.range) : 60;
  const now = Math.floor(Date.now() / 1000);
  const from = now - minutes * 60;
  const shown = history.filter(([t]) => t >= from);
  const stats = pingStats(shown.map(([, v]) => v), prefs.fair);
  els.noHistory.hidden = !!stats;
  els.stats.hidden = !stats;
  els.from.textContent = clockOf(from);
  els.to.textContent = clockOf(now);
  // The chart: the readings as a line, gaps where none came, with the green
  // and amber limits as dashed lines.
  const width = Math.max(120, Math.round(els.chart.clientWidth || 290));
  const height = 110;
  const pad = 4;
  els.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const top = Math.max(prefs.fair * 1.15, stats ? stats.worst * 1.08 : 0);
  const x = (t) => ((t - from) / (now - from || 1)) * width;
  const y = (v) => height - pad - (Math.min(v, top) / top) * (height - pad * 2);
  const parts = [];
  for (const [line, limit] of [["good", prefs.good], ["fair", prefs.fair]]) {
    parts.push(svgEl("line", { x1: 0, x2: width, y1: y(limit), y2: y(limit), class: `limit ${line}` }));
  }
  chartPoints = [];
  let path = "";
  let prev = null;
  for (const [t, v] of shown) {
    if (typeof v !== "number") {
      prev = null;
      continue;
    }
    const px = x(t);
    const py = y(v);
    chartPoints.push({ t, v, px, py });
    path += prev && t - prev <= GAP_SECS ? `L${px.toFixed(1)},${py.toFixed(1)}` : `M${px.toFixed(1)},${py.toFixed(1)}`;
    prev = t;
  }
  if (path) parts.push(svgEl("path", { d: path, class: "line" }));
  // Each reading over amber marked, so spikes stand out at any range.
  for (const p of chartPoints) {
    if (p.v > prefs.fair) parts.push(svgEl("circle", { cx: p.px, cy: p.py, r: 1.8, class: "spike" }));
  }
  els.chart.replaceChildren(...parts);
  renderDays();
  if (!stats) return;
  const ms0 = (v) => `${Math.round(v)} ms`;
  const rows = [
    [words.avg, ms0(stats.avg), stateOf(stats.avg)],
    [words.median, ms0(stats.median), stateOf(stats.median)],
    [words.p95, ms0(stats.p95), stateOf(stats.p95)],
    [words.jitterAvg, stats.jitter == null ? "–" : `${jitterText(stats.jitter)} ms`, ""],
    [words.best, ms0(stats.best), stateOf(stats.best)],
    [words.worst, ms0(stats.worst), stateOf(stats.worst)],
    [words.spikes.replace("{v}", prefs.fair), `${stats.spikes} (${stats.spikePct < 10 ? stats.spikePct.toFixed(1) : Math.round(stats.spikePct)}%)`, stats.spikes ? "poor" : "good"],
    [words.readings, String(stats.n), ""],
  ];
  els.stats.replaceChildren(...rows.map(([label, value, state]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    if (state) dd.dataset.state = state;
    row.append(dt, dd);
    return row;
  }));
}
// Each day's average, min, max and readings over amber, newest first.
function renderDays() {
  const keys = Object.keys(days).sort().reverse();
  els.daily.hidden = !keys.length;
  const head = els.daily.querySelector("thead tr");
  head.replaceChildren(...[words.day, words.avg, words.min, words.max, words.over.replace("{v}", prefs.fair)].map((t) => {
    const th = document.createElement("th");
    th.textContent = t;
    return th;
  }));
  const today = dayKey(Math.floor(Date.now() / 1000));
  els.dailyRows.replaceChildren(...keys.map((key) => {
    const d = days[key];
    const [y, m, dd] = key.split("-").map(Number);
    const label = new Date(y, m - 1, dd).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const avg = d.sum / Math.max(1, d.n);
    const pct = (d.over / Math.max(1, d.n)) * 100;
    const cells = [
      [label + (key === today ? " •" : ""), ""],
      [`${Math.round(avg)}`, stateOf(avg)],
      [`${d.min}`, stateOf(d.min)],
      [`${d.max}`, stateOf(d.max)],
      [`${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`, d.over ? "poor" : "good"],
    ];
    const tr = document.createElement("tr");
    tr.title = `${words.readings}: ${d.n}`;
    tr.replaceChildren(...cells.map(([text, state]) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (state) td.dataset.state = state;
      return td;
    }));
    return tr;
  }));
}

// The reading under the pointer, in the axis line.
els.chart.addEventListener("mousemove", (e) => {
  if (!chartPoints.length) return;
  const box = els.chart.getBoundingClientRect();
  const px = ((e.clientX - box.left) / box.width) * (Number(els.chart.viewBox.baseVal.width) || box.width);
  let best = chartPoints[0];
  for (const p of chartPoints) if (Math.abs(p.px - px) < Math.abs(best.px - px)) best = p;
  els.hover.textContent = `${clockOf(best.t)} · ${best.v} ms`;
});
els.chart.addEventListener("mouseleave", () => { els.hover.textContent = ""; });
els.range.addEventListener("change", async () => {
  prefs.range = Number(els.range.value);
  await save();
  renderHistory();
});
window.addEventListener("resize", () => renderHistory());
// The time axis moves on with no reading coming in.
setInterval(renderHistory, 30_000);

a2.on("ping", (d) => {
  heard = true;
  ms = d && typeof d.ms === "number" ? d.ms : null;
  if (d && "ms" in d) record(ms);
  jitter = d && "jitter" in d ? (typeof d.jitter === "number" ? d.jitter : null) : undefined;
  restartCycle();
  render();
  sendWidget();
});
a2.on("fps", (d) => {
  fps = d || null;
  render();
  sendWidget();
});
// Ask the meter for the FPS, or stop. Turned on by the player (`ask`): when
// the meter must run as administrator, it asks them to restart so at once.
async function watchFps(ask) {
  if (typeof a2.watchFps !== "function") return render();
  fps = await a2.watchFps(prefs.fps).catch(() => null);
  render();
  sendWidget();
  if (prefs.fps && ask && fps?.state === "needsAdmin") await a2.fpsAdmin().catch(() => {});
}
els.fpsAdmin.addEventListener("click", () => a2.fpsAdmin?.().catch(() => {}));
els.fps.addEventListener("change", async () => {
  prefs.fps = els.fps.checked;
  if (!prefs.fps) fps = null;
  await save();
  await placeWidget();
  await watchFps(true);
});

a2.on("game", (d) => {
  const open = !!(d && d.running);
  if (open === gameOpen) return;
  gameOpen = open;
  placeWidget();
});
a2.on("language", (code) => {
  words = UI[code] || UI[String(code).split("-")[0]] || UI.en;
  translate();
  render();
});
a2.on("locked", (on) => {
  els.lock.checked = !!on;
});
// The widget's double-click: this window.
a2.on("widget-message", ({ data }) => {
  if (data && data.open) a2.window?.show?.();
});

els.show.addEventListener("change", async () => {
  prefs.show = els.show.checked;
  await save();
  placeWidget();
});
els.lock.addEventListener("change", () => a2.widgets.lock(els.lock.checked).catch(() => {}));
els.cycle.addEventListener("change", async () => {
  prefs.cycle = els.cycle.checked;
  await save();
  restartCycle();
  render();
  sendWidget();
});
for (const key of ["background", "bars"]) {
  els[key].addEventListener("change", async () => {
    prefs[key] = els[key].checked;
    await save();
    sendWidget();
  });
}
els.size.addEventListener("change", async () => {
  prefs.size = els.size.value;
  await save();
  placeWidget();
});
for (const key of ["good", "fair"]) {
  els[key].addEventListener("change", async () => {
    const v = Math.round(Number(els[key].value));
    if (!Number.isFinite(v) || v <= 0) {
      els[key].value = prefs[key];
      return;
    }
    prefs[key] = v;
    // Amber starts where green ends.
    if (prefs.fair <= prefs.good) prefs.fair = prefs.good + 10;
    els.good.value = prefs.good;
    els.fair.value = prefs.fair;
    await save();
    render();
    renderHistory();
    sendWidget();
  });
}

for (const key of ["fpsGood", "fpsFair"]) {
  els[key].addEventListener("change", async () => {
    const v = Math.round(Number(els[key].value));
    if (!Number.isFinite(v) || v <= 0) {
      els[key].value = prefs[key];
      return;
    }
    prefs[key] = v;
    // Amber ends where green starts.
    if (prefs.fpsFair >= prefs.fpsGood) prefs.fpsFair = Math.max(1, prefs.fpsGood - 5);
    els.fpsGood.value = prefs.fpsGood;
    els.fpsFair.value = prefs.fpsFair;
    await save();
    sendWidget();
  });
}

(async () => {
  const stored = await a2.storage.get("prefs").catch(() => null);
  if (stored && typeof stored === "object") prefs = { ...DEFAULTS, ...stored };
  els.show.checked = prefs.show;
  els.fps.checked = prefs.fps;
  els.cycle.checked = prefs.cycle;
  els.fpsGood.value = prefs.fpsGood;
  els.fpsFair.value = prefs.fpsFair;
  els.background.checked = prefs.background;
  els.bars.checked = prefs.bars;
  els.size.value = String(prefs.size);
  els.good.value = prefs.good;
  els.fair.value = prefs.fair;
  els.range.value = String(prefs.range);
  const kept = await a2.storage.get("history").catch(() => null);
  if (Array.isArray(kept)) {
    const cut = Math.floor(Date.now() / 1000) - HISTORY_SECS;
    history = kept.filter((r) => Array.isArray(r) && r[0] >= cut).concat(history);
  }
  // The days: as saved, with what came in before they loaded added.
  const keptDays = await a2.storage.get("days").catch(() => null);
  if (keptDays && typeof keptDays === "object" && !Array.isArray(keptDays)) {
    const fresh = days;
    days = {};
    for (const [key, d] of Object.entries(keptDays)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && d && Number(d.n) > 0) {
        days[key] = { n: Number(d.n), sum: Number(d.sum) || 0, min: Number(d.min), max: Number(d.max), over: Number(d.over) || 0 };
      }
    }
    for (const [key, d] of Object.entries(fresh)) {
      const have = days[key];
      days[key] = have
        ? { n: have.n + d.n, sum: have.sum + d.sum, min: Math.min(have.min, d.min), max: Math.max(have.max, d.max), over: have.over + d.over }
        : d;
    }
  }
  renderHistory();
  els.lock.checked = await a2.widgets.locked().catch(() => false);
  translate();
  render();
  await placeWidget();
  if (prefs.fps) await watchFps(false);
  a2.ready();
})();
