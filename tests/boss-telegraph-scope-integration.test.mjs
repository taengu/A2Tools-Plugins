import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "plugins", "boss-telegraph");
const source = (name) => fs.readFileSync(path.join(plugin, name), "utf8");
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const locales = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"];
const texts = (en) => Object.fromEntries(locales.map((locale) => [locale, en])); // Synthetic fixture values only.

function fixture(data) {
  const entry = (key, region, category, qualifier, en) => {
    const call = data.calls.find((row) => row.k === key);
    const field = call.line == null ? "act" : "line";
    return { k: call.k, bossKey: call.b, t: call.t, id: call.id, enabled: true, referenceOnly: false,
      verification: "guide-exact", source: { field, en: data.texts[call[field]].en }, text: texts(en),
      scope: { regions: [region], categories: [category], ...qualifier } };
  };
  const literal = entry("use:1604330:decaying-durvati", "Global", "conquest", {}, "Fixture literal destroy eggs");
  literal.verification = "game-explicit"; literal.scope = { universal: true };
  return {
    managedKeys: { fixture: [...new Set(data.calls.map((call) => call.k))] },
    dungeons: { "200001": { name: "Fixture Normal", difficulty: "normal" }, "200002": { name: "Fixture Hard", difficulty: "hard" } },
    entries: [
      literal,
      entry("thamon-violet", "Global", "conquest", { difficulties: ["normal"] }, "Fixture Global magic instruction"),
      entry("thamon-violet", "KR", "conquest", { difficulties: ["hard"] }, "Fixture KR magic instruction"),
      entry("thamon-red", "Global", "conquest", { difficulties: ["hard"] }, "Fixture Global physical instruction"),
      entry("talisra-dark-spear", "Global", "transcendence", { stages: [3] }, "Fixture Global shield reminder"),
      entry("talisra-dark-spear", "KR", "transcendence", { stages: [7] }, "Fixture KR shield reminder"),
      entry("cast:1800050:ultimate-berk", "Global", "conquest", { difficulties: ["normal"] }, "Fixture Global cover instruction"),
    ],
  };
}

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

async function page({ stored = null, registry = fixture } = {}) {
  let time = 100_000, timerId = 0;
  class ClockDate extends Date { static now() { return time; } }
  const elements = new Map(), handlers = new Map(), timers = new Map(), spoken = [], saved = [];
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element([".enabled", ".widget", ".lock", ".tellMeWhatToDo"].includes(selector) ? "checkbox" : ""));
    return elements.get(selector);
  };
  const sandbox = vm.createContext({
    Date: ClockDate,
    window: { speechSynthesis: { getVoices: () => [{ name: "Local", voiceURI: "local", lang: "en-US" }], addEventListener() {}, cancel() {}, speak: (utterance) => spoken.push(utterance.text) } },
    document: { documentElement: {}, body: { style: {} }, querySelector: get, querySelectorAll: () => [], createElement: () => new Element(), createTextNode: (text) => text },
    a2: { storage: { get: async () => structuredClone(stored), set: async (key, value) => saved.push({ key, value: structuredClone(value) }) }, on: (event, fn) => handlers.set(event, fn),
      widgets: { locked: async () => false, open: async () => {}, close: async () => {}, send: async () => {} }, ready() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout: (id) => timers.delete(id), setInterval() {},
    atob: (encoded) => Buffer.from(encoded, "base64").toString("binary"),
  });
  for (const name of ["bosses.js", "actions.js", "i18n.js", "context.js", "activation.js", "logic.js", "voice.js"]) vm.runInContext(source(name), sandbox);
  if (registry === "real") vm.runInContext(source("mechanics.js"), sandbox);
  else sandbox.window.BOSS_MECHANICS = registry(sandbox.window.BOSS_CALLOUTS);
  for (const name of ["BossLogic", "BossContext", "BossActivation"]) sandbox[name] = sandbox.window[name];
  vm.runInContext(source("plugin.js") + "\nglobalThis.scopeTest = { engine, context: guideContext, prefs: () => prefs, data: DATA, registry: MECHANICS, activation };", sandbox);
  await flush(); handlers.get("game")({ running: true }); time += 1;
  const advance = async (ms = 1) => {
    time += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); }
    sandbox.scopeTest.engine.tick(); await flush();
  };
  const choose = async (selector, value) => {
    const element = get(selector); element.value = String(value); element.events.change(); await advance();
  };
  const emit = async (key, { at = time, entity = 101, instance = 1, length = 10000 } = {}) => {
    const call = sandbox.scopeTest.data.calls.find((row) => row.k === key);
    assert.ok(call, key);
    const event = call.t === "cast" ? "boss-cast" : call.t === "use" ? "boss-skill" : "boss-buff-added";
    const fields = call.t === "abnormal" ? { entity, abnormal: call.id, instance, length } : { caster: entity, skill: call.id };
    handlers.get(`decoded:${event}`)(fields, { at }); await flush();
  };
  return { ...sandbox.scopeTest, elements, handlers, spoken, saved, choose, advance, emit, now: () => time };
}

