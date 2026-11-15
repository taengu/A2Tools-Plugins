const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../../plugins/boss-telegraph/context.js"), "utf8"), sandbox);

// Exact entries at official v2.0.97 / 1df3a64; 600003 has no difficulty.
const dungeons = {
  "600001": { name: "Krao Cave", difficulty: "normal" },
  "600002": { name: "Krao Cave", difficulty: "exploration" },
  "600003": { name: "Krao Cave" },
  "600004": { name: "Krao Cave", difficulty: "hard" },
  "600021": { name: "Fire Temple" },
};
function harness() {
  let now = 100000;
  const ctx = sandbox.BossContext.create({ now: () => now, dungeons });
  return {
    ctx, advance: (ms = 1) => { now += ms; }, at: () => now,
    map: (map = 600001, at = now) => ctx.mapLoad({ count: 1, map }, at),
    hp: (extras = {}, at = now) => ctx.hpUpdate({ entity: 25839, disc0: 2, disc1: 1, disc2: 0, currentHp: 4831, zero: 0, ...extras }, at),
    roster: (extras = {}, at = now) => ctx.roster({ partyKey: 1, omittedPartyName: [{}], partySize: 4, dungeonId: 600004, memberCount: 4, ...extras }, at),
  };
}

test("exact dictionary maps preserve explicitly sourced difficulty and unknown defaults", () => {
  for (const [id, difficulty] of [[600001, "normal"], [600002, "exploration"], [600003, null], [600004, "hard"]]) {
    const h = harness(); assert.equal(h.map(id), true);
    const map = h.ctx.snapshot().map;
    assert.equal(map.dungeonId, id); assert.equal(map.difficulty, difficulty);
    assert.equal(map.stage, undefined); assert.equal(map.region, undefined);
  }
});

test("unknown maps and open world clear active dungeon without guessing from numeric ranges", () => {
  const h = harness(); h.map(); h.advance(); h.map(1010);
  assert.equal(h.ctx.snapshot().map.dungeonId, null);
  h.advance(); h.map(699999);
  assert.equal(h.ctx.snapshot().map.difficulty, null);
  assert.equal(h.ctx.snapshot().map.dungeonId, null);
});

test("opaque zero count or zero map still resets the previous encounter like the native parser", () => {
  const h = harness(); h.map(); h.advance(); h.hp(); h.advance();
  assert.equal(h.ctx.mapLoad({ count: 0, map: 0 }, h.at()), true);
  assert.equal(h.ctx.snapshot().map.mapId, 0);
  assert.equal(h.ctx.snapshot().map.dungeonId, null);
  assert.equal(h.ctx.hp(25839), null);
});

test("queued or foreign-party roster never establishes or overwrites active encounter", () => {
  const h = harness(); h.roster();
  assert.equal(h.ctx.snapshot().map, null);
  assert.equal(h.ctx.snapshot().queuedRoster.dungeonId, 600004);
  h.advance(); h.map(600001); h.advance(); h.roster();
  assert.equal(h.ctx.snapshot().map.dungeonId, 600001);
  assert.equal(h.ctx.snapshot().map.difficulty, "normal");
  h.advance(); h.map(1010); h.advance(); h.roster();
  assert.equal(h.ctx.snapshot().map.dungeonId, null);
});

test("every map load invalidates entity HP and roster, including same-map teleport", () => {
  const h = harness(); h.map(); h.advance(); h.hp(); h.roster();
  const generation = h.ctx.snapshot().generation;
  h.advance(); h.map();
  assert.equal(h.ctx.hp(25839), null);
  assert.equal(h.ctx.snapshot().queuedRoster, null);
  assert.equal(h.ctx.snapshot().generation, generation + 1);
});

test("standalone HP validates discriminator and native fallback bound without claiming max or percent", () => {
  const h = harness(); assert.equal(h.hp(), true);
  const reading = h.ctx.hp(25839);
  assert.equal(reading.currentHp, 4831);
  assert.equal(reading.maxHp, undefined); assert.equal(reading.percent, undefined);
  for (const extras of [{ disc0: 1 }, { disc1: 0 }, { disc2: 1 }, { zero: 1 }, { entity: 99 }, { entity: 10000000 }, { currentHp: -1 }, { currentHp: 100000001 }, { currentHp: "4831" }]) {
    h.advance(); assert.equal(h.hp(extras), false);
  }
  h.advance(); assert.equal(h.hp({ currentHp: 0 }), true);
  h.advance(); assert.equal(h.hp({ currentHp: 100000000 }), true);
});

test("HP is per entity, never a denominator inferred from an observed peak", () => {
  const h = harness(); h.hp(); h.hp({ entity: 25840, currentHp: 70 });
  assert.equal(h.ctx.hp(25839).currentHp, 4831);
  assert.equal(h.ctx.hp(25840).currentHp, 70);
  h.advance(); h.hp({ currentHp: 9000 });
  assert.equal(h.ctx.hp(25839).maxHp, undefined);
});

test("HP freshness expires while observed map location persists until lifecycle invalidation", () => {
  const h = harness(); h.map(); h.advance(); h.hp(); h.advance(3001);
  assert.equal(h.ctx.hp(25839), null);
  assert.equal(h.ctx.snapshot().map.dungeonId, 600001);
});

test("reset rejects earlier queued events without mutating state", () => {
  const h = harness(); const earlier = h.at(); h.ctx.reset(); h.advance();
  assert.equal(h.map(600004, earlier), false);
  assert.equal(h.hp({}, earlier), false);
  assert.equal(h.roster({}, earlier), false);
  assert.equal(h.ctx.snapshot().map, null);
});

