// Alerts as icons (#12): each alert that is on shows as a small icon with its
// countdown, in a window of its own (a widget, meter 2.0.68 on) that the
// player drags anywhere and locks in place. The icon appears at the alert's
// time (or always, or some minutes before), shakes, bounces, throbs or glows when due, and the
// alert sounds; the plugin's window stays out of the way. Settings has the
// defaults (sound and repeat in plugin.js; when icons appear, their effect,
// their names, the lock); each alert can override any of them. "Show alerts
// as: This window" keeps the old way, a banner in this window.
//
// A world boss's alert can also come when the boss is being fought (its HP
// reported falling), for players who want to go and join: once per spawn,
// the icon showing "Fighting" and its HP. "Remind me: Don't remind" leaves
// only that.
//
// Loaded after plugin.js, whose timers it reads: plugin.js calls
// pinControls() for each alert row, updatePins() every second,
// pinnedIconOnly() before an alert brings up the window, and alertSound() for
// an alert's sound and repeats.

const PIN_UI = {
  en: { keep: "Show icon even when not alerting", keepAll: "Show icons even when not alerting", more: "More options", open: "Open", killed: "Killed",
    name: "Name on icon", tp: "Teleport number on icon", opacity: "Icon opacity", effect: "Alert icon animation", shake: "Shake", bounce: "Bounce", throb: "Throb", glow: "Glow", nothing: "None", style: "Show alerts as", icons: "Icons", window: "This window",
    deflt: "Default", shown: "Shown", hiddenName: "Hidden", sound: "Sound", repeat: "Repeat",
    lock: "Lock icons", lockNote: "Clicks pass through to the game.",
    fought: "When it's being fought", alertMe: "Alert me", noRemind: "Don't remind", fighting: "Fighting", foughtMsg: (name, hp) => `${name} is being fought (${hp}%), go join!`,
    hideIdle: "Hide window when idle", hideIdleNote: "Hides after 30 s unused. Double-click an icon, or Settings → Plugins → Open, to bring it back.",
    needsMeter: "Icons need meter 2.0.68 or newer", now: "Now" },
  ko: { keep: "알림이 아닐 때도 아이콘 표시", keepAll: "알림이 아닐 때도 아이콘 표시", more: "추가 설정", open: "열림", killed: "처치",
    name: "아이콘에 이름", tp: "아이콘에 텔레포트 번호", opacity: "아이콘 불투명도", effect: "알림 아이콘 효과", shake: "흔들기", bounce: "튀기기", throb: "두근거리기", glow: "빛나기", nothing: "없음", style: "알림 표시 방식", icons: "아이콘", window: "이 창",
    deflt: "기본값", shown: "표시", hiddenName: "숨김", sound: "소리", repeat: "반복",
    lock: "아이콘 잠금", lockNote: "잠긴 아이콘은 클릭이 게임으로 통과됩니다.",
    fought: "전투가 시작되면", alertMe: "알림", noRemind: "알리지 않음", fighting: "전투 중", foughtMsg: (name, hp) => `${name} 전투 중 (${hp}%), 지금 합류하세요!`,
    hideIdle: "사용하지 않을 때 이 창 숨기기", hideIdleNote: "30초 동안 사용하지 않으면 창이 숨겨집니다. 다시 열려면 아이콘을 더블클릭하거나 설정 → 플러그인 → 열기.",
    needsMeter: "아이콘은 미터 2.0.68 이상이 필요합니다", now: "지금" },
  ja: { keep: "通知時以外もアイコンを表示", keepAll: "通知時以外もアイコンを表示", more: "その他の設定", open: "開放中", killed: "討伐",
    name: "アイコンに名前", tp: "アイコンにテレポート番号", opacity: "アイコンの不透明度", effect: "通知アイコンの動き", shake: "揺らす", bounce: "跳ねる", throb: "脈打つ", glow: "光らせる", nothing: "なし", style: "通知の表示", icons: "アイコン", window: "このウィンドウ",
    deflt: "既定", shown: "表示", hiddenName: "非表示", sound: "サウンド", repeat: "繰り返し",
    lock: "アイコンをロック", lockNote: "ロックしたアイコンはクリックがゲームに通ります。",
    fought: "戦闘が始まったら", alertMe: "通知する", noRemind: "通知しない", fighting: "戦闘中", foughtMsg: (name, hp) => `${name}が戦闘中（${hp}%）、参加しよう！`,
    hideIdle: "使っていないときはこのウィンドウを隠す", hideIdleNote: "30秒間使わないとウィンドウが隠れます。戻すには、アイコンをダブルクリックするか、設定 → プラグイン → 開く。",
    needsMeter: "アイコンにはメーター2.0.68以降が必要です", now: "今" },
  de: { keep: "Symbol auch ohne Alarm anzeigen", keepAll: "Symbole auch ohne Alarm anzeigen", more: "Weitere Optionen", open: "Offen", killed: "Besiegt",
    name: "Name am Symbol", tp: "Teleport-Nummer am Symbol", opacity: "Deckkraft der Symbole", effect: "Animation des Alarmsymbols", shake: "Wackeln", bounce: "Hüpfen", throb: "Pulsieren", glow: "Leuchten", nothing: "Nichts", style: "Alarme zeigen als", icons: "Symbole", window: "Dieses Fenster",
    deflt: "Standard", shown: "Angezeigt", hiddenName: "Ausgeblendet", sound: "Ton", repeat: "Wiederholen",
    lock: "Symbole sperren", lockNote: "Gesperrte Symbole lassen Klicks zum Spiel durch.",
    fought: "Wenn er bekämpft wird", alertMe: "Alarm", noRemind: "Nicht erinnern", fighting: "Im Kampf", foughtMsg: (name, hp) => `${name} wird bekämpft (${hp} %), mach mit!`,
    hideIdle: "Dieses Fenster ausblenden, wenn es nicht benutzt wird", hideIdleNote: "Das Fenster wird nach 30 Sekunden ohne Benutzung ausgeblendet. Zurück holst du es per Doppelklick auf ein Symbol oder über Einstellungen → Plugins → Öffnen.",
    needsMeter: "Symbole brauchen Meter 2.0.68 oder neuer", now: "Jetzt" },
  fr: { keep: "Afficher l'icône même sans alerte", keepAll: "Afficher les icônes même sans alerte", more: "Plus d'options", open: "Ouvert", killed: "Vaincu",
    name: "Nom sur l'icône", tp: "Numéro de téléporteur sur l'icône", opacity: "Opacité des icônes", effect: "Animation de l'icône d'alerte", shake: "Secouer", bounce: "Rebondir", throb: "Pulser", glow: "Briller", nothing: "Rien", style: "Afficher les alertes en", icons: "Icônes", window: "Cette fenêtre",
    deflt: "Par défaut", shown: "Affiché", hiddenName: "Masqué", sound: "Son", repeat: "Répéter",
    lock: "Verrouiller les icônes", lockNote: "Les icônes verrouillées laissent passer les clics vers le jeu.",
    fought: "Quand il est attaqué", alertMe: "M'alerter", noRemind: "Ne pas rappeler", fighting: "Attaqué", foughtMsg: (name, hp) => `${name} est attaqué (${hp} %), rejoignez le combat !`,
    hideIdle: "Masquer cette fenêtre quand elle ne sert pas", hideIdleNote: "La fenêtre se masque après 30 secondes sans utilisation. Pour la rouvrir, double-cliquez sur une icône, ou Réglages → Plugins → Ouvrir.",
    needsMeter: "Les icônes nécessitent le compteur 2.0.68 ou plus récent", now: "Maintenant" },
  es: { keep: "Mostrar el icono aunque no haya alerta", keepAll: "Mostrar los iconos aunque no haya alerta", more: "Más opciones", open: "Abierto", killed: "Derrotado",
    name: "Nombre en el icono", tp: "Número de teletransporte en el icono", opacity: "Opacidad de los iconos", effect: "Animación del icono de alerta", shake: "Agitar", bounce: "Rebotar", throb: "Latir", glow: "Brillar", nothing: "Nada", style: "Mostrar las alertas como", icons: "Iconos", window: "Esta ventana",
    deflt: "Predeterminado", shown: "Visible", hiddenName: "Oculto", sound: "Sonido", repeat: "Repetir",
    lock: "Bloquear los iconos", lockNote: "Los iconos bloqueados dejan pasar los clics al juego.",
    fought: "Cuando lo estén atacando", alertMe: "Avisarme", noRemind: "No avisar", fighting: "En combate", foughtMsg: (name, hp) => `Están atacando a ${name} (${hp}%), ¡únete!`,
    hideIdle: "Ocultar esta ventana cuando no se usa", hideIdleNote: "La ventana se oculta tras 30 segundos sin usarla. Para volver a abrirla, haz doble clic en un icono, o Ajustes → Plugins → Abrir.",
    needsMeter: "Los iconos necesitan el medidor 2.0.68 o posterior", now: "Ahora" },
  pt: { keep: "Mostrar o ícone mesmo sem alerta", keepAll: "Mostrar os ícones mesmo sem alerta", more: "Mais opções", open: "Aberto", killed: "Derrotado",
    name: "Nome no ícone", tp: "Número do teleporte no ícone", opacity: "Opacidade dos ícones", effect: "Animação do ícone de alerta", shake: "Tremer", bounce: "Quicar", throb: "Pulsar", glow: "Brilhar", nothing: "Nada", style: "Mostrar os alertas como", icons: "Ícones", window: "Esta janela",
    deflt: "Padrão", shown: "Visível", hiddenName: "Oculto", sound: "Som", repeat: "Repetir",
    lock: "Travar os ícones", lockNote: "Ícones travados deixam os cliques passarem para o jogo.",
    fought: "Quando estiver sendo atacado", alertMe: "Avisar-me", noRemind: "Não avisar", fighting: "Em combate", foughtMsg: (name, hp) => `${name} está sendo atacado (${hp}%), junte-se!`,
    hideIdle: "Ocultar esta janela quando não estiver em uso", hideIdleNote: "A janela se oculta após 30 segundos sem uso. Para reabri-la, clique duas vezes em um ícone, ou Configurações → Plugins → Abrir.",
    needsMeter: "Os ícones precisam do medidor 2.0.68 ou mais recente", now: "Agora" },
  ru: { keep: "Показывать значок и без оповещения", keepAll: "Показывать значки и без оповещения", more: "Дополнительно", open: "Открыт", killed: "Убит",
    name: "Название на значке", tp: "Номер телепорта на значке", opacity: "Непрозрачность значков", effect: "Анимация значка оповещения", shake: "Трясти", bounce: "Подпрыгивать", throb: "Пульсировать", glow: "Светиться", nothing: "Ничего", style: "Показывать оповещения", icons: "Значками", window: "В этом окне",
    deflt: "По умолчанию", shown: "Показано", hiddenName: "Скрыто", sound: "Звук", repeat: "Повтор",
    lock: "Зафиксировать значки", lockNote: "Зафиксированные значки пропускают клики в игру.",
    fought: "Когда его атакуют", alertMe: "Оповестить", noRemind: "Не напоминать", fighting: "Бой", foughtMsg: (name, hp) => `${name} атакуют (${hp}%), присоединяйтесь!`,
    hideIdle: "Скрывать это окно, когда оно не используется", hideIdleNote: "Окно скрывается через 30 секунд без использования. Чтобы вернуть его, дважды щёлкните по значку или откройте Настройки → Плагины → Открыть.",
    needsMeter: "Для значков нужен счётчик 2.0.68 или новее", now: "Сейчас" },
  "zh-Hant": { keep: "未提醒時也顯示圖示", keepAll: "未提醒時也顯示圖示", more: "更多選項", open: "開啟中", killed: "已擊殺",
    name: "圖示上的名稱", tp: "圖示上的傳送點編號", opacity: "圖示不透明度", effect: "提醒圖示動畫", shake: "晃動", bounce: "彈跳", throb: "脈動", glow: "發光", nothing: "無", style: "提醒顯示為", icons: "圖示", window: "此視窗",
    deflt: "預設", shown: "顯示", hiddenName: "隱藏", sound: "音效", repeat: "重複",
    lock: "鎖定圖示", lockNote: "鎖定的圖示會讓點擊穿透到遊戲。",
    fought: "開始戰鬥時", alertMe: "提醒我", noRemind: "不提醒", fighting: "戰鬥中", foughtMsg: (name, hp) => `${name} 戰鬥中（${hp}%），快去加入！`,
    hideIdle: "不使用時隱藏此視窗", hideIdleNote: "30 秒未使用後視窗會隱藏。要再開啟，請雙擊圖示，或 設定 → 外掛程式 → 開啟。",
    needsMeter: "圖示需要計量器 2.0.68 以上", now: "現在" },
  "zh-Hans": { keep: "未提醒时也显示图标", keepAll: "未提醒时也显示图标", more: "更多选项", open: "开启中", killed: "已击杀",
    name: "图标上的名称", tp: "图标上的传送点编号", opacity: "图标不透明度", effect: "提醒图标动画", shake: "晃动", bounce: "弹跳", throb: "脉动", glow: "发光", nothing: "无", style: "提醒显示为", icons: "图标", window: "此窗口",
    deflt: "默认", shown: "显示", hiddenName: "隐藏", sound: "音效", repeat: "重复",
    lock: "锁定图标", lockNote: "锁定的图标会让点击穿透到游戏。",
    fought: "开始战斗时", alertMe: "提醒我", noRemind: "不提醒", fighting: "战斗中", foughtMsg: (name, hp) => `${name} 战斗中（${hp}%），快去加入！`,
    hideIdle: "不使用时隐藏此窗口", hideIdleNote: "30 秒未使用后窗口会隐藏。要再打开，请双击图标，或 设置 → 插件 → 打开。",
    needsMeter: "图标需要计量器 2.0.68 或更新版本", now: "现在" },
};
const pinUi = () => PIN_UI[language] || PIN_UI.en;
const PIN_EFFECTS = ["shake", "bounce", "throb", "glow", "nothing"];
// How long a pin counts as due after its timer starts, so the effect is seen.
const DUE_AFTER_MS = 60_000;
// A world boss seen up and then killed shows "Killed" this long, then goes
// (or, shown always, counts down to its respawn).
const KILLED_SHOW_MS = 20_000;
// World bosses seen up, and when each was seen killed.
const seenUp = new Set();
const killedAt = new Map();
// A boss counts as fought while it is up and a report from the last 3
// minutes has its HP below 99%.
const FOUGHT_BELOW = 99;
const FOUGHT_FRESH_MS = 3 * 60_000;
// When each boss was first seen fought this spawn, and the spawns alerted.
const foughtAt = new Map();
const foughtAlerted = new Set();
const canPin = () => !!(a2.widgets && typeof a2.widgets.open === "function");
// Icons are the alerts, unless the player chose the window (or the meter has
// no widgets).
const iconStyle = () => canPin() && prefs.alertStyle !== "window";
const overrides = () => (prefs.overrides ||= {});
// A widget's name: lowercase letters, digits and "-" ("field:101006" is
// "field-101006").
const widgetName = (id) => id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "timer";

