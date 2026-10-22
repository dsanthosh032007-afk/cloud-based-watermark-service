/**
 * ============================================================================
 * Cloud Digital Watermarking Service - Client-side Processing
 * College Mini-Project (Vanilla JavaScript & HTML5 Canvas API)
 * ============================================================================
 * 
 * Technical Implementation:
 * - HTML5 Canvas 2D Rendering Context (ctx.drawImage, ctx.fillText, ctx.transform)
 * - 100% Client-Side In-Memory Processing (FileReader API)
 * - Lossless PNG Export via canvas.toDataURL('image/png')
 * - Position Calculations (Top/Bottom/Center corners & Tiled Diagonal Matrix)
 * - Live Session Activity Logging
 * ============================================================================
 */

'use strict';

/* --------------------------------------------------------------------------
   1. APPLICATION STATE
   -------------------------------------------------------------------------- */
const state = {
  currentImage: null,        // HTMLImageElement of loaded source
  fileName: '',              // Original file name
  fileSize: '',              // Formatted file size
  fileDimensions: '',        // 'Width x Height'
  viewMode: 'watermarked',   // 'watermarked' | 'original'
  isWatermarked: false,
  logs: []                   // Session activity entries
};

/* --------------------------------------------------------------------------
   2. DOM ELEMENT REFERENCES
   -------------------------------------------------------------------------- */
const el = {
  // Upload & File Info
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  fileInfoBox: document.getElementById('fileInfoBox'),
  fileName: document.getElementById('fileName'),
  fileMeta: document.getElementById('fileMeta'),
  btnRemoveImage: document.getElementById('btnRemoveImage'),

  // Controls Form
  watermarkText: document.getElementById('watermarkText'),
  watermarkPosition: document.getElementById('watermarkPosition'),
  fontSizeSlider: document.getElementById('fontSizeSlider'),
  fontSizeDisplay: document.getElementById('fontSizeDisplay'),
  opacitySlider: document.getElementById('opacitySlider'),
  opacityDisplay: document.getElementById('opacityDisplay'),
  rotationSlider: document.getElementById('rotationSlider'),
  rotationDisplay: document.getElementById('rotationDisplay'),
  watermarkColor: document.getElementById('watermarkColor'),
  colorHexText: document.getElementById('colorHexText'),
  enableShadow: document.getElementById('enableShadow'),
  presetPills: document.querySelectorAll('.preset-pill'),

  // Action Buttons
  btnApplyWatermark: document.getElementById('btnApplyWatermark'),
  btnDownload: document.getElementById('btnDownload'),
  btnLoadSample: document.getElementById('btnLoadSample'),
  btnEmptySampleTrigger: document.getElementById('btnEmptySampleTrigger'),
  btnResetAll: document.getElementById('btnResetAll'),

  // Preview Stage
  canvasEmptyState: document.getElementById('canvasEmptyState'),
  processingCanvas: document.getElementById('processingCanvas'),
  originalImgDisplay: document.getElementById('originalImgDisplay'),
  canvasResolutionTag: document.getElementById('canvasResolutionTag'),
  watermarkStatusTag: document.getElementById('watermarkStatusTag'),
  tabWatermarked: document.getElementById('tabWatermarked'),
  tabOriginal: document.getElementById('tabOriginal'),

  // Activity Log
  activityLogList: document.getElementById('activityLogList'),
  btnClearLog: document.getElementById('btnClearLog'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

/* --------------------------------------------------------------------------
   3. ACTIVITY LOGGING
   -------------------------------------------------------------------------- */
function addLog(actionDescription) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const logItem = {
    id: 'log_' + Date.now(),
    time: timeStr,
    desc: actionDescription
  };

  state.logs.unshift(logItem);
  renderActivityLogs();
}

function renderActivityLogs() {
  el.activityLogList.innerHTML = '';

  if (state.logs.length === 0) {
    el.activityLogList.innerHTML = `
      <li class="log-item" style="justify-content: center; color: var(--text-muted);">
        No activity recorded in this session.
      </li>
    `;
    return;
  }

  state.logs.forEach(item => {
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `
      <span class="log-time">[${item.time}]</span>
      <span class="log-desc">${item.desc}</span>
    `;
    el.activityLogList.appendChild(li);
  });
}

function clearActivityLogs() {
  state.logs = [];
  renderActivityLogs();
  showToast('Activity log cleared.', 'info');
}

/* --------------------------------------------------------------------------
   4. IMAGE LOADING & VALIDATION
   -------------------------------------------------------------------------- */
/**
 * Processes an uploaded File object (JPG, JPEG, PNG).
 */
function handleFileSelection(file) {
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    showToast('Unsupported format! Please upload a JPG, JPEG, or PNG image.', 'danger');
    return;
  }

  // Check file size limit (e.g. 15MB for browser responsiveness)
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast('File too large! Please upload an image under 15MB.', 'danger');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Store state
      state.currentImage = img;
      state.fileName = file.name;
      state.fileSize = formatFileSize(file.size);
      state.fileDimensions = `${img.naturalWidth} × ${img.naturalHeight}`;

      // Update UI displays
      el.fileName.textContent = file.name;
      el.fileMeta.textContent = `${state.fileDimensions} • ${state.fileSize}`;
      el.fileInfoBox.style.display = 'flex';
      el.canvasResolutionTag.textContent = `Resolution: ${state.fileDimensions}`;
      el.originalImgDisplay.src = e.target.result;

      // Adjust default font size proportionally to image resolution
      const proportionalSize = Math.max(18, Math.min(100, Math.round(img.naturalWidth / 30)));
      el.fontSizeSlider.value = proportionalSize;
      el.fontSizeDisplay.textContent = `${proportionalSize}px`;

      // Render onto canvas
      renderWatermarkedCanvas();

      // Enable Download button
      el.btnDownload.disabled = false;

      // Switch to watermarked view
      setViewMode('watermarked');

      addLog(`Loaded image <strong>${escapeHtml(file.name)}</strong> (${state.fileDimensions}, ${state.fileSize})`);
      showToast('Image loaded successfully!', 'success');
    };

    img.onerror = () => {
      showToast('Failed to load image file. Please try another file.', 'danger');
    };

    img.src = e.target.result;
  };

  reader.onerror = () => {
    showToast('Error reading image file from disk.', 'danger');
  };

  reader.readAsDataURL(file);
}

