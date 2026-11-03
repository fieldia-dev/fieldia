import type { Fields } from '../format/field';
import { saveProblemOf, type DataSource, type RecordVersion, type SaveProblem, type SaveRequest, type SubmitRequest, type UploadedFile, type UploadFile } from './data-source';
import type { FormInner, FormJoin } from './joins';
import { lastsPastThePage, ownerOf } from './browser-kept';
import { fileBytesIn, formUploadsPart } from './uploads';
import { answerOf, structuredCopy, type FileValue } from './values';

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
  /**
   * Whose it is: the signed-in person's (`u:<id>`), else the tab's it was kept in (`t:<id>`). Only their own forms send
   * it, so it never goes under the next person's session. None on an item kept before 0.34: any form of its page sends it.
   */
  owner?: string;
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
  /** Let go every item — or an owner's alone — unsent: sign-out (`outbox.clear()`). */
  clear?(owner?: string): Promise<void>;
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

/**
 * How long a sender holds an item it took: past this, another may take it (a tab closed while it sent). A sender still
 * sending renews its claim each third of it (a heartbeat), so a send that takes longer — a film uploaded on a slow
 * signal — is never taken by a second tab meanwhile.
 */
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
    async clear(owner) {
      for (let at = items.length - 1; at >= 0; at--) if (owner === undefined || items[at].owner === owner) items.splice(at, 1);
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
  close(): void;
  onversionchange: (() => void) | null;
  onclose: (() => void) | null;
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
  // One connection a database, shared by every form that keeps sends in it: a page mounting forms one after another
  // opened one each and closed none (0.32: 30 mounts, 30 connections open).
  let open = connections.get(factory);
  if (!open) connections.set(factory, (open = new Map()));
  const shared = open;
  const db = () => {
    const opened = shared.get(name);
    if (opened) return opened;
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('items')) request.result.createObjectStore('items', { keyPath: 'key' });
    };
    const made = asked(request).then((database) => {
      // Another tab opening a newer version: this one lets it go at once, and opens it again when next asked.
      const forget = () => shared.get(name) === made && shared.delete(name);
      database.onversionchange = () => {
        database.close();
        forget();
      };
      database.onclose = forget;
      return database;
    });
    shared.set(name, made);
    // A database that could not open is asked again next time.
    made.catch(() => shared.get(name) === made && shared.delete(name));
    return made;
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
    clear: (owner) =>
      write(async (store) => {
        for (const item of await asked(store.getAll())) if (owner === undefined || item.owner === owner) store.delete(item.key);
        return true;
      }).then(() => undefined),
  };
}

