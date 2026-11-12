"""Sound for one video: synthesised effects on the animation cues + an original music bed, ducked under the voice.
Run inside a video folder after build.py:  python ../common/audio.py   ->  final_audio.wav"""
import json, numpy as np, subprocess, sys
from scipy.signal import butter, lfilter, sosfilt
from scipy.io import wavfile
SR=48000; E=json.load(open("events.json")); TOTAL=E["total"]; N=int(TOTAL*SR); rng=np.random.default_rng(7)
def bp(x,lo,hi): b,a=butter(2,[lo/(SR/2),hi/(SR/2)],btype="band"); return lfilter(b,a,x)
def lp(x,f): b,a=butter(2,f/(SR/2)); return lfilter(b,a,x)
def hp(x,f): b,a=butter(2,f/(SR/2),btype="high"); return lfilter(b,a,x)
def env(n,a=0.005,r=0.05):
    e=np.ones(n); na=max(int(a*SR),1); nr=max(int(r*SR),1); e[:na]=np.linspace(0,1,na); e[-nr:]=np.linspace(1,0,nr); return e
# ---------------- effects ----------------
def scratch(d=0.5):
    n=int(d*SR); t=np.arange(n)/SR; x=bp(rng.standard_normal(n),1800,6500)
    am=0.55+0.45*np.sin(2*np.pi*(7+rng.random()*3)*t+rng.random()*6)*np.sin(2*np.pi*1.7*t+1)
    return x*np.clip(am,0.1,1)*env(n,0.02,0.08)*0.5
def thud(d=0):
    n=int(0.32*SR); t=np.arange(n)/SR
    return np.sin(2*np.pi*(95*np.exp(-t*9)+48)*t)*np.exp(-t*13)*0.95+bp(rng.standard_normal(n),700,4500)*np.exp(-t*55)*0.7
def tick(d=0):
    n=int(0.05*SR); t=np.arange(n)/SR; return (np.sin(2*np.pi*1500*t)*np.exp(-t*90)+bp(rng.standard_normal(n),2500,7000)*np.exp(-t*140)*0.5)*0.6
def pop(d=0):
    n=int(0.11*SR); t=np.arange(n)/SR; f=420+(480+d*300)*t/t[-1]; return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*28)*0.55
def whoosh(d=0.42):
    d=d or 0.42; n=int(d*SR); t=np.arange(n)/SR; x=rng.standard_normal(n); out=np.zeros(n); k=8; seg=n//k
    for i in range(k): lo=500+i*450; out[i*seg:(i+1)*seg]=bp(x,lo,lo+2200)[i*seg:(i+1)*seg]
    return out*np.sin(np.pi*t/d)**2*0.6
def ding(d=0):
    n=int(0.9*SR); t=np.arange(n)/SR; f=1175; return (np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*1.5*t)+0.25*np.sin(2*np.pi*f*2.01*t))*np.exp(-t*5.5)*0.4
def coin(d=0):
    n=int(0.35*SR); t=np.arange(n)/SR; f=1320*(1+0.06*d); return (np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*2*t))*np.exp(-t*14)*0.35
FX=dict(scratch=scratch,thud=thud,tick=tick,pop=pop,whoosh=whoosh,ding=ding,coin=coin)
sfx=np.zeros(N+SR)
for kind,t,g,extra in E["events"]:
    x=FX[kind](extra); i=int(max(t,0)*SR)
    if i<N: sfx[i:i+len(x)]+=x[:len(sfx)-i]*g
sfx=np.tanh(sfx[:N]*1.2)*0.8
# ---------------- music bed: original 8-bar loop, A minor, 96 bpm ----------------
BPM=96; beat=60/BPM; bar=4*beat
def note(f,d,kind):
    n=int(d*SR); t=np.arange(n)/SR
    if kind=="pluck":   # soft mallet
        return (np.sin(2*np.pi*f*t)+0.35*np.sin(2*np.pi*2*f*t)*np.exp(-t*9)+0.12*np.sin(2*np.pi*3*f*t)*np.exp(-t*14))*np.exp(-t*5.5)*env(n,0.004,0.03)
    if kind=="bass":
        return (np.sin(2*np.pi*f*t)+0.25*np.sin(2*np.pi*2*f*t))*np.exp(-t*2.2)*env(n,0.01,0.06)
    if kind=="pad":
        return (np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*1.003*t)+0.2*np.sin(2*np.pi*2*f*t))*env(n,0.5,0.6)
