# Event Timers

Countdowns to AION 2's recurring events and scheduled bosses, in your server's time, nearest first.

| Event | When (server time) |
|---|---|
| Shugo Festival | every hour at :00, in your faction's field |
| Dimensional Invasion | every hour at :30, in your faction's field |
| Spacetime Rift | every 3 hours from 02:00 (the portal stays open 10 minutes) |
| Watcher Kaira | every 3 hours from 01:00, Lower Reshanta |
| Artifact Siege | Monday, Thursday and Saturday at 21:00 |
| Executors Tamasa, Argo and Kaira | Monday, Thursday and Saturday at 21:30 |
| Guardian Lord Nahma | Friday and Sunday at 21:00 |
| Daily and weekly resets | 07:00 UTC; the weekly one on Wednesday |

Each row shows how long until it starts and the start time (in this computer's time zone, or another you pick under **Settings**, or the server's own clock); a running event shows how long it has left (where the game's data says how long it runs). × hides an event; the hidden ones are listed below the others, and clicking one shows it again. Folded (the window's compact button), only the next three show.

## Alerts

The **Alerts** tab starts with **Quick picks**, which turn a whole set on or off with one tap: **Shugo & Invasion**, **Rare world bosses** (those that take 3 hours or more to come back), **All world bosses** (each world boss without an alert of its own) and **Artifact Siege**. Under them, **Your alerts** lists only the alerts that are on, each on one line with when it goes off; click a line to change that alert in place (how long before, as it starts, or 1 to 60 minutes; the time while AION2 is closed; for a world boss, when it's being fought; and its own sound, repeats and icon), and click its 🔔 to turn it off. **Default** at the top of the list sets the times new alerts start with. **Add alerts** below has a search box, the events, the scheduled bosses and the world bosses by map (each with how often it comes back), folded until opened, with **All** for a whole group.

An alert plays a sound and shows a message in the window, or shows its icon (Settings → On screen), once per showing. With **Teleport number on icon** on (Settings → On screen, or per alert in its icon options), a boss's icon carries the number of its nearest teleport for your side, in a chip on the ring's lower right; bosses whose teleport has no number in the game's list show none. With **Speak alerts** on (Settings), its line is also said out loud after the sound, in the meter's language, by one of the computer's voices (`voices.js`), or by the built-in English voice (Kokoro, `kokoro.js`, made by `tools/voices/make_voice.py`) when the computer has none (Linux) or it is picked: **Voice type** (Any, Female, Male) narrows the **Voice** list, **Speed** sets how fast, and the alerts' **Volume** applies; **Test voice** says a sample. The sounds are Hidden Cube Alert's (Chime, Bell, Sparkle, Ping, Soft) and four more (Gong, Horn, Harp, Alarm), made in the plugin, with no sound files. A timer with an alert set shows a 🔔. On the **Bosses** tab, each boss has its own bell, which turns its alert on or off, and a gear, lit while the alert is on, which opens that alert under **Your alerts**; a world boss covered only by **All world bosses** shows a half-lit bell. Click **Scheduled bosses** or **World bosses** to fold that list away; the window remembers which are folded. With **Also alert as it starts** on (under Settings), an alert set for some minutes before goes off again as the event starts, or as the world boss is due.

## Anchor mode

With alerts shown as icons, **Anchor mode** (Settings → On screen, the Placement card) puts all the icons in one grid beside an anchor (⚓), instead of each in its own window where it was dragged. While the Settings tab is open, the anchor and every place in the grid show on screen: unlock the icons and drag the anchor to place the grid. Leave Settings and only the icons stay.

In the card, click a corner of the small grid to set where the anchor sits (the grid grows away from it), use **Across** and **Down** to size it, and **Column gap** and **Row gap** to space the icons (4 px unless changed; below 0 packs them closer). Each row is as tall as its tallest icon. When more icons would show than fit, the last place shows "+N", with the rest named in its tooltip. **Sort by** decides the order: **Most urgent first** (bosses being fought, lowest HP first, then what is up now, rarest first, then the soonest), **Rarest first** (what is up now, the longest to respawn first, then the soonest), or **Soonest first**.

**World Boss Train** puts every world boss that is up, or spawns within the time set under **Spawning within** (5 minutes unless changed), on the grid, with an alert or not: the next stop for a group going from boss to boss. A boss's rarity is how long it takes to respawn, measured on a2tools.app from players' meters (30 minutes to 12 hours); one not measured yet counts as the least rare.

## Artifact Siege

At the top of **Events**: who holds each Abyss artifact, in their side's colour, with the score, and during the siege each Dimensional Core's HP, or "Destroyed". It comes from a2tools.app, where players' meters report what they see near the artifacts and cores, and from your own meter at once when the game tells it (opening the Abyss map, entering the Abyss). Read every 15 seconds while the siege is on, every 5 minutes otherwise. Needs meter 2.0.72 or newer.

## Server time

Each Global region's servers keep their own clock: NA East is New York time, NA West Los Angeles, Europe Berlin, South America São Paulo, Asia Seoul. The region comes from your character's server (the second digit of its number), and so does your faction (the first). Before you log in, or to see another region's times, pick it under **Settings → Server**. Korean and Taiwanese servers share their numbers and run some events on other cycles, so they aren't covered yet.

## Where the times come from

The game's own tables: `EventSchedule` and `FieldEvent` for the field events, `PeriodSpawn` for the scheduled bosses and rift portals, `RiftData` for how long a portal stays open, and names in the game's own words in every language. Maps that aren't open yet (Eltnen, Morheim, Middle Reshanta) are left out, as in Pet Soul Tracker. To rebuild `schedule.js` after a game patch, extract the client's `AION2/Content/Data/Table` and `Data/Map` to JSON, then run:

```
python tools/event-timers/build.py --tables <Output>/AION2/Content/Data/Table --tw-l10n <TW Output>/AION2/Content/Data/Table/L10N
```

Hovering a boss, in the Bosses tab or on its icon, shows its nearest teleport: the teleport number and name, and how far it lands from the boss. It's worked out from the maps' spawn points and teleport landing spots, on the boss's own map and for your faction. Guardian Lord Nahma spawns at one of three points, and the world-boss feed has a timer for each (2003-2005): he is listed, alerted and shown as one boss (under 2003), up when any of them is, with that point's HP and teleport; until he is seen, his hover lists all three points' teleports. Then rebuild `teleports.js` (needs `pip install ijson`):

```
python tools/event-timers/build_teleports.py --tables <Output>/AION2/Content/Data/Table --tw-l10n <TW Output>/AION2/Content/Data/Table/L10N
```

World bosses that respawn a while after they're killed (most of the world map's named bosses) aren't on a schedule, so they aren't here yet.

## Permissions

- `events:character`: your server, for its time and your faction.
- `storage`: your settings, alerts and hidden events, on this computer.
- `notify`: the alert's message in the window.
- `window`: to bring the window up when an alert goes off, if you ask for it.

Plugin API 2: needs meter 2.0.62 or later.
