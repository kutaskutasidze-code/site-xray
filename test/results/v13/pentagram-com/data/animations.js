gsap.registerPlugin(ScrollTrigger);
// Visibility fix for JS-dependent elements
document.querySelectorAll('[style*="opacity: 0"],[style*="opacity:0"]').forEach(el=>{
  if(!el.closest('[class*="modal"],[class*="Modal"]'))el.style.opacity="1";
});
document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
  el.style.pointerEvents="auto";el.style.cursor="pointer";
  const img=el.querySelector("img");if(!img)return;
  el.addEventListener("mouseenter",()=>gsap.to(img,{scale:1.03,filter:"brightness(0.9)",duration:0.75,ease:"expo.out"}));
  el.addEventListener("mouseleave",()=>gsap.to(img,{scale:1,filter:"brightness(1)",duration:0.75,ease:"expo.out"}));
});
