import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logic = fs.readFileSync(path.join(root, "plugins/boss-telegraph/logic.js"), "utf8");
function data() {
  return {
    texts: [{ en: "Safe to attack" }, { en: "Stop magic" }, { en: "Purple" }, { en: "Aura" }, { en: "Bound boss warning" }, { en: "Jump!" }, { en: "Dark" }, { en: "Light" }, { en: "Boss B" }], safe: 0,
    bosses: { a: { s: [10, 11, 12, 13] }, b: { s: [20] } },
    calls: [
      { k: "phase-a", t: "cast", id: 10, b: "a", act: 1, line: 2, lead: 1000, phase: { a: 101, ms: 10000, label: 1, n: 3 } },
      { k: "jump", t: "use", id: 11, b: "a", act: 5, waves: true },
      { k: "dark", t: "use", id: 12, b: "a", act: 6, mark: "order" },
      { k: "light", t: "use", id: 13, b: "a", act: 7, mark: "order" },
      { k: "boss-b", t: "cast", id: 20, b: "b", act: 8 },
      { k: "bound", t: "abnormal", id: 900, b: "a", line: 4, bind: true },
    ],
  };
}

function harness(D = data(), prefs = {}) {
  let now = 100_000, timerId = 0;
  const spoken = [], beeps = [], timers = new Map(), cancelled = [], snapshots = [];
  const sandbox = vm.createContext({ window: {},
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: (id) => { cancelled.push(id); timers.delete(id); },
  });
  vm.runInContext(logic, sandbox);
  const config = { tellMeWhatToDo: false, style: "act", ...prefs };
  const engine = sandbox.window.BossLogic.create(D, { now: () => now, prefs: () => config, lang: () => "en",
    say: (text) => spoken.push(text), beep: () => beeps.push(now), show: (items) => snapshots.push(Array.from(items)),
  });
  const cast = (skill = 10, entity = 1, at = now) => engine.cast({ caster: entity, skill }, at);
  const use = (skill, entity = 1, at = now) => engine.use({ caster: entity, skill }, at);
  const added = (abnormal = 101, entity = 1, instance = 1, at = now, length = 10000) => engine.added({ abnormal, entity, instance, length }, at);
  const removed = (entity = 1, instance = 1, at = now) => engine.removed({ entity, instance }, at);
  const wave = (entity = 1, at = now) => engine.wave({ caster: entity, skill: 11 }, at);
  return { engine, cast, use, added, removed, wave, spoken, beeps, timers, cancelled, snapshots, config, now: () => now,
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
      engine.tick();
    },
  };
}

test("clear discards learned boss binding, repeat history and per-entity call suppression", () => {
  const h = harness(); h.cast(); h.added(900);
  assert.ok(h.spoken.includes("Bound boss warning"));
  h.engine.clear(); h.advance(1); const before = h.spoken.length;
  h.added(900); assert.equal(h.spoken.length, before, "entity cannot inherit old boss binding");
  h.cast(); assert.equal(h.spoken.length, before + 1, "same trigger immediately after reset is fresh");
  h.engine.clear(); h.advance(1); h.added();
  assert.equal(h.spoken.length, before + 2, "pre-reset cast cannot suppress a new phase");
});

test("clear discards wave sources, sign orders, active phases and visible items", () => {
  const h = harness(); h.use(11); h.use(12); h.added();
  h.engine.clear();
  assert.equal(h.engine.items().length, 0);
  h.advance(1);
  h.wave(); assert.equal(h.beeps.length, 0, "old jump cannot beep after reset");
  h.use(13); assert.equal(h.engine.items()[0].text, "Light", "old order cannot carry into the new encounter");
  const before = h.spoken.length; h.advance(20000);
  assert.equal(h.spoken.length, before, "old phase cannot complete after reset");
  assert.equal(h.engine.items().length, 0);
});

test("clear cancels every pending preview timer and invalidates already queued callbacks", () => {
  const h = harness(); h.engine.preview("phase-a"); h.engine.test();
  const queued = [...h.timers.values()].map((timer) => timer.fn);
  assert.equal(queued.length, 2);
  h.engine.clear(); const before = h.spoken.length;
  assert.equal(h.cancelled.length, 2);
  assert.equal(h.timers.size, 0);
  // A callback dispatched just before cancellation must also be harmless.
  queued.forEach((fn) => fn()); h.advance(20000);
  assert.equal(h.engine.items().length, 0);
  assert.equal(h.spoken.length, before);
});