/**
 * Procedurally generates a realistic sample certificate/document image
 * so the evaluator can test immediately without searching their hard drive!
 */
function loadSampleImage() {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 1200;
  sampleCanvas.height = 800;
  const sCtx = sampleCanvas.getContext('2d');

  // Background Gradient
  const bgGrad = sCtx.createLinearGradient(0, 0, 1200, 800);
  bgGrad.addColorStop(0, '#1e293b');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#1e1b4b');
  sCtx.fillStyle = bgGrad;
  sCtx.fillRect(0, 0, 1200, 800);

  // Decorative border
  sCtx.strokeStyle = '#38bdf8';
  sCtx.lineWidth = 12;
  sCtx.strokeRect(30, 30, 1140, 740);

  sCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  sCtx.lineWidth = 2;
  sCtx.strokeRect(45, 45, 1110, 710);

  // Certificate Header
  sCtx.fillStyle = '#f8fafc';
  sCtx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
  sCtx.textAlign = 'center';
  sCtx.fillText('CERTIFICATE OF ACADEMIC ACHIEVEMENT', 600, 180);

  sCtx.fillStyle = '#38bdf8';
  sCtx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING', 600, 230);

  // Line Divider
  sCtx.strokeStyle = '#38bdf8';
  sCtx.lineWidth = 3;
  sCtx.beginPath();
  sCtx.moveTo(400, 260);
  sCtx.lineTo(800, 260);
  sCtx.stroke();

  // Body Text
  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '20px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('This document certifies the successful completion and demonstration of the', 600, 340);
  
  sCtx.fillStyle = '#e2e8f0';
  sCtx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('"Cloud Digital Watermarking Service Prototype"', 600, 390);

  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '18px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('Demonstrating HTML5 Canvas API in-memory cryptographic and visual image protection.', 600, 440);

  // Seal & Meta Details
  sCtx.fillStyle = '#38bdf8';
  sCtx.beginPath();
  sCtx.arc(600, 560, 50, 0, Math.PI * 2);
  sCtx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  sCtx.fill();
  sCtx.strokeStyle = '#38bdf8';
  sCtx.lineWidth = 3;
  sCtx.stroke();

  sCtx.fillStyle = '#38bdf8';
  sCtx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('VERIFIED', 600, 555);
  sCtx.fillText('OFFICIAL', 600, 575);

  sCtx.fillStyle = '#64748b';
  sCtx.font = '14px "JetBrains Mono", monospace';
  sCtx.fillText('DOC-ID: ACAD-WM-2026-X89 &bull; DATE: OCT 2026', 600, 680);

  // Convert to image
  const sampleDataUrl = sampleCanvas.toDataURL('image/png');
  const img = new Image();
  img.onload = () => {
    state.currentImage = img;
    state.fileName = 'academic_sample_certificate.png';
    state.fileSize = '420 KB';
    state.fileDimensions = '1200 × 800';

    el.fileName.textContent = state.fileName;
    el.fileMeta.textContent = `${state.fileDimensions} • ${state.fileSize}`;
    el.fileInfoBox.style.display = 'flex';
    el.canvasResolutionTag.textContent = `Resolution: ${state.fileDimensions}`;
    el.originalImgDisplay.src = sampleDataUrl;

    el.fontSizeSlider.value = 40;
    el.fontSizeDisplay.textContent = '40px';

    renderWatermarkedCanvas();
    el.btnDownload.disabled = false;
    setViewMode('watermarked');

    addLog('Loaded built-in <strong>Sample Academic Certificate</strong> (1200 × 800)');
    showToast('Sample image loaded! Adjust watermark settings as desired.', 'info');
  };
  img.src = sampleDataUrl;
}

