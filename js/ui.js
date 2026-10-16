(function(){
// HUD, меню улучшений, отчёт
const $=id=>document.getElementById(id);
const SLOTS=[['tool1','Лопата','⛏'],['tool2','Оружие','🔫'],['tool3','Турель','🗼'],['tool4','Пылесос','🌀']];
function initHotbar(){ const h=$('hotbar'); SLOTS.forEach(([k,n,ic],i)=>{ const d=document.createElement('div'); d.dataset.k=k; d.innerHTML=`<b>${ic}</b>${i+1} ${n}<span></span>`;
  d.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); press(k); }); d.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true}); h.appendChild(d); }); }
function updateHotbar(){ const sel=S.placing==='gun'?'tool3':S.placing==='vac'?'tool4':player.tool==='gun'?'tool2':'tool1';
  document.querySelectorAll('#hotbar div').forEach(d=>{ d.classList.toggle('sel',d.dataset.k===sel); const k=d.dataset.k; d.querySelector('span').textContent=k==='tool3'?` ×${S.inv.gun}`:k==='tool4'?` ×${S.inv.vac}`:''; }); }
function toggleInv(onClose){ const m=$('inv'); if(!m.classList.contains('hidden')){ m.classList.add('hidden'); onClose(); return; }
  m.innerHTML='<h2>Инвентарь</h2>'; const items=[['gun','Турель (авто-стрельба)'],['vac','Турель-пылесос']];
  for(const [k,n] of items){ const b=document.createElement('button'); b.textContent=`${n}: ${S.inv[k]} шт. — Установить`; b.disabled=!S.inv[k];
    b.onclick=()=>{ m.classList.add('hidden'); selectPlace(k); onClose(); }; m.appendChild(b); }
  { const b=document.createElement('button'); b.textContent=`🩹 Аптечка: ${S.inv.med} шт. — Использовать (+200)`; b.disabled=!S.inv.med; b.onclick=()=>{ heal(); m.classList.add('hidden'); onClose(); }; m.appendChild(b); }
  const r=S.inv.rem; { const p=document.createElement('p'); p.textContent=`Останки нежити: призраки ${r.ghost}, вампиры ${r.vampire}, ведьмы ${r.witch} — продавайте торговцу на рассвете`; m.appendChild(p); }
  if(!S.inv.gun&&!S.inv.vac){ const p=document.createElement('p'); p.textContent='Пусто. Турели покупаются на компьютере в офисе.'; m.appendChild(p); }
  const c=document.createElement('button'); c.textContent='Закрыть (I)'; c.onclick=()=>{ m.classList.add('hidden'); onClose(); }; m.appendChild(c);
  m.classList.remove('hidden'); releaseLock(); }
