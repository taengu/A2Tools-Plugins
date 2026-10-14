"""Build the Pet Soul Tracker's sources.js from AION 2's own game data.

    python tools/game-souls/gamesouls.py --tables <...>/Output/AION2/Content/Data/Table

The data comes from the game client, extracted with Aion2DataExtractor
(github.com/adainrivers/aion2-data-extractor) with these Include prefixes:
    AION2/Content/Data/Table, AION2/Content/Data/Map, AION2/Content/Data/MapDataHierarchy
--tables is the Table folder; Map and MapDataHierarchy are found beside it.
Writes plugins/pet-souls/sources.js. --compare <old sources.js> also writes a
report of what changed (--report), --debug the ids behind each row.

Chain (all client tables under AION2/Content/Data/Table):
  VehicleList.ID (pet id) .SoulItemName -> Item.Name (soul item; also
      Item.UseEffect == GetVehicleSoul, UseEffectValues[0] == pet id)
  drops:  NpcLoot (NpcId, VehicleSoulItemId)  +  ItemGetRoute[soul].MonsterGetRoutes
            (NpcId, RegionInfo.MapId/SubzoneId/KibeliskIds)
          NpcData[NpcId]  -> name (Desc), Level
          RewardData[NpcId].BasicRewardName/LevelscaleBasicRewardName
            -> RewardItem[name].Items[ItemName == soul].ItemProb (1e8 = 100%)
            -> RewardPackage[name].PackageItems (Prob, 1e8) -> RewardPackageItem items
          Subzone[SubzoneId].DisplayName, Map[MapId].Desc -> "zone · map"
          EnvObjData[KibeliskId].Desc (Kibelisk name),
            .UsageValue "TeleportArtifact_<id>" -> TeleportArtifact.Order (map number)
  chests: BoxReward(Group).PackageItems(Prob, 1e4 = 100%) -> RewardPackageItem items
          (1e8 = 100%); box item = Item whose UseEffectValues[0] == Group;
          where the box comes from = the box item's own ItemGetRoute entry.
  spawns: Map/**/MapData.json SpawnInfoList (NPC ids, positions); the zone is
          the smallest SubzoneVolumeInfoMap polygon holding the spawn; the
          Kibelisk is the TeleportArtifact env object nearest the spawns'
          medoid (per side in the Abyss, where each side has its own).
"""
import argparse
import math
import json
import os
import re
import sys
from collections import defaultdict

DEFAULT_TABLES = os.environ.get("A2_GAME_TABLES", "")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load(tables, name):
    with open(os.path.join(tables, name), encoding="utf-8") as f:
        return json.load(f)["Properties"]["Data"]


def v(x):
    return x["Value"] if isinstance(x, dict) else x


def pct(p, scale):
    """A probability as metabot writes it: 100%, 2.44%."""
    x = p * 100.0 / scale
    if abs(x - round(x)) < 1e-9:
        return f"{int(round(x))}%"
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s + "%"


