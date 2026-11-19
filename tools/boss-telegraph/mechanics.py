"""Build reviewed, exact-trigger mechanic instructions against current bosses.js.

Run: python tools/boss-telegraph/mechanics.py [--check]
Importing this module does not read source files or write generated output.
"""
import argparse
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "plugins" / "boss-telegraph"
SOURCE = Path(__file__).with_suffix(".json")
LANGS = {"en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"}
REGIONS = {"KR", "Global"}
CATEGORIES = {"conquest", "transcendence", "trial", "nightmare", "sanctuary"}
DIFFICULTIES = {"normal", "hard", "exploration"}
RANKED = {"transcendence", "trial", "nightmare"}
SCOPE_KEYS = {"universal", "regions", "categories", "difficulties", "stages"}
UNRESOLVED_KEYS = {
    "historical", "historicalOnly", "historicalRemovedMode", "requiresExplicitHistoricalContext",
    "requiresVersionContext", "versionRestricted", "versionMismatch", "versionSpecific",
    "referenceOnly", "unknownScope", "unknownRegion", "unknownMode", "unknownDifficulty",
    "unknownStage", "unverified", "unresolved",
}


def read_js(path):
    src = Path(path).read_text(encoding="utf-8")
    return json.loads(src[src.index("{"):src.rindex("}") + 1])


def _reject_flags(value, location):
    """Do not let unresolved applicability metadata become executable guidance."""
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "flags" and child not in ([], {}):
                raise ValueError(f"{location}: unresolved or unknown flags are not supported")
            if key in UNRESOLVED_KEYS and child:
                raise ValueError(f"{location}: {key} applicability must be resolved before building")
            _reject_flags(child, location)
    elif isinstance(value, list):
        for child in value:
            _reject_flags(child, location)


def _enum_array(scope, key, allowed, location):
    value = scope.get(key)
    if not isinstance(value, list) or any(not isinstance(v, str) or v not in allowed for v in value):
        raise ValueError(f"{location}: scope.{key} must contain only {', '.join(sorted(allowed))}")
    if len(set(value)) != len(value):
        raise ValueError(f"{location}: scope.{key} contains duplicates")
    return value


def _validate_scope(entry, location):
    scope = entry.get("scope")
    if not isinstance(scope, dict) or set(scope) - SCOPE_KEYS:
        raise ValueError(f"{location}: scope contains unknown flags or fields")
    universal = scope.get("universal", False)
    if type(universal) is not bool:
        raise ValueError(f"{location}: scope.universal must be boolean")
    regions = _enum_array(scope, "regions", REGIONS, location)
    categories = _enum_array(scope, "categories", CATEGORIES, location)
    difficulties = _enum_array(scope, "difficulties", DIFFICULTIES, location)
    stages = scope.get("stages")
    if not isinstance(stages, list) or any(type(stage) is not int or stage < 1 for stage in stages):
        raise ValueError(f"{location}: scope.stages must contain positive integer stages")
    if len(set(stages)) != len(stages):
        raise ValueError(f"{location}: scope.stages contains duplicates")
    if universal:
        if entry["verification"] != "game-explicit" or entry["source"]["field"] == "act":
            raise ValueError(f"{location}: universal guidance requires explicit game text, not curated act text")
        if regions or categories or difficulties or stages:
            raise ValueError(f"{location}: universal scope cannot also restrict applicability")
        return
    if not regions:
        raise ValueError(f"{location}: non-universal scope requires explicit regions")
    # A current literal game instruction can be known for its regional client
    # without pretending that its mode was established by a guide.
    if entry["verification"] == "game-explicit":
        return
    if not categories:
        raise ValueError(f"{location}: guide-exact scope requires explicit categories")
    if any(category in {"conquest", "sanctuary"} for category in categories) and not difficulties:
        raise ValueError(f"{location}: conquest/sanctuary requires a known difficulty")
    if any(category in RANKED for category in categories) and not stages:
        raise ValueError(f"{location}: ranked categories require explicit stages")


