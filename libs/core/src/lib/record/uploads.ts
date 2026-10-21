import type { Field, Fields, LineField } from '../format/field';
import { saveProblemOf, type DataSource, type UploadFile, type UploadRequest, type UploadSignal, type UploadedFile } from './data-source';
import { fill, type Messages } from './messages';
import type { FileValue, Line, RecordId, Value, Values } from './values';

/**
 * Files stored as they are picked. Where the data source has `upload`, a
 * file or picture field hands each file to the form, which sends it to the
 * app's store at once — three at a time, the rest waiting their turn, each
 * made ready first when the field asks (a photo made smaller), one at a time
 * — and puts the stored file's link in the field, in the order the files were
 * picked. The form's state shows each on its way; Cancel stops one, Retry
 * sends a failed one again. A save waits for those still going, and stops
 * under its field for one that did not get there. A file still held as its
 * bytes — a signature drawn, a value the app set — is stored by the save.
 */

/** A file on its way to the store, as the form's state shows it. */
export interface FileUpload {
  readonly id: string;
  /** The file or picture field it is for: on a table's line, the line's own field. */
  readonly field: string;
  /** For a field on a line of a table: the table's field and the line's key. */
  readonly line?: { readonly field: string; readonly key: string };
  readonly name: string;
  readonly size: number;
  readonly type: string;
  /**
   * `waiting` its turn; `preparing`, made ready first (a photo made smaller);
   * `uploading`, `sent` of `total` bytes on their way; `failed`, not stored —
   * Retry may mend it; `refused`, the store will not keep it, `error` says why.
   */
  readonly status: 'waiting' | 'preparing' | 'uploading' | 'failed' | 'refused';
  readonly sent: number;
  /** The bytes in all, once the store has told them: null, and its bar moves with no number. */
  readonly total: number | null;
  /** Why it failed, or why the store refused it. */
  readonly error?: string;
}

/** How files are taken, besides the field they are for. */
export interface UploadHow {
  /** For a field on a line of a table: the table's field and the line's key. */
  line?: { field: string; key: string };
  /** Each file made ready before it goes, one at a time: a photo made smaller. A file it cannot make ready goes as it is. */
  prepare?: (file: UploadFile) => Promise<UploadFile>;
}

/** How many files go to the store at once; the rest wait their turn. */
export const UPLOADS_AT_ONCE = 3;

const going = (status: FileUpload['status']) => status !== 'failed' && status !== 'refused';
/** Whether an upload is still going: waiting, being made ready, or on its way. */
export const uploadGoing = (upload: FileUpload) => going(upload.status);

/** What the form gives the uploads: where files go, where their links are put, and how the state is told. */
export interface UploadsHost {
  source(): DataSource | undefined;
  /** The page's model, or a page of responses' id; for a saved form placed in a record, the record's. */
  model(): string;
  recordId(): RecordId | null;
  /**
   * Where the form's fields sit in the record its files are for, before each
   * field's name: a saved form placed in a record keeps its answers under the
   * part's name, so its field `doc` is `consent.doc` there. Empty otherwise.
   */
  under?: string;
  /** A line's id, once it is saved. */
  lineId(field: string, key: string): RecordId | undefined;
  /** A field's or a line field's definition, or null when it holds no files. */
  fileField(field: string, line?: { field: string; key: string }): Field | LineField | null;
  /** The field's value now. */
  read(field: string, line?: { field: string; key: string }): Value | undefined;
  /** Write the field: a person's pick, or (`quiet`) a save putting a link in place of the bytes. */
  write(field: string, line: { field: string; key: string } | undefined, value: Value, quiet: boolean): void;
  changed(uploads: readonly FileUpload[]): void;
  track<T>(promise: Promise<T>): Promise<T>;
  /**
   * An upload through the parts that join the form (form.ts): on a page with an offline outbox, a file the network
   * could not take comes back as its bytes, kept in its field to go with the send.
   */
  through<T>(kind: 'upload', file: UploadFile, send: (file: UploadFile) => Promise<T>): Promise<T | null>;
}

