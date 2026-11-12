# Vende en USA — explainer video agent

Handoff document. It records what was built, why, how to rebuild it, and what is still open, so another coding agent (or a person) can reproduce the same results from this folder.

Everything here was produced with free, locally run tools. No paid service is required.

---

## 1. What this is

A pipeline that turns a short Spanish script into a finished vertical explainer video for social media:

1. A script is written as short segments.
2. A cloned voice narrates each segment (local model, free).
3. The narration is transcribed to get the exact time of every word.
4. An HTML page animates a "notebook" drawing, with every stroke, stamp and caption timed to those words.
5. The page is rendered to MP4, with synthesised sound effects mixed under the voice.

Six videos were taken all the way through, in two visual styles:

| Video | Folder | Length | Style | Service it supports |
|---|---|---|---|---|
| "Llena el vaso" (Colombia → Miami cost example) | `llena-el-vaso/` | 60 s | Notebook | Ruta 02, Tu Marca en EE. UU. |
| "Llegó el barco. ¿Y mi caja?" | `llego-el-barco/` | 32 s | Notebook | Ruta 03, Tu Primera Importación |
| "El certificado que no existe" | `el-certificado-que-no-existe/` | 33 s | Notebook | Ruta 01, Tu Agente FDA |
| "Tres letras" (FOB) | `tres-letras-fob/` | 32 s | Notebook | Ruta 02 |
| "¿Quién es el importador?" (coffee from Honduras) | `quien-es-el-importador/` | 49 s | Notebook | Ruta 03 |
| "¿Qué necesitas para importar tu producto?" | `que-necesitas-para-importar/` | 45 s | Motion graphics | All three |

The first two were built before the shared code existed and carry their own copies of the scripts. The last four use `common/`, which is the version to copy for new work. The last video also uses the voice settings the owner approved (section 7).

---

## 2. The business and the audience

- **Site:** venderenusa.com ("Vende en USA"), in Spanish.
- **Audience:** manufacturers and brand owners in Latin America who want to sell in the United States.
- **Three services ("rutas") on the site:**

| Ruta | Name | The buyer's trigger, in the site's words | Price on site |
|---|---|---|---|
| 01 | Tu Agente FDA | "Mi distribuidor me pidió el registro o el agente de mi fábrica de cosméticos." | US$599 first year, US$199/year renewal |
| 02 | Tu Marca en EE. UU. | "Tengo una cotización de fábrica en China y estoy por pagar el anticipo." | US$399 one-time |
| 03 | Tu Primera Importación | "¿Ya sabes qué enviar a EE. UU.? Te acompañamos desde la revisión de documentos hasta la entrega." | US$499 one-time |

- **Where the buttons lead:**
  - "Revisar mi caso" → `venderenusa.com/consulta/` (a guided form that prepares an email; the page does not send or store anything).
  - Cost calculator → `venderenusa.com/calculadora/` ("Calculadora de costo real", seven cost lines, per-unit result).
  - Entry plan → `venderenusa.com/blueprint/`.
- **Tone the site sets, which scripts must keep:**
  - "Registro no significa aprobación de la FDA."
  - "Ser dueño de una marca no significa que debas registrar una fábrica."
  - "No calculamos tasas ni clasificamos mercancías."
  - No guarantees of approval, customs clearance or sales.

---

## 3. Direction and decisions made

### Goal

Awareness and leads from short explainer videos on Instagram and Facebook (Reels and Stories), YouTube (Shorts) and X. "Viral" is the hope; the measurable goal is visits to the calculator or the consultation form.

### Decisions, in the order they were made

1. **Zero new spend.** Only free, open-source or already-owned tools. Paid options were set aside (see section 9).
2. **The owner's own voice,** cloned, as the brand voice. One reference clip for every video so the voice never changes.
3. **No face required.** The notebook drawing carries the video. A short real-voice or on-camera opening is optional.
4. **The site's design is the video style.** A ring-bound notebook page that fills in while the narrator talks. This is more distinctive than a generic whiteboard hand.
5. **Explainers first, not sales pitches.** Each video teaches one thing the viewer did not know, then points to a free tool or the consultation form.
6. **Tension in every video.** The viewer should be waiting for something: a level rising toward a rim, a counter climbing, a stamp about to land.
7. **Numbers are examples.** Any cost shown is labelled "EJEMPLO ILUSTRATIVO" unless it comes from a real, verified case.
8. **Test, don't polish.** Publish several angles cheaply and let the numbers pick the series (section 10).

