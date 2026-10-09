const CACHE='reynoso-snippets-v1';
const SHELL=['./','./index.html','./snippets.css','./favicon.svg','./app.mjs','./data/default-snippets.mjs','./lib/model.mjs','./lib/search.mjs','./lib/storage.mjs','./lib/import-export.mjs','./lib/ui.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('reynoso-snippets-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  // Serve one coherent version of the entire shell; an updated worker waits until tabs close.
  const relative='./'+url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if(!SHELL.includes(relative))return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));
});
