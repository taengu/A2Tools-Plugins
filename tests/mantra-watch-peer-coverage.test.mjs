import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const root = new URL("../plugins/mantra-watch/", import.meta.url),
  read = (name) => readFileSync(new URL(name, root), "utf8");
const BASE = 1_000_000;
function runtime() {
  class Element {
    constructor(tag = "div") {
      this.tagName = tag;
      this.children = [];
      this.nodes = new Map();
      this.flags = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.textContent = "";
      this.hidden = false;
      this.classList = { toggle: (key, on) => this.flags.set(key, !!on) };
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    addEventListener(name, fn) {
      this.listeners.set(name, fn);
    }
    querySelector(key) {
      const child = this.children.find((c) => c.tagName === key);
      if (child) return child;
      if (!this.nodes.has(key)) this.nodes.set(key, new Element());
      return this.nodes.get(key);
    }
  }
  const elements = new Map(),
    callbacks = new Map(),
    intervals = [],
    shows = [];
  let now = BASE;
  const context = {
    console,
    Map,
    Set,
    Promise,
    Date: { now: () => now },
    addEventListener() {},
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: (fn) => {
      intervals.push(fn);
    },
    document: {
      documentElement: {},
      body: new Element(),
      createElement: (tag) => new Element(tag),
      querySelector: (key) => {
        if (!elements.has(key)) elements.set(key, new Element());
        return elements.get(key);
      },
      querySelectorAll: () => [],
    },
  };
  context.globalThis = context;
  context.a2 = {
    on: (name, fn) => callbacks.set(name, fn),
    ready() {},
    storage: {
      async get(key) {
        return key === "prefs" ? { sound: "" } : null;
      },
      async set() {},
    },
    window: {
      async show() {
        shows.push(now);
      },
      async hide() {},
    },
  };
  vm.createContext(context);
  for (const file of ["logic.js", "plugin.js"])
    vm.runInContext(read(file), context, { filename: file });
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const emit = async (name, data, at = now) => {
    callbacks.get(name)?.(data, { at });
    await flush();
  };
  const packet = async (data, at = now) => {
    for (const decoder of JSON.parse(read("manifest.json")).decoders.filter(
      (d) => d.opcode === "2B 38",
    )) {
      if (data[decoder.self] === 1)
        await emit("decoded:" + decoder.name, data, at);
    }
  };
  const tick = (mantra, on = 1, caster = 1) => ({
    kind: 0x13,
    q: 2,
    on,
    caster,
    skill: mantra * 10000 + 10,
  });
  const hit = () =>
    emit("decoded:my-hit", { actor: 1, target: 99, skill: 18010010 });
  const update = () => intervals[0]();
  const banner = () => elements.get(".banner");
  const row = (mantra) =>
    elements.get(".mantras").children[mantra === 1816 ? 0 : 1];
  return {
    context,
    elements,
    shows,
    flush,
    emit,
    packet,
    tick,
    hit,
    update,
    banner,
    row,
    setTime: (t) => (now = t),
  };
}
test("own mantra pulses reaching an ally remain active when another Chanter supplies your copy", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  for (const mantra of [1816, 1819]) await h.packet(h.tick(mantra));
  await h.hit();
  for (const at of [BASE + 1000, BASE + 2000, BASE + 3000]) {
    h.setTime(at);
    for (const mantra of [1816, 1819]) {
      await h.packet(h.tick(mantra, 2, 1));
      await h.packet(h.tick(mantra, 1, 2));
    }
    await h.hit();
    h.update();
  }
  assert.equal(h.banner().hidden, true);
  assert.equal(h.shows.length, 0);
  for (const mantra of [1816, 1819])
    assert.equal(h.row(mantra).flags.get("on"), true);
});
test("another Chanter covering you suppresses false off alarms without claiming your own toggle is on", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  for (const mantra of [1816, 1819]) await h.packet(h.tick(mantra));
  await h.hit();
  for (const at of [BASE + 1000, BASE + 2000, BASE + 3000]) {
    h.setTime(at);
    for (const mantra of [1816, 1819]) await h.packet(h.tick(mantra, 1, 2));
    await h.hit();
    h.update();
  }
  assert.equal(h.banner().hidden, true);
  assert.equal(h.shows.length, 0);
  for (const mantra of [1816, 1819]) {
    assert.equal(h.row(mantra).flags.get("on"), false);
    assert.equal(h.row(mantra).flags.get("covered"), true);
    assert.match(
      h.row(mantra).querySelector(".coverage").textContent,
      /Chanter.*unknown/,
    );
  }
});

