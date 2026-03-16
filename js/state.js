const defaults = {
  fontFile: null,           // ArrayBuffer
  fontName: '',             // string
  fontMeta: null,           // { unitsPerEm, ascender, descender }
  glyphs: [],              // [{ name, codepoint, unicode }]
  svgEntries: [],          // [{ filename, name, svg }]
  mappings: [],            // mapping entries or category entries
  selectedRows: new Set(),
  searchQuery: '',
  filter: 'all',
  lastClickedRow: null,
};

const state = { ...defaults, selectedRows: new Set() };

const listeners = [];

/**
 * Reset all state fields to their defaults.
 */
export function initState() {
  state.fontFile = null;
  state.fontName = '';
  state.fontMeta = null;
  state.glyphs = [];
  state.svgEntries = [];
  state.mappings = [];
  state.selectedRows = new Set();
  state.searchQuery = '';
  state.filter = 'all';
  state.lastClickedRow = null;
}

/**
 * Return the current state object (mutable reference).
 */
export function getState() {
  return state;
}

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 */
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

/**
 * Notify all subscribers that state has changed.
 */
export function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('State listener error:', err);
    }
  }
}

/**
 * Return default transform values for a mapping entry.
 */
export function defaultTransforms() {
  return { flipH: false, flipV: false, sizeOffset: 0 };
}
