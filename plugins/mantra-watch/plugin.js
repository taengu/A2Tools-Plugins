// Mantra Watch: your mantras on or off, how many party members each reaches,
// an alert the moment one drops in a fight, and each fight's uptime.
const { MANTRAS, tickOf, isFightHit, Fight, TICK_MS, DROP_MS, FIGHT_IDLE_MS, MIN_FIGHT_MS, LANDED_QUIET_MS, LOAD_QUIET_MS, BEFORE_FIGHT_MS } =
  globalThis.MantraLogic;
const $ = (sel, root = document) => root.querySelector(sel);

// The mantras' names in the meter's languages, from its skill list.
const NAMES = {
  de: { 1816: "Invokation des Sprints", 1819: "Invokation der Unbesiegbarkeit" },
  en: { 1816: "Sprint Mantra", 1819: "Undefeated Mantra" },
  es: { 1816: "Proclama de esprint", 1819: "Proclama del invicto" },
  fr: { 1816: "Mantra de sprint", 1819: "Mantra d'invincibilité" },
  ja: { 1816: "疾走のマントラ", 1819: "不敗のマントラ" },
  ko: { 1816: "질주의 진언", 1819: "불패의 진언" },
  pt: { 1816: "Mantra da Disparada", 1819: "Mantra do Imbatível" },
  ru: { 1816: "Заклятие ускорения", 1819: "Песнь непобедимости" },
  "zh-Hans": { 1816: "疾走真言", 1819: "不败真言" },
  "zh-Hant": { 1816: "疾走真言", 1819: "不敗真言" },
};
let lang = "en";
const nameOf = (m) => (NAMES[lang] || NAMES.en)[m];

