import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// The Black Market's listings (pet-souls/plugin.js): the same pet on sale in
// two tabs at once is two listings, each sold once. Buying one used to take
// the pet off the list while the other was still on sale (2026-11-22).
const source = readFileSync(new URL("../plugins/pet-souls/plugin.js", import.meta.url), "utf8");
const market = source.slice(source.indexOf("// One listing of the stock"), source.indexOf("// When a bought item's stock ends"));
const context = vm.createContext({});
vm.runInContext(`var market = {}; var marketChar = "c"; var marketBought = {};
var SHOP_PETS = { 9001: 101, 9002: 102 }; var SHOP_ITEMS = {}; var SHOP_TEXT = {};
${market}
globalThis.api = { listingKey, listings, listingBought, markBought, marketPets };`, context);
const { api } = context;

const NOW = 1_000_000;
const REFRESH = NOW + 3_600_000;
// Pet 101 in both the Special (0x65) and Pets (0x68) tabs; pet 102 in Pets only.
function stock() {
  context.market = {
    c: {
      101: { at: NOW - 60_000, refreshAt: REFRESH, goods: [{ goodsId: 11, itemId: 9001 }] },
      104: { at: NOW - 5_000, refreshAt: REFRESH, goods: [{ goodsId: 21, itemId: 9001 }, { goodsId: 22, itemId: 9002 }] },
    },
  };
  context.marketBought = {};
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const onSale = () => plain(api.marketPets(NOW).map((g) => g.pet).sort());

test("a pet listed in two tabs stays on sale after one is bought", () => {
  stock();
  assert.deepEqual(onSale(), ["101", "102"]);
  // Its first souls say a pet was bought, not from which tab.
  assert.equal(api.markBought("c", (g) => g.itemId === 9001, REFRESH, NOW), true);
  assert.deepEqual(onSale(), ["101", "102"], "the other listing of 101 is still on sale");
  // The tab opened last is taken as the one bought from.
  assert.deepEqual(plain(Object.keys(context.marketBought.c)), ["g104:21:9001"]);
  assert.equal(api.markBought("c", (g) => g.itemId === 9001, REFRESH, NOW), true);
  assert.deepEqual(onSale(), ["102"], "both bought: off the list");
  assert.equal(api.markBought("c", (g) => g.itemId === 9001, REFRESH, NOW), false, "none left to buy");
});

test("with bought, a pet shows once whatever its listings", () => {
  stock();
  api.markBought("c", (g) => g.itemId === 9001, REFRESH, NOW);
  api.markBought("c", (g) => g.itemId === 9001, REFRESH, NOW);
  assert.deepEqual(plain(api.marketPets(NOW, { bought: true }).map((g) => g.pet).sort()), ["101", "102"]);
});

test("a purchase kept the old way (by pet) still takes every listing of it", () => {
  stock();
  context.marketBought = { c: { 101: REFRESH } };
  assert.deepEqual(onSale(), ["102"]);
  context.marketBought = { c: { i9001: REFRESH } };
  assert.deepEqual(onSale(), ["102"]);
});

test("a stock that has changed keeps nothing bought from the one before", () => {
  stock();
  api.markBought("c", (g) => g.itemId === 9002, REFRESH, NOW);
  assert.deepEqual(onSale(), ["101"]);
  assert.deepEqual(plain(api.marketPets(REFRESH + 1)), [], "the old stock is gone too");
});
