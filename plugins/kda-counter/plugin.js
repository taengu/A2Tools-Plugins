// K/D/A Counter: kills, deaths and assists against players, and a sound for
// each kill that climbs with the streak, and the Abyss Points earned in the
// Abyss (a2.on("kda"), permission "events:kda"); its window shows when the
// Abyss is entered (permission "window").
const { apply, notes, fresh, kda, clock, MAX_STREAK } = globalThis.KdaLogic;
let words = globalThis.KDA_UI.en;
const $ = (sel, root = document) => root.querySelector(sel);

// An event older than this is the meter's replay of what came before the
// window opened: counted, not played.
const STALE_MS = 5_000;
const prefs = { volume: 70, assistSound: true, deathSound: false, abyssPopup: true };
let state = fresh();
let audio = null;

const save = () => a2.storage.set("state", state).catch(() => {});
const savePrefs = () => a2.storage.set("prefs", prefs).catch(() => {});

function play(kind, streak) {
  if (!prefs.volume || (kind === "assist" && !prefs.assistSound) || (kind === "death" && !prefs.deathSound)) return;
  try {
    audio ||= new AudioContext();
    // Not awaited: in a hidden window WebKitGTK's resume() waits for the page
    // to be used, and a sound that waited for it stayed silent.
    if (audio.state !== "running") audio.resume().catch(() => {});
    for (const [freq, start, length, wave, volume] of notes(kind, streak)) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const t = audio.currentTime + start;
      const peak = Math.max(0.0002, volume * (prefs.volume / 100));
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  } catch (e) {
    console.warn(e);
  }
}

function draw() {
  $(".kills b").textContent = state.kills;
  $(".deaths b").textContent = state.deaths;
  $(".assists b").textContent = state.assists;
  const streak = $(".streak");
  streak.textContent = state.streak ? words.streak(Math.min(state.streak, 99), state.best, state.streak >= MAX_STREAK) : state.best ? words.bestStreak(state.best) : "";
  streak.classList.toggle("hot", state.streak >= 2);
  $(".ratio").textContent = state.kills + state.assists + state.deaths ? words.kda(kda(state)) : "";
  // In the Abyss, or with points earned there since the reset.
  $(".abyss").hidden = !state.inAbyss && !state.abyssPoints;
  $(".abyss b").textContent = state.abyssPoints.toLocaleString("en-US");
}
function tick() {
  $(".time").textContent = clock(state.since ? Date.now() - state.since : 0);
}

// The page's words in the meter's language (English where it has none).
function translate(code) {
  const ui = globalThis.KDA_UI;
  const lang = ui[code] ? code : ui[String(code).split("-")[0]] ? String(code).split("-")[0] : "en";
  words = ui[lang];
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = words[el.dataset.t];
  for (const el of document.querySelectorAll("[data-title]")) el.title = words[el.dataset.title];
  draw();
}
a2.on("language", translate);

a2.on("kda", (e, meta) => {
  if (!apply(state, e)) return;
  const fresh = Date.now() - (e.at || meta?.at || Date.now()) <= STALE_MS;
  if (fresh && e.kind === "zone" && e.abyss && prefs.abyssPopup) Promise.resolve(a2.window.show()).catch(() => {});
  if (fresh && (e.kind === "kill" || e.kind === "assist" || e.kind === "death")) play(e.kind, state.streak);
  draw();
  save();
});

$(".reset").addEventListener("click", () => {
  // Keeps the events already counted, so a replay can't count them again.
  const seen = state.seen;
  const inAbyss = state.inAbyss;
  state = fresh();
  state.seen = seen;
  state.inAbyss = inAbyss;
  draw();
  tick();
  save();
});
$(".gear").addEventListener("click", () => {
  $(".settings").hidden = !$(".settings").hidden;
});
$(".volume").addEventListener("input", (e) => {
  prefs.volume = Number(e.target.value);
  savePrefs();
});
$(".assistSound").addEventListener("change", (e) => {
  prefs.assistSound = e.target.checked;
  savePrefs();
});
$(".deathSound").addEventListener("change", (e) => {
  prefs.deathSound = e.target.checked;
  savePrefs();
});
$(".abyssPopup").addEventListener("change", (e) => {
  prefs.abyssPopup = e.target.checked;
  savePrefs();
});
// One button per step of the climb, then the other two.
for (const [label, kind, streak] of [["1", "kill", 1], ["2", "kill", 2], ["3", "kill", 3], ["4", "kill", 4], ["5", "kill", 5], ["6", "kill", 6], ["A", "assist", 3], ["D", "death", 0]]) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", () => {
    const keep = [prefs.assistSound, prefs.deathSound];
    // A test plays even where that sound is off.
    prefs.assistSound = prefs.deathSound = true;
    play(kind, streak);
    [prefs.assistSound, prefs.deathSound] = keep;
  });
  $(".tests").append(b);
}

(async () => {
  const p = await a2.storage.get("prefs").catch(() => null);
  if (p) Object.assign(prefs, p);
  const s = await a2.storage.get("state").catch(() => null);
  if (s && typeof s.kills === "number") state = { ...fresh(), ...s };
  $(".volume").value = prefs.volume;
  $(".assistSound").checked = prefs.assistSound;
  $(".deathSound").checked = prefs.deathSound;
  $(".abyssPopup").checked = prefs.abyssPopup;
  draw();
  tick();
  setInterval(tick, 1000);
  // Only now the meter hands over the events it kept: the saved counts are in.
  a2.ready();
})();