### What makes a hook work here

- Something is on screen in the first frame. Never open on an empty page.
- A specific number or a specific claim, not a general warning.
- One open question the viewer wants answered.
- Works with the sound off.

Three hook directions were recorded and compared:

| Direction | Example | Service |
|---|---|---|
| Myth correction | "La FDA no emite certificados." | Ruta 01 |
| Hidden meaning | "Tres letras que casi nadie lee: F, O, B." | Ruta 02 |
| Ticking clock | "Tu carga llegó a Miami hace cinco días. Y todavía no la puedes tocar." | Ruta 03 |

The ticking clock was chosen and built (`llego-el-barco/`).

---

## 4. Design system

Taken from the live site's stylesheet and applied to the videos.

| Token | Value |
|---|---|
| Ink | `#101c29` |
| Orange (accent) | `#ce4206` |
| Paper | `#fcfcfa` |
| Desk / background | `#f1f2ee` |
| Muted text | `#4d5964` |
| Binder frame | `#2a2c2e` |
| Heading font | Space Grotesk (700) |
| Body font | Inter |
| Handwritten notes | Caveat (videos only; not on the site) |

### The notebook frame

- Canvas 1080×1920, 30 fps.
- Dark binder with rounded corners, three metal rings at the top, cream paper with faint ruled lines.
- A small uppercase label and a rule at the top of the page ("CUADERNO DE IMPORTACIÓN"), with a boxed tag at the right ("BOCETO 01", "EJEMPLO ILUSTRATIVO").

### Drawing language

- Thin dark line sketches that draw themselves stroke by stroke; orange fills arrive last.
- The six sketches come from the site itself and are in `site/assets/` (agent, brand, shipment, port, clearance, warehouse). The builder inlines each SVG path so it can be animated.
- Orange rubber stamps slam onto the page with a short paper shake ("SIN LIBERAR", "TE QUEDA US$1.07").
- Pen marks: circles, strike-throughs, braces and loops drawn over text.
- Pages turn by sliding up and away.

### Captions and safe zones

- Captions are burned in, 64 px Space Grotesk, with the spoken word highlighted in orange, upcoming words grey and spoken words dark.
- Caption band: x 110–930, y 1170–1420.
- Kept clear for the apps' own interface: top 250 px, bottom 480 px, and the right-hand column (x > 960) between y 900 and 1440.
- All meaningful content sits between y 260 and y 1160. The bottom third is deliberately blank paper.
- `reference/llego-el-barco-zonas-seguras.jpg` shows five frames with those zones shaded.
- The zone sizes come from third-party guides that disagree, so the most cautious figures were used. Check each platform's own preview before posting.

Reference images: `reference/site-homepage.png` (the live site), `reference/llena-el-vaso-frames.jpg` (frames from the glass video), `reference/motion-graphics-frames.jpg` (frames from the motion-graphics video).

### Second style: motion graphics

Built for more movement and attention (`common/mg.css`, used by `que-necesitas-para-importar/`). Same fonts and colours, no notebook.

- Full-screen colour fields that alternate navy `#101c29`, orange `#ce4206` and paper `#f1f2ee`; a brighter orange `#ff6a2b` is the accent on navy.
- Each scene arrives with a full-screen wipe (expanding circle or sliding edge).
- Giant outlined numerals (330 px) that fill with colour when the number is spoken.
- Titles rise out of a mask; key words pop in as chips on the word that names them.
- Something always moves: a drifting background grid, a ghost word scrolling behind the scene, floating rings.
- A five-part progress bar with a counter ("3/5") at the top of the safe zone.
- Captions are white with a dark outline so they read on all three backgrounds; the spoken word turns bright orange.
- Pass `notebook=False, base="mg.css"` to `Video.build()` to use it.

---

## 5. Folder layout

