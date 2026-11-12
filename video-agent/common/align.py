"""audio/<id>.wav -> timing.json + narration.wav
Evens out the speaking pace line by line, polishes the voice, then times every word."""
import json, subprocess, os
from faster_whisper import WhisperModel
TARGET=float(os.environ.get("PACE","15.6"))   # characters per second
LO,HI=0.94,1.16                                 # never stretch or squeeze more than this
segs=json.load(open("script.json")); model=WhisperModel("small", device="cpu", compute_type="int8")
dur=lambda f: float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]))
t=0.35; out=[]; files=[]
for s in segs:
    src=f"audio/{s['id']}.wav"; trim=f"audio/{s['id']}_t.wav"; pace=f"audio/{s['id']}_p.wav"
    subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-af","silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse","-ar","48000","-ac","1",trim],check=True)
    cps=len(s.get("tts",s["text"]))/dur(trim); f=min(max(TARGET/cps,LO),HI)
    subprocess.run(["ffmpeg","-v","error","-y","-i",trim,"-af",f"atempo={f:.4f}","-ar","48000",pace],check=True)
    d=dur(pace); words=[]
    sg,_=model.transcribe(pace, language="es", word_timestamps=True, vad_filter=False)
    for g in sg:
        for w in g.words: words.append({"w":w.word.strip(),"s":round(t+w.start,3),"e":round(t+w.end,3)})
    out.append({"id":s["id"],"text":s["text"],"start":round(t,3),"end":round(t+d,3),"dur":round(d,3),"cps_before":round(cps,1),"tempo":round(f,3),"heard":" ".join(w["w"] for w in words),"words":words})
    files.append((pace,t)); t+=d+s.get("pause",0.3)
total=round(t+1.3,2); inputs=[]; filt=[]
for i,(f_,st) in enumerate(files): inputs+=["-i",f_]; filt.append(f"[{i}]adelay={int(st*1000)}:all=1[a{i}]")
# voice polish: clear rumble, thin the boxiness, lift presence and air, even out level, set loudness
POLISH="highpass=f=75,equalizer=f=260:t=q:w=1.1:g=-2.5,equalizer=f=3400:t=q:w=1.2:g=3,highshelf=f=8500:g=3.5,acompressor=threshold=-21dB:ratio=3:attack=8:release=140:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=9"
filt.append("".join(f"[a{i}]" for i in range(len(files)))+f"amix=inputs={len(files)}:normalize=0,apad=whole_dur={total},{POLISH}[o]")
subprocess.run(["ffmpeg","-v","error","-y",*inputs,"-filter_complex",";".join(filt),"-map","[o]","-ar","48000","narration.wav"],check=True)
json.dump({"total":total,"segs":out},open("timing.json","w"),ensure_ascii=False,indent=1)
for o in out: print(o["id"],o["start"],o["dur"],f"pace {o['cps_before']}->x{o['tempo']}","|",o["heard"])
print("TOTAL",total)