// Settings from the 0.4.0 test builds: pins made while icons were a separate
// option become alerts, and "Icon appears" (always, or minutes before)
// becomes "Show the icon even when not alerting" (an icon otherwise appears when its alert
// reminds).
function migratePins() {
  if (prefs.iconShow != null) {
    prefs.iconAlways = Number(prefs.iconShow) === -1;
    delete prefs.iconShow;
    savePrefs();
  }
  for (const o of Object.values(overrides())) {
    if (o.show == null) continue;
    if (Number(o.show) === -1) o.always = true;
    delete o.show;
  }
  if (!prefs.pins) return;
  for (const [id, pin] of Object.entries(prefs.pins)) {
    if (!(id in prefs.alerts)) prefs.alerts[id] = prefs.leads[id] ?? defaultLead();
    const o = { ...(overrides()[id] || {}) };
    if (Number(pin.show) === -1) o.always = true;
    if (pin.effect) o.effect = pin.effect;
    if (pin.name != null) o.name = !!pin.name;
    overrides()[id] = o;
  }
  delete prefs.pins;
  savePrefs();
}

// The icons to show and how: one per alert that is on, and with "All field
// bosses" on, one per world boss without an alert of its own. Each with the
// key its settings come from.
function iconPins() {
  if (!iconStyle()) return {};
  migratePins();
  const cfg = (key) => {
    const o = overrides()[key] || {};
    return {
      key,
      always: !!(o.always ?? prefs.iconAlways ?? false),
      effect: o.effect ?? prefs.iconEffect ?? "shake",
      name: o.name ?? prefs.iconName ?? true,
      tp: o.tp ?? prefs.iconTp ?? false,
      lead: Number(prefs.alerts[key] ?? 0),
      fought: !!prefs.fought?.[key],
    };
  };
  // Only this player's side, as the lists and alerts have it: an alert set
  // for both sides' Shugo Festa (or one set before the side was known) gave
  // two icons for one event.
  const side = serverSide();
  const otherSide = (id) => {
    if (!side) return false;
    const of = id.startsWith("field:") ? FIELD_BOSSES[id.slice(6)] : EVENTS.find((ev) => ev.id === id);
    return !!of?.side && of.side !== side;
  };
  const out = {};
  for (const id of Object.keys(prefs.alerts)) if (id !== ALL_FIELD && !otherSide(id)) out[id] = cfg(id);
  if (ALL_FIELD in prefs.alerts) {
    for (const b of fieldBosses()) {
      const id = `field:${b.id}`;
      if (!(id in out)) out[id] = cfg(ALL_FIELD);
    }
  }
  // World Boss Train (anchor.js): the rest of the world bosses, shown while
  // up or about to spawn.
  if (typeof trainPins === "function") trainPins(out, cfg);
  return out;
}

