import type { MemoryDataSource, MemoryDataSourceOptions } from './memory-data-source';
import type { RecordVersion, SubmitRequest } from './data-source';
import { structuredCopy, type RecordId, type Values } from './values';

/**
 * What a memory source keeps (`createMemoryDataSource`): its records, the responses it took, every call, its drafts,
 * the pairs said to be someone else — and the records' versions, with the two things done to them as someone else
 * would do them, at once (`changeElsewhere`, `answeredElsewhere`). Apart from its members, which work on it, so the
 * one-tag script can hand an app its source at once and its members as they come (memory-later.ts).
 */
export interface MemoryKept extends Pick<MemoryDataSource, 'records' | 'notDuplicatePairs' | 'responses' | 'calls' | 'drafts' | 'codes' | 'changeElsewhere' | 'answeredElsewhere'> {
  /** Responses others sent meanwhile (`answeredElsewhere`): counted, never as this person's. */
  readonly elsewhere: SubmitRequest[];
  /** A model's records, by id: made empty the first time it is asked for. */
  table(model: string): Record<string, Values>;
  /** A record's version, given when first asked; none where the source keeps none. */
  versionOf(model: string, id: RecordId): RecordVersion | undefined;
  /** A record's version moved on, by someone, at a time. */
  moveOn(model: string, id: RecordId, by: string | undefined, at?: string): RecordVersion;
}

export function memoryKept(options: Pick<MemoryDataSourceOptions, 'records' | 'notDuplicatePairs' | 'drafts' | 'versions'>): MemoryKept {
  const records = structuredCopy(options.records ?? {});
  const elsewhere: SubmitRequest[] = [];
  /** Each record's version, by `model:id`, given when first asked. */
  const versions = new Map<string, RecordVersion>();
  let stamps = 0;
  const table = (model: string) => (records[model] ??= {});
  const moveOn = (model: string, id: RecordId, by: string | undefined, at = new Date().toISOString()): RecordVersion => {
    const version: RecordVersion = { token: String(++stamps), ...(by ? { by } : {}), at };
    versions.set(`${model}:${id}`, version);
    return version;
  };
  return {
    records,
    notDuplicatePairs: structuredCopy(options.notDuplicatePairs ?? {}),
    responses: [],
    calls: [],
    drafts: structuredCopy(options.drafts ?? {}),
    codes: [],
    elsewhere,
    table,
    versionOf(model, id) {
      if (!options.versions) return undefined;
      const key = `${model}:${id}`;
      if (!versions.has(key)) versions.set(key, { token: String(++stamps) });
      return versions.get(key);
    },
    moveOn,
    answeredElsewhere(pageId: string, values: Values) {
      elsewhere.push({ pageId, values: structuredCopy(values) });
    },
    changeElsewhere(model: string, id: RecordId, values: Values, who: { by: string; at?: string }): RecordVersion {
      const stored = table(model)[String(id)];
      if (!stored) throw new Error(`No ${model} record with id ${id}`);
      Object.assign(stored, structuredCopy(values));
      return moveOn(model, id, who.by, who.at);
    },
  };
}
