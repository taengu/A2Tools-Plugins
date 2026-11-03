import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = (name) => readFileSync(new URL(`../plugins/cooldowns/${name}`, import.meta.url), "utf8");
const SERVER_OFFSET = 1_000_000_000;

function plugin() {
  let now = 1000;
  const intervals = [];
  const context = vm.createContext({
    window: {}, UI: { en: {} }, TextEncoder,
    Date: class extends Date { static now() { return now; } },
    document: { querySelector: () => ({}) },
    setTimeout: () => 1, clearTimeout() {}, setInterval(callback) { intervals.push(callback); },
    a2: { widgets: { send: async () => {} } },
  });
  vm.runInContext(`${source("skills.js")}\n${source("plugin.js").split("// ---- The page")[0]}
    let tab = "skills";
    function renderSkills() {}
    function renderBuffs() {}
    prefs.combatOnly = true;
    prefs.combatAfter = 10;
    globalThis.api = {
      onSkill, onCooldowns, onBuffAdded, onBuffChanged, onBuffRemoved, live,
      skill: (g) => SKILLS.get(g),
      longSkill: [...SKILLS.values()].find((s) => s.cls === "18" && s.cd >= 30000 && !s.ch && !s.held).g,
      buff: (name) => Number(Object.keys(DATA.buffs).find((id) => DATA.buffNames[DATA.buffs[id].t]?.en === name)),
      state: () => ({ away, lastSkillAt }),
    };`, context);
  return { ...context.api, at(time) { now = time; for (const callback of intervals) callback(); } };
}

for (const [name, skill] of [["Sprint Mantra", 18160000], ["Undefeated Mantra", 18190000]]) {
  test(`${name} staying active and refreshing does not extend the ten-second idle timer`, () => {
    const p = plugin();
    p.onSkill({ skill }, 1000);
    const abnormal = p.buff(name);
    assert.ok(Number.isInteger(abnormal) && abnormal > 0);
    p.onBuffAdded({ instance: 1, abnormal, flags: 2, skill, length: 10000, end: SERVER_OFFSET + 11000 }, 1000);
    for (let time = 2000; time <= 12000; time += 1000) {
      p.onBuffChanged({ instance: 1, abnormal, length: 10000, end: SERVER_OFFSET + time + 10000 }, time);
      p.at(time);
    }
    assert.equal(p.state().lastSkillAt, 1000);
    assert.equal(p.state().away, true);
    assert.equal(p.live.buffs.get(1).end, 22000, "the Mantra remains active while the bar is away");
  });
}

test("buff applications, removals and endless buff markers are not skill activity", () => {
  const p = plugin();
  p.onSkill({ skill: 18160000 }, 1000);
  p.onBuffAdded({ instance: 1, abnormal: p.buff("Sprint Mantra"), flags: 0, length: 10000, end: SERVER_OFFSET + 18000 }, 8000);
  p.onBuffRemoved({ instance: 1 }, 9000);
  p.onBuffAdded({ instance: 2, abnormal: 42, flags: 0, length: 1e15, end: 1e15 }, 10000);
  p.at(11250);
  assert.equal(p.state().lastSkillAt, 1000);
  assert.equal(p.state().away, true);
});

test("decreasing cooldown snapshots do not keep the bar awake while a long cooldown remains", () => {
  const p = plugin();
  const group = p.longSkill;
  const total = p.skill(group).cd;
  p.onSkill({ skill: group }, 1000);
  for (let time = 2000; time <= 12000; time += 1000) {
    p.onCooldowns({ skills: [{ group, ms: total - (time - 1000) }] }, time);
    p.at(time);
  }
  assert.equal(p.state().lastSkillAt, 1000);
  assert.equal(p.state().away, true);
  assert.ok(p.live.cd.get(group).end > 12000);
});

test("a ready/reset cooldown is not activity, but an inferred new use restores the bar", () => {
  const p = plugin();
  p.onSkill({ skill: 18160000 }, 1000);
  p.onCooldowns({ skills: [{ group: 18160000, ms: 0 }] }, 6000);
  p.at(11250);
  assert.equal(p.state().lastSkillAt, 1000);
  assert.equal(p.state().away, true);
  p.at(12000);
  p.onCooldowns({ skills: [{ group: 18160000, ms: 5000 }] }, 12000);
  assert.equal(p.state().lastSkillAt, 12000);
  assert.equal(p.state().away, false);
});

test("a real skill use restores the bar and starts another ten-second idle interval", () => {
  const p = plugin();
  p.onSkill({ skill: 18160000 }, 1000);
  p.at(11250);
  assert.equal(p.state().away, true);
  p.at(12000);
  p.onSkill({ skill: 18190000 }, 12000);
  assert.equal(p.state().away, false);
  p.at(22000);
  assert.equal(p.state().away, false, "the existing timer checks strictly after the selected interval");
  p.at(22250);
  assert.equal(p.state().away, true);
});

function widget() {
  const handlers = new Map();
  const element = () => ({
    style: { setProperty(key, value) { this[key] = value; } },
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, append() {}, remove() {},
    querySelector() { return { style: {}, textContent: "" }; },
  });
  const grid = element();
  const context = vm.createContext({
    window: {}, Date: class extends Date { static now() { return 12000; } },
    document: { querySelector: () => grid, documentElement: element(), body: element(), createElement: element, addEventListener() {} },
    setInterval() {}, a2: { on(name, callback) { handlers.set(name, callback); }, ready() {}, widget: { post: async () => {} } },
  });
  vm.runInContext(source("widget.js"), context);
  return { grid, emit(name, data) { handlers.get(name)(data); } };
}

test("idle hiding applies when locked; unlocked widgets intentionally remain available for positioning", () => {
  const w = widget();
  w.emit("widget", { look: { away: true, opacity: 0.8 }, slots: [{ key: "mantra", buff: true, buffStart: 1000, buffEnd: 22000 }] });
  assert.equal(w.grid.style.opacity, "0.8", "unlocked placement preview remains visible");
  w.emit("locked", true);
  assert.equal(w.grid.style.opacity, "0", "locking applies the already expired idle timer immediately");
  w.emit("locked", false);
  assert.equal(w.grid.style.opacity, "0.8");
  w.emit("locked", true);
  w.emit("widget", { look: { away: false } });
  assert.equal(w.grid.style.opacity, "0.8", "activity or disabling the setting restores visibility");
});
