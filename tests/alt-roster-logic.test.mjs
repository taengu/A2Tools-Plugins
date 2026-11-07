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

test("each alert mode's mark", () => {
  assert.equal(L.alertMark(840, "off"), null);
  assert.equal(L.alertMark(840, "waste"), 825, "over 825: the next +15 is wasted");
  assert.equal(L.alertMark(840, "early1"), 810);
  assert.equal(L.alertMark(840, "early3"), 780);
  assert.equal(L.alertMark(840, "full"), 839, "over 839: at the cap");
  assert.equal(L.alertMark(560, "waste"), 545);
});

test("an alert fires once as a character goes over, again after using energy", () => {
  const ch = (key, basic, extra = {}) => ({ key, energy: { basic, charged: 0, at: now }, cap: 840, ...extra });
  // Naicha over the mark, Bo under it.
  let r = L.alertsDue([ch("naicha", 830), ch("bo", 700)], "waste", "all", {}, now);
  assert.deepEqual([...r.fire], ["naicha"]);
  // Still over: no second alert.
  r = L.alertsDue([ch("naicha", 835)], "waste", "all", r.alerted, now);
  assert.deepEqual([...r.fire], []);
  // Energy used, under again: forgotten, so going over alerts again.
  r = L.alertsDue([ch("naicha", 500)], "waste", "all", r.alerted, now);
  assert.deepEqual([...r.fire], []);
  r = L.alertsDue([ch("naicha", 830)], "waste", "all", r.alerted, now);
  assert.deepEqual([...r.fire], ["naicha"]);
  // A refill between sightings takes 815 seen at 00:30 over at 01:00.
  const grown = { key: "x", energy: { basic: 815, charged: 0, at: now - 1.5 * HOUR }, cap: 840 };
  assert.deepEqual([...L.alertsDue([grown], "waste", "all", {}, now).fire], ["x"]);
  // A changed mode alerts again for one still over.
  assert.deepEqual([...L.alertsDue([ch("naicha", 830)], "early1", "all", r.alerted, now).fire], ["naicha"]);
});

test("only ticked characters, or none when off", () => {
  const chars = [
    { key: "a", energy: { basic: 838, charged: 0, at: now }, cap: 840, watched: true },
    { key: "b", energy: { basic: 838, charged: 0, at: now }, cap: 840, watched: false },
  ];
  assert.deepEqual([...L.alertsDue(chars, "waste", "ticked", {}, now).fire], ["a"]);
  assert.deepEqual([...L.alertsDue(chars, "waste", "all", {}, now).fire], ["a", "b"]);
  assert.deepEqual([...L.alertsDue(chars, "off", "all", {}, now).fire], []);
  assert.deepEqual([...L.alertsDue(chars, "full", "all", {}, now).fire], [], "838 isn't full");
});