async function scope(h, region, category, qualifier, value) {
  if (region) await h.choose(".guideRegion", region);
  await h.choose(".guideCategory", category);
  if (qualifier) await h.choose(qualifier, value);
}

test("Global Talisra dark/light retains its original reminders and order without a selected stage", async () => {
  const h = await page({registry: "real", stored: {guideRegion: "Global"}});
  await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "Remember dark shield");
  await h.advance(1500); await h.emit("talisra-light-spear");
  assert.equal(h.spoken.at(-1), "Remember light shield");
  const item=h.engine.items().find(item=>item.key.startsWith("m:"));
  assert.equal(item.text,"Dark → Light"); assert.match(item.sub,/pulses|order|shield/i);
  assert.equal(h.context().stage,null); assert.equal(h.context().category,"auto");
});

test("the missing-stage exception cannot enable other mechanics, wrong regions or explicitly unsupported stages", async () => {
  const h = await page({registry: "real", stored: {guideRegion: "Global"}});
  const entry=h.registry.entries.find(e=>e.id===1801780&&e.scope.regions.includes("Global"));
  await h.emit(entry.k); assert.equal(h.spoken.at(-1),"Watch the boss");
  await h.choose(".guideRegion","KR"); await h.emit("talisra-dark-spear");
  assert.equal(h.spoken.at(-1),"Watch the boss");
  await h.choose(".guideRegion","Global"); await h.choose(".guideCategory","transcendence"); await h.choose(".guideStage",9);
  await h.emit("talisra-light-spear"); assert.equal(h.spoken.at(-1),"Watch the boss");
});

test("the missing-stage reminder cannot bypass an ambiguous trigger or create a remembered manual stage", async () => {
  const h = await page({registry: "real", stored: {guideRegion: "Global"}});
  const call=h.data.calls.find(c=>c.k==="talisra-dark-spear");
  call.uncertain=true; await h.emit(call.k); assert.equal(h.spoken.at(-1),"Watch the boss");
  assert.equal(h.context().stage,null); assert.equal(h.saved.length,0);
});

test("unknown region opens context and holds managed legacy actions, phases and marks", async () => {
  const h = await page(); assert.equal(h.elements.get(".guideContext").open, true);
  await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), "Watch the boss");
  h.handlers.get("decoded:boss-buff-added")({ entity: 101, instance: 1, abnormal: 16046701, length: 10000 }, { at: h.now() });
  assert.ok(!h.engine.items().some((item) => item.kind === "phase"));
  await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "Watch the boss");
  assert.ok(!h.engine.items().some((item) => item.key.startsWith("m:")));
  await h.emit("vakron-jump"); assert.equal(h.spoken.at(-1), "Watch the boss", "managed hold without an entry cannot fall back to Jump");
});

test("reviewed universal literal instructions can work without guessing region or mode", async () => {
  const h = await page(); await h.emit("use:1604330:decaying-durvati");
  assert.equal(h.spoken.at(-1), "Fixture literal destroy eggs");
  assert.equal(h.context().region, null); assert.equal(h.context().category, "auto");
});

