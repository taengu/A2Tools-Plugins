"""Build Boss Callouts' bosses.js from AION 2's own game data.

    python tools/boss-telegraph/build.py --tables <extractor>/Output/AION2/Content/Data/Table
        [--tw-l10n <extractor>/OutputTW/AION2/Content/Data/Table/L10N] [--meter <A2Tools-DPS-Meter>]

After a game patch: extract the client's tables again (Aion2DataExtractor, as for
tools/game-souls), run this, check the counts it prints and the diff of
plugins/boss-telegraph/bosses.js, and bump the plugin's version.

A boss's lines aren't in its traffic: the client plays them itself from
NpcBehaviorCase when the boss does something. What is read:
  NpcBehaviorCase  rows (NpcName, Case, Value, Prob, Talk): Casting <skill> (the cast bar
                   starts, 09 38), SkillUse <skill> (the skill goes off, 02 38), Abnormal
                   <id> (a buff lands on the boss, 2A 38). Kept: Prob 10000 (the game always
                   says it; a line it says only sometimes would be spoken when the screen
                   showed nothing). Idle, CombatStart, Die and the rest are not mechanics.
  NpcData          by NpcName: kept are named heroes (NpcSubType HeroMonster, bNamed: the
                   dungeon, raid and field bosses and their named adds); the name
                   (Desc key), and ActiveSkillList, so the plugin can tell which boss an
                   entity is from the skills it casts (for buffs any monster can get).
  NpcTalk          the Talk's ChatDescription key: the line's text in L10N. BossCaption,
                   Caption and ChatBubble lines (what shows on screen); Test_ rows dropped.
  Skill            CastingTime of each cast trigger (ms), the lead before it lands.
  SkillAbnormal    names of the buffs in curated phases and abnormal triggers.
  Dungeon          the dungeon's title, for grouping: the meter's npcs table
                   (src/data/i18n/npcs/en.json dungeonId) says which dungeon a boss is in.
  L10N/<locale>    en ko ja de fr es pt ru from the Global client; zh-Hant from the TW
                   client's L10N (--tw-l10n); zh-Hans is zh-Hant through OpenCC t2s.
curated.json (next to this file) adds the hand-checked mechanics: a short action call in
the ten languages, and the buff phase that follows (so the plugin can say "safe" when it
ends). Writes plugins/boss-telegraph/bosses.js (window.BOSS_CALLOUTS).
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

import ijson

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "plugins" / "boss-telegraph" / "bosses.js"
CURATED = Path(__file__).resolve().parent / "curated.json"
LANG_DIRS = {"en": "en-US", "ko": "ko-KR", "ja": "ja-JP", "de": "de-DE", "fr": "fr-FR",
             "es": "es-ES", "pt": "pt-BR", "ru": "ru-RU"}
LANGS = ["en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"]
TRIGGERS = {"ENpcBehaviorCase::Casting": "cast", "ENpcBehaviorCase::SkillUse": "use",
            "ENpcBehaviorCase::Abnormal": "abnormal"}
TALK_TYPES = {"ENpcTalkType::BossCaption", "ENpcTalkType::Caption", "ENpcTalkType::ChatBubble"}
# Difficulty and copy suffixes of one boss's rows: M_PD_..._Tamon_01_001_hard.
VARIANT = re.compile(r"(_(easy|normal|hard|grade|hell|\d{3}))+$", re.I)


def v(x):
    return x["Value"] if isinstance(x, dict) else x


def rows(tables, name):
    with open(tables / name, encoding="utf-8") as f:
        return json.load(f)["Properties"]["Data"]


def l10n(tables, tw):
    out = {}
    for lang, d in LANG_DIRS.items():
        with open(tables / "L10N" / d / "L10NString.json", encoding="utf-8") as f:
            out[lang] = json.load(f)["Entries"]
    out["zh-Hant"] = {}
    path = tw / "zh-TW" / "L10NString.json" if tw else None
    if path and path.is_file():
        with open(path, encoding="utf-8") as f:
            out["zh-Hant"] = json.load(f)["Entries"]
    else:
        print(f"no zh-TW L10N at {path}: Chinese falls back to English", file=sys.stderr)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tables", required=True, type=Path)
    ap.add_argument("--tw-l10n", type=Path, help="the TW client's Table/L10N folder (zh-TW)")
    ap.add_argument("--meter", type=Path, default=ROOT.parent / "A2Tools-DPS-Meter")
    args = ap.parse_args()
    if args.tw_l10n is None:
        guess = args.tables
        for _ in range(6):
            guess = guess.parent
            cand = guess.parent / "OutputTW" / "AION2" / "Content" / "Data" / "Table" / "L10N"
            if cand.is_dir():
                args.tw_l10n = cand
                break

    try:
        import opencc
        t2s = opencc.OpenCC("t2s").convert
    except ImportError:
        t2s = None
        print("opencc missing (pip install opencc-python-reimplemented): zh-Hans = zh-Hant", file=sys.stderr)

    L = l10n(args.tables, args.tw_l10n)

    def texts(key):
        """A string in every language; English where one is missing. None without English."""
        en = L["en"].get(key)
        if not en or en.strip() in ("", "None") or en.startswith("STR_"):
            return None
        n = {"en": en.strip()}
        for lang in LANGS[1:-1]:
            t = (L[lang].get(key) or "").strip()
            if t and t != "None":
                n[lang] = t
        if "zh-Hant" in n:
            n["zh-Hans"] = t2s(n["zh-Hant"]) if t2s else n["zh-Hant"]
        return n

    npcs = {r["Name"]: r for r in rows(args.tables, "NpcData.json")}
    talks = {r["Name"]: r for r in rows(args.tables, "NpcTalk.json")}
    abnormals = {v(r["ID"]): r for r in rows(args.tables, "SkillAbnormal.json")}
    dungeons = {v(r["ID"]): r for r in rows(args.tables, "Dungeon.json")}
    meter_npcs = {}
    p = args.meter / "src" / "data" / "i18n" / "npcs" / "en.json"
    if p.is_file():
        meter_npcs = json.loads(p.read_text(encoding="utf-8"))
    else:
        print(f"no {p}: bosses are grouped by their table names", file=sys.stderr)
    curated = json.loads(CURATED.read_text(encoding="utf-8"))

    def hero(name):
        n = npcs.get(name)
        return n if n and n.get("NpcSubType") == "ENpcSubType::HeroMonster" and n.get("bNamed") else None

    # The behaviour rows that are mechanics with a line.
    cases = []
    dropped = defaultdict(int)
    for r in rows(args.tables, "NpcBehaviorCase.json"):
        trig = TRIGGERS.get(r["Case"])
        if not trig:
            continue
        if not hero(r["NpcName"]):
            dropped["not a named boss"] += 1
            continue
        if r.get("Prob") != 10000:
            dropped["said only sometimes"] += 1
            continue
        t = talks.get(r["Talk"])
        if not t or t["Type"] not in TALK_TYPES or r["Talk"].startswith("Test_"):
            dropped["no on-screen line"] += 1
            continue
        line = texts(t["ChatDescription"]["Key"])
        if not line:
            dropped["line has no text"] += 1
            continue
        try:
            value = int(r["Value"])
        except ValueError:
            dropped["bad value"] += 1
            continue
        cases.append((v(r["ID"]), r["NpcName"], trig, value, line))

    # Bosses: one per name (its difficulties and copies together), in the
    # dungeon most of its copies are listed in (the meter's npcs table), else
    # curated.json's "dungeons", else a category ("Dungeon", or "Other").
    def dungeon_of(npc):
        m = meter_npcs.get(str(v(npc["ID"]))) or {}
        did = m.get("dungeonId") or curated.get("dungeons", {}).get(npc["Name"])
        d = dungeons.get(did)
        if d:
            title = d["Title"]["Key"]
            return "d:" + title, texts(f"String_{title}_body")
        return "c:" + (m.get("category") or "Other"), None

    boss_of = {}   # NpcName -> boss key
    bosses = {}    # boss key -> {n, votes, skills, npcs}
    groups = {}    # group key -> its name in every language (None: the plugin's own word)
    def add_boss(name):
        if name in boss_of:
            return boss_of[name]
        npc = npcs[name]
        n = texts(f"String_{npc['Desc']['Key']}_body") or {"en": VARIANT.sub("", name)}
        gkey, gname = dungeon_of(npc)
        groups.setdefault(gkey, gname)
        key = re.sub(r"[^a-z0-9]+", "-", n["en"].lower()).strip("-")
        b = bosses.setdefault(key, {"n": n, "votes": defaultdict(int), "skills": set(), "npcs": set()})
        b["votes"][gkey] += 1
        b["npcs"].add(name)
        b["skills"].update(v(s) for s in npc.get("ActiveSkillList") or [])
        boss_of[name] = key
        return key

    # Calls by (trigger, id, boss): one line each, the normal difficulty's
    # where its copies differ. Bosses sharing a skill keep their own lines.
    calls = {}
    lines_seen = defaultdict(set)
    def rank(npc_name):
        low = npc_name.lower()
        return (1 if re.search(r"_(easy|hard|hell)", low) else 0, len(npc_name))
    for cid, name, trig, value, line in sorted(cases, key=lambda c: (rank(c[1]), c[0])):
        bk = add_boss(name)
        key = f"{trig}:{value}:{bk}"
        calls.setdefault(key, {"t": trig, "id": value, "b": [bk], "line": line})
        lines_seen[key].add(line["en"])

    for m in curated["mechanics"]:
        if m["boss"] not in npcs:
            sys.exit(f"curated {m['key']}: no NPC {m['boss']}")
        bk = add_boss(m["boss"])
        # One mechanic can have several ids (a skill's easy and normal copies):
        # each is its own call, all under the mechanic's key (one setting).
        for i in m.get("ids") or [m["id"]]:
            key = f"{m['trigger']}:{i}:{bk}"
            c = calls.setdefault(key, {"t": m["trigger"], "id": i, "b": [bk], "line": None})
            c["key"] = m["key"]
            c["act"] = m["call"]
            if m.get("lead"):
                c["lead"] = m["lead"]
            if m.get("waves"):
                c["waves"] = True
            if m.get("mark"):
                c["mark"] = m["mark"]
            if m.get("phase"):
                ph = m["phase"]
                a = abnormals.get(ph["abnormal"])
                name = texts(f"SkillAbnormalString_{a['SkillAbnormalString_Key']}_desc_name") if a else None
                c["phase"] = {"a": ph["abnormal"], "ms": ph["ms"], "label": ph["label"], **({"n": name} if name else {})}

    # Cast times from Skill.json (100 MB: streamed).
    want = {c["id"] for c in calls.values() if c["t"] in ("cast", "use")}
    cast_ms = {}
    with open(args.tables / "Skill.json", "rb") as f:
        for r in ijson.items(f, "Properties.Data.item"):
            i = v(r["ID"])
            if i in want:
                cast_ms[i] = int(r.get("CastingTime") or 0)
    for c in calls.values():
        if c["t"] == "cast" and "lead" not in c:
            c["lead"] = cast_ms.get(c["id"], 0)
        if c["t"] == "abnormal":
            a = abnormals.get(c["id"])
            name = texts(f"SkillAbnormalString_{a['SkillAbnormalString_Key']}_desc_name") if a else None
            if name:
                c["n"] = name
            # A buff any monster (or player) can get: only on an entity seen
            # casting one of this boss's skills. A boss's own buff (its id is one
            # of its skills' and a digit) needs no such check.
            own = any(c["id"] // 10 in bosses[b]["skills"] for b in c["b"])
            if not own:
                c["bind"] = True

    # Texts are kept once each and referred to by index.
    pool, index = [], {}
    def ref(n):
        if n is None:
            return None
        n = {k: s for k, s in n.items() if k == "en" or s != n["en"]}
        k = json.dumps(n, ensure_ascii=False, sort_keys=True)
        if k not in index:
            index[k] = len(pool)
            pool.append(n)
        return index[k]

    for bb in bosses.values():
        votes = bb["votes"]
        dungeon = [g for g in votes if g.startswith("d:")]
        bb["g"] = max(dungeon or votes, key=lambda g: (votes[g], g))
    used_bosses = sorted({b for c in calls.values() for b in c["b"]})
    gname = lambda g: (groups[g] or {}).get("en") or ("￿" + g)  # categories last
    used_groups = sorted({bosses[b]["g"] for b in used_bosses}, key=gname)
    out_groups = {g: ({"n": ref(groups[g])} if groups[g] else {}) for g in used_groups}
    out_bosses = {}
    for b in used_bosses:
        bb = bosses[b]
        # Only the skills that tell this boss apart are needed: those of its
        # calls, and all of them when one of its calls must be bound.
        needs_bind = any(c.get("bind") and b in c["b"] for c in calls.values())
        skills = sorted(bb["skills"]) if needs_bind else []
        out_bosses[b] = {"n": ref(bb["n"]), "g": bb["g"], **({"s": skills} if skills else {})}
    out_calls = []
    for key, c in sorted(calls.items(), key=lambda kv: (bosses[kv[1]["b"][0]]["g"], kv[1]["b"][0], kv[1]["id"])):
        o = {"k": c.get("key") or key, "t": c["t"], "id": c["id"], "b": c["b"][0]}
        if c.get("lead"):
            o["lead"] = c["lead"]
        if c["line"]:
            o["line"] = ref(c["line"])
        if c.get("n"):
            o["n"] = ref(c["n"])
        if c.get("act"):
            o["act"] = ref(c["act"])
        if c.get("phase"):
            ph = c["phase"]
            o["phase"] = {"a": ph["a"], "ms": ph["ms"], "label": ref(ph["label"]), **({"n": ref(ph["n"])} if ph.get("n") else {})}
        if c.get("waves"):
            o["waves"] = True
        if c.get("mark"):
            o["mark"] = c["mark"]
        if c.get("bind"):
            o["bind"] = True
        out_calls.append(o)

    data = {"langs": LANGS, "safe": ref(curated["words"]["safe"]), "texts": pool,
            "groups": out_groups, "bosses": out_bosses, "calls": out_calls}
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "// Built by tools/boss-telegraph/build.py from the game's NpcBehaviorCase, NpcTalk,\n"
        "// NpcData, Skill, SkillAbnormal, Dungeon and L10N tables, plus curated.json.\n"
        "// Don't edit by hand: run the build again after a patch.\n"
        f"window.BOSS_CALLOUTS = {body};\n",
        encoding="utf-8", newline="\n")

    trig_counts = defaultdict(int)
    for c in out_calls:
        trig_counts[c["t"]] += 1
    zh = sum(1 for t in pool if "zh-Hant" in t)
    print(f"calls {len(out_calls)} ({dict(trig_counts)}), curated {sum(1 for c in out_calls if 'act' in c)}, "
          f"bound {sum(1 for c in out_calls if c.get('bind'))}")
    print(f"bosses {len(out_bosses)} in {len(out_groups)} groups; texts {len(pool)} ({zh} with Chinese)")
    print(f"dropped rows: {dict(dropped)}")
    print(f"triggers whose copies have other lines (the normal one kept): {sum(1 for x in lines_seen.values() if len(x) > 1)}")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
