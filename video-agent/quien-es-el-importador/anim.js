gsap.set(["#stampNo","#note","#nA","#nB","#qh","#dec","#ctaW","#url"],{autoAlpha:0});
// ---- scene 1: the blank line on the customs entry ----
tl.fromTo("#doc",{scale:0.94,rotation:-1.5},{scale:1,rotation:-1,duration:0.35,ease:"back.out(2)"},0);
tl.from(".q",{autoAlpha:0,x:-30,duration:0.2,stagger:0.14,ease:"power3.out"},0.15);
tl.to("#blank",{opacity:0.35,duration:0.4,yoyo:true,repeat:Math.ceil({{nadie}}/0.4),ease:"sine.inOut"},0.7);
slam("#stampNo",{{entrar}}+0.05,-8);
tl.to("#stampNo",{autoAlpha:0,scale:0.9,duration:0.25},{{nadie}}-0.35);
tl.set("#blank",{opacity:1},{{nadie}}); draw("#impC",{{nadie}}-0.05,0.6,0);
tl.fromTo("#blank",{scale:1},{scale:1.18,duration:0.16,yoyo:true,repeat:1,transformOrigin:"100% 50%"},{{imp}});
[["#r1",".c1",{{declara}}],["#r2",".c2",{{paga}}],["#r3",".c3",{{responde}}]].forEach(([r,c,t])=>{
  tl.from(r,{autoAlpha:0,x:-40,duration:0.25,ease:"power3.out"},t-0.25); draw(c,t+0.1,0.28,0);
});
draw("#brace",{{ese}}-0.1,0.5,0); tl.fromTo("#note",{autoAlpha:0,x:-20},{autoAlpha:1,x:0,duration:0.3},{{ese}}+0.15);
// ---- scene 2: who it is not, and who it can be ----
turn("#sc1","#sc2",{{s1end}});
tl.from("#cA",{autoAlpha:0,y:40,duration:0.25,ease:"power3.out"},{{alm}}-0.1); draw(".whs",{{alm}},0.28,0.06); tl.to(".whf",{opacity:1,duration:0.2},{{alm}}+0.45);
draw("#xA",{{almNo}}-0.05,0.4,0); tl.fromTo("#nA",{autoAlpha:0,scale:1.8},{autoAlpha:1,scale:1,duration:0.2,ease:"back.out(2.5)"},{{almNo}}+0.25);
tl.from("#cB",{autoAlpha:0,y:40,duration:0.25,ease:"power3.out"},{{agente}}-0.25); draw(".brs",{{agente}}-0.15,0.28,0.06); tl.to(".brf",{opacity:1,duration:0.2},{{agente}}+0.3);
draw("#xB",{{tampoco}}-0.05,0.4,0); tl.fromTo("#nB",{autoAlpha:0,scale:1.8},{autoAlpha:1,scale:1,duration:0.2,ease:"back.out(2.5)"},{{tampoco}}+0.25);
tl.fromTo("#qh",{autoAlpha:0,y:24},{autoAlpha:1,y:0,duration:0.3},{{quien}}+0.15);
tl.to([".card svg.sk",".card .nm"],{opacity:0.45,duration:0.3},{{quien}}+0.1);
[["#oA",".oa",{{optA}}],["#oB",".ob",{{optB}}],["#oC",".oc",{{optC}}]].forEach(([r,p,t])=>{
  tl.from(r,{autoAlpha:0,x:-40,duration:0.25,ease:"power3.out"},t-0.25); tl.from(r+" .badge",{scale:0.3,duration:0.25,ease:"back.out(3)"},t-0.2);
  draw(p+"s",t-0.1,0.26,0.06); tl.to(p+"f",{opacity:1,duration:0.2},t+0.35);
});
tl.fromTo("#dec",{autoAlpha:0,y:24},{autoAlpha:1,y:0,duration:0.3},{{decide}}-0.05); draw("#decU",{{antes}}-0.05,0.5,0);
// ---- scene 3: close ----
turn("#sc2","#sc3",{{s2end}});
rise("#e1",{{s2end}}+0.35); draw(".ens",{{s2end}}+0.4,0.4,0.1); tl.to(".enf",{opacity:1,duration:0.25},{{s2end}}+1.3);
tl.fromTo("#ctaW",{autoAlpha:0,scale:0.8},{autoAlpha:1,scale:1,transformOrigin:"0% 50%",duration:0.3,ease:"back.out(2)"},{{cta}}-0.3);
tl.fromTo("#url",{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.3},{{url}}-0.1);
