gsap.set(["#stampN","#note1","#l1","#l2","#ctaW","#url"],{autoAlpha:0});
// ---- scene 1: the certificate ----
draw(".cs",0.03,0.5,0.14); tl.to(".csf",{opacity:1,duration:0.25},1.2);
tl.from(".ct",{autoAlpha:0,duration:0.3,stagger:0.15},0.5);
tl.fromTo("#certW",{rotation:-2},{rotation:2,duration:0.9,yoyo:true,repeat:Math.ceil({{emite}}/0.9),ease:"sine.inOut"},0.6);
tl.fromTo("#title b",{scale:1},{scale:1.12,display:"inline-block",transformOrigin:"0% 60%",duration:0.16,yoyo:true,repeat:1},{{cert}});
tl.to("#certW",{scale:1.04,duration:0.25,yoyo:true,repeat:1},{{guarda}});
draw("#cx",{{emite}}-0.1,0.45,0);
tl.to("#certW",{opacity:0.45,duration:0.3},{{emite}}+0.35);
slam("#stampN",{{noex}}+0.05,-8);
tl.to("#note1",{autoAlpha:1,duration:0.3},{{noex}}+0.45);
// ---- scene 2: what does exist ----
turn("#sc1","#sc2",{{s1end}});
[["#pn1",".p1",{{registro}}],["#pn2",".p2",{{agente}}],["#pn3",".p3",{{listado}}]].forEach(([r,p,t])=>{
  tl.from(r+" .n",{autoAlpha:0,scale:0.4,duration:0.2,ease:"back.out(3)"},t-0.2); draw(p+"s",t-0.15,0.3,0.07); tl.to(p+"f",{opacity:1,duration:0.2},t+0.45);
  tl.from(r+" .tx",{autoAlpha:0,x:30,duration:0.25,ease:"power3.out"},t-0.05);
});
tl.fromTo("#l1",{autoAlpha:0,y:24},{autoAlpha:1,y:0,duration:0.3},{{aprobado}}-0.45); draw("#apX",{{aprobado}}+0.05,0.35,0);
tl.to(["#l1","#apX"],{autoAlpha:0,duration:0.2},{{cual}}-0.25);
draw("#loop",{{cual}}-0.1,0.9,0); tl.fromTo("#l2",{autoAlpha:0,y:24},{autoAlpha:1,y:0,duration:0.3},{{cual}}+0.05);
tl.to(".pan .n",{scale:1.25,duration:0.15,yoyo:true,repeat:1,stagger:0.12},{{cual}}+0.2);
tl.to("#l2",{autoAlpha:0,y:-20,duration:0.2},{{a4}}-0.15);
tl.fromTo("#ctaW",{autoAlpha:0,scale:0.8},{autoAlpha:1,scale:1,transformOrigin:"0% 50%",duration:0.3,ease:"back.out(2)"},{{revisa}}-0.3);
tl.fromTo("#url",{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.3},{{url}}-0.1);
