gsap.set(["#stampT","#stampY","#q","#ctaW","#url","#fobN"],{autoAlpha:0}); gsap.set(["#lF","#lO","#lB"],{autoAlpha:0});
// ---- scene 1: the quote and its three letters ----
tl.fromTo("#doc",{scale:0.94,rotation:-1.5},{scale:1,rotation:-1,duration:0.35,ease:"back.out(2)"},0);
tl.from(".q",{autoAlpha:0,x:-30,duration:0.2,stagger:0.12,ease:"power3.out"},0.15);
draw("#fobC",{{tres}}-0.05,0.6,0);
tl.fromTo("#doc",{x:0},{x:7,duration:0.04,repeat:3,yoyo:true,ease:"none"},{{tres}}+0.55);
[["#lF",{{F}}],["#lO",{{O}}],["#lB",{{B}}]].forEach(([s,t])=>tl.fromTo(s,{autoAlpha:0,scale:2.2,y:-30},{autoAlpha:1,scale:1,y:0,duration:0.22,ease:"back.out(2.4)"},t-0.05));
draw(".fas",{{entrega}}-0.1,0.28,0.06); tl.to(".faf",{opacity:1,duration:0.2},{{entrega}}+0.45); tl.from("#rFab .lbl",{autoAlpha:0,duration:0.2},{{entrega}}+0.1);
draw("#rLine",{{entrega}}+0.3,0.6,0); draw("#rArr",{{entrega}}+0.85,0.2,0);
draw(".pos",{{puerto}}-0.2,0.28,0.06); tl.to(".pof",{opacity:1,duration:0.2},{{puerto}}+0.4); tl.from("#rPort .lbl",{autoAlpha:0,duration:0.2},{{puerto}});
tl.to("#fobN",{autoAlpha:1,duration:0.3},{{puerto}}+0.2);
slam("#stampT",{{termina}}+0.05,-7);
// ---- scene 2: everything after the port ----
turn("#sc1","#sc2",{{s1end}});
const tn=document.getElementById("tn"), o={n:0};
[["#r1",".i1",{{barco}}],["#r2",".i2",{{seguro}}],["#r3",".i3",{{arancel}}],["#r4",".i4",{{aduana}}],["#r5",".i5",{{camion}}]].forEach(([r,p,t],i)=>{
  tl.from(r,{autoAlpha:0,x:-40,duration:0.25,ease:"power3.out"},t-0.25); draw(p+"s",t-0.1,0.26,0.06); tl.to(p+"f",{opacity:1,duration:0.2},t+0.35);
  tl.from(r+" .tp",{autoAlpha:0,scale:1.9,duration:0.2,ease:"back.out(2.5)"},t+0.3);
  tl.to(o,{n:i+1,duration:0.01,onUpdate:()=>{tn.textContent=Math.round(o.n);}},t+0.3);
  tl.fromTo("#tallyN",{scale:1},{scale:1.1,duration:0.1,yoyo:true,repeat:1,transformOrigin:"0% 60%"},t+0.3);
});
rise("#tally",{{barco}}-0.5);
slam("#stampY",{{todo}}+0.1,-6);
tl.fromTo("#q",{autoAlpha:0,y:24},{autoAlpha:1,y:0,duration:0.3},{{cuanto}}-0.05); draw("#ndU",{{nodice}}+0.1,0.4,0);
tl.to(["#q","#ndU"],{autoAlpha:0,duration:0.2},{{b4}}-0.15);
tl.fromTo("#ctaW",{autoAlpha:0,scale:0.8},{autoAlpha:1,scale:1,transformOrigin:"0% 50%",duration:0.3,ease:"back.out(2)"},{{calcula}}-0.2);
tl.fromTo("#url",{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.3},{{url}}-0.1);
