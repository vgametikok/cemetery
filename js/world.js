(function(){
// Сцена и карта кладбища по референсу (вид сверху, ворота внизу по центру = +Z)
const scene = new THREE.Scene();
// Карта: js/map.js (window.CEMETERY_MAP) или из редактора (index.html?map=local → localStorage)
let MAP=window.CEMETERY_MAP;
const bget=t=>MAP.buildings.filter(b=>b.type===t);
const bpos=(t,dx,dz)=>{ const b=bget(t)[0]; return b?new THREE.Vector3(b.x,0,b.z):(dx===undefined?null:new THREE.Vector3(dx,0,dz)); };
const WP=(MAP.wall&&MAP.wall.pts&&MAP.wall.pts.length>1)?MAP.wall.pts:[[-38,-26],[38,-26],[38,26],[-38,26]];
const HX=Math.max(...WP.map(p=>Math.abs(p[0]))), HZ=Math.max(...WP.map(p=>Math.abs(p[1]))), HALF=HZ;
if(!bget('office').length) console.warn('На карте нет офиса — ставлю по умолчанию');
const BUILDING = bpos('office',0,-5);
const DROP = bpos('drop',BUILDING.x-5,BUILDING.z+6);
const CONTAINER = bpos('bin',-6,HZ+3.5);
const BIN_CAP = 10;
const houseBox = {minX:BUILDING.x-6.2,maxX:BUILDING.x+6.2,minZ:BUILDING.z-3.7,maxZ:BUILDING.z+3.7};
const solids = [houseBox];  // здания: нежить их не проходит
const hpBar = {}, binFill = {}, medkits=[];
const MEDCAB = new THREE.Vector3(BUILDING.x+4.5,0,BUILDING.z-2.1);
const colliders = [];      // {x,z,r} или box {minX,maxX,minZ,maxZ}
const M = c => new THREE.MeshLambertMaterial({ color:c });
const mats = { stone:M(0x888890), dark:M(0x555560), dirt:M(0x5a3d22), hole:M(0x1a120a), wood:M(0x7a5230), metal:M(0x9aa0a8), grass:M(0x4a6b35), locked:M(0x3d5a2a), roof:M(0x5a2a2a), tuft:M(0x6a8a30), trash:M(0x333333), paper:M(0xbbbbaa), gold:M(0xc8a040),
  road:M(0x8a7050), bare:M(0x6b4a2c), wild:M(0x3f5f2c), brick:M(0x8a4a35), wall:M(0x7d7d78), bush:M(0x2f5a28), slate:M(0x4a5866), angel:M(0xb8b8b0) };
function sign(text,w,h,x,y,z,parent=scene,rotY=0){ const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d'); g.fillStyle='#3a2a1a'; g.fillRect(0,0,256,64); g.strokeStyle='#c8a050'; g.lineWidth=6; g.strokeRect(3,3,250,58); g.fillStyle='#f0e0b0'; g.font='bold 40px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,34);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,0.08),[mats.wood,mats.wood,mats.wood,mats.wood,new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(c)}),mats.wood]); m.position.set(x,y,z); m.rotation.y=rotY; parent.add(m); return m; }
function box(w,h,d,mat,x=0,y=0,z=0,parent=scene){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; parent.add(m); return m; }
function cyl(rt,rb,h,mat,x=0,y=0,z=0,parent=scene,seg=10){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m; }
const addBox=(x,z,w,d)=>{ const b={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}; colliders.push(b); return b; };
const flat=(w,d,mat,x,z,y=0.02)=>{ const m=box(w,0.04,d,mat,x,y,z); m.castShadow=false; m.renderOrder=1; return m; };
function bush(x,z,s=1){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.7*s,7,5),mats.bush); m.position.set(x,0.5*s,z); m.scale.y=0.75; m.castShadow=true; scene.add(m); return m; }
function tree(x,z){ const h=2.5+Math.random()*1.5; cyl(0.2,0.3,h,mats.wood,x,h/2,z); const c=new THREE.Mesh(new THREE.SphereGeometry(1.3+Math.random()*0.6,7,6),M(0x3d6630)); c.position.set(x,h+0.8,z); c.castShadow=true; scene.add(c); colliders.push({x,z,r:0.45}); }
function oldStone(x,z){ const m=box(0.7,0.9,0.18,mats.stone,x,0.4,z); m.rotation.z=(Math.random()-0.5)*0.4; m.rotation.y=(Math.random()-0.5)*0.4; }

const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
const amb = new THREE.HemisphereLight(0xcfe0ff, 0x404030, 0.8);
const lamps = [];
// Зоны: plots — участки под могилы; остальное — особые объекты
const sections = (MAP.zones||[]).map(z=>({ id:z.id, name:z.name||z.id, type:z.type, kind:(z.type==='bare'||z.type==='wild')?'plots':z.type, order:z.order|0, unlocked:(z.type==='bare'||z.type==='wild')&&!(z.order|0), price:z.price||0, cx:z.x, cz:z.z, w:z.w, d:z.d }));
if(bget('morgue').length){ const m=bget('morgue')[0]; sections.push({ id:'morgue', name:'Морг', kind:'morgue', unlocked:false, price:1000, cx:m.x, cz:m.z, w:8, d:6 }); }
let roads=[];
const CREMB = bpos('crem'); const CREM_DOOR = CREMB?new THREE.Vector3(CREMB.x,0,CREMB.z+4.5):new THREE.Vector3(1e4,0,1e4);
function buildWorld(){
  scene.add(amb); sun.position.set(30,60,20); sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-50,right:50,top:40,bottom:-40}); sun.shadow.mapSize.set(2048,2048); scene.add(sun);
  scene.fog = new THREE.Fog(0xbfd0e0, 40, 110);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(220,200), mats.grass); g.rotation.x=-Math.PI/2; g.receiveShadow=true; g.renderOrder=1; scene.add(g);
  // земля зон
  for(const s of sections) if(s.kind==='plots'||s.kind==='crem'||s.kind==='altar') flat(s.w,s.d, s.type==='bare'?mats.bare:s.kind==='altar'?M(0x55704a):mats.wild, s.cx,s.cz,0.015);
  // грунтовые дороги: от ворот к офису, кольцо и ответвления ко всем зонам
  roads=(MAP.roads||[]).map(r=>[r.x,r.z,r.w,r.d]);
  roads.forEach(([x,z,w,d])=>flat(w,d,mats.road,x,z,0.03));
  // каменная стена по периметру, ворота внизу по центру
  const WH=1.8, T=0.6, wm=mats.wall, gates=MAP.gates||[];
  // стена-полилиния: куски ~1 м (коллизии AABB), в местах ворот — проём
  for(let i=0;i<WP.length;i++){ const [x1,z1]=WP[i], [x2,z2]=WP[(i+1)%WP.length], L=Math.hypot(x2-x1,z2-z1), n=Math.max(1,Math.round(L)), ang=Math.atan2(z2-z1,x2-x1);
    for(let k=0;k<n;k++){ const t=(k+0.5)/n, x=x1+(x2-x1)*t, z=z1+(z2-z1)*t;
      const g=gates.find(g=>Math.hypot(x-g.x,z-g.z)<(g.w||6)/2); if(g) continue;
      const m=box(L/n+0.05,WH,T,wm,x,WH/2,z); m.rotation.y=-ang; const hw=Math.abs(Math.cos(ang))*L/n/2+T/2, hd=Math.abs(Math.sin(ang))*L/n/2+T/2; colliders.push({minX:x-hw,maxX:x+hw,minZ:z-hd,maxZ:z+hd}); } }
  for(const g of gates) for(const sx of [-1,1]){ const p=box(0.9,2.6,0.9,wm,g.x+sx*((g.w||6)/2+0.3)*(Math.abs(g.z)>=Math.abs(g.x)*HZ/HX?1:0),1.3,g.z+sx*((g.w||6)/2+0.3)*(Math.abs(g.z)>=Math.abs(g.x)*HZ/HX?0:1)); }
  // деревья из карты
  for(const t of MAP.trees||[]){ if(t.t==='pine'){ cyl(0.25,0.35,3,mats.wood,t.x,1.5,t.z); const c=new THREE.Mesh(new THREE.ConeGeometry(2,4.5,7),M(0x2a4524)); c.position.set(t.x,4.2,t.z); c.castShadow=true; scene.add(c); colliders.push({x:t.x,z:t.z,r:0.45}); }
    else if(t.t==='willow'){ cyl(0.35,0.45,3,mats.wood,t.x,1.5,t.z); const c=new THREE.Mesh(new THREE.SphereGeometry(2.2,8,6),M(0x5f8a3a)); c.position.set(t.x,4,t.z); c.scale.y=1.2; scene.add(c); colliders.push({x:t.x,z:t.z,r:0.6}); }
    else tree(t.x,t.z); }
  {
  // главное здание: полое, с дверным проёмом (юг), по стенам — коллизии
  const b=new THREE.Group(); b.position.copy(BUILDING); scene.add(b);
  const wm=M(0x9a8f80), W=12, D=7, H=5, T=0.3, DOOR=1.3;
  const wall=(w,d,x,z)=>{ box(w,H,d,wm,x,H/2,z,b); colliders.push({minX:BUILDING.x+x-w/2,maxX:BUILDING.x+x+w/2,minZ:BUILDING.z+z-d/2,maxZ:BUILDING.z+z+d/2}); };
  wall(W,T,0,-D/2); wall(T,D,-W/2,0); wall(T,D,W/2,0);
  const sw=(W/2-DOOR); wall(sw,T,-(DOOR+sw/2),D/2); wall(sw,T,DOOR+sw/2,D/2);
  box(DOOR*2,H-3,T,wm,0,3+(H-3)/2,D/2,b); // перемычка над дверью
  box(W,0.05,D,M(0x6b5a48),0,0.03,0,b);   // пол
  box(W+0.4,0.2,D+0.4,mats.roof,0,H+0.1,0,b); // потолок
  const roof=cyl(0,6.5,3,mats.roof,0,6.6,0,b,4); roof.rotation.y=Math.PI/4; roof.scale.z=0.6;
  box(0.4,1.6,0.4,mats.wood,0,8.9,0,b); box(1.4,0.4,0.4,mats.wood,0,9.2,0,b);
  box(2.5,1,1,mats.wood,-3,0.5,-2.5,b); colliders.push({minX:BUILDING.x-4.25,maxX:BUILDING.x-1.75,minZ:BUILDING.z-3,maxZ:BUILDING.z-2}); // стол
  box(1,2,0.6,mats.dark,4.5,1,-2.9,b); box(0.9,0.05,0.4,mats.metal,4.5,1.2,-2.65,b);
  for(let i=0;i<3;i++){ const k=box(0.25,0.18,0.18,M(0xf0f0f0),4.2+i*0.3,1.32,-2.6,b); box(0.12,0.04,0.19,M(0xdd2222),0,0,0.005,k); box(0.04,0.12,0.19,M(0xdd2222),0,0,0.005,k); medkits.push(k); }
  addBox(BUILDING.x+4.5,BUILDING.z-2.9,1,0.6);
  // компьютер на столе
  box(0.9,0.6,0.08,mats.dark,-3,1.35,-2.6,b); const scr=box(0.8,0.5,0.02,new THREE.MeshBasicMaterial({color:0x3a7acc}),-3,1.35,-2.55,b); scr.castShadow=false;
  box(0.1,0.25,0.1,mats.dark,-3,1.1,-2.65,b); box(0.7,0.04,0.25,mats.dark,-3,1.02,-2.2,b); box(0.5,0.9,0.5,mats.wood,-3,0.45,-1.4,b); // клавиатура, стул
  // декор офиса: окна, рама двери, крыльцо, перила, фонари, вывеска, труба
  const glass=new THREE.MeshLambertMaterial({color:0x9ec8e8,emissive:0x203040}), frame=mats.wood;
  for(const x of [-4,4]){ box(1.6,1.2,0.08,glass,x,2.4,D/2+0.12,b); box(1.8,0.12,0.15,frame,x,1.75,D/2+0.15,b); box(1.8,0.12,0.15,frame,x,3.05,D/2+0.15,b); box(0.08,1.2,0.14,frame,x,2.4,D/2+0.16,b); }
  for(const z of [-1.5,1.5]) for(const sx of [-1,1]) box(0.08,1.2,1.3,glass,sx*(W/2+0.12),2.4,z,b);
  for(const x of [-1.4,1.4]) box(0.2,3.2,0.2,frame,x,1.6,D/2+0.18,b); box(3,0.25,0.2,frame,0,3.1,D/2+0.18,b);
  box(W,0.15,2.2,mats.wood,0,0.08,D/2+1.1,b); // крыльцо
  for(const x of [-W/2+0.2,-1.6,1.6,W/2-0.2]){ box(0.18,2.8,0.18,frame,x,1.4,D/2+2.05,b); }
  box(W+0.6,0.15,2.6,mats.roof,0,2.9,D/2+1.2,b); // навес
  for(const sx of [-1,1]){ box(W/2-1.8,0.08,0.08,frame,sx*(W/4+0.9),0.9,D/2+2.05,b); for(let x=1.8;x<W/2;x+=0.6) box(0.05,0.8,0.05,frame,sx*x,0.5,D/2+2.05,b); }
  for(const x of [-1.9,1.9]){ box(0.25,0.35,0.25,new THREE.MeshLambertMaterial({color:0xffd080,emissive:0x664410}),x,2.2,D/2+0.3,b); }
  sign('ОФИС',2.4,0.6,0,3.55,D/2+0.3,b);
  box(0.8,2.5,0.8,mats.brick,4,6,-1.5,b);
  const il=new THREE.PointLight(0xffe0b0,8,12); il.position.set(0,4,0); b.add(il);
  // полоса HP над зданием
  hpBar.bg=new THREE.Mesh(new THREE.PlaneGeometry(6,0.5),new THREE.MeshBasicMaterial({color:0x330000,side:THREE.DoubleSide}));
  hpBar.fg=new THREE.Mesh(new THREE.PlaneGeometry(6,0.5),new THREE.MeshBasicMaterial({color:0x30d040,side:THREE.DoubleSide}));
  hpBar.g=new THREE.Group(); hpBar.g.add(hpBar.bg); hpBar.fg.position.z=0.01; hpBar.g.add(hpBar.fg); hpBar.g.position.set(BUILDING.x,11,BUILDING.z); scene.add(hpBar.g);
  }
  // мусорный контейнер снаружи (заполнение видно сверху)
  const cg=new THREE.Group(); cg.position.copy(CONTAINER); scene.add(cg);
  box(2.4,1.3,1.4,M(0x2f6a3a),0,0.65,0,cg); box(2.5,0.12,1.5,M(0x1f4a28),0,1.36,-0.75,cg).rotation.x=-1.2;
  binFill.m=box(2.2,1.1,1.2,mats.trash,0,0.1,0,cg); binFill.m.scale.y=0.01;
  addBox(CONTAINER.x,CONTAINER.z,2.4,1.4);
  // фонари
  // фонари вдоль дорог: PointLight без теней (≤8 шт. ради мобильных)
  (MAP.lamps||[]).forEach(({x,z},i)=>{ cyl(0.08,0.1,3,mats.dark,x,1.5,z); box(0.5,0.08,0.5,mats.dark,x,3.35,z);
    const bulb=box(0.3,0.35,0.3,new THREE.MeshLambertMaterial({color:0xffe0a0,emissive:0x000000}),x,3.1,z); bulb.castShadow=false;
    if(i>=8) return; // не больше 8 источников света (мобильные)
    const l=new THREE.PointLight(0xffc070,0,20,1.3); l.position.set(x,2.9,z); l.castShadow=false; l.userData.bulb=bulb; scene.add(l); lamps.push(l); });
  flat(3,3,M(0x777766),DROP.x,DROP.z,0.04);
  if(CREMB) buildCrem(); bget('colum').forEach(buildColum); bget('altar').forEach(b=>buildAltar(b.x,b.z)); if(bget('morgue').length) buildMorgue();
}
// Старый крематорий (кирпич, труба), заросший; стены колумбария
function buildCrem(){
  const x=CREMB.x,z=CREMB.z, w=7, d=6, h=3.6;
  box(w,h,d,mats.brick,x,h/2,z); const r=cyl(0,5.2,2,mats.slate,x,h+1,z,scene,4); r.rotation.y=Math.PI/4; r.scale.z=0.85;
  box(1,4,1,mats.brick,x+2.2,h+2,z-1.5); box(1.3,0.3,1.3,mats.stone,x+2.2,h+4.1,z-1.5); box(1.3,0.2,1.3,mats.stone,x+2.2,h+1.2,z-1.5);
  for(let i=0;i<4;i++) box(w+0.05,0.1,d+0.05,M(0x6a3525),x,0.6+i*0.9,z); // кирпичные пояса
  for(const sx of [-2.2,2.2]){ box(1,1.2,0.1,M(0x221a14),x+sx,2,z+d/2+0.05); for(const r of [-0.3,0.3]){ const p=box(1.2,0.15,0.08,mats.wood,x+sx,2+r,z+d/2+0.12); p.rotation.z=r; } } // заколоченные окна
  box(2,0.25,0.3,mats.stone,x,1.6,z+d/2+0.1); for(const sx of [-0.9,0.9]) box(0.2,1.6,0.3,mats.stone,x+sx,0.8,z+d/2+0.1); box(1.6,1.2,0.2,M(0x221a14),x,0.9,z+d/2+0.05);
  const b={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}; colliders.push(b); solids.push(b);

  for(let i=0;i<14;i++) bush(x+(Math.random()-0.5)*12, z+(Math.random()-0.5)*10, 0.7+Math.random()*0.6);
  // плющ на стенах
  for(let i=0;i<6;i++) box(1.2,1.6,0.1,mats.bush,x-2.5+i*1,1.5+Math.random(),z-d/2-0.06);
}
function buildColum(b){ const rot=((b.rot||0)%180)?Math.PI/2:0; const c=box(3,2.4,0.8,mats.stone,b.x,1.2,b.z); c.rotation.y=rot;
  for(let i=0;i<3;i++) for(let j=0;j<2;j++) box(0.6,0.5,0.1,mats.dark,(i-1)*0.9,0.4-j*0.8+0.2,0.42,c);
  addBox(b.x,b.z,rot?0.8:3,rot?3:0.8); }
