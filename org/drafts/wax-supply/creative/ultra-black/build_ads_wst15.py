VARIANTS = {
 'math':   ['THE MATH ONLY', 'WORKS IN BULK'],
 'onebag': ['STOP BUYING WAX', 'ONE BAG AT A TIME'],
}
# bag in 1254px photo: x 220-1044, y 88-1128 ; target bag box x 263-817, y 445-1145
S = 600/1040
BW = 824*S
IMG_W = 1254*S; IMG_L = (540-BW/2) - 220*S; IMG_T = 470 - 88*S
CALLOUTS = [  # label, side, label_y, dot(x,y)
 ('Fragrance-Free', 'L', 495, (330, 545)),
 ('Hypoallergenic<br>Rosin-Free', 'R', 480, (752, 560)),
 ('Sets in 10 Seconds', 'L', 703, (322, 745)),
 ('Ships Same Day', 'R', 737, (760, 790)),
]
def svg():
    out=[]
    for lab,side,ly,(dx,dy) in CALLOUTS:
        lw={'Fragrance-Free':260,'Sets in 10 Seconds':290}.get(lab,272)
        if side=='L':
            x0=lw; ylab=ly+1
            out.append(f'<polyline points="{x0},{ylab} 300,{ylab} 300,{dy} {dx},{dy}"/>')
        else:
            x0=812; ylab=ly+31 if '<br>' in lab else ly+1
            out.append(f'<polyline points="{x0},{ylab} 792,{ylab} 792,{dy} {dx},{dy}"/>')
        out.append(f'<circle cx="{dx}" cy="{dy}" r="6"/>')
    out.append('<line x1="272" y1="1012" x2="470" y2="1012"/><circle cx="470" cy="1012" r="7"/>')
    return '<svg width="1080" height="1350" style="position:absolute;left:0;top:0" stroke="#111" stroke-width="2" fill="none"><g>'+''.join(out).replace('<circle','<circle fill="#fff" stroke-width="3"')+'</g></svg>'
def labels():
    h=[]
    for lab,side,ly,_ in CALLOUTS:
        if side=='L': h.append(f'<div class="co" style="left:92px;top:{ly-17}px">{lab}</div>')
        else: h.append(f'<div class="co r" style="right:92px;top:{ly-17}px">{lab}</div>')
    return ''.join(h)
def block(lines):
    return f'''<div class="blk">
<div class="wm"><b>WAX</b> SUPPLY</div>
<h1>{lines[0]}<br>{lines[1]}</h1>
<div class="sub">Ultra Black 22 lb bulk — <b>$10.10 a pound.</b></div>
<img class="bag" src="b_single_w.jpg">
{svg()}{labels()}
<div class="size">10 × 2.2 LB</div>
<div class="url">www.waxsupply.com</div>
<div class="offer">15% off first order: <span class="hl">WST15</span> <span class="dot">·</span> Free shipping</div>
</div>'''
CSS = f'''@font-face{{font-family:SS3;src:url(ss3.woff2) format("woff2");font-weight:200 900}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#fff;font-family:SS3,sans-serif;color:#111;position:relative;overflow:hidden}}
.blk{{position:absolute;left:0;width:1080px;height:1350px}}
.wm{{position:absolute;top:104px;width:100%;text-align:center;font-size:31px;letter-spacing:.2em;font-weight:300;color:#777}}
.wm b{{font-weight:700;color:#111}}
h1{{position:absolute;top:196px;width:100%;text-align:center;font-weight:900;font-size:86px;line-height:1.06;letter-spacing:-.3px}}
.sub{{position:absolute;top:382px;width:100%;text-align:center;font-size:38px;font-weight:400}}
.sub b{{font-weight:700}}
.bag{{position:absolute;left:{IMG_L:.1f}px;top:{IMG_T:.1f}px;width:{IMG_W:.1f}px;mix-blend-mode:multiply;z-index:0}}
svg{{z-index:2}} .co,.size,.sub,h1,.wm,.url,.offer{{z-index:3}}
.co{{position:absolute;font-size:25px;line-height:1.25;font-weight:400}}
.co.r{{text-align:right}}
.size{{position:absolute;left:92px;top:992px;font-size:31px;font-weight:700}}
.dot{{padding:0 6px}}
.url{{position:absolute;top:1153px;width:100%;text-align:center;font-size:22px;color:#777}}
.offer{{position:absolute;top:1203px;width:100%;text-align:center;font-size:40px;font-weight:400}}
.hl{{background:#f2c55c;font-weight:700;padding:0 10px;border-radius:4px}}'''
for k,lines in VARIANTS.items():
    open(f'UBW_{k}_feed.html','w').write(f'<!doctype html><html><head><meta charset=utf-8><style>{CSS} html,body{{width:1080px;height:1350px}} .blk{{top:0}}</style></head><body>{block(lines)}</body></html>')
    open(f'UBW_{k}_story.html','w').write(f'<!doctype html><html><head><meta charset=utf-8><style>{CSS} html,body{{width:1080px;height:1920px}} .blk{{top:200px}}</style></head><body>{block(lines)}</body></html>')
