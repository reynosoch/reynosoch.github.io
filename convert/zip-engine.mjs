// High-throughput streaming ZIP / ZIP64 engine with WebAssembly CRC-32 and native CompressionStream.
// Packs folders and heavy files without loading the entire archive into RAM at once.

const STORE_EXT = new Set([
  'zip','7z','rar','gz','tgz','bz2','xz','zst','lz4','br','cab','dmg','iso',
  'mp4','m4v','mkv','mov','avi','webm','wmv','flv','3gp','mpeg','mpg','ts','m2ts',
  'mp3','aac','ogg','oga','opus','flac','m4a','wma',
  'jpg','jpeg','jfif','png','webp','avif','heic','heif','gif',
  'pdf','docx','xlsx','xlsb','pptx','odt','ods','odp','epub','jar','apk','ipa','whl','nupkg',
  'woff','woff2','wasm'
]);

const MAX_DEFLATE_FILE_BYTES = 24 * 1024 * 1024; // Files > 24 MB use zero-copy disk-backed STORE
const ZIP64_LIMIT = 0xFFFFFFFF;
const ZIP64_COUNT_LIMIT = 0xFFFF;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

// Slicing-by-8 lookup tables for fast JS fallback and WASM table initialization
const CRC_TABLES = (() => {
  const t = Array.from({ length: 8 }, () => new Uint32Array(256));
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[0][i] = c >>> 0;
  }
  for (let n = 1; n < 8; n++) {
    for (let i = 0; i < 256; i++) {
      const c = t[n - 1][i];
      t[n][i] = (t[0][c & 0xFF] ^ (c >>> 8)) >>> 0;
    }
  }
  return t;
})();

// Inline WebAssembly CRC-32 accelerator (uses shared linear memory with 1 KB table + 64 KB chunk buffer)
const wasmCrc = (() => {
  try {
    if (typeof WebAssembly !== 'object') return null;
    const bytes = new Uint8Array([
      0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
      0x01,0x07,0x01,0x60,0x02,0x7f,0x7f,0x01,0x7f,
      0x03,0x02,0x01,0x00,
      0x05,0x03,0x01,0x00,0x01,
      0x07,0x12,0x02,0x06,0x6d,0x65,0x6d,0x6f,0x72,0x79,0x02,0x00,0x05,0x63,0x72,0x63,0x33,0x32,0x00,0x00,
      0x0a,0x3c,0x01,0x3a,0x01,0x01,0x7f,
      0x02,0x40,0x03,0x40,
      0x20,0x02,0x20,0x01,0x4f,0x0d,0x01,
      0x20,0x00,0x41,0x08,0x76,
      0x20,0x00,0x20,0x02,0x41,0x80,0x08,0x6a,0x2d,0x00,0x00,0x73,0x41,0xff,0x01,0x71,0x41,0x02,0x74,0x28,0x02,0x00,
      0x73,0x21,0x00,
      0x20,0x02,0x41,0x01,0x6a,0x21,0x02,
      0x0c,0x00,0x0b,0x0b,
      0x20,0x00,0x0b
    ]);
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod);
    const mem32 = new Uint32Array(inst.exports.memory.buffer, 0, 256);
    mem32.set(CRC_TABLES[0]);
    const buf8 = new Uint8Array(inst.exports.memory.buffer, 1024, 64512);
    return { fn: inst.exports.crc32, buf8 };
  } catch {
    return null;
  }
})();

