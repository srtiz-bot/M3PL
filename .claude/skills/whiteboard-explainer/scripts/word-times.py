#!/usr/bin/env python
"""Whisper word timestamps for whiteboard-explainer sync.

Usage:
    python word-times.py assets/voice/*.wav [-o word-times.json] [--model base.en]

Writes JSON: { "<file>": [ {"w": word, "t": start_s, "end": end_s}, ... ] }
Every choreography cue (draw finish, label write start, camera move) must
derive from these times — never from character-proportional estimates.

Also acts as the VO integrity gate: eyeball the printed transcript per file;
a corrupted TTS take shows up as missing/garbled trailing words.

Requires: pip install openai-whisper  (torch; CPU is fine, base.en is enough
for word timing).
"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("-o", "--out", default="word-times.json")
    ap.add_argument("--model", default="base.en")
    args = ap.parse_args()

    import whisper
    model = whisper.load_model(args.model)
    out = {}
    for path in args.files:
        r = model.transcribe(path, word_timestamps=True, language="en")
        words = [
            {"w": w["word"].strip(), "t": round(w["start"], 3), "end": round(w["end"], 3)}
            for seg in r["segments"] for w in seg["words"]
        ]
        out[path] = words
        print(f"\n== {path} ({len(words)} words)", file=sys.stderr)
        print(" ".join(w["w"] for w in words), file=sys.stderr)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"\nwrote {args.out}", file=sys.stderr)

if __name__ == "__main__":
    main()
