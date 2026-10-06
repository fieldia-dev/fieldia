import type { PageEvents } from '../format/actions';
import type { ButtonNode, StatButton } from '../format/layout';
import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { createMemoryDataSource } from './memory-data-source';
import type { ActionHost, OpenRequest, OpenResult } from './run';

/** For the specs of steps and moments: a page of an order, a host that records what it is asked, and a data source. */

/** An order: tabs Main and More, buttons in its header, a reference asked for once there are five or more. */
export function orderPage(extra: { on?: PageEvents; buttons?: ButtonNode[]; stats?: StatButton[] } = {}): Page {
  const page: Page = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      name: { type: 'char', label: 'Name' },
      customer_id: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
      product_id: { type: 'many2one', label: 'Product', relation: 'product' },
      quantity: { type: 'integer', label: 'Quantity' },
      price: { type: 'monetary', label: 'Price' },
      total: { type: 'monetary', label: 'Total', compute: 'quantity * price' },
      ref: { type: 'char', label: 'Reference' },
      note: { type: 'text', label: 'Note' },
      lines: {
        type: 'one2many',
        label: 'Lines',
        relation: 'sale.order.line',
        fields: { name: { type: 'char', label: 'Name' }, qty: { type: 'integer', label: 'Qty' }, product_id: { type: 'many2one', label: 'Product', relation: 'product' } },
      },
    },
    layout: {
      type: 'sheet',
      id: 'root',
      title: { field: 'name' },
      buttons: extra.buttons ?? [],
      statButtons: extra.stats ?? [],
      children: [
        {
          type: 'tabs',
          id: 'tabs',
          children: [
            {
              type: 'tab',
              id: 'main',
              label: 'Order',
              children: [
                { type: 'field', id: 'f-customer', field: 'customer_id' },
                { type: 'field', id: 'f-product', field: 'product_id' },
                { type: 'field', id: 'f-quantity', field: 'quantity' },
                { type: 'field', id: 'f-price', field: 'price' },
                { type: 'field', id: 'f-total', field: 'total' },
                { type: 'field', id: 'f-ref', field: 'ref', required: 'quantity >= 5' },
                { type: 'field', id: 'f-lines', field: 'lines' },
              ],
            },
            { type: 'tab', id: 'more', label: 'More', children: [{ type: 'field', id: 'f-note', field: 'note' }] },
          ],
        },
      ],
    },
    ...(extra.on ? { on: extra.on } : {}),
  };
  const checked = checkPage(page);
  if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return page;
}

/** A wizard of three steps: About, Usage (only once a name is given), Last; a name asked for on the first. */
export function wizardPage(on?: PageEvents): Page {
  const page: Page = {
    fieldia: '0.1',
    id: 'join',
    data: { kind: 'responses' },
    fields: {
      name: { type: 'char', label: 'Name', required: true },
      usage: { type: 'char', label: 'Usage' },
      note: { type: 'text', label: 'Note' },
    },
    layout: {
      type: 'wizard',
      id: 'root',
      children: [
        { type: 'step', id: 'about', label: 'About', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
        { type: 'step', id: 'usage', label: 'Usage', invisible: 'not name', children: [{ type: 'field', id: 'f-usage', field: 'usage' }] },
        { type: 'step', id: 'last', label: 'Last', children: [{ type: 'field', id: 'f-note', field: 'note' }] },
      ],
    },
    ...(on ? { on } : {}),
  };
  const checked = checkPage(page);
  if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return page;
}

/** A host that writes down each thing it is asked, answers questions and opened pages from the lists given, Yes and closed when they run out. */
export function recordingHost(answers: { ask?: boolean[]; open?: OpenResult[] } = {}): ActionHost & { calls: unknown[][]; opened: OpenRequest[] } {
  const calls: unknown[][] = [];
  const opened: OpenRequest[] = [];
  return {
    calls,
    opened,
    async open(request) {
      calls.push(['open', request.page]);
      opened.push(request);
      return answers.open?.shift() ?? { saved: false };
    },
    say: (message, tone) => void calls.push(['say', message, tone]),
    async ask(message) {
      calls.push(['ask', message]);
      return answers.ask?.shift() ?? true;
    },
    close: () => void calls.push(['close']),
    show: (target) => void calls.push(['show', target]),
  };
}

/** Order 7, for Nile Traders, and the partners and products it may point to. */
export function orderSource() {
  return createMemoryDataSource({
    records: {
      'sale.order': { 7: { name: 'SO007', customer_id: { id: 1, label: 'Nile Traders' }, quantity: 2, price: 10 } },
      'res.partner': { 1: { name: 'Nile Traders' }, 2: { name: 'Delta Foods' } },
      product: { 5: { name: 'Dates' } },
    },
  });
}

/** A promise and the hand that settles it, for an app that answers when the test says. */
export function later<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
