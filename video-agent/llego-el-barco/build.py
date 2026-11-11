import json, re, unicodedata, os, shutil
T=json.load(open("timing.json")); SEG={s["id"]:s for s in T["segs"]}; TOTAL=T["total"]
def norm(s): return re.sub(r"[^a-z0-9ñ]","","".join(c for c in unicodedata.normalize("NFD",s.lower()) if unicodedata.category(c)!="Mn"))
def tokens(s):
    ws=s["text"].split(); hw=s["words"]
    if len(hw)==len(ws): return [(w,h["s"],h["e"]) for w,h in zip(ws,hw)]
    a=hw[0]["s"] if hw else s["start"]; b_=hw[-1]["e"] if hw else s["end"]; tot=sum(len(w)+1 for w in ws); out=[]; acc=0
    for w in ws:
        st_=a+(b_-a)*acc/tot; acc+=len(w)+1; out.append((w,round(st_,3),round(a+(b_-a)*acc/tot,3)))
    return out
def merge(tk):
    out=[]; i=0
    while i<len(tk):
        if [norm(x[0]) for x in tk[i:i+5]]==["vender","en","usa","punto","com"]:
            out.append(("venderenusa.com",tk[i][1],tk[i+4][2])); i+=5
        else: out.append(tk[i]); i+=1
    return out
TOK={k:merge(tokens(s)) for k,s in SEG.items()}
def kw(seg,prefix,nth=1):
    n=0
    for w,s,e in TOK[seg]:
        if norm(w).startswith(prefix):
            n+=1
            if n==nth: return round(s,2)
    raise SystemExit(f"cue not found {seg} {prefix}")
st=lambda k: SEG[k]["start"]; en=lambda k: SEG[k]["end"]
caps=[]
for k in SEG:
    cur=[]
    for i,(w,s,e) in enumerate(TOK[k]):
        cur.append((w,s,e)); text=" ".join(x[0] for x in cur)
        if len(text)>=20 or (w[-1] in ".?:," and len(text)>=10) or i==len(TOK[k])-1:
            caps.append(cur); cur=[]
cap_html=[]; cap_js=[]
for i,c in enumerate(caps):
    end = caps[i+1][0][1] if i+1<len(caps) and caps[i+1][0][1]-c[-1][2]<0.45 else c[-1][2]+0.3
    words=[x[0] for x in c]; times=[x[1] for x in c]
    cap_html.append(f'<div class="cap" id="cap{i}">'+" ".join(f'<span id="w{i}_{j}">{w}</span>' for j,w in enumerate(words))+'</div>')
    cap_js.append(f'tl.set("#cap{i}",{{autoAlpha:1}},{max(c[0][1]-0.05,0):.2f}).set("#cap{i}",{{autoAlpha:0}},{end:.2f});')
    for j,t in enumerate(times):
        cap_js.append(f'tl.set("#w{i}_{j}",{{color:"#ce4206"}},{max(t-0.03,0):.2f});'+(f'tl.set("#w{i}_{j}",{{color:"#101c29"}},{times[j+1]-0.03:.2f});' if j+1<len(times) else ''))
SITE=os.path.join("..","site","assets")
def site_svg(name, prefix, width, sw=5, style=""):
    """Inline one of the site's sketch SVGs so each stroke can draw itself."""
    src=open(os.path.join(SITE,name+"-sketch.svg")).read(); out=[]; n=0
    for tag,attrs in re.findall(r"<(path|circle)\b([^>]*?)/>",src):
        at=dict(re.findall(r'([\w-]+)="([^"]*)"',attrs)); geo=" ".join(f'{k}="{at[k]}"' for k in ("d","cx","cy","r") if k in at)
        if at.get("stroke")=="none": out.append(f'<{tag} class="sfill {prefix}f" fill="{at.get("fill")}" {geo}/>')
        else:
            col="#ce4206" if at.get("stroke")=="#a63d18" else "#101c29"
            out.append(f'<{tag} class="d {prefix}s" pathLength="1" vector-effect="non-scaling-stroke" style="stroke:{col};fill:{at.get("fill","none")};stroke-width:{sw}px" {geo}/>'); n+=1
    return f'<svg class="sk" viewBox="0 0 260 132" style="width:{width}px;height:{round(width*132/260)}px;{style}">'+"".join(out)+'</svg>'
C=dict(TOTAL=TOTAL,
 cinco=kw("c1","cinco"), tocar=kw("c1","tocar"), llegar=kw("c1","llegar"), liberada=kw("c1","liberada"),
 aduana=kw("c2","aduana"), transp=kw("c2","transportista"), coord=kw("c2","coordin"), cobrar=kw("c2","cobrar"), s1end=st("c3")-0.4,
 s2=st("c3")-0.1, llegada=kw("c3","llegada"), liberacion=kw("c3","liberacion"), entrega=kw("c3","entrega"), tres=kw("c3","tres"), quien=kw("c3","quien"),
 c4=st("c4"), revisa=kw("c4","revisa"), url=kw("c4","venderenusa"),
 SHIP=site_svg("port","sh",400,5), ICA=site_svg("clearance","ia",118,2.6), ICB=site_svg("port","ib",118,2.6), ICC=site_svg("warehouse","ic",118,2.6),
 P1=site_svg("port","p1",300,4.2), P2=site_svg("clearance","p2",300,4.2), P3=site_svg("warehouse","p3",300,4.2))
json.dump({k:v for k,v in C.items() if isinstance(v,(int,float))},open("cues.json","w"))
def fillt(s):
    for k,v in C.items(): s=s.replace("{{%s}}"%k, f"{v:.2f}" if isinstance(v,float) else str(v))
    return s
CSS=open("style.css").read(); BODY=fillt(open("body.html").read()); JS=fillt(open("anim.js").read())
SRC_AUDIO = next((f for f in ("final_audio.wav","narration.wav") if os.path.exists(f)), None)   # sfx mix if present, else voice only
AUDIO = f'<audio id="vo" src="narration.wav" data-start="0" data-duration="{TOTAL}" data-track-index="1" data-volume="1"></audio>' if SRC_AUDIO else ""
html=f'''<!doctype html>
<html lang="es" data-resolution="portrait"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=1080, height=1920"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{CSS}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1080" data-height="1920">
{AUDIO}
<div id="scene" class="clip" data-start="0" data-duration="{TOTAL}" data-track-index="0">
{BODY}
<div id="capband">{"".join(cap_html)}</div>
</div></div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{JS}
{chr(10).join(cap_js)}
tl.to({{}},{{duration:0.01}},{TOTAL-0.02:.2f});
window.__timelines["main"] = tl; tl.seek(0);
</script></body></html>'''
os.makedirs("project",exist_ok=True)
for f in ("hyperframes.json","package.json"): shutil.copy(os.path.join("..","hf","trial",f),"project")
json.dump({"id":"llego-el-barco","name":"llego-el-barco","createdAt":"2026-11-10T21:47:09.479Z"},open("project/meta.json","w"))
open("project/index.html","w").write(html)
if SRC_AUDIO: shutil.copy(SRC_AUDIO,"project/narration.wav")
print("built",TOTAL,"s",len(caps),"captions")
