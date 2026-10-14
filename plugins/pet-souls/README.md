# Pet Soul Tracker

Shows how many souls each of your pets still needs to reach level 3 (Special pets are left out: they come at their highest level). Filter by genus and level, or search by name: the bar shows the current level's progress, and **To Lv 3** the total still to collect.

It reads three things the game sends: every pet's level and soul points when you log in, each soul as you pick it up, and each level a pet reaches. Counts are kept per server, as the game keeps a pet collection for all your characters on a server, so the list survives restarts and switching characters; logging in again resyncs it from the game.

A soul shows the moment you pick it up on a meter that sends a plugin's records as it reads them (`"immediate"` decoders); older meters, up to 2.0.63, show it half a second later. The pet list at login still waits that half second, so it is filed under the server you logged in on.

Souls per level: 5 (level 0 → 1, inferred), 25 (1 → 2) and 75 (2 → 3).

Pets show by their in-game names, in the meter's language (all ten; `pets.js`, built from the game's `String_str_veh_*` texts). Double-click a name to give it your own; clear it to go back. Search filters by name (shown or English) or id, and each column header sorts the list; pressing it again reverses the order.

A pet levels up as soon as its souls reach what its level needs, and its count starts again from 0, as the game's does. The game's own level-up record doesn't come for every step (a pet at level 0 showed 24 souls in 0.2.0), so the counts level themselves; the next login's pet list corrects them either way. Counts saved by 0.2.0 are corrected the same way when they're loaded.

**☆** pins a pet to the top of the list (★). The pet you last picked up a soul for comes next, marked "farming", for 30 minutes after that soul.

## Where souls drop

Click a pet to see where its souls come from: the monsters that drop them (level, drop chance, zone and map, number of spawns, nearest Kibelisk) and the chests that hold them. Click it again to close.

- The nearest Kibelisk shows its number as the in-game map lists it ("nearest teleport #18 Odar's Shade"), and how far it is from the middle of the spawns. In the Abyss, where each side has Kibelisks of its own, it is the nearest one your side can use.
- The region chips (Altgard, Verteron, Lower and Middle Reshanta) choose which regions you farm in: the list shows only the pets whose souls drop in a region that is on (a pinned pet always shows, and so does one no monster is known to drop), and a pet's sources show only those regions' spawns. Until you change them, the other side's maps are off: Verteron for an Asmodian, Altgard for an Elyos, from the server number (1xxx Elyos, 2xxx Asmodian). A pet that also drops in a turned-off region says so. Turn on one region to list what you can farm there.
- All 200 pets that take souls have sources: 165 drop from monsters, and every one is in a Pet Soul Chest.

The data is the game's own: the soul items, which monsters drop them and how often, the chests and where they come from, and every spawn point and Kibelisk on each map, read from the game client's tables and map data. The plugin has no network access, so the data ships in `sources.js` and changes only with a new version. To rebuild it after a game patch, extract the client's `AION2/Content/Data/Table`, `Data/Map` and `Data/MapDataHierarchy` with [Aion2DataExtractor](https://github.com/adainrivers/aion2-data-extractor), then run `python tools/game-souls/gamesouls.py --tables <Output>/AION2/Content/Data/Table --tw-l10n <TW Output>/AION2/Content/Data/Table/L10N --compare plugins/pet-souls/sources.js` (the report lists what changed in English).

Every name in a pet's sources (monsters, zones, maps, Kibelisks, chests) shows in the meter's language, in the game's own words: the Global client's eight languages, Traditional Chinese from the Taiwan client's strings (`--tw-l10n`, the `Data/Table/L10N` of its extract), and Simplified Chinese converted from it with OpenCC. A name the game spells the same as in English is kept once, in English.

## Permissions

- `decoder:pet-list`, `decoder:soul-gained`, `decoder:level-up`: read your own pets' levels and soul gains.
- `events:character`: keep a separate list per server.
- `storage`: save the counts (with the last 200 changes per server, to trace a count that drifts from the game's), your pet names, the sort order, pins and region choice on this computer.

## Try it (developer mode)

Settings → Plugins: turn on **Plugin developer mode**, choose **Load plugin folder…**, pick this folder, then **Open**. Log in (or relog) to sync. After editing the files, **Check for updates** reloads them.