// Everything else the page says, in the same languages (the class name as
// the meter has it).
const UI = {
  en: { alertWhen: "Alert when one drops", inFight: "In a fight", always: "Always", never: "Never", sound: "Sound", volume: "Volume",
    alarm: "Alarm", chime: "Chime", ping: "Ping", none: "None", test: "Test", settings: "Settings", watch: "Watch",
    reaches: "Party members it reaches", notChanter: "Not a Chanter: no alerts", fighting: "Fighting",
    noFight: "No fight yet", lastFight: "Last fight", lastN: (n) => `last ${n}`, off: (name) => `${name} is off!`,
    coveredOther: "Other Chanter; your toggle is unknown", dismiss: "Click to dismiss until it is back on" },
  ko: { alertWhen: "꺼지면 알림", inFight: "전투 중", always: "항상", never: "안 함", sound: "소리", volume: "음량",
    alarm: "경보", chime: "차임", ping: "핑", none: "없음", test: "테스트", settings: "설정", watch: "감시",
    reaches: "닿는 파티원 수", notChanter: "호법성이 아님: 알림 없음", fighting: "전투 중",
    noFight: "아직 전투 없음", lastFight: "지난 전투", lastN: (n) => `최근 ${n}회`, off: (name) => `${name} 꺼짐!`,
    coveredOther: "다른 호법성의 효과 · 내 토글 상태는 미확인", dismiss: "클릭하면 다시 켜질 때까지 숨깁니다" },
  ja: { alertWhen: "切れたら通知", inFight: "戦闘中", always: "常に", never: "しない", sound: "サウンド", volume: "音量",
    alarm: "アラーム", chime: "チャイム", ping: "ピン", none: "なし", test: "テスト", settings: "設定", watch: "監視",
    reaches: "届いているパーティーメンバー", notChanter: "チャンターではありません: 通知なし", fighting: "戦闘中",
    noFight: "まだ戦闘なし", lastFight: "前回の戦闘", lastN: (n) => `直近${n}回`, off: (name) => `${name}が切れています！`,
    coveredOther: "他のチャンターの効果・自身の切替は未確認", dismiss: "クリックすると、再び有効になるまで隠します" },
  de: { alertWhen: "Alarm, wenn eine ausfällt", inFight: "Im Kampf", always: "Immer", never: "Nie", sound: "Ton", volume: "Lautstärke",
    alarm: "Alarm", chime: "Glocke", ping: "Ping", none: "Keiner", test: "Test", settings: "Einstellungen", watch: "Beobachten",
    reaches: "Gruppenmitglieder in Reichweite", notChanter: "Kein Kantor: keine Alarme", fighting: "Im Kampf",
    noFight: "Noch kein Kampf", lastFight: "Letzter Kampf", lastN: (n) => `letzte ${n}`, off: (name) => `${name} ist aus!`,
    coveredOther: "Anderer Kantor; eigener Schalter unbekannt", dismiss: "Klicken: ausblenden, bis sie wieder an ist" },
  fr: { alertWhen: "Alerter quand un tombe", inFight: "En combat", always: "Toujours", never: "Jamais", sound: "Son", volume: "Volume",
    alarm: "Alarme", chime: "Carillon", ping: "Ping", none: "Aucun", test: "Tester", settings: "Réglages", watch: "Surveiller",
    reaches: "Membres du groupe touchés", notChanter: "Pas un Aède : aucune alerte", fighting: "En combat",
    noFight: "Pas encore de combat", lastFight: "Dernier combat", lastN: (n) => `${n} derniers`, off: (name) => `${name} est coupé !`,
    coveredOther: "Autre Aède ; votre activation reste inconnue", dismiss: "Cliquer : masquer jusqu'à son retour" },
  es: { alertWhen: "Avisar si uno se corta", inFight: "En combate", always: "Siempre", never: "Nunca", sound: "Sonido", volume: "Volumen",
    alarm: "Alarma", chime: "Campana", ping: "Ping", none: "Ninguno", test: "Probar", settings: "Ajustes", watch: "Vigilar",
    reaches: "Miembros del grupo alcanzados", notChanter: "No eres Conjurador: sin avisos", fighting: "En combate",
    noFight: "Aún sin combate", lastFight: "Último combate", lastN: (n) => `últimos ${n}`, off: (name) => `¡${name} está apagado!`,
    coveredOther: "Otro Conjurador; tu activación es desconocida", dismiss: "Clic: ocultar hasta que vuelva" },
  pt: { alertWhen: "Avisar quando um cair", inFight: "Em combate", always: "Sempre", never: "Nunca", sound: "Som", volume: "Volume",
    alarm: "Alarme", chime: "Sino", ping: "Ping", none: "Nenhum", test: "Testar", settings: "Configurações", watch: "Vigiar",
    reaches: "Membros do grupo alcançados", notChanter: "Não é Encantador: sem avisos", fighting: "Em combate",
    noFight: "Nenhum combate ainda", lastFight: "Último combate", lastN: (n) => `últimos ${n}`, off: (name) => `${name} está desligado!`,
    coveredOther: "Outro Encantador; sua ativação é desconhecida", dismiss: "Clique: ocultar até voltar" },
  ru: { alertWhen: "Оповещать, если спадёт", inFight: "В бою", always: "Всегда", never: "Никогда", sound: "Звук", volume: "Громкость",
    alarm: "Тревога", chime: "Звон", ping: "Пинг", none: "Нет", test: "Проверить", settings: "Настройки", watch: "Следить",
    reaches: "Сколько участников группы затронуто", notChanter: "Не Чародей: без оповещений", fighting: "Бой",
    noFight: "Боёв ещё не было", lastFight: "Последний бой", lastN: (n) => `последние ${n}`, off: (name) => `${name} не действует!`,
    coveredOther: "Другой Чародей; ваш переключатель не определён", dismiss: "Нажмите, чтобы скрыть до включения" },
  "zh-Hans": { alertWhen: "中断时提醒", inFight: "战斗中", always: "总是", never: "从不", sound: "声音", volume: "音量",
    alarm: "警报", chime: "钟声", ping: "提示音", none: "无", test: "试听", settings: "设置", watch: "监视",
    reaches: "覆盖的队友数", notChanter: "不是护法圣：不提醒", fighting: "战斗中",
    noFight: "还没有战斗", lastFight: "上次战斗", lastN: (n) => `最近 ${n} 场`, off: (name) => `${name} 已中断！`,
    coveredOther: "由其他护法圣覆盖；自己的开关状态未知", dismiss: "点击隐藏，直到它重新开启" },
  "zh-Hant": { alertWhen: "中斷時提醒", inFight: "戰鬥中", always: "總是", never: "從不", sound: "音效", volume: "音量",
    alarm: "警報", chime: "鐘聲", ping: "提示音", none: "無", test: "試聽", settings: "設定", watch: "監視",
    reaches: "涵蓋的隊友數", notChanter: "不是護法聖：不提醒", fighting: "戰鬥中",
    noFight: "還沒有戰鬥", lastFight: "上次戰鬥", lastN: (n) => `最近 ${n} 場`, off: (name) => `${name} 已中斷！`,
    coveredOther: "由其他護法聖涵蓋；自己的開關狀態未知", dismiss: "點擊隱藏，直到它重新開啟" },
};
const ui = () => UI[lang] || UI.en;