interface Entry {
  id: string;
  /** Its place in the order files were picked. */
  seq: number;
  field: string;
  line?: { field: string; key: string };
  file: UploadFile;
  prepare?: (file: UploadFile) => Promise<UploadFile>;
  /** Made ready, or needing nothing done. */
  ready: boolean;
  /** The file held as its bytes that this one is stored for: a save puts the link in its place. */
  replaces?: FileValue;
  status: FileUpload['status'];
  sent: number;
  total: number | null;
  error?: string;
  stop?: () => void;
  /** Ends its run: stored, failed, refused or cancelled. */
  end?: () => void;
}

/** The host's `AbortController`: every browser's, and Node's. Core names no DOM types. */
const stopper = () => new (globalThis as unknown as { AbortController: new () => { signal: UploadSignal; abort(): void } }).AbortController();

const sameFile = (a: FileValue, b: FileValue) => a.name === b.name && a.data === b.data && a.url === b.url;
const isFile = (value: unknown): value is FileValue => !!value && typeof value === 'object' && typeof (value as FileValue).name === 'string' && typeof (value as FileValue).size === 'number';
const filesIn = (value: Value | undefined): FileValue[] => (Array.isArray(value) ? (value as unknown[]).filter(isFile) : isFile(value) ? [value] : []);
const holdsFiles = (def: Field | LineField | undefined) => def?.type === 'binary' || def?.type === 'image';

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

/**
 * The values as a draft keeps them: a file held as its bytes is left out —
 * a field holding one is not kept at all, and a line's loses that file —
 * so a draft stays small enough for the browser's store, and restoring it
 * leaves those fields as the record holds them.
 */
export function withoutFileBytes(fields: Fields, values: Readonly<Values>): Values {
  const kept: Values = {};
  for (const [name, value] of Object.entries(values)) {
    const def = fields[name];
    if (holdsFiles(def)) {
      if (!filesIn(value).some((file) => file.data !== undefined)) kept[name] = value;
    } else if (def?.type === 'one2many' && Array.isArray(value)) {
      const subs = Object.entries(def.fields).filter(([, sub]) => holdsFiles(sub as LineField)).map(([sub]) => sub);
      kept[name] = !subs.length
        ? value
        : (value as Line[]).map((line) => {
            const own = { ...line.values };
            for (const sub of subs) if (filesIn(own[sub]).some((file) => file.data !== undefined)) delete own[sub];
            return { ...line, values: own };
          });
    } else kept[name] = value;
  }
  return kept;
}

/** Each file still held as its bytes in the fields that changed — on the record, or on a changed table's lines — for a save to store. */
export function fileBytesIn(fields: Fields, values: Readonly<Values>, changed: readonly string[]): { field: string; line?: { field: string; key: string }; file: FileValue }[] {
  const found: { field: string; line?: { field: string; key: string }; file: FileValue }[] = [];
  for (const name of changed) {
    const def = fields[name];
    if (holdsFiles(def)) for (const file of filesIn(values[name])) if (file.data !== undefined) found.push({ field: name, file });
    if (def?.type !== 'one2many') continue;
    for (const line of (values[name] as Line[] | null) ?? []) {
      for (const [sub, subDef] of Object.entries(def.fields)) {
        if (holdsFiles(subDef as LineField)) for (const file of filesIn(line.values[sub])) if (file.data !== undefined) found.push({ field: sub, line: { field: name, key: line.key }, file });
      }
    }
  }
  return found;
}

/**
 * A field's files with a stored one put in: in place of the bytes it was
 * stored for (nothing, when those are gone), in place of a field's one file,
 * or among several before the first that was picked after it.
 */
function placed(current: Value | undefined, stored: FileValue, how: { several: boolean; replaces?: FileValue; pickedAfter: (file: FileValue) => boolean }): Value | undefined {
  if (how.replaces) {
    const was = how.replaces;
    if (Array.isArray(current)) {
      const at = (current as unknown[]).findIndex((file) => isFile(file) && sameFile(file, was));
      return at < 0 ? undefined : ((current as unknown[]).map((file, i) => (i === at ? stored : file)) as unknown as Value);
    }
    return isFile(current) && sameFile(current, was) ? (stored as unknown as Value) : undefined;
  }
  if (!how.several) return stored as unknown as Value;
  const files = filesIn(current);
  const at = files.findIndex(how.pickedAfter);
  const list = at < 0 ? [...files, stored] : [...files.slice(0, at), stored, ...files.slice(at)];
  return list as unknown as Value;
}

