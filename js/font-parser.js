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
  const nameMap = {}; // codepoint hex → name
  let detectedFontName = null;
  // Match: .something-name:before { content: '\eXXX' }
  // or .something-name::before { content: "\eXXX" }
  const regex = /\.([a-zA-Z0-9_-]+)\s*::?before\s*\{\s*content:\s*['"]\\([0-9a-fA-F]+)['"]\s*;/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    const fullClassName = match[1]; // e.g. "pmi-icon-cart"
    const codepoint = match[2].toLowerCase(); // e.g. "e816"
    const name = stripCssPrefix(fullClassName);
    nameMap[codepoint] = name;
    // Detect font name from the CSS prefix (e.g. "pmi-icon" from "pmi-icon-cart")
    if (!detectedFontName) {
      for (const prefix of KNOWN_PREFIXES) {
        if (fullClassName.startsWith(prefix)) {
          detectedFontName = prefix.replace(/-$/, ''); // "pmi-icon-" → "pmi-icon"
          break;
        }
      }
    }
  }
  // Also try to extract font-family from @font-face
  const fontFaceMatch = cssText.match(/font-family:\s*['"]([^'"]+)['"]/);
  if (fontFaceMatch) {
    detectedFontName = fontFaceMatch[1];
  }
  return { nameMap, detectedFontName };
}

const KNOWN_PREFIXES = ['pmi-icon-', 'icon-', 'fa-', 'glyphicon-', 'ic-'];

// Strip CSS class prefix to get just the icon name
function stripCssPrefix(className) {
  for (const prefix of KNOWN_PREFIXES) {
    if (className.startsWith(prefix)) {
      return className.slice(prefix.length);
    }
  }
  return className;
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
