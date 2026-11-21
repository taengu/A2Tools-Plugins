// Resolve reviewed mechanic candidates without inventing encounter context.
// This helper does not learn identity from skills or observe the game itself.
//
// resolve({ event, candidates, context, coverageComplete }) accepts:
//   event: { kind, id, entity, at, generation? }
//   candidate: { id, trigger: { kind, id }, applicability?, action?, conditional? }
//   applicability: { region?, difficulty?, tierLabel?, stage?, phase?, dungeonId? }
//     Each restriction is an array; absent/null means unknown, not universal.
//   context: { region?: { value, source: "manual"|"observed" }, ...,
//              evidence?: { [key]: { value, source: "observed", entity, at,
//                                    generation, localPlayer?: true } } }
//   action: { key, audience, timing, verified: true, covers: [candidate.id],
//             requiresEvidence?: [{ key, value, scope: "entity"|"self" }] }
//   conditional: the same action fields, plus mode: "player-observed" and
//                conditions: [reviewed observable-condition keys]. Its key
//                names the complete if/then instruction, never one branch.
//
// coverageComplete is the caller's assertion that EVERY plausible profile for
// this trigger is represented, including profiles with no reviewed action.
// All remaining candidates must agree on key, audience and timing. Reuse an
// action key only for reviewed equivalent semantics. `verified` and `covers`
// assert a reviewed trigger-to-action mapping, not just a guide for this boss.
// Source references remain in the caller's data; this helper creates none.
// Observed dungeonId/difficulty facts may specify basis:"map-load": these
// persist within their generation, retaining their actual observation at.
// The caller must reset this resolver whenever passive context generation
// changes and pass the same generation on both map facts and observations.
(function (root) {
  const DIMENSIONS = ["region", "difficulty", "tierLabel", "stage", "phase", "dungeonId"];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
  const scalar = (value) => nonempty(value) || (typeof value === "number" && Number.isFinite(value));
  const positive = (value) => Number.isSafeInteger(value) && value > 0;

  function create({ now = Date.now, maxAgeMs = 3000 } = {}) {
    if (typeof now !== "function" || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
      throw new TypeError("A clock and a nonnegative freshness limit are required");
    }
    let generation = 0;
    let resetAt = -Infinity;

    function current(at, time) {
      return Number.isFinite(at) && at > resetAt && at <= time && time - at <= maxAgeMs;
    }

    function resolve({ event, candidates = [], context = {}, coverageComplete = false } = {}) {
      const time = now();
      const result = (kind, reason, plausible = [], action = null) => ({
        kind, reason, generation,
        candidateIds: plausible.map((candidate) => candidate.id),
        actionKey: action ? action.key : null,
        audience: action ? action.audience : null,
        timing: action ? action.timing : null,
        conditions: kind === "conditional" ? [...action.conditions] : [],
      });
      if (!event || !["cast", "use", "abnormal", "mark", "sequence"].includes(event.kind)
          || !positive(event.id) || !positive(event.entity) || !Number.isFinite(time)) {
        return result("ignored", "invalid-event");
      }
      if (!current(event.at, time) || (own(event, "generation") && event.generation !== generation)) {
        return result("ignored", "stale-or-reset-event");
      }
      if (!Array.isArray(candidates) || !context || typeof context !== "object") {
        return result("neutral", "invalid-context");
      }
      const matching = candidates.filter((candidate) => candidate && candidate.trigger
        && candidate.trigger.kind === event.kind && candidate.trigger.id === event.id);
      if (!matching.length) return result("ignored", "no-trigger-candidates");

      const ids = new Set();
      for (const candidate of matching) {
        if (!nonempty(candidate.id) || ids.has(candidate.id)) {
          return result("neutral", "invalid-candidate-set", matching);
        }
        ids.add(candidate.id);
        const applicability = candidate.applicability;
        if (applicability != null && (typeof applicability !== "object" || Array.isArray(applicability))) {
          return result("neutral", "invalid-applicability", matching);
        }
        // A misspelled scope must not silently broaden the supported scope.
        if (applicability && Object.keys(applicability).some((key) => !DIMENSIONS.includes(key))) {
          return result("neutral", "invalid-applicability", matching);
        }
        for (const key of DIMENSIONS) {
          const restriction = applicability?.[key];
          if (restriction != null && (!Array.isArray(restriction) || !restriction.length || !restriction.every(scalar))) {
            return result("neutral", "invalid-applicability", matching);
          }
        }
      }

      const plausible = matching.filter((candidate) => DIMENSIONS.every((key) => {
        const restriction = candidate.applicability?.[key];
        const fact = context[key];
        // Unknown context is retained. Locale, HP, elapsed time and suffixes
        // are never inspected or converted to a difficulty/phase/region.
        if (restriction == null || !fact || !scalar(fact.value)
            || !["manual", "observed"].includes(fact.source)) return true;
        // Map location is structural state until its lifecycle ends; HP and
        // transient observations expire. Preserve the map's original time.
        if (fact.source === "observed") {
          const persistentMap = fact.basis === "map-load" && ["dungeonId", "difficulty"].includes(key);
          if (fact.generation !== generation || !Number.isFinite(fact.at) || fact.at > event.at
              || (!persistentMap && !current(fact.at, time))
              || (key === "phase" && fact.entity !== event.entity)) return true;
        }
        return restriction.includes(fact.value);
      }));
      if (!plausible.length) return result("ignored", "no-applicable-candidates");
      if (coverageComplete !== true) return result("neutral", "incomplete-candidate-coverage", plausible);

      function evidenceMatches(requirement) {
        if (!requirement || !nonempty(requirement.key) || !own(requirement, "value")
            || !["entity", "self"].includes(requirement.scope)) return false;
        const fact = context.evidence?.[requirement.key];
        if (!fact || fact.source !== "observed" || fact.generation !== generation
            || !current(fact.at, time) || fact.at > event.at || fact.value !== requirement.value) return false;
        if (!positive(fact.entity)) return false;
        if (requirement.scope === "self") return fact.localPlayer === true;
        return fact.entity === event.entity;
      }

      function common(field) {
        let selected = null;
        let signature = null;
        for (const candidate of plausible) {
          const action = candidate[field];
          if (!action || action.verified !== true || !nonempty(action.key)
              || !nonempty(action.audience) || !nonempty(action.timing)
              || !Array.isArray(action.covers) || !action.covers.includes(candidate.id)) return null;
          if (action.requiresEvidence != null && (!Array.isArray(action.requiresEvidence)
              || !action.requiresEvidence.every(evidenceMatches))) return null;
          if (field === "conditional" && (action.mode !== "player-observed"
              || !Array.isArray(action.conditions) || !action.conditions.length
              || !action.conditions.every(nonempty))) return null;
          const next = JSON.stringify([action.key, action.audience, action.timing,
            field === "conditional" ? [...new Set(action.conditions)].sort() : []]);
          if (signature != null && signature !== next) return null;
          signature = next;
          selected = action;
        }
        return selected;
      }

      const action = common("action");
      if (action) return result("specific", "verified-actions-agree", plausible, action);
      const conditional = common("conditional");
      if (conditional) return result("conditional", "player-observation-required", plausible, conditional);
      return result("neutral", "unresolved-action", plausible);
    }

    return {
      resolve,
      reset() {
        const time = now();
        if (!Number.isFinite(time)) throw new TypeError("The clock must return a finite timestamp");
        generation += 1;
        resetAt = Math.max(resetAt, time);
        return generation;
      },
      generation: () => generation,
    };
  }

  root.BossDetection = { create };
})(typeof window !== "undefined" ? window : globalThis);
