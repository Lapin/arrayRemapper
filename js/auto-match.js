import { getState, notify } from './state.js';
import { autoSave } from './persistence.js';

// Normalize a name for fuzzy matching:
// strip extension, leading underscores, hyphens, underscores, spaces, lowercase
function normalizeName(name) {
  let n = name.toLowerCase();
  n = n.replace(/\.svg$/i, '');
  n = n.replace(/^_+/, '');
  n = n.replace(/[-_ ]/g, '');
  return n;
}

export function autoMatch() {
  const s = getState();
  let matched = 0;
  s.mappings.forEach(m => {
    if (m.isCategory || m.svgFilename) return;
    const normGlyph = normalizeName(m.glyphName);
    for (const entry of s.svgEntries) {
      const normSvg = normalizeName(entry.filename);
      // Exact match after normalization
      if (normGlyph === normSvg) {
        m.svgFilename = entry.filename;
        matched++;
        return;
      }
      // Also match if one ends with the other (handles prefixed names)
      if (normSvg.endsWith(normGlyph) || normGlyph.endsWith(normSvg)) {
        m.svgFilename = entry.filename;
        matched++;
        return;
      }
    }
  });
  autoSave();
  notify();
  return matched;
}
