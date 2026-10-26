import type { Line, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridWidgets } from './grid';

/**
 * A grid's lines as cards — drawn for a phone, there on a desktop too, out of sight — drawn again only where what a card
 * shows changed (0.35.1): the owner's walk of 0.35 found a key in a 200-line invoice's header drawing the 200 cards of its
 * lines again, and every other key, wherever it was typed — 1,008 elements written a key, where the 3-line invoice wrote 32.
 */

const page = {
  fieldia: '0.13',
  id: 'invoice',
  data: { kind: 'record', model: 'account.move' },
  fields: {
    ref: { type: 'char', label: 'Payment reference' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    line_ids: {
      type: 'one2many',
      label: 'Lines',
      relation: 'account.move.line',
      fields: { name: { type: 'char', label: 'Label' }, qty: { type: 'float', label: 'Quantity' }, price: { type: 'float', label: 'Price' } },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-ref', field: 'ref' },
      { type: 'field', id: 'f-state', field: 'state' },
      { type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid', cards: 'narrow', totals: ['qty'], cells: { price: { readonly: "parent.state == 'posted'" } }, rowTones: [{ tone: 'danger', when: 'qty > 100' }] },
    ],
  },
} as unknown as Page;

const lines = (n: number): Line[] => Array.from({ length: n }, (_, i) => ({ key: `l${i + 1}`, id: i + 1, values: { name: `Item ${i + 1}`, qty: (i % 5) + 1, price: 10 + i } }));

let handle: ViewerHandle | null = null;
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(n: number) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, widgets: gridWidgets, values: { ref: 'INV/1', state: 'draft', line_ids: lines(n) } as never });
  await frames();
  const grid = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  return { grid, form: handle.form };
}

/** The nodes written under `root` by `act`: added, taken away, attributes and words. */
async function written(root: Element, act: () => void): Promise<number> {
  let count = 0;
  const watch = new MutationObserver((records) => {
    for (const record of records) count += record.type === 'childList' ? record.addedNodes.length + record.removedNodes.length : 1;
  });
  watch.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  act();
  await frames();
  for (const record of watch.takeRecords()) count += record.type === 'childList' ? record.addedNodes.length + record.removedNodes.length : 1;
  watch.disconnect();
  return count;
}

const cards = (grid: Element) => [...grid.querySelectorAll<HTMLElement>('.fd-line-cards > .fd-line-card')];

describe('a grid’s cards, drawn again only where what they show changed', () => {
  it('a key in the record’s header draws none of its 200 lines’ cards', async () => {
    const { grid, form } = await mount(200);
    expect(cards(grid)).toHaveLength(200);
    const before = cards(grid);
    const list = grid.querySelector('.fd-line-cards') as HTMLElement;
    expect(await written(list, () => form.setValue('ref', 'INV/1 a'))).toBe(0);
    expect(cards(grid).every((card, at) => card === before[at])).toBe(true);
  });

  it('a change in a line draws its own card again, in its place, and the total under them', async () => {
    const { grid, form } = await mount(200);
    const before = cards(grid);
    const list = grid.querySelector('.fd-line-cards') as HTMLElement;
    const count = await written(list, () => form.updateLine('line_ids', 'l120', 'qty', 7));
    const after = cards(grid);
    expect(after.filter((card, at) => card !== before[at]).map((card) => card.dataset['line'])).toEqual(['l120']);
    expect(after[119].querySelectorAll('dd')[0]?.textContent).toBe('7.00');
    expect(grid.querySelector('.fd-line-cards-total')?.textContent).toBe(`Quantity: ${(lines(200).reduce((sum, line) => sum + Number(line.values['qty']), 0) - 5 + 7).toFixed(2)}`);
    // The card out and in, and the total's words: 0.35.0 wrote the 200 cards again.
    expect(count).toBeLessThanOrEqual(4);
  });

  it('draws a card again where what its line’s rules read of the record changes, and its tone with its line', async () => {
    const { grid, form } = await mount(3);
    const before = cards(grid);
    // Each line's rules read the record's state (its price locked once posted): each line's state is new, its card drawn again.
    form.setValue('state', 'posted');
    await frames();
    const posted = cards(grid);
    expect(posted.every((card, at) => card !== before[at])).toBe(true);
    form.updateLine('line_ids', 'l2', 'qty', 150);
    await frames();
    expect(cards(grid)[1].dataset['tone']).toBe('danger');
    expect(cards(grid)[0]).toBe(posted[0]);
    expect(cards(grid)[2]).toBe(posted[2]);
  });
});