// The game's own icon for a timer (icons/, from the game files): Shugo Festa,
// the Dimensional Invasion, the rift, Artifact War, and the boss marker for
// every boss. Anything else shows its initials.
const pinIcon = (id, kind) => {
  if (id.startsWith("field:") || kind === "boss") return "boss";
  if (id.startsWith("festival")) return "shugo";
  if (id.startsWith("invasion")) return "invasion";
  if (id === "rift") return "rift";
  if (id === "artifact") return "artifact";
  return "";
};
// An icon's window: room for its countdown, and its name, on two lines each.
// Tight around the badge and its two lines, so icons can sit close together.
// With room above the badge for its glow.
const pinSize = (showName) => ({ width: 80, height: showName ? 128 : 94 });
// How see-through the icons are (Settings: Icon opacity), 0.3 to 1.
const PIN_OPACITIES = [100, 90, 80, 70, 60, 50, 40, 30];
const pinOpacity = () => (PIN_OPACITIES.includes(Number(prefs.iconOpacity)) ? Number(prefs.iconOpacity) : 100) / 100;

// What a timer is doing now: its name, kind, the next start (ms) or null,
// whether it is running (an event under way, a world boss up), and a field
// boss's HP and kill.
function pinState(id, now) {
  if (id.startsWith("field:")) {
    const b = fieldBosses().find((x) => `field:${x.id}` === id);
    if (!b) return null;
    const t = fieldTimer(b.id);
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : null;
    // Its HP while it is up and the report is fresh (the feed drops it after
    // 30 minutes), for the ring around its icon.
    const hp = t?.state === "up" && t.hp != null && t.hpAt ? Math.max(0, Math.min(100, Number(t.hp))) : null;
    // Up, then dead: killed just now.
    if (t?.state === "up") {
      seenUp.add(id);
      killedAt.delete(id);
    } else if (t?.state === "dead" && seenUp.has(id)) {
      seenUp.delete(id);
      killedAt.set(id, now);
    }
    const killed = killedAt.has(id) && now - killedAt.get(id) < KILLED_SHOW_MS;
    return { name: text(b.name), kind: "field", start: next, running: t?.state === "up", end: null, hp, killed,
      fought: bossFought(t, now) };
  }
  const ev = EVENTS.find((e) => e.id === id);
  if (!ev) return null;
  const tz = timeZone();
  if (!tz && !ev.utc) return { name: text(ev.name), kind: ev.kind === "boss" ? "boss" : "event", start: null, running: false, end: null };
  const next = nextOf(ev, tz || "UTC", now);
  return {
    name: text(ev.name),
    kind: ev.kind === "boss" ? "boss" : "event",
    start: next ? next.start : null,
    end: next ? next.end : null,
    running: !!next && next.start <= now,
    // Open to enter until `end` (nextOf counts only that while as running).
    entry: !!ev.enter,
  };
}

