import json, sys, time, torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
ref = sys.argv[1]; only = set(sys.argv[2:])
segs = json.load(open("script.json"))
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
for s in segs:
    if only and s["id"] not in only: continue
    t=time.time(); torch.manual_seed(11)
    wav = m.generate(s.get("tts",s["text"]), language_id="es", audio_prompt_path=ref)
    ta.save(f"audio/{s['id']}.wav", wav, m.sr)
    print("DONE", s["id"], round(wav.shape[-1]/m.sr,2), "s in", round(time.time()-t), flush=True)
