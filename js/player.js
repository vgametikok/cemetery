(function(){
// Игрок: FPS-камера, движение, коллизии, модель инструмента в руках
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 200);
const player = { pos:new THREE.Vector3(0,1.7,14), yaw:0, pitch:0, hp:400, maxHp:400, speed:6, slow:0, tool:'shovel', carrying:null, trash:null };
const shovel=new THREE.Group(), gun=new THREE.Group();
function initPlayer(scene){
  scene.add(camera);
  cyl(0.03,0.03,1,mats.wood,0,0,0,shovel); box(0.22,0.28,0.03,mats.metal,0,-0.6,0,shovel);
  shovel.position.set(0.45,-0.35,-0.7); shovel.rotation.set(-0.6,0,0.3);
  box(0.1,0.14,0.45,mats.dark,0,0,0,gun); box(0.08,0.2,0.1,mats.wood,0,-0.12,0.15,gun);
  gun.position.set(0.3,-0.25,-0.55);
  camera.add(shovel); camera.add(gun); setTool('shovel');
}
function setTool(t){ player.tool=t; shovel.visible=t==='shovel'; gun.visible=t==='gun'; }
let bob=0;
function kick(){ gun.position.z=-0.45; }
function swing(dt){ bob+=dt*10; shovel.rotation.x=-0.6+Math.sin(bob)*0.4; }
function updatePlayer(dt){
  const sens=0.0025; player.yaw-=input.lookX*sens; player.pitch-=input.lookY*sens; input.lookX=input.lookY=0;
  player.pitch=Math.max(-1.4,Math.min(1.4,player.pitch));
  player.slow=Math.max(0,player.slow-dt);
  const sp=player.speed*(player.slow>0?0.5:1)*(player.carrying?1/1.5:1)*((input.sprint||input.runToggle)&&!player.carrying&&!player.pushing?1.4:1);
  const f=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)), r=new THREE.Vector3(-f.z,0,f.x);
  const mv=f.multiplyScalar(input.my).add(r.multiplyScalar(input.mx)); if(mv.lengthSq()>1) mv.normalize();
  const p=player.pos; p.x+=mv.x*sp*dt; p.z+=mv.z*sp*dt;
  p.x=Math.max(-HX-10,Math.min(HX+10,p.x)); p.z=Math.max(-HZ-10,Math.min(HZ+10,p.z));
  for(const c of colliders){ if(c.off) continue;
    if(c.r!==undefined){ const dx=p.x-c.x, dz=p.z-c.z, d=Math.hypot(dx,dz), m=c.r+0.4; if(d<m&&d>0){ p.x=c.x+dx/d*m; p.z=c.z+dz/d*m; } }
    else if(p.x>c.minX-0.4&&p.x<c.maxX+0.4&&p.z>c.minZ-0.4&&p.z<c.maxZ+0.4){
      const o=[p.x-(c.minX-0.4),(c.maxX+0.4)-p.x,p.z-(c.minZ-0.4),(c.maxZ+0.4)-p.z], i=o.indexOf(Math.min(...o));
      if(i===0)p.x=c.minX-0.4; else if(i===1)p.x=c.maxX+0.4; else if(i===2)p.z=c.minZ-0.4; else p.z=c.maxZ+0.4; }
  }
  camera.position.copy(p); camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
  gun.position.z+=(-0.55-gun.position.z)*Math.min(1,dt*12);
  if(player.trash){ player.trash.position.set(p.x-Math.sin(player.yaw-0.5)*0.9,0.8,p.z-Math.cos(player.yaw-0.5)*0.9); }
  if(player.carrying){ const c=player.carrying; c.position.set(p.x-Math.sin(player.yaw)*1.3,0.9,p.z-Math.cos(player.yaw)*1.3); c.rotation.y=player.yaw; }
}
function forwardPoint(d){ return new THREE.Vector3(player.pos.x-Math.sin(player.yaw)*d,0,player.pos.z-Math.cos(player.yaw)*d); }

Object.assign(window,{camera,player,initPlayer,setTool,kick,swing,updatePlayer,forwardPoint});
})();
