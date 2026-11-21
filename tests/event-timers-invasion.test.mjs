import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// The Dimensional Invasion's slots (event-timers/plugin.js): the game opens it
// at random at :30 and announces each opening (decoded:timed-event). A slot
// announced shows as open; one not announced while the plugin was listening
// gives way to the next once the grace time has passed.
const source = readFileSync(new URL("../plugins/event-timers/plugin.js", import.meta.url), "utf8");
const part = source.slice(source.indexOf("// Whether it opened:"), source.indexOf("function showingOf"));
const showing = source.slice(source.indexOf("function showingOf"), source.indexOf("\n}\n", source.indexOf("function showingOf")) + 3);
const context = vm.createContext({});
const HOUR = 3_600_000;
const S = 10 * HOUR + 30 * 60_000; // a :30 slot
vm.runInContext(`var now = 0; var character = { name: "A" }; var gameRunning = true;
const serverNow = () => now;
const isChance = (ev) => ev.id.startsWith("invasion");
// Slots every hour at :30, entry open for 3 minutes.
const nextOf = (ev, zone, at) => {
  let start = Math.floor((at - 30 * 60_000) / ${HOUR}) * ${HOUR} + 30 * 60_000;
  if (start + 180_000 <= at) start += ${HOUR};
  return { start, end: start + 180_000 };
};
${part}
${showing}
globalThis.api = { showingOf, noteListening, opened, setClock: (k) => { clockKnown = k; },
  set: (n, c, g) => { now = n; character = c; gameRunning = g; } };`, context);
const { api } = context;
const ev = { id: "invasion-elyos", side: "elyos" };
const plain = (v) => JSON.parse(JSON.stringify(v));

test("an announced slot shows as open", () => {
  api.set(S - 600_000, { name: "A" }, true);
  api.noteListening();
  api.opened.elyos.push(S + 1_000); // the window's start, as the game sends it
  api.set(S + 90_000, { name: "A" }, true);
  assert.deepEqual(plain(api.showingOf(ev, "UTC", S + 90_000)), { start: S, end: S + 180_000, opened: true });
  api.opened.elyos.length = 0;
});

test("a slot not announced while listening gives way to the next after the grace time", () => {
  api.setClock(true);
  assert.equal(api.showingOf(ev, "UTC", S + 20_000).start, S, "still waiting 20 s in");
  const after = plain(api.showingOf(ev, "UTC", S + 31_000));
  assert.deepEqual(after, { start: S + HOUR, end: S + HOUR + 180_000, skipped: true });
});

test("an uncorrected clock waits 60 s before calling it skipped", () => {
  api.setClock(false);
  assert.equal(api.showingOf(ev, "UTC", S + 45_000).start, S);
  assert.equal(api.showingOf(ev, "UTC", S + 61_000).start, S + HOUR);
});

test("not listening (game closed), a slot stays a chance", () => {
  api.set(S - 600_000, null, false);
  api.noteListening();
  api.set(S + 120_000, null, false);
  assert.deepEqual(plain(api.showingOf(ev, "UTC", S + 120_000)), { start: S, end: S + 180_000, opened: false });
});
