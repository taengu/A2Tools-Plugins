// Event Timers: countdowns to the recurring events, the scheduled bosses and
// the world bosses, in the player's server time, with alerts before the ones
// they choose.
//
// The schedules are the game's own (schedule.js), in server time: each Global
// region's servers keep their own clock (NA East is New York time, and so on),
// and the region comes from the server's number (its second digit), told by
// the meter with the character and remembered for when the game is closed.
// Resets are one moment on every Global server: 07:00 UTC.
//
// World bosses respawn a while after each kill: their timers come from what
// players' meters read off the in-game map, shared through a2tools.app
// (a2.bossTimers, meter 2.0.65 on), fetched when the window opens and every
// 15 minutes; a map the player opens themselves comes straight from their
// meter (a2.on("bossMap")), and for each boss the newest word stands.
//
// Alerts: each event or boss can sound an alert a set time before it starts,
// once per showing, and another lead while AION2 is closed (to leave time to
// start it and log in). The sound repeats as often as chosen, until muted from
// the alert's banner.

const $ = (selector) => document.querySelector(selector);
const els = {
  status: $(".status"),
  resets: $(".resets"),
  banner: $(".banner"),
  bannerText: $(".bannerText"),
  alertBox: $(".alertBox"),
  openFull: $(".openFull"),
  mute: $(".mute"),
  dismiss: $(".dismiss"),
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    events: $(".view.events"),
    bosses: $(".view.bosses"),
    alerts: $(".view.alerts"),
    settings: $(".view.settings"),
  },
  events: $(".eventList"),
  eventsHead: $(".eventsHead"),
  hidden: $(".hidden"),
  scheduledHead: $(".scheduledHead"),
  scheduled: $(".scheduledList"),
  fieldHead: $(".fieldHead"),
  fieldNote: $(".fieldNote"),
  field: $(".fieldList"),
  fieldCredit: $(".fieldCredit"),
  soundLabel: $(".soundLabel"),
  sound: $(".sound"),
  testAlert: $(".testAlert"),
  alertOptionsBtn: $(".alertOptionsBtn"),
  alertSettings: $(".alertSettings"),
  repeatLabel: $(".repeatLabel"),
  volumeLabel: $(".volumeLabel"),
  volume: $(".volume"),
  repeat: $(".repeat"),
  speak: $(".speak"),
  speakLabel: $(".speakLabel"),
  voiceTypeLabel: $(".voiceTypeLabel"),
  voiceType: $(".voiceType"),
  voicePickLabel: $(".voicePickLabel"),
  voiceName: $(".voiceName"),
  voiceRateLabel: $(".voiceRateLabel"),
  voiceRate: $(".voiceRate"),
  testVoice: $(".testVoice"),
  voiceNote: $(".voiceNote"),
  voiceRows: [...document.querySelectorAll(".voiceRow")],
  pop: $(".pop"),
  popLabel: $(".popLabel"),
  alsoAtStart: $(".alsoAtStart"),
  alsoAtStartLabel: $(".alsoAtStartLabel"),
  popNote: $(".popNote"),
  alertList: $(".alertList"),
  regionLabel: $(".regionLabel"),
  regionSelect: $(".regionSelect"),
  zoneLabel: $(".zoneLabel"),
  zoneSelect: $(".zoneSelect"),
  scaleLabel: $(".scaleLabel"),
  colorLabel: $(".colorLabel"),
  colorSelect: $(".colorSelect"),
  scaleSelect: $(".scaleSelect"),
  defaultLeadLabel: $(".defaultLeadLabel"),
  defaultLead: $(".defaultLead"),
  defaultClosedLabel: $(".defaultClosedLabel"),
  defaultClosed: $(".defaultClosed"),
  defaultsNote: $(".defaultsNote"),
  applyAll: $(".applyAll"),
  modal: $(".modal"),
  modalText: $(".modalText"),
  modalYes: $(".modalYes"),
  modalNo: $(".modalNo"),
};

// How long before an event its alert goes off, in minutes (0 = as it starts).
const LEADS = [0, 1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60];
const DEFAULT_LEAD = 5;
// While the game is closed an alert can come earlier, to leave time to start
// it and log in: by default a quarter of an hour.
const DEFAULT_CLOSED_LEAD = 15;
// How many times an alert's sound plays; 0 = until muted (for at most
// UNTIL_MUTED_MS).
const REPEATS = [1, 2, 3, 5, 10, 0];
const UNTIL_MUTED_MS = 5 * 60_000;
// The alert sounds, in the order the list shows them (sounds.js).
const SOUND_ORDER = ["chime", "bell", "sparkle", "ping", "soft", "gong", "horn", "harp", "alarm", "crystal", "marimba", "kalimba", "epiano", "sonar", "fanfare", "warhorn", "taiko"];
// With "keep this window hidden until an alert goes off": hidden once the
// window has gone this long without use (and no alert is up), so whoever is
// working in it, in Settings say, keeps it. An alert's banner clears itself
// after BANNER_MS.
const IDLE_HIDE_MS = 30_000;
const BANNER_MS = 2 * 60_000;
// An event or boss this close to starting or returning is marked "soon".
const SOON_MS = 15 * 60_000;
// The alert banner's colour: a few to pick from, orange unless chosen.
const ALERT_COLORS = {
  orange: "#ff9a3c", gold: "#f2c14e", red: "#ff6464", pink: "#ff7ac2",
  purple: "#b48cff", blue: "#8fc2ff", green: "#6fdc9a",
};
// Text size: the whole page scaled, spacing and controls with the text.
// 100% is BASE_ZOOM, a little larger than the stylesheet's own sizes.
const SCALES = [0.9, 1, 1.1, 1.25, 1.5];
const BASE_ZOOM = 1.2;
// The feed of world boss timers: read this often, or every FEED_BUSY_MS
// while a world boss on the server is up, due within 15 minutes or overdue,
// when its state changes fast (the feed's file is rewritten at once on a kill
// or an HP report).
const FEED_EVERY_MS = 15 * 60_000;
const FEED_BUSY_MS = 2 * 60_000;
// While a pinned world boss is up (pins.js): its HP as it falls and its kill,
// about as often as the feed's file changes on the CDN; while one is about to
// spawn or overdue, often enough to see it come up.
const FEED_PINNED_UP_MS = 5_000;
const FEED_PINNED_MS = 10_000;
// An overdue boss counts as "in its window" this long after its time.
const WINDOW_MS = 2 * 3600_000;
// "All world bosses" in the alert list.
const ALL_FIELD = "field:*";
// The time zone this computer is set to, for showing times.
const SYSTEM_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();
const ALL_ZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
})();

// Each Global region's server clock, by the second digit of a server's number.
const REGIONS = {
  1: "America/New_York",
  2: "America/Los_Angeles",
  3: "Europe/Berlin",
  4: "America/Sao_Paulo",
  5: "Asia/Seoul",
};

// The plugin's own words, in each of the meter's languages.
const UI = {
  en: { serverTime: "Server time", auto: "From your character", regions: ["NA East", "NA West", "Europe", "South America", "Asia"],
        pick: "Log in to a character, or pick your region.", unsupported: "Korean and Taiwanese servers aren't covered yet: pick a region to use its times.",
        now: "now", left: (t) => `${t} left`, in: (t) => `in ${t}`, hide: "Hide", hidden: "Hidden:", elyos: "Elyos", asmodian: "Asmodian" },
  ko: { serverTime: "서버 시간", auto: "캐릭터 기준", regions: ["북미 동부", "북미 서부", "유럽", "남미", "아시아"],
        pick: "캐릭터로 접속하거나 지역을 선택하세요.", unsupported: "한국·대만 서버는 아직 지원하지 않습니다. 지역을 선택하면 해당 시간으로 표시합니다.",
        now: "진행 중", left: (t) => `${t} 남음`, in: (t) => `${t} 후`, hide: "숨기기", hidden: "숨김:", elyos: "천족", asmodian: "마족" },
  ja: { serverTime: "サーバー時間", auto: "キャラクターから", regions: ["北米東部", "北米西部", "ヨーロッパ", "南米", "アジア"],
        pick: "キャラクターでログインするか、地域を選んでください。", unsupported: "韓国・台湾サーバーにはまだ対応していません。地域を選ぶとその時間で表示します。",
        now: "開催中", left: (t) => `残り ${t}`, in: (t) => `${t} 後`, hide: "非表示", hidden: "非表示:", elyos: "天族", asmodian: "魔族" },
  de: { serverTime: "Serverzeit", auto: "Vom Charakter", regions: ["NA Ost", "NA West", "Europa", "Südamerika", "Asien"],
        pick: "Mit einem Charakter einloggen oder Region wählen.", unsupported: "Koreanische und taiwanische Server werden noch nicht unterstützt: Region wählen, um deren Zeiten zu nutzen.",
        now: "jetzt", left: (t) => `noch ${t}`, in: (t) => `in ${t}`, hide: "Ausblenden", hidden: "Ausgeblendet:", elyos: "Elyos", asmodian: "Asmodier" },
  fr: { serverTime: "Heure du serveur", auto: "D'après le personnage", regions: ["NA Est", "NA Ouest", "Europe", "Amérique du Sud", "Asie"],
        pick: "Connectez-vous avec un personnage ou choisissez votre région.", unsupported: "Les serveurs coréens et taïwanais ne sont pas encore pris en charge : choisissez une région pour ses horaires.",
        now: "en cours", left: (t) => `encore ${t}`, in: (t) => `dans ${t}`, hide: "Masquer", hidden: "Masqués :", elyos: "Elyséens", asmodian: "Asmodiens" },
  es: { serverTime: "Hora del servidor", auto: "Según tu personaje", regions: ["NA Este", "NA Oeste", "Europa", "Sudamérica", "Asia"],
        pick: "Entra con un personaje o elige tu región.", unsupported: "Los servidores de Corea y Taiwán aún no están cubiertos: elige una región para usar sus horas.",
        now: "ahora", left: (t) => `quedan ${t}`, in: (t) => `en ${t}`, hide: "Ocultar", hidden: "Ocultos:", elyos: "Elios", asmodian: "Asmodianos" },
  pt: { serverTime: "Hora do servidor", auto: "Pelo personagem", regions: ["NA Leste", "NA Oeste", "Europa", "América do Sul", "Ásia"],
        pick: "Entre com um personagem ou escolha sua região.", unsupported: "Servidores da Coreia e de Taiwan ainda não são cobertos: escolha uma região para usar os horários dela.",
        now: "agora", left: (t) => `faltam ${t}`, in: (t) => `em ${t}`, hide: "Ocultar", hidden: "Ocultos:", elyos: "Elyos", asmodian: "Asmodianos" },
  ru: { serverTime: "Время сервера", auto: "По персонажу", regions: ["СА Восток", "СА Запад", "Европа", "Южная Америка", "Азия"],
        pick: "Войдите персонажем или выберите регион.", unsupported: "Корейские и тайваньские серверы пока не поддерживаются: выберите регион, чтобы видеть его время.",
        now: "идёт", left: (t) => `осталось ${t}`, in: (t) => `через ${t}`, hide: "Скрыть", hidden: "Скрыто:", elyos: "Элийцы", asmodian: "Асмодиане" },
  "zh-Hant": { serverTime: "伺服器時間", auto: "依角色", regions: ["北美東部", "北美西部", "歐洲", "南美", "亞洲"],
        pick: "請登入角色，或選擇地區。", unsupported: "尚未支援韓國與台灣伺服器：選擇地區即可使用其時間。",
        now: "進行中", left: (t) => `剩餘 ${t}`, in: (t) => `${t} 後`, hide: "隱藏", hidden: "已隱藏：", elyos: "天族", asmodian: "魔族" },
  "zh-Hans": { serverTime: "服务器时间", auto: "依角色", regions: ["北美东部", "北美西部", "欧洲", "南美", "亚洲"],
        pick: "请登录角色，或选择地区。", unsupported: "尚未支持韩国与台湾服务器：选择地区即可使用其时间。",
        now: "进行中", left: (t) => `剩余 ${t}`, in: (t) => `${t} 后`, hide: "隐藏", hidden: "已隐藏：", elyos: "天族", asmodian: "魔族" },
};

// "Enter", as the game labels a field event's entrance while it is open.
const ENTER = { en: "Enter", ko: "입장", ja: "入場", de: "Betreten", fr: "Entrer", es: "Entrar", pt: "Entrar", ru: "Вход",
  "zh-Hant": "進入", "zh-Hans": "进入" };
const enterWord = () => ENTER[language] || ENTER.en;

