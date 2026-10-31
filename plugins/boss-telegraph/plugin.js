// Boss Callouts (once Enhanced Boss Telegraph): a boss's lines and mechanics spoken and shown in big text.
// The rules are in logic.js; this page holds the settings, the voice and the
// widget. Nothing leaves the computer: no network, only the meter's storage.
const $ = (s) => document.querySelector(s);
const DATA = window.BOSS_CALLOUTS || { langs: ["en"], texts: [], groups: {}, bosses: {}, calls: [] };

const DEFAULTS = {
  enabled: true, widget: true, style: "both",
  size: "60", fg: "#ffff00", safe: "#66ff66", bg: "#000000", bgOpacity: 85,
  volume: 100, voiceName: "", rate: "1",
  offBoss: {}, offCall: {}, waves: {}, custom: {},
  // This window's own text size (Look): the whole page scaled, for reduced vision.
  menuSize: "1",
};
let prefs = { ...DEFAULTS };
let lang = "en";
let words = UI.en;
let gameOpen = false;
let locked = false;

const T = (i) => {
  if (i == null) return "";
  const t = DATA.texts[i];
  return (t && (t[lang] || t.en)) || "";
};
const save = () => a2.storage.set("prefs", prefs).catch(() => {});

// ---- The voice ---------------------------------------------------------

// The computer's voices come a moment after the page opens (voiceschanged).
// With none (Linux: the meter's web view has no speech), the built-in voice
// speaks: every line in English, made with Kokoro (voice.js).
const synth = window.speechSynthesis || null;
const KOKORO = "kokoro";
const CLIPS = window.BOSS_VOICE || {};
const hasClips = Object.keys(CLIPS).length > 0;
// Each text in every language, to its English (the clips' keys).
const toEnglish = new Map();
for (const t of DATA.texts) if (t && t.en) for (const s of Object.values(t)) if (s) toEnglish.set(s, t.en);
for (const w of Object.values(UI)) if (w.preview) toEnglish.set(w.preview, UI.en.preview);
let voices = [];
function loadVoices() {
  voices = synth?.getVoices?.() || [];
  fillVoices();
  showVoiceNote();
}
// A voice in the meter's language: for Traditional Chinese the Taiwan and
// Hong Kong voices, for Simplified the others.
const TRAD = /^zh[-_](tw|hk|mo|hant)/i;
function inLanguage(v) {
  const base = lang.split("-")[0].toLowerCase();
  const vl = (v.lang || "").toLowerCase();
  if (!vl.startsWith(base)) return false;
  if (base !== "zh") return true;
  return lang === "zh-Hant" ? TRAD.test(vl) : !TRAD.test(vl);
}
const sameBase = (v) => (v.lang || "").toLowerCase().startsWith(lang.split("-")[0].toLowerCase());
function pickVoice() {
  if (prefs.voiceName) {
    const v = voices.find((x) => x.voiceURI === prefs.voiceName || x.name === prefs.voiceName);
    if (v) return v;
  }
  return voices.find(inLanguage) || voices.find(sameBase) || null;
}
// The built-in voice: chosen, or the computer has none. On Windows the list
// is empty for a moment after the page opens, so "none" counts only once it
// has come (voiceschanged) or 1.5 s have passed; meanwhile the computer's
// default voice speaks.
let voicesSettled = false;
setTimeout(() => { voicesSettled = true; }, 1500);
const builtIn = () => hasClips && (prefs.voiceName === KOKORO || !synth || (voicesSettled && !voices.length));
const volumeGain = (percent) => Math.pow(Math.max(0, Math.min(100, Number(percent) || 0)) / 100, 2);

