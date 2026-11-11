const PXD={{PX}}, BOT={{BOT}}, RIM={{RIM}};
const draw=(sel,t,d=0.3,s=0.16)=>tl.to(sel,{strokeDashoffset:0,duration:d,stagger:s,ease:"power1.inOut"},t);
const rise=(sel,t,o={})=>tl.from(sel,Object.assign({autoAlpha:0,y:28,duration:0.3,ease:"power3.out"},o),t);
const slam=(sel,t,rot)=>{tl.fromTo(sel,{autoAlpha:0,scale:2.8,rotation:rot-14},{autoAlpha:1,scale:1,rotation:rot,duration:0.18,ease:"power4.in"},t).fromTo("#paper",{x:0},{x:10,duration:0.04,repeat:5,yoyo:true,ease:"none"},t+0.18);};
const pour=(sel,t)=>tl.fromTo(sel,{strokeDashoffset:1},{strokeDashoffset:0,duration:0.3,ease:"power1.in"},t).to(sel,{strokeDashoffset:-1,duration:0.45,ease:"power1.out"},t+0.62);
const totEl=document.getElementById("tot"), o={v:0};
const fill=(a,b,t,d,over)=>{
  tl.to("#liq",{y:Math.max(BOT-PXD*b,424),duration:d,ease:"back.out(1.6)"},t);
  tl.to(o,{v:b,duration:d,ease:"power2.out",onUpdate:()=>{totEl.textContent="US$"+o.v.toFixed(2);}},t);
  tl.fromTo("#tot",{scale:1},{scale:1.07,duration:0.14,yoyo:true,repeat:1,transformOrigin:"0% 100%"},t+d*0.5);
};
gsap.set("#liq",{y:BOT+20}); gsap.set(["#stampO","#stampQ","#puddle","#leftT","#was"],{autoAlpha:0});
// ---- hook: on screen from frame one ----
draw(".hks",0.05,0.32,0.08); tl.to(".hkf",{opacity:1,duration:0.25},0.75);
tl.fromTo("#tagA",{scale:0.9,rotation:-3},{scale:1,rotation:-2,duration:0.35,ease:"back.out(2.2)"},0);
tl.fromTo("#pA",{scale:1},{scale:1.18,transformOrigin:"0% 60%",duration:0.16,yoyo:true,repeat:1},Math.max({{h1p}}-0.05,0.2));
tl.from("#tagB",{autoAlpha:0,x:80,rotation:6,duration:0.35,ease:"back.out(1.8)"},{{h2}}); tl.set("#tagB",{rotation:2},{{h2}}+0.36);
tl.from("#pB",{scale:1.6,autoAlpha:0,transformOrigin:"0% 60%",duration:0.25,ease:"back.out(2)"},{{h2p}}-0.1);
rise("#q",{{h3}}-0.05,{scale:0.8,ease:"back.out(2)"}); draw("#q .circ path",{{h3p}}+0.1,0.55,0);
tl.to("#q",{rotation:-2,duration:0.12,yoyo:true,repeat:3,ease:"sine.inOut"},{{h3p}}+0.75);
// ---- page turn to the glass ----
tl.to("#scH",{autoAlpha:0,y:-110,duration:0.28,ease:"power2.in"},{{gout}});
tl.fromTo("#scG",{autoAlpha:0},{autoAlpha:1,duration:0.2},{{g0}}-0.08);
draw("#glass",{{g0}},0.95,0); draw("#shine",{{g0}}+0.8,0.3,0);
draw("#rim",{{g0}}+0.95,0.4,0); rise("#rimT",{{g0}}+1.05,{x:-20,y:0});
rise("#totK",{{g0}}+0.6); rise("#tot",{{g0}}+0.7);
tl.fromTo("#wave",{x:0},{x:-100,duration:1.3,ease:"none",repeat:Math.ceil(({{e1}}-{{g0}})/1.3)},{{g0}});
//ROWS
// ---- the gap ----
tl.fromTo("#tot",{scale:1},{scale:1.1,duration:0.16,yoyo:true,repeat:1,transformOrigin:"0% 100%"},{{t1}}+0.1);
tl.to("#leftT",{autoAlpha:1,duration:0.25},{{t1q}}); tl.from("#leftT",{x:-24,duration:0.25,immediateRender:false},{{t1q}}); draw("#leftU",{{t1q}}+0.3,0.4,0); draw("#brace",{{t1q}}-0.25,0.45,0);
tl.to("#liq",{y:"+=5",duration:0.5,yoyo:true,repeat:3,ease:"sine.inOut"},{{t1}});
// ---- overflow ----
tl.to(["#leftT","#leftU","#brace"],{autoAlpha:0,duration:0.2},{{o1}}+0.1);
//EXTRAS
if ({{over}}) {
  draw(["#spillL","#spillR"],{{spill}},0.7,0.08);
  tl.fromTo("#puddle",{autoAlpha:0,scaleX:0.2,transformOrigin:"50% 50%"},{autoAlpha:1,scaleX:1,duration:0.8,ease:"power2.out"},{{spill}}+0.55);
  tl.to("#tot",{fill:"#ce4206",duration:0.3},{{spill}});
  slam("#stampO",Math.max({{o2}}+0.35,{{spill}}+0.5),-9);
} else {
  tl.to("#liq",{y:"+=4",duration:0.45,yoyo:true,repeat:5,ease:"sine.inOut"},{{o2}}-0.3);
  tl.to("#was",{autoAlpha:1,duration:0.25},{{o2p}}-0.35); tl.from("#was",{x:-24,duration:0.25,immediateRender:false},{{o2p}}-0.35);
  draw("#wasX",{{o2p}}+0.3,0.35,0);
  tl.to("#tot",{fill:"#ce4206",duration:0.3},{{o2q}});
  slam("#stampQ",{{o2q}}+0.2,-8);
}
// ---- close ----
tl.to("#scG",{autoAlpha:0,y:-110,duration:0.28,ease:"power2.in"},{{e1}}-0.2);
tl.fromTo("#scE",{autoAlpha:0,y:70},{autoAlpha:1,y:0,duration:0.28,ease:"power3.out"},{{e1}}+0.02);
rise("#e1",{{e1}}+0.15); tl.from("#e1 b",{scale:1.22,transformOrigin:"0% 60%",duration:0.25,ease:"back.out(3)",display:"inline-block"},{{e1n}});
draw(["#g2","#g2r"],{{e2}},0.6,0.3); rise("#e2",{{e2v}}-0.1); draw("#g2q",{{e2v}}+0.5,0.45,0);
rise("#e3c",{{e3}},{scale:0.8,transformOrigin:"0% 50%",ease:"back.out(2)"}); rise("#url",{{e3u}}-0.1);
