// Tests for the dock's size with Windows' Text size (Settings > Accessibility >
// Text size) above 100%.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const placement = source.slice(source.indexOf("function sizeFor("), source.indexOf("\nfunction send()"));

// Fake meter:
// - sizes a widget's window from the display scale.
// - draws the page inside at display scale * Text size
//      so the room the icons really get is (window size) / (page's pixel ratio).
// - "extra" came from testing the real meter (113.33 px of room for a 134 px window @ 120%).
// - "store" is the plugin's saved storage, "at" where the meter opens the bar (its saved spot).
function meter({ display = 1, text = 1, extra = 1.67, direction = "right", layout = "combined", size = "54", store = {}, at: start = { x: 500, y: 500 } } = {}) {
  const windows = new Map(), opens = [];
  const widgets = {
    async open(name, size) {
      opens.push([name, size]);
      const at = windows.get(name) || { ...start };
      windows.set(name, { ...at, width: Math.round(size.width * display), height: Math.round(size.height * display), asked: size });
    },
    async close(name) { windows.delete(name); },
    async where(name) { const w = windows.get(name); return { x: w.x, y: w.y, width: w.width, height: w.height }; },
    async place(name, at) { Object.assign(windows.get(name), at); },
  };
  const storage = {
    async set(key, value) { store[key] = JSON.parse(JSON.stringify(value)); },
    async get(key) { return store[key] ?? null; },
  };
  const prefs = { show: true, layout, direction, size, perLine: 10 };
  const mine = { skills: {}, buffs: {} };
  const context = vm.createContext({ prefs, mine, a2: { widgets, storage }, devicePixelRatio: display * text, send() {} });
  vm.runInContext(`${placement}\ngameOpen = true; Object.assign(globalThis, { placeWidgets, onRoom, sizeFor, useSavedFits });`, context);
  const room = (name) => {
    const w = windows.get(name);
    return { width: w.width / (display * text) + extra, height: w.height / (display * text) + extra };
  };
  // Resizing count.
  async function settle() {
    for (let round = 0; round < 12; round++) {
      const before = opens.length;
      for (const [name, w] of [...windows]) await context.onRoom(name, room(name), w.asked);
      if (opens.length === before) return round;
    }
    throw new Error("the window size never stopped changing");
  }
  const shown = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { show: true }]));
  return {
    windows, opens, room, settle, context,
    // Settle size.
    async tick(skills, buffs = 0) {
      mine.skills = shown(skills); mine.buffs = shown(buffs);
      await context.placeWidgets();
      return settle();
    },
    need: (n, per) => context.sizeFor(n, per),
  };
}

const setups = [
  { display: 1, text: 1 }, { display: 1, text: 1.18 }, { display: 1, text: 1.2 }, { display: 1, text: 1.5 },
  { display: 1, text: 2.25 }, { display: 1.25, text: 1.2 }, { display: 1.5, text: 1 }, { display: 1.75, text: 1.35 },
];

for (const setup of setups) for (const direction of ["right", "center", "up"]) {
  test(`every icon fits in the bar at display scale ${setup.display * 100}% and Text size ${Math.round(setup.text * 100)}% (Grows: ${direction})`, async () => {
    const m = meter({ ...setup, direction });
    for (const n of [1, 2, 3, 5, 2, 11, 4]) {
      const rounds = await m.tick(n);
      assert.ok(rounds <= 2, `${n} icons: it took ${rounds} rounds of resizing to settle, expected at most 2`);
      const got = m.room("bar");
      const vertical = direction === "up";
      const along = vertical ? got.height : got.width, across = vertical ? got.width : got.height;
      const per = Math.min(10, Math.floor((along + 1 - 14) / 60));
      assert.ok(per >= 1, `${n} icons: not even one icon fits in ${along} px`);
      const lines = Math.ceil(n / per);
      assert.ok(lines * 60 + 14 <= across + 1, `${n} icons: ${lines} lines of ${per} don't fit in ${across} px`);
      const full = m.need(n);
      if (Math.max(full.width, full.height) * setup.text <= 790) assert.equal(per >= Math.min(n, 10), true, `${n} icons: only ${per} fit on a line`);
      const need = m.need(n, per);
      assert.ok(got.width <= need.width * 1.05 + 3 && got.height <= need.height * 1.05 + 3, `${n} icons: ${got.width} x ${got.height} px of room, much more than the ${need.width} x ${need.height} needed`);
    }
  });
}

test("at Text size 100%, nothing gets resized", async () => {
  const m = meter();
  await m.tick(3);
  const opens = m.opens.length;
  await m.settle();
  assert.equal(m.opens.length, opens, "the window was resized although it already fit");
});