// The alerts' words, in each of the meter's languages.
const ALERT_UI = {
  en: { closed: "If AION2 is closed", settings: "Settings", server: "Server", showIn: "Show times in", systemTime: (z) => `This computer's time (${z})`, serverTime: "Server time", enable: "Alert",
        timers: "Timers", alerts: "Alerts", sound: "Sound", play: "Play", none: "None", pop: "Hide window until an alert", alsoAtStart: "Also alert as it starts",
        off: "Off", atStart: "As it starts", before: (n) => `${n} min before`, soon: (name, n) => `${name} in ${n} min`, now: (name) => `${name} is starting`,
        sounds: { chime: "Chime", bell: "Bell", sparkle: "Sparkle", ping: "Ping", soft: "Soft", gong: "Gong", horn: "Horn", harp: "Harp", alarm: "Alarm", crystal: "Crystal", marimba: "Marimba", kalimba: "Kalimba", epiano: "Electric piano", sonar: "Sonar", fanfare: "Fanfare", warhorn: "War horn", taiko: "Taiko drums" } },
  ko: { closed: "AION2가 꺼져 있으면", settings: "설정", server: "서버", showIn: "시간 표시", systemTime: (z) => `이 컴퓨터 시간 (${z})`, serverTime: "서버 시간", enable: "알림",
        timers: "타이머", alerts: "알림", sound: "소리", play: "재생", none: "없음", pop: "알림이 울릴 때까지 이 창 숨기기", alsoAtStart: "시작할 때도 알림",
        off: "끔", atStart: "시작할 때", before: (n) => `${n}분 전`, soon: (name, n) => `${name} ${n}분 전`, now: (name) => `${name} 시작`,
        sounds: { chime: "차임", bell: "종", sparkle: "반짝임", ping: "핑", soft: "부드러움", gong: "징", horn: "뿔피리", harp: "하프", alarm: "경보", crystal: "크리스털", marimba: "마림바", kalimba: "칼림바", epiano: "일렉트릭 피아노", sonar: "소나", fanfare: "팡파르", warhorn: "전투 뿔피리", taiko: "태고 북" } },
  ja: { closed: "AION2を閉じている場合", settings: "設定", server: "サーバー", showIn: "時刻の表示", systemTime: (z) => `このPCの時刻（${z}）`, serverTime: "サーバー時間", enable: "通知",
        timers: "タイマー", alerts: "通知", sound: "サウンド", play: "再生", none: "なし", pop: "通知が鳴るまでこのウィンドウを隠す", alsoAtStart: "開始時にも通知",
        off: "オフ", atStart: "開始時", before: (n) => `${n}分前`, soon: (name, n) => `${name}まであと${n}分`, now: (name) => `${name}開始`,
        sounds: { chime: "チャイム", bell: "ベル", sparkle: "きらめき", ping: "ピン", soft: "ソフト", gong: "銅鑼", horn: "ホルン", harp: "ハープ", alarm: "アラーム", crystal: "クリスタル", marimba: "マリンバ", kalimba: "カリンバ", epiano: "エレピ", sonar: "ソナー", fanfare: "ファンファーレ", warhorn: "戦の角笛", taiko: "和太鼓" } },
  de: { closed: "Wenn AION2 geschlossen ist", settings: "Einstellungen", server: "Server", showIn: "Zeiten zeigen in", systemTime: (z) => `Zeit dieses Computers (${z})`, serverTime: "Serverzeit", enable: "Alarm",
        timers: "Timer", alerts: "Alarme", sound: "Ton", play: "Abspielen", none: "Keiner", pop: "Dieses Fenster bis zu einem Alarm verbergen", alsoAtStart: "Auch zum Start alarmieren",
        off: "Aus", atStart: "Zum Start", before: (n) => `${n} Min. vorher`, soon: (name, n) => `${name} in ${n} Min.`, now: (name) => `${name} beginnt`,
        sounds: { chime: "Glockenspiel", bell: "Glocke", sparkle: "Funkeln", ping: "Ping", soft: "Sanft", gong: "Gong", horn: "Horn", harp: "Harfe", alarm: "Alarm", crystal: "Kristall", marimba: "Marimba", kalimba: "Kalimba", epiano: "E-Piano", sonar: "Sonar", fanfare: "Fanfare", warhorn: "Kriegshorn", taiko: "Taiko-Trommeln" } },
  fr: { closed: "Si AION2 est fermé", settings: "Réglages", server: "Serveur", showIn: "Afficher les heures en", systemTime: (z) => `Heure de cet ordinateur (${z})`, serverTime: "Heure du serveur", enable: "Alerte",
        timers: "Minuteurs", alerts: "Alertes", sound: "Son", play: "Écouter", none: "Aucun", pop: "Masquer cette fenêtre jusqu'à une alerte", alsoAtStart: "Alerter aussi au début",
        off: "Désactivée", atStart: "Au début", before: (n) => `${n} min avant`, soon: (name, n) => `${name} dans ${n} min`, now: (name) => `${name} commence`,
        sounds: { chime: "Carillon", bell: "Cloche", sparkle: "Scintillement", ping: "Ping", soft: "Doux", gong: "Gong", horn: "Cor", harp: "Harpe", alarm: "Alarme", crystal: "Cristal", marimba: "Marimba", kalimba: "Kalimba", epiano: "Piano électrique", sonar: "Sonar", fanfare: "Fanfare", warhorn: "Cor de guerre", taiko: "Tambours taiko" } },
  es: { closed: "Si AION2 está cerrado", settings: "Ajustes", server: "Servidor", showIn: "Mostrar horas en", systemTime: (z) => `Hora de este equipo (${z})`, serverTime: "Hora del servidor", enable: "Alerta",
        timers: "Temporizadores", alerts: "Alertas", sound: "Sonido", play: "Reproducir", none: "Ninguno", pop: "Ocultar esta ventana hasta que suene una alerta", alsoAtStart: "Avisar también al empezar",
        off: "Desactivada", atStart: "Al empezar", before: (n) => `${n} min antes`, soon: (name, n) => `${name} en ${n} min`, now: (name) => `Empieza ${name}`,
        sounds: { chime: "Campanilla", bell: "Campana", sparkle: "Destello", ping: "Ping", soft: "Suave", gong: "Gong", horn: "Cuerno", harp: "Arpa", alarm: "Alarma", crystal: "Cristal", marimba: "Marimba", kalimba: "Kalimba", epiano: "Piano eléctrico", sonar: "Sonar", fanfare: "Fanfarria", warhorn: "Cuerno de guerra", taiko: "Tambores taiko" } },
  pt: { closed: "Se o AION2 estiver fechado", settings: "Configurações", server: "Servidor", showIn: "Mostrar horários em", systemTime: (z) => `Hora deste computador (${z})`, serverTime: "Hora do servidor", enable: "Alerta",
        timers: "Timers", alerts: "Alertas", sound: "Som", play: "Tocar", none: "Nenhum", pop: "Ocultar esta janela até um alerta tocar", alsoAtStart: "Alertar também ao começar",
        off: "Desligado", atStart: "Ao começar", before: (n) => `${n} min antes`, soon: (name, n) => `${name} em ${n} min`, now: (name) => `${name} está começando`,
        sounds: { chime: "Carrilhão", bell: "Sino", sparkle: "Brilho", ping: "Ping", soft: "Suave", gong: "Gongo", horn: "Trompa", harp: "Harpa", alarm: "Alarme", crystal: "Cristal", marimba: "Marimba", kalimba: "Kalimba", epiano: "Piano elétrico", sonar: "Sonar", fanfare: "Fanfarra", warhorn: "Trompa de guerra", taiko: "Tambores taiko" } },
  ru: { closed: "Если AION2 закрыт", settings: "Настройки", server: "Сервер", showIn: "Показывать время", systemTime: (z) => `Время этого компьютера (${z})`, serverTime: "Время сервера", enable: "Оповещать",
        timers: "Таймеры", alerts: "Оповещения", sound: "Звук", play: "Прослушать", none: "Нет", pop: "Скрывать это окно до оповещения", alsoAtStart: "Оповещать и при начале",
        off: "Выкл.", atStart: "При начале", before: (n) => `за ${n} мин`, soon: (name, n) => `${name} через ${n} мин`, now: (name) => `${name} начинается`,
        sounds: { chime: "Перезвон", bell: "Колокол", sparkle: "Искры", ping: "Пинг", soft: "Мягкий", gong: "Гонг", horn: "Рог", harp: "Арфа", alarm: "Тревога", crystal: "Кристалл", marimba: "Маримба", kalimba: "Калимба", epiano: "Электропиано", sonar: "Сонар", fanfare: "Фанфары", warhorn: "Боевой рог", taiko: "Барабаны тайко" } },
  "zh-Hant": { closed: "若 AION2 未開啟", settings: "設定", server: "伺服器", showIn: "時間顯示", systemTime: (z) => `本機時間（${z}）`, serverTime: "伺服器時間", enable: "提醒",
        timers: "計時器", alerts: "提醒", sound: "音效", play: "播放", none: "無", pop: "在提醒前隱藏此視窗", alsoAtStart: "開始時也提醒",
        off: "關閉", atStart: "開始時", before: (n) => `${n} 分鐘前`, soon: (name, n) => `${name} ${n} 分鐘後開始`, now: (name) => `${name} 開始`,
        sounds: { chime: "鐘聲", bell: "鈴聲", sparkle: "閃爍", ping: "叮", soft: "柔和", gong: "銅鑼", horn: "號角", harp: "豎琴", alarm: "警報", crystal: "水晶", marimba: "馬林巴", kalimba: "卡林巴", epiano: "電鋼琴", sonar: "聲納", fanfare: "凱旋號角", warhorn: "戰爭號角", taiko: "太鼓" } },
  "zh-Hans": { closed: "若 AION2 未开启", settings: "设置", server: "服务器", showIn: "时间显示", systemTime: (z) => `本机时间（${z}）`, serverTime: "服务器时间", enable: "提醒",
        timers: "计时器", alerts: "提醒", sound: "音效", play: "播放", none: "无", pop: "在提醒前隐藏此窗口", alsoAtStart: "开始时也提醒",
        off: "关闭", atStart: "开始时", before: (n) => `${n} 分钟前`, soon: (name, n) => `${name} ${n} 分钟后开始`, now: (name) => `${name} 开始`,
        sounds: { chime: "钟声", bell: "铃声", sparkle: "闪烁", ping: "叮", soft: "柔和", gong: "铜锣", horn: "号角", harp: "竖琴", alarm: "警报", crystal: "水晶", marimba: "马林巴", kalimba: "卡林巴", epiano: "电钢琴", sonar: "声呐", fanfare: "凯旋号角", warhorn: "战争号角", taiko: "太鼓" } },
};

// The words added with the tabs, the world bosses and repeating alerts.
const MORE_UI = {
  en: { groupUp: "Up", groupWindow: "In window", groupUpcoming: "Upcoming", groupUnknown: "No report yet", ago: (t) => `${t} ago`, hpLeft: (n) => `HP ${n}%`,
        openFull: "Open Event Timers", alertOptions: "Options", testAlert: "Test alert", alertColor: "Alert colour", colors: {"orange": "Orange", "gold": "Gold", "red": "Red", "pink": "Pink", "purple": "Purple", "blue": "Blue", "green": "Green"},
        whileOpen: "Remind me", allOn: "All on", allOff: "All off", defaultLead: "When to alert", defaultClosed: "When to alert (AION2 closed)", applyAll: "Apply to current alerts", applyAsk: (n, lead, closed) => `Set the ${n} alerts that are on to ${lead}, and ${closed} while AION2 is closed?`, apply: "Apply", cancel: "Cancel", defaultsNote: "Default times for new alerts",
        textSize: "Text size", popNote: "Hides after 30 s unused and comes back when an alert goes off. To open it sooner: Settings → Plugins → Open.", events: "Events", bosses: "Bosses", region: "Region", daily: "Daily reset", weekly: "Weekly reset",
        scheduled: "Abyss bosses", field: "World bosses", fieldNote: "Shared by players' meters as they open their map.",
        noFeed: "World boss timers need meter 2.0.65 or later.", feedFailed: "Couldn't read the world boss timers.",
        noServer: "Log in to a character to see your server's world bosses.", up: "Up", upFor: (t) => `for ${t}`,
        due: "Due", unknown: "No report yet", seen: (t) => `reported ${t} ago`, allField: "All world bosses",
        repeat: "Repeat", volume: "Volume", once: "Once", times: (n) => `${n} times`, untilMuted: "Until muted", mute: "Mute", dismiss: "Dismiss",
        bossSoon: (name, n) => `${name} back in ${n} min`, bossNow: (name) => `${name} is back` },
  ko: { groupUp: "출현 중", groupWindow: "출현 시간 지남", groupUpcoming: "예정", groupUnknown: "아직 정보 없음", ago: (t) => `${t} 전`, hpLeft: (n) => `HP ${n}%`,
        openFull: "Event Timers 열기", alertOptions: "구성", testAlert: "알림 테스트", alertColor: "알림 색상", colors: {"orange": "주황", "gold": "금색", "red": "빨강", "pink": "분홍", "purple": "보라", "blue": "파랑", "green": "초록"},
        whileOpen: "알림 시간", allOn: "모두 켜기", allOff: "모두 끄기", defaultLead: "알림 시간", defaultClosed: "AION2가 꺼져 있을 때 알림 시간", applyAll: "현재 알림에 적용", applyAsk: (n, lead, closed) => `켜져 있는 알림 ${n}개를 ${lead}, AION2가 꺼져 있을 때는 ${closed}(으)로 바꿀까요?`, apply: "적용", cancel: "취소", defaultsNote: "새 알림의 기본 시간",
        textSize: "글자 크기", popNote: "30초 동안 사용하지 않으면 창이 숨겨지고, 알림이 울리면 다시 나타납니다. 그 전에 열려면: 설정 → 플러그인 → 열기.", events: "이벤트", bosses: "보스", region: "지역", daily: "일일 초기화", weekly: "주간 초기화",
        scheduled: "어비스 보스", field: "월드 보스", fieldNote: "플레이어들이 지도를 열 때 미터가 공유한 정보입니다.",
        noFeed: "월드 보스 타이머는 미터 2.0.65 이상이 필요합니다.", feedFailed: "월드 보스 타이머를 읽지 못했습니다.",
        noServer: "캐릭터로 접속하면 서버의 월드 보스가 표시됩니다.", up: "출현", upFor: (t) => `${t}째`,
        due: "곧 출현", unknown: "아직 정보 없음", seen: (t) => `${t} 전 보고`, allField: "모든 월드 보스",
        repeat: "반복", volume: "음량", once: "1회", times: (n) => `${n}회`, untilMuted: "끌 때까지", mute: "소리 끄기", dismiss: "닫기",
        bossSoon: (name, n) => `${name} ${n}분 후 출현`, bossNow: (name) => `${name} 출현` },
  ja: { groupUp: "出現中", groupWindow: "出現時刻経過", groupUpcoming: "予定", groupUnknown: "情報なし", ago: (t) => `${t}前`, hpLeft: (n) => `HP ${n}%`,
        openFull: "Event Timers を開く", alertOptions: "構成", testAlert: "通知をテスト", alertColor: "通知の色", colors: {"orange": "オレンジ", "gold": "ゴールド", "red": "赤", "pink": "ピンク", "purple": "紫", "blue": "青", "green": "緑"},
        whileOpen: "通知するタイミング", allOn: "すべてオン", allOff: "すべてオフ", defaultLead: "通知のタイミング", defaultClosed: "AION2を閉じているときの通知タイミング", applyAll: "現在の通知に適用", applyAsk: (n, lead, closed) => `オンの通知${n}件を${lead}、AION2を閉じているときは${closed}に変更しますか？`, apply: "適用", cancel: "キャンセル", defaultsNote: "新しい通知の既定のタイミング",
        textSize: "文字の大きさ", popNote: "30秒操作がないとウィンドウは隠れ、通知が鳴ると自動で再表示されます。それまでに開くには：設定 → プラグイン → 開く。", events: "イベント", bosses: "ボス", region: "地域", daily: "デイリーリセット", weekly: "ウィークリーリセット",
        scheduled: "アビスボス", field: "ワールドボス", fieldNote: "プレイヤーがマップを開いたときにメーターが共有した情報です。",
        noFeed: "ワールドボスのタイマーにはメーター 2.0.65 以降が必要です。", feedFailed: "ワールドボスのタイマーを読み込めませんでした。",
        noServer: "キャラクターでログインするとサーバーのワールドボスが表示されます。", up: "出現中", upFor: (t) => `${t}経過`,
        due: "まもなく", unknown: "情報なし", seen: (t) => `${t}前に報告`, allField: "すべてのワールドボス",
        repeat: "繰り返し", volume: "音量", once: "1回", times: (n) => `${n}回`, untilMuted: "ミュートするまで", mute: "ミュート", dismiss: "閉じる",
        bossSoon: (name, n) => `${name}まであと${n}分`, bossNow: (name) => `${name}出現` },
  de: { groupUp: "Da", groupWindow: "Im Zeitfenster", groupUpcoming: "Demnächst", groupUnknown: "Noch keine Meldung", ago: (t) => `vor ${t}`, hpLeft: (n) => `HP ${n} %`,
        openFull: "Event Timers öffnen", alertOptions: "Konfig", testAlert: "Testalarm", alertColor: "Alarmfarbe", colors: {"orange": "Orange", "gold": "Gold", "red": "Rot", "pink": "Pink", "purple": "Lila", "blue": "Blau", "green": "Grün"},
        whileOpen: "Erinnern", allOn: "Alle an", allOff: "Alle aus", defaultLead: "Alarmzeit", defaultClosed: "Alarmzeit, wenn AION2 geschlossen ist", applyAll: "Auf aktuelle Alarme anwenden", applyAsk: (n, lead, closed) => `Die ${n} aktiven Alarme auf ${lead} setzen, und auf ${closed}, wenn AION2 geschlossen ist?`, apply: "Anwenden", cancel: "Abbrechen", defaultsNote: "Standardzeiten für neue Alarme",
        textSize: "Textgröße", popNote: "Das Fenster verschwindet nach 30 Sekunden ohne Nutzung und kommt bei einem Alarm von selbst zurück. Um es vorher zu öffnen: Einstellungen → Plugins → Öffnen.", events: "Events", bosses: "Bosse", region: "Region", daily: "Täglicher Reset", weekly: "Wöchentlicher Reset",
        scheduled: "Abyss-Bosse", field: "Weltbosse", fieldNote: "Von den Metern der Spieler geteilt, wenn sie ihre Karte öffnen.",
        noFeed: "Weltboss-Timer brauchen Meter 2.0.65 oder neuer.", feedFailed: "Die Weltboss-Timer konnten nicht gelesen werden.",
        noServer: "Mit einem Charakter einloggen, um die Weltbosse deines Servers zu sehen.", up: "Da", upFor: (t) => `seit ${t}`,
        due: "Fällig", unknown: "Noch keine Meldung", seen: (t) => `vor ${t} gemeldet`, allField: "Alle Weltbosse",
        repeat: "Wiederholen", volume: "Lautstärke", once: "Einmal", times: (n) => `${n}-mal`, untilMuted: "Bis stumm", mute: "Stumm", dismiss: "Schließen",
        bossSoon: (name, n) => `${name} in ${n} Min. zurück`, bossNow: (name) => `${name} ist zurück` },
  fr: { groupUp: "Présents", groupWindow: "Dans la fenêtre", groupUpcoming: "À venir", groupUnknown: "Pas encore signalés", ago: (t) => `il y a ${t}`, hpLeft: (n) => `PV ${n} %`,
        openFull: "Ouvrir Event Timers", alertOptions: "Config", testAlert: "Tester l'alerte", alertColor: "Couleur des alertes", colors: {"orange": "Orange", "gold": "Or", "red": "Rouge", "pink": "Rose", "purple": "Violet", "blue": "Bleu", "green": "Vert"},
        whileOpen: "Me rappeler", allOn: "Tout activer", allOff: "Tout désactiver", defaultLead: "Moment de l'alerte", defaultClosed: "Moment de l'alerte quand AION2 est fermé", applyAll: "Appliquer aux alertes actuelles", applyAsk: (n, lead, closed) => `Régler les ${n} alertes actives sur ${lead}, et ${closed} quand AION2 est fermé ?`, apply: "Appliquer", cancel: "Annuler", defaultsNote: "Moments par défaut des nouvelles alertes",
        textSize: "Taille du texte", popNote: "La fenêtre se masque après 30 secondes sans utilisation et revient d'elle-même lors d'une alerte. Pour l'ouvrir avant : Réglages → Plugins → Ouvrir.", events: "Événements", bosses: "Boss", region: "Région", daily: "Réinitialisation quotidienne", weekly: "Réinitialisation hebdomadaire",
        scheduled: "Boss des Abysses", field: "Boss mondiaux", fieldNote: "Partagés par les meters des joueurs quand ils ouvrent leur carte.",
        noFeed: "Les minuteurs des boss mondiaux demandent le meter 2.0.65 ou plus récent.", feedFailed: "Impossible de lire les minuteurs des boss mondiaux.",
        noServer: "Connectez-vous avec un personnage pour voir les boss mondiaux de votre serveur.", up: "Présent", upFor: (t) => `depuis ${t}`,
        due: "Imminent", unknown: "Pas encore signalé", seen: (t) => `signalé il y a ${t}`, allField: "Tous les boss mondiaux",
        repeat: "Répéter", volume: "Volume", once: "Une fois", times: (n) => `${n} fois`, untilMuted: "Jusqu'à coupure", mute: "Couper", dismiss: "Fermer",
        bossSoon: (name, n) => `${name} de retour dans ${n} min`, bossNow: (name) => `${name} est de retour` },
  es: { groupUp: "Activos", groupWindow: "En ventana", groupUpcoming: "Próximos", groupUnknown: "Sin informes", ago: (t) => `hace ${t}`, hpLeft: (n) => `PV ${n} %`,
        openFull: "Abrir Event Timers", alertOptions: "Config", testAlert: "Probar alerta", alertColor: "Color de las alertas", colors: {"orange": "Naranja", "gold": "Dorado", "red": "Rojo", "pink": "Rosa", "purple": "Morado", "blue": "Azul", "green": "Verde"},
        whileOpen: "Avisarme", allOn: "Activar todo", allOff: "Desactivar todo", defaultLead: "Momento de la alerta", defaultClosed: "Momento de la alerta con AION2 cerrado", applyAll: "Aplicar a las alertas actuales", applyAsk: (n, lead, closed) => `¿Poner las ${n} alertas activas en ${lead}, y ${closed} con AION2 cerrado?`, apply: "Aplicar", cancel: "Cancelar", defaultsNote: "Momentos predeterminados de las alertas nuevas",
        textSize: "Tamaño del texto", popNote: "La ventana se oculta tras 30 segundos sin uso y vuelve sola cuando suena una alerta. Para abrirla antes: Ajustes → Plugins → Abrir.", events: "Eventos", bosses: "Jefes", region: "Región", daily: "Reinicio diario", weekly: "Reinicio semanal",
        scheduled: "Jefes del Abismo", field: "Jefes mundiales", fieldNote: "Compartidos por los medidores de los jugadores al abrir su mapa.",
        noFeed: "Los temporizadores de jefes mundiales necesitan el medidor 2.0.65 o posterior.", feedFailed: "No se pudieron leer los temporizadores de jefes mundiales.",
        noServer: "Entra con un personaje para ver los jefes mundiales de tu servidor.", up: "Activo", upFor: (t) => `desde hace ${t}`,
        due: "Inminente", unknown: "Sin informes", seen: (t) => `informado hace ${t}`, allField: "Todos los jefes mundiales",
        repeat: "Repetir", volume: "Volumen", once: "Una vez", times: (n) => `${n} veces`, untilMuted: "Hasta silenciar", mute: "Silenciar", dismiss: "Cerrar",
        bossSoon: (name, n) => `${name} vuelve en ${n} min`, bossNow: (name) => `${name} ha vuelto` },
  pt: { groupUp: "Ativos", groupWindow: "Na janela", groupUpcoming: "Próximos", groupUnknown: "Sem relatos ainda", ago: (t) => `há ${t}`, hpLeft: (n) => `PV ${n}%`,
        openFull: "Abrir Event Timers", alertOptions: "Config", testAlert: "Testar alerta", alertColor: "Cor dos alertas", colors: {"orange": "Laranja", "gold": "Dourado", "red": "Vermelho", "pink": "Rosa", "purple": "Roxo", "blue": "Azul", "green": "Verde"},
        whileOpen: "Avisar-me", allOn: "Ativar todos", allOff: "Desativar todos", defaultLead: "Momento do alerta", defaultClosed: "Momento do alerta com o AION2 fechado", applyAll: "Aplicar aos alertas atuais", applyAsk: (n, lead, closed) => `Ajustar os ${n} alertas ativos para ${lead}, e ${closed} com o AION2 fechado?`, apply: "Aplicar", cancel: "Cancelar", defaultsNote: "Momentos padrão dos novos alertas",
        textSize: "Tamanho do texto", popNote: "A janela some após 30 segundos sem uso e volta sozinha quando um alerta toca. Para abri-la antes: Configurações → Plugins → Abrir.", events: "Eventos", bosses: "Chefes", region: "Região", daily: "Reinício diário", weekly: "Reinício semanal",
        scheduled: "Chefes do Abismo", field: "Chefes mundiais", fieldNote: "Compartilhados pelos medidores dos jogadores ao abrir o mapa.",
        noFeed: "Os timers de chefes mundiais precisam do medidor 2.0.65 ou mais novo.", feedFailed: "Não foi possível ler os timers de chefes mundiais.",
        noServer: "Entre com um personagem para ver os chefes mundiais do seu servidor.", up: "Ativo", upFor: (t) => `há ${t}`,
        due: "Iminente", unknown: "Sem relatos ainda", seen: (t) => `relatado há ${t}`, allField: "Todos os chefes mundiais",
        repeat: "Repetir", volume: "Volume", once: "Uma vez", times: (n) => `${n} vezes`, untilMuted: "Até silenciar", mute: "Silenciar", dismiss: "Fechar",
        bossSoon: (name, n) => `${name} volta em ${n} min`, bossNow: (name) => `${name} voltou` },
  ru: { groupUp: "На месте", groupWindow: "В окне появления", groupUpcoming: "Скоро", groupUnknown: "Пока нет данных", ago: (t) => `${t} назад`, hpLeft: (n) => `HP ${n}%`,
        openFull: "Открыть Event Timers", alertOptions: "Конфиг", testAlert: "Проверить", alertColor: "Цвет оповещений", colors: {"orange": "Оранжевый", "gold": "Золотой", "red": "Красный", "pink": "Розовый", "purple": "Фиолетовый", "blue": "Синий", "green": "Зелёный"},
        whileOpen: "Напомнить", allOn: "Включить все", allOff: "Выключить все", defaultLead: "Время оповещения", defaultClosed: "Время оповещения, когда AION2 закрыт", applyAll: "Применить к текущим оповещениям", applyAsk: (n, lead, closed) => `Установить ${n} включённых оповещений на «${lead}», а когда AION2 закрыт — «${closed}»?`, apply: "Применить", cancel: "Отмена", defaultsNote: "Время по умолчанию для новых оповещений",
        textSize: "Размер текста", popNote: "Окно скрывается после 30 секунд без действий и само появляется при оповещении. Чтобы открыть его раньше: Настройки → Плагины → Открыть.", events: "События", bosses: "Боссы", region: "Регион", daily: "Ежедневный сброс", weekly: "Еженедельный сброс",
        scheduled: "Боссы Бездны", field: "Мировые боссы", fieldNote: "Делятся метры игроков, когда те открывают карту.",
        noFeed: "Для таймеров мировых боссов нужен метр 2.0.65 или новее.", feedFailed: "Не удалось прочитать таймеры мировых боссов.",
        noServer: "Войдите персонажем, чтобы видеть мировых боссов своего сервера.", up: "На месте", upFor: (t) => `уже ${t}`,
        due: "Вот-вот", unknown: "Пока нет данных", seen: (t) => `данные ${t} назад`, allField: "Все мировые боссы",
        repeat: "Повтор", volume: "Громкость", once: "Один раз", times: (n) => `${n} раз`, untilMuted: "Пока не выключить", mute: "Выключить звук", dismiss: "Закрыть",
        bossSoon: (name, n) => `${name} через ${n} мин`, bossNow: (name) => `${name} появился` },
  "zh-Hant": { groupUp: "已出現", groupWindow: "出現時段中", groupUpcoming: "即將出現", groupUnknown: "尚無回報", ago: (t) => `${t} 前`, hpLeft: (n) => `HP ${n}%`,
        openFull: "開啟 Event Timers", alertOptions: "配置", testAlert: "測試提醒", alertColor: "提醒顏色", colors: {"orange": "橘色", "gold": "金色", "red": "紅色", "pink": "粉紅", "purple": "紫色", "blue": "藍色", "green": "綠色"},
        whileOpen: "提醒時間", allOn: "全部開啟", allOff: "全部關閉", defaultLead: "提醒時間", defaultClosed: "AION2 關閉時的提醒時間", applyAll: "套用到目前的提醒", applyAsk: (n, lead, closed) => `將已開啟的 ${n} 個提醒設為「${lead}」，AION2 關閉時設為「${closed}」？`, apply: "套用", cancel: "取消", defaultsNote: "新提醒的預設時間",
        textSize: "文字大小", popNote: "30 秒未使用後視窗會隱藏，提醒響起時會自動再出現。若要先開啟：設定 → 外掛 → 開啟。", events: "活動", bosses: "首領", region: "地區", daily: "每日重置", weekly: "每週重置",
        scheduled: "深淵首領", field: "世界首領", fieldNote: "由玩家開啟地圖時其計量器分享。",
        noFeed: "世界首領計時需要計量器 2.0.65 以上。", feedFailed: "無法讀取世界首領計時。",
        noServer: "登入角色即可查看伺服器的世界首領。", up: "已出現", upFor: (t) => `已 ${t}`,
        due: "即將出現", unknown: "尚無回報", seen: (t) => `${t} 前回報`, allField: "所有世界首領",
        repeat: "重複", volume: "音量", once: "一次", times: (n) => `${n} 次`, untilMuted: "直到靜音", mute: "靜音", dismiss: "關閉",
        bossSoon: (name, n) => `${name} ${n} 分鐘後出現`, bossNow: (name) => `${name} 已出現` },
  "zh-Hans": { groupUp: "已出现", groupWindow: "出现时段中", groupUpcoming: "即将出现", groupUnknown: "尚无回报", ago: (t) => `${t} 前`, hpLeft: (n) => `HP ${n}%`,
        openFull: "打开 Event Timers", alertOptions: "配置", testAlert: "测试提醒", alertColor: "提醒颜色", colors: {"orange": "橙色", "gold": "金色", "red": "红色", "pink": "粉红", "purple": "紫色", "blue": "蓝色", "green": "绿色"},
        whileOpen: "提醒时间", allOn: "全部开启", allOff: "全部关闭", defaultLead: "提醒时间", defaultClosed: "AION2 关闭时的提醒时间", applyAll: "应用到当前的提醒", applyAsk: (n, lead, closed) => `将已开启的 ${n} 个提醒设为“${lead}”，AION2 关闭时设为“${closed}”？`, apply: "应用", cancel: "取消", defaultsNote: "新提醒的默认时间",
        textSize: "文字大小", popNote: "30 秒未使用后窗口会隐藏，提醒响起时会自动再出现。若要先打开：设置 → 插件 → 打开。", events: "活动", bosses: "首领", region: "地区", daily: "每日重置", weekly: "每周重置",
        scheduled: "深渊首领", field: "世界首领", fieldNote: "由玩家打开地图时其计量器分享。",
        noFeed: "世界首领计时需要计量器 2.0.65 以上。", feedFailed: "无法读取世界首领计时。",
        noServer: "登录角色即可查看服务器的世界首领。", up: "已出现", upFor: (t) => `已 ${t}`,
        due: "即将出现", unknown: "尚无回报", seen: (t) => `${t} 前回报`, allField: "所有世界首领",
        repeat: "重复", volume: "音量", once: "一次", times: (n) => `${n} 次`, untilMuted: "直到静音", mute: "静音", dismiss: "关闭",
        bossSoon: (name, n) => `${name} ${n} 分钟后出现`, bossNow: (name) => `${name} 已出现` },
};

