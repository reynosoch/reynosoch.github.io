// Keep the transport document alive while the user browses the same-origin catalog.
const catalogURL = new URL('../', location.href);
let layer, frame, priorFocus;
function stateLabel() {
  const state = window.dropConnection?.state;
  return state?.ready ? `Sala ${state.room} · Conectado` : state?.room ? `Sala ${state.room} · ${state.recovering ? 'Reconectando' : 'Esperando dispositivo'}` : 'Drop · Sin sala abierta';
}
function update() {
  document.getElementById('drop-dock-state')?.replaceChildren(document.createTextNode(stateLabel()));
  const reconnect = document.getElementById('reconnect-room'); if (reconnect) reconnect.disabled = !window.dropConnection?.active;
  const live = document.getElementById('drop-live-state');
  if (live) live.textContent = stateLabel();
}
function closeCatalog() {
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  document.body.classList.remove('drop-catalog-open');
  for (const node of document.querySelectorAll('body > header, body > main, body > footer')) node.inert = false;
  const url = new URL(location.href); url.searchParams.delete('view'); history.replaceState(null, '', url);
  window.dropConnection?.resume();
  priorFocus?.focus();
}
function openCatalog(event) {
  if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
  event?.preventDefault();
  priorFocus = document.activeElement;
  if (!layer) {
    layer = document.createElement('section'); layer.className = 'drop-catalog-layer'; layer.setAttribute('aria-label', 'Toolchain con Drop activo');
    layer.innerHTML = '<div class="drop-dock"><div><strong>DROP</strong><span id="drop-dock-state" role="status" aria-live="polite"></span></div><button id="drop-back" type="button">Volver a Drop</button></div><iframe title="Reynoso Toolchain · Catálogo" referrerpolicy="same-origin"></iframe>';
    document.body.append(layer); frame = layer.querySelector('iframe');
    layer.querySelector('#drop-back').addEventListener('click', closeCatalog);
    frame.addEventListener('load', () => {
      try {
        if (frame.contentWindow.location.origin !== location.origin) return;
        // Returning to Drop reuses the existing transport instead of opening another peer.
        frame.contentDocument.addEventListener('click', e => {
          const anchor = e.target.closest('a[href]'); if (!anchor) return;
          const target = new URL(anchor.href);
          if (target.origin === location.origin && target.pathname.replace(/\/$/, '') === catalogURL.pathname.replace(/\/$/, '') + '/drop') { e.preventDefault(); closeCatalog(); }
        }, true);
      } catch { /* External pages cannot be inspected. The return dock remains available. */ }
    });
    frame.src = catalogURL.href;
  }
  layer.hidden = false;
  document.body.classList.add('drop-catalog-open');
  for (const node of document.querySelectorAll('body > header, body > main, body > footer')) node.inert = true;
  const url = new URL(location.href); url.searchParams.set('view', 'toolchain'); history.replaceState(null, '', url);
  update(); layer.querySelector('#drop-back').focus();
}
for (const anchor of document.querySelectorAll('.tc-home,.drop-home-footer')) anchor.addEventListener('click', openCatalog);
new MutationObserver(update).observe(document.getElementById('status'), {childList:true,subtree:true,characterData:true});
document.addEventListener('visibilitychange', update);
document.getElementById('reconnect-room')?.addEventListener('click', () => window.dropConnection?.reconnect());
update();
if (new URL(location.href).searchParams.get('view') === 'toolchain') openCatalog();