test("queued pre-reset events cannot repopulate the new encounter even inside the freshness window", () => {
  const h = harness(); h.use(12); h.advance(10);
  const queuedAt = h.now(); h.engine.clear(); h.advance(10);
  h.cast(10, 1, queuedAt); h.use(12, 1, queuedAt); h.added(101, 1, 1, queuedAt);
  h.added(900);
  assert.equal(h.engine.items().length, 0, "pre-reset phase/order and learned identity stay discarded");
  const before = h.spoken.length;
  h.use(13); assert.equal(h.engine.items()[0].text, "Light");
  h.cast(); assert.equal(h.spoken.length, before + 2, "rejected queued cast cannot suppress a current cast");
  h.engine.clear(); const resetTime = h.now(); h.cast(10, 1, resetTime);
  assert.equal(h.engine.items().length, 0, "same-millisecond live data is conservatively rejected");
  h.engine.preview("phase-a");
  assert.equal(h.engine.items()[0].text, "Stop magic", "explicit preview still works immediately after Reset");
});

test("stale and future events cannot learn binding or poison live repeat suppression", () => {
  for (const offset of [-3001, 1, 10000]) {
    const h = harness(); h.cast(10, 1, h.now() + offset); h.added(900);
    assert.deepEqual(h.spoken, [], `offset ${offset} must not learn a boss`);
    h.cast(); assert.deepEqual(h.spoken, ["Stop magic"], "rejected timestamp must not suppress the current event");
  }
});

test("stale and future phases cannot create or refresh countdowns", () => {
  for (const offset of [-3001, 1]) {
    const h = harness(); h.added(101, 1, 1, h.now() + offset);
    assert.equal(h.engine.items().length, 0); assert.deepEqual(h.spoken, []);
    h.added(); const until = h.engine.items()[0].end;
    h.added(101, 1, 1, h.now() + offset, 60000);
    assert.equal(h.engine.items()[0].end, until, "rejected buff cannot extend an existing phase");
  }
});

test("stale and future removals cannot end a current phase", () => {
  const h = harness(); h.added();
  for (const offset of [-3001, 1]) {
    h.removed(1, 1, h.now() + offset);
    assert.equal(h.engine.items()[0].kind, "phase");
    assert.deepEqual(h.spoken, ["Stop magic"]);
  }
  h.removed(); assert.equal(h.engine.items()[0].kind, "safe");
});

test("invalid timestamps and IDs cannot mutate phase, identity, order or wave state", () => {
  for (const at of [NaN, Infinity, -Infinity, undefined]) {
    const h = harness(); h.engine.cast({ caster: 1, skill: 10 }, at);
    h.engine.added({ entity: 1, instance: 1, abnormal: 101, length: 10000 }, at);
    assert.deepEqual(h.spoken, []); assert.equal(h.engine.items().length, 0);
  }
  for (const entity of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const h = harness(); h.cast(10, entity); h.use(12, entity); h.added(101, entity); h.wave(entity);
    assert.deepEqual(h.spoken, []); assert.equal(h.engine.items().length, 0); assert.equal(h.beeps.length, 0);
  }
});

test("rejected wave events cannot extend a visible call or suppress the next live beep", () => {
  const h = harness(); h.use(11); const until = h.engine.items()[0].until;
  h.wave(1, h.now() + 2000); h.wave(1, h.now() - 3001);
  assert.equal(h.engine.items()[0].until, until); assert.equal(h.beeps.length, 0);
  h.advance(1700); h.wave(); assert.equal(h.beeps.length, 1);
});

test("cast and phase speech suppression is scoped to the same entity", () => {
  const h = harness(); h.cast(10, 1); h.added(101, 2);
  assert.deepEqual(h.spoken, ["Stop magic", "Stop magic"], "a second boss's phase still speaks");
  h.added(101, 1); assert.equal(h.spoken.length, 2, "the first boss's recent cast suppresses only its own phase");
  const p = harness(); p.engine.preview("phase-a"); p.added(101, 1);
  assert.equal(p.spoken.length, 2, "preview history cannot suppress a live entity");
});

