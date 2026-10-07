import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * How a dense record sheet reads, as Flectra draws one: read-only values as
 * words, stat buttons that format what they show, links with pictures and
 * colours, parts on one line, alerts holding a field's value, a statusbar
 * with a condition, keys on buttons, parts for editing or reading only, and
 * several ribbons.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');

function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  return { host, handle, form: handle.form, at: (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement };
}

const FIELDS: Page['fields'] = {
  name: { type: 'char', label: 'Name' },
  ref: { type: 'char', label: 'Reference', readonly: true },
  email: { type: 'char', label: 'Email' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'paid', label: 'Paid' }] },
  risk: { type: 'selection', label: 'Risk', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
  amount: { type: 'monetary', label: 'Amount', currency: 'EGP' },
  hours: { type: 'float', label: 'Hours', digits: [16, 2] },
  due: { type: 'date', label: 'Due' },
  partner: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
  notes: { type: 'text', label: 'Notes' },
  empty: { type: 'char', label: 'Nothing yet' },
};

const VALUES: Values = {
  name: 'INV/2026/0042',
  ref: 'A very long reference that goes on and on past the width of its box, as a display name does',
  email: 'sara@example.com',
  state: 'paid',
  risk: 'high',
  amount: 6750,
  hours: 24.8,
  due: '2026-10-13',
  partner: { id: 7, label: 'Bermuda Real Estate' },
  notes: 'Two lines\nof notes',
  empty: null,
};

function readonlyPage(look?: Page['look']): Page {
  const field = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ type: 'field' as const, id, field: name, readonly: true, ...extra });
  return {
    fieldia: '0.1',
    id: 'reading',
    data: { kind: 'record', model: 'account.move' },
    fields: FIELDS,
    layout: {
      type: 'sheet',
      id: 'root',
      title: { field: 'name' },
      children: [
        {
          type: 'section',
          id: 's',
          children: [
            { type: 'field', id: 'f-ref', field: 'ref' },
            field('f-email', 'email', { widget: 'email' }),
            field('f-state', 'state'),
            field('f-amount', 'amount'),
            field('f-hours', 'hours'),
            field('f-due', 'due'),
            field('f-partner', 'partner'),
            field('f-notes', 'notes'),
            field('f-empty', 'empty'),
            { type: 'field', id: 'f-name-edit', field: 'email' },
          ],
        },
      ],
    },
    ...(look ? { look } : {}),
  };
}

