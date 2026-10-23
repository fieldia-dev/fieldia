import { createMemoryDataSource, type ApprovalEntry, type Approvals, type JsonValue, type MemoryDataSource, type MemoryDataSourceOptions, type PropertyDefinition, type RecordId, type SubmitRequest, type Values } from '@fieldia/core';
import type { ChatterSource, MemoryChatterOptions, RecordRef } from '@fieldia/chatter';
import type { PreferenceStore } from '@fieldia/widgets';

/**
 * What a demo saved, kept while its tab is open, as an app's server keeps it — in every store a demo saves to, every
 * demo alike: its records, the records said to be someone else for one another, approvals decided, record templates, a
 * list's saved views, properties added in place, responses sent, each record's conversation, and a demo's own
 * preferences (its favourite searches). A page the demo goes
 * to — a list's record, View all's list, a link in its how-to, Back — and Reload show what was saved there, never the
 * samples again; the frame says "What you saved stays while this tab is open" once something is (demos/shell.mjs), and
 * its Start over takes it all away. Each store is kept in the tab's sessionStorage under `KEPT` once something of it is
 * written. Where the browser keeps nothing (storage blocked, or full), a demo starts from its samples, as before.
 *
 * A demo with a source of its own keeps it apart (`scope`): its models' names are its own, never the samples'.
 */
export const KEPT = 'fieldia-demo-records:';
/** Told on the window each time something is kept: the frame shows its Start over. */
export const KEPT_EVENT = 'fieldia-demo-kept';

type Tables = Record<string, Record<string, Values>>;
type Definitions = NonNullable<MemoryDataSourceOptions['definitions']>;
type ChatterRecords = NonNullable<MemoryChatterOptions['records']>;
/** A model as kept: its records, and the ids taken away (deleted, merged), which a page's own extra samples stay out of. */
interface Kept {
  records: Record<string, Values>;
  gone: string[];
}

/** The keys of a source's stores besides its models' (a model's name never starts with "#" nor holds a "/"). */
const STORE = {
  apart: '#not-duplicates',
  approvals: '#approvals',
  templates: '#templates',
  views: '#views',
  definitions: '#definitions',
  responses: '#responses',
  chatter: '#chatter',
  preferences: '#preferences',
} as const;

function store(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** A store's JSON as this tab kept it, or null. */
function readKept<T>(key: string): T | null {
  try {
    const kept = JSON.parse(store()?.getItem(key) ?? 'null') as T | null;
    return kept && typeof kept === 'object' ? kept : null;
  } catch {
    return null;
  }
}

/** A store kept in this tab, and the frame told; a full store goes back to its samples next time, never to an older state. */
function writeKept(key: string, value: unknown): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    storage.removeItem(key);
  }
  dispatchEvent(new CustomEvent(KEPT_EVENT));
}

function read(storage: Storage, key: string): Kept | null {
  try {
    const kept = JSON.parse(storage.getItem(key) ?? 'null') as Kept | null;
    return kept && typeof kept.records === 'object' && Array.isArray(kept.gone) ? kept : null;
  } catch {
    return null;
  }
}

/**
 * The records a demo starts from: the samples, a page's own extra ones added (the customer typed twice's second Nile
 * Traders), and each model kept in this tab in their place — an extra sample added back unless it was taken away.
 */
export function keptOver(samples: Tables, extra: Tables = {}, scope = ''): Tables {
  const records: Tables = { ...samples };
  for (const [model, rows] of Object.entries(extra)) records[model] = { ...records[model], ...rows };
  const storage = store();
  if (!storage) return records;
  for (let at = 0; at < storage.length; at++) {
    const key = storage.key(at);
    if (!key?.startsWith(KEPT + scope)) continue;
    const model = key.slice(KEPT.length + scope.length);
    // Another store of this source's, or another source's model.
    if (model.startsWith('#') || model.includes('/')) continue;
    const kept = read(storage, key);
    if (!kept) continue;
    const back = Object.entries(extra[model] ?? {}).filter(([id]) => !(id in kept.records) && !kept.gone.includes(id));
    records[model] = { ...kept.records, ...Object.fromEntries(back) };
  }
  return records;
}

/** What a source keeps by page — record templates, a list's saved views —: the samples', each page this tab kept in their place. */
function keptByPage<T>(key: string, samples: Record<string, T[]> | undefined): Record<string, T[]> | undefined {
  // A source given none has none: a page whose source keeps no templates offers none, whatever another page kept.
  if (!samples) return samples;
  return { ...samples, ...readKept<Record<string, T[]>>(key) };
}

/**
 * The properties added in place this tab kept, each by its list and the definitions the app gives the record (as a
 * memory source keys them): the app's own, then those added.
 */
function keptDefinitions(given: Definitions | undefined, added: Record<string, PropertyDefinition[]>): Definitions | undefined {
  if (!given) return given;
  return Object.fromEntries(
    Object.entries(given).map(([list, own]) => [
      list,
      (values: Values) => {
        const mine = own(values);
        const more = added[`${list}:${JSON.stringify(mine)}`] ?? [];
        return [...mine, ...more.filter((one) => !mine.some((o) => o.name === one.name))];
      },
    ])
  );
}

