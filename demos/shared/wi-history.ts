import { createMemoryChatter, type ChatterMessage, type Person } from '@fieldia/chatter';
import type { Page, Values } from '@fieldia/core';

/**
 * A bug's History tab, tried on its own: the page `wi-history`, its record,
 * and the history its chatter keeps — how its State moved and why, then each
 * change with its before and after. The backlog demo puts the same History
 * in its work item's popup. Every name, title and number is invented.
 */

const mona: Person = { id: 31, name: 'Mona Adel' };
const salma: Person = { id: 33, name: 'Salma Nabil' };
const omar: Person = { id: 34, name: 'Omar Hany' };
/** Karim has a picture of his own: a drawn one, kept in the page. */
const karim: Person = {
  id: 32,
  name: 'Karim Fathy',
  avatar:
    'data:image/svg+xml;base64,' +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#c9d6df"/><circle cx="32" cy="25" r="12" fill="#8d5b3f"/><path d="M20 22c1-9 23-11 24 0-5-4-18-4-24 0z" fill="#2b2b2b"/><path d="M8 64c2-14 13-20 24-20s22 6 24 20z" fill="#3d5a80"/></svg>'
    ),
};

/** A moment of 2026, in the reader's own time: the list shows its day, the change its day and hour. */
const at = (day: string, time = '10:00') => `2026-${day}T${time}:00`;
const rank = (author: Person, id: number, day: string, to: string, from: string, time?: string): ChatterMessage => ({
  id,
  kind: 'event',
  author,
  date: at(day, time),
  body: '',
  tracking: [{ field: 'stack_rank', label: 'Stack Rank', from, to }],
});

/** The bug's history, newest first, as a tracker keeps it. */
export const WI_HISTORY_MESSAGES: ChatterMessage[] = [
  rank(mona, 412, '08-25', '1999964430', '1999976256', '16:05'),
  rank(mona, 411, '08-23', '1999976256', '1999978790', '11:20'),
  rank(mona, 410, '08-20', '1999978790', '1999979534', '09:42'),
  { id: 409, kind: 'event', author: mona, date: at('07-27', '14:31'), body: '', tracking: [{ field: 'iteration', label: 'Iteration Path', from: 'Portal\\Sprint 13', to: 'Portal\\Sprint 14' }] },
  rank(mona, 408, '07-22', '1999979534', '1999987060', '12:59'),
  {
    id: 407,
    kind: 'event',
    author: karim,
    date: at('07-08', '15:12'),
    body: '',
    tracking: [
      { field: 'state', label: 'State', from: 'New', to: 'Active' },
      { field: 'reason', label: 'Reason', from: 'Investigation Complete', to: 'Approved' },
      { field: 'activated_by', label: 'Activated By', from: null, to: 'Karim Fathy' },
    ],
  },
  {
    id: 406,
    kind: 'event',
    author: karim,
    date: at('07-08', '15:10'),
    body: '',
    tracking: [{ field: 'title', label: 'Title', from: 'Stock count wrong after a partial release', to: 'Stock count shows 12 after releasing 3 of 15 items to order SO-2088' }],
  },
  rank(mona, 405, '06-20', '1999987060', '1999990112', '08:47'),
  {
    id: 404,
    kind: 'message',
    author: karim,
    date: at('06-14', '17:03'),
    body: '<p>I need the night shift’s warehouse log before I can reproduce it; the scanner there is offline until Sunday.</p>',
  },
  {
    id: 403,
    kind: 'event',
    author: karim,
    date: at('06-14', '16:58'),
    body: '',
    tracking: [
      { field: 'state', label: 'State', from: 'Active', to: 'New' },
      { field: 'reason', label: 'Reason', from: 'Approved', to: 'Investigation Complete' },
    ],
  },
  {
    id: 402,
    kind: 'event',
    author: mona,
    date: at('06-11', '09:30'),
    body: '',
    tracking: [
      { field: 'state', label: 'State', from: 'New', to: 'Active' },
      { field: 'reason', label: 'Reason', from: 'New', to: 'Approved' },
    ],
  },
  {
    id: 401,
    kind: 'event',
    author: mona,
    date: at('06-10', '11:15'),
    body: '',
    tracking: [
      { field: 'title', label: 'Title', from: null, to: 'Stock count wrong after a partial release' },
      { field: 'state', label: 'State', from: null, to: 'New' },
      { field: 'reason', label: 'Reason', from: null, to: 'New' },
      { field: 'area', label: 'Area Path', from: null, to: 'Portal' },
      { field: 'iteration', label: 'Iteration Path', from: null, to: 'Portal\\Sprint 13' },
    ],
  },
];

/** The chatter the History tab reads: the bug's history, kept in memory. */
export function wiHistoryChatter() {
  return createMemoryChatter({ me: salma, people: [salma, mona, karim, omar], records: { 'wi.history:1': { messages: WI_HISTORY_MESSAGES } } });
}