// What is waiting to be said: two at most. A new mechanic ("high") cuts off
// a boss's line still being read ("low") or a backlog, so the call that
// matters now is heard now; a line that comes while two wait is dropped.
const saying = new Map(); // utterance -> { at, prio }
function say(text, prio = "high") {
  if (!text || prefs.volume <= 0) return;
  // The built-in voice says only its own lines: the player's own words for a
  // call go to the computer's voices, when it has any.
  if (builtIn() && (clip(text) || !synth || !voices.length)) return sayBuiltIn(text, prio);
  if (!synth) return;
  const now = Date.now();
  for (const [u, s] of saying) if (now - s.at > 15_000) saying.delete(u);
  const lowWaiting = [...saying.values()].some((s) => s.prio === "low");
  if (prio === "high" && (saying.size >= 2 || lowWaiting)) {
    synth.cancel();
    saying.clear();
  } else if (prio === "low" && saying.size >= 2) {
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || lang;
  u.rate = Number(prefs.rate) || 1;
  u.pitch = 1;
  u.volume = volumeGain(prefs.volume);
  u.onend = u.onerror = () => saying.delete(u);
  saying.set(u, { at: now, prio });
  synth.speak(u);
}

// The built-in voice, through Web Audio (the page may load no audio files,
// so the clips are decoded from their bytes), with the same queue: the one
// playing and one waiting, a "high" one cutting off a "low" one or a backlog.
let audio = null;
// An AudioContext is an audio engine of its own: on Linux a GStreamer
// pipeline with its own thread and buffers, some 40 MB, kept for the whole
// run (2026-10-29). Closed once nothing has played for IDLE_MS, made again
// for the next sound; decoded clips (AudioBuffers) work in the new one.
const IDLE_MS = 30_000;
let idleClose = null;
function audioUsed() {
  clearTimeout(idleClose);
  idleClose = setTimeout(() => {
    // Not while a line is still being said.
    if (playing && Date.now() < playing.until) return audioUsed();
    const ctx = audio;
    audio = null;
    ctx?.close().catch(() => {});
  }, IDLE_MS);
}
const context = () => {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  audioUsed();
  if (audio.state !== "running") audio.resume().catch(() => {});
  return audio;
};
const decoded = new Map(); // English text -> Promise<AudioBuffer>
const stretched = new Map(); // "rate|text" -> AudioBuffer
let playing = null; // { node, prio, until }
let waiting = []; // [{ text, prio }]
function clip(text) {
  const en = CLIPS[text] ? text : toEnglish.get(text);
  if (!en || !CLIPS[en]) return null;
  if (!decoded.has(en)) {
    const bytes = Uint8Array.from(atob(CLIPS[en]), (c) => c.charCodeAt(0));
    decoded.set(en, context().decodeAudioData(bytes.buffer));
  }
  return { en, buffer: decoded.get(en) };
}
function sayBuiltIn(text, prio) {
  if (!clip(text)) return;
  // A clip whose end never came (the audio output stopped) holds no one up.
  if (playing && Date.now() > playing.until) stopPlaying();
  const lowWaiting = (playing && playing.prio === "low") || waiting.some((w) => w.prio === "low");
  const count = (playing ? 1 : 0) + waiting.length;
  if (prio === "high" && (count >= 2 || lowWaiting)) {
    waiting = [];
    stopPlaying();
  } else if (prio === "low" && count >= 2) {
    return;
  }
  waiting.push({ text, prio });
  if (!playing) playNext();
}
function stopPlaying() {
  const p = playing;
  playing = null;
  // A clip still decoding has no node yet: playNext sees it was cut off.
  if (p?.node) {
    p.node.onended = null;
    try {
      p.node.stop();
    } catch {
      /* not started yet */
    }
  }
}
async function playNext() {
  const next = waiting.shift();
  if (!next) return;
  const c = clip(next.text);
  const rate = Number(prefs.rate) || 1;
  const slot = { node: null, prio: next.prio, until: Date.now() + 5000 };
  playing = slot;
  let buffer;
  try {
    buffer = await c.buffer;
    if (rate !== 1) {
      const key = `${rate}|${c.en}`;
      if (!stretched.has(key)) stretched.set(key, stretch(context(), buffer, rate));
      buffer = stretched.get(key);
    }
  } catch {
    buffer = null;
  }
  if (playing !== slot) return; // cut off while it decoded
  if (!buffer) {
    playing = null;
    return playNext();
  }
  const ctx = context();
  const node = ctx.createBufferSource();
  node.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volumeGain(prefs.volume);
  node.connect(gain).connect(ctx.destination);
  slot.node = node;
  slot.until = Date.now() + (buffer.duration * 1000) + 1000;
  node.onended = () => {
    if (playing === slot) playing = null;
    playNext();
  };
  node.start();
}

// Faster or slower at the same pitch (WSOLA): 30 ms windows laid half over
// each other, each taken from where it best continues the last, within 10 ms
// of where the speed puts it. The search looks at every 4th sample, so a
// clip takes a few milliseconds.
function stretch(ctx, buffer, rate) {
  const x = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const N = Math.round(sr * 0.03) & ~1;
  const H = N / 2; // output hop
  const tol = Math.round(sr * 0.01);
  const frames = Math.max(1, Math.floor((x.length / rate - N) / H) + 1);
  const y = new Float32Array((frames - 1) * H + N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  let prev = 0; // input start of the last frame
  for (let k = 0; k < frames; k++) {
    let pos = Math.round(k * H * rate);
    if (k > 0) {
      // The last frame's natural continuation, matched against candidates.
      const want = prev + H;
      let best = 0;
      let bestScore = -Infinity;
      for (let d = -tol; d <= tol; d += 4) {
        const p = pos + d;
        if (p < 0 || p + H > x.length || want + H > x.length) continue;
        let s = 0;
        for (let i = 0; i < H; i += 4) s += x[want + i] * x[p + i];
        if (s > bestScore) {
          bestScore = s;
          best = d;
        }
      }
      pos = Math.max(0, pos + best);
    }
    for (let i = 0; i < N && pos + i < x.length; i++) y[k * H + i] += x[pos + i] * win[i];
    prev = pos;
  }
  const out = ctx.createBuffer(1, y.length, sr);
  out.copyToChannel(y, 0);
  return out;
}

// A wave's beep: short, high, at the volume.
function beep() {
  if (prefs.volume <= 0) return;
  try {
    const audio = context();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = 1320;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25 * volumeGain(prefs.volume) + 0.0001, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch {
    /* no audio: the widget still shows */
  }
}

// ---- The widget --------------------------------------------------------

let shown = [];
const engine = BossLogic.create(DATA, {
  now: () => Date.now(),
  prefs: () => prefs,
  lang: () => lang,
  say,
  beep,
  show: (items) => {
    shown = items;
    send();
  },
});

let widgetOpen = false;
let lastSize = "";
const widgetSize = () => {
  const s = Number(prefs.size) || 60;
  return { width: Math.round(Math.min(1100, Math.max(520, s * 13))), height: Math.round(s * 3.4 + 48) };
};
async function placeWidget() {
  const want = prefs.enabled && prefs.widget && gameOpen;
  const size = JSON.stringify(widgetSize());
  if (!want) {
    if (widgetOpen) await a2.widgets.close("callout").catch(() => {});
    widgetOpen = false;
    lastSize = "";
    return;
  }
  if (!widgetOpen || size !== lastSize) {
    await a2.widgets.open("callout", widgetSize()).catch(() => {});
    widgetOpen = true;
    lastSize = size;
  }
  send();
}
function send() {
  if (!widgetOpen) return;
  const look = { size: Number(prefs.size) || 60, fg: prefs.fg, safe: prefs.safe, bg: prefs.bg, bgOpacity: prefs.bgOpacity / 100 };
  const items = shown.slice(0, 2).map(({ kind, text, sub, end, until }) => ({ kind, text, sub, end, until }));
  a2.widgets.send("callout", { look, items, preview: { text: words.preview, sub: words.previewSub } }).catch(() => {});
}

// ---- The page ----------------------------------------------------------

const els = {
  enabled: $(".enabled"), widget: $(".widget"), style: $(".style"),
  size: $(".size"), fg: $(".fg"), safe: $(".safe"), bg: $(".bg"), bgOpacity: $(".bgOpacity"),
  volume: $(".volume"), voiceName: $(".voiceName"), rate: $(".rate"),
  menuSize: $(".menuSize"),
};
// The page at the size picked: zoom scales text, controls and spacing alike,
// so nothing overlaps or is cut off at 175%.
const MENU_SIZES = ["1", "1.25", "1.5", "1.75"];
function sizeMenu() {
  const z = MENU_SIZES.includes(String(prefs.menuSize)) ? Number(prefs.menuSize) : 1;
  document.body.style.zoom = String(z);
}

function translate() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) {
    const text = words[el.dataset.t];
    if (text) el.textContent = text;
  }
  for (const el of document.querySelectorAll("[data-tp]")) el.placeholder = words[el.dataset.tp] || el.placeholder;
  fillVoices();
  showVoiceNote();
}
function showVoiceNote() {
  $(".voiceNote").textContent = synth && voices.length ? words.voiceNote : words.noVoices;
}

// The voices: the automatic one first, then the meter's language's, then the
// rest. A saved voice not listed (not loaded yet) keeps its place.
function fillVoices() {
  const el = els.voiceName;
  const opt = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
  const byName = (x, y) => x.name.localeCompare(y.name);
  const others = voices.filter((v) => !inLanguage(v)).sort((x, y) => (x.lang || "").localeCompare(y.lang || "") || byName(x, y));
  const options = [opt("", words.voiceDefault), ...(hasClips ? [opt(KOKORO, words.voiceKokoro)] : []), ...[...voices.filter(inLanguage).sort(byName), ...others].map((v) => opt(v.voiceURI || v.name, `${v.name} (${v.lang})`))];
  if (prefs.voiceName && !options.some((o) => o.value === prefs.voiceName)) options.push(opt(prefs.voiceName, prefs.voiceName));
  el.replaceChildren(...options);
  el.value = prefs.voiceName;
}

function showPrefs() {
  for (const [key, el] of Object.entries(els)) {
    if (key === "voiceName") continue;
    if (el.type === "checkbox") el.checked = !!prefs[key];
    else el.value = String(prefs[key]);
  }
  els.voiceName.value = prefs.voiceName;
  sizeMenu();
}

// What a call is, in the list: a card with its short call (if curated) over
// the boss's line, what sets it off as tags, and ✎ for the player's own words.
function callRow(c) {
  const li = document.createElement("li");
  li.className = "callCard";
  const row = document.createElement("label");
  row.className = "call";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !prefs.offCall[c.k];
  box.addEventListener("change", () => {
    if (box.checked) delete prefs.offCall[c.k];
    else prefs.offCall[c.k] = true;
    li.classList.toggle("isOff", !box.checked);
    offTag.hidden = box.checked;
    save();
  });
  const what = document.createElement("span");
  what.className = "what";
  const main = document.createElement("span");
  main.className = c.act ? "act" : "said";
  main.textContent = T(c.act) || T(c.line) || T(c.n);
  what.append(main);
  if (c.act && T(c.line)) {
    const line = document.createElement("span");
    line.className = "line";
    line.textContent = `“${T(c.line)}”`;
    what.append(line);
  }
  // The player's own words, when set: what is said and shown now.
  const mine = document.createElement("span");
  mine.className = "mine";
  what.append(mine);
  const tags = document.createElement("span");
  tags.className = "tags";
  const trig = c.t === "cast" ? words.trigCast : c.t === "use" ? words.trigUse : words.trigBuff;
  const tag = (text, cls = "") => Object.assign(document.createElement("span"), { className: `tag ${cls}`.trim(), textContent: text });
  tags.append(tag(trig));
  if (c.t === "abnormal" && T(c.n)) tags.append(tag(T(c.n)));
  if (c.lead) tags.append(tag(`${(c.lead / 1000).toFixed(1).replace(/\.0$/, "")} s`));
  if (c.act) tags.append(tag(words.tagCall, "isCall"));
  // Off said in words, not only by the card fading.
  const offTag = tag(words.tagOff, "isOffTag");
  offTag.hidden = box.checked;
  tags.append(offTag);
  const pen = document.createElement("button");
  pen.type = "button";
  pen.className = "pen";
  // A pencil, drawn: the ✎ character came out small and faint in some fonts.
  pen.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  pen.title = words.custom;
  pen.setAttribute("aria-label", words.custom);
  // ▶: hear and see this call now, as in a fight.
  const play = document.createElement("button");
  play.type = "button";
  play.className = "pen play";
  play.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';
  play.title = words.previewCall;
  play.setAttribute("aria-label", words.previewCall);
  play.addEventListener("click", (e) => {
    e.preventDefault();
    engine.preview(c.k);
  });
  const buttons = document.createElement("span");
  buttons.className = "buttons";
  buttons.append(play, pen);
  row.append(box, what, buttons, tags);
  li.append(row);

  // ✎ opens a box for the player's own words: said and shown instead.
  const edit = document.createElement("div");
  edit.className = "ownBox";
  const label = Object.assign(document.createElement("span"), { className: "ownLabel", textContent: words.custom });
  const own = document.createElement("input");
  own.type = "text";
  own.maxLength = 80;
  own.placeholder = T(c.act) || T(c.line) || T(c.n);
  own.value = prefs.custom[c.k] || "";
  own.setAttribute("aria-label", words.custom);
  const clear = Object.assign(document.createElement("button"), { type: "button", className: "clear", textContent: "×", title: words.customReset });
  const hint = Object.assign(document.createElement("p"), { className: "ownHint", textContent: words.customHint });
  edit.append(label, own, clear, hint);
  li.append(edit);
  const showMine = () => {
    const v = prefs.custom[c.k] || "";
    mine.textContent = v ? `${words.custom}: ${v}` : "";
    mine.hidden = !v;
    pen.classList.toggle("isSet", !!v);
    li.classList.toggle("hasOwn", !!v);
  };
  const setOwn = (v) => {
    if (v) prefs.custom[c.k] = v;
    else delete prefs.custom[c.k];
    showMine();
    save();
  };
  edit.hidden = true;
  pen.addEventListener("click", (e) => {
    e.preventDefault();
    edit.hidden = !edit.hidden;
    pen.classList.toggle("isOpen", !edit.hidden);
    if (!edit.hidden) own.focus();
  });
  own.addEventListener("change", () => setOwn(own.value.trim()));
  own.addEventListener("keydown", (e) => {
    if (e.key === "Enter") own.blur();
    if (e.key === "Escape") {
      own.value = prefs.custom[c.k] || "";
      edit.hidden = true;
      pen.classList.remove("isOpen");
    }
  });
  clear.addEventListener("click", () => {
    own.value = "";
    setOwn("");
    own.focus();
  });
  showMine();
  li.classList.toggle("isOff", !box.checked);

  if (c.waves) {
    // Its waves' beep (03 38), on unless turned off.
    const w = document.createElement("label");
    w.className = "waves";
    const wb = document.createElement("input");
    wb.type = "checkbox";
    wb.checked = prefs.waves[c.k] !== false;
    wb.addEventListener("change", () => {
      prefs.waves[c.k] = wb.checked;
      save();
    });
    const t = document.createElement("span");
    t.textContent = words.beepWaves;
    w.append(wb, t);
    li.append(w);
  }
  return li;
}

// Dungeons (open while filtering), their bosses, each boss's calls. A
// mechanic with several ids (a skill's easy and normal copies) is one row.
const openGroups = new Set();
function renderBosses() {
  const q = $(".filter").value.trim().toLowerCase();
  const byBoss = new Map();
  for (const c of DATA.calls) {
    const list = byBoss.get(c.b) || [];
    if (!list.some((x) => x.k === c.k)) list.push(c);
    byBoss.set(c.b, list);
  }
  const groupName = (g) => T(DATA.groups[g]?.n) || (g === "c:Dungeon" ? words.groupDungeon : words.groupOther);
  const out = [];
  for (const g of Object.keys(DATA.groups)) {
    const bosses = Object.entries(DATA.bosses).filter(([, b]) => b.g === g).sort((x, y) => T(x[1].n).localeCompare(T(y[1].n)));
    const det = document.createElement("details");
    det.className = "group";
    const sum = document.createElement("summary");
    sum.textContent = groupName(g);
    det.append(sum);
    let any = false;
    for (const [key, b] of bosses) {
      const calls = byBoss.get(key) || [];
      const hit = !q || groupName(g).toLowerCase().includes(q) || T(b.n).toLowerCase().includes(q) ||
        calls.some((c) => [T(c.act), T(c.line), T(c.n)].some((s) => s.toLowerCase().includes(q)));
      if (!hit || !calls.length) continue;
      any = true;
      const div = document.createElement("div");
      div.className = "boss";
      const head = document.createElement("label");
      head.className = "bossHead";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !prefs.offBoss[key];
      box.addEventListener("change", () => {
        if (box.checked) delete prefs.offBoss[key];
        else prefs.offBoss[key] = true;
        div.classList.toggle("isOff", !box.checked);
        save();
      });
      head.append(box, document.createTextNode(T(b.n)));
      div.classList.toggle("isOff", !box.checked);
      const ul = document.createElement("ul");
      ul.className = "calls";
      // Curated mechanics first.
      for (const c of [...calls].sort((x, y) => !!y.act - !!x.act)) ul.append(callRow(c));
      div.append(head, ul);
      det.append(div);
    }
    if (!any) continue;
    det.open = !!q || openGroups.has(g);
    det.addEventListener("toggle", () => {
      if (q) return;
      if (det.open) openGroups.add(g);
      else openGroups.delete(g);
    });
    out.push(det);
  }
  $(".groups").replaceChildren(...out);
}

for (const b of document.querySelectorAll(".tab")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll(".tab")) {
      x.classList.toggle("isActive", x === b);
      x.setAttribute("aria-selected", String(x === b));
    }
    for (const p of document.querySelectorAll(".pane")) p.hidden = p.dataset.pane !== b.dataset.tab;
  });
}
$(".filter").addEventListener("input", renderBosses);
$(".allOn").addEventListener("click", () => {
  prefs.offBoss = {};
  prefs.offCall = {};
  save();
  renderBosses();
});
$(".allOff").addEventListener("click", () => {
  for (const k of Object.keys(DATA.bosses)) prefs.offBoss[k] = true;
  save();
  renderBosses();
});
$(".contrast").addEventListener("click", () => {
  for (const k of ["fg", "safe", "bg", "bgOpacity"]) prefs[k] = DEFAULTS[k];
  showPrefs();
  save();
  send();
});
$(".test").addEventListener("click", () => engine.test());