```
video-agent/
├── README.md                 this document
├── common/                   shared code: use this for new videos
│   ├── gen_voice.py          script.json → one WAV per segment (cloned voice)
│   ├── align.py              evens the pace, polishes the voice, times every word
│   ├── buildlib.py           timings → cues → captions → one HTML page
│   ├── audio.py              sound effects + original music bed, lowered under the voice
│   ├── base.css              notebook style
│   └── mg.css                motion-graphics style
├── hf/trial/                 HyperFrames project stub copied into each build
├── site/assets/              the site's six sketch SVGs
├── reference/                target look: site screenshot, frames, safe-zone proof
├── el-certificado-que-no-existe/, tres-letras-fob/, quien-es-el-importador/, que-necesitas-para-importar/
│   └── script.json, build.py (cues and sound events), body.html, anim.js, style.css, timing.json, events.json
├── llena-el-vaso/            video 1 (60 s), older self-contained layout
│   ├── script.json           narration segments and pauses
│   ├── data.json             the example's numbers
│   ├── gen_voice.py          script → one WAV per segment (cloned voice)
│   ├── align.py              WAVs → timing.json + narration.wav
│   ├── fake_timing.py        estimated timing for a silent draft
│   ├── build.py              timing + data → project/index.html
│   ├── body.html, style.css, anim.js   the page, its styles, its animation cues
│   └── timing.json           word timings from the last real run
└── llego-el-barco/           video 2 (32 s)
    ├── script.json, gen_voice.py, align.py, build.py, body.html, style.css, anim.js
    ├── sfx.py                synthesised sound effects, mixed under the voice
    ├── proof.py              safe-zone overlay image from snapshot frames
    └── timing.json, cues.json
```

Not in the repo, on purpose: voice recordings, the voice reference clip, rendered videos, the Python environment, and the model files. They are large or personal and can be regenerated (section 6).

The `.claude/skills/whiteboard-explainer` folder at the repo root is a third-party MIT skill installed early on. It uses a photographed-hand reveal technique that was not adopted; the videos here use self-drawing SVG strokes instead.

---

## 6. Setup

Tested on Linux, CPU only, Python 3.11, Node 22. A Mac with Apple Silicon should work and be faster, but that was not tested.

### Tools

| Tool | Version used | Job | License |
|---|---|---|---|
| HyperFrames (`heygen-com/hyperframes`) | 0.9.31 (npm) | HTML page → MP4 | Apache-2.0 |
| Chatterbox Multilingual (`resemble-ai/chatterbox`) | 0.1.7 (pip `chatterbox-tts`) | Voice cloning, Spanish | MIT |
| faster-whisper | 1.2.1, model `small` | Word-level timestamps | MIT |
| GSAP | 3.15.0 (CDN) | Animation timeline | free standard license |
| FFmpeg | 6.1 | Trim, mix, loudness | LGPL/GPL |
| Chromium | bundled with the environment | Renders the page | — |

### Install

```bash
# video renderer
npm install hyperframes@0.9.31
npx hyperframes telemetry disable        # it reports usage by default

# voice + timing, in its own Python 3.11 environment
uv venv -p python3.11 venv
uv pip install -p venv/bin/python chatterbox-tts==0.1.7 "setuptools<81" faster-whisper
```

### Things that broke and how they were fixed

- **Chatterbox fails on load with `'NoneType' object is not callable`.** Its watermark component needs `pkg_resources`. Installing `setuptools<81` fixes it.
- **Model download hangs.** Set `HF_HUB_DISABLE_XET=1` before any command that downloads from Hugging Face.
- **Python 3.13 is too new** for the Chatterbox dependencies. Use 3.11.
- **Do not add a PyTorch CPU index URL** to the install; the default package index works.
- **Network allowlist** (only relevant in a restricted sandbox): `huggingface.co`, `us.aws.cdn.hf.co` and the Hugging Face CDN hosts for the models; `fonts.googleapis.com` and `cdn.jsdelivr.net` are reached at render time for fonts and GSAP.
- **HyperFrames lint** reports `font_family_without_font_face` for Caveat and a nested-structure warning. Both are harmless: the renderer fetches Google Fonts itself, and the render succeeds.

### The voice reference

Chatterbox clones from a short clip. The clip used here was a 20-second preview of the owner's existing cloned voice named "SaulSpanish", converted to mono 44.1 kHz WAV. It is a copy of a copy; a clean 30–60 second real recording in Spanish should give a closer match. The clip is not stored in this repo.

---

## 7. How to build a video

These are the steps for a video that uses `common/` (the four newer ones). Run from inside the video folder, with the voice environment at `../cb/venv` (or adjust the path).

```bash
# 1. narrate every segment in script.json  → audio/<id>.wav   (add ids to redo only some)
HF_HUB_DISABLE_XET=1 ../cb/venv/bin/python ../common/gen_voice.py /path/to/voice-reference.wav

# 2. even the pace, polish, transcribe  → timing.json + narration.wav, then READ the transcript
HF_HUB_DISABLE_XET=1 ../cb/venv/bin/python ../common/align.py

# 3. build the page and the list of sound events  → project/index.html + events.json
python3 build.py

# 4. sound effects + music under the voice  → final_audio.wav, then rebuild to pick it up
../cb/venv/bin/python ../common/audio.py 0.28      # the number is the music level
python3 build.py

# 5. look, then render
cd project && npx hyperframes snapshot --at 0.4,5,12,20,30 && npx hyperframes render
```