/** The bug as it stands after its history. */
export function wiHistoryRecord(): Values {
  return {
    number: 4127,
    title: 'Stock count shows 12 after releasing 3 of 15 items to order SO-2088',
    state: 'active',
    reason: 'approved',
    iteration: 'Portal\\Sprint 14',
    stack_rank: 1999964430,
  };
}

/** The bug's page: its state and reason over a Details tab and the History tab, which an app's history slot fills. */
export const wiHistoryPage: Page = {
  fieldia: '0.1',
  id: 'wi-history',
  title: 'Bug history',
  data: { kind: 'record', model: 'wi.history' },
  look: { theme: 'fluent', skin: 'quiet', density: 'compact' },
  fields: {
    number: { type: 'integer', label: 'ID', readonly: true },
    title: { type: 'char', label: 'Title', required: true },
    state: {
      type: 'selection',
      label: 'State',
      options: [
        { value: 'new', label: 'New' },
        { value: 'active', label: 'Active' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    reason: {
      type: 'selection',
      label: 'Reason',
      options: [
        { value: 'new', label: 'New' },
        { value: 'approved', label: 'Approved' },
        { value: 'investigated', label: 'Investigation Complete' },
        { value: 'fixed', label: 'Fixed' },
      ],
    },
    iteration: { type: 'char', label: 'Iteration' },
    stack_rank: { type: 'integer', label: 'Stack Rank' },
  },
  layout: {
    type: 'sheet',
    id: 'bug',
    title: { field: 'title', before: [{ type: 'field', id: 't-number', field: 'number', labels: 'hidden' }] },
    children: [
      {
        type: 'section',
        id: 'band',
        quiet: true,
        labels: 'beside',
        labelWidth: 76,
        columns: 2,
        children: [
          {
            type: 'field',
            id: 'f-state',
            field: 'state',
            widget: 'dot',
            // The colours a tracker gives its states, and the tones of a dot that does not take colours: the History tab's dots read them from here.
            options: { label: true, colours: { new: '#b2b2b2', active: '#007acc', resolved: '#ff9d00', closed: '#339933' }, tones: { new: 'muted', active: 'info', resolved: 'warning', closed: 'success' } },
          },
          { type: 'field', id: 'f-reason', field: 'reason', readonly: true, readonlyReason: 'Set by the workflow when the State changes' },
        ],
      },
      {
        type: 'tabs',
        id: 'wi-tabs',
        children: [
          {
            type: 'tab',
            id: 't-details',
            label: 'Details',
            children: [
              { type: 'section', id: 'planning', columns: 2, children: [{ type: 'field', id: 'f-iteration', field: 'iteration' }, { type: 'field', id: 'f-rank', field: 'stack_rank' }] },
            ],
          },
          { type: 'tab', id: 't-history', label: 'History', icon: 'history', children: [{ type: 'slot', id: 's-history', name: 'history' }] },
        ],
      },
    ],
  },
  translations: {
    ar: {
      'Bug history': 'سجل الخلل',
      ID: 'المعرّف',
      Title: 'العنوان',
      State: 'الحالة',
      New: 'جديد',
      Active: 'نشط',
      Resolved: 'محلول',
      Closed: 'مغلق',
      Reason: 'السبب',
      Approved: 'معتمد',
      'Investigation Complete': 'اكتمل التحقيق',
      Fixed: 'تم الإصلاح',
      Iteration: 'الدورة',
      'Stack Rank': 'ترتيب الأولوية',
      'Set by the workflow when the State changes': 'يحدده سير العمل عند تغيّر الحالة',
      Details: 'التفاصيل',
      History: 'السجل',
    },
    de: {
      'Bug history': 'Fehlerverlauf',
      ID: 'ID',
      Title: 'Titel',
      State: 'Status',
      New: 'Neu',
      Active: 'Aktiv',
      Resolved: 'Behoben',
      Closed: 'Geschlossen',
      Reason: 'Grund',
      Approved: 'Genehmigt',
      'Investigation Complete': 'Untersuchung abgeschlossen',
      Fixed: 'Korrigiert',
      Iteration: 'Iteration',
      'Stack Rank': 'Rangfolge',
      'Set by the workflow when the State changes': 'Wird vom Workflow gesetzt, wenn sich der Status ändert',
      Details: 'Details',
      History: 'Verlauf',
    },
    fr: {
      'Bug history': 'Historique du bogue',
      ID: 'ID',
      Title: 'Titre',
      State: 'État',
      New: 'Nouveau',
      Active: 'Actif',
      Resolved: 'Résolu',
      Closed: 'Fermé',
      Reason: 'Raison',
      Approved: 'Approuvé',
      'Investigation Complete': 'Enquête terminée',
      Fixed: 'Corrigé',
      Iteration: 'Itération',
      'Stack Rank': 'Rang',
      'Set by the workflow when the State changes': 'Défini par le flux de travail quand l’état change',
      Details: 'Détails',
      History: 'Historique',
    },
  },
};
