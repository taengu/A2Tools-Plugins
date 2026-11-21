const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "detection.js"), "utf8"), sandbox);
const create = sandbox.BossDetection.create;
const action = (id, key = "move-away", extras = {}) => ({
  key, audience: "all", timing: "now", verified: true, covers: [id], ...extras,
});
const candidate = (id, extras = {}) => ({ id, trigger: { kind: "cast", id: 123 }, action: action(id), ...extras });
const conditional = (id, key = "check-mark-if-then", extras = {}) => action(id, key, {
  mode: "player-observed", conditions: ["visible-mark"], ...extras,
});

function harness() {
  let time = 100000;
  const resolver = create({ now: () => time });
  return {
    resolver,
    advance: (ms) => { time += ms; },
    event: (extras = {}) => ({ kind: "cast", id: 123, entity: 7, at: time, ...extras }),
    observed: (value, extras = {}) => ({ value, source: "observed", at: time, generation: resolver.generation(), ...extras }),
    resolve(candidates, extras = {}) { return resolver.resolve({ event: this.event(), candidates, coverageComplete: true, ...extras }); },
  };
}

test("a complete exact trigger set with one reviewed action resolves specifically", () => {
  const h = harness();
  const result = h.resolve([candidate("global-normal")]);
  assert.equal(result.kind, "specific");
  assert.equal(result.actionKey, "move-away");
  assert.deepEqual(Array.from(result.candidateIds), ["global-normal"]);
});

test("one reviewed row is insufficient when plausible profile coverage is unknown", () => {
  const h = harness();
  for (const coverageComplete of [undefined, false, "true"]) {
    const result = h.resolve([candidate("normal")], { coverageComplete });
    assert.equal(result.kind, "neutral");
    assert.equal(result.reason, "incomplete-candidate-coverage");
  }
});

test("shared triggers resolve only when every plausible verified action agrees", () => {
  const h = harness();
  assert.equal(h.resolve([candidate("normal"), candidate("hard")]).kind, "specific");
  for (const divergent of [
    { action: action("hard", "stack") },
    { action: action("hard", "move-away", { audience: "marked" }) },
    { action: action("hard", "move-away", { timing: "after-pulse" }) },
    { action: action("hard", "move-away", { verified: false }) },
    { action: null },
    { action: action("hard", "move-away", { covers: ["normal"] }) },
  ]) assert.equal(h.resolve([candidate("normal"), candidate("hard", divergent)]).kind, "neutral");
});

test("unknown dimensions preserve all possible variants, including rows with unknown scope", () => {
  const h = harness();
  const rows = [
    candidate("normal", { applicability: { difficulty: ["normal"] } }),
    candidate("hard", { applicability: { difficulty: ["hard"] }, action: action("hard", "stack") }),
    candidate("unknown", { action: null }),
  ];
  const result = h.resolve(rows, { context: { difficulty: "normal", region: { value: null, source: "manual" } } });
  assert.equal(result.kind, "neutral");
  assert.equal(result.candidateIds.length, 3);
  assert.equal(h.resolve(rows, { context: { difficulty: { value: "normal", source: "manual" } } }).kind, "neutral");
});

test("manual difficulty narrows scope without claiming a detected difficulty", () => {
  const h = harness();
  const rows = [
    candidate("normal", { applicability: { difficulty: ["normal"] } }),
    candidate("hard", { applicability: { difficulty: ["hard"] }, action: action("hard", "stack") }),
  ];
  const result = h.resolve(rows, { context: { difficulty: { value: "normal", source: "manual" } } });
  assert.equal(result.kind, "specific");
  assert.deepEqual(Array.from(result.candidateIds), ["normal"]);
  assert.equal(result.detectedDifficulty, undefined);
});

test("region is independent of UI language; tierLabel, difficulty, stage and phase are separate", () => {
  const h = harness();
  const rows = [candidate("global", { applicability: { region: ["global"], difficulty: ["normal"], tierLabel: ["Stage2"], stage: [2], phase: ["enraged"], dungeonId: [600001] } }),
    candidate("korea", { applicability: { region: ["korea"] }, action: action("korea", "stack") })];
  assert.equal(h.resolve(rows, { context: { language: "ko", region: { value: "global", source: "guessed" } } }).kind, "neutral");
  const context = Object.fromEntries(Object.entries({ region: "global", difficulty: "normal", tierLabel: "Stage2", stage: 2, phase: "enraged", dungeonId: 600001 }).map(([key, value]) => [key, { value, source: "manual" }]));
  assert.equal(h.resolve(rows, { context }).kind, "specific");
  assert.equal(h.resolve(rows, { context: { ...context, stage: { value: "Stage2", source: "manual" } } }).kind, "ignored");
});