// The Bosses tab's row buttons: each boss's alert on or off, and the way to
// its settings in Alerts.
const ROW_UI = {
  en: { alertOn: "Turn this alert on", alertOff: "Turn this alert off", viaAll: "On with “All world bosses”: click for an alert of its own",
        settings: "This alert's settings", settingsOff: "Turn the alert on to set it" },
  ko: { alertOn: "이 알림 켜기", alertOff: "이 알림 끄기", viaAll: "“모든 월드 보스”로 켜져 있음: 클릭하면 이 보스만의 알림",
        settings: "이 알림 설정", settingsOff: "알림을 켜면 설정할 수 있습니다" },
  ja: { alertOn: "この通知をオン", alertOff: "この通知をオフ", viaAll: "「すべてのワールドボス」でオン：クリックでこのボス個別の通知",
        settings: "この通知の設定", settingsOff: "通知をオンにすると設定できます" },
  de: { alertOn: "Diesen Alarm einschalten", alertOff: "Diesen Alarm ausschalten", viaAll: "An über „Alle Weltbosse“: klicken für einen eigenen Alarm",
        settings: "Einstellungen dieses Alarms", settingsOff: "Alarm einschalten, um ihn einzustellen" },
  fr: { alertOn: "Activer cette alerte", alertOff: "Désactiver cette alerte", viaAll: "Active via « Tous les boss mondiaux » : cliquez pour une alerte à lui",
        settings: "Réglages de cette alerte", settingsOff: "Activez l'alerte pour la régler" },
  es: { alertOn: "Activar esta alerta", alertOff: "Desactivar esta alerta", viaAll: "Activa con «Todos los jefes mundiales»: haz clic para una alerta propia",
        settings: "Ajustes de esta alerta", settingsOff: "Activa la alerta para ajustarla" },
  pt: { alertOn: "Ativar este alerta", alertOff: "Desativar este alerta", viaAll: "Ativo por “Todos os chefes mundiais”: clique para um alerta próprio",
        settings: "Configurações deste alerta", settingsOff: "Ative o alerta para configurá-lo" },
  ru: { alertOn: "Включить это оповещение", alertOff: "Выключить это оповещение", viaAll: "Включено через «Все мировые боссы»: нажмите для отдельного оповещения",
        settings: "Настройки этого оповещения", settingsOff: "Включите оповещение, чтобы настроить его" },
  "zh-Hant": { alertOn: "開啟此提醒", alertOff: "關閉此提醒", viaAll: "已透過「所有世界首領」開啟：點擊為它設定專屬提醒",
        settings: "此提醒的設定", settingsOff: "開啟提醒後即可設定" },
  "zh-Hans": { alertOn: "开启此提醒", alertOff: "关闭此提醒", viaAll: "已通过“所有世界首领”开启：点击为它设置专属提醒",
        settings: "此提醒的设置", settingsOff: "开启提醒后即可设置" },
};

// Spoken alerts' settings (voices.js).
const VOICE_UI = {
  en: { speak: "Speak alerts", voiceType: "Voice type", voice: "Voice", voiceDefault: "Default", speed: "Speed", testVoice: "Test voice",
        types: { any: "Any", female: "Female", male: "Male" },
        note: "Uses your computer's voices. Female and male are told by a voice's name: those it can't tell are listed under Any only." },
  ko: { speak: "알림 읽어 주기", voiceType: "음성 종류", voice: "음성", voiceDefault: "기본", speed: "속도", testVoice: "음성 테스트",
        types: { any: "모두", female: "여성", male: "남성" },
        note: "컴퓨터의 음성을 사용합니다. 여성/남성은 음성 이름으로 구분하며, 구분할 수 없는 음성은 '모두'에만 표시됩니다." },
  ja: { speak: "通知を読み上げ", voiceType: "声の種類", voice: "音声", voiceDefault: "既定", speed: "速さ", testVoice: "音声をテスト",
        types: { any: "すべて", female: "女性", male: "男性" },
        note: "PCの音声を使います。女性・男性は音声の名前から判断し、判断できない音声は「すべて」にのみ表示されます。" },
  de: { speak: "Alarme vorlesen", voiceType: "Stimmtyp", voice: "Stimme", voiceDefault: "Standard", speed: "Tempo", testVoice: "Stimme testen",
        types: { any: "Alle", female: "Weiblich", male: "Männlich" },
        note: "Nutzt die Stimmen Ihres Computers. Weiblich und männlich werden am Namen einer Stimme erkannt: Stimmen ohne Zuordnung stehen nur unter „Alle“." },
  fr: { speak: "Lire les alertes à voix haute", voiceType: "Type de voix", voice: "Voix", voiceDefault: "Par défaut", speed: "Vitesse", testVoice: "Tester la voix",
        types: { any: "Toutes", female: "Féminine", male: "Masculine" },
        note: "Utilise les voix de votre ordinateur. Féminine ou masculine se devine au nom de la voix : celles qu'on ne peut pas classer ne figurent que sous « Toutes »." },
  es: { speak: "Leer las alertas en voz alta", voiceType: "Tipo de voz", voice: "Voz", voiceDefault: "Predeterminada", speed: "Velocidad", testVoice: "Probar voz",
        types: { any: "Todas", female: "Femenina", male: "Masculina" },
        note: "Usa las voces de tu ordenador. Femenina o masculina se deduce del nombre de la voz: las que no se pueden clasificar solo aparecen en «Todas»." },
  pt: { speak: "Falar os alertas", voiceType: "Tipo de voz", voice: "Voz", voiceDefault: "Padrão", speed: "Velocidade", testVoice: "Testar voz",
        types: { any: "Todas", female: "Feminina", male: "Masculina" },
        note: "Usa as vozes do seu computador. Feminina ou masculina é deduzido do nome da voz: as que não dá para classificar aparecem só em “Todas”." },
  ru: { speak: "Озвучивать оповещения", voiceType: "Тип голоса", voice: "Голос", voiceDefault: "По умолчанию", speed: "Скорость", testVoice: "Проверить голос",
        types: { any: "Любой", female: "Женский", male: "Мужской" },
        note: "Голоса вашего компьютера. Женский или мужской определяется по названию голоса; те, что определить нельзя, есть только в «Любой»." },
  "zh-Hant": { speak: "朗讀提醒", voiceType: "語音類型", voice: "語音", voiceDefault: "預設", speed: "語速", testVoice: "測試語音",
        types: { any: "全部", female: "女聲", male: "男聲" },
        note: "使用電腦的語音。女聲或男聲依語音名稱判斷，無法判斷的語音只列在「全部」。" },
  "zh-Hans": { speak: "朗读提醒", voiceType: "语音类型", voice: "语音", voiceDefault: "默认", speed: "语速", testVoice: "测试语音",
        types: { any: "全部", female: "女声", male: "男声" },
        note: "使用电脑的语音。女声或男声依语音名称判断，无法判断的语音只列在“全部”。" },
};
const vui = () => VOICE_UI[language] || VOICE_UI.en;

