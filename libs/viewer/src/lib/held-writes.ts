import type { DataSource } from '@fieldia/core';

/**
 * The members of a data source that write through a page — a record saved, a form's answers sent (an outbox's kept
 * sends too), a step's save, a file uploaded, a draft kept on the server, a decision, a payment, a code sent, records
 * copied, deleted or archived, cells and records changed in bulk, an import, a merge, a template.
 */
const WRITES: ReadonlySet<PropertyKey> = new Set(['save', 'submit', 'create', 'copy', 'delete', 'archive', 'upload', 'writeMany', 'createMany', 'importRecords', 'merge', 'markNotDuplicate', 'saveDraft', 'decide', 'pay', 'sendCode', 'saveDefinitions', 'saveTemplate', 'deleteTemplate']);

/**
 * The app's data source with every write held until the page's whole check has run (0.37, viewer.ts): `checked` gives
 * null once it has passed, or its part could not come — the write goes at once, as ever — else what it waits for: let go
 * as the check passes, refused with the page (its error the `PageRefused`) where it refuses it. Invisible on a page that
 * passes, whose check lands a frame or two after its draw. Reads — a record, a list's rows, options, a search — go at once,
 * each member read as it is called. A member the source has not is none here either (hide, never disable). The app's own
 * answer is handled as it is made, whatever its promise (deadline.ts, `answerOf`): never left unhandled while held.
 */
export function heldWrites(source: DataSource | undefined, checked: () => Promise<void> | null): DataSource | undefined {
  return (
    source &&
    new Proxy(source, {
      get(target, member) {
        const value = Reflect.get(target, member, target) as unknown;
        if (typeof value !== 'function') return value;
        if (!WRITES.has(member)) return value.bind(target);
        return (...args: unknown[]) => {
          const waiting = checked();
          if (!waiting) return value.apply(target, args);
          return waiting.then(
            () =>
              new Promise((resolve, reject) => {
                const answer = value.apply(target, args) as unknown;
                if (answer && typeof (answer as PromiseLike<unknown>).then === 'function') (answer as PromiseLike<unknown>).then(resolve, reject);
                else resolve(answer);
              })
          );
        };
      },
    })
  );
}
