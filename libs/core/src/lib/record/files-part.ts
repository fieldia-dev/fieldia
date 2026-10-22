import type { DataSource, UploadedFile, UploadFile, UploadRequest, UploadSignal } from './data-source';
import { saveProblemOf } from './data-source';
import { filesIn, isFile, UPLOADS_AT_ONCE, type Entry, type UploadsRun } from './uploads';
import type { FileValue, Value } from './values';

/**
 * The uploads' work (uploads.ts), a part of its own: each file made ready, one at a time (a photo made smaller), and
 * sent to the app's store, three at a time — its bar told as it goes, Cancel stopping it — then its stored link put in
 * its field in the order the files were picked, in place of the bytes a save stores, the words beside them kept. It
 * comes with the files part, and the first time a form sends a file: a page with no file never downloads it.
 */

/** The host's `AbortController`: every browser's, and Node's. Core names no DOM types. */
const stopper = () => new (globalThis as unknown as { AbortController: new () => { signal: UploadSignal; abort(): void } }).AbortController();

const sameFile = (a: FileValue, b: FileValue) => a.name === b.name && a.data === b.data && a.url === b.url;
/** The bytes a base64 text holds. */
function bytesOf(data: string): Uint8Array {
  const text = (globalThis as unknown as { atob(text: string): string }).atob(data);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

/** A file held as its bytes, as the store takes a file: its name, size, kind and bytes. */
export function fileFromBytes(file: FileValue): UploadFile {
  const bytes = bytesOf(file.data ?? '');
  return { name: file.name, size: bytes.length, type: file.type, arrayBuffer: async () => bytes.slice().buffer };
}

/** A stored file with the words its bytes had beside them as they stand now — a caption, a signature's evidence — never their link's. */
const keeping = (stored: FileValue, was: FileValue): FileValue => {
  const file: FileValue = { ...stored };
  for (const [key, value] of Object.entries(was)) if (!['data', 'url', 'name', 'size', 'type', 'fileId'].includes(key)) (file as unknown as Record<string, unknown>)[key] = value;
  return file;
};

/**
 * A field's files with a stored one put in: in place of the bytes it was
 * stored for (nothing, when those are gone), with what stands beside them
 * now; in place of a field's one file; or among several before the first
 * that was picked after it.
 */
function placed(current: Value | undefined, stored: FileValue, how: { several: boolean; replaces?: FileValue; pickedAfter: (file: FileValue) => boolean }): Value | undefined {
  if (how.replaces) {
    const was = how.replaces;
    if (Array.isArray(current)) {
      const at = (current as unknown[]).findIndex((file) => isFile(file) && sameFile(file, was));
      return at < 0 ? undefined : ((current as unknown[]).map((file, i) => (i === at ? keeping(stored, file as FileValue) : file)) as unknown as Value);
    }
    return isFile(current) && sameFile(current, was) ? (keeping(stored, current) as unknown as Value) : undefined;
  }
  if (!how.several) return stored as unknown as Value;
  const files = filesIn(current);
  const at = files.findIndex(how.pickedAfter);
  const list = at < 0 ? [...files, stored] : [...files.slice(0, at), stored, ...files.slice(at)];
  return list as unknown as Value;
}

/** The next file made ready, one at a time, and the next to go, three at a time: the uploads' own pump, once this part came. */
export function pumpUploads(run: UploadsRun): void {
  if (!run.entries.some((entry) => entry.status === 'preparing')) {
    const next = run.entries.find((entry) => entry.status === 'waiting' && !entry.ready);
    if (next) void prepare(run, next);
  }
  for (let next = nextToSend(run); next && run.entries.filter((entry) => entry.status === 'uploading').length < UPLOADS_AT_ONCE; next = nextToSend(run)) void send(run, next);
}
const nextToSend = (run: UploadsRun) => run.entries.find((entry) => entry.status === 'waiting' && entry.ready);

async function prepare(run: UploadsRun, entry: Entry) {
  entry.status = 'preparing';
  run.tell();
  const original = entry.file;
  let refused: string | null = null;
  try {
    entry.file = await (entry.prepare as NonNullable<Entry['prepare']>)(original);
  } catch (error) {
    // A file that cannot be made ready goes as it is, never lost — unless the field refuses it as it is (too large still).
    const problem = saveProblemOf(error);
    if (problem.kind === 'rule') refused = problem.message;
    entry.file = original;
  }
  entry.ready = true;
  if (!run.entries.includes(entry)) return;
  entry.status = refused === null ? 'waiting' : 'refused';
  if (refused !== null) {
    entry.error = refused;
    entry.end?.();
  }
  run.tell();
  pumpUploads(run);
}

async function send(run: UploadsRun, entry: Entry) {
  const source = run.host.source();
  if (!source?.upload) return;
  const stop = stopper();
  entry.status = 'uploading';
  entry.sent = 0;
  entry.total = null;
  delete entry.error;
  entry.stop = () => stop.abort();
  run.tell();
  const lineId = entry.line ? run.host.lineId(entry.line.field, entry.line.key) : undefined;
  const under = run.host.under ?? '';
  const request: UploadRequest = {
    model: run.host.model(),
    // A line's field is named on its own, its table where it sits.
    field: entry.line ? entry.field : `${under}${entry.field}`,
    recordId: run.host.recordId(),
    ...(entry.line ? { line: { ...entry.line, field: `${under}${entry.line.field}`, ...(lineId !== undefined ? { id: lineId } : {}) } } : {}),
    signal: stop.signal,
    onProgress: (sent, total) => {
      if (entry.status !== 'uploading' || !run.entries.includes(entry)) return;
      // Told when the bar would move: a whole per cent, or the end.
      const was = entry.total ? Math.floor((entry.sent * 100) / entry.total) : -1;
      const now = total ? Math.floor((sent * 100) / total) : -1;
      entry.sent = sent;
      entry.total = total;
      if (now !== was || sent === total) run.tell();
    },
  };
  try {
    // Through the parts that join the form (form.ts): on a page with an offline outbox, a file the network could not
    // take comes back as its bytes, kept in its field to go with the send.
    const stored = (await run.host.through('upload', entry.file, (file) => (source.upload as NonNullable<DataSource['upload']>)(file, request))) as UploadedFile;
    if (!run.entries.includes(entry)) return;
    run.entries = run.entries.filter((other) => other !== entry);
    put(run, entry, stored);
    entry.end?.();
  } catch (error) {
    if (!run.entries.includes(entry) || stop.signal.aborted || (error as Error | null)?.name === 'AbortError') {
      if (run.entries.includes(entry)) run.drop(entry);
    } else {
      const problem = saveProblemOf(error);
      entry.status = problem.kind === 'rule' ? 'refused' : 'failed';
      entry.error = problem.message;
      entry.end?.();
    }
  } finally {
    delete entry.stop;
    run.tell();
    pumpUploads(run);
  }
}

/** The stored file in its field: exactly what the store gave — the words beside the bytes it stands in for kept. */
function put(run: UploadsRun, entry: Entry, stored: UploadedFile) {
  const def = run.host.fileField(entry.field, entry.line);
  const file: FileValue = { ...stored };
  run.order.set(file.url ?? '', entry.seq);
  const value = placed(run.host.read(entry.field, entry.line), file, {
    several: (def as { multiple?: boolean } | null)?.multiple === true,
    ...(entry.replaces ? { replaces: entry.replaces } : {}),
    pickedAfter: (other) => (run.order.get(other.url ?? '') ?? -1) > entry.seq,
  });
  if (value !== undefined) run.host.write(entry.field, entry.line, value, !!entry.replaces);
}
