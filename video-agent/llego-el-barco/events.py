"""Sound events for 'Llegó el barco', from the animation cues."""
import json
C=json.load(open("cues.json")); ev=[]
def put(kind,t,g=1.0,extra=0): ev.append([kind,round(t,3),g,extra])
put("scratch",0.03,0.9,1.4)
t0=max(C["cinco"]-1.5,0.6)
for i in range(4): put("tick",t0+1.5*(i+1)/4,0.9)
put("thud",C["tocar"]+0.02); put("pop",C["llegar"]-0.1,0.7); put("scratch",C["llegar"]+0.15,0.8,0.3)
put("pop",C["liberada"]-0.25,0.7); put("scratch",C["liberada"]+0.05,0.9,0.35)
for k in ("aduana","transp","coord"): put("pop",C[k]-0.25,0.5); put("scratch",C[k]-0.1,0.75,0.55)
span=max(C["s1end"]-C["cobrar"]+0.25,1.2); step=span/4
for i in range(4): put("tick",C["cobrar"]+step*(i+1),0.8); put("coin",C["cobrar"]+step*(i+1)+0.02,0.9,i)
put("whoosh",C["s1end"]-0.02,0.9)
for k in ("llegada","liberacion","entrega"): put("pop",C[k]-0.2,0.5,1); put("scratch",C[k]-0.15,0.8,0.7)
put("scratch",C["tres"]-0.1,0.9,0.9); put("pop",C["quien"]-0.05,0.6); put("ding",C["revisa"]-0.2,0.9); put("pop",C["url"]-0.1,0.5,1)
json.dump({"total":C["TOTAL"],"events":ev},open("events.json","w")); print(len(ev),"events")