def validate_mechanics(source, data):
    """Return a full copy of validated source, preserving review and provenance."""
    if not isinstance(source, dict) or type(source.get("schemaVersion")) is not int or source["schemaVersion"] != 1:
        raise ValueError("Mechanics source requires schemaVersion 1")
    if not isinstance(source.get("entries"), list):
        raise ValueError("Mechanics source requires an entries array")
    if "dungeons" in source:
        dungeons = source["dungeons"]
        if not isinstance(dungeons, dict):
            raise ValueError("dungeons must be a dictionary of numeric IDs")
        for dungeon_id, dungeon in dungeons.items():
            if (not isinstance(dungeon_id, str) or not dungeon_id.isascii()
                    or not dungeon_id.isdecimal() or int(dungeon_id) < 1
                    or not isinstance(dungeon, dict)
                    or not isinstance(dungeon.get("name"), str) or not dungeon["name"].strip()):
                raise ValueError(f"dungeon {dungeon_id}: positive numeric ID and non-empty name required")
            if "difficulty" in dungeon and (not isinstance(dungeon["difficulty"], str) or dungeon["difficulty"] not in DIFFICULTIES):
                raise ValueError(f"dungeon {dungeon_id}: invalid official difficulty")
    if "managedKeys" in source:
        managed = source["managedKeys"]
        if not isinstance(managed, dict) or any(region not in REGIONS for region in managed):
            raise ValueError("managedKeys must map explicit KR/Global regions to key arrays")
        for region, keys in managed.items():
            if (not isinstance(keys, list)
                    or any(not isinstance(key, str) or not key.strip() for key in keys)
                    or len(set(keys)) != len(keys)):
                raise ValueError(f"managedKeys.{region} must contain unique non-empty string keys")
    seen = {}
    calls = data["calls"]
    for position, entry in enumerate(source["entries"]):
        location = f"entry {position}"
        if not isinstance(entry, dict):
            raise ValueError(f"{location}: expected an object")
        for key in ("k", "bossKey", "t"):
            if not isinstance(entry.get(key), str) or not entry[key].strip():
                raise ValueError(f"{location}: {key} must be non-empty")
        location = f"{entry['k']} ({entry['bossKey']})"
        if entry["t"] not in {"cast", "use", "abnormal"} or type(entry.get("id")) is not int or entry["id"] < 1:
            raise ValueError(f"{location}: invalid trigger type or ID")
        trigger = (entry["k"], entry["bossKey"], entry["t"], entry["id"])
        seen.setdefault(trigger, []).append(entry)
        matches = [c for c in calls if (c.get("k"), c.get("b"), c.get("t"), c.get("id")) == trigger]
        if not matches:
            raise ValueError(f"{location}: exact trigger tuple changed or missing in bosses.js")
        original = entry.get("source")
        if (not isinstance(original, dict) or not isinstance(original.get("field"), str)
                or original["field"] not in {"line", "act", "n"}
                or not isinstance(original.get("en"), str) or not original["en"].strip()):
            raise ValueError(f"{location}: source requires a text field and non-empty English")
        field = original["field"]
        for call in matches:
            index = call.get(field)
            if (type(index) is not int or index < 0 or index >= len(data["texts"])
                    or data["texts"][index].get("en") != original["en"]):
                raise ValueError(f"{location}: source {field}/en changed or missing; review before rebuilding")
        text = entry.get("text")
        if not isinstance(text, dict) or set(text) != LANGS or any(not isinstance(s, str) or not s.strip() for s in text.values()):
            raise ValueError(f"{location}: mechanic text must have ten non-empty locales")
        if len(text["en"]) > 100:
            raise ValueError(f"{location}: English instruction exceeds 100 characters")
        if not isinstance(entry.get("verification"), str) or entry["verification"] not in {"game-explicit", "guide-exact"}:
            raise ValueError(f"{location}: unsupported verification")
        if type(entry.get("enabled")) is not bool or type(entry.get("referenceOnly")) is not bool:
            raise ValueError(f"{location}: enabled and referenceOnly must be explicit booleans")
        evidence = entry.get("evidence")
        if (not isinstance(evidence, list) or not evidence
                or any(not isinstance(item, (dict, str)) or not item or isinstance(item, str) and not item.strip() for item in evidence)):
            raise ValueError(f"{location}: evidence must contain non-empty provenance")
        if not isinstance(entry.get("review"), dict) or not entry["review"]:
            raise ValueError(f"{location}: review metadata is required")
        _reject_flags(entry, location)
        _validate_scope(entry, location)
    for trigger, entries in seen.items():
        if len(entries) < 2:
            continue
        claimed_regions = set()
        for entry in entries:
            scope = entry["scope"]
            regions = {region.strip().lower() for region in scope["regions"]}
            if scope.get("universal", False) or not regions or claimed_regions & regions:
                raise ValueError(f"{trigger[0]}: duplicate exact trigger tuple requires pairwise-disjoint explicit regions")
            claimed_regions.update(regions)
    return copy.deepcopy(source)


def build_mechanics(data=None, check=False, *, source_path=None, output_path=None, bosses_path=None):
    """Validate actual game triggers and generate JS, or check its exact freshness.

    Paths may be injected for isolated checks without changing repository files.
    Passing data allows the ordinary game-table builder to reuse its parsed data.
    """
    source_path = Path(source_path) if source_path is not None else SOURCE
    output_path = Path(output_path) if output_path is not None else PLUGIN / "mechanics.js"
    if data is None:
        data = read_js(Path(bosses_path) if bosses_path is not None else PLUGIN / "bosses.js")
    source = json.loads(source_path.read_text(encoding="utf-8"))
    payload = validate_mechanics(source, data)
    # Keep review evidence in mechanics.json, outside the runtime payload.
    payload.pop("contextProvenance", None)
    for entry in payload["entries"]:
        entry.pop("evidence", None)
    body = "// Built by tools/boss-telegraph/mechanics.py from reviewed mechanics.json.\n"
    body += "// Exact triggers and source text checked against bosses.js; do not edit by hand.\n"
    body += "window.BOSS_MECHANICS = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    if check:
        if not output_path.exists() or output_path.read_text(encoding="utf-8") != body:
            raise ValueError("mechanics.js is out of date; run tools/boss-telegraph/mechanics.py")
    else:
        output_path.write_text(body, encoding="utf-8", newline="\n")
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--bosses", type=Path)
    args = parser.parse_args()
    result = build_mechanics(check=args.check, source_path=args.source, output_path=args.output, bosses_path=args.bosses)
    print(f"{len(result['entries'])} exact mechanic triggers; all ten locales; source and scope verified")


if __name__ == "__main__":
    main()
