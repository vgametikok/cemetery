(function(){

const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; document.body.prepend(renderer.domElement);
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
buildWorld(); buildPlots(); finishWorld(); initPlayer(scene); setLogger(log); initHotbar();
const mobile=isMobile(); initDesktop(renderer.domElement); if(mobile) initMobile(renderer.domElement);
document.getElementById('ctrlhelp').innerHTML = mobile
  ? 'Левая половина — стик движения, правая — обзор. Тап — выстрел/поставить турель, удержание — копать/засыпать/расчищать. Кнопка E/G появляется, когда есть действие. Слоты внизу, 🎒 — инвентарь, ☰ — пауза, ⛶ — весь экран, R — перезарядка, ❤ — аптечка, 🏃 — бег, Q — инструмент.'
  : 'WASD — движение, мышь — обзор, ЛКМ — копать/стрелять, E — взять/положить, Shift — бег, R — перезарядка, G — тележка, H — аптечка, Q/1/2 — инструмент (2 повторно — сменить оружие), E у компьютера в офисе — магазин, Esc — пауза, N — день/ночь (тест)';
let overShown=false, running=false, paused=false, pauseOn=false, pauseT=0;
const lockPtr=()=>{ try{ const r=renderer.domElement.requestPointerLock?.(); r&&r.catch&&r.catch(()=>{}); }catch(e){} };
const relock=()=>{ if(!mobile) lockPtr(); };
const nearComputer=(d=2.2)=>Math.hypot(player.pos.x-COMPUTER.x,player.pos.z-COMPUTER.z)<d;
function resume(){ pauseOn=false; paused=false; showPause(false); relock(); }
function pauseAction(a){ if(a==='go') resume(); else { if(a==='new') sessionStorage.setItem('cg_autostart','1'); location.reload(); } }
const startGame=()=>{ document.getElementById('start').classList.add('hidden'); running=true; if(!mobile) lockPtr(); startDay(); };
document.getElementById('playbtn').onclick=startGame;
if(sessionStorage.getItem('cg_autostart')){ sessionStorage.removeItem('cg_autostart'); startGame(); }

// эффекты выстрела
const tracers=[];
function tracer(a,b){ const g=new THREE.BufferGeometry().setFromPoints([a,b]); const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffee88})); scene.add(l); tracers.push({l,t:0.08}); }
const ray=new THREE.Raycaster(); let fireCd=0;
function shoot(){
  const w=WPN[S.weapon]; fireCd=w.cd; if(!canFire()) return; kick();
  const meshes=enemies.map(e=>e.m);
  for(let i=0;i<w.pel;i++){
    const s=w.spread; ray.setFromCamera(new THREE.Vector2((Math.random()-0.5)*s,(Math.random()-0.5)*s),camera);
    const hit=ray.intersectObjects(meshes,true)[0], from=camera.localToWorld(new THREE.Vector3(0.3,-0.25,-0.8));
    tracer(from, hit?hit.point:ray.ray.at(40,new THREE.Vector3()));
    if(hit){ let o=hit.object; while(o&&!o.userData.enemy) o=o.parent; const e=o?.userData.enemy;
      if(e&&enemies.includes(e)) damage(e,hitDamage(e)); }
  }
}
const clockT=new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clockT.getDelta(),0.05);
  if(running&&!S.over&&consume('pause')&&performance.now()-pauseT>300){ pauseT=performance.now();
    if(pauseOn) resume(); else if(!paused){ pauseOn=true; paused=true; closeShop(); closeSell(); showPause(true,pauseAction); } }
  if(running&&!paused&&!S.over){
    if(consume('night')){ const r=togglePhase(); if(r){ paused=true; closeShop(); showReport(r,()=>paused=false); } }
    if(consume('inv')) { paused=true; closeShop(); toggleInv(()=>{ paused=false; relock(); }); }
    if(consume('tool')) { if(S.placing) cancelPlace(); else setTool(player.tool==='gun'?'shovel':'gun'); }
    if(consume('tool1')) { cancelPlace(); setTool('shovel'); } if(consume('tool2')) { cancelPlace(); if(player.tool==='gun') cycleWeapon(); else setTool('gun'); }
    if(consume('reload')) reload(); if(consume('cart')) toggleCart(); if(consume('run')) { input.runToggle=!input.runToggle; log(input.runToggle?'Бег включён':'Бег выключен'); }
    if(consume('tool3')) S.placing==='gun'?cancelPlace():selectPlace('gun'); if(consume('tool4')) S.placing==='vac'?cancelPlace():selectPlace('vac');
    if(consume('heal')) heal();
    if(consume('interact')){ if(shopOpen()){ closeShop(); relock(); } else if(sellOpen()){ closeSell(); relock(); } else if(nearComputer()) openShop(); else if(interact()==='sell') openSell(); }
    if(sellOpen()&&(!S.merchant||Math.hypot(player.pos.x-MERCHANT.x,player.pos.z-MERCHANT.z)>5)) closeSell();
    if(shopOpen()&&!nearComputer(3)) closeShop();
    updateKeys(); updatePlayer(dt); if(window.__cam) window.__cam(camera);
    let digP=null; fireCd-=dt; updatePlacement();
    const fireEdge=consume('fireTap');
    if(shopOpen()||sellOpen()){} else if(S.placing){ if(fireEdge) confirmPlace(); }
    else if(input.fire){ if(player.tool==='gun'){ if(fireCd<=0&&!player.carrying&&!player.pushing) shoot(); } else { swing(dt); digP=dig(dt); } }
    const r=updateSim(dt); if(r){ paused=true; closeShop(); showReport(r,()=>paused=false); }
    updateEnemies(dt,onEnemyEvent); updateTurrets(dt,tracer);
    updateHUD(dt,digP);
  } else if(paused&&!pauseOn){ if(consume('inv') && !document.getElementById('inv').classList.contains('hidden')) toggleInv(()=>{ paused=false; relock(); }); }
  if(S.over&&!overShown){ overShown=true; closeShop(); closeSell(); showGameOver(S.over); }
  input.once.clear();
  for(const t of [...tracers]){ t.t-=dt; if(t.t<=0){ scene.remove(t.l); tracers.splice(tracers.indexOf(t),1); } }
  renderer.render(scene,camera);
}
loop();
window.__game={S,player,enemies}; // для отладки/тестов

Object.assign(window,{});
})();
