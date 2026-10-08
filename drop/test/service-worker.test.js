import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function setup() {
  const scope = 'https://reynosoch.github.io/drop/';
  const listeners = new Map(), deleted = [], writes = [];
  const keys = [`reynoso-drop:${scope}:v1.7.1`, `reynoso-drop:${scope}:v1.7.2`, 'transformers-cache', 'other-tool-cache', 'reynoso-drop-v1.7'];
  const cached = new Map();
  const cache = { match: async request => cached.get(typeof request === 'string' ? request : request.url), put: async (request,response) => writes.push([request,response]) };
  const context = { URL, Response,
    fetch: async () => { throw new Error('offline'); },
    caches: { keys: async () => keys, delete: async key => { deleted.push(key); }, open: async () => cache },
    self: { registration: { scope }, location: { origin: 'https://reynosoch.github.io' }, clients: { claim: async () => {} }, addEventListener: (name, fn) => listeners.set(name,fn) },
  };
  runInNewContext(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),context);
  return {listeners,deleted,context,cached,writes};
}
test('activation removes only outdated Drop caches for this scope', async () => {
  const {listeners,deleted} = setup(); let done;
  listeners.get('activate')({waitUntil:promise=>{done=promise;}}); await done;
  assert.deepEqual(deleted,['reynoso-drop:https://reynosoch.github.io/drop/:v1.7.1']);
});
test('service worker leaves hub, Transcribe and other origins alone', () => {
  const {listeners}=setup();
  for(const url of ['https://reynosoch.github.io/','https://reynosoch.github.io/transcribe/app.mjs','https://external.test/drop/file']) {
    let intercepted=false;
    listeners.get('fetch')({request:{method:'GET',url},respondWith:()=>{intercepted=true;}});
    assert.equal(intercepted,false,url);
  }
});
test('offline HTML fallback is limited to navigations inside Drop', async () => {
  const {listeners,cached}=setup(); cached.set('./index.html',new Response('<h1>Drop</h1>'));
  let response;
  const event={waitUntil(){},respondWith:promise=>{response=promise;}};
  listeners.get('fetch')({...event,request:{method:'GET',url:'https://reynosoch.github.io/drop/app.js',mode:'cors'}});
  assert.equal((await response).type,'error');
  listeners.get('fetch')({...event,request:{method:'GET',url:'https://reynosoch.github.io/drop/',mode:'navigate'}});
  assert.equal(await (await response).text(),'<h1>Drop</h1>');
});
test('network HTTP errors are not cached', async () => {
  const {listeners,context,writes}=setup(); context.fetch=async()=>new Response('missing',{status:404}); let result;
  listeners.get('fetch')({request:{method:'GET',url:'https://reynosoch.github.io/drop/missing.js'},waitUntil(){},respondWith:p=>{result=p;}});
  assert.equal((await result).status,404); assert.equal(writes.length,0);
});
