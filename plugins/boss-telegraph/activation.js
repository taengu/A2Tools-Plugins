// Activate reviewed instructions only for their exact trigger and scope.
// This module reads explicit context; it detects no region, stage or role.
(function (root) {
  const LOCALES = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"];
  const SCOPE_KEYS = ["universal", "regions", "categories", "difficulties", "stages", "flags"];
  const FLAGS = ["historicalRemovedMode", "requiresExplicitHistoricalContext", "requiresVersionContext"];
  const DIMENSIONS = { regions: "region", categories: "category", difficulties: "difficulty", stages: "stage" };
  const DIFFICULTY_CATEGORIES = ["conquest", "sanctuary"];
  const STAGE_CATEGORIES = ["transcendence", "trial", "nightmare"];
  const object = (value) => value != null && typeof value === "object" && !Array.isArray(value);
  const string = (value) => typeof value === "string" && value.trim().length > 0;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const normalized = (value) => {
    if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    if (!string(value)) return null;
    const text = value.trim().toLowerCase();
    return ["auto", "unknown", "null", "undefined"].includes(text) ? null : text;
  };
  const tuple = (call) => object(call) && string(call.k) && string(call.b)
    && ["cast", "use", "abnormal"].includes(call.t) && Number.isSafeInteger(call.id) && call.id > 0
    ? JSON.stringify([call.k, call.b, call.t, call.id]) : null;

  function create(data) {
    let entries = [];
    let validData = object(data) && Array.isArray(data.entries);
    try { if (validData) entries = copy(data.entries); } catch (_) { validData = false; }
    const indexed = new Map(), triggerBosses = new Map(), triggerTexts = new Map();
    for (const entry of entries) {
      if (!object(entry)) continue;
      const key = tuple({ k: entry.k, b: entry.bossKey, t: entry.t, id: entry.id });
      if (!key) continue;
      if (!indexed.has(key)) indexed.set(key, []);
      indexed.get(key).push(entry);
      const trigger = `${entry.t}:${entry.id}`;
      if (!triggerBosses.has(trigger)) triggerBosses.set(trigger, new Set());
      triggerBosses.get(trigger).add(entry.bossKey);
      if (!triggerTexts.has(trigger)) triggerTexts.set(trigger, new Set());
      triggerTexts.get(trigger).add(JSON.stringify(entry.text));
    }

    function resolve(call, context = {}, { preview = false, uncertain = false } = {}) {
      let entry = null, scopeBadge = null;
      const result = (reason, eligible = false) => ({
        text: eligible ? copy(entry.text) : null,
        entry: entry ? copy(entry) : null,
        reason, eligible, scopeBadge: scopeBadge ? copy(scopeBadge) : null,
      });
      if (!validData) return result("invalid-data");
      const key = tuple(call);
      if (!key) return result("invalid-call");
      const matches = indexed.get(key) || [];
      if (!matches.length) return result("not-found");
      if (matches.length > 1) {
        // The only permitted duplicate tuple is a set of explicit, disjoint
        // regional variants. Never choose one by array order, text agreement,
        // difficulty or stage; regional selection happens before preview.
        const regions = new Map();
        for (const variant of matches) {
          const scope = variant.scope;
          if (!object(scope) || (own(scope, "universal") && scope.universal !== false)
              || !Array.isArray(scope.regions) || !scope.regions.length) return result("duplicate-entry");
          for (const raw of scope.regions) {
            const region = typeof raw === "string" ? normalized(raw) : null;
            if (region == null || regions.has(region)) return result("duplicate-entry");
            regions.set(region, variant);
          }
        }
        const region = object(context) && typeof context.region === "string" ? normalized(context.region) : null;
        if (region == null) {
          if (preview === true) return result("preview-region-needed");
          // Region unknown: one text for every region can still be given;
          // two different texts are never chosen between.
          const first = JSON.stringify(matches[0].text);
          if (matches.some((variant) => JSON.stringify(variant.text) !== first)) return result("unknown-context");
          let tried = result("unknown-context");
          for (const known of regions.keys()) {
            tried = resolve(call, { ...(object(context) ? context : {}), region: known }, { preview, uncertain });
            if (tried.eligible) return { ...tried, reason: "active-assumed" };
          }
          return tried;
        }
        entry = regions.get(region) || null;
        if (!entry) return result("scope-mismatch");
      } else {
        entry = matches[0];
      }
      if (entry.enabled !== true) return result("disabled");
      if (entry.referenceOnly !== false) return result("reference-only");
      if (!["game-explicit", "guide-exact"].includes(entry.verification)
          || !object(entry.source) || !string(entry.source.field)
          || !/^[a-z][a-z0-9_]*$/.test(entry.source.field) || !string(entry.source.en)
          || !object(entry.text) || LOCALES.some((locale) => !string(entry.text[locale]))) return result("invalid-entry");
      const scope = entry.scope;
      if (!object(scope) || Object.keys(scope).some((name) => !SCOPE_KEYS.includes(name))
          || (own(scope, "universal") && typeof scope.universal !== "boolean")) return result("invalid-scope");
      if (own(scope, "flags")) {
        if (!object(scope.flags) || Object.keys(scope.flags).some((flag) => !FLAGS.includes(flag)
            || typeof scope.flags[flag] !== "boolean")) return result("invalid-scope-flags");
        if (FLAGS.some((flag) => scope.flags[flag] === true)) return result("historical-or-version-context");
      }
      const lists = {};
      for (const [plural, singular] of Object.entries(DIMENSIONS)) {
        const list = scope[plural];
        if (own(scope, plural) && (!Array.isArray(list) || list.some((value) =>
          (singular !== "stage" && typeof value !== "string") || normalized(value) == null))) return result("invalid-scope");
        lists[plural] = (list || []).map(normalized);
      }
      const universal = scope.universal === true;
      const literal = entry.verification === "game-explicit" && ["line", "n"].includes(entry.source.field);
      if (universal) {
        if (!literal) return result("unresolved-scope");
        // A universal exemption must never discard narrower provenance.
        if (Object.values(lists).some((list) => list.length)) return result("conflicting-universal-scope");
      } else {
        if (!lists.regions.length) return result("unresolved-scope");
        if (entry.verification === "game-explicit") {
          // A reviewed literal instruction needs its explicit region and any
          // supplied constraints, not a guessed mode or stage absent in source.
          if (!literal) return result("unresolved-scope");
        } else {
          if (!lists.categories.length) return result("unresolved-scope");
          if (lists.categories.some((category) => DIFFICULTY_CATEGORIES.includes(category))
              && !lists.difficulties.length) return result("unresolved-difficulty");
          if (lists.categories.some((category) => STAGE_CATEGORIES.includes(category))
              && !lists.stages.length) return result("unresolved-stage");
        }
      }
      scopeBadge = { universal, ...lists, preview: preview === true };
      // Preview can demonstrate another mode/stage only after the selected
      // region matches. A single regional entry is not a region exemption.
      if (preview === true) {
        if (!universal) {
          const region = object(context) && typeof context.region === "string" ? normalized(context.region) : null;
          if (region == null) return result("preview-region-needed");
          if (!lists.regions.includes(region)) return result("scope-mismatch");
        }
        return result("preview", true);
      }
      // A trigger several bosses share is told apart only when every boss's
      // entry for it says the same thing (Frenzy): then which boss it is
      // doesn't change the words.
      const uniform = (triggerTexts.get(`${call.t}:${call.id}`)?.size || 0) === 1;
      if (!uniform && (uncertain !== false || (own(call, "uncertain") && call.uncertain !== false))) return result("uncertain-trigger");
      if (!uniform && (triggerBosses.get(`${call.t}:${call.id}`)?.size || 0) > 1) return result("shared-trigger");
      // This entry is the trigger's only text for its region, so a dimension
      // the context doesn't know is assumed to match; a known one must match.
      const facts = object(context) ? context : {};
      let assumed = false;
      for (const [plural, singular] of Object.entries(DIMENSIONS)) {
        if (!lists[plural].length) continue;
        const value = singular !== "stage" && typeof facts[singular] !== "string"
          ? null : normalized(facts[singular]);
        if (value == null) { assumed = true; continue; }
        if (!lists[plural].includes(value)) return result("scope-mismatch");
      }
      return result(assumed ? "active-assumed" : "active", true);
    }

    return { resolve, describe: (call, context) => resolve(call, context) };
  }

  root.BossActivation = { create };
})(typeof window !== "undefined" ? window : globalThis);
