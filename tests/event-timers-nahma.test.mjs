import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Guardian Lord Nahma as one boss: the shipped feedEntry and spawnEntry, out
// of plugin.js. The feed has a timer for each of his spawners (2003-2005).
const source = readFileSync(new URL("../plugins/event-timers/plugin.js", import.meta.url), "utf8");
const start = source.indexOf("const BOSS_OFFSETS");
const end = source.indexOf("const fieldTimer = ");
assert.ok(start > 0 && end > start, "the feed code is where the test expects it");

// A plugin page: set the feed's bosses, then read Nahma, as often as wanted.
function page() {
  const context = vm.createContext({ prefs: {}, feed: { server: 2011, bosses: {} }, serverId: () => 2011 });
  vm.runInContext(`${source.slice(start, end)}; globalThis.read = (id) => feedEntry(id);`, context);
  return {
    set: (bosses) => { context.feed.bosses = bosses; },
    read: (id = "2003") => JSON.parse(JSON.stringify(context.read(id))),
  };
}

const dead = (at) => ({ state: "dead", upSince: null, nextSpawn: null, reportedAt: at });
const up = (since, hp = null, hpAt = null) => ({ state: "up", upSince: since, nextSpawn: null, reportedAt: since + 5, hp, hpAt });

test("up at any spawner: him, with that spawner's HP", () => {
  const p = page();
  p.set({ 2003: dead(100), 2004: up(1000, 62, 1100), 2005: dead(100) });
  const t = p.read();
  assert.equal(t.state, "up");
  assert.equal(t.hp, 62);
  assert.equal(t.spawn, "2004");
});

test("the spawner he was up at reported dead: killed, though the others were never reported", () => {
  const p = page();
  p.set({ 2005: up(1000, 40, 1100) });
  assert.equal(p.read().spawn, "2005");
  p.set({ 2005: dead(1300) });
  const t = p.read();
  assert.equal(t.state, "dead");
  assert.equal(t.reportedAt, 1300);
});

test("at 0% HP he was killed", () => {
  const p = page();
  p.set({ 2003: up(1000, 0, 1200), 2004: dead(100), 2005: dead(100) });
  const t = p.read();
  assert.equal(t.state, "dead");
  assert.equal(t.reportedAt, 1200);
});

test("all three reported dead: the newest report", () => {
  const p = page();
  p.set({ 2003: dead(100), 2004: dead(300), 2005: dead(200) });
  assert.equal(p.read().reportedAt, 300);
});

test("a spawner he never used reported dead says nothing of him: his schedule decides", () => {
  const p = page();
  p.set({ 2004: dead(1300) });
  assert.equal(p.read(), null);
});

test("other bosses are read as they are", () => {
  const p = page();
  p.set({ 2006: up(1000), 2004: up(1000) });
  assert.equal(p.read("2006").state, "up");
  assert.equal(p.read("2006").spawn, undefined);
});