test("a missing or empty scope registry cannot reactivate legacy directions", async () => {
  for (const registry of [() => undefined, () => ({ entries: [], dungeons: {} })]) {
    const h = await page({ registry }); await h.emit("thamon-violet");
    assert.equal(h.spoken.at(-1), "Watch the boss");
    await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "Watch the boss");
  }
});

test("Global and KR disjoint variants require their own difficulty and category", async () => {
  for (const [region, difficulty, expected] of [["Global", "normal", "Fixture Global magic instruction"], ["KR", "hard", "Fixture KR magic instruction"]]) {
    const h = await page(); await scope(h, region, "conquest", ".guideDifficulty", difficulty);
    await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), expected);
    await h.choose(".guideDifficulty", difficulty === "normal" ? "hard" : "normal");
    await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), "Watch the boss");
    await h.choose(".guideCategory", "sanctuary");
    await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), "Watch the boss");
  }
});

test("wrong stage holds mark instructions without building an order or using legacy speech", async () => {
  for (const [region, wrongStage] of [["Global", 7], ["KR", 3]]) {
    const h = await page(); await scope(h, region, "transcendence", ".guideStage", wrongStage);
    await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "Watch the boss");
    assert.ok(!h.engine.items().some((item) => item.key.startsWith("m:")));
  }
});

test("eligible reviewed sign keeps its short reminder only after the regional scope matches", async () => {
  for (const [region, stage] of [["Global", 3], ["KR", 7]]) {
    const h = await page(); await scope(h, region, "transcendence", ".guideStage", stage);
    await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "Remember dark shield");
    assert.equal(h.engine.items()[0].text, "Dark");
  }
});

test("eligible reviewed phase keeps its short stop command only after the regional scope matches", async () => {
  const h = await page(); await scope(h, "KR", "conquest", ".guideDifficulty", "hard");
  h.handlers.get("decoded:boss-buff-added")({ entity: 101, instance: 1, abnormal: 16046701, length: 10000 }, { at: h.now() });
  assert.equal(h.spoken.at(-1), "Stop magic");
  assert.equal(h.engine.items()[0].text, "Stop magic");
});

test("held standalone phases cannot issue completion from a later removal", async () => {
  const h = await page();
  h.handlers.get("decoded:boss-buff-added")({ entity: 101, instance: 1, abnormal: 16046701, length: 10000 }, { at: h.now() });
  h.handlers.get("decoded:boss-buff-removed")({ entity: 101, instance: 1 }, { at: h.now() });
  assert.equal(h.spoken.length, 0); assert.equal(h.engine.items().length, 0);
});

test("wrong regional difficulty also blocks curated phase labels and completion", async () => {
  const h = await page(); await scope(h, "Global", "conquest", ".guideDifficulty", "hard");
  h.handlers.get("decoded:boss-buff-added")({ entity: 101, instance: 1, abnormal: 16046701, length: 10000 }, { at: h.now() });
  h.handlers.get("decoded:boss-buff-removed")({ entity: 101, instance: 1 }, { at: h.now() });
  assert.equal(h.spoken.length, 0); assert.equal(h.engine.items().length, 0);
});

test("custom wording and action-mode opt-out remain explicit overrides of scoped holds", async () => {
  const h = await page({ stored: { style: "line", custom: { "thamon-violet": "My exact warning", "talisra-dark-spear": "My dark sign" } } });
  await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), "My exact warning");
  await h.emit("talisra-dark-spear"); assert.equal(h.spoken.at(-1), "My dark sign");
  await h.advance(7000);
  h.handlers.get("decoded:boss-buff-added")({ entity: 101, instance: 1, abnormal: 16046701, length: 10000 }, { at: h.now() });
  assert.equal(h.engine.items()[0].text, "My exact warning");
  const old = await page({ stored: { tellMeWhatToDo: false, style: "act" } });
  await old.emit("thamon-violet"); assert.equal(old.spoken.at(-1), "Purple — stop magic attacks");
  await old.emit("talisra-dark-spear"); assert.equal(old.spoken.at(-1), "Dark");
});