export function crc32Update(crc, chunk) {
  let c = (crc ^ 0xFFFFFFFF) >>> 0;
  const len = chunk.length;
  if (wasmCrc && len > 0) {
    const { fn, buf8 } = wasmCrc;
    const step = buf8.length;
    for (let pos = 0; pos < len; pos += step) {
      const sub = chunk.subarray(pos, Math.min(len, pos + step));
      buf8.set(sub);
      c = fn(c, sub.length) >>> 0;
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const [t0, t1, t2, t3, t4, t5, t6, t7] = CRC_TABLES;
  let i = 0;
  const limit = len - 7;
  for (; i < limit; i += 8) {
    const lo = (c ^ (chunk[i] | (chunk[i + 1] << 8) | (chunk[i + 2] << 16) | (chunk[i + 3] << 24))) >>> 0;
    const hi = (chunk[i + 4] | (chunk[i + 5] << 8) | (chunk[i + 6] << 16) | (chunk[i + 7] << 24)) >>> 0;
    c = (t7[lo & 0xFF] ^ t6[(lo >>> 8) & 0xFF] ^ t5[(lo >>> 16) & 0xFF] ^ t4[lo >>> 24] ^
         t3[hi & 0xFF] ^ t2[(hi >>> 8) & 0xFF] ^ t1[(hi >>> 16) & 0xFF] ^ t0[hi >>> 24]) >>> 0;
  }
  for (; i < len; i++) {
    c = (t0[(c ^ chunk[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export async function streamCrc32(blob, onBytes) {
  let crc = 0;
  if (typeof blob.stream === 'function') {
    const reader = blob.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) {
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        crc = crc32Update(crc, bytes);
        onBytes?.(bytes.byteLength);
      }
    }
    return crc >>> 0;
  }
  const chunkSize = 8 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const bytes = new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + chunkSize)).arrayBuffer());
    crc = crc32Update(crc, bytes);
    onBytes?.(bytes.byteLength);
  }
  return crc >>> 0;
}

async function compressDeflateRaw(blob, onBytes) {
  if (typeof CompressionStream !== 'function' || typeof blob.stream !== 'function') return null;
  let crc = 0;
  const source = new ReadableStream({
    async start(controller) {
      const reader = blob.stream().getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.byteLength) {
            const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
            crc = crc32Update(crc, bytes);
            onBytes?.(bytes.byteLength);
            controller.enqueue(bytes);
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    }
  });
  const compressedStream = source.pipeThrough(new CompressionStream('deflate-raw'));
  const reader = compressedStream.getReader();
  const chunks = [];
  let compressedSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      chunks.push(bytes);
      compressedSize += bytes.byteLength;
    }
  }
  return { crc: crc >>> 0, compressedBlob: new Blob(chunks), compressedSize };
}

