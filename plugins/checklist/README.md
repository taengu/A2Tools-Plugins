# Daily Checklist

Your dailies, weeklies and one-time goals in a small window. It starts with a
common Aion 2 checklist (10 daily, 13 weekly, 8 one-time items, with notes),
which you can change under Edit. Items are the same for every character, and
each character's ticks are its own. Mark your main under Edit (★): items set
to "main only" (Daily Duty, Weekly Daily Dungeon, Weekly Scrolls) then show
only on it. One-time items never clear.
Ticks clear at the game's resets: daily at 07:00 UTC, weekly on Wednesday at
07:00 UTC (the times in the game's tables; both can be changed under Edit).

## Ticking

- Click an item to tick it. An item done several times a reset (set under
  Edit) counts up with each click; a right click counts down.
- **Ticks itself:** the game tells the client its entry counts as they
  change (dungeon entries and the like). The counts carry ids, not names, so
  the first time one the checklist doesn't know goes down, a small banner asks
  which item that was (**Link**), or to leave it alone (**Ignore**). From then
  on each use ticks that item, marked ⚡, with the entries left beside it.
  Links can be changed under Edit.
- Below the lists: how far your other characters are.

## Reminders

Before each reset, if anything is left on your current character, the window
comes up with what is left and a sound (default: 2 h before the daily reset,
1 day before the weekly one; Off is a choice). Only while AION2 is running.
**Test** under Edit shows one.

## What it reads

Only `0C 61`, the game's update of your entry counts: an entry's kind, its id
and the entries left. Seven decoders read the same record, one for each way
its first two entries can be laid out (an entry with a zero leaves the value
out); the checklist keeps whichever one fits. Odyle energy (id 60000001) is
skipped.
