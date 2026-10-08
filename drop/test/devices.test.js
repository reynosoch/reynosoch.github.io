import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectDevice,deviceType,deviceIcon} from '../devices.js';
test('distingue iPad en modo escritorio, teléfono, tablet Android y computadora', () => {
  assert.deepEqual(detectDevice({userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}),{label:'iPad',type:'tablet'});
  assert.equal(detectDevice({userAgent:'Mozilla iPad Safari'}).type,'tablet');
  assert.equal(detectDevice({userAgent:'Mozilla iPhone Safari'}).type,'phone');
  assert.equal(detectDevice({userAgent:'Mozilla Android Mobile Chrome'}).type,'phone');
  assert.equal(detectDevice({userAgent:'Mozilla Android Chrome'}).type,'tablet');
  assert.equal(detectDevice({userAgent:'Mozilla Windows Chrome'}).type,'computer');
  assert.equal(deviceType(undefined,'iPad'),'tablet'); assert.equal(deviceType(undefined,'Android'),'phone');
  assert.equal(deviceType('invalid','Laptop Windows'),'computer'); assert.equal(deviceType('<script>','desconocido'),'unknown');
  assert.notEqual(deviceIcon('tablet'),deviceIcon('phone')); assert.notEqual(deviceIcon('phone'),deviceIcon('computer'));
  assert.equal(deviceIcon('<script>'),deviceIcon('unknown'));
});
