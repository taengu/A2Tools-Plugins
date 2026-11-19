// Track map loads using the exact dungeon metadata shipped by the generator.
(function (root) {
  const u32 = (n) => Number.isInteger(n) && n >= 0 && n <= 0xFFFFFFFF;

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
    let map = null;
    const validAt = (at) => {
      const time = now();
      return Number.isFinite(time) && Number.isFinite(at) && at > resetAt
        && at <= time && time - at <= maxAgeMs;
    };
    const copy = (value) => value == null ? null : { ...value };
    function clear(at) {
      generation += 1;
      resetAt = Math.max(resetAt, at);
      map = null;
      return generation;
    }

    function mapLoad(data, at) {
      if (!validAt(at) || !data || !u32(data.count)
          || !u32(data.map) || (map && at <= map.at)) return false;
      // A teleport to the same dungeon also starts a new encounter.
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

    return {
      mapLoad,
      reset() {
        const time = now();
        if (!Number.isFinite(time)) throw new TypeError("The clock must return a finite timestamp");
        return clear(time);
      },
      snapshot: () => ({ generation, map: copy(map) }),
    };
  }

  root.BossContext = { create };
})(typeof window !== "undefined" ? window : globalThis);