test("observed scope expires and cannot survive a reset generation", () => {
  const h = harness();
  const rows = [candidate("global", { applicability: { region: ["global"] } }), candidate("korea", { applicability: { region: ["korea"] }, action: action("korea", "stack") })];
  const region = h.observed("global");
  assert.equal(h.resolve(rows, { context: { region } }).kind, "specific");
  h.advance(3001);
  assert.equal(h.resolve(rows, { context: { region } }).kind, "neutral");
  h.resolver.reset(); h.advance(1);
  assert.equal(h.resolve(rows, { context: { region } }).kind, "neutral");
});

test("exact map facts persist within their lifecycle without renewing the original timestamp", () => {
  const h = harness();
  const rows = [candidate("normal", { applicability: { difficulty: ["normal"] } }),
    candidate("hard", { applicability: { difficulty: ["hard"] }, action: action("hard", "stack") })];
  const difficulty = h.observed("normal", { basis: "map-load" });
  h.advance(30000);
  assert.equal(h.resolve(rows, { context: { difficulty } }).kind, "specific");
  assert.equal(difficulty.at, 100000);
  h.resolver.reset(); h.advance(1);
  assert.equal(h.resolve(rows, { context: { difficulty } }).kind, "neutral");
  const regions = [candidate("global", { applicability: { region: ["global"] } }),
    candidate("korea", { applicability: { region: ["korea"] }, action: action("korea", "stack") })];
  assert.equal(h.resolve(regions, { context: { region: { ...difficulty, generation: h.resolver.generation(), value: "global" } } }).kind, "neutral");
});

test("observed phase scope belongs to the event entity and existed when the trigger arrived", () => {
  const h = harness();
  const rows = [candidate("early", { applicability: { phase: ["early"] } }),
    candidate("late", { applicability: { phase: ["late"] }, action: action("late", "stack") })];
  const phase = h.observed("early", { entity: 8 });
  assert.equal(h.resolve(rows, { context: { phase } }).kind, "neutral");
  phase.entity = 7;
  assert.equal(h.resolve(rows, { context: { phase } }).kind, "specific");
  const event = h.event(); h.advance(1);
  assert.equal(h.resolve(rows, { event, context: { phase: h.observed("early", { entity: 7 }) } }).kind, "neutral");
});

test("stale, future, malformed and previous-generation events never resolve actions", () => {
  const h = harness();
  for (const event of [h.event({ at: 96999 }), h.event({ at: 100001 }), h.event({ at: NaN }), h.event({ entity: 0 }), h.event({ id: "123" }), h.event({ generation: 9 })]) {
    assert.equal(h.resolve([candidate("a")], { event }).kind, "ignored");
  }
  const old = h.event(); h.resolver.reset(); h.advance(1);
  assert.equal(h.resolve([candidate("a")], { event: old }).kind, "ignored");
  assert.equal(h.resolve([candidate("a")]).kind, "specific");
});

test("resolve never learns a boss, tier or mark from previous exact skills", () => {
  const h = harness();
  h.resolve([candidate("unique")]);
  h.advance(1);
  const ambiguous = [candidate("boss-a"), candidate("boss-b", { action: action("boss-b", "stack") })];
  assert.equal(h.resolve(ambiguous).kind, "neutral");
  assert.equal(h.resolve(ambiguous, { context: { hp: 25, bossName: "boss-a", size: "large" } }).kind, "neutral");
});

test("common complete if/then guidance can cover unresolved observable branches", () => {
  const h = harness();
  const rows = [candidate("red", { action: action("red", "stop-physical"), conditional: conditional("red") }),
    candidate("purple", { action: action("purple", "stop-magic"), conditional: conditional("purple") })];
  const result = h.resolve(rows);
  assert.equal(result.kind, "conditional");
  assert.equal(result.actionKey, "check-mark-if-then");
  assert.equal(result.reason, "player-observation-required");
  assert.deepEqual(Array.from(result.conditions), ["visible-mark"]);
  assert.equal(result.detectedMark, undefined);
});

