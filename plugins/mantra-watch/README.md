# Mantra Watch

For Chanters. A small window with your mantras (Sprint Mantra, Undefeated
Mantra): a green dot while one runs, and how many party members it reaches
(+3). Green means your aura is currently observed, including pulses on allies.
Blue means another Chanter supplies the effect on you while your own activity
is not observed; your own toggle state remains unknown. If neither is currently
detected in a fight, a red banner and a sound, and the
window comes up on top without taking focus; it goes again on its own when
the mantra is back. The same alert comes at the first hit of a fight if a
mantra you ran in the minute before it is no longer detected; one you switched off earlier
is your choice, and gives none. A click on the banner dismisses it until
that mantra is on again.

Below: the current fight's length and each mantra's uptime, and after it the
last fight's, with the average of the last 10 (per character). A fight runs
from your first hit to 8 s after your last; fights under 10 s aren't kept,
and a heal or buff on someone your mantras reach starts none.

⚙: when to alert (in a fight, always, never), the sound and its volume, and which mantras
to watch. Everything is in the meter's 10 languages.

Switching character starts over (with `events:character`, meter 2.0.65 on):
a mantra from the last character is not "off" on this one. On a character
the meter knows isn't a Chanter there is no alert at all.

## What it reads

- `2B 38`, a mantra ticking (`self: caster`): a mantra ticks once a second
  on everyone it reaches, carrying who it is on and who keeps it up. Only
  yours reach the own-activity channel. A separate `self: on` decoder observes
  incoming coverage on you from another Chanter; it does not add your own uptime
  or party reach. A kind with bit 2 (the skill is there; `13` in the
  captures), `q` 2, skills 1816xxxx and 1819xxxx.
  A gap of 2.2 s without either own activity or received coverage can alert.
  This is observed effect coverage, not authoritative toggle state.
- `04 38`, a hit (`self: actor`): the start of the record (target, flags,
  a value, who hit, the skill), only your own hits. A hit on something else
  with a skill that isn't a mantra means a fight.
- `21 36`, a map loading, and `23 36`, landing after it: a teleport. Ticks
  stop in between (3 to 7 s) and come back about a second after landing, so
  a teleport ends the fight and no alert comes until 5 s after landing.

Checked against a capture from 2026-10-14 (22:15, a party of five): your 14
ticks over 7 s, 4 party members reached, 26 fight hits.

If your own mantra stops while another Chanter supplies the same mantra on you,
there is deliberately no alert; your own uptime still records the gap.