// The line a double right-click on its icon copies, for chat: what the icon
// shows, in words (plugin.js's COPY). World and Abyss bosses say which.
function pinLine(id, state, now, fight) {
  const c = COPY[language] || COPY.en;
  const n = state.name;
  const field = id.startsWith("field:");
  const ev = field ? null : EVENTS.find((e) => e.id === id);
  const abyss = field ? isAbyssBoss(fieldBosses().find((x) => `field:${x.id}` === id) || {}) : state.kind === "boss";
  const hp = field ? state.hp : null;
  const until = state.start != null ? state.start - now : null;
  const say = state.killed ? c.killed(n)
    : hp != null && (state.running || field) ? c.hp(n, Math.round(hp))
    : fight ? c.fought(n)
    : state.running && state.kind !== "event" ? c.up(n)
    : state.running && state.end > now ? (state.entry ? c.open : c.on)(n, chatSpan(state.end - now))
    : state.running ? c.now(n)
    : until == null ? c.unknown(n)
    : until <= 0 ? c.due(n)
    : (state.kind === "event" ? c.starts : c.back)(n, chatSpan(until));
  return state.kind === "event" ? say : `${abyss ? c.abyss : c.wb}: ${say}`;
}

// "up" while a world boss with an icon is up, "soon" while one is due within
// 5 minutes or overdue, else "": how often plugin.js reads the feed, for its
// HP as it falls and its kill.
// The world bosses whose news matters now: those with an icon, and those
// watched for being fought.
const watchedField = () => [...new Set([...Object.keys(iconPins()).filter((id) => id.startsWith("field:")), ...foughtWatched()])];