for (const [key, el] of Object.entries(els)) {
  el.addEventListener(el.type === "range" || el.type === "color" ? "input" : "change", () => {
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (key === "volume" || key === "bgOpacity") v = Number(v);
    prefs[key] = v;
    save();
    if (key === "menuSize") return sizeMenu();
    if (key === "enabled" || key === "widget" || key === "size") placeWidget();
    else send();
    if (key === "enabled" && !v) engine.clear();
    if (key === "voiceName" || key === "rate") say(words.preview);
  });
}
// The volume, heard where the slider is let go.
els.volume.addEventListener("change", () => say(words.preview));
$(".lock").addEventListener("change", (e) => a2.widgets.lock(e.target.checked).catch(() => {}));
if (synth) {
  loadVoices();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", () => { voicesSettled = true; loadVoices(); });
  else synth.onvoiceschanged = loadVoices;
}
setInterval(() => engine.tick(), 100);

// ---- The meter ---------------------------------------------------------

const atOf = (meta) => (meta && typeof meta.at === "number" ? meta.at : Date.now());
a2.on("decoded:boss-cast", (d, meta) => engine.cast(d, atOf(meta)));
a2.on("decoded:boss-skill", (d, meta) => engine.use(d, atOf(meta)));
a2.on("decoded:boss-wave", (d, meta) => engine.wave(d, atOf(meta)));
a2.on("decoded:boss-buff-added", (d, meta) => engine.added(d, atOf(meta)));
a2.on("decoded:boss-buff-removed", (d, meta) => engine.removed(d, atOf(meta)));
a2.on("language", (code) => {
  lang = UI[code] ? code : UI[String(code).split("-")[0]] ? String(code).split("-")[0] : "en";
  words = UI[lang];
  translate();
  renderBosses();
  send();
});
a2.on("game", (d) => {
  const open = !!(d && d.running);
  if (open === gameOpen) return;
  gameOpen = open;
  if (!open) engine.clear();
  placeWidget();
});
a2.on("locked", (on) => {
  locked = !!on;
  $(".lock").checked = locked;
});
a2.on("widget-message", ({ data }) => {
  if (data && data.open) a2.window?.show?.();
});

(async () => {
  const stored = await a2.storage.get("prefs").catch(() => null);
  if (stored && typeof stored === "object") {
    prefs = { ...DEFAULTS, ...stored };
    for (const k of ["offBoss", "offCall", "waves", "custom"]) prefs[k] = { ...(stored[k] || {}) };
  }
  locked = await a2.widgets.locked().catch(() => false);
  $(".lock").checked = locked;
  showPrefs();
  translate();
  renderBosses();
  placeWidget();
  a2.ready();
})();