/**
 * A demo's memory source, made over what this tab kept of it and keeping each write it takes: the one rule every demo's
 * source follows. `extra`: a page's own samples beside the source's (see `keptOver`); `scope`: a demo's own source's,
 * kept apart from the samples' (`"backlog/"`).
 */
export function keptSource(options: MemoryDataSourceOptions = {}, how: { extra?: Tables; scope?: string } = {}): MemoryDataSource {
  const scope = how.scope ?? '';
  const at = (name: string) => KEPT + scope + name;
  const added = readKept<Record<string, PropertyDefinition[]>>(at(STORE.definitions)) ?? {};
  const views = keptByPage(at(STORE.views), options.views);
  const templates = keptByPage(at(STORE.templates), options.templates);
  const definitions = keptDefinitions(options.definitions, added);
  const apart = readKept<Record<string, [RecordId, RecordId][]>>(at(STORE.apart));
  const approvals = readKept<Record<string, ApprovalEntry[]>>(at(STORE.approvals));
  const source = createMemoryDataSource({
    ...options,
    records: keptOver(options.records ?? {}, how.extra, scope),
    ...(views ? { views } : {}),
    ...(templates ? { templates } : {}),
    ...(definitions ? { definitions } : {}),
    ...(apart || options.notDuplicatePairs ? { notDuplicatePairs: { ...options.notDuplicatePairs, ...apart } } : {}),
    ...(approvals || options.approvalHistory ? { approvalHistory: { ...options.approvalHistory, ...approvals } } : {}),
  });
  // The responses sent from this tab: counted again, as the server counts them (a form's limits, a booking's number).
  (source.responses as SubmitRequest[]).push(...(readKept<SubmitRequest[]>(at(STORE.responses)) ?? []));
  keepWrites(source, { scope, definitions: options.definitions, added, histories: options.approvalHistory });
  return source;
}

type Request = { model: string; id?: RecordId | null; mergeIds?: RecordId[]; pageId?: string; list?: string; values?: Values; definitions?: PropertyDefinition[] };
type Member = (request: Request, ...rest: unknown[]) => Promise<unknown>;

/** The source's writes kept in this tab, each store as it is written; the frame told each time. */
function keepWrites(source: MemoryDataSource, how: { scope: string; definitions?: Definitions; added: Record<string, PropertyDefinition[]>; histories?: Record<string, ApprovalEntry[]> }): void {
  const storage = store();
  if (!storage) return;
  const at = (name: string) => KEPT + how.scope + name;
  /** A model kept as it is now, with the ids just taken away from it. */
  const keep = (model: string, gone: RecordId[] = []) => {
    const before = read(storage, at(model))?.gone ?? [];
    writeKept(at(model), { records: source.records[model] ?? {}, gone: [...new Set([...before, ...gone.map(String)])] } satisfies Kept);
  };
  const own = source as unknown as Record<string, Member | undefined>;
  /** Each of a source's `members` kept after it answers, as `after` says. */
  const after = (members: string[], then: (request: Request, method: string, answer: unknown) => unknown) => {
    for (const method of members) {
      const write = own[method]?.bind(source);
      if (!write) continue;
      own[method] = async (request: Request, ...rest: unknown[]) => {
        const answer = await write(request, ...rest);
        await then(request, method, answer);
        return answer;
      };
    }
  };
  // A decision moves its record on (its state), as a save does.
  after(['save', 'create', 'archive', 'copy', 'writeMany', 'createMany', 'delete', 'decide'], (request, method) => keep(request.model, method === 'delete' && request.id != null ? [request.id] : []));
  // A change someone else saved meanwhile (a colleague at the front desk, another tab) is the server's as much.
  const elsewhere = source.changeElsewhere.bind(source);
  source.changeElsewhere = (model, id, values, how) => {
    const version = elsewhere(model, id, values, how);
    keep(model);
    return version;
  };
  // A merge moves every link to the records it takes away: each model it changed is kept.
  const merge = own['merge']?.bind(source);
  if (merge) {
    own['merge'] = async (request: Request, ...rest: unknown[]) => {
      const before = Object.fromEntries(Object.entries(source.records).map(([model, rows]) => [model, JSON.stringify(rows)]));
      const answer = await merge(request, ...rest);
      keep(request.model, request.mergeIds ?? []);
      for (const model of Object.keys(source.records)) if (model !== request.model && JSON.stringify(source.records[model]) !== before[model]) keep(model);
      return answer;
    };
  }
  // "It's someone new", kept as the server keeps it: another page of this tab lets that record be too.
  after(['markNotDuplicate'], () => writeKept(at(STORE.apart), source.notDuplicatePairs));
  // Each record's approval history as the source answers it — a decision, a record sent for approval — kept as the
  // engine keeps it: the next person signed in sees it. A history only read, as it was, is nothing saved.
  const histories = readKept<Record<string, ApprovalEntry[]>>(at(STORE.approvals)) ?? {};
  after(['approvals', 'decide'], (request, _method, answer) => {
    const history = (answer as Approvals | undefined)?.history;
    const asked = request as unknown as { model: string; recordId: RecordId };
    const key = `${asked.model}:${asked.recordId}`;
    if (!history || JSON.stringify(history) === JSON.stringify(histories[key] ?? how.histories?.[key] ?? [])) return;
    histories[key] = history;
    writeKept(at(STORE.approvals), histories);
  });
  // A page's record templates and a list's saved views, each page's as the source answers them now.
  for (const [read, writes, key] of [
    ['templates', ['saveTemplate', 'deleteTemplate'], STORE.templates],
    ['views', ['saveView', 'deleteView'], STORE.views],
  ] as const) {
    const now = own[read]?.bind(source);
    if (!now) continue;
    after([...writes], async (request) => {
      const kept = readKept<Record<string, unknown>>(at(key)) ?? {};
      writeKept(at(key), { ...kept, [String(request.pageId)]: await now(request) });
    });
  }
  // A property added in place, by its list and the definitions the app gives the record.
  after(['saveDefinitions'], (request) => {
    const given = how.definitions?.[String(request.list)]?.(request.values ?? {}) ?? [];
    how.added[`${request.list}:${JSON.stringify(given)}`] = (request.definitions ?? []).filter((one) => !given.some((o) => o.name === one.name));
    writeKept(at(STORE.definitions), how.added);
  });
  // A response sent: counted again on the next page, as the server counts it.
  after(['submit'], () => writeKept(at(STORE.responses), source.responses));
}

