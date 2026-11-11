import json, re, unicodedata, os, shutil
T=json.load(open("timing.json")); SEG={s["id"]:s for s in T["segs"]}; TOTAL=T["total"]; D=json.load(open("data.json"))
def norm(s): return re.sub(r"[^a-z0-9ñ]","","".join(c for c in unicodedata.normalize("NFD",s.lower()) if unicodedata.category(c)!="Mn"))
def merge(tk):
    out=[]; i=0
    while i<len(tk):
        if [norm(x[0]) for x in tk[i:i+5]]==["vender","en","usa","punto","com"]:
            out.append(("venderenusa.com",tk[i][1],tk[i+4][2])); i+=5
        else: out.append(tk[i]); i+=1
    return out
def tokens(s):
    ws=s["text"].split(); hw=s["words"]
    if len(hw)==len(ws): return [(w,h["s"],h["e"]) for w,h in zip(ws,hw)]
    a=hw[0]["s"] if hw else s["start"]; b_=hw[-1]["e"] if hw else s["end"]; tot=sum(len(w)+1 for w in ws); out=[]; acc=0
    for w in ws:
        st_=a+(b_-a)*acc/tot; acc+=len(w)+1; out.append((w,round(st_,3),round(a+(b_-a)*acc/tot,3)))
    return out
TOK={k:merge(tokens(s)) for k,s in SEG.items()}
def kw(seg,prefix,nth=1,default=None):
    n=0
    for w,s,e in TOK[seg]:
        if norm(w).startswith(prefix):
            n+=1
            if n==nth: return round(s,2)
    if default is not None: return default
    raise SystemExit(f"cue not found {seg} {prefix}")
st=lambda k: SEG[k]["start"]; en=lambda k: SEG[k]["end"]
money=lambda v: f"{v:.2f}"
# ---------- captions (karaoke, safe zone) ----------
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
        cap_js.append(f'tl.set("#w{i}_{j}",{{color:"#c9421a"}},{max(t-0.03,0):.2f});'+(f'tl.set("#w{i}_{j}",{{color:"#13202e"}},{times[j+1]-0.03:.2f});' if j+1<len(times) else ''))
# ---------- glass geometry ----------
BOT,RIM,TOPY=952,460,430; PX=(BOT-RIM)/D["price"]; ly=lambda v: round(BOT-PX*v,1)
SITE=os.path.join("..","site","assets")
def site_icon(name, prefix, x, y, scale, sw=5):
    """Inline one of the site's own sketch SVGs so each stroke can be drawn on."""
    src=open(os.path.join(SITE,name+"-sketch.svg")).read(); out=[]; n=0
    for tag,attrs in re.findall(r"<(path|circle)\b([^>]*?)/>",src):
        at=dict(re.findall(r'([\w-]+)="([^"]*)"',attrs)); geo=" ".join(f'{k}="{at[k]}"' for k in ("d","cx","cy","r") if k in at)
        if at.get("stroke")=="none":
            out.append(f'<{tag} class="sfill {prefix}f" fill="{at.get("fill")}" {geo}/>')
        else:
            col="#ce4206" if at.get("stroke")=="#a63d18" else "#101c29"; fl=at.get("fill","none")
            out.append(f'<{tag} class="d ic {prefix}s" id="{prefix}s{n}" pathLength="1" vector-effect="non-scaling-stroke" style="stroke:{col};fill:{fl};stroke-width:{sw}px" {geo}/>'); n+=1
    return f'<g transform="translate({x},{y}) scale({scale})">'+"".join(out)+'</g>'