### Voice settings the owner approved

The first narrations sounded uneven. Measured, the lines ran anywhere from 12 to 18 characters per second, and the model's 24 kHz output was dull. `common/gen_voice.py` and `common/align.py` fix this:

- **Energy:** `exaggeration=0.62`, `cfg_weight=0.5` (environment variables `EXAG`, `CFG`). Higher expressiveness also steadied the pace.
- **Pace:** each line is measured and time-stretched toward 15.6 characters per second, limited to 0.94×–1.16× so it never sounds processed (`PACE`).
- **Polish:** high-pass at 75 Hz, −2.5 dB at 260 Hz, +3 dB at 3.4 kHz, +3.5 dB shelf above 8.5 kHz, 3:1 compression, loudness to −16 LUFS.
- **Retakes:** `SEED=23 gen_voice.py ref.wav s2` gives a different take of one line.

### Sound and music

`common/audio.py` reads `events.json` (written by `build.py`) and `narration.wav`.

- **Effects** are synthesised: pen scratch, stamp thud, tick, pop, page-turn whoosh, bell, coin. Each event is `[kind, time, gain, extra]`, placed on the same word cues as the animation. They sit at about a fifth of the voice level.
- **Music** is an original eight-bar loop written in code (A minor, 96 bpm: pad, bass, mallet arpeggio, soft kick, shaker, rim). No licensing is involved.
- **Ducking:** the music follows the voice's loudness and drops about 8 dB while the narrator speaks.
- The owner asked for music because the videos "lacked oomph"; no verdict on this bed has been given yet. A real licensed track can be mixed in the same way.

### The two older videos

`llena-el-vaso/` and `llego-el-barco/` predate `common/` and keep their own scripts:

```bash
# 1. narrate every segment in script.json  → audio/<id>.wav
HF_HUB_DISABLE_XET=1 ../cb/venv/bin/python gen_voice.py /path/to/voice-reference.wav

#    redo only some segments
HF_HUB_DISABLE_XET=1 ../cb/venv/bin/python gen_voice.py /path/to/voice-reference.wav c2 c3

# 2. transcribe, apply pauses, assemble  → timing.json + narration.wav
HF_HUB_DISABLE_XET=1 ../cb/venv/bin/python align.py

# 3. READ the printed transcript against the script (see "Voice proofreading")

# 4. build the page  → project/index.html
python3 build.py

# 5. (llego-el-barco only) sound effects  → final_audio.wav, then rebuild
../cb/venv/bin/python sfx.py && python3 build.py

# 6. look before rendering
cd project
npx hyperframes check
npx hyperframes snapshot --at 0.4,5,12,20,30     # PNG frames + a contact sheet

# 7. render  → project/renders/*.mp4
npx hyperframes render
```

For a silent draft before any voice exists, run `python3 fake_timing.py` in place of steps 1–2 (`llena-el-vaso/` only). It estimates timing from text length.

### How the timing works

- `script.json` holds segments: `id`, `text` (what the captions show), optional `tts` (what the voice should say when it differs), and `pause` (silence after the segment, in seconds).
- `align.py` trims silence from each clip, places the clips end to end with the pauses, and writes each word's absolute time.
- `build.py` looks up cue times by keyword, for example `kw("c1","cinco")` is the moment "cinco" is spoken in segment `c1`, and substitutes them into `anim.js` wherever `{{name}}` appears.
- If the transcript's word count matches the script's, timings map one to one. If not (numbers are the usual cause), times are spread across the segment by character count.

### Speed

On a 4-core CPU: about 4–5 seconds of computing per second of speech, 50 seconds to render a 32-second video, under a minute to transcribe. A full video takes roughly ten minutes end to end.

---

## 8. Lessons that cost time

### Voice proofreading is mandatory

The voice model makes mistakes that only show up by transcribing its output and reading it:

