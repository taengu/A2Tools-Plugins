import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL("../plugins/dice-rolls/logic.js", import.meta.url), "utf8"), context);
const L = context.DiceLogic;

// The logic runs in its own realm: compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const fold = (events, me) => events.reduce((list, e) => L.apply(list, e, me), []);
const p = (name, serverId) => ({ name, serverId });

// The user's Artwork roll (2026-11-04), as the meter read it.
const ARTWORK = 514310074;
const artwork = [
  { at: 1000, type: "open", rollId: "a609050000010000", itemId: ARTWORK, count: 1, endsAt: 36000 },
  { at: 6000, type: "roll", itemId: ARTWORK, player: p("HeavenDorian", 1304), roll: 2846 },
  { at: 6000, type: "roll", itemId: ARTWORK, player: p("Codix", 1304), roll: 1944 },
  { at: 6200, type: "roll", itemId: ARTWORK, player: p("T7", 1304), roll: 5070 },
  { at: 7200, type: "roll", itemId: ARTWORK, player: p("Exodus", 1304), roll: 3985 },
  { at: 7400, type: "roll", itemId: ARTWORK, player: p("Kayamo", 1304), roll: 3278 },
  { at: 8900, type: "mine", rollId: "a609050000010000", roll: 2003 },
  { at: 9400, type: "won", rollId: "a609050000010000", itemId: ARTWORK, player: p("T7", 1304) },
];
const ME = p("Misti", 1304);

test("a roll from open to winner is one record, rolls high to low", () => {
  const list = fold(artwork, ME);
  assert.equal(list.length, 1);
  const r = list[0];
  assert.equal(r.itemId, ARTWORK);
  assert.equal(r.endsAt, 36000);
  assert.deepEqual(plain(r.rolls.map((x) => x.roll)), [5070, 3985, 3278, 2846, 2003, 1944]);
  assert.equal(r.rolls[4].mine, true);
  assert.equal(r.rolls[4].name, "Misti");
  assert.deepEqual(plain(r.winner), { name: "T7", serverId: 1304, mine: false, roll: 5070 });
  assert.deepEqual(plain(L.place(r)), { place: 5, of: 6 });
});

test("rolls heard before the open, and yours before any item, still meet", () => {
  // The meter started mid-roll: no open, and your roll first.
  const list = fold(artwork.slice(1).reverse().filter((e) => e.type !== "won").concat(artwork[7]), ME);
  assert.equal(list.length, 1, JSON.stringify(list));
  assert.equal(list[0].rolls.length, 6);
  assert.equal(list[0].winner.name, "T7");
});

test("a pass is kept apart from the rolls, and your win is yours", () => {
  const ring = 310330063, id = "8b550f0000ed0000";
  const list = fold([
    { at: 0, type: "open", rollId: id, itemId: ring, count: 1, endsAt: 35000 },
    { at: 1600, type: "mine", rollId: id, roll: 9361 },
    { at: 1900, type: "roll", itemId: ring, player: p("Nyxaris", 1501), roll: 926 },
    { at: 7000, type: "pass", rollId: id, itemId: ring, player: p("Nongkedtk", 1501) },
    { at: 11600, type: "won", rollId: id, itemId: ring, player: p("mRaz", 1501) },
  ], p("mRaz", 1501));
  const r = list[0];
  assert.deepEqual(plain(r.passes.map((x) => x.name)), ["Nongkedtk"]);
  assert.equal(r.winner.mine, true);
  assert.equal(r.winner.roll, 9361);
});

test("two items at once stay apart; the same item again is a new record once the first is over", () => {
  const list = fold([
    { at: 0, type: "open", rollId: "aa", itemId: 1, endsAt: 35000 },
    { at: 0, type: "open", rollId: "bb", itemId: 2, endsAt: 35000 },
    { at: 100, type: "roll", itemId: 1, player: p("A", 1), roll: 10 },
    { at: 100, type: "roll", itemId: 2, player: p("A", 1), roll: 20 },
    { at: 200, type: "won", rollId: "aa", itemId: 1, player: p("A", 1) },
    { at: 300, type: "roll", itemId: 1, player: p("B", 1), roll: 30 },
  ], null);
  assert.equal(list.length, 3);
  assert.deepEqual(plain(list.map((r) => [r.itemId, r.rolls.length])), [[1, 1], [2, 1], [1, 1]]);
});

test("a roll nobody wins is over after its deadline", () => {
  const list = fold([{ at: 0, type: "open", rollId: "cc", itemId: 3, endsAt: 35000 }], null);
  assert.equal(L.settle(list, 35000 + L.GRACE_MS), list, "not yet");
  const over = L.settle(list, 35001 + L.GRACE_MS);
  assert.equal(over[0].endedAt, 35000);
  assert.equal(over[0].winner, null);
});

test("a player's roll counts once, and the history is capped", () => {
  const twice = fold([
    { at: 0, type: "roll", itemId: 5, player: p("A", 1), roll: 10 },
    { at: 1, type: "roll", itemId: 5, player: p("A", 1), roll: 10 },
  ], null);
  assert.equal(twice[0].rolls.length, 1);
  let list = [];
  for (let i = 0; i < L.KEEP + 5; i++) list = L.apply(list, { at: i, type: "won", rollId: `r${i}`, itemId: i, player: p("A", 1) }, null);
  assert.equal(list.length, L.KEEP);
  assert.equal(list[0].itemId, L.KEEP + 4);
});