let language = "en";
let character = null;
// Whether AION2 is open, as the meter tells it; null on meters that don't
// say, taken as open.
let gameRunning = null;
// alerts: id -> minutes before (0 = as it starts); absent = off. Ids are an
// event's, "field:<world-map id>" for a world boss, ALL_FIELD for all of them.
// leads: the lead chosen per id, kept while its alert is off.
// closedLeads: id -> minutes before while the game is closed, or -1 for no
// alert then; absent = DEFAULT_CLOSED_LEAD.
// repeat: how many times the sound plays (0 = until muted).
// display: "system" (this computer's zone), "server", or a zone name.
// defaultLead / defaultClosedLead: what an alert starts with when turned on.
// lastServer: the last character's server, kept for when nobody is logged in.
// alsoAtStart: an alert with a lead goes off again as its event starts.
// folded: the Bosses tab's sections folded away ({ scheduled, field }).
// volume: the alerts' loudness, 0-100 %, the spoken ones' too.
// speak: alerts also said out loud (voices.js), in voiceName ("": the first
// of voiceType, "any" / "female" / "male", in the meter's language), at
// voiceRate.
let prefs = { region: "auto", hidden: [], alerts: {}, leads: {}, closedLeads: {}, sound: "chime", repeat: 1, volume: 100, pop: false,
  tab: "events", display: "system", lastServer: 0, scale: 1, defaultLead: DEFAULT_LEAD, defaultClosedLead: DEFAULT_CLOSED_LEAD,
  alertColor: "orange", alsoAtStart: false, folded: {}, speak: false, voiceName: "", voiceType: "any", voiceRate: 1 };
// The world boss timers: { server, bosses, at, error }, from the feed and the
// player's own map, the newest report of each boss kept.
let feed = null;
// Bosses read off the player's own map, kept across a feed refresh.
let ownMap = { server: 0, bosses: {} };

const ui = () => ({ ...(UI[language] || UI.en), ...(MORE_UI[language] || MORE_UI.en) });
const aui = () => ALERT_UI[language] || ALERT_UI.en;
const rui = () => ROW_UI[language] || ROW_UI.en;
const text = (k) => EVENT_TEXT[k]?.[language] ?? EVENT_TEXT[k]?.en ?? k;
// The built-in voice's lines (kokoro.js, made by tools/voices/make_voice.py
// from these words: change both): a name, then what it is doing, in English.
const SPOKEN = {
  name: (k) => EVENT_TEXT[k]?.en ?? null,
  soon: (n) => (n === 1 ? "in 1 minute" : `in ${n} minutes`),
  now: "is starting",
  bossSoon: (n) => (n === 1 ? "back in 1 minute" : `back in ${n} minutes`),
  bossNow: "is back",
  fought: "is being fought, go join!",
};

// A boss's nearest teleport (teleports.js, from the game's map data), shown
// on hover: in its row and on its icon. One line per spawn point, for the
// player's side (both sides, named, before they log in).
const TP_UI = {
  en: { label: "Nearest teleport", tp: (n) => `TP ${n}` },
  ko: { label: "가까운 텔레포트", tp: (n) => `${n}번` },
  ja: { label: "最寄りのテレポート", tp: (n) => `${n}番` },
  de: { label: "Nächster Teleport", tp: (n) => `TP ${n}` },
  fr: { label: "Téléporteur le plus proche", tp: (n) => `TP ${n}` },
  es: { label: "Teletransporte más cercano", tp: (n) => `TP ${n}` },
  pt: { label: "Teleporte mais próximo", tp: (n) => `TP ${n}` },
  ru: { label: "Ближайший телепорт", tp: (n) => `ТП ${n}` },
  "zh-Hant": { label: "最近的傳送點", tp: (n) => `${n} 號` },
  "zh-Hans": { label: "最近的传送点", tp: (n) => `${n} 号` },
};
// A boss's teleports: a scheduled Abyss boss's are its event's (several
// bosses, each named), only those for it.
const spotsOf = (id) => {
  if (typeof TELEPORTS !== "object") return null;
  const b = id.startsWith("field:") ? FIELD_BOSSES[id.slice(6)] : null;
  if (!b?.schedule) return TELEPORTS[id];
  return (TELEPORTS[b.schedule] || []).filter((s) => !s.boss || s.boss === b.name);
};
const teleportTip = (id) => {
  const spots = spotsOf(id);
  if (!spots?.length) return "";
  const u = TP_UI[language] || TP_UI.en;
  const side = serverSide();
  // Several bosses at once (one event): each line names its boss.
  const named = !!EVENTS.find((e) => e.id === id)?.also?.length;
  const lines = [];
  for (const spot of spots) {
    for (const s of ["elyos", "asmodian"]) {
      const t = spot[s];
      if (!t || (side && s !== side)) continue;
      const place = TELEPORT_TEXT[t.name]?.[language] ?? TELEPORT_TEXT[t.name]?.en ?? "";
      const where = [t.tp != null ? u.tp(t.tp) : "", place].filter(Boolean).join(" – ");
      const who = [named && spot.boss ? text(spot.boss) : "", !side && spot.elyos && spot.asmodian ? ui()[s] : ""]
        .filter(Boolean).join(" · ");
      const line = `${who ? `${who}: ` : ""}${where} (${unit(t.dist, "meter")})`;
      if (!lines.includes(line)) lines.push(line);
    }
  }
  if (!lines.length) return "";
  return lines.length === 1 ? `${u.label}: ${lines[0]}` : `${u.label}:\n${lines.join("\n")}`;
};
// The teleport list's numbers for a boss, on its icon: the player's side
// only (none before the side is known), each spawn point's once, nearest
// first; up to two, "3/5", and "3/5+" past that.
const teleportBadge = (id) => {
  const spots = spotsOf(id);
  const side = serverSide();
  if (!spots?.length || !side) return "";
  const nums = [];
  for (const t of spots.map((s) => s[side]).filter((t) => t?.tp != null).sort((a, b) => a.dist - b.dist)) {
    if (!nums.includes(t.tp)) nums.push(t.tp);
  }
  return nums.slice(0, 2).join("/") + (nums.length > 2 ? "+" : "");
};
const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});
const defaultLead = () => (LEADS.includes(Number(prefs.defaultLead)) ? Number(prefs.defaultLead) : DEFAULT_LEAD);
const defaultClosed = () => {
  const n = Number(prefs.defaultClosedLead);
  return n === -1 || LEADS.includes(n) ? n : DEFAULT_CLOSED_LEAD;
};
const leadText = (n) => {
  const a = aui();
  return n < 0 ? a.off : n ? a.before(n) : a.atStart;
};
const option = (value, label) => {
  const o = document.createElement("option");
  o.value = String(value);
  o.textContent = label;
  return o;
};

// The character's server, or the last one seen: the game may be closed, the
// alerts still wanted.
const serverId = () => Number(character?.serverId) || Number(prefs.lastServer) || 0;
const serverName = () => {
  const names = SERVERS[String(serverId())];
  return names ? names[language] || names.en : "";
};
// The server's region (second digit) and side (first).
const serverRegion = () => {
  const id = serverId();
  if (!(id >= 1000)) return null;
  return Number(String(id)[1]);
};
const serverSide = () => {
  const id = serverId();
  if (!(id >= 1000)) return null;
  return String(id)[0] === "1" ? "elyos" : String(id)[0] === "2" ? "asmodian" : null;
};
const region = () => (prefs.region !== "auto" ? Number(prefs.region) : serverRegion());
const timeZone = () => REGIONS[region()] || null;

