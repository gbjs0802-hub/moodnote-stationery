const CACHE_NAME='moodnote-pwa-v8';
const APP_SHELL=['/','/index.html','/support.html','/offline.html','/manifest.webmanifest','/styles.css?v=6','/mobile.css?v=3','/live.css?v=1','/ai-chat.css?v=2','/detail-commerce.css?v=3','/app.js?v=24','/pwa.js?v=1','/assets/pwa-192.png','/assets/pwa-512.png','/assets/moodnote-logo-v4.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put('/index.html',copy));
      return response;
    }).catch(()=>caches.match('/index.html').then(response=>response||caches.match('/offline.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok&&['style','script','image','font'].includes(request.destination)){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
    }
    return response;
  })));
});