test("the same report twice doesn't resize again, and going back to Text size 100% puts the window back to its normal size", async () => {
  const m = meter({ text: 1.2 });
  await m.tick(4);
  const opens = m.opens.length;
  const w = m.windows.get("bar");
  await m.context.onRoom("bar", m.room("bar"), w.asked);
  assert.equal(m.opens.length, opens, "the window was resized again for the same report");
  // Text size back to 100%: page room = window room.
  await m.context.onRoom("bar", { width: w.width + 1.67, height: w.height + 1.67 }, w.asked);
  assert.ok(m.opens.length > opens, "the window wasn't resized");
  assert.deepEqual(m.windows.get("bar").asked, m.need(4), "the window isn't back to its normal size");
});

test("with skills and buffs in separate widgets, each widget gets its own correction", async () => {
  const m = meter({ text: 1.2, layout: "split" });
  await m.tick(3, 2);
  for (const [name, n] of [["skills", 3], ["buffs", 2]]) {
    const got = m.room(name), need = m.need(n);
    assert.ok(got.width >= need.width - 1 && got.height >= need.height - 1, `the ${name} widget is too small for its icons`);
  }
});

test("a broken size report (missing or zero sizes) is ignored", async () => {
  const m = meter({ text: 1.2 });
  await m.tick(2);
  const opens = m.opens.length;
  for (const [room, size] of [[null, { width: 1, height: 1 }], [{ width: 0, height: 10 }, { width: 10, height: 10 }], [{ width: 10, height: 10 }, null], [{ width: NaN, height: 5 }, { width: 5, height: 5 }]]) {
    await m.context.onRoom("bar", room, size);
  }
  assert.equal(m.opens.length, opens, "the window was resized for a broken report");
});

for (const direction of ["center", "up"]) {
  test(`restarting the meter doesn't move the bar (Grows: ${direction}, Text size 120%)`, async () => {
    const store = {};
    let at = { x: 500, y: 500 };
    for (let start = 1; start <= 5; start++) {
      const m = meter({ text: 1.2, direction, store, at });
      m.context.useSavedFits(store.fits);
      await m.tick(6);
      const w = m.windows.get("bar");
      // The first start ever has no saved correction yet, so it may move once.
      if (start > 1) {
        assert.equal(m.opens.length, 1, `start ${start}: the bar was resized after opening`);
        assert.deepEqual({ x: w.x, y: w.y }, at, `start ${start}: the bar moved`);
      }
      at = { x: w.x, y: w.y };
    }
  });
}

test("the size settles at every display scale, Text size and icon size (no flipping back and forth)", async () => {
  const stuck = [];
  for (const display of [1, 1.25, 1.5, 1.75, 2]) for (let percent = 100; percent <= 225; percent += 5) for (const size of ["32", "42", "54", "68"]) {
    for (const direction of ["right", "up"]) for (const n of [1, 2, 3, 6, 10, 12]) {
      const m = meter({ display, text: percent / 100, size, direction });
      try {
        const rounds = await m.tick(n);
        if (rounds > 3) stuck.push(`${display * 100}% / ${percent}% / ${size} px / ${n} icons / ${direction}: ${rounds} rounds`);
      } catch {
        stuck.push(`${display * 100}% / ${percent}% / ${size} px / ${n} icons / ${direction}: never settled`);
      }
    }
  }
  assert.deepEqual(stuck, [], "these setups kept resizing");
});

test("going from 9 icons to 1 doesn't make the size flip (display 125%, Text size 105%, Medium)", async () => {
  const m = meter({ display: 1.25, text: 1.05, size: "42" });
  await m.tick(9);
  const rounds = await m.tick(1);
  assert.ok(rounds <= 3, `it took ${rounds} rounds of resizing to settle`);
});

test("the size settles when the number of icons goes up and down during a session", async () => {
  const stuck = [];
  // "extra" varies too: other PCs may give a bit more or less room than the 1.67 px measured on one
  for (const extra of [-1, 0, 1.67, 3]) for (const display of [1, 1.25, 1.5, 1.75, 2]) for (let percent = 100; percent <= 225; percent += 5) for (const size of ["32", "42", "54", "68"]) {
    for (const direction of ["right", "up"]) {
      const m = meter({ display, text: percent / 100, size, direction, extra });
      for (const n of [9, 1, 6, 2, 12, 1, 3, 10]) {
        let result;
        try {
          const rounds = await m.tick(n);
          if (rounds > 3) result = `${rounds} rounds`;
        } catch {
          result = "never settled";
        }
        if (result) stuck.push(`extra ${extra} px / ${display * 100}% / ${percent}% / ${size} px / ${direction} / to ${n} icons: ${result}`);
      }
    }
  }
  assert.deepEqual(stuck, [], "these setups kept resizing after the number of icons changed");
});
