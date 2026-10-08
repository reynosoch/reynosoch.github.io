// Lector de QR con la cámara. Usa BarcodeDetector cuando existe y jsQR (vendor/jsqr.js) como respaldo.
export async function startQRScanner({ video, canvas, onCode, nav = navigator, win = window, interval = 220 }) {
  if (!nav.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara. Escribe los 4 números de la sala.');
  let detector = null;
  if (typeof win.BarcodeDetector === 'function') { try { detector = new win.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; } }
  if (!detector && typeof win.jsQR !== 'function') throw new Error('No se pudo cargar el lector de QR. Escribe los 4 números de la sala.');
  let stream;
  try { stream = await nav.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
  catch (e) { throw new Error(e?.name === 'NotAllowedError' ? 'Permite el acceso a la cámara para escanear el QR, o escribe los 4 números de la sala.' : 'No se pudo abrir la cámara. Escribe los 4 números de la sala.'); }
  let stopped = false, timer = null, lastValue = '', lastAt = 0;
  const stop = () => { stopped = true; clearTimeout(timer); for (const track of stream.getTracks()) track.stop(); video.srcObject = null; };
  video.srcObject = stream; video.muted = true;
  try { await video.play(); } catch { /* Safari puede iniciar la reproducción al tener el primer fotograma. */ }
  const context = canvas.getContext?.('2d', { willReadFrequently: true });
  async function read() {
    if (!video.videoWidth) return '';
    if (detector) { try { const found = await detector.detect(video); if (found[0]?.rawValue) return found[0].rawValue; } catch { /* usa jsQR */ } }
    if (typeof win.jsQR !== 'function' || !context) return '';
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return win.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data || '';
  }
  async function tick() {
    if (stopped) return;
    try {
      const value = await read(), now = Date.now();
      if (value && (value !== lastValue || now - lastAt > 2500)) {
        lastValue = value; lastAt = now;
        if (await onCode(value)) { stop(); return; }
      }
    } catch { /* sigue escaneando */ }
    if (!stopped) timer = setTimeout(tick, interval);
  }
  timer = setTimeout(tick, interval);
  return stop;
}