function pinnedBossLive(now) {
  let soon = false;
  for (const id of watchedField()) {
    const t = fieldTimer(id.slice(6));
    if (t?.state === "up" || seenUp.has(id)) return "up";
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : 0;
    if (next > 0 && next - now <= 5 * 60_000 && now - next <= WINDOW_MS) soon = true;
  }
  return soon ? "soon" : "";
}

// Whether an alert comes as its icon (and sound) rather than this window.
function pinnedIconOnly() {
  return iconStyle();
}

// Whether a world boss is being fought: up, and a fresh report has its HP
// falling below 99%.
function bossFought(t, now) {
  return t?.state === "up" && t.hp != null && !!t.hpAt && Number(t.hp) < FOUGHT_BELOW
    && now - t.hpAt * 1000 < FOUGHT_FRESH_MS;
}

// The alert whose settings a world boss follows ("field:<id>", or "All field
// bosses" for one without its own), if it is on.
function fieldAlertKey(id) {
  if (id in prefs.alerts) return id;
  return ALL_FIELD in prefs.alerts ? ALL_FIELD : null;
}

// The world bosses whose alert asks to be told when they are fought.
function foughtWatched() {
  if (!prefs.fought) return [];
  return fieldBosses().map((b) => `field:${b.id}`).filter((id) => {
    const key = fieldAlertKey(id);
    return key && prefs.fought[key];
  });
}

// Each check (plugin.js, with its announce): a watched boss newly fought
// alerts, once per spawn; not while AION2 is closed if its alert is off then.
function checkFights(now, announce) {
  const p = pinUi();
  for (const id of foughtWatched()) {
    const t = fieldTimer(id.slice(6));
    if (t?.state !== "up") {
      foughtAt.delete(id);
      continue;
    }
    if (!bossFought(t, now)) continue;
    if (!foughtAt.has(id)) foughtAt.set(id, now);
    const spawn = `${id}@${t.upSince ?? ""}`;
    if (foughtAlerted.has(spawn)) continue;
    foughtAlerted.add(spawn);
    const key = fieldAlertKey(id);
    if (gameRunning === false && Number(prefs.closedLeads[key] ?? defaultClosed()) < 0) continue;
    const b = fieldBosses().find((x) => `field:${x.id}` === id);
    announce(id, p.foughtMsg(b ? text(b.name) : id, Math.round(Number(t.hp))), key,
      b && typeof SPOKEN === "object" ? [SPOKEN.name(b.name), SPOKEN.fought] : undefined);
  }
}

// The alert's "When it's being fought" line, for world bosses.
function fightControl(id) {
  const p = pinUi();
  const row = document.createElement("label");
  row.className = "leadRow";
  const label = document.createElement("span");
  label.textContent = p.fought;
  const s = document.createElement("select");
  s.className = "lead";
  s.append(option("off", aui().off), option("on", p.alertMe));
  s.value = prefs.fought?.[id] ? "on" : "off";
  s.addEventListener("change", () => {
    prefs.fought ||= {};
    if (s.value === "on") prefs.fought[id] = true;
    else delete prefs.fought[id];
    savePrefs();
    updatePins(Date.now());
  });
  row.append(label, s);
  return row;
}

// The sound and repeats for an alert: its own, else the defaults.
function alertSound(key) {
  const o = (key && overrides()[key]) || {};
  return { sound: o.sound ?? prefs.sound, repeat: Number(o.repeat ?? prefs.repeat) };
}

// "More options" under an alert that is on: its own sound, repeats and icon,
// each "Default" (Settings) unless changed.
function pinControls(id) {
  const p = pinUi();
  const a = aui();
  const words = ui();
  const box = document.createElement("details");
  box.className = "pinMore";
  const summary = document.createElement("summary");
  summary.textContent = p.more;
  const select = (values) => {
    const s = document.createElement("select");
    s.append(...values.map(([v, l]) => option(v, l)));
    return s;
  };
  const sound = select([["", p.deflt], ...[...SOUND_ORDER, "off"].map((v) => [v, v === "off" ? a.none : a.sounds[v]])]);
  const repeat = select([["", p.deflt], ...REPEATS.map((n) => [n, n === 0 ? words.untilMuted : n === 1 ? words.once : words.times(n)])]);
  const keep = select([["", p.deflt], ["on", p.shown], ["off", p.hiddenName]]);
  const effect = select([["", p.deflt], ...PIN_EFFECTS.map((e) => [e, p[e]])]);
  const name = select([["", p.deflt], ["on", p.shown], ["off", p.hiddenName]]);
  const tp = select([["", p.deflt], ["on", p.shown], ["off", p.hiddenName]]);
  const line = (label, control, icon) => {
    const row = document.createElement("label");
    row.className = "leadRow";
    if (icon) row.classList.add("iconOnlyRow");
    const s = document.createElement("span");
    s.textContent = label;
    row.append(s, control);
    return row;
  };
  // Its rows in a grid of their own, as the alert's times are (a <details>
  // is not a grid on every engine, so a div inside it).
  const rows = document.createElement("div");
  rows.className = "pinRows";
  rows.append(line(p.sound, sound), line(p.repeat, repeat), line(p.keep, keep, true), line(p.effect, effect, true),
    line(p.name, name, true), line(p.tp, tp, true));
  box.append(summary, rows);
  const fill = () => {
    const o = overrides()[id] || {};
    sound.value = o.sound ?? "";
    repeat.value = o.repeat != null ? String(o.repeat) : "";
    keep.value = o.always == null ? "" : o.always ? "on" : "off";
    effect.value = o.effect ?? "";
    name.value = o.name == null ? "" : o.name ? "on" : "off";
    tp.value = o.tp == null ? "" : o.tp ? "on" : "off";
    for (const row of box.querySelectorAll(".iconOnlyRow")) row.hidden = !iconStyle();
    // Open while anything differs from the defaults, so it shows.
    box.classList.toggle("changed", Object.keys(o).length > 0);
  };
  fill();
  if (Object.keys(overrides()[id] || {}).length) box.open = true;
  const save = () => {
    const o = {};
    if (sound.value) o.sound = sound.value;
    if (repeat.value !== "") o.repeat = Number(repeat.value);
    if (keep.value) o.always = keep.value === "on";
    if (effect.value) o.effect = effect.value;
    if (name.value) o.name = name.value === "on";
    if (tp.value) o.tp = tp.value === "on";
    if (Object.keys(o).length) overrides()[id] = o;
    else delete overrides()[id];
    fill();
    savePrefs();
    updatePins(Date.now());
  };
  for (const control of [sound, repeat, keep, effect, name, tp]) control.addEventListener("change", save);
  sound.addEventListener("change", () => {
    if (sound.value && sound.value !== "off") playSound(sound.value);
  });
  return box;
}

