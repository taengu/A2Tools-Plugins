# Writing a plugin

## Try it locally

1. Make a folder under `plugins/` named after your plugin's id (lowercase letters, digits, `-`).
2. In the meter, open **Settings → Plugins** and turn on **Plugin developer mode**.
3. Choose **Load plugin folder…** and pick your folder, then select **Open**.
4. After you edit your files, select **Check for updates**. The meter reads the folder again and reloads the plugin's window.

Developer-mode plugins carry an "Unreviewed plugin" badge.

## The folder

```
plugins/my-plugin/
  manifest.json   id, name, version, apiVersion, author, description, permissions, decoders, ui
  index.html      the page, loaded in the plugin's window
  *.js *.css      its scripts and styles (no inline scripts: script-src 'self')
  *.json *.png …  data and images
  README.md       for reviewers and players (not shipped)
  changes.json    What's new: each recent version's notes (not shipped; goes into the catalog)
```

Allowed file types: `.html .js .css .json .png .jpg .jpeg .webp .svg .gif .md .txt`. A plugin can be at most 8 MB.

`changes.json` says what each recent version added, shown to players in the meter's update prompt and in Settings → Plugins (meter 2.0.81 on). Newest first, at most 5 versions, none newer than the manifest's; English required, the other languages (`ko ja de fr es pt ru zh-Hant zh-Hans`) optional, each note at most 300 characters. It goes into the signed catalog, not the plugin's files, so a note can be added or corrected without a new version:

```json
[
  { "version": "1.1.0", "en": "A volume for its alerts.", "de": "Eine Lautstärke für die Alarme." },
  { "version": "1.0.0", "en": "First version." }
]
```

`manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "apiVersion": 1,
  "author": "Your name",
  "description": "One sentence: what it shows the player.",
  "permissions": ["storage"],
  "decoders": [],
  "ui": { "panel": { "width": 360, "height": 480 } }
}
```

## The API

Load `/_sdk/a2.js` before your own scripts. It provides `a2`:

```js
a2.on("decoded:<name>", (data) => …)  // your decoder read a packet       (decoder:<name>)
a2.on("character", (c) => …)          // name, serverId, class, level     (events:character)
a2.on("kda", ({ kind, at }) => …)         // "kill", "assist" or "death" against a player (events:kda; needs a meter that sends it)
a2.on("language", (code) => …)        // "en", "ko", "zh-Hans", … at start and on change
a2.on("compact", (on) => …)           // the window's fold button: show only the essentials
a2.on("theme", (t) => …)              // the Settings colours {bg, panel, accent}, at start and on change (meter 2.0.76)
await a2.storage.get("key")           // your saved JSON, or null           (storage)
await a2.storage.set("key", value)
a2.notify("Text")                     // a short message in your window     (notify)
await a2.window.show() / hide()       // your window, without taking focus  (window, API 2)
await a2.watchFps(true)               // the game's FPS as a2.on("fps", ({ fps, state }) => …) about every second; (fps, meter 2.0.78)
                                      // state "ok", "noGame", "needsAdmin" or "unsupported"; false stops
await a2.fpsAdmin()                   // Windows: ask the player to restart the meter as administrator, for FPS (fps)
a2.ready()                            // once your handlers are set: queued events arrive then
// In a widget's page (widgets permission):
a2.widget.area({ x, y, width, height })    // the part that takes the mouse; clicks elsewhere go through to the game
a2.widget.areas([{ x, y, width, height }, …])  // the same as several parts, up to 64 (meter 2.0.77)
```

## Look

Report only what you draw with `a2.widget.areas`: the gaps between your icons, and room you keep for more, then let clicks through to the game. On older meters, fall back to one box around them with `a2.widget.area`.

Keep the page background transparent. The window paints the panel at the opacity the player picks. Don't set `color-scheme` on `:root` or `body` either: it makes the page opaque and the opacity slider stops working.

The window takes the colours the player picks in **Settings → Appearance → Settings colours**. Your page gets them as CSS variables (meter 2.0.76 and later):

| Variable | What it is |
|---|---|
| `--a2-accent` | the accent: selected tabs, switches, focus rings, highlights |
| `--a2-bg` | the panel's background |
| `--a2-panel` | a slightly different background, for lists and menus |

Use the accent for your interface's highlights, with a fallback for older meters, and mix it for tints:

```css
.tab.active { border-color: var(--a2-accent, #8fc2ff); }
.row:hover  { background: color-mix(in srgb, var(--a2-accent, #8fc2ff) 15%, transparent); }
```

Keep colours that mean something (ready green, low-HP red, rarity gold) as they are.

The meter also styles your page's selects, checkboxes, radio buttons, sliders and scrollbars to match the Settings window. Its rules have no specificity, so any rule of your own wins. If you style a `select` yourself, keep `appearance: none` and draw the chevron, or it falls back to the webview's grey box. The official plugins show one way to do it; it also looks right on older meters.

## Decoders

A decoder turns one game packet (by its two-byte opcode) into numbers. It reads only what it names, and only from the player's own game data (or monsters' and bosses', see below).

```json
{ "name": "soul-gained", "opcode": "0D 90",
  "fields": [ { "type": "skip:1" }, { "name": "pet", "type": "u32" }, { "name": "amount", "type": "u32" } ] }
```

Field types: `u8 u16 u32 u64 i32 varint`, `skip:N`, and `list` (with a `count` of `u8 u16 u32 varint` and its own `fields`). Lists can nest two deep, and a decoder can read at most 32 fields. Each decoder needs the permission `decoder:<name>`.

`"self": "<field>"` (plugin API 2) names a number field that holds an entity id: the meter passes the event on only when that entity is the player's own character. Use it to tell "I did this" without ever seeing anyone else.

With `events:character`, a plugin's events reach it half a second after they are read, stamped with the character: at login the game sends some data (the pet list) just before the record saying who is playing. `"immediate": true` on a decoder skips that wait, for records that never come at login, such as a soul picked up; it never overtakes an earlier event of the plugin that is still waiting. Meters up to 2.0.63 ignore it and hold the event as before, so it needs no new `apiVersion`.

### Monsters' and bosses' data

A plugin that needs it may read monsters' and bosses' casts and buffs (NPC data), for example `09 38` (a cast starts), `02 38` (a skill goes off), `2A 38` / `2C 38` (a buff added / removed), without `"self"`. These records come for every entity, players too, so the plugin must:

- keep only what its own table of NPC skill and buff ids names, and ignore the rest at once;
- never store, show or send on another player's id, casts or buffs, nor keep an entity id longer than it needs to tell which boss it is;
- read no other player's data in any other way (names, gear, damage, positions): that stays forbidden.

For accessibility plugins the boundary is what the game itself shows or plays: a boss's line, its cast bar, the buff on it and its time, a mechanic's colour or animation. Such a plugin may put that into words, sound or big text. It must not predict what the game doesn't show (a hidden timer, the next skill, who will be targeted), reveal hidden information, or act for the player.

## Plugin API versions

- `"apiVersion": 1` runs on meter 2.0.60 and later.
- `"apiVersion": 2` adds a decoder's `"self"` field and the `window` permission, and needs meter 2.0.62. Older meters say the plugin needs a newer meter rather than run it.

## Submitting

Open a pull request. Before it's merged, review checks that:

- the permissions match what the plugin does;
- the decoders read only what the description says;
- nothing tries to leave the sandbox (other frames, the meter, the network);
- the player's data stays on their computer.

Before opening it, run `python tools/build_catalog.py`. It runs the same checks as CI.

A plugin submitted here is published under this repository's [GPL-3.0](LICENSE) license.