// ── State ──────────────────────────────────────────────────────────────────
// Events older than this are the meter's replay of what came before the
// window opened: no use for what is on now.
const STALE_MS = 5_000;
const lastTick = {}; // mantra -> when your aura last ticked on anyone
const lastPeerTick = {}; // mantra -> another Chanter's latest tick on you
const reach = {}; // mantra -> Map(entity -> last tick on them)
let fight = null;
let lastHit = 0;
let quietUntil = 0; // no alert before this: a teleport is loading
let epoch = 0; // observations from a previous character cannot return
// watch: mantra -> false for one the player doesn't want alerts for.
// volume: the alert's loudness, 0-100 %.
const prefs = { alert: "fight", sound: "alarm", watch: {}, volume: 100 };
let fights = []; // the last fights: { at, length, uptime: { mantra: 0..1 }, who }

const isOn = (m, now) => now - (lastTick[m] || 0) < DROP_MS;
const isCovered = (m, now) => !!lastPeerTick[m] && now - lastPeerTick[m] >= 0 && now - lastPeerTick[m] < DROP_MS;
const inFight = (now) => fight && now - lastHit < FIGHT_IDLE_MS;
const eventAt = (meta) => {
  const at = meta?.at;
  const now = Date.now();
  const observed = meta?.character;
  if (observed?.name && who && `${observed.name}@${observed.serverId}` !== who) return null;
  return Number.isFinite(at) && at > 0 && at >= epoch && at <= now && now - at <= STALE_MS ? at : null;
};

// ── Records ────────────────────────────────────────────────────────────────
a2.on("decoded:mantra-tick", (d, meta) => {
  const t = tickOf(d);
  const at = eventAt(meta);
  if (!t || at === null) return;
  // The host filters caster=self. A pulse on an ally still establishes your
  // aura's activity when another Chanter supplies the effective copy on you.
  if (at >= (lastTick[t.mantra] || 0)) {
    lastTick[t.mantra] = at;
    fight?.tick(t.mantra, at);
  }
  if (!t.onMe) {
    const targets = (reach[t.mantra] ||= new Map());
    targets.set(t.on, Math.max(targets.get(t.on) || 0, at));
  }
  update();
});
// A separate recipient=self decoder observes coverage from another Chanter.
// It does not establish that your own toggle is on, and never adds party reach
// or your aura's uptime. Keep those ownership meanings separate.
a2.on("decoded:mantra-cover", (d, meta) => {
  const t = tickOf(d);
  const at = eventAt(meta);
  if (!t || t.onMe || at === null) return;
  lastPeerTick[t.mantra] = Math.max(lastPeerTick[t.mantra] || 0, at);
  update();
});
// Someone your mantras reached in the last minute: a party member, whom a
// heal or a buff is no fight with.
const isAlly = (id) => MANTRAS.some((m) => Date.now() - (reach[m]?.get(id) || 0) < 60_000);
a2.on("decoded:my-hit", (d, meta) => {
  const at = meta.at || Date.now();
  if (!isFightHit(d, isAlly) || Date.now() - at > STALE_MS) return;
  if (!inFight(at)) {
    endFight();
    fight = new Fight(at);
    // A tick just before the first hit still covers its start.
    for (const m of MANTRAS) if (at - (lastTick[m] || 0) < TICK_MS) fight.tick(m, lastTick[m]);
  }
  fight.hit(at);
  lastHit = at;
  update();
});

// A teleport ends the fight, and the ticks it pauses are no drop.
a2.on("decoded:map-load", (_d, meta) => {
  const at = meta.at || Date.now();
  if (Date.now() - at > STALE_MS) return;
  endFight();
  for (const m of MANTRAS) reach[m]?.clear();
  for (const m of MANTRAS) delete lastPeerTick[m];
  quietUntil = at + LOAD_QUIET_MS;
  update();
});
a2.on("decoded:landed", (_d, meta) => {
  const at = meta.at || Date.now();
  if (Date.now() - at > STALE_MS) return;
  quietUntil = at + LANDED_QUIET_MS;
  update();
});

// Another character: what was on is the last one's. A class the meter knows
// that isn't Chanter has no mantras, so no alert (null: not known yet).
const CHANTER = "호법성"; // the meter names classes in Korean
let who = null;
let chanter = null;
a2.on("character", (c) => {
  const key = c?.name ? `${c.name}@${c.serverId}` : null;
  if (key && who && key !== who) {
    epoch = Date.now();
    fight = null;
    lastHit = 0;
    for (const m of MANTRAS) {
      delete lastTick[m];
      delete lastPeerTick[m];
      reach[m]?.clear();
    }
  }
  if (key) who = key;
  chanter = c?.class ? c.class === CHANTER : null;
  update();
});

