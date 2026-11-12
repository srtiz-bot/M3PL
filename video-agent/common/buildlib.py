"""Shared builder: word timings -> cues -> captions -> one HyperFrames HTML page."""
import json, re, unicodedata, os, shutil
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def norm(s): return re.sub(r"[^a-z0-9ñ]","","".join(c for c in unicodedata.normalize("NFD",s.lower()) if unicodedata.category(c)!="Mn"))
def site_svg(name, prefix, width, sw=5, style="", ink="#101c29", accent="#ce4206", paper=None):
    """Inline one of the site's sketch SVGs so each stroke can draw itself."""
    src=open(os.path.join(ROOT,"site","assets",name+"-sketch.svg")).read(); out=[]
    for tag,attrs in re.findall(r"<(path|circle)\b([^>]*?)/>",src):
        at=dict(re.findall(r'([\w-]+)="([^"]*)"',attrs)); geo=" ".join(f'{k}="{at[k]}"' for k in ("d","cx","cy","r") if k in at)
        fl=at.get("fill","none"); fl=accent if fl=="#a63d18" else (paper if (paper and fl=="#fcfcfa") else fl)
        if at.get("stroke")=="none": out.append(f'<{tag} class="sfill {prefix}f" fill="{fl}" {geo}/>')
        else:
            col=accent if at.get("stroke")=="#a63d18" else ink
            out.append(f'<{tag} class="d {prefix}s" pathLength="1" vector-effect="non-scaling-stroke" style="stroke:{col};fill:{fl};stroke-width:{sw}px" {geo}/>')
    return f'<svg class="sk" viewBox="0 0 260 132" style="width:{width}px;height:{round(width*132/260)}px;flex:none;{style}">'+"".join(out)+'</svg>'
