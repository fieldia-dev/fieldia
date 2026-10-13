import { createMemoryChatter, type ChatterMessage, type Person } from '@fieldia/chatter';
import { createMemoryDataSource, type MemoryDataSourceOptions, type RelatedRecord, type Values } from '@fieldia/core';

/**
 * The backlog demo's own data, all of it invented: a team's bugs, the areas
 * and sprints they sit in, the people who work on them, and bug 4127 in full
 * — its comment and the history of its changes, kept by the chatter.
 */

// ---- people ------------------------------------------------------------------------------------------

/** Karim and Salma, the person using the demo, have pictures of their own (drawn, of no one); the others show their initials. */
const salmaPicture =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#8fa3ad"/><path d="M14 40c-2-20 6-31 18-31s20 11 18 31z" fill="#4a3426"/><circle cx="32" cy="27" r="11" fill="#e9c4a2"/><path d="M21 25c1-8 6-11 11-11s10 3 11 11c-4-4-8-5-11-5s-7 1-11 5z" fill="#4a3426"/><path d="M8 64c2-13 11-19 24-19s22 6 24 19z" fill="#2f5d7c"/></svg>'
  );
const karimPicture =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#5c7f94"/><circle cx="32" cy="25" r="12" fill="#f1d3b5"/><path d="M20 22c0-9 6-13 12-13s12 4 12 13c-3-5-8-6-12-6s-9 1-12 6z" fill="#3b2a20"/><path d="M10 64c2-14 11-20 22-20s20 6 22 20z" fill="#e8eef2"/></svg>'
  );

export const people = {
  mona: { id: 1, name: 'Mona Adel' },
  karim: { id: 2, name: 'Karim Fathy', avatar: karimPicture },
  salma: { id: 3, name: 'Salma Nabil', avatar: salmaPicture },
  omar: { id: 4, name: 'Omar Hany' },
} satisfies Record<string, Person>;

/** The person using the demo: the author of what is posted. */
export const me: Person = people.salma;

const link = (record: { id: number; name: string }): RelatedRecord => ({ id: record.id, label: record.name });

// ---- where the bugs sit: areas and iterations, each with its path from the top -----------------------------

/** The team's one area, the project's own, as the tracker's screens have it (20.20.45): a root with nothing under it. */
const AREAS = [{ id: 1, path: ['Portal'] }];

/** Each sprint with its dates, as the iteration picker shows them at the end of its row. */
const ITERATIONS = [
  { id: 10, path: ['Portal'], dates: '' },
  { id: 11, path: ['Portal', 'Test Plan'], dates: '8/3/2025 - 8/17/2025' },
  { id: 12, path: ['Portal', 'Sprint 12'], dates: '3/25/2026 - 4/16/2026' },
  { id: 13, path: ['Portal', 'Sprint 13'], dates: '4/8/2026 - 4/20/2026' },
  { id: 14, path: ['Portal', 'Sprint 14'], dates: '4/12/2027 - 5/25/2027' },
  { id: 15, path: ['Portal', 'Tasks and Activities'], dates: '7/16/2026 - 8/28/2026' },
  { id: 16, path: ['Portal', 'Invoices'], dates: '12/29/2027 - 2/9/2028' },
  // The rest of the team's sprints and weeks, as a tree a few years old has them: the list scrolls a long way.
  ...[
    ['Week 15 Bugs', '4/1/2026 - 4/13/2026'],
    ['Week 16 Bugs', '4/8/2026 - 4/20/2026'],
    ['Week 17 Bugs', '4/15/2026 - 4/27/2026'],
    ['Week 18 Bugs', '4/22/2026 - 5/4/2026'],
    ['Week 19 Bugs', '4/29/2026 - 5/11/2026'],
    ['Week 20 Bugs', '5/6/2026 - 5/18/2026'],
    ['Sprint 10', '1/14/2026 - 2/4/2026'],
    ['Sprint 11', '2/18/2026 - 3/11/2026'],
    ['Sprint 15', '5/26/2027 - 6/16/2027'],
    ['Sprint 16', '6/17/2027 - 7/8/2027'],
    ['Release 2.0', '9/1/2025 - 10/15/2025'],
    ['Release 2.1', '10/16/2025 - 11/30/2025'],
    ['Hardening', '12/1/2025 - 12/19/2025'],
    ['Data Migration', '1/5/2026 - 1/30/2026'],
    ['Scanner Rollout', '2/2/2026 - 2/27/2026'],
    ['Reports', '3/2/2026 - 3/20/2026'],
    ['Mobile', '6/1/2026 - 7/10/2026'],
    ['Payments', '7/13/2026 - 8/14/2026'],
    ['Support Rotation', '8/17/2026 - 9/11/2026'],
    ['Year End', '12/1/2026 - 12/31/2026'],
  ].map(([name, dates], at) => ({ id: 20 + at, path: ['Portal', name], dates })),
];

