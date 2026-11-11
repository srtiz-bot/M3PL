"""Synthesised sound effects, placed on the animation cues and mixed under the narration."""
import json, numpy as np, subprocess
from scipy.signal import butter, lfilter
from scipy.io import wavfile
SR=48000; C=json.load(open("cues.json")); TOTAL=C["TOTAL"]; rng=np.random.default_rng(7)
track=np.zeros(int(TOTAL*SR)+SR)
def bp(x,lo,hi):
    b,a=butter(2,[lo/(SR/2),hi/(SR/2)],btype="band"); return lfilter(b,a,x)
def env(n,a=0.005,r=0.05):
    e=np.ones(n); na=max(int(a*SR),1); nr=max(int(r*SR),1); e[:na]=np.linspace(0,1,na); e[-nr:]=np.linspace(1,0,nr); return e
def scratch(d):            # pen on paper: band-passed noise with an irregular stroke rhythm
    n=int(d*SR); t=np.arange(n)/SR; x=bp(rng.standard_normal(n),1800,6500)
    am=0.55+0.45*np.sin(2*np.pi*(7+rng.random()*3)*t+rng.random()*6)*np.sin(2*np.pi*1.7*t+1)
    return x*np.clip(am,0.1,1)*env(n,0.02,0.08)*0.5
def thud():                # stamp: low body + sharp paper slap
    n=int(0.32*SR); t=np.arange(n)/SR
    body=np.sin(2*np.pi*(95*np.exp(-t*9)+48)*t)*np.exp(-t*13)
    slap=bp(rng.standard_normal(n),700,4500)*np.exp(-t*55)
    return body*0.95+slap*0.7
def tick():
    n=int(0.05*SR); t=np.arange(n)/SR; return (np.sin(2*np.pi*1500*t)*np.exp(-t*90)+bp(rng.standard_normal(n),2500,7000)*np.exp(-t*140)*0.5)*0.6
def pop(f0=420,f1=900):
    n=int(0.11*SR); t=np.arange(n)/SR; f=f0+(f1-f0)*t/t[-1]; return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*28)*0.55
def whoosh(d=0.42):        # page turn
    n=int(d*SR); t=np.arange(n)/SR; x=rng.standard_normal(n); out=np.zeros(n); k=8; seg=n//k
    for i in range(k):
        lo=500+i*450; out[i*seg:(i+1)*seg]=bp(x,lo,lo+2200)[i*seg:(i+1)*seg]
    return out*np.sin(np.pi*t/d)**2*0.6
def ding(f=1175):
    n=int(0.9*SR); t=np.arange(n)/SR; return (np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*1.5*t)+0.25*np.sin(2*np.pi*f*2.01*t))*np.exp(-t*5.5)*0.4
def coin(i):
    n=int(0.35*SR); t=np.arange(n)/SR; f=1320*(1+0.06*i); return (np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*2*t))*np.exp(-t*14)*0.35
def put(x,t,g=1.0):
    i=int(max(t,0)*SR); track[i:i+len(x)]+=x[:len(track)-i]*g
# --- scene 1 ---
put(scratch(1.4),0.03,0.9)
t0=max(C["cinco"]-1.5,0.6)
for i in range(4): put(tick(),t0+1.5*(i+1)/4,0.9)
put(thud(),C["tocar"]+0.02,1.0)
put(pop(),C["llegar"]-0.1,0.7); put(scratch(0.3),C["llegar"]+0.15,0.8)
put(pop(380,760),C["liberada"]-0.25,0.7); put(scratch(0.35),C["liberada"]+0.05,0.9)
for k in ("aduana","transp","coord"):
    put(pop(520,640),C[k]-0.25,0.5); put(scratch(0.55),C[k]-0.1,0.75)
span=max(C["s1end"]-C["cobrar"]+0.25,1.2); step=span/4
for i in range(4): put(tick(),C["cobrar"]+step*(i+1),0.8); put(coin(i),C["cobrar"]+step*(i+1)+0.02,0.9)
# --- page turn + scene 2 ---
put(whoosh(),C["s1end"]-0.02,0.9)
for k in ("llegada","liberacion","entrega"):
    put(pop(600,980),C[k]-0.2,0.5); put(scratch(0.7),C[k]-0.15,0.8)
put(scratch(0.9),C["tres"]-0.1,0.9)
put(pop(440,880),C["quien"]-0.05,0.6)
put(ding(),C["revisa"]-0.2,0.9); put(pop(500,1000),C["url"]-0.1,0.5)
track=np.tanh(track*1.2)*0.8
wavfile.write("sfx.wav",SR,(track[:int(TOTAL*SR)]*32767).astype(np.int16))
# voice stays in front: effects sit well under it
subprocess.run(["ffmpeg","-v","error","-y","-i","narration.wav","-i","sfx.wav","-filter_complex",
  "[1]volume=0.20[s];[0][s]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=false[o]","-map","[o]","-ar","48000","final_audio.wav"],check=True)
print("sfx mixed")
