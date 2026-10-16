import { createMemoryDataSource, type Line, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridApiOf, gridWidgets } from './grid';

/**
 * A block pasted on a grid's column of words that has a most (`size`, "Most characters" in the designer). The text
 * box keeps a paste that goes over whole and says at once how many characters are too many (limits.ts `counted`:
 * "5 characters too many"); the grid's paste (cell-paste.ts `readPastedCell`, case 'char') never looks at the most:
 * the cell takes 15 characters where 10 go, and the note says only "Pasted into 1 cell." Nothing is said until a
 * save is refused. The input rules §2, Grid paste: "each cell read as its column reads", what is not taken "named
 * with why (as its box says it)"; CHANGELOG 0.21.0 names "one character over its most is said as one" for the
 * grid's paste.
 */

const order: Page = {
  fieldia: '0.1',
  id: 'order',
  title: 'Sales order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'sale.order.line',
      fields: { code: { type: 'char', label: 'Code', size: 10 }, qty: { type: 'float', label: 'Quantity', digits: [8, 2] } },
    },
  },
  layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid' }] }] },
};
const lines: Line[] = [{ key: 'l1', id: 11, values: { code: 'A-1', qty: 4 } }];

let handle: ViewerHandle | null = null;
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

it('a word cell pasted past its most says how many characters are too many, never “Pasted into 1 cell.” alone', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: order, dataSource: createMemoryDataSource({ records: { 'sale.order': { 1: { line_ids: lines } } } }), recordId: 1, widgets: gridWidgets });
  await handle.form.settled();
  await frames();
  const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  gridApiOf(box)!.setFocusedCell(0, 'code');
  await frames();
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? 'ABCDEFGHIJKLMNO' : '') } });
  (document.activeElement ?? document.body).dispatchEvent(event);
  const note = box.querySelector('.fd-grid-paste-note')?.textContent ?? '';
  expect(note).toMatch(/5 characters too many/);
});