// Алтарь: плачущий ангел и 16 камней с выемкой посередине
function buildAltar(cx,cz){
  box(3,0.6,3,mats.stone,cx,0.3,cz); cyl(0.9,1.1,1.2,mats.stone,cx,1.2,cz);
  const a=new THREE.Group(); a.position.set(cx,1.8,cz); scene.add(a);
  box(0.7,1.6,0.5,mats.angel,0,0.8,0,a); box(0.4,0.4,0.4,mats.angel,0,1.85,0.1,a);
  for(const s of [-1,1]){ const wg=box(0.15,1.6,1,mats.angel,s*0.5,1.2,-0.3,a); wg.rotation.y=s*0.5; }
  box(0.5,0.15,0.4,mats.angel,0,1.7,0.35,a); // руки у лица
  colliders.push({x:cx,z:cz,r:1.8});
  for(let i=0;i<16;i++){ const ang=i/16*Math.PI*2, r=i%2?7:5.2, x=cx+Math.cos(ang)*r, z=cz+Math.sin(ang)*r;
    const st=new THREE.Group(); st.position.set(x,0,z); st.rotation.y=-ang+Math.PI/2; scene.add(st);
    box(0.35,1.3,0.35,mats.stone,-0.4,0.65,0,st); box(0.35,1.3,0.35,mats.stone,0.4,0.65,0,st); box(1.15,0.35,0.35,mats.stone,0,1.25,0,st); box(1.15,0.3,0.35,mats.stone,0,0.15,0,st); // выемка в середине
    colliders.push({x,z,r:0.6}); }
}
// Морг у ворот
// Морг: полое здание с дверью (запирается) и 3 столами под гробы
const MB=bget('morgue')[0]; const MORGUE={ x:MB?MB.x:1e4, z:MB?MB.z:1e4, w:8, d:6, locked:true, tables:[], doorPt:new THREE.Vector3(1e4,0,1e4), outPt:new THREE.Vector3(1e4,0,1e4), inner:{minX:1e4,maxX:1e4,minZ:1e4,maxZ:1e4}, box:{minX:1e4,maxX:1e4,minZ:1e4,maxZ:1e4} };
function buildMorgue(){
  const {x,z,w,d}=MORGUE, H=3.2, T=0.25, DW=0.9, wm=M(0x8a96a6);
  const wall=(ww,dd,cx,cz)=>{ box(ww,H,dd,wm,cx,H/2,cz); addBox(cx,cz,ww,dd); };
  wall(w,T,x,z-d/2); wall(T,d,x-w/2,z); wall(T,d,x+w/2,z);
  const sw=w/2-DW; wall(sw,T,x-DW-sw/2,z+d/2); wall(sw,T,x+DW+sw/2,z+d/2); box(DW*2,H-2.4,T,wm,x,2.4+(H-2.4)/2,z+d/2);
  box(w,0.05,d,M(0xb8c0c8),x,0.03,z).renderOrder=1; box(w+0.3,0.2,d+0.3,mats.slate,x,H+0.1,z);
  const r=cyl(0,w*0.75,1.6,mats.slate,x,H+1,z,scene,4); r.rotation.y=Math.PI/4; r.scale.z=d/w;
  // дверь на петле + коллизия, пока заперто
  const hinge=new THREE.Group(); hinge.position.set(x-DW,0,z+d/2); scene.add(hinge); box(DW*2,2.3,0.1,M(0x3a4048),DW,1.15,0,hinge);
  MORGUE.door=hinge; MORGUE.doorBox={minX:x-DW,maxX:x+DW,minZ:z+d/2-0.15,maxZ:z+d/2+0.15}; colliders.push(MORGUE.doorBox);
  MORGUE.doorPt=new THREE.Vector3(x,0,z+d/2); MORGUE.outPt=new THREE.Vector3(x,0,z+d/2+1.6);
  MORGUE.inner={minX:x-w/2+0.5,maxX:x+w/2-0.5,minZ:z-d/2+0.5,maxZ:z+d/2-0.5};
  for(const sx of [-1,1]) box(0.15,2.6,0.2,mats.stone,x+sx*(DW+0.08),1.3,z+d/2+0.1); box(DW*2+0.4,0.2,0.22,mats.stone,x,2.6,z+d/2+0.1);
  sign('МОРГ',1.8,0.5,x,2.95,z+d/2+0.2); box(3,0.15,1.2,mats.stone,x,0.08,z+d/2+0.7);
  for(const sz of [-1.3,1.3]) box(0.08,0.8,1,new THREE.MeshLambertMaterial({color:0x9ec8e8}),x+w/2+0.1,1.8,z+sz);
  box(0.25,0.35,0.25,new THREE.MeshLambertMaterial({color:0xffd080,emissive:0x664410}),x+1.4,2.1,z+d/2+0.2); box(0.6,1.4,0.6,mats.stone,x-2.5,H+1.2,z-1.5);
  // столы
  for(const tx of [-2.6,0,2.6]){ const t={x:x+tx,z:z-0.8,coffin:null}; box(1.0,0.08,2.2,mats.metal,t.x,0.85,t.z); for(const [lx,lz] of [[-0.4,-0.95],[0.4,-0.95],[-0.4,0.95],[0.4,0.95]]) box(0.07,0.85,0.07,mats.dark,t.x+lx,0.42,t.z+lz);
    addBox(t.x,t.z,1.0,2.2); MORGUE.tables.push(t); }
  const l=new THREE.PointLight(0xd0e8ff,6,10); l.position.set(x,2.8,z); scene.add(l);
  const b={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}; solids.push(b); MORGUE.box=b;
}
function setMorgueLock(v){ MORGUE.locked=v; if(!MORGUE.door) return; MORGUE.doorBox.off=!v; MORGUE.door.rotation.y=v?0:-1.6; }
// Тележка для гробов
function makeCart(){ const g=new THREE.Group(); scene.add(g);
  box(0.9,0.08,2.1,mats.wood,0,0.6,0,g); box(0.06,0.2,2.1,mats.wood,-0.45,0.72,0,g); box(0.06,0.2,2.1,mats.wood,0.45,0.72,0,g);
  for(const [x,z] of [[-0.5,0.7],[0.5,0.7],[-0.5,-0.7],[0.5,-0.7]]){ const w=cyl(0.25,0.25,0.08,mats.dark,x,0.25,z,g,12); w.rotation.z=Math.PI/2; }
  for(const x of [-0.35,0.35]) box(0.05,0.05,0.6,mats.metal,x,0.9,1.3,g); box(0.8,0.06,0.06,mats.metal,0,0.92,1.6,g); // ручка
  return g; }
