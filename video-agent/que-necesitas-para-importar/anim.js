const T={{TOTAL}};
const wipes=["circle(0% at 18% 26%)","inset(100% 0% 0% 0%)","inset(0% 0% 0% 100%)","circle(0% at 82% 30%)","inset(0% 0% 100% 0%)","circle(0% at 50% 55%)"];
const full=w=>w.startsWith("circle")?w.replace("0%","150%"):"inset(0% 0% 0% 0%)";
const wipe=(sel,t,i)=>{ const w=wipes[i%wipes.length]; gsap.set(sel,{clipPath:w}); tl.to(sel,{clipPath:full(w),duration:0.5,ease:"power3.inOut"},t); };
const pop=(sel,t,o={})=>tl.fromTo(sel,Object.assign({autoAlpha:0,scale:0.4},o.from||{}),{autoAlpha:1,scale:1,duration:0.26,ease:"back.out(2.6)"},t);
const cnt=document.getElementById("cnt"), oc={n:0};
// background life: every grid drifts for the whole film
tl.to(".grid",{x:120,y:120,duration:T,ease:"none"},0);
tl.to(".ring",{y:-40,duration:2.2,yoyo:true,repeat:Math.ceil(T/2.2),ease:"sine.inOut"},0);
tl.to(".ghost",{x:-520,duration:T,ease:"none"},0);
// ---- intro: the question, word by word ----
gsap.set(["#five","#prog"],{autoAlpha:0}); gsap.set("#boxes0 .box",{autoAlpha:0});
[["#wq",{{que}}],["#wn",{{nec}}],["#wp",{{para}}],["#wt",{{tu}}],["#wa",{{a}}]].forEach(([s,t],i)=>{
  if(i===0){ tl.fromTo(s,{scale:0.86},{scale:1,duration:0.3,ease:"back.out(2.4)"},0); }      // on screen from frame one
  else { gsap.set(s,{opacity:0.2}); tl.fromTo(s,{opacity:0.2,scale:0.9,rotation:i===3?-7:0},{opacity:1,scale:1,rotation:i===3?-2:0,duration:0.26,ease:"back.out(2.6)"},t-0.06); }
});
tl.to("#i0",{scale:0.44,duration:0.4,ease:"power3.inOut"},{{cinco0}}-0.3);
tl.fromTo("#five",{autoAlpha:0,scale:2.4,rotation:-8},{autoAlpha:1,scale:1,rotation:0,duration:0.3,ease:"power4.in"},{{cinco0}}-0.2);
tl.fromTo("#paper",{x:0},{x:12,duration:0.04,repeat:5,yoyo:true,ease:"none"},{{cinco0}}+0.1);
tl.to("#five",{y:-56,duration:0.35,ease:"power2.inOut"},{{cuenta}}-0.3);
tl.fromTo("#boxes0 .box",{autoAlpha:0,y:50,scale:0.5},{autoAlpha:1,y:0,scale:1,duration:0.22,stagger:0.12,ease:"back.out(2.5)"},{{cuenta}});
tl.to("#prog",{autoAlpha:1,duration:0.3},{{t1}}+0.2);
// ---- one item per scene ----
const item=(i,t,tn,tw)=>{ const s="#s"+i;
  wipe(s,t,i-1);
  tl.fromTo(s+" .num",{x:-260,autoAlpha:0},{x:0,autoAlpha:1,duration:0.4,ease:"power3.out"},t+0.12);
  tl.to(s+" .num",{x:14,duration:1.6,yoyo:true,repeat:3,ease:"sine.inOut"},t+0.6);
  tl.to(s+" .num .f",{clipPath:"inset(0% 0 0 0)",duration:0.45,ease:"power2.out"},tn);
  tl.fromTo("#ttl"+i,{yPercent:115},{yPercent:0,duration:0.38,ease:"power4.out"},tw-0.1);
  tl.to("#p"+i,{scaleX:1,duration:0.4,ease:"power2.out"},tn);
  tl.to(oc,{n:i,duration:0.01,onUpdate:()=>{cnt.textContent=Math.round(oc.n)+"/5";}},tn);
  tl.fromTo("#cnt",{scale:1},{scale:1.35,duration:0.12,yoyo:true,repeat:1,transformOrigin:"100% 50%"},tn);
};
item(1,{{t1}},{{uno}},{{clas}}); item(2,{{t2}},{{dos}},{{imp}}); item(3,{{t3}},{{tres}},{{docs}}); item(4,{{t4}},{{cuatro}},{{req}}); item(5,{{t5}},{{cinco}},{{dest}});
// 01 the code scrambles, then lands
const dg=document.getElementById("digits"), od={k:0}, FINAL="0901.21", SCR=["4817.30","6204.11","2106.90","3304.99","8471.60","1905.31","0901.21"];
gsap.set(["#code","#ex1"],{autoAlpha:0});
tl.to("#code",{autoAlpha:1,duration:0.2},{{codigo}}-0.2);
tl.to(od,{k:SCR.length-1,duration:0.9,ease:"steps("+(SCR.length-1)+")",onUpdate:()=>{dg.textContent=SCR[Math.round(od.k)];}},{{codigo}}-0.15);
tl.fromTo("#code",{scale:1},{scale:1.08,duration:0.14,yoyo:true,repeat:1,transformOrigin:"0% 60%"},{{codigo}}+0.78);
tl.to("#ex1",{autoAlpha:.9,duration:0.25},{{codigo}}+0.8);
pop("#c1a",{{arancel}}-0.08,{from:{x:-60}}); pop("#c1b",{{regula}}-0.3,{from:{x:60}});
// 02 a signature on the line
gsap.set(["#sg0","#st2"],{autoAlpha:0});
tl.to("#sg0",{autoAlpha:1,duration:0.25},{{responda}}-0.5); tl.to("#sgL",{strokeDashoffset:0,duration:0.3},{{responda}}-0.45);
tl.to("#sgS",{strokeDashoffset:0,duration:0.75,ease:"power1.inOut"},{{responda}}-0.1);
tl.fromTo("#st2",{autoAlpha:0,scale:2.6,rotation:-18},{autoAlpha:1,scale:1,rotation:-6,duration:0.18,ease:"power4.in"},{{aduana}}+0.05);
tl.fromTo("#paper",{x:0},{x:10,duration:0.04,repeat:5,yoyo:true,ease:"none"},{{aduana}}+0.23);
// 03 three documents deal out like cards
[["#d1",{{factura}},-4],["#d2",{{lista}},2],["#d3",{{transp}},-2]].forEach(([s,t,r])=>tl.fromTo(s,{autoAlpha:0,x:700,rotation:r+24},{autoAlpha:1,x:0,rotation:r,duration:0.36,ease:"back.out(1.5)"},t-0.14));
// 04 two product types, one agency
pop("#c4a",{{alim}}-0.08); pop("#c4b",{{cosm}}-0.08);
tl.fromTo("#fda",{autoAlpha:0,scale:2.2,y:40},{autoAlpha:1,scale:1,y:0,duration:0.24,ease:"power4.in"},{{fda}}-0.1);
tl.fromTo("#paper",{x:0},{x:10,duration:0.04,repeat:5,yoyo:true,ease:"none"},{{fda}}+0.14);
tl.to(["#c4a","#c4b"],{backgroundColor:"#fcfcfa",color:"#ce4206",duration:0.2},{{fda}}+0.1);
// 05 the warehouse draws itself
tl.to(".whs",{strokeDashoffset:0,duration:0.32,stagger:0.08,ease:"power1.inOut"},{{dest}}-0.05); tl.to(".whf",{opacity:1,duration:0.25},{{dest}}+0.6);
pop("#c5a",{{almacen}}-0.08,{from:{x:60}}); pop("#c5b",{{cliente}}-0.08,{from:{x:60}});
// ---- outro ----
wipe("#s6",{{t6}},5);
tl.to("#prog",{autoAlpha:0,duration:0.2},{{t6}});
gsap.set(["#o2","#ctaW","#url"],{autoAlpha:0}); gsap.set("#boxes6 .box",{autoAlpha:0});
tl.fromTo("#o1",{autoAlpha:0,y:80},{autoAlpha:1,y:0,duration:0.35,ease:"back.out(1.8)"},{{t6}}+0.25);
tl.fromTo("#boxes6 .box",{autoAlpha:0,scale:0.4},{autoAlpha:1,scale:1,duration:0.2,stagger:0.11,ease:"back.out(2.6)"},{{tienes}}+0.1);
tl.to("#lastb",{borderColor:"#ff6a2b",scale:1.18,duration:0.3,yoyo:true,repeat:7,ease:"sine.inOut"},{{falta}}-0.1);
tl.fromTo("#o2",{autoAlpha:0,x:-50},{autoAlpha:1,x:0,duration:0.3,ease:"power3.out"},{{falta}}-0.15);
tl.fromTo("#ctaW",{autoAlpha:0,scale:0.7},{autoAlpha:1,scale:1,transformOrigin:"0% 50%",duration:0.3,ease:"back.out(2.2)"},{{cuent}}-0.15);
tl.fromTo("#url",{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:0.3},{{url}}-0.1);
