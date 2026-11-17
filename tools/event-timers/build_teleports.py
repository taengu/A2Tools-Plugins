"""Build Event Timers' teleports.js: each boss's nearest teleport (Kibelisk).

    python tools/event-timers/build_teleports.py --tables <...>/AION2/Content/Data/Table
        [--tw-l10n <TW ...>/AION2/Content/Data/Table/L10N]

Run it after tools/event-timers/build.py: it reads the bosses from the
plugin's schedule.js (FIELD_BOSSES by world-map id, the scheduled bosses of
EVENTS by event id) and finds them in the same extract:

  WorldMapFieldNamed  a field boss's spawner (FieldNamedSpawnerName) and map
  PeriodSpawn         a scheduled boss's spawner; rows grouped by start times
                      and weekdays, as build.py groups them into events, on
                      the event's maps (Map.json's names for them)
  Map/**/MapData.json SpawnInfoList: a spawner's Positions (cm);
                      TeleportDataMap: where each teleport actor lands you
  TeleportArtifact    the teleports players unlock: Race (side), Order (the
                      number the game's teleport list shows) and Teleport, a
                      row of Teleport.json, whose MapId and ActorName give the
                      map and the TeleportDataMap entry
  EnvObjData, L10N    the teleport's name: its Kibelisk's Desc (the env object
                      whose UsageValue is TeleportArtifact_<id>), else the
                      <QK>…</> of TeleportArtifact_TeleportArtifact_<id>_detail_desc

Nearest = the smallest 3D distance from the spawn point to the teleport's
landing spot, among the teleports of the boss's own map that the side may use
(Race Light/Dark/All); never one of another map. A spawner with several
points is measured from their medoid (the point closest to the others), and
skipped when its points lie far apart (it spawns at one of them at random).
Order 999 marks teleports the game doesn't list: those are left out. Where a
side's teleports on a map all share one Order (the Abyss: all 1), the number
says nothing, so only the name is given.

Big map files are streamed with ijson (pip install ijson) to keep memory low.
"""
import argparse
import json
import math
import os
import re
import sys
from collections import defaultdict

import ijson

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLUGIN = os.path.join(REPO, "plugins", "event-timers")
LANG_DIRS = {"en": "en-US", "ko": "ko-KR", "ja": "ja-JP", "de": "de-DE", "fr": "fr-FR",
             "es": "es-ES", "pt": "pt-BR", "ru": "ru-RU"}
RACE = {"ERace::Light": "elyos", "ERace::Dark": "asmodian", "ERace::All": None}
SIDES = ("elyos", "asmodian")
DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
TICKS_PER_MIN = 600_000_000
HIDDEN_ORDER = 999
# A spawner whose points are further than this (m) from their medoid spawns
# somewhere different each time: no single nearest teleport.
SPREAD_M = 300
# Where players say to teleport instead of the nearest: the nearest by
# distance is not the way there. Boss key -> side -> TeleportArtifact id.
PREFERRED = {
    # Black Tentacle Lawa: from 44, Ancient Zumion Temple Site, not 38 (2026-10-30).
    "field:101011": {"elyos": 1051060},
    # Kashapa (Asmodian): from 50, not 54 (2026-11-17).
    "field:111023": {"asmodian": 1052042},
}


def v(x):
    return x["Value"] if isinstance(x, dict) else x


def rows(path):
    with open(path, "rb") as f:
        yield from ijson.items(f, "Properties.Data.item")


