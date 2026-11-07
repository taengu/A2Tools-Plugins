import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL("../plugins/alt-roster/logic.js", import.meta.url), "utf8"), context);
const L = context.RosterLogic;

const HOUR = 3_600_000;
// 02:00 UTC on a day: the last refill was 01:00, the next is 04:00.
const now = Date.UTC(2026, 10, 7, 2, 0, 0);

test("the next refill is wasted above cap - 15", () => {
  const seen = (basic) => ({ basic, charged: 0, at: now });
  assert.equal(L.wastesNext(seen(825), 840, now), null, "825 + 15 is exactly 840");
  assert.equal(L.wastesNext(seen(830), 840, now), Date.UTC(2026, 10, 7, 4, 0, 0));
  assert.equal(L.wastesNext(seen(835), 840, now), Date.UTC(2026, 10, 7, 4, 0, 0));
  assert.equal(L.wastesNext(seen(840), 840, now), Date.UTC(2026, 10, 7, 4, 0, 0), "full");
  assert.equal(L.wastesNext(seen(550), 560, now), Date.UTC(2026, 10, 7, 4, 0, 0), "without membership");
  assert.equal(L.wastesNext(null, 840, now), null);
});

test("it goes by the estimate, refills since included", () => {
  // 815 seen at 00:30, a refill at 01:00 since: about 830 now.
  const seen = { basic: 815, charged: 0, at: now - 1.5 * HOUR };
  assert.equal(L.estimate(seen, now, 840).basic, 830);
  assert.ok(L.wastesNext(seen, 840, now));
});
