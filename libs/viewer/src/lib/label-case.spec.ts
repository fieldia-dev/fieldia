import { createMemoryDataSource, type Page } from '@fieldia/core';
import type { WidgetFactory } from '@fieldia/widgets';
import { customers, partners, until } from './test-list';
import { mountViewer, quietHint, type ViewerHandle, type ViewerOptions } from './viewer';
import { VIEWER_LABELS } from './labels';

/**
 * A page that asks for its fields' labels small inside Fieldia's sentences (`lowerLabels`): every sentence that
 * puts a label after a word of it says it so — what a refused save asks to check, a help's and a lock's names, a value
 * that waits, a link's ×, a tags' Add, a phone's country, a line's cell that waits, a field that could not be shown —
 * while one that begins its sentence ("Phone is required", "Status: …") and a name ("IBAN") stay as written. Without
 * it, every sentence reads as before.
 */

const lead = (lower?: boolean): Page =>
  ({
    fieldia: '0.13',
    id: 'lead',
    title: 'Lead',
    data: { kind: 'record', model: 'lead' },
    look: { helpShown: 'tooltip' },
    phone: { country: 'EG' },
    fields: {
      name: { type: 'char', label: 'Full name', required: true },
      iban: { type: 'char', label: 'IBAN', required: true },
      tax: { type: 'char', label: 'Tax ID', help: 'The tax registration number.' },
      budget: { type: 'float', label: 'Budget', readonly: true },
      quantity: { type: 'integer', label: 'Quantity' },
      total: { type: 'float', label: 'Total', compute: 'quantity * 2' },
      price: { type: 'float', label: 'Price' },
      country_id: { type: 'many2one', label: 'Country', relation: 'country' },
      tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
      mobile: { type: 'char', label: 'Mobile' },
      line_ids: {
        type: 'one2many',
        label: 'Order lines',
        relation: 'order.line',
        fields: { qty: { type: 'float', label: 'Quantity' }, unit: { type: 'float', label: 'Unit price' }, subtotal: { type: 'float', label: 'Subtotal', compute: 'qty * unit' } },
      },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-name', field: 'name' },
        { type: 'field', id: 'f-iban', field: 'iban' },
        { type: 'field', id: 'f-tax', field: 'tax' },
        { type: 'field', id: 'f-budget', field: 'budget', readonlyReason: 'Set by finance' },
        { type: 'field', id: 'f-quantity', field: 'quantity' },
        { type: 'field', id: 'f-total', field: 'total' },
        { type: 'field', id: 'f-price', field: 'price', widget: 'fancy' },
        { type: 'field', id: 'f-country', field: 'country_id' },
        { type: 'field', id: 'f-tags', field: 'tag_ids', options: { adder: 'button' } },
        { type: 'field', id: 'f-mobile', field: 'mobile', widget: 'phone' },
        { type: 'field', id: 'f-lines', field: 'line_ids', columns: ['qty', 'unit', 'subtotal'] },
      ],
    },
    ...(lower === undefined ? {} : { lowerLabels: lower }),
  }) as unknown as Page;

/** A widget that cannot be drawn: its field's box says so, naming it. */
const broken: Record<string, WidgetFactory> = {
  'float.fancy': () => {
    throw new Error('boom');
  },
};

let handle: ViewerHandle | null = null;
// The widget that cannot be drawn is said to the console too: kept out of the test's output.
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => {
  jest.restoreAllMocks();
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { lead: {}, country: { 1: { name: 'Egypt' } }, tag: { 1: { name: 'VIP' } } } });
  handle = mountViewer(host, { page, dataSource, widgets: broken, onError: () => undefined, values: { country_id: { id: 1, label: 'Egypt' }, line_ids: [{ key: 'l1', values: { qty: 2, unit: 10 } }] }, ...options });
  await handle.drawn;
  await handle.form.settled();
  return host;
}
const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

