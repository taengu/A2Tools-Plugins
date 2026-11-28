import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Shugo's Ledger's Drops tab, Gathering: every item gathered has a row (as
// many as came out, of how many gathers), not only the extras and double
// yields (0.8.8).
const ui = readFileSync(new URL("../plugins/pet-souls/collection-ui.js", import.meta.url), "utf8");
const logic = ui.slice(ui.indexOf("  const DROPS_KEY = "), ui.indexOf("  const pct = (x) =>"));
const HERB = 610670041, FRESH = 610670045, ORE = 610610013, EXTRA = 510116011;

function fresh() {
  const context = vm.createContext({ setInterval: () => 0, Date });
  vm.runInContext(`
const DAY_MS = 86400000;
const dayOf = (ms) => Math.floor(ms / DAY_MS) * DAY_MS;
const words = (w) => w;
const DROP_ITEMS = {}, UNIQUE_ITEMS = {}, MOB_NAMES = {}, MOB_LISTS = {}, DROP_LISTS = {};
const characterKey = () => "me"; const me = () => "me";
const cprefs = { dropPeriod: "all" };
const renderDrops = () => {};
const ready = Promise.resolve();
const a2 = { on: () => {}, storage: { set: async () => {} } };
const t = (k) => k === "fromGathers" ? (n, g) => n + "/" + g : k;
const num = (n) => String(n);
${logic}
globalThis.api = { noteLoot, dropRows, get dropStats() { return dropStats; }, set dropStats(v) { dropStats = v; } };`, context);
  return context.api;
}
const done = (item, extra = {}) => ({ kind: "gather", at: Date.now(), gather: { type: "done", item, status: 0, count: 1, bonus: 0, extraItem: 0, extraCount: 0, ...extra } });
const plain = (v) => JSON.parse(JSON.stringify(v));

test("every gathered item has a row, with the copies Plentiful Harvest added", () => {
  const api = fresh();
  api.noteLoot(done(HERB));
  api.noteLoot(done(HERB, { bonus: 1 }));
  api.noteLoot(done(HERB, { extraItem: EXTRA }));
  api.noteLoot(done(FRESH, { status: 1 }));
  api.noteLoot(done(ORE, { count: 3 }));
  api.noteLoot(done(ORE, { status: 2, count: 0 }));
  const rows = plain(api.dropRows()).filter((r) => r.source === "gathered");
  const by = Object.fromEntries(rows.map((r) => [r.item, [r.n, r.detail]]));
  assert.deepEqual(by, { [HERB]: [4, "4/3"], [FRESH]: [1, "1/1"], [ORE]: [3, "3/2"] });
  // The extras and double yields are still there.
  const other = plain(api.dropRows()).filter((r) => r.source !== "gathered").map((r) => [r.item, r.n]);
  assert.deepEqual(other.sort(), [[EXTRA, 1], [HERB, 1]].sort());
});

test("gathers kept before the counts were count as one each", () => {
  const api = fresh();
  const day = Math.floor(Date.now() / 86400000) * 86400000;
  api.dropStats = { chars: { me: { days: { [day]: { kills: {}, mob: {}, gathers: { [HERB]: 5 }, bonus: {}, extras: {}, runs: {}, reward: {}, rewardRuns: {} } } } }, lastRun: {} };
  api.noteLoot(done(HERB, { count: 2 }));
  const row = plain(api.dropRows()).find((r) => r.source === "gathered" && r.item === HERB);
  assert.deepEqual([row.n, row.detail], [7, "7/6"]);
});

test("Drops: Plentiful Harvest doubles a gather of more than one", () => {
  const api = fresh();
  const MELA = 610680045;
  api.noteLoot(done(MELA, { status: 1, count: 3, bonus: 1 }));
  const row = plain(api.dropRows()).find((r) => r.source === "gathered" && r.item === MELA);
  assert.deepEqual([row.n, row.detail], [6, "6/1"]);
});
