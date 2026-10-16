import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TransportManager} from '../transport-manager.js';
import {DROP_CONFIG,peerOptions} from '../transport-config.js';

const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
function network() {
  const registry=new Map(),timers=new Map();let sequence=0;
  class Link extends EventEmitter {
    constructor(peer,metadata){super();this.peer=peer;this.metadata=metadata;this.open=false;}
    send(message){if(!this.open)throw Error('closed');queueMicrotask(()=>{if(this.other.open)this.other.emit('data',structuredClone(message));});}
    close(){const wasOpen=this.open;this.open=false;this.emit('close');if(wasOpen&&this.other.open){this.other.open=false;this.other.emit('close');}}
  }
  class Peer extends EventEmitter {
    constructor(id,options){super();this.id=id;this.options=options;this.destroyed=false;this.disconnected=false;this.links=[];
      queueMicrotask(()=>{if(registry.has(id)){this.emit('error',{type:'unavailable-id'});return;}registry.set(id,this);this.emit('open');});}
    connect(id,{metadata}){
      const local=new Link(id,metadata);this.links.push(local);
      queueMicrotask(()=>{
        const target=registry.get(id);if(!target){local.emit('error',Error('not found'));return;}
        const remote=new Link(this.id,metadata);local.other=remote;remote.other=local;target.links.push(remote);
        target.emit('connection',remote);
        local.open=true;local.emit('open');remote.open=true;remote.emit('open');
      });return local;
    }
    reconnect(){this.disconnected=false;this.emit('open');}
    destroy(){this.destroyed=true;if(registry.get(this.id)===this)registry.delete(this.id);for(const link of this.links)link.close();}
  }
  const clock={setTimeout(callback,ms){const id=++sequence;timers.set(id,{callback,ms});return id;},clearTimeout(id){timers.delete(id);}};
  function manager(){return new TransportManager({Peer,timers:clock});}
  function expire(ms){for(const [id,timer] of [...timers])if(timer.ms===ms&&timers.has(id)){timers.delete(id);timer.callback();}}
  async function room(count=5){const members=[];for(let i=0;i<count;i++){const m=manager();members.push(m);m.connect({host:i===0,code:'0012',device:['PC personal','PC Ethernet','Laptop corpo','iPhone','iPad'][i]||`Equipo ${i}`,kind:i>2?'iOS':'Windows',deviceType:i===3?'phone':i===4?'tablet':'computer'});await flush();}return members;}
  return {registry,manager,room,expire,flush};
}