ROWICON={"c1":"brand","c2":"port","c3":"clearance","c4":"agent","c5":"warehouse"}
rows=[]; rows_js=[]; run=0
for i,c in enumerate(D["costs"]):
    y=440+i*96; k=c["key"]; prev=run; run=round(run+c["amount"],2); t=st(k)
    lab=c["label"]; m=re.match(r"(.*?)\s+([\d.]+%)$",lab)
    lab_svg = f'{m.group(1)} <tspan style="font-size:30px;fill:#ce4206">{m.group(2)}</tspan>' if m else lab
    rows.append(f'''<g id="row{i}">{site_icon(ROWICON[k],f"r{i}",540,y+2,0.4,2.6)}
<text id="lb{i}" class="hand" x="656" y="{y+50}" style="font-size:{34 if len(lab)>13 and not m else (44 if m else 52)}px">{lab_svg}</text>
<text id="am{i}" class="amt" x="984" y="{y+50}" text-anchor="end">+{money(c["amount"])}</text>
<path class="sep" d="M548 {y+84} H984"/>
<path id="str{i}" class="stream" pathLength="1" d="M536 {y+36} C 520 {y-140} 430 330 300 344 L300 {ly(prev)+6}"/></g>''')
    amt_t = kw(k,"cinco",default=t+0.9) if k=="c1" else (kw(k,"doce",default=t+0.9) if k=="c3" else t+0.8)
    rows_js.append(f'''draw(".r{i}s",{t:.2f},0.3,0.09); tl.to(".r{i}f",{{opacity:1,duration:0.2}},{t+0.5:.2f}); rise("#lb{i}",{t+0.2:.2f},{{x:-24,y:0}}); tl.from("#row{i} .sep",{{autoAlpha:0,duration:0.2}},{t+0.2:.2f});
tl.from("#am{i}",{{autoAlpha:0,scale:1.8,transformOrigin:"100% 60%",duration:0.22,ease:"back.out(2.5)"}},{amt_t:.2f});
pour("#str{i}",{amt_t+0.12:.2f}); fill({prev},{run},{amt_t+0.38:.2f},0.75);''')
base=run; left=round(D["price"]-base,2)
ex=[]; ex_js=[]; lv=base
for j,e in enumerate(D["extras"]):
    y=968+j*62; t=kw("o1",e["kw"],default=st("o1")+0.8+j*0.9); prev=lv; lv=round(lv+e["amount"],2)
    ex.append(f'<text id="ex{j}" class="hand hot" x="560" y="{y}">+ {e["label"]}</text><text id="exa{j}" class="amt" x="984" y="{y}" text-anchor="end">+{money(e["amount"])}</text><path id="exs{j}" class="stream" pathLength="1" d="M300 330 L300 {max(ly(prev),TOPY)+6}"/>')
    ex_js.append(f'rise("#ex{j}",{t:.2f},{{x:-24,y:0}}); tl.from("#exa{j}",{{autoAlpha:0,scale:1.8,transformOrigin:"100% 60%",duration:0.22,ease:"back.out(2.5)"}},{t+0.25:.2f}); pour("#exs{j}",{t+0.3:.2f}); fill({prev},{lv},{t+0.55:.2f},0.6,true);')
final=lv; over=final>D["price"]; rest=round(D["price"]-final,2)
spill_t = kw("o1",D["extras"][-1]["kw"],default=en("o1")-0.6)+0.9
C=dict(TOTAL=TOTAL, g0=st("g0"), h1=st("h1"), h1p=kw("h1","cinco"), h2=st("h2"), h2p=kw("h2","veinticinco"), h3=kw("h2","ganas"), h3p=kw("h2","veinte"),
 gout=st("g0")-0.35, t1=st("t1"), t1q=kw("t1","queda"), o1=st("o1"), o2=st("o2"), o2p=kw("o2","veinte"), o2q=kw("o2","queda"), spill=spill_t, over=("true" if over else "false"), rest=money(rest), braceTop=RIM+2, braceBot=ly(base)-2, braceMid=round((RIM+ly(base))/2), bracePath=f"M494 {RIM+4} q16 2 16 20 V{round((RIM+ly(base))/2)-16} q0 16 14 16 q-14 0 -14 16 V{ly(base)-24} q0 18 -16 20", naiveInt=f'{D["price"]-D["costs"][0]["amount"]:g}', restRound=f"{round(rest):d}" if rest>0 else "0", e1=st("e1")-0.15, e1n=kw("e1","nunca"), e2=st("e2"), e2v=kw("e2","llena"), e3=st("e3"), e3u=kw("e3","venderenusa"), hookIcon=site_icon("agent","hk",330,676,1.62), endIcon=site_icon("warehouse","en",560,1010,1.3),
 BOT=BOT, RIM=RIM, PX=PX, base=money(base), left=money(left), price=f'{D["price"]:g}', fab=f'{D["costs"][0]["amount"]:g}', naive=f'{D["price"]-D["costs"][0]["amount"]:g}')
def fillt(s):
    for k,v in C.items(): s=s.replace("{{%s}}"%k, f"{v:.2f}" if isinstance(v,float) else str(v))
    return s
CSS=open("style.css").read(); BODY=fillt(open("body.html").read()).replace("<!--ROWS-->","\n".join(rows)).replace("<!--EXTRAS-->","\n".join(ex)); JS=fillt(open("anim.js").read()).replace("//ROWS","\n".join(rows_js)).replace("//EXTRAS","\n".join(ex_js))
audio = f'<audio id="vo" src="narration.wav" data-start="0" data-duration="{TOTAL}" data-track-index="1" data-volume="1"></audio>' if os.path.exists("narration.wav") and not T.get("estimated") else ""
html=f'''<!doctype html>
<html lang="es" data-resolution="portrait"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=1080, height=1920"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{CSS}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1080" data-height="1920">
{audio}
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
json.dump({"id":"llena-el-vaso-colombia","name":"llena-el-vaso-colombia","createdAt":"2026-11-10T21:47:09.479Z"},open("project/meta.json","w"))
open("project/index.html","w").write(html)
if audio: shutil.copy("narration.wav","project/narration.wav")
print("built",TOTAL,"s",len(caps),"captions; base",base,"left",left)
