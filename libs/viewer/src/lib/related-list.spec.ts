import { createMemoryDataSource, type ActionRequest, type DataSource, type ListRequest, type ListResult, type OpenRequest, type OpenResult, type Page, type Values } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';
import { cardsPart, listPart, partsFor } from './viewer-parts';

/**
 * A related list inside a record: a customer's invoices, a page at a time, searched, counted, each opening in a
 * dialog; New making one with the customer filled in; View all opening the app's list of them as an `open` step does.
 * Nothing before the first save; the records of a record no longer shown are drawn in none.
 */

const invoices = {
  type: 'related',
  id: 'invoices',
  title: 'Invoices',
  model: 'invoice',
  field: 'partner_id',
  fields: {
    name: { type: 'char', label: 'Number' },
    amount: { type: 'integer', label: 'Total' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
  },
  columns: ['name', 'amount', 'state'],
  cells: { state: { widget: 'dot', options: { tones: { posted: 'success' } } } },
  sort: [{ field: 'name' }],
  limit: 2,
};

const customer = (related: Record<string, unknown> = {}): Page => ({
  fieldia: '0.3',
  id: 'customer',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, children: [{ ...invoices, ...related } as unknown as Page['fields'][string] & { type: 'related'; id: string }] },
}) as unknown as Page;

/** The page the app gives for an invoice: what a row opens and New makes. */
const invoicePage = {
  fieldia: '0.3',
  id: 'invoice',
  title: 'Invoice',
  data: { kind: 'record', model: 'invoice' },
  fields: { name: { type: 'char', label: 'Number' }, amount: { type: 'integer', label: 'Total' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-amount', field: 'amount' }, { type: 'field', id: 'f-partner', field: 'partner_id' }] },
} as unknown as Page;

const records = () => ({
  partner: { 1: { name: 'Acme' }, 2: { name: 'Globex' } },
  invoice: {
    11: { name: 'INV/1', amount: 100, state: 'posted', partner_id: { id: 1, label: 'Acme' } },
    12: { name: 'INV/2', amount: 50, state: 'draft', partner_id: { id: 1, label: 'Acme' } },
    13: { name: 'INV/3', amount: 70, state: 'posted', partner_id: { id: 2, label: 'Globex' } },
    14: { name: 'INV/4', amount: 20, state: 'posted', partner_id: { id: 1, label: 'Acme' } },
  },
});

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: customer(), dataSource: createMemoryDataSource({ records: records() }), recordId: 1, ...options });
  handles.push(handle);
  await handle.drawn;
  await handle.form.settled();
  return { host, handle };
}