test("stale/future timestamps and invalid numbers never mutate observed context", () => {
  const h = harness();
  for (const at of [h.at() - 3001, h.at() + 1, NaN, undefined]) {
    assert.equal(h.ctx.mapLoad({ count: 1, map: 600004 }, at), false);
    assert.equal(h.ctx.hpUpdate({ entity: 25839, disc0: 2, disc1: 1, disc2: 0, currentHp: 4831, zero: 0 }, at), false);
  }
  for (const map of [-1, NaN, "600001", 0x100000000]) assert.equal(h.map(map), false);
  assert.equal(h.ctx.snapshot().map, null);
});

test("older per-entity readings and older map loads cannot roll state back", () => {
  const h = harness(); h.map(); h.advance(); const earlier = h.at(); h.hp();
  h.advance(); h.hp({ currentHp: 4000 });
  assert.equal(h.hp({ currentHp: 6000 }, earlier), false);
  assert.equal(h.ctx.hp(25839).currentHp, 4000);
  assert.equal(h.map(600004, earlier - 1), false);
});

test("character changes and game exit/reopen clear previous encounter context", () => {
  const h = harness(); h.ctx.character("character-a", h.at()); h.advance(); h.map(); h.advance(); h.hp();
  h.advance(); h.ctx.character("character-b", h.at());
  assert.equal(h.ctx.snapshot().map, null); assert.equal(h.ctx.hp(25839), null);
  h.advance(); h.map(); h.advance(); h.ctx.game(false, h.at());
  assert.equal(h.ctx.snapshot().map, null);
  h.advance(); h.ctx.game(true, h.at()); h.advance(); h.map();
  h.advance(); const generation = h.ctx.snapshot().generation;
  h.ctx.game(true, h.at());
  assert.equal(h.ctx.snapshot().generation, generation);
});

test("no-character identity clears state and a closed game cannot acquire new packet context", () => {
  const h = harness(); h.ctx.character("a", h.at()); h.advance(); h.map(); h.advance();
  assert.equal(h.ctx.character(null, h.at()), true);
  assert.equal(h.ctx.snapshot().map, null);
  h.advance(); h.ctx.game(false, h.at()); h.advance();
  assert.equal(h.map(), false); assert.equal(h.hp(), false); assert.equal(h.roster(), false);
  assert.equal(h.ctx.snapshot().map, null);
  h.advance(); h.ctx.game(true, h.at()); h.advance();
  assert.equal(h.map(), true);
});

test("late unchanged character/game events cannot erase or recreate new context", () => {
  const h = harness(); const old = h.at(); h.ctx.character("a", old); h.advance(); h.map(); h.advance();
  assert.equal(h.ctx.character("b", old), false);
  assert.equal(h.ctx.game(false, old), false);
  assert.equal(h.ctx.snapshot().map.dungeonId, 600001);
  h.ctx.character("a", h.at());
  assert.equal(h.ctx.snapshot().map.dungeonId, 600001);
});

test("roster skips text entirely and rejects malformed count/skip results", () => {
  const h = harness();
  for (const extras of [{ omittedPartyName: [] }, { omittedPartyName: new Array(41).fill({}) }, { omittedPartyName: [{ byte: 65 }] }, { partySize: 13 }, { memberCount: 0 }, { dungeonId: -1 }]) assert.equal(h.roster(extras), false);
  assert.equal(h.roster({ dungeonId: 0 }), true);
  assert.equal(h.ctx.snapshot().map, null);
});

test("returned and injected records cannot mutate live state", () => {
  const h = harness(); h.map(); h.ctx.snapshot().map.difficulty = "invented";
  assert.equal(h.ctx.snapshot().map.difficulty, "normal");
  h.advance(); h.hp(); h.ctx.hp(25839).currentHp = 1;
  assert.equal(h.ctx.hp(25839).currentHp, 4831);
});

test("official source HP and map fixtures decode to exact expected prefix fields", () => {
  const mapPacket = Buffer.from("34213601000000d52709003b1a350000000000f7e646460d7fb0c60080b045409da54200000000000000000000004f0000", "hex");
  assert.equal(mapPacket.readUInt16BE(1), 0x2136);
  const h = harness();
  assert.equal(h.ctx.mapLoad({ count: mapPacket.readUInt32LE(3), map: mapPacket.readUInt32LE(7) }, h.at()), true);
  assert.equal(h.ctx.snapshot().map.dungeonId, 600021);
  h.advance();
  const hpPacket = Buffer.from("14008defc901020100df12000000000000", "hex");
  let entity = 0, shift = 0, p = 3;
  do { const byte = hpPacket[p++]; entity += (byte & 127) * 2 ** shift; shift += 7; if (!(byte & 128)) break; } while (p < hpPacket.length);
  assert.equal(h.ctx.hpUpdate({ entity, disc0: hpPacket[p++], disc1: hpPacket[p++], disc2: hpPacket[p++], currentHp: hpPacket.readUInt32LE(p), zero: hpPacket.readUInt32LE(p + 4) }, h.at()), true);
  assert.equal(h.ctx.hp(25839).currentHp, 4831);
});

test("configuration and reset clock validation fail closed", () => {
  assert.throws(() => sandbox.BossContext.create({ dungeons: [] }), /dictionary/);
  assert.throws(() => sandbox.BossContext.create({ maxAgeMs: -1 }), /freshness/);
  assert.throws(() => sandbox.BossContext.create({ now: () => NaN }).reset(), /finite/);
});
