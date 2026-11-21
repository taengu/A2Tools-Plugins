import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "plugins", "boss-telegraph");
const source = (name) => fs.readFileSync(path.join(plugin, name), "utf8");
const context = vm.createContext({ window: {} });
for (const name of ["bosses.js", "actions.js", "logic.js"]) vm.runInContext(source(name), context);
const DATA = context.window.BOSS_CALLOUTS;
const ACTIONS = context.window.BOSS_ACTIONS;
const english = (id) => DATA.texts[id]?.en || "";
const call = (key) => DATA.calls.find((c) => c.k === key);

function harness(prefs = {}, lang = "en") {
  let now = 100_000;
  const spoken = [], beeps = [], timers = [];
  const sandbox = vm.createContext({ window: {}, setTimeout: (fn, ms) => timers.push({ fn, at: now + ms }) });
  vm.runInContext(source("logic.js"), sandbox);
  const engine = sandbox.window.BossLogic.create(DATA, {
    now: () => now, prefs: () => prefs, lang: () => lang, actions: ACTIONS,
    say: (text, priority) => spoken.push({ text, priority }), beep: () => beeps.push(now), show() {},
  });
  return {
    engine, prefs, spoken, beeps, now: () => now,
    advance(ms) {
      now += ms;
      for (const timer of [...timers]) if (timer.at <= now) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
      engine.tick();
    },
    trigger(c, age = 0) {
      const d = c.t === "abnormal" ? { entity: 1, abnormal: c.id, instance: 1, length: 10000 } : { caster: 1, skill: c.id };
      engine[c.t === "cast" ? "cast" : c.t === "use" ? "use" : "added"](d, now - age);
    },
  };
}

test("default instruction mode replaces dialogue and retains visual context and cast countdown", () => {
  const h = harness({ style: "line" });
  const c = call("thamon-violet");
  h.trigger(c);
  assert.deepEqual(h.spoken, [{ text: "Stop magic", priority: "high" }]);
  assert.equal(h.engine.items()[0].sub, english(c.line));
  assert.equal(h.engine.items()[0].end, h.now() + c.lead);
});

test("explicit opt-out retains all three previous call styles", () => {
  const c = call("thamon-violet");
  for (const style of ["both", "act", "line"]) {
    const h = harness({ tellMeWhatToDo: false, style });
    h.trigger(c);
    assert.deepEqual(h.spoken.map((s) => s.text), style === "both" ? [english(c.act), english(c.line)] : [english(c[style])]);
  }
});

test("unknown mechanics announce a neutral advisory with original context on screen", () => {
  const h = harness();
  const c = call("cast:1808880:basilus-the-false");
  h.trigger(c);
  assert.deepEqual(h.spoken.map((s) => s.text), [english(c.act) || english(c.line)]);
  assert.equal(h.engine.items()[0].text, english(c.act) || english(c.line));
  assert.equal(h.engine.items()[0].sub, "");
});

test("instructions backed by explicit game dialogue use their exact reviewed trigger", () => {
  for (const [key, text] of Object.entries(ACTIONS.calls)) {
    const c = call(key);
    if (c.mark) continue;
    const h = harness();
    h.engine.preview(key); // selected boss is explicit, including a shared ID
    assert.equal(h.spoken[0].text, text.en, key);
    assert.equal(h.engine.items()[0].sub, english(c.line) || english(c.act), key);
  }
});

test("a live shared trigger stays neutral even after another boss-specific skill or session clear", () => {
  const h = harness();
  h.trigger(call("vakron-jump"));
  h.advance(2000);
  h.engine.cast({ caster: 1, skill: 1604500 }, h.now());
  assert.equal(h.spoken.at(-1).text, "Don't touch those flowers, unless you wish to be poisoned!");
  h.engine.clear();
  h.advance(2000);
  h.engine.cast({ caster: 1, skill: 1604500 }, h.now());
  assert.equal(h.spoken.at(-1).text, "Don't touch those flowers, unless you wish to be poisoned!");
  assert.ok(!h.spoken.some((s) => s.text === ACTIONS.calls["cast:1604500:vakron"].en));
});