describe('read-only fields as words (look.readonlyShown)', () => {
  const words = (at: (id: string) => HTMLElement, id: string) => {
    const text = at(id).querySelector('.fd-read-text') as HTMLElement | null;
    return visible(text) ? (text as HTMLElement).textContent : null;
  };

  it('keeps the greyed boxes unless the page asks for words', () => {
    const { at } = mount(readonlyPage(), { values: VALUES });
    expect(words(at, 'f-state')).toBeNull();
    expect(visible(at('f-state').querySelector('select'))).toBe(true);
  });

  it('draws each read-only value as its words: a choice by its label, money with its currency, a date, a link by its name, long words wrapped', () => {
    const { at } = mount(readonlyPage({ readonlyShown: 'text' }), { values: VALUES });
    expect(words(at, 'f-ref')).toBe(VALUES['ref']);
    expect(words(at, 'f-state')).toBe('Paid');
    expect(visible(at('f-state').querySelector('select'))).toBe(false);
    expect(words(at, 'f-amount')).toMatch(/6,750\.00/);
    expect(words(at, 'f-amount')).toMatch(/EGP|E£|£/);
    expect(words(at, 'f-hours')).toBe('24.80');
    expect(words(at, 'f-due')).toBe('13 Oct 2026');
    expect(words(at, 'f-partner')).toBe('Bermuda Real Estate');
    expect(words(at, 'f-notes')).toBe('Two lines\nof notes');
    // An email is a link to write to, as Flectra's.
    expect(at('f-email').querySelector('.fd-read-text a')?.getAttribute('href')).toBe('mailto:sara@example.com');
    // Empty, it draws empty: no "Search…", no mask.
    expect(words(at, 'f-empty')).toBe('');
    // A field that can be edited keeps its box.
    expect(visible(at('f-name-edit').querySelector('input'))).toBe(true);
    expect(words(at, 'f-name-edit')).toBeNull();
  });

  it('follows the value as it changes, and the box comes back once the field can be edited', () => {
    const page = readonlyPage({ readonlyShown: 'text' });
    const section = (page.layout as { children: { children: { id: string; readonly?: unknown }[] }[] }).children[0];
    section.children.find((n) => n.id === 'f-state')!.readonly = "name == 'locked'";
    const { at, form } = mount(page, { values: { ...VALUES, name: 'locked' } });
    expect(words(at, 'f-state')).toBe('Paid');
    form.setValue('state', 'draft');
    expect(words(at, 'f-state')).toBe('Draft');
    form.setValue('name', 'open');
    expect(words(at, 'f-state')).toBeNull();
    expect(visible(at('f-state').querySelector('select'))).toBe(true);
  });

  it('draws a whole form locked by the Edit switch as words, and its boxes once Edit is pressed', () => {
    const { host, at } = mount(readonlyPage({ readonlyShown: 'text' }), { values: VALUES, readonly: true, editSwitch: true });
    expect(words(at, 'f-name-edit')).toBe('sara@example.com');
    (host.querySelector('.fd-edit-switch') as HTMLButtonElement).click();
    expect(words(at, 'f-name-edit')).toBeNull();
    expect(words(at, 'f-state')).toBe('Paid');
  });

  it('draws a read-only title as words too, so a long one wraps', () => {
    const page = readonlyPage({ readonlyShown: 'text' });
    (page.fields['name'] as { readonly?: boolean }).readonly = true;
    const { host } = mount(page, { values: VALUES });
    expect(host.querySelector('.fd-title [data-node="#title"] .fd-read-text')?.textContent).toBe('INV/2026/0042');
  });
});

describe('several ribbons', () => {
  const page = (): Page => ({
    fieldia: '0.1',
    id: 'case',
    data: { kind: 'record', model: 'legal.case' },
    fields: {
      name: { type: 'char', label: 'Case' },
      outcome: { type: 'selection', label: 'Outcome', options: [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }, { value: 'settled', label: 'Settled' }] },
      legacy: { type: 'boolean', label: 'Legacy' },
    },
    layout: {
      type: 'sheet',
      id: 'root',
      ribbon: { id: 'r-legacy', label: 'Legacy', tooltip: 'Made in the old app', invisible: 'not legacy' },
      ribbons: [
        { id: 'r-won', label: 'Won', tone: 'success', invisible: "outcome != 'won'" },
        { id: 'r-outcome', label: 'Closed', labelField: 'outcome', tone: 'danger', invisible: 'not outcome' },
      ],
      children: [],
    },
  });
  const shown = (host: HTMLElement) => [...host.querySelectorAll('.fd-ribbon')].filter((r) => visible(r));

  it('shows the first ribbon whose condition holds, alone in the corner', () => {
    const { host, form } = mount(page(), { values: { outcome: 'won' } });
    expect(shown(host).map((r) => r.textContent)).toEqual(['Won']);
    form.setValue('legacy', true);
    expect(shown(host).map((r) => r.textContent)).toEqual(['Legacy']);
    expect(shown(host)[0].getAttribute('title')).toBe('Made in the old app');
    form.setValue('legacy', false);
    form.setValue('outcome', null);
    expect(shown(host)).toEqual([]);
  });

  it('takes its words from a field, by the choice’s label', () => {
    const { host, form } = mount(page(), { values: { outcome: 'settled' } });
    expect(shown(host).map((r) => r.textContent)).toEqual(['Settled']);
    form.setValue('outcome', 'lost');
    expect(shown(host).map((r) => r.textContent)).toEqual(['Lost']);
    expect(shown(host)[0].className).toContain('fd-tone-danger');
  });
});

