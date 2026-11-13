// Tests for Grows: Centered based on cooldowns-up-anchor.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const placement = source.slice(source.indexOf("function sizeFor("), source.indexOf("\nfunction send()"));

function bar({ scale = 1, layout = "combined", direction = "center" } = {}) {
  const windows = new Map(), calls = [];
  const widgets = {
    async open(name, size) {
      calls.push(["open", name]);
      const at = windows.get(name) || { x: 400, y: 600 };
      windows.set(name, { ...at, width: Math.round(size.width * scale), height: Math.round(size.height * scale) });
    },
    async close(name) { calls.push(["close", name]); windows.delete(name); },
    async where(name) { calls.push(["where", name]); return { ...windows.get(name) }; },
    async place(name, at) {
      assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y), "the window was placed at a fraction of a pixel");
      calls.push(["place", name]);
      Object.assign(windows.get(name), at);
    },
  };
  const prefs = { show: true, layout, direction, size: "48", perLine: 6 };
  const mine = { skills: {}, buffs: {} };
  const context = vm.createContext({ prefs, mine, a2: { widgets }, devicePixelRatio: scale, send() {} });
  vm.runInContext(`${placement}\ngameOpen = true; globalThis.placeWidgets = placeWidgets;`, context);
  const shown = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, { show: true }]));
  return {
    windows, calls, widgets,
    async resize(settings = {}, skills = 2, buffs = 1) {
      Object.assign(prefs, settings);
      mine.skills = shown(skills); mine.buffs = shown(buffs);
      await context.placeWidgets();
    },
  };
}

const middle = (at) => at.x + at.width / 2;

function drag(b) {
  const anchored = new Map();
  for (const [name, at] of b.windows) {
    at.x += name === "buffs" ? 333 : 77; at.y -= name === "buffs" ? 150 : 90;
    anchored.set(name, { middle: middle(at), y: at.y });
  }
  return anchored;
}

for (const layout of ["combined", "split"]) for (const scale of [1, 1.25, 1.5, 1.75, 2]) {
  test(`Centered: the middle stays put as icons are added and removed, and doesn't creep sideways (${layout} layout, ${scale}x display scale)`, async () => {
    const b = bar({ layout, scale });
    await b.resize();
    assert.equal(b.calls.some(([action]) => action === "where" || action === "place"), false, "the widget was moved right after it opened");
    const anchored = drag(b);
    const check = () => {
      for (const [name, at] of b.windows) {
        assert.ok(Math.abs(middle(at) - anchored.get(name).middle) <= 1, `${name}: the middle moved more than 1 px`);
        assert.equal(at.y, anchored.get(name).y, `${name}: the widget moved up or down`);
      }
    };
    for (let round = 0; round < 25; round++) {
      for (const n of [3, 4, 5, 4, 3, 2]) {
        await b.resize({}, n, layout === "split" ? n % 3 + 1 : 1);
        check();
      }
    }
    for (const [settings, skills, buffs] of [[{}, 9, 3], [{ size: "68", perLine: 3 }, 7, 2], [{ size: "32", perLine: 6 }, 2, 1]]) {
      await b.resize(settings, skills, buffs);
      check();
    }
  });
}

test("Centered: after moving the widget, adding or removing icons doesn't pull it back to its previous position", async () => {
  const b = bar({ scale: 1.25 });
  await b.resize({}, 3, 1);
  drag(b);
  await b.resize({}, 5, 1);
  const anchored = drag(b);
  for (const n of [2, 6, 3]) {
    await b.resize({}, n, 1);
    assert.ok(Math.abs(middle(b.windows.get("bar")) - anchored.get("bar").middle) <= 1, "the widget went back towards its previous position");
  }
});

test("Centered: ticking an icon that only adds a new line (leaving width unchanged) doesn't move the widget sideways", async () => {
  const b = bar();
  await b.resize({}, 5, 1);
  const before = { ...b.windows.get("bar") };
  b.calls.length = 0;
  await b.resize({}, 9, 1);
  const after = b.windows.get("bar");
  assert.equal(after.width, before.width, "the width changed when a second line started (sizing bug, or bar() no longer putting 6 icons on a line)");
  assert.ok(after.height > before.height, "no new line started");
  assert.equal(b.calls.some(([action]) => action === "where" || action === "place"), false, "the plugin moved the widget when a new line was added");
  assert.equal(after.x, before.x, "the widget moved sideways");
});

test("Centered: the widget opens in the same spot it was closed in", async () => {
  const b = bar();
  await b.resize();
  b.calls.length = 0;
  await b.resize({ show: false });
  await b.resize({ show: true }, 7, 3);
  assert.deepEqual(b.calls, [["close", "bar"], ["open", "bar"]], "the reopened widget was moved");
});

test("Centered: the widget isn't moved when the meter can't say where it is or can't resize it (e.g. outdated meter, failed call)", async () => {
  for (const failure of ["missing-where", "missing-place", "where", "open"]) {
    const b = bar();
    await b.resize();
    if (failure.startsWith("missing-")) delete b.widgets[failure.slice(8)];
    else b.widgets[failure] = async () => { throw new Error("unavailable"); };
    b.calls.length = 0;
    await b.resize({}, 7, 3);
    assert.equal(b.calls.some(([action]) => action === "place"), false, `the widget was moved although ${failure.startsWith("missing-") ? `the meter has no ${failure.slice(8)}()` : `${failure}() failed`}`);
  }
});

test("Centered gets the same window sizes as Right", async () => {
  const right = bar({ direction: "right" }), center = bar();
  for (const [skills, buffs] of [[1, 0], [4, 2], [9, 3]]) {
    await right.resize({}, skills, buffs);
    await center.resize({}, skills, buffs);
    const r = right.windows.get("bar"), c = center.windows.get("bar");
    assert.deepEqual([c.width, c.height], [r.width, r.height], `Centered has a different window size (${skills} skills and ${buffs} buffs)`);
  }
});
