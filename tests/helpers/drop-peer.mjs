export function peerAdapter(memory=false) {
return `
const MEMORY=${memory};
class Emitter{constructor(){this.events={}}on(name,fn){(this.events[name]??=[]).push(fn);return this}emit(name,...args){for(const fn of this.events[name]||[])fn(...args)}}
const encode=msg=>JSON.stringify(msg,(_,v)=>v instanceof ArrayBuffer?{$bytes:[...new Uint8Array(v)]}:v);
const decode=msg=>JSON.parse(msg,(_,v)=>v&&v.$bytes?new Uint8Array(v.$bytes).buffer:v);
const gather=rtc=>rtc.iceGatheringState==='complete'?Promise.resolve():new Promise(resolve=>rtc.addEventListener('icegatheringstatechange',()=>{if(rtc.iceGatheringState==='complete')resolve()}));
class Link extends Emitter{
 constructor(owner,id,target,metadata){super();this.owner=owner;this.id=id;this.peer=target;this.metadata=metadata;this.open=false;this.peerConnection=MEMORY?{addEventListener(){},close(){}}:new RTCPeerConnection({iceServers:[]});if(!MEMORY)this.peerConnection.ondatachannel=e=>this.attach(e.channel)}
 attach(channel){this.channel=channel;channel.onopen=()=>{this.open=true;this.emit('open')};channel.onclose=()=>{this.open=false;this.emit('close')};channel.onmessage=e=>this.emit('data',decode(e.data))}
 send(msg){if(MEMORY){window.__signal({type:'data',from:this.owner.id,to:this.peer,link:this.id,payload:encode(msg)});return}this.channel.send(encode(msg))}
 close(){if(MEMORY&&this.open)window.__signal({type:'close',from:this.owner.id,to:this.peer,link:this.id});this.channel?.close();this.peerConnection.close();this.open=false;this.emit('close')}
}
window.__peerInstances=[];window.__links=new Map();
window.Peer=class extends Emitter{
 constructor(id){super();this.id=id||crypto.randomUUID();this.token=crypto.randomUUID();this.destroyed=false;this.disconnected=false;window.__currentPeer=this;window.__peerInstances.push(this);window.__signal({type:'register',from:this.id,token:this.token}).then(()=>{if(!this.destroyed)this.emit('open')})}
 connect(target,options){const link=new Link(this,crypto.randomUUID(),target,options.metadata);window.__links.set(link.id,link);if(MEMORY){setTimeout(()=>{if(window.__blockRTC)return;link.open=true;link.emit('open');window.__signal({type:'offer',from:this.id,to:target,link:link.id,metadata:options.metadata})},0);return link}link.attach(link.peerConnection.createDataChannel('drop'));(async()=>{await link.peerConnection.setLocalDescription(await link.peerConnection.createOffer());await gather(link.peerConnection);const ok=await window.__signal({type:'offer',from:this.id,to:target,link:link.id,metadata:options.metadata,sdp:link.peerConnection.localDescription.toJSON()});if(!ok)this.emit('error',{type:'peer-unavailable'})})().catch(()=>{});return link}
 reconnect(){this.disconnected=false;this.emit('open')}
 destroy(){this.destroyed=true;window.__signal({type:'destroy',from:this.id,token:this.token});for(const link of window.__links.values())if(link.owner===this)link.close()}
};
window.__receive=async msg=>{if(window.__blockRTC&&msg.type==='offer')return;const peer=window.__currentPeer;if(peer.destroyed)return;if(MEMORY){if(msg.type==='offer'){const link=new Link(peer,msg.link,msg.from,msg.metadata);window.__links.set(msg.link,link);peer.emit('connection',link);link.open=true;link.emit('open')}else if(msg.type==='data'){window.__links.get(msg.link)?.emit('data',decode(msg.payload))}else if(msg.type==='close'){const link=window.__links.get(msg.link);if(link){link.open=false;link.emit('close')}}return}if(msg.type==='offer'){const link=new Link(peer,msg.link,msg.from,msg.metadata);window.__links.set(msg.link,link);peer.emit('connection',link);await link.peerConnection.setRemoteDescription(msg.sdp);await link.peerConnection.setLocalDescription(await link.peerConnection.createAnswer());await gather(link.peerConnection);await window.__signal({type:'answer',from:peer.id,to:msg.from,link:msg.link,sdp:link.peerConnection.localDescription.toJSON()})}else if(msg.type==='answer'){await window.__links.get(msg.link)?.peerConnection.setRemoteDescription(msg.sdp)}};
`;
}