test("explicit preview needs region for disjoint entries and shows selected scope qualification", async () => {
  const h = await page(); h.engine.preview("thamon-violet"); assert.equal(h.spoken.at(-1), "Watch the boss");
  await h.choose(".guideRegion", "KR");
  h.engine.preview("thamon-violet"); assert.equal(h.spoken.at(-1), "Fixture KR magic instruction");
  assert.match(h.engine.items()[0].sub, /Korea \(KR\).*Hard/);
  assert.equal(h.context().difficulty, undefined, "preview does not silently select a live difficulty");
  assert.equal(h.context().category, "auto");
});

test("explicit mark preview also qualifies its known region and stage", async () => {
  const h = await page(); await h.choose(".guideRegion", "Global");
  h.engine.preview("talisra-dark-spear");
  assert.equal(h.spoken.at(-1), "Remember dark shield");
  assert.match(h.engine.items()[0].sub, /Global.*3/);
});

test("manual encounter fields are ephemeral and category changes clear the other selections", async () => {
  const h = await page({ stored: { guideRegion: "Global", guideCategory: "trial", guideDifficulty: "hard", guideStage: 17, style: "line", custom: { "thamon-violet": "Preserve me" }, volume: 63 } });
  assert.equal(h.context().category, "auto"); assert.equal(h.context().stage, null);
  assert.equal(h.saved.length, 0, "startup does not rewrite saved preferences");
  await h.choose(".guideCategory", "transcendence"); await h.choose(".guideStage", 3);
  assert.equal(h.saved.length, 0, "encounter selection alone never writes preferences");
  await h.choose(".guideCategory", "conquest");
  assert.equal(h.context().stage, null); assert.equal(h.context().difficulty, undefined);
  await h.choose(".guideDifficulty", "normal");
  await h.choose(".guideRegion", "KR");
  const saved = h.saved.at(-1).value;
  assert.equal(saved.guideRegion, "KR"); assert.equal(saved.style, "line"); assert.equal(saved.volume, 63);
  assert.equal(saved.custom["thamon-violet"], "Preserve me");
  for (const key of ["guideCategory", "guideDifficulty", "guideStage"]) assert.ok(!(key in saved), key);
});

test("only observed exact map difficulty is automatic and travel resets manual category and stage", async () => {
  const h = await page(); await scope(h, "Global", "transcendence", ".guideStage", 3);
  h.handlers.get("decoded:boss-map")({ count: 1, map: 200001 }, { at: h.now() }); await h.advance();
  assert.equal(h.context().difficulty, "normal"); assert.equal(h.context().category, "auto"); assert.equal(h.context().stage, null);
  await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), "Watch the boss", "map difficulty cannot invent activity");
  await h.choose(".guideCategory", "conquest");
  await h.emit("thamon-violet"); assert.equal(h.spoken.at(-1), "Fixture Global magic instruction");
  h.handlers.get("decoded:boss-map")({ count: 1, map: 299999 }, { at: h.now() }); await h.advance();
  assert.equal(h.context().difficulty, null); assert.equal(h.context().region, "Global");
});

test("map reset and a subsequent cast in the same batch preserve captured ordering and reject old manual scope", async () => {
  const h = await page(); await scope(h, "Global", "conquest", ".guideDifficulty", "normal"); await h.advance(100);
  h.handlers.get("decoded:boss-map")({ count: 1, map: 200001 }, { at: h.now() - 30 });
  await h.emit("thamon-violet", { at: h.now() - 20 });
  assert.equal(h.spoken.at(-1), "Watch the boss");
  assert.equal(h.engine.items()[0].text, "Watch the boss", "valid new-map event is evaluated, with manual activity now unknown");
  assert.equal(h.context().category, "auto");
});

test("unchanged game state preserves scope; process changes reset ephemeral choices while preserving region", async () => {
  const h = await page(); await scope(h, "Global", "transcendence", ".guideStage", 3);
  h.handlers.get("game")({ running: true }); assert.equal(h.context().stage, 3);
  h.handlers.get("game")({ running: false }); assert.equal(h.context().stage, null); assert.equal(h.context().category, "auto");
  h.handlers.get("game")({ running: true }); assert.equal(h.context().region, "Global");
});

