import { createMemoryDataSource, type Page } from '@fieldia/core';
import { CARD_STYLES } from './cards-styles';
import { EDITABLE_STYLES } from './editable-styles';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor } from './viewer-parts';

/**
 * A long list keeps the browser's work to what changed (the performance audit's H1, its first step): a key typed in a
 * cell writes that cell's row only where a cell shows something new — 0.32 drew every cell of the row again on each
 * key, and the browser laid the whole table out again for it — and the box being typed in is contained, so what is
 * typed lays out that box alone; cards far out of sight skip their drawing. The browser's side (a key's layout of a
 * few objects, never the table's thousands) is held in e2e/list-contain.spec.ts.
 */

const prices: Page = {
  fieldia: '0.11',
  id: 'prices',
  title: 'Prices',
  data: { kind: 'record', model: 'service' },
  fields: {
    name: { type: 'char', label: 'Service', required: true },
    minutes: { type: 'integer', label: 'Minutes', min: 5 },
    price: { type: 'monetary', label: 'Price', currency: 'EGP', min: 0 },
    per_hour: { type: 'float', label: 'Per hour', compute: 'price / minutes * 60' },
    code: { type: 'char', label: 'Code', readonly: true },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'minutes', 'price', 'per_hour', 'code'], sort: [{ field: 'name' }], editable: true },
} as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const cell = (host: Element, id: number, column: string) => host.querySelector(`.fd-list-row[data-id="${id}"] td[data-col="${column}"]`) as HTMLTableCellElement;

describe('a key typed in a cell of an editable list', () => {
  it('writes only the cells that show something new: the one worked out from it, never the rest of its row', async () => {
    await Promise.all(partsFor(prices).map((part) => part.load()));
    const host = document.createElement('div');
    document.body.append(host);
    const records = { service: { 1: { name: 'Chemical peel', minutes: 45, price: 2200, per_hour: 2933, code: 'CP' }, 2: { name: 'Hydrafacial', minutes: 60, price: 2800, per_hour: 2800, code: 'HF' } } };
    handle = mountViewer(host, { page: prices, dataSource: createMemoryDataSource({ records, versions: true }) });
    await until(() => cell(host, 2, 'price'));
    cell(host, 2, 'price').click();
    await until(() => cell(host, 2, 'price').querySelector('input'));
    const box = cell(host, 2, 'price').querySelector('input') as HTMLInputElement;
    const written = new Set<string>();
    const watch = new MutationObserver((changes) => {
      for (const change of changes) {
        const td = (change.target as Element).closest?.('td[data-col]') ?? (change.target.parentElement as Element | null)?.closest('td[data-col]');
        if (change.type === 'childList' && td) written.add(td.getAttribute('data-col') as string);
      }
    });
    watch.observe(host, { subtree: true, childList: true });
    for (const text of ['3', '30', '300', '3000']) {
      box.value = text;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    watch.disconnect();
    // The box's own cell is the box's; its per hour, worked out from it, is drawn anew; nothing else is.
    expect([...written].filter((column) => column !== 'price')).toEqual(['per_hour']);
    expect(cell(host, 2, 'per_hour').textContent).toBe('3,000.00');
    expect(cell(host, 2, 'name').textContent).toBe('Hydrafacial');
  });
});

describe('the containment rules', () => {
  it('contain the line typed in a cell, aligned as it sits without it, and every card list’s cards', () => {
    expect(EDITABLE_STYLES).toMatch(/\.fd-list-editor :is\(input:not\(\[type\]\), input\[type="text"\][^)]*\) \{ contain: size layout; vertical-align: top; \}/);
    // Every card list's where the browser anchors the scroll (cards above drawn at their height move nothing in sight).
    expect(CARD_STYLES).toMatch(/@supports \(overflow-anchor: auto\) \{\s*\.fd-list\[data-as\] \.fd-list-row \{ content-visibility: auto; contain-intrinsic-size: auto 160px; \}/);
  });
});
