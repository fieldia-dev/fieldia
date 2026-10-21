import { lazyPart, type Part } from '../parts';
import type * as MemoryModule from './memory-part';
import type { MemoryDataSource, MemoryDataSourceOptions } from './memory-data-source';
import { memoryKept } from './memory-kept';

/** The memory part: a memory source's members (memory-data-source.ts). */
export type MemoryPart = typeof MemoryModule;

/**
 * A memory source's members, loaded the first time a page makes one (`createMemoryDataSource`): the one-tag script's
 * (tools/script-entry.ts), where an app that gives its own data source never downloads them.
 */
export const memoryPart: Part<MemoryPart> = lazyPart('memory', () => import('./memory-part'));

/** Every member of a data source a memory source answers, as its members do once they have come. */
export const MEMORY_MEMBERS = [
  'load', 'save', 'onchange', 'search', 'create', 'submit', 'list', 'groups', 'options', 'definitions', 'saveDefinitions', 'archive', 'copy', 'delete',
  'attachments', 'totals', 'upload', 'slots', 'writeMany', 'createMany', 'duplicates', 'merge', 'notDuplicates', 'markNotDuplicate', 'limits', 'saveDraft', 'loadDraft',
] as const;

/**
 * The one-tag script's memory source: what it keeps — its records, responses, calls, drafts, its versions, and what
 * someone else does to them (`changeElsewhere`, `answeredElsewhere`) — at once, every member answering once the memory
 * part has come (each call waits for it, the first asking for it; one that could not come asks again next time). Once
 * it is in, a source is made whole at once, as the packages' is.
 */
export function createMemoryDataSource(options: MemoryDataSourceOptions = {}): MemoryDataSource {
  const part = memoryPart.loaded;
  if (part) return part.createMemoryDataSource(options);
  const kept = memoryKept(options);
  let made: MemoryDataSource | undefined;
  const members = (): Promise<MemoryDataSource> => memoryPart.load().then((loaded) => (made ??= loaded.memorySource(options, kept)));
  const source = { records: kept.records, notDuplicatePairs: kept.notDuplicatePairs, responses: kept.responses, calls: kept.calls, drafts: kept.drafts, changeElsewhere: kept.changeElsewhere, answeredElsewhere: kept.answeredElsewhere } as Record<string, unknown>;
  // Record templates where it was given some (`templates`); live (`live`): a push answered once the members came, as
  // a form asks for it once it has read the record through them.
  for (const name of [...MEMORY_MEMBERS, ...(options.templates ? ['templates', 'saveTemplate', 'deleteTemplate'] : []), ...(options.live ? ['subscribe', 'presence', 'arrive', 'leave'] : [])]) {
    source[name] = (...args: unknown[]) => {
      const call = (from: MemoryDataSource) => (from[name as keyof MemoryDataSource] as (...given: unknown[]) => unknown)(...args);
      return made ? call(made) : members().then(call);
    };
  }
  return source as unknown as MemoryDataSource;
}
