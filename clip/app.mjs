import { icon } from '../shared/icons.mjs';

// Format seconds into MM:SS.SS
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mStr = String(mins).padStart(2, '0');
  const sStr = secs.toFixed(2).padStart(5, '0');
  return `${mStr}:${sStr}`;
}

// Format bytes into readable string
export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

// Sanitize filename for exports
export function getSafeBaseName(filename) {
  if (!filename) return 'clip';
  return filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
}

// Download blob helper
export function downloadBlob(blob, filename) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 200);
}

// Main interactive application logic (runs only in browser)
export function initClipApp() {
  if (typeof document === 'undefined') return;

  // DOM elements
  const dropzone = document.getElementById('dropzone');
  const videoFileInput = document.getElementById('video-file-input');
  const pickVideoBtn = document.getElementById('pick-video');
  const videoInfoPanel = document.getElementById('video-info-panel');
  const toolsPanel = document.getElementById('tools-panel');
  const keyframeSuite = document.getElementById('keyframe-suite');
  const playerEmpty = document.getElementById('player-empty');
  const playerContainer = document.getElementById('player-container');
  const changeVideoBtn = document.getElementById('change-video');

  const sourceVideo = document.getElementById('source-video');
  const videoTitle = document.getElementById('video-title');
  const specResolution = document.getElementById('spec-resolution');
  const specDuration = document.getElementById('spec-duration');
  const specSize = document.getElementById('spec-size');
  const specFrames = document.getElementById('spec-frames');

  // Timeline & Transport
  const timelineSlider = document.getElementById('timeline-slider');
  const trimRangeVisual = document.getElementById('trim-range-visual');
  const timecodeDisplay = document.getElementById('timecode-display');
  const frameCounter = document.getElementById('frame-counter');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const stepBackBtn = document.getElementById('step-back-btn');
  const stepFwdBtn = document.getElementById('step-fwd-btn');
  const loopBtn = document.getElementById('loop-btn');

  // Trim inputs
  const trimStartInput = document.getElementById('trim-start-input');
  const trimEndInput = document.getElementById('trim-end-input');
  const setInPointBtn = document.getElementById('set-in-point');
  const setOutPointBtn = document.getElementById('set-out-point');
  const trimDurationBadge = document.getElementById('trim-duration-badge');
  const resetTrimBtn = document.getElementById('reset-trim');

  // Speed & Audio
  const speedSelect = document.getElementById('speed-select');
  const toggleMuteBtn = document.getElementById('toggle-mute');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeVal = document.getElementById('volume-val');

  // Transforms
  const rotateLeftBtn = document.getElementById('rotate-left-btn');
  const rotateRightBtn = document.getElementById('rotate-right-btn');
  const flipHBtn = document.getElementById('flip-h-btn');
  const resetTransformBtn = document.getElementById('reset-transform-btn');

  // Export video
  const exportVideoBtn = document.getElementById('export-video-btn');
  const exportVideoProgress = document.getElementById('export-video-progress');
  const exportVideoStatus = document.getElementById('export-video-status');

  // Keyframes
  const firstFrameCanvas = document.getElementById('first-frame-canvas');
  const currentFrameCanvas = document.getElementById('current-frame-canvas');
  const lastFrameCanvas = document.getElementById('last-frame-canvas');
  const firstFrameTime = document.getElementById('first-frame-time');
  const currentFrameTime = document.getElementById('current-frame-time');
  const lastFrameTime = document.getElementById('last-frame-time');
  const firstFrameLoading = document.getElementById('first-frame-loading');
  const lastFrameLoading = document.getElementById('last-frame-loading');

  const copyFirstFrameBtn = document.getElementById('copy-first-frame');
  const downloadFirstFrameBtn = document.getElementById('download-first-frame');
  const seekFirstFrameBtn = document.getElementById('seek-first-frame');

  const copyCurrentFrameBtn = document.getElementById('copy-current-frame');
  const downloadCurrentFrameBtn = document.getElementById('download-current-frame');

  const copyLastFrameBtn = document.getElementById('copy-last-frame');
  const downloadLastFrameBtn = document.getElementById('download-last-frame');
  const seekLastFrameBtn = document.getElementById('seek-last-frame');

  const downloadBothFramesBtn = document.getElementById('download-both-frames');
  const quickCopyBtn = document.getElementById('quick-copy-btn');
  const quickSnapBtn = document.getElementById('quick-snap-btn');

  // State
  let currentFile = null;
  let videoObjectUrl = null;
  let duration = 0;
  let trimStart = 0;
  let trimEnd = 0;
  let rotation = 0; // 0, 90, 180, 270
  let flipH = false;
  let isLooping = true;
  let isExporting = false;
  const ESTIMATED_FPS = 30;

  // Show toast notification
  function showToast(message) {
    const existing = document.querySelector('.toast-notice');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // Inject Lucide icons into DOM
  function setupIcons() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      const iconName = el.getAttribute('data-icon');
      el.innerHTML = icon(iconName);
    });
    document.querySelectorAll('[data-button-icon]').forEach(btn => {
      const iconName = btn.getAttribute('data-button-icon');
      const span = document.createElement('span');
      span.innerHTML = icon(iconName, 'ui-icon');
      btn.prepend(span);
    });
  }

  // Load Video File
  async function loadVideoFile(file) {
    if (!file) return;
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }

    currentFile = file;
    videoObjectUrl = URL.createObjectURL(file);
    sourceVideo.src = videoObjectUrl;
    videoTitle.textContent = file.name;
    specSize.textContent = formatBytes(file.size);

    sourceVideo.onloadedmetadata = async () => {
      duration = sourceVideo.duration || 0;
      trimStart = 0;
      trimEnd = duration;

      specResolution.textContent = `${sourceVideo.videoWidth} × ${sourceVideo.videoHeight}`;
      specDuration.textContent = formatTime(duration);
      specFrames.textContent = `~${Math.round(duration * ESTIMATED_FPS)} fotogramas`;

      trimStartInput.max = duration;
      trimEndInput.max = duration;
      trimStartInput.value = '0.00';
      trimEndInput.value = duration.toFixed(2);
      timelineSlider.max = duration;
      timelineSlider.value = 0;

      dropzone.hidden = true;
      videoInfoPanel.hidden = false;
      toolsPanel.hidden = false;
      keyframeSuite.hidden = false;
      playerEmpty.hidden = true;
      playerContainer.hidden = false;

      updateTrimUI();
      updatePlaybackUI();

      // Extract First & Last frame thumbnails
      await extractFirstAndLastFrames();
      updateCurrentFramePreview();
    };
  }

  // Update Trim UI indicators
  function updateTrimUI() {
    const trimDuration = Math.max(0, trimEnd - trimStart);
    trimDurationBadge.textContent = `Duración corte: ${formatTime(trimDuration)}`;

    const leftPercent = duration > 0 ? (trimStart / duration) * 100 : 0;
    const rightPercent = duration > 0 ? (1 - trimEnd / duration) * 100 : 0;
    trimRangeVisual.style.left = `${leftPercent}%`;
    trimRangeVisual.style.right = `${rightPercent}%`;
  }

  // Update Playback UI
  function updatePlaybackUI() {
    const current = sourceVideo.currentTime || 0;
    timelineSlider.value = current;
    timecodeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    const currentFrame = Math.round(current * ESTIMATED_FPS);
    const totalFrames = Math.round(duration * ESTIMATED_FPS);
    frameCounter.textContent = `Frame ${currentFrame} / ${totalFrames}`;

    if (sourceVideo.paused) {
      playPauseBtn.textContent = '▶ Reproducir';
    } else {
      playPauseBtn.textContent = '⏸ Pausar';
    }
  }

  // Apply transforms to video preview
  function applyTransforms() {
    let transformStr = `rotate(${rotation}deg)`;
    if (flipH) transformStr += ' scaleX(-1)';
    sourceVideo.style.transform = transformStr;
  }

  // Capture frame at native resolution onto an offscreen canvas
  function captureFrame(video, applyOrientation = true) {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    const offscreen = document.createElement('canvas');

    if (applyOrientation && (rotation === 90 || rotation === 270)) {
      offscreen.width = h;
      offscreen.height = w;
    } else {
      offscreen.width = w;
      offscreen.height = h;
    }

    const ctx = offscreen.getContext('2d');
    ctx.save();

    if (applyOrientation) {
      ctx.translate(offscreen.width / 2, offscreen.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      ctx.drawImage(video, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    ctx.restore();
    return offscreen;
  }

  // Seek an auxiliary video element to capture a timestamp without moving playback
  async function captureFrameAtTime(targetTime) {
    return new Promise((resolve) => {
      const aux = document.createElement('video');
      aux.src = videoObjectUrl;
      aux.muted = true;
      aux.playsInline = true;
      aux.currentTime = Math.max(0, Math.min(targetTime, duration));

      aux.onseeked = () => {
        const canvas = captureFrame(aux, true);
        resolve(canvas);
      };
      aux.onerror = () => {
        resolve(null);
      };
    });
  }

  // Extract First and Last frames
  async function extractFirstAndLastFrames() {
    firstFrameLoading.hidden = false;
    lastFrameLoading.hidden = false;

    // First frame at t = 0.02
    const firstCanvas = await captureFrameAtTime(0.02);
    if (firstCanvas) {
      drawToDisplayCanvas(firstCanvas, firstFrameCanvas);
      firstFrameTime.textContent = formatTime(0);
    }
    firstFrameLoading.hidden = true;

    // Last frame at t = duration - 0.05
    const lastTime = Math.max(0, duration - 0.05);
    const lastCanvas = await captureFrameAtTime(lastTime);
    if (lastCanvas) {
      drawToDisplayCanvas(lastCanvas, lastFrameCanvas);
      lastFrameTime.textContent = formatTime(lastTime);
    }
    lastFrameLoading.hidden = true;
  }

  // Draw to responsive thumbnail canvas
  function drawToDisplayCanvas(source, targetCanvas) {
    targetCanvas.width = source.width;
    targetCanvas.height = source.height;
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(source, 0, 0);
  }

  // Update current frame preview canvas
  function updateCurrentFramePreview() {
    if (!sourceVideo || sourceVideo.readyState < 2) return;
    const canvas = captureFrame(sourceVideo, true);
    drawToDisplayCanvas(canvas, currentFrameCanvas);
    currentFrameTime.textContent = formatTime(sourceVideo.currentTime);
  }

  // Copy canvas to clipboard
  async function copyCanvasToClipboard(canvas, label = 'Fotograma') {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar imagen');

      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast(`${label} copiado al portapapeles`);
        return true;
      } else {
        downloadBlob(blob, `${label.toLowerCase().replace(/\s+/g, '_')}.png`);
        showToast(`${label} descargado (portapapeles restringido)`);
        return false;
      }
    } catch (err) {
      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, `${label.toLowerCase().replace(/\s+/g, '_')}.png`);
      }, 'image/png');
      showToast(`${label} guardado como archivo`);
      return false;
    }
  }

  // Trigger frame download
  async function downloadFrameFromTime(targetTime, filenameSuffix) {
    const canvas = await captureFrameAtTime(targetTime);
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (blob) {
        const base = getSafeBaseName(currentFile?.name);
        downloadBlob(blob, `${base}-${filenameSuffix}.png`);
        showToast(`Descargando ${filenameSuffix}...`);
      }
    }, 'image/png');
  }

  // Step video by 1 frame forward or backward
  function stepFrame(forward = true) {
    const step = 1 / ESTIMATED_FPS;
    sourceVideo.pause();
    sourceVideo.currentTime = Math.max(0, Math.min(duration, sourceVideo.currentTime + (forward ? step : -step)));
  }

  // Export Video using MediaRecorder and Canvas
  async function exportTrimmedVideo() {
    if (isExporting || !sourceVideo) return;
    isExporting = true;
    exportVideoBtn.disabled = true;
    exportVideoProgress.hidden = false;
    exportVideoProgress.value = 0;
    exportVideoStatus.textContent = 'Procesando fotogramas de video...';

    const w = sourceVideo.videoWidth || 640;
    const h = sourceVideo.videoHeight || 360;
    const exportCanvas = document.createElement('canvas');

    if (rotation === 90 || rotation === 270) {
      exportCanvas.width = h;
      exportCanvas.height = w;
    } else {
      exportCanvas.width = w;
      exportCanvas.height = h;
    }

    const ctx = exportCanvas.getContext('2d');
    const stream = exportCanvas.captureStream(30);

    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const base = getSafeBaseName(currentFile?.name);
      downloadBlob(blob, `${base}-recorte.webm`);
      exportVideoProgress.hidden = true;
      exportVideoStatus.textContent = '¡Video exportado y descargado!';
      exportVideoBtn.disabled = false;
      isExporting = false;
      sourceVideo.pause();
      sourceVideo.currentTime = trimStart;
    };

    sourceVideo.currentTime = trimStart;
    await new Promise(r => { sourceVideo.onseeked = r; });

    recorder.start();
    sourceVideo.play();

    const renderLoop = () => {
      if (!isExporting) return;
      ctx.save();
      ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
      ctx.translate(exportCanvas.width / 2, exportCanvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      ctx.drawImage(sourceVideo, -w / 2, -h / 2, w, h);
      ctx.restore();

      const progress = ((sourceVideo.currentTime - trimStart) / (trimEnd - trimStart)) * 100;
      exportVideoProgress.value = Math.max(0, Math.min(100, progress));

      if (sourceVideo.currentTime >= trimEnd || sourceVideo.ended) {
        recorder.stop();
      } else {
        requestAnimationFrame(renderLoop);
      }
    };

    requestAnimationFrame(renderLoop);
  }

  // Setup Event Handlers
  function setupEvents() {
    pickVideoBtn.addEventListener('click', () => videoFileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== pickVideoBtn) videoFileInput.click();
    });
    videoFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) loadVideoFile(e.target.files[0]);
    });
    changeVideoBtn.addEventListener('click', () => videoFileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadVideoFile(e.dataTransfer.files[0]);
      }
    });

    window.addEventListener('paste', (e) => {
      if (!e.clipboardData || !e.clipboardData.items) return;
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (file) loadVideoFile(file);
          break;
        }
      }
    });

    sourceVideo.addEventListener('timeupdate', () => {
      if (!isExporting) {
        updatePlaybackUI();
        updateCurrentFramePreview();

        if (isLooping && sourceVideo.currentTime >= trimEnd) {
          sourceVideo.currentTime = trimStart;
          sourceVideo.play();
        }
      }
    });

    sourceVideo.addEventListener('ended', () => {
      if (isLooping && !isExporting) {
        sourceVideo.currentTime = trimStart;
        sourceVideo.play();
      } else {
        updatePlaybackUI();
      }
    });

    timelineSlider.addEventListener('input', (e) => {
      sourceVideo.currentTime = parseFloat(e.target.value);
      updatePlaybackUI();
      updateCurrentFramePreview();
    });

    playPauseBtn.addEventListener('click', () => {
      if (sourceVideo.paused) {
        if (sourceVideo.currentTime >= trimEnd) sourceVideo.currentTime = trimStart;
        sourceVideo.play();
      } else {
        sourceVideo.pause();
      }
      updatePlaybackUI();
    });

    stepBackBtn.addEventListener('click', () => stepFrame(false));
    stepFwdBtn.addEventListener('click', () => stepFrame(true));

    loopBtn.addEventListener('click', () => {
      isLooping = !isLooping;
      loopBtn.setAttribute('aria-pressed', isLooping);
      loopBtn.classList.toggle('is-active', isLooping);
    });

    setInPointBtn.addEventListener('click', () => {
      trimStart = Math.min(sourceVideo.currentTime, trimEnd);
      trimStartInput.value = trimStart.toFixed(2);
      updateTrimUI();
      showToast(`Punto de inicio fijado: ${formatTime(trimStart)}`);
    });

    setOutPointBtn.addEventListener('click', () => {
      trimEnd = Math.max(sourceVideo.currentTime, trimStart);
      trimEndInput.value = trimEnd.toFixed(2);
      updateTrimUI();
      showToast(`Punto de fin fijado: ${formatTime(trimEnd)}`);
    });

    trimStartInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value) || 0;
      trimStart = Math.max(0, Math.min(val, trimEnd));
      trimStartInput.value = trimStart.toFixed(2);
      updateTrimUI();
    });

    trimEndInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value) || duration;
      trimEnd = Math.min(duration, Math.max(val, trimStart));
      trimEndInput.value = trimEnd.toFixed(2);
      updateTrimUI();
    });

    resetTrimBtn.addEventListener('click', () => {
      trimStart = 0;
      trimEnd = duration;
      trimStartInput.value = '0.00';
      trimEndInput.value = duration.toFixed(2);
      updateTrimUI();
      showToast('Rango de corte restablecido a video completo');
    });

    speedSelect.addEventListener('change', (e) => {
      sourceVideo.playbackRate = parseFloat(e.target.value);
    });

    toggleMuteBtn.addEventListener('click', () => {
      sourceVideo.muted = !sourceVideo.muted;
      toggleMuteBtn.setAttribute('aria-pressed', sourceVideo.muted);
      toggleMuteBtn.textContent = sourceVideo.muted ? 'Silenciado' : 'Audio activado';
      toggleMuteBtn.classList.toggle('is-active', sourceVideo.muted);
    });

    volumeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      sourceVideo.volume = val / 100;
      volumeVal.textContent = `${val}%`;
      if (val === 0) {
        sourceVideo.muted = true;
        toggleMuteBtn.textContent = 'Silenciado';
      } else if (sourceVideo.muted) {
        sourceVideo.muted = false;
        toggleMuteBtn.textContent = 'Audio activado';
      }
    });

    rotateLeftBtn.addEventListener('click', () => {
      rotation = (rotation - 90 + 360) % 360;
      applyTransforms();
      updateCurrentFramePreview();
    });

    rotateRightBtn.addEventListener('click', () => {
      rotation = (rotation + 90) % 360;
      applyTransforms();
      updateCurrentFramePreview();
    });

    flipHBtn.addEventListener('click', () => {
      flipH = !flipH;
      applyTransforms();
      updateCurrentFramePreview();
    });

    resetTransformBtn.addEventListener('click', () => {
      rotation = 0;
      flipH = false;
      applyTransforms();
      updateCurrentFramePreview();
    });

    copyFirstFrameBtn.addEventListener('click', () => {
      copyCanvasToClipboard(firstFrameCanvas, 'Primer fotograma');
    });

    downloadFirstFrameBtn.addEventListener('click', () => {
      downloadFrameFromTime(0.02, 'primer-fotograma');
    });

    seekFirstFrameBtn.addEventListener('click', () => {
      sourceVideo.currentTime = trimStart;
      sourceVideo.pause();
      updatePlaybackUI();
    });

    copyCurrentFrameBtn.addEventListener('click', () => {
      const canvas = captureFrame(sourceVideo, true);
      copyCanvasToClipboard(canvas, `Fotograma (${formatTime(sourceVideo.currentTime)})`);
    });

    downloadCurrentFrameBtn.addEventListener('click', () => {
      const canvas = captureFrame(sourceVideo, true);
      canvas.toBlob(blob => {
        if (blob) {
          const base = getSafeBaseName(currentFile?.name);
          const timeSlug = formatTime(sourceVideo.currentTime).replace(':', 'm') + 's';
          downloadBlob(blob, `${base}-frame-${timeSlug}.png`);
          showToast('Descargando fotograma actual...');
        }
      }, 'image/png');
    });

    quickCopyBtn.addEventListener('click', () => {
      const canvas = captureFrame(sourceVideo, true);
      copyCanvasToClipboard(canvas, 'Fotograma en pantalla');
    });

    quickSnapBtn.addEventListener('click', () => {
      downloadCurrentFrameBtn.click();
    });

    copyLastFrameBtn.addEventListener('click', () => {
      copyCanvasToClipboard(lastFrameCanvas, 'Último fotograma');
    });

    downloadLastFrameBtn.addEventListener('click', () => {
      downloadFrameFromTime(Math.max(0, duration - 0.05), 'ultimo-fotograma');
    });

    seekLastFrameBtn.addEventListener('click', () => {
      sourceVideo.currentTime = Math.max(0, trimEnd - 0.05);
      sourceVideo.pause();
      updatePlaybackUI();
    });

    downloadBothFramesBtn.addEventListener('click', async () => {
      showToast('Generando pack de continuidad (Inicio + Fin)...');
      await downloadFrameFromTime(0.02, 'primer-fotograma');
      setTimeout(async () => {
        await downloadFrameFromTime(Math.max(0, duration - 0.05), 'ultimo-fotograma');
      }, 600);
    });

    exportVideoBtn.addEventListener('click', exportTrimmedVideo);

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        playPauseBtn.click();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(false);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepFrame(true);
      } else if (e.key === '[') {
        e.preventDefault();
        setInPointBtn.click();
      } else if (e.key === ']') {
        e.preventDefault();
        setOutPointBtn.click();
      } else if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          copyCurrentFrameBtn.click();
        }
      } else if (e.key === '1') {
        e.preventDefault();
        seekFirstFrameBtn.click();
      } else if (e.key === '2') {
        e.preventDefault();
        seekLastFrameBtn.click();
      }
    });
  }

  setupIcons();
  setupEvents();
}

// Auto-run if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initClipApp();
}
