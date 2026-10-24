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

  globalThis.RosterLogic = { STEP, EVERY, CAPS, nextRefill, refillsBetween, estimate, fullAt };
})();
