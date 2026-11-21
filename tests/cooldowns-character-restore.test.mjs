import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const loader = source.slice(source.indexOf("async function loadCharacter("), source.indexOf("// ---- What is happening"));
const turn = () => new Promise((resolve) => setImmediate(resolve));

function setup(initial = "Example@1") {
  const reads = new Map(), writes = [];
  const live = Object.fromEntries(["cd", "used", "unsure", "changed", "charges", "samples", "early", "buffs"]
    .map((key) => [key, new Map([[1, 1]])]));
  const ctx = vm.createContext({ live, clearTimeout() {}, charStoreKey: (key) => key, fresh: (value) => value,
    async storeMine(key, value) { writes.push([key, value.id]); },
    takeClass() {}, takeCdr() {}, renderAll() {}, $() { return {}; },
    a2: { storage: { get: (key) => new Promise((resolve) => reads.set(key, resolve)) } },
  });
  vm.runInContext(`let charKey = ${JSON.stringify(initial)}, charName = "Example", saving = null,
    loadingCharacter = null, mine = { id: "old" }; ${loader}`, ctx);
  return { reads, writes, live, load: ctx.loadCharacter, key: () => vm.runInContext("charKey", ctx),
    profile: () => vm.runInContext("mine.id", ctx) };
}

test("the same name with another server stays the same character and profile", async () => {
  const h = setup();
  await h.load({ name: "Example", serverId: 2 });
  assert.equal(h.key(), "Example@1");
  assert.equal(h.profile(), "old");
  assert.equal(h.reads.size, 0);
  assert.deepEqual(h.writes, []);
  assert.equal(h.live.used.size, 1);
});

test("the same name with another server while it loads stays the character being loaded", async () => {
  const h = setup();
  const update = h.load({ name: "Other", serverId: 3 });
  await turn();
  await h.load({ name: "Other", serverId: 5 });
  h.reads.get("Other@3")({ id: "other" });
  await update;
  assert.equal(h.key(), "Other@3");
  assert.equal(h.profile(), "other");
  assert.equal(h.reads.size, 1);
});

test("another character restores its own profile and clears what was happening", async () => {
  const h = setup();
  const update = h.load({ name: "Other", serverId: 2 });
  await turn();
  h.reads.get("Other@2")({ id: "other" });
  await update;
  assert.equal(h.key(), "Other@2");
  assert.equal(h.profile(), "other");
  assert.deepEqual(h.writes, [["Example@1", "old"]]);
  for (const state of Object.values(h.live)) if (state instanceof Map) assert.equal(state.size, 0);
});

test("late reads cannot replace a newer character or undo a return to the current character", async () => {
  const h = setup();
  const first = h.load({ name: "Early", serverId: 3 });
  await turn();
  const second = h.load({ name: "Later", serverId: 4 });
  await turn();
  h.reads.get("Later@4")({ id: "later" });
  await second;
  h.reads.get("Early@3")({ id: "early" });
  await first;
  assert.equal(h.profile(), "later");
  const pending = h.load({ name: "Early", serverId: 3 });
  await turn();
  await h.load({ name: "Later", serverId: 0 });
  h.reads.get("Early@3")({ id: "early" });
  await pending;
  assert.equal(h.key(), "Later@4");
});

test("an unknown server can keep its current settings when it becomes known", async () => {
  const h = setup("Example@");
  const update = h.load({ name: "Example", serverId: 2 });
  await turn();
  h.reads.get("Example@2")(null);
  await update;
  assert.equal(h.key(), "Example@2");
  assert.equal(h.profile(), "old");
});
