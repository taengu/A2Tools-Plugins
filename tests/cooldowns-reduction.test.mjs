import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// How Cooldowns estimates a skill it hasn't learned yet: its base, times the
// reduction its learned skills show (#183).
const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const part = source.slice(source.indexOf("function reduction()"), source.indexOf("\n// A use, announced"));

function estimate(learned, skills, cdr, spec, vc = {}) {
  const SKILLS = new Map(Object.entries(skills).map(([g, cd]) => [Number(g), { cd, vc: vc[g] }]));
  const context = vm.createContext({ SKILLS, mine: { learned, cdr, spec } });
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

// xanthics's Cleric, its stat page at -6.7% (#183): every skill not timed
// yet is its base less that, whatever was learnt.
test("the stat page's reduction sets the others", () => {
  const cooldownOf = estimate({ 17060000: 35000, 17150000: 23300 }, { 17060000: 45000, 17150000: 30000, 17440000: 60000, 17070000: 20000 }, 6.7);
  assert.equal(cooldownOf(17440000), 55980);
  assert.equal(cooldownOf(17070000), 18660);
});

test("a time learnt under a passing reduction gives way to the sheet's", () => {
  const cooldownOf = estimate({ 17060000: 35000 }, { 17060000: 45000 }, 6.7);
  assert.equal(cooldownOf(17060000), 41985);
});

test("a skill's own reduction, within a tenth, is kept", () => {
  const cooldownOf = estimate({ 9: 26000 }, { 9: 30000 }, 4.3);
  assert.equal(cooldownOf(9), 26000);
});

// Power of the Storm with its -30 s specialisation (18250010, 90 s), at 4.3%.
test("the variant used sets the base", () => {
  const vc = { 18250000: { 18250010: 90000 } };
  assert.equal(estimate({}, { 18250000: 120000 }, 4.3, { 18250000: 18250010 }, vc)(18250000), 86130);
  assert.equal(estimate({}, { 18250000: 120000 }, 4.3, {}, vc)(18250000), 114840);
});
