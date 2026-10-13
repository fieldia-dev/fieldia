import type { DataSource, Locale, Values } from '@fieldia/core';
import { chatterSlot, createMemoryChatter } from '@fieldia/chatter';

/**
 * The work item's body (examples/pages/wi-text.page.json): bug 4127's
 * records, the people mentioned and the pull requests linked in its texts,
 * and its own discussion, kept in memory. Every name and record is invented.
 */

const salma = { id: 3, name: 'Salma Nabil' };
const mona = { id: 1, name: 'Mona Adel' };
/** A drawn picture, as a person's photo stands in a work tracker. */
const karimFace =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#cfd8dc"/><circle cx="24" cy="19" r="9" fill="#a1887f"/><path d="M8 48c2-11 8-16 16-16s14 5 16 16z" fill="#37474f"/><path d="M15 16c2-7 16-8 18 0-3-3-15-3-18 0z" fill="#4e342e"/></svg>'
  );
const karim = { id: 2, name: 'Karim Fathy', avatar: karimFace };
const omar = { id: 4, name: 'Omar Hany' };

/** Bug 4127, the work items it can link to, the people and the pull requests its texts name, its development links. */
export function wiTextRecords(): Record<string, Record<number, Values>> {
  return {
    'wi.text': {
      1: {
        name: 'Stock count shows 12 after releasing 3 of 15 items to order SO-2088',
        repro_steps: '<p><a href="https://shop.example/orders/SO-2088?tab=history">https://shop.example/orders/SO-2088?tab=history</a></p>',
        system_info: null,
        category: null,
        resolved_reason: null,
        story_points: null,
        priority: '1',
        severity: '3',
        activity: null,
        original_estimate: null,
        remaining_work: null,
        completed_work: null,
        dev_links: [],
        related: [],
        found_in: null,
        integrated_in: null,
      },
      2: { name: 'Invoice total is off by one cent on split payments' },
      3: { name: 'Reserved stock is not released when an order is cancelled' },
      4: { name: 'Warehouse scanner drops the last line of a pick list' },
    },
    'wi.person': { 1: { name: mona.name }, 2: { name: karim.name }, 3: { name: salma.name }, 4: { name: omar.name } },
    'wi.pull': { 12: { name: 'Release reserved stock line by line' }, 15: { name: 'Count stock after a partial release' } },
    'wi.dev': { 1: { name: 'stock/partial-release' }, 2: { name: 'Commit 4f2c9e1: recount after release' } },
  };
}

/** The bug's discussion: Karim's comment, and a change that belongs to its history, not here. */
export const wiTextChatter = createMemoryChatter({
  me: salma,
  people: [mona, karim, salma, omar],
  now: () => new Date('2026-10-12T09:00:00Z'),
  records: {
    'wi.text:1': {
      messages: [
        { id: 501, kind: 'message', author: karim, date: '2026-06-14T10:20:00Z', body: '<p>I need the night shift’s warehouse log before I can reproduce it; the scanner there is offline until Sunday.</p>' },
        { id: 500, kind: 'event', author: mona, date: '2026-06-11T08:00:00Z', body: '', tracking: [{ field: 'state', label: 'State', from: 'New', to: 'Active' }] },
      ],
    },
  },
});

/** The words in the empty comment box, in each language the demo shows. */
const HINT: Record<Locale, string> = {
  en: 'Add a comment. Use # to link a work item, @ to mention a person, or ! to link a pull request.',
  ar: 'أضف تعليقًا. استخدم # لربط عنصر عمل، و@ للإشارة إلى شخص، و! لربط طلب سحب.',
  de: 'Kommentar hinzufügen. Mit # verknüpfen Sie ein Arbeitselement, mit @ erwähnen Sie eine Person, mit ! verknüpfen Sie einen Pull Request.',
  fr: 'Ajoutez un commentaire. Utilisez # pour lier un élément de travail, @ pour mentionner une personne ou ! pour lier une demande de tirage.',
};
const KINDS: Record<Locale, [string, string]> = {
  en: ['work item', 'pull request'],
  ar: ['عنصر عمل', 'طلب سحب'],
  de: ['Arbeitselement', 'Pull Request'],
  fr: ['un élément de travail', 'une demande de tirage'],
};

/** What the discussion said of its count, for the browser tests: the head's "1 Comment" reads it once the parts are joined. */
const counts: number[] = [];
if (typeof window !== 'undefined') Object.assign(window, { fieldiaWiText: { counts } });

/** The work item's Discussion, in the demo's language and direction, its records found in the demo's data. */
export function wiTextDiscussion(params: URLSearchParams, dataSource: DataSource) {
  const locale = (params.get('locale') as Locale | null) ?? 'en';
  const find = (model: string) => (query: string) => dataSource.search?.({ model, query, limit: 8 }) ?? Promise.resolve([]);
  return chatterSlot({
    look: 'discussion',
    source: wiTextChatter,
    me: salma,
    placeholder: HINT[locale] ?? HINT.en,
    references: [
      { key: '#', model: 'wi.text', label: KINDS[locale]?.[0] ?? KINDS.en[0], icon: 'hash', search: find('wi.text') },
      { key: '!', model: 'wi.pull', label: KINDS[locale]?.[1] ?? KINDS.en[1], icon: 'pull-request', search: find('wi.pull') },
    ],
    locale,
    dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
    now: () => new Date('2026-10-12T09:00:00Z'),
    onCount: (count) => counts.push(count),
  });
}
