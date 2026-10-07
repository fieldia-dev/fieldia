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
  share: { type: 'float', label: 'Share' },
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
  share: 0.35,
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
            field('f-spent', 'hours', { widget: 'duration' }),
            field('f-share', 'share', { widget: 'percentage' }),
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
    // Hours and per cents read as their widgets write them.
    expect(words(at, 'f-spent')).toBe('24:48');
    expect(words(at, 'f-share')).toBe('35%');
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

  it('keeps a number’s unit, before or after it, as its box shows it', () => {
    const page = readonlyPage({ readonlyShown: 'text' });
    const section = (page.layout as { children: { children: unknown[] }[] }).children[0];
    section.children.push(
      { type: 'field', id: 'f-days', field: 'hours', readonly: true, options: { suffix: 'Days' } },
      { type: 'field', id: 'f-cost', field: 'share', readonly: true, options: { prefix: '~' } },
      { type: 'field', id: 'f-none', field: 'empty', readonly: true, options: { suffix: 'Days' } }
    );
    const { at } = mount(page, { values: VALUES });
    expect(words(at, 'f-days')).toBe('24.80 Days');
    expect(words(at, 'f-cost')).toBe('~ 0.35');
    // Empty, it draws nothing, not the unit alone.
    expect(words(at, 'f-none')).toBe('');
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
  const page = (children: unknown[] = []): Page => ({
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

  it('saves what the server worked out from the step, as Flectra saves once its onchange is back', async () => {
    const data = createMemoryDataSource({
      records: {
        deal: { 1: { name: 'Office fit-out', active: true, stage_id: { id: 2, label: 'Proposal' }, durations: {} } },
        stage: { 1: { name: 'New' }, 2: { name: 'Proposal' }, 3: { name: 'Won' } },
      },
      // The server renames the deal as its stage changes, a moment later.
      onchange: { deal: { stage_id: (values) => ({ name: `Office fit-out (${(values['stage_id'] as { label: string }).label})` }) } },
      delayMs: 20,
    });
    const { host } = mount(page({ clickable: true, saves: true }), { dataSource: data, recordId: 1 });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const won = [...bar(host).querySelectorAll('button')].find((b) => b.textContent === 'Won') as HTMLButtonElement;
    won.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(data.records['deal']['1']['name']).toBe('Office fit-out (Won)');
  });
});

describe('keys on buttons', () => {
  const page = (): Page => ({
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: { state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'sale', label: 'Sale' }] }, note: { type: 'char', label: 'Note' } },
    layout: {
      type: 'sheet',
      id: 'root',
      buttons: [
        { type: 'button', id: 'b-confirm', label: 'Confirm', action: 'confirm', hotkey: 'v', invisible: "state != 'draft'" },
        { type: 'button', id: 'b-cancel', label: 'Cancel', action: 'cancel', hotkey: 'v' },
        { type: 'button', id: 'b-send', label: 'Send by email', action: 'send', hotkey: 'shift+g' },
      ],
      children: [{ type: 'field', id: 'f-note', field: 'note' }],
    },
  });
  const alt = (target: EventTarget, code: string, extra: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { code, key: code.slice(-1).toLowerCase(), altKey: true, bubbles: true, cancelable: true, ...extra });
    target.dispatchEvent(event);
    return event;
  };

  it('presses the first shown button with the key, with Alt, from a field or from the page', async () => {
    const actions: string[] = [];
    const { host, form } = mount(page(), { values: { state: 'draft' }, onAction: async (request) => void actions.push(request.action) });
    const note = host.querySelector('[data-node="f-note"] input') as HTMLInputElement;
    note.focus();
    expect(alt(note, 'KeyV').defaultPrevented).toBe(true);
    await flush();
    expect(actions).toEqual(['confirm']);
    form.setValue('state', 'sale');
    alt(document.body, 'KeyV');
    await flush();
    expect(actions).toEqual(['confirm', 'cancel']);
    alt(document.body, 'KeyG', { shiftKey: true });
    await flush();
    expect(actions).toEqual(['confirm', 'cancel', 'send']);
    // Without Alt, or with Ctrl too, it is the field's key.
    expect(alt(note, 'KeyV', { altKey: false }).defaultPrevented).toBe(false);
    expect(alt(note, 'KeyV', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(alt(note, 'KeyQ').defaultPrevented).toBe(false);
  });

  it('says its key in its tooltip and to a screen reader, and shows it while Alt is held', () => {
    const { host } = mount(page(), { values: { state: 'draft' } });
    const send = host.querySelector('[data-node="b-send"]') as HTMLButtonElement;
    expect(send.getAttribute('aria-keyshortcuts')).toBe('Alt+Shift+G');
    expect(send.title).toBe('Send by email (Alt+Shift+G)');
    const root = host.querySelector('.fd-form') as HTMLElement;
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true, bubbles: true }));
    expect(root.hasAttribute('data-hotkeys')).toBe(true);
    expect(send.querySelector('.fd-hotkey')?.textContent).toBe('⇧G');
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }));
    expect(root.hasAttribute('data-hotkeys')).toBe(false);
  });

  it('leaves the key to a question asked over the page', async () => {
    const actions: string[] = [];
    const confirm = page();
    (confirm.layout as { buttons: { confirm?: string }[] }).buttons[2].confirm = 'Send it now?';
    const { host } = mount(confirm, { values: { state: 'draft' }, onAction: async (request) => void actions.push(request.action) });
    alt(document.body, 'KeyG', { shiftKey: true });
    await flush();
    expect(host.querySelector('.fd-dialog')).not.toBeNull();
    alt(document.body, 'KeyV');
    await flush();
    expect(actions).toEqual([]);
  });
});

