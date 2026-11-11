import sys, glob
from PIL import Image, ImageDraw, ImageFont
d=sys.argv[1]; fs=sorted(glob.glob(d+"/frame-0[0-4]*.png")); out=Image.new("RGB",(540*len(fs)+20*(len(fs)+1),960+110),"#1a1a1a")
try: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",20)
except Exception: f=ImageFont.load_default()
for i,p in enumerate(fs):
    im=Image.open(p).convert("RGBA"); ov=Image.new("RGBA",im.size,(0,0,0,0)); dr=ImageDraw.Draw(ov)
    dr.rectangle([0,0,1080,250],fill=(220,30,30,95))          # top: account name / search bar
    dr.rectangle([0,1440,1080,1920],fill=(220,30,30,95))      # bottom: caption text, audio, nav
    dr.rectangle([960,900,1080,1440],fill=(30,90,220,105))    # right: like / comment / share column
    im=Image.alpha_composite(im,ov).convert("RGB").resize((540,960)); out.paste(im,(20+i*560,20))
dd=ImageDraw.Draw(out)
dd.text((20,990),"Rojo: zonas que cubren Instagram, TikTok y YouTube Shorts (arriba 250 px, abajo 480 px).",fill="#ff8080",font=f)
dd.text((20,1022),"Azul: columna de botones a la derecha (me gusta, comentar, compartir).",fill="#80a8ff",font=f)
dd.text((20,1054),"Texto, subtítulos y botón quedan en la zona libre.",fill="#ffffff",font=f)
out.save(sys.argv[2],quality=90)