test("custom wording overrides instruction mode, legacy styles and instruction phase label", () => {
  const c = call("thamon-violet");
  for (const tellMeWhatToDo of [true, false]) {
    const h = harness({ tellMeWhatToDo, style: "line", custom: { [c.k]: "My own warning" } });
    h.trigger(c);
    assert.equal(h.spoken[0].text, "My own warning");
    assert.equal(h.engine.items()[0].sub, "");
    h.engine.added({ entity: 1, abnormal: c.phase.a, instance: 3, length: 5000 }, h.now());
    assert.equal(h.engine.items()[0].text, tellMeWhatToDo ? "My own warning" : english(c.phase.n));
  }
});

test("instruction phases retain buff countdown without claiming safety from elapsed time", () => {
  const h = harness({ style: "line" });
  const c = call("lakshmi-reflect");
  h.trigger(c);
  h.engine.added({ entity: 1, abnormal: c.phase.a, instance: 5, length: 8000 }, h.now());
  assert.equal(h.engine.items()[0].text, "Stop attacking");
  assert.equal(h.engine.items()[0].sub, english(c.phase.n));
  assert.equal(h.engine.items()[0].end, h.now() + 8000);
  assert.equal(h.spoken.length, 1, "a cast just heard is not repeated for its buff");
  h.advance(8000);
  assert.equal(h.spoken.at(-1).text, "Safe to attack");
  assert.equal(h.engine.items()[0].kind, "safe");
});

test("stale casts, skills and phase removal are silent; duplicate events do not repeat", () => {
  const h = harness();
  const c = call("thamon-violet");
  h.trigger(c, 3001);
  h.trigger(call("vakron-jump"), 3001);
  assert.equal(h.spoken.length, 0);
  h.advance(2000);
  h.trigger(c);
  h.trigger(c);
  assert.equal(h.spoken.length, 1);
  h.engine.added({ entity: 1, abnormal: c.phase.a, instance: 9, length: 10000 }, h.now());
  h.engine.removed({ entity: 1, instance: 9 }, h.now() - 3001);
  assert.equal(h.spoken.length, 1);
});

test("disabled plugin, boss or mechanic remains silent, while preview remains deliberate", () => {
  const c = call("thamon-violet");
  for (const prefs of [{ enabled: false }, { offBoss: { [c.b]: true } }, { offCall: { [c.k]: true } }]) {
    const h = harness(prefs);
    h.trigger(c);
    assert.equal(h.spoken.length, 0);
    h.engine.preview(c.k);
    assert.equal(h.spoken[0].text, "Stop magic");
  }
});

test("Talisra's signs are remembered for future pulses, preserving order and reset gap", () => {
  const h = harness();
  const dark = call("talisra-dark-spear"), light = call("talisra-light-spear");
  h.trigger(dark); h.advance(2000); h.trigger(dark); h.advance(2000); h.trigger(light);
  assert.deepEqual(h.spoken.map((s) => s.text), [ACTIONS.calls[dark.k].en, ACTIONS.calls[dark.k].en, ACTIONS.calls[light.k].en]);
  assert.equal(h.engine.items()[0].text, "Dark → Dark → Light");
  assert.equal(h.engine.items()[0].sub, ACTIONS.order.en);
  assert.match(h.engine.items()[0].sub, /When the pulses begin/);
  h.advance(7000); h.trigger(light);
  assert.equal(h.engine.items()[0].text, "Light");
  const old = harness({ tellMeWhatToDo: false }); old.trigger(dark);
  assert.equal(old.spoken[0].text, "Dark");
  const own = harness({ custom: { [dark.k]: "My dark reminder" } }); own.trigger(dark);
  assert.equal(own.spoken[0].text, "My dark reminder");
});

