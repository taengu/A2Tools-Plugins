// Event Timers: the Spacetime Rift's window, the one open now or the next:
// every 3 hours from 02:00 server time, 10 minutes to enter plus an hour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/event-timers/plugin.js", import.meta.url), "utf8");
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));

function riftWindowIn(tz) {
  const context = vm.createContext({ Intl, Date, Math, Number, Map, timeZone: () => tz });
  vm.runInContext(
    `${slice("const zoneFormats = new Map();", "// Times as the player chose to see them")}
     ${slice("const RIFT_OPEN_MS", "async function readEnemyFeed()")}
     globalThis.riftWindow = riftWindow;`,
    context,
  );
  // Plain objects: the sandbox's are of another realm.
  return (now) => { const w = context.riftWindow(now); return w && { ...w }; };
}

// Europe's servers keep Berlin time: 05:30 on 15 November is 04:30 UTC.
const berlin = (h, m, day = 15) => Date.UTC(2026, 10, day, h - 1, m);
const MIN = 60_000;

test("a rift open now is the one shown, until 70 minutes after it opened", () => {
  const riftWindow = riftWindowIn("Europe/Berlin");
  assert.deepEqual(riftWindow(berlin(5, 30)), { from: berlin(5, 0), to: berlin(5, 0) + 70 * MIN });
  assert.deepEqual(riftWindow(berlin(6, 9)), { from: berlin(5, 0), to: berlin(5, 0) + 70 * MIN });
});

test("after it closes, the next one, across midnight too", () => {
  const riftWindow = riftWindowIn("Europe/Berlin");
  assert.deepEqual(riftWindow(berlin(6, 11)), { from: berlin(8, 0), to: berlin(8, 0) + 70 * MIN });
  assert.deepEqual(riftWindow(berlin(23, 30)), { from: berlin(23, 0), to: berlin(23, 0) + 70 * MIN });
  assert.deepEqual(riftWindow(berlin(0, 20, 16)), { from: berlin(2, 0, 16), to: berlin(2, 0, 16) + 70 * MIN });
});

test("no server time zone, no window", () => {
  assert.equal(riftWindowIn(null)(berlin(5, 30)), null);
});