describe('keys on a dialog’s own buttons', () => {
  it('press the dialog’s button, not the page’s under it', async () => {
    const wizard: Page = {
      fieldia: '0.1',
      id: 'lost',
      data: { kind: 'record', model: 'crm.lead.lost' },
      fields: { reason: { type: 'char', label: 'Reason' } },
      layout: {
        type: 'sections',
        id: 'root',
        children: [{ type: 'field', id: 'f-reason', field: 'reason' }],
        footer: [
          { type: 'button', id: 'w-lost', label: 'Mark as Lost', style: 'primary', hotkey: 'q', action: 'mark_lost' },
          { type: 'button', id: 'w-cancel', label: 'Cancel', hotkey: 'x', steps: [{ do: 'close' }] },
        ],
      },
    };
    const page: Page = {
      fieldia: '0.1',
      id: 'lead',
      data: { kind: 'record', model: 'crm.lead' },
      fields: { name: { type: 'char', label: 'Name' } },
      layout: { type: 'sheet', id: 'root', buttons: [{ type: 'button', id: 'b-lost', label: 'Lost', hotkey: 'q', steps: [{ do: 'open', page: 'lost', as: 'dialog' }] }], children: [] },
    };
    const actions: string[] = [];
    const { host } = mount(page, { pages: { lost: wizard }, onAction: async (request) => void actions.push(request.action) });
    (host.querySelector('[data-node="b-lost"]') as HTMLButtonElement).click();
    await flush();
    const dialog = document.querySelector('.fd-form-dialog') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[data-node="w-lost"]')?.getAttribute('aria-keyshortcuts')).toBe('Alt+Q');
    const reason = dialog.querySelector('input') as HTMLInputElement;
    reason.focus();
    reason.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', altKey: true, bubbles: true, cancelable: true }));
    await flush();
    expect(actions).toEqual(['mark_lost']);
  });
});

