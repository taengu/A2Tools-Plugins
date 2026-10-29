# Cooldowns

Your skill cooldowns and buffs as icons you place anywhere over the game, in the spirit of NotMeter's Combat Assist.

- **Skills:** every skill of your class with a cooldown. Turn on the ones to show; with "Add skills as you use them" on, each one you use turns itself on. A dark sweep and the seconds left run over each icon while it cools down; it flashes when ready. Click a skill for its options: keep it showing when ready, a sound when ready, its name spoken when ready.
- **Buffs:** every buff you've had, and your class's own buffs from the start (those its skills put on you, `selfbuffs.js`). Show any as its own icon; a buff from one of your skills shows on that skill's icon too. Options: keep it showing (greyed, near black) while it isn't on you, a sound or its name spoken just before it ends. A buff's ranks and variants (one name, one icon) are one row.
- **Look:** one bar or skills and buffs apart, icon size, the way it grows, icons per line, opacity, a buff's time left (a green bar, or a green ring round the icon that drains while the icon dims and greys as it runs out), seconds, the flash.
- **Alerts:** the sound, its volume (for the spoken names too), spoken names and the voice (any of your computer's voices, Default being the first in the meter's language; or the built-in English one, Kokoro, `kokoro.js` from `tools/voices/make_voice.py`, which speaks when the computer has none, as on Linux), its type (Any, Female, Male: told by the voice's name, `voices.js`, the same file as Event Timers'), its speed and Test voice, how long before a buff ends to warn. Names that come together are queued, two at most.
- Settings are per character.

## Where the times come from

The game works cooldowns out itself, so nothing in its traffic says how long a skill's cooldown is when you use it. The plugin reads (all decoders in `manifest.json`):

| Opcode | What it is |
| --- | --- |
| `01 38` | You used a skill: its id (a variant of the skill; its cooldown group is the base, see `skills.js` `variants`). |
| `47 38` | Cooldowns: a list of (group, ms left). One entry when something changed a cooldown (0: it was reset); every group at once now and then. |
| `2A 38`, `2B 38`, `2C 38` | A buff on you added, changed, removed (`capture/abnormal.rs` in the meter has the layout). |

A skill starts at the game's base time (Skill table `NeedCoolTime`, shown with ≈). Whenever a full list arrives, the time since you used a skill plus the time it has left is its real cooldown, with your cooldown reduction in it (a Sorcerer's 60 s skills ran 27.8 s). The median of the last five is kept, per character. A measurement is dropped when the skill was reset meanwhile, or was used again without `01 38` (not every use sends it: the list then shows it ready, or with more left than it should have). Skills not yet measured scale by how far the measured ones are below base.

## Data

`skills.js` and `icons/` are built by `tools/cooldowns/build_skills.py` from the game's Skill and SkillAbnormal tables and the meter's skill and buff names:

```
python tools/cooldowns/build_skills.py --tables <extractor>/Output/AION2/Content/Data/Table
python tools/cooldowns/build_self_buffs.py --tables <extractor>/Output/AION2/Content/Data/Table
```

`selfbuffs.js` (the second, after `skills.js`) lists the buffs each class's skills put on yourself: a class skill's effects (Skill `SkillEffectTimeDataList`) aimed at yourself or at friends (SkillEffectFilter `Self`, or friendly), whose SkillEffect rows apply an abnormal (`Abnormal`, `Abnormal_True`: the third value), kept to the buffs `skills.js` has; a passive's own skills count too.

### Gladiator artwork correction (0.2.6)

Zikel's Blessing and Lunge Stance used each other's artwork in the generated table. The [in-game tooltips reported in meter issue #130](https://github.com/taengu/A2Tools-DPS-Meter/issues/130#issuecomment-6502543233) identify the right icons and base times:

| Skill | Cooldown group | Base time | Correct artwork |
| --- | --- | --- | --- |
| Zikel's Blessing | `11250000` | 120 seconds | Red crowned warrior (`ICON_GL_SKILL_040`) |
| Lunge Stance | `11400000` | 60 seconds | Raised hands (`ICON_GL_SKILL_024`) |

The correction covers both skills and their six existing buff ranks. It changes fourteen artwork references; names, cooldown groups, variants, base durations, and cooldown learning stay the same. The server's remaining-time updates still determine the timers you see. The numeric cooldowns have not been swapped: each timer is now drawn over the matching in-game icon.

`build_skills.py` keeps the correction by skill group and buff family so rebuilding from the extracted tables preserves it. The embedded images themselves are unchanged. The original empty "Skills and buffs apart" bars were already fixed in 0.2.5 by the widget-ready handshake; this correction addresses the later artwork report.

Run the data and generator regressions with `node --test tests/cooldown-icons.test.mjs` and `python -m unittest discover -s tests -p 'test_cooldown_icons.py'`, followed by `python tools/build_catalog.py`. The regressions check the shipped skill and buff artwork, unchanged groups and durations, regeneration, and unaffected artwork.

## Not yet

Party members' cooldowns, debuffs on your target, the boss's casts and presets you can share: the decoders only read your own character for now.
