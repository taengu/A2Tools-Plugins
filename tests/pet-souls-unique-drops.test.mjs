import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Shugo's Ledger's Unique drops (pet-souls/collection-ui.js). 0.8.4 counted
// one bow and one ring twice, every move of gear between the bag and the
// storages, and every change of a Unique stack (Amplify Stone Fragment) as a
// drop (2026-11-24). The records below are the shapes of that capture's
// `1B 56`, read with the manifest's own decoder.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../plugins/pet-souls/collection-ui.js");
const collection = read("../plugins/pet-souls/collection.js");
const manifest = JSON.parse(read("../plugins/pet-souls/manifest.json"));
const uniques = collection.slice(collection.indexOf("const UNIQUE_ITEMS = {"), collection.indexOf("};", collection.indexOf("const UNIQUE_ITEMS = {")) + 2);
const logic = ui.slice(ui.indexOf("// ---- Unique drops: counted once per item ----"), ui.indexOf("// ---- end of Unique drops ----"));
const context = vm.createContext({});
vm.runInContext(`${uniques}
const DAY_MS = 86400000; const RESET_MS = 25200000;
const dayOf = (ms) => Math.floor((ms - RESET_MS) / DAY_MS) * DAY_MS + RESET_MS;
${logic}
globalThis.api = { noteUnique, dropStacks, dayOf, UNIQUE_ITEMS, COUNTED_KEEP };`, context);
const { api } = context;

// The manifest's item-gained fields over a record's body, as the meter reads
// them (decoder.rs): a u64 reaches the plugin as a JSON number.
const decoder = manifest.decoders.find((d) => d.name === "item-gained");
function decode(hex) {
  const b = Buffer.from(hex.replace(/\s+/g, ""), "hex");
  let pos = 0;
  const out = {};
  for (const f of decoder.fields) {
    if (f.type.startsWith("skip:")) { pos += Number(f.type.slice(5)); continue; }
    const size = { u8: 1, u16: 2, u32: 4, u64: 8 }[f.type];
    const v = size === 8 ? b.readBigUInt64LE(pos) : b.readUIntLE(pos, size);
    out[f.name] = JSON.parse(JSON.stringify(Number(v)));
    pos += size;
  }
  return out;
}
const le32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b.toString("hex"); };
const le64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b.toString("hex"); };
// <n> <change> <flag> <instance u64> <item u32> <stack total u64> <container> <slot>
const record = ({ n = 1, change, flag, instance, item, total = 1, where = "0154" }) =>
  `${n.toString(16).padStart(2, "0")} ${change} ${flag} ${instance} ${le32(item)} ${le64(total)} ${where}`;

// A Unique shoulder (the capture's moved gear was Epic; its bytes are kept).
const GEAR = 210430011;
const FRAGMENT = 631800004;
const DAY = api.dayOf(Date.UTC(2026, 10, 24, 12));
const AT = DAY + 3_600_000;
const character = () => ({ name: "c", days: { [DAY]: { uniques: [] } } });
const count = (who) => who.days[DAY].uniques.length;

test("the decoder still gives the purchase logic its fields", () => {
  // 2026-11-10: a skin bought, `01 02 00 ...`.
  const d = decode(record({ change: "02", flag: "00", instance: "a1e7060000830200", item: 9_001 }));
  assert.equal(d.entries, 1);
  assert.equal(d.kind, 2);
  assert.equal(d.item, 9_001);
  assert.equal(d.flag, 0);
});

test("a u64 instance reads whole and stays exact", () => {
  const d = decode(record({ change: "01", flag: "01", instance: "a1e7060000830200", item: GEAR }));
  assert.equal(d.instance, 0x0002_8300_0006_e7a1);
  assert.ok(Number.isSafeInteger(d.instance));
  assert.equal(d.item, GEAR);
});

