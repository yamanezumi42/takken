/* 殻だけをキャッシュしてオフラインで起動できるようにする。
   問題データはここに入れない（IndexedDBにある）。 */
var V='takken-1308945b';
var ASSETS=['./','./index.html','./app.js?v=1308945b','./bootfx.js?v=1308945b','./manifest.webmanifest',
            './icon-180.png','./icon-192.png','./icon-512.png',
            './fonts/zenoldmincho-subset.woff2','./fonts/washi.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(V).then(function(c){return c.addAll(ASSETS)}).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){return k===V?null:caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  /* caches.match は全キャッシュを横断するので、削除が遅れると「新しい殻＋古い本体」が
     成立しうる（2026-08-15 批評）。いまの版のキャッシュだけを見る。 */
  e.respondWith(caches.open(V).then(function(c){return c.match(r,{ignoreSearch:true})}).then(function(hit){
    if(hit)return hit;
    return fetch(r).then(function(res){
      if(res&&res.ok){var cl=res.clone();caches.open(V).then(function(c){c.put(r,cl)})}
      return res;
    }).catch(function(){
      if(r.mode==='navigate')return caches.open(V).then(function(c){return c.match('./index.html')});
      throw new Error('offline');
    });
  }));
});