// A wall-clock time in a time zone, as a moment (ms). The zone's offset is
// read from Intl for that moment, twice, so a time next to a clock change
// lands right.
// One formatter per zone: making one is slow, and the timers asked for
// thousands a second (half a CPU core, 2026-10-28).
const zoneFormats = new Map();
const zoneFormat = (tz) => {
  let f = zoneFormats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric", weekday: "short",
    });
    zoneFormats.set(tz, f);
  }
  return f;
};
const partsIn = (tz, ms) => {
  const parts = zoneFormat(tz).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    y: Number(get("year")), m: Number(get("month")), d: Number(get("day")),
    h: Number(get("hour")), mi: Number(get("minute")), s: Number(get("second")),
    wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
};
const offsetAt = (tz, ms) => {
  const p = partsIn(tz, ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
};
const wallToMs = (tz, y, m, d, minutes) => {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - offsetAt(tz, guess);
  return guess - offsetAt(tz, first);
};

// An event's current or next showing: { start, end } in ms. One that can only
// be entered for a while after it starts (the Shugo Festa and the Dimensional
// Invasion: 3 minutes, then the game closes the entrance) counts as running
// for that while only, so the next one shows once it can no longer be joined.
// Each event's answer is kept until it is over (or, for one with no length,
// until it starts), so most seconds work nothing out.
const nextCache = new WeakMap();
const nextOf = (ev, tz, now) => {
  const zone = ev.utc ? "UTC" : tz;
  const runMs = ev.enter ? ev.enter * 1000 : (ev.minutes || 0) * 60_000;
  const kept = nextCache.get(ev);
  if (kept && kept.zone === zone && kept.from <= now && (!kept.best || (runMs ? kept.best.end : kept.best.start) > now)) {
    if (kept.best || now - kept.from < 60_000) return kept.best;
  }
  const best = nextFrom(ev, zone, runMs, now);
  nextCache.set(ev, { zone, from: now, best });
  return best;
};
const nextFrom = (ev, zone, runMs, now) => {
  let best = null;
  for (let back = -1; back <= 8; back++) {
    const p = partsIn(zone, now + back * 86_400_000);
    if (!ev.days.includes(p.wd)) continue;
    for (const start of ev.starts) {
      const at = wallToMs(zone, p.y, p.m, p.d, start);
      const end = at + runMs;
      if ((runMs ? end : at) <= now) continue;
      if (!best || at < best.start) best = { start: at, end };
    }
  }
  return best;
};

// A day or more as "6d 17h" in the meter's language; under that, h:mm:ss.
const unit = (n, u) => {
  try {
    return new Intl.NumberFormat(language, { style: "unit", unit: u, unitDisplay: "narrow" }).format(n);
  } catch {
    return `${n}${u[0]}`;
  }
};
const span = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 86_400) return `${unit(Math.floor(s / 86_400), "day")} ${unit(Math.floor((s % 86_400) / 3600), "hour")}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
// A rough age: "12 min", "3 h".
const age = (ms) => {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min >= 120 ? unit(Math.round(min / 60), "hour") : unit(min, "minute");
};
// Times as the player chose to see them: this computer's zone, the server's,
// or any other.
const clock = () => {
  const tz = timeZone();
  const zone = prefs.display === "server" ? tz || undefined : prefs.display === "system" ? undefined : prefs.display;
  const opts = { weekday: "short", hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat(language, { ...opts, timeZone: zone });
  } catch {
    return new Intl.DateTimeFormat(language, opts);
  }
};

// The scheduled events and bosses this player sees: their side's, or both
// before they log in; resets apart.
const scheduled = (kind) => {
  const side = serverSide();
  return EVENTS.filter((ev) => (kind === "boss" ? ev.kind === "boss" : ev.kind !== "boss" && ev.kind !== "reset"))
    .filter((ev) => !ev.side || !side || ev.side === side);
};
const eventName = (ev) => {
  const side = serverSide();
  return [ev.name, ...(ev.also || [])].map(text).join(" · ") + (ev.side && !side ? ` (${ui()[ev.side]})` : "");
};
// The world bosses on the maps this player's side sees.
const fieldBosses = () => {
  const side = serverSide();
  return Object.entries(FIELD_BOSSES)
    .filter(([, b]) => !b.side || !side || b.side === side)
    .map(([id, b]) => ({ id, ...b }));
};
// A world boss's timer from the feed: { state, upSince, nextSpawn, reportedAt } (seconds), or null.
// One still up at 0% HP was killed: the meter that saw it fall did not see
// it die, and until a map says so the feed has it up (Watcher Kaira, 0%).
// One dead past its respawn time is up: the time is the game's own, and
// nobody may have opened their map since.
const feedEntry = (id) => (feed && feed.server === serverId() ? feed.bosses?.[id] || null : null);
const fieldTimer = (id) => {
  let t = feedEntry(id);
  if (t?.state === "up" && t.hp === 0 && t.hpAt) {
    t = { ...t, state: "dead", nextSpawn: null, reportedAt: Math.max(t.reportedAt || 0, t.hpAt) };
  }
  const b = FIELD_BOSSES[id];
  if (b?.schedule && (!t || (t.state === "dead" && !t.nextSpawn))) return scheduledTimer(b, t);
  if (t?.state === "dead" && !t.nextSpawn) return t;
  if (t?.state === "dead" && t.nextSpawn && Date.now() >= t.nextSpawn * 1000) {
    return { ...t, state: "up", upSince: t.nextSpawn, nextSpawn: null, hp: null, hpAt: null };
  }
  return t;
};
// The Abyss's bosses (Reshanta) are listed apart from the world bosses: the
// ones on a fixed schedule from it, Argo, the Spirit King from the feed.
const isAbyssBoss = (b) => b.where === "String_STR_Map_Abyss_Reshanta_A_body";
// The Abyss's scheduled bosses are world bosses, as the feed has them
// (WorldMapFieldNamed: Watcher Kaira 2002; the three Guardian Lord Nahmas
// 2003-2005; Executors Tamasa, Argo and Kaira 2006-2008), listed, followed
// and alerted as the others are. Their next spawn comes from the game's
// schedule (schedule.js EVENTS), the feed keeping none for them. Each spawn's
// event, and its name's place in the event's names.
const ABYSS_SPAWNS = { "boss-kaira": ["2002"], "boss-nahma": ["2003", "2004", "2005"], "boss-tamasa-argo-kaira": ["2006", "2007", "2008"] };
for (const [evId, ids] of Object.entries(ABYSS_SPAWNS)) {
  const ev = EVENTS.find((e) => e.id === evId);
  if (!ev) continue;
  ids.forEach((id, i) => {
    const names = [ev.name, ...(ev.also || [])];
    FIELD_BOSSES[id] ||= { name: names[ev.also?.length ? i : 0] || ev.name, side: ev.side, where: ev.where[0], schedule: evId };
  });
}
// A scheduled boss's spawn as the schedule has it: up from its start, for
// the spawn's window, unless reported killed since; else the next start.
const scheduledTimer = (b, t) => {
  const ev = EVENTS.find((e) => e.id === b.schedule);
  const tz = timeZone() || "UTC";
  const now = Date.now();
  let next = ev && nextOf(ev, tz, now);
  if (!next) return t;
  const killed = t?.state === "dead" && Number(t.reportedAt) * 1000 >= next.start + 60_000;
  if (next.start <= now && killed) next = nextOf(ev, tz, next.end + 1);
  if (!next) return t;
  if (next.start <= now) return { ...(t || {}), state: "up", upSince: Math.floor(next.start / 1000), nextSpawn: null, hp: null, hpAt: null };
  return { ...(t || {}), state: "dead", nextSpawn: Math.floor(next.start / 1000), reportedAt: t?.reportedAt || 0 };
};

function renderStatic() {
  const words = ui();
  const a = aui();
  const labels = { events: words.events, bosses: words.bosses, alerts: a.alerts, settings: a.settings };
  for (const tab of els.tabs) tab.textContent = labels[tab.dataset.tab];
  els.eventsHead.textContent = words.events;
  els.regionLabel.textContent = words.region;
  els.zoneLabel.textContent = a.showIn;
  els.scaleLabel.textContent = words.textSize;
  els.colorLabel.textContent = words.alertColor;
  // Each colour shown in itself: a swatch and its name, on the list's dark.
  els.colorSelect.replaceChildren(...Object.entries(ALERT_COLORS).map(([k, hex]) => {
    const o = option(k, `● ${words.colors[k]}`);
    o.style.color = hex;
    return o;
  }));
  els.colorSelect.value = ALERT_COLORS[prefs.alertColor] ? prefs.alertColor : "orange";
  $(".defaultsHead").textContent = a.alerts;
  els.defaultLeadLabel.textContent = words.whileOpen;
  els.defaultClosedLabel.textContent = a.closed;
  els.defaultsNote.textContent = words.defaultsNote;
  els.applyAll.textContent = words.applyAll;
  els.modalYes.textContent = words.apply;
  els.modalNo.textContent = words.cancel;
  els.defaultLead.replaceChildren(...LEADS.map((n) => option(n, leadText(n))));
  els.defaultLead.value = String(defaultLead());
  els.defaultClosed.replaceChildren(...[-1, ...LEADS].map((n) => option(n, leadText(n))));
  els.defaultClosed.value = String(defaultClosed());
  els.scaleSelect.replaceChildren(...SCALES.map((x) => option(x, `${Math.round(x * 100)}%`)));
  els.scaleSelect.value = String(prefs.scale);
  els.soundLabel.textContent = a.sound;
  els.testAlert.textContent = words.testAlert;
  els.alertOptionsBtn.textContent = words.alertOptions;
  els.repeatLabel.textContent = words.repeat;
  els.volumeLabel.textContent = words.volume;
  els.volume.value = String(prefs.volume ?? 100);
  els.popLabel.textContent = a.pop;
  els.alsoAtStartLabel.textContent = a.alsoAtStart;
  els.popNote.textContent = words.popNote;
  els.popNote.hidden = !prefs.pop;
  els.mute.textContent = words.mute;
  els.dismiss.title = words.dismiss;
  els.openFull.textContent = words.openFull;
  els.dismiss.setAttribute("aria-label", words.dismiss);
  els.scheduledHead.querySelector(".foldLabel").textContent = words.scheduled;
  els.fieldHead.querySelector(".foldLabel").textContent = words.field;
  renderFolds();
  els.zoneSelect.replaceChildren(option("system", a.systemTime(SYSTEM_ZONE || "?")), option("server", a.serverTime),
    ...ALL_ZONES.map((z) => option(z, z.replaceAll("_", " "))));
  els.zoneSelect.value = prefs.display;
  if (els.zoneSelect.value !== prefs.display) els.zoneSelect.value = "system";
  els.regionSelect.replaceChildren(option("auto", words.auto),
    ...Object.keys(REGIONS).map((k) => option(k, words.regions[k - 1])));
  els.regionSelect.value = String(prefs.region);
  els.sound.replaceChildren(...[...SOUND_ORDER, "off"].map((v) => option(v, v === "off" ? a.none : a.sounds[v])));
  els.sound.value = prefs.sound;
  els.repeat.replaceChildren(...REPEATS.map((n) => option(n, n === 0 ? words.untilMuted : n === 1 ? words.once : words.times(n))));
  els.repeat.value = String(prefs.repeat);
  els.pop.checked = !!prefs.pop;
  els.alsoAtStart.checked = !!prefs.alsoAtStart;
  renderVoice();
  renderTabs();
  renderAlerts();
  if (typeof renderPinLock === "function") renderPinLock();
}

// zoom, not a font size: the styles are in pixels, and everything should grow
// together.
function applyColor() {
  const hex = ALERT_COLORS[prefs.alertColor] || ALERT_COLORS.orange;
  document.documentElement.style.setProperty("--alert", hex);
  // The closed dropdown in the colour it names.
  els.colorSelect.style.color = hex;
}

function applyScale() {
  const scale = SCALES.includes(Number(prefs.scale)) ? Number(prefs.scale) : 1;
  document.documentElement.style.zoom = String(Math.round(BASE_ZOOM * scale * 1000) / 1000);
}

// Events and bosses can stay visible together. Alerts and Settings remember
// the last list selection when they temporarily replace the timers.
function timerViews() {
  const selected = Array.isArray(prefs.timerViews)
    ? ["events", "bosses"].filter((name) => prefs.timerViews.includes(name)) : [];
  return selected.length ? selected : [prefs.tab === "bosses" ? "bosses" : "events"];
}

function selectTab(name) {
  if (["events", "bosses"].includes(name)) {
    let selected = timerViews();
    const showingTimers = ["events", "bosses", "both"].includes(prefs.tab);
    if (showingTimers && selected.includes(name) && selected.length > 1) selected = selected.filter((v) => v !== name);
    else if (!selected.includes(name)) selected.push(name);
    prefs.timerViews = selected;
    prefs.tab = selected.length === 2 ? "both" : selected[0];
  } else prefs.tab = name;
  savePrefs();
  renderTabs();
}

function renderTabs() {
  const visible = ["events", "bosses", "both"].includes(prefs.tab) ? timerViews() : [prefs.tab];
  for (const tab of els.tabs) tab.setAttribute("aria-pressed", String(visible.includes(tab.dataset.tab)));
  for (const [name, view] of Object.entries(els.views)) view.hidden = !visible.includes(name);
  els.eventsHead.hidden = visible.length !== 2;
  document.body.classList.toggle("combinedTimers", visible.length === 2);
}

// The header: server, region and its clock; the resets.
function renderHeader(now) {
  const words = ui();
  const tz = timeZone();
  if (!tz) {
    els.status.textContent = serverRegion() === 0 ? words.unsupported : words.pick;
  } else {
    const parts = [serverName(), words.regions[region() - 1], tz.split("/").pop().replace("_", " ")];
    els.status.textContent = parts.filter(Boolean).join(" · ");
  }
  const resets = EVENTS.filter((ev) => ev.kind === "reset").map((ev) => {
    const next = nextOf(ev, "UTC", now);
    return next ? `${text(ev.name)} ${words.in(span(next.start - now))}` : "";
  });
  els.resets.textContent = resets.filter(Boolean).join(" · ");
}

// Lucide's arrow-up (ISC licence), inline: the plugin's page loads nothing
// from outside.
const UP_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>';

// Lucide's bell and settings (ISC licence), for the Bosses tab's row buttons.
const BELL_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/>'
  + '<path class="fillable" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8'
  + 'c0 4.499-1.411 5.956-2.738 7.326"/></svg>';
const GEAR_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 '
  + '1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 '
  + '1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 '
  + '2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15'
  + '-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 '
  + '0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

// A boss's alert as the Bosses tab shows it: "own" (its own alert is on),
// "all" (a world boss with no alert of its own, covered by "All field
// bosses"), or "" (none). `key` is the alert entry its settings are in.
function bossAlert(id) {
  if (id in prefs.alerts) return { state: "own", key: id };
  if (id.startsWith("field:") && ALL_FIELD in prefs.alerts) return { state: "all", key: ALL_FIELD };
  return { state: "", key: null };
}

// The bell and the gear on a boss's row. The bell turns the boss's own alert
// on (with its last time, else the default, as the Alerts tab's "All on"
// does) or off, in the same prefs.alerts the Alerts tab uses. The gear, lit
// while an alert covers the boss, opens that alert in the Alerts tab.
function rowActions(id) {
  const r = rui();
  const { state, key } = bossAlert(id);
  const box = document.createElement("span");
  box.className = "rowActions";
  const bell = document.createElement("button");
  bell.type = "button";
  bell.className = `rowBtn alertBtn${state ? ` ${state}` : ""}`;
  bell.dataset.act = "alert";
  bell.dataset.id = id;
  bell.setAttribute("aria-pressed", String(state === "own"));
  bell.title = state === "own" ? r.alertOff : state === "all" ? r.viaAll : r.alertOn;
  bell.setAttribute("aria-label", bell.title);
  bell.innerHTML = BELL_ICON;
  const gear = document.createElement("button");
  gear.type = "button";
  gear.className = `rowBtn gearBtn${state ? " lit" : ""}`;
  gear.dataset.act = "settings";
  gear.dataset.id = id;
  gear.setAttribute("aria-disabled", String(!state));
  gear.title = state ? r.settings : r.settingsOff;
  gear.setAttribute("aria-label", gear.title);
  gear.innerHTML = GEAR_ICON;
  box.append(bell, gear);
  return box;
}

function toggleBossAlert(id) {
  if (id in prefs.alerts) delete prefs.alerts[id];
  else prefs.alerts[id] = prefs.leads[id] ?? defaultLead();
  savePrefs();
  renderAlerts();
  render();
}


// The Bosses tab's buttons, on the lists (their rows are drawn anew every
// second). A click is taken here and goes no further than its button.
for (const list of [els.scheduled, els.field]) {
  list.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".rowBtn");
    if (!btn || !list.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.id;
    if (btn.dataset.act === "alert") toggleBossAlert(id);
    else if (btn.dataset.act === "settings") {
      const { key } = bossAlert(id);
      if (key) openAlert(key);
    }
  });
}
// While a button is held, its list isn't redrawn: a click whose press and
// release land on two drawings of the row would be lost.
let rowPress = false;
const endPress = () => { rowPress = false; };
for (const list of [els.scheduled, els.field]) {
  list.addEventListener("pointerdown", (e) => {
    if (e.target.closest?.(".rowBtn")) rowPress = true;
  });
}
// A line about a timer for chat ("WB: Harvest Manager Moshav is at 76%"),
// which a double right-click on its icon copies (pins.js pinLine, widget.js).
const COPY = {
  en: { wb: "WB", abyss: "Abyss", hp: (n, p) => `${n} is at ${p}%`, up: (n) => `${n} is up`, back: (n, t) => `${n} is back in ${t}`, due: (n) => `${n} is due now`, unknown: (n) => `${n}: no report yet`, starts: (n, t) => `${n} starts in ${t}`, on: (n, t) => `${n} is on now, ${t} left`, open: (n, t) => `${n} is open, ${t} left`, now: (n) => `${n} is on now`, fought: (n) => `${n} is being fought`, killed: (n) => `${n} was just killed`, copied: "Copied" },
  ko: { wb: "월드보스", abyss: "어비스", hp: (n, p) => `${n} ${p}% 남음`, up: (n) => `${n} 출현 중`, back: (n, t) => `${n} ${t} 후 출현`, due: (n) => `${n} 곧 출현`, unknown: (n) => `${n}: 정보 없음`, starts: (n, t) => `${n} ${t} 후 시작`, on: (n, t) => `${n} 진행 중, ${t} 남음`, open: (n, t) => `${n} 입장 가능, ${t} 남음`, now: (n) => `${n} 지금 진행 중`, fought: (n) => `${n} 전투 중`, killed: (n) => `${n} 방금 처치됨`, copied: "복사됨" },
  ja: { wb: "WB", abyss: "アビス", hp: (n, p) => `${n} 残りHP ${p}%`, up: (n) => `${n} 出現中`, back: (n, t) => `${n} あと${t}で出現`, due: (n) => `${n} まもなく出現`, unknown: (n) => `${n}: 情報なし`, starts: (n, t) => `${n} あと${t}で開始`, on: (n, t) => `${n} 開催中、残り${t}`, open: (n, t) => `${n} 入場可能、残り${t}`, now: (n) => `${n} 開催中`, fought: (n) => `${n} 戦闘中`, killed: (n) => `${n} 討伐されました`, copied: "コピーしました" },
  de: { wb: "WB", abyss: "Abyss", hp: (n, p) => `${n} ist bei ${p} %`, up: (n) => `${n} ist da`, back: (n, t) => `${n} kommt in ${t}`, due: (n) => `${n} ist jetzt fällig`, unknown: (n) => `${n}: noch keine Meldung`, starts: (n, t) => `${n} beginnt in ${t}`, on: (n, t) => `${n} läuft, noch ${t}`, open: (n, t) => `${n} ist offen, noch ${t}`, now: (n) => `${n} läuft jetzt`, fought: (n) => `${n} wird bekämpft`, killed: (n) => `${n} wurde gerade besiegt`, copied: "Kopiert" },
  fr: { wb: "WB", abyss: "Abysses", hp: (n, p) => `${n} est à ${p} %`, up: (n) => `${n} est là`, back: (n, t) => `${n} revient dans ${t}`, due: (n) => `${n} est attendu maintenant`, unknown: (n) => `${n} : pas encore de signalement`, starts: (n, t) => `${n} commence dans ${t}`, on: (n, t) => `${n} en cours, encore ${t}`, open: (n, t) => `${n} est ouvert, encore ${t}`, now: (n) => `${n} est en cours`, fought: (n) => `${n} est en combat`, killed: (n) => `${n} vient d'être vaincu`, copied: "Copié" },
  es: { wb: "WB", abyss: "Abismo", hp: (n, p) => `${n} está al ${p}%`, up: (n) => `${n} ha aparecido`, back: (n, t) => `${n} vuelve en ${t}`, due: (n) => `${n} debería aparecer ya`, unknown: (n) => `${n}: sin informes aún`, starts: (n, t) => `${n} empieza en ${t}`, on: (n, t) => `${n} en curso, quedan ${t}`, open: (n, t) => `${n} está abierto, quedan ${t}`, now: (n) => `${n} está en curso`, fought: (n) => `${n} está en combate`, killed: (n) => `${n} acaba de caer`, copied: "Copiado" },
  pt: { wb: "WB", abyss: "Abismo", hp: (n, p) => `${n} está com ${p}%`, up: (n) => `${n} apareceu`, back: (n, t) => `${n} volta em ${t}`, due: (n) => `${n} deve aparecer agora`, unknown: (n) => `${n}: sem relatos ainda`, starts: (n, t) => `${n} começa em ${t}`, on: (n, t) => `${n} acontecendo, faltam ${t}`, open: (n, t) => `${n} está aberto, faltam ${t}`, now: (n) => `${n} está acontecendo`, fought: (n) => `${n} está em combate`, killed: (n) => `${n} acabou de ser derrotado`, copied: "Copiado" },
  ru: { wb: "WB", abyss: "Бездна", hp: (n, p) => `${n}: ${p}% HP`, up: (n) => `${n} появился`, back: (n, t) => `${n} появится через ${t}`, due: (n) => `${n} вот-вот появится`, unknown: (n) => `${n}: пока нет данных`, starts: (n, t) => `${n} начнётся через ${t}`, on: (n, t) => `${n} идёт, осталось ${t}`, open: (n, t) => `${n} открыт, осталось ${t}`, now: (n) => `${n} идёт сейчас`, fought: (n) => `${n}: идёт бой`, killed: (n) => `${n} только что убит`, copied: "Скопировано" },
  "zh-Hant": { wb: "世界首領", abyss: "深淵", hp: (n, p) => `${n} 剩餘 ${p}%`, up: (n) => `${n} 已出現`, back: (n, t) => `${n} ${t}後出現`, due: (n) => `${n} 即將出現`, unknown: (n) => `${n}：尚無回報`, starts: (n, t) => `${n} ${t}後開始`, on: (n, t) => `${n} 進行中，剩餘 ${t}`, open: (n, t) => `${n} 開放中，剩餘 ${t}`, now: (n) => `${n} 進行中`, fought: (n) => `${n} 戰鬥中`, killed: (n) => `${n} 剛被擊敗`, copied: "已複製" },
  "zh-Hans": { wb: "世界首领", abyss: "深渊", hp: (n, p) => `${n} 剩余 ${p}%`, up: (n) => `${n} 已出现`, back: (n, t) => `${n} ${t}后出现`, due: (n) => `${n} 即将出现`, unknown: (n) => `${n}：尚无回报`, starts: (n, t) => `${n} ${t}后开始`, on: (n, t) => `${n} 进行中，剩余 ${t}`, open: (n, t) => `${n} 开放中，剩余 ${t}`, now: (n) => `${n} 进行中`, fought: (n) => `${n} 战斗中`, killed: (n) => `${n} 刚被击败`, copied: "已复制" },
};
// A wait for chat: "45 sec", "3 min 20 sec" (under 10 minutes), "12 min",
// "1 hr 5 min".
const chatSpan = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return unit(s, "second");
  if (s < 600) return s % 60 ? `${unit(Math.floor(s / 60), "minute")} ${unit(s % 60, "second")}` : unit(s / 60, "minute");
  const m = Math.round(s / 60);
  return m >= 60 ? `${unit(Math.floor(m / 60), "hour")} ${unit(m % 60, "minute")}` : unit(m, "minute");
};
// A boss row's nearest teleport, in a tooltip while the pointer is on it.
// One tooltip for the page, placed by the row (the rows are drawn anew every
// second; the tooltip stays). Positions are corrected by what the browser
// reports, so the page's zoom (Text size) doesn't throw them off.
const tpTip = document.createElement("div");
tpTip.className = "tpTip";
tpTip.hidden = true;
document.body.append(tpTip);
let tpRow = null;
const placeTip = () => {
  const li = tpRow && [els.scheduled, els.field].map((l) => [...l.children].find((x) => x.dataset.id === tpRow)).find(Boolean);
  const tip = li && teleportTip(tpRow);
  if (!tip) {
    tpTip.hidden = true;
    return;
  }
  if (tpTip.textContent !== tip) tpTip.textContent = tip;
  tpTip.hidden = false;
  const r = li.getBoundingClientRect();
  if (!r.width) {
    tpTip.hidden = true;
    return;
  }
  const set = (x, y) => {
    tpTip.style.left = `${x}px`;
    tpTip.style.top = `${y}px`;
  };
  set(100, 100);
  const k = tpTip.getBoundingClientRect().left / 100 || 1;
  const t = tpTip.getBoundingClientRect();
  const below = r.bottom + 4 + t.height <= innerHeight || r.top - 4 - t.height < 0;
  const x = Math.max(4, Math.min(r.left + 12, innerWidth - t.width - 4));
  const y = below ? r.bottom + 4 : r.top - 4 - t.height;
  set(x / k, y / k);
};
for (const list of [els.scheduled, els.field]) {
  list.addEventListener("mouseover", (e) => {
    const id = e.target.closest?.("li[data-id]")?.dataset.id || null;
    if (id === tpRow) return;
    tpRow = id;
    placeTip();
  });
  list.addEventListener("mouseleave", () => {
    tpRow = null;
    placeTip();
  });
}
addEventListener("scroll", () => tpRow && placeTip(), true);

document.addEventListener("pointerup", endPress, true);
document.addEventListener("pointercancel", endPress, true);
window.addEventListener("blur", endPress);

// The Bosses tab's two sections, each folded away or open, as last left.
function renderFolds() {
  for (const btn of document.querySelectorAll(".foldBtn")) {
    const folded = !!prefs.folded?.[btn.dataset.fold];
    btn.setAttribute("aria-expanded", String(!folded));
    els.views.bosses.classList.toggle(`${btn.dataset.fold}Folded`, folded);
  }
}
for (const btn of document.querySelectorAll(".foldBtn")) {
  btn.addEventListener("click", () => {
    prefs.folded = { ...(prefs.folded || {}), [btn.dataset.fold]: !prefs.folded?.[btn.dataset.fold] };
    savePrefs();
    renderFolds();
  });
}

