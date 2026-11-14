// Ping: the meter's ping to the game server (a2.on("ping"), meter 2.0.73 on)
// in a widget the player drags anywhere and locks in place. This page holds
// the settings and hands each new ping to the widget, and the game's FPS
// (a2.watchFps, meter 2.0.78 on) when asked: on Windows the meter must run
// as administrator for it, and asks the player to restart so.
const $ = (s) => document.querySelector(s);
const els = { value: $(".now .value"), jitter: $(".now .jitter"), cycle: $(".cycle"), jitterOld: $(".jitterOld"), fps: $(".fps"), fpsGood: $(".fpsGood"), fpsFair: $(".fpsFair"), fpsRows: [...document.querySelectorAll(".fpsRow")], fpsNote: $(".fpsNote"), fpsText: $(".fpsNote .text"), fpsAdmin: $(".fpsNote .admin"), show: $(".show"), lock: $(".lock"), background: $(".background"), bars: $(".bars"), size: $(".size"), good: $(".good"), fair: $(".fair") };

const UI = {
  en: { now: "Ping now", show: "Show the ping widget", lock: "Lock the widget", lockNote: "Clicks pass through to the game. Unlock to move it.", background: "Show the background", bars: "Show the signal bars", size: "Size", small: "Small", medium: "Medium", large: "Large", good: "Green up to", fair: "Amber up to", help: "Drag the widget anywhere. Double-click it to open this window.", old: "Needs meter 2.0.73 or newer", fps: "Show the game's FPS", fpsAdmin: "FPS needs the meter to run as administrator.", fpsAdminButton: "Run as administrator", fpsUnsupported: "FPS isn't available on this system.", fpsOld: "FPS needs meter 2.0.78 or newer.", fpsGood: "FPS green from", fpsFair: "FPS amber from", jitter: "Jitter {v} ms", cycle: "Alternate ping and jitter", cycleNote: "The widget shows the jitter 5 s after each ping, then the next ping.", jitterOld: "Jitter needs meter 2.0.99 or newer." },
  ko: { now: "현재 핑", show: "핑 위젯 표시", lock: "위젯 잠금", lockNote: "클릭이 게임으로 통과됩니다. 옮기려면 잠금을 푸세요.", background: "배경 표시", bars: "신호 막대 표시", size: "크기", small: "작게", medium: "보통", large: "크게", good: "초록색 최대", fair: "주황색 최대", help: "위젯을 원하는 곳으로 끌어 놓으세요. 더블클릭하면 이 창이 열립니다.", old: "미터 2.0.73 이상이 필요합니다", fps: "게임 FPS 표시", fpsAdmin: "FPS를 보려면 미터를 관리자 권한으로 실행해야 합니다.", fpsAdminButton: "관리자 권한으로 실행", fpsUnsupported: "이 시스템에서는 FPS를 볼 수 없습니다.", fpsOld: "FPS에는 미터 2.0.78 이상이 필요합니다.", fpsGood: "FPS 초록색 최소", fpsFair: "FPS 주황색 최소", jitter: "지터 {v} ms", cycle: "핑과 지터 번갈아 표시", cycleNote: "위젯이 핑을 받은 지 5초 후 지터를 보여 주고, 다음 핑이 오면 다시 핑을 보여 줍니다.", jitterOld: "지터에는 미터 2.0.99 이상이 필요합니다." },
  ja: { now: "現在のPing", show: "Pingウィジェットを表示", lock: "ウィジェットをロック", lockNote: "クリックがゲームに通ります。動かすにはロックを解除。", background: "背景を表示", bars: "電波バーを表示", size: "サイズ", small: "小", medium: "中", large: "大", good: "緑の上限", fair: "橙の上限", help: "ウィジェットは好きな場所にドラッグできます。ダブルクリックでこの画面を開きます。", old: "メーター2.0.73以降が必要です", fps: "ゲームのFPSを表示", fpsAdmin: "FPSの表示にはメーターを管理者として実行する必要があります。", fpsAdminButton: "管理者として実行", fpsUnsupported: "このシステムではFPSを表示できません。", fpsOld: "FPSにはメーター2.0.78以降が必要です。", fpsGood: "FPS 緑の下限", fpsFair: "FPS 橙の下限", jitter: "ジッター {v} ms", cycle: "Pingとジッターを交互に表示", cycleNote: "ウィジェットは各Pingの5秒後にジッターを表示し、次のPingで戻ります。", jitterOld: "ジッターにはメーター2.0.99以降が必要です。" },
  de: { now: "Ping jetzt", show: "Ping-Widget anzeigen", lock: "Widget sperren", lockNote: "Klicks gehen zum Spiel durch. Zum Verschieben entsperren.", background: "Hintergrund anzeigen", bars: "Signalbalken anzeigen", size: "Größe", small: "Klein", medium: "Mittel", large: "Groß", good: "Grün bis", fair: "Gelb bis", help: "Zieh das Widget an eine beliebige Stelle. Doppelklick öffnet dieses Fenster.", old: "Benötigt Meter 2.0.73 oder neuer", fps: "FPS des Spiels anzeigen", fpsAdmin: "Für die FPS muss das Meter als Administrator laufen.", fpsAdminButton: "Als Administrator ausführen", fpsUnsupported: "FPS sind auf diesem System nicht verfügbar.", fpsOld: "FPS benötigen Meter 2.0.78 oder neuer.", fpsGood: "FPS grün ab", fpsFair: "FPS gelb ab", jitter: "Jitter {v} ms", cycle: "Ping und Jitter abwechseln", cycleNote: "Das Widget zeigt 5 s nach jedem Ping den Jitter, dann den nächsten Ping.", jitterOld: "Jitter benötigt Meter 2.0.99 oder neuer." },
  fr: { now: "Ping actuel", show: "Afficher le widget de ping", lock: "Verrouiller le widget", lockNote: "Les clics passent au jeu. Déverrouille pour le déplacer.", background: "Afficher le fond", bars: "Afficher les barres de signal", size: "Taille", small: "Petit", medium: "Moyen", large: "Grand", good: "Vert jusqu'à", fair: "Orange jusqu'à", help: "Fais glisser le widget où tu veux. Double-clique dessus pour ouvrir cette fenêtre.", old: "Nécessite le compteur 2.0.73 ou plus récent", fps: "Afficher les FPS du jeu", fpsAdmin: "Les FPS nécessitent que le compteur s'exécute en tant qu'administrateur.", fpsAdminButton: "Exécuter en tant qu'administrateur", fpsUnsupported: "Les FPS ne sont pas disponibles sur ce système.", fpsOld: "Les FPS nécessitent le compteur 2.0.78 ou plus récent.", fpsGood: "FPS vert à partir de", fpsFair: "FPS orange à partir de", jitter: "Gigue {v} ms", cycle: "Alterner ping et gigue", cycleNote: "Le widget affiche la gigue 5 s après chaque ping, puis le ping suivant.", jitterOld: "La gigue nécessite le compteur 2.0.99 ou plus récent." },
  es: { now: "Ping actual", show: "Mostrar el widget de ping", lock: "Bloquear el widget", lockNote: "Los clics pasan al juego. Desbloquéalo para moverlo.", background: "Mostrar el fondo", bars: "Mostrar las barras de señal", size: "Tamaño", small: "Pequeño", medium: "Mediano", large: "Grande", good: "Verde hasta", fair: "Ámbar hasta", help: "Arrastra el widget a donde quieras. Haz doble clic para abrir esta ventana.", old: "Necesita el medidor 2.0.73 o posterior", fps: "Mostrar los FPS del juego", fpsAdmin: "Los FPS necesitan que el medidor se ejecute como administrador.", fpsAdminButton: "Ejecutar como administrador", fpsUnsupported: "Los FPS no están disponibles en este sistema.", fpsOld: "Los FPS necesitan el medidor 2.0.78 o posterior.", fpsGood: "FPS verde desde", fpsFair: "FPS ámbar desde", jitter: "Fluctuación {v} ms", cycle: "Alternar ping y fluctuación", cycleNote: "El widget muestra la fluctuación 5 s después de cada ping y luego el siguiente ping.", jitterOld: "La fluctuación necesita el medidor 2.0.99 o posterior." },
  pt: { now: "Ping agora", show: "Mostrar o widget de ping", lock: "Travar o widget", lockNote: "Os cliques passam para o jogo. Destrave para movê-lo.", background: "Mostrar o fundo", bars: "Mostrar as barras de sinal", size: "Tamanho", small: "Pequeno", medium: "Médio", large: "Grande", good: "Verde até", fair: "Âmbar até", help: "Arraste o widget para onde quiser. Clique duas vezes para abrir esta janela.", old: "Requer o medidor 2.0.73 ou mais recente", fps: "Mostrar o FPS do jogo", fpsAdmin: "O FPS precisa que o medidor seja executado como administrador.", fpsAdminButton: "Executar como administrador", fpsUnsupported: "O FPS não está disponível neste sistema.", fpsOld: "O FPS requer o medidor 2.0.78 ou mais recente.", fpsGood: "FPS verde a partir de", fpsFair: "FPS âmbar a partir de", jitter: "Variação {v} ms", cycle: "Alternar ping e variação", cycleNote: "O widget mostra a variação 5 s após cada ping e depois o próximo ping.", jitterOld: "A variação requer o medidor 2.0.99 ou mais recente." },
  ru: { now: "Пинг сейчас", show: "Показывать виджет пинга", lock: "Закрепить виджет", lockNote: "Клики проходят в игру. Открепите, чтобы переместить.", background: "Показывать фон", bars: "Показывать полоски сигнала", size: "Размер", small: "Маленький", medium: "Средний", large: "Большой", good: "Зелёный до", fair: "Жёлтый до", help: "Перетащите виджет куда угодно. Двойной щелчок открывает это окно.", old: "Нужен метр 2.0.73 или новее", fps: "Показывать FPS игры", fpsAdmin: "Для FPS метр должен работать от имени администратора.", fpsAdminButton: "Запустить от имени администратора", fpsUnsupported: "FPS недоступен в этой системе.", fpsOld: "Для FPS нужен метр 2.0.78 или новее.", fpsGood: "FPS зелёный от", fpsFair: "FPS жёлтый от", jitter: "Джиттер {v} мс", cycle: "Чередовать пинг и джиттер", cycleNote: "Виджет показывает джиттер через 5 с после каждого пинга, затем следующий пинг.", jitterOld: "Для джиттера нужен метр 2.0.99 или новее." },
  "zh-Hant": { now: "目前延遲", show: "顯示延遲小工具", lock: "鎖定小工具", lockNote: "點擊會穿透到遊戲。解鎖後才能移動。", background: "顯示背景", bars: "顯示訊號格", size: "大小", small: "小", medium: "中", large: "大", good: "綠色上限", fair: "橘色上限", help: "可將小工具拖到任何位置。按兩下開啟此視窗。", old: "需要計量器 2.0.73 或更新版本", fps: "顯示遊戲 FPS", fpsAdmin: "顯示 FPS 需要計量器以系統管理員身分執行。", fpsAdminButton: "以系統管理員身分執行", fpsUnsupported: "此系統無法顯示 FPS。", fpsOld: "FPS 需要計量器 2.0.78 或更新版本。", fpsGood: "FPS 綠色下限", fpsFair: "FPS 橘色下限", jitter: "抖動 {v} 毫秒", cycle: "輪流顯示延遲與抖動", cycleNote: "小工具在每次延遲更新 5 秒後顯示抖動，下次延遲更新時再切回。", jitterOld: "抖動需要計量器 2.0.99 或更新版本。" },
  "zh-Hans": { now: "当前延迟", show: "显示延迟小组件", lock: "锁定小组件", lockNote: "点击会穿透到游戏。解锁后才能移动。", background: "显示背景", bars: "显示信号格", size: "大小", small: "小", medium: "中", large: "大", good: "绿色上限", fair: "橙色上限", help: "可将小组件拖到任意位置。双击打开此窗口。", old: "需要计量器 2.0.73 或更新版本", fps: "显示游戏 FPS", fpsAdmin: "显示 FPS 需要计量器以管理员身份运行。", fpsAdminButton: "以管理员身份运行", fpsUnsupported: "此系统无法显示 FPS。", fpsOld: "FPS 需要计量器 2.0.78 或更新版本。", fpsGood: "FPS 绿色下限", fpsFair: "FPS 橙色下限", jitter: "抖动 {v} 毫秒", cycle: "轮流显示延迟与抖动", cycleNote: "小组件在每次延迟更新 5 秒后显示抖动，下次延迟更新时再切回。", jitterOld: "抖动需要计量器 2.0.99 或更新版本。" },
};
let words = UI.en;

const DEFAULTS = { show: true, background: true, bars: true, size: "1", good: 80, fair: 150, fps: false, fpsGood: 60, fpsFair: 30, cycle: false };
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

a2.on("ping", (d) => {
  heard = true;
  ms = d && typeof d.ms === "number" ? d.ms : null;
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
  els.lock.checked = await a2.widgets.locked().catch(() => false);
  translate();
  render();
  await placeWidget();
  if (prefs.fps) await watchFps(false);
  a2.ready();
})();
