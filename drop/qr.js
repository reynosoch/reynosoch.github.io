export function drawRoomQR(canvas, url, generator = window.qrcode) {
  if (typeof generator !== 'function') throw new Error('No se pudo generar el QR. Usa el código de 4 números.');
  const qr = generator(0, 'M'); qr.addData(url); qr.make();
  const modules = qr.getModuleCount(), quiet = 4, scale = 6;
  canvas.width = canvas.height = (modules + quiet * 2) * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('QR no disponible en este navegador. Usa el código de 4 números.');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  for (let row = 0; row < modules; row++) for (let col = 0; col < modules; col++) {
    if (qr.isDark(row, col)) context.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
  }
}
