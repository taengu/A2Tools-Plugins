const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../../plugins/boss-telegraph/activation.js"), "utf8"), sandbox);
const create = sandbox.BossActivation.create;
const locales = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"];
const call = { k: "instruction-a", b: "boss-a", t: "cast", id: 123 };
const context = { region: "global", category: "conquest", difficulty: "normal", stage: 2 };
const entry = (extras = {}) => ({
  k: call.k, bossKey: call.b, t: call.t, id: call.id,
  source: { field: "line", en: "The sourced exact supporting line" },
  text: Object.fromEntries(locales.map((locale) => [locale, `Reviewed instruction ${locale}`])),
  scope: { regions: ["global"], categories: ["conquest"], difficulties: ["normal"] },
  verification: "guide-exact", enabled: true, referenceOnly: false, ...extras,
});
const resolver = (e = entry()) => create({ entries: [e] });

test("exact tuple and matching explicit facts activate reviewed localized instruction", () => {
  const result = resolver().resolve(call, context);
  assert.equal(result.eligible, true); assert.equal(result.reason, "active");
  assert.equal(result.text.ko, "Reviewed instruction ko");
  assert.equal(result.scopeBadge.preview, false);
});

test("every tuple component must match exactly and IDs are not coerced", () => {
  for (const change of [{ k: "other" }, { b: "boss-b" }, { t: "use" }, { id: 124 }, { id: "123" }]) {
    assert.equal(resolver().resolve({ ...call, ...change }, context).eligible, false);
  }
});

test("a single entry is assumed for unknown region/category/difficulty, never for a mismatching one", () => {
  for (const key of ["region", "category", "difficulty"]) {
    for (const value of [undefined, null, "", "auto", "unknown", "NULL", "undefined"]) {
      const result = resolver().resolve(call, { ...context, [key]: value });
      assert.equal(result.reason, "active-assumed"); assert.equal(result.eligible, true);
      assert.equal(result.text.en, "Reviewed instruction en");
    }
    assert.equal(resolver().resolve(call, { ...context, [key]: "different" }).reason, "scope-mismatch");
  }
  assert.equal(resolver().resolve(call, { language: "en" }).reason, "active-assumed");
  assert.equal(resolver().resolve(call, null).reason, "active-assumed");
  assert.equal(resolver().resolve(call, { category: "auto", difficulty: "hard" }).reason, "scope-mismatch");
});

test("unknown region with several regional entries uses them only when every text is the same", () => {
  const same = ["korea", "global"].map((region) => entry({ scope: { regions: [region], categories: ["nightmare"], stages: region === "korea" ? [7] : [2] } }));
  const r = create({ entries: same });
  for (const region of [undefined, null, "auto", "unknown"]) {
    const result = r.resolve(call, { region, category: "nightmare" });
    assert.equal(result.eligible, true); assert.equal(result.reason, "active-assumed");
    assert.equal(result.text.en, "Reviewed instruction en");
  }
  assert.equal(r.resolve(call, { category: "nightmare", stage: 2 }).eligible, true);
  assert.equal(r.resolve(call, { category: "nightmare", stage: 9 }).reason, "scope-mismatch");
  assert.equal(r.resolve(call, { category: "trial" }).reason, "scope-mismatch");
  assert.equal(r.resolve(call, {}, { preview: true }).reason, "preview-region-needed");
  assert.equal(r.resolve(call, { category: "nightmare" }, { uncertain: true }).eligible, false);
  const different = create({ entries: regionalVariants() });
  for (const facts of [{}, { category: "nightmare" }, { category: "nightmare", stage: 2 }]) {
    const result = different.resolve(call, facts);
    assert.equal(result.eligible, false); assert.equal(result.reason, "unknown-context"); assert.equal(result.text, null);
  }
});

test("only literal game-explicit entries may claim universal scope", () => {
  const universal = { universal: true, regions: [], categories: [], difficulties: [], stages: [] };
  assert.equal(resolver(entry({ verification: "game-explicit", scope: universal })).resolve(call, {}).eligible, true);
  assert.equal(resolver(entry({ scope: universal })).resolve(call, context).reason, "unresolved-scope");
  assert.equal(resolver(entry({ verification: "game-explicit", source: { field: "act", en: "Curated action" }, scope: universal })).resolve(call, {}, { preview: true }).eligible, false);
  assert.equal(resolver(entry({ verification: "game-explicit", scope: { ...universal, regions: ["global"] } })).resolve(call, context).reason, "conflicting-universal-scope");
});

