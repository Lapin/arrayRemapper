import { getState, defaultTransforms, notify } from './state.js';
import { autoSave, registerFontFace } from './persistence.js';

// Parse a font file ArrayBuffer using global opentype object.
// Extract glyphs with unicode >= 0xE000, skip .notdef and unnamed.
export function parseFontFile(arrayBuffer) {
  const font = opentype.parse(arrayBuffer);
  const fontName = font.names.fontFamily?.en || font.names.postScriptName?.en || 'IconFont';
  const fontMeta = {
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
  };
  const glyphs = [];
  for (let i = 0; i < font.numGlyphs; i++) {
    const g = font.glyphs.get(i);
    if (!g.unicode || g.unicode < 0xE000) continue;
    if (g.name === '.notdef') continue;
    // Many icon fonts don't store glyph names — fall back to codepoint-based name
    const name = g.name || ('glyph-' + g.unicode.toString(16));
    glyphs.push({ name, codepoint: g.unicode.toString(16), unicode: g.unicode });
  }
  glyphs.sort((a, b) => a.unicode - b.unicode);
  return { fontName, fontMeta, glyphs };
}

// Parse a CSS file to extract icon name → codepoint mappings.
// Supports common patterns:
//   .prefix-name:before { content: '\eXXX'; }
//   .prefix-name::before { content: "\eXXX"; }
export function parseCssForGlyphNames(cssText) {
  // Step 1: collect all class names with their codepoints
  const regex = /\.([a-zA-Z0-9_-]+)\s*::?before\s*\{\s*content:\s*['"]\\([0-9a-fA-F]+)['"]\s*;/g;
  const entries = [];
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    entries.push({ fullClass: match[1], codepoint: match[2].toLowerCase() });
  }

  // Step 2: auto-detect the common prefix from all class names
  const detectedPrefix = findCommonPrefix(entries.map(e => e.fullClass));

  // Step 3: strip prefix to get icon names
  const nameMap = {};
  for (const e of entries) {
    const name = detectedPrefix ? e.fullClass.slice(detectedPrefix.length) : e.fullClass;
    nameMap[e.codepoint] = name;
  }

  // Step 4: try to extract font-family from @font-face
  let detectedFontName = null;
  const fontFaceMatch = cssText.match(/font-family:\s*['"]([^'"]+)['"]/);
  if (fontFaceMatch) {
    detectedFontName = fontFaceMatch[1];
  }

  return { nameMap, detectedFontName };
}

// Find the longest common prefix ending with a separator (- or _)
// e.g. ["my-icon-cart", "my-icon-search", "my-icon-home"] → "my-icon-"
function findCommonPrefix(strings) {
  if (!strings || strings.length === 0) return '';
  if (strings.length === 1) {
    // Single entry: find last separator
    const last = Math.max(strings[0].lastIndexOf('-'), strings[0].lastIndexOf('_'));
    return last > 0 ? strings[0].slice(0, last + 1) : '';
  }
  // Find character-by-character common prefix
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return '';
    }
  }
  // Trim to the last separator so we don't cut mid-word
  const lastSep = Math.max(prefix.lastIndexOf('-'), prefix.lastIndexOf('_'));
  return lastSep > 0 ? prefix.slice(0, lastSep + 1) : '';
}

// Apply CSS name mappings to existing glyphs in state
export function applyCssNames(parsedCss) {
  const { nameMap, detectedFontName } = parsedCss;
  const s = getState();
  let applied = 0;
  s.mappings.forEach(m => {
    if (m.isCategory) return;
    const name = nameMap[m.glyphCodepoint];
    if (name) {
      m.glyphName = name;
      applied++;
    }
  });
  // Also update the glyphs array
  s.glyphs.forEach(g => {
    const name = nameMap[g.codepoint];
    if (name) g.name = name;
  });
  autoSave();
  notify();
  return applied;
}

// Handle a dropped font file: parse, populate state, create initial mappings
export function handleFontFile(arrayBuffer) {
  const { fontName, fontMeta, glyphs } = parseFontFile(arrayBuffer);
  const s = getState();
  s.fontFile = arrayBuffer;
  s.fontName = fontName;
  s.fontMeta = fontMeta;
  s.glyphs = glyphs;
  // Initial mappings: one "Uncategorised" category + all glyphs unmatched
  s.mappings = [
    { isCategory: true, categoryName: 'Uncategorised', _id: 'cat-1' },
    ...glyphs.map(g => ({
      glyphName: g.name,
      glyphCodepoint: g.codepoint,
      svgFilename: null,
      isNew: false,
      transforms: defaultTransforms(),
    })),
  ];
  registerFontFace(arrayBuffer, fontName);
  autoSave();
  notify();
  return { fontName, glyphCount: glyphs.length };
}
