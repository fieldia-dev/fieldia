import { loadedRecordOf, type DataSource, type RecordChange, type RecordVersion } from './data-source';
import type { FormInner } from './joins';
import type { LiveRecord } from './live-later';
import { fill, fillMessage } from './messages';
import { unsavedWork } from './form';
import { structuredCopy, type RecordId, type Value, type Values } from './values';

/**
 * The record a form shows, made live (the data source's `subscribe` and `presence`): its changes made elsewhere asked
 * for once it has an id, and who else has it open asked again as this person starts or stops changing it (`editing`).
 * A change arriving waits for a save of the form's on its way (its answer may be that very change), and one carrying the
 * form's own version is let go; without its values, the record is read again. Where the person changed nothing, it is
 * laid on the record as stored, told (`arrived`) and said; after a change of theirs, it waits as the conflict a save would
 * meet, their typing untouched. Nothing arriving for a record no longer shown is laid on the one shown.
 */
/**
 * What stops a push: the source's own, or the one it gives once it is ready (the one-tag script's memory source asked
 * before its members came).
 */
const stopOf = (given: unknown): (() => void) => (typeof given === 'function' ? (given as () => void) : () => void Promise.resolve(given).then((stop) => typeof stop === 'function' && stop()));

/**
 * The live part's side of a form (joins.ts): the record shown watched once it is loaded (`loaded`: at once where it was
 * loaded before the part came), again as the form's state changes (`changed`), and let go with the form (`dispose`).
 */
export function join(context: FormInner): LiveRecord {
  const live = liveRecord(context);
  return { ...live, loaded: live.watch, changed: live.watch, dispose: live.stop };
}

export function liveRecord(context: FormInner): LiveRecord {
  const { page, fields } = context;
  // A page of responses has no record to watch.
  if (page.data.kind !== 'record') return { watch: () => undefined, stop: () => undefined };
  const source = context.options.dataSource as DataSource;
  const model = (page.data as { model: string }).model;
  let watchedId: RecordId | null = null;
  let watchedAt = -1;
  let editing = false;
  let stopChanges: (() => void) | null = null;
  let stopPresence: (() => void) | null = null;

  async function arrived(change: RecordChange, shown: () => boolean) {
    const state = context.state();
    const id = state.recordId as RecordId;
    const { messages } = context;
    const say = (words: string, tone: 'info' | 'warning') => context.options.host?.say(words, tone);
    if (change.type === 'deleted') return say(change.by ? fillMessage(messages, messages.deletedBy, { name: change.by }) : messages.deletedElsewhere, 'warning');
    if (change.type !== 'record') return;
    await context.settled();
    const ours = (version: RecordVersion | undefined) => !!version && !!context.state().version && version.token === context.state().version?.token;
    if (!shown() || ours(change.version)) return;
    let theirs = change.values;
    let version = change.version;
    if (!theirs && source.load) {
      const now = loadedRecordOf(await context.track(source.load({ model, id, fields })));
      if (!shown()) return;
      theirs = now.values;
      version = now.version ?? version;
    }
    if (!theirs || ours(version)) return;
    const told: Values = {};
    for (const [name, value] of Object.entries(theirs)) if (fields[name]) told[name] = structuredCopy(value) as Value;
    const baseline = context.baseline();
    const changed = Object.keys(fields).filter((name) => name in told && !context.same(name, baseline[name], told[name]));
    const by = version?.by ?? change.by;
    const at = version?.at ?? change.at;
    const when = { ...(by ? { by } : {}), ...(at ? { at } : {}) };
    // The person's work would be lost by laying their values over the record: it waits, as a save would meet it.
    if (unsavedWork(context.state())) {
      context.set({ conflict: context.conflictOf({ version: version ?? { token: '', ...when }, theirs: told }) });
      context.emit('arrived', { recordId: id, ...when, fields: changed, conflict: true });
      return;
    }
    if (changed.length) context.store(Object.fromEntries(changed.map((name) => [name, told[name]])));
    if (version) context.set({ version });
    if (!changed.length) return;
    context.emit('arrived', { recordId: id, ...when, fields: changed, conflict: false });
    // Who changed what, said: "Mona Adel changed Price."
    const labels = changed.map((name) => page.fields[name]?.label ?? name).join(', ');
    say(by ? fill(messages.changedBy, { name: by, fields: labels }) : fill(messages.changedElsewhere, { fields: labels }), 'info');
  }

  return {
    watch() {
      const state = context.state();
      if (state.status === 'loading') return;
      const id = state.recordId;
      const again = id !== watchedId || context.generation() !== watchedAt;
      const editingNow = state.dirty.length > 0;
      if (!again && editingNow === editing) return;
      watchedId = id;
      watchedAt = context.generation();
      if (again) {
        stopChanges?.();
        stopChanges = null;
        if (state.present?.length) context.set({ present: [] });
      }
      stopPresence?.();
      stopPresence = null;
      editing = editingNow;
      if (id == null) return;
      const shown = context.shownNow();
      if (again && source.subscribe) stopChanges = stopOf(source.subscribe({ model, id, fields }, (change) => void (shown() && arrived(change, shown))));
      if (source.presence) {
        const me = context.options.user;
        stopPresence = stopOf(
          source.presence({ model, id, ...(me ? { user: { id: me.id, ...(me.name ? { name: me.name } : {}) } } : {}), editing }, (people) => {
            if (shown()) context.set({ present: people.filter((one) => !me || String(one.id) !== String(me.id)) });
          })
        );
      }
    },
    stop() {
      stopChanges?.();
      stopPresence?.();
      stopChanges = stopPresence = null;
    },
  };
}