test("guide entries need complete region/category and category-specific scope", () => {
  for (const scope of [{}, { regions: ["global"] }, { categories: ["conquest"] }]) {
    assert.equal(resolver(entry({ scope })).resolve(call, context, { preview: true }).eligible, false);
  }
  for (const category of ["conquest", "sanctuary"]) {
    const e = entry({ scope: { regions: ["global"], categories: [category] } });
    assert.equal(resolver(e).resolve(call, { ...context, category }, { preview: true }).reason, "unresolved-difficulty");
  }
  for (const category of ["transcendence", "trial", "nightmare"]) {
    const e = entry({ scope: { regions: ["global"], categories: [category] } });
    assert.equal(resolver(e).resolve(call, { ...context, category }, { preview: true }).reason, "unresolved-stage");
  }
});

test("stage scopes require explicit matching stages and never derive them from difficulty", () => {
  const r = resolver(entry({ scope: { regions: ["global"], categories: ["nightmare"], stages: [2, 3] } }));
  assert.equal(r.resolve(call, { ...context, category: "nightmare", stage: 2 }).eligible, true);
  assert.equal(r.resolve(call, { ...context, category: "nightmare", stage: "2" }).eligible, true);
  assert.equal(r.resolve(call, { ...context, category: "nightmare", stage: null, difficulty: "Stage2" }).reason, "active-assumed");
  assert.equal(r.resolve(call, { ...context, category: "nightmare", stage: 4 }).reason, "scope-mismatch");
});

test("combined categories preserve every required difficulty and stage dimension", () => {
  const scope = { regions: ["global"], categories: ["conquest", "nightmare"], difficulties: ["normal"], stages: [2] };
  const r = resolver(entry({ scope }));
  assert.equal(r.resolve(call, context).eligible, true);
  assert.equal(r.resolve(call, { ...context, stage: null }).reason, "active-assumed");
  assert.equal(r.resolve(call, { ...context, category: "nightmare", difficulty: null }).reason, "active-assumed");
  assert.equal(r.resolve(call, { ...context, stage: 5 }).reason, "scope-mismatch");
});

test("live uncertain/shared triggers remain neutral while explicit preview demonstrates the chosen scope", () => {
  const r = resolver();
  assert.equal(r.resolve(call, context, { uncertain: true }).reason, "uncertain-trigger");
  assert.equal(r.resolve({ ...call, uncertain: true }, context).eligible, false);
  assert.equal(r.resolve({ ...call, uncertain: "true" }, context).eligible, false);
  const shared = create({ entries: [entry(), entry({ k: "b", bossKey: "boss-b" })] });
  assert.equal(shared.resolve(call, context).reason, "shared-trigger");
  assert.equal(shared.resolve(call, { region: "global" }, { preview: true }).eligible, true);
  assert.equal(shared.resolve(call, { region: "global" }, { preview: true }).scopeBadge.preview, true);
});

test("regional preview requires matching region before bypassing category/mode/stage", () => {
  const r = resolver();
  assert.equal(r.resolve(call, {}, { preview: true }).reason, "preview-region-needed");
  assert.equal(r.resolve(call, { region: "korea" }, { preview: true }).reason, "scope-mismatch");
  assert.equal(r.resolve(call, { region: "global", category: "nightmare", difficulty: "other", stage: 99 }, { preview: true }).eligible, true);
  for (const extras of [{ enabled: false }, { enabled: "true" }, { referenceOnly: true }, { verification: "unresolved" }, { scope: {} }]) {
    assert.equal(resolver(entry(extras)).resolve(call, context, { preview: true }).eligible, false);
  }
});

test("historical/version flags and referenceOnly cannot be bypassed by preview", () => {
  for (const flag of ["historicalRemovedMode", "requiresExplicitHistoricalContext", "requiresVersionContext"]) {
    const e = entry(); e.scope.flags = { [flag]: true };
    assert.equal(resolver(e).resolve(call, context, { preview: true }).reason, "historical-or-version-context");
  }
  assert.equal(resolver(entry({ referenceOnly: true })).resolve(call, context, { preview: true }).reason, "reference-only");
});

test("unknown scope keys and malformed flag shapes fail closed", () => {
  for (const flags of [null, [], "historical", { addedFlag: false }, { requiresVersionContext: "false" }, { historicalRemovedMode: null }]) {
    const e = entry(); e.scope.flags = flags;
    assert.equal(resolver(e).resolve(call, context, { preview: true }).reason, "invalid-scope-flags");
  }
  const e = entry(); e.scope.patch = "2026-11";
  assert.equal(resolver(e).resolve(call, context, { preview: true }).reason, "invalid-scope");
  const allowed = entry(); allowed.scope.flags = { requiresVersionContext: false };
  assert.equal(resolver(allowed).resolve(call, context).eligible, true);
});

