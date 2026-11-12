import sys, os; sys.path.insert(0, os.path.join("..","common")); from buildlib import Video, site_svg
V=Video(); kw,st=V.kw,V.st
C=dict(
 cert=kw("a1","certificado"), guarda=kw("a1","guardalo"), emite=kw("a1","emite"), noex=kw("a1","certificado",2),
 s1end=st("a2")-0.45, registro=kw("a2","registro"), agente=kw("a2","agente"), listado=kw("a2","listado"),
 nada=st("a3"), aprobado=kw("a3","aprobado"), cual=kw("a3","cual"), a4=st("a4"), revisa=kw("a4","revisamos"), url=kw("a4","venderenusa"),
 P1=site_svg("brand","p1",220,3.6), P2=site_svg("shipment","p2",220,3.6), P3=site_svg("agent","p3",220,3.6))
ev=[]; put=lambda k,t,g=1.0,x=0: ev.append([k,round(t,3),g,x])
put("scratch",0.05,0.9,1.5); put("pop",C["cert"]-0.05,0.6); put("scratch",C["emite"]-0.1,0.9,0.5); put("thud",C["noex"]+0.2)
put("whoosh",C["s1end"]-0.02,0.9)
for k in ("registro","agente","listado"): put("pop",C[k]-0.2,0.5,1); put("scratch",C[k]-0.15,0.8,0.7)
put("pop",C["aprobado"]-0.45,0.6); put("scratch",C["aprobado"]+0.05,0.9,0.35); put("scratch",C["cual"]-0.1,0.9,0.9); put("pop",C["cual"]+0.1,0.6)
put("ding",C["revisa"]-0.2,0.9); put("pop",C["url"]-0.1,0.5,1)
V.build(C, ev, "el-certificado-que-no-existe", tag="RUTA 01 · AGENTE FDA")
