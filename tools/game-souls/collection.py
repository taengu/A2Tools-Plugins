"""The skins and items Shugo's Ledger shows: every skin with its name in
each language, its slot and grade and where it comes from (the boxes that
hold it with their odds, the Black Market, the coin shops, Hidden Cubes,
rankings and dungeons, as the game's "where to get it" lists them), the
gathering nodes that drop Poko's Skin Bundle, and every Unique and Epic item
that drops, with its name, for the Kinah tab's Unique drops. Writes
plugins/pet-souls/collection.js.

    python tools/game-souls/collection.py --tables <Output>/AION2/Content/Data/Table [--tw-l10n <OutputTW>/.../Table/L10N]

zh-Hans is the Taiwan client's zh-TW through OpenCC (t2s), as the other
plugins' Simplified Chinese.
"""
import argparse
import json
import os
import re
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "plugins", "pet-souls", "collection.js")
LANG_DIRS = {"en": "en-US", "ko": "ko-KR", "ja": "ja-JP", "de": "de-DE", "fr": "fr-FR",
             "es": "es-ES", "pt": "pt-BR", "ru": "ru-RU"}
# As the game shows them: white Common, green Rare, blue Epic (the tables'
# "Legend"), yellow Unique, orange (the tables' "Epic") above it.
GRADES = {"EItemGrade::Common": 0, "EItemGrade::Rare": 1, "EItemGrade::Legend": 2,
          "EItemGrade::Unique": 3, "EItemGrade::Epic": 4}
SKIN_GRADES = {"ESkinGrade::Common": 0, "ESkinGrade::Rare": 1, "ESkinGrade::Legend": 2,
               "ESkinGrade::Unique": 3, "ESkinGrade::Epic": 4}
# The gathering node types, as the game's GatherSource names them.
NODE_TYPES = ["Herb", "Od", "Jewelry", "Shellfish", "RareMetal", "Tree", "Berry", "Vegetable", "Flower", "Metal"]
# The odds in RewardPackageItem are out of this.
PACKAGE_SCALE = 100_000_000