test("both Vakron difficulty IDs keep jump instructions and optional wave beeps", () => {
  for (const c of DATA.calls.filter((c) => c.k === "vakron-jump")) {
    const h = harness(); h.trigger(c); h.advance(1700);
    h.engine.wave({ caster: 1, skill: c.id }, h.now());
    h.engine.wave({ caster: 1, skill: c.id }, h.now());
    assert.equal(h.spoken[0].text, "Jump!"); assert.equal(h.beeps.length, 1);
    h.prefs.waves = { [c.k]: false }; h.advance(1700);
    h.engine.wave({ caster: 1, skill: c.id }, h.now());
    assert.equal(h.beeps.length, 1);
  }
});

test("Test and individual previews use the chosen mode and expire silently", () => {
  const h = harness({ style: "line" }); h.engine.test();
  assert.equal(h.spoken[0].text, "Stop magic");
  h.advance(1800); assert.equal(h.engine.items()[0].text, "Stop magic");
  h.advance(5000); assert.equal(h.spoken.at(-1).text, "Safe to attack");
  assert.equal(h.engine.items()[0].kind, "safe");
  const p = harness({ tellMeWhatToDo: false, style: "line" }); p.engine.preview("thamon-violet");
  assert.equal(p.spoken[0].text, english(call("thamon-violet").line));
});