// One countdown row: name (and a bell when its alert is on), where, and when;
// an up boss's countdown leads with an up arrow. A boss's row has its alert's
// buttons (rowActions) in place of the bell.
function row({ id, name, where, countdown, at, running, up, soon, hide, actions }) {
  const li = document.createElement("li");
  li.dataset.id = id;
  li.classList.toggle("running", !!running);
  li.classList.toggle("up", !!up);
  li.classList.toggle("soon", !!soon && !running && !up);
  const n = document.createElement("span");
  n.className = "name";
  n.textContent = name;
  if (!actions && (id in prefs.alerts || (id.startsWith("field:") && ALL_FIELD in prefs.alerts))) {
    const bell = document.createElement("span");
    bell.className = "bell";
    bell.textContent = "🔔";
    n.prepend(bell);
  }
  const w = document.createElement("span");
  w.className = "where";
  w.textContent = where;
  const when = document.createElement("span");
  when.className = "when";
  const c = document.createElement("div");
  c.className = "countdown";
  c.textContent = countdown;
  if (up) {
    const icon = document.createElement("span");
    icon.className = "upIcon";
    icon.title = ui().up;
    icon.innerHTML = UP_ICON;
    c.prepend(icon);
  }
  const t = document.createElement("div");
  t.className = "at";
  t.textContent = at;
  when.append(c, t);
  li.append(n, when);
  if (hide) li.append(hide);
  if (actions) li.append(rowActions(id));
  li.append(w);
  return li;
}

function renderSchedule(list, events, now, { hideable, actions = false }) {
  const words = ui();
  const tz = timeZone();
  const fmt = clock();
  const shown = events.filter((ev) => tz || ev.utc).map((ev) => ({ ev, next: nextOf(ev, tz || "UTC", now) })).filter((x) => x.next);
  const visible = shown.filter((x) => !hideable || !prefs.hidden.includes(x.ev.id)).sort((a, b) => a.next.start - b.next.start);
  list.replaceChildren(...visible.map(({ ev, next }) => {
    const running = next.start <= now;
    let hide = null;
    if (hideable) {
      hide = document.createElement("button");
      hide.type = "button";
      hide.className = "hide";
      hide.textContent = "×";
      hide.title = words.hide;
      hide.addEventListener("click", () => {
        prefs.hidden = [...new Set([...prefs.hidden, ev.id])];
        savePrefs();
        render();
      });
    }
    return row({
      id: ev.id, name: eventName(ev), where: ev.where.map(text).join(", "), running, hide, actions,
      soon: next.start - now <= SOON_MS,
      countdown: running ? `${ev.enter ? enterWord() : words.now} · ${words.left(span(next.end - now))}` : words.in(span(next.start - now)),
      at: fmt.format(new Date(next.start)),
    });
  }));
  return shown;
}

function renderHidden(shown) {
  const words = ui();
  const hiddenOnes = shown.filter((x) => prefs.hidden.includes(x.ev.id));
  els.hidden.replaceChildren();
  if (!hiddenOnes.length) return;
  els.hidden.append(words.hidden);
  for (const { ev } of hiddenOnes) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text(ev.name);
    b.addEventListener("click", () => {
      prefs.hidden = prefs.hidden.filter((id) => id !== ev.id);
      savePrefs();
      render();
    });
    els.hidden.append(b);
  }
}

// World bosses: up ones first, then by when they're back, then the ones no
// meter has reported yet.
function renderField(now) {
  const words = ui();
  // Timers from Aion 2 Timers (the shared feed marks them): credited, with a
  // link to their site, wherever they show.
  const fromA2t = fieldBosses().some((b) => fieldTimer(b.id)?.source === "a2t");
  els.fieldCredit.hidden = !fromA2t;
  if (typeof a2.bossTimers !== "function") els.fieldNote.textContent = words.noFeed;
  else if (!serverId()) els.fieldNote.textContent = words.noServer;
  else if (feed?.error) els.fieldNote.textContent = words.feedFailed;
  else els.fieldNote.textContent = words.fieldNote;
  els.field.replaceChildren(...fieldItems(fieldBosses().filter((b) => !isAbyssBoss(b)), now, true));
}

// The rows of these feed bosses, up ones first, then by when they're back;
// with a heading over each group if `withHeads`.
function fieldItems(bosses, now, withHeads) {
  const words = ui();
  const fmt = clock();
  const rows = bosses.map((b) => {
    const t = fieldTimer(b.id);
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : null;
    const group = t?.state === "up" ? "up" : !next ? "unknown"
      : next <= now ? (now - next <= WINDOW_MS ? "window" : "unknown") : "upcoming";
    return { b, t, next, group };
  });
  const order = { up: 0, window: 1, upcoming: 2, unknown: 3 };
  rows.sort((x, y) => order[x.group] - order[y.group]
    || (x.group === "up" ? (x.t.hp ?? 101) - (y.t.hp ?? 101) : 0)
    || (x.next || 0) - (y.next || 0) || text(x.b.name).localeCompare(text(y.b.name)));
  const heads = { up: words.groupUp, window: words.groupWindow, upcoming: words.groupUpcoming, unknown: words.groupUnknown };
  const items = [];
  let lastGroup = "";
  for (const { b, t, next, group } of rows) {
    if (withHeads && group !== lastGroup) {
      lastGroup = group;
      const li = document.createElement("li");
      li.className = `subhead ${group}`;
      li.textContent = heads[group];
      items.push(li);
    }
    let countdown = "–";
    let at = words.unknown;
    if (group === "up") {
      countdown = t.upSince ? words.upFor(span(now - t.upSince * 1000)) : words.up;
      // Its HP while fresh (the feed drops it after 30 minutes), else when
      // it was last reported.
      at = t.hp != null && t.hpAt
        ? `${words.hpLeft(t.hp)} · ${words.ago(age(now - t.hpAt * 1000))}`
        : words.seen(age(now - (t.reportedAt || 0) * 1000));
    } else if (group === "window") {
      countdown = words.ago(age(now - next));
      at = fmt.format(new Date(next));
    } else if (group === "upcoming") {
      countdown = words.in(span(next - now));
      at = fmt.format(new Date(next));
    }
    const name = text(b.name) + (b.level ? ` · Lv ${b.level}` : "");
    const soon = group === "window" || (group === "upcoming" && next - now <= SOON_MS);
    const li = row({ id: `field:${b.id}`, name, where: text(b.where), countdown, at, up: group === "up", soon, actions: true });
    li.classList.toggle("abyss", isAbyssBoss(b));
    if (group === "up" && t.hp != null && t.hpAt) li.style.setProperty("--hp", `${Math.max(0, Math.min(100, t.hp))}%`);
    li.classList.toggle("hasHp", group === "up" && t.hp != null && !!t.hpAt);
    items.push(li);
  }
  return items;
}

function render() {
  const now = Date.now();
  renderHeader(now);
  renderHidden(renderSchedule(els.events, scheduled("event"), now, { hideable: true }));
  // Not while a row's button is pressed; a focused one keeps its focus.
  if (rowPress) return;
  const focused = document.activeElement?.closest?.(".rowBtn");
  const refocus = focused && { act: focused.dataset.act, id: focused.dataset.id };
  els.scheduled.replaceChildren(...fieldItems(fieldBosses().filter(isAbyssBoss), now, false));
  renderField(now);
  // Rows move as timers change: the teleport tooltip follows its row.
  if (tpRow) placeTip();
  if (refocus) {
    const again = [...els.views.bosses.querySelectorAll(".rowBtn")]
      .find((b) => b.dataset.act === refocus.act && b.dataset.id === refocus.id);
    again?.focus({ preventScroll: true });
  }
}

// One alert's settings: on or off, its two times, when fought (world
// bosses), and its own sound, repeats and icon (pins.js). Opened in place
// under its line in Your alerts.
// A note on the Dimensional Invasion's alert: the game lists it every hour
// at :30, and that is what the timer shows; some players sometimes get none
// (a game bug, 0.6.6 took those hours out and 0.6.12 put them back).
const INVASION_NOTE = {
  en: "Every hour at :30, as the game schedules it. Sometimes it doesn't appear for some players: that's a game bug, not a change to the schedule.",
  ko: "게임 일정대로 매시 30분에 열립니다. 가끔 일부 플레이어에게 나타나지 않는 경우가 있는데, 일정 변경이 아니라 게임 버그입니다.",
  ja: "ゲームのスケジュールどおり毎時30分に始まります。一部のプレイヤーに現れないことがありますが、スケジュールの変更ではなくゲームの不具合です。",
  de: "Jede Stunde um :30, wie das Spiel es plant. Manchmal erscheint sie bei manchen Spielern nicht: ein Fehler im Spiel, keine Änderung des Zeitplans.",
  fr: "Toutes les heures à :30, comme le prévoit le jeu. Il arrive qu'elle n'apparaisse pas pour certains joueurs : c'est un bug du jeu, pas un changement d'horaire.",
  es: "Cada hora a las :30, según el horario del juego. A veces no aparece para algunos jugadores: es un error del juego, no un cambio de horario.",
  pt: "Toda hora às :30, como o jogo programa. Às vezes não aparece para alguns jogadores: é um bug do jogo, não uma mudança de horário.",
  ru: "Каждый час в :30, по расписанию игры. Иногда у некоторых игроков оно не появляется: это ошибка игры, а не изменение расписания.",
  "zh-Hant": "依遊戲排程，每小時 30 分開啟。有時部分玩家看不到它出現：這是遊戲的錯誤，不是排程變更。",
  "zh-Hans": "按游戏排程，每小时 30 分开启。有时部分玩家看不到它出现：这是游戏的错误，不是排程变更。",
};

function alertEditor(id, label) {
  const words = ui();
  const a = aui();
    const li = document.createElement("li");
    li.dataset.alert = id;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = label;
    const on = document.createElement("input");
    on.type = "checkbox";
    on.className = "alertOn";
    on.title = a.enable;
    on.checked = id in prefs.alerts;
    const lead = document.createElement("select");
    lead.className = "lead";
    lead.append(...LEADS.map((n) => option(n, n ? a.before(n) : a.atStart)));
    lead.value = String(prefs.alerts[id] ?? prefs.leads[id] ?? defaultLead());
    const closed = document.createElement("select");
    closed.className = "lead";
    closed.append(...[-1, ...LEADS].map((n) => option(n, n < 0 ? a.off : n ? a.before(n) : a.atStart)));
    closed.value = String(prefs.closedLeads[id] ?? defaultClosed());
    // Its two times, once it is on: one line each, labels left, the
    // dropdowns lined up on the right.
    const timeRow = (text, select) => {
      const row = document.createElement("label");
      row.className = "leadRow";
      const span = document.createElement("span");
      span.textContent = text;
      row.append(span, select);
      return row;
    };
    const leads = document.createElement("div");
    leads.className = "leads";
    leads.append(timeRow(words.whileOpen, lead), timeRow(a.closed, closed));
    // A world boss: also, or only ("Don't remind"), when it is being fought
    // (pins.js).
    if (id.startsWith("field:") && typeof fightControl === "function") {
      lead.prepend(option(-1, pinUi().noRemind));
      lead.value = String(prefs.alerts[id] ?? prefs.leads[id] ?? defaultLead());
      leads.append(fightControl(id));
    }
    const show = () => {
      leads.hidden = !on.checked;
      li.classList.toggle("on", on.checked);
    };
    show();
    const apply = (e) => {
      // Switched on: its own last times, else the defaults as they are now.
      if (e?.target === on && on.checked) {
        lead.value = String(prefs.leads[id] ?? defaultLead());
        closed.value = String(prefs.closedLeads[id] ?? defaultClosed());
      }
      prefs.leads[id] = Number(lead.value);
      prefs.closedLeads[id] = Number(closed.value);
      if (on.checked) prefs.alerts[id] = Number(lead.value);
      else delete prefs.alerts[id];
      show();
      savePrefs();
      render();
      renderAlerts();
    };
    on.addEventListener("change", apply);
    lead.addEventListener("change", apply);
    closed.addEventListener("change", apply);
    const head = document.createElement("label");
    head.className = "alertHead";
    head.append(on, name);
    // Its own sound, repeats and icon, under its times (pins.js).
    if (typeof pinControls === "function") leads.append(pinControls(id));
    li.append(head);
    if (id.startsWith("invasion")) {
      const note = document.createElement("p");
      note.className = "note alertNote";
      note.textContent = INVASION_NOTE[language] || INVASION_NOTE.en;
      li.append(note);
    }
    li.append(leads);
    return li;
}

// The Alerts tab (0.6): the alerts that are on first, one line each, whose
// settings open in place one at a time; quick picks for the common sets; and
// everything else to add from, searchable, world bosses grouped by map with
// how often each comes back. A list of every timer with its settings opening
// under each, as before, grew with every alert turned on.
const LIST_UI = {
  en: { yours: "Your alerts", picks: "Quick picks", add: "Add alerts", search: "Search", none: "No alerts yet. Pick a set above, or add one below.",
        deflt: (t) => `Default: ${t}`, every: (m) => (m >= 60 ? `every ${m / 60} h` : `every ${m} min`), fought: "when fought",
        edit: "Settings", remove: "Turn off", addOne: "Add", added: "On", all: "All", noMatch: "Nothing matches.",
        pickEvents: "Shugo & Invasion", pickRare: "Rare world bosses", pickAll: "All world bosses", pickSiege: "Artifact Siege",
        rareNote: "World bosses that take 3 h or more to come back." },
  ko: { yours: "내 알림", picks: "빠른 선택", add: "알림 추가", search: "검색", none: "아직 알림이 없습니다. 위에서 묶음을 고르거나 아래에서 추가하세요.",
        deflt: (t) => `기본값: ${t}`, every: (m) => (m >= 60 ? `${m / 60}시간마다` : `${m}분마다`), fought: "전투 시",
        edit: "설정", remove: "끄기", addOne: "추가", added: "켜짐", all: "모두", noMatch: "일치하는 항목이 없습니다.",
        pickEvents: "슈고 & 침공", pickRare: "희귀 월드 보스", pickAll: "모든 월드 보스", pickSiege: "아티팩트 공성전",
        rareNote: "다시 나오기까지 3시간 이상 걸리는 월드 보스." },
  ja: { yours: "設定中の通知", picks: "まとめて選ぶ", add: "通知を追加", search: "検索", none: "まだ通知はありません。上でまとめて選ぶか、下から追加してください。",
        deflt: (t) => `既定: ${t}`, every: (m) => (m >= 60 ? `${m / 60}時間ごと` : `${m}分ごと`), fought: "戦闘時",
        edit: "設定", remove: "オフ", addOne: "追加", added: "オン", all: "すべて", noMatch: "一致するものがありません。",
        pickEvents: "シュゴ & 侵攻", pickRare: "レアなワールドボス", pickAll: "すべてのワールドボス", pickSiege: "アーティファクト攻城戦",
        rareNote: "再出現まで3時間以上かかるワールドボス。" },
  de: { yours: "Deine Alarme", picks: "Schnellauswahl", add: "Alarme hinzufügen", search: "Suchen", none: "Noch keine Alarme. Wähle oben eine Gruppe oder füge unten einen hinzu.",
        deflt: (t) => `Standard: ${t}`, every: (m) => (m >= 60 ? `alle ${m / 60} Std.` : `alle ${m} Min.`), fought: "im Kampf",
        edit: "Einstellungen", remove: "Ausschalten", addOne: "Hinzufügen", added: "An", all: "Alle", noMatch: "Nichts gefunden.",
        pickEvents: "Shugo & Invasion", pickRare: "Seltene Weltbosse", pickAll: "Alle Weltbosse", pickSiege: "Artefakt-Belagerung",
        rareNote: "Weltbosse, die 3 Std. oder länger zum Wiedererscheinen brauchen." },
  fr: { yours: "Vos alertes", picks: "Choix rapides", add: "Ajouter des alertes", search: "Rechercher", none: "Aucune alerte. Choisissez un ensemble ci-dessus ou ajoutez-en une ci-dessous.",
        deflt: (t) => `Par défaut : ${t}`, every: (m) => (m >= 60 ? `toutes les ${m / 60} h` : `toutes les ${m} min`), fought: "en combat",
        edit: "Réglages", remove: "Désactiver", addOne: "Ajouter", added: "Activée", all: "Tout", noMatch: "Aucun résultat.",
        pickEvents: "Shugo et Invasion", pickRare: "Boss mondiaux rares", pickAll: "Tous les boss mondiaux", pickSiege: "Siège des artefacts",
        rareNote: "Boss mondiaux qui mettent 3 h ou plus à revenir." },
  es: { yours: "Tus alertas", picks: "Selección rápida", add: "Añadir alertas", search: "Buscar", none: "Aún no hay alertas. Elige un grupo arriba o añade una abajo.",
        deflt: (t) => `Predeterminado: ${t}`, every: (m) => (m >= 60 ? `cada ${m / 60} h` : `cada ${m} min`), fought: "en combate",
        edit: "Ajustes", remove: "Desactivar", addOne: "Añadir", added: "Activa", all: "Todos", noMatch: "Sin resultados.",
        pickEvents: "Shugo e Invasión", pickRare: "Jefes mundiales raros", pickAll: "Todos los jefes mundiales", pickSiege: "Asedio de artefactos",
        rareNote: "Jefes mundiales que tardan 3 h o más en volver." },
  pt: { yours: "Seus alertas", picks: "Escolhas rápidas", add: "Adicionar alertas", search: "Buscar", none: "Nenhum alerta ainda. Escolha um grupo acima ou adicione um abaixo.",
        deflt: (t) => `Padrão: ${t}`, every: (m) => (m >= 60 ? `a cada ${m / 60} h` : `a cada ${m} min`), fought: "em combate",
        edit: "Configurações", remove: "Desligar", addOne: "Adicionar", added: "Ligado", all: "Todos", noMatch: "Nada encontrado.",
        pickEvents: "Shugo e Invasão", pickRare: "Chefes mundiais raros", pickAll: "Todos os chefes mundiais", pickSiege: "Cerco de Artefatos",
        rareNote: "Chefes mundiais que levam 3 h ou mais para voltar." },
  ru: { yours: "Ваши оповещения", picks: "Быстрый выбор", add: "Добавить оповещения", search: "Поиск", none: "Оповещений пока нет. Выберите набор выше или добавьте ниже.",
        deflt: (t) => `По умолчанию: ${t}`, every: (m) => (m >= 60 ? `каждые ${m / 60} ч` : `каждые ${m} мин`), fought: "в бою",
        edit: "Настройки", remove: "Выключить", addOne: "Добавить", added: "Вкл.", all: "Все", noMatch: "Ничего не найдено.",
        pickEvents: "Шуго и Вторжение", pickRare: "Редкие мировые боссы", pickAll: "Все мировые боссы", pickSiege: "Осада артефактов",
        rareNote: "Мировые боссы, которые возрождаются 3 ч и дольше." },
  "zh-Hant": { yours: "我的提醒", picks: "快速選擇", add: "新增提醒", search: "搜尋", none: "尚無提醒。從上方選一組，或在下方新增。",
        deflt: (t) => `預設：${t}`, every: (m) => (m >= 60 ? `每 ${m / 60} 小時` : `每 ${m} 分鐘`), fought: "戰鬥時",
        edit: "設定", remove: "關閉", addOne: "新增", added: "已開啟", all: "全部", noMatch: "沒有符合的項目。",
        pickEvents: "修果與入侵", pickRare: "稀有世界首領", pickAll: "所有世界首領", pickSiege: "神器攻城戰",
        rareNote: "重生需要 3 小時以上的世界首領。" },
  "zh-Hans": { yours: "我的提醒", picks: "快速选择", add: "添加提醒", search: "搜索", none: "还没有提醒。从上方选一组，或在下方添加。",
        deflt: (t) => `默认：${t}`, every: (m) => (m >= 60 ? `每 ${m / 60} 小时` : `每 ${m} 分钟`), fought: "战斗时",
        edit: "设置", remove: "关闭", addOne: "添加", added: "已开启", all: "全部", noMatch: "没有匹配的项目。",
        pickEvents: "修果与入侵", pickRare: "稀有世界首领", pickAll: "所有世界首领", pickSiege: "神器攻城战",
        rareNote: "重生需要 3 小时以上的世界首领。" },
};
const lui = () => LIST_UI[language] || LIST_UI.en;
// The Alerts tab's state: the alert whose settings are open, the search, the
// groups opened (kept), and whether the defaults are open.
const alertView = { open: null, search: "", defaults: false };
const RARE_MIN = 180;

