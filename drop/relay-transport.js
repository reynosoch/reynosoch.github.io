import { encodeFrame, decodeFrame } from './relay-codec.js';

export function relayAddress(value) {
  if(!value)return null;
  const url=new URL(value);
  if(url.username||url.password||url.hash||url.search)throw new Error('Dirección del servicio no válida');
  if(url.protocol==='https:')url.protocol='wss:';
  if(url.protocol==='http:')url.protocol='ws:';
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='wss:'&&!(loopback&&url.protocol==='ws:'))throw new Error('El servicio de conexión requiere HTTPS');
  return url.href;
}

// One socket per room participant; each RelayTransport below is a logical peer
// link sharing it. No file, text, or transfer history is buffered here.
export class RelaySession {
  constructor({url,WebSocket:Socket=globalThis.WebSocket,timers=globalThis,timeout=8000,onMembers,onMessage,onClose,onError}) {
    this.url=relayAddress(url);this.Socket=Socket;this.timers=timers;this.timeout=timeout;
    this.callbacks={onMembers,onMessage,onClose,onError};this.socket=null;this.open=false;this.closed=false;
  }
  connect(identity) {
    this.closed=false;
    try{this.socket=new this.Socket(this.url);}catch{this.fail('unavailable');return;}
    const socket=this.socket;socket.binaryType='arraybuffer';
    this.timer=this.timers.setTimeout(()=>this.fail('timeout'),this.timeout);
    socket.addEventListener('open',()=>{if(this.closed||socket!==this.socket)return;this.write({type:'join',...identity});});
    socket.addEventListener('message',event=>{
      if(this.closed||socket!==this.socket)return;
      try{
        const packet=decodeFrame(event.data);
        if(packet.type==='members'){
          this.timers.clearTimeout(this.timer);this.open=true;this.callbacks.onMembers(packet);
        }else if(packet.type==='data'&&this.open)this.callbacks.onMessage(packet.from,packet.message);
        else if(packet.type==='closed'){this.callbacks.onError(packet.reason||'room-closed');this.close();}
        else if(packet.type==='error')this.fail(packet.reason||'unavailable');
      }catch{this.fail('invalid-frame');}
    });
    socket.addEventListener('error',()=>this.fail('unavailable'));
    socket.addEventListener('close',()=>{if(!this.closed&&socket===this.socket){this.open=false;this.closed=true;this.timers.clearTimeout(this.timer);this.callbacks.onClose();}});
  }
  write(packet) {
    if(!this.socket||this.socket.readyState!==1||this.socket.bufferedAmount>1024*1024)throw new Error('El servicio de conexión no está disponible');
    this.socket.send(encodeFrame(packet));
  }
  send(message,to) {if(!this.open)throw new Error('Restableciendo conexión…');this.write({type:'data',to,message});}
  fail(reason) {if(this.closed)return;this.callbacks.onError(reason);this.close();}
  close(notify=false,closeRoom=false) {
    if(this.closed)return;
    if(notify&&this.open){try{this.write({type:'leave',closeRoom});}catch{}}
    this.closed=true;this.open=false;this.timers.clearTimeout(this.timer);this.socket?.close();
  }
}

export class RelayTransport {
  constructor(session,peerId) {this.session=session;this.peerId=peerId;this.closed=false;}
  get open(){return !this.closed&&this.session.open;}
  send(message){if(!this.open)throw new Error('Restableciendo conexión…');this.session.send(message,this.peerId);}
  close(){this.closed=true;}
  diagnostics(){return {transport:'Drop Relay',route:'HTTPS/WSS',state:this.open?'open':'closed',ice:'not-used',candidateTypes:[]};}
}
