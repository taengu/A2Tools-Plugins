import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = (name) => readFileSync(new URL(`../plugins/cooldowns/${name}`, import.meta.url), "utf8");
const SERVER_OFFSET = 1_000_000_000;
const buff = (end, length = 10000) => ({ instance: 1, abnormal: 42, flags: 0, length, end: SERVER_OFFSET + end });

function parser() {
  const context = vm.createContext({
    window: {}, UI: { en: {} }, TextEncoder,
    document: { querySelector: () => ({}) },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
  });
  vm.runInContext(`${source("plugin.js").split("// ---- The page")[0]}
    globalThis.api = { onBuffAdded, onBuffChanged, live };`, context);
  return context.api;
}

// Run the shipped widget's tick against one existing icon, without a browser.
function icon() {
  let now = 1000;
  const parts = new Map();
  const el = {
    style: { setProperty(key, value) { this[key] = value; } },
    classList: { toggle() {} },
    querySelector(selector) {
      if (!parts.has(selector)) parts.set(selector, { textContent: "" });
      return parts.get(selector);
    },
  };
  const context = vm.createContext({
    window: {}, Date: class extends Date { static now() { return now; } },
    document: { querySelector: () => ({ addEventListener() {} }), addEventListener() {} },
    setInterval() {}, a2: { on() {}, ready() {}, widget: { post: async () => {} } },
  });
  vm.runInContext(`${source("widget.js")}\nglobalThis.api = { tick, nodes };`, context);
  return (b, at) => {
    now = at;
    context.api.nodes.set("buff", { el, art: { style: {} }, slot: { buff: true, buffStart: b.start, buffEnd: b.end } });
    context.api.tick();
    return { ring: el.style["--r"], text: el.querySelector(".buffNum").textContent };
  };
}

test("a refreshed buff restarts its ring with its countdown", () => {
  const p = parser();
  const draw = icon();
  p.onBuffAdded(buff(11000), 1000);
  assert.deepEqual(draw(p.live.buffs.get(1), 6000), { ring: "180deg", text: "5.0" });
  p.onBuffChanged(buff(16000), 6000);
  assert.deepEqual(draw(p.live.buffs.get(1), 6000), { ring: "360deg", text: "10" });
  assert.deepEqual(draw(p.live.buffs.get(1), 11000), { ring: "180deg", text: "5.0" });
});

test("a stack change retaining the interval does not restart progress", () => {
  const p = parser();
  p.onBuffAdded(buff(11000), 1000);
  p.onBuffChanged(buff(11000), 6000);
  assert.deepEqual(icon()(p.live.buffs.get(1), 6000), { ring: "180deg", text: "5.0" });
});

test("a late change uses the server interval, not its arrival time", () => {
  const p = parser();
  p.onBuffAdded(buff(11000), 1000);
  p.onBuffChanged(buff(16000), 8500);
  assert.deepEqual(icon()(p.live.buffs.get(1), 8500), { ring: "270deg", text: "7.5" });
});

test("a change without the original add uses the known server clock", () => {
  const p = parser();
  p.live.clock = SERVER_OFFSET;
  p.onBuffChanged(buff(16000, 15000), 8500);
  assert.equal(p.live.buffs.get(1).start, 1000);
  assert.deepEqual(icon()(p.live.buffs.get(1), 8500), { ring: "180deg", text: "7.5" });
});

test("an unknown interval preserves the existing start", () => {
  const p = parser();
  p.onBuffAdded(buff(11000), 1000);
  p.onBuffChanged(buff(16000, 0), 6000);
  assert.equal(p.live.buffs.get(1).start, 1000);
  assert.equal(p.live.buffs.get(1).end, 16000);
});

test("changes remain ignored until the server clock is known", () => {
  const p = parser();
  p.onBuffChanged(buff(16000), 6000);
  assert.equal(p.live.buffs.size, 0);
});
