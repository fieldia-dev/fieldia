import { createMemoryDataSource, type Page } from '@fieldia/core';
import { openFormDialog } from './dialog';

/**
 * Escape in a quiet field puts back what it held as it was entered. A dialog
 * takes the focus to its first field at once, before its record has come:
 * what the field held is then what the record brought, so Escape changes
 * nothing and goes on to the dialog, which closes.
 */
const bug: Page = {
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'bug' },
  look: { skin: 'quiet' },
  fields: { title: { type: 'char', label: 'Title' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-title', field: 'title' }] },
};

afterEach(() => document.body.replaceChildren());

it('keeps the record’s value when Escape is pressed in a field entered before the record came, and the dialog closes', async () => {
  const dataSource = createMemoryDataSource({ records: { bug: { 7: { title: 'Stock count is wrong' } } }, delayMs: 5 });
  const closed = openFormDialog({ page: bug, recordId: 7, title: 'Bug 7', dataSource });
  const input = () => document.querySelector<HTMLInputElement>('[data-field="title"] input') as HTMLInputElement;
  expect(document.activeElement).toBe(input());
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(input().value).toBe('Stock count is wrong');
  input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const result = await closed;
  expect(result.saved).toBe(false);
  expect(result.values['title']).toBe('Stock count is wrong');
});
