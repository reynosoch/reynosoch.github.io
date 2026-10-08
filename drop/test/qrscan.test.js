import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startQRScanner } from '../qrscan.js';

function fakes({ code = '', detectorOnly = true } = {}) {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const stream = { getTracks: () => tracks };
  const video = { videoWidth: 640, videoHeight: 480, muted: false, srcObject: null, play: async () => {} };
  const canvas = { getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) }) };
  const nav = { mediaDevices: { getUserMedia: async () => stream } };
  const win = detectorOnly
    ? { BarcodeDetector: class { async detect() { return code ? [{ rawValue: code }] : []; } } }
    : { jsQR: () => (code ? { data: code } : null) };
  return { tracks, video, canvas, nav, win };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('el escáner entrega el valor del QR y apaga la cámara al aceptarlo', async () => {
  for (const detectorOnly of [true, false]) {
    const { tracks, video, canvas, nav, win } = fakes({ code: 'https://x.test/#0012', detectorOnly });
    const seen = [];
    await startQRScanner({ video, canvas, nav, win, interval: 5, onCode: value => { seen.push(value); return true; } });
    await wait(40);
    assert.deepEqual(seen, ['https://x.test/#0012']);
    assert.equal(tracks[0].stopped, true); assert.equal(video.srcObject, null);
  }
});
test('un QR no aceptado mantiene la cámara abierta hasta detenerla', async () => {
  const { tracks, video, canvas, nav, win } = fakes({ code: 'otra cosa' });
  const stop = await startQRScanner({ video, canvas, nav, win, interval: 5, onCode: () => false });
  await wait(30); assert.equal(tracks[0].stopped, false);
  stop(); assert.equal(tracks[0].stopped, true);
});
test('sin cámara, sin permiso o sin lector se explica y ofrece el código', async () => {
  const base = fakes();
  await assert.rejects(startQRScanner({ ...base, nav: {}, onCode() {} }), /cámara/);
  await assert.rejects(startQRScanner({ ...base, win: {}, onCode() {} }), /lector de QR/);
  const denied = { mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); } } };
  await assert.rejects(startQRScanner({ ...base, nav: denied, onCode() {} }), /Permite el acceso/);
});
