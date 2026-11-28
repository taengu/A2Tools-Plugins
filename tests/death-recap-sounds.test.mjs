import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ btoa, atob });
vm.runInContext(readFileSync(new URL("../plugins/death-recap/sounds.js", import.meta.url), "utf8"), context);
const S = context.KdaSounds;

test("a kill plays the kill sound, and the spree sound from the streak set", () => {
  const has = { kill: true, spree: true };
  assert.equal(S.slotFor("kill", 1, 6, has), "kill");
  assert.equal(S.slotFor("kill", 5, 6, has), "kill");
  assert.equal(S.slotFor("kill", 6, 6, has), "spree");
  assert.equal(S.slotFor("kill", 9, 6, has), "spree");
});

test("without a spree sound a kill in a spree plays the kill sound, and without either the built-in notes", () => {
  assert.equal(S.slotFor("kill", 8, 6, { kill: true }), "kill");
  assert.equal(S.slotFor("kill", 2, 6, { spree: true }), null);
  assert.equal(S.slotFor("kill", 7, 6, { spree: true }), "spree");
  assert.equal(S.slotFor("kill", 1, 6, {}), null);
});

test("an assist and a death play only their own sounds", () => {
  const all = { kill: true, assist: true, spree: true, death: true };
  assert.equal(S.slotFor("assist", 9, 2, all), "assist");
  assert.equal(S.slotFor("death", 0, 2, all), "death");
  assert.equal(S.slotFor("assist", 9, 2, { kill: true, spree: true }), null);
  assert.equal(S.slotFor("death", 0, 2, { kill: true }), null);
  assert.equal(S.slotFor("points", 0, 2, all), null);
});

test("the spree streak is kept between 2 and 10", () => {
  assert.equal(S.spreeAt(1), 2);
  assert.equal(S.spreeAt("4"), 4);
  assert.equal(S.spreeAt(40), 10);
  assert.equal(S.spreeAt(undefined), S.SPREE_DEFAULT);
});

test("a file kept in pieces comes back the same", () => {
  const bytes = new Uint8Array(2_000_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7919) & 255;
  const parts = S.pieces(S.toBase64(bytes));
  assert.ok(parts.length > 1);
  // Each piece, stored as JSON, stays under the meter's 1 MB a value.
  for (const p of parts) assert.ok(JSON.stringify(p).length < 1024 * 1024);
  assert.deepEqual(Buffer.from(S.fromBase64(parts.join(""))), Buffer.from(bytes));
  // The largest file allowed fits in the pieces a slot clears.
  assert.ok(S.pieces("x".repeat(Math.ceil(S.MAX_BYTES / 3) * 4)).length <= S.MAX_PIECES);
});

test("a file's name is shown without its folder and cut short", () => {
  assert.equal(S.shortName(String.raw`C:\sounds\headshot.mp3`), "headshot.mp3");
  assert.equal(S.shortName("a".repeat(60) + ".wav").length, 38);
});