test("UI language cannot select or change region, category, difficulty or stage", async () => {
  const h = await page(); h.handlers.get("language")("ko"); assert.equal(h.context().region, null);
  await scope(h, "Global", "transcendence", ".guideStage", 3);
  h.handlers.get("language")("ko");
  assert.equal(h.context().region, "Global"); assert.equal(h.context().stage, 3); assert.equal(h.context().category, "transcendence");
});

test("real generated registry is loaded with the shipped activation path", { skip: !fs.existsSync(path.join(plugin, "mechanics.js")) }, async () => {
  const h = await page({ registry: "real" });
  assert.ok(h.registry.entries.length > 0); assert.ok(Object.values(h.registry.managedKeys).flat().length > 0);
  assert.equal(h.context().region, null);
});

test("all real managed keys hold legacy directions while live region is unknown", { skip: !fs.existsSync(path.join(plugin, "mechanics.js")) }, async () => {
  const h = await page({ registry: "real" });
  for (const [index, call] of h.data.calls.entries()) {
    const before = h.spoken.length, entity = 1000 + index;
    const event = call.t === "cast" ? "boss-cast" : call.t === "use" ? "boss-skill" : "boss-buff-added";
    h.handlers.get(`decoded:${event}`)(call.t === "abnormal" ? { entity, abnormal: call.id, instance: 1, length: 10000 } : { caster: entity, skill: call.id }, { at: h.now() });
    await flush();
    if (h.spoken.length > before) assert.equal(h.spoken.at(-1), "Watch the boss", call.k);
  }
  assert.equal(h.context().region, null);
});

test("real registry live instructions match each supplied exact region and encounter scope", { skip: !fs.existsSync(path.join(plugin, "mechanics.js")) }, async () => {
  const h = await page({ registry: "real" });
  for (const [index, entry] of h.registry.entries.entries()) {
    const call = h.data.calls.find((row) => row.k === entry.k && row.b === entry.bossKey && row.t === entry.t && row.id === entry.id);
    assert.ok(call, entry.k);
    await h.choose(".guideRegion", entry.scope.regions[0]);
    await h.choose(".guideCategory", entry.scope.categories[0] || "auto");
    if (entry.scope.difficulties.length) await h.choose(".guideDifficulty", entry.scope.difficulties[0]);
    if (entry.scope.stages.length) await h.choose(".guideStage", entry.scope.stages[0]);
    const shared = new Set(h.data.calls.filter((row) => row.t === call.t && row.id === call.id).map((row) => row.b)).size > 1;
    const before = h.spoken.length, entity = 1000 + index;
    const event = call.t === "cast" ? "boss-cast" : call.t === "use" ? "boss-skill" : "boss-buff-added";
    h.handlers.get(`decoded:${event}`)(call.t === "abnormal" ? { entity, abnormal: call.id, instance: 1, length: 10000 } : { caster: entity, skill: call.id }, { at: h.now() });
    await flush();
    if (call.bind) assert.equal(h.spoken.length, before, `${entry.k}: a new entity has no bound boss identity`);
    else assert.equal(h.spoken.at(-1), shared ? "Watch the boss" : call.k === "talisra-dark-spear" ? "Remember dark shield" : call.k === "talisra-light-spear" ? "Remember light shield" : entry.text.en, `${entry.k} / ${entry.scope.regions[0]}`);
  }
});

test("single-region previews cannot use a conflicting explicitly selected region", { skip: !fs.existsSync(path.join(plugin, "mechanics.js")) }, async () => {
  const h = await page({ registry: "real" });
  const entry = h.registry.entries.find((row) => row.scope.regions.length === 1 && row.scope.regions[0] === "KR"
    && h.registry.entries.filter((other) => other.k === row.k && other.bossKey === row.bossKey && other.t === row.t && other.id === row.id).length === 1);
  assert.ok(entry);
  await h.choose(".guideRegion", "Global");
  h.engine.preview(entry.k);
  assert.equal(h.spoken.at(-1), "Watch the boss", entry.k);
});