/**
 * Removes the current loaded image and resets canvas to empty state.
 */
function removeCurrentImage() {
  state.currentImage = null;
  state.fileName = '';
  state.fileSize = '';
  state.fileDimensions = '';

  el.fileInput.value = '';
  el.fileInfoBox.style.display = 'none';
  el.btnDownload.disabled = true;

  el.processingCanvas.style.display = 'none';
  el.originalImgDisplay.style.display = 'none';
  el.canvasEmptyState.style.display = 'block';

  el.canvasResolutionTag.textContent = 'Resolution: 0 × 0';
  el.watermarkStatusTag.textContent = 'Ready';
  el.watermarkStatusTag.className = 'status-tag status-ready';

  addLog('Removed loaded image from canvas.');
  showToast('Image removed.', 'info');
}

/* --------------------------------------------------------------------------
   5. WATERMARK CANVAS RENDERING ENGINE (HTML5 CANVAS 2D)
   -------------------------------------------------------------------------- */
/**
 * Redraws the original image and bakes the watermark text into the raw pixel canvas.
 */
function renderWatermarkedCanvas() {
  if (!state.currentImage) return;

  const canvas = el.processingCanvas;
  const ctx = canvas.getContext('2d');
  const img = state.currentImage;

  // Set physical pixel dimensions to match image exactly (Lossless 1:1 scale)
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  // 1. Draw base original image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  // 2. Read user settings
  const text = el.watermarkText.value.trim() || '© Copyright';
  const position = el.watermarkPosition.value;
  const fontSize = parseInt(el.fontSizeSlider.value, 10) || 36;
  const opacity = parseInt(el.opacitySlider.value, 10) / 100;
  const rotationDeg = parseInt(el.rotationSlider.value, 10) || 0;
  const color = el.watermarkColor.value || '#ffffff';
  const hasShadow = el.enableShadow.checked;

  // 3. Configure text style
  ctx.font = `bold ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;

  // Shadow / Contrast Outline
  if (hasShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.max(3, fontSize * 0.15);
    ctx.shadowOffsetX = Math.max(1, fontSize * 0.05);
    ctx.shadowOffsetY = Math.max(1, fontSize * 0.05);
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // 4. Render Position
  if (position === 'tiled') {
    renderTiledWatermark(ctx, text, canvas.width, canvas.height, fontSize, rotationDeg);
  } else {
    renderSingleWatermark(ctx, text, position, canvas.width, canvas.height, fontSize, rotationDeg);
  }

  // Reset context alpha & shadow for safety
  ctx.globalAlpha = 1.0;
  ctx.shadowColor = 'transparent';

  // Show canvas
  el.canvasEmptyState.style.display = 'none';
  if (state.viewMode === 'watermarked') {
    el.processingCanvas.style.display = 'block';
    el.originalImgDisplay.style.display = 'none';
  }

  state.isWatermarked = true;
  el.watermarkStatusTag.textContent = 'Watermarked';
  el.watermarkStatusTag.className = 'status-tag status-applied';
}

/**
 * Renders a single watermark at a specified corner or center position.
 */
function renderSingleWatermark(ctx, text, position, width, height, fontSize, rotationDeg) {
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const margin = Math.max(25, fontSize * 0.8);

  let x = 0;
  let y = 0;

  switch (position) {
    case 'top-left':
      x = margin;
      y = margin + fontSize;
      ctx.textAlign = 'left';
      break;

    case 'top-center':
      x = width / 2;
      y = margin + fontSize;
      ctx.textAlign = 'center';
      break;

    case 'top-right':
      x = width - margin;
      y = margin + fontSize;
      ctx.textAlign = 'right';
      break;

    case 'center':
      x = width / 2;
      y = height / 2;
      ctx.textAlign = 'center';
      break;

    case 'bottom-left':
      x = margin;
      y = height - margin;
      ctx.textAlign = 'left';
      break;

    case 'bottom-center':
      x = width / 2;
      y = height - margin;
      ctx.textAlign = 'center';
      break;

    case 'bottom-right':
    default:
      x = width - margin;
      y = height - margin;
      ctx.textAlign = 'right';
      break;
  }

  ctx.save();
  ctx.translate(x, y);
  if (rotationDeg !== 0) {
    ctx.rotate((rotationDeg * Math.PI) / 180);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Renders a repeating diagonal tiled grid watermark across the entire image.
 */
function renderTiledWatermark(ctx, text, width, height, fontSize, rotationDeg) {
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  
  // Grid spacing
  const stepX = textWidth + Math.max(80, fontSize * 2.5);
  const stepY = fontSize * 4;
  const angle = rotationDeg === 0 ? -28 : rotationDeg; // default -28 deg diagonal

  ctx.textAlign = 'center';

  // Tile over an area larger than canvas to ensure full coverage under rotation
  const diagonal = Math.sqrt(width * width + height * height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((angle * Math.PI) / 180);

  for (let y = -diagonal; y <= diagonal; y += stepY) {
    for (let x = -diagonal; x <= diagonal; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
}

/* --------------------------------------------------------------------------
   6. DOWNLOAD & EXPORT FUNCTION
   -------------------------------------------------------------------------- */
/**
 * Serializes modified canvas pixels into a lossless PNG Data URI and triggers download.
 */
function downloadWatermarkedImage() {
  if (!state.currentImage || !state.isWatermarked) {
    showToast('Please upload an image and apply a watermark first.', 'danger');
    return;
  }

  const canvas = el.processingCanvas;

  try {
    const dataUrl = canvas.toDataURL('image/png');
    const baseName = (state.fileName || 'image').replace(/\.[^/.]+$/, '');
    const downloadName = `watermarked_${baseName}.png`;

    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = downloadName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    addLog(`Downloaded watermarked image as <strong>${escapeHtml(downloadName)}</strong> (PNG format)`);
    showToast('Watermarked image downloaded successfully!', 'success');
  } catch (err) {
    console.error('Error generating image download:', err);
    showToast('Error exporting image. Please try again.', 'danger');
  }
}

/* --------------------------------------------------------------------------
   7. VIEW MODE SWITCHING (ORIGINAL VS WATERMARKED)
   -------------------------------------------------------------------------- */
function setViewMode(mode) {
  state.viewMode = mode;

  if (mode === 'watermarked') {
    el.tabWatermarked.classList.add('active');
    el.tabOriginal.classList.remove('active');
    el.tabWatermarked.setAttribute('aria-selected', 'true');
    el.tabOriginal.setAttribute('aria-selected', 'false');

    if (state.currentImage) {
      el.processingCanvas.style.display = 'block';
      el.originalImgDisplay.style.display = 'none';
      el.canvasEmptyState.style.display = 'none';
    }
  } else {
    el.tabOriginal.classList.add('active');
    el.tabWatermarked.classList.remove('active');
    el.tabOriginal.setAttribute('aria-selected', 'true');
    el.tabWatermarked.setAttribute('aria-selected', 'false');

    if (state.currentImage) {
      el.originalImgDisplay.style.display = 'block';
      el.processingCanvas.style.display = 'none';
      el.canvasEmptyState.style.display = 'none';
    }
  }
}

/* --------------------------------------------------------------------------
   8. RESET ALL SETTINGS
   -------------------------------------------------------------------------- */
function resetAllSettings() {
  removeCurrentImage();

  // Reset inputs
  el.watermarkText.value = '© 2026 Academic Project - Confidential';
  el.watermarkPosition.value = 'bottom-right';
  el.fontSizeSlider.value = 36;
  el.fontSizeDisplay.textContent = '36px';
  el.opacitySlider.value = 45;
  el.opacityDisplay.textContent = '45%';
  el.rotationSlider.value = 0;
  el.rotationDisplay.textContent = '0°';
  el.watermarkColor.value = '#ffffff';
  el.colorHexText.textContent = '#FFFFFF';
  el.enableShadow.checked = true;

  addLog('Reset all watermark controls and cleared canvas.');
  showToast('Settings reset to default baseline.', 'info');
}

/* --------------------------------------------------------------------------
   9. FORMATTING & UTILITIES
   -------------------------------------------------------------------------- */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* --------------------------------------------------------------------------
   10. TOAST NOTIFICATIONS
   -------------------------------------------------------------------------- */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2600);
}

/* --------------------------------------------------------------------------
   11. EVENT LISTENERS
   -------------------------------------------------------------------------- */
function setupEventListeners() {
  // 1. Drag & Drop Upload
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.fileInput.click();
    }
  });

  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('drag-active');
  });

  el.dropzone.addEventListener('dragleave', () => {
    el.dropzone.classList.remove('drag-active');
  });

  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  el.btnRemoveImage.addEventListener('click', removeCurrentImage);

  // 2. Sample Image Buttons
  el.btnLoadSample.addEventListener('click', loadSampleImage);
  el.btnEmptySampleTrigger.addEventListener('click', loadSampleImage);

  // 3. Reset All Button
  el.btnResetAll.addEventListener('click', resetAllSettings);

  // 4. Quick Preset Text Pills
  el.presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      el.watermarkText.value = pill.getAttribute('data-text');
      renderWatermarkedCanvas();
      addLog(`Selected preset text: "${escapeHtml(pill.getAttribute('data-text'))}"`);
    });
  });

  // 5. Real-Time Sliders & Inputs
  el.watermarkText.addEventListener('input', () => {
    renderWatermarkedCanvas();
  });

  el.watermarkPosition.addEventListener('change', (e) => {
    renderWatermarkedCanvas();
    addLog(`Changed position to <strong>${e.target.options[e.target.selectedIndex].text}</strong>`);
  });

  el.fontSizeSlider.addEventListener('input', (e) => {
    el.fontSizeDisplay.textContent = `${e.target.value}px`;
    renderWatermarkedCanvas();
  });

  el.opacitySlider.addEventListener('input', (e) => {
    el.opacityDisplay.textContent = `${e.target.value}%`;
    renderWatermarkedCanvas();
  });

  el.rotationSlider.addEventListener('input', (e) => {
    el.rotationDisplay.textContent = `${e.target.value}°`;
    renderWatermarkedCanvas();
  });

  el.watermarkColor.addEventListener('input', (e) => {
    const hex = e.target.value.toUpperCase();
    el.colorHexText.textContent = hex;
    renderWatermarkedCanvas();
  });

  el.enableShadow.addEventListener('change', () => {
    renderWatermarkedCanvas();
  });

  // 6. Explicit "Apply Watermark" Button
  el.btnApplyWatermark.addEventListener('click', () => {
    if (!state.currentImage) {
      showToast('Please upload an image first.', 'warning');
      return;
    }
    renderWatermarkedCanvas();
    setViewMode('watermarked');
    addLog(`Applied watermark: "${escapeHtml(el.watermarkText.value)}" (Opacity: ${el.opacitySlider.value}%, Pos: ${el.watermarkPosition.value})`);
    showToast('Watermark applied to image pixels!', 'success');
  });

  // 7. Download Button
  el.btnDownload.addEventListener('click', downloadWatermarkedImage);

  // 8. View Mode Tabs (Watermarked vs Original)
  el.tabWatermarked.addEventListener('click', () => setViewMode('watermarked'));
  el.tabOriginal.addEventListener('click', () => setViewMode('original'));

  // 9. Clear Activity Log
  el.btnClearLog.addEventListener('click', clearActivityLogs);
}

/* --------------------------------------------------------------------------
   12. APPLICATION BOOTSTRAP
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  addLog('Session initialized. Ready to process image.');
});
