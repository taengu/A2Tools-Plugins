import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "tools", "boss-telegraph", "mechanics.py");
const locales = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"];

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boss-mechanics-build-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const paths = {
    source: path.join(dir, "mechanics.json"), bosses: path.join(dir, "bosses.js"),
    output: path.join(dir, "mechanics.js"),
  };
  const data = {
    texts: [{ en: "Hide behind a rock!" }, { en: "Curated hide instruction" }],
    calls: [{ k: "hide", b: "stone-giant", t: "cast", id: 123, line: 0, act: 1 }],
  };
  const entry = {
    k: "hide", bossKey: "stone-giant", t: "cast", id: 123,
    source: { field: "line", en: "Hide behind a rock!" },
    text: Object.fromEntries(locales.map((lang) => [lang, lang === "en" ? "Hide behind a rock" : `${lang}: hide instruction`])),
    scope: { universal: true, regions: [], categories: [], difficulties: [], stages: [] },
    verification: "game-explicit", enabled: true, referenceOnly: false,
    evidence: [{ kind: "game-dialogue", table: "NpcTalk", row: 123, quote: "Hide behind a rock!" }],
    review: { status: "reviewed", reviewer: "fixture", flags: [] },
  };
  const source = { schemaVersion: 1, entries: [entry], provenance: { note: "Retain source records" } };
  function run({ check = false, save = true } = {}) {
    if (save) {
      fs.writeFileSync(paths.source, JSON.stringify(source));
      fs.writeFileSync(paths.bosses, `window.BOSS_CALLOUTS = ${JSON.stringify(data)};\n`);
    }
    return spawnSync("python", [builder, "--source", paths.source, "--bosses", paths.bosses,
      "--output", paths.output, ...(check ? ["--check"] : [])], { cwd: root, encoding: "utf8" });
  }
  function rejects(pattern) {
    const result = run();
    assert.notEqual(result.status, 0, "invalid source unexpectedly built");
    assert.match(result.stderr, pattern);
    assert.equal(fs.existsSync(paths.output), false, "invalid source must not write an artifact");
  }
  function scoped(category = "conquest") {
    entry.verification = "guide-exact";
    entry.scope = { universal: false, regions: ["KR"], categories: [category], difficulties: ["hard"], stages: [] };
  }
  return { paths, data, entry, source, run, rejects, scoped };
}

test("builder preserves all reviewed metadata and checks freshness without writing", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const body = fs.readFileSync(f.paths.output, "utf8");
  const context = vm.createContext({ window: {} });
  vm.runInContext(body, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.BOSS_MECHANICS)), f.source);
  assert.equal(f.run({ check: true }).status, 0);
  fs.appendFileSync(f.paths.output, "// stale\n");
  const staleBody = fs.readFileSync(f.paths.output, "utf8");
  const modified = fs.statSync(f.paths.output).mtimeMs;
  const stale = f.run({ check: true });
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /out of date/);
  assert.equal(fs.readFileSync(f.paths.output, "utf8"), staleBody);
  assert.equal(fs.statSync(f.paths.output).mtimeMs, modified);
});

test("--check rejects missing output without creating it", (t) => {
  const f = fixture(t);
  const result = f.run({ check: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /out of date/);
  assert.equal(fs.existsSync(f.paths.output), false);
});

test("optional official dungeon metadata and context provenance are preserved without inferring modes", (t) => {
  const f = fixture(t);
  f.source.dungeons = { "123": { name: "An ominous _HARD suffix" }, "124": { name: "Known map", difficulty: "hard" } };
  f.source.contextProvenance = { source: "official dictionary", revision: "fixture" };
  assert.equal(f.run().status, 0);
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(f.paths.output, "utf8"), context);
  const payload = JSON.parse(JSON.stringify(context.window.BOSS_MECHANICS));
  assert.deepEqual(payload.dungeons, f.source.dungeons);
  assert.deepEqual(payload.contextProvenance, f.source.contextProvenance);
  assert.equal(Object.hasOwn(payload.dungeons["123"], "difficulty"), false);
});

test("factual build and version provenance remains intact in eligible guidance", (t) => {
  const f = fixture(t);
  Object.assign(f.entry.evidence[0], {
    build: "Global client 2.0.10", version: "2.0.10", versions: ["2.0.9", "2.0.10"],
    methodology: "Compared exact trigger against the current Global client",
  });
  f.entry.review.client = { build: "Global 2.0.10", version: "2.0.10" };
  assert.equal(f.run().status, 0);
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(f.paths.output, "utf8"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.BOSS_MECHANICS.entries[0])), f.entry);
});

