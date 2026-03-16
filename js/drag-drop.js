import { getState, notify, defaultTransforms } from './state.js';
import { autoSave } from './persistence.js';

let altKeyDown = false;

function trackAltKey() {
  document.addEventListener('keydown', (e) => { if (e.key === 'Alt') altKeyDown = true; });
  document.addEventListener('keyup', (e) => { if (e.key === 'Alt') altKeyDown = false; });
  window.addEventListener('blur', () => { altKeyDown = false; });
}

let altTrackerInitialized = false;

/**
 * Attach drag-and-drop listeners to the current DOM.
 * Call after every re-render of the mapping list / pool.
 */
export function initDragDrop() {
  if (!altTrackerInitialized) {
    trackAltKey();
    altTrackerInitialized = true;
  }

  initPoolDrag();
  initSlotDrop();
  initSlotDrag();
  initRowDrag();
}

// =============================================
// 1. Pool item drag (pool -> slot)
// =============================================

function initPoolDrag() {
  const poolScroll = document.getElementById('poolScroll');
  if (!poolScroll) return;

  poolScroll.querySelectorAll('.pool-item[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.filename);
      e.dataTransfer.setData('application/x-pool-item', '1');
      e.dataTransfer.effectAllowed = 'copyMove';
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '';
    });
  });
}

// =============================================
// 2. SVG slot drop targets (pool -> slot, slot -> slot)
// =============================================

function initSlotDrop() {
  document.querySelectorAll('.svg-slot').forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      // Only accept pool or slot drags, not row reorder drags
      if (e.dataTransfer.types.includes('application/x-row-drag')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = altKeyDown ? 'copy' : 'move';
      slot.classList.add('drag-over-slot');
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over-slot');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over-slot');

      const s = getState();
      const targetIdx = parseInt(slot.dataset.idx, 10);
      if (isNaN(targetIdx)) return;

      // Check if this is from pool
      if (e.dataTransfer.getData('application/x-pool-item')) {
        const filename = e.dataTransfer.getData('text/plain');
        if (filename && s.mappings[targetIdx] && !s.mappings[targetIdx].isCategory) {
          s.mappings[targetIdx].svgFilename = filename;
          autoSave();
          notify();
        }
        return;
      }

      // Check if from another slot
      const sourceIdxStr = e.dataTransfer.getData('application/x-slot-idx');
      if (sourceIdxStr) {
        const sourceIdx = parseInt(sourceIdxStr, 10);
        if (isNaN(sourceIdx) || sourceIdx === targetIdx) return;
        const srcEntry = s.mappings[sourceIdx];
        const tgtEntry = s.mappings[targetIdx];
        if (!srcEntry || srcEntry.isCategory || !tgtEntry || tgtEntry.isCategory) return;

        if (altKeyDown) {
          // Copy: assign source's SVG to target (keep source)
          tgtEntry.svgFilename = srcEntry.svgFilename;
        } else {
          // Swap
          const tmp = tgtEntry.svgFilename;
          tgtEntry.svgFilename = srcEntry.svgFilename;
          srcEntry.svgFilename = tmp;
        }
        autoSave();
        notify();
      }
    });
  });
}

// =============================================
// 3. SVG slot drag source (slot -> slot)
// =============================================

function initSlotDrag() {
  document.querySelectorAll('.svg-slot.has-svg').forEach(slot => {
    slot.setAttribute('draggable', 'true');

    slot.addEventListener('dragstart', (e) => {
      e.stopPropagation(); // prevent row drag
      e.dataTransfer.setData('application/x-slot-idx', slot.dataset.idx);
      e.dataTransfer.effectAllowed = 'copyMove';
      slot.style.opacity = '0.5';
    });

    slot.addEventListener('dragend', () => {
      slot.style.opacity = '';
    });
  });
}

// =============================================
// 4. Row drag handle -> reorder rows
// =============================================

function initRowDrag() {
  const mappingList = document.getElementById('mappingList');
  if (!mappingList) return;

  // Make drag handles draggable
  mappingList.querySelectorAll('.row-drag-handle').forEach(handle => {
    const row = handle.closest('.mapping-row, .category-row');
    if (!row) return;

    handle.setAttribute('draggable', 'true');

    handle.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      const idx = parseInt(row.dataset.idx, 10);
      e.dataTransfer.setData('application/x-row-drag', String(idx));
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');

      // Use a minimal drag image
      const ghost = row.cloneNode(true);
      ghost.style.width = row.offsetWidth + 'px';
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    });

    handle.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      clearDropIndicators(mappingList);
    });
  });

  // Row drop targets: each row accepts row drags
  const allRows = mappingList.querySelectorAll('.mapping-row, .category-row');
  allRows.forEach(targetRow => {
    targetRow.addEventListener('dragover', (e) => {
      // Only handle row drags
      if (!e.dataTransfer.types.includes('application/x-row-drag')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      clearDropIndicators(mappingList);

      // Determine top or bottom half
      const rect = targetRow.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        targetRow.classList.add('drop-above');
      } else {
        targetRow.classList.add('drop-below');
      }
    });

    targetRow.addEventListener('dragleave', () => {
      targetRow.classList.remove('drop-above', 'drop-below');
    });

    targetRow.addEventListener('drop', (e) => {
      if (!e.dataTransfer.types.includes('application/x-row-drag')) return;
      e.preventDefault();
      clearDropIndicators(mappingList);

      const sourceIdx = parseInt(e.dataTransfer.getData('application/x-row-drag'), 10);
      const targetIdx = parseInt(targetRow.dataset.idx, 10);
      if (isNaN(sourceIdx) || isNaN(targetIdx) || sourceIdx === targetIdx) return;

      // Determine insert position (above or below)
      const rect = targetRow.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBelow = e.clientY >= midY;

      const s = getState();

      // Collect indices to move: if source is selected and part of multi-select, move all selected
      let indicesToMove;
      if (s.selectedRows.has(sourceIdx) && s.selectedRows.size > 1) {
        indicesToMove = Array.from(s.selectedRows).sort((a, b) => a - b);
      } else {
        indicesToMove = [sourceIdx];
      }

      reorderRows(s.mappings, indicesToMove, targetIdx, insertBelow);
      s.selectedRows.clear();
      s.lastClickedRow = null;
      autoSave();
      notify();
    });
  });
}

function clearDropIndicators(container) {
  container.querySelectorAll('.drop-above, .drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });
}

/**
 * Move a set of rows (by original indices) to a target position.
 */
function reorderRows(mappings, sourceIndices, targetIdx, insertBelow) {
  // Extract the items to move
  const items = sourceIndices.map(i => mappings[i]);
  const sourceSet = new Set(sourceIndices);

  // Build new array without the moved items
  const remaining = [];
  let adjustedTarget = targetIdx;
  let removedBeforeTarget = 0;

  for (let i = 0; i < mappings.length; i++) {
    if (sourceSet.has(i)) {
      if (i < targetIdx) removedBeforeTarget++;
      continue;
    }
    remaining.push(mappings[i]);
  }

  // Adjust target for removed items above it
  adjustedTarget -= removedBeforeTarget;

  // Insert position
  let insertAt = insertBelow ? adjustedTarget + 1 : adjustedTarget;
  insertAt = Math.max(0, Math.min(insertAt, remaining.length));

  // Splice in the moved items
  remaining.splice(insertAt, 0, ...items);

  // Replace mappings array contents in place
  mappings.length = 0;
  mappings.push(...remaining);
}