// Декор заросших зон: кусты и старые надгробия по краям
function buildWild(){
  for(const s of sections){ if(s.kind!=='plots'||s.type==='bare') continue;
    for(let i=0;i<10;i++){ const t=Math.random(); const edge=i%2; const x=s.cx+(edge?(Math.random()-0.5)*s.w:(Math.random()<0.5?-1:1)*(s.w/2-0.8)); const z=s.cz+(edge?(Math.random()<0.5?-1:1)*(s.d/2-0.6):(Math.random()-0.5)*s.d);
      t<0.6?bush(x,z,0.6+Math.random()*0.5):oldStone(x,z); } }
  // голая земля: кучи земли, тачка, лопата
  for(const s of sections.filter(s=>s.type==='bare')){ for(const [fx,fz] of [[-0.42,-0.5],[0.4,-0.5],[-0.42,0.5]]){ const m=new THREE.Mesh(new THREE.SphereGeometry(0.9,7,5),mats.dirt); m.position.set(s.cx+fx*s.w,0.1,s.cz+fz*s.d); m.scale.y=0.5; scene.add(m); }
    box(0.8,0.4,1.3,mats.metal,s.cx+s.w/2-2,0.5,s.cz+s.d/2-1); }
}
// Участки под могилы
const plots = [];
function buildPlots(){
  for(const q of MAP.plots||[]){ const sec=sections.find(s=>s.id===q.zone&&s.kind==='plots'); if(!sec) continue; const {x,z}=q;
      const patch=box(1.6,0.06,2.6, sec.unlocked?mats.dirt:mats.locked, x,0.04,z); patch.castShadow=false; patch.renderOrder=1;
      const p={ x,z,sec, state:'empty', dig:0, patch, objs:[], hp:0, chunks:[] }; plots.push(p);
      if(!sec.unlocked) for(let i=0;i<2;i++) for(let j=0;j<3;j++) buildChunk(p,x-0.4+i*0.8,z-0.87+j*0.87); // 6 кусков ~ пол-гроба
  }
}
function finishWorld(){ buildWild(); }
function unlockSection(s){ s.unlocked=true; plots.filter(p=>p.sec===s).forEach(setPatch); }
const chunks=[];
const typeMat={};
function buildChunk(p,x,z){
  const r=Math.random(), type=r<0.55?'grass':r<0.8?'trash':'branch', g=new THREE.Group(); g.position.set(x,0,z); scene.add(g);
  if(type==='grass') for(let i=0;i<5;i++){ const c=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.5+Math.random()*0.4,4),mats.tuft); c.position.set((Math.random()-0.5)*0.6,0.3,(Math.random()-0.5)*0.6); g.add(c); }
  else if(type==='trash'){ for(let i=0;i<3;i++){ const m=box(0.25+Math.random()*0.2,0.2,0.25,i%2?mats.trash:mats.paper,(Math.random()-0.5)*0.4,0.1+i*0.12,(Math.random()-0.5)*0.4,g); m.rotation.y=Math.random()*3; } }
  else for(let i=0;i<3;i++){ const m=cyl(0.04,0.05,0.9,mats.wood,0,0.08,0,g,5); m.rotation.set(Math.PI/2,0,Math.random()*3); m.position.x=(Math.random()-0.5)*0.4; }
  const ch={x,z,type,g,plot:p,cleared:false,prog:0}; chunks.push(ch); p.chunks.push(ch);
}
// Яма: внутренность (BackSide) рисуется первой, маска пишет только глубину и «вырезает» землю
const pitMat=new THREE.MeshLambertMaterial({color:0x2a1a0c,side:THREE.BackSide}), maskMat=new THREE.MeshBasicMaterial({colorWrite:false});
function updatePit(p){
  if(!p.pit){ const g=new THREE.Group(); g.position.set(p.x,0,p.z); scene.add(g);
    const pit=new THREE.Mesh(new THREE.BoxGeometry(1.2,1,2.1),pitMat); pit.renderOrder=-2; g.add(pit);
    const mask=new THREE.Mesh(new THREE.PlaneGeometry(1.2,2.1),maskMat); mask.rotation.x=-Math.PI/2; mask.position.y=0.08; mask.renderOrder=-1; g.add(mask);
    const mound=new THREE.Mesh(new THREE.SphereGeometry(0.8,8,6),mats.dirt); mound.position.set(1.25,0,0); mound.castShadow=true; g.add(mound);
    p.pit={g,pit,mound}; }
  const d=Math.max(0.02,p.dig)*1.4; p.pit.pit.scale.y=d; p.pit.pit.position.y=-d/2+0.07;
  const k=Math.max(0.05,p.dig); p.pit.mound.scale.set(k,0.6*k,1.6*k);
}
function removePit(p){ if(p.pit){ scene.remove(p.pit.g); p.pit=null; } }
function setPatch(p){ p.patch.material = !p.sec.unlocked?mats.locked : p.state==='dug'?mats.hole : mats.dirt; }
// Надгробия по уровню здания
function makeStone(p, level){
  p.objs.forEach(o=>scene.remove(o)); p.objs=[];
  const add=o=>{ p.objs.push(o); };
  add(box(1.5,0.25,2.4,mats.dirt,p.x,0.12,p.z));
  if(level<=1){ add(box(0.12,1,0.12,mats.wood,p.x,0.6,p.z-1)); add(box(0.6,0.12,0.12,mats.wood,p.x,0.8,p.z-1)); }
  else if(level===2){ add(box(0.9,1.1,0.2,mats.stone,p.x,0.55,p.z-1.1)); }
  else if(level===3){ add(box(1.1,1.4,0.3,mats.stone,p.x,0.7,p.z-1.1)); add(box(1.2,0.3,0.4,mats.wood,p.x+1.4,0.3,p.z)); }
  else { add(box(1.3,0.3,1.3,mats.stone,p.x,0.15,p.z-1.0)); add(cyl(0.3,0.4,1.8,mats.stone,p.x,1.2,p.z-1.0)); add(new THREE.Mesh(new THREE.SphereGeometry(0.35,8,6),mats.gold)); p.objs.at(-1).position.set(p.x,2.3,p.z-1); scene.add(p.objs.at(-1)); }
}
function clearStone(p){ p.objs.forEach(o=>scene.remove(o)); p.objs=[]; }
// Цветная бирка с номером (связь гроб ↔ тело зомби)
// 8 хорошо различимых цветов × 4 формы = 32 уникальные метки (без цифр)
const TAGC=['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6'], TAGS=['circle','square','tri','diamond'];
function tagSprite(n){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const col=TAGC[n%8], sh=TAGS[Math.floor(n/8)%4]; g.fillStyle=col; g.strokeStyle='#fff'; g.lineWidth=4; g.beginPath();
  if(sh==='circle') g.arc(32,32,27,0,7); else if(sh==='square') g.rect(7,7,50,50); else if(sh==='tri'){ g.moveTo(32,4); g.lineTo(60,58); g.lineTo(4,58); g.closePath(); } else { g.moveTo(32,3); g.lineTo(61,32); g.lineTo(32,61); g.lineTo(3,32); g.closePath(); }
  g.fill(); g.stroke();
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false})); sp.scale.set(0.23,0.23,1); sp.renderOrder=5; return sp; }
// Гроб: корпус + крышка на петле (открывается ночью)
function makeCoffin(n){ const g=new THREE.Group(); box(0.7,0.4,1.9,mats.wood,0,0,0,g); box(0.6,0.05,1.8,mats.hole,0,0.19,0,g);
  const hinge=new THREE.Group(); hinge.position.set(-0.35,0.2,0); g.add(hinge); const lid=box(0.72,0.07,1.92,mats.wood,0.36,0.03,0,hinge); box(0.5,0.02,0.3,mats.gold,0,0.045,-0.5,lid);
  const tg=tagSprite(n); tg.position.set(0,0.7,0); g.add(tg); g.userData.lid=hinge; g.userData.tag=tg; scene.add(g); return g; }
