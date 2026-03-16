# Font Icon Remapper

A browser-based tool for editing icon font files. Drop in a font, drop in SVGs, map them visually, and generate updated font files — all client-side, no server needed.

## Usage

1. Open the tool in a browser
2. Drop a font file (.ttf, .woff, or .otf) onto the left drop zone
3. Drop SVG icon files onto the right drop zone
4. Click **Auto-Match** to match SVGs to glyphs by name
5. Drag SVGs from the pool to glyph slots to assign manually
6. Click **Edit** on any row to rename, flip, or resize
7. Click **Generate Font** to download the updated .ttf and .woff

## Features

- Drag-and-drop font and SVG loading
- Auto-match by normalized name
- Visual mapping with drag-and-drop (swap, copy with Alt)
- Edit modal: rename, flip H/V, size adjustment, SVG download
- Categories with collapse/expand
- Right-click context menu
- Full workspace auto-saved in browser (IndexedDB)
- Export/import full project as single JSON file
- Generate .ttf and .woff with all transforms applied

## Development

No build step required. Serve locally:

```bash
cd font-icon-remapper
python3 -m http.server 8080
```

Open http://localhost:8080

## Hosting

Deploy the contents of this directory to any static host (GitHub Pages, Netlify, etc.).