/** The connections open, by the browser's IndexedDB they are of, by name. */
const connections = new WeakMap<IdbFactory, Map<string, Promise<IdbDatabase>>>();

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
export function join(joined: FormInner): FormOutbox {
  const { form, page, options, set, scheduler } = joined;
  const host: OutboxHost = { pageId: page.id, fields: page.fields, dataSource: options.dataSource };
  // Where a browser keeps nothing past the page (no IndexedDB): held in memory, and said so — never "kept on this device".
  const lasting = options.outbox ?? indexedOutbox();
  const shared = lasting ?? memoryOutbox();
  // This person's sends alone: the signed-in person's, else this tab's — never another's, sent under their session.
  const owner = ownerOf(form.user());
  const mine = (item: OutboxItem) => item.owner === undefined || item.owner === owner;
  // Each answer of the store — an app's own among them — handled as it is given (`answerOf`): one it refuses at once is
  // never said unhandled by an Angular zone while an `await` here comes to it a microtask late.
  const store: OutboxStore = {
    list: async (pageId) => (await answerOf(shared.list(pageId))).filter(mine),
    put: (item) => answerOf(shared.put(item)),
    delete: (key) => answerOf(shared.delete(key)),
    claim: (key, by, until) => answerOf(shared.claim(key, by, until)),
  };
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
        // Kept past the page: in a store that lasts, for a signed-in person (a tab's own go with the tab).
        lasting: lasting !== null && lastsPastThePage(owner),
      },
    });
  };
  /** A kept send of the same record as this save: a new one's own, or a stored one's by its model and id. */
  const sameRecord = (item: OutboxItem, request: SaveRequest) =>
    item.kind === 'save' && !item.refused && (request.id == null ? item.record === record : (item.request as SaveRequest).id === request.id && (item.request as SaveRequest).model === request.model);
  const sendAll = async () => {
    const source = host.dataSource;
    if (!source) return;
    await refresh();
    /** Each record's version as a send of it in this run left it: the person's own saves go one after another, never refused by their own. */
    const versions = new Map<string, RecordVersion>();
    for (const item of await store.list(host.pageId)) {
      if (item.refused || !(await store.claim(item.key, me, Date.now() + CLAIM_MS))) continue;
      const tries = item.tries + 1;
      // Held while it goes, however long it takes: the claim renewed each third of it.
      let beat: unknown = null;
      const renew = () => {
        beat = scheduler.setTimeout(() => {
          void store.claim(item.key, me, Date.now() + CLAIM_MS);
          renew();
        }, CLAIM_MS / 3);
      };
      renew();
      try {
        const stored = await withFilesStored(item, host);
        const saving = item.kind === 'save' ? (stored as SaveRequest) : null;
        const known = saving && saving.id != null ? versions.get(`${saving.model}\u0000${saving.id}`) : undefined;
        const request = { ...stored, ...(known ? { version: known } : {}), key: stored.key ?? item.key, queued: { key: item.key, at: item.at } };
        if (item.kind === 'submit') {
          if (!source.submit) throw new Error('This page has no data source to send its answers to');
          await source.submit(request as SubmitRequest);
        } else {
          if (!source.save) throw new Error('This page has no data source to save to');
          const result = await source.save(request as SaveRequest);
          if (result.version) versions.set(`${(request as SaveRequest).model}\u0000${result.id}`, result.version);
          // The new record this form still shows went: it has its id now. The record it shows: its version now.
          if (item.record === record && form.getState().recordId == null) set({ recordId: result.id, version: result.version ?? null });
          else if (result.version && form.getState().recordId === result.id && (request as SaveRequest).id === result.id) set({ version: result.version });
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
      } finally {
        scheduler.clearTimeout(beat);
      }
      await refresh();
    }
  };
  const outbox: FormOutbox = {
    async keep(kind, request, own) {
      const items = await store.list(host.pageId);
      // A new record saved again while its first save waits: one save, of the record as it is now — by its key, the same.
      const same = own ? items.find((item) => item.record === own && item.kind === kind && !item.refused && !(item.claim && item.claim.until > Date.now())) : undefined;
      // Kept by the send's own key, the one its first try carried: a server that had that try keeps no second.
      const item: OutboxItem = same
        ? { ...same, request: structuredCopy({ ...request, key: same.key }) }
        : { key: request.key ?? newKey(Date.now()), pageId: host.pageId, kind, request: structuredCopy(request), at: new Date().toISOString(), ...(own ? { record: own } : {}), owner, tries: 0 };
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
      // Told as it starts; a store that cannot answer tells nothing, and leaves nothing unhandled.
      void refresh().catch(() => undefined);
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
      // A save of a record with sends of it kept: they go first, in order; still kept, this one waits behind them — a newer
      // save never lands before an older one, nor a new record twice. Gone, it goes after them: a new record's as a save of
      // the record they made, each at its version now.
      if (kind === 'save' && (await store.list(host.pageId)).some((item) => sameRecord(item, sent as SaveRequest))) {
        await outbox.send();
        const request = sent as SaveRequest;
        if ((await store.list(host.pageId)).some((item) => sameRecord(item, request))) {
          kept = true;
          await outbox.keep('save', request, request.id == null ? record : undefined);
          return null;
        }
        const now = form.getState();
        if (now.recordId != null) sent = { ...request, id: request.id ?? now.recordId, ...(now.version ? { version: now.version } : {}) };
      }
      try {
        const answer = await go(sent);
        // It went: there is signal, and what waited goes after it.
        if (kind !== 'upload') {
          keptNow(false);
          void outbox.send().catch(() => undefined);
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
  void refresh().catch(() => undefined);
  return outbox;
}
