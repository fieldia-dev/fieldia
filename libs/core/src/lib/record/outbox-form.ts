import type { Fields } from '../format/field';
import { saveProblemOf, type DataSource, type SaveProblem, type SaveRequest, type SubmitRequest, type UploadedFile, type UploadFile } from './data-source';
import type { FormJoin, JoinHost } from './joins';
import { fileBytesIn, formUploadsPart } from './uploads';
import { structuredCopy, type FileValue } from './values';

/**
 * An offline outbox (`outbox` on a page), the form's side — the outbox part's, which joins a form whose page has one
 * (joins.ts): a send that finds no network is kept on the device — its answers and its photos' bytes — and sent in order
 * when the signal comes back. In the one-tag script, one script with the viewer's outbox part (fieldia.outbox.js).
 */

/** A send kept on the device until it can go: what it was, its answers, how far it got. */
export interface OutboxItem {
  /** Its own key, the same for every try: sent with it (`queued.key`), so a server can tell a second try from a new send. */
  key: string;
  pageId: string;
  /** A response's `submit`, or a record's `save`. */
  kind: 'submit' | 'save';
  /** The send as it would have gone, its files' bytes in its values where they were not stored yet. */
  request: SubmitRequest | SaveRequest;
  /** When it was kept, as ISO: its place in the order they go. */
  at: string;
  /** A new record's own key on the form that kept it: a later save of the same record while this waits takes its place. */
  record?: string;
  /** How many times it was tried. */
  tries: number;
  /** Refused when it was sent (not the network's doing): why, kept for the person to see, and nothing sent after it waits on it. */
  refused?: { message: string; problem?: SaveProblem };
  /** Who is sending it now, and until when: no other tab or page sends it meanwhile. */
  claim?: { by: string; until: number };
}

/**
 * Where an outbox keeps its items: the browser's IndexedDB in the viewer (the outbox part's), a memory store in tests
 * (`memoryOutbox`), or the app's own. Every call is the store's to make atomic: `claim` takes an item for one sender only.
 */
export interface OutboxStore {
  /** The items of a page, in the order they were kept. */
  list(pageId: string): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  delete(key: string): Promise<void>;
  /** Take an item to send it, unless another sender holds it still: whether it was taken. */
  claim(key: string, by: string, until: number): Promise<boolean>;
}

/** A form's outbox, made for it (`join`; `form.joined('outbox')`). */
export interface FormOutbox extends FormJoin {
  /** Keep a send that found no network, in order — a new record's later save in place of its earlier one still waiting. */
  keep(kind: OutboxItem['kind'], request: SubmitRequest | SaveRequest, record?: string): Promise<OutboxItem>;
  /** Send what waits, in order: a network's failure stops it there (tried again later), a refusal is kept and said. */
  send(): Promise<void>;
  /** What waits now, told in the form's state (`outbox`). */
  refresh(): Promise<void>;
  /** Let a refused send go: the person's Discard. */
  discard(key: string): Promise<void>;
  /** Try again a refused send, as it is. */
  retry(key: string): Promise<void>;
  /** A file the network could not take, as its field keeps it until the send goes: its bytes, in base64. */
  bytes(file: UploadFile): Promise<FileValue>;
}

/** What the outbox's sending needs of the form: its page's, its source, and where the items are kept. */
interface OutboxHost {
  readonly pageId: string;
  readonly fields: Fields;
  readonly dataSource: DataSource | undefined;
}

/** How long a sender holds an item it took: past this, another may take it (a tab closed while it sent). */
const CLAIM_MS = 120_000;
let sender = 0;

/** An outbox kept in memory: for tests, and where a browser keeps nothing (no IndexedDB). Lost with the page. */
export function memoryOutbox(): OutboxStore & { readonly items: OutboxItem[] } {
  const items: OutboxItem[] = [];
  return {
    items,
    list: async (pageId) => structuredCopy(items.filter((item) => item.pageId === pageId)),
    async put(item) {
      const at = items.findIndex((one) => one.key === item.key);
      if (at < 0) items.push(structuredCopy(item));
      else items[at] = structuredCopy(item);
    },
    async delete(key) {
      const at = items.findIndex((one) => one.key === key);
      if (at >= 0) items.splice(at, 1);
    },
    async claim(key, by, until) {
      const item = items.find((one) => one.key === key);
      if (!item || (item.claim && item.claim.by !== by && item.claim.until > Date.now())) return false;
      item.claim = { by, until };
      return true;
    },
  };
}

/** What the browser's IndexedDB gives, as far as an outbox uses it: core names no DOM types. */
interface IdbRequest<T> {
  result: T;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}
