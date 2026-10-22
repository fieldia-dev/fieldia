import type { PresenceRequest, PresentPerson, RecordChange, RecordRequest } from './data-source';
import type { MemoryDataSourceOptions } from './memory-data-source';
import type { MemoryKept } from './memory-kept';
import { structuredCopy, type RecordId } from './values';

/**
 * A memory source live, as a server with a socket (`live`): each change `changeElsewhere` makes pushed to the pages
 * that have its record open (`subscribe`), and who has a record open told to each of them (`presence`) — every page
 * that opens it with a `user`, and whoever `arrive` brings until `leave`. Off unless said: then it has none of them.
 */
export function memoryLive(options: Pick<MemoryDataSourceOptions, 'live' | 'versions'>, kept: MemoryKept) {
  const changes = new Map<string, Set<(change: RecordChange) => void>>();
  const watchers = new Map<string, Set<{ push: (people: PresentPerson[]) => void; me: RecordId | null }>>();
  const present = new Map<string, Map<string, PresentPerson>>();
  const at = (model: string, id: RecordId) => `${model}:${id}`;
  const held = <T>(map: Map<string, T>, key: string, make: () => T): T => {
    let found = map.get(key);
    if (!found) map.set(key, (found = make()));
    return found;
  };
  /** Everyone watching a record told who else has it open: never themselves. */
  const tell = (key: string) => {
    const people = [...(present.get(key)?.values() ?? [])];
    for (const one of watchers.get(key) ?? []) one.push(people.filter((person) => one.me === null || String(person.id) !== String(one.me)).map((person) => ({ ...person })));
  };
  kept.changed = (model, id, version, by) => {
    if (!options.live) return;
    const stored = kept.table(model)[String(id)];
    for (const push of changes.get(at(model, id)) ?? []) push({ type: 'record', ...(options.versions ? { version } : {}), values: structuredCopy(stored), by, ...(version.at ? { at: version.at } : {}) });
  };
  // Live only where it says: without `live`, a memory source tells neither, as an app's source without a socket.
  const told = {
    subscribe(record: RecordRequest, push: (change: RecordChange) => void) {
      const listening = held(changes, at(record.model, record.id), () => new Set<(change: RecordChange) => void>());
      listening.add(push);
      return () => void listening.delete(push);
    },
    presence(request: PresenceRequest, push: (people: PresentPerson[]) => void) {
      const key = at(request.model, request.id);
      const one = { push, me: request.user?.id ?? null };
      held(watchers, key, () => new Set<typeof one>()).add(one);
      if (request.user?.id != null) held(present, key, () => new Map<string, PresentPerson>()).set(String(request.user.id), { id: request.user.id, name: request.user.name ?? String(request.user.id), editing: request.editing });
      tell(key);
      return () => {
        watchers.get(key)?.delete(one);
        if (one.me !== null) present.get(key)?.delete(String(one.me));
        tell(key);
      };
    },
  };
  return options.live
    ? {
        ...told,
        arrive(model: string, id: RecordId, person: PresentPerson) {
          held(present, at(model, id), () => new Map<string, PresentPerson>()).set(String(person.id), { ...person });
          tell(at(model, id));
        },
        leave(model: string, id: RecordId, person: RecordId) {
          present.get(at(model, id))?.delete(String(person));
          tell(at(model, id));
        },
      }
    : {};
}
