import { getState, initState, notify } from './state.js';
import { showToast } from './utils.js';

const DB_NAME = 'font-icon-remapper';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

let dbAvailable = true;

export function isDbAvailable() {
  return dbAvailable;
}

// ===== IndexedDB helpers =====

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbAvailable = false;
        reject(req.error);
      };
    } catch (err) {
      dbAvailable = false;
      reject(err);
    }
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== Base64 helpers =====

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ===== Project name generator =====

function generateProjectName() {
  const adjectives = [
    'amber', 'bold', 'calm', 'dark', 'eager', 'fair', 'glad', 'hazy',
    'iron', 'keen', 'lean', 'mild', 'neat', 'open', 'pale', 'quick',
    'rare', 'slim', 'tame', 'vast', 'warm', 'young', 'zinc', 'azure',
    'crisp', 'dense', 'fresh', 'green', 'ivory', 'lunar',
  ];
  const nouns = [
    'apex', 'bloom', 'cliff', 'delta', 'ember', 'frost', 'grove', 'haven',
    'inlet', 'jewel', 'knoll', 'lotus', 'marsh', 'noble', 'oasis', 'pearl',
    'quill', 'ridge', 'stone', 'trail', 'unity', 'vault', 'whale', 'xenon',
    'yarn', 'zenith', 'atlas', 'birch', 'coral', 'drift',
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}`;
}

// ===== Font face registration =====

export function registerFontFace(arrayBuffer, familyName) {
  // Remove any previous dynamic font-face style
  const existing = document.getElementById('dynamic-font-face');
  if (existing) existing.remove();

  const blob = new Blob([arrayBuffer], { type: 'font/ttf' });
  const url = URL.createObjectURL(blob);
  const style = document.createElement('style');
  style.id = 'dynamic-font-face';
  style.textContent = `
    @font-face {
      font-family: '${familyName}';
      src: url('${url}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
}

// ===== Auto-save (debounced) =====

let saveTimer = null;

export function autoSave() {
  if (!dbAvailable) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const s = getState();
      // Save font file as base64 (if present)
      const fontBase64 = s.fontFile ? arrayBufferToBase64(s.fontFile) : null;

      await dbPut('fontBase64', fontBase64);
      await dbPut('fontName', s.fontName);
      await dbPut('fontMeta', s.fontMeta);
      await dbPut('glyphs', s.glyphs);
      await dbPut('svgEntries', s.svgEntries);
      await dbPut('mappings', s.mappings);
      await dbPut('searchQuery', s.searchQuery);
      await dbPut('filter', s.filter);
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, 300);
}

// ===== Restore session =====

export async function restoreSession() {
  if (!dbAvailable) return false;
  try {
    const fontBase64 = await dbGet('fontBase64');
    if (!fontBase64) return false;

    const s = getState();
    s.fontFile = base64ToArrayBuffer(fontBase64);
    s.fontName = (await dbGet('fontName')) || '';
    s.fontMeta = (await dbGet('fontMeta')) || null;
    s.glyphs = (await dbGet('glyphs')) || [];
    s.svgEntries = (await dbGet('svgEntries')) || [];
    s.mappings = (await dbGet('mappings')) || [];
    s.searchQuery = (await dbGet('searchQuery')) || '';
    s.filter = (await dbGet('filter')) || 'all';

    if (s.fontFile && s.fontName) {
      registerFontFace(s.fontFile, s.fontName);
    }

    notify();
    return true;
  } catch (err) {
    console.error('Restore session failed:', err);
    return false;
  }
}

// ===== Export project =====

export function exportProject() {
  const s = getState();
  if (!s.fontFile) {
    showToast('No font loaded to export');
    return;
  }

  const projectName = generateProjectName();
  const data = {
    projectName,
    exportedAt: new Date().toISOString(),
    fontName: s.fontName,
    fontMeta: s.fontMeta,
    fontBase64: arrayBufferToBase64(s.fontFile),
    glyphs: s.glyphs,
    svgEntries: s.svgEntries,
    mappings: s.mappings,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported as ${projectName}.json`);
}

// ===== Load project =====

export function loadProject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const s = getState();

        s.fontFile = data.fontBase64 ? base64ToArrayBuffer(data.fontBase64) : null;
        s.fontName = data.fontName || '';
        s.fontMeta = data.fontMeta || null;
        s.glyphs = data.glyphs || [];
        s.svgEntries = data.svgEntries || [];
        s.mappings = data.mappings || [];
        s.selectedRows = new Set();
        s.searchQuery = '';
        s.filter = 'all';
        s.lastClickedRow = null;

        if (s.fontFile && s.fontName) {
          registerFontFace(s.fontFile, s.fontName);
        }

        notify();
        autoSave();
        showToast(`Loaded project: ${data.projectName || file.name}`);
        resolve(true);
      } catch (err) {
        console.error('Load project failed:', err);
        showToast('Failed to load project file');
        reject(err);
      }
    };
    reader.onerror = () => {
      showToast('Failed to read file');
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}

// ===== New project =====

export async function newProject() {
  try {
    await dbClear();
    initState();
    notify();
    showToast('New project created');
  } catch (err) {
    console.error('New project failed:', err);
    showToast('Failed to create new project');
  }
}
