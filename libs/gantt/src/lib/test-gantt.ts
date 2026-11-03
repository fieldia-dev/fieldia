import { createMemoryDataSource, type ListGantt, type Page, type Values } from '@fieldia/core';

/** Wednesday 14 October 2026, 09:40 in the reader's own time: "now" in these tests. */
export const NOW = new Date(2026, 9, 14, 9, 40);

/** A shop's fit-out, its tasks by trade, each waiting for the ones before it. */
export function fitoutPage(gantt: Partial<ListGantt> = {}, more: Partial<Page> = {}): Page {
  return {
    fieldia: '0.13',
    id: 'fitout',
    title: 'Fit-out',
    data: { kind: 'record', model: 'fitout.task' },
    fields: {
      name: { type: 'char', label: 'Task' },
      start: { type: 'date', label: 'Starts' },
      finish: { type: 'date', label: 'Ends' },
      days: { type: 'integer', label: 'Days' },
      trade: { type: 'many2one', label: 'Trade', relation: 'fitout.trade' },
      phase: {
        type: 'selection',
        label: 'Phase',
        options: [
          { value: 'strip', label: 'Strip-out' },
          { value: 'first', label: 'First fix' },
          { value: 'finish', label: 'Finishes' },
        ],
      },
      after: { type: 'many2many', label: 'Waits for', relation: 'fitout.task' },
    },
    layout: {
      type: 'list',
      id: 'list',
      columns: ['name', 'start', 'finish', 'phase'],
      sort: [{ field: 'start' }],
      filters: [{ id: 'finishes', label: 'Finishes', filter: [{ field: 'phase', op: '=', value: 'finish' }] }],
      gantt: { start: 'start', end: 'finish', title: 'name', group: 'phase', colour: 'trade', dependsOn: 'after', opens: 'gantt', zoom: 'day', ...gantt },
    },
    ...more,
  };
}

export const BUILDERS = { id: 1, label: 'Nile Builders' };
export const SPARKS = { id: 2, label: 'Sparks Electric' };
const task = (id: number, label: string) => ({ id, label });

export function fitoutRecords(): Record<string, Values> {
  return {
    1: { name: 'Strip the old shop', start: '2026-10-12', finish: '2026-10-13', phase: 'strip', trade: BUILDERS, after: [] },
    2: { name: 'Wiring', start: '2026-10-14', finish: '2026-10-16', phase: 'first', trade: SPARKS, after: [task(1, 'Strip the old shop')] },
    3: { name: 'Plastering', start: '2026-10-19', finish: '2026-10-21', phase: 'finish', trade: BUILDERS, after: [task(2, 'Wiring')] },
    // Starts before the wiring it waits for ends: too soon.
    4: { name: 'Painting', start: '2026-10-15', finish: '2026-10-20', phase: 'finish', trade: BUILDERS, after: [task(2, 'Wiring')] },
    5: { name: 'Snagging', start: null, finish: null, phase: 'finish', trade: null, after: [] },
  };
}

export function fitoutSource(records: Record<string, Values> = fitoutRecords()) {
  return createMemoryDataSource({
    records: {
      'fitout.task': records,
      'fitout.trade': { 1: { name: 'Nile Builders' }, 2: { name: 'Sparks Electric' } },
    },
  });
}

/** Wait, up to two seconds, for something the timeline does once an answer comes back. */
export async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

export const key = (target: Element, name: string, more: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...more }));
