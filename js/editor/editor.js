// Простой 2D-редактор карты Cemetery Guys (file://, без сервера)
function openEditor(){
document.getElementById('start').classList.add('hidden');
const root=document.createElement('div'); root.id='ed'; document.body.appendChild(root);
root.innerHTML=`<div id="edbar"><b>Инструмент:</b> <span id="tools"></span><span class="sep"></span>
<label><input type="checkbox" id="snap" checked> Привязка 1 м</label>
<button id="bNew">Новая</button><select id="edload"></select><button id="bLoad">Открыть</button>
<button id="bSaveAs">Сохранить как…</button><button id="bDelete">Удалить</button>
<button id="bImp">Импорт…</button><input type="file" id="edfile" accept=".js,.json" hidden>
<button id="bExp">Экспорт файла</button><button id="bPlay">▶ Играть</button><button id="bClose">✕ Выход</button></div>
<canvas id="edcv"></canvas><div id="edinfo"></div><div id="edzone" style="display:none">Зона: порядок покупки <input id="zord" type="number" min="0" style="width:45px"> цена $<input id="zpr" type="number" min="0" step="50" style="width:60px"><br><small>0 — стартовая (бесплатно), 1 — первая к покупке, 2 — вторая…</small></div>
<div id="edhelp">ЛКМ — поставить / выбрать и тащить · ПКМ — панорама · колесо — масштаб · R — поворот · Del — удалить · Ctrl+Z — отмена · Стена: клики по точкам, Enter — закончить</div>`;
const cv=document.getElementById('edcv'), g=cv.getContext('2d'), $=id=>document.getElementById(id);
const clone=o=>JSON.parse(JSON.stringify(o));
const BLANK={version:1,wall:{pts:[[-38,-26],[38,-26],[38,26],[-38,26]]},gates:[{x:0,z:26,w:6}],roads:[],zones:[],plots:[],buildings:[{type:'office',x:0,z:0,rot:0}],trees:[],lamps:[]};
let name=localStorage.getItem('cg_mapedit')||'Моя карта', M=MapStore.get('lib:'+name)||clone(window.CEMETERY_MAP);
const fillLoad=()=>{ $('edload').innerHTML=MapStore.list().map(k=>`<option value="${k}">${MapStore.label(k)}</option>`).join(''); };
// размеры зданий (м) для отрисовки/выбора
const BS={office:[12.4,7.4,'#b08a5a','Офис'],morgue:[8,6,'#8a9aa8','Морг'],crem:[7,6,'#a0523c','Крематорий'],altar:[6,6,'#cfcfd8','Алтарь'],colum:[3,0.8,'#999','Колумбарий'],bin:[2,1.2,'#3d6b3d','Контейнер'],drop:[3,2,'#555','Точка гробов'],merchant:[3,2,'#6a4a8a','Торговец']};
const ZC={bare:'#6b5233',wild:'#3f6b2f',crem:'#704036',altar:'#5a5a6e'};
const TOOLS=[['sel','Выбор'],['road','Дорога'],['zone','Зона'],['plot','Участок'],['tree','Дерево'],['lamp','Фонарь'],['gate','Ворота'],['wall','Стена'],...Object.keys(BS).map(k=>['b:'+k,BS[k][3]])];
let tool='sel', zt='wild', view={x:0,z:0,s:10}, sel=null, drag=null, undo=[], wallPts=null;
const tb=$('tools');
TOOLS.forEach(([id,n])=>{ const b=document.createElement('button'); b.textContent=n; b.dataset.t=id; b.onclick=()=>{tool=id; wallPts=id==='wall'?[]:null; upd();}; tb.appendChild(b); });
const zs=document.createElement('select'); zs.innerHTML='<option value="bare">голая земля</option><option value="wild" selected>заросшая</option><option value="crem">крематорий</option><option value="altar">алтарь</option>'; zs.onchange=()=>zt=zs.value; tb.appendChild(zs);
const save=()=>{ const l=MapStore.lib(); M.name=name; l[name]=M; MapStore.saveLib(l); localStorage.setItem('cg_mapedit',name); };
const push=()=>{ undo.push(JSON.stringify(M)); if(undo.length>60) undo.shift(); };
const snap=v=>$('snap').checked?Math.round(v):Math.round(v*10)/10;
const W2S=(x,z)=>[cv.width/2+(x-view.x)*view.s, cv.height/2+(z-view.z)*view.s];
const S2W=(px,py)=>[(px-cv.width/2)/view.s+view.x,(py-cv.height/2)/view.s+view.z];
const rot90=(w,d,r)=>((r||0)%180)?[d,w]:[w,d];
// все объекты в одном списке для выбора: [массив, элемент, w, d]
function items(){ const L=[];
  M.lamps.forEach(o=>L.push([M.lamps,o,0.8,0.8])); M.trees.forEach(o=>L.push([M.trees,o,1.4,1.4])); M.plots.forEach(o=>L.push([M.plots,o,1.6,2.6]));
  M.gates.forEach(o=>L.push([M.gates,o,o.w,1])); M.buildings.forEach(o=>{const [w,d]=rot90(BS[o.type][0],BS[o.type][1],o.rot); L.push([M.buildings,o,w,d]);});
  M.roads.forEach(o=>L.push([M.roads,o,o.w,o.d])); M.zones.forEach(o=>L.push([M.zones,o,o.w,o.d])); return L; }
function hit(x,z){ return items().find(([a,o,w,d])=>Math.abs(x-o.x)<=w/2&&Math.abs(z-o.z)<=d/2)||null; }
function rect(x,z,w,d,fill,stroke){ const [a,b]=W2S(x-w/2,z-d/2); g.fillStyle=fill; g.fillRect(a,b,w*view.s,d*view.s); if(stroke){g.strokeStyle=stroke;g.strokeRect(a,b,w*view.s,d*view.s);} }
function draw(){
  cv.width=innerWidth; cv.height=innerHeight; g.fillStyle='#24331f'; g.fillRect(0,0,cv.width,cv.height);
  // сетка 1 м / 5 м
  g.lineWidth=1; const [x0,z0]=S2W(0,0),[x1,z1]=S2W(cv.width,cv.height);
  for(let x=Math.floor(x0);x<=x1;x++){ if(view.s<5&&x%5) continue; const [a]=W2S(x,0); g.strokeStyle=x%5?'#2c3c27':'#3a4d33'; g.beginPath(); g.moveTo(a,0); g.lineTo(a,cv.height); g.stroke(); }
  for(let z=Math.floor(z0);z<=z1;z++){ if(view.s<5&&z%5) continue; const [,b]=W2S(0,z); g.strokeStyle=z%5?'#2c3c27':'#3a4d33'; g.beginPath(); g.moveTo(0,b); g.lineTo(cv.width,b); g.stroke(); }
  M.zones.forEach(o=>{ rect(o.x,o.z,o.w,o.d,ZC[o.type]+'aa','#000'); txt(((o.type==='bare'||o.type==='wild')?'['+(o.order|0)+'] $'+(o.price|0)+' ':'')+o.id+' '+o.type,o.x,o.z-o.d/2+1); });
  M.roads.forEach(o=>rect(o.x,o.z,o.w,o.d,'#8a7350'));
  M.plots.forEach(o=>rect(o.x,o.z,1.6,2.6,'#4a3420','#c9a36a'));
  // стена
  g.strokeStyle='#bbb'; g.lineWidth=Math.max(2,0.6*view.s); g.beginPath(); M.wall.pts.forEach((p,i)=>{const [a,b]=W2S(p[0],p[1]); i?g.lineTo(a,b):g.moveTo(a,b);}); g.closePath(); g.stroke(); g.lineWidth=1;
  M.gates.forEach(o=>{ rect(o.x,o.z,o.w,1.2,'#24331f','#ffcc33'); txt('ворота',o.x,o.z); });
  M.buildings.forEach(o=>{ const [w,d]=rot90(BS[o.type][0],BS[o.type][1],o.rot); rect(o.x,o.z,w,d,BS[o.type][2],'#000'); txt(BS[o.type][3],o.x,o.z); });
  M.trees.forEach(o=>dot(o.x,o.z,o.t==='pine'?1:0.9,o.t==='pine'?'#1c3a18':'#3f7a2f'));
  M.lamps.forEach(o=>dot(o.x,o.z,0.4,'#ffd060'));
  if(wallPts&&wallPts.length){ g.strokeStyle='#ff0'; g.beginPath(); wallPts.forEach((p,i)=>{const [a,b]=W2S(p[0],p[1]); i?g.lineTo(a,b):g.moveTo(a,b);}); g.stroke(); }
  if(drag&&drag.rect){ const r=drag.rect; rect((r[0]+r[2])/2,(r[1]+r[3])/2,Math.abs(r[2]-r[0]),Math.abs(r[3]-r[1]),'#ffffff33','#fff'); }
  if(sel){ const it=items().find(i=>i[1]===sel); if(it){ g.lineWidth=2; rect(sel.x,sel.z,it[2]+0.4,it[3]+0.4,'transparent','#ff0'); g.lineWidth=1; } }
}
function txt(s,x,z){ const [a,b]=W2S(x,z); g.fillStyle='#fff'; g.font='11px sans-serif'; g.textAlign='center'; g.fillText(s,a,b+4); }
function dot(x,z,r,c){ const [a,b]=W2S(x,z); g.fillStyle=c; g.beginPath(); g.arc(a,b,Math.max(2,r*view.s),0,7); g.fill(); }
function validate(){ const w=[];
  if(!M.buildings.some(b=>b.type==='office')) w.push('Нет офиса (игра поставит по умолчанию)');
  if(!M.gates.length) w.push('Нет ворот в стене');
  if(!M.zones.some(z=>z.type==='bare')) w.push('Нет стартовой зоны (голая земля)');
  if(M.plots.some(p=>!M.zones.some(z=>z.id===p.zone))) w.push('Есть участки вне зон (будут пропущены)');
  if(!M.buildings.some(b=>b.type==='bin')) w.push('Нет мусорного контейнера');
  return w; }
const UNIQ=['office','morgue','crem','altar','bin','drop','merchant'];
function upd(){ document.querySelectorAll('#tools button').forEach(b=>{ b.classList.toggle('on',b.dataset.t===tool); const t=b.dataset.t; b.disabled=t==='gate'?M.gates.length>0:(t.startsWith('b:')&&UNIQ.includes(t.slice(2))&&M.buildings.some(o=>o.type===t.slice(2))); if(b.disabled&&tool===t) tool='sel'; });
  const zp=sel&&(sel.type==='bare'||sel.type==='wild')&&'order' in sel; $('edzone').style.display=zp?'':'none'; if(zp){ $('zord').value=sel.order; $('zpr').value=sel.price; }
  const w=validate(); let s=`Объектов: зданий ${M.buildings.length}, деревьев ${M.trees.length}, участков ${M.plots.length}, зон ${M.zones.length}`;
  if(sel) s+='\nВыбрано: '+(sel.type||sel.id||'')+` (${sel.x}, ${sel.z})`+(sel.rot!==undefined?' поворот '+sel.rot+'°':'');
  $('edinfo').innerHTML=s+(w.length?'\n<span class="warn">⚠ '+w.join('\n⚠ ')+'</span>':'\n✓ Карта корректна'); draw(); save(); }
function zoneAt(x,z){ const zz=M.zones.find(o=>(o.type==='bare'||o.type==='wild')&&Math.abs(x-o.x)<=o.w/2&&Math.abs(z-o.z)<=o.d/2); return zz&&zz.id; }
cv.oncontextmenu=e=>e.preventDefault();
cv.onmousedown=e=>{ const [wx,wz]=S2W(e.offsetX,e.offsetY), x=snap(wx), z=snap(wz);
  if(e.button!==0){ drag={pan:1,px:e.clientX,py:e.clientY,vx:view.x,vz:view.z}; return; }
  if(tool==='sel'){ const h=hit(wx,wz); sel=h&&h[1]; if(sel){ push(); drag={obj:sel,dx:sel.x-wx,dz:sel.z-wz}; } upd(); return; }
  if(tool==='wall'){ wallPts.push([x,z]); draw(); return; }
  if(tool==='road'||tool==='zone'){ drag={rect:[x,z,x,z]}; return; }
  push();
  if(tool==='plot'){ const id=zoneAt(x,z); if(!id){ alert('Участок можно ставить только внутри зоны (голая земля/заросшая)'); undo.pop(); return; } M.plots.push(sel={x,z,zone:id}); }
  else if(tool==='tree') M.trees.push(sel={x,z,t:e.shiftKey?'pine':'round'});
  else if(tool==='lamp') M.lamps.push(sel={x,z});
  else if(tool==='gate') M.gates.push(sel={x,z,w:6});
  else if(tool.startsWith('b:')) M.buildings.push(sel={type:tool.slice(2),x,z,rot:0});
  upd(); };
onmousemove=e=>{ if(!drag) return;
  if(drag.pan){ view.x=drag.vx-(e.clientX-drag.px)/view.s; view.z=drag.vz-(e.clientY-drag.py)/view.s; draw(); return; }
  const [wx,wz]=S2W(e.clientX,e.clientY);
  if(drag.obj){ drag.obj.x=snap(wx+drag.dx); drag.obj.z=snap(wz+drag.dz); draw(); }
  if(drag.rect){ drag.rect[2]=snap(wx); drag.rect[3]=snap(wz); draw(); } };
onmouseup=()=>{ if(drag&&drag.rect){ const r=drag.rect, w=Math.abs(r[2]-r[0]), d=Math.abs(r[3]-r[1]);
    if(w>=1&&d>=1){ push(); const o={x:(r[0]+r[2])/2,z:(r[1]+r[3])/2,w,d};
      if(tool==='road') M.roads.push(sel=o); else { let n=1; while(M.zones.some(q=>q.id==='Z'+n)) n++; Object.assign(o,{id:'Z'+n,type:zt,name:'Зона Z'+n,price:zt==='bare'?0:300,order:zt==='wild'?1+Math.max(0,...M.zones.map(q=>q.order|0)):0}); M.zones.push(sel=o); } } }
  if(drag&&(drag.obj||drag.rect)) upd(); drag=null; };
cv.onwheel=e=>{ e.preventDefault(); view.s=Math.min(60,Math.max(3,view.s*(e.deltaY<0?1.15:1/1.15))); draw(); };
onkeydown=e=>{ if(e.target.tagName==='INPUT') return; if(e.code==='Escape'){ tool='sel'; upd(); }
  if(e.ctrlKey&&e.code==='KeyZ'){ if(undo.length){ M=JSON.parse(undo.pop()); sel=null; upd(); } e.preventDefault(); return; }
  if(e.code==='Enter'&&wallPts){ if(wallPts.length>=3){ push(); M.wall.pts=wallPts; } wallPts=[]; upd(); return; }
  if(!sel) return;
  if(e.code==='KeyR'){ push(); if('rot' in sel) sel.rot=((sel.rot||0)+90)%360; else if('w' in sel&&'d' in sel){ [sel.w,sel.d]=[sel.d,sel.w]; } upd(); }
  if(e.code==='Delete'||e.code==='Backspace'){ push(); const it=items().find(i=>i[1]===sel); it[0].splice(it[0].indexOf(sel),1);
    if(sel.id&&sel.type in ZC) M.plots=M.plots.filter(p=>p.zone!==sel.id); sel=null; upd(); } };
$('bNew').onclick=()=>{ push(); M=clone(BLANK); sel=null; upd(); };
$('bLoad').onclick=()=>{ const k=$('edload').value, m=MapStore.get(k); if(!m) return; push(); M=m; name=k.startsWith('lib:')?k.slice(4):(m.name||'Карта')+' (копия)'; sel=null; upd(); fillLoad(); };
$('bSaveAs').onclick=()=>{ const n=prompt('Имя карты:',name); if(!n) return; name=n.trim(); upd(); fillLoad(); };
$('bDelete').onclick=()=>{ const k=$('edload').value; if(!k.startsWith('lib:')){ alert('Файловые карты удаляются из папки maps/'); return; } if(!confirm('Удалить '+k.slice(4)+'?')) return; const l=MapStore.lib(); delete l[k.slice(4)]; MapStore.saveLib(l); if(k.slice(4)===name) localStorage.removeItem('cg_mapedit'); fillLoad(); };
$('bClose').onclick=()=>location.reload();
$('bImp').onclick=()=>$('edfile').click();
$('edfile').onchange=e=>{ const f=e.target.files[0]; if(!f) return; f.text().then(t=>{ try{ const j=JSON.parse(t.slice(t.indexOf('{'),t.lastIndexOf('}')+1)); if(!j.buildings) throw 0; push(); M=MapStore.norm(j); name=j.name||f.name.replace(/\.\w+$/,''); sel=null; upd(); }catch(_){ alert('Не удалось прочитать карту'); } }); e.target.value=''; };
const fid=()=>name.toLowerCase().replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'map';
const exportText=()=>`// Карта кладбища «${name}». Положите в maps/ и добавьте '${fid()}' в maps/index.js\nCEMETERY_MAPS.register('${fid()}',`+JSON.stringify(M)+');\n';
$('bExp').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([exportText()],{type:'text/javascript'})); a.download=fid()+'.js'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };
$('bPlay').onclick=()=>{ save(); localStorage.setItem('cg_mapsel','lib:'+name); sessionStorage.setItem('cg_autostart','1'); location.reload(); };
window.CGED={get map(){return M;}, exportText, hit};
$('zord').onchange=()=>{ push(); sel.order=Math.max(0,$('zord').value|0); upd(); }; $('zpr').onchange=()=>{ push(); sel.price=Math.max(0,$('zpr').value|0); upd(); };
onresize=draw; fillLoad(); upd();
}
// экран заголовка: выбор карты + кнопка редактора
(()=>{ const s=document.getElementById('mapsel'); if(!s) return; s.innerHTML=MapStore.list().map(k=>`<option value="${k}">${MapStore.label(k)}</option>`).join(''); s.value=MapStore.sel();
  s.onchange=()=>{ localStorage.setItem('cg_mapsel',s.value); location.reload(); };
  document.getElementById('edbtn').onclick=openEditor; })();
