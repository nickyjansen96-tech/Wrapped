// Bewaart de app-bestanden zodat het Huishoudboek ook offline opent.
// Verhoog VERSION bij elke wijziging aan de bestanden hieronder.
const VERSION="hhb-v1";
const FILES=["./","index.html","style.css","app.js","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","apple-touch-icon.png","vendor/xlsx.full.min.js"];
self.addEventListener("install",e=>{ e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
// Eerst het netwerk (zodat updates direct binnenkomen), bij geen verbinding de opgeslagen versie.
self.addEventListener("fetch",e=>{ const req=e.request; if(req.method!=="GET"||new URL(req.url).origin!==location.origin)return;
  e.respondWith(fetch(req).then(res=>{ if(res.ok){ const copy=res.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); } return res; })
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match("index.html")))); });
