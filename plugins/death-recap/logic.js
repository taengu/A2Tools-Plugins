// The history's rules, without the page: what is kept of a recap, and the
// tallies. Loaded by the page, and by node for the tests.
(() => {
  // Deaths kept, the oldest dropped first.
  const MAX_DEATHS = 2000;
  // Skills kept per death.
  const MAX_SKILLS = 5;
  // Assists kept per death.
  const MAX_ASSISTS = 10;

  // What is kept of the meter's recap (a2.on("deathRecap")).
  const entryOf = (r) => ({
    at: r.at,
    name: r.killer?.name || "?",
    serverId: r.killer?.serverId ?? null,
    legion: r.killer?.legion || null,
    class: r.killer?.class || null,
    level: r.killer?.level ?? null,
    gs: r.killer?.gearScore ?? null,
    cp: r.killer?.combatPower ?? null,
    rank: r.killer?.abyssGrade ?? null,
    damage: r.damage || 0,
    hits: r.hits || 0,
    durationMs: r.durationMs ?? null,
    dps: r.dps ?? null,
    skills: (r.skills || []).slice(0, MAX_SKILLS).map((s) => ({ id: s.id, name: s.name || null, damage: s.damage, hits: s.hits })),
    assists: (r.assists || []).slice(0, MAX_ASSISTS).map((a) => ({
      name: a.name || null, legion: a.legion || null, serverId: a.serverId ?? null, class: a.class || null, level: a.level ?? null, gs: a.gearScore ?? null, cp: a.combatPower ?? null, rank: a.abyssGrade ?? null, damage: a.damage || 0, hits: a.hits || 0,
    })),
  });

  // The history with a recap added, newest first: unless it is one already
  // there (a window opened again may be told it again).
  const add = (history, recap) => {
    const e = entryOf(recap);
    if (history.some((h) => h.at === e.at && h.name === e.name)) return history;
    return [e, ...history].sort((a, b) => b.at - a.at).slice(0, MAX_DEATHS);
  };

  // A player is a name on a server: two servers may each have one.
  const playerKey = (h) => `${h.name}@${h.serverId ?? ""}`;

  // Deaths grouped by `by` ("player", "legion", "server"), the most first:
  // [{ key, count, last, sample }], `sample` the group's newest death.
  const tally = (history, by) => {
    const keyOf = by === "player" ? playerKey : by === "legion" ? (h) => (h.legion ? `${h.legion}@${h.serverId ?? ""}` : "") : (h) => String(h.serverId ?? "");
    const groups = new Map();
    for (const h of history) {
      const key = keyOf(h);
      const g = groups.get(key);
      if (g) {
        g.count += 1;
        if (h.at > g.last) {
          g.last = h.at;
          g.sample = h;
        }
      } else {
        groups.set(key, { key, count: 1, last: h.at, sample: h });
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.last - a.last);
  };

  // How many times this death's killer has killed you, this one included.
  const timesBy = (history, entry) => history.filter((h) => playerKey(h) === playerKey(entry)).length;

  // Combat power in thousands to two places ("170.74k"), or millions.
  const cpText = (n, lang) => {
    if (typeof n !== "number") return "–";
    const two = (v) => v.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1_000_000) return `${two(n / 1_000_000)}M`;
    if (n >= 1_000) return `${two(n / 1_000)}k`;
    return String(n);
  };

  const api = { entryOf, add, tally, timesBy, cpText, MAX_DEATHS };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.RecapLogic = api;
})();