function setLid(c,open){ c.userData.lid.rotation.z=open?1.9:0; c.userData.open=open; }
// Тело зомби (лежит), с такой же биркой
function makeBody(n){ const g=new THREE.Group(), m=new THREE.MeshLambertMaterial({color:0x557a44}), cl=new THREE.MeshLambertMaterial({color:0x4a3a2a});
  box(0.6,0.3,1.1,cl,0,0.15,0,g); box(0.38,0.3,0.38,m,0,0.15,-0.8,g); for(const x of [-0.16,0.16]) box(0.2,0.2,0.7,cl,x,0.1,0.85,g);
  const tg=tagSprite(n); tg.position.set(0,0.8,0); g.add(tg); scene.add(g); return g; }
// Торговец с телегой и скелетами-лошадьми (снаружи у ворот)
const MERCHANT=bpos('merchant',5,HZ+5);
function makeMerchant(){ const g=new THREE.Group(); g.position.copy(MERCHANT); scene.add(g); const bone=M(0xe8e4d8);
  box(2.2,0.8,1.4,mats.wood,0,0.9,0,g); box(2.2,0.6,0.08,mats.wood,0,1.6,0.68,g); box(2.2,0.6,0.08,mats.wood,0,1.6,-0.68,g);
  for(const [x,z] of [[-0.7,0.75],[0.7,0.75],[-0.7,-0.75],[0.7,-0.75]]){ const w=cyl(0.45,0.45,0.1,mats.dark,x,0.45,z,g,12); w.rotation.x=Math.PI/2; }
  box(1.4,1.0,1.2,M(0x6a2a5a),0,1.8,0,g); // товар под тканью
  for(const z of [-0.45,0.45]){ const h=new THREE.Group(); h.position.set(-2.8,0,z); g.add(h); // скелет лошади
    box(1.4,0.1,0.1,bone,0,1.2,0,h); for(let i=0;i<5;i++) box(0.05,0.4,0.35,bone,-0.5+i*0.25,1.05,0,h);
    for(const [lx,lz] of [[-0.55,0.12],[-0.55,-0.12],[0.55,0.12],[0.55,-0.12]]) box(0.06,1.1,0.06,bone,lx,0.55,lz,h);
    box(0.1,0.5,0.1,bone,-0.75,1.45,0,h).rotation.z=0.5; box(0.45,0.2,0.2,bone,-1.0,1.65,0,h); box(0.06,0.06,0.22,M(0xff3020),-1.05,1.7,0,h); }
  box(1.6,0.06,0.06,mats.wood,-1.7,0.9,0.45,g); box(1.6,0.06,0.06,mats.wood,-1.7,0.9,-0.45,g);
  const man=new THREE.Group(); man.position.set(1.6,0,1.1); g.add(man); const robe=M(0x3a3048);
  cyl(0.15,0.45,1.5,robe,0,0.75,0,man); box(0.3,0.3,0.3,M(0xc8b090),0,1.65,0,man); const hood=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.6,8),robe); hood.position.y=1.85; man.add(hood);
  return g; }