function renderAlerts() {
  const words = ui();
  const a = aui();
  const l = lui();
  prefs.alertGroups ||= [];
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const changed = () => {
    savePrefs();
    renderAlerts();
    render();
  };
  const turnOn = (id) => {
    if (!(id in prefs.alerts)) prefs.alerts[id] = prefs.leads[id] ?? defaultLead();
  };
  const field = fieldBosses().sort((x, y) => text(x.name).localeCompare(text(y.name)));
  const events = scheduled("event");
  const respawn = (b) => (typeof RESPAWN_MIN === "object" ? RESPAWN_MIN[b.id] || 0 : 0);
  // An alert's name, and where it is (a world boss's map), apart: the name
  // gets the line, the map goes under it with the timing.
  const nameOf = (id) => {
    if (id === ALL_FIELD) return words.allField;
    if (id.startsWith("field:")) return text(FIELD_BOSSES[id.slice(6)]?.name ?? id);
    const ev = EVENTS.find((e) => e.id === id);
    return ev ? eventName(ev) : id;
  };
  const whereOf = (id) => (id.startsWith("field:") && id !== ALL_FIELD ? text(FIELD_BOSSES[id.slice(6)]?.where ?? "") : "");
  // An alert in one line: when it goes, and whether also when fought.
  const summary = (id) => {
    const n = Number(prefs.alerts[id]);
    const when = n < 0 ? pinUi().noRemind : leadText(n);
    return prefs.fought?.[id] ? `${when} · ${l.fought}` : when;
  };

  const parts = [];

  // Quick picks: a set turned on or off at once.
  const picks = [
    [l.pickEvents, events.filter((ev) => /^(festival|invasion)/.test(ev.id)).map((ev) => ev.id)],
    [l.pickRare, field.filter((b) => respawn(b) >= RARE_MIN).map((b) => `field:${b.id}`), l.rareNote],
    [l.pickAll, [ALL_FIELD]],
    [l.pickSiege, events.filter((ev) => ev.id === "artifact").map((ev) => ev.id)],
  ].filter(([, ids]) => ids.length);
  const pickBox = el("li", "picks");
  pickBox.append(el("h2", "group", l.picks));
  const chips = el("div", "chips pickChips");
  for (const [label, ids, note] of picks) {
    const on = ids.every((id) => id in prefs.alerts);
    const chip = el("button", `chip${on ? " on" : ""}`, label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(on));
    if (note) chip.title = note;
    chip.addEventListener("click", () => {
      for (const id of ids) {
        if (on) delete prefs.alerts[id];
        else turnOn(id);
      }
      changed();
    });
    chips.append(chip);
  }
  pickBox.append(chips);
  parts.push(pickBox);

  // Your alerts: those on, one line each.
  const mine = Object.keys(prefs.alerts).sort((x, y) => nameOf(x).localeCompare(nameOf(y)));
  const yours = el("li", "yours");
  const head = el("h2", "group yoursHead");
  head.append(el("span", null, `${l.yours} (${mine.length})`));
  const defBtn = el("button", "linkBtn", l.deflt(leadText(defaultLead())));
  defBtn.type = "button";
  defBtn.setAttribute("aria-expanded", String(alertView.defaults));
  defBtn.addEventListener("click", () => { alertView.defaults = !alertView.defaults; renderAlerts(); });
  head.append(defBtn);
  yours.append(head);
  if (alertView.defaults) {
    // The default times, in place: the same controls as Settings has.
    const box = el("div", "defaultsInline");
    const pick = (label, value, values, set) => {
      const row = el("label", "setting");
      const s = el("select");
      s.append(...values.map((n) => option(n, leadText(n))));
      s.value = String(value);
      s.addEventListener("change", () => { set(Number(s.value)); savePrefs(); renderStatic(); renderAlerts(); });
      row.append(el("span", null, label), s);
      return row;
    };
    box.append(
      pick(words.whileOpen, defaultLead(), LEADS, (v) => { prefs.defaultLead = v; }),
      pick(a.closed, defaultClosed(), [-1, ...LEADS], (v) => { prefs.defaultClosedLead = v; }),
    );
    const apply = el("button", "linkBtn", words.applyAll);
    apply.type = "button";
    apply.addEventListener("click", () => els.applyAll.click());
    box.append(apply);
    yours.append(box);
  }
  if (!mine.length) yours.append(el("p", "note emptyNote", l.none));
  const list = el("ol", "mine");
  for (const id of mine) {
    const li = el("li", "mineRow");
    li.dataset.alert = id;
    const row = el("div", "mineLine");
    const bell = el("button", "bell on", "🔔");
    bell.type = "button";
    bell.title = l.remove;
    bell.setAttribute("aria-label", `${l.remove}: ${nameOf(id)}`);
    bell.addEventListener("click", () => {
      delete prefs.alerts[id];
      if (alertView.open === id) alertView.open = null;
      changed();
    });
    const open = alertView.open === id;
    const toggle = el("button", "mineToggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(open));
    const words2 = el("span", "mineText");
    words2.append(el("span", "mineName", nameOf(id)), el("span", "mineWhen", [whereOf(id), summary(id)].filter(Boolean).join(" · ")));
    toggle.title = [nameOf(id), whereOf(id)].filter(Boolean).join(" · ");
    toggle.append(words2, el("span", "chev", "›"));
    toggle.addEventListener("click", () => { alertView.open = open ? null : id; renderAlerts(); });
    row.append(bell, toggle);
    li.append(row);
    if (open) {
      // Its settings: the same controls as before, under its line.
      const editor = alertEditor(id, nameOf(id));
      editor.classList.add("editor");
      li.append(editor);
    }
    list.append(li);
  }
  yours.append(list);
  parts.push(yours);

  // Add alerts: search, then each group, folded.
  const add = el("li", "addBox");
  add.append(el("h2", "group", l.add));
  const search = el("input", "alertSearch");
  search.type = "search";
  search.placeholder = l.search;
  search.setAttribute("aria-label", l.search);
  search.value = alertView.search;
  search.addEventListener("input", () => {
    alertView.search = search.value;
    renderAlerts();
    const again = els.alertList.querySelector(".alertSearch");
    again?.focus();
    again?.setSelectionRange(again.value.length, again.value.length);
  });
  add.append(search);
  const q = alertView.search.trim().toLowerCase();
  const groups = [
    ["events", words.events, events.map((ev) => ({ id: ev.id, label: eventName(ev) }))],
  ];
  const maps = new Map();
  for (const b of field) {
    const where = text(b.where);
    if (!maps.has(where)) maps.set(where, []);
    maps.get(where).push({ id: `field:${b.id}`, label: text(b.name), sub: respawn(b) ? l.every(respawn(b)) : "" });
  }
  for (const [where, items] of [...maps].sort((x, y) => x[0].localeCompare(y[0]))) {
    groups.push([`map:${where}`, where, items]);
  }
  let shown = 0;
  for (const [key, label, items] of groups) {
    const hits = q ? items.filter((it) => `${it.label} ${label}`.toLowerCase().includes(q)) : items;
    if (!hits.length) continue;
    shown += hits.length;
    const open = !!q || prefs.alertGroups.includes(key);
    const group = el("div", "addGroup");
    const gh = el("div", "addHead");
    const fold = el("button", "foldBtn addFold");
    fold.type = "button";
    fold.setAttribute("aria-expanded", String(open));
    fold.append(el("span", "chev", open ? "▾" : "▸"), el("span", null, `${label} (${items.length})`));
    fold.addEventListener("click", () => {
      prefs.alertGroups = open ? prefs.alertGroups.filter((k) => k !== key) : [...prefs.alertGroups, key];
      savePrefs();
      renderAlerts();
    });
    const allOn = items.every((it) => it.id in prefs.alerts);
    const all = el("button", "groupToggle", allOn ? words.allOff : l.all);
    all.type = "button";
    all.addEventListener("click", () => {
      for (const it of items) {
        if (allOn) delete prefs.alerts[it.id];
        else turnOn(it.id);
      }
      changed();
    });
    gh.append(fold, all);
    group.append(gh);
    if (open) {
      const rows = el("ol", "addList");
      for (const it of hits) {
        const on = it.id in prefs.alerts;
        const li = el("li", `addRow${on ? " on" : ""}`);
        const name = el("span", "addName", it.label);
        const btn = el("button", `addBtn${on ? " on" : ""}`, on ? `✓ ${l.added}` : `+ ${l.addOne}`);
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(on));
        btn.setAttribute("aria-label", `${on ? l.remove : l.addOne}: ${it.label}`);
        btn.addEventListener("click", () => {
          if (on) delete prefs.alerts[it.id];
          else turnOn(it.id);
          changed();
        });
        li.append(name);
        if (it.sub) li.append(el("span", "addSub", it.sub));
        li.append(btn);
        rows.append(li);
      }
      group.append(rows);
    }
    add.append(group);
  }
  if (q && !shown) add.append(el("p", "note", l.noMatch));
  parts.push(add);
  els.alertList.replaceChildren(...parts);
}

// The Alerts tab, opened at an alert's settings (the Bosses tab's gear),
// which flashes.
function openAlert(key) {
  prefs.tab = "alerts";
  savePrefs();
  renderTabs();
  if (key in prefs.alerts) alertView.open = key;
  renderAlerts();
  const li = [...els.alertList.querySelectorAll("[data-alert]")].find((x) => x.dataset.alert === key);
  if (!li) return;
  li.scrollIntoView({ block: "center" });
  li.classList.remove("flash");
  void li.offsetWidth;
  li.classList.add("flash");
}

// The alert's banner, with the sound repeating until it has played as often
// as chosen or is muted.
let repeatTimer = 0;
let repeatUntil = 0;
const lines = [];
function stopSound() {
  clearTimeout(repeatTimer);
  repeatTimer = 0;
  els.mute.hidden = true;
}
// An alert's sound: its own (`key`'s, pins.js) if it has one, else the
// default's.
function soundAlert(key) {
  stopSound();
  const own = typeof alertSound === "function" ? alertSound(key) : { sound: prefs.sound, repeat: Number(prefs.repeat) };
  if (own.sound === "off") return;
  const times = Number(own.repeat);
  const gap = (soundLength(own.sound) + 0.7) * 1000;
  let left = times === 0 ? Infinity : Math.max(1, times);
  repeatUntil = Date.now() + UNTIL_MUTED_MS;
  const play = () => {
    playSound(own.sound);
    left -= 1;
    // The last play: Mute stays live until it has finished.
    repeatTimer = setTimeout(left > 0 && Date.now() < repeatUntil ? play : stopSound, gap);
  };
  // Mute shows on every alert, left of ×, while the sound can still play;
  // gone once it is done or muted.
  els.mute.hidden = false;
  play();
}
// Spoken alerts (voices.js): the alert's line said after its sound's first
// play, without the HP in brackets. The computer's voices come a moment
// after the page opens, and the Voice list is filled again then.
let voice = null;
voice = typeof makeVoices === "function" ? makeVoices({ lang: () => language, prefs: () => prefs, onChange: () => renderVoice() }) : null;
const speakTimers = new Set();
function speakAlert(message, key, parts) {
  if (!prefs.speak || !voice?.available || !message) return;
  const own = typeof alertSound === "function" ? alertSound(key) : { sound: prefs.sound };
  const wait = own.sound === "off" || typeof soundLength !== "function" ? 0 : Math.min(1500, soundLength(own.sound) * 1000);
  const said = String(message).replace(/\s*[(（][^)）]*[)）]/g, "");
  const timer = setTimeout(() => {
    speakTimers.delete(timer);
    voice.say(said, parts);
  }, wait);
  speakTimers.add(timer);
}
function stopSpeaking() {
  for (const t of speakTimers) clearTimeout(t);
  speakTimers.clear();
  voice?.stop();
}
function renderVoice() {
  if (!voice) return;
  const v = vui();
  els.speakLabel.textContent = v.speak;
  els.voiceTypeLabel.textContent = v.voiceType;
  els.voicePickLabel.textContent = v.voice;
  els.voiceRateLabel.textContent = v.speed;
  els.testVoice.textContent = v.testVoice;
  els.voiceNote.textContent = v.note;
  els.speak.checked = !!prefs.speak;
  els.speak.disabled = !voice.available;
  els.voiceType.replaceChildren(...VOICE_TYPES.map((t) => option(t, v.types[t])));
  els.voiceType.value = VOICE_TYPES.includes(prefs.voiceType) ? prefs.voiceType : "any";
  els.voiceRate.replaceChildren(...VOICE_RATES.map((r) => option(r, `${r.toLocaleString(language)}×`)));
  els.voiceRate.value = String(VOICE_RATES.includes(Number(prefs.voiceRate)) ? Number(prefs.voiceRate) : 1);
  voice.fill(els.voiceName, v.voiceDefault);
  for (const row of els.voiceRows) row.hidden = !prefs.speak || !voice.available;
}

// Meters before plugin API 2 have no a2.window: the option then does nothing.
const windowApi = () => (a2.window && typeof a2.window.show === "function" ? a2.window : null);
// With the option on: shown while an alert's banner is up; otherwise hidden
// once nobody has used the window for IDLE_HIDE_MS.
let hideTimer = 0;
let lastUse = Date.now();
function updateWindow() {
  const api = windowApi();
  if (!api || !prefs.pop) return;
  clearTimeout(hideTimer);
  if (!els.banner.hidden) {
    api.show().catch(() => {});
    return;
  }
  hideTimer = setTimeout(() => {
    if (els.banner.hidden && Date.now() - lastUse >= IDLE_HIDE_MS - 50) api.hide().catch(() => {});
    else updateWindow();
  }, Math.max(0, IDLE_HIDE_MS - (Date.now() - lastUse)));
}
// Any use of the window counts: a click, a key, the wheel, the pointer moving
// over it (at most once a second, so moving doesn't reschedule constantly).
const windowInUse = () => Date.now() - lastUse < IDLE_HIDE_MS;
let lastScheduled = 0;
const used = () => {
  lastUse = Date.now();
  if (lastUse - lastScheduled < 1000) return;
  lastScheduled = lastUse;
  updateWindow();
};
for (const type of ["pointerdown", "keydown", "wheel", "pointermove"]) {
  document.addEventListener(type, used, { passive: true });
}
let bannerTimer = 0;
function clearBanner() {
  stopSound();
  stopSounds();
  clearTimeout(bannerTimer);
  lines.length = 0;
  renderLines();
  els.banner.hidden = true;
  showFull();
  updateWindow();
}
// An alert that brings up a hidden window ("keep this window hidden") shows
// only itself: the banner and a button to the full window, the window
// fitted to them (a2.window.fit, meter 2.0.65), until it is dismissed or the
// full window is asked for.
let alertOnly = false;
const canFit = () => !!(a2.window && typeof a2.window.fit === "function");
function fitToAlert() {
  if (!alertOnly || !canFit()) return;
  requestAnimationFrame(() => {
    const zoom = Number(document.documentElement.style.zoom) || 1;
    const pad = parseFloat(getComputedStyle(document.body).paddingTop) + parseFloat(getComputedStyle(document.body).paddingBottom);
    const height = Math.ceil((els.alertBox.getBoundingClientRect().height + pad) * zoom) + 2;
    a2.window.fit(height).catch(() => {});
  });
}
function showAlertOnly() {
  alertOnly = true;
  document.body.classList.add("alertOnly");
  els.openFull.hidden = false;
  fitToAlert();
}
function showFull() {
  if (!alertOnly) return;
  alertOnly = false;
  document.body.classList.remove("alertOnly");
  els.openFull.hidden = true;
  if (canFit()) a2.window.fit().catch(() => {});
}
els.openFull.addEventListener("click", showFull);

