# Shugo's Ledger

Pets, Kinah, drops and skins in one window, on four tabs (Pet Soul Tracker until 0.7.0). Saved pets, names, pins and settings carry over.

## Kinah

The game counts the Kinah each character gains in a day, up to 1,000,000, and resets the count at the daily reset. The **Kinah** tab follows that count:

- **Today**, for the character you play: the Kinah so far against 1,000,000, when the day's first Kinah came, how long since (or how long it took to reach the limit), the Kinah per hour and when you'll reach the limit at that pace, the Unique drops so far and when the day resets.
- **Your characters today**: each character with Kinah today, on this server or all, with how long it took (or **running**, or **stopped** after 15 minutes without Kinah) and its Unique drops.
- **Last 7 days** of one character (pick it in the menu): a bar per day for the time to the limit, shorter being faster, and a row per day.
- **Unique drops today**: the Unique and Heroic items picked up, the ones during the run marked.

"Took" runs from the day's first Kinah to the limit; time away from the game counts. A meter started after a character's first Kinah of the day starts the day where it first saw it (marked ≥). Unique drops are the items of Unique grade or above that the game lists from monsters, dungeons or gathering. Days are kept for 30 days.

## Drops

**Drops** puts what you get beside what the game lists (meter 2.0.98 or later). Each row is an item, with your rate and the game's listed chance:

- **Monsters**: your drops of the item from a monster, against the kills of it you hit. In a party each member gets drops of their own, so only yours count. The listed chance is the game's own, from the monster's reward lists.
- **Gathering**: the extras a gather can give (a Life Crystal from Aria and Targena, Poko's Skin Bundle from most nodes, a Seed of Detection from trees) and double yields, against your gathers of that item. The game lists no chance for these.
- **Shugo Festival** and **Dimensional Invasion**: each item the rewards gave, and in how many of your runs.

Search by item or monster, pick a source, sort by the most seen, the luckiest (your rate against the listed chance) or the name, and choose the period (today, the last 7 or 30 days, or all kept). **Unique and above only** and **This character only** narrow the list. Counts are kept per character and day, for 90 days.

## Skins

**Skins** lists every skin in the game against your Closet (sent when you log in, and each skin added since): how many you have, and the missing ones first. Search by name, show **Missing**, **Owned** or **All**, pick armour, weapons or accessories, and filter by where they come from (boxes, the Black Market, the coin shops, Hidden Cubes, rankings, dungeons, or other). A skin on the Black Market for you right now is marked and listed first.

Each skin says where the game says it comes from, with the chance where the game gives one: Poko's Skin Bundle lists 38 wings and skins with their odds. **Where to get it** on a bundle skin lists the gathering nodes that drop the bundle (any gathering node of those kinds can; the game gives no chance for that).

The skins, their sources and odds are the game's own (its Skin, Item, ItemGetRoute, BoxReward, RewardPackageItem and gathering tables), built by `tools/game-souls/collection.py` into `collection.js`.

## Pets

Shows how many souls each of your pets still needs to reach level 3 (Special pets are left out: they come at their highest level). At the top: the souls still needed for every pet, how many pets are left, and a bar of how far along you are. Search by name, or open **Filters** for genus, level, regions, "Hide pets at level 3", the layout and the text size (the button shows how many filters are on).

## Layouts

Filters → **Layout** draws the list one of four ways. In each, a pet's genus (Cogni, Fera, Natura, Varian) shows beside its name, in its colour.


- **Cards** (the default): each pet's level in a ring of its genus colour, the ring filling with the souls toward the next level; the souls left to level 3 in the card's corner; and under its name the way to level 3 as three steps (5, 25 and 75 souls), the steps done full and the current one by its souls. The card's edge is its genus colour, green for the pet being farmed, gold at level 3.
- **Filled cards**: the genus icon, the card filling with the souls toward the next level, the level as dots and the souls left large.
- **Rows**: one line per pet, with the ring and the three steps: the most pets on screen.
- **Classic**: the table as before 0.4.7, its columns Lv, Pet, Souls and To Lv 3.

## Farming pop-up

Tick **Pop up while farming** under Filters, and you don't need the window open while you farm. When you pick up a soul for a pet below level 3, the window comes up with only the pets you are farming (those you picked up a soul for in the last 30 minutes, the last first), fitted to them, and hides itself again once nothing has happened for the time under **Hide after** (10 s to 1 min, or Never). Moving the mouse over it keeps it up. A pet that reaches level 3 stays a minute, then leaves the list.

**All pets** shows the whole list; **×** hides the window until the next soul. Open from Settings, the window shows the whole list, and a soul doesn't swap it for the farming list while you are using it (a click, a key or the wheel in the last 10 seconds; the mouse only passing over it doesn't count); otherwise **Farming** beside the search box goes back to it. The pop-up comes up where the window is, at its width: move and size the whole list where you want it. It needs meter 2.0.65 or later.

