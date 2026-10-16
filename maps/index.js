// Список карт в папке maps/. Добавили файл maps/<имя>.js — допишите имя сюда.
window.CEMETERY_MAP_LIST=['default'];
window.CEMETERY_MAPS={ register(id,m){ this[id]=m; } };
for(const n of CEMETERY_MAP_LIST) document.write('<script src="maps/'+n+'.js"><\/script>');
