import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = (name) => readFileSync(new URL(`../plugins/cooldowns/${name}`, import.meta.url), "utf8");

function engine(learned = {}) {
  const context = vm.createContext({
    window: {}, UI: { en: {} }, TextEncoder,
    Date: class extends Date { static now() { return 1000; } },
    document: { querySelector: () => ({}) },
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
  });
  vm.runInContext(`${source("skills.js")}\n${source("plugin.js").split("// ---- The page")[0]}
    function renderSkills() {}
    globalThis.api = { onSkill, onCooldowns, slots, learn(values) { mine.learned = values; } };`, context);
  context.api.learn(learned);
  return context.api;
}

function shield() {
  const p = engine();
  p.onSkill({ skill: 12110010 }, 1000);
  return p.slots().skills.find((slot) => slot.key === "s12110000");
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

test("Recuperation restores each charge in 15 seconds despite inferred ordinary cooldown reduction", () => {
  const p = engine({ 18290000: 24000 }); // A 30-second ordinary cooldown measured at 24.
  p.onSkill({ skill: 18120010 }, 1000);
  const slot = () => p.slots().skills.find((s) => s.key === "s18120000");
  assert.equal(slot().chPer, 15000);
  assert.equal(icon(slot())(1000).text, "15");
  p.onSkill({ skill: 18120010 }, 2000);
  const draw = icon(slot());
  assert.equal(slot().cdEnd, 16000, "the first charge must not return after 12 seconds");
  assert.equal(draw(13000).charges, "", "zero usable charges have no count badge");
  assert.equal(draw(13000).text, "3.0");
  assert.equal(draw(16000).charges, "1");
  assert.equal(draw(16000).text, "15");
  assert.equal(draw(28000).charges, "1", "the second charge also needs its full interval");
  assert.equal(draw(31000).charges, "2");
  assert.equal(draw(31000).hidden, true);
});

test("Recuperation keeps the shorter charge interval of its 12-second variants", () => {
  const p = engine({ 18290000: 24000 });
  p.onSkill({ skill: 18120150 }, 1000);
  const slot = p.slots().skills.find((s) => s.key === "s18120000");
  assert.equal(slot.chPer, 12000);
  const draw = icon(slot);
  assert.equal(draw(1000).text, "12");
  assert.equal(draw(11000).charges, "1");
  assert.equal(draw(13000).charges, "2");
});

test("Recuperation charge timing still accepts the server's remaining-time corrections", () => {
  const p = engine({ 18290000: 24000 });
  p.onSkill({ skill: 18120010 }, 1000);
  p.onSkill({ skill: 18120010 }, 2000);
  p.onCooldowns({ skills: [{ group: 18120000, ms: 14000 }] }, 3000);
  const slot = () => p.slots().skills.find((s) => s.key === "s18120000");
  assert.equal(slot().cdEnd, 17000);
  assert.equal(slot().chFull, 32000);
  assert.equal(icon(slot())(17000).charges, "1");
  p.onCooldowns({ skills: [{ group: 18120000, ms: 0 }] }, 4000);
  assert.equal(slot().chFull, 19000);
  assert.equal(icon(slot())(4000).charges, "1");
});

test("ordinary Recuperation and other skills retain their cooldown reduction", () => {
  const p = engine({ 18290000: 24000 });
  p.onSkill({ skill: 18120010 }, 1000);
  p.onSkill({ skill: 18120000 }, 2000);
  const slot = p.slots().skills.find((s) => s.key === "s18120000");
  assert.equal(slot.cdEnd, 14000);
  assert.equal(slot.chPer, undefined, "switching to the ordinary variant clears charge timing");
  p.onSkill({ skill: 12110010 }, 1000);
  assert.equal(p.slots().skills.find((s) => s.key === "s12110000").chPer, 16000);
});