/** Each record's conversation this tab kept — its messages, to-dos and followers — over the samples'. */
export function keptChatter(samples: ChatterRecords = {}, scope = ''): ChatterRecords {
  const kept = readKept<ChatterRecords>(KEPT + scope + STORE.chatter);
  if (!kept) return samples;
  const records: ChatterRecords = { ...samples };
  for (const [key, one] of Object.entries(kept)) records[key] = { ...samples[key], ...one };
  return records;
}

/**
 * Each change to a record's conversation kept in this tab — a message posted or received, a reaction, a to-do planned
 * or done, a follower — as the chatter answers it now: the next page shows it. Ids go on after those kept (the memory
 * chatter numbers its own after the ones it is given).
 */
export function keepChatter<T extends ChatterSource>(chatter: T, scope = ''): T {
  if (!store()) return chatter;
  const key = KEPT + scope + STORE.chatter;
  const snapshot = async (record: RecordRef) => {
    const [messages, activities, followers] = await Promise.all([chatter.messages(record), chatter.activities?.(record) ?? [], chatter.followers?.(record) ?? []]);
    writeKept(key, { ...readKept<ChatterRecords>(key), [`${record.model}:${record.id}`]: { messages, activities, followers } });
  };
  const own = chatter as unknown as Record<string, ((record: RecordRef, ...rest: unknown[]) => unknown) | undefined>;
  for (const method of ['post', 'resend', 'react', 'schedule', 'markDone', 'cancel', 'follow', 'unfollow', 'receive', 'deliver']) {
    const write = own[method]?.bind(chatter);
    if (!write) continue;
    own[method] = (record: RecordRef, ...rest: unknown[]) => {
      const answer = write(record, ...rest);
      // `receive` and `deliver` answer at once, the others when the chatter has done it.
      void Promise.resolve(answer).then(() => snapshot(record), () => undefined);
      return answer;
    };
  }
  // What the chatter pushes as it happens — a delivery its gateway tells — kept as it arrives.
  const subscribe = chatter.subscribe?.bind(chatter);
  if (subscribe) chatter.subscribe = (record, push) => subscribe(record, (change) => (push(change), void snapshot(record)));
  return chatter;
}

/**
 * A demo's own preferences — a list's favourite searches, the latest picks — as `seed` gives them, and what the person
 * changed of them kept in this tab, as the other demos' are kept in the browser (the viewer's own preferences).
 */
export function keptPreferences(seed: Record<string, JsonValue>, scope = ''): PreferenceStore {
  const key = KEPT + scope + STORE.preferences;
  const kept: Record<string, JsonValue> = { ...seed, ...readKept<Record<string, JsonValue>>(key) };
  return {
    get: (name) => (name in kept ? (JSON.parse(JSON.stringify(kept[name])) as JsonValue) : null),
    set(name, value) {
      if (JSON.stringify(kept[name] ?? null) === JSON.stringify(value)) return;
      kept[name] = JSON.parse(JSON.stringify(value)) as JsonValue;
      writeKept(key, Object.fromEntries(Object.entries(kept).filter(([one]) => JSON.stringify(kept[one]) !== JSON.stringify(seed[one]))));
    },
  };
}