interface IdbStore {
  get(key: string): IdbRequest<OutboxItem | undefined>;
  getAll(): IdbRequest<OutboxItem[]>;
  put(value: OutboxItem): IdbRequest<unknown>;
  delete(key: string): IdbRequest<unknown>;
}
interface IdbTransaction {
  objectStore(name: string): IdbStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  error: unknown;
}
interface IdbDatabase {
  transaction(name: string, mode: 'readonly' | 'readwrite'): IdbTransaction;
  createObjectStore(name: string, options: { keyPath: string }): unknown;
  objectStoreNames: { contains(name: string): boolean };
}
interface IdbFactory {
  open(name: string, version: number): IdbRequest<IdbDatabase> & { onupgradeneeded: (() => void) | null };
}

const asked = <T>(request: IdbRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * An outbox kept in the browser's IndexedDB (database `fieldia-outbox`, store `items`): never lost on a reload, shared by
 * the tabs of one site, an item taken by one sender at a time in a transaction of its own. Null where the browser has no
 * IndexedDB.
 */
export function indexedOutbox(name = 'fieldia-outbox'): OutboxStore | null {
  const factory = (globalThis as unknown as { indexedDB?: IdbFactory }).indexedDB;
  if (!factory) return null;
  let opened: Promise<IdbDatabase> | null = null;
  const db = () => {
    if (opened) return opened;
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('items')) request.result.createObjectStore('items', { keyPath: 'key' });
    };
    opened = asked(request);
    // A database that could not open is asked again next time.
    opened.catch(() => (opened = null));
    return opened;
  };
  const write = async (work: (store: IdbStore) => void | Promise<boolean>): Promise<boolean> => {
    const transaction = (await db()).transaction('items', 'readwrite');
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    const result = await work(transaction.objectStore('items'));
    await done;
    return result !== false;
  };
  return {
    async list(pageId) {
      const all = await asked((await db()).transaction('items', 'readonly').objectStore('items').getAll());
      return all.filter((item) => item.pageId === pageId).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    },
    put: (item) => write((store) => void store.put(structuredCopy(item))).then(() => undefined),
    delete: (key) => write((store) => void store.delete(key)).then(() => undefined),
    claim(key, by, until) {
      // In one transaction: read, and take it only where no other sender holds it still.
      return write(async (store) => {
        const item = await asked(store.get(key));
        if (!item || (item.claim && item.claim.by !== by && item.claim.until > Date.now())) return false;
        store.put({ ...item, claim: { by, until } });
        return true;
      });
    },
  };
}

/** A key no other kept send has. */
const newKey = (now: number) => `outbox-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Files still held as their bytes in a kept send — photos taken without signal — stored first, through the source's
 * `upload`, and their links put in their place wherever the send holds them: its values, a save's changes and lines.
 */
async function withFilesStored(item: OutboxItem, host: OutboxHost): Promise<SubmitRequest | SaveRequest> {
  const source = host.dataSource;
  const request = item.request;
  const fields = item.kind === 'save' ? (request as SaveRequest).fields : host.fields;
  const found = fileBytesIn(fields, request.values, Object.keys(request.values));
  if (!found.length || !source?.upload) return request;
  const stored = new Map<string, UploadedFile>();
  // A file held as its bytes made one the store takes by the files part (files-part.ts), as the form's uploads do.
  const { fileFromBytes } = await formUploadsPart.load();
  for (const { field, line, file } of found) {
    const key = `${file.name}\u0000${file.data}`;
    if (stored.has(key)) continue;
    const recordId = item.kind === 'save' ? (request as SaveRequest).id : null;
    stored.set(key, await source.upload(fileFromBytes(file), { model: item.kind === 'save' ? (request as SaveRequest).model : '', field, recordId, ...(line ? { line } : {}) }));
  }
  // Every place the send holds one of those files, its link in place of its bytes, its other words kept.
  const swap = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(swap);
    if (!value || typeof value !== 'object') return value;
    const file = value as FileValue;
    if (typeof file.name === 'string' && typeof file.data === 'string') {
      const link = stored.get(`${file.name}\u0000${file.data}`);
      if (link) {
        const { data: _bytes, ...rest } = file;
        return { ...rest, ...link };
      }
    }
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, swap(inner)]));
  };
  return swap(request) as SubmitRequest | SaveRequest;
}

/** A new record's own key while it has no id: a later save of it, while its first waits, takes that one's place. */
const recordKey = () => `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The outbox part's side of a form (`outbox` on its page): around each send, one that finds no network kept on the
 * device in order — the form going on as though it went, its ending saying so (`state.outbox.kept`) — and a file the
 * network could not take kept as its bytes; what waits sent — each taken by one sender only, its photos stored first —
 * when the signal comes back, and right after a send of this form went through; a refusal kept and said; what waits
 * told in the form's state (`outbox`).
 */
