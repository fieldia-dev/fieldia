import { indexedOutbox } from './outbox-form';

/**
 * The outbox kept in IndexedDB opens one connection a database, shared by every form that keeps sends in it — a page
 * that mounts forms one after another opened one each and closed none (the performance audit's M7: 30 mounts, 30
 * connections) — and lets it go when another tab opens a newer version.
 */

/** A browser's IndexedDB as far as the outbox uses it, counting the connections it opens and closes. */
function fakeIndexedDb() {
  const items = new Map<string, unknown>();
  const counts = { opened: 0, closed: 0 };
  const databases: { onversionchange: (() => void) | null; close(): void }[] = [];
  const answer = <T>(result: T) => {
    const request = { result, error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    setTimeout(() => request.onsuccess?.());
    return request;
  };
  const store = {
    get: (key: string) => answer(items.get(key)),
    getAll: () => answer([...items.values()]),
    put: (value: { key: string }) => (items.set(value.key, value), answer(undefined)),
    delete: (key: string) => (items.delete(key), answer(undefined)),
  };
  const factory = {
    open() {
      counts.opened++;
      let open = true;
      const database = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => undefined,
        onversionchange: null as (() => void) | null,
        onclose: null as (() => void) | null,
        close() {
          if (open) counts.closed++;
          open = false;
        },
        transaction() {
          const transaction = { objectStore: () => store, oncomplete: null as (() => void) | null, onerror: null, onabort: null, error: null };
          setTimeout(() => setTimeout(() => transaction.oncomplete?.()));
          return transaction;
        },
      };
      databases.push(database);
      return Object.assign(answer(database), { onupgradeneeded: null });
    },
  };
  return { factory, counts, databases };
}

describe('the IndexedDB outbox’s connection', () => {
  const real = (globalThis as { indexedDB?: unknown }).indexedDB;
  afterEach(() => ((globalThis as { indexedDB?: unknown }).indexedDB = real));

  it('is one for every form that keeps its sends in the same database', async () => {
    const fake = fakeIndexedDb();
    (globalThis as { indexedDB?: unknown }).indexedDB = fake.factory;
    for (let mount = 0; mount < 20; mount++) {
      const outbox = indexedOutbox();
      await outbox?.list('page');
      await outbox?.put({ key: `k${mount}`, pageId: 'page', kind: 'submit', request: { pageId: 'page', values: {} }, at: new Date(2026, 9, 24, 0, mount).toISOString(), tries: 0 } as never);
    }
    expect(fake.counts.opened).toBe(1);
    expect((await indexedOutbox()?.list('page'))?.length).toBe(20);
    // Another database is a connection of its own.
    await indexedOutbox('another')?.list('page');
    expect(fake.counts.opened).toBe(2);
  });

  it('lets the connection go when another tab opens a newer version, and opens it again when next asked', async () => {
    const fake = fakeIndexedDb();
    (globalThis as { indexedDB?: unknown }).indexedDB = fake.factory;
    const outbox = indexedOutbox();
    await outbox?.list('page');
    fake.databases[0].onversionchange?.();
    expect(fake.counts.closed).toBe(1);
    await outbox?.list('page');
    expect(fake.counts.opened).toBe(2);
  });
});
