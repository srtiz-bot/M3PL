const draw=(sel,t,d=0.3,s=0.1)=>tl.to(sel,{strokeDashoffset:0,duration:d,stagger:s,ease:"power1.inOut"},t);
const rise=(sel,t,o={})=>tl.from(sel,Object.assign({autoAlpha:0,y:28,duration:0.3,ease:"power3.out"},o),t);
const slam=(sel,t,rot)=>{tl.fromTo(sel,{autoAlpha:0,scale:2.8,rotation:rot-14},{autoAlpha:1,scale:1,rotation:rot,duration:0.18,ease:"power4.in"},t).fromTo("#paper",{x:0},{x:10,duration:0.04,repeat:5,yoyo:true,ease:"none"},t+0.18);};
const dn=document.getElementById("dn"), o={d:1};
const tick=(to,t,dur,steps)=>{ tl.to(o,{d:to,duration:dur,ease:"steps("+steps+")",onUpdate:()=>{dn.textContent=Math.round(o.d);}},t); };
gsap.set(["#stamp1","#ctaW","#url"],{autoAlpha:0}); gsap.set("#barF",{scaleX:0}); gsap.set(".coin",{autoAlpha:0});
// ---- scene 1: the ship is in, the cargo is not ----
draw(".shs",0.02,0.45,0.12); tl.to(".shf",{opacity:1,duration:0.25},0.6);
tl.to("#ship",{y:-7,duration:1.1,yoyo:true,repeat:Math.ceil({{s1end}}/1.1),ease:"sine.inOut"},0.9);
tl.fromTo("#day",{scale:0.92},{scale:1,duration:0.3,ease:"back.out(2)"},0.05);
tick(5,Math.max({{cinco}}-1.5,0.6),1.5,4);
tl.fromTo("#dayN",{scale:1},{scale:1.12,duration:0.14,yoyo:true,repeat:1,transformOrigin:"0% 60%"},{{cinco}});
slam("#stamp1",{{tocar}}-0.15,-8);
rise("#pillA",{{llegar}}-0.1,{x:-30,y:0}); draw(".ck",{{llegar}}+0.15,0.3,0);
rise("#pillB",{{liberada}}-0.25,{x:-30,y:0}); draw(".xk",{{liberada}}+0.05,0.35,0);
[["#r1",".ia",{{aduana}}],["#r2",".ib",{{transp}}],["#r3",".ic",{{coord}}]].forEach(([r,p,t])=>{
  tl.from(r,{autoAlpha:0,x:-40,duration:0.25,ease:"power3.out"},t-0.25); draw(p+"s",t-0.1,0.28,0.07); tl.to(p+"f",{opacity:1,duration:0.2},t+0.4);
});
tl.to(".pend",{rotation:360,duration:2.4,ease:"none",repeat:Math.ceil(({{s1end}}-{{aduana}})/2.4)},{{aduana}}-0.2);
// the meter: every extra day adds a charge
rise("#meter",{{cobrar}}-0.9);
const span=Math.max({{s1end}}-{{cobrar}}+0.25,1.2), step=span/4;
tick(9,{{cobrar}},span,4);
tl.to("#barF",{scaleX:1,duration:span,ease:"steps(4)"},{{cobrar}});
tl.to("#dayN",{color:"#ce4206",duration:0.2},{{cobrar}}+step);
document.querySelectorAll(".coin").forEach((c,i)=>{ const t={{cobrar}}+step*(i+1);
  tl.fromTo(c,{autoAlpha:0,y:10,scale:0.4},{autoAlpha:1,y:-4,scale:1,duration:0.25,ease:"back.out(3)"},t);
  tl.fromTo("#dayN",{scale:1},{scale:1.1,duration:0.1,yoyo:true,repeat:1,transformOrigin:"0% 60%"},t); });
// ---- scene 2: three different moments ----
tl.to("#sc1",{autoAlpha:0,y:-110,duration:0.28,ease:"power2.in"},{{s1end}}+0.05);
tl.fromTo("#sc2",{autoAlpha:0,y:70},{autoAlpha:1,y:0,duration:0.28,ease:"power3.out"},{{s2}}-0.15);
tl.to("#ej",{autoAlpha:1},0);
[["#pn1",".p1",{{llegada}}],["#pn2",".p2",{{liberacion}}],["#pn3",".p3",{{entrega}}]].forEach(([r,p,t])=>{
  tl.from(r+" .n",{autoAlpha:0,scale:0.4,duration:0.2,ease:"back.out(3)"},t-0.2); draw(p+"s",t-0.15,0.3,0.08); tl.to(p+"f",{opacity:1,duration:0.2},t+0.45);
  tl.from(r+" .tx",{autoAlpha:0,x:30,duration:0.25,ease:"power3.out"},t-0.05);
});
draw("#loop",{{tres}}-0.1,0.9,0);
rise("#q",{{quien}}-0.05);
tl.to("#q",{autoAlpha:0,y:-20,duration:0.2},{{c4}}-0.15);
tl.fromTo("#ctaW",{autoAlpha:0,scale:0.8},{autoAlpha:1,scale:1,transformOrigin:"0% 50%",duration:0.3,ease:"back.out(2)"},{{revisa}}-0.2);
tl.fromTo("#url",{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.3},{{url}}-0.1);
