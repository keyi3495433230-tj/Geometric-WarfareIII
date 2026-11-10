const cacheName='gw-models-v1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const root=new URL('./',self.location.href).pathname;
  if(url.pathname!==root+'models.js' && (!url.pathname.startsWith(root+'models/')||! /\.(glb|png|jpg)$/.test(url.pathname)))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName),hit=await cache.match(event.request);
    if(hit)return hit;
    const response=await fetch(event.request);
    if(response.ok){const clone=response.clone();event.waitUntil(cache.put(event.request,clone).catch(()=>{}));}
    return response;
  })());
});