describe('parts shown only while the record is edited, or only while it is read', () => {
  const page = (): Page => ({
    fieldia: '0.1',
    id: 'contact',
    data: { kind: 'record', model: 'res.partner' },
    fields: { name: { type: 'char', label: 'Name' } },
    layout: {
      type: 'sheet',
      id: 'root',
      children: [
        { type: 'field', id: 'f-name', field: 'name' },
        { type: 'button', id: 'b-company', label: 'Create company', action: 'create_company', invisible: 'not editing' },
        { type: 'text', id: 't-read', text: 'Press Edit to change this contact.', style: 'note', invisible: 'editing' },
      ],
    },
  });

  it('follows the Edit switch: edit-only parts while editing, read-only parts while reading', async () => {
    const { host, at } = mount(page(), { values: { name: 'Mona' }, readonly: true, editSwitch: true });
    expect(visible(at('b-company'))).toBe(false);
    expect(visible(at('t-read'))).toBe(true);
    (host.querySelector('.fd-edit-switch') as HTMLButtonElement).click();
    await flush();
    expect(visible(at('b-company'))).toBe(true);
    expect(visible(at('t-read'))).toBe(false);
  });

  it('follows the app locking the form, and a form always edited shows its edit-only parts', () => {
    const { at, handle } = mount(page(), { values: { name: 'Mona' } });
    expect(visible(at('b-company'))).toBe(true);
    handle.setReadonly(true);
    expect(visible(at('b-company'))).toBe(false);
    expect(visible(at('t-read'))).toBe(true);
  });
});

describe('a link read as words, with its picture and its address', () => {
  it('draws the picture before the name and the record’s lines under it, from the data source', async () => {
    const page: Page = {
      fieldia: '0.1',
      id: 'order',
      data: { kind: 'record', model: 'sale.order' },
      look: { readonlyShown: 'text' },
      fields: { partner_id: { type: 'many2one', label: 'Customer', relation: 'partner', readonly: true }, user_id: { type: 'many2one', label: 'Salesperson', relation: 'user' } },
      layout: { type: 'sheet', id: 'root', children: [
        { type: 'field', id: 'f-partner', field: 'partner_id', options: { details: true, open: false } },
        { type: 'field', id: 'f-user', field: 'user_id', options: { avatar: true } },
      ] },
    };
    const dataSource = createMemoryDataSource({
      records: {
        'sale.order': { 1: { partner_id: { id: 1, label: 'Nile Traders' }, user_id: { id: 5, label: 'Mona Adel' } } },
        partner: { 1: { name: 'Nile Traders', street: '12 Nile St', city: 'Cairo' } },
        user: { 5: { name: 'Mona Adel', image: 'data:image/png;base64,AAAA' } },
      },
      shows: { partner: { details: ['street', 'city'] }, user: { avatar: 'image' } },
    });
    const { at } = mount(page, { dataSource, recordId: 1 });
    for (let i = 0; i < 4; i++) await flush();
    expect(at('f-partner').querySelector('.fd-read-text')?.textContent).toBe('Nile Traders12 Nile StCairo');
    expect(at('f-partner').querySelector('.fd-read-link')).toBeNull();
    expect((at('f-user').querySelector('.fd-combo .fd-link-avatar img') as HTMLImageElement).src).toBe('data:image/png;base64,AAAA');
  });
});

describe('parts on one line, and a label over the title', () => {
  const page = (): Page => ({
    fieldia: '0.1',
    id: 'survey',
    data: { kind: 'record', model: 'survey' },
    fields: {
      title: { type: 'char', label: 'Title' },
      limited: { type: 'boolean', label: 'Limit attempts' },
      attempts: { type: 'integer', label: 'Attempts' },
      price: { type: 'monetary', label: 'Price', currency: 'EGP' },
    },
    layout: {
      type: 'sheet',
      id: 'root',
      title: { field: 'title', label: 'Survey Title' },
      children: [
        {
          type: 'section',
          id: 'limit',
          title: 'Limit attempts',
          style: 'inline',
          children: [
            { type: 'field', id: 'f-limited', field: 'limited' },
            { type: 'text', id: 't-to', text: 'to', invisible: 'not limited' },
            { type: 'field', id: 'f-attempts', field: 'attempts', invisible: 'not limited' },
            { type: 'text', id: 't-attempts', text: 'attempts', invisible: 'not limited' },
          ],
        },
        { type: 'section', id: 'price-row', title: 'Price', style: 'inline', children: [
          { type: 'field', id: 'f-price', field: 'price' },
          { type: 'button', id: 'b-update', label: 'Update prices', style: 'link', action: 'update' },
        ] },
      ],
    },
  });

  it('draws its parts on one line after its title, each field named for a screen reader though its label is not shown', () => {
    const { at } = mount(page(), { values: { limited: true, attempts: 3 } });
    const line = at('limit');
    expect(line.getAttribute('data-style')).toBe('inline');
    expect(line.querySelector(':scope > .fd-label')?.textContent).toBe('Limit attempts');
    const row = line.querySelector(':scope > .fd-oneline-row') as HTMLElement;
    expect([...row.children].map((c) => c.getAttribute('data-node'))).toEqual(['f-limited', 't-to', 'f-attempts', 't-attempts']);
    expect(row.querySelector('[data-node="t-to"]')?.tagName).toBe('SPAN');
    const attempts = row.querySelector('[data-node="f-attempts"] input') as HTMLInputElement;
    expect(attempts.labels?.[0]?.textContent).toBe('Attempts');
  });

  it('shows and hides its parts by their own conditions, and puts a button beside a field', () => {
    const { at, form } = mount(page(), { values: { limited: false } });
    expect(visible(at('t-to'))).toBe(false);
    form.setValue('limited', true);
    expect(visible(at('t-to'))).toBe(true);
    expect(at('price-row').querySelector('.fd-oneline-row [data-node="b-update"]')).not.toBeNull();
  });

  it('puts the title’s own label over it', () => {
    const { host } = mount(page(), { values: {} });
    const label = host.querySelector('.fd-title .fd-title-label') as HTMLLabelElement;
    expect(label.textContent).toBe('Survey Title');
    expect(label.htmlFor).toBe((host.querySelector('[data-node="#title"] input') as HTMLInputElement).id);
  });
});

