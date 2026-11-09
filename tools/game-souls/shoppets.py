"""What the Black Cloud Merchants sell, for Pet Soul Tracker's Black Market:
the pet each pet item gives (Vehicle_*_b, "Pet: ..."), and every skin and
Theostone on their lists, with its name in each language and its grade. The
meter's blackMarket event names the item. Writes plugins/pet-souls/shop.js.

    python tools/game-souls/shoppets.py --tables <Output>/AION2/Content/Data/Table [--tw-l10n <OutputTW>/.../Table/L10N]

zh-Hans is the Taiwan client's zh-TW through OpenCC (t2s), as the other
plugins' Simplified Chinese.
"""
import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "plugins", "pet-souls", "shop.js")
LANG_DIRS = {"en": "en-US", "ko": "ko-KR", "ja": "ja-JP", "de": "de-DE", "fr": "fr-FR",
             "es": "es-ES", "pt": "pt-BR", "ru": "ru-RU"}
KINDS = {"EItemUseEffect::GetSkin": "skin", "EItemUseEffect::GetGodstone": "theostone"}
# As the game shows them: white Common, green Rare, blue Epic (the tables'
# "Legend"), yellow Unique.
GRADES = {"EItemGrade::Common": 0, "EItemGrade::Rare": 1, "EItemGrade::Legend": 2, "EItemGrade::Unique": 3}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", required=True)
    ap.add_argument("--tw-l10n", default=None)
    args = ap.parse_args()
    items = load(os.path.join(args.tables, "Item.json"))["Properties"]["Data"]
    pets = {}
    for item in items:
        if item.get("UseEffect") == "EItemUseEffect::GetVehicle" and item.get("UseEffectValues"):
            pets[item["ID"]["Value"]] = int(item["UseEffectValues"][0])

    langs = {}
    for code, folder in LANG_DIRS.items():
        langs[code] = load(os.path.join(args.tables, "L10N", folder, "L10NString.json"))["Entries"]
    if args.tw_l10n:
        tw = load(os.path.join(args.tw_l10n, "zh-TW", "L10NString.json"))["Entries"]
        langs["zh-Hant"] = tw
        import opencc
        t2s = opencc.OpenCC("t2s")
        langs["zh-Hans"] = {k: t2s.convert(v) for k, v in tw.items() if isinstance(v, str)}

    # The game's own ids, which its owned lists name: a skin's Skin id (by the
    # item's skin name) and a Theostone's Godstone id (by its name string).
    skin_ids = {r["Name"]: r["ID"]["Value"] for r in load(os.path.join(args.tables, "Skin.json"))["Properties"]["Data"]}
    stone_ids = {r["NameString"]["Key"].upper(): r["GodstoneId"]["Value"]
                 for r in load(os.path.join(args.tables, "GodstoneData.json"))["Properties"]["Data"]}

    def game_id(item):
        value = str(item["UseEffectValues"][0])
        if item["UseEffect"] == "EItemUseEffect::GetSkin":
            return skin_ids.get(value, 0)
        return stone_ids.get("STR_" + value.upper(), 0)

    by_name = {i["Name"]: i for i in items}
    goods = load(os.path.join(args.tables, "RandomShopGoods.json"))["Properties"]["Data"]
    on_sale = {}
    for g in goods:
        item = by_name.get(g["ItemName"])
        if item and item.get("UseEffect") in KINDS:
            on_sale[item["ID"]["Value"]] = item

    texts, text_index, rows = [], {}, {}
    for item_id, item in sorted(on_sale.items()):
        key = "String_%s_body" % item["Desc"]["Key"]
        en = langs["en"].get(key)
        if not en:
            continue
        if key not in text_index:
            t = {"en": en}
            for code, entries in langs.items():
                x = entries.get(key)
                if code != "en" and x and x != key and x != en:
                    t[code] = x
            text_index[key] = len(texts)
            texts.append(t)
        rows[item_id] = [KINDS[item["UseEffect"]], GRADES.get(item.get("ItemGrade"), 0), text_index[key], game_id(item)]

    # Every one is bound, and each language says so in a last bracket ("(Bound)",
    # "(각인)", "(Gebunden)"): the list leaves that out.
    import re
    from collections import Counter
    last = re.compile(r"\s*[(（][^()（）]*[)）]\s*$")
    for code in {c for t in texts for c in t}:
        named = [t for t in texts if code in t]
        tails = Counter(m.group(0).strip() for t in named for m in [last.search(t[code])] if m)
        if not tails:
            continue
        # The last brackets that each end 5% of the names at least, when
        # together they end 90% (French has three: "(lié)", "(liée)" and
        # "(liés)").
        bound, covered = [], 0
        for tail, n in tails.most_common():
            if n * 20 < len(named):
                break
            bound.append(tail)
            covered += n
        if covered * 10 < 9 * len(named):
            continue
        for t in named:
            for tail in bound:
                if t[code].rstrip().endswith(tail):
                    t[code] = t[code].rstrip()[: -len(tail)].rstrip()
                    break

    pet_lines = ",\n".join(f"  {k}: {v}" for k, v in sorted(pets.items()))
    item_lines = ",\n".join(f"  {k}: {json.dumps(v)}" for k, v in sorted(rows.items()))
    text_lines = ",\n".join("  " + json.dumps(t, ensure_ascii=False) for t in texts)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(
            "// What the Black Cloud Merchants sell, for the Black Market view. Generated\n"
            "// by tools/game-souls/shoppets.py from the game's Item and RandomShopGoods\n"
            "// tables: don't edit by hand.\n"
            "// The pet each pet item gives (Item id -> pet id).\n"
            f"const SHOP_PETS = {{\n{pet_lines},\n}};\n"
            "// Each skin and Theostone on sale (Item id -> [kind, grade: 0 Common,\n"
            "// 1 Rare, 2 Epic, 3 Unique, index into SHOP_TEXT, the game's Skin or Godstone id]).\n"
            f"const SHOP_ITEMS = {{\n{item_lines},\n}};\n"
            "// Their names, in each language that has its own (English otherwise).\n"
            f"const SHOP_TEXT = [\n{text_lines},\n];\n"
        )
    print(f"{len(pets)} pet items, {len(rows)} skins and Theostones, {len(texts)} names")


if __name__ == "__main__":
    main()
