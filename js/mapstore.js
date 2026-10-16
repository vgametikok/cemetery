// Хранилище карт: файлы maps/*.js + именованная библиотека в localStorage
const MAP_VERSION=1;
const MapStore={
  lib(){ try{ return JSON.parse(localStorage.getItem('cg_maplib'))||{}; }catch(e){ return {}; } },
  saveLib(l){ localStorage.setItem('cg_maplib',JSON.stringify(l)); },
  list(){ return [...CEMETERY_MAP_LIST.filter(n=>CEMETERY_MAPS[n]).map(n=>'file:'+n), ...Object.keys(this.lib()).map(n=>'lib:'+n)]; },
  label(k){ const [t,n]=k.split(/:(.*)/); return t==='file'?((CEMETERY_MAPS[n]||{}).name||n)+' (файл)':n+' (моя)'; },
  get(k){ const [t,n]=(k||'').split(/:(.*)/); const m=t==='lib'?this.lib()[n]:t==='file'?CEMETERY_MAPS[n]:null; return m?this.norm(m):null; },
  // заполняет недостающие поля — старые карты не ломаются после обновлений
  norm(m){ m=JSON.parse(JSON.stringify(m)); const d={version:MAP_VERSION,name:'Карта',wall:{pts:[[-38,-26],[38,-26],[38,26],[-38,26]]},gates:[],roads:[],zones:[],plots:[],buildings:[],trees:[],lamps:[]};
    for(const k in d) if(m[k]==null) m[k]=d[k];
    if(!m.wall.pts||m.wall.pts.length<2) m.wall=d.wall;
    for(const b of m.buildings) b.rot=b.rot||0; for(const z of m.zones){ z.price=z.price||0; z.name=z.name||z.id; }
    if((m.version||1)>MAP_VERSION) console.warn('Карта новее игры — часть данных может игнорироваться');
    m.version=MAP_VERSION; return m; },
  sel(){ return localStorage.getItem('cg_mapsel')||'file:default'; },
};
window.CEMETERY_MAP=MapStore.get(/[?&]map=local/.test(location.search)?'lib:'+localStorage.getItem('cg_mapedit'):MapStore.sel())||MapStore.get('file:default');
