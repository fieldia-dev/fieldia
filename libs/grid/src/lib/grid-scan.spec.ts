import { createMemoryDataSource, type Line, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { scanPart } from '@fieldia/widgets';
import { gridApiOf, gridWidgets } from './grid';

/**
 * A grid's column scanned into with the camera (`cells.<column>.options.scan`): its cell's editor has the Scan button;
 * the grid stops editing a cell as the camera's sheet takes the focus, and the sheet reads on into that line all the
 * same, through the line's form, which outlives its editor.
 */

const page: Page = {
  fieldia: '0.7',
  id: 'stock',
  data: { kind: 'record', model: 'stock.move' },
  fields: {
    line_ids: { type: 'one2many', label: 'Lines', relation: 'stock.move.line', fields: { lot: { type: 'char', label: 'Lot' }, qty: { type: 'float', label: 'Quantity' } } },
  },
  layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid', cells: { lot: { options: { scan: true } } } }] }] },
} as unknown as Page;
const lines: Line[] = [{ key: 'l1', id: 11, values: { lot: null, qty: 4 } }];

let handle: ViewerHandle | null = null;
let frames: { rawValue: string; format: string }[][] = [];
const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(ready: () => unknown, ms = 4000): Promise<boolean> {
  const end = Date.now() + ms;
  while (!ready() && Date.now() < end) await wait(10);
  return !!ready();
}

beforeEach(async () => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) }, configurable: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
  frames = [];
  (await scanPart.load()).useCodeReader({ detect: async () => frames.shift() ?? [] });
});
afterEach(async () => {
  handle?.destroy();
  handle = null;
  (await scanPart.load()).useCodeReader(null);
  document.body.replaceChildren();
  jest.restoreAllMocks();
});

it("reads into a grid's cell, the sheet outliving the editor the grid closed as it took the focus", async () => {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'stock.move': { 1: { line_ids: lines } } } }), recordId: 1, widgets: gridWidgets });
  await handle.form.settled();
  await wait(50);
  const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  const api = gridApiOf(box);
  api?.startEditingCell({ rowIndex: 0, colKey: 'lot' });
  await wait(50);
  const scan = box.querySelector<HTMLButtonElement>('.fd-grid-editor .fd-scan-button');
  expect(scan?.getAttribute('aria-label')).toBe('Scan a code into Lot');
  scan?.click();
  expect(document.querySelector('.fd-scan-sheet')).not.toBeNull();
  // The grid stops editing the cell that lost the focus.
  api?.stopEditing();
  await wait(50);
  expect(box.querySelector('.fd-grid-editor')).toBeNull();
  expect(document.querySelector('.fd-scan-sheet')).not.toBeNull();
  frames.push([{ rawValue: 'LOT-2207', format: 'code_128' }]);
  const form = handle.form;
  expect(await until(() => (form.getState().values['line_ids'] as Line[])[0].values['lot'] === 'LOT-2207')).toBe(true);
  expect(await until(() => !document.querySelector('.fd-scan-sheet'))).toBe(true);
});
