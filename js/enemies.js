(function(){
// Нежить: призраки (к зданию), вампиры (игрок и надгробия), ведьмы (призыв, дебафф)
const enemies = [];
const T = {
  ghost:  { hp:2, speed:2.2, color:0xccefff, price:25, name:'Призрак' },
  vampire:{ hp:4, speed:4.2, color:0x8a1020, price:40, name:'Вампир' },
  witch:  { hp:6, speed:1.6, color:0x3a7a30, price:70, name:'Ведьма' },
  zombie: { hp:5, speed:1.7, color:0x4a3a2a, price:0, name:'Зомби' },
};
const TYPES=T;
function mesh(type,glow){
  const g=new THREE.Group(), c=T[type].color;
  if(type==='ghost'){ const m=new THREE.MeshLambertMaterial({color:c,emissive:0x6699aa,transparent:true,opacity:0.7});
    const b=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.6,8,1,true),m); b.rotation.x=Math.PI; b.position.y=0.8; g.add(b);
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.45,10,8),m); h.position.y=1.7; g.add(h); }
  else { const m=new THREE.MeshLambertMaterial({color:c}), skin=new THREE.MeshLambertMaterial({color:type==='vampire'?0xdddddd:type==='zombie'?0x557a44:0x99bb66});
    const b=new THREE.Mesh(new THREE.BoxGeometry(0.7,1.2,0.4),m); b.position.y=1.0; g.add(b);
    const h=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.4),skin); h.position.y=1.85; g.add(h);
    for(const x of [-0.18,0.18]){ const l=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.5,0.2),m); l.position.set(x,0.25,0); g.add(l); }
    // глаза: у обычных зомби тусклые, у усиленных — ярко-красные светящиеся
    const eyeMat = type==='zombie' ? (glow?new THREE.MeshBasicMaterial({color:0xff1010}):new THREE.MeshLambertMaterial({color:0x222211})) : new THREE.MeshBasicMaterial({color:0xff2020});
    for(const x of [-0.09,0.09]){ const e=new THREE.Mesh(new THREE.BoxGeometry(glow?0.11:0.08,glow?0.08:0.05,0.05),eyeMat); e.position.set(x,1.9,0.21); g.add(e); }
    if(glow){ const h2=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6),new THREE.MeshBasicMaterial({color:0xff2020,transparent:true,opacity:0.25,depthWrite:false})); h2.position.set(0,1.9,0.22); g.add(h2); }
    if(type==='zombie') for(const x of [-0.45,0.45]){ const a=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,0.7),skin); a.position.set(x,1.35,0.35); g.add(a); }
    if(type==='witch'){ const hat=new THREE.Mesh(new THREE.ConeGeometry(0.35,0.8,8),m); hat.position.y=2.4; g.add(hat); } }
  g.traverse(o=>o.castShadow=true); scene.add(g); return g;
}
function spawn(type, pos, mods){
  if(!pos){ const t=Math.random(); pos = t<0.4 ? new THREE.Vector3((Math.random()*2-1)*HX,0,-HZ-4) : t<0.7 ? new THREE.Vector3(-HX-4,0,(Math.random()*2-1)*HZ) : new THREE.Vector3(HX+4,0,(Math.random()*2-1)*HZ); }
  mods=mods||{hp:1,dmg:1,sp:1,lvl:0}; const m=mesh(type,mods.lvl>0); m.position.copy(pos);
  const e={ type, mods, hp:T[type].hp*mods.hp, m, cd:0, summon:6, t:Math.random()*9 }; m.userData.enemy=e; enemies.push(e); return e;
}
function removeEnemy(e){ scene.remove(e.m); const i=enemies.indexOf(e); if(i>=0) enemies.splice(i,1); }
function clearEnemies(){ while(enemies.length) removeEnemy(enemies[0]); }
// Обновление; cb: события урона
// нежить (включая призраков) не проходит сквозь дом
function pushOut(p,e){ for(const b of solids){ if(e&&e.inMorgue&&b===MORGUE.box) continue; pushBox(p,b); } }
function pushBox(p,b){ const m=0.6; if(p.x>b.minX-m&&p.x<b.maxX+m&&p.z>b.minZ-m&&p.z<b.maxZ+m){
  const o=[p.x-(b.minX-m),(b.maxX+m)-p.x,p.z-(b.minZ-m),(b.maxZ+m)-p.z], i=o.indexOf(Math.min(...o));
  if(i===0)p.x=b.minX-m; else if(i===1)p.x=b.maxX+m; else if(i===2)p.z=b.minZ-m; else p.z=b.maxZ+m; } }
