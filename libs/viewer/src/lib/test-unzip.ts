import { inflateRawSync } from 'node:zlib';
import { TextDecoder, TextEncoder } from 'node:util';
import { crc32 } from './zip';

// jsdom has no TextEncoder, which every browser has: Node's, for the tests.
Object.assign(globalThis, { TextEncoder, TextDecoder });

/** The files of a zip, read from its directory: each one's bytes, inflated where squeezed, its check verified. */
export function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error('no end of directory');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('no directory entry');
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`no local header for ${name}`);
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const body = bytes.subarray(start, start + size);
    const plain = method === 8 ? new Uint8Array(inflateRawSync(body)) : body;
    if (crc32(plain) !== crc) throw new Error(`${name} does not match its check`);
    files.set(name, new TextDecoder().decode(plain));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

