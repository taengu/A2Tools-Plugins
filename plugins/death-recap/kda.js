// PvP Tracker's counter (from Nullception's K/D/A Counter): what each event does to the counts, and the notes of each
// sound. No page code here, so it can be tried on its own.
globalThis.KdaLogic = (() => {
  // C5 D5 E5 G5 A5 C6: every step up sounds brighter and none sounds wrong.
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const MAX_STREAK = SCALE.length;
  const SPARKLE = [2093, 2637, 3136, 3951, 4186];
  const SEEN_MAX = 100;

  const fresh = () => ({ kills: 0, deaths: 0, assists: 0, streak: 0, best: 0, since: null, seen: [], abyssPoints: 0, inAbyss: false, week: null, limit: null, weekAt: null });

  // Count one event, once. False when it was counted before (the meter keeps
  // its events for a window opened later) or is not one of ours.
  function apply(state, event) {
    const kind = event?.kind;
    if (!["kill", "assist", "death", "points", "zone"].includes(kind)) return false;
    const key = `${event.at}:${event.seq ?? 0}:${kind}`;
    if (state.seen.includes(key)) return false;
    state.seen.push(key);
    if (state.seen.length > SEEN_MAX) state.seen.shift();
    // The Abyss: the points gained while in it, added up. The meter tells
    // when the Abyss is entered and left; points outside it don't count.
    if (kind === "zone") {
      state.inAbyss = event.abyss === true;
      return true;
    }
    if (kind === "points") {
      const amount = Number(event.amount);
      if (state.inAbyss && amount > 0) state.abyssPoints += amount;
      // The week's points so far and their cap (meter 2.0.98 on).
      if (Number(event.limit) > 0) {
        state.week = Number(event.week) || 0;
        state.limit = Number(event.limit);
        state.weekAt = Number(event.at) || Date.now();
      }
      return true;
    }
    state.since ??= Number(event.at) || Date.now();
    if (kind === "kill") {
      state.kills += 1;
      state.streak += 1;
      state.best = Math.max(state.best, state.streak);
    } else if (kind === "assist") {
      state.assists += 1;
      state.streak += 1;
      state.best = Math.max(state.best, state.streak);
    } else {
      state.deaths += 1;
      state.streak = 0;
    }
    return true;
  }

  // [frequency, start s, length s, wave, volume] for a sound. A kill climbs
  // the scale with the streak and stays on the top sound from the sixth.
  // An assist plays the streak's note, quieter.
  function notes(kind, streak) {
    if (kind === "assist") return notes("kill", streak).map(([f, s, l, w, v]) => [f, s, l, w, v * 0.6]);
    if (kind === "death") return [[220, 0, 0.25, "sawtooth", 0.14], [165, 0.18, 0.4, "sawtooth", 0.14]];
    const n = Math.min(Math.max(streak, 1), MAX_STREAK);
    if (n === MAX_STREAK) {
      const fanfare = [
        [523.25, 0, 0.12, "triangle", 0.3],
        [659.25, 0.09, 0.12, "triangle", 0.3],
        [783.99, 0.18, 0.12, "triangle", 0.3],
        [1046.5, 0.27, 0.4, "triangle", 0.34],
        [1318.5, 0.27, 0.4, "sine", 0.15],
        [1568, 0.27, 0.4, "sine", 0.1],
      ];
      // Past the sixth, a sparkle on top: one more twinkle for each kill,
      // up to five.
      const twinkles = Math.min(Math.max(streak - MAX_STREAK, 0), 5);
      for (let i = 0; i < twinkles; i++) fanfare.push([SPARKLE[i], 0.34 + i * 0.07, 0.14, "sine", 0.1]);
      return fanfare;
    }
    const base = SCALE[n - 1];
    const out = [
      [base, 0, 0.16, "triangle", 0.32],
      [base * 2, 0.06, 0.2, "sine", 0.1 + 0.02 * n],
    ];
    if (n >= 3) out.push([base * 1.5, 0.05, 0.2, "sine", 0.1]);
    return out;
  }

  // The players you killed or helped kill, newest first (meter 2.0.98 on: its
  // kill and assist events name them). The game sends the points a kill
  // earns in the same moment as the record of it, just before or after, so a
  // gain within PAIR_MS of a kill or assist is taken as what it earned.
  const PAIR_MS = 3_000;
  const VICTIMS_MAX = 300;
  function logVictim(list, event) {
    const kind = event?.kind;
    if (kind === "kill" || kind === "assist") {
      const v = event.victim || {};
      const at = Number(event.at) || Date.now();
      const entry = { at, kind, name: v.name || null, serverId: v.serverId ?? null, class: v.class || null, level: v.level ?? null, legion: v.legion || null, ap: null };
      // A gain that came first and no kill took yet.
      const gain = list.pendingGain;
      if (gain && Math.abs(at - gain.at) <= PAIR_MS) {
        entry.ap = gain.amount;
        list.pendingGain = null;
      }
      list.items.unshift(entry);
      if (list.items.length > VICTIMS_MAX) list.items.length = VICTIMS_MAX;
      return true;
    }
    if (kind === "points") {
      const amount = Number(event.amount);
      if (!(amount > 0)) return false;
      const at = Number(event.at) || Date.now();
      const recent = list.items.find((v) => v.ap == null && Math.abs(at - v.at) <= PAIR_MS);
      if (recent) {
        recent.ap = amount;
        return true;
      }
      list.pendingGain = { at, amount };
      return false;
    }
    return false;
  }
  const freshVictims = () => ({ items: [], pendingGain: null });
  // The average points a kill and an assist earned, of those paired.
  function apEach(items) {
    const avg = (kind) => {
      const got = items.filter((v) => v.kind === kind && v.ap > 0);
      return got.length ? Math.round(got.reduce((s, v) => s + v.ap, 0) / got.length) : null;
    };
    return { kill: avg("kill"), assist: avg("assist") };
  }

  // (kills + assists) per death, one decimal; deaths 0 counts as 1.
  const kda = (s) => ((s.kills + s.assists) / Math.max(s.deaths, 1)).toFixed(1);
  const clock = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const rest = `${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
    return h ? `${h}:${rest}` : rest;
  };

  return { apply, notes, fresh, kda, clock, logVictim, freshVictims, apEach, MAX_STREAK };
})();
