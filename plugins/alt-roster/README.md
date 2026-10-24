# Roster / Content Overview

Every character you play in one window, kept between sessions: class,
level, server, combat power, gear score and Odyle energy. Leave it open, or
move it to a second monitor: it never hides by itself.

- **Basic energy refills while you are away**, +15 every 3 hours (on 01:00,
  04:00, 07:00 … UTC) up to the cap. Each character's energy is shown as it
  likely is now: `≈` marks an estimate, the striped part of the bar is what
  refills added since the game last said. Logging in to the character
  corrects it.
- **Full in**: when each character's basic energy reaches the cap. A
  character already full is listed at the top: each refill from then on is
  lost until some is spent.
- **The cap** is 840 with a membership, 560 without. Click a character's cap
  to switch it (over 560 seen sets 840 by itself).
- At the top: the next refill, and the daily (07:00 UTC) and weekly
  (Wednesday 07:00 UTC) resets, in your own time on hover.
- Sort by name, combat power, gear score, energy, full soonest or last
  played; search by name or server. × (on hover) removes a character; it
  comes back when you play it.
- The fold button leaves only names, energy and Full in.
- **Content** tab: Nightmare and Ascension Trial left per character, Shugo
  Festival and Invasion per server, as the game last said, with the extra
  from recharge items (`+N`). Counts recharge while you are away (`≈`,
  striped): Nightmare +2, Shugo +3, Invasion +1 at each daily reset,
  Ascension +3 and Daily Dungeon (per server) +14 at the weekly one, up to
  the cap. Daily Duty (the
  server's limit, added up over your characters) shows the quests completed
  today (n / 5; the game's own n/5 counts the taken ones,
  done or not: those are in the tooltip), back to 0 at the daily reset.

## What it reads

No decoders. Only the meter's `character` event (`events:character`): name,
server, class and level, and from a meter newer than 2.0.77 combat power, gear score
and Odyle energy (basic and charged). On older meters the roster shows the
characters without those. The Content counts (`contentCounts`) come from
the same event on a meter newer than 2.0.77; without them the Content tab
shows `?`.

Server names: `servers.js`, the English names from the meter's own list.