class Element {
  constructor(type = "") { this.type = type; this.value = ""; this.children = []; this.dataset = {}; this.style = {}; this.events = {}; this.classList = { toggle() {}, remove() {} }; }
  addEventListener(name, fn) { this.events[name] = fn; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  focus() {}
}

async function page(stored = null, systemVoice = false) {
  const elements = new Map(), saved = [], spoken = [], played = [], decoded = [], timers = [], handlers = new Map();
  const get = (s) => {
    if (!elements.has(s)) elements.set(s, new Element([".enabled", ".widget", ".lock", ".tellMeWhatToDo"].includes(s) ? "checkbox" : ""));
    return elements.get(s);
  };
  class AudioContext {
    state = "running";
    destination = {};
    async decodeAudioData(bytes) {
      decoded.push(Buffer.from(bytes));
      assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "OggS");
      return { duration: 1 };
    }
    createGain() { return { gain: {}, connect() { return this; } }; }
    createBufferSource() { const node = { connect() { return this; }, start() { played.push(node); }, stop() {} }; return node; }
    async close() {}
  }
  const sandbox = vm.createContext({
    window: { AudioContext, speechSynthesis: systemVoice ? { getVoices: () => [{ name: "Local", voiceURI: "local", lang: "en-US" }], addEventListener() {}, speak: (u) => spoken.push(u), cancel() {} } : undefined },
    document: { documentElement: {}, body: { style: {} }, querySelector: get, querySelectorAll: () => [], createElement: () => new Element(), createTextNode: (s) => s },
    a2: { storage: { get: async () => stored, set: async (key, value) => saved.push(structuredClone(value)) }, on: (name, fn) => handlers.set(name, fn), widgets: { locked: async () => false }, ready() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {}, setInterval() {},
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
  });
  for (const name of ["bosses.js", "actions.js", "i18n.js", "context.js", "mechanics.js", "activation.js", "logic.js", "voice.js"]) vm.runInContext(source(name), sandbox);
  sandbox.BossLogic = sandbox.window.BossLogic;
  sandbox.BossContext = sandbox.window.BossContext;
  sandbox.BossActivation = sandbox.window.BossActivation;
  vm.runInContext(source("plugin.js") + "\nglobalThis.api = { prefs: () => prefs, clip, say, engine };", sandbox);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  return { ...sandbox.api, elements, saved, spoken, played, decoded, handlers, timers };
}

test("old saved preferences receive the default-on setting, preserve custom/style, and persist opt-out", async () => {
  const old = { style: "line", custom: { "thamon-violet": "Careful" }, volume: 70 };
  const p = await page(old);
  assert.equal(p.prefs().tellMeWhatToDo, true);
  assert.equal(p.prefs().style, "line");
  assert.equal(p.prefs().custom["thamon-violet"], "Careful");
  assert.equal(p.elements.get(".tellMeWhatToDo").value, "instructions");
  assert.equal(p.elements.get(".style").disabled, true);
  const checkbox = p.elements.get(".tellMeWhatToDo"); checkbox.value = "lines"; checkbox.events.change();
  assert.equal(p.saved.at(-1).tellMeWhatToDo, false);
  assert.equal(p.elements.get(".style").disabled, false);
  const again = await page(p.saved.at(-1));
  assert.equal(again.prefs().tellMeWhatToDo, false);
  assert.equal(again.elements.get(".tellMeWhatToDo").value, "lines");
  assert.equal(again.prefs().style, "line");
});

test("every localized spoken action resolves through the real audio lookup to an English Ogg clip", async () => {
  const p = await page();
  for (const text of [ACTIONS.watch, ...Object.values(ACTIONS.calls)]) {
    for (const lang of DATA.langs) {
      const clip = p.clip(text[lang]);
      assert.ok(clip, `${lang}: ${text.en}`);
      assert.equal(clip.en, text.en);
      await clip.buffer;
    }
  }
  p.say(ACTIONS.watch.en);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(p.played.length, 1, "no-system-voice path starts an audio source");
  assert.ok(p.decoded.length >= Object.keys(ACTIONS.calls).length, "action audio was decoded");
});

test("system speech reads localized instructions and custom wording still uses system speech with Built-in selected", async () => {
  const p = await page({ voiceName: "kokoro", custom: { "thamon-violet": "My custom direction" } }, true);
  p.engine.preview("thamon-violet");
  assert.equal(p.spoken[0].text, "My custom direction");
  const q = await page({ guideRegion: "Global" }, true); q.handlers.get("language")("fr");
  q.engine.preview("cast:1800050:ultimate-berk");
  const registryContext = vm.createContext({ window: {} }); vm.runInContext(source("mechanics.js"), registryContext);
  const instruction = registryContext.window.BOSS_MECHANICS.entries.find((entry) => entry.k === "cast:1800050:ultimate-berk" && entry.scope.regions.includes("Global"));
  assert.equal(q.spoken[0].text, instruction.text.fr);
});

test("new UI/action/release text covers all ten locales, release notes respect 300 characters", () => {
  const locales = Array.from(DATA.langs).sort();
  const uiContext = vm.createContext({}); vm.runInContext(source("i18n.js") + "\nglobalThis.words = UI;", uiContext);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(uiContext.words[locale]).sort(), Object.keys(uiContext.words.en).sort(), locale);
    for (const key of Object.keys(uiContext.words.en)) assert.ok(uiContext.words[locale][key]?.trim(), `${locale}.${key}`);
  }
  for (const text of [ACTIONS.watch, ACTIONS.order, ...Object.values(ACTIONS.calls)]) {
    assert.deepEqual(Object.keys(text).sort(), locales);
    for (const locale of locales) assert.ok(text[locale].trim());
  }
  const changes = JSON.parse(source("changes.json"));
  const manifest = JSON.parse(source("manifest.json"));
  assert.ok(changes.length <= 5); assert.equal(changes[0].version, manifest.version);
  assert.deepEqual(Object.keys(changes[0]).filter((k) => k !== "version").sort(), locales);
  for (const locale of locales) assert.ok(changes[0][locale].trim() && [...changes[0][locale]].length <= 300, locale);
  const html = source("index.html");
  assert.match(html, /class="tellMeWhatToDo" aria-describedby="actionsNote"/);
  assert.ok(html.indexOf('src="actions.js"') < html.indexOf('src="plugin.js"'));
});

test("the instruction builder verifies generated output and rejects changed supporting game dialogue", () => {
  const script = `
import copy,sys
sys.path.insert(0, 'tools/boss-telegraph')
from actions import build_actions,read_js,PLUGIN
data=read_js(PLUGIN/'bosses.js')
build_actions(data,check=True)
changed=copy.deepcopy(data)
call=next(c for c in changed['calls'] if c['k']=='cast:1800050:ultimate-berk')
changed['texts'][call['line']]['en']='A different mechanic after a game patch'
try:
    build_actions(changed,check=True)
except ValueError as error:
    assert 'source changed or missing' in str(error)
else:
    raise AssertionError('source drift was accepted')
`;
  const result = spawnSync("python", ["-c", script], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
