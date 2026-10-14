# A2 Tools plugins

Reviewed plugins for the [A2 Tools DPS Meter](https://a2tools.app), the damage meter for AION 2. Plugins add features beside the meter, each in a small window of its own.

| Plugin | What it does |
|---|---|
| [Pet Soul Tracker](plugins/pet-souls) | How many souls each of your pets still needs to reach level 3, from the game's own pet data, with filters by genus and level, in all ten meter languages, and where each pet's souls drop and the nearest teleport, from the game's own data. |

## Install a plugin

1. Update the meter to 2.0.60 or later. Plugins that use plugin API 2 need 2.0.62.
2. Open **Settings → Plugins**.
3. Under **Available**, choose **Install**. The meter lists what the plugin will be able to do before you agree.
4. Choose **Open** to show its window. **Check for updates** fetches newer reviewed versions.

## How plugins are checked

Every plugin here is reviewed before it's published, and the meter installs nothing else:

1. A plugin lives in its own folder under `plugins/`, and every change arrives as a pull request.
2. **Check plugins** runs on each pull request. It checks the manifest, the permissions, the decoders and the file types (`tools/build_catalog.py`).
3. After review, the change is merged. **Publish plugins** then:
   - builds the catalog, `index.json`, which lists every plugin's version and permissions and the SHA-256 of each of its files;
   - signs it with an Ed25519 key that only this workflow holds;
   - uploads the catalog and the files to `cdn.a2tools.app/plugins/`.
4. The meter installs only from a catalog whose signature matches the public key built into it, and only files whose hashes match that catalog. A plugin from anywhere else won't install.

A published version never changes. To change a plugin, raise its `version`: the workflow refuses changed files under a version that's already out.

### Verify the catalog yourself

The catalog's public key (Ed25519, hex) is:

```
d71e888cd5530b57254a4f87bf8f1861d8ddd8f7ddf45ecdba0771bb8f7d54ae
```

With OpenSSL 3:

```bash
curl -sO https://cdn.a2tools.app/plugins/index.json
curl -sO https://cdn.a2tools.app/plugins/index.json.sig
printf '302a300506032b6570032100%s' d71e888cd5530b57254a4f87bf8f1861d8ddd8f7ddf45ecdba0771bb8f7d54ae | xxd -r -p > pub.der
openssl pkey -pubin -inform DER -in pub.der -out pub.pem
xxd -r -p index.json.sig > index.sig
openssl pkeyutl -verify -pubin -inkey pub.pem -rawin -in index.json -sigfile index.sig
```

It prints `Signature Verified Successfully`. Each file's SHA-256 in `index.json` then matches the file at `cdn.a2tools.app/plugins/<id>/<version>/<file>`.

## What a plugin can and can't do

A plugin runs in a sandboxed frame with no network, no access to the meter, and no access to other plugins. It gets only what its manifest asks for, and the player sees those permissions in plain words before installing:

| Permission | What it allows |
|---|---|
| `storage` | Save its own data on this computer (per plugin, up to 1 MB per key) |
| `notify` | Show short messages in its window |
| `events:character` | See the player's own character: name, server, class and level |
| `window` | Show and hide its own window, without taking focus from the game (plugin API 2) |
| `decoder:<name>` | Receive the numbers its own named decoder reads from the player's game data |

Decoders read numbers only, never text, so no name can be read from game data. A decoder can also ask the meter to pass an event on only when a given entity is the player's own character: the plugin then never sees anyone else's id.

## Write a plugin

See [CONTRIBUTING.md](CONTRIBUTING.md): how to try one locally in the meter's developer mode, the manifest, the API, decoders, and how to submit.

## Problems

Report a problem with a plugin in this repository's issues, and a problem with the meter in [A2Tools-DPS-Meter](https://github.com/taengu/A2Tools-DPS-Meter/issues).