/** A record of a tree, named by its whole path ("Portal\Sprint 14"), as a backlog's column shows it. */
const pathName = (path: string[]) => path.join('\\');
const area = (id: number): RelatedRecord => ({ id, label: pathName(AREAS.find((a) => a.id === id)?.path ?? []) });
const iteration = (id: number): RelatedRecord => ({ id, label: pathName(ITERATIONS.find((i) => i.id === id)?.path ?? []) });

// ---- the backlog ---------------------------------------------------------------------------------------------

/** One bug of the backlog: its order on it, its id, its title and where it sits. */
type Line = [order: number, id: number, title: string, iteration: number];

const BUGS: Line[] = [
  [17, 4127, 'Stock count shows 12 after releasing 3 of 15 items to order SO-2088', 14],
  [31, 4131, 'Download stops at the cancel stage of a purchase order', 13],
  [52, 4136, 'The menu link should say Inventory, not Warehouse', 11],
  [84, 4140, 'A task that cannot be deleted should say why', 15],
  [87, 4142, 'Sales price shows a rate of 1 for every currency', 16],
  [100, 4145, 'Margin on order SO-2091 does not match the project’s figure', 14],
  [101, 4147, 'Budget total leaves out the last revision', 14],
  [110, 4151, 'Currency rate shows 0 on a letter of guarantee', 16],
  [112, 4153, 'Grid shows amounts in EUR while its rate is in EGP', 16],
  [115, 4156, 'No rate appears for a requested guarantee value', 16],
  [138, 4160, 'A new account cannot be added from Contacts', 10],
  [185, 4164, 'Go to offer runs twice after a double click (video attached)', 10],
  [196, 4167, 'Deduction message should say why approval is blocked', 10],
  [197, 4169, 'Saving this page shows an error', 10],
  [199, 4172, 'Sales reps can see the jobs of other reps (video attached)', 10],
  [206, 4175, 'Searching for a job number fails to load', 10],
  [207, 4178, 'Delete shows for people who cannot delete', 10],
];

/** Work under bug 4127: hidden while the backlog shows bugs alone, nested under it once it shows tasks too. */
const TASKS: Line[] = [
  [18, 4128, 'Write a test for the stock count after a part is released', 14],
  [19, 4129, 'Read the night shift’s scanner log', 14],
];

const BUG_4127_REPRO = '<p><a href="https://shop.example/orders/SO-2088?tab=history">https://shop.example/orders/SO-2088?tab=history</a></p>';

function workItems(): Record<string, Values> {
  const items: Record<string, Values> = {};
  const base = (order: number, id: number, title: string, at: number): Values => ({
    order,
    number: id,
    title,
    work_type: 'bug',
    state: 'active',
    reason: 'approved',
    value_area: 'business',
    area: area(1),
    iteration: iteration(at),
    assigned_to: null,
    tags: [],
    comment_count: 0,
    parent_id: null,
    priority: '2',
    severity: '3',
    story_points: null,
    category: null,
    resolved_reason: null,
    activity: null,
    original_estimate: null,
    remaining_work: null,
    completed_work: null,
    repro_steps: '',
    system_info: '',
    found_in: null,
    integrated_in: null,
    related: [],
    dev_links: [],
    changed_by: link(people.mona),
    changed_date: '2026-08-25T09:40:00',
    following: false,
    attachments: [],
  });
  for (const [order, id, title, at] of BUGS) items[id] = base(order, id, title, at);
  // Bug 4127, as the screenshots show the bug opened: priority 1, one comment, one file, its steps a link.
  Object.assign(items[4127], {
    priority: '1',
    comment_count: 1,
    repro_steps: BUG_4127_REPRO,
    attachments: [{ name: 'stock-after-release.png', type: 'image/png', size: 48213, url: null }],
  });
  for (const [order, id, title, at] of TASKS) {
    items[id] = { ...base(order, id, title, at), work_type: 'task', state: id === 4128 ? 'active' : 'new', reason: 'new', parent_id: { id: 4127, label: items[4127]['title'] as string }, changed_by: link(people.karim) };
  }
  return items;
}

/**
 * What a link shows of each model's records besides their name: a person's
 * picture; an area's and a sprint's path, and a sprint's dates at the end of
 * its row.
 */
