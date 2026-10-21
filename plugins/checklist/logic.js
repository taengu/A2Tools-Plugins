// The checklist's rules, without the page: when each list resets, and the
// game's entry counts out of the decoders' events. plugin.js uses them; a
// test can load this file alone.
(() => {
  const DAY = 86_400_000;

  // When the current period began and when it ends (ms). Daily resets come at
  // `minutes` after midnight UTC; weekly ones at that time on `weekday`
  // (0 = Sunday). The game's tables: 07:00 UTC, weekly on Wednesday.
  function period(kind, now, { minutes = 420, weekday = 3 } = {}) {
    const d = new Date(now);
    let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + minutes * 60_000;
    if (start > now) start -= DAY;
    if (kind === "weekly") {
      while (new Date(start).getUTCDay() !== weekday) start -= DAY;
      return { start, end: start + 7 * DAY };
    }
    return { start, end: start + DAY };
  }

  // The game's entry counts carry ids like 60001101 (60000001 is Odyle
  // energy, which is no checklist item).
  const ODYLE = 60000001;
  const isCounter = (id) => Number.isInteger(id) && id > ODYLE && id < 60_100_000;

  // Which kinds each decoder's layout fits: `counts-<shape>`, one character
  // per entry. 1: one value (kind 04, or 08 when the first is 0), 0: no value
  // (kind 00, the count is 0), 2: two values (kind 0c). An entry is
  // `<kind> <id u32> <values...>`; a zero value is left out.
  const FITS = { 1: [0x04, 0x08], 0: [0x00], 2: [0x0c] };

  // The counts a decoder event holds, as [{ id, left }], or [] when its
  // layout isn't the record's (the other decoders of the same record then
  // read it). `left` is the first value: the entries left.
  function countsOf(event, data) {
    const shape = String(event).replace(/^(decoded:)?counts-/, "");
    if (!/^[012]{1,2}$/.test(shape) || !data) return [];
    const entries = [];
    for (let i = 0; i < shape.length; i++) {
      const n = i + 1;
      // A second entry only when the record says there is one (the count;
      // updates whose count is 0 still hold one entry).
      if (n > Math.max(1, data.count)) break;
      const kind = data[`kind${n}`];
      const id = data[`id${n}`];
      if (!FITS[shape[i]].includes(kind)) return [];
      if (id === ODYLE) continue;
      if (!isCounter(id)) return [];
      entries.push({ id, left: kind & 0x04 ? data[`value${n}`] : 0 });
    }
    // Several layouts can fit the same record (the one-entry one reads the
    // first of two): the same count arriving twice changes nothing.
    return entries;
  }

  // What a new count means: a use (the count went down), with how many, or
  // nothing (the same, or up at a reset or from a ticket). A count not seen
  // before is taken as one use, unless the period just began (the game
  // refilling it).
  function usesOf(before, left, now, periodStart) {
    if (typeof before === "number") return Math.max(0, before - left);
    return now - periodStart < 10 * 60_000 ? 0 : 1;
  }

  globalThis.ChecklistLogic = { period, countsOf, usesOf, isCounter, ODYLE };
})();