test("a genuine loss still alerts once, and a returned own pulse restores the green own state", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816));
  await h.hit();
  h.setTime(BASE + 2300);
  await h.hit();
  h.update();
  assert.equal(h.banner().hidden, false);
  assert.match(h.banner().textContent, /Sprint Mantra is off!/);
  assert.equal(h.shows.length, 1);
  h.update();
  assert.equal(h.shows.length, 1);
  h.setTime(BASE + 2400);
  await h.packet(h.tick(1816, 2, 1));
  h.update();
  assert.equal(h.banner().hidden, true);
  assert.equal(h.row(1816).flags.get("on"), true);
});
test("peer coverage expires normally and cannot hide a later genuine observation gap", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816));
  await h.hit();
  h.setTime(BASE + 1000);
  await h.packet(h.tick(1816, 1, 2));
  h.setTime(BASE + 3000);
  await h.hit();
  h.update();
  assert.equal(h.banner().hidden, true);
  h.setTime(BASE + 3300);
  await h.hit();
  h.update();
  assert.equal(h.banner().hidden, false);
});
test("a peer aura on someone else cannot enter the self coverage channel", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816));
  await h.hit();
  h.setTime(BASE + 3000);
  await h.packet(h.tick(1816, 3, 2));
  await h.hit();
  h.update();
  assert.equal(h.banner().hidden, false);
  assert.equal(h.row(1816).flags.get("covered"), false);
});
test("peer-only coverage never becomes your own activity, reach or fight uptime", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816, 1, 2));
  await h.hit();
  for (const at of [BASE + 1000, BASE + 2000, BASE + 3000]) {
    h.setTime(at);
    await h.packet(h.tick(1816, 1, 2));
    await h.hit();
  }
  assert.equal(h.row(1816).flags.get("on"), false);
  assert.equal(h.row(1816).flags.get("covered"), true);
  assert.equal(h.row(1816).querySelector(".reach").textContent, "");
  assert.match(h.elements.get(".fight").textContent, /0% · 0%/);
});
test("covering one mantra never masks the loss of the other", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  for (const mantra of [1816, 1819]) await h.packet(h.tick(mantra));
  await h.hit();
  for (const at of [BASE + 1000, BASE + 2000, BASE + 3000]) {
    h.setTime(at);
    await h.packet(h.tick(1816, 1, 2));
    await h.hit();
  }
  assert.equal(h.banner().hidden, false);
  assert.match(h.banner().textContent, /Undefeated/);
  assert.doesNotMatch(h.banner().textContent, /Sprint/);
});
test("stale, missing, future and old out-of-order peer records cannot postpone a loss", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816));
  await h.hit();
  h.setTime(BASE + 3000);
  for (const at of [undefined, NaN, BASE + 3001, BASE - 3000]) {
    if (at === undefined)
      await h.emit("decoded:mantra-cover", h.tick(1816, 1, 2), NaN);
    else await h.emit("decoded:mantra-cover", h.tick(1816, 1, 2), at);
  }
  await h.hit();
  h.update();
  assert.equal(h.banner().hidden, false);
  await h.packet(h.tick(1816, 1, 2));
  assert.equal(h.banner().hidden, true);
  h.setTime(BASE + 3100);
  await h.packet(h.tick(1816, 1, 2), BASE + 1000);
  h.update();
  assert.equal(h.banner().hidden, true);
});
test("changing characters clears peer coverage and rejects delayed previous-character pulses", async () => {
  const h = runtime();
  await h.flush();
  await h.emit("character", { name: "Tester", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816, 1, 2));
  h.setTime(BASE + 1000);
  await h.emit("character", { name: "Other", serverId: 1, class: "호법성" });
  await h.packet(h.tick(1816, 1, 2), BASE);
  await h.packet(h.tick(1816, 1, 1), BASE);
  h.update();
  assert.equal(h.row(1816).flags.get("covered"), false);
  assert.equal(h.row(1816).flags.get("on"), false);
});
test("the ownership channels stay separately scoped to self caster and self recipient", () => {
  const m = JSON.parse(read("manifest.json"));
  assert.equal(m.decoders.find((d) => d.name === "mantra-tick").self, "caster");
  assert.equal(m.decoders.find((d) => d.name === "mantra-cover").self, "on");
  assert.ok(m.permissions.includes("decoder:mantra-cover"));
  assert.ok(!m.permissions.some((p) => /network|https/.test(p)));
});
test("all ten interface dictionaries and the new release note cover the affected wording", () => {
  const h = runtime(),
    ui = vm.runInContext("UI", h.context),
    locales = [
      "en",
      "ko",
      "ja",
      "de",
      "fr",
      "es",
      "pt",
      "ru",
      "zh-Hant",
      "zh-Hans",
    ];
  const changes = JSON.parse(read("changes.json"));
  assert.equal(changes[0].version, JSON.parse(read("manifest.json")).version);
  assert.ok(changes.length <= 5);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(ui[locale]).sort(), Object.keys(ui.en).sort());
    assert.ok(ui[locale].coveredOther.trim());
    assert.ok(ui[locale].off("Mantra").trim());
    if (locale !== "en")
      assert.notEqual(ui[locale].coveredOther, ui.en.coveredOther);
    for (const note of changes) {
      assert.ok(note[locale]?.trim());
      assert.ok([...note[locale]].length <= 300);
      if (locale !== "en") assert.notEqual(note[locale], note.en);
    }
  }
});