test('cinco dispositivos forman una sala completa y los invitados se envían sin pasar contenido por el host',async()=>{
  const n=network(),all=await n.room();
  try {
    for(const m of all){assert.equal(m.state.members.length,5);assert.equal(m.state.members.filter(x=>x.connected).length,5);assert.equal(m.links.size,4);}
    const received=all.map(()=>[]);all.forEach((m,i)=>m.on('message',message=>received[i].push(message)));
    all[3].send({type:'text',text:'de iPhone a iPad'},all[4].localId);await flush();
    assert.equal(received[4][0].message.text,'de iPhone a iPad');assert.equal(received[4][0].peerId,all[3].localId);
    assert.equal(received[0].length,0);assert.equal(received[1].length,0);assert.equal(received[2].length,0);
  }finally{all.forEach(m=>m.close());}
});
test('salir un invitado conserva las conexiones sanas y su regreso usa el mismo código',async()=>{
  const n=network(),all=await n.room();
  try {
    const before=all[1].links.get(all[2].localId).transport;
    const id=all[3].localId;all[3].close(true);await flush();
    assert.equal(all[0].state.members.length,4);assert.equal(all[1].links.get(all[2].localId).transport,before);assert(before.open);
    assert(all[0].state.ready);assert(!all[0].members.has(id));
    all[3].connect({host:false,code:'0012',device:'iPhone',kind:'iPhone',deviceType:'phone'});await flush();
    assert.equal(all[0].state.members.length,5);assert(all.every(m=>m.state.ready));
  }finally{all.forEach(m=>m.close());}
});
test('una caída del enlace con el anfitrión se recupera sin reemplazar al Peer ni los otros canales',async()=>{
  const n=network(),all=await n.room();
  try{
    const guest=all[1],peer=guest.peer;
    guest.links.get(guest.hostId).transport.close();await flush();
    assert.equal(guest.peer,peer);assert.equal(guest.state.room,'0012');
    n.expire(1000);await flush();
    assert(guest.links.get(guest.hostId)?.ready);assert.equal(guest.peer,peer);
    assert.equal(all[0].state.members.length,5);
  }finally{all.forEach(m=>m.close());}
});
test('solo el anfitrión puede publicar miembros; cerrar un invitado no cierra la sala',async()=>{
  const n=network(),all=await n.room(3);
  try{
    const before=all[2].state.members.map(x=>x.id);
    all[1].send({type:'members',members:[]},all[2].localId);await flush();
    assert.deepEqual(all[2].state.members.map(x=>x.id),before);
    all[1].close(true);await flush();assert(all[0].intent);assert(all[2].intent);
    all[0].close(true);await flush();assert.equal(all[2].intent,null);
  }finally{all.forEach(m=>m.close());}
});
test('listas inválidas o de más de ocho equipos se ignoran sin hacer conexiones arbitrarias',async()=>{
  const n=network(),all=await n.room(2);
  try{
    const guest=all[1],before=guest.state.members;
    for(const members of [[],Array.from({length:9},(_,i)=>({id:`extra-${i}`})),[{id:guest.localId},{id:guest.localId}], [{id:guest.localId},{id:'https://not-a-peer'}]]){
      all[0].send({type:'members',members},guest.localId);await flush();assert.deepEqual(guest.state.members,before);
    }
  }finally{all.forEach(m=>m.close());}
});
test('el límite incluye al anfitrión y no admite una novena conexión pendiente',async()=>{
  const n=network(),all=await n.room(8);const extra=n.manager();
  try{
    extra.connect({host:false,code:'0012',device:'Noveno'});await flush();
    assert.equal(all[0].state.members.length,8);assert.equal(all[0].links.size,7);assert.equal(extra.state.ready,false);
  }finally{extra.close();all.forEach(m=>m.close());}
});
test('sin TURN configurado no hay credenciales públicas ni un relay ficticio; diagnóstico no incluye contenido',async()=>{
  const options=peerOptions();assert.equal(options.secure,true);assert.equal(options.port,443);
  assert.equal(options.config.iceServers.length,1);assert.equal(options.config.iceServers[0].username,undefined);
  assert.throws(()=>peerOptions({...DROP_CONFIG,turnServers:[{urls:'http://bad'}]}),/no válida/);
  const n=network(),all=await n.room(2);
  try{
    all[0].send({type:'text',text:'CONTENIDO PRIVADO'},all[1].localId);await flush();
    const info=all[0].diagnostics();assert.equal(info.relayAvailable,false);assert.equal(info.turnConfigured,false);assert.equal(info.signaling,'connected');assert(!JSON.stringify(info).includes('CONTENIDO PRIVADO'));
  }finally{all.forEach(m=>m.close());}
});

test('recuperar anfitrión conserva el código cuando su ID sigue ocupado',async()=>{
  const n=network(),all=await n.room(2),restoring=n.manager();
  try{
    restoring.connect({host:true,code:'0012',device:'PC restaurada',recovering:true});await flush();
    assert.equal(restoring.state.room,'0012');assert.equal(restoring.localId,'reynoso-drop-0012');assert.equal(restoring.state.recovering,true);
    assert.equal(n.registry.get('reynoso-drop-0012'),all[0].peer);
  }finally{restoring.close();all.forEach(m=>m.close());}
});

test('un miembro no disponible no se presenta como caída de señalización ni destruye canales sanos',async()=>{
  const n=network(),all=await n.room(3);
  try{
    const peer=all[1].peer,link=all[1].links.get(all[2].localId).transport;
    peer.emit('error',{type:'peer-unavailable'});await flush();
    assert.equal(all[1].diagnostics().signaling,'connected');assert.equal(all[1].peer,peer);assert.equal(all[1].links.get(all[2].localId).transport,link);assert(link.open);
  }finally{all.forEach(m=>m.close());}
});