const part = (host: HTMLElement) => host.querySelector('[data-node="invoices"]') as HTMLElement;
const rows = (host: HTMLElement) => [...part(host).querySelectorAll('.fd-list-row')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join(' | '));
const count = (host: HTMLElement) => part(host).querySelector('.fd-related-count') as HTMLElement;
const named = (host: HTMLElement, words: string) => [...part(host).querySelectorAll('button')].find((b) => b.textContent === words) as HTMLButtonElement | undefined;
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const dialogButton = (name: string) => [...(dialog()?.querySelectorAll('.fd-form-dialog-foot button') ?? [])].find((b) => b.textContent === name) as HTMLButtonElement;
function typeIn(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('a related list inside a record', () => {
  it('lists the records that point at this one, a page at a time, in its order, counted, drawn as a list draws them', async () => {
    const { host } = await mount();
    await until(() => rows(host).length === 2);
    expect(part(host).getAttribute('role')).toBe('group');
    // Its id names its box alone: the list inside has one of its own.
    expect(host.querySelectorAll('[data-node="invoices"]')).toHaveLength(1);
    expect(part(host).querySelector('.fd-related-title')?.textContent).toContain('Invoices');
    expect(rows(host)).toEqual(['INV/1 | 100 | Posted', 'INV/2 | 50 | Draft']);
    // Its cells as the list's: a state's dot in its tone.
    expect(part(host).querySelector('.fd-list-row .fd-list-dot')?.getAttribute('data-tone')).toBe('success');
    // How many, beside its title, and read out with it; never Globex's.
    expect(count(host).hidden).toBe(false);
    expect(count(host).textContent).toBe('3');
    expect(part(host).getAttribute('aria-label')).toBe('Invoices, 3');
    // Past a page: its pager and its search, a box alone with no menu of filters, groups and favourites.
    expect(part(host).querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 3');
    expect((part(host).querySelector('.fd-search') as HTMLElement).hidden).toBe(false);
    expect(part(host).querySelector('.fd-search-toggle')).toBeNull();
    expect(part(host).querySelector('.fd-list-checkbox')).toBeNull();
    (part(host).querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await until(() => rows(host)[0] === 'INV/4 | 20 | Posted');
    // Its headers put it in order, as a list's.
    (part(host).querySelector('th[data-field="amount"] button') as HTMLButtonElement).click();
    await until(() => rows(host)[0] === 'INV/4 | 20 | Posted' && rows(host)[1] === 'INV/2 | 50 | Draft');
  });

  it('searches its records alone, its count staying theirs; within a page, no search and no pager', async () => {
    const { host } = await mount();
    await until(() => rows(host).length === 2);
    const box = part(host).querySelector('.fd-search-input') as HTMLInputElement;
    typeIn(box, 'INV/4');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await until(() => rows(host).length === 1);
    expect(rows(host)).toEqual(['INV/4 | 20 | Posted']);
    expect(count(host).textContent).toBe('3');
    // A search that finds nothing says so as a list does.
    (part(host).querySelector('.fd-facet-remove') as HTMLButtonElement).click();
    typeIn(box, 'INV/9');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await until(() => rows(host).length === 0);
    expect((part(host).querySelector('.fd-list-empty') as HTMLElement).textContent).toBe('No records match.');
    // Globex's one invoice fits a page: neither its search nor its pager shows.
    const other = await mount({ recordId: 2 });
    await until(() => rows(other.host).length === 1);
    expect((part(other.host).querySelector('.fd-list-bar') as HTMLElement).hidden).toBe(true);
  });

  it('before the first save says nothing points at it yet, with no New; once saved, lists its own and offers New', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host, handle } = await mount({ recordId: null, dataSource, pages: { invoice: invoicePage } });
    expect((part(host).querySelector('.fd-related-note') as HTMLElement).hidden).toBe(false);
    expect(part(host).querySelector('.fd-related-note')?.textContent).toBe('Nothing here until this record is saved.');
    expect(named(host, 'New')?.hidden).toBe(true);
    expect(part(host).querySelector('.fd-list')).toBeNull();
    // Its title says what is not there yet; with none, no empty heading over the words.
    expect((part(host).querySelector('.fd-related-head') as HTMLElement).hidden).toBe(false);
    expect(dataSource.calls.filter((call) => call.method === 'list')).toEqual([]);
    handle.form.setValue('name', 'Initech');
    expect(await handle.save()).toBe(true);
    await until(() => part(host).querySelector('.fd-list-empty:not([hidden])'));
    expect((part(host).querySelector('.fd-related-note') as HTMLElement).hidden).toBe(true);
    expect(part(host).querySelector('.fd-list-empty')?.textContent).toBe('None yet.');
    expect(count(host).textContent).toBe('0');
    expect(named(host, 'New')?.hidden).toBe(false);
    expect(named(host, 'New')?.getAttribute('aria-label')).toBe('New in Invoices');
  });

  it('New makes one with this record filled in, in a dialog of the model’s page, and lists it once saved', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host } = await mount({ dataSource, pages: { invoice: invoicePage } });
    await until(() => rows(host).length === 2);
    named(host, 'New')?.click();
    await until(() => dialog());
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('New in Invoices');
    expect((dialog()?.querySelector('[data-node="f-partner"] input') as HTMLInputElement).value).toBe('Acme');
    typeIn(dialog()?.querySelector('[data-node="f-name"] input') as HTMLInputElement, 'INV/0');
    dialogButton('Save & Close').click();
    await until(() => !dialog() && count(host).textContent === '4');
    expect(rows(host)[0]).toBe('INV/0 |  | ');
    const made = Object.values(dataSource.records['invoice']).find((values) => values['name'] === 'INV/0') as Values;
    expect(made['partner_id']).toEqual({ id: 1, label: 'Acme' });
  });

  it('opens a row’s record in a dialog named by it, then asks again', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host } = await mount({ dataSource, pages: { invoice: invoicePage } });
    await until(() => rows(host).length === 2);
    (part(host).querySelector('.fd-list-row') as HTMLElement).click();
    await until(() => dialog());
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('INV/1');
    typeIn(dialog()?.querySelector('[data-node="f-amount"] input') as HTMLInputElement, '120');
    dialogButton('Save & Close').click();
    await until(() => !dialog() && rows(host)[0] === 'INV/1 | 120 | Posted');
  });

  it('View all opens the app’s list of them, this record’s alone, as an open step does — the app’s own way first', async () => {
    const asked: OpenRequest[] = [];
    const onOpen = (request: OpenRequest): Promise<OpenResult> => {
      asked.push(request);
      return Promise.resolve({ saved: false });
    };
    const { host } = await mount({ page: customer({ viewAll: { page: 'invoices', as: 'page' } }), onOpen });
    await until(() => rows(host).length === 2);
    const all = named(host, 'View all') as HTMLButtonElement;
    expect(all.getAttribute('aria-label')).toBe('View all Invoices');
    all.click();
    await until(() => asked.length === 1);
    expect(asked[0]).toEqual({ page: 'invoices', as: 'page', filter: [{ field: 'partner_id', op: '=', value: 1 }] });
    // In the viewer's own dialog, a list has nothing to save: Close alone.
    const own = await mount({ page: customer({ viewAll: { page: 'all' } }), pages: { all: { ...invoicePage, id: 'all', layout: { type: 'list', id: 'all-list', columns: ['name'] } } as unknown as Page } });
    await until(() => rows(own.host).length === 2);
    named(own.host, 'View all')?.click();
    await until(() => dialog()?.querySelector('.fd-list-row'));
    const foot = [...(dialog()?.querySelectorAll('.fd-form-dialog-foot button') ?? [])].filter((b) => !(b as HTMLElement).hidden).map((b) => b.textContent);
    expect(foot).toEqual(['Close']);
    dialogButton('Close').click();
    await until(() => !dialog());
    // A page the app does not have is said.
    const missing = await mount({ page: customer({ viewAll: { page: 'nowhere' } }), pages: {} });
    await until(() => rows(missing.host).length === 2);
    named(missing.host, 'View all')?.click();
    await until(() => missing.host.querySelector('.fd-say')?.textContent?.includes('nowhere'));
  });

  it('View all in this page’s place: the app’s list of them kept to this record’s, and Back to the record', async () => {
    const list = {
      fieldia: '0.3',
      id: 'invoices',
      title: 'All invoices',
      data: { kind: 'record', model: 'invoice' },
      fields: invoices.fields,
      layout: { type: 'list', id: 'all', columns: ['name', 'partner_id'], sort: [{ field: 'name' }] },
    } as unknown as Page;
    const { host } = await mount({ page: customer({ viewAll: { page: 'invoices', as: 'page' } }), pages: { invoices: list } });
    await until(() => rows(host).length === 2);
    named(host, 'View all')?.click();
    await until(() => host.querySelectorAll('[data-node="all"] .fd-list-row').length === 3);
    expect([...host.querySelectorAll('[data-node="all"] .fd-list-row td:nth-child(2)')].map((td) => td.textContent)).toEqual(['INV/1', 'INV/2', 'INV/4']);
    (host.querySelector('.fd-back') as HTMLButtonElement).click();
    await until(() => !host.querySelector('[data-node="all"]') && rows(host).length === 2);
  });

  it('asks nothing while hidden by its rule, and asks once it shows', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host, handle } = await mount({ dataSource, page: customer({ invisible: "name == 'Acme'" }) });
    expect(part(host).hidden).toBe(true);
    expect(dataSource.calls.filter((call) => call.method === 'list')).toEqual([]);
    handle.form.setValue('name', 'Acme Ltd');
    await until(() => rows(host).length === 2);
    expect(part(host).hidden).toBe(false);
  });

  it('offers no New, no View all and no row to open where the app gives no page for them', async () => {
    const { host } = await mount();
    await until(() => rows(host).length === 2);
    expect(named(host, 'New')).toBeUndefined();
    expect(named(host, 'View all')).toBeUndefined();
    expect(part(host).querySelector('.fd-list-openable')).toBeNull();
    // Without New for a related list that says create: false, the page given or not.
    const plain = await mount({ page: customer({ create: false }), pages: { invoice: invoicePage } });
    await until(() => rows(plain.host).length === 2);
    expect(named(plain.host, 'New')).toBeUndefined();
  });

  it('is not shown where the data source cannot list records', async () => {
    const memory = createMemoryDataSource({ records: records() });
    const { list: _list, ...noList } = memory;
    const { host } = await mount({ dataSource: noList as DataSource });
    expect(part(host).hidden).toBe(true);
    expect(part(host).children.length).toBe(0);
  });

  it('never draws the records of a record no longer shown: asked for Acme, answered while Globex is on its way', async () => {
    const memory = createMemoryDataSource({ records: records() });
    const waiting: { request: ListRequest; go: () => void }[] = [];
    let loading: Promise<void> | null = null;
    const dataSource: DataSource = {
      ...memory,
      load: async (request) => {
        if (loading) await loading;
        return memory.load!(request);
      },
      list: (request) =>
        new Promise<ListResult>((resolve) => {
          waiting.push({ request, go: () => void memory.list!(request).then(resolve) });
        }),
    };
    const { host, handle } = await mount({ dataSource });
    await until(() => waiting.length === 1);
    // Acme's invoices asked for; the person moves to Globex, whose values are on their way as Acme's answer comes.
    let loaded!: () => void;
    loading = new Promise((resolve) => (loaded = resolve));
    const moved = handle.form.openRecord(2);
    await until(() => handle.form.getState().status === 'loading');
    waiting[0].go();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rows(host)).toEqual([]);
    expect(count(host).hidden).toBe(true);
    // Asked for Globex only once its values have come.
    expect(waiting.length).toBe(1);
    loaded();
    await moved;
    await until(() => waiting.length === 2);
    expect(waiting[1].request.filter).toEqual([{ field: 'partner_id', op: '=', value: 2 }]);
    waiting[1].go();
    await until(() => rows(host).length === 1);
    expect(rows(host)).toEqual(['INV/3 | 70 | Posted']);
    expect(count(host).textContent).toBe('1');
  });

  it('asks again when the record is loaded again or its changes discarded mid-answer, and never for a record on its way', async () => {
    const memory = createMemoryDataSource({ records: records() });
    const asked: ListRequest[] = [];
    let gate: Promise<void> | null = null;
    const dataSource: DataSource = {
      ...memory,
      list: async (request) => {
        asked.push(request);
        const answer = await memory.list!(request);
        if (gate) await gate;
        return answer;
      },
    };
    const { host, handle } = await mount({ dataSource });
    await until(() => rows(host).length === 2);
    expect(asked.length).toBe(1);
    // A reload of this record: asked again (a record loaded again is shown anew).
    await handle.reload();
    await until(() => asked.length === 2);
    // An answer held while the person's Discard lets the record's changes go: dropped, and asked once more.
    let open!: () => void;
    gate = new Promise((resolve) => (open = resolve));
    (part(host).querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await until(() => asked.length === 3);
    handle.form.setValue('name', 'Acme Ltd');
    handle.form.reset();
    gate = null;
    open();
    await until(() => asked.length === 4);
    await until(() => rows(host).length > 0);
  });

  it('in a tab, asks for its records once its tab is shown', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const page = customer();
    const sheet = page.layout as Extract<Page['layout'], { type: 'sheet' }>;
    sheet.children = [
      {
        type: 'tabs',
        id: 'tabs',
        children: [
          { type: 'tab', id: 'tab-main', label: 'Main', children: [{ type: 'text', id: 'hello', text: 'Hello' }] },
          { type: 'tab', id: 'tab-invoices', label: 'Invoices', children: [{ ...invoices, title: undefined } as unknown as (typeof sheet.children)[number]] },
        ],
      },
    ];
    const { host } = await mount({ page, dataSource });
    expect(dataSource.calls.filter((call) => call.method === 'list')).toEqual([]);
    (host.querySelector('[data-node="tab-invoices"]') as HTMLButtonElement).click();
    await until(() => rows(host).length === 2);
    // No title: no heading to name it by, its count in its pager.
    expect(part(host).querySelector('.fd-related-head')?.hasAttribute('hidden')).toBe(true);
  });
});