const shows: MemoryDataSourceOptions['shows'] = {
  'res.users': { avatar: 'image' },
  'work.area': { path: 'path' },
  'work.iteration': { path: 'path', aside: 'dates' },
};

export function backlogData() {
  return createMemoryDataSource({
    records: {
      'work.item': workItems(),
      'res.users': Object.fromEntries(Object.values(people).map((p) => [p.id, { name: p.name, image: 'avatar' in p ? p.avatar : null }])),
      'work.area': Object.fromEntries(AREAS.map((a) => [a.id, { name: pathName(a.path), path: a.path }])),
      'work.iteration': Object.fromEntries(ITERATIONS.map((i) => [i.id, { name: pathName(i.path), path: i.path, dates: i.dates }])),
      'work.tag': { 1: { name: 'Stock' }, 2: { name: 'Pricing' }, 3: { name: 'Night shift' } },
      'dev.link': {},
      // What a comment's ! links: a few pull requests, invented.
      'pull.request': { 61: { name: 'Release keeps the reserved stock' }, 62: { name: 'Stock count after a partial release' }, 63: { name: 'Night shift scanner log export' } },
    },
    shows,
    // A work item is named by its title, as a link to one shows it.
    labelField: { 'work.item': 'title' },
  });
}

/**
 * The person's latest Area and Iteration picks, so the pickers' Suggestions are there on the first open: kept as the
 * path picker keeps them (`recent:<model>`, newest first, each `{ id, label }`).
 */
export const recentPicks = {
  // As the tracker's screens show them: the sprint picked before the current one first, then the current one.
  'recent:work.iteration': [12, 14, 10, 15, 16].map((id) => ({ id, label: pathName(ITERATIONS.find((i) => i.id === id)?.path ?? []) })),
  'recent:work.area': [1].map((id) => ({ id, label: pathName(AREAS.find((a) => a.id === id)?.path ?? []) })),
};

// ---- bug 4127's conversation and history ----------------------------------------------------------------

const change = (field: string, label: string, from: string | null, to: string | null) => ({ field, label, from, to });

/** Newest first, as a chatter keeps them: the comment, then each change made to the bug. */
function history(): ChatterMessage[] {
  const { mona, karim } = people;
  const event = (id: number, author: Person, date: string, tracking: ReturnType<typeof change>[]): ChatterMessage => ({ id, kind: 'event', author, date, body: '', tracking });
  return [
    event(118, mona, '2026-08-25T09:40:00Z', [change('stack_rank', 'Stack Rank', '1999964429', '1999964430')]),
    event(117, mona, '2026-08-23T13:05:00Z', [change('stack_rank', 'Stack Rank', '1999971200', '1999964429')]),
    event(116, mona, '2026-08-20T10:15:00Z', [change('stack_rank', 'Stack Rank', '1999979534', '1999971200')]),
    event(115, mona, '2026-07-27T08:30:00Z', [change('iteration', 'Iteration Path', 'Portal\\Sprint 13', 'Portal\\Sprint 14')]),
    event(114, mona, '2026-07-22T12:59:00Z', [change('stack_rank', 'Stack Rank', '1999987060', '1999979534')]),
    event(113, karim, '2026-07-08T11:20:00Z', [change('state', 'State', 'New', 'Active'), change('reason', 'Reason', 'Investigation Complete', 'Approved'), change('priority', 'Priority', '2', '1')]),
    event(112, karim, '2026-07-08T11:18:00Z', [change('title', 'Title', 'Stock count wrong after a release', 'Stock count shows 12 after releasing 3 of 15 items to order SO-2088')]),
    {
      id: 111,
      kind: 'message',
      author: karim,
      date: '2026-06-14T15:02:00Z',
      body: '<p>I need the night shift’s warehouse log before I can reproduce it; the scanner there is offline until Sunday.</p>',
    },
    event(110, karim, '2026-06-14T14:55:00Z', [change('state', 'State', 'Active', 'New'), change('reason', 'Reason', 'Approved', 'Investigation Complete')]),
    event(109, mona, '2026-06-11T09:10:00Z', [change('state', 'State', 'New', 'Active'), change('reason', 'Reason', 'New', 'Approved')]),
    event(108, mona, '2026-06-10T16:45:00Z', [change('state', 'State', null, 'New'), change('reason', 'Reason', null, 'New'), change('area', 'Area', null, 'Portal')]),
  ];
}

export function backlogChatter() {
  return createMemoryChatter({ me, people: Object.values(people), records: { 'work.item:4127': { messages: history() } } });
}
