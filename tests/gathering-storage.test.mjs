import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/pet-souls/gathering.js", import.meta.url), "utf8");
const indexKey = "gatherLogPages";
const stamp = 1795125660000;
const row = (at) => [at, "char-1304-ExampleName1", 610670045, 2, 6, 3, 1, 3];

function setup(data, shouldFail = () => false) {
  const callbacks = new Map();
  let save;
  const context = {
    a2: {
      on: (name, fn) => callbacks.set(name, fn),
      storage: {
        async get(key) { return structuredClone(data.get(key) ?? null); },
        async set(key, value) {
          if (shouldFail(key)) throw new Error("temporary write failure");
          assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 1024 ** 2, "host storage limit");
          data.set(key, structuredClone(value));
        },
      },
    },
    document: { body: { classList: { contains: () => false } }, addEventListener() {} },
    marketKeyOf: () => "char-1304-ExampleName1",
    setInterval: (fn) => { save = fn; },
  };
  vm.runInNewContext(source, context);
  return { save, done: (at) => callbacks.get("decoded:gather-done")({ status: 0, node: 1, item: 610670041, count: 1 },
    { at, character: {} }) };
}

function history(data) {
  const index = data.get(indexKey);
  return Array.from({ length: index.pages }, (_, i) => data.get(`gatherLog_${index.bank}_${i}`)).flat();
}

test("legacy history migrates, every page fits, and a reload keeps the newest 20,000 rows", async () => {
  const legacy = { log: Array.from({ length: 20_000 }, (_, i) => row(stamp + i)), pairs: { 610670045: 610670041 } };
  const data = new Map([["gatherLog", legacy]]);
  const first = setup(data);
  await first.done(stamp + 20_000);
  await first.save();
  assert.equal(data.get("gatherLog"), legacy);
  assert.equal(history(data).length, 20_000);
  assert.equal(history(data)[0][0], stamp + 1);
  assert.equal(history(data).at(-1)[0], stamp + 20_000);
  const restarted = setup(data);
  await restarted.done(stamp + 20_001);
  await restarted.save();
  assert.equal(history(data)[0][0], stamp + 2);
  assert.equal(history(data).at(-1)[0], stamp + 20_001);
});

test("a failed commit keeps the last complete index and retries without another gather", async () => {
  let rejectIndex = false;
  const data = new Map();
  const h = setup(data, (key) => rejectIndex && key === indexKey);
  await h.done(stamp);
  await h.save();
  const committed = data.get(indexKey);
  rejectIndex = true;
  await h.done(stamp + 1);
  await h.save();
  assert.equal(data.get(indexKey), committed);
  assert.equal(history(data).length, 1);
  rejectIndex = false;
  await h.save();
  assert.equal(history(data).length, 2);
  assert.equal(history(data).at(-1)[0], stamp + 1);
});
