import type { Fields } from '../format/field';
import { saveProblemOf, type DataSource, type SaveRequest, type SaveResult, type SubmitRequest, type UploadedFile, type UploadFile } from './data-source';
import type { FormState } from './form';
import type { OutboxItem, OutboxStore } from './outbox';
import { fileBytesIn, fileFromBytes } from './uploads';
import { structuredCopy, type FileValue } from './values';

/** What a form's outbox asks of the form it is made for. */
export interface OutboxHost {
  readonly pageId: string;
  readonly fields: Fields;
  readonly dataSource: DataSource | undefined;
  /** Where the items are kept: the app's own store, else the browser's IndexedDB, else memory (`memoryOutbox`). */
  readonly store: OutboxStore | undefined;
  set(patch: Partial<FormState>): void;
  /** A new record whose save waited here went: its id, for the form still showing it (by its own key). */
  saved(record: string, result: SaveResult): void;
  /** Now, in ms. */
  now(): number;
}

/** A form's outbox, made for it (`formOutbox`). */
export interface FormOutbox {
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

/**
 * The form's side of an offline outbox (`outbox` on a page): a send that found no network kept on the device in order,
 * and sent — each taken by one sender only, its photos stored first — when the signal comes back; a refusal kept and
 * said; what waits told in the form's state.
 */
export function formOutbox(host: OutboxHost): FormOutbox {
  const store = host.store ?? indexedOutbox() ?? memoryOutbox();
  const me = `sender-${++sender}-${Math.random().toString(36).slice(2, 8)}`;
  let sending: Promise<void> | null = null;
  /** Whether the last try found no network: a send kept, or one of those kept tried and not taken. */
  let offline = false;
  const refresh = async () => {
    const items = await store.list(host.pageId);
    host.set({
      outbox: {
        waiting: items.filter((item) => !item.refused).length,
        sending: sending !== null,
        offline,
        refused: items.filter((item) => item.refused).map((item) => ({ key: item.key, message: item.refused?.message ?? '', at: item.at })),
      },
    });
  };
  const sendAll = async () => {
    const source = host.dataSource;
    if (!source) return;
    await refresh();
    for (const item of await store.list(host.pageId)) {
      if (item.refused || !(await store.claim(item.key, me, host.now() + CLAIM_MS))) continue;
      const tries = item.tries + 1;
      try {
        const request = { ...(await withFilesStored(item, host)), queued: { key: item.key, at: item.at } };
        if (item.kind === 'submit') {
          if (!source.submit) throw new Error('This page has no data source to send its answers to');
          await source.submit(request as SubmitRequest);
        } else {
          if (!source.save) throw new Error('This page has no data source to save to');
          const result = await source.save(request as SaveRequest);
          if (item.record) host.saved(item.record, result);
        }
        offline = false;
        await store.delete(item.key);
      } catch (error) {
        const problem = saveProblemOf(error);
        const { claim: _claim, ...kept } = item;
        // No signal again: it waits where it was, and so does every send after it.
        offline = problem.kind === 'network';
        if (offline) {
          await store.put({ ...kept, tries });
          break;
        }
        await store.put({ ...kept, tries, refused: { message: problem.message, problem } });
      }
      await refresh();
    }
  };
  return {
    async keep(kind, request, record) {
      const items = await store.list(host.pageId);
      // A new record saved again while its first save waits: one save, of the record as it is now.
      const same = record ? items.find((item) => item.record === record && item.kind === kind && !item.refused && !(item.claim && item.claim.until > host.now())) : undefined;
      const item: OutboxItem = same
        ? { ...same, request: structuredCopy(request) }
        : { key: newKey(host.now()), pageId: host.pageId, kind, request: structuredCopy(request), at: new Date(host.now()).toISOString(), ...(record ? { record } : {}), tries: 0 };
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
      await this.send();
    },
  };
}