function makeRemains(type){ const col={ghost:0x99ddff,vampire:0xaa1030,witch:0x66cc44}[type]; const m=new THREE.Mesh(new THREE.OctahedronGeometry(0.25),new THREE.MeshLambertMaterial({color:col,emissive:col,emissiveIntensity:0.6})); m.position.y=0.4; scene.add(m); return m; }
// Освещение день/ночь: t от 0 (день) до 1 (ночь)
const dayFog=new THREE.Color(0xbfd0e0), nightFog=new THREE.Color(0x0a1020);
function applyLight(n,warm=0){
  sun.intensity=1.4*(1-n)+0.12*n; sun.color.setHex(n>0.5?0x8090ff:0xfff0d0); if(warm>0.05) sun.color.lerp(new THREE.Color(0xff8a40),warm);
  amb.intensity=0.8*(1-n)+0.18*n;
  scene.fog.color.copy(dayFog).lerp(nightFog,n); if(warm>0.05) scene.fog.color.lerp(new THREE.Color(0xd08a60),warm*0.5); scene.background=scene.fog.color;
  scene.fog.far=90-60*n; scene.fog.near=30-22*n;
  lamps.forEach(l=>{ l.intensity=n*45; l.userData.bulb&&l.userData.bulb.material.emissive.setHex(n>0.5?0xffc060:0x000000); });
}

Object.assign(window,{MORGUE,setMorgueLock,makeCart,tagSprite,setLid,makeBody,makeMerchant,makeRemains,MERCHANT,medkits,MEDCAB,finishWorld,updatePit,removePit,COMPUTER:new THREE.Vector3(BUILDING.x-3,0,BUILDING.z-1.4),CONTAINER,BIN_CAP,binFill,solids,HX,HZ,CREM_DOOR,unlockSection,houseBox,hpBar,chunks,scene,HALF,BUILDING,DROP,colliders,mats,box,cyl,sun,amb,lamps,buildWorld,plots,sections,buildPlots,setPatch,makeStone,clearStone,makeCoffin,applyLight});
})();
