import type { Field, Fields, LineField } from '../format/field';
import { lazyPart, type Part } from '../parts';
import type { DataSource, UploadFile } from './data-source';
import { fill, type Messages } from './messages';
import type * as UploadsModule from './files-part';
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
  /**
   * The file the field holds as its bytes that this one is stored for, as a save stores bytes — a photo cropped in a
   * photo set, stored at once: once stored, its link takes that file's place, the words beside it then (a caption)
   * kept. Changed meanwhile (cropped again, taken away), the stored file is laid nowhere.
   */
  replaces?: FileValue;
}

/** How many files go to the store at once; the rest wait their turn. */
export const UPLOADS_AT_ONCE = 3;

export const going = (status: FileUpload['status']) => status !== 'failed' && status !== 'refused';
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
}

/** A file on its way, as the uploads keep it (the state shows each as a `FileUpload`). */
export interface Entry {
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

export const isFile = (value: unknown): value is FileValue => !!value && typeof value === 'object' && typeof (value as FileValue).name === 'string' && typeof (value as FileValue).size === 'number';
export const filesIn = (value: Value | undefined): FileValue[] => (Array.isArray(value) ? (value as unknown[]).filter(isFile) : isFile(value) ? [value] : []);
const holdsFiles = (def: Field | LineField | undefined) => def?.type === 'binary' || def?.type === 'image';

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
 * The run of one form's uploads, shared with the uploads part that makes each file ready and sends it, then puts its
 * stored link in its field (files-part.ts): what the form gives, the files on their way, the order they were picked.
 */
export interface UploadsRun {
  readonly host: UploadsHost;
  entries: Entry[];
  /** Where each stored file came in the order picked, by its link: a later one goes after it. */
  readonly order: Map<string, number>;
  tell(): void;
  drop(entry: Entry): void;
}

/** The uploads part's code (files-part.ts). */
export type FormUploadsPart = typeof UploadsModule;

/**
 * Files made ready and sent to the store, their links put in their fields — the uploads' work, a part of its own that
 * comes with the files part (a page with a file or picture field asks for it before it is drawn), and the first time a
 * form sends a file or stores the bytes it holds. Until it has come, a file picked waits its turn.
 */
export const formUploadsPart: Part<FormUploadsPart> = lazyPart('files', () => import('./files-part'));

/** The uploads of one form. */
export function createUploads(host: UploadsHost) {
  let made = 0;
  let picked = 0;
  const waiters = new Set<() => void>();
  const run: UploadsRun = { host, entries: [], order: new Map(), tell, drop };

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
    host.changed(run.entries.map(shown));
    if (!run.entries.some((entry) => going(entry.status))) for (const done of [...waiters]) done();
  }

  function drop(entry: Entry) {
    run.entries = run.entries.filter((other) => other !== entry);
    entry.stop?.();
    entry.end?.();
  }

  /**
   * The next files made ready and sent, by the uploads part — at once where it has come, else once it has: a file
   * waits its turn meanwhile. One that cannot come fails the files going, said with why, each to be sent again.
   */
  function pump() {
    const part = formUploadsPart.loaded;
    if (part) return part.pumpUploads(run);
    if (!run.entries.some((entry) => going(entry.status))) return;
    formUploadsPart.load().then(
      () => pump(),
      (error: Error) => {
        for (const entry of run.entries.filter((one) => going(one.status))) {
          entry.status = 'failed';
          entry.error = error.message;
          entry.end?.();
        }
        tell();
      }
    );
  }

  function begin(field: string, line: Entry['line'], file: UploadFile, more: { prepare?: Entry['prepare']; replaces?: FileValue }): Entry {
    const entry: Entry = { id: `upload-${++made}`, seq: ++picked, field, ...(line ? { line } : {}), file, ...(more.prepare ? { prepare: more.prepare } : {}), ready: !more.prepare, ...(more.replaces ? { replaces: more.replaces } : {}), status: 'waiting', sent: 0, total: null };
    run.entries = [...run.entries, entry];
    void host.track(new Promise<void>((resolve) => (entry.end = resolve)));
    return entry;
  }

  /** Wait until no file is still going: each one stored, failed, refused or cancelled. */
  const settled = () =>
    new Promise<void>((resolve) => {
      if (!run.entries.some((entry) => going(entry.status))) return resolve();
      const done = () => (waiters.delete(done), resolve());
      waiters.add(done);
    });

  return {
    /** Send files picked for a field: its ids. */
    start(field: string, files: readonly UploadFile[], how: UploadHow = {}): string[] {
      if (!host.source()?.upload) throw new Error('The data source has no upload: files go inside the record');
      const def = host.fileField(field, how.line);
      if (!def) throw new Error(how.line ? `The lines of "${how.line.field}" have no file field "${field}"` : `"${field}" is not a file or picture field`);
      // A field of one file: the last one picked is the one it keeps; one still on its way is stopped. A file stored for
      // bytes the field holds stops none: it is no pick.
      if ((def as { multiple?: boolean }).multiple !== true && !how.replaces) {
        for (const entry of run.entries.filter((e) => e.field === field && e.line?.key === how.line?.key && e.line?.field === how.line?.field && !e.replaces)) drop(entry);
        files = files.slice(-1);
      }
      const started = (how.replaces ? files.slice(0, 1) : files).map((file) => begin(field, how.line, file, { prepare: how.prepare, replaces: how.replaces }));
      tell();
      pump();
      return started.map((entry) => entry.id);
    },
    cancel(id: string) {
      const entry = run.entries.find((e) => e.id === id);
      if (!entry) return;
      drop(entry);
      tell();
      pump();
    },
    retry(id: string) {
      const entry = run.entries.find((e) => e.id === id);
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
      if (!run.entries.length) return;
      for (const entry of [...run.entries]) drop(entry);
      tell();
    },
    /** Whether any file is still going. */
    going: () => run.entries.some((entry) => going(entry.status)),
    settled,
    /** Store each file still held as its bytes in the fields given, and wait for them all. */
    async storeBytes(found: { field: string; line?: Entry['line']; file: FileValue }[]) {
      if (!found.length || !host.source()?.upload) return;
      // The bytes made a file by the uploads part; where it cannot come, they go inside the record, as without upload.
      const part = await formUploadsPart.load().catch(() => null);
      if (!part) return;
      for (const { field, line, file } of found) begin(field, line, part.fileFromBytes(file), { replaces: file });
      tell();
      pump();
      await settled();
    },
    /** What stops a save, under each field: a file that failed, or that the store refused. */
    problems(messages: Messages): Record<string, string> {
      const out: Record<string, string> = {};
      const by = new Map<string, Entry[]>();
      for (const entry of run.entries.filter((e) => !going(e.status))) {
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