test("malformed restrictions, missing translations/source and duplicate tuples fail closed", () => {
  for (const scope of [{ regions: "global" }, { regions: ["unknown"] }, { universal: "true" }, { stages: [0] }, { universal: true, regions: null }]) {
    assert.equal(resolver(entry({ scope })).resolve(call, context, { preview: true }).eligible, false);
  }
  for (const extras of [{ source: {} }, { source: { field: " act ", en: "Curated" } }, { text: { en: "Only English" } }, { text: { ...entry().text, ko: " " } }, { referenceOnly: undefined }]) {
    assert.equal(resolver(entry(extras)).resolve(call, context, { preview: true }).eligible, false);
  }
  assert.equal(create({ entries: [entry(), entry()] }).resolve(call, context).reason, "duplicate-entry");
  assert.equal(create({ entries: null }).resolve(call, context).reason, "invalid-data");
});

test("describe reports the same eligibility and scope without altering input or future results", () => {
  const e = entry(), r = resolver(e);
  const description = r.describe(call, context);
  assert.equal(description.eligible, true); assert.equal(description.scopeBadge.categories[0], "conquest");
  description.entry.enabled = false; description.text.en = "Changed";
  description.scopeBadge.categories[0] = "changed"; e.enabled = false;
  assert.equal(r.resolve(call, context).eligible, true);
  assert.equal(r.resolve(call, context).text.en, "Reviewed instruction en");
});

