import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// The shipped hpOfLife, keepNewerHp and mergeOwn, out of plugin.js.
const source = readFileSync(new URL("../plugins/event-timers/plugin.js", import.meta.url), "utf8");
const start = source.indexOf("function hpOfLife(");
const end = source.indexOf("// Whether the server's world bosses change fast");
assert.ok(start > 0 && end > start, "the merge functions are where the test expects them");

function merge(ownMapBosses = {}) {
  const context = vm.createContext({});
  vm.runInContext(`let ownMap = { server: 1304, bosses: ${JSON.stringify(ownMapBosses)} };
    const serverId = () => 1304;
    ${source.slice(start, end)}
    globalThis.api = { keepNewerHp, mergeOwn };`, context);
  return context.api;
}

// Lawa on 1304, 2026-11-07: up at 06:09:23 and fought, while the file, written
// every 5 minutes, still had it dead from its last life.
const fileDead = { state: "dead", upSince: null, nextSpawn: 1794031700, reportedAt: 1794017364, confirmed: true };
const heldUp = { state: "up", upSince: 1794031763, nextSpawn: null, reportedAt: 1794031765, confirmed: true,
                 hp: 20, hpAt: 1794031868 };

test("a file older than the boss held keeps the boss and its HP", () => {
  const { keepNewerHp, mergeOwn } = merge();
  const out = mergeOwn(keepNewerHp({ "101011": fileDead }, { "101011": heldUp }));
  assert.equal(out["101011"].state, "up");
  assert.equal(out["101011"].hp, 20);
});

test("with the player's own map newer still, the held HP stays", () => {
  const mine = { state: "up", upSince: 1794031763, nextSpawn: null, reportedAt: 1794031859, confirmed: true };
  const { keepNewerHp, mergeOwn } = merge({ "101011": mine });
  const out = mergeOwn(keepNewerHp({ "101011": fileDead }, { "101011": heldUp }));
  assert.equal(out["101011"].reportedAt, 1794031859);
  assert.equal(out["101011"].hp, 20);
});

test("a newer file wins: the boss died since", () => {
  const { keepNewerHp } = merge();
  const killed = { state: "dead", upSince: null, nextSpawn: 1794046291, reportedAt: 1794031891, confirmed: true };
  assert.deepEqual(keepNewerHp({ "101011": killed }, { "101011": heldUp })["101011"], killed);
});

test("the same life read from the file keeps the newer HP held", () => {
  const { keepNewerHp } = merge();
  const fileUp = { ...heldUp, hp: 60, hpAt: 1794031819 };
  const out = keepNewerHp({ "101011": fileUp }, { "101011": heldUp })["101011"];
  assert.equal(out.hp, 20);
  assert.equal(out.hpAt, heldUp.hpAt);
});
