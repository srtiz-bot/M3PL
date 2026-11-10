# Whiteboard Explainer — a Claude Code skill

A [Claude Code](https://claude.com/claude-code) skill for building VideoScribe-quality **whiteboard explainer videos** in [HyperFrames](https://www.npmjs.com/package/hyperframes) — a photographed hand appears to draw detailed illustrations and hand-written labels on paper, perfectly in sync with a voiceover.

## What it does

Instead of animating SVG stroke paths (which caps quality at stick figures), this skill uses the same architecture as professional whiteboard tools like VideoScribe and Doodly:

- **Finished, detailed illustrations** revealed through an animated serpentine mask, with a **photo hand holding a marker** riding the mask's tip
- **One isolated image per drawable element** — eliminates reveal bleed and scallop gaps by construction
- **Whisper word timestamps** as the sole timing source — every draw, label, camera move, and SFX cue derives from real spoken-word times
- **Hard QA gates** — coverage checks, frame-by-frame audits every 2 seconds, and Whisper verification of every TTS take

The skill governs **mechanics only**. Visual style (fonts, palette, art direction, music) is designed fresh for every project — nothing is copied between videos.

## Install

```bash
git clone https://github.com/brandonvant/claude-skill-whiteboard-explainer "$HOME/.claude/skills/whiteboard-explainer"
```

On Windows (PowerShell):

```powershell
git clone https://github.com/brandonvant/claude-skill-whiteboard-explainer "$env:USERPROFILE\.claude\skills\whiteboard-explainer"
```

Then just ask Claude Code for a whiteboard / hand-drawn / sketch-style explainer video — the skill triggers automatically.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- [HyperFrames](https://www.npmjs.com/package/hyperframes) (`npx hyperframes`) — the HTML→MP4 render engine
- Python with `openai-whisper` (word-level VO timestamps) and `Pillow` (art tooling)
- An image model for the artwork and a TTS voice for the narration — any provider works; the skill is provider-agnostic

## Contents

```
whiteboard-explainer/
├── SKILL.md                     # the skill entry point: architecture, pipeline, gates
├── references/
│   ├── art-generation.md        # isolated per-element artwork, style/contact-sheet gates
│   ├── hand-prep.md             # photo hand pose set + nib calibration
│   ├── reveal-engine.md         # how the serpentine mask reveal works
│   └── qa-gates.md              # the every-2s frame audit checklist
├── templates/
│   └── reveal-engine.js         # the debugged reveal engine (copy into your composition)
└── scripts/
    ├── word-times.py            # Whisper word-timestamp extraction
    ├── coverage-check.py        # verifies mask chunks fully cover each element's ink
    └── isolate-elements.py      # splits a multi-element image into isolated elements
```

## Why the gates matter

Every gate exists because skipping it produced a specific, visible failure:

| Symptom | Cause | Prevention |
|---|---|---|
| Element partially visible before its beat | shared-image reveal bleed | one image per element |
| Chunk of art never appears | scalloped stroke-cap gaps | coverage-check gate |
| Labels/draws early or late vs VO | estimated timings | Whisper word map |
| Hand floats idle on screen | leftover keep flags | hand lifecycle contract + audit |
| VO take corrupted mid-sentence | TTS glitch | Whisper verification gate |

## License

MIT
