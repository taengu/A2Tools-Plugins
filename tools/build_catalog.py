"""Check every plugin under plugins/ and build the catalog the meter installs from.

    python tools/build_catalog.py            check only (pull requests)
    python tools/build_catalog.py dist       check, then write dist/

dist/ then holds, ready to upload to cdn.a2tools.app/plugins/:

    index.json                  every plugin: id, version, permissions, and each
                                file's SHA-256 (the meter checks each file it
                                downloads against this)
    <id>/<version>/<file>       the plugin's files
    <id>/<version>.a2pk         the same files in one download (meter 2.0.90 on):
                                its SHA-256 is the entry's "pack"; see pack()

The release workflow signs index.json (index.json.sig) with the key only it
holds. The meter refuses a catalog whose signature does not match, and a file
whose hash does not match the signed catalog.
"""

import gzip
import hashlib
import json
import struct
import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLUGINS = ROOT / "plugins"
API_VERSIONS = {1, 2}  # 2: decoders' "self" field and the "window" permission
MAX_PLUGIN = 8 * 1024 * 1024
ID = re.compile(r"^[a-z0-9-]{1,40}$")
VERSION = re.compile(r"^\d+\.\d+\.\d+$")
PART = re.compile(r"^[A-Za-z0-9._-]+$")
# What a plugin may ship: its page, scripts, styles, data and images.
ALLOWED = {".html", ".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".md", ".txt"}
# Not shipped to players (still reviewed in the repo).
SKIP = {"README.md", "changes.json"}
# feed:boss-timers: the shared field boss timers (a2.bossTimers, the bossMap
# event; meter 2.0.65). A meter without it simply has no a2.bossTimers.
# "widgets": small windows of the plugin's own (a2.widgets, meter 2.0.68).
# "fps": the game's frame rate (a2.watchFps, a2.fpsAdmin; meter 2.0.78).
# Frames no decoder may read (the meter's REFUSED_OPCODES): another player
# coming into view, and players' movement.
REFUSED_OPCODES = {"44 36", "45 36", "1E 37", "1F 37", "20 37", "28 37", "29 37", "2A 37"}
PERMISSIONS = {"storage", "notify", "events:character", "window", "feed:boss-timers", "widgets", "fps", "events:death-recap", "events:loot-rolls", "events:kda", "screenshot"}
DECODER_TYPES = {"u8", "u16", "u32", "u64", "i32", "varint", "list"}


def fail(plugin, message):
    raise SystemExit(f"plugins/{plugin}: {message}")


def check_decoders(name, fields, depth=1):
    if depth > 2:
        fail(name, "decoders nest at most two lists deep")
    if len(fields) > 32:
        fail(name, "a decoder reads at most 32 fields")
    for field in fields:
        kind = field.get("type", "")
        if kind.startswith("skip:"):
            if not kind[5:].isdigit():
                fail(name, f"bad skip {kind!r}")
            continue
        if kind not in DECODER_TYPES:
            fail(name, f"field type {kind!r} is not one the meter knows")
        if kind == "list":
            if field.get("count") not in {"u8", "u16", "u32", "varint"}:
                fail(name, "a list needs a count of u8, u16, u32 or varint")
            check_decoders(name, field.get("fields", []), depth + 1)


# What's new: a plugin's changes.json, each recent version's notes per
# language, newest first, shown by the meter in the update prompt and
# Settings → Plugins (2.0.81 on; older meters ignore it). It goes into the
# catalog, not the plugin's files, so notes can be written or corrected
# without a new version of the plugin.
LANGS = {"en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"}
MAX_CHANGES = 5
MAX_NOTE = 300


def version_key(v):
    return tuple(int(x) for x in v.split("."))


def check_changes(name, folder, manifest):
    path = folder / "changes.json"
    changes = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else []
    if not isinstance(changes, list) or len(changes) > MAX_CHANGES:
        fail(name, f"changes: a list of at most {MAX_CHANGES} versions")
    last = None
    for c in changes:
        if not isinstance(c, dict) or not VERSION.match(str(c.get("version", ""))):
            fail(name, "changes: each needs a version like 1.2.3")
        v = version_key(c["version"])
        if v > version_key(manifest["version"]):
            fail(name, f"changes: {c['version']} is newer than the plugin's version")
        if last is not None and v >= last:
            fail(name, "changes: newest first, each version once")
        last = v
        if not str(c.get("en", "")).strip():
            fail(name, f"changes {c['version']}: needs an English note (en)")
        for key, text in c.items():
            if key == "version":
                continue
            if key not in LANGS:
                fail(name, f"changes {c['version']}: unknown language {key!r}")
            if not isinstance(text, str) or not text.strip() or len(text) > MAX_NOTE:
                fail(name, f"changes {c['version']} {key}: a note of 1 to {MAX_NOTE} characters")
    return changes


# A plugin version's files in one download: gzip of b"A2PK1\n", then for each
# file in path order a u16 LE path length, the path (UTF-8), a u32 LE size and
# the bytes. The meter checks the pack against its hash in the signed catalog,
# and each file in it against its own, as it would a file downloaded alone.
PACK_MAGIC = b"A2PK1\n"
CDN = "https://cdn.a2tools.app/plugins"


def pack(folder, files):
    body = bytearray(PACK_MAGIC)
    for rel in sorted(files):
        data = (folder / rel).read_bytes()
        path = rel.encode("utf-8")
        body += struct.pack("<H", len(path)) + path + struct.pack("<I", len(data)) + data
    return gzip.compress(bytes(body), compresslevel=9, mtime=0)


def unpacked(packed):
    """A pack's files, path → SHA-256."""
    raw = gzip.decompress(packed)
    if not raw.startswith(PACK_MAGIC):
        raise ValueError("not a pack")
    at, files = len(PACK_MAGIC), {}
    while at < len(raw):
        (n,) = struct.unpack_from("<H", raw, at)
        path = raw[at + 2 : at + 2 + n].decode("utf-8")
        (size,) = struct.unpack_from("<I", raw, at + 2 + n)
        at += 2 + n + 4
        files[path] = hashlib.sha256(raw[at : at + size]).hexdigest()
        at += size
    return files


def published_pack(entry):
    """The version's pack as already published, when it is: a published
    version never changes, and the same files gzipped by another zlib (a
    runner update) could come out different, its hash with them. None for a
    version not published yet; a published pack whose files aren't the
    version's stops the build."""
    import urllib.error
    import urllib.request

    # The query keeps a plain GET from caching a 404 at the edge for a key
    # the upload is about to put (see the uploader's wait_for_edge).
    url = f"{CDN}/{entry['id']}/{entry['version']}.a2pk?build={int(time.time())}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "A2Tools-Plugins catalog"}), timeout=60) as r:
            packed = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    if unpacked(packed) != entry["files"]:
        fail(entry["id"], f"{entry['version']}.a2pk on the CDN doesn't hold this version's files: bump the version")
    return packed


def check(folder):
    name = folder.name
    manifest_path = folder / "manifest.json"
    if not manifest_path.is_file() or not (folder / "index.html").is_file():
        fail(name, "needs manifest.json and index.html")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("id") != name or not ID.match(name):
        fail(name, "the manifest's id must match its folder: lowercase letters, digits and '-'")
    if not VERSION.match(str(manifest.get("version", ""))):
        fail(name, "version must look like 1.2.3")
    api = manifest.get("apiVersion")
    if api not in API_VERSIONS:
        fail(name, f"apiVersion must be one of {sorted(API_VERSIONS)}")
    if api < 2 and ("window" in manifest.get("permissions", []) or any("self" in d for d in manifest.get("decoders", []))):
        fail(name, 'the "window" permission and a decoder\'s "self" need apiVersion 2')
    for key in ("name", "description", "author"):
        if not str(manifest.get(key, "")).strip():
            fail(name, f"the manifest needs a {key}")
    decoders = manifest.get("decoders", [])
    decoder_names = {d.get("name") for d in decoders}
    for permission in manifest.get("permissions", []):
        if permission.startswith("decoder:"):
            if permission[8:] not in decoder_names:
                fail(name, f"{permission} has no decoder of that name")
        elif permission not in PERMISSIONS:
            fail(name, f"unknown permission {permission!r}")
    for decoder in decoders:
        if f"decoder:{decoder.get('name')}" not in manifest.get("permissions", []):
            fail(name, f"decoder {decoder.get('name')} needs the permission decoder:{decoder.get('name')}")
        if not re.fullmatch(r"[0-9A-Fa-f]{2} [0-9A-Fa-f]{2}", decoder.get("opcode", "")):
            fail(name, f"decoder {decoder.get('name')}: opcode must look like \"0D 90\"")
        # As the meter refuses them: players coming into view, and moving.
        if decoder.get("opcode", "").upper() in REFUSED_OPCODES:
            fail(name, f"decoder {decoder.get('name')}: frames {decoder['opcode']} can't be read by plugins")
        check_decoders(name, decoder.get("fields", []))
        if not isinstance(decoder.get("immediate", False), bool):
            fail(name, f"decoder {decoder.get('name')}: \"immediate\" must be true or false")
        if "self" in decoder:
            numbers = {f.get("name") for f in decoder.get("fields", []) if f.get("type") in {"u16", "u32", "u64", "varint"}}
            if decoder["self"] not in numbers:
                fail(name, f"decoder {decoder.get('name')}: \"self\" must name one of its number fields")

    changes = check_changes(name, folder, manifest)

    files = {}
    total = 0
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        rel = path.relative_to(folder).as_posix()
        if rel in SKIP or rel in (".unpublished", ".test"):
            continue
        if not all(PART.match(part) and part not in {".", ".."} for part in rel.split("/")) or len(rel) > 128:
            fail(name, f"file name {rel!r}: letters, digits, '.', '-' and '_' only")
        if path.suffix.lower() not in ALLOWED:
            fail(name, f"{rel}: {path.suffix} files are not allowed")
        data = path.read_bytes()
        total += len(data)
        files[rel] = hashlib.sha256(data).hexdigest()
    if total > MAX_PLUGIN:
        fail(name, f"larger than {MAX_PLUGIN} bytes")
    entry = {
        "id": name,
        "name": manifest["name"],
        "version": manifest["version"],
        "apiVersion": manifest["apiVersion"],
        "description": manifest["description"],
        "author": manifest["author"],
        "permissions": manifest.get("permissions", []),
        "source": f"https://github.com/taengu/A2Tools-Plugins/tree/main/plugins/{name}",
        "files": files,
    }
    if changes:
        entry["changes"] = changes
    return entry


def main():
    folders = sorted(p for p in PLUGINS.iterdir() if p.is_dir())
    # A folder with an `.unpublished` file is checked but kept out of the
    # catalog: a plugin still in the works, used locally in developer mode.
    # A folder with a `.test` file goes into the test catalog (test/index.json,
    # signed the same way): meters from 2.0.78 install it by id, and don't
    # list it until installed; older meters never see it.
    entries = []
    tests = []
    for folder in folders:
        entry = check(folder)
        if (folder / ".unpublished").exists():
            print(f"--  {entry['id']} {entry['version']}  (unpublished: not in the catalog)")
        elif (folder / ".test").exists():
            tests.append(entry)
        else:
            entries.append(entry)
    for e in entries:
        print(f"ok  {e['id']} {e['version']}  ({len(e['files'])} files)")
    for e in tests:
        print(f"ok  {e['id']} {e['version']}  ({len(e['files'])} files, test)")
    if len(sys.argv) < 2:
        return
    dist = Path(sys.argv[1])
    shutil.rmtree(dist, ignore_errors=True)
    for e in entries + tests:
        for rel in e["files"]:
            target = dist / e["id"] / e["version"] / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(PLUGINS / e["id"] / rel, target)
        packed = published_pack(e) or pack(PLUGINS / e["id"], e["files"])
        (dist / e["id"] / f"{e['version']}.a2pk").write_bytes(packed)
        e["pack"] = hashlib.sha256(packed).hexdigest()
    # Each build's serial, its time: a meter (2.0.87 on) refuses a catalog
    # older than one it has read, so an old signed index can't be served
    # again to hold back an update (audit L2).
    serial = int(time.time())
    catalog = {"format": 1, "serial": serial, "plugins": entries}
    (dist / "index.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {dist}/index.json")
    if tests:
        (dist / "test").mkdir(parents=True, exist_ok=True)
        test_catalog = {"format": 1, "serial": serial, "plugins": tests}
        (dist / "test" / "index.json").write_text(json.dumps(test_catalog, ensure_ascii=False, indent=1, sort_keys=True) + chr(10), encoding="utf-8")
        print(f"wrote {dist}/test/index.json")


if __name__ == "__main__":
    main()