- **Acronyms:** "FDA" was read as a made-up word. Write it phonetically in `tts` ("efe de a") and keep "FDA" in `text` for the captions. Same for "FOB" ("efe, o, be").
- **Very short lines stutter or repeat.** "¿Ganas veinte?" came out doubled twice. Merge short lines into the neighbouring sentence.
- **Dropped words:** a leading "Tres:" vanished once. Rewording to "Y tres:" fixed it.
- **Small rewordings:** "Te quedan poco más" became "Te queda un poco más". If the result is still correct Spanish, change the caption text to match and move on.
- **The web address:** write "vender en usa punto com" for the voice; the builder merges it back into "venderenusa.com" for captions.
- **A number word alone at the start of a line gets dropped.** "Tres:" vanished repeatedly; "Número tres:" and "Y cinco:" survive.
- **Some word pairs garble.** "cuánto arancel pagas" came out wrong on two takes; "el arancel que pagas" was clean.
- Changing the random seed in `gen_voice.py` gives a different take of the same line.

### Layout

- Long labels collide with amounts in narrow columns. Check every row at its final width.
- Anything positioned near y 1100 collides with the caption band.
- A stamp's first animation frame is much larger than its resting size; that is expected.
- Always look at snapshot frames. A passing check does not show how it looks.

### Honesty in the content

- Invented numbers were never shown as fact. Either label the example or leave the figure out (the port-charges meter has no dollar amounts for this reason).
- With realistic numbers the glass did not overflow, so the ending was rewritten ("Pensabas ganar veinte. Te queda uno.") instead of rigging the figures.
- Tariff rates were changing at the time of writing and sources disagreed. Any rate in a script should be confirmed with a customs broker on the day of recording.

---

## 9. Options considered and set aside

| Option | Why not |
|---|---|
| HeyGen voice through its API | The account had zero API credits; generating audio would cost money. The voices exist there and can still be used by hand in the HeyGen app. |
| HeyGen's hosted HyperFrames video builder | Disabled for command-line agents, cloud rendering is paid, and it uses its own house styles. |
| ElevenLabs professional voice clone | Best quality, but a monthly subscription. First upgrade to consider if the free voice is the weak point. |
| Remotion | Charges companies above a small team size. HyperFrames avoids the question. |
| XTTS-v2 | Non-commercial license. |
| F5-TTS | Good quality; sources conflict on whether its model weights allow commercial use. |
| Photographed-hand whiteboard reveal | Needs a hand photo set and one image per element; the self-drawing notebook is closer to the site and less work. |
| AI music models (MusicGen, Stable Audio) | Non-commercial or unclear licences, and heavy to run. A simple loop written in code is used instead (section 7). |

---

## 10. Content bank

### Finished scripts

**"Llegó el barco. ¿Y mi caja?"** (`llego-el-barco/script.json`)

> Tu carga llegó a Miami hace cinco días. Y todavía no la puedes tocar. Porque llegar no es lo mismo que estar liberada.
>
> Falta que la aduana la despache, que el transportista la suelte, y que alguien coordine el retiro. Y mientras tanto, el puerto empieza a cobrar por cada día.
>
> Llegada, liberación y entrega: son tres momentos distintos. ¿Quién está viendo los tres en tu primer envío?
>
> Antes de tu primer envío, revisa tu caso en venderenusa.com.

**"Llena el vaso"** (`llena-el-vaso/script.json`), a facial cream from Colombia sold online in Miami. All figures are estimates except the 12.5% duty, which came from press reports and was not confirmed for cosmetics.

| Line | Per unit |
|---|---|
| Factory price | $5.00 |
| Freight Cartagena → Miami | $0.35 |
| Duty at 12.5% | $0.63 |
| Customs broker and entry | $0.25 |
| Warehouse, packing, delivery | $8.20 |
| Marketplace commission | $3.75 |
| Advertising | $5.00 |
| Returns | $0.75 |
| **Total against a $25 sale price** | **$23.93, leaving $1.07** |

**"¿Quién es el importador?"** (`quien-es-el-importador/script.json`), framed on coffee from Honduras.

> Tu café puede llegar a Miami y no entrar. No por el café: porque nadie figura como importador.
>
> En cada envío, alguien responde ante la aduana de Estados Unidos: declara la carga, paga los aranceles y responde si algo falla. Ese es el importador.
>
> Tu almacén no lo es. Tu agente aduanal tramita la entrada, pero normalmente tampoco.
>
> Entonces, ¿quién? Puede ser tu propia empresa en Estados Unidos, tu empresa extranjera registrada como importador no residente, o tu comprador allá.
>
> Decídelo antes de embarcar, no cuando el café ya está en el puerto.

Checked against the rule that the importer of record is the owner, the purchaser, or a licensed broker they designate, and that a foreign company needs a bond and a resident agent. A November 2026 Federal Register notice proposes new requirements for foreign importers; confirm its status before reusing option B.