for (const flag of ["historicalRemovedMode", "requiresExplicitHistoricalContext", "requiresVersionContext", "referenceOnly", "unknownScope"]) {
  test(`explicit unresolved applicability flag ${flag} is rejected`, (t) => {
    const f = fixture(t);
    f.entry.review[flag] = true;
    f.rejects(/resolved before building/);
  });
}

for (const change of ["id", "name", "difficulty", "nullDifficulty"]) {
  test(`official dungeon dictionary rejects invalid ${change}`, (t) => {
    const f = fixture(t);
    f.source.dungeons = { [change === "id" ? "map123" : "123"]: { name: "Map" } };
    const dungeon = Object.values(f.source.dungeons)[0];
    if (change === "name") dungeon.name = "";
    if (change === "difficulty") dungeon.difficulty = "unknown";
    if (change === "nullDifficulty") dungeon.difficulty = null;
    f.rejects(/dungeon/);
  });
}

for (const key of ["k", "bossKey", "t", "id"]) {
  test(`exact trigger drift in ${key} is rejected even when other tuple parts match`, (t) => {
    const f = fixture(t);
    f.entry[key] = key === "id" ? 124 : key === "t" ? "use" : "changed";
    f.rejects(/exact trigger tuple changed or missing/);
  });
}

test("a shared key does not validate against a different boss or trigger", (t) => {
  const f = fixture(t);
  f.data.calls.unshift({ ...f.data.calls[0], b: "another-giant", line: 1 });
  assert.equal(f.run().status, 0);
});

test("duplicate exact source trigger tuples are rejected", (t) => {
  const f = fixture(t);
  f.source.entries.push(structuredClone(f.entry));
  f.rejects(/duplicate exact trigger/);
});

test("same exact trigger permits separately reviewed KR and Global variants without merging scope", (t) => {
  const f = fixture(t);
  f.scoped();
  const global = structuredClone(f.entry);
  global.scope = { universal: false, regions: ["Global"], categories: ["sanctuary"], difficulties: ["normal"], stages: [] };
  global.text.en = "Global-specific instruction";
  f.source.entries.push(global);
  assert.equal(f.run().status, 0);
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(f.paths.output, "utf8"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.BOSS_MECHANICS.entries)), f.source.entries);
});

for (const change of ["overlap", "multiRegionOverlap", "universal", "missingRegion"]) {
  test(`regional variants reject ${change} regardless of other dimensions`, (t) => {
    const f = fixture(t);
    f.scoped();
    const second = structuredClone(f.entry);
    second.scope.categories = ["sanctuary"];
    second.scope.difficulties = ["normal"];
    if (change === "multiRegionOverlap") second.scope.regions = ["Global", "KR"];
    if (change === "universal") {
      second.verification = "game-explicit";
      second.scope = { universal: true, regions: [], categories: [], difficulties: [], stages: [] };
    }
    if (change === "missingRegion") second.scope.regions = [];
    f.source.entries.push(second);
    f.rejects(/duplicate exact trigger|explicit regions/);
  });
}

test("regional current literal game instruction does not require an invented mode or category", (t) => {
  const f = fixture(t);
  f.entry.scope = { universal: false, regions: ["KR"], categories: [], difficulties: [], stages: [] };
  assert.equal(f.run().status, 0);
});

test("regional literal retains any independently reviewed nonempty scope restrictions", (t) => {
  const f = fixture(t);
  f.entry.scope = { universal: false, regions: ["Global"], categories: ["conquest"], difficulties: [], stages: [] };
  assert.equal(f.run().status, 0);
});

test("managedKeys preserves region-specific review holds even without a matching active entry", (t) => {
  const f = fixture(t);
  f.source.managedKeys = { Global: ["hide", "held-key"], KR: ["hide"] };
  assert.equal(f.run().status, 0);
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(f.paths.output, "utf8"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.BOSS_MECHANICS.managedKeys)), f.source.managedKeys);
});

for (const change of ["unknownRegion", "nonArray", "blankKey", "nonStringKey", "duplicateKey"]) {
  test(`managedKeys rejects ${change}`, (t) => {
    const f = fixture(t);
    f.source.managedKeys = { KR: ["hide"] };
    if (change === "unknownRegion") f.source.managedKeys = { unknown: ["hide"] };
    if (change === "nonArray") f.source.managedKeys.KR = "hide";
    if (change === "blankKey") f.source.managedKeys.KR = [" "];
    if (change === "nonStringKey") f.source.managedKeys.KR = [123];
    if (change === "duplicateKey") f.source.managedKeys.KR = ["hide", "hide"];
    f.rejects(/managedKeys/);
  });
}