// Live updates (meter 2.0.68 with a site that pushes them): the world bosses
// with an icon that are up, due soon, overdue or just killed are followed,
// and each change the site pushes lands in the feed at once. While the
// connection is up, reading the feed is only the fallback.
let followed = "";
let liveUp = false;
function followLive(now) {
  if (typeof a2.followBosses !== "function") return;
  const server = serverId();
  if (!server) return;
  const ids = watchedField()
    .filter((id) => {
      const t = fieldTimer(id.slice(6));
      // Just killed: while it shows "Killed" (it was followed forever after).
      if (t?.state === "up" || seenUp.has(id) || now - (killedAt.get(id) ?? -Infinity) < KILLED_SHOW_MS) return true;
      const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : 0;
      return next > 0 && next - now <= 5 * 60_000 && now - next <= WINDOW_MS;
    })
    .map((id) => id.slice(6))
    .sort();
  const key = `${server}:${ids.join(",")}`;
  if (key === followed) return;
  const before = followed;
  followed = key;
  // A different server: stop following the old one.
  const oldServer = Number(before.split(":")[0]);
  if (oldServer && oldServer !== server) a2.followBosses(oldServer, []).catch(() => {});
  a2.followBosses(server, ids).catch(() => { followed = before; });
}
a2.on("bossLive", (m) => {
  if (!m || Number(m.server) !== serverId()) return;
  if (m.type === "status") {
    liveUp = !!m.connected;
    return;
  }
  const base = feed?.server === serverId() ? feed : { server: serverId(), bosses: {}, at: Date.now() };
  let bosses = { ...(base.bosses || {}) };
  // The newest report of each boss stands, as for the feed (mergeOwn): the
  // site's older word overwrote the player's own map's, and the boss went
  // from up to dead and back with each read, its icon opening and closing.
  const take = (id, entry) => {
    const have = bosses[id];
    if (!have || (Number(have.reportedAt) || 0) <= (Number(entry?.reportedAt) || 0)) {
      // Newer as a report, but the HP read here (bossHp) can be newer
      // still: kept for the same life.
      bosses[id] = hpOfLife(have, entry) && (Number(have.hpAt) || 0) > (Number(entry?.hpAt) || 0)
        ? { ...entry, hp: have.hp, hpAt: have.hpAt }
        : entry;
      return;
    }
    // An older report can still bring newer HP: the site's HP updates leave
    // reportedAt as it was. Taken for the same life still up.
    if (hpOfLife(entry, have) && (Number(entry.hpAt) || 0) > (Number(have.hpAt) || 0)) {
      bosses[id] = { ...have, hp: entry.hp, hpAt: entry.hpAt };
    }
  };
  if (m.type === "state" && m.bosses && typeof m.bosses === "object") for (const [id, e] of Object.entries(m.bosses)) take(id, e);
  else if (m.type === "boss" && m.boss != null && m.entry) take(String(m.boss), m.entry);
  else return;
  bosses = mergeOwn(bosses);
  liveUp = true;
  feed = { ...base, bosses };
  updatePins(Date.now());
});

// The player's own fight (meter 2.0.93 on): the HP their meter reads, at
// once. The site's word came back later, or not while reports couldn't
// reach it, and a boss's icon stayed at 24% through the fight (Allula,
// 2026-11-08). Stamped now, it stands over any older word from the site.
a2.on("bossHp", (m) => {
  if (!m || Number(m.server) !== serverId() || !Array.isArray(m.bosses)) return;
  const base = feed?.server === serverId() ? feed : { server: serverId(), bosses: {}, at: Date.now() };
  const bosses = { ...(base.bosses || {}) };
  const at = Math.floor(Date.now() / 1000);
  for (const b of m.bosses) {
    const hp = Number(b?.hp);
    if (b?.id == null || !Number.isFinite(hp)) continue;
    const id = String(b.id);
    const have = bosses[id];
    // Being hit, it is up, whatever the feed last said.
    bosses[id] = have?.state === "up"
      ? { ...have, hp, hpAt: at }
      : { ...(have || {}), state: "up", upSince: at, nextSpawn: null, hp, hpAt: at,
          reportedAt: Math.max(Number(have?.reportedAt) || 0, at) };
  }
  feed = { ...base, bosses: mergeOwn(bosses) };
  updatePins(Date.now());
  if (typeof render === "function") render();
});

// The open widgets, by widget name: the timer each shows and its height.
const openPins = new Map();
let pinsBusy = false;

