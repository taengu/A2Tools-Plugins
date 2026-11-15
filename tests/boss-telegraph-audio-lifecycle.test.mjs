import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (name) => fs.readFileSync(path.join(root, "plugins", "boss-telegraph", name), "utf8");
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

class Element {
  constructor(type = "") {
    this.type = type; this.value = ""; this.children = []; this.dataset = {}; this.style = {}; this.events = {};
    this.classList = { toggle() {}, remove() {} };
  }
  addEventListener(name, fn) { this.events[name] = fn; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  focus() {}
}

async function page({ deferred = false, systemVoice = false, stored = null } = {}) {
  let time = 100_000;
  class ClockDate extends Date { static now() { return time; } }
  const elements = new Map(), handlers = new Map(), pending = [], started = [], oscillators = [], utterances = [];
  const cancellations = [];
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element([".enabled", ".widget", ".lock", ".tellMeWhatToDo"].includes(selector) ? "checkbox" : ""));
    return elements.get(selector);
  };
  class AudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    async decodeAudioData(bytes) {
      assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "OggS");
      if (deferred) await new Promise((resolve) => pending.push(resolve));
      return { duration: 1 };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; }, disconnect() {} };
    }
    createBufferSource() {
      return { connect() { return this; }, start() { started.push(this); }, stop() { this.stopped = true; } };
    }
    createOscillator() {
      const node = { frequency: {}, connect() { return this; }, start() {}, stop(at) { if (at == null) this.stoppedImmediately = true; }, disconnect() {} };
      oscillators.push(node);
      return node;
    }
    async close() {}
  }
  const sandbox = vm.createContext({
    Date: ClockDate,
    window: { AudioContext, speechSynthesis: systemVoice ? {
      getVoices: () => [{ name: "Local", voiceURI: "local", lang: "en-US" }], addEventListener() {},
      speak: (utterance) => utterances.push(utterance), cancel: () => cancellations.push(true),
    } : undefined },
    document: { documentElement: {}, body: { style: {} }, querySelector: get, querySelectorAll: () => [], createElement: () => new Element(), createTextNode: (text) => text },
    a2: { storage: { get: async () => stored, set: async () => {} }, on: (event, fn) => handlers.set(event, fn),
      widgets: { locked: async () => false, open: async () => {}, close: async () => {}, send: async () => {} }, ready() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    atob: (encoded) => Buffer.from(encoded, "base64").toString("binary"),
  });
  for (const name of ["bosses.js", "actions.js", "i18n.js", "context.js", "mechanics.js", "activation.js", "logic.js", "voice.js"]) vm.runInContext(source(name), sandbox);
  sandbox.BossLogic = sandbox.window.BossLogic;
  sandbox.BossContext = sandbox.window.BossContext;
  sandbox.BossActivation = sandbox.window.BossActivation;
  vm.runInContext(source("plugin.js") + "\nglobalThis.audioTest = { say, beep, engine, resetLifecycle, prefs: () => prefs };", sandbox);
  await flush();
  handlers.get("game")({ running: true });
  time += 1;
  const reset = async (reason) => {
    if (reason === "disable") { const checkbox = get(".enabled"); checkbox.checked = false; checkbox.events.change(); }
    else if (reason === "game-close") handlers.get("game")({ running: false });
    else sandbox.audioTest.resetLifecycle();
    await flush();
  };
  return { ...sandbox.audioTest, reset, started, oscillators, utterances, cancellations, pending, handlers,
    now: () => time, advance: (ms) => { time += ms; },
    async resolveDecodes() { while (pending.length) pending.shift()(); await flush(); },
  };
}

for (const reason of ["disable", "game-close", "manual-reset"]) {
  test(`${reason} invalidates pending decode and waiting cues, while a deliberate new preview still works`, async () => {
    const h = await page({ deferred: true });
    h.say("Watch the boss", "high"); h.say("Stop magic", "low");
    assert.ok(h.pending.length >= 2);
    await h.reset(reason);
    await h.resolveDecodes();
    assert.equal(h.started.length, 0, "a pre-reset decode must not start playback");
    h.engine.preview("thamon-violet");
    await h.resolveDecodes();
    assert.equal(h.started.length, 1, "explicit preview remains available after reset, including while off");
  });

  test(`${reason} stops active built-in audio and wave beeps`, async () => {
    const h = await page(); h.say("Watch the boss"); h.beep(); await flush();
    assert.equal(h.started.length, 1); assert.equal(h.oscillators.length, 1);
    await h.reset(reason);
    assert.equal(h.started[0].stopped, true);
    assert.equal(h.started[0].onended, null);
    assert.equal(h.oscillators[0].stoppedImmediately, true);
  });

  test(`${reason} cancels system speech and preserves deliberate custom previews`, async () => {
    const h = await page({ systemVoice: true, stored: { custom: { "thamon-violet": "My custom reminder" } } });
    h.say("Old current cue"); h.say("Old waiting cue", "low");
    const before = h.cancellations.length;
    await h.reset(reason);
    assert.equal(h.cancellations.length, before + 1);
    for (const utterance of h.utterances) assert.equal(utterance.onend, null);
    h.engine.preview("thamon-violet");
    assert.equal(h.utterances.at(-1).text, "My custom reminder");
  });
}

