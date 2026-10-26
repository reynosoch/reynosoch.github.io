import { DEPLOYMENT_CONFIG } from './deployment-config.js';
// Personal deployment: no public TURN credentials. Office settings
// belong here; never put long-lived private credentials in a public Pages site.
export const DROP_CONFIG = Object.freeze({
  signaling: {host:'0.peerjs.com', port:443, secure:true},
  iceServers: [{urls:[
    'stun:stun.l.google.com:19302',
    'stun:stun.cloudflare.com:3478'
  ]}],
  turnServers: [],
  relayUrl: DEPLOYMENT_CONFIG.relayUrl,
  relayTimeout: 8000,
  maxParticipants: 8,
  signalingTimeout: 8000,
  connectionTimeout: 12000,
  heartbeatInterval: 5000,
  heartbeatTimeout: 25000,
  emptyRoomTTL: 10 * 60 * 1000,
});

export function peerOptions(config = DROP_CONFIG) {
  const turn = config.turnServers || [];
  for (const server of turn) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    if (!urls.length || !urls.every(url => typeof url === 'string' && /^turns?:[^\s]+$/.test(url)) || !server.username || !server.credential) throw new Error('Configuración de conexión de respaldo no válida');
  }
  return { ...config.signaling, debug:0, config:{sdpSemantics:'unified-plan',iceServers:[...config.iceServers,...turn]} };
}