function regionalVariants() {
  return [
    entry({ scope: { regions: ["korea"], categories: ["nightmare"], stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      text: Object.fromEntries(locales.map((locale) => [locale, `Korea instruction ${locale}`])) }),
    entry({ scope: { regions: ["global"], categories: ["nightmare"], stages: [1, 2, 3, 4] },
      text: Object.fromEntries(locales.map((locale) => [locale, `Global instruction ${locale}`])) }),
  ];
}

test("disjoint explicit regional variants choose their own text and stage scope", () => {
  const r = create({ entries: regionalVariants() });
  const facts = { category: "nightmare", stage: 4 };
  const global = r.resolve(call, { ...facts, region: "global" });
  assert.equal(global.eligible, true); assert.equal(global.text.en, "Global instruction en");
  assert.deepEqual(Array.from(global.scopeBadge.stages), ["1", "2", "3", "4"]);
  const korea = r.resolve(call, { ...facts, region: "korea", stage: 8 });
  assert.equal(korea.eligible, true); assert.equal(korea.text.en, "Korea instruction en");
  assert.equal(r.resolve(call, { ...facts, region: "global", stage: 8 }).reason, "scope-mismatch");
  const assumed = r.resolve(call, { ...facts, region: "korea", stage: null });
  assert.equal(assumed.reason, "active-assumed"); assert.equal(assumed.text.en, "Korea instruction en");
});

test("regional preview requires region first and then demonstrates only that selected scope", () => {
  const r = create({ entries: regionalVariants() });
  for (const region of [undefined, null, "auto", "unknown", ""]) {
    const result = r.resolve(call, { region }, { preview: true });
    assert.equal(result.eligible, false); assert.equal(result.reason, "preview-region-needed");
  }
  const global = r.resolve(call, { region: "global", category: "conquest", stage: 10 }, { preview: true });
  assert.equal(global.eligible, true); assert.equal(global.text.en, "Global instruction en");
  assert.equal(global.scopeBadge.preview, true);
  assert.equal(r.resolve(call, { region: "taiwan" }, { preview: true }).reason, "scope-mismatch");
  assert.equal(r.resolve(call, {}).reason, "unknown-context");
});

test("regional overlap rejects the whole tuple even when other scopes or text differ", () => {
  for (const regions of [["global"], [" GLOBAL "], ["korea", "global"]]) {
    const variants = regionalVariants(); variants[0].scope.regions = regions;
    const r = create({ entries: variants });
    assert.equal(r.resolve(call, context).reason, "duplicate-entry");
    assert.equal(r.resolve(call, { region: "global" }, { preview: true }).reason, "duplicate-entry");
  }
  const sameRegionDifferentMode = [entry(), entry({ scope: { regions: ["global"], categories: ["trial"], stages: [2] } })];
  assert.equal(create({ entries: sameRegionDifferentMode }).resolve(call, context).reason, "duplicate-entry");
});

test("multiple entries reject universal, absent, unknown, malformed or repeated region scopes", () => {
  for (const scope of [{ universal: true }, { regions: [] }, { regions: null }, { regions: ["unknown"] },
    { regions: ["korea", "KOREA"] }, { regions: [1] }, { universal: "false", regions: ["korea"] }]) {
    const variants = regionalVariants(); variants[0].scope = scope;
    const r = create({ entries: variants });
    assert.equal(r.resolve(call, { region: "global" }, { preview: true }).reason, "duplicate-entry");
  }
});

test("regional selection never falls back to another region when selected entry is unavailable", () => {
  for (const extras of [{ enabled: false }, { referenceOnly: true }, { verification: "unresolved" },
    { scope: { regions: ["global"], categories: ["nightmare"], stages: [1], flags: { requiresVersionContext: true } } }]) {
    const variants = regionalVariants(); Object.assign(variants[1], extras);
    const r = create({ entries: variants });
    assert.equal(r.resolve(call, { region: "global" }, { preview: true }).eligible, false);
    assert.equal(r.resolve(call, { region: "korea" }, { preview: true }).text.en, "Korea instruction en");
  }
});

test("regional variants retain the existing live uncertain/shared trigger protection", () => {
  const variants = regionalVariants();
  let r = create({ entries: variants });
  const facts = { region: "global", category: "nightmare", stage: 1 };
  assert.equal(r.resolve(call, facts, { uncertain: true }).reason, "uncertain-trigger");
  r = create({ entries: [...variants, entry({ k: "other", bossKey: "boss-b" })] });
  assert.equal(r.resolve(call, facts).reason, "shared-trigger");
});

test("regional literal game instructions require known region without inventing category or mode", () => {
  for (const field of ["line", "n"]) {
    const r = resolver(entry({ verification: "game-explicit", source: { field, en: "Literal instruction" },
      scope: { universal: false, regions: ["KR"], categories: [], difficulties: [], stages: [] } }));
    assert.equal(r.resolve(call, {}).reason, "active-assumed");
    assert.equal(r.resolve(call, { region: "auto" }).reason, "active-assumed");
    const result = r.resolve(call, { region: "KR" });
    assert.equal(result.eligible, true);
    assert.equal(result.scopeBadge.categories.length, 0);
    assert.equal(r.resolve(call, { region: "Global" }).reason, "scope-mismatch");
  }
});

test("Global regional literals retain every known explicit category/difficulty/stage constraint", () => {
  const e = entry({ verification: "game-explicit", scope: { universal: false, regions: ["Global"],
    categories: ["conquest"], difficulties: ["hard"], stages: [2] } });
  const r = resolver(e);
  assert.equal(r.resolve(call, { region: "Global" }).reason, "active-assumed");
  assert.equal(r.resolve(call, { region: "Global", category: "conquest", difficulty: "normal", stage: 2 }).reason, "scope-mismatch");
  assert.equal(r.resolve(call, { region: "Global", category: "conquest", difficulty: "hard", stage: 2 }).eligible, true);
  assert.equal(r.resolve(call, { region: "Global", category: "conquest", difficulty: "hard", stage: 3 }).eligible, false);
  e.scope.categories = []; e.scope.stages = [];
  assert.equal(resolver(e).resolve(call, { region: "Global", difficulty: "hard" }).eligible, true);
});

test("guide and nonliteral entries do not gain the regional literal exemption", () => {
  const scope = { universal: false, regions: ["Global"], categories: [], difficulties: [], stages: [] };
  assert.equal(resolver(entry({ scope })).resolve(call, { region: "Global" }).reason, "unresolved-scope");
  for (const field of ["act", "other"]) {
    const e = entry({ verification: "game-explicit", source: { field, en: "Not a literal supported field" }, scope });
    assert.equal(resolver(e).resolve(call, { region: "Global" }, { preview: true }).eligible, false);
    e.scope = { universal: true };
    assert.equal(resolver(e).resolve(call, {}, { preview: true }).eligible, false);
  }
});

test("KR/Global literal counterparts with disjoint regions select only their reviewed instruction", () => {
  const variants = ["KR", "Global"].map((region) => entry({ verification: "game-explicit",
    scope: { universal: false, regions: [region], categories: [], difficulties: [], stages: [] },
    text: Object.fromEntries(locales.map((locale) => [locale, `${region} literal ${locale}`])) }));
  const r = create({ entries: variants });
  assert.equal(r.resolve(call, { region: "KR" }).text.en, "KR literal en");
  assert.equal(r.resolve(call, { region: "Global" }).text.en, "Global literal en");
  assert.equal(r.resolve(call, {}, { preview: true }).reason, "preview-region-needed");
});

test("a single KR literal preview cannot activate under Global or an unknown region", () => {
  const r = resolver(entry({ verification: "game-explicit", scope: { universal: false, regions: ["KR"], categories: [], difficulties: [], stages: [] } }));
  for (const region of [null, undefined, "auto", "unknown"]) {
    assert.equal(r.resolve(call, { region }, { preview: true }).reason, "preview-region-needed");
  }
  assert.equal(r.resolve(call, { region: "Global" }, { preview: true }).reason, "scope-mismatch");
  assert.equal(r.resolve(call, { region: "KR" }, { preview: true }).eligible, true);
});
