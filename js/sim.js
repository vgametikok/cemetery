(function(){
// Экономика, время суток, захоронения, турели, отчёт
const S = { day:1, time:8*60, phase:'day', money:100, rep:50, level:1, bHp:100, coffins:[], bodies:[], remains:[], arrivals:[], buried:0, nextId:1, merchant:null, nightT:0,
  weapons:{pistol:true,shotgun:false,salt:false}, weapon:'pistol', reloadT:0, cart:null,
  ammo:{pistol:{mag:8,cap:8,res:24},shotgun:{mag:0,cap:6,res:0},salt:{mag:0,cap:5,res:0}}, inv:{gun:0,vac:0,med:0,rem:{ghost:0,vampire:0,witch:0}}, medCab:3, placing:null, preview:null, trashDone:0, bin:0, holy:false, turrets:[], night:{kills:{ghost:0,vampire:0,witch:0,zombie:0},dmg:0,graves:0,waves:[]}, dayIncome:0, over:false };
const LEVELS=[null,{n:'Базовые могилы',b:0},{n:'Надгробия',b:0.3},{n:'Памятники и скамейки',b:0.5},{n:'Мемориалы + музыка',b:1.0},{n:'Мемориальный комплекс',b:1.3}];
const UPG_COST=[0,150,300,500,800];
let log=()=>{}; function setLogger(f){ log=f; }
// Фазы суток: рассвет 06–08, день 08–18, закат 18–20, ночь 20–06
const PH={dawn:'Рассвет',day:'День',dusk:'Закат',night:'Ночь'}, PHI={dawn:'🌅',day:'☀',dusk:'🌇',night:'🌙'};
const RATE={dawn:6, day:600/130, dusk:6, night:6}; // игровых минут в секунду
function phaseOf(t){ const m=((t%1440)+1440)%1440; return m>=360&&m<480?'dawn':m>=480&&m<1080?'day':m>=1080&&m<1200?'dusk':'night'; }
function clock(){ const m=Math.floor(S.time)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function lightFor(t){ const m=t%1440; if(m>=360&&m<480){ const k=(m-360)/120; return [1-k,Math.sin(Math.PI*k)]; } if(m>=1080&&m<1200){ const k=(m-1080)/120; return [k,Math.sin(Math.PI*k)]; } return [m>=480&&m<1080?0:1,0]; }
function startDay(){ // начало дневной фазы (08:00): доставки покойников
  S.phase='day'; S.dayIncome=0; setTool('shovel');
  const n=2+S.day+Math.floor(S.rep/40); S.arrivals=[]; for(let i=0;i<n;i++) S.arrivals.push(8*60+30+i*(540/n));
  if(S.merchant){ scene.remove(S.merchant); S.merchant=null; window.closeSell&&closeSell(); log(`День ${S.day}. Торговец уехал. Ожидается покойников: ${n}`); } else log(`День ${S.day}. Ожидается покойников: ${n}`);
}
function startDusk(){ S.phase='dusk'; S.arrivals=[]; if(S.bin){ S.bin=0; binFill.m.scale.y=0.01; } log('Закат. Мусорный контейнер опустел. Скоро ночь — хороните гробы!'); }
const newMods=()=>({hp:1,dmg:1,sp:1,lvl:0});
function buffMods(m){ m=Object.assign({},m||newMods()); if(Math.random()<0.5){ m.hp*=2; m.dmg*=2; } else m.sp*=2; m.lvl++; return m; }
function spawnZombie(pos,cof,mods){ const e=spawn('zombie',new THREE.Vector3(pos.x,0,pos.z),mods); e.cof=cof; cof.userData.zombie=e; cof.userData.bodyRef=null; return e; }
function startNight(){
  S.phase='night'; S.nightT=0; setTool('gun'); cancelPlace();
  if(player.carrying) dropCarried(true); if(S.cart&&S.cart.pushing) toggleCart();
  S.night={ kills:{ghost:0,vampire:0,witch:0,zombie:0}, dmg:0, graves:0, waves:[], zombies:0 };
  // незакопанные гробы открываются — из каждого выходит зомби
  for(const c of S.coffins){ const u=c.userData; if(u.open) continue; setLid(c,true); const zp=u.table?new THREE.Vector3(u.table.x+0.9,0,u.table.z):c.position; const ze=spawnZombie(zp,c,u.mods||newMods()); ze.inMorgue=!!u.table; S.night.zombies++; }
  // невозвращённые тела оживают сильнее (×2 HP/урон или ×2 скорость, складывается)
  for(const b of [...S.bodies]){ const m=buffMods(b.userData.mods); const ze=spawnZombie(b.position,b.userData.cof,m); ze.inMorgue=inMorgueBox(b.position); scene.remove(b); S.night.zombies++; }
  S.bodies=[];
  const n=4+S.day*2; for(let i=0;i<n;i++){ const r=Math.random(); S.night.waves.push({ t:20+i*(560/n), type: S.day>=2&&r<0.15?'witch' : r<0.5?'vampire':'ghost' }); }
  log(S.night.zombies?`Ночь! Из незакопанных гробов встают зомби: ${S.night.zombies}`:'Наступила ночь! Нежить идёт на кладбище');
}
function zombieToBody(e){ const c=e.cof, b=makeBody(c.userData.id); b.position.set(e.m.position.x,0,e.m.position.z); b.rotation.y=Math.random()*6;
  b.userData={cof:c, mods:e.mods, body:true}; c.userData.bodyRef=b; c.userData.zombie=null; S.bodies.push(b); removeEnemy(e); }
function startDawn(){ // рассвет: зомби падают замертво, прочая нежить уходит, приезжает торговец
  S.phase='dawn';
  for(const e of [...enemies]){ if(e.type==='zombie') zombieToBody(e); else removeEnemy(e); }
  S.day++; if(!S.merchant) S.merchant=makeMerchant();
  const k=S.night.kills;
  return { title:`Рассвет — ночь ${S.day-1} позади`, lines:[`Доход за прошлый день: $${Math.round(S.dayIncome)}`, `Убито: призраков ${k.ghost}, вампиров ${k.vampire}, ведьм ${k.witch}, зомби ${k.zombie}`, `Урон офису: ${S.night.dmg}`, `Разрушено надгробий: ${S.night.graves}`, `Тел зомби на земле: ${S.bodies.length} — верните их в их гробы и закопайте до ночи!`, 'У ворот ждёт торговец (до 08:00): продайте ему останки нежити.', `Деньги: $${Math.round(S.money)}  Репутация: ${S.rep}`] };
}
function togglePhase(){ const m=S.time%1440, bs=[360,480,1080,1200]; let nb=bs.find(b=>b>m+0.5); if(nb===undefined) nb=360+1440; S.time=nb+0.01; if(S.time>=1440) S.time-=1440; return null; }

const nearPt=(v,d)=>Math.hypot(player.pos.x-v.x,player.pos.z-v.z)<d;
function nearestOf(list,d=1.9){ const f=forwardPoint(1.1); let best=null,bd=d; for(const o of list){ const q=o.position; const dd=Math.min(Math.hypot(q.x-f.x,q.z-f.z),Math.hypot(q.x-player.pos.x,q.z-player.pos.z)+0.3); if(dd<bd){bd=dd;best=o;} } return best; }
function freeSpot(){ for(let i=0;i<30;i++){ const x=DROP.x-2+(i%5)*1.0, z=DROP.z-1.5+Math.floor(i/5)*2.3; if(!S.coffins.some(c=>Math.hypot(c.position.x-x,c.position.z-z)<0.8)) return new THREE.Vector3(x,0.2,z); } return new THREE.Vector3(DROP.x,0.2,DROP.z); }
function walkable(v){ if(Math.abs(v.x)>HX+9||Math.abs(v.z)>HZ+9) return false; return !colliders.some(c=>!c.off&&(c.r!==undefined?Math.hypot(v.x-c.x,v.z-c.z)<c.r+0.3:(v.x>c.minX-0.3&&v.x<c.maxX+0.3&&v.z>c.minZ-0.3&&v.z<c.maxZ+0.3))); }
function dropCarried(force){ const o=player.carrying; let v=forwardPoint(1.3); if(!walkable(v)){ if(!force) return log('Здесь нельзя положить'); v=new THREE.Vector3(player.pos.x,0,player.pos.z); }
  o.position.set(v.x,o.userData.body?0:0.2,v.z); o.rotation.y=player.yaw; player.carrying=null;
  if(o.userData.body) S.bodies.push(o); else S.coffins.push(o); if(!force) log(o.userData.body?'Тело положено':'Гроб поставлен'); }
function nearestPlot(maxD=2.2){ const f=forwardPoint(1.8); let best=null,bd=maxD; for(const p of plots){ const d=Math.hypot(p.x-f.x,p.z-f.z); if(d<bd){bd=d;best=p;} } return best; }
const near=nearPt;
function price(t=1){ return Math.round(60*(1+LEVELS[t].b)*(0.6+S.rep/100)); }
const orderText=c=>{ const t=c.userData.tier||1; return `${LEVELS[t].n} — $${price(t)}`; };
// Подсказка по текущему контексту
const orderC=c=>orderText(c);
function contextHint(){
  if(Math.hypot(player.pos.x-COMPUTER.x,player.pos.z-COMPUTER.z)<2.2) return 'E — компьютер: магазин улучшений';
  if(nearPt(MEDCAB,2)) return S.medCab?`Аптечки ${S.medCab}/3: E — взять в инвентарь · H/❤ — использовать сразу`:'Аптечек больше нет';
  if(morgueOpen()&&nearDoor()&&!player.carrying&&!player.pushing) return MORGUE.locked?'E — отпереть дверь морга':'E — запереть дверь морга';
  if(!morgueOpen()&&nearDoor()) return `Морг закрыт. Открыть: компьютер в офисе, $1000`;
  if(player.pushing){ const p2=nearestPlot(), L=S.cart.load; if(L&&p2&&p2.state==='dug') return L.userData.open?'Гроб пуст — верните тело':'E — опустить гроб с тележки в яму · G — отпустить'; return `Толкаете тележку${L?' с гробом':''} · G — отпустить`; }
  if(S.cart&&nearCart()&&!player.pushing){ if(player.carrying&&!player.carrying.userData.body&&!S.cart.load) return 'E — положить гроб на тележку · G — толкать (сначала руки свободны)';
    if(!player.carrying&&S.cart.load&&S.phase!=='night') return `E — снять гроб с тележки · G — толкать`; if(!player.carrying) return 'G/🛒 — толкать тележку'; }
  if(morgueOpen()&&!player.pushing){ const t=nearTable(); if(t){ if(player.carrying&&!player.carrying.userData.body&&!t.coffin) return 'E — положить гроб на стол';
    if(!player.carrying&&t.coffin&&S.phase!=='night'&&!nearestOf(S.bodies)) return `E — взять гроб со стола`; } }
  if(S.placing) return `Установка: ${TNAME[S.placing]} — ЛКМ/🔫 подтвердить, Q — отмена`;
  if(player.trash) return near(CONTAINER,3.2)?(S.bin>=BIN_CAP?`Контейнер полон (${S.bin}/${BIN_CAP}) — опустеет на закате`:`E — выбросить ($2 за вывоз) · Контейнер ${S.bin}/${BIN_CAP}`):'Несите мусор в контейнер за воротами';
  if(near(CONTAINER,4)) return `Мусорный контейнер: ${S.bin}/${BIN_CAP}. Пустеет на закате`;
  if(S.merchant&&near(MERCHANT,4.5)) return 'E — торговец: купить снаряжение / продать останки';
  const car=player.carrying;
  if(car&&car.userData.body){ const c=car.userData.cof; const nc=nearestOf(S.coffins,2.4); return nc===c?'E — Положить тело в гроб':(nc?'Это не его гроб — ищите гроб с такой же меткой':'Несите тело к гробу с такой же цветной меткой (E — положить на землю)'); }
  const p=nearestPlot();
  if(car){
    if(p&&p.state==='dug') return car.userData.open?'Гроб пуст — сначала верните в него тело':`E — опустить гроб в яму · Заказ ${orderC(car)}`;
    if(near(CREM_DOOR,4)&&secOpen('crem')) return 'E — кремировать ($40)';
    return `Заказ ${orderC(car)} — несите к выкопанной яме · E — поставить на землю`;
  }
  const vt=S.turrets.find(t=>t.kind==='vac'&&t.count>0&&nearPt(t.g.position,2.2)); if(vt) return `E — забрать пойманных призраков (${vt.count}/3)`;
  const rm=nearestOf(S.remains); if(rm) return `E — подобрать останки (${TYPES[rm.userData.type].name})`;
  const ch=nearestChunk();
  if(ch&&S.phase!=='night') return ch.plot.sec.unlocked?(player.tool==='shovel'?`Удерживайте ЛКМ — расчистить (${CHN[ch.type]})`:'Q — взять лопату'):`Заброшенный участок — купите в компьютере в офисе`;
  if(S.phase!=='night'){
    const b=nearestOf(S.bodies); if(b) return `E — поднять тело зомби (метка — как на его гробу)`;
    const c=nearestOf(S.coffins.filter(c=>!c.userData.inPit&&!c.userData.table&&!c.userData.cart)); if(c) return `E — взять гроб ${orderC(c)}${c.userData.open?' (пустой — тело снаружи)':''}`;
  }
  if(p){ if(!p.sec.unlocked) return `Участок не куплен ($${p.sec.price}, компьютер в офисе)`;
    if(p.state==='empty'&&p.chunks.some(c=>!c.cleared)) return 'Сначала расчистите участок';
    if(p.state==='empty') return player.tool==='shovel'?`Удерживайте ЛКМ — копать яму: ${Math.floor(p.dig*100)}%`:`Q — взять лопату (яма ${Math.floor(p.dig*100)}%)`;
    if(p.state==='coffin') return p.coffin.userData.open?'Гроб открыт — верните тело, потом закапывайте':(player.tool==='shovel'?`Удерживайте ЛКМ — засыпать могилу: ${Math.floor((p.fill||0)*100)}%`:'Q — взять лопату');
    if(p.state==='dug') return 'Яма готова — принесите гроб'; if(p.state==='broken') return 'E — починить надгробие ($20)'; }
  if(S.phase==='night') return player.tool==='gun'?'ЛКМ — стрелять':'Q — достать оружие';
  const z=zoneHint(); if(z) return z;
  return '';
}
const secOpen=id=>sections.find(s=>s.id===id).unlocked;
function zoneHint(){ for(const s of sections){ if(s.kind==='plots') continue; const c=s.kind==='crem'?CREM_DOOR:new THREE.Vector3(s.cx,0,s.cz+(s.kind==='morgue'?3:0)); if(!near(c,s.kind==='altar'?9:4)) continue;
  if(!s.unlocked) return (s.kind==='crem'||s.kind==='altar')?`${s.name} — пока недоступно`:`${s.name} — закрыто. Открыть: компьютер в офисе, $${s.price}`;
  return s.kind==='crem'?'Крематорий работает: принесите гроб к двери':s.kind==='morgue'?'':'Алтарь восстановлен — ритуалы появятся позже'; } return ''; }
function heal(){ if(player.hp>=100) return log('Здоровье полное');
  if(nearPt(MEDCAB,2)&&S.medCab>0){ S.medCab--; medkits[S.medCab].visible=false; player.hp=Math.min(100,player.hp+50); return log('Аптечка использована: +50'); }
  if(S.inv.med>0){ S.inv.med--; player.hp=Math.min(100,player.hp+50); return log('Аптечка из инвентаря: +50'); } log('Нет аптечек'); }
function interact(){
  if(player.trash){ if(near(CONTAINER,3.2)){ if(S.bin>=BIN_CAP) return log('Контейнер полон — опустеет на закате'); if(S.money<2) return log('Нужно $2 за вывоз мусора');
    scene.remove(player.trash); player.trash=null; S.trashDone++; S.bin++; S.money-=2; binFill.m.scale.y=S.bin/BIN_CAP; binFill.m.position.y=0.1+0.55*S.bin/BIN_CAP; log(`Мусор выброшен (−$2), контейнер ${S.bin}/${BIN_CAP}`); } else log('Контейнер — за воротами'); return; }
  if(morgueOpen()&&nearDoor()&&!player.carrying&&!player.pushing){ setMorgueLock(!MORGUE.locked); return log(MORGUE.locked?'Морг заперт':'Морг открыт'); }
  if(player.pushing){ const p2=nearestPlot(), L=S.cart.load; if(L&&p2&&p2.state==='dug'&&!L.userData.open){ S.cart.load=null; L.userData.cart=false; S.coffins.splice(S.coffins.indexOf(L),1); lowerIntoPit(L,p2); } return; }
  if(S.cart&&nearCart()){ const c=S.cart;
    if(player.carrying&&!player.carrying.userData.body&&!c.load){ c.load=player.carrying; player.carrying=null; c.load.userData.cart=true; S.coffins.push(c.load); updateCart(); return log('Гроб на тележке'); }
    if(!player.carrying&&c.load&&S.phase!=='night'){ const L=c.load; c.load=null; L.userData.cart=false; S.coffins.splice(S.coffins.indexOf(L),1); player.carrying=L; setTool('shovel'); return log('Гроб снят с тележки'); } }
  if(morgueOpen()){ const t=nearTable(); if(t){ const car0=player.carrying;
    if(car0&&!car0.userData.body&&!t.coffin){ player.carrying=null; t.coffin=car0; car0.userData.table=t; car0.position.set(t.x,1.1,t.z); car0.rotation.y=0; S.coffins.push(car0); return log('Гроб на столе в морге'); }
    if(!car0&&t.coffin&&S.phase!=='night'&&!nearestOf(S.bodies)){ const c=t.coffin; t.coffin=null; c.userData.table=null; S.coffins.splice(S.coffins.indexOf(c),1); player.carrying=c; setTool('shovel'); return log('Гроб взят со стола'); } } }
  const car=player.carrying, p=nearestPlot();
  if(car&&car.userData.body){ const c=car.userData.cof;
    if(nearestOf(S.coffins,2.4)===c){ scene.remove(car); player.carrying=null; setLid(c,false); c.userData.mods=car.userData.mods; c.userData.bodyRef=null; log(`Тело в гробу, крышка закрыта`); }
    else dropCarried(); return; }
  if(car){
    if(p&&p.state==='dug'){ if(car.userData.open) return log('Гроб пуст — сначала верните тело');
      lowerIntoPit(car,p); return; }
    else if(near(CREM_DOOR,4)&&secOpen('crem')&&!car.userData.open){ scene.remove(car); player.carrying=null; S.money+=40; S.dayIncome+=40; S.rep=Math.min(100,S.rep+1); log('Кремация: +$40'); }
    else dropCarried();
    return;
  }
  if(S.merchant&&near(MERCHANT,4.5)) return 'sell';
  if(nearPt(MEDCAB,2)){ if(S.medCab>0){ S.medCab--; medkits[S.medCab].visible=false; S.inv.med++; log('Аптечка в инвентаре'); } return; }
  const vt=S.turrets.find(t=>t.kind==='vac'&&t.count>0&&nearPt(t.g.position,2.2)); if(vt){ S.inv.rem.ghost+=vt.count; log(`Забрано призраков: ${vt.count}`); vt.count=0; setVacLabel(vt); return; }
  const rm=nearestOf(S.remains); if(rm){ S.inv.rem[rm.userData.type]++; scene.remove(rm); S.remains.splice(S.remains.indexOf(rm),1); log('Останки в инвентаре'); return; }
  if(S.phase!=='night'){
    const b=nearestOf(S.bodies); if(b){ S.bodies.splice(S.bodies.indexOf(b),1); player.carrying=b; setTool('shovel'); log(`Тело зомби — отнесите в гроб с такой же меткой`); return; }
    const c=nearestOf(S.coffins.filter(c=>!c.userData.inPit&&!c.userData.table&&!c.userData.cart)); if(c){ S.coffins.splice(S.coffins.indexOf(c),1); player.carrying=c; setTool('shovel'); log('Заказ клиента: '+orderC(c)); return; }
  } else if(nearestOf(S.coffins)||nearestOf(S.bodies)) return log('Ночью гробы и тела не поднять');
  if(p&&p.state==='broken') repair(p);
}
function lowerIntoPit(car,p){ if(player.carrying===car) player.carrying=null; p.state='coffin'; p.coffin=car; p.fill=0; car.userData.inPit=p; car.position.set(p.x,0.07-1.4+0.22,p.z); car.rotation.y=0; car.traverse(o=>{ if(o.isMesh) o.renderOrder=-2; }); S.coffins.push(car); log('Гроб в яме — засыпьте могилу лопатой'); }
function finishBurial(p){ const c=p.coffin, tier=c.userData.tier||1; scene.remove(c); S.coffins.splice(S.coffins.indexOf(c),1); p.coffin=null; p.dig=0; p.fill=0;
  removePit(p); p.state='filled'; p.level=Math.min(4,tier); makeStone(p,p.level); setPatch(p);
  const v=price(tier); S.money+=v; S.dayIncome+=v; S.rep=Math.min(100,S.rep+2); S.buried++; log(`Могила засыпана (${LEVELS[tier].n})! +$${v}`); }
function repair(p){ if(S.money<20) return log('Не хватает денег'); S.money-=20; p.state='filled'; makeStone(p,p.level||1); log('Надгробие починено'); }
const CHN={grass:'трава',trash:'мусор',branch:'ветки'}, TNAME={gun:'Турель',vac:'Турель-пылесос'};
function nearestChunk(){ const f=forwardPoint(1.6); let best=null,bd=1.1; for(const c of chunks){ if(c.cleared) continue; const d=Math.hypot(c.x-f.x,c.z-f.z); if(d<bd){bd=d;best=c;} } return best; }
function makeBag(type){ const g=new THREE.Group(); if(type==='trash'){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.35,8,6),mats.trash); m.scale.y=1.2; g.add(m); } else for(let i=0;i<4;i++){ const c=cyl(0.04,0.05,1,mats.wood,0,0,0,g,5); c.rotation.set(Math.PI/2,0,i*0.3-0.4); } scene.add(g); return g; }
function dig(dt){
  if(S.phase==='night'||player.carrying||player.trash) return null;
  const ch=nearestChunk();
  if(ch&&ch.plot.sec.unlocked){ ch.prog+=dt/1.2; if(ch.prog>=1){ ch.cleared=true; scene.remove(ch.g);
      if(ch.type!=='grass'){ player.trash=makeBag(ch.type); log(`Собрано: ${CHN[ch.type]} — отнесите в контейнер`); } }
    return {dig:Math.min(1,ch.prog)}; }
  const p=nearestPlot(); if(!p) return null;
  if(p.state==='coffin'){ if(p.coffin.userData.open) return null; p.fill=Math.min(1,(p.fill||0)+dt/3); p.dig=1-p.fill; updatePit(p); p.coffin.position.y=0.07-1.4+0.22+0; 
    if(p.fill>=1) finishBurial(p); return {dig:p.fill}; }
  if(!p.sec.unlocked||p.state!=='empty'||p.chunks.some(c=>!c.cleared)) return null;
  p.dig=Math.min(1,p.dig+dt/4); updatePit(p); if(p.dig>=1){ p.state='dug'; log('Яма выкопана на 100% — можно хоронить'); } return p;
}
// Магазин / улучшения (компьютер в офисе)
function shopItems(){
  const it=[];
  if(S.level<5) it.push({ label:`Улучшить здание → ур.${S.level+1}: ${LEVELS[S.level+1].n}`, cost:UPG_COST[S.level], buy:()=>{ S.level++; } });
  sections.filter(s=>!s.unlocked).forEach(s=>it.push({ label:`Открыть: ${s.kind==='plots'?'['+s.order+'] ':''}${s.name}${s.kind==='plots'?' (+места, нужна расчистка)':s.kind==='crem'?' (кремация)':' (пока заглушка)'}`, cost:s.price, buy:()=>{ unlockSection(s); if(s.id==='morgue') setMorgueLock(false); }, na:s.kind==='crem'||s.kind==='altar'||(s.kind==='plots'&&sections.some(o=>o.kind==='plots'&&!o.unlocked&&o.order<s.order)) }));
  if(!S.cart) it.push({ label:'Тележка для гробов (1 гроб, толкать — G/🛒)', cost:250, buy:()=>{ S.cart={g:makeCart(),load:null,pushing:false}; S.cart.g.position.set(-1.5,0,17.5); } });
  if(S.bHp<100) it.push({ label:`Ремонт здания (${S.bHp}/100)`, cost:Math.ceil((100-S.bHp)*1.8), buy:()=>{ S.bHp=100; } });
  return it;
}
// Оружие и боеприпасы
const WPN={ pistol:{n:'Пистолет',cd:0.35,pel:1,spread:0,ghost:0.5,other:1}, shotgun:{n:'Дробовик',cd:0.75,pel:5,spread:0.06,ghost:0.5,other:1}, salt:{n:'Сольное ружьё',cd:0.6,pel:1,spread:0,ghost:2,other:0.5} };
function cycleWeapon(){ const own=Object.keys(WPN).filter(k=>S.weapons[k]); S.weapon=own[(own.indexOf(S.weapon)+1)%own.length]; S.reloadT=0; log('Оружие: '+WPN[S.weapon].n); }
function reload(){ const a=S.ammo[S.weapon]; if(S.reloadT>0||a.mag>=a.cap) return; if(a.res<=0) return log('Нет патронов в запасе — купите у торговца'); S.reloadT=1.2; log('Перезарядка…'); }
function canFire(){ const a=S.ammo[S.weapon]; if(S.reloadT>0) return false; if(a.mag<=0){ if(a.res>0) reload(); else log('Патроны кончились!'); return false; } a.mag--; return true; }
function hitDamage(e){ const w=WPN[S.weapon]; let d=e.type==='ghost'?w.ghost:w.other; if(S.holy&&(e.type==='vampire'||e.type==='witch')) d*=2; return d; }
// Товары торговца: оружие против призраков, турели, патроны
function merchantItems(){ const it=[], A=S.ammo;
  if(!S.weapons.salt) it.push({ label:'Сольное ружьё (×2 урон по призракам; обычное оружие бьёт призраков вполсилы)', cost:220, buy:()=>{ S.weapons.salt=true; A.salt.mag=5; A.salt.res+=10; S.weapon='salt'; } });
  if(!S.weapons.shotgun) it.push({ label:'Дробовик (5 дробин)', cost:200, buy:()=>{ S.weapons.shotgun=true; A.shotgun.mag=6; A.shotgun.res+=12; } });
  if(!S.holy) it.push({ label:'Святая вода (×2 урон по вампирам/ведьмам)', cost:180, buy:()=>{ S.holy=true; } });
  it.push({ label:'Турель (авто-стрельба) (в инвентарь)', cost:150, buy:()=>{ S.inv.gun++; } });
  it.push({ label:'Турель-пылесос (ловит до 3 призраков) (в инвентарь)', cost:120, buy:()=>{ S.inv.vac++; } });
  it.push({ label:'Патроны для пистолета ×16', cost:15, buy:()=>{ A.pistol.res+=16; } });
  if(S.weapons.shotgun) it.push({ label:'Патроны для дробовика ×12', cost:25, buy:()=>{ A.shotgun.res+=12; } });
  if(S.weapons.salt) it.push({ label:'Солевые патроны ×10', cost:20, buy:()=>{ A.salt.res+=10; } });
  return it; }
// Тележка
function nearCart(d=2.3){ return S.cart&&nearPt(S.cart.g.position,d); }
function toggleCart(){ if(!S.cart) return; const c=S.cart; if(c.pushing){ c.pushing=false; player.pushing=false; log('Тележка отпущена'); return; }
  if(!nearCart()) return; if(player.carrying) return log('Сначала положите то, что несёте (или загрузите гроб на тележку — E)');
  c.pushing=true; player.pushing=true; setTool('shovel'); log('Толкаете тележку (G — отпустить)'); }
function updateCart(){ const c=S.cart; if(!c) return; if(c.pushing){ const v=forwardPoint(1.6); c.g.position.set(v.x,0,v.z); c.g.rotation.y=player.yaw; }
  if(c.load){ c.load.position.set(c.g.position.x,0.85,c.g.position.z); c.load.rotation.y=c.g.rotation.y; } }
// Морг
const morgueOpen=()=>sections.find(s=>s.id==='morgue').unlocked;
function nearTable(){ const f=forwardPoint(1.0); let best=null,bd=1.8; for(const t of MORGUE.tables){ const d=Math.hypot(t.x-f.x,t.z-f.z); if(d<bd){bd=d;best=t;} } return best; }
function nearDoor(){ const D=MORGUE.doorPt; return Math.abs(player.pos.x-D.x)<1.3&&Math.abs(player.pos.z-D.z)<1.1; }
const inMorgueBox=v=>{ const b=MORGUE.box; return v.x>b.minX&&v.x<b.maxX&&v.z>b.minZ&&v.z<b.maxZ; };
function turretMesh(kind){
  const g=new THREE.Group(); scene.add(g);
  cyl(0.4,0.5,0.8,mats.dark,0,0.4,0,g);
  const head=box(0.5,0.4,0.5,kind==='gun'?mats.metal:mats.gold,0,1,0,g);
  const barrel = kind==='gun'? box(0.1,0.1,0.8,mats.dark,0,0,-0.5,head) : cyl(0.25,0.12,0.6,mats.metal,0,0,-0.4,head);
  if(kind==='vac') barrel.rotation.x=Math.PI/2;
  return {g,head};
}
// Инвентарь и установка турелей с призрачным превью
const gnd=new THREE.Plane(new THREE.Vector3(0,1,0),0), rc=new THREE.Raycaster();
function placePoint(){ rc.setFromCamera(new THREE.Vector2(0,0),camera); const v=new THREE.Vector3();
  if(rc.ray.intersectPlane(gnd,v) && v.distanceTo(player.pos)<10) return v; return forwardPoint(3); }
function selectPlace(kind){ cancelPlace(); if(!S.inv[kind]) return log('Нет в инвентаре — купите в компьютере в офисе');
  S.placing=kind; S.preview=turretMesh(kind).g; S.preview.traverse(o=>{ if(o.material){ o.material=o.material.clone(); o.material.transparent=true; o.material.opacity=0.45; o.castShadow=false; } }); }
function cancelPlace(){ if(S.preview) scene.remove(S.preview); S.preview=null; S.placing=null; }
function updatePlacement(){ if(S.preview){ const v=placePoint(); S.preview.position.set(v.x,0,v.z); } }
function confirmPlace(){ if(!S.placing) return false; const kind=S.placing, pos=S.preview.position.clone(); cancelPlace();
  const t=turretMesh(kind); t.g.position.copy(pos); const tu={ kind, g:t.g, head:t.head, cd:0, count:0 }; if(kind==='vac') setVacLabel(tu); S.turrets.push(tu); S.inv[kind]--; log(TNAME[kind]+' установлена'); return true; }
// Пылесос: ловит до 3 призраков (притягивает, обездвиживает), потом «полон» — разгрузить (E) и продать торговцу
function setVacLabel(t){ const c=t.lc||(t.lc=document.createElement('canvas')); c.width=128; c.height=48; const g=c.getContext('2d'); g.clearRect(0,0,128,48);
  g.fillStyle=t.count>=3?'#c0392b':'#000a'; g.fillRect(0,0,128,48); g.fillStyle='#fff'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(`👻 ${t.count}/3`,64,26);
  if(!t.label){ t.label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false})); t.label.scale.set(1.2,0.45,1); t.label.position.y=1.9; t.label.renderOrder=5; t.g.add(t.label); }
  else t.label.material.map.needsUpdate=true; }
