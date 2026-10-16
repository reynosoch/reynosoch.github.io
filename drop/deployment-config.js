// GitHub Pages remains direct-only until a deployed relay URL is assigned here
// and its exact WSS origin is added to index.html's connect-src policy.
// The standalone relay server serves this module with its own /relay endpoint.
export const DEPLOYMENT_CONFIG = Object.freeze({relayUrl:null});