def js_const(src, name):
    """A `const NAME = <json>;` from a generated .js file."""
    m = re.search(r"^const " + name + r" = (.*?);\n(?=//|const |\Z)", src, re.S | re.M)
    if not m:
        sys.exit(f"schedule.js: no const {name}")
    return json.loads(m.group(1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", default=os.environ.get("A2_GAME_TABLES", ""))
    ap.add_argument("--tw-l10n", default=None, help="the Taiwan client's extracted Table/L10N folder (zh-TW)")
    ap.add_argument("--schedule", default=os.path.join(PLUGIN, "schedule.js"))
    ap.add_argument("--out", default=os.path.join(PLUGIN, "teleports.js"))
    a = ap.parse_args()
    T = a.tables
    if not T or not os.path.isdir(T):
        sys.exit("--tables: the extracted Data/Table folder (or set A2_GAME_TABLES)")
    data_dir = os.path.dirname(os.path.normpath(T))

    with open(a.schedule, encoding="utf-8") as f:
        src = f.read()
    events = [e for e in js_const(src, "EVENTS") if e["kind"] == "boss"]
    field_ids = set(js_const(src, "FIELD_BOSSES"))
    del src

    # Bosses -> spawners: (key, boss name key or None, map id, spawner name).
    targets = []
    for r in rows(os.path.join(T, "WorldMapFieldNamed.json")):
        if str(v(r["ID"])) in field_ids:
            targets.append(("field:" + str(v(r["ID"])), None, v(r["MapId"]), r["FieldNamedSpawnerName"]))
    found = {t[0][6:] for t in targets}
    for fid in sorted(field_ids - found):
        print(f"field boss {fid}: not in WorldMapFieldNamed", file=sys.stderr)
    by_slot = defaultdict(list)
    for r in rows(os.path.join(T, "PeriodSpawn.json")):
        if "RiftPortal" in r["Name"]:
            continue
        first = int(r["Time"]["Ticks"]) // TICKS_PER_MIN
        cycle = r["Cycle"]
        starts = tuple(range(first, 24 * 60, cycle)) if cycle else (first,)
        days = tuple(i for i, d in enumerate(DAYS) if r.get("b" + d))
        by_slot[(starts, days)].append((v(r["MapId"]), r["SpawnerName"]))
    # An event names its maps by text key (as build.py writes them): keep the
    # slot's spawners on those maps only (build.py leaves closed maps out).
    map_key = {}
    for r in rows(os.path.join(T, "Map.json")):
        k = r["Desc"]["Key"]
        map_key[v(r["ID"])] = {k, "String_" + k + "_body"}
    for e in events:
        for mid, spawner in by_slot.get((tuple(e["starts"]), tuple(e["days"])), []):
            if map_key.get(mid, set()) & set(e["where"]):
                targets.append((e["id"], None, mid, spawner))

    # Teleports: artifact id -> (side, order, map, actor, detail-desc key).
    tel = {}
    for r in rows(os.path.join(T, "Teleport.json")):
        tel[r["Name"]] = (v(r["MapId"]), r["ActorName"])
    arts = {}
    for r in rows(os.path.join(T, "TeleportArtifact.json")):
        mid, actor = tel.get(r["Teleport"], (None, None))
        if mid is None or "," in actor:
            continue
        arts[v(r["ID"])] = {"side": RACE.get(r["Race"]), "order": r["Order"], "map": mid,
                            "actor": actor, "desc": r["DetailDesc"]["Key"]}
    del tel
    maps = {t[2] for t in targets}

    # Map files, streamed: spawner points and teleport landing spots.
    want_spawners = defaultdict(set)
    for _, _, mid, sp in targets:
        want_spawners[mid].add(sp)
    want_actors = defaultdict(set)
    for x in arts.values():
        if x["map"] in maps:
            want_actors[x["map"]].add(x["actor"])
    points = {}  # (map, spawner) -> [(x, y, z)], spawner npc
    landing = {}  # (map, actor) -> (x, y, z)
    for root, dirs, files in os.walk(os.path.join(data_dir, "Map")):
        dirs.sort()
        if "MapData.json" not in files or "InstanceLayer" in root.replace("\\", "/").split("/"):
            continue
        path = os.path.join(root, "MapData.json")
        with open(path, "rb") as f:
            mid = next((int(x) for p, e, x in ijson.parse(f) if p == "Properties.Data.MapId"), None)
        if mid not in maps:
            continue
        with open(path, "rb") as f:
            for sp in ijson.items(f, "Properties.Data.SpawnInfoList.item"):
                if sp["Name"] in want_spawners[mid] and sp["Positions"]:
                    pts = [tuple(float(q["Location"][k]) for k in "XYZ") for q in sp["Positions"]]
                    npc = v(sp["NpcIdList"][0]) if sp["NpcIdList"] else None
                    points[(mid, sp["Name"])] = (pts, npc)
        with open(path, "rb") as f:
            for kv in ijson.items(f, "Properties.Data.TeleportDataMap.item"):
                if kv["Key"] in want_actors[mid]:
                    landing[(mid, kv["Key"])] = tuple(float(kv["Value"]["Location"][k]) for k in "XYZ")

    # Boss names for scheduled events with several bosses, from NpcData.
    npc_ids = {points[(m, s)][1] for k, _, m, s in targets if not k.startswith("field:") and (m, s) in points}
    npc_name = {}
    for r in rows(os.path.join(T, "NpcData.json")):
        if v(r["ID"]) in npc_ids:
            npc_name[v(r["ID"])] = r["Desc"]["Key"]

    # Each map's teleports per side, and whether their numbers mean anything.
    cands = {}
    for mid in maps:
        for side in SIDES:
            c = [(aid, x) for aid, x in arts.items()
                 if x["map"] == mid and x["side"] in (side, None) and x["order"] < HIDDEN_ORDER
                 and (mid, x["actor"]) in landing]
            orders = [x["order"] for _, x in c]
            cands[(mid, side)] = (c, len(set(orders)) == len(orders) and len(orders) > 1)

    out = defaultdict(list)
    used = set()
    skipped = []
    for key, _, mid, spawner in targets:
        if (mid, spawner) not in points:
            skipped.append((key, f"spawner {spawner} not in map {mid}"))
            continue
        pts, npc = points[(mid, spawner)]
        med = min(pts, key=lambda p: sum(math.dist(p, o) for o in pts))
        spread = max(math.dist(med, p) for p in pts) / 100
        if spread > SPREAD_M:
            skipped.append((key, f"spawner {spawner}: {len(pts)} points up to {spread:,.0f} m apart"))
            continue
        entry = {}
        for side in SIDES:
            c, numbered = cands[(mid, side)]
            if not c:
                continue
            aid, x = min(c, key=lambda t: math.dist(landing[(mid, t[1]["actor"])], med))
            want = PREFERRED.get(key, {}).get(side)
            aid, x = next(((a, y) for a, y in c if a == want), (aid, x))
            d = math.dist(landing[(mid, x["actor"])], med) / 100
            entry[side] = {**({"tp": x["order"]} if numbered else {}), "name": str(aid), "dist": round(d)}
            used.add(aid)
        if not entry:
            skipped.append((key, f"no teleport on map {mid}"))
            continue
        if not key.startswith("field:") and npc in npc_name:
            k = npc_name[npc]
            entry["boss"] = k if k.startswith("String_") else "String_" + k + "_body"  # schedule.js's keys
        out[key].append(entry)

    # Teleport names: the Kibelisk's own name (EnvObjData whose UsageValue is
    # TeleportArtifact_<id>), else the <QK>place</> of the detail description
    # (some languages decline it there: "teleport to ...").
    env_desc = {}
    for r in rows(os.path.join(T, "EnvObjData.json")):
        m = re.match(r"TeleportArtifact_(\d+)$", r.get("UsageValue") or "")
        # Basic_TeleportArtifact_L/D_01 are the generic "Elyos/Asmodian Kibelisk".
        if (m and int(m.group(1)) in used and r.get("Usage") == "EEnvObjectUsage::TeleportArtifact"
                and not r.get("Name", "").startswith("Basic_")):
            env_desc.setdefault(int(m.group(1)), r["Desc"]["Key"])
    want_env = {k: str(aid) for aid, k in env_desc.items()}
    want_desc = {arts[aid]["desc"]: str(aid) for aid in used}
    names = defaultdict(dict)
    fallback = defaultdict(dict)
    sources = [(code, os.path.join(T, "L10N", folder, "L10NString.json")) for code, folder in LANG_DIRS.items()]
    if a.tw_l10n:
        sources.append(("zh-Hant", os.path.join(a.tw_l10n, "zh-TW", "L10NString.json")))
    for code, path in sources:
        with open(path, "rb") as f:
            for k, s in ijson.kvitems(f, "Entries"):
                if k in want_env and s and s != k:
                    names[want_env[k]][code] = s.strip()
                elif k in want_desc:
                    m = re.search(r"<QK>(.*?)</>", s or "")
                    if m:
                        fallback[want_desc[k]][code] = m.group(1).strip()
    for aid, t in fallback.items():
        for code, x in t.items():
            names[aid].setdefault(code, x)
    try:
        import opencc
        t2s = opencc.OpenCC("t2s").convert
        for t in names.values():
            if "zh-Hant" in t:
                t["zh-Hans"] = t2s(t["zh-Hant"])
    except ImportError:
        print("opencc missing: no zh-Hans names", file=sys.stderr)
    for t in names.values():
        for code in list(t):
            if code != "en" and t[code] == t.get("en"):
                del t[code]

    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Each boss's nearest teleport, from the game's own map data.\n")
        f.write("// Generated by tools/event-timers/build_teleports.py: don't edit by hand.\n")
        f.write("// Key: \"field:<world-map id>\" or a scheduled boss's event id; one entry per\n")
        f.write("// spawner, per side: tp = the teleport list's number (absent where it says\n")
        f.write("// nothing), name = TELEPORT_TEXT key, dist = metres to the spawn point.\n")
        f.write("const TELEPORTS = " + json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")
        f.write("const TELEPORT_TEXT = " + json.dumps(names, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")
    print(f"wrote {a.out}: {len(out)} bosses, {len(used)} teleports", file=sys.stderr)
    for key, why in skipped:
        print(f"  skipped {key}: {why}", file=sys.stderr)
    for key in sorted(out):
        for e in out[key]:
            print(f"  {key:26} " + "  ".join(
                f"{s[:3]} #{e[s].get('tp', '-')} {names[e[s]['name']].get('en', '?')[:28]} {e[s]['dist']} m"
                for s in SIDES if s in e), file=sys.stderr)


if __name__ == "__main__":
    main()
