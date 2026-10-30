# Roster / Content Overview

Every character you play in one window, kept between sessions: class,
level, server, combat power, gear score and Odyle energy. Leave it open, or
move it to a second monitor: it never hides by itself.

- **Basic energy refills while you are away.** The plugin estimates +15
  every 3 hours (on 01:00, 04:00, 07:00 … UTC) up to the cap: one refill was
  seen at 16:00 UTC, the rest of the rule is from another app, not checked.
  Each character's energy is shown as it likely is now: `≈` marks an
  estimate, the striped part of the bar is what refills added since the game
  last said. Logging in to the character corrects it.
- **Full in**: when each character's basic energy reaches the cap. A
  character already full is listed at the top: each refill from then on is
  lost until some is spent.
- **The cap** is 560, or 840 with a membership. A new character starts at
  560 and switches to 840 once more than 560 is seen. Click a character's
  cap to switch it, e.g. when a membership runs out.
- At the top: the next refill, and the daily (07:00 UTC) and weekly
  (Wednesday 07:00 UTC) resets, in your own time on hover.
- Sort by name, combat power, gear score, energy, full soonest or last
  played; search by name or server. × (on hover, then click again to
  confirm) removes a character; it comes back when you play it. A character
  moved to another server shows up as a new one: remove the old row.
- The fold button leaves only names, energy and Full in.
- **Content** tab: Nightmare and Ascension Trial left per character, Shugo
  Festival, Invasion and Daily Dungeon per server, as the game last said,
  with the extra from recharge items (`+N`). Daily Duty shows the quests
  completed today (n / 5; the game's own n/5 counts the taken ones, done or
  not: those are in the tooltip), added up over your characters on the
  server, back to 0 at the daily reset.
  Abyss Corridors done per character, out of the corridors your side
  holds since the last Artifact Siege (up to 3; your side from the server
  id), from the Abyss passages' usage timers the game lists at each login;
  after the next siege `?` until the game says again. Who holds which
  artifact, and when the next siege is, come from the game as you enter
  the Abyss or open its map, else from A2Tools' copy of them. With neither
  (offline, before any Abyss visit), all three corridors count and the
  weekly reset (Wednesday 07:00 UTC) stands in for the siege: an estimate.
  A side holding none of the artifacts shows `—`; an artifact no side
  holds counts as closed to both (as far as known). With no timer on any
  passage, "all used" and "not handed out yet" (until the first Abyss
  visit after a siege) look the same: unless a passage had time left since
  the siege, the count shows `≈0`.
- **Recharges while you are away are estimates** (`≈`, striped), up to the
  cap. A count is as the game last said it, from when it last changed: the
  meter sends its last values with every update, so an old count isn't
  taken as new. From the game's tooltips: Nightmare +2 a day (cap 14), Shugo +3 a day
  (cap 21), Ascension Trial +3 a week (cap 3), Daily Dungeon 14 a week.
  Not from the game, so less sure: Invasion cap 7 at +1 a day, Daily Duty 5
  a day shared by the server's characters (from another app, and how the
  game behaved), and that Daily Dungeon is the game's entry 101 (the only
  14 + 3 in the list).

- **Other** tab: the week's limits, as the game last said once the shop or
  the crafting window has opened on a character (Wednesday 07:00 UTC
  reset): Odyle Energy crafts (16 a week on the server, 4 per character),
  Buy Odyle Energy (20) and Buy Rift Stones (7) per character; and from
  each login, the Kinah gained today (1,000,000 a day) and the week's Abyss
  Points with the limit the game sends.

**Show** limits the displayed characters to the current faction, server or
character. All characters remain visible by default, and until the current
identity is known. Content and Other still use the current or last-played
server. Hidden characters stay saved and contribute to shared server totals;
full-energy warnings are unchanged. The choice is saved between launches.

## What it reads

No decoders. The meter's `character` event (`events:character`): name,
server, class and level, and from meter 2.0.78 on combat power, gear score
and Odyle energy (basic and charged). On older meters the roster shows the
characters without those. The Content counts (`contentCounts`) come from
the same event from meter 2.0.78 on; without them the Content tab shows
`?`. The Other tab's (`shopLimits`, `crafts`, `kinahToday`, `abyssPoints`) and the
Abyss passages (`contentTimes`) come from newer meters too. The Artifact
Siege comes with `feed:boss-timers`: the meter's `abyss` event and
`a2.abyssSiege` (who holds each artifact, and when the next siege is).

Server names: `servers.js`, from the meter's own list.

In the meter's ten languages (`i18n.js`), following its language setting.
Content and class names are the game's own where the meter's tables have
them; "Daily Duty" and "Daily Dungeon" are translated and may differ from
the game's wording.
