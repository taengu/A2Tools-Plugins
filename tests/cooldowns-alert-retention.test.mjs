import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const alerts = source.slice(source.indexOf("const alerted ="), source.indexOf("// ---- The page"));

test("expired dedupe entries cannot evict an active buff warning", () => {
  let now = 10_000, tick, chimes = 0;
  const buffs = new Map([[2, { a: 2, start: 1000, end: 12_000 }]]);
  const ctx = vm.createContext({ Date: { now: () => now }, live: { cd: new Map(), buffs }, prefs: { lead: 3 },
    mine: { skills: {}, buffs: { 2: { sound: true } } }, checkAway() {}, ding: () => { chimes++; },
    setInterval: (fn) => { tick = fn; },
  });
  vm.runInContext(`${alerts}\nfor (let i=0; i<500; i++) alerted.set("old:" + i, 9000);`, ctx);
  tick();
  tick();
  assert.equal(chimes, 1);
  assert.equal(vm.runInContext("alerted.size", ctx), 1);
  now = 12_001;
  tick();
  assert.equal(vm.runInContext("alerted.size", ctx), 0);
});
