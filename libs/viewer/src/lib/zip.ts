/**
 * A zip archive, as an Excel workbook is one: each file squeezed with deflate
 * where the browser can (its own CompressionStream), else stored as it is —
 * both of which every zip reader takes. No library: the list part writes the
 * few files a workbook holds itself.
 */

/** One file in the archive: its path, and its bytes or its text (written as UTF-8). */
export interface ZipEntry {
  path: string;
  data: Uint8Array | string;
}

let crcTable: Uint32Array | undefined;

/** A zip's check of a file's bytes (CRC-32). */
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Text as UTF-8. */
export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Bytes squeezed with raw deflate by the browser, or null where it cannot (an older one): they are stored instead. */
async function deflated(bytes: Uint8Array): Promise<Uint8Array | null> {
  const Squeeze = (globalThis as { CompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream;
  if (!Squeeze || typeof Response === 'undefined') return null;
  try {
    const squeezed = new Blob([bytes as BlobPart]).stream().pipeThrough(new Squeeze('deflate-raw'));
    return new Uint8Array(await new Response(squeezed).arrayBuffer());
  } catch {
    return null;
  }
}

/** The archive's bytes: each file, then the directory of them, as the zip format lays them out. */
export async function zipOf(entries: readonly ZipEntry[], when = new Date()): Promise<Uint8Array> {
  // The time each file was written, as zips keep it (two seconds at a time, from 1980).
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = (Math.max(0, when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = utf8(entry.path);
    const plain = typeof entry.data === 'string' ? utf8(entry.data) : entry.data;
    const squeezed = await deflated(plain);
    // Deflated only where that makes it smaller.
    const stored = !squeezed || squeezed.length >= plain.length;
    const body = stored ? plain : squeezed;
    const crc = crc32(plain);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(8, stored ? 0 : 8, true);
    head.setUint16(10, time, true);
    head.setUint16(12, date, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, body.length, true);
    head.setUint32(22, plain.length, true);
    head.setUint16(26, name.length, true);
    head.setUint16(28, 0, true);
    const listed = new DataView(new ArrayBuffer(46));
    listed.setUint32(0, 0x02014b50, true);
    listed.setUint16(4, 20, true);
    listed.setUint16(6, 20, true);
    listed.setUint16(8, 0x0800, true);
    listed.setUint16(10, stored ? 0 : 8, true);
    listed.setUint16(12, time, true);
    listed.setUint16(14, date, true);
    listed.setUint32(16, crc, true);
    listed.setUint32(20, body.length, true);
    listed.setUint32(24, plain.length, true);
    listed.setUint16(28, name.length, true);
    listed.setUint32(42, offset, true);
    parts.push(new Uint8Array(head.buffer), name, body);
    directory.push(new Uint8Array(listed.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...directory, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
