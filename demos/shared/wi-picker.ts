import type { Page, Values } from '@fieldia/core';
import page from '../../examples/pages/wi-picker.page.json';

/**
 * The work item's pickers on a page of their own (`?page=wi-picker`), for
 * their browser test (e2e/wi-picker.spec.ts): a bug's Area and Iteration as
 * path pickers over a tree of areas and of iterations with their dates, its
 * State's list, Planning's choices in Fieldia's own list, its tags added from
 * a button, and no one assigned yet. Invented data.
 */

const path = (...names: string[]) => names;

/** The areas, as a tree: each one's names from the top down. */
const AREAS: Record<number, Values> = {
  1: { name: 'Portal', path: path('Portal') },
  2: { name: 'Checkout', path: path('Portal', 'Checkout') },
  3: { name: 'Search', path: path('Portal', 'Search') },
  4: { name: 'Warehouse', path: path('Warehouse') },
};

/** The iterations, each with its dates at the end of its row. */
const ITERATIONS: Record<number, Values> = {
  1: { name: 'Portal', path: path('Portal') },
  2: { name: 'Test Plan', path: path('Portal', 'Test Plan'), dates: '8/3/2025 - 8/17/2025' },
  3: { name: 'Sprint 12', path: path('Portal', 'Sprint 12'), dates: '3/25/2026 - 4/16/2026' },
  4: { name: 'Sprint 13', path: path('Portal', 'Sprint 13'), dates: '4/8/2026 - 4/20/2026' },
  5: { name: 'Sprint 14', path: path('Portal', 'Sprint 14'), dates: '4/12/2027 - 5/25/2027' },
  6: { name: 'Tasks and Activities', path: path('Portal', 'Tasks and Activities'), dates: '7/16/2026 - 8/28/2026' },
  7: { name: 'Invoices', path: path('Portal', 'Invoices'), dates: '12/29/2027 - 2/9/2028' },
  8: { name: 'Week 16 Fixes', path: path('Portal', 'Week 16 Fixes'), dates: '4/13/2026 - 4/17/2026' },
  9: { name: 'Night shift', path: path('Portal', 'Week 16 Fixes', 'Night shift'), dates: '4/15/2026 - 4/16/2026' },
};

const PEOPLE: Record<number, Values> = {
  1: { name: 'Mona Adel' },
  2: { name: 'Karim Fathy' },
  3: { name: 'Salma Nabil' },
  4: { name: 'Omar Hany' },
};

const TAGS: Record<number, Values> = { 1: { name: 'Stock' }, 2: { name: 'Checkout' }, 3: { name: 'Regression' } };

const link = (rows: Record<number, Values>, id: number) => ({ id, label: String(rows[id]['name']), ...(rows[id]['path'] ? { path: rows[id]['path'] as string[] } : {}), ...(rows[id]['dates'] ? { aside: String(rows[id]['dates']) } : {}) });

export const wiPicker = {
  pages: { 'wi-picker': page as Page },
  records: {
    'wi.area': AREAS,
    'wi.iteration': ITERATIONS,
    'wi.user': PEOPLE,
    'wi.tag': TAGS,
    'wi.picker': {
      1: {
        assigned_to: null,
        tags: [],
        state: 'active',
        reason: 'approved',
        area: link(AREAS, 1),
        iteration: link(ITERATIONS, 5),
        category: null,
        story_points: null,
        priority: '1',
        severity: '3',
        activity: null,
      },
    },
  } as Record<string, Record<number, Values>>,
  /** What a picker shows of a tree's records: their names from the top down, and an iteration's dates. */
  shows: { 'wi.area': { path: 'path' }, 'wi.iteration': { path: 'path', aside: 'dates' } },
};