function dosDateTime(timestamp) {
  const d = new Date(Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now());
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  const dosTime = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F);
  const dosDate = (((year - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { dosTime, dosDate };
}

export function cleanEntryPath(rawPath, fallbackName = 'archivo') {
  const normalized = String(rawPath || fallbackName)
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:\/+/, '')
    .replace(/^\/+/, '');
  const parts = normalized.split('/').filter(part => part && part !== '.' && part !== '..');
  return parts.length ? parts.join('/') : (String(fallbackName || 'archivo').replace(/[\\/:*?"<>|]+/g, '_') || 'archivo');
}

export function inferArchiveName(files) {
  if (!files?.length) return 'convert-archive.zip';
  const relPaths = files
    .map(f => String(f._relativePath || f.webkitRelativePath || '').replace(/\\/g, '/').replace(/^\/+/, ''))
    .filter(p => p.includes('/'));
  if (relPaths.length) {
    const roots = [...new Set(relPaths.map(p => p.split('/')[0]).filter(Boolean))];
    if (roots.length === 1) return `${roots[0]}.zip`;
    return `${roots[0]}-y-${roots.length - 1}-mas.zip`;
  }
  if (files.length === 1) {
    const stem = String(files[0].name || 'archivo').replace(/\.[^.]+$/, '') || 'archivo';
    return `${stem}.zip`;
  }
  const stem = String(files[0].name || 'archivos').replace(/\.[^.]+$/, '') || 'archivos';
  return `${stem}-lote.zip`;
}

function shouldStoreRaw(file) {
  const size = Number(file.size) || 0;
  if (size < 64 || size > MAX_DEFLATE_FILE_BYTES) return true;
  const ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
  return STORE_EXT.has(ext);
}

export async function buildZipArchive(files, onProgress) {
  const list = Array.from(files || []);
  const totalBytes = list.reduce((sum, item) => sum + (Number((item.file || item).size) || 0), 0);
  let processedBytes = 0;

  const usedPaths = new Map();
  const parts = [];
  const entries = [];
  let offset = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const file = item.file || item;
    const rawPath = item.path || file._relativePath || file.webkitRelativePath || file.name || `archivo-${i + 1}`;
    let entryPath = cleanEntryPath(rawPath, file.name || `archivo-${i + 1}`);
    const seenCount = usedPaths.get(entryPath) || 0;
    usedPaths.set(entryPath, seenCount + 1);
    if (seenCount > 0) {
      const dot = entryPath.lastIndexOf('.');
      const slash = entryPath.lastIndexOf('/');
      if (dot > slash + 1) entryPath = `${entryPath.slice(0, dot)} (${seenCount + 1})${entryPath.slice(dot)}`;
      else entryPath = `${entryPath} (${seenCount + 1})`;
    }

    const nameBytes = encoder.encode(entryPath);
    const uncompressedSize = Number(file.size) || 0;
    const { dosTime, dosDate } = dosDateTime(file.lastModified);

    let method = 0;
    let crc = 0;
    let dataBlob = file;
    let compressedSize = uncompressedSize;

    const reportBytes = delta => {
      processedBytes += delta;
      onProgress?.({
        index: i + 1,
        totalFiles: list.length,
        fileName: entryPath,
        processedBytes,
        totalBytes,
        percent: totalBytes > 0 ? Math.min(99, Math.round((processedBytes / totalBytes) * 94) + 3) : Math.round(((i + 1) / list.length) * 95)
      });
    };

    if (!shouldStoreRaw(file)) {
      try {
        const deflated = await compressDeflateRaw(file, reportBytes);
        if (deflated && deflated.compressedSize < uncompressedSize) {
          method = 8;
          crc = deflated.crc;
          dataBlob = deflated.compressedBlob;
          compressedSize = deflated.compressedSize;
        } else if (deflated) {
          crc = deflated.crc;
        } else {
          crc = await streamCrc32(file, reportBytes);
        }
      } catch {
        crc = await streamCrc32(file, reportBytes);
      }
    } else {
      crc = await streamCrc32(file, reportBytes);
    }

    const localZip64 = uncompressedSize >= ZIP64_LIMIT || compressedSize >= ZIP64_LIMIT;
    const localExtra = new Uint8Array(localZip64 ? 20 : 0);
    if (localZip64) {
      const ev = new DataView(localExtra.buffer);
      ev.setUint16(0, 0x0001, true);
      ev.setUint16(2, 16, true);
      ev.setBigUint64(4, BigInt(uncompressedSize), true);
      ev.setBigUint64(12, BigInt(compressedSize), true);
    }

    const localHeader = new Uint8Array(30 + nameBytes.length + localExtra.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, localZip64 ? 45 : 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, method, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc >>> 0, true);
    lv.setUint32(18, localZip64 ? ZIP64_LIMIT : compressedSize, true);
    lv.setUint32(22, localZip64 ? ZIP64_LIMIT : uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, localExtra.length, true);
    localHeader.set(nameBytes, 30);
    if (localExtra.length) localHeader.set(localExtra, 30 + nameBytes.length);

    const localHeaderOffset = offset;
    parts.push(localHeader, dataBlob);
    offset += localHeader.byteLength + compressedSize;

    entries.push({
      nameBytes,
      method,
      dosTime,
      dosDate,
      crc: crc >>> 0,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });
  }

  const cdOffset = offset;
  let cdSize = 0;
  let usesZip64 = entries.length >= ZIP64_COUNT_LIMIT || cdOffset >= ZIP64_LIMIT;

  for (const entry of entries) {
    const needUncomp64 = entry.uncompressedSize >= ZIP64_LIMIT;
    const needComp64 = entry.compressedSize >= ZIP64_LIMIT;
    const needOffset64 = entry.localHeaderOffset >= ZIP64_LIMIT;
    const entryZip64 = needUncomp64 || needComp64 || needOffset64;
    if (entryZip64) usesZip64 = true;

    const extraDataLen = (needUncomp64 ? 8 : 0) + (needComp64 ? 8 : 0) + (needOffset64 ? 8 : 0);
    const cdExtra = new Uint8Array(entryZip64 ? 4 + extraDataLen : 0);
    if (entryZip64) {
      const ev = new DataView(cdExtra.buffer);
      ev.setUint16(0, 0x0001, true);
      ev.setUint16(2, extraDataLen, true);
      let pos = 4;
      if (needUncomp64) { ev.setBigUint64(pos, BigInt(entry.uncompressedSize), true); pos += 8; }
      if (needComp64) { ev.setBigUint64(pos, BigInt(entry.compressedSize), true); pos += 8; }
      if (needOffset64) { ev.setBigUint64(pos, BigInt(entry.localHeaderOffset), true); pos += 8; }
    }

    const cdHeader = new Uint8Array(46 + entry.nameBytes.length + cdExtra.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, entryZip64 ? 45 : 20, true);
    cv.setUint16(6, entryZip64 ? 45 : 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, entry.method, true);
    cv.setUint16(12, entry.dosTime, true);
    cv.setUint16(14, entry.dosDate, true);
    cv.setUint32(16, entry.crc, true);
    cv.setUint32(20, needComp64 ? ZIP64_LIMIT : entry.compressedSize, true);
    cv.setUint32(24, needUncomp64 ? ZIP64_LIMIT : entry.uncompressedSize, true);
    cv.setUint16(28, entry.nameBytes.length, true);
    cv.setUint16(30, cdExtra.length, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, needOffset64 ? ZIP64_LIMIT : entry.localHeaderOffset, true);
    cdHeader.set(entry.nameBytes, 46);
    if (cdExtra.length) cdHeader.set(cdExtra, 46 + entry.nameBytes.length);

    parts.push(cdHeader);
    cdSize += cdHeader.byteLength;
  }

  if (cdSize >= ZIP64_LIMIT) usesZip64 = true;

  if (usesZip64) {
    const zip64EocdOffset = cdOffset + cdSize;
    const z64Eocd = new Uint8Array(56);
    const zv = new DataView(z64Eocd.buffer);
    zv.setUint32(0, 0x06064b50, true);
    zv.setBigUint64(4, 44n, true);
    zv.setUint16(12, 45, true);
    zv.setUint16(14, 45, true);
    zv.setUint32(16, 0, true);
    zv.setUint32(20, 0, true);
    zv.setBigUint64(24, BigInt(entries.length), true);
    zv.setBigUint64(32, BigInt(entries.length), true);
    zv.setBigUint64(40, BigInt(cdSize), true);
    zv.setBigUint64(48, BigInt(cdOffset), true);

    const z64Loc = new Uint8Array(20);
    const lv = new DataView(z64Loc.buffer);
    lv.setUint32(0, 0x07064b50, true);
    lv.setUint32(4, 0, true);
    lv.setBigUint64(8, BigInt(zip64EocdOffset), true);
    lv.setUint32(16, 1, true);

    parts.push(z64Eocd, z64Loc);
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, Math.min(entries.length, ZIP64_COUNT_LIMIT), true);
  ev.setUint16(10, Math.min(entries.length, ZIP64_COUNT_LIMIT), true);
  ev.setUint32(12, Math.min(cdSize, ZIP64_LIMIT), true);
  ev.setUint32(16, Math.min(cdOffset, ZIP64_LIMIT), true);
  ev.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

// Slices only the Central Directory at the end of a ZIP file so even multi-GB ZIPs can be inspected without loading into RAM
export async function inspectZipBlob(file) {
  const size = Number(file.size) || 0;
  const tailLen = Math.min(size, 65557 + 76);
  const tailStart = Math.max(0, size - tailLen);
  const tailBytes = new Uint8Array(await file.slice(tailStart, size).arrayBuffer());
  const tv = new DataView(tailBytes.buffer, tailBytes.byteOffset, tailBytes.byteLength);

  let eocdPos = -1;
  for (let i = tailBytes.byteLength - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) throw Error('Archivo ZIP sin directorio central legible.');

  let cdSize = tv.getUint32(eocdPos + 12, true);
  let cdOffset = tv.getUint32(eocdPos + 16, true);

  if ((cdSize === ZIP64_LIMIT || cdOffset === ZIP64_LIMIT) && eocdPos >= 20) {
    const locPos = eocdPos - 20;
    if (tv.getUint32(locPos, true) === 0x07064b50) {
      const z64Offset = Number(tv.getBigUint64(locPos + 8, true));
      const z64Bytes = new Uint8Array(await file.slice(z64Offset, Math.min(size, z64Offset + 56)).arrayBuffer());
      if (z64Bytes.byteLength >= 56) {
        const zv = new DataView(z64Bytes.buffer, z64Bytes.byteOffset, z64Bytes.byteLength);
        if (zv.getUint32(0, true) === 0x06064b50) {
          cdSize = Number(zv.getBigUint64(40, true));
          cdOffset = Number(zv.getBigUint64(48, true));
        }
      }
    }
  }

  const maxCdRead = Math.min(cdSize, 32 * 1024 * 1024);
  const cdBytes = new Uint8Array(await file.slice(cdOffset, Math.min(size, cdOffset + maxCdRead)).arrayBuffer());
  const cv = new DataView(cdBytes.buffer, cdBytes.byteOffset, cdBytes.byteLength);

  const rows = [['path', 'size_bytes', 'compressed_bytes', 'compression', 'crc32']];
  let pos = 0;
  while (pos + 46 <= cdBytes.byteLength) {
    if (cv.getUint32(pos, true) !== 0x02014b50) break;
    const method = cv.getUint16(pos + 10, true);
    const crc = cv.getUint32(pos + 16, true) >>> 0;
    let compSize = cv.getUint32(pos + 20, true);
    let uncompSize = cv.getUint32(pos + 24, true);
    const nameLen = cv.getUint16(pos + 28, true);
    const extraLen = cv.getUint16(pos + 30, true);
    const commentLen = cv.getUint16(pos + 32, true);
    const name = decoder.decode(cdBytes.subarray(pos + 46, pos + 46 + nameLen));

    if (uncompSize === ZIP64_LIMIT || compSize === ZIP64_LIMIT) {
      let ePos = pos + 46 + nameLen;
      const eEnd = Math.min(cdBytes.byteLength, ePos + extraLen);
      while (ePos + 4 <= eEnd) {
        const tag = cv.getUint16(ePos, true);
        const sz = cv.getUint16(ePos + 2, true);
        if (tag === 0x0001) {
          let zPos = ePos + 4;
          if (uncompSize === ZIP64_LIMIT && zPos + 8 <= ePos + 4 + sz) {
            uncompSize = Number(cv.getBigUint64(zPos, true));
            zPos += 8;
          }
          if (compSize === ZIP64_LIMIT && zPos + 8 <= ePos + 4 + sz) {
            compSize = Number(cv.getBigUint64(zPos, true));
          }
          break;
        }
        ePos += 4 + sz;
      }
    }

    if (!name.endsWith('/')) {
      rows.push([
        name,
        String(uncompSize),
        String(compSize),
        method === 0 ? 'STORE' : method === 8 ? 'DEFLATE' : `METHOD_${method}`,
        crc.toString(16).padStart(8, '0')
      ]);
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return {
    rows,
    text: rows.map(r => r.join('\t')).join('\n')
  };
}

// Extracts all files recursively from a DataTransfer event (supports nested folders with >100 entries per dir)
export async function extractDataTransferFiles(dataTransfer) {
  if (!dataTransfer) return { files: [], hasDirectory: false };
  const items = Array.from(dataTransfer.items || []);
  const directFiles = Array.from(dataTransfer.files || []);
  const entries = [];
  let hasDirectory = false;

  for (const item of items) {
    if (item.kind && item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.();
    if (entry) {
      if (entry.isDirectory) hasDirectory = true;
      entries.push(entry);
    } else {
      const f = item.getAsFile?.();
      if (f) entries.push({ isFile: true, isDirectory: false, name: f.name, _file: f });
    }
  }

  if (!entries.length) return { files: directFiles, hasDirectory: false };

  const collected = [];

  async function readAllEntries(reader) {
    const all = [];
    while (true) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject)).catch(() => []);
      if (!batch || !batch.length) break;
      all.push(...batch);
    }
    return all;
  }

  async function walk(entry, prefix = '') {
    if (!entry) return;
    if (entry._file) {
      collected.push(entry._file);
      return;
    }
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject)).catch(() => null);
      if (file) {
        const relPath = prefix ? `${prefix}/${file.name}` : (entry.fullPath ? entry.fullPath.replace(/^\/+/, '') : '');
        if (relPath && relPath.includes('/')) {
          try { Object.defineProperty(file, '_relativePath', { value: relPath, configurable: true }); } catch {}
        }
        collected.push(file);
      }
      return;
    }
    if (entry.isDirectory) {
      hasDirectory = true;
      const dirName = prefix ? `${prefix}/${entry.name}` : entry.name;
      const children = await readAllEntries(entry.createReader());
      for (const child of children) {
        await walk(child, dirName);
      }
    }
  }

  for (const entry of entries) {
    await walk(entry, '');
  }

  return { files: collected.length ? collected : directFiles, hasDirectory };
}