function updateTurrets(dt, fx){
  for(const t of S.turrets){ t.cd-=dt; const p=t.g.position;
    if(t.kind==='vac'){
      if(t.tgt&&!enemies.includes(t.tgt)) t.tgt=null;
      if(!t.tgt&&t.count<3){ let bd=8; for(const e of enemies){ if(e.type!=='ghost'||e.captured) continue; const d=Math.hypot(p.x-e.m.position.x,p.z-e.m.position.z); if(d<bd){bd=d;t.tgt=e;} } if(t.tgt) t.tgt.captured=true; }
      const e=t.tgt; if(!e) continue; const q=e.m.position, to=new THREE.Vector3(p.x-q.x,1-q.y,p.z-q.z), d=to.length();
      t.head.rotation.y=Math.atan2(-to.x,-to.z);
      if(d<0.6){ removeEnemy(e); t.tgt=null; t.count++; setVacLabel(t); log(`Призрак пойман (${t.count}/3)`); }
      else q.add(to.multiplyScalar(Math.min(1,dt*5/d)));
      continue; }
    const want=['vampire','witch','zombie'], R=14;
    let best=null,bd=R; for(const e of enemies){ if(!want.includes(e.type)) continue; const d=p.distanceTo(e.m.position); if(d<bd){bd=d;best=e;} }
    if(!best) continue; t.head.rotation.y=Math.atan2(p.x-best.m.position.x,p.z-best.m.position.z);
    if(t.cd<=0){ t.cd=0.8; fx(p.clone().setY(1),best.m.position.clone().setY(1.2)); damage(best,1); }
  }
}
function damage(e,dmg){ if(!enemies.includes(e)) return; e.hp-=dmg; if(e.hp>0) return; S.night.kills[e.type]++;
  if(e.type==='zombie'){ zombieToBody(e); log('Зомби упокоен — тело осталось на земле'); return; }
  const r=makeRemains(e.type); r.position.x=e.m.position.x; r.position.z=e.m.position.z; r.userData.type=e.type; S.remains.push(r); removeEnemy(e); log(`${TYPES[e.type].name} уничтожен — подберите останки`); }