function updateEnemies(dt, cb){
  for(const e of [...enemies]){
    const p=e.m.position, t=T[e.type]; e.t+=dt; e.cd-=dt; if(e.captured) continue;
    let target, inside=Math.abs(p.x)<HX&&Math.abs(p.z)<HZ;
    if(e.type==='ghost'){ const hb=houseBox; target=new THREE.Vector3(Math.max(hb.minX-0.9,Math.min(hb.maxX+0.9,p.x)),0,Math.max(hb.minZ-0.9,Math.min(hb.maxZ+0.9,p.z))); }
    else if(e.type==='vampire'){
      const dp=p.distanceTo(new THREE.Vector3(player.pos.x,0,player.pos.z));
      if(dp<10||!e.grave||e.grave.state!=='filled') { e.grave = dp<10?null:plots.filter(g=>g.state==='filled').sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]; }
      target = e.grave ? new THREE.Vector3(e.grave.x,0,e.grave.z) : new THREE.Vector3(player.pos.x,0,player.pos.z);
    } else if(e.type==='zombie'&&e.inMorgue){ // зомби в морге: заперто — сидит внутри, открыто — выходит через дверь
      const q=MORGUE.inner, pin=player.pos.x>q.minX-0.5&&player.pos.x<q.maxX+0.5&&player.pos.z>q.minZ-0.5&&player.pos.z<q.maxZ+0.5;
      if(MORGUE.locked){ target=pin?new THREE.Vector3(player.pos.x,0,player.pos.z):p.clone(); e.tgt={k:pin?'player':'none',v:target}; }
      else { const D=MORGUE.doorPt; target = p.z<D.z-0.2 && Math.abs(p.x-D.x)>0.3 ? new THREE.Vector3(D.x,0,D.z-0.6) : MORGUE.outPt.clone(); e.tgt={k:'none',v:target};
        if(Math.hypot(p.x-MORGUE.outPt.x,p.z-MORGUE.outPt.z)<0.8) e.inMorgue=false; }
    } else if(e.type==='zombie'){ // ближайшая цель: игрок, офис или надгробие
      const hb=houseBox, cands=[{k:'player',v:new THREE.Vector3(player.pos.x,0,player.pos.z)},{k:'building',v:new THREE.Vector3(Math.max(hb.minX-0.9,Math.min(hb.maxX+0.9,p.x)),0,Math.max(hb.minZ-0.9,Math.min(hb.maxZ+0.9,p.z)))}];
      for(const g of plots) if(g.state==='filled') cands.push({k:'grave',v:new THREE.Vector3(g.x,0,g.z),g});
      let best=cands[0], bd=1e9; for(const c of cands){ const d=Math.hypot(c.v.x-p.x,c.v.z-p.z); if(d<bd){bd=d;best=c;} } e.tgt=best; target=best.v;
    } else target=new THREE.Vector3(player.pos.x,0,player.pos.z);
    const d=new THREE.Vector3(target.x-p.x,0,target.z-p.z), dist=d.length();
    let sp=t.speed*(e.mods?e.mods.sp:1); if(e.type==='vampire' && lamps.some(l=>Math.hypot(l.position.x-p.x,l.position.z-p.z)<7)) sp*=0.5; // свет ослабляет вампиров
    const stop = e.type==='zombie'?(e.inMorgue?0.1:e.tgt&&e.tgt.k==='building'?0.3:1.1) : e.type==='ghost'?0.2 : e.type==='witch'?7 : 1.2;
    if(dist>stop){ d.normalize(); p.x+=d.x*sp*dt; p.z+=d.z*sp*dt; e.m.rotation.y=Math.atan2(d.x,d.z); }
    pushOut(p,e);
    if(e.inMorgue&&MORGUE.locked){ const q=MORGUE.inner; p.x=Math.max(q.minX,Math.min(q.maxX,p.x)); p.z=Math.max(q.minZ,Math.min(q.maxZ,p.z)); }
    if(e.type==='ghost'){ p.y=0.4+Math.sin(e.t*3)*0.3; if(dist<=0.5&&e.cd<=0){ e.cd=1; cb('building',3); } }
    else if(e.type==='zombie' && dist<=stop+0.4 && e.cd<=0){ e.cd=1.2; const k=e.tgt.k, dm=e.mods.dmg; if(k==='none'){ e.cd=0.5; } else if(k==='player') cb('player',8*dm); else if(k==='building') cb('building',4*dm); else { cb('grave',e.tgt.g); if(dm>1) cb('grave',e.tgt.g); } }
    else if(e.type==='vampire' && dist<=stop+0.3 && e.cd<=0){ e.cd=1; if(e.grave) cb('grave',e.grave); else cb('player',10); }
    else if(e.type==='witch' && inside){ e.summon-=dt; if(e.summon<=0){ e.summon=8; spawn(Math.random()<0.6?'ghost':'vampire', p.clone().add(new THREE.Vector3(1,0,1))); cb('summon'); }
      if(dist<9 && e.cd<=0){ e.cd=3; player.slow=2.5; cb('player',5); } }
  }
}

Object.assign(window,{enemies,TYPES,spawn,removeEnemy,clearEnemies,updateEnemies});
})();
