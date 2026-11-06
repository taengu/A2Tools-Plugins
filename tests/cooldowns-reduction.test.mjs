import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// How Cooldowns estimates a skill it hasn't learned yet: its base, times the
// reduction its learned skills show (#183).
const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const part = source.slice(source.indexOf("function reduction()"), source.indexOf("\n// A use, announced"));

function estimate(learned, skills) {
  const SKILLS = new Map(Object.entries(skills).map(([g, cd]) => [Number(g), { cd }]));
  const context = vm.createContext({ SKILLS, mine: { learned } });
  vm.runInContext(`${part}\nglobalThis.cooldownOf = cooldownOf;`, context);
  return (g) => context.cooldownOf(g);
}

test("skills shortened on their own don't shorten the others", () => {
  // -10% for every skill; two skills also cut by a stigma or a proc.
  const cooldownOf = estimate(
    { 1: 9000, 2: 27000, 3: 6000, 4: 4500, 5: 40500 },
    { 1: 10000, 2: 30000, 3: 12000, 4: 10000, 5: 45000, 17400000: 30000 },
  );
  assert.equal(cooldownOf(17400000), 27000);
});

test("one slow reading can't lift the estimate", () => {
  const cooldownOf = estimate(
    { 1: 9000, 2: 27000, 3: 18000, 4: 13200 },
    { 1: 10000, 2: 30000, 3: 20000, 4: 12000, 9: 30000 },
  );
  assert.equal(cooldownOf(9), 27000);
});

test("nothing learned: the base", () => {
  assert.equal(estimate({}, { 9: 30000 })(9), 30000);
});
