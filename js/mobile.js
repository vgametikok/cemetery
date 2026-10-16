(function(){
// Виртуальный джойстик, обзор перетаскиванием, экранные кнопки
function isMobile(){ return matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; }
function initMobile(canvas){
  input.mobile=true;
  document.getElementById('mobile').classList.remove('hidden');
  const joy=document.getElementById('joy'), knob=document.getElementById('knob');
  let jid=null, lid=null, lx=0, ly=0;
  joy.addEventListener('touchstart',e=>{ jid=e.changedTouches[0].identifier; moveJ(e.changedTouches[0]); e.preventDefault(); },{passive:false});
  const moveJ=t=>{ const r=joy.getBoundingClientRect(); let dx=(t.clientX-r.left-r.width/2)/(r.width/2), dy=(t.clientY-r.top-r.height/2)/(r.height/2);
    const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l;} input.mx=dx; input.my=-dy; knob.style.left=(40+dx*40)+'px'; knob.style.top=(40+dy*40)+'px'; };
  addEventListener('touchmove',e=>{ for(const t of e.changedTouches){ if(t.identifier===jid) moveJ(t);
    else if(t.identifier===lid){ input.lookX+=(t.clientX-lx)*1.6; input.lookY+=(t.clientY-ly)*1.6; lx=t.clientX; ly=t.clientY; } } e.preventDefault(); },{passive:false});
  const end=e=>{ for(const t of e.changedTouches){ if(t.identifier===jid){ jid=null; input.mx=input.my=0; knob.style.left=knob.style.top='40px'; } if(t.identifier===lid) lid=null; } };
  addEventListener('touchend',end); addEventListener('touchcancel',end);
  canvas.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; if(lid===null){ lid=t.identifier; lx=t.clientX; ly=t.clientY; } },{passive:true});
  document.querySelectorAll('#mbtns button').forEach(b=>{
    const k=b.dataset.k;
    b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); if(k==='fire'){ input.fire=true; press('fireTap'); } else press(k); },{passive:false});
    b.addEventListener('touchend',e=>{ e.preventDefault(); if(k==='fire') input.fire=false; },{passive:false});
  });
}

Object.assign(window,{isMobile,initMobile});
})();