export function join(joined: JoinHost): FormOutbox {
  const { form, page, options, set } = joined;
  const host: OutboxHost = { pageId: page.id, fields: page.fields, dataSource: options.dataSource };
  const store = options.outbox ?? indexedOutbox() ?? memoryOutbox();
  const me = `sender-${++sender}-${Math.random().toString(36).slice(2, 8)}`;
  let sending: Promise<void> | null = null;
  /** Whether the last try found no network: a send kept, or one of those kept tried and not taken. */
  let offline = false;
  /** Whether this form's last send was kept, not sent: its ending says so. */
  let kept = false;
  /** This form's new record's own key, while it has no id. */
  let record = recordKey();
  /** Whether this form's last send was kept, said at once: its ending reads it as the send ends. */
  const keptNow = (now: boolean) => {
    kept = now;
    const told = form.getState().outbox;
    if (told && told.kept !== now) set({ outbox: { ...told, kept } });
  };
  const refresh = async () => {
    const items = await store.list(host.pageId);
    set({
      outbox: {
        waiting: items.filter((item) => !item.refused).length,
        sending: sending !== null,
        offline,
        kept,
        refused: items.filter((item) => item.refused).map((item) => ({ key: item.key, message: item.refused?.message ?? '', at: item.at })),
      },
    });
  };
  const sendAll = async () => {
    const source = host.dataSource;
    if (!source) return;
    await refresh();
    for (const item of await store.list(host.pageId)) {
      if (item.refused || !(await store.claim(item.key, me, Date.now() + CLAIM_MS))) continue;
      const tries = item.tries + 1;
      try {
        const request = { ...(await withFilesStored(item, host)), queued: { key: item.key, at: item.at } };
        if (item.kind === 'submit') {
          if (!source.submit) throw new Error('This page has no data source to send its answers to');
          await source.submit(request as SubmitRequest);
        } else {
          if (!source.save) throw new Error('This page has no data source to save to');
          const result = await source.save(request as SaveRequest);
          // The new record this form still shows went: it has its id now.
          if (item.record === record && form.getState().recordId == null) set({ recordId: result.id, version: result.version ?? null });
        }
        offline = false;
        await store.delete(item.key);
      } catch (error) {
        const problem = saveProblemOf(error);
        const { claim: _claim, ...again } = item;
        // No signal again: it waits where it was, and so does every send after it.
        offline = problem.kind === 'network';
        if (offline) {
          await store.put({ ...again, tries });
          break;
        }
        await store.put({ ...again, tries, refused: { message: problem.message, problem } });
      }
      await refresh();
    }
  };
  const outbox: FormOutbox = {
    async keep(kind, request, own) {
      const items = await store.list(host.pageId);
      // A new record saved again while its first save waits: one save, of the record as it is now.
      const same = own ? items.find((item) => item.record === own && item.kind === kind && !item.refused && !(item.claim && item.claim.until > Date.now())) : undefined;
      const item: OutboxItem = same
        ? { ...same, request: structuredCopy(request) }
        : { key: newKey(Date.now()), pageId: host.pageId, kind, request: structuredCopy(request), at: new Date().toISOString(), ...(own ? { record: own } : {}), tries: 0 };
      await store.put(item);
      offline = true;
      await refresh();
      return item;
    },
    send() {
      if (sending) return sending;
      sending = sendAll().finally(() => {
        sending = null;
        return refresh();
      });
      void refresh();
      return sending;
    },
    refresh,
    async discard(key) {
      await store.delete(key);
      await refresh();
    },
    async bytes(file) {
      const read = new Uint8Array(await file.arrayBuffer());
      let text = '';
      for (let at = 0; at < read.length; at += 0x8000) text += String.fromCharCode(...read.subarray(at, at + 0x8000));
      return { name: file.name, type: file.type, size: file.size, data: (globalThis as unknown as { btoa(text: string): string }).btoa(text) };
    },
    async retry(key) {
      const item = (await store.list(host.pageId)).find((one) => one.key === key);
      if (!item) return;
      const { refused: _refused, ...again } = item;
      await store.put(again);
      await outbox.send();
    },
    async around(kind, sent, go) {
      try {
        const answer = await go(sent);
        // It went: there is signal, and what waited goes after it.
        if (kind !== 'upload') {
          keptNow(false);
          void outbox.send();
        }
        return answer;
      } catch (error) {
        if (saveProblemOf(error).kind !== 'network') throw error;
        // No signal: a photo kept as its bytes in its field; a send kept on the device, the form going on as though it went.
        if (kind === 'upload') return (await outbox.bytes(sent as UploadFile)) as never;
        kept = true;
        await outbox.keep(kind, sent as SubmitRequest | SaveRequest, kind === 'save' && form.getState().recordId == null ? record : undefined);
        return null;
      }
    },
    reset() {
      // Started again, or another record: a new record's own key, and its ending its own.
      record = recordKey();
      keptNow(false);
    },
  };
  // What waits from before — a reload, another tab — told at once.
  void refresh();
  return outbox;
}
