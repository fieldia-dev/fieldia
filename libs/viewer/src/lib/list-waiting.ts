import { recordSentence } from '@fieldia/core';
import { loadingOver, startLoading, type Part, type Wait } from '@fieldia/widgets';
import type { ListContext, ListView } from './list';
import type * as ListModule from './list-part';

/**
 * A list drawn before its part came (list-part.ts): only when the part could
 * not come while the viewer waited for it (offline, say). Its first wait in the
 * list's place, as every wait is (loading.ts in @fieldia/widgets: a skeleton
 * unless the page says otherwise, "Loading…" in words until the loading part
 * has come), drawn at once — the page waited already — while the part is asked
 * for again; then the list itself in that place, asking for its records, its
 * own wait going on from this one. Nothing is typed into it, so nothing is lost.
 * When the part cannot come again, the list's own "Could not load the
 * records." and Retry, which asks again. What the app asks of the list
 * meanwhile — its records again, a record opened — waits for it.
 */
export function waitingList(part: Part<typeof ListModule>, context: ListContext): ListView {
  const { el, labels, node } = context;
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
  const failed = el('p', { class: 'fd-list-failed', role: 'alert', hidden: '' }, recordSentence(context.page.records, labels.loadFailedNoun, labels.loadFailed, context.locale), ' ', retry);
  const holder = el('div', { class: 'fd-list', 'data-node': node.id }, failed);
  const loading = loadingOver(context.loading, node.loading);
  let list: ListView | null = null;
  let gone = false;
  let asking: Promise<ListView | null> | null = null;
  let wait: Wait | null = null;
  /** Its wait while the part is asked for: its failure the list's own sentence and Retry. */
  const waiting = () => {
    failed.hidden = true;
    wait = startLoading(holder, 'first', loading, {
      part: node.id,
      now: true,
      failed: () => {
        failed.hidden = false;
        return true;
      },
    });
  };
  const ask = (): Promise<ListView | null> =>
    (asking ??= part.load().then(
      (module) => {
        if (gone) return null;
        // The list's own first wait goes on from this one, drawn at once in its place: never gone and back.
        context.loadingNow = context.loadingNow || !!wait?.shown;
        wait?.stop();
        list = module.listView(context);
        holder.replaceWith(list.element);
        return list;
      },
      (error: unknown) => {
        // Forgotten, so Retry asks again.
        asking = null;
        if (!gone) wait?.fail(error);
        return null;
      }
    ));
  retry.addEventListener('click', () => {
    waiting();
    void ask();
  });
  waiting();
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
      wait?.stop();
      list?.destroy();
    },
  };
}
