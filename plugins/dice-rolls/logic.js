// Dice Rolls' bookkeeping, apart from the page so it can be tested: the
// meter's lootRoll events (meter 2.0.88 on) folded into one record per item
// rolled for. Each event names the roll, the item, or both:
//   open { rollId, itemId, count, endsAt }   mine { rollId, roll }
//   roll { itemId, player, roll }            pass { rollId, itemId, player }
//   won  { rollId, itemId, player }
// so a record is found by its roll id when the event has one, else by its
// item among the rolls still going. Your own roll has no item: it goes to the
// roll it names, or else to the newest still going that you haven't rolled in.
(() => {
  // A roll with no word for this long after its deadline (or, with none
  // known, after its last event) is over, winner or not.
  const GRACE_MS = 5_000;
  const NO_DEADLINE_MS = 60_000;
  const KEEP = 200;

  const fresh = (at) => ({ rollId: null, itemId: null, count: 1, openedAt: at, endsAt: null, lastAt: at, rolls: [], passes: [], winner: null, endedAt: null });

  const going = (r, now) => !r.endedAt && now <= (r.endsAt ? r.endsAt + GRACE_MS : r.lastAt + NO_DEADLINE_MS);

  const same = (a, b) => !!a && !!b && a.name === b.name && (a.serverId ?? null) === (b.serverId ?? null);

  // The record an event belongs to, made if there is none.
  function find(list, e, at) {
    if (e.rollId) {
      const byId = list.find((r) => r.rollId === e.rollId);
      if (byId) return byId;
    }
    if (e.itemId != null) {
      const byItem = list.find((r) => going(r, at) && r.itemId === e.itemId && (!r.rollId || !e.rollId));
      if (byItem) return byItem;
      // Your roll came first, with no item: the item's first word is about it.
      const mineOnly = list.find((r) => going(r, at) && r.itemId == null && (!e.rollId || !r.rollId || r.rollId === e.rollId));
      if (mineOnly) return mineOnly;
    }
    if (e.type === "mine") {
      const open = list.find((r) => going(r, at) && !r.rollId && !r.rolls.some((x) => x.mine));
      if (open) return open;
    }
    const r = fresh(at);
    list.unshift(r);
    return r;
  }

  // `list` newest first; `me` is the player ({ name, serverId }) or null.
  function apply(list, e, me) {
    if (!e || typeof e !== "object") return list;
    const at = typeof e.at === "number" ? e.at : Date.now();
    const out = list.slice();
    const r = find(out, e, at);
    if (e.rollId && !r.rollId) r.rollId = e.rollId;
    if (e.itemId != null && r.itemId == null) r.itemId = e.itemId;
    r.lastAt = Math.max(r.lastAt, at);
    switch (e.type) {
      case "open":
        r.count = e.count || 1;
        r.endsAt = e.endsAt || null;
        r.openedAt = Math.min(r.openedAt, at);
        break;
      case "mine":
        if (!r.rolls.some((x) => x.mine)) r.rolls.push({ name: me?.name || null, serverId: me?.serverId ?? null, roll: e.roll, mine: true });
        break;
      case "roll": {
        const mine = same(e.player, me);
        if (mine && r.rolls.some((x) => x.mine)) break;
        if (!r.rolls.some((x) => same(x, e.player))) r.rolls.push({ name: e.player?.name, serverId: e.player?.serverId ?? null, roll: e.roll, mine });
        break;
      }
      case "pass":
        if (!r.passes.some((x) => same(x, e.player))) r.passes.push({ name: e.player?.name, serverId: e.player?.serverId ?? null, mine: same(e.player, me) });
        break;
      case "won":
        r.winner = { name: e.player?.name, serverId: e.player?.serverId ?? null, mine: same(e.player, me) };
        r.endedAt = at;
        break;
      default:
        return list;
    }
    r.rolls.sort((a, b) => b.roll - a.roll);
    // The winner's roll, and "you" known by name once the meter says who won.
    if (r.winner) {
      const w = r.rolls.find((x) => same(x, r.winner));
      if (w) r.winner.roll = w.roll;
      else if (r.winner.mine) r.winner.roll = r.rolls.find((x) => x.mine)?.roll;
    }
    return out.slice(0, KEEP);
  }

  // Rolls past their time, marked over (no winner heard).
  function settle(list, now) {
    let changed = false;
    const out = list.map((r) => {
      if (r.endedAt || going(r, now)) return r;
      changed = true;
      return { ...r, endedAt: r.endsAt ? r.endsAt : r.lastAt };
    });
    return changed ? out : list;
  }

  // Where your roll placed: { place, of } (1 = highest), or null.
  function place(r) {
    const i = r.rolls.findIndex((x) => x.mine);
    return i < 0 ? null : { place: i + 1, of: r.rolls.length };
  }

  globalThis.DiceLogic = { apply, settle, place, going, GRACE_MS, NO_DEADLINE_MS, KEEP };
})();
