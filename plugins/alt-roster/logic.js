// Roster / Content Overview's rules, without the page: when basic Odyle energy refills, and
// what a character's energy is likely to be now. plugin.js uses them; a
// test can load this file alone.
(() => {
  const HOUR = 3_600_000;
  // Basic energy: +15 every 3 hours, on the hours that meet the 07:00 UTC
  // daily reset (01:00, 04:00, 07:00 … UTC), up to the cap.
  const STEP = 15;
  const EVERY = 3 * HOUR;
  const OFFSET = 1 * HOUR;
  // The cap: 840 with a membership, 560 without. Charged energy never refills.
  const CAPS = [840, 560];

  const tick = (t) => Math.floor((t - OFFSET) / EVERY);
  // When the next refill comes after `now`.
  const nextRefill = (now) => (tick(now) + 1) * EVERY + OFFSET;
  // How many refills came after `from`, up to and with `to`.
  const refillsBetween = (from, to) => (to > from ? tick(to) - tick(from) : 0);

  // What energy seen as `seen` ({ basic, charged, at }) is likely to be at
  // `now`: { basic, charged, gained, full }. gained: what refills added since.
  function estimate(seen, now, cap) {
    if (!seen) return null;
    const grown = Math.min(cap, seen.basic + refillsBetween(seen.at, now) * STEP);
    const basic = Math.max(seen.basic, grown);
    return { basic, charged: seen.charged, gained: basic - seen.basic, full: basic >= cap };
  }

  // When basic energy reaches the cap: null when it already has.
  function fullAt(seen, cap) {
    if (!seen || seen.basic >= cap) return null;
    const needed = Math.ceil((cap - seen.basic) / STEP);
    return nextRefill(seen.at) + (needed - 1) * EVERY;
  }

  // Whether the next refill would be wasted, all or part of it: basic energy
  // above cap - STEP at `now` (830 or 835 of 840, or full). Then the time of
  // that refill, by which energy wants using; else null.
  function wastesNext(seen, cap, now) {
    const est = estimate(seen, now, cap);
    if (!est || est.basic <= cap - STEP) return null;
    return nextRefill(now);
  }

  // The energy alert (Roster's "Alert" setting): a character's basic energy
  // over its mark. "waste": the next refill would be wasted (over cap -
  // STEP); "early1" to "early3": that many refills (3 h each) sooner; "full":
  // at the cap; "off": never.
  const ALERT_MODES = ["off", "waste", "early1", "early2", "early3", "full"];
  function alertMark(cap, mode) {
    if (mode === "full") return cap - 1;
    if (mode === "waste") return cap - STEP;
    const early = /^early([1-3])$/.exec(mode || "");
    return early ? cap - STEP * (Number(early[1]) + 1) : null;
  }

  // Who to alert for at `now`, once each time they go over the mark.
  // chars: [{ key, energy, cap, watched }]; who: "all", or "ticked" (only the
  // watched); alerted: { key: mode } as kept, each one alerted and still
  // over. Returns { fire: [keys], alerted }: a character that dropped back
  // under (energy used) is forgotten, so it alerts again next time.
  function alertsDue(chars, mode, who, alerted, now) {
    const kept = {};
    const fire = [];
    for (const { key, energy, cap, watched } of chars) {
      const mark = alertMark(cap, mode);
      const est = estimate(energy, now, cap);
      if (mark == null || !est || est.basic <= mark) continue;
      if (who === "ticked" && !watched) continue;
      kept[key] = mode;
      if (alerted?.[key] !== mode) fire.push(key);
    }
    return { fire, alerted: kept };
  }

  globalThis.RosterLogic = {
    STEP, EVERY, CAPS, ALERT_MODES, nextRefill, refillsBetween, estimate, fullAt, wastesNext, alertMark, alertsDue,
  };
})();
