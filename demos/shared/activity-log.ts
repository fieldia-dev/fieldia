import type { Page, Values } from '@fieldia/core';
import { demoNow } from './calendar';

/**
 * What a sales team did (activity-log): 1,284 entries back from now — the reader's own, or `?now=` as the browser tests
 * pin it — a few minutes apart, each who, what they did and to which record, so a list that loads as it is scrolled has
 * a feed's length. The same entries on every visit.
 */
const PEOPLE = ['Mona Adel', 'Karim Samir', 'Salma Hany', 'Youssef Nabil', 'Laila Mostafa'];
const ACTIONS = ['created', 'updated', 'updated', 'sent', 'archived'];
const RECORDS = ['Quotation S0', 'Invoice INV/2026/', 'Lead #', 'Viewing V-', 'Contract C-'];
const DETAILS: Record<string, string[]> = {
  created: ['From a WhatsApp enquiry', 'From the website form', 'Copied from last year'],
  updated: ['Price changed', 'Agent changed', 'Next follow-up moved', 'Notes added'],
  sent: ['By email to the customer', 'By WhatsApp', 'Reminder sent'],
  archived: ['Lost to a competitor', 'Duplicate', 'Closed'],
};

/** The same numbers every time: a demo that looks the same on each visit. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}

export function activityEntries(now = demoNow()): Record<number, Values> {
  const random = seeded(23);
  const records: Record<number, Values> = {};
  let at = now.getTime();
  for (let id = 1; id <= 1284; id++) {
    at -= (3 + Math.floor(random() * 40)) * 60_000;
    const action = ACTIONS[Math.floor(random() * ACTIONS.length)];
    const details = DETAILS[action];
    records[id] = {
      at: new Date(at).toISOString().slice(0, 16),
      who: PEOPLE[Math.floor(random() * PEOPLE.length)],
      action,
      name: `${RECORDS[Math.floor(random() * RECORDS.length)]}${1000 + Math.floor(random() * 900)}`,
      details: details[Math.floor(random() * details.length)],
    };
  }
  return records;
}

/** An entry's own page, as a row of the log opens it: when, who, what and to which record. */
export const activityEntryPage: Page = {
  fieldia: '0.11',
  id: 'activity-entry',
  title: 'An entry of the log',
  data: { kind: 'record', model: 'activity.entry' },
  fields: {
    at: { type: 'datetime', label: 'When', readonly: true },
    who: { type: 'char', label: 'Who', readonly: true },
    action: { type: 'selection', label: 'Did', readonly: true, options: [{ value: 'created', label: 'Created' }, { value: 'updated', label: 'Updated' }, { value: 'sent', label: 'Sent' }, { value: 'archived', label: 'Archived' }] },
    name: { type: 'char', label: 'Record', readonly: true },
    details: { type: 'char', label: 'Details', readonly: true },
  },
  layout: {
    type: 'sheet',
    id: 'activity-entry',
    title: { field: 'name' },
    children: [{ type: 'section', id: 'what', children: [{ type: 'field', id: 'at', field: 'at' }, { type: 'field', id: 'who', field: 'who' }, { type: 'field', id: 'action', field: 'action' }, { type: 'field', id: 'details', field: 'details' }] }],
  },
};