def load(tables, name):
    with open(os.path.join(tables, name + ".json"), encoding="utf-8") as f:
        return json.load(f)["Properties"]["Data"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", required=True)
    ap.add_argument("--tw-l10n", default=None)
    args = ap.parse_args()
    T = args.tables

    langs = {}
    for code, folder in LANG_DIRS.items():
        with open(os.path.join(T, "L10N", folder, "L10NString.json"), encoding="utf-8") as f:
            langs[code] = json.load(f)["Entries"]
    if args.tw_l10n:
        with open(os.path.join(args.tw_l10n, "zh-TW", "L10NString.json"), encoding="utf-8") as f:
            tw = json.load(f)["Entries"]
        langs["zh-Hant"] = tw
        import opencc
        t2s = opencc.OpenCC("t2s")
        langs["zh-Hans"] = {k: t2s.convert(v) for k, v in tw.items() if isinstance(v, str)}

    texts, text_index, by_content = [], {}, {}

    def text(key):
        """The index of a string in every language that has it, or None."""
        en = langs["en"].get(key)
        if not en or en == key:
            return None
        if key not in text_index:
            t = {"en": en}
            for code, entries in langs.items():
                x = entries.get(key)
                if code != "en" and x and x != key and x != en:
                    t[code] = x
            # The same words under another key (a skin's Elyos and Asmodian
            # names are often one) are kept once.
            same = json.dumps(t, ensure_ascii=False, sort_keys=True)
            if same not in by_content:
                by_content[same] = len(texts)
                texts.append(t)
            text_index[key] = by_content[same]
        return text_index[key]

    items = load(T, "Item")
    by_name = {i["Name"]: i for i in items}
    by_id = {i["ID"]["Value"]: i for i in items}

    # Skins, and the items that give each.
    skin_rows = load(T, "Skin")
    skin_by_name = {r["Name"]: r for r in skin_rows}
    items_of_skin = defaultdict(list)
    for item in items:
        if item.get("UseEffect") == "EItemUseEffect::GetSkin" and item.get("UseEffectValues"):
            skin = skin_by_name.get(str(item["UseEffectValues"][0]))
            if skin:
                items_of_skin[skin["ID"]["Value"]].append(item)

    # Boxes: the package each box opens (BoxReward), and what each package
    # holds with its odds (RewardPackageItem).
    packages = {r["PackageName"]: r["Items"] for r in load(T, "RewardPackageItem")}
    boxes_of_package = defaultdict(set)
    for b in load(T, "BoxReward"):
        for p in b.get("PackageItems") or []:
            boxes_of_package[p["Item"]].add(b["Group"])
    box_item_of_group = {}
    for item in items:
        if item.get("UseEffect") == "EItemUseEffect::RewardBox" and item.get("UseEffectValues"):
            box_item_of_group.setdefault(str(item["UseEffectValues"][0]), item["ID"]["Value"])
    # item name -> [(box item id, chance %)]
    box_odds = defaultdict(list)
    for package, contents in packages.items():
        box_ids = sorted({box_item_of_group[g] for g in boxes_of_package.get(package, ()) if g in box_item_of_group})
        for entry in contents:
            for box_id in box_ids:
                box_odds[entry["ItemName"]].append((box_id, round(entry["ItemProb"] * 100 / PACKAGE_SCALE, 4)))

    # The game's own "where to get it".
    routes = {r["ItemId"]["Value"]: r for r in load(T, "ItemGetRoute")}
    coin_shops = {}

    def sources_of(item):
        out = []
        for box_id, pct in box_odds.get(item["Name"], []):
            out.append(["box", box_id, pct])
        r = routes.get(item["ID"]["Value"]) or {}
        if r.get("RandomShopInfo"):
            out.append(["market"])
        for shop in r.get("CoinShopInfo") or []:
            key = shop["Key"]
            # Each side's battle pass shop is the one Pass Shop; the festival
            # and Nightmare shops have no name in the game (the plugin names them).
            plain = re.sub(r"_[LD]_", "_", key)
            coin_shops.setdefault(key, text("String_UI_%s_body" % plain.upper()))
            out.append(["coin", key])
        if r.get("HiddenCubeInfo"):
            out.append(["cube"])
        if r.get("RankingInfo"):
            out.append(["ranking"])
        for d in r.get("PartyDungeonGetRoutes") or []:
            for t in d["Value"]["TableIds"]:
                out.append(["dungeon", t["Value"]])
        seen, unique = set(), []
        for s in out:
            k = json.dumps(s)
            if k not in seen:
                seen.add(k)
                unique.append(s)
        return unique

    skins = {}
    for skin in skin_rows:
        sid = skin["ID"]["Value"]
        if not skin.get("bShow") or sid not in items_of_skin:
            continue
        light = text(skin["DescLight"]["Key"])
        dark = text(skin["DescDark"]["Key"])
        if light is None and dark is None:
            continue
        sources = []
        for item in items_of_skin[sid]:
            for s in sources_of(item):
                if s not in sources:
                    sources.append(s)
        row = {"n": light if light is not None else dark, "g": SKIN_GRADES.get(skin.get("Grade"), 0),
               "s": skin["SkinCategory"].split("::")[-1], "o": skin.get("Order", 0)}
        if dark is not None and dark != row["n"]:
            row["d"] = dark
        if sources:
            row["src"] = sources
        skins[sid] = row

    # The boxes the skins come from, by item id: name, and for gathering's
    # Poko's Skin Bundle the node types that drop it.
    gather_groups = {r["MaterialGroup"]: r["SourceType"].split("::")[-1] for r in load(T, "GatherSource")}
    nodes_of_item = defaultdict(set)
    for r in load(T, "GatherSourceMaterial"):
        for extra in r.get("AddMaterialList") or []:
            nodes_of_item[extra["Item"]].add(gather_groups.get(r["MaterialGroup"], "?"))
    boxes = {}
    for sid, row in skins.items():
        for s in row.get("src", []):
            if s[0] == "box" and s[1] not in boxes:
                item = by_id[s[1]]
                b = {"n": text("String_%s_body" % item["Desc"]["Key"]), "g": GRADES.get(item.get("ItemGrade"), 0)}
                nodes = sorted(nodes_of_item.get(item["Name"], ()), key=lambda t: NODE_TYPES.index(t) if t in NODE_TYPES else 99)
                if nodes:
                    b["nodes"] = nodes
                boxes[s[1]] = b

    # One box per name: each side has its own Poko's Skin Bundle item, the
    # same box to the player. Sources name the first; the nodes are both's.
    first_of_name = {}
    for box_id in sorted(boxes):
        b = boxes[box_id]
        keep = first_of_name.setdefault(b["n"], box_id)
        if keep != box_id:
            nodes = sorted(set(boxes[keep].get("nodes", [])) | set(b.get("nodes", [])),
                           key=lambda t: NODE_TYPES.index(t) if t in NODE_TYPES else 99)
            if nodes:
                boxes[keep]["nodes"] = nodes
    for row in skins.values():
        merged = []
        for src in row.get("src", []):
            if src[0] == "box":
                src = ["box", first_of_name[boxes[src[1]]["n"]], src[2]]
            if src not in merged:
                merged.append(src)
        if merged:
            row["src"] = merged
    boxes = {k: v for k, v in boxes.items() if first_of_name[v["n"]] == k}
    # Boxes are named without their "(Bound)", in every language.
    for b in boxes.values():
        t = texts[b["n"]]
        if t["en"].endswith("(Bound)"):
            for code in t:
                t[code] = re.sub(r"\s*[(（][^()（）]*[)）]\s*$", "", t[code])

    # Unique and Epic items that drop (from monsters, dungeons or gathering,
    # as the game lists them), with their names, for Unique drops.
    uniques = {}
    for item in items:
        g = GRADES.get(item.get("ItemGrade"))
        if g is None or g < 3:
            continue
        r = routes.get(item["ID"]["Value"]) or {}
        if not any(r.get(k) for k in ("MonsterGetRoutes", "PartyDungeonGetRoutes", "GatherGetRoutes")):
            continue
        n = text("String_%s_body" % item["Desc"]["Key"])
        if n is not None:
            uniques[item["ID"]["Value"]] = [g, n]

    # Drops: every monster's reward lists (`RewardData` names them;
    # `RewardItem` and `RewardPackage` hold the items and their odds, out of
    # 100,000,000), each list once; the monsters' and items' names.
    def v(x):
        return x["Value"]

    reward_data = {v(x["ID"]): x for x in load(T, "RewardData")}
    reward_item = {x["Name"]: x["Items"] for x in load(T, "RewardItem")}
    reward_pkg = {x["Name"]: x["PackageItems"] for x in load(T, "RewardPackage")}
    npc_rows = {v(x["ID"]): x for x in load(T, "NpcData")}
    list_index, drop_lists, mob_lists = {}, [], {}
    drop_items = {}

    def item_row(item):
        iid = item["ID"]["Value"]
        if iid not in drop_items:
            drop_items[iid] = [GRADES.get(item.get("ItemGrade"), 0), text("String_%s_body" % item["Desc"]["Key"])]
        return iid

    def reward_list(name):
        """The list's index in DROP_LISTS, or None when it holds no item."""
        if name in list_index:
            return list_index[name]
        entries = {}
        for it in reward_item.get(name, []):
            item = by_name.get(it["ItemName"])
            if item and it["ItemProb"] > 0:
                k = item_row(item)
                entries[k] = max(entries.get(k, 0), it["ItemProb"])
        for pk in reward_pkg.get(name, []):
            for it in packages.get(pk["Item"], []):
                item = by_name.get(it["ItemName"])
                if item and it["ItemProb"] > 0:
                    k = item_row(item)
                    entries[k] = max(entries.get(k, 0), pk["Prob"] * it["ItemProb"] // PACKAGE_SCALE)
        list_index[name] = len(drop_lists) if entries else None
        if entries:
            drop_lists.append(sorted(entries.items()))
        return list_index[name]

    def npc_name(npc):
        key = npc["Desc"]["Key"]
        return text(key) if key in langs["en"] else text("String_%s_body" % key)

    mob_names = {}
    for npc_id in sorted({v(x["NpcId"]) for x in load(T, "NpcLoot")}):
        r = reward_data.get(npc_id)
        if not r:
            continue
        names = list(r["BasicRewardName"]) + list(r["LevelscaleBasicRewardName"]) + list(r["BasicKeyRewards"])
        names += [n for n in (r["RewardName"], r["BasicRewardNameNoLvgap"], r["LevelscaleBasicRewardNameNoLvgap"]) if n and n != "None"]
        idx = [i for i in (reward_list(n) for n in dict.fromkeys(names)) if i is not None]
        if idx:
            mob_lists[npc_id] = idx
            if npc_id in npc_rows:
                mob_names[npc_id] = npc_name(npc_rows[npc_id])
    # Gathering's items and their extras, named too.
    for r in load(T, "GatherSourceMaterial"):
        for name in [r["MaterialName"]] + [x["Item"] for x in r.get("AddMaterialList") or []]:
            if name in by_name:
                item_row(by_name[name])

    # Every box and item name is bound or not in a last bracket in each
    # language ("(Bound)", "(각인)"): the lists leave that out, as shop.js.
    last = re.compile(r"\s*[(（][^()（）]*[)）]\s*$")
    named_items = ({b["n"] for b in boxes.values() if b["n"] is not None} | {u[1] for u in uniques.values()}
                   | {d[1] for d in drop_items.values() if d[1] is not None})
    for code in {c for i in named_items for c in texts[i]}:
        named = [texts[i] for i in named_items if code in texts[i]]
        tails = Counter(m.group(0).strip() for t in named for m in [last.search(t[code])] if m)
        bound = [tail for tail, n in tails.most_common(3) if n * 20 >= len(named) and "ound" in tail or tail in ("(각인)", "(귀속)")]
        for t in named:
            for tail in bound:
                if t[code].rstrip().endswith(tail):
                    t[code] = t[code].rstrip()[: -len(tail)].rstrip()
                    break

    def lines(d):
        return ",\n".join(f"  {k}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))}" for k, v in sorted(d.items()))

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(
            "// Skins, the boxes they come from, and Unique items, for Shugo's Ledger.\n"
            "// Generated by tools/game-souls/collection.py from the game's tables: don't\n"
            "// edit by hand.\n"
            "// Each skin (Skin id -> n: name in COLLECTION_TEXT, d: the Asmodian name when\n"
            "// it differs, g: grade 0 Common to 4, s: slot, o: the game's order, src:\n"
            "// [\"box\", item id, chance %] | [\"market\"] | [\"coin\", shop] | [\"cube\"] |\n"
            "// [\"ranking\"] | [\"dungeon\", id]).\n"
            f"const SKINS = {{\n{lines(skins)},\n}};\n"
            "// The boxes (item id -> n: name, g: grade, nodes: the gathering node types that drop it).\n"
            f"const SKIN_BOXES = {{\n{lines(boxes)},\n}};\n"
            "// The coin shops (key -> name in COLLECTION_TEXT, or null).\n"
            f"const COIN_SHOPS = {json.dumps(coin_shops, separators=(',', ':'))};\n"
            "// Unique and Epic items (item id -> [grade 3 Unique / 4 Epic, name]).\n"
            f"const UNIQUE_ITEMS = {{\n{lines(uniques)},\n}};\n"
            "// Items that drop or are gathered (item id -> [grade 0 Common to 4, name]).\n"
            f"const DROP_ITEMS = {{\n{lines(drop_items)},\n}};\n"
            "// Each reward list once: [[item id, chance per kill out of 100,000,000], ...].\n"
            "const DROP_LISTS = [\n" + ",\n".join("  " + json.dumps(l, separators=(",", ":")) for l in drop_lists) + ",\n];\n"
            "// Each monster's reward lists (NPC id -> indexes into DROP_LISTS).\n"
            f"const MOB_LISTS = {json.dumps({str(k): x for k, x in sorted(mob_lists.items())}, separators=(',', ':'))};\n"
            "// Their names (NPC id -> name in COLLECTION_TEXT).\n"
            f"const MOB_NAMES = {json.dumps({str(k): x for k, x in sorted(mob_names.items())}, separators=(',', ':'))};\n"
            "// The names, in each language that has its own (English otherwise).\n"
            "const COLLECTION_TEXT = [\n" + ",\n".join("  " + json.dumps(t, ensure_ascii=False) for t in texts) + ",\n];\n"
        )
    by_src = Counter(s[0] for r in skins.values() for s in r.get("src", []))
    print(f"{len(skins)} skins ({sum(1 for r in skins.values() if 'src' not in r)} with no known source), "
          f"sources {dict(by_src)}, {len(boxes)} boxes, {len(coin_shops)} coin shops, {len(uniques)} Unique/Epic items, "
          f"{len(drop_items)} drop items, {len(drop_lists)} reward lists for {len(mob_lists)} monsters, "
          f"{len(texts)} names, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