for (const change of ["text", "field", "missingField", "duplicateGameRow"]) {
  test(`source drift (${change}) cannot silently reuse an instruction`, (t) => {
    const f = fixture(t);
    if (change === "text") f.data.texts[0].en = "Run away!";
    if (change === "field") f.entry.source.field = "act";
    if (change === "missingField") delete f.data.calls[0].line;
    if (change === "duplicateGameRow") f.data.calls.push({ ...f.data.calls[0], line: 1 });
    f.rejects(/source .*changed or missing/);
  });
}

for (const change of ["missing", "empty", "extra", "wrongType", "longEnglish"]) {
  test(`invalid localized instructions (${change}) are rejected`, (t) => {
    const f = fixture(t);
    if (change === "missing") delete f.entry.text.ru;
    if (change === "empty") f.entry.text.ko = "  ";
    if (change === "extra") f.entry.text.unknown = "text";
    if (change === "wrongType") f.entry.text.ja = 12;
    if (change === "longEnglish") f.entry.text.en = "x".repeat(101);
    f.rejects(/ten non-empty locales|exceeds 100/);
  });
}

test("100-character English instruction remains valid", (t) => {
  const f = fixture(t);
  f.entry.text.en = "x".repeat(100);
  assert.equal(f.run().status, 0);
});

for (const change of ["guideUniversal", "curatedUniversal", "mixedUniversal"]) {
  test(`universal applicability rejects ${change}`, (t) => {
    const f = fixture(t);
    if (change === "guideUniversal") f.entry.verification = "guide-exact";
    if (change === "curatedUniversal") f.entry.source = { field: "act", en: f.data.texts[1].en };
    if (change === "mixedUniversal") f.entry.scope.regions.push("KR");
    f.rejects(/universal/);
  });
}

for (const change of ["unknownRegion", "unknownCategory", "unknownDifficulty", "unknownField", "emptyRegion", "emptyCategory", "emptyMode", "emptyStages", "badStage", "historical", "version", "flags"]) {
  test(`scoped guidance rejects unresolved or invalid ${change}`, (t) => {
    const f = fixture(t);
    f.scoped();
    if (change === "unknownRegion") f.entry.scope.regions = ["global"];
    if (change === "unknownCategory") f.entry.scope.categories = ["raid"];
    if (change === "unknownDifficulty") f.entry.scope.difficulties = ["unknown"];
    if (change === "unknownField") f.entry.scope.modes = ["hard"];
    if (change === "emptyRegion") f.entry.scope.regions = [];
    if (change === "emptyCategory") f.entry.scope.categories = [];
    if (change === "emptyMode") f.entry.scope.difficulties = [];
    if (change === "emptyStages") f.entry.scope.categories = ["transcendence"];
    if (change === "badStage") { f.entry.scope.categories = ["trial"]; f.entry.scope.stages = [true]; }
    if (change === "historical") f.entry.review.historical = true;
    if (change === "version") f.entry.review.versionRestricted = "old patch";
    if (change === "flags") f.entry.review.flags = ["unverified-global"];
    f.rejects(/scope|requires|ranked|resolved|flags/);
  });
}

for (const category of ["conquest", "sanctuary", "transcendence", "trial", "nightmare"]) {
  test(`known ${category} guide applicability builds`, (t) => {
    const f = fixture(t);
    f.scoped(category);
    if (["transcendence", "trial", "nightmare"].includes(category)) {
      f.entry.scope.difficulties = [];
      f.entry.scope.stages = [1, 2];
    }
    assert.equal(f.run().status, 0);
  });
}

test("import has no source-read, argument-parse or output side effects", (t) => {
  const f = fixture(t);
  const code = "import importlib.util,pathlib; from unittest.mock import patch; " +
    "spec=importlib.util.spec_from_file_location('mechanics'," + JSON.stringify(builder) + "); " +
    "module=importlib.util.module_from_spec(spec); " +
    "guard=patch.object(pathlib.Path,'read_text',side_effect=AssertionError('import read a file')); " +
    "guard.start(); spec.loader.exec_module(module); assert callable(module.build_mechanics)";
  const result = spawnSync("python", ["-c", code, "--unknown-argument"], { cwd: f.paths.source.replace(/mechanics\.json$/, ""), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(f.paths.output), false);
});
