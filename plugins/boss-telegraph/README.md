# Boss Callouts

(Called Enhanced Boss Telegraph before 0.1.8; its id is still `boss-telegraph`.)

An accessibility plugin, asked for by Nyx, a visually impaired player. Some boss mechanics show only on screen: the boss's line in the middle of the screen, the colour it glows, a buff icon on it and its time. Boss Callouts speaks them aloud and shows them in big, high-contrast text you place anywhere over the game.

- **Calls:** speaks and displays boss mechanics, with cast and buff countdowns. The original “Safe to attack” cue returns when a tracked countdown ends or its effect is removed, provided no overlapping tracked phase remains. Countdown completion is an estimate, not proof of the boss’s actual state. A page resuming more than three seconds late stays quiet.
- **Call mode:** Instructions is the default. Matching scoped guides replace the spoken call; otherwise the original short call is spoken with the boss line on screen. Boss lines restores the saved Call style. Custom wording takes priority in both modes.
- **Bosses:** every boss and mechanic can be turned off, grouped by dungeon. Each call has **▶ to play it** as a fight would (its words, countdown and phase), and can have **your own words** (✎), said and shown instead of it, whatever the call style; the built-in English voice has only its own words, so yours are said by the computer's voice. Vakron's jump can beep on each wave.
- **Look:** text size (32 to 80 px), text, "safe" and background colours (yellow on black by default; **High contrast colours** puts them back), background opacity. **Big text on screen** off: spoken only. **Lock in place**: clicks go through to the game.
- **Voice:** volume (for the beep too), voice (any of your computer's voices, or **Built-in**; Default is the first in the meter's language), speech speed. A computer with no voices (Linux) uses the built-in voice: every line in English, made with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (voice `af_heart`; the model and its voices are Apache 2.0) by `tools/boss-telegraph/voice.py`. Calls that come together queue, two at most; a new mechanic cuts off a boss's line still being read.
- **Test** previews a purple phase with its five-second countdown and completion cue.

## What it does and doesn't do

It only puts into words what a sighted player sees or hears in game: the boss's own lines, its cast bar, the buffs on it and how long they last. It never predicts what the game doesn't show (hidden timers, the next skill, who will be targeted), never reveals hidden information, and never acts for you.

It knows only the bosses in its list (`bosses.js`). A boss or a mechanic that isn't there is silent.

## Guide context

Global is the default region; select Korea (KR) for the Korean game. Display language never changes region. Explicit activity, difficulty and stage choices are saved until changed, including across map and game-process resets. Auto difficulty uses only exact observed map metadata and does not infer activity or stage.

Version 0.2.0 includes 45 Global and 98 KR guide rules across 118 trigger tuples. Added guides require their supported region and mode/stage. When none matches, the original short call remains available; this fallback is not a claim that a regional guide was verified. Talisra’s signs and accumulated order remain available in every region.

Per-call previews require the selected region. They may demonstrate a supported instruction outside its mode/stage context, with the scope shown on screen. They do not claim that the preview matches the current encounter. Custom wording remains the player's explicit override, and turning off Tell me what to do retains the original call styles.

## Hand-checked mechanics

| Boss | Trigger | Call | Then |
| --- | --- | --- | --- |
| Thamon (Vakron Sky Island) | cast 1604670 "Surging violet!" (1.79 s) | Purple — stop magic attacks | boss buff 16046701 Mysterious Roar, 10 s: "Stop magic", then "Safe to attack" |
| Thamon | cast 1604660 "Burn! Burn!!" (1.79 s) | Red — stop physical attacks | boss buff 16046601 Cry of Life, 10 s: "Stop physical", then "Safe to attack" |
| Vakron | skill 1604390 (normal) / 1604393 (easy), no cast time | Jump! | a beep on each of its three waves (+1.7, +3.4, +5.1 s) |
| Talisra of the Void (Transcendence) | skill 1801730 (her dark spear shown) / 1801735 (her light spear shown) | Dark / Light | after "With this spear forged of light and dark" she shows the order of her three pulses, one spear at a time, 2 s apart (stand in the dark or light shield for each pulse, in that order): each word said as it is shown, and the callout reads the whole order (Dark → Dark → Light) for 12 s |
| Phantasmal Lakshmi (Draupnir) | cast 1605910 (0.73 s) | Reflect — stop attacking | boss buff 16059101 Damage Reflection, 8 s: "Stop attacking", then "Safe to attack" |

