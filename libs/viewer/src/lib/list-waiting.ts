import type { Part } from '@fieldia/widgets';
import type { ListContext, ListView } from './list';
import type * as ListModule from './list-part';

/**
 * A list drawn before its part came (list-part.ts): only when the part could
 * not come while the viewer waited for it (offline, say). "Loading…" in the
 * list's place while the part is asked for again, then the list itself in that
 * place, asking for its records. Nothing is typed into it, so nothing is lost.
 * When the part cannot come again, the list's own "Could not load the
 * records." and Retry, which asks again. What the app asks of the list
 * meanwhile — its records again, a record opened — waits for it.
 */
export function waitingList(part: Part<typeof ListModule>, context: ListContext): ListView {
  const { el, labels, node } = context;
  const words = el('p', { class: 'fd-list-waiting', role: 'status' }, labels.loading);
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
  const failed = el('p', { class: 'fd-list-failed', role: 'alert', hidden: '' }, labels.loadFailed, ' ', retry);
  const holder = el('div', { class: 'fd-list', 'data-node': node.id, 'aria-busy': 'true' }, words, failed);
  let list: ListView | null = null;
  let gone = false;
  let asking: Promise<ListView | null> | null = null;
  const waiting = (on: boolean) => {
    words.hidden = !on;
    failed.hidden = on;
    if (on) holder.setAttribute('aria-busy', 'true');
    else holder.removeAttribute('aria-busy');
  };
  const ask = (): Promise<ListView | null> =>
    (asking ??= part.load().then(
      (module) => {
        if (gone) return null;
        list = module.listView(context);
        holder.replaceWith(list.element);
        return list;
      },
      () => {
        // Forgotten, so Retry asks again.
        asking = null;
        if (!gone) waiting(false);
        return null;
      }
    ));
  retry.addEventListener('click', () => {
    waiting(true);
    void ask();
  });
  void ask();
  return {
    get element() {
      return list?.element ?? holder;
    },
    reload: async () => {
      if (list) return list.reload();
      await ask();
    },
    open: async (id, options) => {
      await (list ?? (await ask()))?.open(id, options);
    },
    destroy() {
      gone = true;
      list?.destroy();
    },
  };
}