/** Every sentence of the lead's page that puts a label, as it reads now. */
async function sentences(host: HTMLElement) {
  type(at(host, 'f-quantity').querySelector('input') as HTMLInputElement, '1 2');
  const cell = at(host, 'f-lines').querySelector('td[data-column="qty"] input') as HTMLInputElement;
  type(cell, '2 x');
  await until(() => at(host, 'f-lines').querySelector('.fd-cell-waits'));
  [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Save')?.click();
  await handle?.form.settled();
  await until(() => host.querySelector('.fd-announce')?.textContent);
  return {
    check: host.querySelector('.fd-announce')?.textContent,
    help: at(host, 'f-tax').querySelector('[aria-label^="Help for"]')?.getAttribute('aria-label'),
    lock: at(host, 'f-budget').querySelector('button.fd-lock')?.getAttribute('aria-label'),
    waits: at(host, 'f-total').querySelector('.fd-value-waits')?.getAttribute('title'),
    clear: at(host, 'f-country').querySelector('.fd-combo-clear')?.getAttribute('aria-label'),
    adder: at(host, 'f-tags').querySelector('button')?.textContent,
    country: at(host, 'f-mobile').querySelector('.fd-phone-country')?.getAttribute('aria-label'),
    cell: (at(host, 'f-lines').querySelector('.fd-cell-waits') as HTMLElement | null)?.title,
    broken: (at(host, 'f-price').matches('.fd-broken') ? at(host, 'f-price') : at(host, 'f-price').querySelector('.fd-broken'))?.textContent,
  };
}

describe('a page that asks for its labels small inside sentences', () => {
  it('says each label after a word of its sentence small; one that begins it, and a name, as written', async () => {
    const host = await mount(lead(true));
    expect(await sentences(host)).toEqual({
      check: 'Not saved. Check: full name, IBAN, quantity, order lines',
      help: 'Help for tax ID',
      lock: 'Locked: budget',
      waits: 'Fix quantity to see total',
      clear: 'Clear country',
      adder: 'Add tags',
      country: 'Country of mobile',
      cell: 'Fix quantity to see this line’s subtotal',
      broken: 'This field could not be shown: price',
    });
    // Begun by its label, a sentence keeps it: under its box, and a heading's place.
    expect(at(host, 'f-name').querySelector('.fd-error')?.textContent).toBe('Full name is required');
    expect(at(host, 'f-iban').querySelector('.fd-error')?.textContent).toBe('IBAN is required');
  });

  it('reads as before without it, or with it off', async () => {
    for (const lower of [undefined, false]) {
      const host = await mount(lead(lower));
      expect(await sentences(host)).toEqual({
        check: 'Not saved. Check: Full name, IBAN, Quantity, Order lines',
        help: 'Help for Tax ID',
        lock: 'Locked: Budget',
        waits: 'Fix Quantity to see Total',
        clear: 'Clear Country',
        adder: 'Add Tags',
        country: 'Country of Mobile',
        cell: 'Fix Quantity to see this line’s Subtotal',
        broken: 'This field could not be shown: Price',
      });
      handle?.destroy();
      handle = null;
    }
  });

  it('keeps the quiet look’s “Add story points” as it always was, a name as written in it', () => {
    expect(quietHint('Story points', 'en')).toBe('Add story points');
    expect(quietHint('VAT number', 'en')).toBe('Add VAT number');
    expect(quietHint('WhatsApp number', 'en', VIEWER_LABELS.en)).toBe('Add WhatsApp number');
    expect(quietHint('Telefon', 'de')).toBe(VIEWER_LABELS.de.quietHint.replace('{label}', 'Telefon'));
  });
});

describe('a list and a record’s ways on a page that asks for its labels small', () => {
  const people = (lower?: boolean): Page =>
    ({
      ...customers,
      fields: { ...customers.fields, tax: { type: 'char', label: 'Tax ID' } },
      layout: { ...(customers.layout as object), columns: ['name', 'country_id', 'state', 'tax'], optionalColumns: { country_id: 'show', state: 'show', tax: 'show' }, search: 'fields', filterFields: ['state'] },
      ...(lower === undefined ? {} : { lowerLabels: lower }),
    }) as unknown as Page;
  const searching = (lower?: boolean): Page => ({ ...customers, ...(lower === undefined ? {} : { lowerLabels: lower }) }) as Page;

  async function listed(page: Page) {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, dataSource: partners() });
    await until(() => host.querySelector('.fd-list-table tbody tr'));
    return host;
  }

  it('names a column’s grip, a filter’s menu and a search by a label small; without it, as before', async () => {
    for (const [lower, grip, filter, search] of [
      [true, 'Resize tax ID', 'Filter by status', 'Search name for: egy'],
      [undefined, 'Resize Tax ID', 'Filter by Status', 'Search Name for: egy'],
    ] as const) {
      const host = await listed(people(lower));
      expect(host.querySelector('thead th[data-col="tax"] .fd-list-grip')?.getAttribute('aria-label')).toBe(grip);
      expect(host.querySelector('.fd-filter-menu')?.getAttribute('aria-label')).toBe(filter);
      handle?.destroy();
      const other = await listed(searching(lower));
      const input = other.querySelector('.fd-search-input') as HTMLInputElement;
      input.value = 'egy';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(other.querySelector('.fd-search-suggestions [role=option]')?.textContent).toBe(search);
      handle?.destroy();
      handle = null;
    }
  });

  it('says what someone else changed, and puts back each, by a label small; without it, as before', async () => {
    for (const [lower, changed, putBack] of [
      [true, 'They changed: phone.', 'Put back phone'],
      [undefined, 'They changed: Phone.', 'Put back Phone'],
    ] as const) {
      const page = { fieldia: '0.13', id: 'lead', data: { kind: 'record', model: 'lead' }, fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } }, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-phone', field: 'phone' }] }, ...(lower ? { lowerLabels: true } : {}) } as unknown as Page;
      const source = createMemoryDataSource({ records: { lead: { 1: { name: 'Villa', phone: '1' } } }, versions: { by: 'Sara' } });
      const host = document.createElement('div');
      document.body.append(host);
      handle = mountViewer(host, { page, dataSource: source, recordId: 1, confirm: async () => true });
      await handle.form.settled();
      handle.form.setValue('phone', '2');
      source.changeElsewhere('lead', 1, { phone: '3' }, { by: 'Mona' });
      expect(await handle.save()).toBe(false);
      expect(host.querySelector('.fd-conflict [role="alert"]')?.textContent).toContain(changed);
      [...host.querySelectorAll<HTMLButtonElement>('.fd-conflict button')].find((b) => b.textContent === 'Reload')?.click();
      await until(() => host.querySelector('.fd-set-aside button[aria-label^="Put back"]'));
      expect(host.querySelector('.fd-set-aside button[aria-label^="Put back"]')?.getAttribute('aria-label')).toBe(putBack);
      handle.destroy();
      handle = null;
    }
  });
});