Confirmed in captures on 2026-10-26 (Talisra: 2026-10-27, one spear phase: dark, dark, light). Not called: Bakarma's per-player debuffs 18006910 to 18006914 (2 s; their meaning is not known yet), and Vakron's other casts without a line (1604410, 1604400, 1604370).

## What it reads

All decoders are in `manifest.json`, none with `"self"`: a boss's casts and buffs come from the boss. They come for every entity, players too; mechanic processing keeps only the ids `bosses.js` names (see CONTRIBUTING.md, "Monsters' and bosses' data"). A numeric map-load header is also read to reset encounter state.

| Opcode | Read | What it is |
| --- | --- | --- |
| `21 36` | opaque count, map id | map load; clears the previous encounter even for a same-map teleport |
| `09 38` | caster, skill | a cast bar starts |
| `02 38` | caster, skill | a skill goes off (the only sign of one with no cast time) |
| `03 38` | caster, source, skill | a skill's later hits (Vakron's waves) |
| `2A 38` | entity, flags, instance, abnormal, length | a buff lands |
| `2C 38` | entity, count, kind, instance | a buff ends (the first one listed) |

A boss's lines aren't in its traffic: the client plays them itself from its NpcBehaviorCase table (`Casting <skill>`, `SkillUse <skill>`, `Abnormal <id>`). So the plugin hears the trigger and says the line the game shows for it. An entity is remembered (for half an hour) only once it casts one of a boss's own skills, to tell which boss got a buff any monster can get (Frenzy, Stagger). Events more than 3 s old (queued while the window was shut) are not spoken. Nothing is sent anywhere: no network, settings in the meter's storage.

Map loads and game-process transitions clear encounter observations, phases, sign sequences, pending previews and queued audio. Explicit guide settings are preserved. Disabling Callouts cancels pending audio. Region, activity, stage, HP percentage and assignments are not automatically detected; exact map metadata can supply difficulty.

## Data

`tools/boss-telegraph/mechanics.json` contains the active regional registry, all ten instruction locales, exact source guards, evidence and review receipts. `python tools/boss-telegraph/mechanics.py --check` verifies the generated `mechanics.js` and rejects changed triggers, supporting dialogue, incomplete translations or broadened scopes. English clips are built for every registered instruction.

The earlier `actions.json` remains for compact sign speech and source provenance. New scoped instructions cannot bypass registry checks. The original game short calls remain the fallback.

Talisra's dark and light signs still build the upcoming order. Instruction mode says to **remember** each sign; the display explains that matching shields are used in that order **when the pulses begin**. It does not tell you to move immediately or predict the next sign. The accumulated order stays ahead of ordinary boss lines for its normal display lifetime; live phase warnings remain higher priority. Each sign is still spoken separately.

`bosses.js` is built from the game's tables by `tools/boss-telegraph/build.py`, with the hand-checked mechanics from `tools/boss-telegraph/curated.json`:

```
python tools/boss-telegraph/build.py --tables <extractor>/Output/AION2/Content/Data/Table [--tw-l10n <extractor>/OutputTW/AION2/Content/Data/Table/L10N]
```

It keeps NpcBehaviorCase rows of named bosses whose Casting, SkillUse or Abnormal event always (Prob 10000) plays an on-screen line, with the cast time from Skill and the names and lines in ten languages (Traditional Chinese from the TW client, Simplified made from it with OpenCC). Run it again after a patch and bump the version.

`voice.js` (the built-in voice) is built from `bosses.js` and the checked action instructions by `tools/boss-telegraph/voice.py` (Kokoro, Python 3.10 to 3.12, no ffmpeg needed): run it after `build.py` or changing instructions. The new instructions have English clips too, including the neutral advisory, for computers without system voices. Displayed instructions follow the meter's language; built-in speech remains English.

## A mechanic missing or wrong?

Open an issue at https://github.com/taengu/A2Tools-Plugins/issues with the dungeon, the boss, what the game shows (the line, the colour, the buff) and, if you can, a packet log of that fight (turn on **Packet logging** in the meter's settings before it).

Talisra’s accumulated sign order stays visible when ordinary boss lines arrive. After a 2.5-second pause between signs, action mode also speaks the matching-shield instruction once per sequence. This pause does not confirm the sequence is complete or predict the first pulse. Encounter resets and expired or disabled calls cancel the pending instruction.
