/**
 * The files of a zip archive, as an Excel workbook is one: read from the
 * archive's own directory at its end, each file stored as it is or squeezed
 * with deflate, which the browser opens itself (its DecompressionStream). No
 * library: a list's Import reads the few files of a workbook it needs, as its
 * Export writes them (zip.ts).
 */

/**
 * The most a file of an archive, and all those read of one, may open to: a workbook's sheet of 50,000 rows is well
 * inside; a few kilobytes squeezed from 100 megabytes of one letter is not, and is never opened whole.
 */
export const UNZIPPED_MOST = { entry: 100 * 1024 * 1024, total: 200 * 1024 * 1024 };

/**
 * Why an archive could not be read: not a zip at all, a file in it locked with a password, squeezed some other way,
 * damaged (a file opening to another size than the archive says), or opening to more than `UNZIPPED_MOST`.
 */
export class ZipProblem extends Error {
  constructor(readonly problem: 'notZip' | 'locked' | 'method' | 'cannotInflate' | 'damaged' | 'tooLarge') {
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
  /** The size it says it opens to. */
  size: number;
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
    files.set(path, { path, flags: view.getUint16(at + 8, true), method: view.getUint16(at + 10, true), squeezed: view.getUint32(at + 20, true), size: view.getUint32(at + 24, true), offset: view.getUint32(at + 42, true) });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

/** Bytes squeezed with raw deflate, opened by the browser: to `size`, the size the archive says, and not a byte more. */
async function inflated(bytes: Uint8Array, size: number): Promise<Uint8Array> {
  const Open = (globalThis as { DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (!Open) throw new ZipProblem('cannotInflate');
  const stream = new Open('deflate-raw');
  const writer = stream.writable.getWriter();
  // Written a piece at a time as it is read — the stream holds back what it writes until it is read — so a file that
  // opens to far more than it says is stopped after a piece, never opened whole first.
  void (async () => {
    for (let at = 0; at < bytes.length; at += 16384) {
      await writer.ready;
      await writer.write(bytes.subarray(at, at + 16384));
    }
    await writer.close();
  })().catch(() => undefined);
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let read = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value);
      read += value.length;
      // More than it says it holds: a file that lies about its size is stopped where it went past it.
      if (read > size) break;
    }
  } catch {
    throw new ZipProblem('damaged');
  }
  if (read !== size) {
    void reader.cancel().catch(() => undefined);
    throw new ZipProblem('damaged');
  }
  const out = new Uint8Array(read);
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
  /** What the files read so far opened to: all of them kept to `UNZIPPED_MOST.total`. */
  let opened = 0;
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
      if (file.method !== 0 && file.method !== 8) throw new ZipProblem('method');
      if (file.size > UNZIPPED_MOST.entry || opened + file.size > UNZIPPED_MOST.total) throw new ZipProblem('tooLarge');
      opened += file.size;
      if (file.method === 0) {
        if (body.length !== file.size) throw new ZipProblem('damaged');
        return body;
      }
      return inflated(body, file.size);
    },
  };
}