describe('a line’s own dialog on a page that asks for its labels small', () => {
  const DAYS = { type: 'selection', label: 'Work days', multiple: true, options: ['Sun', 'Mon', 'Tue'].map((day) => ({ value: day, label: day })) };
  const order = (lower: boolean | undefined, opens?: 'record'): Page =>
    ({
      fieldia: '0.13',
      id: 'roster',
      data: { kind: 'record', model: 'roster' },
      fields: { line_ids: { type: 'one2many', label: 'Shifts', relation: 'roster.shift', fields: { days: DAYS } } },
      layout: {
        type: 'sections',
        id: 'root',
        children: [{ type: 'field', id: 'f-lines', field: 'line_ids', columns: ['days'], ...(opens ? { lineOpens: opens } : { lineForm: { children: [{ type: 'field', id: 'l-days', field: 'days', validate: [{ atLeast: 2 }] }] } }) }],
      },
      ...(lower === undefined ? {} : { lowerLabels: lower }),
    }) as unknown as Page;
  /** The app's page for a shift: what a line opens in its own way (`lineOpens: "record"`), saying so itself or not. */
  const shift = (lowerLabels?: boolean): Page =>
    ({
      fieldia: '0.13',
      id: 'shift',
      data: { kind: 'record', model: 'roster.shift' },
      fields: { days: DAYS },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 's-days', field: 'days', validate: [{ atLeast: 2 }] }] },
      ...(lowerLabels === undefined ? {} : { lowerLabels }),
    }) as unknown as Page;
  const dialog = () => document.querySelector('.fd-form-dialog') as HTMLElement;

  async function refusedIn(page: Page, options: Partial<ViewerOptions> = {}) {
    const host = document.createElement('div');
    document.body.append(host);
    const dataSource = createMemoryDataSource({ records: { roster: { 1: { line_ids: [{ key: 'k1', id: 7, values: { days: ['Sun'] } }] } }, 'roster.shift': { 7: { days: ['Sun'] } } } });
    handle = mountViewer(host, { page, dataSource, recordId: 1, ...options });
    await handle.form.settled();
    (host.querySelector('tr[data-line="k1"] .fd-line-open') as HTMLButtonElement).click();
    await until(() => dialog());
    await until(() => dialog().querySelector('.fd-form-dialog-foot button'));
    [...dialog().querySelectorAll<HTMLButtonElement>('.fd-form-dialog-foot button')].find((b) => b.textContent === 'Save & Close')?.click();
    await until(() => dialog()?.querySelector('.fd-error:not([hidden])')?.textContent);
    const words = dialog().querySelector('.fd-error:not([hidden])')?.textContent;
    handle.destroy();
    handle = null;
    document.body.replaceChildren();
    return words;
  }

  it('follows the record’s page: a line is part of its record', async () => {
    expect(await refusedIn(order(true))).toBe('Choose at least 2 for work days');
    expect(await refusedIn(order(undefined))).toBe('Choose at least 2 for Work days');
  });

  it('opened in its own page, follows the record’s unless that page says otherwise', async () => {
    expect(await refusedIn(order(true, 'record'), { pages: { 'roster.shift': shift() } })).toBe('Choose at least 2 for work days');
    expect(await refusedIn(order(true, 'record'), { pages: { 'roster.shift': shift(false) } })).toBe('Choose at least 2 for Work days');
    expect(await refusedIn(order(undefined, 'record'), { pages: { 'roster.shift': shift(true) } })).toBe('Choose at least 2 for work days');
  });
});
