# Estimated timing for a silent animatic; align.py replaces this once the narration exists.
import json
segs=json.load(open("script.json")); t=0.35; out=[]
for s in segs:
    ws=s["text"].split(); dur=max(len(s["text"])/14.5,0.9); tot=sum(len(w)+1 for w in ws); acc=0; words=[]
    for w in ws:
        a=t+dur*acc/tot; acc+=len(w)+1; words.append({"w":w,"s":round(a,3),"e":round(t+dur*acc/tot,3)})
    out.append({"id":s["id"],"text":s["text"],"start":round(t,3),"end":round(t+dur,3),"dur":round(dur,3),"words":words})
    t+=dur+s.get("pause",0.3)
json.dump({"total":round(t+1.5,2),"segs":out,"estimated":True},open("timing.json","w"),ensure_ascii=False,indent=1)
print("estimated total",round(t+1.5,2))
