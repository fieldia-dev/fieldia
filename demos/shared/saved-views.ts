import type { MemoryDataSource, SavedView } from '@fieldia/core';
import { KEPT, KEPT_EVENT } from './kept';

/**
 * The sales team's saved views of its queue of leads (leads-queue), as its server keeps them: two the team shares —
 * Mona Adel's, Karim Samir's — each a search and an order, neither the default, so the queue opens on its own search;
 * and those saved in this tab, kept while it is open (the frame's Start over takes them away), as the demos' records
 * are (shared/kept.ts).
 */
const TEAM: Record<string, SavedView[]> = {
  'leads-queue': [
    {
      id: 'team-unassigned',
      name: 'No agent yet, biggest first',
      shared: true,
      by: 'Mona Adel',
      state: { facets: [{ kind: 'filters', ids: ['no_agent'], labels: ['No agent yet'] }], sort: [{ field: 'budget', desc: true }] },
    },
    {
      id: 'team-late',
      name: 'Late, by agent',
      shared: true,
      by: 'Karim Samir',
      state: { facets: [{ kind: 'filters', ids: ['late'], labels: ['Late'] }], sort: [{ field: 'agent' }, { field: 'next_on' }] },
    },
  ],
};

/** Where this tab keeps the views it saved: under the demos' prefix, so Start over takes them away with the records. */
const VIEWS = `${KEPT}#views`;

function store(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The views the demo's source starts from: the team's, or what this tab kept since. */
export function keptViews(): Record<string, SavedView[]> {
  try {
    const kept = JSON.parse(store()?.getItem(VIEWS) ?? 'null') as Record<string, SavedView[]> | null;
    return kept && typeof kept === 'object' ? { ...TEAM, ...kept } : TEAM;
  } catch {
    return TEAM;
  }
}

/** Each view saved or deleted kept in this tab, as the server keeps it: the next visit lists it, the frame told. */
export function keepViews(source: MemoryDataSource): void {
  const storage = store();
  const { views, saveView, deleteView } = source;
  if (!storage || !views || !saveView || !deleteView) return;
  const keep = async (request: { pageId: string; model: string; list: string }) => {
    const now = await views.call(source, request);
    try {
      const kept = JSON.parse(storage.getItem(VIEWS) ?? '{}') as Record<string, SavedView[]>;
      storage.setItem(VIEWS, JSON.stringify({ ...kept, [request.pageId]: now }));
      dispatchEvent(new Event(KEPT_EVENT));
    } catch {
      // A full store: the views stay in this tab's page alone.
    }
  };
  source.saveView = (request) => saveView.call(source, request).then(async (view) => (await keep(request), view));
  source.deleteView = (request) => deleteView.call(source, request).then(() => keep(request));
}
