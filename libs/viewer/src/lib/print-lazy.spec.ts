import { createMemoryDataSource, type Page } from '@fieldia/core';
import { linesPart } from '@fieldia/widgets';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A record's footer on paper is its content's last part (print.ts), which the stylesheet makes the footer under every
 * sheet: still the last where the page is drawn only once its parts have come, after the footer was put in. This
 * file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const page: Page = {
  fieldia: '0.4',
  id: 'visit',
  title: 'Visit',
  print: { footer: 'Bring this sheet to room {room}.' },
  data: { kind: 'record', model: 'visit' },
  fields: {
    room: { type: 'char', label: 'Room' },
    step_ids: { type: 'one2many', label: 'Steps', relation: 'visit.step', fields: { title: { type: 'char', label: 'Title' } } },
  },
  layout: { type: 'sheet', id: 'sheet', children: [{ type: 'field', id: 'f-room', field: 'room' }, { type: 'field', id: 'f-steps', field: 'step_ids' }] },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

it('keeps the footer the content’s last part when the page is drawn once its parts come', async () => {
  expect(linesPart.loaded).toBeFalsy();
  const host = document.createElement('div');
  document.body.append(host);
  const steps = [{ key: 'a', values: { title: 'Sign in at the desk' } }];
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { visit: { 1: { room: 'B2', step_ids: steps } } } }), recordId: 1 });
  const content = host.querySelector('form.fd-form > .fd-content') as HTMLElement;
  // Waiting for the lines part: nothing of the page drawn yet, the footer in already.
  expect(content.querySelector('[data-field="step_ids"]')).toBeNull();
  expect(content.lastElementChild?.classList.contains('fd-print-end')).toBe(true);
  await handle.drawn;
  expect(content.querySelector('[data-field="step_ids"]')).not.toBeNull();
  expect(content.lastElementChild?.classList.contains('fd-print-end')).toBe(true);
  expect(content.querySelectorAll('.fd-print-end')).toHaveLength(1);
});
