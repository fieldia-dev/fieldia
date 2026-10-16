/**
 * The files of a zip archive, as an Excel workbook is one: read from the
 * archive's own directory at its end, each file stored as it is or squeezed
 * with deflate, which the browser opens itself (its DecompressionStream). No
 * library: a list's Import reads the few files of a workbook it needs, as its
 * Export writes them (zip.ts).
 */

/** Why an archive could not be read: not a zip at all, a file in it locked with a password, or squeezed some other way. */
export class ZipProblem extends Error {
  constructor(readonly problem: 'notZip' | 'locked' | 'method' | 'cannotInflate' | 'damaged') {
    super(problem);
    this.name = 'ZipProblem';
  }
}

/** One file listed in the archive's directory. */
interface Listed {
  path: string;
  method: number;
  flags: number;
  squeezed: number;
  offset: number;
}

/** The archive's directory: every file in it, by its path. */
function directory(bytes: Uint8Array): Map<string, Listed> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record is the last thing in the file, before a comment of up to 65,535 bytes.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new ZipProblem('notZip');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names = new TextDecoder('utf-8');
  const files = new Map<string, Listed>();
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new ZipProblem('damaged');
    const nameLength = view.getUint16(at + 28, true);
    const path = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    files.set(path, { path, flags: view.getUint16(at + 8, true), method: view.getUint16(at + 10, true), squeezed: view.getUint32(at + 20, true), offset: view.getUint32(at + 42, true) });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

/** Bytes squeezed with raw deflate, opened by the browser. */
async function inflated(bytes: Uint8Array): Promise<Uint8Array> {
  const Open = (globalThis as { DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (!Open) throw new ZipProblem('cannotInflate');
  const stream = new Open('deflate-raw');
  const writer = stream.writable.getWriter();
  // Written and read at once: the stream holds back what it writes until it is read.
  writer.write(bytes).catch(() => undefined);
  writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value);
      size += value.length;
    }
  } catch {
    throw new ZipProblem('damaged');
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** An archive opened: what it holds, and each file's bytes asked for by its path (null when it has no such file). */
export interface Unzipped {
  paths: string[];
  read(path: string): Promise<Uint8Array | null>;
}

/** An archive's directory read, each file opened when it is asked for. */
export function unzip(bytes: Uint8Array): Unzipped {
  const files = directory(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    paths: [...files.keys()],
    async read(path) {
      const file = files.get(path);
      if (!file) return null;
      // Locked with a password: nothing to read without it.
      if (file.flags & 1) throw new ZipProblem('locked');
      if (file.offset + 30 > bytes.length || view.getUint32(file.offset, true) !== 0x04034b50) throw new ZipProblem('damaged');
      const start = file.offset + 30 + view.getUint16(file.offset + 26, true) + view.getUint16(file.offset + 28, true);
      const body = bytes.subarray(start, start + file.squeezed);
      if (file.method === 0) return body;
      if (file.method === 8) return inflated(body);
      throw new ZipProblem('method');
    },
  };
}