describe('a related list’s rows', () => {
  const rules = {
    rowTones: [{ tone: 'success', when: "state == 'posted'" }],
    rowBold: 'amount >= user.id',
    rowButtons: [{ type: 'button', id: 'remind', label: 'Remind', action: 'remind', invisible: "state != 'posted'" }],
  };

  it('are toned, bold and given their buttons, as a list’s, each read on its own record — its fields and the person', async () => {
    const asked: ActionRequest[] = [];
    const dataSource = createMemoryDataSource({ records: records() });
    const { host } = await mount({ page: customer(rules), dataSource, user: { id: 60, name: 'Mona' }, onAction: (request) => void asked.push(request) });
    await until(() => rows(host).length === 2);
    const [first, second] = [...part(host).querySelectorAll<HTMLElement>('.fd-list-row')];
    // INV/1, posted, 100; INV/2, a draft of 50: toned by its state, bold by its amount against the person's id.
    expect([first.dataset['tone'], first.hasAttribute('data-bold')]).toEqual(['success', true]);
    expect([second.dataset['tone'], second.hasAttribute('data-bold')]).toEqual([undefined, false]);
    expect(first.querySelector('[data-action="remind"]')).not.toBeNull();
    expect(second.querySelector('[data-action="remind"]')).toBeNull();
    // Pressed: run with that one invoice, on the customer shown; then its records asked again.
    const before = dataSource.calls.filter((call) => call.method === 'list').length;
    (first.querySelector('[data-action="remind"]') as HTMLButtonElement).click();
    await until(() => asked.length === 1);
    expect(asked[0]).toEqual(expect.objectContaining({ id: 'remind', action: 'remind', recordId: 1, recordIds: [11] }));
    await until(() => dataSource.calls.filter((call) => call.method === 'list').length > before);
  });

  it('show a row’s button only to the roles it names, as a list’s', async () => {
    const roled = { ...rules, rowButtons: [{ ...rules.rowButtons[0], roles: ['accountant'] }] };
    const { host } = await mount({ page: customer(roled), user: { id: 60, name: 'Mona', roles: ['sales'] } });
    await until(() => rows(host).length === 2);
    expect(part(host).querySelector('[data-action="remind"]')).toBeNull();
  });
});

