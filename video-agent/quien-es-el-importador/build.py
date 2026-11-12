import sys, os; sys.path.insert(0, os.path.join("..","common")); from buildlib import Video, site_svg
V=Video(); kw,st=V.kw,V.st
C=dict(
 entrar=kw("h1","entrar"), nadie=kw("h1","nadie"), imp=kw("h1","importador"),
 declara=kw("h2","declara"), paga=kw("h2","paga"), responde=kw("h2","responde",2), ese=kw("h2","ese"),
 s1end=st("h3")-0.45, alm=st("h3"), almNo=kw("h3","no"), agente=kw("h3","agente"), tampoco=kw("h3","tampoco"),
 quien=st("h4"), optA=kw("h4","propia"), optB=kw("h4","extranjera"), optC=kw("h4","comprador"),
 decide=kw("h5","decidelo"), antes=kw("h5","antes"),
 s2end=st("h6")-0.45, cta=kw("h6","revisamos"), url=kw("h6","venderenusa"),
 WH=site_svg("warehouse","wh",300,4.2), BR=site_svg("clearance","br",300,4.2),
 IA=site_svg("brand","oa",112,2.6), IB=site_svg("shipment","ob",112,2.6), IC=site_svg("agent","oc",112,2.6),
 END=site_svg("shipment","en",520,5))
ev=[]; put=lambda k,t,g=1.0,x=0: ev.append([k,round(t,3),g,x])
put("pop",0.05,0.6); put("scratch",0.25,0.7,0.8); put("thud",C["entrar"]+0.2); put("scratch",C["nadie"]-0.05,0.9,0.7); put("tick",C["imp"],0.8)
for k in ("declara","paga","responde"): put("pop",C[k]-0.25,0.5); put("scratch",C[k]+0.1,0.8,0.3)
put("scratch",C["ese"]-0.1,0.9,0.6); put("whoosh",C["s1end"]-0.02,0.9)
put("scratch",C["alm"]+0.05,0.8,0.7); put("scratch",C["almNo"]-0.05,1.0,0.4); put("scratch",C["agente"]-0.15,0.8,0.7); put("scratch",C["tampoco"]-0.05,1.0,0.4)
put("pop",C["quien"]+0.2,0.7)
for i,k in enumerate(("optA","optB","optC")): put("pop",C[k]-0.25,0.6,i); put("scratch",C[k]-0.1,0.75,0.5)
put("scratch",C["antes"]-0.05,0.9,0.5); put("whoosh",C["s2end"]-0.02,0.9); put("scratch",C["s2end"]+0.4,0.8,1.0)
put("ding",C["cta"]-0.3,0.9); put("pop",C["url"]-0.1,0.5,1)
V.build(C, ev, "quien-es-el-importador", tag="CAFÉ · HONDURAS")