describe('alerts holding a field’s value, with buttons inside, and alerts among the parts', () => {
  const page = (children: Page['layout'] extends infer L ? unknown[] : never = []): Page => ({
    fieldia: '0.1',
    id: 'bill',
    data: { kind: 'record', model: 'account.move' },
    fields: {
      lock: { type: 'date', label: 'Lock date' },
      warning: { type: 'char', label: 'Credit warning' },
      topup: { type: 'monetary', label: 'Top-up', currency: 'EGP' },
      tz: { type: 'selection', label: 'Timezone', options: [{ value: 'Africa/Cairo', label: 'Cairo' }] },
    },
    layout: {
      type: 'sheet',
      id: 'root',
      alerts: [
        { id: 'a-lock', message: 'Entries before {lock} cannot be posted.', tone: 'warning' },
        { id: 'a-credit', message: 'Over the credit limit.', messageField: 'warning', tone: 'danger' },
        { id: 'a-dup', message: 'This bill may be a duplicate.', buttons: [{ type: 'button', id: 'b-dup', label: 'See the other bill', action: 'open_duplicate' }] },
      ],
      children: children as never,
    },
  });
  const words = (host: HTMLElement, id: string) => (host.querySelector(`[data-node="${id}"] .fd-alert-message`) as HTMLElement).textContent;

  it('shows a field’s value inside its words, as the field shows it, and follows it', () => {
    const { host, form } = mount(page(), { values: { lock: '2026-09-30' } });
    expect(words(host, 'a-lock')).toBe('Entries before 30 Sept 2026 cannot be posted.');
    form.setValue('lock', '2026-12-31');
    expect(words(host, 'a-lock')).toBe('Entries before 31 Dec 2026 cannot be posted.');
  });

  it('shows a field’s words in place of its own while the field holds any', () => {
    const { host, form } = mount(page(), { values: {} });
    expect(words(host, 'a-credit')).toBe('Over the credit limit.');
    form.setValue('warning', 'Nile Traders owes 12,000 EGP past due.');
    expect(words(host, 'a-credit')).toBe('Nile Traders owes 12,000 EGP past due.');
    form.setValue('warning', null);
    expect(words(host, 'a-credit')).toBe('Over the credit limit.');
  });

  it('has its buttons inside, after its words, as links unless styled; a press runs the button', async () => {
    const actions: string[] = [];
    const { host } = mount(page(), { values: {}, onAction: async (request) => void actions.push(request.action) });
    const button = host.querySelector('[data-node="a-dup"] [data-node="b-dup"]') as HTMLButtonElement;
    expect(button.textContent).toBe('See the other bill');
    expect(button.className).toContain('fd-button-link');
    button.click();
    await flush();
    expect(actions).toEqual(['open_duplicate']);
  });

  it('draws an alert among the parts — in a tab — with a field’s value inside', () => {
    const tabs = [{ type: 'tabs', id: 'tabs', children: [{ type: 'tab', id: 'trust', label: 'Trust', children: [{ type: 'text', id: 't-topup', text: 'Top up {topup} to reach the minimum.', style: 'alert', tone: 'warning' }] }] }];
    const { host } = mount(page(tabs), { values: { topup: 2500 } });
    const alert = host.querySelector('[data-node="t-topup"]') as HTMLElement;
    expect(alert.classList.contains('fd-alert')).toBe(true);
    expect(alert.classList.contains('fd-tone-warning')).toBe(true);
    expect(alert.getAttribute('role')).toBe('status');
    expect(alert.textContent).toMatch(/^Top up .*2,500\.00 to reach the minimum\.$/);
  });
});

