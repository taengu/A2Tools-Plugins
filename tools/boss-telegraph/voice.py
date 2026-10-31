"""Boss Callouts' built-in voice: every line it can speak, in English,
made with Kokoro (https://huggingface.co/hexgrad/Kokoro-82M, Apache 2.0) and
written to plugins/boss-telegraph/voice.js as Opus clips.

For computers with no voices of their own (Linux: the meter's web view has no
speech). Run it again after build.py and bump the version:

    pip install kokoro soundfile    # Python 3.10 to 3.12; soundfile 0.13+ writes Opus
    python tools/boss-telegraph/voice.py [--voice af_heart]

Clips already made for the same text are kept, so a run after build.py only
makes the new lines.
"""
import argparse
import base64
import io
import json
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[2] / "plugins" / "boss-telegraph"
# Said by the page itself (i18n.js): the voice and volume preview.
EXTRA = ["Boss Callouts"]


def spoken(data):
    """The English of every text a call can say (logic.js: words, startPhase, endPhase)."""
    ids = {data["safe"]}
    for c in data["calls"]:
        for k in ("line", "act"):
            if c.get(k) is not None:
                ids.add(c[k])
        if c["t"] == "abnormal" and c.get("n") is not None:
            ids.add(c["n"])
        for k in ("label", "n"):
            if (c.get("phase") or {}).get(k) is not None:
                ids.add(c["phase"][k])
    return sorted({data["texts"][i]["en"] for i in ids if data["texts"][i].get("en")} | set(EXTRA))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="af_heart")
    # Opus' compression level, from about 265 kbps at 0 to 10 kbps at 1:
    # 0.94 is about 24 kbps, as the clips were made with ffmpeg before.
    ap.add_argument("--level", type=float, default=0.94)
    args = ap.parse_args()

    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    src = (PLUGIN / "bosses.js").read_text(encoding="utf-8")
    data = json.loads(src[src.index("{"):src.rindex("}") + 1])
    texts = spoken(data)
    out = PLUGIN / "voice.js"
    had = {}
    if out.exists():
        old = out.read_text(encoding="utf-8")
        had = json.loads(old[old.index("{"):old.rindex("}") + 1])
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    clips = {}
    for n, text in enumerate(texts, 1):
        if text in had:
            clips[text] = had[text]
            continue
        audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=args.voice)])
        ogg = io.BytesIO()
        sf.write(ogg, audio, 24000, format="OGG", subtype="OPUS", compression_level=args.level)
        clips[text] = base64.b64encode(ogg.getvalue()).decode()
        print(f"{n}/{len(texts)} {len(ogg.getvalue()):>6} B  {text}")

    out.write_text(
        "// Built by tools/boss-telegraph/voice.py: every line the plugin can say, in English,\n"
        f"// made with Kokoro (voice {args.voice}; the model and its voices are Apache 2.0),\n"
        "// as Opus clips. The built-in voice, for computers with none of their own.\n"
        "// Don't edit by hand: run it again after build.py.\n"
        "window.BOSS_VOICE = " + json.dumps(clips, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"{out}: {out.stat().st_size} B, {len(clips)} clips")


if __name__ == "__main__":
    main()
