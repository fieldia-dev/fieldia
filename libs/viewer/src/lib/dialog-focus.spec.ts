import { createMemoryDataSource, type Page } from '@fieldia/core';
import { openFormDialog } from './dialog';

/**
 * A dialog takes the focus to its first box a person can reach: a read-only
 * value shown as words (`readonlyShown: "text"`) keeps its box hidden, and
 * the focus goes past it, so Escape and Tab work in the dialog at once.
 */
const bug: Page = {
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'bug' },
  look: { readonlyShown: 'text' },
  fields: { number: { type: 'integer', label: 'ID', readonly: true }, title: { type: 'char', label: 'Title' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-number', field: 'number' }, { type: 'field', id: 'f-title', field: 'title' }] },
};

afterEach(() => document.body.replaceChildren());

it('takes the focus past a read-only value shown as words, to the first box that shows', async () => {
  const dataSource = createMemoryDataSource({ records: { bug: { 7: { number: 4127, title: 'Stock count is wrong' } } } });
  void openFormDialog({ page: bug, recordId: 7, title: 'Bug 4127', dataSource });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const active = document.activeElement as HTMLElement;
  expect(active.closest('[data-field]')?.getAttribute('data-field')).toBe('title');
});
