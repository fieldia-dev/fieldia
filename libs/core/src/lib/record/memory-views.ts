import type { DataSource, DeleteViewRequest, SavedView, SaveViewRequest, ViewsRequest } from './data-source';
import { structuredCopy } from './values';

/**
 * A memory source's saved views (`views`, `saveView`, `deleteView`), by page id, as an app's server keeps them: the
 * views it was given — the team's shared ones, each with `by`, and this person's own (`mine`) — and those this person
 * saves, theirs. One default of a kind: a view kept as the default lets go of the person's other own default, a shared
 * one of the team's other default. Another's view is never changed nor deleted: refused, as a server would.
 */
export function memoryViews(given: Record<string, SavedView[]>, calls: { method: keyof DataSource; request: unknown }[], pause: () => Promise<void>): Required<Pick<DataSource, 'views' | 'saveView' | 'deleteView'>> {
  const kept: Record<string, SavedView[]> = structuredCopy(given);
  let made = 0;
  /** A new view's id: one no view kept has — those it was given (a visit before) among them. */
  const newId = () => {
    let id: string;
    do id = `view-${++made}`;
    while (Object.values(kept).some((views) => views.some((view) => view.id === id)));
    return id;
  };
  const of = (request: ViewsRequest) => (kept[request.pageId] ??= []);
  return {
    async views(request: ViewsRequest): Promise<SavedView[]> {
      calls.push({ method: 'views', request });
      await pause();
      return structuredCopy(of(request));
    },

    async saveView(request: SaveViewRequest): Promise<SavedView> {
      calls.push({ method: 'saveView', request });
      await pause();
      const views = of(request);
      const { id, ...asked } = structuredCopy(request.view);
      const before = id === undefined ? undefined : views.find((view) => view.id === id);
      if (id !== undefined && !before) throw new Error('That view is no longer there.');
      if (before && !before.mine) throw new Error(`${before.name} is ${before.by ?? 'someone else'}’s view: save it under a name of your own.`);
      const view: SavedView = { ...asked, id: before?.id ?? newId(), mine: true };
      if (!view.shared) delete view.shared;
      if (!view.isDefault) delete view.isDefault;
      // One default of a kind: the person's own, or the team's.
      if (view.isDefault) for (const other of views) if (other.id !== view.id && other.isDefault && (view.shared ? other.shared : other.mine && !other.shared)) delete other.isDefault;
      if (before) views.splice(views.indexOf(before), 1, view);
      else views.push(view);
      return structuredCopy(view);
    },

    async deleteView(request: DeleteViewRequest): Promise<void> {
      calls.push({ method: 'deleteView', request });
      await pause();
      const views = of(request);
      const at = views.findIndex((view) => view.id === request.id);
      if (at < 0) return;
      if (!views[at].mine) throw new Error(`${views[at].name} is ${views[at].by ?? 'someone else'}’s view.`);
      views.splice(at, 1);
    },
  };
}
