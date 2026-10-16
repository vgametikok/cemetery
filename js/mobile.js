(function(){
// Сенсорное управление в стиле Roblox: плавающий стик слева, обзор справа, тап = выстрел, удержание = копать
function isMobile(){ return matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; }
function initMobile(canvas){
  input.mobile=true; const $=id=>document.getElementById(id);
  $('mobile').classList.remove('hidden');
  const joy=$('joy'), knob=$('knob'); let J=null, L=null;
  canvas.addEventListener('touchstart',e=>{ for(const t of e.changedTouches){
    if(t.clientX<innerWidth/2&&!J){ J={id:t.identifier,x:t.clientX,y:t.clientY}; joy.style.cssText=`display:block;left:${t.clientX}px;top:${t.clientY}px`; }
    else if(!L){ L={id:t.identifier,x:t.clientX,y:t.clientY,sx:t.clientX,sy:t.clientY,t0:performance.now(),mv:false,hold:setTimeout(()=>{ if(!L.mv&&player.tool!=='gun'){ L.dig=true; input.fire=true; } },260)}; } }
    e.preventDefault(); },{passive:false});
  canvas.addEventListener('touchmove',e=>{ for(const t of e.changedTouches){
    if(J&&t.identifier===J.id){ let dx=(t.clientX-J.x)/50, dy=(t.clientY-J.y)/50; const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l;} input.mx=dx; input.my=-dy; knob.style.left=(35+dx*35)+'px'; knob.style.top=(35+dy*35)+'px'; }
    else if(L&&t.identifier===L.id){ if(Math.hypot(t.clientX-L.sx,t.clientY-L.sy)>12) L.mv=true; if(L.mv&&!L.dig){ input.lookX+=(t.clientX-L.x)*1.6; input.lookY+=(t.clientY-L.y)*1.6; } L.x=t.clientX; L.y=t.clientY; } }
    e.preventDefault(); },{passive:false});
  const end=e=>{ for(const t of e.changedTouches){
    if(J&&t.identifier===J.id){ J=null; input.mx=input.my=0; joy.style.display='none'; knob.style.left=knob.style.top='35px'; }
    if(L&&t.identifier===L.id){ clearTimeout(L.hold); if(L.dig) input.fire=false;
      else if(!L.mv&&(player.tool==='gun'||performance.now()-L.t0<400)){ press('fireTap'); if(player.tool==='gun'){ input.fire=true; requestAnimationFrame(()=>requestAnimationFrame(()=>input.fire=false)); } }
      L=null; } } };
  addEventListener('touchend',end); addEventListener('touchcancel',end);
  document.querySelectorAll('#mobile button[data-k]').forEach(b=>b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); press(b.dataset.k); },{passive:false}));
  // полноэкранный режим (+ webkit), затем попытка повернуть в альбомную
  const fs=$('fsbtn'), de=document.documentElement, req=de.requestFullscreen||de.webkitRequestFullscreen;
  if(!req) fs.style.display='none';
  fs.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation();
    if(document.fullscreenElement||document.webkitFullscreenElement){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); return; }
    try{ const p=req.call(de); Promise.resolve(p).then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{})).catch(()=>{}); }catch(_){} },{passive:false});
  // контекстные кнопки E / G по тексту подсказки
  const eb=$('ebtn'), gb=$('gbtn'); let last='';
  setInterval(()=>{ const h=$('hint').textContent; if(h===last) return; last=h;
    const m=h.match(/E\s*[—-]\s*([^·(:\n]+)/); eb.style.display=m?'block':'none'; if(m) eb.textContent='E · '+m[1].trim().slice(0,22);
    gb.style.display=/\bG\b/.test(h)?'block':'none'; },150);
}
Object.assign(window,{isMobile,initMobile});
})();