JS_HELPERS='''
const draw=(sel,t,d=0.3,s=0.1)=>tl.to(sel,{strokeDashoffset:0,duration:d,stagger:s,ease:"power1.inOut"},t);
const rise=(sel,t,o={})=>tl.from(sel,Object.assign({autoAlpha:0,y:28,duration:0.3,ease:"power3.out"},o),t);
const slam=(sel,t,rot)=>{tl.fromTo(sel,{autoAlpha:0,scale:2.8,rotation:rot-14},{autoAlpha:1,scale:1,rotation:rot,duration:0.18,ease:"power4.in"},t).fromTo("#paper",{x:0},{x:10,duration:0.04,repeat:5,yoyo:true,ease:"none"},t+0.18);};
const turn=(a,b,t)=>{tl.to(a,{autoAlpha:0,y:-110,duration:0.28,ease:"power2.in"},t);tl.fromTo(b,{autoAlpha:0,y:70},{autoAlpha:1,y:0,duration:0.28,ease:"power3.out"},t+0.3);};
'''
class Video:
    def __init__(self):
        T=json.load(open("timing.json")); self.SEG={s["id"]:s for s in T["segs"]}; self.TOTAL=T["total"]
        self.TOK={k:self._merge(self._tokens(s)) for k,s in self.SEG.items()}
    def _tokens(self,s):
        ws=s["text"].split(); hw=s["words"]
        if len(hw)==len(ws): return [(w,h["s"],h["e"]) for w,h in zip(ws,hw)]
        a=hw[0]["s"] if hw else s["start"]; b=hw[-1]["e"] if hw else s["end"]; tot=sum(len(w)+1 for w in ws); out=[]; acc=0
        for w in ws:
            st=a+(b-a)*acc/tot; acc+=len(w)+1; out.append((w,round(st,3),round(a+(b-a)*acc/tot,3)))
        return out
    def _merge(self,tk):
        out=[]; i=0
        while i<len(tk):
            if [norm(x[0]) for x in tk[i:i+5]]==["vender","en","usa","punto","com"]:
                out.append(("venderenusa.com",tk[i][1],tk[i+4][2])); i+=5
            else: out.append(tk[i]); i+=1
        return out
    def kw(self,seg,prefix,nth=1):
        n=0
        for w,s,e in self.TOK[seg]:
            if norm(w).startswith(prefix):
                n+=1
                if n==nth: return round(s,2)
        raise SystemExit(f"cue not found: {seg} {prefix} in {[norm(w) for w,_,_ in self.TOK[seg]]}")
    def st(self,k): return self.SEG[k]["start"]
    def en(self,k): return self.SEG[k]["end"]
    def captions(self, cur="#ce4206", done="#101c29"):
        caps=[]
        for k in self.SEG:
            cur=[]
            for i,(w,s,e) in enumerate(self.TOK[k]):
                cur.append((w,s,e)); text=" ".join(x[0] for x in cur)
                if len(text)>=20 or (w[-1] in ".?:," and len(text)>=10) or i==len(self.TOK[k])-1: caps.append(cur); cur=[]
        h=[]; j_=[]
        for i,c in enumerate(caps):
            end=caps[i+1][0][1] if i+1<len(caps) and caps[i+1][0][1]-c[-1][2]<0.45 else c[-1][2]+0.3
            words=[x[0] for x in c]; times=[x[1] for x in c]
            h.append(f'<div class="cap" id="cap{i}">'+" ".join(f'<span id="w{i}_{j}">{w}</span>' for j,w in enumerate(words))+'</div>')
            j_.append(f'tl.set("#cap{i}",{{autoAlpha:1}},{max(c[0][1]-0.05,0):.2f}).set("#cap{i}",{{autoAlpha:0}},{end:.2f});')
            for j,t in enumerate(times):
                j_.append(f'tl.set("#w{i}_{j}",{{color:"{cur}"}},{max(t-0.03,0):.2f});'+(f'tl.set("#w{i}_{j}",{{color:"{done}"}},{times[j+1]-0.03:.2f});' if j+1<len(times) else ''))
        return "".join(h),"\n".join(j_),len(caps)
    def build(self, C, events, pid, label="CUADERNO DE IMPORTACIÓN", tag="", notebook=True, base="base.css", cap=("#ce4206","#101c29")):
        """C: cue name -> seconds (or HTML snippets). events: [kind, time, gain, extra] for the sound track."""
        C=dict(C,TOTAL=self.TOTAL)
        def fill(s):
            for k,v in C.items(): s=s.replace("{{%s}}"%k, f"{v:.2f}" if isinstance(v,float) else str(v))
            return s
        css=open(os.path.join(HERE,base)).read()+(open("style.css").read() if os.path.exists("style.css") else "")
        body=fill(open("body.html").read()); js=fill(open("anim.js").read()); ch,cj,n=self.captions(*cap)
        json.dump({"total":self.TOTAL,"events":events},open("events.json","w"))
        src=next((f for f in ("final_audio.wav","narration.wav") if os.path.exists(f)),None)
        audio=f'<audio id="vo" src="narration.wav" data-start="0" data-duration="{self.TOTAL}" data-track-index="1" data-volume="1"></audio>' if src else ""
        FRAME = (f'<div class="ring" style="left:330px"></div><div class="ring" style="left:522px"></div><div class="ring" style="left:714px"></div><div id="binder"></div><div id="paper"></div><div id="label">{label}</div>'+(f'<div id="ej">{tag}</div>' if tag else '')+'<div id="rule"></div>') if notebook else ''
        html=f'''<!doctype html>
<html lang="es" data-resolution="portrait"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=1080, height=1920"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{css}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{self.TOTAL}" data-width="1080" data-height="1920">
{audio}
<div id="scene" class="clip" data-start="0" data-duration="{self.TOTAL}" data-track-index="0">
{FRAME}
{body}
<div id="capband">{ch}</div>
</div></div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{JS_HELPERS}
{js}
{cj}
tl.to({{}},{{duration:0.01}},{self.TOTAL-0.02:.2f});
window.__timelines["main"] = tl; tl.seek(0);
</script></body></html>'''
        os.makedirs("project",exist_ok=True)
        for f in ("hyperframes.json","package.json"): shutil.copy(os.path.join(ROOT,"hf","trial",f),"project")
        json.dump({"id":pid,"name":pid,"createdAt":"2026-11-10T21:47:09.479Z"},open("project/meta.json","w"))
        open("project/index.html","w").write(html)
        if src: shutil.copy(src,"project/narration.wav")
        print("built",pid,self.TOTAL,"s;",n,"captions;",len(events),"sound events; audio:",src)