function onEnemyEvent(kind,arg){
  if(kind==='building'){ S.bHp-=arg; S.night.dmg+=arg; if(S.bHp<=0) S.over='Главное здание разрушено!'; }
  if(kind==='player'){ player.hp-=arg; if(player.hp<=0) S.over='Смотритель погиб!'; }
  if(kind==='grave'){ arg.hp=(arg.hp||3)-1; if(arg.hp<=0){ arg.state='broken'; arg.hp=3; clearStone(arg); box(1.5,0.25,2.4,mats.dark,arg.x,0.12,arg.z); arg.objs.push(scene.children.at(-1)); S.night.graves++; S.rep=Math.max(0,S.rep-3); log('Вампир разрушил надгробие!'); } }
}
let regenT=0;
function updateSim(dt){
  updateCart(); if(S.reloadT>0){ S.reloadT-=dt; if(S.reloadT<=0){ const a=S.ammo[S.weapon], n=Math.min(a.cap-a.mag,a.res); a.mag+=n; a.res-=n; S.reloadT=0; log('Перезаряжено'); } }
  S.time+=dt*RATE[S.phase]; if(S.time>=1440) S.time-=1440;
  const [n,w]=lightFor(S.time); applyLight(n,w);
  S.remains.forEach(r=>r.rotation.y+=dt*2);
  let rep=null; const ph=phaseOf(S.time);
  if(ph!==S.phase){ if(ph==='dusk') startDusk(); else if(ph==='night') startNight(); else if(ph==='dawn') rep=startDawn(); else startDay(); }
  if(S.phase==='day'){
    if(player.hp<100&&player.hp>0) player.hp=Math.min(100,player.hp+dt*0.4); // медленная регенерация днём
    while(S.arrivals.length&&S.time>=S.arrivals[0]){ S.arrivals.shift(); const id=S.nextId++, c=makeCoffin(id); c.userData.id=id; c.userData.tier=1+Math.floor(Math.random()*S.level); c.userData.open=false; c.position.copy(freeSpot()); S.coffins.push(c); log(`Катафалк привёз покойника `); }
  } else if(S.phase==='night'){
    S.nightT+=dt*RATE.night;
    while(S.night.waves.length&&S.nightT>=S.night.waves[0].t) spawn(S.night.waves.shift().type);
  }
  return rep;
}
function sellItems(){ return ['ghost','vampire','witch'].map(k=>({k,name:TYPES[k].name,n:S.inv.rem[k],price:TYPES[k].price})); }
function sell(k){ const list=k?[k]:['ghost','vampire','witch']; let sum=0; for(const t of list){ sum+=S.inv.rem[t]*TYPES[t].price; S.inv.rem[t]=0; } S.money+=sum; if(sum) log(`Продано торговцу: +$${sum}`); return sum; }

Object.assign(window,{WPN,cycleWeapon,reload,canFire,hitDamage,merchantItems,toggleCart,updateCart,PH,PHI,heal,sellItems,sell,dropCarried,finishBurial,setVacLabel,phaseOf,nearestChunk,selectPlace,cancelPlace,updatePlacement,confirmPlace,TNAME,setLogger,S,LEVELS,UPG_COST,clock,startDay,startNight,startDawn,startDusk,togglePhase,nearestPlot,price,contextHint,interact,dig,shopItems,updateTurrets,damage,onEnemyEvent,updateSim});
})();
