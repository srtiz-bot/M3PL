"""script.json -> audio/<id>.wav in the cloned voice.  usage: gen_voice.py REF.wav [ids...]
EXAG raises energy (and pace); CFG holds the delivery closer to the reference."""
import json, sys, os, time, torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
ref=sys.argv[1]; only=set(sys.argv[2:]); EXAG=float(os.environ.get("EXAG","0.62")); CFG=float(os.environ.get("CFG","0.5")); SEED=int(os.environ.get("SEED","11"))
segs=json.load(open("script.json")); m=ChatterboxMultilingualTTS.from_pretrained(device="cpu")
for s in segs:
    if only and s["id"] not in only: continue
    t=time.time(); torch.manual_seed(SEED)
    wav=m.generate(s.get("tts",s["text"]), language_id="es", audio_prompt_path=ref, exaggeration=EXAG, cfg_weight=CFG)
    ta.save(f"audio/{s['id']}.wav", wav, m.sr); print("DONE", s["id"], round(wav.shape[-1]/m.sr,2), "s in", round(time.time()-t), flush=True)
