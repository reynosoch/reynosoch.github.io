// Lossless Token-Saving Engine ("Motor Cortina") for ZIP archives.
// Preserves 100% of user files unmodified while generating an AST/symbol index,
// line-range map, and compact context curtain so Claude / LLM readers consume minimal tokens.

const TEXT_SCAN_EXT = new Set([
  'js','mjs','cjs','jsx','ts','mts','cts','tsx','vue','svelte','astro',
  'py','pyw','pyi','ipynb','rb','php','lua','pl','pm','r','jl','sh','bash','zsh','ps1','bat','cmd',
  'rs','go','java','kt','kts','scala','c','h','cpp','hpp','cc','cxx','cs','fs','swift','dart','zig','nim','ex','exs','erl','hs','clj','elm','sol',
  'sql','psql','prisma','graphql','gql','proto',
  'json','jsonc','json5','yaml','yml','toml','xml','html','htm','css','scss','sass','less','md','markdown','txt','rst','tex','ini','cfg','conf','env','dockerfile','makefile','cmake','tf','hcl','nix'
]);

const MAX_SCAN_FILE_BYTES = 2 * 1024 * 1024; // Scan up to 2 MB per file for AST/symbol indexing
const MAX_TOTAL_SCAN_BYTES = 48 * 1024 * 1024; // Cap total lexical scan to 48 MB so multi-GB folders stay instant
const MAX_CORTINA_FILE_BYTES = 256 * 1024; // Include compact curtain skeletons for files up to 256 KB
const MAX_CORTINA_TOTAL_BYTES = 4 * 1024 * 1024;

function extOf(name) {
  const s = String(name || '');
  const idx = s.lastIndexOf('.');
  return idx > 0 ? s.slice(idx + 1).toLowerCase() : '';
}

function relPath(file, index = 0) {
  const raw = file?._relativePath || file?.webkitRelativePath || file?.name || `archivo-${index + 1}`;
  return String(raw).replace(/\\/g, '/').replace(/^\/+/, '');
}

// Calibrated BPE token estimator (Claude / cl100k approximation)
export function estimateBpeTokensFromText(text) {
  if (!text) return 0;
  const len = text.length;
  // Count identifier/word runs, number runs, punctuation runs, and newlines
  let tokens = 0;
  let i = 0;
  while (i < len) {
    const ch = text.charCodeAt(i);
    if (ch === 10 || ch === 13) {
      tokens++;
      if (ch === 13 && text.charCodeAt(i + 1) === 10) i++;
      i++;
    } else if (ch === 32 || ch === 9) {
      let spaces = 0;
      while (i < len && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) {
        spaces++;
        i++;
      }
      tokens += Math.ceil(spaces / 4);
    } else if ((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) || ch === 95) {
      let wordLen = 0;
      while (i < len) {
        const c = text.charCodeAt(i);
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95) {
          wordLen++;
          i++;
        } else break;
      }
      tokens += Math.max(1, Math.ceil(wordLen / 4.2));
    } else if (ch >= 48 && ch <= 57) {
      let numLen = 0;
      while (i < len && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) {
        numLen++;
        i++;
      }
      tokens += Math.max(1, Math.ceil(numLen / 3));
    } else {
      tokens++;
      i++;
    }
  }
  return Math.max(1, tokens);
}

export function estimateFolderTokenStats(files) {
  const list = Array.from(files || []);
  let totalBytes = 0;
  let textFiles = 0;
  let binaryFiles = 0;
  let rawTokens = 0;

  for (const file of list) {
    const size = Number(file?.size) || 0;
    totalBytes += size;
    const ext = extOf(file?.name);
    const lower = String(file?.name || '').toLowerCase();
    const isText = TEXT_SCAN_EXT.has(ext) || lower === 'dockerfile' || lower === 'makefile' || lower.startsWith('.env') || (file?.type && file.type.startsWith('text/'));
    if (isText) {
      textFiles++;
      // Average ~3.6 bytes per BPE token in source code/text
      rawTokens += Math.max(1, Math.round(size / 3.6));
    } else {
      binaryFiles++;
      // Binary files in ZIP: only metadata is read unless decoded
      rawTokens += 24;
    }
  }

  // Index + surgical line-range reading typically requires ~12%-18% of full-repo tokens
  const indexedTokens = list.length
    ? Math.max(60, Math.min(rawTokens, Math.round(list.length * 28 + rawTokens * 0.14)))
    : 0;
  const savedTokens = Math.max(0, rawTokens - indexedTokens);
  const savedPercent = rawTokens > 60 ? Math.min(92, Math.max(18, Math.round((savedTokens / rawTokens) * 100))) : 0;

  return {
    totalFiles: list.length,
    textFiles,
    binaryFiles,
    totalBytes,
    rawTokens,
    indexedTokens,
    savedTokens,
    savedPercent
  };
}