## Pets only from chests

A pet no monster drops can only be raised with Pet Soul Chests (the battle pass's), so it can't be farmed: it is hidden unless **Show pets only from chests** is ticked under Filters. A pinned pet always shows. The totals at the top count the pets shown.

It reads three things the game sends: every pet's level and soul points when you log in, each soul as you pick it up, and each level a pet reaches. Counts are kept per server, as the game keeps a pet collection for all your characters on a server, so the list survives restarts and switching characters; logging in again resyncs it from the game.

A soul shows the moment you pick it up on a meter that sends a plugin's records as it reads them (`"immediate"` decoders); older meters, up to 2.0.63, show it half a second later. The pet list at login still waits that half second, so it is filed under the server you logged in on.

Souls per level: 5 (level 0 → 1, inferred), 25 (1 → 2) and 75 (2 → 3).

Pets show by their in-game names, in the meter's language (all ten; `pets.js`, built from the game's `String_str_veh_*` texts). Double-click a name to give it your own; clear it to go back. Search filters by name (shown or English) or id, and the sort buttons (To Lv 3, Souls, Lv, Pet) sort the list; pressing one again reverses the order.

A pet levels up as soon as its souls reach what its level needs, and its count starts again from 0, as the game's does. The game's own level-up record doesn't come for every step (a pet at level 0 showed 24 souls in 0.2.0), so the counts level themselves; the next login's pet list corrects them either way. Counts saved by 0.2.0 are corrected the same way when they're loaded.

**☆** pins a pet to the top of the list (★). The pet you last picked up a soul for comes next, marked "farming", for 30 minutes after that soul.

## Around you

Tick **Show the map** under Filters (it is off until you do) for a map at the top of where the souls you still need are: the game's world map of the map you're on, north up, with every spawn of the monsters that drop a soul for a pet below level 3 as small dots in that pet's genus colour, and you on it. The monsters in range, as the game sends them, show larger and ringed on their spawns, and under the map the nearest kinds (up to four): name, level, how many, how far and which way, and the pets they drop souls for with the souls each still needs. **All monsters** adds every other monster in range as grey dots. The header names the map and counts the spawns you need on it and how many are in range.

Drag the map to look around (⌖ or a double-click goes back to you); the wheel or **+** / **−** zooms, from 0.5 to 16 m a pixel. With the map on, it comes along in the farming pop-up, above the pets being farmed. Its words follow the meter's language.

