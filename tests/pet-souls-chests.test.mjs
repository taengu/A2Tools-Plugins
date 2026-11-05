import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// The plugin's counting (levelUp, gain and the event handlers), run on the
// events of three chests opened on 2026-11-05: from the game's pet list before
// them, they must reach the list the game sent after a reconnect.
const source = readFileSync(new URL("../plugins/pet-souls/plugin.js", import.meta.url), "utf8");
const counting = source.slice(source.indexOf("// The souls past a level's cost"), source.indexOf("\n// Counts are kept per server"));
const context = vm.createContext({});
vm.runInContext(`const NEEDED = [5, 25, 75]; const MAX_LEVEL = NEEDED.length; const FARMING_MS = 60000;
${counting}
globalThis.handle = handle;`, context);
const fixture = JSON.parse(readFileSync(new URL("./pet-souls-chests.json", import.meta.url), "utf8"));
const plain = (v) => JSON.parse(JSON.stringify(v));

test("chests: new pets, souls past a level's cost, and the game's level-ups", () => {
  const st = { levels: { ...fixture.before.levels }, points: { ...fixture.before.points } };
  for (const [event, data] of fixture.events) context.handle[event](st, data, 0);
  const pets = new Set([...Object.keys(fixture.after.levels), ...Object.keys(st.levels)]);
  for (const pet of pets) {
    assert.equal(st.levels[pet] || 0, fixture.after.levels[pet] || 0, `pet ${pet}'s level`);
    assert.equal(st.points[pet] || 0, fixture.after.points[pet] || 0, `pet ${pet}'s souls`);
  }
});

test("a level-up the counting didn't make takes the level's cost, not every soul", () => {
  const st = { levels: { 1: 1 }, points: { 1: 29 } };
  context.handle["decoded:level-up"](st, { pet: 1, level: 2 });
  assert.deepEqual(plain(st), { levels: { 1: 2 }, points: { 1: 4 } });
});