test("gear moved between the bag and the storages counts once", () => {
  const who = character();
  // Dropped, then taken to storage and back, and moved in a batch of four
  // (the capture's 1B 56 change 1 flag 1, paired with 43 56 / 45 56).
  const moves = [
    record({ change: "00", flag: "01", instance: "a1e7060000830200", item: GEAR }),
    record({ change: "01", flag: "01", instance: "a1e7060000830200", item: GEAR, where: "0f07" }),
    record({ change: "01", flag: "01", instance: "a1e7060000830200", item: GEAR }),
    record({ n: 4, change: "01", flag: "01", instance: "a1e7060000830200", item: GEAR }),
  ];
  const counted = moves.map((m, i) => api.noteUnique(who, decode(m), AT + i * 3_000));
  assert.deepEqual(counted, [true, false, false, false]);
  assert.equal(count(who), 1);
  // Another piece of the same item is another drop.
  assert.equal(api.noteUnique(who, decode(record({ change: "00", flag: "01", instance: "acdf060000d40200", item: GEAR })), AT + 20_000), true);
  assert.equal(count(who), 2);
});

test("new gear announced twice counts once", () => {
  const who = character();
  // 2026-11-12 (the meter's item_gained_rewards_again): `00 01 <inst>`, then
  // `01 01 <inst>` for the same instance a moment later.
  assert.equal(api.noteUnique(who, decode(record({ change: "00", flag: "01", instance: "8dc61600002a0000", item: GEAR })), AT), true);
  assert.equal(api.noteUnique(who, decode(record({ change: "01", flag: "01", instance: "8dc61600002a0000", item: GEAR })), AT + 1_500), false);
  assert.equal(count(who), 1);
});

test("gear held from before, moved, doesn't count", () => {
  // The game numbers its items again at each login: a piece owned before is
  // an instance the plugin never saw, moved with change 1 (2026-11-24's bank
  // test: 01 01 a1e7060000830200 with 45 56, then 43 56).
  const who = character();
  for (const where of ["0f07", "0154"]) {
    assert.equal(api.noteUnique(who, decode(record({ change: "01", flag: "01", instance: "a1e7060000830200", item: GEAR, where })), AT), false);
  }
  assert.equal(count(who), 0);
  // A new drop of the same item still counts.
  assert.equal(api.noteUnique(who, decode(record({ change: "00", flag: "01", instance: "8dc61600002a0000", item: GEAR })), AT + 9_000), true);
  assert.equal(count(who), 1);
});

test("a move after a restart doesn't count again", () => {
  const who = character();
  api.noteUnique(who, decode(record({ change: "00", flag: "01", instance: "a1e7060000830200", item: GEAR })), AT);
  const restored = JSON.parse(JSON.stringify(who));
  assert.equal(api.noteUnique(restored, decode(record({ change: "01", flag: "01", instance: "a1e7060000830200", item: GEAR })), AT + 60_000), false);
  assert.equal(count(restored), 1);
});

test("Unique stacks are not Unique drops", () => {
  assert.equal(api.UNIQUE_ITEMS[FRAGMENT], undefined, "Amplify Stone Fragment (Unique)");
  const who = character();
  // Picked up, some used, the stack moved: none of it counts.
  for (const [i, total] of [12, 10, 10].entries()) {
    const d = decode(record({ change: "01", flag: "00", instance: "71f2140000330000", item: FRAGMENT, total }));
    assert.equal(api.noteUnique(who, d, AT + i * 1_000), false);
  }
  assert.equal(count(who), 0);
});

test("stacks counted before are dropped from the days kept", () => {
  const all = { c: { name: "c", days: { [DAY]: { uniques: [[AT, FRAGMENT], [AT + 1, GEAR], [AT + 2, FRAGMENT]] } } } };
  api.dropStacks(all);
  assert.deepEqual(JSON.parse(JSON.stringify(all.c.days[DAY].uniques)), [[AT + 1, GEAR]]);
});

test("the instances kept are capped", () => {
  const who = character();
  for (let i = 1; i <= api.COUNTED_KEEP + 5; i++) api.noteUnique(who, { item: GEAR, kind: 0, instance: i }, AT + i);
  assert.equal(who.counted.length, api.COUNTED_KEEP);
  assert.equal(who.counted[0], "6", "the oldest go first");
});

test("with no instance, the same item at the same moment counts once", () => {
  const who = character();
  assert.equal(api.noteUnique(who, { item: GEAR }, AT), true);
  assert.equal(api.noteUnique(who, { item: GEAR }, AT + 500), false);
  assert.equal(api.noteUnique(who, { item: GEAR }, AT + 5_000), true);
});
