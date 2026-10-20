import type { MemoryDataSource, StoredDraft } from '@fieldia/core';

/**
 * The clinic's long intake (examples/pages/clinic-intake.page.json), started on one device and finished on another:
 * the demo's memory source keeps its drafts as an app's server would (`saveDraft`, `loadDraft`), in this browser's
 * localStorage — so a link opened in another tab, or after a reload, finds them — and makes the link Continue later
 * gives, this page's address with the draft's key (`?resume=…`). Mona Adel's draft, stopped at Medical history, is
 * there to continue from.
 */

const KEPT = 'fieldia-demo-drafts';

/** Mona Adel's intake, started on her phone: About you and Your visit answered, stopped at Medical history. */
const MONA: StoredDraft & { pageId: string } = {
  pageId: 'clinic-intake',
  values: {
    full_name: 'Mona Adel',
    birth_date: '1988-04-12',
    phone: '+201001234567',
    email: 'mona.adel@example.com',
    reason: 'A check-up before starting a new exercise plan, and a rash on my arm that comes and goes.',
    referred_by: 'friend',
    weight: 64.5,
    height: 168,
  },
  step: 'history',
  skipped: [],
  answered: ['full_name', 'birth_date', 'phone', 'email', 'reason', 'referred_by', 'weight', 'height'],
  savedAt: '2026-10-19T08:42:00.000Z',
};

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The drafts the demo's server keeps: those kept in this browser, and Mona's. */
export function keptDrafts(): Record<string, StoredDraft & { pageId: string }> {
  let kept: Record<string, StoredDraft & { pageId: string }> = {};
  try {
    kept = JSON.parse(store()?.getItem(KEPT) ?? '{}') ?? {};
  } catch {
    kept = {};
  }
  return { 'mona-adel': MONA, ...kept };
}

/** The link Continue later answers with: this page's address, its draft's key in it. */
export function draftLink(key: string): string {
  const url = new URL(location.href);
  url.searchParams.set('resume', key);
  return url.href;
}

/** Each draft the source keeps, and each it lets go as its answers are sent, kept in this browser for the next tab. */
export function keepDrafts(source: MemoryDataSource): void {
  const kept = store();
  if (!kept) return;
  const save = () => {
    try {
      kept.setItem(KEPT, JSON.stringify(Object.fromEntries(Object.entries(source.drafts).filter(([key]) => key !== 'mona-adel'))));
    } catch {
      // A full store: the drafts stay in this tab alone.
    }
  };
  for (const method of ['saveDraft', 'submit'] as const) {
    const own = source[method].bind(source) as (request: never) => Promise<unknown>;
    (source as unknown as Record<string, unknown>)[method] = (request: never) => own(request).then((answer) => (save(), answer));
  }
}
