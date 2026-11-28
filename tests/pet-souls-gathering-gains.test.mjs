import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Shugo's Ledger's Gathering tab (0.8.8): what a stretch of gathering brought
// in, and where the latest session starts.
const context = vm.createContext({ setInterval: () => 0, Date, Promise, Map, Math, Number,
  a2: { on: () => {}, storage: { get: async () => null, set: async () => {} } },
  document: { body: { classList: { contains: () => false } }, addEventListener: () => {} },
  language: "en", marketKeyOf: (c) => c, marketChar: "me" });
vm.runInContext(readFileSync(new URL("../plugins/pet-souls/gathering.js", import.meta.url), "utf8"), context);
const { gains, sessionStart } = context.GatherGains;
const plain = (v) => JSON.parse(JSON.stringify(v));
const HERB = 610670041, FRESH = 610670045, CRYSTAL = 510116011;
const MIN = 60_000;
// [at, character, item, grade, effects, bonus, status, count, extra, extraCount]
const row = (at, item, { bonus = 0, status = 0, count = 1, extra = 0, extraCount = 0 } = {}) => [at, "me", item, status === 1 ? 2 : 1, null, bonus, status, count, extra, extraCount];

test("a stretch's items: the count, Plentiful Harvest's copies and the extras; a failed gather gives none", () => {
  const got = plain(gains([
    row(0, HERB),
    row(MIN, HERB, { bonus: 1 }),
    row(2 * MIN, FRESH, { status: 1 }),
    row(3 * MIN, HERB, { extra: CRYSTAL, extraCount: 1 }),
    row(4 * MIN, HERB, { status: 2, count: 0 }),
    // A row from before 0.8.8: no extras.
    [5 * MIN, "me", HERB, 1, null, 0, 0, 1],
  ]));
  assert.deepEqual(got.items, [[HERB, 5], [CRYSTAL, 1], [FRESH, 1]].sort((a, b) => b[1] - a[1] || a[0] - b[0]));
  assert.equal(got.gathers, 6);
  assert.equal(got.span, 5 * MIN);
});

test("the latest session runs back to a 15-minute gap", () => {
  const rows = [row(0, HERB), row(5 * MIN, HERB), row(30 * MIN, HERB), row(40 * MIN, HERB), row(54 * MIN, HERB)];
  assert.equal(sessionStart(rows), 30 * MIN);
  assert.equal(sessionStart([row(7, HERB)]), 7);
  assert.equal(sessionStart([]), Infinity);
});

test("Plentiful Harvest doubles a gather of more than one (Mela ×3 → 6), whatever the bonus says", () => {
  const MELA = 610680045;
  const got = plain(gains([row(0, MELA, { status: 1, count: 3, bonus: 1 }), row(MIN, MELA, { status: 1, count: 3, bonus: 3 }), row(2 * MIN, MELA, { status: 1, count: 3 })]));
  assert.deepEqual(got.items, [[MELA, 15]]);
  assert.equal(got.materials, 15);
});

test("each quality's share at the start: an Appraiser upgrade counts as the base it started at", () => {
  const { tally } = context.GatherGains;
  const ODYLE = 610610013, FINE = 610610014, PURE = 610610015;
  const base = (item, start) => [0, "me", item, item === ODYLE ? 1 : 2, start, 0, item === ODYLE ? 0 : 1, 1];
  const s = tally([
    base(ODYLE, 1), base(ODYLE, 1), base(ODYLE, 1),
    base(FINE, 0x07), base(PURE, 0x07),
    // Herb Appraiser: upgraded after a base start.
    base(FINE, 0x03),
    // A failed gather and one whose start wasn't seen: not counted.
    [0, "me", ODYLE, 1, 1, 0, 2, 0], base(ODYLE, null),
  ]);
  const starts = Object.fromEntries([...s.starts]);
  // Fine Odyle pairs back to Odyle (a pair the plugin knows), so the
  // Appraiser's one started as Odyle.
  assert.deepEqual(starts, { [ODYLE]: 4, [FINE]: 1, [PURE]: 1 });
  assert.equal(s.failed, 1);
});
