// Event Timers: World Boss Train shows every world boss within the train's
// time of spawning, a boss with an alert of its own too (its alert's shorter
// time hid it before).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../plugins/event-timers/anchor.js", import.meta.url), "utf8");
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
const MIN = 60_000;

function train(prefs, bosses, respawn = () => 600) {
  const context = vm.createContext({
    prefs,
    canPlace: () => true,
    iconStyle: () => true,
    canPin: () => true,
    serverNow: () => 0,
    fieldBosses: () => bosses.map((id) => ({ id })),
    respawnOf: (id) => respawn(id),
  });
  vm.runInContext(
    `${slice("const TRAIN_LEADS", "// List layout")}
     const anchorOn = () => canPlace() && iconStyle() && !!prefs.anchorMode;
     ${slice("const trainOn = ", "const gridSize")}
     ${slice("const RIFT_TRAIN_MIN", "// Which comes first")}
     globalThis.trainPins = trainPins; globalThis.trainVisible = trainVisible;`,
    context,
  );
  return context;
}
const cfg = (key) => ({ key, always: false, lead: 1, fought: false });

test("a boss with its own 1-minute alert shows from the train's 5 minutes", () => {
  const t = train({ anchorMode: true, anchorTrain: true, anchorTrainLead: 5 }, ["a", "b"]);
  const out = { "field:a": cfg("field:a") };
  t.trainPins(out, cfg);
  // Its alert stays its own (lead 1), and the train shows it as well.
  assert.equal(out["field:a"].lead, 1);
  assert.equal(out["field:a"].train, true);
  assert.equal(out["field:b"].lead, -1);
  for (const id of ["field:a", "field:b"]) {
    assert.equal(t.trainVisible(out[id], { running: false, killed: false }, 4 * MIN), true, id);
    assert.equal(t.trainVisible(out[id], { running: false, killed: false }, 6 * MIN), false, id);
    assert.equal(t.trainVisible(out[id], { running: true, killed: false }, null), true, id);
    assert.equal(t.trainVisible(out[id], { running: true, killed: true }, null), false, id);
  }
});

test("with the train off, a boss's own alert is left alone", () => {
  const t = train({ anchorMode: true, anchorTrain: false }, ["a"]);
  const out = { "field:a": cfg("field:a") };
  t.trainPins(out, cfg);
  assert.equal(out["field:a"].train, undefined);
  assert.equal(t.trainVisible(out["field:a"], { running: false, killed: false }, 4 * MIN), false);
});
