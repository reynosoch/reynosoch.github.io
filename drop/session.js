const SESSION_KEY = 'reynoso-drop:session-v1';
const DEVICE_KEY = 'reynoso-drop:device-name';
const DRAFT_KEY = 'reynoso-drop:text-draft';
const AUTO_RECEIVE_KEY = 'reynoso-drop:auto-receive';
const RESUME_HOST_KEY = 'reynoso-drop:resume-host-room';
const ROOM_RE = /^\d{4}$/;
const RETRY_MS = 4000;
let restoring = false;
let roleHint = '';
let retryTimer = null;

function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return value && ROOM_RE.test(value.room) && /^(host|guest)$/.test(value.role) ? value : null;
  } catch { return null; }
}
function saveSession(role, room) {
  if (!ROOM_RE.test(room) || !/^(host|guest)$/.test(role)) return;
  const deviceName = document.getElementById('device-name')?.value?.trim().slice(0, 40) || '';
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ role, room, deviceName, savedAt: Date.now() })); } catch { /* private mode / quota */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(RESUME_HOST_KEY); } catch { /* storage unavailable */ }
}
function idle() {
  const details = document.getElementById('room-details');
  const create = document.getElementById('create-room');
  const join = document.getElementById('join-room');
  return Boolean(details?.hidden && create && join && !create.disabled && !join.disabled);
}
function persistFromUi() {
  const details = document.getElementById('room-details');
  const code = document.getElementById('room-code')?.textContent?.replace(/\D/g, '') || '';
  if (details?.hidden || !ROOM_RE.test(code)) return;
  const role = !document.getElementById('qr-panel')?.hidden ? 'host' : roleHint || 'guest';
  saveSession(role, code);
}
function restoreSession() {
  const saved = readSession();
  if (!saved || !navigator.onLine || !idle()) return;
  const name = document.getElementById('device-name');
  if (name && saved.deviceName) name.value = saved.deviceName;
  restoring = true;
  roleHint = saved.role;
  try {
    if (saved.role === 'host') {
      localStorage.setItem(RESUME_HOST_KEY, saved.room);
      document.getElementById('create-room')?.click();
    } else {
      const input = document.getElementById('room-input');
      if (input) input.value = saved.room;
      document.getElementById('join-room')?.click();
    }
  } finally { restoring = false; }
}
function boot() {
  const create = document.getElementById('create-room');
  const join = document.getElementById('join-room');
  const leave = document.getElementById('leave-room');
  const roomInput = document.getElementById('room-input');
  const deviceName = document.getElementById('device-name');
  const editor = document.getElementById('text-input');
  const autoReceive = document.getElementById('auto-receive');
  const saved = readSession();

  try {
    const savedName = localStorage.getItem(DEVICE_KEY) || saved?.deviceName || '';
    if (deviceName && savedName) deviceName.value = savedName.slice(0, 40);
    if (editor) editor.value = localStorage.getItem(DRAFT_KEY) || editor.value;
    if (autoReceive && localStorage.getItem(AUTO_RECEIVE_KEY) !== null) autoReceive.checked = localStorage.getItem(AUTO_RECEIVE_KEY) !== '0';
  } catch { /* storage unavailable */ }
  editor?.dispatchEvent(new Event('input', { bubbles: true }));

  create?.addEventListener('click', () => {
    roleHint = 'host';
    if (!restoring) clearSession();
  }, true);
  join?.addEventListener('click', () => { roleHint = 'guest'; }, true);
  roomInput?.addEventListener('input', () => { if (ROOM_RE.test(roomInput.value.replace(/\D/g, ''))) roleHint = 'guest'; }, true);
  leave?.addEventListener('click', () => clearSession(), true);

  deviceName?.addEventListener('input', () => {
    try { localStorage.setItem(DEVICE_KEY, deviceName.value.trim().slice(0, 40)); } catch { /* storage unavailable */ }
  });
  autoReceive?.addEventListener('change', () => {
    try { localStorage.setItem(AUTO_RECEIVE_KEY, autoReceive.checked ? '1' : '0'); } catch { /* storage unavailable */ }
  });
  editor?.addEventListener('input', () => {
    try {
      if (editor.value.length <= 200000) localStorage.setItem(DRAFT_KEY, editor.value);
      else localStorage.removeItem(DRAFT_KEY);
    } catch { /* storage unavailable */ }
  });
  editor?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const send = document.getElementById('send-text');
    if (!send?.disabled) send.click();
  }, true);

  const observer = new MutationObserver(() => persistFromUi());
  const details = document.getElementById('room-details');
  const code = document.getElementById('room-code');
  const qr = document.getElementById('qr-panel');
  if (details) observer.observe(details, { attributes: true, attributeFilter: ['hidden'] });
  if (code) observer.observe(code, { childList: true, characterData: true, subtree: true });
  if (qr) observer.observe(qr, { attributes: true, attributeFilter: ['hidden'] });

  window.addEventListener('online', () => setTimeout(restoreSession, 250));
  retryTimer = setInterval(restoreSession, RETRY_MS);
  window.addEventListener('pagehide', () => clearInterval(retryTimer), { once: true });
  setTimeout(() => { persistFromUi(); restoreSession(); }, 50);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();