def hz(m): return 440*2**((m-69)/12)
# Am  F  C  G  |  Am  F  C  E   (MIDI chord tones)
CH=[[57,60,64],[53,57,60],[48,52,55],[55,59,62],[57,60,64],[53,57,60],[48,52,55],[52,56,59]]
ARP=[0,1,2,1,0,2,1,2]
M=np.zeros(N+int(2*bar*SR)); nb=int(np.ceil(TOTAL/bar))+1
def add(x,t,g):
    i=int(t*SR)
    if i<len(M): M[i:i+len(x)]+=x[:len(M)-i]*g
for b in range(nb):
    ch=CH[b%8]; t0=b*bar; lift = 1.0 if b>=2 else 0.0          # first two bars: pad + mallet only
    for m in ch: add(note(hz(m),bar*1.05,"pad"),t0,0.10)
    add(note(hz(ch[0]-12),beat*1.8,"bass"),t0,0.42*lift); add(note(hz(ch[0]-12),beat*1.2,"bass"),t0+2.5*beat,0.34*lift)
    for i,a in enumerate(ARP):
        add(note(hz(ch[a]+12),beat*0.9,"pluck"),t0+i*beat/2,0.20 if i%2==0 else 0.14)
    for i in range(8):                                             # shaker on eighths
        n=int(0.05*SR); tt=np.arange(n)/SR; add(hp(rng.standard_normal(n),6000)*np.exp(-tt*70),t0+i*beat/2,(0.05 if i%2 else 0.035)*lift)
    for k in (0,2):                                                # soft kick on 1 and 3
        n=int(0.22*SR); tt=np.arange(n)/SR; add(np.sin(2*np.pi*(52+70*np.exp(-tt*30))*tt)*np.exp(-tt*16),t0+k*beat,0.5*lift)
    for k in (1,3):                                                # rim click on 2 and 4
        n=int(0.04*SR); tt=np.arange(n)/SR; add(bp(rng.standard_normal(n),1500,4500)*np.exp(-tt*110),t0+k*beat,0.14*lift)
M=lp(M[:N],7500); M*=env(N,0.6,1.6)
M/=max(np.abs(M).max(),1e-6)
# ---------------- duck the music under the voice ----------------
subprocess.run(["ffmpeg","-v","error","-y","-i","narration.wav","-ac","1","-ar",str(SR),"-f","s16le","_v.raw"],check=True)
v=np.fromfile("_v.raw",dtype=np.int16).astype(np.float64)/32768; v=np.pad(v,(0,max(0,N-len(v))))[:N]
e=lp(np.abs(v),6); e=np.clip(e/max(e.max(),1e-6)*6,0,1)          # 0 = silence, 1 = speaking
duck=1-0.62*lp(e,3)                                                # music drops ~8 dB while the voice is on
MUSIC_GAIN=float(sys.argv[1]) if len(sys.argv)>1 else 0.16
mix=v+sfx*0.20+M*duck*MUSIC_GAIN
mix=np.tanh(mix*1.05)/np.tanh(1.05)*0.92
wavfile.write("final_audio.wav",SR,(mix*32767).astype(np.int16))
wavfile.write("music_only.wav",SR,(M*duck*MUSIC_GAIN*32767).astype(np.int16)); wavfile.write("sfx_only.wav",SR,(sfx*0.20*32767).astype(np.int16))
rms=lambda x: 20*np.log10(np.sqrt(np.mean(x**2))+1e-9)
print(f"voice {rms(v):.1f} dB | music {rms(M*duck*MUSIC_GAIN):.1f} dB | sfx {rms(sfx*0.20):.1f} dB | mix peak {20*np.log10(np.abs(mix).max()):.1f} dB")
