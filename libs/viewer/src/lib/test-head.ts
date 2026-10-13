import type { Page } from '@fieldia/core';

/**
 * A bug with a work item's head, for the head's and its dialog's tests: its
 * kind, the number before the title, a row with a field and "1 Comment", Save
 * and Close, Follow, Refresh and Undo, a band of State, Area and Reason, and
 * the tabs Details, History and Links in the head. Invented.
 */
export const BUG = {
  fieldia: '0.1',
  id: 'bug',
  title: 'Bug',
  data: { kind: 'record', model: 'work.item' },
  look: { skin: 'quiet', lockAt: 'value' },
  fields: {
    number: { type: 'integer', label: 'ID', readonly: true },
    work_type: { type: 'selection', label: 'Work Item Type', options: [{ value: 'bug', label: 'Bug' }, { value: 'task', label: 'Task' }] },
    title: { type: 'char', label: 'Title', required: true },
    assigned: { type: 'char', label: 'Assigned To' },
    comment_count: { type: 'integer', label: 'Comments', readonly: true },
    state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
    reason: { type: 'char', label: 'Reason', readonly: true },
    area: { type: 'char', label: 'Area' },
    notes: { type: 'text', label: 'Notes' },
    related: { type: 'many2many', label: 'Related Work', relation: 'work.item' },
    changed_by: { type: 'many2one', label: 'Changed By', relation: 'res.users', readonly: true },
    changed_date: { type: 'datetime', label: 'Changed Date', readonly: true },
    following: { type: 'boolean', label: 'Following', readonly: true },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'title', before: [{ type: 'field', id: 't-number', field: 'number', labels: 'hidden' }] },
    statusbar: { field: 'state' },
    badges: [{ id: 'old-badge', label: 'Old' }],
    head: {
      kind: { field: 'work_type', numberField: 'number', looks: { bug: { colour: '#cc293d', icon: 'bug' }, task: { colour: '#f2cb1d', icon: 'task' } } },
      meta: [
        { type: 'field', id: 'h-assigned', field: 'assigned', placeholder: 'No one selected' },
        { type: 'link', id: 'h-comments', icon: 'chat', field: 'comment_count', words: { one: 'Comment', other: 'Comments' }, target: 'g-notes' },
      ],
      actions: [
        { type: 'button', id: 'b-save-close', label: 'Save and Close', icon: 'save', primaryWhenChanged: true, steps: [{ do: 'save' }, { do: 'close' }], menu: [{ id: 'm-save', label: 'Save', steps: [{ do: 'save' }] }] },
        { type: 'button', id: 'b-follow', label: 'Follow', pressedLabel: 'Following', icon: 'eye', pressed: 'following', action: 'follow', menuIcon: 'gear', menuLabel: 'Notification settings', menu: [{ id: 'm-follow-all', label: 'All changes', action: 'follow-all' }] },
        { type: 'button', id: 'b-refresh', label: 'Refresh', icon: 'refresh', iconOnly: true, steps: [{ do: 'reload' }] },
        { type: 'button', id: 'b-undo', label: 'Revert changes', icon: 'undo', iconOnly: true, steps: [{ do: 'reset' }] },
      ],
      band: {
        tracks: ['274px', '1fr'],
        children: [
          { type: 'field', id: 'f-state', field: 'state', hotkey: 'e' },
          { type: 'field', id: 'f-area', field: 'area', hotkey: 'a' },
          { type: 'field', id: 'f-reason', field: 'reason', readonlyReason: 'Set by the workflow' },
        ],
      },
      updated: { byField: 'changed_by', atField: 'changed_date', opens: 't-history' },
    },
    toolbar: { menu: [{ id: 'm-copy', label: 'Copy link', action: 'copy-link' }] },
    children: [
      {
        type: 'tabs',
        id: 'tabs',
        place: 'head',
        children: [
          { type: 'tab', id: 't-details', label: 'Details', children: [{ type: 'section', id: 'g-notes', title: 'Notes', children: [{ type: 'field', id: 'f-notes', field: 'notes' }] }] },
          { type: 'tab', id: 't-history', label: 'History', icon: 'history', iconOnly: true, children: [{ type: 'text', id: 'x-history', text: 'Changes' }] },
          { type: 'tab', id: 't-links', label: 'Links', icon: 'link', iconOnly: true, count: 'related', children: [] },
        ],
      },
    ],
  },
  translations: { ar: { Comment: 'تعليق', Comments: 'تعليقات', Bug: 'خطأ', State: 'الحالة', 'Save and Close': 'حفظ وإغلاق', Details: 'التفاصيل', Links: 'الروابط' } },
} as unknown as Page;

export const VALUES = {
  number: 4127,
  work_type: 'bug',
  title: 'Stock count shows 12 after releasing 3 of 15',
  assigned: null,
  comment_count: 1,
  state: 'active',
  reason: 'Approved',
  area: 'Portal',
  notes: null,
  related: [],
  changed_by: { id: 1, label: 'Mona Adel' },
  changed_date: '2026-08-25T09:40:00',
  following: false,
};