// Every second: open the icons that should show, close the rest, and send
// each its countdown.
async function updatePins(now) {
  if (pinsBusy) return;
  // A world boss just started to matter: read the feed now, not at its next
  // scheduled read.
  const live = pinnedBossLive(now);
  followLive(now);
  // Pushed live: the feed only as a fallback, every 30 s.
  const every = liveUp ? 30_000 : live === "up" ? FEED_PINNED_UP_MS : FEED_PINNED_MS;
  if (live && typeof readFeed === "function" && (!feed || !feed.at || now - feed.at >= every)) readFeed();
  if (!canPin()) return;
  pinsBusy = true;
  try {
    const p = pinUi();
    const words = ui();
    let wanted = new Map();
    for (const [id, pin] of Object.entries(iconPins())) {
      const state = pinState(id, now);
      if (!state) continue;
      const until = state.start != null ? state.start - now : null;
      const reminds = pin.lead >= 0;
      // Being fought, and its alert asks for that.
      const fight = pin.fought && state.fought;
      // It appears when its alert reminds (or stays on screen), while the
      // event is on or the boss up, and when the boss is being fought. With
      // "Don't remind", only then (and its kill, if it showed).
      const visible = pin.always || fight
        || (state.killed && (reminds || openPins.has(widgetName(id))))
        || (reminds && (state.running || (until != null && until <= pin.lead * 60_000 + 1000)))
        || (typeof trainVisible === "function" && trainVisible(pin, state, until));
      if (!visible) continue;
      // Due: from its alert's time (or the last minute), and for a minute
      // after it starts; an event that can be entered, while it can be; a
      // boss for a minute after it is first seen fought.
      const due = (reminds && until != null && until <= Math.max(1, pin.lead) * 60_000 && until > -DUE_AFTER_MS)
        || (reminds && state.running && (state.entry || (state.start != null && now - state.start < DUE_AFTER_MS)))
        || (fight && now - (foughtAt.get(id) ?? now) < DUE_AFTER_MS);
      // An event that lasts a while (the rift's 10 minutes, an entrance's 3):
      // the time it has left, and under it "Enter" or "Open".
      const lasts = state.running && state.end != null && state.end > now && state.kind !== "field";
      const countdown = state.killed ? p.killed
        : fight ? p.fighting
        : state.running
          ? (lasts ? span(state.end - now) : state.kind !== "event" ? words.up : p.now)
          : until != null ? span(until) : "–";
      const sub = state.killed ? "" : state.running && state.entry ? enterWord() : lasts ? p.open
        : state.hp != null ? `${Math.round(state.hp)}%` : "";
      wanted.set(widgetName(id), {
        id,
        // For anchor mode's Sort by (anchor.js).
        order: { id, fight: !!fight, running: !!state.running && !state.killed, hp: state.hp ?? null, until, killed: !!state.killed },
        // The icon's tooltip: its name, and a boss's nearest teleport.
        data: { name: state.name, tip: teleportTip(id) && [state.name, teleportTip(id)].join("\n"),
          showName: !!pin.name, tp: pin.tp ? teleportBadge(id) : "", opacity: pinOpacity(), countdown, sub, hp: state.killed ? 0 : state.hp ?? null,
          running: state.running, due: due && !state.killed, effect: pin.effect, kind: state.kind, icon: pinIcon(id, state.kind),
          copy: pinLine(id, state, now, fight),
          abyss: id.startsWith("field:") && isAbyssBoss(FIELD_BOSSES[id.slice(6)] || {}) },
      });
    }
    // Anchor mode: in its order, with what doesn't fit folded into "+N",
    // all in the anchor's frame: no icon windows of their own (anchor.js).
    if (typeof anchorPlan === "function") wanted = anchorPlan(wanted);
    if (typeof anchorShow === "function" && await anchorShow(wanted)) wanted = new Map();
    for (const name of [...openPins.keys()]) {
      if (!wanted.has(name)) {
        openPins.delete(name);
        await a2.widgets.close(name).catch(() => {});
      }
    }
    for (const [name, { id, data }] of wanted) {
      // Opened, or opened again at its new size (its name turned on or off).
      const size = pinSize(data.showName);
      if (openPins.get(name)?.height !== size.height) {
        const ok = await a2.widgets.open(name, size).then(() => true, () => false);
        if (!ok) continue;
        openPins.set(name, { id, height: size.height });
      }
      a2.widgets.send(name, data).catch(() => {});
    }
  } finally {
    pinsBusy = false;
  }
}

// A double-click on an unlocked icon opens this window.
a2.on("widget-message", (msg) => {
  // A right-click on an icon: its sound stops.
  if (msg?.data?.mute) {
    stopSound();
    stopSounds();
    return;
  }
  if (msg?.data?.open && typeof windowApi === "function" && windowApi()) {
    showFull();
    windowApi().show().catch(() => {});
  }
});

