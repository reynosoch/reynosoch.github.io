// A single data link. Room membership, UI, file chunks and ACKs live above it.
export class WebRTCTransport {
  constructor(connection, {onOpen, onMessage, onClose, onState}) {
    this.connection = connection;
    this.closed = false;
    this.info = {transport:'WebRTC',state:'connecting',ice:'new',candidateTypes:[],route:'WebRTC'};
    this.callbacks = {onOpen,onMessage,onClose,onState};
    connection.on('open', () => { if (this.closed) return; this.info.state='open'; this.observe(); onOpen(); });
    connection.on('data', message => { if (!this.closed) onMessage(message); });
    connection.on('close', () => this.finish('closed'));
    connection.on('error', () => this.close('channel-error'));
    this.observe();
  }
  observe() {
    const rtc=this.connection.peerConnection;
    if (!rtc || this.rtc===rtc) return;
    this.rtc=rtc;
    const update=()=>{
      if(this.closed)return;
      this.info.ice=rtc.iceConnectionState || 'new';
      this.info.connection=rtc.connectionState || 'new';
      this.callbacks.onState(this.diagnostics());
      if(this.info.ice==='failed' || this.info.connection==='failed')this.close('ice-failed');
      if(this.info.ice==='connected' || this.info.ice==='completed')this.selectedRoute();
    };
    rtc.addEventListener?.('icecandidate', event=>{
      const type=event.candidate?.type;
      if(['host','srflx','prflx','relay'].includes(type)&&!this.info.candidateTypes.includes(type))this.info.candidateTypes.push(type);
      update();
    });
    rtc.addEventListener?.('iceconnectionstatechange',update);
    rtc.addEventListener?.('connectionstatechange',update);
    update();
  }
  async selectedRoute() {
    try {
      const stats=await this.rtc.getStats();
      if(this.closed)return;
      const pair=[...stats.values()].find(item=>item.type==='candidate-pair'&&item.state==='succeeded'&&(item.nominated||item.selected));
      if(!pair)return;
      this.info.route=[stats.get(pair.localCandidateId),stats.get(pair.remoteCandidateId)].some(item=>item?.candidateType==='relay')?'Relay WebRTC':'Direct WebRTC';
      this.callbacks.onState(this.diagnostics());
    } catch { /* Stats are optional; never expose candidate addresses or credentials. */ }
  }
  get open() { return !this.closed && this.connection.open; }
  send(message) { if(!this.open)throw new Error('El dispositivo se desconectó'); this.connection.send(message); }
  diagnostics() { return {...this.info,candidateTypes:[...this.info.candidateTypes]}; }
  finish(reason) { if(this.closed)return; this.closed=true; this.info.state=reason; this.callbacks.onClose(reason); }
  close(reason='closed') { if(this.closed)return; this.finish(reason); this.connection.close(); }
}