test("an already-dispatched old onended callback cannot advance a new generation's queue", async () => {
  const h = await page(); h.say("Watch the boss"); await flush();
  const oldEnded = h.started[0].onended;
  await h.reset("manual-reset");
  h.say("Jump!"); h.say("Stop physical", "low"); await flush();
  assert.equal(h.started.length, 2);
  oldEnded(); await flush();
  assert.equal(h.started.length, 2, "an old callback cannot overlap the current cue with its waiting cue");
  h.started[1].onended(); await flush();
  assert.equal(h.started.length, 3, "the current generation still advances normally");
});

test("ordinary built-in playback still queues and advances without a reset", async () => {
  const h = await page(); h.say("Watch the boss"); h.say("Stop magic", "low"); await flush();
  assert.equal(h.started.length, 1);
  h.started[0].onended(); await flush(); assert.equal(h.started.length, 2);
  h.started[1].onended(); await flush(); assert.equal(h.started.length, 2);
});

test("a fresh map load invalidates pending encounter audio and leaves explicit previews usable", async () => {
  const h = await page({ deferred: true });
  h.say("Watch the boss");
  h.handlers.get("decoded:boss-map")({ count: 0, map: 0 }, { at: h.now() });
  await h.resolveDecodes();
  assert.equal(h.started.length, 0);
  h.engine.preview("thamon-violet");
  await h.resolveDecodes();
  assert.equal(h.started.length, 1);
});

test("teleporting to the same map is a new encounter, not a repeated map value to ignore", async () => {
  const h = await page();
  const load = () => h.handlers.get("decoded:boss-map")({ count: 1, map: 200001 }, { at: h.now() });
  load(); h.engine.preview("thamon-violet"); await flush();
  assert.equal(h.started.length, 1);
  h.advance(1000); load();
  assert.equal(h.started[0].stopped, true);
  assert.equal(h.engine.items().length, 0);
});

test("stale, future and malformed map events cannot cancel the current encounter", async () => {
  const h = await page(); h.say("Watch the boss"); await flush();
  const map = h.handlers.get("decoded:boss-map");
  map({ count: 1, map: 200001 }, { at: h.now() - 3001 });
  map({ count: 1, map: 200001 }, { at: h.now() + 1 });
  map({ count: -1, map: 200001 }, { at: h.now() });
  for (const meta of [undefined, null, {}, { at: null }, { at: String(h.now()) }]) {
    map({ count: 1, map: 200001 }, meta);
  }
  assert.notEqual(h.started[0].stopped, true);
  map({ count: 1, map: 200001 }, { at: h.now() });
  assert.equal(h.started[0].stopped, true);
});

test("map and subsequent cast delivered in one batch use captured ordering, not delivery time", async () => {
  const h = await page(); h.advance(100);
  h.handlers.get("decoded:boss-map")({ count: 1, map: 200001 }, { at: h.now() - 30 });
  h.handlers.get("decoded:boss-cast")({ caster: 1, skill: 1604670 }, { at: h.now() - 20 });
  await flush();
  assert.equal(h.started.length, 1, "the cast captured after the map belongs to the new encounter");
  assert.equal(h.engine.items()[0].text, "Watch the boss", "map reset leaves unselected encounter scope neutral");
});

test("unchanged running-state notifications do not cancel speech and closed-game map events do not reopen context", async () => {
  const h = await page(); h.say("Watch the boss"); await flush();
  h.handlers.get("game")({ running: true });
  assert.notEqual(h.started[0].stopped, true);
  await h.reset("game-close"); h.engine.preview("thamon-violet"); await flush();
  const preview = h.started.at(-1);
  h.advance(1000);
  h.handlers.get("decoded:boss-map")({ count: 1, map: 200001 }, { at: h.now() });
  h.handlers.get("game")({ running: false });
  assert.notEqual(preview.stopped, true);
});

test("the reviewed map decoder and context script are declared in the shipped panel", () => {
  const manifest = JSON.parse(source("manifest.json"));
  const map = manifest.decoders.filter((entry) => entry.name === "boss-map");
  assert.equal(map.length, 1);
  assert.equal(map[0].opcode, "21 36");
  assert.deepEqual(map[0].fields, [{ name: "count", type: "u32" }, { name: "map", type: "u32" }]);
  assert.ok(manifest.permissions.includes("decoder:boss-map"));
  const panel = source("index.html");
  assert.ok(panel.indexOf('src="context.js"') < panel.indexOf('src="plugin.js"'));
});
