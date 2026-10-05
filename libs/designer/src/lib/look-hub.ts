import type { LookStore, SavedLook } from './designer';
import { wellMadeLooks } from './look-store';

/**
 * The looks of one store as every editor on the page sees them: listed once,
 * and each change told to every Look tab and sheet showing them, so a look
 * saved in the screen editor is offered at once in the survey editor beside
 * it. Shown by name, so a look brought back with Undo is where it was.
 */

export interface LookView {
  /** What shows them: one off the page is told nothing more. */
  element: HTMLElement;
  draw(): void;
}

export interface LooksHub {
  /** The looks kept, by name; null until the store has listed them. */
  readonly looks: readonly SavedLook[] | null;
  /** Why the store could not list them, in its words ('' when it gave none); null when it could. */
  readonly problem: string | null;
  /** Be told of each change while on the page. */
  listen(view: LookView): void;
  /** List them, once. */
  ensure(): void;
  /** List them again, as after a failure. */
  reload(): void;
  /** Keep a look, new or renamed. Rejects as the store does, the looks unchanged. */
  save(look: SavedLook): Promise<void>;
  /** Let a look go. Rejects as the store does, the looks unchanged. */
  remove(id: string): Promise<void>;
}

/** The words of a store's error — its message, or the words it was — or '' when it gave none. */
export const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : typeof error === 'string' ? error : '').trim();

const byName = (looks: readonly SavedLook[]) => [...looks].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

const hubs = new WeakMap<LookStore, LooksHub>();

export function looksHub(store: LookStore): LooksHub {
  const found = hubs.get(store);
  if (found) return found;
  let looks: SavedLook[] | null = null;
  let problem: string | null = null;
  let listing: Promise<void> | null = null;
  /** What was changed while the store was listing: done again on what it answers, which may be from before. */
  let since: ((looks: SavedLook[]) => SavedLook[])[] | null = null;
  const views = new Set<LookView>();
  const tell = () => {
    for (const view of [...views]) {
      if (view.element.isConnected) view.draw();
      else views.delete(view);
    }
  };
  /** A change to the looks: made now, and again on a listing that answers later. */
  const change = (edit: (looks: SavedLook[]) => SavedLook[]) => {
    looks = byName(edit(looks ?? []));
    since?.push(edit);
    tell();
  };
  const list = () => {
    since = [];
    listing = Promise.resolve()
      .then(() => store.list())
      .then(
        (listed) => {
          looks = byName((since ?? []).reduce((all, edit) => edit(all), wellMadeLooks(listed)));
          problem = null;
        },
        (error: unknown) => {
          problem = reasonOf(error);
        }
      )
      .then(() => {
        since = null;
        tell();
      });
  };
  const hub: LooksHub = {
    get looks() {
      return looks;
    },
    get problem() {
      return problem;
    },
    listen(view) {
      views.add(view);
    },
    ensure() {
      if (!listing) list();
    },
    reload: list,
    async save(look) {
      await store.save(look);
      const kept = { ...look, look: { ...look.look } };
      change((all) => [...all.filter((l) => l.id !== look.id), kept]);
    },
    async remove(id) {
      await store.remove(id);
      change((all) => all.filter((l) => l.id !== id));
    },
  };
  hubs.set(store, hub);
  return hub;
}
