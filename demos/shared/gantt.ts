import { ganttListViews } from '@fieldia/gantt';
import type { Page, Values } from '@fieldia/core';
import fitoutPlan from '../../examples/pages/fitout-plan.page.json';
import fitoutTask from '../../examples/pages/fitout-task.page.json';
import { demoNow } from './calendar';

/**
 * The timeline demo: a café's fit-out in a mall unit, its tasks by phase,
 * each from its start for its days, waiting for the ones before it. Made
 * round "now" — the plan two weeks under way — so the timeline opens on
 * today: the reader's own, or `?now=2026-10-14T09:40` as the browser tests
 * pin it.
 */

/** A list's timeline, for the viewer's `listViews`: on the demos' clock. */
export const demoGanttViews = ganttListViews({ now: demoNow });

const TRADES = ['Atlas Contracting', 'Volt Electrical', 'Aqua MEP', 'Line Interiors', 'Oak Joinery', 'Stone Floors'];
const trade = (n: number) => ({ id: n, label: TRADES[n - 1] });

/** Each task: its name, its phase, its trade, its first day from the plan's, its days, and those it waits for, by their number. */
const PLAN: [string, string, number | null, number | null, number, number[]][] = [
  ['Site survey', 'design', 4, 0, 2, []],
  ['Design sign-off', 'design', 4, 2, 3, [1]],
  ['Strip out the old unit', 'strip', 1, 5, 4, [2]],
  ['Waste removal', 'strip', 1, 9, 2, [3]],
  ['Electrical first fix', 'first', 2, 11, 5, [4]],
  ['Plumbing first fix', 'first', 3, 11, 4, [4]],
  ['Air-conditioning ducts', 'first', 3, 13, 5, [4]],
  ['Partitions', 'walls', 1, 16, 4, [5, 6]],
  // Planned to start the day before the partitions are done: too soon, and the timeline says so.
  ['Suspended ceiling', 'walls', 1, 19, 4, [7, 8]],
  ['Electrical second fix', 'second', 2, 23, 3, [9]],
  ['Sanitary fittings', 'second', 3, 23, 2, [9]],
  ['Painting', 'finish', 1, 26, 4, [10, 11]],
  ['Flooring', 'finish', 6, 30, 4, [12]],
  ['Counter and shelving', 'finish', 5, 30, 5, [12]],
  ['Snagging', 'handover', 1, 35, 3, [13, 14]],
  ['Handover to the tenant', 'handover', 1, 38, 0, [15]],
  ['Shop sign', 'handover', null, null, 2, []],
];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The fit-out's tasks: the plan started on the Monday two weeks before now, each done, under way or to do as of today. */
export function fitoutTasks(now = demoNow()): Record<number, Values> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 14);
  const records: Record<number, Values> = {};
  PLAN.forEach(([name, phase, who, from, days, after], i) => {
    const start = from === null ? null : new Date(first.getFullYear(), first.getMonth(), first.getDate() + from);
    const end = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.max(days, 1)) : null;
    records[i + 1] = {
      name,
      phase,
      trade: who === null ? null : trade(who),
      start: start ? dayKey(start) : null,
      days,
      after: after.map((n) => ({ id: n, label: PLAN[n - 1][0] })),
      state: !start || !end || start > today ? 'todo' : end <= today ? 'done' : 'doing',
      notes: null,
    };
  });
  return records;
}

/** What the demos' data source, pages and opened records need of the timeline demo. */
export const ganttDemo = {
  pages: { 'fitout-plan': fitoutPlan as Page, 'fitout-task': fitoutTask as Page } as Record<string, Page>,
  /** The timeline's record page: what a bar opens in. */
  recordPages: { 'fitout-plan': 'fitout-task' } as Record<string, string>,
  /** The page a task opens in, in a dialog, by its model. */
  related: { 'cafe.task': fitoutTask as Page } as Record<string, Page>,
  records: () => ({
    'cafe.task': fitoutTasks(),
    'cafe.trade': Object.fromEntries(TRADES.map((name, i) => [i + 1, { name }])),
  }),
};
