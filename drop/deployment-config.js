// GitHub Pages remains direct-only until a deployed relay URL is assigned here
// and its exact WSS origin is added to index.html's connect-src policy.
// The private IIS backend does not serve frontend files. Its phase-one server
// must remain disabled here until frontend fallback and file support are ready.
export const DEPLOYMENT_CONFIG = Object.freeze({relayUrl:null});
