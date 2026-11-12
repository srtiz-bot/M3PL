import sys, os; sys.path.insert(0, os.path.join("..","common")); from buildlib import Video, site_svg
V=Video(); kw,st=V.kw,V.st
W="#fcfcfa"; N="#101c29"; O="#ce4206"; HOT="#ff6a2b"
C=dict(
 que=kw("s1","que"), nec=kw("s1","necesitas"), para=kw("s1","para"), tu=kw("s1","tu"), a=kw("s1","estados"), cinco0=kw("s1","cinco"), cuenta=kw("s1","contar"),
 t1=st("s2")-0.28, uno=kw("s2","uno"), clas=kw("s2","clasificacion"), codigo=kw("s2","codigo"), arancel=kw("s2","arancel"), regula=kw("s2","regula"),
 t2=st("s3")-0.28, dos=kw("s3","dos"), imp=kw("s3","importador"), responda=kw("s3","responda"), aduana=kw("s3","aduana"),
 t3=st("s4")-0.28, tres=kw("s4","tres"), docs=kw("s4","documentos"), factura=kw("s4","factura"), lista=kw("s4","lista"), transp=kw("s4","documento",2),
 t4=st("s5")-0.28, cuatro=kw("s5","cuatro"), req=kw("s5","requisitos"), alim=kw("s5","alimento"), cosm=kw("s5","cosmetico"), fda=kw("s5","fda"),
 t5=st("s6")-0.28, cinco=kw("s6","cinco"), dest=kw("s6","destino"), almacen=kw("s6","almacen"), cliente=kw("s6","cliente"),
 t6=st("s7")-0.3, tienes=kw("s7","tienes"), falta=kw("s7","falta"), empieza=kw("s7","empieza"), cuent=kw("s7","cuentanos"), url=kw("s7","venderenusa"),
 WH=site_svg("warehouse","wh",470,6,ink=N,accent=O), SHIP=site_svg("shipment","sp",300,4.5,ink=W,accent=HOT,paper=N))
ev=[]; put=lambda k,t,g=1.0,x=0: ev.append([k,round(t,3),g,x])
for k in ("que","nec","para","tu","a"): put("pop",C[k]-0.05,0.55)
put("thud",C["cinco0"]+0.05,0.9)
for i in range(5): put("tick",C["cuenta"]+0.12*i,0.8)
for i,(t,n,w) in enumerate((("t1","uno","clas"),("t2","dos","imp"),("t3","tres","docs"),("t4","cuatro","req"),("t5","cinco","dest"))):
    put("whoosh",C[t]-0.05,0.9); put("coin",C[n]+0.05,0.9,i); put("pop",C[w]-0.05,0.7,1)
put("tick",C["codigo"],0.8); put("tick",C["codigo"]+0.15,0.8); put("tick",C["codigo"]+0.3,0.8); put("pop",C["arancel"]-0.05,0.6); put("pop",C["regula"]-0.05,0.6)
put("scratch",C["responda"]-0.05,0.9,0.6); put("thud",C["aduana"]+0.1,0.8)
for k in ("factura","lista","transp"): put("whoosh",C[k]-0.12,0.5,0.25); put("pop",C[k],0.6)
put("pop",C["alim"]-0.05,0.6); put("pop",C["cosm"]-0.05,0.6); put("thud",C["fda"]+0.02,0.9)
put("scratch",C["dest"],0.8,0.9); put("pop",C["almacen"]-0.05,0.6); put("pop",C["cliente"]-0.05,0.6)
put("whoosh",C["t6"]-0.05,0.9)
for i in range(4): put("tick",C["tienes"]+0.1+0.11*i,0.8)
put("pop",C["falta"]-0.05,0.7); put("ding",C["cuent"]-0.15,0.9); put("pop",C["url"]-0.1,0.5,1)
V.build(C, ev, "que-necesitas-para-importar", notebook=False, base="mg.css", cap=(HOT,W))