**Pop out** (the arrow-out button in the map's header) puts the map in a small window of its own, always on top, which you can drag anywhere by its bar and lock with the plugin's other widgets (meter 2.0.68 or later). Locked, only its buttons take the mouse: clicks on the map go through to the game. Its own zoom, drag and follow work as in the window; the size button steps it through five sizes, from 300 × 270 to 760 × 660, and **×** puts the map back in the Pet Soul Tracker window. It stays popped out across restarts, and keeps going while the tracker's window is hidden. Turning **Show the map** off closes it.

The game sends each monster as it comes into range and as it goes, after a kill or as it leaves your range, so those are placed exactly. Your own position is exact when you fight, dodge, mount, glide or use a skill on yourself, every second under a Chanter's mantra, at a teleport and as a map loads. Running alone sends none: then the monsters coming into view place you within about 20 to 30 m (**≈ position estimated**, a dashed circle) until the next exact one, and with nothing coming into view the header says how old your position is. Only your own position is read, never another player's: the meter passes on only yours, once it knows which character is you (from the game's record about you, a few seconds after each map load; started mid-session, a while after it starts). Until then the monsters in range place you. Started mid-session, before a map has loaded, the map is the one whose spawns match the monsters in range, else the one you were last on.

Only the picture of the map you're on is loaded.

The map pictures and spawn points come from [Aion 2 Timers](https://www.aion2timers.com/map/)' interactive map, with their permission, credited in the map's corner (`tools/pet-maps/build.py` builds `maps/` and `maps.js` from it): the open-world maps and Reshanta, 2048 px each. Their positions are the game's world units, the same as the game sends; spawns seen in game sit within a few metres of theirs.

## Where souls drop

Click a pet to see where its souls come from: the monsters that drop them (level, drop chance, zone and map, number of spawns, nearest Kibelisk), the one with the most spawns first, and the chests that hold them. Click it again to close.

- The nearest Kibelisk shows its number as the in-game map lists it ("nearest teleport #18 Odar's Shade"), and how far it is from the middle of the spawns. In the Abyss, where each side has Kibelisks of its own, it is the nearest one your side can use.
- The region chips (Altgard, Verteron, Lower and Middle Reshanta) choose which regions you farm in: the list shows only the pets whose souls drop in a region that is on (a pinned pet always shows, and so does one no monster is known to drop), and a pet's sources show only those regions' spawns. Until you change them, the other side's maps are off: Verteron for an Asmodian, Altgard for an Elyos, from the server number (1xxx Elyos, 2xxx Asmodian). A pet that also drops in a turned-off region says so. Turn on one region to list what you can farm there.
- Only maps already open on the servers count. The game client ships maps before they open (Eltnen, Morheim and Middle Reshanta), so the generator takes the open ones from the game's own "where to get it" routes: Verteron, Altgard, Lower Reshanta and the dungeons those routes name. Drops elsewhere are left out, and a pet only found there (three for now) is left out of the list, though the game lists it.
- Of the 197 pets that take souls on open maps, 162 drop from monsters, and every one is in a Pet Soul Chest.

The data is the game's own: the soul items, which monsters drop them and how often, the chests and where they come from, and every spawn point and Kibelisk on each map, read from the game client's tables and map data. The plugin has no network access, so the data ships in `sources.js` and changes only with a new version. To rebuild it after a game patch, extract the client's `AION2/Content/Data/Table`, `Data/Map` and `Data/MapDataHierarchy` to JSON, then run `python tools/game-souls/gamesouls.py --tables <Output>/AION2/Content/Data/Table --tw-l10n <TW Output>/AION2/Content/Data/Table/L10N --compare plugins/pet-souls/sources.js` (the report lists what changed in English).

Each monster in a pet's sources has a **Map** link to the [Aion 2 Timers](https://www.aion2timers.com/map/) map, opened in your browser: every spawn of that monster on its map, and the nearest teleport, measured from the same spawn as here so the distance matches. In the Abyss it uses your side's Kibelisk, as the list does. The map opens in the meter's language where it has it.

Every name in a pet's sources (monsters, zones, maps, Kibelisks, chests) shows in the meter's language, in the game's own words: the Global client's eight languages, Traditional Chinese from the Taiwan client's strings (`--tw-l10n`, the `Data/Table/L10N` of its extract), and Simplified Chinese converted from it with OpenCC. A name the game spells the same as in English is kept once, in English.

## Permissions

- `decoder:pet-list`, `decoder:soul-gained`, `decoder:level-up`: read your own pets' levels and soul gains.
- `events:character`: keep a separate list per server.
- `window`: show the window when you pick up a soul for a pet you are farming, fitted to that list, and hide it again (only with **Pop up while farming** on).
- `decoder:npc-spawn`, `decoder:npc-gone`: the monsters coming into and leaving your range, for the map.
- `decoder:map-load`, `decoder:teleport`: the map you're on and where it or a teleport puts you.
- `decoder:own-position`, `decoder:mantra-tick`: your own position, from your effects landing on you and your mantras (filtered to you by the meter).
- `widgets`: the popped-out map.
- `storage`: save the counts (with the last 200 changes per server, to trace a count that drifts from the game's), your pet names, the sort order, pins, region choice, filters, layout and the pets you are farming on this computer.

## Try it (developer mode)

Settings → Plugins: turn on **Plugin developer mode**, choose **Load plugin folder…**, pick this folder, then **Open**. Log in (or relog) to sync. After editing the files, **Check for updates** reloads them.