function endFight() {
  if (!fight) return;
  const f = fight;
  fight = null;
  const length = f.last - f.start;
  if (length < MIN_FIGHT_MS) return;
  const uptime = Object.fromEntries(MANTRAS.map((m) => [m, f.uptime(m)]));
  // A fight with no mantra at all is likely not a Chanter's: not kept.
  if (!MANTRAS.some((m) => uptime[m] > 0)) return;
  fights = [{ at: f.start, length, uptime, who }, ...fights].slice(0, 40);
  a2.storage.set("fights", fights).catch(() => {});
}

// ── Drawing and alerts ─────────────────────────────────────────────────────
const rows = {};
for (const m of MANTRAS) {
  const li = document.createElement("li");
  li.innerHTML = '<span class="dot"></span><span class="label"><span class="name"></span><span class="coverage"></span></span><span class="reach"></span>';
  $(".mantras").append(li);
  rows[m] = li;
}
const pct = (x) => `${Math.round(x * 100)}%`;
const mmss = (ms) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

let dropped = new Set(); // mantras the alert is up for
let hideAfterAlert = false;
let lastUse = 0;
for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, () => (lastUse = Date.now()), true);

function update() {
  const now = Date.now();
  if (fight && !inFight(now)) endFight();
  for (const m of MANTRAS) {
    const li = rows[m];
    const on = isOn(m, now);
    const covered = !on && isCovered(m, now);
    li.classList.toggle("on", on);
    li.classList.toggle("covered", covered);
    li.classList.toggle("seen", !!lastTick[m] || covered);
    $(".name", li).textContent = nameOf(m);
    $(".coverage", li).textContent = covered ? ui().coveredOther : "";
    const n = [...(reach[m] || new Map()).values()].filter((at) => now - at < DROP_MS).length;
    $(".reach", li).textContent = on && n ? `+${n}` : "";
    $(".reach", li).title = ui().reaches;
  }
  $(".fight").textContent = chanter === false ? ui().notChanter
    : fight ? `${ui().fighting} ${mmss(fight.last - fight.start)} · ${MANTRAS.map((m) => pct(fight.uptime(m))).join(" · ")}`
      : lastFightText();
  checkDrops(now);
}

// This character's last fight, and its average over the last 10 (fights from
// before characters were told apart count for whoever plays).
function lastFightText() {
  const mine = fights.filter((f) => !f.who || !who || f.who === who);
  if (!mine.length) return ui().noFight;
  const f = mine[0];
  const recent = mine.slice(0, 10);
  const avg = MANTRAS.map((m) => pct(recent.reduce((s, x) => s + (x.uptime[m] || 0), 0) / recent.length));
  return `${ui().lastFight} ${mmss(f.length)} · ${MANTRAS.map((m) => pct(f.uptime[m] || 0)).join(" · ")}`
    + (recent.length > 1 ? ` (${ui().lastN(recent.length)}: ${avg.join(" · ")})` : "");
}

// A mantra that was up and stopped ticking: in a fight (or always, or never,
// as chosen). The alert goes when it is back, or the fight is over. In a
// fight, only a mantra that was on in it or just before it: one switched off
// well before the fight is the player's choice. A click on the banner
// dismisses it until that mantra is on again (switched off on purpose
// mid-fight); a mantra not watched never alerts.
const dismissed = new Set();
function checkDrops(now) {
  for (const m of MANTRAS) if (isOn(m, now) || isCovered(m, now)) dismissed.delete(m);
  const watching = chanter !== false && now >= quietUntil && (prefs.alert === "always" || (prefs.alert === "fight" && inFight(now)));
  const since = prefs.alert === "fight" && fight ? fight.start - BEFORE_FIGHT_MS : now - 60_000 * 10;
  const nowDropped = new Set(
    watching
      ? MANTRAS.filter((m) => prefs.watch[m] !== false && !dismissed.has(m) && lastTick[m] && !isOn(m, now) && !isCovered(m, now) && lastTick[m] >= since)
      : [],
  );
  const fresh = [...nowDropped].filter((m) => !dropped.has(m));
  if (fresh.length) {
    if (!dropped.size) hideAfterAlert = Date.now() - lastUse > 60_000;
    playSound(prefs.sound);
    a2.window?.show().catch(() => {});
  }
  dropped = nowDropped;
  $(".banner").hidden = !dropped.size;
  $(".banner").textContent = [...dropped].map((m) => ui().off(nameOf(m))).join(" ");
  $(".banner").title = ui().dismiss;
  for (const m of MANTRAS) rows[m].classList.toggle("dropped", dropped.has(m));
  if (!dropped.size && hideAfterAlert && !fresh.length) {
    hideAfterAlert = false;
    a2.window?.hide().catch(() => {});
  }
}

