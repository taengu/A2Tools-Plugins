"""Build action instructions from reviewed text, checking the current game's source lines.

Run after updating bosses.js: python tools/boss-telegraph/actions.py [--check]
The ordinary game-table builder also calls build_actions. This separate step
can rebuild instructions without the large extracted client tables.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "plugins" / "boss-telegraph"
SOURCE = Path(__file__).with_suffix(".json")
LANGS = {"en", "ko", "ja", "de", "fr", "es", "pt", "ru", "zh-Hant", "zh-Hans"}


def read_js(path):
    src = path.read_text(encoding="utf-8")
    return json.loads(src[src.index("{"):src.rindex("}") + 1])


def build_actions(data, check=False):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    calls = {}
    for key, entry in source["calls"].items():
        matches = [c for c in data["calls"] if c["k"] == key]
        field = entry["source"]["field"]
        expected = entry["source"]["en"]
        if not matches or any(data["texts"][c[field]]["en"] != expected for c in matches if field in c) or any(field not in c for c in matches):
            raise ValueError(f"{key}: source changed or missing; review instruction before rebuilding")
        calls[key] = entry["text"]
    texts = [source["watch"], source["order"], *calls.values()]
    for text in texts:
        if set(text) != LANGS or any(not isinstance(s, str) or not s.strip() for s in text.values()):
            raise ValueError(f"Action text must have ten non-empty locales: {text.get('en')}")
    payload = {"watch": source["watch"], "order": source["order"], "calls": calls}
    body = "// Built by tools/boss-telegraph/actions.py from reviewed actions.json.\n"
    body += "// Original dialogue is checked against bosses.js; do not edit by hand.\n"
    body += "window.BOSS_ACTIONS = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    output = PLUGIN / "actions.js"
    if check:
        if output.read_text(encoding="utf-8") != body:
            raise ValueError("actions.js is out of date; run tools/boss-telegraph/actions.py")
    else:
        output.write_text(body, encoding="utf-8", newline="\n")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = build_actions(read_js(PLUGIN / "bosses.js"), check=args.check)
    print(f"{len(result['calls'])} supported action keys; all ten locales; source dialogue verified")
