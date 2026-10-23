import type { SavedView } from '@fieldia/core';

/**
 * The sales team's saved views of its queue of leads (leads-queue), as its server keeps them: two the team shares —
 * Mona Adel's, Karim Samir's — each a search and an order, neither the default, so the queue opens on its own search;
 * and those saved in this tab, kept while it is open (the frame's Start over takes them away), as every store of the
 * demos' is (shared/kept.ts).
 */
export const TEAM_VIEWS: Record<string, SavedView[]> = {
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
