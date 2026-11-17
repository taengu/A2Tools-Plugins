// Mantra Watch's rules, without the page: which records are your mantras and
// your hits, when a fight starts and ends, and each mantra's uptime in it.
// plugin.js uses them; a test can load this file alone.
(() => {
  // A mantra ticks once a second on everyone it reaches: `on` is who it is
  // on, `caster` who keeps it up (the decoder passes only yours). The kind's
  // bit 2 says the record carries its skill (13 in the captures; a renewal
  // with another bit set is still a tick), and `q` 2 that it is re-applied
  // (0 is an effect left where it landed).
  // Mantras are skills 1816xxxx (Sprint) and 1819xxxx (Undefeated); the last
  // digits are the skill's level.
  const MANTRAS = [1816, 1819];
  const mantraOf = (skill) =>
    MANTRAS.includes(Math.floor(skill / 10_000))
      ? Math.floor(skill / 10_000)
      : null;
  function tickOf(d) {
    if (
      !d ||
      !Number.isInteger(d.kind) ||
      !(d.kind & 0x02) ||
      d.q !== 2 ||
      !Number.isSafeInteger(d.on) ||
      d.on <= 0 ||
      !Number.isSafeInteger(d.caster) ||
      d.caster <= 0 ||
      !Number.isSafeInteger(d.skill)
    )
      return null;
    const mantra = mantraOf(d.skill);
    return mantra ? { mantra, onMe: d.on === d.caster, on: d.on } : null;
  }

  // A hit of yours that means a fight: on something else that isn't an ally
  // (`allies(id)`: someone your mantras reach, so a heal or a buff on them is
  // no fight), with a skill that isn't a mantra (mantras show up as your own
  // records too).
  const isFightHit = (d, allies = () => false) =>
    !!d &&
    d.target !== d.actor &&
    !allies(d.target) &&
    !mantraOf(d.skill) &&
    d.skill > 0;

  // A tick keeps its mantra up for this long; one missing tick (1 s apart)
  // is a drop. A little over two, for records that arrive in bunches.
  const TICK_MS = 1_000;
  const DROP_MS = 2_200;
  // A fight ends this long after your last hit.
  const FIGHT_IDLE_MS = 8_000;
  // Shorter fights aren't kept: a stray hit is no fight.
  const MIN_FIGHT_MS = 10_000;
  // A teleport: the game loads the map (`21 36`) and lands you (`23 36`) 3
  // to 7 s later; no mantra ticks in between, and they come back about a
  // second after landing. No alert until this long after landing, or after
  // the load if the landing is missed.
  const LANDED_QUIET_MS = 5_000;
  const LOAD_QUIET_MS = 30_000;
  // In a fight, a mantra counts as dropped only if it was on in the fight or
  // this long before it started: one switched off well before is a choice.
  const BEFORE_FIGHT_MS = 60_000;

  // One fight: from its first hit to its last, and each mantra's ticks on
  // you in it, as covered time.
  class Fight {
    constructor(at) {
      this.start = at;
      this.last = at;
      this.covered = {}; // mantra -> [[from, to], ...] merged
    }
    hit(at) {
      this.last = Math.max(this.last, at);
    }
    tick(mantra, at) {
      const spans = (this.covered[mantra] ||= []);
      const from = at;
      const to = at + TICK_MS;
      const end = spans[spans.length - 1];
      // Ticks come in order; a gap of one missed tick still splits.
      if (end && from <= end[1] + 200) end[1] = Math.max(end[1], to);
      else spans.push([from, to]);
    }
    // Each mantra's share of the fight, 0 to 1.
    uptime(mantra) {
      const len = this.last - this.start;
      if (len <= 0) return 0;
      let sum = 0;
      for (const [a, b] of this.covered[mantra] || [])
        sum += Math.max(0, Math.min(b, this.last) - Math.max(a, this.start));
      return Math.min(1, sum / len);
    }
  }

  globalThis.MantraLogic = {
    MANTRAS,
    mantraOf,
    tickOf,
    isFightHit,
    Fight,
    TICK_MS,
    DROP_MS,
    FIGHT_IDLE_MS,
    MIN_FIGHT_MS,
    LANDED_QUIET_MS,
    LOAD_QUIET_MS,
    BEFORE_FIGHT_MS,
  };
})();