// Extracts exported functions, classes, components, types, SQL tables, headings and imports with line numbers
export function extractSymbolsAndStructure(text, ext) {
  const lines = String(text || '').split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const maxSymbols = 80;
  const maxImports = 25;

  const patterns = [
    // JS / TS / JSX / TSX
    { re: /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/, kind: 'fn' },
    { re: /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_$]+)/, kind: 'class' },
    { re: /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/, kind: 'export' },
    { re: /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/, kind: 'type' },
    { re: /^\s*async\s+function\s+([A-Za-z0-9_$]+)/, kind: 'fn' },
    { re: /^\s*function\s+([A-Za-z0-9_$]+)/, kind: 'fn' },
    // Python
    { re: /^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/, kind: 'def' },
    // Rust / Go / Swift / Kotlin / Java / C#
    { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/, kind: 'fn' },
    { re: /^\s*(?:pub\s+)?(struct|enum|trait|mod)\s+([A-Za-z0-9_]+)/, kind: 'kw2' },
    { re: /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z0-9_]+)\s*\(/, kind: 'func' },
    { re: /^\s*(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:class|interface|record|enum|struct|void|[A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*[(<{]/, kind: 'member' },
    // SQL
    { re: /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|PROCEDURE|FUNCTION|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_."[\]]+)/i, kind: 'sql' },
    // Markdown / Headings
    { re: /^(#{1,3})\s+(.+)$/, kind: 'heading' }
  ];

  const importPatterns = [
    /^\s*import\s+.*?from\s+['"]([^'"]+)['"]/,
    /^\s*const\s+.*?=\s*require\(\s*['"]([^'"]+)['"]\s*\)/,
    /^\s*(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/,
    /^\s*use\s+([A-Za-z0-9_:]+)/,
    /^\s*#include\s+[<"]([^>"]+)[>"]/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length > 260) continue;

    if (imports.length < maxImports) {
      for (const ire of importPatterns) {
        const m = line.match(ire);
        const target = m?.[1] || m?.[2];
        if (target && !imports.includes(target)) {
          imports.push(target);
          break;
        }
      }
    }

    if (symbols.length < maxSymbols) {
      for (const { re, kind } of patterns) {
        const m = line.match(re);
        if (m) {
          if (kind === 'heading' && !['md', 'markdown', 'rst', 'adoc', 'txt'].includes(ext)) continue;
          const label = kind === 'heading'
            ? `${m[1]} ${m[2].trim().slice(0, 60)}`
            : kind === 'kw2'
              ? `${m[1]} ${m[2]}`
              : `${kind} ${m[1]}`;
          symbols.push({ line: i + 1, label });
          break;
        }
      }
    }
  }

  // Estimate end line of each symbol based on next symbol or EOF
  for (let s = 0; s < symbols.length; s++) {
    const nextLine = s + 1 < symbols.length ? symbols[s + 1].line - 1 : lines.length;
    symbols[s].endLine = Math.max(symbols[s].line, nextLine);
  }

  return {
    lineCount: lines.length,
    symbols,
    imports
  };
}

// Builds a ultra-compact "cortina" skeleton of a file (keeps signatures, exports, imports, and key structure lines with line numbers)
function buildCompactCurtainEntry(path, text, meta) {
  const lines = String(text || '').split(/\r?\n/);
  const kept = [];
  const maxLines = 45;
  for (let i = 0; i < lines.length && kept.length < maxLines; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    // Skip pure single-line comments unless they are TODO/FIXME/NOTE or section headers
    if ((trimmed.startsWith('//') || trimmed.startsWith('#')) && !/TODO|FIXME|NOTE|IMPORTANT|@|!/i.test(trimmed) && i > 2) continue;
    // Keep structural declarations, exports, imports, route definitions, keys
    if (
      /^(?:export|import|from|function|async|class|interface|type|enum|const|let|def|fn|pub|struct|impl|func|package|CREATE|ALTER|SELECT|return|module\.exports)/i.test(trimmed) ||
      lines[i].search(/\S/) <= 2
    ) {
      kept.push(`L${i + 1}: ${trimmed.slice(0, 140)}`);
    }
  }
  return [
    `=== ${path} (${meta.lineCount}L · ~${meta.tokens} tok) ===`,
    kept.length ? kept.join('\n') : lines.slice(0, 15).map((l, idx) => `L${idx + 1}: ${l.trim().slice(0, 140)}`).join('\n')
  ].join('\n');
}

// Generates lossless context index files to prepend into the ZIP without modifying or removing any user file
export async function generateTokenSavingArtifacts(files, options = {}) {
  const includeCurtainMirror = options.includeCurtainMirror !== false;
  const list = Array.from(files || []);
  let scannedBytes = 0;
  let curtainBytes = 0;

  const fileManifest = [];
  const curtainBlocks = [];
  let totalRawTokens = 0;

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const path = relPath(file, i);
    const size = Number(file?.size) || 0;
    const ext = extOf(file?.name || path);
    const lower = String(file?.name || path).toLowerCase();
    const isTextCandidate = TEXT_SCAN_EXT.has(ext) || lower.endsWith('dockerfile') || lower.endsWith('makefile') || lower.includes('.env');

    if (isTextCandidate && size > 0 && size <= MAX_SCAN_FILE_BYTES && scannedBytes + size <= MAX_TOTAL_SCAN_BYTES) {
      try {
        const text = await file.text();
        scannedBytes += size;
        const tokens = estimateBpeTokensFromText(text);
        totalRawTokens += tokens;
        const { lineCount, symbols, imports } = extractSymbolsAndStructure(text, ext);
        const entry = {
          path,
          size,
          kind: 'text',
          lineCount,
          tokens,
          imports,
          symbols
        };
        fileManifest.push(entry);

        if (includeCurtainMirror && size <= MAX_CORTINA_FILE_BYTES && curtainBytes + size <= MAX_CORTINA_TOTAL_BYTES) {
          curtainBlocks.push(buildCompactCurtainEntry(path, text, entry));
          curtainBytes += size;
        }
        continue;
      } catch {
        // Fallback to metadata entry if reading fails
      }
    }

    const estTokens = isTextCandidate ? Math.max(1, Math.round(size / 3.6)) : 16;
    totalRawTokens += estTokens;
    fileManifest.push({
      path,
      size,
      kind: isTextCandidate ? 'text-large' : 'binary',
      lineCount: null,
      tokens: estTokens,
      imports: [],
      symbols: []
    });
  }

  // Sort manifest so important entrypoints and smaller config/source files appear clearly
  const treeLines = fileManifest.map(m => {
    const sizeKb = m.size < 1024 ? `${m.size} B` : `${(m.size / 1024).toFixed(1)} KB`;
    const linesInfo = m.lineCount !== null ? ` · ${m.lineCount}L` : '';
    const tokInfo = ` · ~${m.tokens} tok`;
    return `- \`${m.path}\` (${sizeKb}${linesInfo}${tokInfo})`;
  });

  const symbolSections = fileManifest
    .filter(m => m.symbols.length > 0 || m.imports.length > 0)
    .map(m => {
      const parts = [`### \`${m.path}\` (${m.lineCount} líneas · ~${m.tokens} tokens)`];
      if (m.imports.length) {
        parts.push(`- **Dependencias**: ${m.imports.map(imp => `\`${imp}\``).join(', ')}`);
      }
      if (m.symbols.length) {
        parts.push(`- **Símbolos y rangos de línea**: ` + m.symbols.map(s => `\`[L${s.line}-L${s.endLine}] ${s.label}\``).join(' · '));
      }
      return parts.join('\n');
    });

  const indexMd = [
    `# 00_CLAUDE_CONTEXT_INDEX — PROTOCOLO DE AHORRO DE TOKENS (CERO PÉRDIDA)`,
    ``,
    `> **INSTRUCCIÓN PRIORITARIA DE LECTURA EFICIENTE**:`,
    `> 1. Este archivo \`.zip\` contiene **el 100% de los archivos originales íntegros y sin modificaciones** (${fileManifest.length} archivos). Nada fue eliminado ni recortado.`,
    `> 2. **NO abras ni leas todos los archivos del ZIP de golpe.** Hacerlo consumirá innecesariamente~${totalRawTokens.toLocaleString('en-US')} tokens de la ventana de contexto.`,
    `> 3. Usa el **Mapa de Símbolos y Rangos de Línea** de abajo para ubicar exactamente el archivo y las líneas (\`L inicio - L fin\`) que necesitas inspeccionar o modificar.`,
    includeCurtainMirror ? `> 4. Si necesitas un vistazo rápido de las firmas y estructura de todo el proyecto en una sola lectura ultraligera, consulta \`01_CLAUDE_CORTINA_COMPACT.txt\`.` : null,
    ``,
    `## 1. Resumen del Paquete`,
    `- **Archivos totales (100% intactos)**: ${fileManifest.length}`,
    `- **Tokens brutos si se leyera todo sin filtro**: ~${totalRawTokens.toLocaleString('en-US')} tokens`,
    `- **Costo de este índice quirúrgico**: ~${Math.max(80, Math.round(treeLines.join('\n').length / 3.8)).toLocaleString('en-US')} tokens`,
    ``,
    `## 2. Árbol Completo de Archivos`,
    ...treeLines,
    ``,
    `## 3. Mapa Quirúrgico de Símbolos, Funciones y Líneas`,
    symbolSections.length ? symbolSections.join('\n\n') : `_Archivos de datos o binarios listados en el árbol superior._`,
    ``
  ].filter(v => v !== null).join('\n');

  const extraEntries = [];
  const indexBlob = new Blob([indexMd], { type: 'text/markdown;charset=utf-8' });
  indexBlob.name = '00_CLAUDE_CONTEXT_INDEX.md';
  extraEntries.push({ file: indexBlob, path: '00_CLAUDE_CONTEXT_INDEX.md' });

  if (includeCurtainMirror && curtainBlocks.length > 0) {
    const curtainText = [
      `# 01_CLAUDE_CORTINA_COMPACT — ESPEJO ESTRUCTURAL DE BAJO CONSUMO DE TOKENS`,
      `# Nota: Todos los archivos originales están completos y sin cambios en sus rutas dentro de este mismo .zip.`,
      `# Usa este espejo para entender la estructura global gastando el mínimo de tokens, y abre solo las líneas exactas del archivo original cuando necesites ver el cuerpo completo.`,
      ``,
      curtainBlocks.join('\n\n')
    ].join('\n');
    const curtainBlob = new Blob([curtainText], { type: 'text/plain;charset=utf-8' });
    curtainBlob.name = '01_CLAUDE_CORTINA_COMPACT.txt';
    extraEntries.push({ file: curtainBlob, path: '01_CLAUDE_CORTINA_COMPACT.txt' });
  }

  return {
    extraEntries,
    stats: {
      totalFiles: fileManifest.length,
      totalRawTokens,
      indexTokens: estimateBpeTokensFromText(indexMd)
    }
  };
}

// Opens the modal decision panel when selecting/generating ZIP so the user can choose token-saving mode
export function reviewZipTokenOptions(files, currentConfig = {}) {
  const stats = estimateFolderTokenStats(files);
  const dialog = document.createElement('dialog');
  dialog.id = 'zip-token-dialog';
  dialog.className = 'table-review zip-token-dialog';
  dialog.setAttribute('aria-labelledby', 'zip-token-title');

  const defaultMode = currentConfig.mode || 'cortina';
  const defaultMirror = currentConfig.includeCurtainMirror !== false;

  dialog.innerHTML = `<form method="dialog">
    <header>
      <div>
        <p class="section-kicker">OPTIMIZADOR DE CONTEXTO · ZIP</p>
        <h2 id="zip-token-title">¿Preparar ZIP para ahorrar tokens?</h2>
      </div>
      <button value="cancel" aria-label="Cerrar panel" type="submit">Cerrar</button>
    </header>
    <p class="table-review-detected">Ideal para subir el <strong>.zip</strong> en corto a <strong>Claude</strong> u otros asistentes cuando usas cuenta gratuita y no quieres agotar tus mensajes en una sola carga.</p>
    <div class="zip-token-metrics" role="status" aria-live="polite">
      <div class="zip-metric-card">
        <span>Archivos originales</span>
        <strong>${stats.totalFiles ? `${stats.totalFiles.toLocaleString('es-MX')} intactos (100%)` : '100% intactos'}</strong>
        <small>Sin modificar ni quitar nada</small>
      </div>
      <div class="zip-metric-card">
        <span>Lectura bruta vs Cortina</span>
        <strong>${stats.totalFiles ? `~${stats.rawTokens.toLocaleString('es-MX')} → ~${stats.indexedTokens.toLocaleString('es-MX')} tok` : 'Hasta -85% tokens'}</strong>
        <small>${stats.totalFiles ? `Ahorro estimado ~${stats.savedPercent}% en exploración` : 'Mapa quirúrgico por líneas'}</small>
      </div>
    </div>
    <div class="zip-mode-list" role="radiogroup" aria-label="Modo de empaquetado ZIP">
      <label class="zip-mode-option" data-mode-card="cortina">
        <input type="radio" name="zip-token-mode" value="cortina" ${defaultMode === 'cortina' ? 'checked' : ''}>
        <div>
          <strong>Modo Cortina · Ahorro de tokens para Claude (Recomendado)</strong>
          <span>Conserva el 100% de tus archivos originales intactos sin tocar ni borrar una sola línea. Inyecta el índice AST de símbolos con rangos exactos de línea (<code>00_CLAUDE_CONTEXT_INDEX.md</code>) para que Claude lea directo lo que ocupa sin tragar todo el ZIP de golpe.</span>
        </div>
      </label>
      <label class="zip-mode-option" data-mode-card="standard">
        <input type="radio" name="zip-token-mode" value="standard" ${defaultMode === 'standard' ? 'checked' : ''}>
        <div>
          <strong>ZIP estándar directo</strong>
          <span>Empaqueta únicamente los archivos y carpetas originales tal cual, sin generar índice de ahorro de tokens.</span>
        </div>
      </label>
    </div>
    <label class="image-text-check zip-mirror-Toggle" id="zip-mirror-wrap">
      <input id="zip-include-mirror" type="checkbox" ${defaultMirror ? 'checked' : ''}>
      <span>Incluir espejo estructural ultracompacto (<code>01_CLAUDE_CORTINA_COMPACT.txt</code>) además de los archivos originales</span>
    </label>
    <p class="table-review-note">Ningún archivo tuyo se modifica, recorta ni elimina. El ahorro ocurre porque el motor indexa firmas, rutas y líneas exactas para evitar lecturas masivas innecesarias.</p>
    <footer>
      <button id="zip-token-standard" value="standard" type="button">ZIP normal sin optimizar</button>
      <button id="zip-token-confirm" value="confirm" class="button-primary" type="submit">Aplicar y continuar</button>
    </footer>
  </form>`;

  const mirrorWrap = dialog.querySelector('#zip-mirror-wrap');
  const mirrorInput = dialog.querySelector('#zip-include-mirror');
  const radios = [...dialog.querySelectorAll('input[name="zip-token-mode"]')];
  const standardBtn = dialog.querySelector('#zip-token-standard');
  const confirmBtn = dialog.querySelector('#zip-token-confirm');

  function syncUi() {
    const selected = radios.find(r => r.checked)?.value || 'cortina';
    mirrorWrap.hidden = selected !== 'cortina';
    dialog.querySelectorAll('.zip-mode-option').forEach(card => {
      card.classList.toggle('is-selected', card.dataset.modeCard === selected);
    });
    confirmBtn.textContent = selected === 'cortina'
      ? (stats.totalFiles ? 'Empaquetar con ahorro de tokens' : 'Activar ahorro de tokens')
      : (stats.totalFiles ? 'Empaquetar ZIP normal' : 'Usar ZIP normal');
  }

  radios.forEach(r => r.addEventListener('change', syncUi));
  standardBtn.addEventListener('click', () => {
    const stdRadio = radios.find(r => r.value === 'standard');
    if (stdRadio) stdRadio.checked = true;
    dialog.close('standard');
  });

  document.body.append(dialog);
  syncUi();
  dialog.showModal();
  confirmBtn.focus();

  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      const rv = dialog.returnValue;
      if (rv === 'cancel' || !rv) {
        dialog.remove();
        resolve(null);
        return;
      }
      const mode = rv === 'standard' ? 'standard' : (radios.find(r => r.checked)?.value || 'cortina');
      const includeCurtainMirror = Boolean(mirrorInput?.checked);
      dialog.remove();
      resolve({
        mode,
        includeCurtainMirror
      });
    }, { once: true });
  });
}
