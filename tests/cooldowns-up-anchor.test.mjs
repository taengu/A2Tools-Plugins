import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/cooldowns/plugin.js", import.meta.url), "utf8");
const placement = source.slice(source.indexOf("function sizeFor("), source.indexOf("\nfunction send()"));

function bar({ scale = 1, layout = "combined", direction = "up" } = {}) {
  const windows = new Map(), calls = [];
  const widgets = {
    async open(name, size) {
      calls.push(["open", name]);
      const at = windows.get(name) || { x: 120, y: 600 };
      windows.set(name, { ...at, width: Math.round(size.width * scale), height: Math.round(size.height * scale) });
    },
    async close(name) { calls.push(["close", name]); },
    async where(name) { calls.push(["where", name]); return { ...windows.get(name) }; },
    async place(name, at) {
      assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y));
      calls.push(["place", name]);
      Object.assign(windows.get(name), at);
    },
  };
  const prefs = { show: true, layout, direction, size: "48", perLine: 4 };
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

const bottom = (at) => at.y + at.height;

for (const layout of ["combined", "split"]) for (const scale of [1, 1.5, 2]) {
  test(`Up preserves each dragged bottom through resize and wrapping (${layout}, ${scale}x)`, async () => {
    const b = bar({ layout, scale });
    await b.resize();
    assert.equal(b.calls.some(([action]) => action === "where" || action === "place"), false);
    const anchored = new Map();
    for (const [name, at] of b.windows) {
      at.x += name === "buffs" ? 250 : 75; at.y -= name === "buffs" ? 150 : 90;
      anchored.set(name, { x: at.x, bottom: bottom(at) });
    }
    for (const [settings, skills, buffs] of [[{}, 7, 3], [{ size: "68", perLine: 3 }, 6, 2], [{ size: "48", perLine: 6 }, 2, 1]]) {
      await b.resize(settings, skills, buffs);
      for (const [name, at] of b.windows) {
        assert.equal(at.x, anchored.get(name).x);
        assert.ok(Math.abs(bottom(at) - anchored.get(name).bottom) <= 1, "bottom stays fixed within physical-pixel rounding");
      }
    }
  });
}

test("other directions, unchanged size and Up width-only wrapping do not move", async () => {
  for (const direction of ["right", "left", "down", "up"]) {
    const b = bar({ direction });
    await b.resize({}, 4, 0);
    b.calls.length = 0;
    await b.resize({}, 4, 0);
    assert.equal(b.calls.length, 0);
    await b.resize({}, 5, 0); // Up adds a column without changing height.
    assert.equal(b.calls.some(([action]) => action === "where" || action === "place"), false);
  }
});

test("closing and reopening does not apply an old anchor", async () => {
  const b = bar();
  await b.resize();
  b.calls.length = 0;
  await b.resize({ show: false });
  await b.resize({ show: true }, 7, 3);
  assert.deepEqual(b.calls, [["close", "bar"], ["open", "bar"]]);
});

test("missing placement APIs, failed bounds and failed opens do not move", async () => {
  for (const failure of ["missing-where", "missing-place", "where", "open"]) {
    const b = bar();
    await b.resize();
    if (failure.startsWith("missing-")) delete b.widgets[failure.slice(8)];
    else b.widgets[failure] = async () => { throw new Error("unavailable"); };
    b.calls.length = 0;
    await b.resize({}, 7, 3);
    assert.equal(b.calls.some(([action]) => action === "place"), false);
  }
});
