(function(){
// Единое состояние ввода (клавиатура/мышь и сенсор)
const input = { mx:0, my:0, lookX:0, lookY:0, fire:false, once:new Set(), locked:false, mobile:false };
const keys = {};
const map = { KeyE:'interact', KeyQ:'tool', KeyN:'night', Digit1:'tool1', Digit2:'tool2', Digit3:'tool3', Digit4:'tool4', KeyI:'inv', KeyH:'heal', KeyR:'reload', KeyG:'cart', Escape:'pause' };
function releaseLock(){ if(document.pointerLockElement){ input.expectUnlock=true; document.exitPointerLock(); } }
function press(a){ input.once.add(a); }
function consume(a){ const h=input.once.has(a); input.once.delete(a); return h; }
function initDesktop(canvas){
  addEventListener('keydown',e=>{ keys[e.code]=true; if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.sprint=true; if(map[e.code]){ press(map[e.code]);  } });
  addEventListener('keyup',e=>{ keys[e.code]=false; if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.sprint=false; });
  canvas.addEventListener('mousedown',e=>{ if(input.mobile)return; if(!input.locked){ { const r=canvas.requestPointerLock?.(); r&&r.catch&&r.catch(()=>{}); } return; } if(e.button===0){ input.fire=true; press('fireTap'); } });
  addEventListener('mouseup',e=>{ if(e.button===0) input.fire=false; });
  addEventListener('mousemove',e=>{ if(input.locked){ input.lookX+=e.movementX; input.lookY+=e.movementY; } });
  document.addEventListener('pointerlockchange',()=>{ const was=input.locked; input.locked=document.pointerLockElement===canvas;
    if(was&&!input.locked&&!input.expectUnlock) press('pause'); // ESC в браузере снимает захват — открываем паузу
    if(input.locked) input.expectUnlock=false; });
}
function updateKeys(){
  if(input.mobile) return;
  input.mx=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  input.my=(keys.KeyW?1:0)-(keys.KeyS?1:0);
}

Object.assign(window,{releaseLock,input,press,consume,initDesktop,updateKeys});
})();
