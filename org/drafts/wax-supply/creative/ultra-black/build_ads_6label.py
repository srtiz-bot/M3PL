# Ultra Black ads, 6-label layout mirroring the Euro Clear sample ads (Nov 2026)
VARIANTS = {'math': ['THE MATH ONLY', 'WORKS IN BULK'], 'onebag': ['STOP BUYING WAX', 'ONE BAG AT A TIME']}
S = 600/1040; BW = 824*S
IMG_W = 1254*S; IMG_L = (540-BW/2) - 220*S; IMG_T = 470 - 88*S
# label, side, label_y (center), dot (x,y)
CALLOUTS = [
 ('Fragrance-Free',     'L', 495, (372, 548)),
 ('Sets in 10 Seconds', 'L', 703, (392, 703)),
 ('Rosin-Free',         'R', 495, (704, 556)),
 ('Strong Grip',        'R', 735, (726, 782)),
 ('Stays Flexible',     'R', 905, (722, 948)),
]
def labels():
    h=[]
    for i,(lab,side,ly,(dx,dy)) in enumerate(CALLOUTS):
        st=f'left:92px' if side=='L' else 'right:92px'
        h.append(f'<div class="co {side}" data-dx="{dx}" data-dy="{dy}" style="{st};top:{ly-16}px">{lab}</div>')
    h.append('<div class="co L size" data-dx="470" data-dy="1012" style="left:92px;top:992px">10 × 2.2 LB</div>')
    return ''.join(h)
JS = '''<script>
document.fonts.ready.then(()=>{
 const svg=document.getElementById('ln'); const ns='http://www.w3.org/2000/svg'; const blk=document.querySelector('.blk').getBoundingClientRect();
 document.querySelectorAll('.co').forEach(el=>{
  const r=el.getBoundingClientRect(); const dx=+el.dataset.dx, dy=+el.dataset.dy;
  const y=r.top-blk.top+r.height/2; const L=el.classList.contains('L');
  const x0=L? r.right-blk.left+14 : r.left-blk.left-14;
  let pts;
  if(el.classList.contains('size')) pts=`${x0},${y} ${dx},${dy}`;
  else { const xb = L? x0+30 : x0-30; pts = Math.abs(dy-y)<4 ? `${x0},${y} ${dx},${dy}` : `${x0},${y} ${xb},${y} ${xb},${dy} ${dx},${dy}`; }
  const p=document.createElementNS(ns,'polyline'); p.setAttribute('points',pts); svg.appendChild(p);
  const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',dx); c.setAttribute('cy',dy); c.setAttribute('r',el.classList.contains('size')?7:6);
  c.setAttribute('fill','#fff'); c.setAttribute('stroke-width','3'); svg.appendChild(c);
 });
 document.body.dataset.ready=1;
});
</script>'''
def block(lines):
    return f'''<div class="blk">
<div class="wm"><b>WAX</b> SUPPLY</div>
<h1>{lines[0]}<br>{lines[1]}</h1>
<div class="sub">Ultra Black 22 lb bulk — <b>$10.10 a pound.</b></div>
<img class="bag" src="b_single_w.jpg">
<svg id="ln" width="1080" height="1350" style="position:absolute;left:0;top:0" stroke="#111" stroke-width="2" fill="none"></svg>
{labels()}
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
svg{{z-index:2}} .co,.sub,h1,.wm,.url,.offer{{z-index:3}}
.co{{position:absolute;font-size:26px;line-height:1.25;font-weight:400;white-space:nowrap}}
.co.size{{font-size:31px;font-weight:700;line-height:40px}}
.dot{{padding:0 6px}}
.url{{position:absolute;top:1153px;width:100%;text-align:center;font-size:22px;color:#777}}
.offer{{position:absolute;top:1203px;width:100%;text-align:center;font-size:40px;font-weight:400}}
.hl{{background:#f2c55c;font-weight:700;padding:0 10px;border-radius:4px}}'''
for k,lines in VARIANTS.items():
    open(f'UB6_{k}_feed.html','w').write(f'<!doctype html><html><head><meta charset=utf-8><style>{CSS} html,body{{width:1080px;height:1350px}} .blk{{top:0}}</style></head><body>{block(lines)}{JS}</body></html>')
    open(f'UB6_{k}_story.html','w').write(f'<!doctype html><html><head><meta charset=utf-8><style>{CSS} html,body{{width:1080px;height:1920px}} .blk{{top:200px}}</style></head><body>{block(lines)}{JS}</body></html>')
