/* 殻だけをキャッシュしてオフラインで起動できるようにする。
   問題データはここに入れない（IndexedDBにある）。 */
var V='takken-92adb02a';
var ASSETS=['./','./index.html','./app.js?v=92adb02a','./bootfx.js?v=92adb02a','./manifest.webmanifest',
            './icon-180.png','./icon-192.png','./icon-512.png',
            './fonts/zenoldmincho-subset.woff2','./fonts/washi.png',
            './splash/1125x2436.png','./splash/1170x2532.png','./splash/1179x2556.png','./splash/1206x2622.png','./splash/1242x2688.png','./splash/1284x2778.png','./splash/1290x2796.png','./splash/1320x2868.png','./splash/1536x2048.png','./splash/1668x2388.png','./splash/2048x2732.png','./splash/640x1136.png','./splash/750x1334.png','./splash/828x1792.png',
            ];
/* 取り込むときはブラウザの一時保存（GitHub Pages は max-age=600）を通さず、必ず配信先から取る
   （2026-10-07 本人報告「さっきのデザインと違ってない？」「始めるを押しても起動しない」）。
   通すと、配信の直前に開いた古い index.html（古いCSS）と新しい app.js が同じ版に入り、
   見た目だけ古いまま動く（index.html と CSS 以外の差は版の番号だけだった＝実測）。 */
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(V).then(function(c){
    return c.addAll(ASSETS.map(function(u){return new Request(u,{cache:'reload'})}));
  }).then(function(){return self.skipWaiting()}));
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