# Where a box comes from, from its own ItemGetRoute entry (field -> label).
ROUTE_LABELS = [
    ("BattlePassInfo", "Battle pass"),
    ("MembershipPassInfo", "Membership pass"),
    ("AchievementInfo", "Achievements"),
    ("AttendanceInfo", "Attendance"),
    ("BMShopInfo", "Shop"),
    ("CoinShopInfo", "Coin shop"),
    ("NPCShopInfo", "NPC shop"),
    ("RandomShopInfo", "Random shop"),
    ("QuestGetRoutes", "Quests"),
    ("MonsterGetRoutes", "Monsters"),
    ("PartyDungeonGetRoutes", "Party dungeons"),
    ("TrialDungeonGetRoutes", "Trial dungeons"),
    ("RaidInfo", "Raids"),
    ("FieldEventInfo", "Field events"),
    ("PeriodCollectionInfo", "Collections"),
    ("OnboardingInfo", "Onboarding"),
    ("DailyInfo", "Daily dungeons"),
    ("SubscribeInfo", "Subscription"),
    ("CraftGetRoutes", "Crafting"),
    ("DecomposeItemInfos", "Decomposing"),
    ("ConversionRecipeGetRoutes", "Conversion"),
    ("MonolithInfo", "Monoliths"),
    ("HiddenCubeInfo", "Hidden cubes"),
    ("AwakenInfo", "Awakening"),
    ("AscensionInfo", "Ascension"),
    ("RankingInfo", "Rankings"),
    ("SuppressionInfo", "Suppression"),
    ("ExtraInfo", "Other"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", default=DEFAULT_TABLES)
    ap.add_argument("--lang", default="en-US")
    ap.add_argument("--out", default=os.path.join(REPO, "plugins", "pet-souls", "sources.js"))
    ap.add_argument("--compare", default=None, help="an earlier sources.js to report the changes against")
    ap.add_argument("--report", default="diff_report.txt")
    ap.add_argument("--debug", action="store_true", help="also write <out>_debug.json: the ids behind each row")
    ap.add_argument("--chances", action=argparse.BooleanOptionalAction, default=True,
                    help="include drop chances (from RewardData/RewardItem)")
    ap.add_argument("--infer-model-key", action="store_true",
                    help="also list Abyss NPCs whose reward_<ResourceKey>_key holds the soul")
    a = ap.parse_args()
    T = a.tables
    if not T or not os.path.isdir(T):
        sys.exit("--tables: the extracted Data/Table folder (or set A2_GAME_TABLES)")

    with open(os.path.join(T, "L10N", a.lang, "L10NString.json"), encoding="utf-8") as f:
        S = json.load(f)["Entries"]

    def tr(key):
        if not key or key == "None":
            return ""
        return S.get(key) or S.get("String_" + key + "_body") or key

    print("loading tables...", file=sys.stderr)
    vehicles = load(T, "VehicleList.json")
    items = load(T, "Item.json")
    item_by_name = {x["Name"]: x for x in items}
    item_by_id = {v(x["ID"]): x for x in items}
    npcs = {v(x["ID"]): x for x in load(T, "NpcData.json")}
    reward_data = {v(x["ID"]): x for x in load(T, "RewardData.json")}
    reward_item = {x["Name"]: x["Items"] for x in load(T, "RewardItem.json")}
    reward_pkg = {x["Name"]: x["PackageItems"] for x in load(T, "RewardPackage.json")}
    pkg_items = {x["PackageName"]: x["Items"] for x in load(T, "RewardPackageItem.json")}
    subzones = {v(x["ID"]): x for x in load(T, "Subzone.json")}
    maps = {v(x["ID"]): x for x in load(T, "Map.json")}
    env = {v(x["ID"]): x for x in load(T, "EnvObjData.json")}
    tele_art = {v(x["ID"]): x for x in load(T, "TeleportArtifact.json")}
    boxes = load(T, "BoxReward.json")
    routes = {v(x["ItemId"]): x for x in load(T, "ItemGetRoute.json")}
    npc_loot = defaultdict(list)
    for x in load(T, "NpcLoot.json"):
        if v(x["VehicleSoulItemId"]):
            npc_loot[v(x["VehicleSoulItemId"])].append(v(x["NpcId"]))
    box_item_by_group = {}
    for x in items:
        if x.get("UseEffect") == "EItemUseEffect::RewardBox" and x.get("UseEffectValues"):
            box_item_by_group.setdefault(x["UseEffectValues"][0], x)

    def npc_chance(npc_id, soul_name):
        """Best chance one kill drops the soul, from the NPC's reward lists."""
        rd = reward_data.get(npc_id)
        if not rd:
            return None, []
        names = list(rd["BasicRewardName"]) + list(rd["LevelscaleBasicRewardName"]) + list(rd["BasicKeyRewards"])
        for n in (rd["RewardName"], rd["BasicRewardNameNoLvgap"], rd["LevelscaleBasicRewardNameNoLvgap"]):
            if n and n != "None":
                names.append(n)
        best, via = None, []
        for n in dict.fromkeys(names):
            for it in reward_item.get(n, []):
                if it["ItemName"] == soul_name:
                    p = it["ItemProb"] / 1e8
                    via.append(n)
                    best = max(best or 0, p)
            for pk in reward_pkg.get(n, []):
                for it in pkg_items.get(pk["Item"], []):
                    if it["ItemName"] == soul_name:
                        p = pk["Prob"] / 1e8 * it["ItemProb"] / 1e8
                        via.append(n + ">" + pk["Item"])
                        best = max(best or 0, p)
        return best, via

    def abyss_style(npc_id):
        rd = reward_data.get(npc_id)
        return bool(rd) and not (rd["BasicRewardName"] or rd["LevelscaleBasicRewardName"] or rd["BasicKeyRewards"])

    soul_names = {x["SoulItemName"] for x in vehicles}
    model_key_npcs = defaultdict(list)
    for npc_id, n in npcs.items():
        if not abyss_style(npc_id) or not n["Name"].startswith("M_AR"):
            continue
        for it in reward_item.get("reward_" + n["ResourceKey"] + "_key", []):
            if it["ItemName"] in soul_names:
                model_key_npcs[it["ItemName"]].append(npc_id)

    # Area code in the NPC's internal name -> map id (codes seen with map ids
    # in WorldMapFieldNamed/PeriodSpawn). Used only when no route gives a map.
    AREA_MAP = {"L1": 1010, "D1": 1110, "L2": 1011, "D2": 1111, "AR1": 20, "AR3": 22}

    def map_from_name(n):
        m = re.match(r"M_([A-Z]+\d*)_", n["Name"])
        return AREA_MAP.get(m.group(1)) if m else None

    def kibelisk(ids):
        for i in ids:
            e = env.get(v(i))
            if not e:
                continue
            name = tr(e["Desc"]["Key"])
            order = None
            m = re.match(r"TeleportArtifact_(\d+)$", e.get("UsageValue", ""))
            if m and int(m.group(1)) in tele_art:
                order = tele_art[int(m.group(1))]["Order"]
            return name, order
        return None, None

    # Soul -> chests: every BoxReward whose packages hold the soul.
    chests_by_soul = defaultdict(list)
    for b in boxes:
        for pk in b["PackageItems"]:
            for it in pkg_items.get(pk["Item"], []):
                chests_by_soul[it["ItemName"]].append((b, pk["Prob"] / 1e4 * it["ItemProb"] / 1e8))
        for it in b["Items"]:
            if "Prob" in it:
                chests_by_soul[it["Item"]].append((b, it["Prob"] / 1e4))

    def box_from(box_item):
        r = routes.get(v(box_item["ID"])) if box_item else None
        if not r:
            return ""
        labels = [lab for key, lab in ROUTE_LABELS if r.get(key)]
        if r.get("RewardBoxInfo", {}).get("BoxDatas") or r.get("RewardBoxInfo", {}).get("BoxClassDatas"):
            labels.append("Other boxes")
        return "The box comes from " + ", ".join(labels) if labels else ""

    # ---- Map data: spawns, subzone volumes, Kibelisk positions -------------
    data_dir = os.path.dirname(os.path.normpath(T))  # .../Content/Data
    print("loading map data...", file=sys.stderr)
    hierarchy = defaultdict(list)  # soul item id -> [(map, subzone, npc)]
    hier_npc_subzones = defaultdict(set)  # (map, npc) -> {subzone}
    hp = os.path.join(data_dir, "MapDataHierarchy", "MapDataHierarchy.json")
    if os.path.exists(hp):
        with open(hp, encoding="utf-8") as f:
            H = json.load(f)
        soul_ids = {v(x["ID"]) for x in items if x.get("UseEffect") == "EItemUseEffect::GetVehicleSoul"}
        for w in H["Worlds"]:
            for sz in w["SubZones"]:
                for t in sz["NPCTypes"]:
                    for n in t["NPCs"]:
                        hier_npc_subzones[(w["Id"], n["Id"])].add(sz["Id"])
                        for it in n["Items"]:
                            if it["Id"] in soul_ids:
                                hierarchy[it["Id"]].append((w["Id"], sz["Id"], n["Id"]))
    spawns = defaultdict(lambda: defaultdict(list))  # npc -> map -> [(x,y,z)]
    volumes = defaultdict(list)  # map -> [(priority, subzone id, zmin, zmax, bbox, poly)]
    kibs = defaultdict(list)  # map -> [(envobj id, (x,y,z))]
    layer_maps = set()
    for root, _, files in os.walk(os.path.join(data_dir, "Map")):
        if "MapData.json" not in files:
            continue
        with open(os.path.join(root, "MapData.json"), encoding="utf-8") as f:
            md = json.load(f)["Properties"]["Data"]
        mid = md["MapId"]
        if "InstanceLayer" in root.replace("\\", "/").split("/"):
            layer_maps.add(mid)
        for sp in md["SpawnInfoList"]:
            pos = [(p["Location"]["X"], p["Location"]["Y"], p["Location"]["Z"]) for p in sp["Positions"]]
            for x in sp["NpcIdList"]:
                spawns[v(x)][mid].extend(pos)
            for x in sp["EnvObjIdList"]:
                e = env.get(v(x))
                if e and e.get("Usage") == "EEnvObjectUsage::TeleportArtifact":
                    kibs[mid].extend((v(x), q) for q in pos)
        for kv in md.get("SubzoneVolumeInfoMap", []):
            vol = kv["Value"]
            sid_ = vol["SubzoneTableId"]
            b = vol["Boundary2D"]
            poly = [(q["X"], q["Y"]) for q in vol["Points"]]
            # Finest area wins: sort key is the polygon's area (the map-wide
            # subzone, e.g. "Verteron", is the largest and only a fallback).
            pr = abs(sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))) / 2 or float("inf")
            volumes[mid].append((pr, sid_, vol["HeightMin"], vol["HeightMax"],
                                 (b["Min"]["X"], b["Min"]["Y"], b["Max"]["X"], b["Max"]["Y"]), poly))
    for mid in volumes:
        volumes[mid].sort(key=lambda t: t[0])  # smallest area first

    def inside(poly, x, y):
        c = False
        j = len(poly) - 1
        for i in range(len(poly)):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
                c = not c
            j = i
        return c

    def subzone_at(mid, x, y, z):
        for pr, sid_, zmin, zmax, bb, poly in volumes.get(mid, []):
            if bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and zmin <= z <= zmax and inside(poly, x, y):
                return sid_
        # Height ranges are sometimes tight; retry ignoring height.
        for pr, sid_, zmin, zmax, bb, poly in volumes.get(mid, []):
            if bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and inside(poly, x, y):
                return sid_
        return None

    def kib_race(eid):
        """A Kibelisk's side: "elyos", "asmodian", or None for either."""
        m = re.match(r"TeleportArtifact_(\d+)$", env[eid].get("UsageValue", ""))
        race = tele_art.get(int(m.group(1)), {}).get("Race", "") if m else ""
        return {"ERace::Light": "elyos", "ERace::Dark": "asmodian"}.get(race)

    def nearest_kibelisk(mid, pos, side=None):
        """Nearest Kibelisk to the spawn medoid (the spawn point with the
        smallest summed 2D distance to the others), measured in 2D. With
        `side`, only that side's Kibelisks (and those of either side)."""
        cands = kibs.get(mid)
        if side:
            cands = [c for c in cands or [] if kib_race(c[0]) in (side, None)]
        if not cands or not pos:
            return None
        sample = pos if len(pos) <= 400 else pos[:: max(1, len(pos) // 400)]
        med = min(sample, key=lambda p: sum(math.hypot(p[0] - o[0], p[1] - o[1]) for o in sample))
        eid, q = min(cands, key=lambda c: math.hypot(c[1][0] - med[0], c[1][1] - med[1]))
        dist = math.hypot(q[0] - med[0], q[1] - med[1]) / 100.0  # cm -> m
        e = env[eid]
        order = None
        m = re.match(r"TeleportArtifact_(\d+)$", e.get("UsageValue", ""))
        if m and int(m.group(1)) in tele_art:
            order = tele_art[int(m.group(1))]["Order"]
        return tr(e["Desc"]["Key"]), round(dist), order, eid

    def join_zones(subs):
        if len(subs) <= 1:
            return "".join(subs)
        if len(subs) == 2:
            return " and ".join(subs)
        return ", ".join(subs[:-1]) + ", and " + subs[-1]

    out, debug = {}, {}
    for veh in vehicles:
        if veh["SoulItemName"] == "None":
            continue
        pet_id = v(veh["ID"])
        soul = item_by_name.get(veh["SoulItemName"])
        if not soul:
            print(f"pet {pet_id}: soul item {veh['SoulItemName']} missing", file=sys.stderr)
            continue
        sid = v(soul["ID"])
        sname = soul["Name"]
        route = routes.get(sid, {})
        # Which NPCs drop the soul, and which maps each source puts them on.
        npc_src = defaultdict(set)
        npc_maps = defaultdict(set)
        route_kib = {}
        for r in route.get("MonsterGetRoutes", []):
            nid, ri = v(r["NpcId"]), r["RegionInfo"]
            npc_src[nid].add("route")
            npc_maps[nid].add(v(ri["MapId"]))
            route_kib.setdefault(nid, [v(k) for k in ri.get("KibeliskIds", [])])
        for mid, szid, nid in hierarchy.get(sid, []):
            npc_src[nid].add("hierarchy")
            npc_maps[nid].add(mid)
        for nid in npc_loot.get(sid, []):
            npc_src[nid].add("npcloot")
        if a.infer_model_key:
            for nid in model_key_npcs.get(sname, []):
                npc_src[nid].add("model_key")
        drops, dbg = [], []
        for npc_id in sorted(npc_src):
            n = npcs.get(npc_id)
            if not n:
                continue
            chance, via = npc_chance(npc_id, sname)
            if chance is None and abyss_style(npc_id):
                for it in reward_item.get("reward_" + n["ResourceKey"] + "_key", []):
                    if it["ItemName"] == sname:
                        chance = it["ItemProb"] / 1e8
                        via = ["reward_" + n["ResourceKey"] + "_key (by model, inferred)"]
            # One row per map the NPC spawns on (instance layers only when it
            # spawns nowhere else); maps named by the routes/hierarchy without
            # spawn data still get a row.
            sp_maps = dict(spawns.get(npc_id, {}))
            main = {m: p for m, p in sp_maps.items() if m not in layer_maps}
            use = dict(main or sp_maps)
            if not use:  # no spawn data at all: rows for the maps the routes/hierarchy name
                for m in npc_maps[npc_id]:
                    use.setdefault(m, [])
            if not use:
                use = {None: []}
            for mid, pos in sorted(use.items(), key=lambda kv: -len(kv[1])):
                d = {"name": tr(n["Desc"]["Key"]), "level": str(n["Level"])}
                if a.chances:
                    d["chance"] = pct(chance, 1) if chance is not None else "?"
                cnt = defaultdict(int)
                for x, y, z in pos:
                    cnt[subzone_at(mid, x, y, z)] += 1
                subs = [tr(subzones[s_]["DisplayName"]["Key"])
                        for s_, _ in sorted(cnt.items(), key=lambda kv: -kv[1]) if s_ in subzones]
                if not subs:  # no spawn data: hierarchy, then route subzones
                    ids_ = sorted(hier_npc_subzones.get((mid, npc_id), ()))
                    ids_ += [v(r["RegionInfo"]["SubzoneId"]) for r in route.get("MonsterGetRoutes", [])
                             if v(r["NpcId"]) == npc_id and v(r["RegionInfo"]["MapId"]) == mid]
                    subs = [tr(subzones[s_]["DisplayName"]["Key"]) for s_ in ids_ if s_ in subzones]
                subs = list(dict.fromkeys(subs))
                parts = [join_zones(subs) or "?"]
                if mid in maps:
                    parts.append(tr(maps[mid]["Desc"]["Key"]) or maps[mid]["Name"])
                if pos:
                    parts.append(f"{len(pos)} spawn" + ("" if len(pos) == 1 else "s"))
                d["where"] = " · ".join(parts)
                k = nearest_kibelisk(mid, pos)
                if k:
                    d["kibelisk"] = f"{k[0]} · {k[1]:,} m"
                    if k[2]:
                        d["teleport"] = k[2]
                # In the Abyss each side has Kibelisks of its own: the nearest
                # one each side can use, where the two differ.
                races = {kib_race(c[0]) for c in kibs.get(mid, [])}
                if {"elyos", "asmodian"} <= races:
                    by_side = {}
                    for side in ("elyos", "asmodian"):
                        ks = nearest_kibelisk(mid, pos, side)
                        if ks:
                            by_side[side] = {"kibelisk": f"{ks[0]} · {ks[1]:,} m", **({"teleport": ks[2]} if ks[2] else {})}
                    if by_side:
                        d["bySide"] = by_side
                drops.append(d)
                dbg.append({"npc": npc_id, "npc_name": n["Name"], "grade": n["Grade"], "map": mid,
                            "sources": sorted(npc_src[npc_id]), "rewards": via,
                            "chance": chance, "spawns": len(pos), "route_kibelisk": route_kib.get(npc_id),
                            "kibelisk_envobj": k[3] if k else None,
                            "subzone_counts": {str(s_): c for s_, c in cnt.items()}})
        chests = []
        for b, p in chests_by_soul.get(sname, []):
            bi = box_item_by_group.get(b["Group"])
            c = {"name": tr(bi["Desc"]["Key"]) if bi else b["Group"], "chance": pct(p, 1) + " per opening"}
            f = box_from(bi)
            if f:
                c["from"] = f
            chests.append(c)
        out[str(pet_id)] = {"title": tr(soul["Desc"]["Key"]), "soul_item": sid, "drops": drops, "chests": chests}
        debug[str(pet_id)] = dbg

    with open(a.out, "w", encoding="utf-8") as f:
        f.write("// Where each pet's souls come from, keyed by pet id: the monsters that drop\n")
        f.write("// them and the chests that hold them, from the game's own tables and map\n")
        f.write("// data. Generated by tools/game-souls/gamesouls.py: don't edit by hand.\n")
        f.write("const PET_SOURCES = " + json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")
    if a.debug:
        with open(os.path.splitext(a.out)[0] + "_debug.json", "w", encoding="utf-8") as f:
            json.dump(debug, f, ensure_ascii=False, indent=1)
    print(f"wrote {a.out}: {len(out)} pets, {sum(1 for e in out.values() if e['drops'])} with drops, "
          f"{sum(1 for e in out.values() if e['chests'])} with chests", file=sys.stderr)

    if a.compare and os.path.exists(a.compare):
        compare(out, a.compare, a.report)


def compare(game, path, report):
    t = open(path, encoding="utf-8").read()
    t = t[t.index("{"): t.rindex("}") + 1]
    meta = json.loads(t)
    L = []
    stats = defaultdict(int)

    def split_where(d):
        w = d.get("where", "").split(" · ")
        zone = w[0] if w else ""
        mp = w[1] if len(w) > 1 else ""
        sp = None
        if len(w) > 2:
            m_ = re.match(r"([\d,]+) spawns?", w[2])
            sp = int(m_.group(1).replace(",", "")) if m_ else None
        zones = None if zone in ("", "?") else {x.strip() for x in re.split(r",? and |, ", zone) if x.strip()}
        return zones, mp, sp

    def split_kib(d):
        k = d.get("kibelisk", "")
        if not k:
            return None, None
        parts = k.split(" · ")
        dist = None
        if len(parts) > 1:
            m_ = re.match(r"([\d,]+) m", parts[1])
            dist = int(m_.group(1).replace(",", "")) if m_ else None
        return parts[0], dist

    ids = sorted(set(game) | set(meta), key=int)
    for pid in ids:
        g, m = game.get(pid), meta.get(pid)
        if not m:
            stats["pets_only_game"] += 1
            if g and (g["drops"] or g["chests"]):
                L.append(f"{pid} {g['title']}: only in game data ({len(g['drops'])} drops, {len(g['chests'])} chests)")
            continue
        if not g:
            stats["pets_only_metabot"] += 1
            L.append(f"{pid} {m['title']}: only in metabot")
            continue
        stats["pets_both"] += 1
        if g["drops"]:
            stats["pets_game_has_drops"] += 1
        if m["drops"]:
            stats["pets_metabot_has_drops"] += 1
        msgs = []
        if g["title"] != m["title"]:
            msgs.append(f"  title game={g['title']!r} metabot={m['title']!r}")

        def dk(d):
            return (d["name"], str(d.get("level")), split_where(d)[1])
        gk, mk = {}, {}
        for d in g["drops"]:
            gk.setdefault(dk(d), d)
        for d in m["drops"]:
            mk.setdefault(dk(d), d)
        # A side without a map matches the other side's entry by name + level.
        for side, other in ((gk, mk), (mk, gk)):
            for k in [k for k in side if k not in other]:
                cands = [o for o in other if o[:2] == k[:2] and o not in side]
                if len(cands) == 1 and (not k[2] or not cands[0][2]):
                    side[cands[0]] = side.pop(k)
        for k in sorted(set(gk) | set(mk)):
            gd, md = gk.get(k), mk.get(k)
            if not md:
                stats["drop_only_game"] += 1
                msgs.append(f"  + game-only drop: {gd['name']} Lv {gd['level']} @ {gd.get('where', '?')} (kibelisk {gd.get('kibelisk', '-')} #{gd.get('teleport', '-')})")
                continue
            if not gd:
                stats["drop_only_metabot"] += 1
                msgs.append(f"  - metabot-only drop: {md['name']} Lv {md.get('level')} {md.get('chance')} @ {md.get('where', '?')}")
                continue
            stats["drop_match"] += 1
            if "chance" in gd and str(gd.get("chance")) != str(md.get("chance")):
                stats["drop_chance_diff"] += 1
            gz, _, gs = split_where(gd)
            mz, _, ms = split_where(md)
            if gz is not None and mz is not None:
                mz2 = {x.split(" - ")[0] for x in mz}
                gz2 = {x.split(" - ")[0] for x in gz}
                if gz == mz:
                    stats["zones_same"] += 1
                elif gz2 == mz2:
                    stats["zones_same_area"] += 1
                else:
                    stats["zones_diff"] += 1
                    msgs.append(f"  ~ {k[0]} Lv {k[1]} ({k[2]}): zones game={sorted(gz)} metabot={sorted(mz)}")
            if ms is not None:
                if gs == ms:
                    stats["spawns_same"] += 1
                elif ms == 60 and gs is not None and gs > 60:
                    stats["spawns_metabot_capped_at_60"] += 1
                elif gs is None:
                    stats["spawns_missing_game"] += 1
                else:
                    stats["spawns_diff"] += 1
                    msgs.append(f"  ~ {k[0]} Lv {k[1]} ({k[2]}): spawns game={gs} metabot={ms}")
            elif gs is not None:
                stats["spawns_only_game"] += 1
            gkn, gdist = split_kib(gd)
            mkn, mdist = split_kib(md)
            if mkn:
                if gkn == mkn:
                    stats["kibelisk_same"] += 1
                    if gdist is not None and mdist is not None:
                        stats["kibelisk_dist_exact" if gdist == mdist else
                              "kibelisk_dist_within_5m" if abs(gdist - mdist) <= 5 else "kibelisk_dist_diff"] += 1
                else:
                    stats["kibelisk_diff"] += 1
                    msgs.append(f"  ~ {k[0]} Lv {k[1]} ({k[2]}): kibelisk game={gd.get('kibelisk')!r} metabot={md.get('kibelisk')!r}")
            elif gkn:
                stats["kibelisk_only_game"] += 1
            if "teleport" in md:
                if str(gd.get("teleport")) in str(md["teleport"]).split("/"):
                    stats["teleport_same"] += 1
                else:
                    stats["teleport_diff"] += 1
            elif "teleport" in gd:
                stats["teleport_only_game"] += 1
        gc = {c["name"]: c for c in g["chests"]}
        mc = {c["name"]: c for c in m["chests"]}
        for n in sorted(set(gc) | set(mc)):
            if n not in mc:
                stats["chest_only_game"] += 1
                msgs.append(f"  + game-only chest: {n} {gc[n]['chance']} ({gc[n].get('from', '')})")
            elif n not in gc:
                stats["chest_only_metabot"] += 1
                msgs.append(f"  - metabot-only chest: {n} {mc[n]['chance']}")
            else:
                stats["chest_match"] += 1
                if gc[n]["chance"] != mc[n]["chance"]:
                    stats["chest_chance_diff"] += 1
                    msgs.append(f"  ~ chest {n}: game={gc[n]['chance']} metabot={mc[n]['chance']}")
                if gc[n].get("from") != mc[n].get("from"):
                    stats["chest_from_diff"] += 1
                    msgs.append(f"  ~ chest {n}: from game={gc[n].get('from')!r} metabot={mc[n].get('from')!r}")
        if msgs:
            stats["pets_with_diffs"] += 1
            L.append(f"{pid} {g['title']}:")
            L.extend(msgs)
        else:
            stats["pets_identical"] += 1
    head = ["Summary (game tables + map data vs metabot sources.js):"] + [f"  {k}: {stats[k]}" for k in sorted(stats)] + [""]
    with open(report, "w", encoding="utf-8") as f:
        f.write("\n".join(head + L) + "\n")
    print("\n".join(head), file=sys.stderr)
    print(f"wrote {report}", file=sys.stderr)


if __name__ == "__main__":
    main()