// Settings, under Alerts: how alerts show, the icons' defaults, and the lock.
// The window-only option ("keep this window hidden until an alert") shows
// only for alerts shown in this window.
function renderPinLock() {
  const view = document.querySelector(".view.settings");
  if (!view) return;
  const p = pinUi();
  let box = view.querySelector(".iconSettings");
  if (!box) {
    box = document.createElement("div");
    box.className = "iconSettings";
    const row = (cls, control) => {
      const r = document.createElement("label");
      r.className = `setting ${cls}`;
      const s = document.createElement("span");
      s.className = "iconSettingLabel";
      r.append(s, control);
      return r;
    };
    const switchBox = (cls) => {
      const c = document.createElement("input");
      c.type = "checkbox";
      c.className = `${cls} switch`;
      c.setAttribute("role", "switch");
      return c;
    };
    const style = document.createElement("select");
    style.className = "alertStyle";
    const keep = switchBox("iconKeep");
    const effect = document.createElement("select");
    effect.className = "iconEffect";
    const name = switchBox("iconName");
    const tp = switchBox("iconTp");
    const opacity = document.createElement("select");
    opacity.className = "iconOpacity";
    const lock = switchBox("pinLock");
    const note = document.createElement("p");
    note.className = "note pinLockNote";
    box.append(row("styleRow", style), row("keepRow", keep), row("effectRow", effect), row("nameRow", name), row("tpRow", tp), row("opacityRow", opacity), row("lockRow", lock), note);
    // First under the Alerts heading.
    // First in Settings, under its own "On screen" heading (anchor.js),
    // ahead of the Alerts heading.
    const heading = view.querySelector(".alertDefaults");
    if (heading) heading.before(box);
    else view.prepend(box);
    style.addEventListener("change", () => {
      prefs.alertStyle = style.value;
      savePrefs();
      renderStatic();
      updatePins(Date.now());
    });
    keep.addEventListener("change", () => {
      prefs.iconAlways = keep.checked;
      savePrefs();
      updatePins(Date.now());
    });
    effect.addEventListener("change", () => {
      prefs.iconEffect = effect.value;
      savePrefs();
      updatePins(Date.now());
    });
    name.addEventListener("change", () => {
      prefs.iconName = name.checked;
      savePrefs();
      updatePins(Date.now());
    });
    tp.addEventListener("change", () => {
      prefs.iconTp = tp.checked;
      savePrefs();
      updatePins(Date.now());
    });
    opacity.addEventListener("change", () => {
      prefs.iconOpacity = Number(opacity.value);
      savePrefs();
      updatePins(Date.now());
    });
    lock.addEventListener("change", () => {
      a2.widgets.lock(lock.checked).catch(() => {});
    });
    if (canPin()) a2.widgets.locked().then((locked) => { lock.checked = !!locked; }).catch(() => {});
  }
  const label = (cls, text) => { box.querySelector(`.${cls} .iconSettingLabel`).textContent = text; };
  label("styleRow", p.style);
  label("keepRow", p.keepAll);
  label("effectRow", p.effect);
  label("nameRow", p.name);
  label("tpRow", p.tp);
  label("opacityRow", p.opacity);
  label("lockRow", p.lock);
  const style = box.querySelector(".alertStyle");
  style.replaceChildren(option("icons", p.icons), option("window", p.window));
  style.value = iconStyle() ? "icons" : "window";
  style.disabled = !canPin();
  box.querySelector(".iconKeep").checked = !!prefs.iconAlways;
  const effect = box.querySelector(".iconEffect");
  effect.replaceChildren(...PIN_EFFECTS.map((e) => option(e, p[e])));
  effect.value = prefs.iconEffect ?? "shake";
  box.querySelector(".iconName").checked = prefs.iconName ?? true;
  box.querySelector(".iconTp").checked = !!prefs.iconTp;
  const opacity = box.querySelector(".iconOpacity");
  opacity.replaceChildren(...PIN_OPACITIES.map((v) => option(String(v), `${v}%`)));
  opacity.value = String(Math.round(pinOpacity() * 100));
  for (const cls of ["keepRow", "effectRow", "nameRow", "tpRow", "opacityRow", "lockRow"]) box.querySelector(`.${cls}`).hidden = !iconStyle();
  const note = box.querySelector(".pinLockNote");
  note.textContent = canPin() ? p.lockNote : p.needsMeter;
  note.hidden = canPin() && !iconStyle();
  // The banner's colour: only for alerts shown in this window. Hiding the
  // window when idle applies in both styles (it was hidden with icons, and
  // a window set to hide could then not be kept open), worded for each:
  // with icons, an alert doesn't bring the window back.
  const colorRow = view.querySelector(".colorRow");
  if (colorRow) colorRow.hidden = iconStyle();
  const popRow = view.querySelector(".popRow:not(.alsoAtStartRow)");
  if (popRow) popRow.hidden = false;
  const popLabel = view.querySelector(".popLabel");
  if (popLabel) popLabel.textContent = iconStyle() ? p.hideIdle : aui().pop;
  const popNote = view.querySelector(".popNote");
  if (popNote) {
    popNote.textContent = iconStyle() ? p.hideIdleNote : ui().popNote;
    popNote.hidden = !prefs.pop;
  }
  if (typeof renderAnchorSettings === "function") renderAnchorSettings(box);
}

// Test Alert, with alerts as icons: a sample icon for 10 seconds, due, with
// the default sound.
let testTimer = 0;
function testIcon() {
  const ev = scheduled("event").find((e) => e.id.startsWith("festival")) || scheduled("event")[0];
  const name = ev ? text(ev.name) : "Shugo Festival";
  const show = prefs.iconName ?? true;
  const data = { name, showName: show, tp: prefs.iconTp ? "3" : "", opacity: pinOpacity(), countdown: span(5 * 60_000), sub: "", hp: null, running: false, due: true,
    effect: prefs.iconEffect ?? "shake", kind: "event", icon: ev ? pinIcon(ev.id, "event") : "shugo" };
  a2.widgets.open("test", pinSize(show)).then(() => a2.widgets.send("test", data)).catch(() => {});
  soundAlert(null);
  clearTimeout(testTimer);
  testTimer = setTimeout(() => a2.widgets.close("test").catch(() => {}), 10_000);
}

// plugin.js may have drawn its tabs before this file loaded: draw them again
// with the alerts' options and the icons' settings.
setTimeout(() => {
  if (typeof renderStatic === "function") renderStatic();
}, 0);