/** The uploads of one form. */
export function createUploads(host: UploadsHost) {
  let entries: Entry[] = [];
  let made = 0;
  let picked = 0;
  /** Where each stored file came in the order picked, by its link: a later one goes after it. */
  const order = new Map<string, number>();
  const waiters = new Set<() => void>();

  const shown = (entry: Entry): FileUpload => ({
    id: entry.id,
    field: entry.field,
    ...(entry.line ? { line: entry.line } : {}),
    name: entry.file.name,
    size: entry.file.size,
    type: entry.file.type,
    status: entry.status,
    sent: entry.sent,
    total: entry.total,
    ...(entry.error !== undefined ? { error: entry.error } : {}),
  });

  function tell() {
    host.changed(entries.map(shown));
    if (!entries.some((entry) => going(entry.status))) for (const done of [...waiters]) done();
  }

  function drop(entry: Entry) {
    entries = entries.filter((other) => other !== entry);
    entry.stop?.();
    entry.end?.();
  }

  /** The next to be made ready, one at a time, and the next to go, three at a time. */
  function pump() {
    if (!entries.some((entry) => entry.status === 'preparing')) {
      const next = entries.find((entry) => entry.status === 'waiting' && !entry.ready);
      if (next) void prepare(next);
    }
    for (let next = nextToSend(); next && entries.filter((entry) => entry.status === 'uploading').length < UPLOADS_AT_ONCE; next = nextToSend()) void send(next);
  }
  const nextToSend = () => entries.find((entry) => entry.status === 'waiting' && entry.ready);

  async function prepare(entry: Entry) {
    entry.status = 'preparing';
    tell();
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
    if (!entries.includes(entry)) return;
    entry.status = refused === null ? 'waiting' : 'refused';
    if (refused !== null) {
      entry.error = refused;
      entry.end?.();
    }
    tell();
    pump();
  }

  async function send(entry: Entry) {
    const source = host.source();
    if (!source?.upload) return;
    const stop = stopper();
    entry.status = 'uploading';
    entry.sent = 0;
    entry.total = null;
    delete entry.error;
    entry.stop = () => stop.abort();
    tell();
    const lineId = entry.line ? host.lineId(entry.line.field, entry.line.key) : undefined;
    const under = host.under ?? '';
    const request: UploadRequest = {
      model: host.model(),
      // A line's field is named on its own, its table where it sits.
      field: entry.line ? entry.field : `${under}${entry.field}`,
      recordId: host.recordId(),
      ...(entry.line ? { line: { ...entry.line, field: `${under}${entry.line.field}`, ...(lineId !== undefined ? { id: lineId } : {}) } } : {}),
      signal: stop.signal,
      onProgress: (sent, total) => {
        if (entry.status !== 'uploading' || !entries.includes(entry)) return;
        // Told when the bar would move: a whole per cent, or the end.
        const was = entry.total ? Math.floor((entry.sent * 100) / entry.total) : -1;
        const now = total ? Math.floor((sent * 100) / total) : -1;
        entry.sent = sent;
        entry.total = total;
        if (now !== was || sent === total) tell();
      },
    };
    try {
      const stored = (await host.through('upload', entry.file, (file) => (source.upload as NonNullable<DataSource['upload']>)(file, request))) as UploadedFile;
      if (!entries.includes(entry)) return;
      entries = entries.filter((other) => other !== entry);
      put(entry, stored);
      entry.end?.();
    } catch (error) {
      if (!entries.includes(entry) || stop.signal.aborted || (error as Error | null)?.name === 'AbortError') {
        if (entries.includes(entry)) drop(entry);
      } else {
        const problem = saveProblemOf(error);
        entry.status = problem.kind === 'rule' ? 'refused' : 'failed';
        entry.error = problem.message;
        entry.end?.();
      }
    } finally {
      delete entry.stop;
      tell();
      pump();
    }
  }

  /** The stored file in its field: exactly what the store gave — its other words kept, for bytes it stands in for. */
  function put(entry: Entry, stored: UploadedFile) {
    const def = host.fileField(entry.field, entry.line);
    const extra: Partial<FileValue> = {};
    if (entry.replaces) for (const [key, value] of Object.entries(entry.replaces)) if (!['data', 'url', 'name', 'size', 'type', 'fileId'].includes(key)) (extra as Record<string, unknown>)[key] = value;
    const file: FileValue = { ...stored, ...extra };
    order.set(file.url ?? '', entry.seq);
    const value = placed(host.read(entry.field, entry.line), file, {
      several: (def as { multiple?: boolean } | null)?.multiple === true,
      ...(entry.replaces ? { replaces: entry.replaces } : {}),
      pickedAfter: (other) => (order.get(other.url ?? '') ?? -1) > entry.seq,
    });
    if (value !== undefined) host.write(entry.field, entry.line, value, !!entry.replaces);
  }

  function begin(field: string, line: Entry['line'], file: UploadFile, more: { prepare?: Entry['prepare']; replaces?: FileValue }): Entry {
    const entry: Entry = { id: `upload-${++made}`, seq: ++picked, field, ...(line ? { line } : {}), file, ...(more.prepare ? { prepare: more.prepare } : {}), ready: !more.prepare, ...(more.replaces ? { replaces: more.replaces } : {}), status: 'waiting', sent: 0, total: null };
    entries = [...entries, entry];
    void host.track(new Promise<void>((resolve) => (entry.end = resolve)));
    return entry;
  }

  /** Wait until no file is still going: each one stored, failed, refused or cancelled. */
  const settled = () =>
    new Promise<void>((resolve) => {
      if (!entries.some((entry) => going(entry.status))) return resolve();
      const done = () => (waiters.delete(done), resolve());
      waiters.add(done);
    });

  return {
    /** Send files picked for a field: its ids. */
    start(field: string, files: readonly UploadFile[], how: { line?: Entry['line']; prepare?: Entry['prepare'] } = {}): string[] {
      if (!host.source()?.upload) throw new Error('The data source has no upload: files go inside the record');
      const def = host.fileField(field, how.line);
      if (!def) throw new Error(how.line ? `The lines of "${how.line.field}" have no file field "${field}"` : `"${field}" is not a file or picture field`);
      // A field of one file: the last one picked is the one it keeps; one still on its way is stopped.
      if ((def as { multiple?: boolean }).multiple !== true) {
        for (const entry of entries.filter((e) => e.field === field && e.line?.key === how.line?.key && e.line?.field === how.line?.field && !e.replaces)) drop(entry);
        files = files.slice(-1);
      }
      const started = files.map((file) => begin(field, how.line, file, { prepare: how.prepare }));
      tell();
      pump();
      return started.map((entry) => entry.id);
    },
    cancel(id: string) {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      drop(entry);
      tell();
      pump();
    },
    retry(id: string) {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.status !== 'failed') return;
      entry.status = 'waiting';
      entry.sent = 0;
      entry.total = null;
      delete entry.error;
      void host.track(new Promise<void>((resolve) => (entry.end = resolve)));
      tell();
      pump();
    },
    /** Stop every upload: the changes they were for are gone. */
    clear() {
      if (!entries.length) return;
      for (const entry of [...entries]) drop(entry);
      tell();
    },
    /** Whether any file is still going. */
    going: () => entries.some((entry) => going(entry.status)),
    settled,
    /** Store each file still held as its bytes in the fields given, and wait for them all. */
    async storeBytes(found: { field: string; line?: Entry['line']; file: FileValue }[]) {
      if (!found.length || !host.source()?.upload) return;
      for (const { field, line, file } of found) begin(field, line, fileFromBytes(file), { replaces: file });
      tell();
      pump();
      await settled();
    },
    /** What stops a save, under each field: a file that failed, or that the store refused. */
    problems(messages: Messages): Record<string, string> {
      const out: Record<string, string> = {};
      const by = new Map<string, Entry[]>();
      for (const entry of entries.filter((e) => !going(e.status))) {
        const key = entry.line ? `${entry.line.field}.${entry.line.key}.${entry.field}` : entry.field;
        by.set(key, [...(by.get(key) ?? []), entry]);
      }
      for (const [key, list] of by) {
        const refused = list.filter((entry) => entry.status === 'refused');
        out[key] =
          list.length > 1 ? fill(messages.notUploadedMany, { n: list.length })
          : refused.length ? fill(messages.fileRefused, { name: list[0].file.name, reason: list[0].error ?? '' })
          : fill(messages.notUploaded, { name: list[0].file.name });
      }
      return out;
    },
  };
}

export type Uploads = ReturnType<typeof createUploads>;
