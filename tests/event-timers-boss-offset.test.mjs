import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// The shipped offset and feedEntry, out of plugin.js.
const source = readFileSync(new URL("../plugins/event-timers/plugin.js", import.meta.url), "utf8");
const start = source.indexOf("const BOSS_OFFSETS");
const end = source.indexOf("const fieldTimer = ");
assert.ok(start > 0 && end > start, "the offset code is where the test expects it");

function entry(offset, boss) {
  const context = vm.createContext({
    prefs: { bossOffset: offset },
    feed: { server: 2011, bosses: { 1001: boss } },
    serverId: () => 2011,
  });
  vm.runInContext(`${source.slice(start, end)}; globalThis.out = feedEntry("1001");`, context);
  return JSON.parse(JSON.stringify(context.out));
}

test("a world boss's respawn time moves by the offset, either way", () => {
  const dead = { state: "dead", nextSpawn: 1_000_000, reportedAt: 900_000 };
  assert.equal(entry(0, dead).nextSpawn, 1_000_000);
  assert.equal(entry(3, dead).nextSpawn, 1_000_003);
  assert.equal(entry(-2, dead).nextSpawn, 999_998);
  assert.equal(entry(99, dead).nextSpawn, 1_000_000, "out of range: none");
  // Up, no respawn time: as it was.
  assert.deepEqual(entry(5, { state: "up", upSince: 5 }), { state: "up", upSince: 5 });
});
