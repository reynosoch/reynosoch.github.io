import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, formatBytes, getSafeBaseName } from '../clip/app.mjs';

test('formatTime formats seconds into readable MM:SS.SS with zero-padding', () => {
  assert.equal(formatTime(0), '00:00.00');
  assert.equal(formatTime(9.5), '00:09.50');
  assert.equal(formatTime(65.25), '01:05.25');
  assert.equal(formatTime(3600), '60:00.00');
  assert.equal(formatTime(-5), '00:00.00');
  assert.equal(formatTime(NaN), '00:00.00');
});

test('formatBytes formats file size in appropriate byte units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(500), '500.0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(10485760), '10.0 MB');
});

test('getSafeBaseName creates sanitized and safe filename for exports', () => {
  assert.equal(getSafeBaseName(''), 'clip');
  assert.equal(getSafeBaseName('sequence-01.mp4'), 'sequence-01');
  assert.equal(getSafeBaseName('my video test.final.webm'), 'my_video_test_final');
  assert.equal(getSafeBaseName('clip [1080p] #cool.mov'), 'clip__1080p___cool');
});
