import sys, os; sys.path.insert(0, os.path.join("..","common")); from buildlib import Video, site_svg
V=Video(); kw,st=V.kw,V.st
C=dict(
 tres=kw("b1","tres"), F=kw("b1","f",2), O=kw("b1","o"), B=kw("b1","b"), entrega=kw("b1","entrega"), puerto=kw("b1","puerto"), termina=kw("b1","termina"),
 s1end=st("b2")-0.45, barco=kw("b2","barco"), seguro=kw("b2","seguro"), arancel=kw("b2","arancel"), aduana=kw("b2","aduana"), camion=kw("b2","camion"), todo=kw("b2","todo"),
 cuanto=kw("b3","cuanto"), nodice=kw("b3","no"), b4=st("b4"), calcula=kw("b4","calcula"), url=kw("b4","venderenusa"),
 FAB=site_svg("brand","fa",190,3.4), PORT=site_svg("port","po",190,3.4),
 I1=site_svg("port","i1",112,2.6), I2=site_svg("agent","i2",112,2.6), I3=site_svg("clearance","i3",112,2.6), I4=site_svg("shipment","i4",112,2.6), I5=site_svg("warehouse","i5",112,2.6))
ev=[]; put=lambda k,t,g=1.0,x=0: ev.append([k,round(t,3),g,x])
put("pop",0.05,0.6); put("scratch",C["tres"]-0.05,0.9,0.6)
for i,k in enumerate(("F","O","B")): put("pop",C[k]-0.05,0.8,i); put("tick",C[k]-0.05,0.7)
put("scratch",C["entrega"]-0.1,0.8,0.7); put("scratch",C["puerto"]-0.2,0.8,0.8); put("thud",C["termina"]+0.2)
put("whoosh",C["s1end"]-0.02,0.9)
for i,k in enumerate(("barco","seguro","arancel","aduana","camion")):
    put("pop",C[k]-0.25,0.5); put("scratch",C[k]-0.1,0.75,0.5); put("tick",C[k]+0.3,0.8); put("coin",C[k]+0.32,0.9,i)
put("thud",C["todo"]+0.25); put("pop",C["cuanto"]-0.05,0.6); put("scratch",C["nodice"]+0.1,0.9,0.4)
put("ding",C["calcula"]-0.2,0.9); put("pop",C["url"]-0.1,0.5,1)
V.build(C, ev, "tres-letras-fob", tag="EJEMPLO ILUSTRATIVO")