describe('stat buttons that format what they show', () => {
  const page = (): Page => ({
    fieldia: '0.1',
    id: 'stats',
    data: { kind: 'record', model: 'x' },
    fields: {
      invoiced: { type: 'monetary', label: 'Invoiced', currency: 'EGP' },
      hours: { type: 'float', label: 'Hours', digits: [16, 2] },
      meeting_label: { type: 'char', label: 'Meeting label' },
      meeting_date: { type: 'date', label: 'Meeting' },
      sold: { type: 'float', label: 'Sold', digits: [16, 2] },
      uom: { type: 'many2one', label: 'Unit', relation: 'uom' },
      left: { type: 'float', label: 'Left' },
      allowed: { type: 'float', label: 'Allowed' },
      incoming: { type: 'integer', label: 'In' },
      outgoing: { type: 'integer', label: 'Out' },
      orders: { type: 'integer', label: 'Orders' },
    },
    layout: {
      type: 'sheet',
      id: 'root',
      statButtons: [
        { id: 's-money', label: 'Invoiced', field: 'invoiced', action: 'a' },
        { id: 's-hours', label: 'Hours', field: 'hours', action: 'a' },
        { id: 's-meeting', label: 'No Meeting', labelField: 'meeting_label', field: 'meeting_date', action: 'a' },
        { id: 's-sold', label: 'Sold', field: 'sold', unit: 'Units', unitField: 'uom', action: 'a' },
        { id: 's-days', label: 'Time Off', field: 'left', secondField: 'allowed', unit: 'Days', action: 'a' },
        { id: 's-moves', label: 'In', field: 'incoming', secondField: 'outgoing', secondLabel: 'Out', action: 'a' },
        { id: 's-orders', label: 'Orders', field: 'orders', action: 'a' },
      ],
      children: [],
    },
  });
  const read = (host: HTMLElement, id: string) => {
    const stat = host.querySelector(`[data-node="${id}"]`) as HTMLElement;
    return [...stat.querySelectorAll('.fd-stat-value, .fd-stat-label')].map((part) => `${part.className.replace('fd-stat-', '')}:${part.textContent}`);
  };
  const values = { invoiced: 6750, hours: 24.8, meeting_label: null, meeting_date: '2026-10-13', sold: 38, uom: { id: 1, label: 'kg' }, left: 12.5, allowed: 21, incoming: 3, outgoing: 5, orders: 1240 };

  it('writes a value as its field shows it: money with its currency, hours with their digits, a date, a count grouped', () => {
    const { host } = mount(page(), { values });
    expect(read(host, 's-money')[0]).toMatch(/^value:E£6,750\.00$|^value:EGP\s?6,750\.00$/);
    expect(read(host, 's-hours')).toEqual(['value:24.80', 'label:Hours']);
    expect(read(host, 's-orders')).toEqual(['value:1,240', 'label:Orders']);
  });

  it('takes its words from a field while it holds any', () => {
    const { host, form } = mount(page(), { values });
    expect(read(host, 's-meeting')).toEqual(['value:13 Oct 2026', 'label:No Meeting']);
    form.setValue('meeting_label', 'Next Meeting');
    expect(read(host, 's-meeting')).toEqual(['value:13 Oct 2026', 'label:Next Meeting']);
  });

  it('puts a unit after the value — a field’s, or its own while the field is empty', () => {
    const { host, form } = mount(page(), { values });
    expect(read(host, 's-sold')).toEqual(['value:38.00 kg', 'label:Sold']);
    form.setValue('uom', null);
    expect(read(host, 's-sold')).toEqual(['value:38.00 Units', 'label:Sold']);
  });

  it('shows a second value after the first, or with its own words, the two one over the other', () => {
    const { host } = mount(page(), { values });
    expect(read(host, 's-days')).toEqual(['value:12.50 / 21.00 Days', 'label:Time Off']);
    expect(read(host, 's-moves')).toEqual(['label:In', 'value:3', 'label:Out', 'value:5']);
  });
});

