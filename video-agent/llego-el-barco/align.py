import json, subprocess, unicodedata, re
from faster_whisper import WhisperModel
segs = json.load(open("script.json"))
model = WhisperModel("small", device="cpu", compute_type="int8")
norm = lambda s: re.sub(r"[^a-z0-9ñ ]","",unicodedata.normalize("NFD",s.lower()).encode("ascii","ignore").decode() if False else "".join(c for c in unicodedata.normalize("NFD",s.lower()) if unicodedata.category(c)!="Mn"))
GAP = 0.30; LEAD = 0.40
t = LEAD; out = []; files = []
for s in segs:
    src = f"audio/{s['id']}.wav"; trimmed = f"audio/{s['id']}_t.wav"
    # trim silence at both ends, keep a tiny pad
    subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-af",
      "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse",
      "-ar","44100","-ac","1",trimmed],check=True)
    dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",trimmed]))
    words = []
    sg,_ = model.transcribe(trimmed, language="es", word_timestamps=True, vad_filter=False)
    for g in sg:
        for w in g.words: words.append({"w":w.word.strip(),"n":norm(w.word.strip()),"s":round(t+w.start,3),"e":round(t+w.end,3)})
    heard = " ".join(w["w"] for w in words)
    out.append({"id":s["id"],"text":s["text"],"start":round(t,3),"end":round(t+dur,3),"dur":round(dur,3),"heard":heard,"words":words})
    files.append((trimmed,t)); t += dur + s.get("pause",GAP)
total = round(t + 1.2, 2)
# build narration track
inputs=[]; filt=[]
for i,(f,st) in enumerate(files):
    inputs += ["-i",f]; filt.append(f"[{i}]adelay={int(st*1000)}:all=1[a{i}]")
filt.append("".join(f"[a{i}]" for i in range(len(files)))+f"amix=inputs={len(files)}:normalize=0,apad=whole_dur={total},loudnorm=I=-16:TP=-1.5:LRA=11[o]")
subprocess.run(["ffmpeg","-v","error","-y",*inputs,"-filter_complex",";".join(filt),"-map","[o]","-ar","48000","narration.wav"],check=True)
json.dump({"total":total,"segs":out},open("timing.json","w"),ensure_ascii=False,indent=1)
for o in out: print(o["id"],o["start"],o["dur"],"|",o["heard"])
print("TOTAL",total)
