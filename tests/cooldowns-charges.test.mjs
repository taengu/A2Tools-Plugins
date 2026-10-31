import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = (name) => readFileSync(new URL(`../plugins/cooldowns/${name}`, import.meta.url), "utf8");

function shield() {
  const context = vm.createContext({
    window: {}, UI: { en: {} }, TextEncoder,
    Date: class extends Date { static now() { return 1000; } },
    document: { querySelector: () => ({}) },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
  });
  vm.runInContext(`${source("skills.js")}\n${source("plugin.js").split("// ---- The page")[0]}
    function renderSkills() {}
    globalThis.api = { onSkill, slots };`, context);
  context.api.onSkill({ skill: 12110010 }, 1000);
  return context.api.slots().skills.find((slot) => slot.key === "s12110000");
}

// Run the shipped widget against one icon, with a controlled clock.
function icon(slot, locked = true) {
  let now = 1000;
  let flashes = 0;
  const classes = new Set();
  const parts = new Map();
  const el = {
    style: { setProperty(key, value) { this[key] = value; } },
    classList: {
      toggle(key, on) { if (on) classes.add(key); else classes.delete(key); },
      add(key) { classes.add(key); if (key === "flash") flashes++; },
      remove(key) { classes.delete(key); },
    },
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
  vm.runInContext(`${source("widget.js")}\nglobalThis.api = { tick, nodes, lock(on) { locked = on; } };`, context);
  context.api.lock(locked);
  context.api.nodes.set("skill", { el, art: { style: {} }, slot, wasCooling: false });
  return (at) => {
    now = at;
    context.api.tick();
    return {
      text: el.querySelector(".cdNum").textContent,
      charges: el.querySelector(".chNum").textContent,
      sweep: el.style["--p"], cooling: classes.has("cooling"),
      both: classes.has("both"), hidden: el.hidden, flashes,
    };
  };
}

test("Shield of Protection shows the spent charge's recharge while one remains usable", () => {
  const slot = shield();
  assert.equal(slot.chMax, 2);
  assert.equal(slot.chPer, 20000);
  assert.equal(slot.cdEnd, 0, "the engine's readiness timer is intentionally clear");
  const draw = icon(slot);
  assert.deepEqual(draw(1000), {
    text: "20", charges: "1", sweep: "360deg", cooling: true,
    both: false, hidden: false, flashes: 0,
  });
  assert.equal(draw(11000).sweep, "180deg");
  assert.equal(draw(11000).text, "10");
  const full = draw(21000);
  assert.equal(full.text, "");
  assert.equal(full.charges, "2");
  assert.equal(full.cooling, false);
  assert.equal(full.hidden, true, "a ready icon still honors Keep showing when ready");
});

test("each missing charge gets its own sweep and the first usable charge still flashes", () => {
  const draw = icon({ cdStart: 2000, cdEnd: 21000, chMax: 3, chPer: 20000, chFull: 61000 });
  assert.equal(draw(2000).text, "19");
  assert.equal(draw(11000).sweep, `${(10000 / 19000) * 360}deg`, "an unusable skill keeps its existing cooldown interval");
  assert.equal(draw(21000).text, "20");
  assert.equal(draw(21000).charges, "1");
  assert.equal(draw(21000).sweep, "360deg");
  assert.equal(draw(21000).flashes, 1);
  assert.equal(draw(41000).charges, "2");
  assert.equal(draw(41000).text, "20");
  assert.equal(draw(41000).flashes, 1, "recharging another charge is not a second ready transition");
  assert.equal(draw(61000).hidden, true);
});

test("recharging alongside a buff uses the combined timer layout", () => {
  const draw = icon({ ...shield(), buffStart: 1000, buffEnd: 11000 });
  assert.equal(draw(1000).both, true);
  assert.equal(draw(11000).both, false);
  assert.equal(draw(11000).text, "10");
});

test("ordinary cooldowns and unlocked placement placeholders retain their behavior", () => {
  const draw = icon({ cdStart: 1000, cdEnd: 11000 }, false);
  assert.equal(draw(6000).text, "5.0");
  assert.equal(draw(6000).sweep, "180deg");
  assert.equal(draw(11000).text, "");
  assert.equal(draw(11000).cooling, false);
  assert.equal(draw(11000).hidden, false);
  assert.equal(draw(11000).flashes, 1);
});
