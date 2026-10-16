import { DROP_CONFIG, peerOptions } from './transport-config.js';
import { WebRTCTransport } from './webrtc-transport.js';
import { newCode, newRoomCode, deviceName, parseCode } from './protocol.js';

const peerId = value => typeof value==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const member = (id, data, isHost=false) => ({id,name:deviceName(data?.device),kind:deviceName(data?.kind),deviceType:['phone','tablet','computer'].includes(data?.deviceType)?data.deviceType:'unknown',isHost});

export class TransportManager {
  constructor({Peer,config=DROP_CONFIG,timers=globalThis,now=()=>Date.now(),online=()=>globalThis.navigator?.onLine!==false}={}) {
    this.Peer=Peer; this.config=config; this.timers=timers; this.now=now; this.online=online;
    this.listeners=new Map(); this.links=new Map(); this.members=new Map(); this.retries=new Map(); this.attempts=[];
    this.room=''; this.peer=null; this.intent=null; this.signaling='idle'; this.recovery=0;
  }
  on(event,callback) { if(!this.listeners.has(event))this.listeners.set(event,new Set());this.listeners.get(event).add(callback);return ()=>this.listeners.get(event)?.delete(callback); }
  emit(event,value) { for(const callback of this.listeners.get(event)||[])callback(value); }
  later(callback,ms) { return this.timers.setTimeout(callback,ms); }
  clear(timer) { this.timers.clearTimeout(timer); }
  changed() { this.emit('state',this.state); }
  record(state,reason='') { this.attempts.push({transport:'WebRTC',state,reason});if(this.attempts.length>32)this.attempts.shift(); }
  get state() {
    const members=[...this.members.values()].map(item=>({...item,connected:item.id===this.localId||Boolean(this.links.get(item.id)?.ready),local:item.id===this.localId}));
    const remotes=members.filter(item=>!item.local&&item.connected);
    return {room:this.room,host:Boolean(this.intent?.host),ready:remotes.length>0,remoteName:remotes[0]?.name||'',recovering:Boolean(this.signalRetry||this.retries.size),members};
  }
  diagnostics() {
    return {network:this.online()?'online':'offline',signaling:this.signaling,activeTransport:this.state.ready?'WebRTC':'none',turnConfigured:Boolean(this.config.turnServers?.length),relayAvailable:false,attempts:[...this.attempts],links:[...this.links.values()].map(link=>({...link.transport?.diagnostics(),ready:link.ready}))};
  }
  connect({host,code,device,kind,deviceType,recovering=false}) {
    if(!parseCode(code))throw new Error('Código de sala no válido');
    this.close(); this.attempts=[]; this.intent={host,code,device,kind,deviceType};this.room=code;
    this.restoring=recovering;
    this.localId=host?`reynoso-drop-${code}`:`reynoso-drop-device-${newCode()}`;
    this.hostId=`reynoso-drop-${code}`; this.token=host?newCode():'';this.openedOnce=false;
    this.members.set(this.localId,member(this.localId,this.intent,host));
    this.openPeer();
  }
  openPeer() {
    if(!this.intent || !this.online()){this.schedulePeer();return;}
    this.signaling='connecting';this.changed();
    let instance;
    try { instance=new this.Peer(this.localId,peerOptions(this.config)); }
    catch {this.signaling='failed';this.emit('notice','No se pudo abrir el servicio de salas.');this.schedulePeer();return;}
    this.peer=instance;
    this.signalTimer=this.later(()=>{if(this.peer===instance){this.signaling='timeout';this.emit('notice','El servicio de salas tardó en responder.');this.schedulePeer();}},this.config.signalingTimeout);
    instance.on('open',()=>{
      if(this.peer!==instance)return;
      this.clear(this.signalTimer);this.clear(this.signalRetry);this.signalRetry=null;this.signaling='connected';this.recovery=0;
      const first=!this.openedOnce;this.openedOnce=true;
      if(first){this.emit('room',this.state);this.expireEmpty();}
      if(!this.intent.host&&!this.links.has(this.hostId))this.dial(this.hostId);
      this.changed();this.health();
    });
    instance.on('connection',connection=>{
      if(this.peer!==instance||!this.intent){connection.close();return;}
      const id=connection.peer || `legacy-${newCode()}`;
      if(!peerId(id)||this.links.has(id)||this.members.size>=this.config.maxParticipants&&!this.members.has(id)||connection.metadata?.room&&connection.metadata.room!==this.room){connection.close();return;}
      if(!this.intent.host&&(!this.members.has(id)||connection.metadata?.token!==this.token||!this.token)){connection.close();return;}
      this.attach(id,connection,true);
    });
    instance.on('error',error=>{
      if(this.peer!==instance)return;
      if(error.type==='unavailable-id'&&this.intent.host&&!this.restoring&&!this.openedOnce&&this.recovery<4){
        this.recovery++;this.room=newRoomCode();this.intent.code=this.room;this.hostId=this.localId=`reynoso-drop-${this.room}`;
        this.members.clear();this.members.set(this.localId,member(this.localId,this.intent,true));this.retirePeer();this.openPeer();return;
      }
      if(error.type==='peer-unavailable'){
        // The broker answered; one missing peer is not a signaling outage.
        this.emit('notice',this.state.ready?'Uno de los dispositivos no respondió; los demás siguen conectados.':'No encontré esa sala. Comprueba el código y que el anfitrión siga abierto.');
        this.changed();return;
      }
      this.signaling='failed';this.emit('notice',error.type==='unavailable-id'?'Esperando liberar la sesión anterior para recuperar el mismo código.':'No se pudo contactar el servicio de salas. La red puede impedir la conexión.');
      this.schedulePeer();
    });
    instance.on('disconnected',()=>{if(this.peer===instance)this.resume();});
    instance.on('close',()=>{if(this.peer===instance)this.schedulePeer();});
  }
  retirePeer() {const previous=this.peer;this.peer=null;this.clear(this.signalTimer);previous?.destroy();}
  schedulePeer() {
    if(!this.intent||this.signalRetry)return;
    this.signalRetry=this.later(()=>{
      this.signalRetry=null;if(!this.intent)return;
      if(!this.online()){this.schedulePeer();return;}
      if(this.peer&&!this.peer.destroyed){
        if(this.peer.disconnected){try{this.peer.reconnect();}catch{}}
        if(this.peer.disconnected||this.signaling!=='connected'){
          if(this.state.ready){this.schedulePeer();return;}
          // No live channels to preserve; recreate the same peer and room identity.
          this.dropLinks();this.retirePeer();this.openPeer();
        } else if(!this.intent.host&&!this.links.has(this.hostId))this.dial(this.hostId);
      }else{this.retirePeer();this.openPeer();}
    },Math.min(15000,1000*2**Math.min(this.recovery++,4)));
    this.changed();
  }
  dial(id) {
    if(!this.intent||!this.peer||this.peer.destroyed||this.links.has(id))return;
    try {
      const connection=this.peer.connect(id,{reliable:true,serialization:'binary',metadata:{...this.intent,room:this.room,version:2,token:this.token}});
      this.attach(id,connection,false);
    }catch{this.retry(id);}
  }
  attach(id,connection,incoming) {
    const data=connection.metadata||{};
    const link={id,incoming,ready:false,lastSeen:this.now(),lastProbe:0,heartbeat:false,version:data.version===2?2:1};
    this.links.set(id,link);this.record('connecting');
    if(!this.members.has(id))this.members.set(id,member(id,data,id===this.hostId));
    link.timer=this.later(()=>{
      if(this.links.get(id)!==link||link.ready)return;
      this.emit('notice','La sala respondió, pero el canal de datos no abrió. La red puede impedir el enlace.');link.transport.close('timeout');
    },this.config.connectionTimeout);
    link.transport=new WebRTCTransport(connection,{
      onOpen:()=>{
        if(this.links.get(id)!==link)return;
        if(incoming){
          link.transport.send({type:'approved',device:this.intent.device,kind:this.intent.kind,deviceType:this.intent.deviceType,heartbeat:1,version:2,token:this.token});
          this.markReady(link);
        }
      },
      onMessage:message=>this.receive(link,message),
      onClose:reason=>this.lost(link,reason),
      onState:()=>this.changed(),
    });
    this.changed();
  }
  markReady(link) {
    if(this.links.get(link.id)!==link)return;
    link.ready=true;this.clear(link.timer);this.clear(this.retries.get(link.id));this.retries.delete(link.id);this.clear(this.expiryTimer);
    this.record('connected');this.changed();this.emit('connected',link.id);this.health();
    if(this.intent.host)this.broadcastRoster();
  }
  receive(link,message) {
    if(this.links.get(link.id)!==link||!message||typeof message!=='object')return;
    link.lastSeen=this.now();link.lastProbe=0;
    if(message.type==='approved'&&!link.incoming){
      if(link.id===this.hostId){this.token=typeof message.token==='string'&&/^[a-f0-9]{24}$/.test(message.token)?message.token:'';}
      this.members.set(link.id,member(link.id,{...message,device:message.device},link.id===this.hostId));link.version=message.version===2?2:1;link.heartbeat=message.heartbeat===1;
      this.markReady(link);if(link.heartbeat)link.transport.send({type:'health-ready'});return;
    }
    if(!link.ready)return;
    if(message.type==='ping'){link.transport.send({type:'pong'});return;}
    if(message.type==='pong'){this.changed();return;}
    if(message.type==='health-ready'){link.heartbeat=true;this.health();return;}
    if(message.type==='members'){
      if(!this.intent.host&&link.id===this.hostId&&link.version===2)this.applyRoster(message.members);
      return;
    }
    if(message.type==='room-closed'){
      if(!this.intent.host&&link.id===this.hostId){this.emit('room-closed');this.close();}else link.transport.close('left');return;
    }
    this.emit('message',{peerId:link.id,message});
  }
  broadcastRoster() {
    const members=[...this.members.values()].filter(item=>item.id===this.localId||this.links.get(item.id)?.ready).map(item=>({...item,version:this.links.get(item.id)?.version||2}));
    for(const link of this.links.values())if(link.ready&&link.version===2){try{link.transport.send({type:'members',members});}catch{link.transport.close('channel-error');}}
  }
  applyRoster(values) {
    if(!Array.isArray(values)||values.length>this.config.maxParticipants||values.length<2)return;
    const ids=new Set();
    for(const value of values)if(!peerId(value?.id)||ids.has(value.id))return;else ids.add(value.id);
    if(!ids.has(this.localId)||!ids.has(this.hostId))return;
    for(const [id] of this.members)if(!ids.has(id)){this.members.delete(id);this.clear(this.retries.get(id));this.retries.delete(id);this.links.get(id)?.transport.close('left');}
    for(const value of values){
      if(value.id===this.localId)continue;
      this.members.set(value.id,member(value.id,{device:value.name,kind:value.kind,deviceType:value.deviceType},value.id===this.hostId));
      // Only one side dials each mesh edge. Old clients remain host-only.
      if(value.version===2&&value.id!==this.hostId&&this.localId<value.id&&!this.links.has(value.id))this.dial(value.id);
    }
    this.changed();
  }
  lost(link,reason) {
    if(this.links.get(link.id)!==link)return;
    this.clear(link.timer);this.links.delete(link.id);this.record('failed',reason);this.emit('disconnected',link.id);
    if(this.intent?.host){this.members.delete(link.id);this.broadcastRoster();this.expireEmpty();}
    else if(this.intent&&this.members.has(link.id)&&reason!=='left')this.retry(link.id);
    this.changed();
  }
  retry(id) {
    if(!this.intent||this.retries.has(id))return;
    this.retries.set(id,this.later(()=>{
      this.retries.delete(id);if(!this.intent||!this.members.has(id))return;
      if(this.online())this.dial(id);else this.retry(id);
    },1000));this.changed();
  }
  health() {
    this.clear(this.healthTimer);if(!this.intent)return;
    for(const link of [...this.links.values()])if(link.ready&&link.heartbeat){
      if(link.lastProbe&&this.now()-link.lastSeen>this.config.heartbeatTimeout&&this.now()-link.lastProbe>10000){link.transport.close('heartbeat-timeout');continue;}
      try{link.transport.send({type:'ping'});if(!link.lastProbe)link.lastProbe=this.now();}catch{link.transport.close('channel-error');}
    }
    this.healthTimer=this.later(()=>this.health(),this.config.heartbeatInterval);
  }
  resume() {
    if(!this.intent)return;
    if(!this.peer||this.peer.destroyed||this.peer.disconnected){this.signaling='reconnecting';try{this.peer?.reconnect();}catch{}if(this.signaling!=='connected')this.schedulePeer();}
    if(this.peer&&!this.peer.disconnected&&!this.intent.host&&!this.links.has(this.hostId))this.dial(this.hostId);
    for(const link of this.links.values()){link.lastSeen=this.now();link.lastProbe=0;if(link.ready&&!link.transport.open)link.transport.close('channel-error');}
    this.health();this.changed();
  }
  send(message,id) {const link=this.links.get(id);if(!link?.ready)throw new Error('El dispositivo elegido no está conectado');link.transport.send(message);}
  expireEmpty() {
    this.clear(this.expiryTimer);
    if(this.intent?.host&&!this.state.ready)this.expiryTimer=this.later(()=>{if(!this.state.ready){this.emit('expired');this.close();}},this.config.emptyRoomTTL);
  }
  dropLinks() {for(const link of [...this.links.values()])link.transport?.close('session-reset');}
  close(notify=false) {
    const wasHost=this.intent?.host;this.intent=null;
    if(notify)for(const link of this.links.values())if(link.ready&&(wasHost||link.id===this.hostId)){try{link.transport.send({type:'room-closed'});}catch{}}
    this.clear(this.signalTimer);this.clear(this.signalRetry);this.signalRetry=null;this.clear(this.healthTimer);this.clear(this.expiryTimer);
    for(const timer of this.retries.values())this.clear(timer);this.retries.clear();
    if(notify&&this.links.size){
      // Give ordered channels a chance to deliver the leave notification before
      // destroying the Peer; no payloads are queued or persisted by the room.
      const previousPeer=this.peer,links=[...this.links.values()];this.peer=null;
      for(const link of links){this.clear(link.timer);this.links.delete(link.id);this.emit('disconnected',link.id);}
      this.later(()=>{for(const link of links)link.transport.close('left');previousPeer?.destroy();},150);
    }else{this.dropLinks();this.retirePeer();}
    this.members.clear();this.room='';this.signaling='idle';this.changed();
  }
}