// ── Sounds (no files: notes made with Web Audio) ───────────────────────────
const SOUNDS = {
  alarm: [
    [988, 0, 0.14, "square", 0.07], [784, 0.16, 0.14, "square", 0.07],
    [988, 0.32, 0.14, "square", 0.07], [784, 0.48, 0.14, "square", 0.07],
  ],
  chime: [[880, 0, 0.45, "sine", 0.25], [1320, 0.16, 0.5, "sine", 0.25]],
  ping: [[1760, 0, 0.3, "sine", 0.22], [1760, 0.35, 0.3, "sine", 0.14]],
};
let audio = null;
// Every note goes out through one gain, the Volume setting: squared, so the
// slider follows how loud it sounds.
let out = null;
// An AudioContext is an audio engine of its own: on Linux a GStreamer
// pipeline with its own thread and buffers, some 40 MB, kept for the whole
// run (2026-10-29). Closed once nothing has played for IDLE_MS, made again
// for the next sound; decoded clips (AudioBuffers) work in the new one.
const IDLE_MS = 30_000;
let idleClose = null;
function audioUsed() {
  clearTimeout(idleClose);
  idleClose = setTimeout(() => {
    const ctx = audio;
    audio = null;
    out = null;
    ctx?.close().catch(() => {});
  }, IDLE_MS);
}
const gainOf = (percent) => Math.pow(Math.max(0, Math.min(100, Number(percent) || 0)) / 100, 2);
function setVolume() {
  if (out) out.gain.value = gainOf(prefs.volume);
}
function playSound(name) {
  const notes = SOUNDS[name];
  if (!notes) return;
  try {
    audio ||= new AudioContext();
    audioUsed();
    if (!out) {
      out = audio.createGain();
      out.connect(audio.destination);
      setVolume();
    }
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
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  } catch (e) {
    console.warn(e);
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
$(".gear").addEventListener("click", () => {
  $(".settings").hidden = !$(".settings").hidden;
});
$(".banner").addEventListener("click", () => {
  for (const m of dropped) dismissed.add(m);
  update();
});
// Which mantras to alert for: one per mantra, on unless turned off.
const watchBoxes = {};
for (const m of MANTRAS) {
  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.addEventListener("change", () => {
    if (box.checked) delete prefs.watch[m];
    else prefs.watch[m] = false;
    a2.storage.set("prefs", prefs).catch(() => {});
    update();
  });
  label.append(box, document.createElement("span"));
  $(".watch").append(label);
  watchBoxes[m] = label;
}
// The page's words in the meter's language.
function applyTexts() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = ui()[el.dataset.t];
  $(".gear").title = ui().settings;
  for (const m of MANTRAS) {
    $("span", watchBoxes[m]).textContent = `${ui().watch}: ${nameOf(m)}`;
    $("input", watchBoxes[m]).checked = prefs.watch[m] !== false;
  }
}
for (const key of ["alert", "sound"]) {
  $(`.${key}`).addEventListener("change", (e) => {
    prefs[key] = e.target.value;
    a2.storage.set("prefs", prefs).catch(() => {});
    update();
  });
}
$(".volume").addEventListener("input", (e) => {
  prefs.volume = Number(e.target.value);
  setVolume();
  a2.storage.set("prefs", prefs).catch(() => {});
});
// Heard where the slider is let go.
$(".volume").addEventListener("change", () => playSound(prefs.sound));
$(".test").addEventListener("click", () => playSound(prefs.sound));
a2.on("language", (code) => {
  lang = code in NAMES ? code : "en";
  applyTexts();
  update();
});
a2.on("compact", (on) => document.body.classList.toggle("compact", !!on));

(async () => {
  const [savedPrefs, savedFights] = await Promise.all([a2.storage.get("prefs").catch(() => null), a2.storage.get("fights").catch(() => null)]);
  Object.assign(prefs, savedPrefs || {});
  prefs.watch ||= {};
  if (Array.isArray(savedFights)) fights = savedFights;
  applyTexts();
  $(".alert").value = prefs.alert;
  $(".sound").value = prefs.sound;
  $(".volume").value = String(prefs.volume);
  update();
  a2.ready();
  setInterval(update, 250);
})();
