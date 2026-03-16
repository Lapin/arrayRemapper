import { getState, notify } from './state.js';
import { autoSave } from './persistence.js';

const STRIP_PREFIXES = ['_pmi-icon-', 'pmi-icon-', 'icon-', 'ic-'];

function normalizeName(name) {
  let n = name.toLowerCase();
  n = n.replace(/\.svg$/i, '');
  for (const prefix of STRIP_PREFIXES) {
    if (n.startsWith(prefix)) { n = n.slice(prefix.length); break; }
  }
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
      if (normGlyph === normalizeName(entry.filename)) {
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
