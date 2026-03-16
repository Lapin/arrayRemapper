import { getState, defaultTransforms, notify } from './state.js';
import { showToast } from './utils.js';
import { autoSave } from './persistence.js';

let modalEl = null;
let currentIdx = null;
let tempTransforms = null;
let tempName = '';

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Open the edit modal for the mapping at the given index.
 */
export function openEditModal(idx) {
  const s = getState();
  const m = s.mappings[idx];
  if (!m || m.isCategory) return;

  currentIdx = idx;
  tempTransforms = m.transforms
    ? { ...m.transforms }
    : { ...defaultTransforms() };
  tempName = m.glyphName || '';

  renderModal();
  document.addEventListener('keydown', onKeydown);
}

function closeModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
  currentIdx = null;
  tempTransforms = null;
  tempName = '';
  document.removeEventListener('keydown', onKeydown);
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    closeModal();
  }
}

function renderModal() {
  // Remove previous modal if any
  if (modalEl) modalEl.remove();

  const s = getState();
  const m = s.mappings[currentIdx];
  const hasSvg = !!m.svgFilename;
  const codepoint = (m.glyphCodepoint || '').toUpperCase();

  let svgSourceText = 'No SVG assigned';
  if (hasSvg) {
    svgSourceText = escHtml(m.svgFilename);
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const modal = document.createElement('div');
  modal.className = 'edit-modal';

  modal.innerHTML = `
    <div class="edit-modal-header">
      <h3>Edit Glyph</h3>
      <button class="edit-modal-close">&times;</button>
    </div>
    <div class="edit-modal-body">
      <div class="edit-modal-top">
        <div class="edit-modal-preview">
          <div class="edit-modal-preview-content" id="editPreviewContent"></div>
          <div class="padding-indicator"></div>
        </div>
        <div class="edit-modal-info">
          <div class="edit-modal-info-row">Codepoint: <strong>U+${escHtml(codepoint)}</strong></div>
          <div class="edit-modal-info-row">SVG Source: <strong>${svgSourceText}</strong></div>
          <div class="edit-modal-info-row">
            <label>Glyph Name:</label>
            <input class="edit-modal-name-input" id="editGlyphName" value="${escHtml(tempName)}">
          </div>
        </div>
      </div>
      <div class="edit-modal-controls">
        <button class="btn-flip" id="btnFlipH" ${!hasSvg ? 'disabled' : ''}>&#8596; Flip H</button>
        <button class="btn-flip" id="btnFlipV" ${!hasSvg ? 'disabled' : ''}>&#8597; Flip V</button>
        <span class="edit-modal-size-label">Size</span>
        <button class="btn-size" id="btnSizeMinus">&minus;</button>
        <span class="edit-modal-size-value" id="sizeValue">${tempTransforms.sizeOffset}</span>
        <button class="btn-size" id="btnSizePlus">+</button>
      </div>
      ${!hasSvg ? '<div class="disabled-note">Flip is not available for font glyphs — assign an SVG to enable.</div>' : ''}
    </div>
    <div class="edit-modal-footer">
      <button class="btn-download-svg" id="btnDownloadSvg">&#11015; Download SVG</button>
      <div style="margin-left:auto;display:flex;gap:8px;">
        <button class="btn btn-secondary" id="btnEditCancel">Cancel</button>
        <button class="btn btn-primary" id="btnEditApply">Apply</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modalEl = overlay;

  // Wire events
  modal.querySelector('.edit-modal-close').addEventListener('click', closeModal);
  modal.querySelector('#btnEditCancel').addEventListener('click', closeModal);
  modal.querySelector('#btnEditApply').addEventListener('click', applyChanges);
  modal.querySelector('#btnDownloadSvg').addEventListener('click', downloadSvg);

  const nameInput = modal.querySelector('#editGlyphName');
  nameInput.addEventListener('input', (e) => {
    tempName = e.target.value;
  });

  if (hasSvg) {
    modal.querySelector('#btnFlipH').addEventListener('click', () => {
      tempTransforms.flipH = !tempTransforms.flipH;
      updatePreview();
    });
    modal.querySelector('#btnFlipV').addEventListener('click', () => {
      tempTransforms.flipV = !tempTransforms.flipV;
      updatePreview();
    });
  }

  modal.querySelector('#btnSizeMinus').addEventListener('click', () => {
    if (tempTransforms.sizeOffset > -4) {
      tempTransforms.sizeOffset--;
      updateSizeDisplay();
      updatePreview();
    }
  });
  modal.querySelector('#btnSizePlus').addEventListener('click', () => {
    if (tempTransforms.sizeOffset < 4) {
      tempTransforms.sizeOffset++;
      updateSizeDisplay();
      updatePreview();
    }
  });

  updatePreview();
}

function updateSizeDisplay() {
  if (!modalEl) return;
  const el = modalEl.querySelector('#sizeValue');
  if (el) el.textContent = tempTransforms.sizeOffset;
}

function updatePreview() {
  if (!modalEl) return;
  const container = modalEl.querySelector('#editPreviewContent');
  if (!container) return;

  const s = getState();
  const m = s.mappings[currentIdx];
  const hasSvg = !!m.svgFilename;

  if (hasSvg) {
    const svgEntry = s.svgEntries.find(e => e.filename === m.svgFilename);
    if (svgEntry) {
      const scaleX = tempTransforms.flipH ? -1 : 1;
      const scaleY = tempTransforms.flipV ? -1 : 1;
      const sizeScale = 1 + tempTransforms.sizeOffset * 0.05;
      container.innerHTML = `<div class="edit-modal-svg-wrap" style="transform: scaleX(${scaleX}) scaleY(${scaleY}) scale(${sizeScale})">${svgEntry.svg}</div>`;
    } else {
      container.innerHTML = '<span style="color:#999;font-size:12px;">SVG not found</span>';
    }
  } else {
    // Show font glyph character
    const codepoint = m.glyphCodepoint;
    const fontFamily = s.fontName ? escHtml(s.fontName) : '';
    const baseFontSize = 80;
    const sizeScale = 1 + tempTransforms.sizeOffset * 0.05;
    const fontSize = Math.round(baseFontSize * sizeScale);
    container.innerHTML = `<div class="edit-modal-glyph-char" style="font-family:'${fontFamily}';font-size:${fontSize}px;">&#x${codepoint};</div>`;
  }
}