test("conditional guidance cannot escape its reviewed candidate and condition scope", () => {
  const h = harness();
  const a = candidate("a", { action: null, conditional: conditional("a") });
  for (const extra of [{ verified: false }, { covers: ["a"] }, { conditions: ["boss-size"] }, { mode: "inferred" }, { conditions: [] }]) {
    const b = candidate("b", { action: null, conditional: conditional("b", "check-mark-if-then", extra) });
    assert.equal(h.resolve([a, b]).kind, "neutral");
  }
  assert.equal(h.resolve([a, candidate("unmapped", { action: null })]).kind, "neutral");
});

test("direct player instructions require observed self evidence, never a manual mark", () => {
  const h = harness();
  const rows = [candidate("marked", { action: action("marked", "marked-move", { audience: "self", requiresEvidence: [{ key: "mark", value: "red", scope: "self" }] }) })];
  const fact = h.observed("red", { entity: 22, localPlayer: true });
  assert.equal(h.resolve(rows).kind, "neutral");
  assert.equal(h.resolve(rows, { context: { evidence: { mark: { ...fact, source: "manual" } } } }).kind, "neutral");
  assert.equal(h.resolve(rows, { context: { evidence: { mark: { ...fact, localPlayer: false } } } }).kind, "neutral");
  assert.equal(h.resolve(rows, { context: { evidence: { mark: fact } } }).kind, "specific");
  h.advance(3001);
  assert.equal(h.resolve(rows, { context: { evidence: { mark: fact } } }).kind, "neutral");
});

test("entity-specific boss or HP phase evidence is never borrowed from another entity", () => {
  const h = harness();
  const rows = [candidate("a", { action: action("a", "jump", { requiresEvidence: [{ key: "hpPhase", value: "below-half", scope: "entity" }] }) })];
  const fact = h.observed("below-half", { entity: 7 });
  assert.equal(h.resolve(rows, { context: { evidence: { hpPhase: { ...fact, entity: 8 } } } }).kind, "neutral");
  assert.equal(h.resolve(rows, { context: { hpPercent: 40 } }).kind, "neutral");
  assert.equal(h.resolve(rows, { context: { evidence: { hpPhase: fact } } }).kind, "specific");
  const earlierEvent = h.event(); h.advance(1);
  assert.equal(h.resolve(rows, { event: earlierEvent, context: { evidence: { hpPhase: h.observed("below-half", { entity: 7 }) } } }).kind, "neutral");
  h.resolver.reset(); h.advance(1);
  assert.equal(h.resolve(rows, { context: { evidence: { hpPhase: fact } } }).kind, "neutral");
});

test("an unmet direct condition can fall back only to a separately reviewed conditional", () => {
  const h = harness();
  const row = candidate("a", { action: action("a", "move", { requiresEvidence: [{ key: "mark", value: true, scope: "self" }] }), conditional: conditional("a") });
  assert.equal(h.resolve([row]).kind, "conditional");
});

test("malformed or misspelled applicability and duplicate rows fail closed", () => {
  const h = harness();
  for (const applicability of [{ regions: ["global"] }, { stage: [] }, { region: "global" }, { stage: [null] }]) {
    assert.equal(h.resolve([candidate("a", { applicability })]).kind, "neutral");
  }
  assert.equal(h.resolve([candidate("a"), candidate("a")]).kind, "neutral");
  assert.equal(h.resolve([candidate("a", { id: "" })]).kind, "neutral");
});

test("wrong triggers stay silent and caller data is never changed", () => {
  const h = harness();
  const rows = [candidate("a")];
  const context = { region: { value: "global", source: "manual" } };
  const before = JSON.stringify({ rows, context });
  assert.equal(h.resolve(rows, { event: h.event({ kind: "use" }), context }).kind, "ignored");
  h.resolve(rows, { context });
  assert.equal(JSON.stringify({ rows, context }), before);
});

test("clock configuration is validated", () => {
  assert.throws(() => create({ now: 1 }), /clock/);
  assert.throws(() => create({ maxAgeMs: -1 }), /freshness/);
  assert.throws(() => create({ now: () => NaN }).reset(), /finite/);
});