describe('a statusbar with a condition, time per step, folded steps, and a click that saves', () => {
  const page = (statusbar: Record<string, unknown>): Page => ({
    fieldia: '0.1',
    id: 'deal',
    data: { kind: 'record', model: 'deal' },
    fields: {
      name: { type: 'char', label: 'Name' },
      active: { type: 'boolean', label: 'Active' },
      stage_id: { type: 'many2one', label: 'Stage', relation: 'stage' },
      durations: { type: 'json', label: 'Time per stage' },
    },
    layout: { type: 'sheet', id: 'root', statusbar: { field: 'stage_id', ...statusbar } as never, children: [{ type: 'field', id: 'f-name', field: 'name' }] },
  });
  const source = () =>
    createMemoryDataSource({
      records: {
        deal: { 1: { name: 'Office fit-out', active: true, stage_id: { id: 2, label: 'Proposal' }, durations: { 1: 3 * 86400, 2: 5 * 3600 } } },
        stage: { 1: { name: 'New', fold: false }, 2: { name: 'Proposal', fold: false }, 3: { name: 'Won', fold: false }, 4: { name: 'Lost', fold: true }, 5: { name: 'On hold', fold: true } },
      },
      shows: { stage: { folded: 'fold' } },
    });
  const settle = async () => {
    for (let i = 0; i < 5; i++) await flush();
  };
  const bar = (host: HTMLElement) => host.querySelector('.fd-statusbar') as HTMLElement;
  const steps = (host: HTMLElement) => [...bar(host).querySelectorAll(':scope > li:not(.fd-step-more) > *')].map((s) => s.querySelector('span')?.textContent);

  it('hides while its condition holds', async () => {
    const { host, form } = mount(page({ invisible: 'not active' }), { dataSource: source(), recordId: 1 });
    await settle();
    expect(visible(bar(host))).toBe(true);
    form.setValue('active', false);
    expect(visible(bar(host))).toBe(false);
  });

  it('shows the time spent in each step from the record, as days, hours or minutes', async () => {
    const { host } = mount(page({ durationsField: 'durations' }), { dataSource: source(), recordId: 1 });
    await settle();
    const time = (label: string) => [...bar(host).querySelectorAll('li')].find((li) => li.textContent?.startsWith(label))?.querySelector('.fd-step-time')?.textContent;
    expect(time('New')).toBe('3d');
    expect(time('Proposal')).toBe('5h');
    expect(time('Won')).toBeUndefined();
  });

  it('folds the stages their record folds under More, unless the record stands on one', async () => {
    const { host, form } = mount(page({ fold: true, clickable: true }), { dataSource: source(), recordId: 1 });
    await settle();
    expect(steps(host)).toEqual(['New', 'Proposal', 'Won']);
    const more = bar(host).querySelector('.fd-step-more > button') as HTMLButtonElement;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    more.click();
    const menu = bar(host).querySelector('.fd-step-more [role="menu"]') as HTMLElement;
    expect(visible(menu)).toBe(true);
    expect([...menu.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent)).toEqual(['Lost', 'On hold']);
    (menu.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    expect((form.getState().values['stage_id'] as { label: string }).label).toBe('Lost');
    await settle();
    // Standing on a folded stage, it shows in the bar.
    expect(steps(host)).toEqual(['New', 'Proposal', 'Won', 'Lost']);
  });

  it('saves the record at once on a click, when told to', async () => {
    const data = source();
    const { host, form } = mount(page({ clickable: true, saves: true }), { dataSource: data, recordId: 1 });
    await settle();
    const won = [...bar(host).querySelectorAll('button')].find((b) => b.textContent === 'Won') as HTMLButtonElement;
    won.click();
    await settle();
    expect(data.calls.some((c) => c.method === 'save')).toBe(true);
    expect(form.getState().dirty).toEqual([]);
    expect((data.records['deal']['1']['stage_id'] as { label: string }).label).toBe('Won');
  });
});
