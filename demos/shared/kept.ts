import type { MemoryDataSource, RecordId, Values } from '@fieldia/core';

/**
 * A demo's records kept while its tab is open, as an app's server keeps them: a page the demo goes to — a list's
 * record, View all's list, a quotation's own page, Back — and Reload show what was saved there, never the samples
 * again. Each model is kept in the tab's sessionStorage once something of it is written, under `KEPT` and its name;
 * the demo frame's Start over (demos/shell.mjs) takes them all away. Where the browser keeps nothing (storage blocked,
 * or full), a demo starts from its samples, as before.
 */
export const KEPT = 'fieldia-demo-records:';
/** Told on the window each time something is kept: the frame shows its Start over. */
export const KEPT_EVENT = 'fieldia-demo-kept';

type Tables = Record<string, Record<string, Values>>;
/** A model as kept: its records, and the ids taken away (deleted, merged), which a page's own extra samples stay out of. */
interface Kept {
  records: Record<string, Values>;
  gone: string[];
}

function store(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function read(storage: Storage, model: string): Kept | null {
  try {
    const kept = JSON.parse(storage.getItem(KEPT + model) ?? 'null') as Kept | null;
    return kept && typeof kept.records === 'object' && Array.isArray(kept.gone) ? kept : null;
  } catch {
    return null;
  }
}

/**
 * The records a demo starts from: the samples, a page's own extra ones added (the customer typed twice's second Nile
 * Traders), and each model kept in this tab in their place — an extra sample added back unless it was taken away.
 */
export function keptOver(samples: Tables, extra: Tables = {}): Tables {
  const records: Tables = { ...samples };
  for (const [model, rows] of Object.entries(extra)) records[model] = { ...records[model], ...rows };
  const storage = store();
  if (!storage) return records;
  for (let at = 0; at < storage.length; at++) {
    const key = storage.key(at);
    if (!key?.startsWith(KEPT)) continue;
    const model = key.slice(KEPT.length);
    const kept = read(storage, model);
    if (!kept) continue;
    const back = Object.entries(extra[model] ?? {}).filter(([id]) => !(id in kept.records) && !kept.gone.includes(id));
    records[model] = { ...kept.records, ...Object.fromEntries(back) };
  }
  return records;
}

type Request = { model: string; id?: RecordId | null; mergeIds?: RecordId[] };

/** The source's writes kept in this tab, each model as it is written; the frame told each time. */
export function keepWrites(source: MemoryDataSource): void {
  const storage = store();
  if (!storage) return;
  /** A model kept as it is now, with the ids just taken away from it. */
  const keep = (model: string, gone: RecordId[] = []) => {
    const before = read(storage, model)?.gone ?? [];
    const kept: Kept = { records: source.records[model] ?? {}, gone: [...new Set([...before, ...gone.map(String)])] };
    try {
      storage.setItem(KEPT + model, JSON.stringify(kept));
    } catch {
      // Storage full: the model goes back to its samples next time, never to a state older than this one.
      storage.removeItem(KEPT + model);
    }
  };
  const told = () => dispatchEvent(new CustomEvent(KEPT_EVENT));
  const own = source as unknown as Record<string, ((request: Request, ...rest: unknown[]) => Promise<unknown>) | undefined>;
  for (const method of ['save', 'create', 'archive', 'copy', 'writeMany', 'createMany', 'delete']) {
    const write = own[method]?.bind(source);
    if (!write) continue;
    own[method] = async (request: Request, ...rest: unknown[]) => {
      const answer = await write(request, ...rest);
      keep(request.model, method === 'delete' && request.id != null ? [request.id] : []);
      told();
      return answer;
    };
  }
  // A merge moves every link to the records it takes away: each model it changed is kept.
  const merge = own['merge']?.bind(source);
  if (merge) {
    own['merge'] = async (request: Request, ...rest: unknown[]) => {
      const before = Object.fromEntries(Object.entries(source.records).map(([model, rows]) => [model, JSON.stringify(rows)]));
      const answer = await merge(request, ...rest);
      keep(request.model, request.mergeIds ?? []);
      for (const model of Object.keys(source.records)) if (model !== request.model && JSON.stringify(source.records[model]) !== before[model]) keep(model);
      told();
      return answer;
    };
  }
}