describe('a stat button’s help', () => {
  it('is its tooltip and its accessible description, as Flectra’s help= on a smart button', () => {
    const page = {
      fieldia: '0.1',
      id: 'transfer',
      data: { kind: 'record', model: 'stock.picking' },
      fields: { name: { type: 'char', label: 'Reference' } },
      layout: {
        type: 'sheet',
        id: 'sheet',
        statButtons: [
          { id: 'operations', label: 'Operations', icon: 'list', action: 'action_view_moves', help: 'List view of operations' },
          { id: 'returns', label: 'Returns', action: 'action_returns' },
        ],
        children: [{ type: 'field', id: 'f-name', field: 'name' }],
      },
    } as unknown as Page;
    const { at } = mount(page);
    const operations = at('operations');
    expect(operations.title).toBe('List view of operations');
    const described = document.getElementById(operations.getAttribute('aria-describedby') as string);
    expect(described?.textContent).toBe('List view of operations');
    // The help describes it; its name stays its words.
    expect(operations.textContent).not.toContain('List view');
    expect(at('returns').hasAttribute('title')).toBe(false);
    expect(at('returns').hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('words in an empty box chosen by a condition', () => {
  it('follow the record, in the title and in a field, as Flectra’s company and person names', () => {
    const page = {
      fieldia: '0.1',
      id: 'contact',
      data: { kind: 'record', model: 'res.partner' },
      fields: { name: { type: 'char', label: 'Name' }, is_company: { type: 'boolean', label: 'Company' }, parent_id: { type: 'many2one', label: 'Company', relation: 'res.partner' } },
      layout: {
        type: 'sheet',
        id: 'sheet',
        title: { field: 'name', placeholder: 'e.g. Brandom Freeman', placeholderWhen: [{ when: 'is_company', text: 'e.g. Lumber Inc' }] },
        children: [
          { type: 'field', id: 'f-company', field: 'is_company' },
          { type: 'field', id: 'f-parent', field: 'parent_id', placeholderWhen: [{ when: 'is_company', text: 'Parent company…' }] },
        ],
      },
    } as unknown as Page;
    const { host, form } = mount(page);
    const title = host.querySelector('[data-node="#title"] input') as HTMLInputElement;
    const parent = host.querySelector('[data-node="f-parent"] input') as HTMLInputElement;
    const drawn = parent.placeholder;
    expect(title.placeholder).toBe('e.g. Brandom Freeman');
    form.setValue('is_company', true);
    expect(title.placeholder).toBe('e.g. Lumber Inc');
    expect(parent.placeholder).toBe('Parent company…');
    form.setValue('is_company', false);
    expect(title.placeholder).toBe('e.g. Brandom Freeman');
    expect(parent.placeholder).toBe(drawn);
  });
});
