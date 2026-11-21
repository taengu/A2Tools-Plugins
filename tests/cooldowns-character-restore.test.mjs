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

test("same-name characters on different known servers restore different profiles", async () => {
  const h = setup();
  const update = h.load({ name: "Example", serverId: 2 });
  await turn();
  h.reads.get("Example@2")({ id: "server2" });
  await update;
  assert.equal(h.key(), "Example@2");
  assert.equal(h.profile(), "server2");
  assert.deepEqual(h.writes, [["Example@1", "old"]]);
  assert.equal(h.live.used.size, 0);
  assert.equal(h.live.samples.size, 0);
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