**"¿Qué necesitas para importar tu producto a Estados Unidos?"** (`que-necesitas-para-importar/script.json`). Five items: clasificación, importador, documentos, requisitos del producto, destino. The list is a sensible general one, not an official one.

### The niche this came from

A real inquiry showed the persona clearly: an online retailer of packaged food from Central America (coffee, in that case) who wants US inventory so American orders ship domestically. Small, cautious, wants a pilot, has no US company, ships parcels of one to three units, and asks about importer-of-record, lot and expiry tracking, store integration, minimums and per-parcel rates. Each of those questions is a video. Naming the product and origin in the hook ("café de Honduras") is what makes that viewer stop. Never name a real lead in public content.

### Hooks recorded and then built

**"El certificado que no existe"** (Ruta 01). Confirmed: the FDA's Cosmetics Direct page states it does not issue certificates or other documents verifying cosmetic facility registration or product listing.

> ¿Te ofrecieron un certificado de la FDA para tu cosmético? Guárdalo bien, porque la FDA no emite certificados. Lo que existe es otra cosa: el registro de la instalación donde se fabrica, un agente en Estados Unidos, y el listado de cada producto. Y nada de eso significa aprobado. Antes de pagar por un papel, averigua cuál de los tres te falta.

**"Tres letras"** (Ruta 02)

> Tu cotización de fábrica tiene tres letras que casi nadie lee: F, O, B. Significan que la fábrica entrega tu producto en un puerto de China, y ahí termina su trabajo. El barco, el seguro, el arancel, la aduana y el camión hasta tu almacén: todo eso es tuyo. Así que antes de pagar el anticipo, pregúntate: ¿cuánto cuesta lo que la cotización no dice?

### Topic ideas by group

- **Fundamentals:** the product's whole journey from factory to US customer; who the "importer" is; FOB vs CIF vs DDP; air vs sea vs courier; whether you need a US company.
- **Costs:** how duty is worked out from the HS code; every charge between port and customer; what a 3PL is and when US inventory makes sense.
- **FDA and cosmetics (Ruta 01):** what an FDA agent is; registered is not approved; what a distributor is really asking for.
- **Manufacturing in China (Ruta 02):** reading a factory quote line by line; what to check before paying the deposit; can the factory ship direct to a US customer.
- **First import (Ruta 03):** the documents of a first shipment; what a customs hold is; a first import week by week.

### Country series idea

"¿Cuánto cuesta traer tu producto de [país] a Miami?" reuses the glass animation with a different `data.json` and a re-recorded narration. Naming the country helps the right viewer self-select and helps search; it is not geo-targeting. Each country needs its own verified figures. Brazil would need Portuguese.

---

## 11. Open items

1. **The owner has not approved the facts** in either script. Everything regulatory or numerical needs sign-off.
2. **Music and effects are synthesised.** The owner has approved the reworked voice but has not yet judged the music bed.
3. **Only the 9:16 format exists.** A 16:9 layout for regular YouTube was planned (the site's desktop notebook spread) but not built.
4. **Publishing is manual.** Upload in each app; add a tracked link per video to the calculator or consultation page.
5. **The voice setup is not on the owner's Mac yet.** It ran in a temporary cloud session.
6. **Motion was checked through still frames only.** Someone should watch each render for anything that moves oddly.
7. **The first eight seconds of "Llegó el barco"** use only the top third of the page.
8. **Measurement plan,** once videos are posted: share of viewers still watching at 3 seconds, average watch time, saves and shares, and visits to the site from each video's link. The angle that wins on site visits is the series to build.

---

## 12. Mirroring this in another agent

To reproduce the results from this folder:

1. Follow section 6 to install the three tools, including the `setuptools<81` fix.
2. Get a Spanish voice reference clip (20–60 seconds, mono WAV).
3. In `que-necesitas-para-importar/`, run the steps in section 7. The frames should match `reference/motion-graphics-frames.jpg`, apart from the voice.
4. To make a new video, copy one of the four newer folders, rewrite `script.json`, then edit `build.py` (cue names and sound events), `body.html` (what is on screen) and `anim.js` (when each thing happens, using the `{{cue}}` names from `build.py`).

The rules a new agent should hold to:

- Read the transcript after every voice generation.
- Look at snapshot frames before every render.
- Keep text inside the safe zone described in section 4.
- Never show an unverified number as fact.
- Keep the site's caveats in the script.