function applyChanges() {
  const s = getState();
  const m = s.mappings[currentIdx];
  if (!m) return;

  m.transforms = { ...tempTransforms };
  m.glyphName = tempName;
  autoSave();
  notify();
  closeModal();
  showToast('Glyph updated');
}

function downloadSvg() {
  const s = getState();
  const m = s.mappings[currentIdx];
  if (!m) return;

  const hasSvg = !!m.svgFilename;

  if (hasSvg) {
    downloadMappedSvg(m, s);
  } else {
    downloadFontGlyphSvg(m, s);
  }
}

function downloadMappedSvg(m, s) {
  const svgEntry = s.svgEntries.find(e => e.filename === m.svgFilename);
  if (!svgEntry) {
    showToast('SVG data not found');
    return;
  }

  // Parse SVG and wrap paths with transform group
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgEntry.svg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    showToast('Could not parse SVG');
    return;
  }

  // Build transform string
  const transforms = tempTransforms;
  const parts = [];
  const sizeScale = 1 + transforms.sizeOffset * 0.05;

  // For flip we need to translate to center, scale, translate back
  // SVG viewBox is typically 0 0 24 24
  const vb = svgEl.getAttribute('viewBox') || '0 0 24 24';
  const vbParts = vb.split(/\s+/).map(Number);
  const cx = vbParts[2] / 2;
  const cy = vbParts[3] / 2;

  const scaleX = (transforms.flipH ? -1 : 1) * sizeScale;
  const scaleY = (transforms.flipV ? -1 : 1) * sizeScale;

  const needsTransform = transforms.flipH || transforms.flipV || transforms.sizeOffset !== 0;

  if (needsTransform) {
    // Wrap all children in a <g> with transform
    const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${cx}, ${cy}) scale(${scaleX}, ${scaleY}) translate(${-cx}, ${-cy})`);

    while (svgEl.firstChild) {
      g.appendChild(svgEl.firstChild);
    }
    svgEl.appendChild(g);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgEl);
  triggerDownload(svgString, `${m.glyphName || 'glyph'}.svg`, 'image/svg+xml');
}

function downloadFontGlyphSvg(m, s) {
  // Use opentype.js to extract glyph outline
  if (typeof opentype === 'undefined') {
    showToast('opentype.js not loaded');
    return;
  }

  if (!s.fontFile) {
    showToast('No font loaded');
    return;
  }

  try {
    const font = opentype.parse(s.fontFile);
    const codepoint = parseInt(m.glyphCodepoint, 16);
    const glyph = font.charToGlyph(String.fromCodePoint(codepoint));

    if (!glyph || glyph.index === 0) {
      showToast('Glyph not found in font');
      return;
    }

    const upm = font.unitsPerEm;
    const path = glyph.getPath(0, 0, upm);
    const pathData = path.toPathData(2);

    // Create SVG with Y-flip (font coordinates are Y-up, SVG is Y-down)
    const sizeScale = 1 + tempTransforms.sizeOffset * 0.05;
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${upm} ${upm}">
  <g transform="translate(0, ${upm}) scale(${sizeScale}, ${-sizeScale})">
    <path d="${pathData}" fill="#393E44"/>
  </g>
</svg>`;

    triggerDownload(svgString, `${m.glyphName || 'glyph'}.svg`, 'image/svg+xml');
  } catch (err) {
    console.error('Font glyph SVG export error:', err);
    showToast('Failed to extract glyph from font');
  }
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
