import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from '../shot/vendor/jszip-3.10.2.mjs';
import {
  crc32Update,
  streamCrc32,
  cleanEntryPath,
  inferArchiveName,
  buildZipArchive,
  inspectZipBlob
} from '../convert/zip-engine.mjs';

test('WASM / Slicing-by-8 CRC-32 matches standard IEEE 802.3 checksums across chunk boundaries', async () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32Update(0, bytes), 0xcbf43926);

  // Split across multiple chunks
  const full = new Uint8Array(100_000);
  for (let i = 0; i < full.length; i++) full[i] = (i * 31 + 7) & 0xff;
  const singlePass = crc32Update(0, full);

  let streamed = 0;
  for (let offset = 0; offset < full.length; offset += 13_337) {
    streamed = crc32Update(streamed, full.subarray(offset, Math.min(full.length, offset + 13_337)));
  }
  assert.equal(streamed, singlePass);
  assert.equal(await streamCrc32(new Blob([full])), singlePass);
});

test('inferArchiveName and cleanEntryPath preserve folder hierarchy and prevent traversal', () => {
  assert.equal(cleanEntryPath('..\\..\\Proyecto\\src\\main.rs'), 'Proyecto/src/main.rs');
  assert.equal(
    inferArchiveName([
      { name: 'a.rs', webkitRelativePath: 'MiRepo/src/a.rs' },
      { name: 'b.go', webkitRelativePath: 'MiRepo/cmd/b.go' }
    ]),
    'MiRepo.zip'
  );
  assert.equal(inferArchiveName([{ name: 'reporte.pdf' }]), 'reporte.zip');
});

test('buildZipArchive packs large folders (>100 files, multiple languages, binaries) and inspectZipBlob reads Central Directory', async () => {
  const files = [];
  for (let i = 1; i <= 140; i++) {
    const ext = i % 4 === 0 ? 'rs' : i % 3 === 0 ? 'py' : i % 2 === 0 ? 'go' : 'bin';
    const content = ext === 'bin'
      ? new Uint8Array([0x00, 0xff, 0x10, 0x80, i & 0xff])
      : new TextEncoder().encode(`// File ${i} (${ext})\n`.repeat(50));
    const blob = new Blob([content]);
    blob.name = `file_${i}.${ext}`;
    blob.webkitRelativePath = `CarpetaPesada/mod_${i % 6}/file_${i}.${ext}`;
    files.push(blob);
  }

  let lastProgress = null;
  const zipBlob = await buildZipArchive(files, info => { lastProgress = info; });
  assert.ok(zipBlob.size > 0);
  assert.equal(lastProgress?.totalFiles, 140);
  assert.equal(lastProgress?.index, 140);

  // Verify with JSZip
  const loaded = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  const names = Object.keys(loaded.files).filter(k => !loaded.files[k].dir);
  assert.equal(names.length, 140);
  const sampleRs = await loaded.file('CarpetaPesada/mod_4/file_4.rs').async('string');
  assert.match(sampleRs, /\/\/ File 4 \(rs\)/);
  const sampleBin = await loaded.file('CarpetaPesada/mod_1/file_1.bin').async('uint8array');
  assert.deepEqual([...sampleBin], [0x00, 0xff, 0x10, 0x80, 1]);

  // Verify tail-slice Central Directory inspector
  const inspected = await inspectZipBlob(zipBlob);
  assert.equal(inspected.rows.length, 141); // header + 140 entries
  assert.equal(inspected.rows[0][0], 'path');
  assert.equal(inspected.rows[1][0], 'CarpetaPesada/mod_1/file_1.bin');
});
