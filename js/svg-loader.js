import { getState, notify } from './state.js';
import { autoSave } from './persistence.js';

// Load multiple SVG files from a FileList. Returns { loaded, skipped } counts.
export async function loadSvgFiles(fileList) {
  const s = getState();
  let loaded = 0, skipped = 0;
  const existingFilenames = new Set(s.svgEntries.map(e => e.filename));

  const promises = Array.from(fileList).map(file => {
    return new Promise(resolve => {
      if (!file.name.toLowerCase().endsWith('.svg')) { skipped++; resolve(); return; }
      if (existingFilenames.has(file.name)) { resolve(); return; } // skip duplicates
      const reader = new FileReader();
      reader.onload = (ev) => {
        const svg = ev.target.result;
        if (!svg.includes('<svg')) { skipped++; resolve(); return; }
        const name = file.name.replace(/\.svg$/i, '').replace(/^_/, '');
        s.svgEntries.push({ filename: file.name, name, svg });
        loaded++;
        resolve();
      };
      reader.onerror = () => { skipped++; resolve(); };
      reader.readAsText(file);
    });
  });

  await Promise.all(promises);
  s.svgEntries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  autoSave();
  notify();
  return { loaded, skipped };
}