// Each alerting event on a line of its own, newest last (the last five).
function renderLines() {
  els.bannerText.replaceChildren(...lines.map((line) => {
    const div = document.createElement("div");
    div.className = "bannerLine";
    div.textContent = line;
    return div;
  }));
}

function alertBanner(message, { preview = false, key = null } = {}) {
  lines.push(message);
  while (lines.length > 5) lines.shift();
  renderLines();
  const wasHidden = els.banner.hidden;
  els.banner.hidden = false;
  // A preview (Test Alert) shows it as a real one would come, though the
  // window is in use.
  if (prefs.pop && windowApi() && (preview || (wasHidden ? !windowInUse() : alertOnly))) showAlertOnly();
  // Flash it, from the start each time an alert comes in.
  els.banner.classList.remove("pulse");
  void els.banner.offsetWidth;
  els.banner.classList.add("pulse");
  soundAlert(key);
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(clearBanner, BANNER_MS);
  updateWindow();
}
els.mute.addEventListener("click", () => {
  stopSound();
  stopSounds();
  stopSpeaking();
});
els.dismiss.addEventListener("click", clearBanner);

// Alerts: each goes off once, when its moment (the start less its lead)
// passes between one check and the next. Opening the window after the
// moment doesn't sound it late.
let lastCheck = Date.now();
const fired = new Set();
// An alert's leads in minutes: its own, and 0 as well with "Also alert as it
// starts".
const alsoAtStart = (minutes) => (prefs.alsoAtStart && minutes ? [minutes, 0] : [minutes]);
function checkAlerts(now) {
  // An alert pinned to come with its icon alone sounds, and leaves the
  // window as it is (pins.js).
  // As its icon (pins.js): the sound, and the icon shakes or glows; or as a
  // banner in this window. `key` is the alert whose settings apply.
  // `parts`: the line in English, for the built-in voice.
  const announce = (id, message, key = id, parts) => {
    if (typeof pinnedIconOnly === "function" && pinnedIconOnly(id)) soundAlert(key);
    else alertBanner(message, { key });
    speakAlert(message, key, parts);
  };
  const tz = timeZone();
  const a = aui();
  const words = ui();
  const closedNow = gameRunning === false;
  const minutesFor = (id) => {
    const m = closedNow ? Number(prefs.closedLeads[id] ?? defaultClosed()) : prefs.alerts[id];
    return m >= 0 ? m : null;
  };
  const due = (key, start, minutes) => {
    const at = start - minutes * 60_000;
    const k = `${closedNow ? "closed" : "open"}:${key}@${start}`;
    if (at > lastCheck && at <= now && !fired.has(k)) {
      fired.add(k);
      return true;
    }
    return false;
  };
  for (const ev of scheduled("event")) {
    if (!(ev.id in prefs.alerts) || (!tz && !ev.utc)) continue;
    const lead = minutesFor(ev.id);
    if (lead === null) continue;
    for (const minutes of alsoAtStart(lead)) {
      // The showing that is next once the lead is counted.
      const next = nextOf(ev, tz || "UTC", lastCheck + minutes * 60_000 - 1);
      if (next && due(`${ev.id}+${minutes}`, next.start, minutes)) {
        const name = text(ev.name);
        announce(ev.id, minutes ? a.soon(name, minutes) : a.now(name), ev.id,
          [SPOKEN.name(ev.name), minutes ? SPOKEN.soon(minutes) : SPOKEN.now]);
      }
    }
  }
  for (const b of fieldBosses()) {
    const id = `field:${b.id}`;
    const own = id in prefs.alerts;
    if (!own && !(ALL_FIELD in prefs.alerts)) continue;
    // The feed's own entry: its respawn time, which fieldTimer counts as up
    // once reached (the "is back" alert is at that time). A scheduled one's
    // comes from its schedule, the showing next once the lead is counted.
    const t = feedEntry(b.id);
    const ev = b.schedule && EVENTS.find((e) => e.id === b.schedule);
    if (!ev && (t?.state !== "dead" || !t.nextSpawn)) continue;
    const lead = minutesFor(own ? id : ALL_FIELD);
    if (lead === null) continue;
    for (const minutes of alsoAtStart(lead)) {
      const at = ev ? nextOf(ev, tz || "UTC", lastCheck + minutes * 60_000 - 1)?.start : t.nextSpawn * 1000;
      if (at && due(`${id}+${minutes}`, at, minutes)) {
        const name = text(b.name);
        announce(id, minutes ? words.bossSoon(name, minutes) : words.bossNow(name), own ? id : ALL_FIELD,
          [SPOKEN.name(b.name), minutes ? SPOKEN.bossSoon(minutes) : SPOKEN.bossNow]);
      }
    }
  }
  // World bosses being fought, for those who want to join (pins.js).
  if (typeof checkFights === "function") checkFights(now, announce);
  lastCheck = now;
}

// The world boss timers for the player's server: when the window opens, when
// the server changes, and every 15 minutes.
let feedTimer = 0;
// Whether `entry`'s HP belongs to the life `life` says is up: both up, and
// the HP reported since it spawned. Not by the same up-since: the site's
// comes from whoever saw the spawn (Aion 2 Timers' a few seconds off the
// game's), and with the player's own map newer, every live HP of that boss
// was dropped and its icon stayed a bare "up" (Kernon, 2026-10-24).
function hpOfLife(entry, life) {
  if (entry?.state !== "up" || life?.state !== "up" || entry.hp == null || !entry.hpAt) return false;
  return !life.upSince || Number(entry.hpAt) >= Number(life.upSince);
}
// The feed file just read, keeping the newer HP held (pushed live): the file
// is published at most once a minute, and each read put a boss's HP back up
// by as much as it had fallen since (Kusan, 2026-10-30).
function keepNewerHp(bosses, held) {
  const out = { ...bosses };
  for (const [id, have] of Object.entries(held || {})) {
    const read = out[id];
    if (read && hpOfLife(have, read) && (Number(have.hpAt) || 0) > (Number(read.hpAt) || 0)) {
      out[id] = { ...read, hp: have.hp, hpAt: have.hpAt };
    }
  }
  return out;
}
// Each boss's newest report, between the feed's and the player's own map's.
function mergeOwn(bosses) {
  const out = { ...bosses };
  if (ownMap.server !== serverId()) return out;
  for (const [id, mine] of Object.entries(ownMap.bosses)) {
    const known = out[id];
    if (known && (Number(known.reportedAt) || 0) > (Number(mine.reportedAt) || 0)) continue;
    // The map says nothing of HP: opening it mid-fight replaced the boss
    // with an entry without its HP, which came back only at the next HP
    // report. The same life still up keeps the HP it had.
    out[id] = known && hpOfLife(known, mine) ? { ...mine, hp: known.hp, hpAt: known.hpAt } : mine;
  }
  return out;
}
// Whether the server's world bosses change fast just now: one up, due within
// 15 minutes, or overdue (in its window).
function feedBusy(now) {
  return fieldBosses().some((b) => {
    const t = fieldTimer(b.id);
    if (t?.state === "up") return true;
    const next = t?.state === "dead" && t.nextSpawn ? t.nextSpawn * 1000 : 0;
    return next > 0 && next - now <= SOON_MS && now - next <= WINDOW_MS;
  });
}

let feedReading = false;
async function readFeed() {
  if (feedReading) return;
  clearTimeout(feedTimer);
  feedTimer = setTimeout(readFeed, FEED_EVERY_MS);
  const server = serverId();
  if (!server || typeof a2.bossTimers !== "function") return;
  feedReading = true;
  try {
    const data = await a2.bossTimers(server);
    const held = feed?.server === server ? feed.bosses : null;
    feed = { server, bosses: mergeOwn(keepNewerHp(data?.bosses || {}, held)), at: Date.now() };
  } catch {
    feed = { server, bosses: mergeOwn(feed?.server === server ? feed.bosses || {} : {}), error: true, at: Date.now() };
  } finally {
    feedReading = false;
  }
  // Sooner while it changes fast, and every few seconds while a pinned boss
  // is being waited for or fought.
  const pinned = typeof pinnedBossLive === "function" ? pinnedBossLive(Date.now()) : "";
  if (pinned || feedBusy(Date.now())) {
    clearTimeout(feedTimer);
    // Pushed live (pins.js): the feed only as a fallback.
    const live = typeof liveUp !== "undefined" && liveUp;
    feedTimer = setTimeout(readFeed, live && pinned ? 30_000 : pinned === "up" ? FEED_PINNED_UP_MS : pinned ? FEED_PINNED_MS : FEED_BUSY_MS);
  }
  render();
}

for (const tab of els.tabs) {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
}
els.sound.addEventListener("change", () => {
  prefs.sound = els.sound.value;
  savePrefs();
  playSound(prefs.sound);
});
// A sample alert, as a real one would come: banner, flash, sound and repeats.
const sampleAlert = () => {
  const ev = scheduled("event")[0];
  return aui().soon(ev ? text(ev.name) : "Shugo Festival", defaultLead());
};
const sampleParts = () => {
  const ev = scheduled("event")[0];
  const lead = defaultLead();
  return [ev ? SPOKEN.name(ev.name) : "Shugo Festival", lead ? SPOKEN.soon(lead) : SPOKEN.now];
};
const testAlert = () => {
  const message = sampleAlert();
  // Alerts as icons: a sample icon, as a real one comes (pins.js).
  if (typeof testIcon === "function" && typeof pinnedIconOnly === "function" && pinnedIconOnly()) {
    testIcon();
    speakAlert(message, null, sampleParts());
    return;
  }
  // The banner is at the top of the window: bring it into view.
  window.scrollTo({ top: 0 });
  alertBanner(message, { preview: true });
  speakAlert(message, null, sampleParts());
};
// Test Alert: one alert as a real one comes (picking a sound plays it).
els.testAlert.addEventListener("click", testAlert);
// Alerts → its options, in Settings.
els.alertOptionsBtn.addEventListener("click", () => {
  prefs.tab = "settings";
  savePrefs();
  renderTabs();
  els.alertSettings.scrollIntoView({ block: "start" });
});
// The volume, for every alert's sound; heard where the slider is let go.
els.volume.addEventListener("input", () => {
  prefs.volume = Number(els.volume.value);
  setSoundVolume(prefs.volume);
  savePrefs();
});
els.volume.addEventListener("change", () => {
  if (prefs.sound !== "off") playSound(prefs.sound);
});
// Spoken alerts: on or off, the voice's type, the voice, its speed.
els.speak.addEventListener("change", () => {
  prefs.speak = els.speak.checked;
  savePrefs();
  renderVoice();
  if (prefs.speak) voice?.say(sampleAlert(), sampleParts());
  else stopSpeaking();
});
els.voiceType.addEventListener("change", () => {
  prefs.voiceType = els.voiceType.value;
  // A voice of the other type gives way to the first of this one.
  if (voice && !voice.savedFits()) prefs.voiceName = "";
  savePrefs();
  renderVoice();
});
els.voiceName.addEventListener("change", () => {
  prefs.voiceName = els.voiceName.value;
  savePrefs();
  voice?.say(sampleAlert(), sampleParts());
});
els.voiceRate.addEventListener("change", () => {
  prefs.voiceRate = Number(els.voiceRate.value) || 1;
  savePrefs();
  voice?.say(sampleAlert(), sampleParts());
});
els.testVoice.addEventListener("click", () => {
  stopSpeaking();
  voice?.say(sampleAlert(), sampleParts());
});
els.repeat.addEventListener("change", () => {
  prefs.repeat = Number(els.repeat.value);
  savePrefs();
});
els.alsoAtStart.addEventListener("change", () => {
  prefs.alsoAtStart = els.alsoAtStart.checked;
  savePrefs();
});
els.pop.addEventListener("change", () => {
  prefs.pop = els.pop.checked;
  els.popNote.hidden = !prefs.pop;
  savePrefs();
  // Turned off: make sure the window is showing. Turned on: it hides shortly
  // unless an alert is up (time enough to read the note).
  if (!prefs.pop) windowApi()?.show().catch(() => {});
  else updateWindow();
});
els.zoneSelect.addEventListener("change", () => {
  prefs.display = els.zoneSelect.value;
  savePrefs();
  render();
});
// A new default: the alert list's dropdowns for alerts with no time of
// their own show it from now on.
els.defaultLead.addEventListener("change", () => {
  prefs.defaultLead = Number(els.defaultLead.value);
  savePrefs();
  renderAlerts();
});
els.defaultClosed.addEventListener("change", () => {
  prefs.defaultClosedLead = Number(els.defaultClosed.value);
  savePrefs();
  renderAlerts();
});
// Apply to current alerts: every alert that is on takes the defaults, once
// the player says yes (the plugin's frame may not use confirm()).
const closeModal = () => {
  els.modal.hidden = true;
};
els.applyAll.addEventListener("click", () => {
  const ids = Object.keys(prefs.alerts);
  if (!ids.length) return;
  els.modalText.textContent = ui().applyAsk(ids.length, leadText(defaultLead()), leadText(defaultClosed()));
  els.modal.hidden = false;
  els.modalYes.focus();
});
els.modalNo.addEventListener("click", closeModal);
els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.modal.hidden) closeModal();
});
els.modalYes.addEventListener("click", () => {
  for (const id of Object.keys(prefs.alerts)) {
    prefs.alerts[id] = defaultLead();
    prefs.leads[id] = defaultLead();
    prefs.closedLeads[id] = defaultClosed();
  }
  savePrefs();
  closeModal();
  renderAlerts();
  render();
});
els.colorSelect.addEventListener("change", () => {
  prefs.alertColor = els.colorSelect.value;
  savePrefs();
  applyColor();
});
els.scaleSelect.addEventListener("change", () => {
  prefs.scale = Number(els.scaleSelect.value);
  savePrefs();
  applyScale();
});
els.regionSelect.addEventListener("change", () => {
  prefs.region = els.regionSelect.value;
  savePrefs();
  render();
});
a2.on("character", (c) => {
  const before = serverId();
  character = c || null;
  const id = Number(character?.serverId);
  if (id >= 1000 && id !== Number(prefs.lastServer)) {
    prefs.lastServer = id;
    savePrefs();
  }
  renderAlerts();
  render();
  if (serverId() !== before) readFeed();
});
a2.on("language", (code) => {
  language = typeof code === "string" ? code : "en";
  renderStatic();
  render();
});
// A map the player just opened, from their own meter: their server's bosses,
// as of now (meter 2.0.65 on).
a2.on("bossMap", (m) => {
  const server = serverId();
  if (!server || !m || typeof m.bosses !== "object") return;
  if (ownMap.server !== server) ownMap = { server, bosses: {} };
  Object.assign(ownMap.bosses, m.bosses);
  const base = feed?.server === server ? feed.bosses || {} : {};
  feed = { ...(feed?.server === server ? feed : {}), server, bosses: mergeOwn(base), at: Date.now(), error: false };
  render();
});

// Whether AION2 is open (meter 2.0.65 on).
a2.on("game", (g) => {
  gameRunning = typeof g?.running === "boolean" ? g.running : null;
});
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  prefs = { ...prefs, ...((await a2.storage.get("prefs").catch(() => null)) || {}) };
  prefs.closedLeads = prefs.closedLeads || {};
  // 0.6.22 and before listed the Abyss's scheduled bosses as events: their
  // alerts, times and icon settings go to the world bosses they are.
  let moved = false;
  for (const [evId, ids] of Object.entries(ABYSS_SPAWNS)) {
    for (const store of [prefs.alerts, prefs.leads, prefs.closedLeads, prefs.overrides || {}]) {
      if (!store || !(evId in store)) continue;
      for (const id of ids) store[`field:${id}`] ??= store[evId];
      delete store[evId];
      moved = true;
    }
  }
  if (moved) savePrefs();
  setSoundVolume(prefs.volume);
  // The old single "timers" tab is the events one now.
  if (!els.views[prefs.tab] && prefs.tab !== "both") prefs.tab = "events";
  prefs.timerViews = timerViews();
  applyScale();
  applyColor();
  renderStatic();
  render();
  lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    checkAlerts(now);
    render();
    if (typeof updatePins === "function") updatePins(now);
  }, 1000);
  if (!windowApi()) {
    els.pop.disabled = true;
    els.pop.parentElement.title = "Needs a newer meter";
  }
  await a2.ready();
  readFeed();
  setTimeout(updateWindow, 1500);
})();