test("same mechanic on another entity cannot suppress confirmed completion", () => {
  const h = harness(); h.added(101, 1); h.added(101, 2);
  h.removed(1, 1);
  assert.equal(h.spoken.at(-1), "Safe to attack");
  assert.ok(h.engine.items().some((item) => item.kind === "phase" && item.key.includes(":2:")), "the other entity's phase remains visible");
});

test("each buff instance keeps its own countdown until its exact removal", () => {
  const h = harness(); h.added(101, 1, 1); h.added(101, 1, 2);
  assert.equal(h.engine.items().filter((item) => item.kind === "phase").length, 2);
  assert.equal(h.spoken.length, 1, "a duplicate phase's standalone speech is not repeated");
  h.removed(1, 1);
  assert.equal(h.engine.items().filter((item) => item.kind === "phase").length, 1);
  assert.equal(h.spoken.length, 1, "another instance on the same entity is still active");
  h.removed(2, 2); assert.equal(h.spoken.length, 1, "unrelated recipient cannot remove it");
  h.removed(1, 2); assert.equal(h.spoken.at(-1), "Safe to attack");
});

test("countdown completion announces safety once and late removal cannot duplicate it",()=>{
 const h=harness();h.added(101,1,1,h.now(),1000);h.advance(1000);
 assert.deepEqual(h.spoken,["Stop magic","Safe to attack"]);assert.equal(h.engine.items()[0].kind,"safe");
 h.advance(40);h.removed();h.removed();assert.equal(h.spoken.filter(s=>s==="Safe to attack").length,1);
});
test("suspended expired countdown stays quiet rather than announcing an old window",()=>{
 const h=harness();h.added(101,1,1,h.now(),1000);h.advance(5000);assert.deepEqual(h.spoken,["Stop magic"]);
});
test("overlapping hazards suppress completion until every active hazard has ended",()=>{
 const D=data();D.texts.push({en:"Stop physical"});D.calls.push({k:"physical",t:"cast",id:14,b:"a",act:9,phase:{a:102,ms:10000,label:9}});
 const h=harness(D);h.added(101,1,1,h.now(),1000);h.added(102,1,2);h.advance(1000);
 assert.deepEqual(h.spoken,["Stop magic","Stop physical"]);h.removed(1,2);assert.equal(h.spoken.at(-1),"Safe to attack");
});

test("shared phase IDs never pick the first boss or use disabled candidates to guess", () => {
  const D = data(); D.calls.push({ k: "phase-b", t: "cast", id: 20, b: "b", act: 8, phase: { a: 101, ms: 10000, label: 8 } });
  for (const prefs of [{}, { offCall: { "phase-a": true } }]) {
    const h = harness(D, prefs); h.cast(20); const before = h.spoken.length; h.added();
    assert.equal(h.spoken.length, before); assert.ok(!h.engine.items().some((item) => item.kind === "phase"));
  }
});

test("a phase shared with another boss's abnormal trigger stays unresolved", () => {
  const D = data(); D.calls.push({ k: "other-buff", t: "abnormal", id: 101, b: "b", bind: true, act: 8 });
  const h = harness(D); h.added();
  assert.equal(h.engine.items().length, 0); assert.deepEqual(h.spoken, []);
});

test("bound phase rejects unknown or mismatched recipients and accepts matching narrow context", () => {
  const D = data(); D.calls[0].phase.bind = true;
  const h = harness(D); h.added(); assert.equal(h.engine.items().length, 0);
  h.cast(20); h.added(); assert.ok(!h.engine.items().some((item) => item.kind === "phase"));
  h.cast(10, 2); h.added(101, 2); assert.ok(h.engine.items().some((item) => item.kind === "phase"));
  const generic = harness(); generic.cast(20); generic.added();
  assert.ok(!generic.engine.items().some((item) => item.kind === "phase"), "even an unbound phase must not contradict known boss context");
});

test("disabling a mechanic before removal prevents a completion announcement", () => {
  const h = harness(); h.added(); h.config.offCall = { "phase-a": true }; h.removed();
  assert.deepEqual(h.spoken, ["Stop magic"]); assert.equal(h.engine.items().length, 0);
});
