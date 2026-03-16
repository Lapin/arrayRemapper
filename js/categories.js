import { getState, notify } from './state.js';
import { autoSave } from './persistence.js';

let idCounter = 0;

function uniqueCategoryId() {
  idCounter++;
  return 'cat_' + Date.now() + '_' + idCounter + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * Insert a new category separator after the given index.
 * If afterIdx is -1 or omitted, appends at the end.
 */
export function addCategory(afterIdx = -1, name = 'New Category') {
  const s = getState();
  const entry = {
    isCategory: true,
    categoryName: name,
    _id: uniqueCategoryId(),
  };

  if (afterIdx < 0 || afterIdx >= s.mappings.length) {
    s.mappings.push(entry);
  } else {
    s.mappings.splice(afterIdx + 1, 0, entry);
  }

  autoSave();
  notify();
  return entry;
}

/**
 * Delete a category row at the given index.
 */
export function deleteCategory(idx) {
  const s = getState();
  if (!s.mappings[idx] || !s.mappings[idx].isCategory) return;
  s.mappings.splice(idx, 1);
  autoSave();
  notify();
}

/**
 * Rename a category at the given index.
 */
export function renameCategory(idx, newName) {
  const s = getState();
  if (!s.mappings[idx] || !s.mappings[idx].isCategory) return;
  s.mappings[idx].categoryName = newName;
  autoSave();
}

/**
 * Toggle collapse state for a category.
 * collapsedSet is the Set from render.js module scope.
 */
export function toggleCollapse(categoryId, collapsedSet) {
  if (collapsedSet.has(categoryId)) {
    collapsedSet.delete(categoryId);
  } else {
    collapsedSet.add(categoryId);
  }
}

/**
 * Collapse all categories.
 */
export function collapseAll(collapsedSet) {
  const s = getState();
  for (const m of s.mappings) {
    if (m.isCategory && m._id) {
      collapsedSet.add(m._id);
    }
  }
}

/**
 * Expand all categories.
 */
export function expandAll(collapsedSet) {
  collapsedSet.clear();
}

/**
 * Get category stats: how many glyphs are matched vs total
 * for the section starting at catIdx.
 */
export function getCategoryStats(idx) {
  const s = getState();
  let matched = 0, total = 0;
  for (let j = idx + 1; j < s.mappings.length; j++) {
    if (s.mappings[j].isCategory) break;
    total++;
    if (s.mappings[j].svgFilename) matched++;
  }
  return { matched, total };
}