describe('a related list on paper', () => {
  it('says how many of how many it shows where they run past a page, and nothing where they fit', async () => {
    const { host } = await mount();
    await until(() => rows(host).length === 2);
    const shown = () => part(host).querySelector('.fd-list-shown') as HTMLElement;
    expect([shown().hidden, shown().textContent]).toEqual([false, '2 of 3']);
    (part(host).querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await until(() => rows(host).length === 1);
    expect(shown().textContent).toBe('1 of 3');
    const fits = await mount({ page: customer({ limit: 5 }) });
    await until(() => rows(fits.host).length === 3);
    expect((part(fits.host).querySelector('.fd-list-shown') as HTMLElement).hidden).toBe(true);
  });
});

describe('a related list on a phone', () => {
  /** The list's width told as the browser tells it, at the next frame as a list draws it. */
  function sized() {
    let told: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
    const was = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
        told = callback;
      }
      observe() {}
      disconnect() {}
    };
    return {
      async width(width: number) {
        told!([{ contentRect: { width } }]);
        await new Promise((done) => requestAnimationFrame(done));
      },
      restore: () => ((window as unknown as { ResizeObserver?: unknown }).ResizeObserver = was),
    };
  }
  const phoneCard = { card: { title: 'name', status: 'state', fields: ['amount'] }, cells: { state: { widget: 'badge', options: { tones: { posted: 'success' } } } } };

  it('asks for the cards part where it has cards, as a list does', () => {
    expect(partsFor(customer())).toEqual([listPart]);
    expect(partsFor(customer(phoneCard))).toEqual([listPart, cardsPart]);
  });

  it('draws its rows as cards, as a list’s: its title, its status a pill in its tone, its lines — a card opening its record', async () => {
    const size = sized();
    try {
      const { host } = await mount({ page: customer(phoneCard), pages: { invoice: invoicePage } });
      await until(() => rows(host).length === 2);
      const list = part(host).querySelector('.fd-list') as HTMLElement;
      expect(list.hasAttribute('data-as')).toBe(false);
      await size.width(390);
      expect(list.dataset['as']).toBe('cards');
      const cards = [...part(host).querySelectorAll('.fd-list-card')];
      expect(cards.map((card) => card.querySelector('.fd-list-card-title')?.textContent)).toEqual(['INV/1', 'INV/2']);
      // Its status as its column draws it, a pill in its tone; its line labelled by its own records' field.
      const pill = cards[0].querySelector('.fd-list-card-head .fd-value-badge') as HTMLElement;
      expect([pill.textContent, pill.dataset['tone']]).toEqual(['Posted', 'success']);
      expect(cards[0].querySelector('.fd-list-card-lines [data-field="amount"]')?.textContent).toBe('Total100');
      // A card is its row: pressed, its record opens in a dialog of the model's page.
      (cards[0].closest('.fd-list-row') as HTMLElement).click();
      await until(() => dialog());
      expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('INV/1');
      // Wide again: its table.
      await size.width(900);
      expect(list.hasAttribute('data-as')).toBe(false);
    } finally {
      size.restore();
    }
  });
});
