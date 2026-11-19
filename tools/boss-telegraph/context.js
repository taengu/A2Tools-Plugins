// Passive numeric context from reviewed declarative decoders. No game reads,
// identity inference, HP percentage, or difficulty inferred from a suffix.
// Inject the exact official src/data/i18n/dungeons/en.json dictionary. Only a
// known map ID selects that entry; roster IDs are merely queued information.
// The boss-map decoder supplies the numeric map ID; the exact dictionary
// and its recorded provenance are included in tools/boss-telegraph/mechanics.json.
(function (root) {
  const u32 = (n) => Number.isInteger(n) && n >= 0 && n <= 0xFFFFFFFF;
  const entityId = (n) => Number.isInteger(n) && n >= 100 && n <= 9_999_999;

  function create({ now = Date.now, dungeons = {}, maxAgeMs = 3000 } = {}) {
    if (typeof now !== "function" || !Number.isFinite(maxAgeMs) || maxAgeMs < 0
        || !dungeons || typeof dungeons !== "object" || Array.isArray(dungeons)) {
      throw new TypeError("A clock, exact dungeon dictionary and freshness limit are required");
    }
    // Copy only the actual source fields; unknown difficulty stays unknown.
    const metadata = new Map();
    for (const [key, entry] of Object.entries(dungeons)) {
      const id = Number(key);
      if (!u32(id) || id === 0 || String(id) !== key || !entry
          || typeof entry.name !== "string" || !entry.name.trim()) continue;
      metadata.set(id, {
        name: entry.name,
        difficulty: typeof entry.difficulty === "string" && entry.difficulty.trim() ? entry.difficulty : null,
      });
    }

    let generation = 0, resetAt = -Infinity;
    let map = null, queuedRoster = null;
    let characterKey = null, running = null;
    let characterAt = -Infinity, gameAt = -Infinity;
    const health = new Map();
    const validAt = (at) => {
      const time = now();
      return Number.isFinite(time) && Number.isFinite(at) && at > resetAt
        && at <= time && time - at <= maxAgeMs;
    };
    const copy = (value) => value == null ? null : { ...value };
    function clear(at) {
      generation += 1;
      resetAt = Math.max(resetAt, at);
      map = queuedRoster = null;
      health.clear();
      return generation;
    }

    function mapLoad(data, at) {
      if (running === false || !validAt(at) || !data || !u32(data.count)
          || !u32(data.map) || (map && at <= map.at)) return false;
      // A teleport to the same dungeon is a new map load too. This invalidates
      // every entity-scoped observation, not the metadata for that map.
      clear(at);
      const entry = metadata.get(data.map);
      map = {
        mapId: data.map, count: data.count, at, generation, source: "map-load",
        dungeonId: entry ? data.map : null,
        name: entry ? entry.name : null,
        difficulty: entry ? entry.difficulty : null,
      };
      return true;
    }

    function roster(data, at) {
      if (running === false || !validAt(at) || !data || !u32(data.partyKey) || !u32(data.dungeonId)
          || !Number.isInteger(data.partySize) || data.partySize < 1 || data.partySize > 12
          || !Number.isInteger(data.memberCount) || data.memberCount < 1 || data.memberCount > 12
          || !Array.isArray(data.omittedPartyName) || data.omittedPartyName.length < 1
          || data.omittedPartyName.length > 40
          || !data.omittedPartyName.every((part) => part && typeof part === "object"
            && !Array.isArray(part) && Object.keys(part).length === 0)
          || (queuedRoster && at <= queuedRoster.at)) return false;
      // This can name a queued dungeon, a former dungeon or another party.
      // Never use it to establish current location or overwrite the map.
      queuedRoster = { dungeonId: data.dungeonId, at, generation, source: "unverified-party-roster" };
      return true;
    }

    function hpUpdate(data, at) {
      if (running === false || !validAt(at) || !data || !entityId(data.entity) || data.disc0 !== 2
          || data.disc1 !== 1 || data.disc2 !== 0 || data.zero !== 0
          || !u32(data.currentHp) || data.currentHp > 100_000_000
          || (health.has(data.entity) && at <= health.get(data.entity).at)) return false;
      // Native accepts >100 million only against a confirmed spawn maximum.
      // We have no such maximum; never turn an observed peak into one.
      health.set(data.entity, {
        entity: data.entity, currentHp: data.currentHp, at, generation,
        source: "standalone-hp-prefix",
      });
      // Bound memory for a long session even when no map loads are observed.
      if (health.size > 512) {
        const time = now();
        for (const [id, value] of health) if (time - value.at > maxAgeMs) health.delete(id);
        while (health.size > 512) health.delete(health.keys().next().value);
      }
      return true;
    }

    function character(key, at) {
      if (!validAt(at) || at <= characterAt
          || (key !== null && (typeof key !== "string" || !key.trim()))) return false;
      characterAt = at;
      if (key !== characterKey) {
        characterKey = key;
        clear(at);
      }
      return true;
    }

    function game(value, at) {
      if (!validAt(at) || at <= gameAt || typeof value !== "boolean") return false;
      gameAt = at;
      if (value !== running) {
        running = value;
        // Reopen is a new lifecycle too, even if an exit event was missed.
        clear(at);
      }
      return true;
    }

    function hp(entity) {
      const value = health.get(entity);
      const time = now();
      if (!value || !Number.isFinite(time) || value.at > time || time - value.at > maxAgeMs) return null;
      return copy(value);
    }

    return {
      mapLoad, roster, hpUpdate, character, game, hp,
      reset() {
        const time = now();
        if (!Number.isFinite(time)) throw new TypeError("The clock must return a finite timestamp");
        return clear(time);
      },
      snapshot: () => ({ generation, map: copy(map), queuedRoster: copy(queuedRoster) }),
    };
  }

  root.BossContext = { create };
})(typeof window !== "undefined" ? window : globalThis);
