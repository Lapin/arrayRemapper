// Minimal ZIP file builder (no compression — store only)
// Sufficient for font files + text files

export function createZip(files) {
  // files = [{ name: 'path/file.ext', data: Uint8Array | string }]

  const entries = files.map(f => ({
    name: new TextEncoder().encode(f.name),
    data: typeof f.data === 'string' ? new TextEncoder().encode(f.data) : new Uint8Array(f.data),
  }));

  // Calculate sizes
  let offset = 0;
  const localHeaders = [];
  const centralHeaders = [];

  for (const entry of entries) {
    const localHeader = buildLocalHeader(entry.name, entry.data);
    localHeaders.push({ header: localHeader, data: entry.data, offset });
    offset += localHeader.length + entry.data.length;

    centralHeaders.push(buildCentralHeader(entry.name, entry.data, localHeaders[localHeaders.length - 1].offset));
  }

  const centralStart = offset;
  let centralSize = 0;
  centralHeaders.forEach(h => centralSize += h.length);

  const endRecord = buildEndRecord(entries.length, centralSize, centralStart);

  // Concatenate everything
  const totalSize = offset + centralSize + endRecord.length;
  const zip = new Uint8Array(totalSize);
  let pos = 0;

  for (const { header, data } of localHeaders) {
    zip.set(header, pos); pos += header.length;
    zip.set(data, pos); pos += data.length;
  }
  for (const h of centralHeaders) {
    zip.set(h, pos); pos += h.length;
  }
  zip.set(endRecord, pos);

  return zip;
}

function buildLocalHeader(name, data) {
  const crc = crc32(data);
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);  // Local file header signature
  view.setUint16(4, 20, true);           // Version needed
  view.setUint16(6, 0, true);            // Flags
  view.setUint16(8, 0, true);            // Compression: store
  view.setUint16(10, 0, true);           // Mod time
  view.setUint16(12, 0, true);           // Mod date
  view.setUint32(14, crc, true);         // CRC-32
  view.setUint32(18, data.length, true); // Compressed size
  view.setUint32(22, data.length, true); // Uncompressed size
  view.setUint16(26, name.length, true); // Filename length
  view.setUint16(28, 0, true);           // Extra field length
  header.set(name, 30);
  return header;
}

function buildCentralHeader(name, data, localOffset) {
  const crc = crc32(data);
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);    // Central directory signature
  view.setUint16(4, 20, true);             // Version made by
  view.setUint16(6, 20, true);             // Version needed
  view.setUint16(8, 0, true);              // Flags
  view.setUint16(10, 0, true);             // Compression: store
  view.setUint16(12, 0, true);             // Mod time
  view.setUint16(14, 0, true);             // Mod date
  view.setUint32(16, crc, true);           // CRC-32
  view.setUint32(20, data.length, true);   // Compressed size
  view.setUint32(24, data.length, true);   // Uncompressed size
  view.setUint16(28, name.length, true);   // Filename length
  view.setUint16(30, 0, true);             // Extra field length
  view.setUint16(32, 0, true);             // Comment length
  view.setUint16(34, 0, true);             // Disk number
  view.setUint16(36, 0, true);             // Internal attrs
  view.setUint32(38, 0, true);             // External attrs
  view.setUint32(42, localOffset, true);   // Local header offset
  header.set(name, 46);
  return header;
}

function buildEndRecord(count, centralSize, centralStart) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);     // End of central directory
  view.setUint16(4, 0, true);              // Disk number
  view.setUint16(6, 0, true);              // Disk with central dir
  view.setUint16(8, count, true);          // Entries on this disk
  view.setUint16(10, count, true);         // Total entries
  view.setUint32(12, centralSize, true);   // Central dir size
  view.setUint32(16, centralStart, true);  // Central dir offset
  view.setUint16(20, 0, true);            // Comment length
  return record;
}

// CRC-32 implementation
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