let msgT=0;
function log(t){ $('msg').textContent=t; msgT=3; }
function updateHUD(dt, digP){
  $('stats').innerHTML=`<b>День ${S.day}</b> — ${PHI[S.phase]} ${PH[S.phase]} ${clock()}<br>💰 $${Math.round(S.money)} &nbsp; ⭐ Реп: ${S.rep}<br>
  🏛 Здание ур.${S.level} (${LEVELS[S.level].n}) ❤ ${S.bHp}/${S.bMax}<br>🧍 Здоровье: ${Math.max(0,Math.round(player.hp))} · 🩹 ${S.inv.med} &nbsp; ${player.tool==='gun'?`🔫 ${WPN[S.weapon].n} ${S.ammo[S.weapon].mag}/${S.ammo[S.weapon].res}${S.reloadT>0?' (перезарядка…)':''}`:'⛏ лопата'}${player.pushing?' · 🛒 тележка':''}<br>
  ⚰ Гробов не закопано: ${S.coffins.length+(player.carrying&&!player.carrying.userData.body?1:0)}${player.carrying?(player.carrying.userData.body?' (несёте тело)':' (несёте гроб)'):''} · Тел: ${S.bodies.length} &nbsp; Похоронено: ${S.buried}${S.phase==='night'?`<br>👻 Врагов: ${enemies.length}`:''}${S.merchant?'<br>🛒 Торговец у ворот':''}`;
  const ph=Math.max(0,player.hp)/player.maxHp*100; $('phpfill').style.width=ph+'%'; $('phpfill').style.background=ph>50?'#4af':ph>25?'#db3':'#d33';
  $('hint').textContent=contextHint(); updateHotbar();
  const bp=Math.max(0,S.bHp)/S.bMax*100; $('hpfill').style.width=bp+'%'; $('hpfill').style.background=bp>50?'#3c4':bp>25?'#db3':'#d33';
  const k=Math.max(0.001,S.bHp/S.bMax); hpBar.fg.scale.x=k; hpBar.fg.position.x=-3*(1-k); hpBar.fg.material.color.setHex(bp>50?0x30d040:bp>25?0xddbb30:0xdd3030); hpBar.g.quaternion.copy(camera.quaternion);
  msgT-=dt; if(msgT<=0) $('msg').textContent='';
  $('bar').style.display=digP?'block':'none'; if(digP) $('barfill').style.width=(digP.dig*100)+'%';
}
const menuOpen=()=>!$('report').classList.contains('hidden')||!$('inv').classList.contains('hidden');
// Магазин: офисный компьютер (улучшения) и торговец (тот же стиль, вкладки Купить/Продать)
let shopKind=null, shopTab='buy';
const shopOpen=()=>!$('menu').classList.contains('hidden')&&shopKind==='office';
const sellOpen=()=>!$('menu').classList.contains('hidden')&&shopKind==='merchant';
function openShop(kind='office'){ shopKind=kind; shopTab='buy'; renderShop(); $('menu').classList.remove('hidden'); releaseLock(); }
function closeShop(){ if(shopKind==='office') hideShop(); }
function closeSell(){ if(shopKind==='merchant') hideShop(); }
function hideShop(){ $('menu').classList.add('hidden'); shopKind=null; }
const openSell=()=>openShop('merchant');
const ICON=l=>/здание|Улучшить/.test(l)?'🏛':/Сольное|Солевые/.test(l)?'🧂':/Патроны/.test(l)?'📦':/Дробовик/.test(l)?'🔫':/Святая/.test(l)?'💧':/пылесос/i.test(l)?'🌀':/Турель/.test(l)?'🗼':/Ремонт/.test(l)?'🔧':/Тележка/.test(l)?'🛒':/Морг/.test(l)?'🏥':/крематорий/i.test(l)?'🔥':/алтарь/i.test(l)?'👼':/Призрак/.test(l)?'👻':/Вампир/.test(l)?'🧛':/Ведьма/.test(l)?'🧙':'🌳';
function card(g,label,price,btn,dis,na,fn){ const d=document.createElement('div'); d.className='card'+(na?' na':'');
  d.innerHTML=`<div class="ic">${ICON(label)}</div><div class="nm">${label}</div><div class="pr">$${price}</div>`;
  const b=document.createElement('button'); b.textContent=btn; b.disabled=dis; b.onclick=fn; d.appendChild(b); g.appendChild(d); }
function renderShop(){
  const m=$('menu'); m.className='shop'; const merch=shopKind==='merchant';
  m.innerHTML=`<div class="shopbar"><span>🔍 <input placeholder="Поиск товаров…" disabled></span><span>💰 $${Math.round(S.money)} · 🛒</span></div>`+
    (merch?`<div class="tabs"><button data-t="buy" class="${shopTab==='buy'?'on':''}">Купить</button><button data-t="sell" class="${shopTab==='sell'?'on':''}">Продать</button></div>`:'')+`<div class="grid"></div><p class="small">E — закрыть</p>`;
  m.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{ shopTab=b.dataset.t; renderShop(); });
  const g=m.querySelector('.grid');
  if(merch&&shopTab==='sell'){ for(const it of sellItems()) card(g,`${it.name}: останки × ${it.n}`,it.price,it.n?`Продать (${it.n}) = $${it.n*it.price}`:'Нет в наличии',!it.n,false,()=>{ sell(it.k); renderShop(); }); return; }
  for(const it of (merch?merchantItems():shopItems())) card(g,it.label,it.cost,it.na?'Недоступно':S.money<it.cost?'Не хватает денег':'Купить',it.na||S.money<it.cost,it.na,()=>{ if(it.na||S.money<it.cost) return; S.money-=it.cost; it.buy(); log('Куплено: '+it.label); renderShop(); });
}
// Пауза
function showPause(on, h){ const el=$('pause'); if(!on){ el.classList.add('hidden'); return; } el.classList.remove('hidden'); releaseLock();
  el.innerHTML='<h2>Пауза</h2><button data-a="go">Продолжить</button><button data-a="new">Начать заново</button><button data-a="exit">Выйти</button>';
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>h(b.dataset.a)); }
function showReport(r, onClose){
  const el=$('report'); el.innerHTML=`<h2>${r.title}</h2>`+r.lines.map(l=>`<p>${l}</p>`).join('')+'<button>Начать новый день</button>';
  el.classList.remove('hidden'); releaseLock();
  el.querySelector('button').onclick=()=>{ el.classList.add('hidden'); onClose(); };
}
function showGameOver(t){ const el=$('report'); el.innerHTML=`<h2>Игра окончена</h2><p>${t}</p><p>Дней продержались: ${S.day}</p><button>Заново</button>`;
  el.classList.remove('hidden'); releaseLock(); el.querySelector('button').onclick=()=>location.reload(); }

Object.assign(window,{sellOpen,closeSell,openSell,initHotbar,toggleInv,log,updateHUD,menuOpen,openShop,closeShop,shopOpen,showPause,showReport,showGameOver});
})();
