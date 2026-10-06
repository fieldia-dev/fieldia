import { createMemoryDataSource, type ActionStep, type ButtonNode, type LayoutNode, type OpenRequest, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';
import { openFormPanel } from './dialog';

/**
 * The viewer is its form's host: what a page's steps ask of the screen — a
 * page opened in a dialog, a panel or in its place, words said, a question
 * asked, a tab shown — it does itself, unless the app does it its own way.
 */

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Wait, up to two seconds, for something that comes after an answer. */
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

const field = (id: string, name: string): LayoutNode => ({ type: 'field', id, field: name });
const button = (id: string, label: string, steps: ActionStep[], more: Partial<ButtonNode> = {}): ButtonNode => ({ type: 'button', id, label, steps, ...more });

/** An order taken on the phone: who calls, their customer record, a product and its price; a note on a tab of its own. */
function order(buttons: ButtonNode[] = [], on?: Page['on']): Page {
  return {
    fieldia: '0.1',
    id: 'order',
    title: 'Quick order',
    data: { kind: 'record', model: 'shop.order' },
    fields: {
      caller: { type: 'char', label: 'Caller' },
      customer_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
      product: { type: 'char', label: 'Product', required: true },
      price: { type: 'float', label: 'Price' },
      note: { type: 'text', label: 'Note' },
    },
    layout: {
      type: 'tabs',
      id: 'root',
      children: [
        { type: 'tab', id: 'main', label: 'Order', children: [field('f-caller', 'caller'), field('f-customer', 'customer_id'), field('f-product', 'product'), field('f-price', 'price'), ...buttons] },
        { type: 'tab', id: 'more', label: 'More', children: [field('f-note', 'note')] },
      ],
    },
    ...(on ? { on } : {}),
  };
}

/** A small page for a new customer, its name first; its own buttons for the steps inside it. */
function newCustomer(buttons: ButtonNode[] = []): Page {
  return {
    fieldia: '0.1',
    id: 'new-customer',
    title: 'New customer',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name', required: true }, email: { type: 'char', label: 'Email' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [field('c-name', 'name'), field('c-email', 'email'), ...buttons] }] },
  };
}

let handle: ViewerHandle | null = null;
let host: HTMLElement;
beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  handle?.destroy();
  handle = null;
  jest.useRealTimers();
});

function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource(), ...options });
  return handle;
}

const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const press = (label: string, within: ParentNode = host) =>
  ([...within.querySelectorAll('button')].find((b) => b.textContent?.trim() === label && visible(b)) as HTMLButtonElement).click();
const box = (id: string, within: ParentNode = document) => within.querySelector(`[data-node="${id}"] input, [data-node="${id}"] textarea`) as HTMLInputElement;
function typeIn(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const toasts = () => [...document.querySelectorAll<HTMLElement>('.fd-say')];
const question = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const answer = (label: 'OK' | 'Cancel') => press(label, question() as HTMLElement);
const panel = () => document.querySelector<HTMLElement>('.fd-form-panel');
const dialog = () => document.querySelector<HTMLElement>('.fd-form-dialog:not(.fd-form-panel)');

describe('words said: a toast', () => {
  it('says each in its tone, in a polite live region, one under another, each with a × that dismisses it', async () => {
    const viewer = mount(order());
    await viewer.run([
      { do: 'say', message: 'Customer added', tone: 'success' },
      { do: 'say', message: 'Check the price' , tone: 'warning' },
    ]);
    expect(toasts().map((t) => [t.textContent?.replace('×', ''), t.getAttribute('data-tone')])).toEqual([
      ['Customer added', 'success'],
      ['Check the price', 'warning'],
    ]);
    const region = toasts()[0].parentElement as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('role')).toBe('status');
    // Inside the form, so it wears its skin, scheme and direction.
    expect(viewer.element.contains(region)).toBe(true);
    const dismiss = toasts()[0].querySelector('button') as HTMLButtonElement;
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss');
    dismiss.click();
    expect(toasts().map((t) => t.getAttribute('data-tone'))).toEqual(['warning']);
  });

  it('goes by itself after a moment, but not while the pointer or the focus is on it', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
    const viewer = mount(order());
    void viewer.run([{ do: 'say', message: 'Order sent', tone: 'success' }]);
    await Promise.resolve();
    await Promise.resolve();
    expect(toasts()).toHaveLength(1);
    toasts()[0].dispatchEvent(new MouseEvent('mouseenter'));
    jest.advanceTimersByTime(20000);
    expect(toasts()).toHaveLength(1);
    toasts()[0].dispatchEvent(new MouseEvent('mouseleave'));
    jest.advanceTimersByTime(20000);
    expect(toasts()).toHaveLength(0);
  });

  it('says what the app answers, and a stop’s words as a warning', async () => {
    const viewer = mount(order(), {
      onAction: ({ action }) => (action === 'price' ? { values: { price: 380 }, say: { message: 'In stock: 12', tone: 'info' } } : { stop: 'Out of stock' }),
    });
    await viewer.run([{ do: 'call', action: 'price' }]);
    expect(viewer.form.getState().values['price']).toBe(380);
    const result = await viewer.run([{ do: 'call', action: 'reserve' }, { do: 'say', message: 'never' }]);
    expect(result).toMatchObject({ done: false, reason: 'app', message: 'Out of stock' });
    expect(toasts().map((t) => [t.firstChild?.textContent, t.getAttribute('data-tone')])).toEqual([
      ['In stock: 12', 'info'],
      ['Out of stock', 'warning'],
    ]);
  });

  it('leaves the words to the app when it gives a say of its own, and the rest to the viewer', async () => {
    const said: string[] = [];
    const viewer = mount(order(), { host: { say: (message) => void said.push(message) } });
    const asking = viewer.run([{ do: 'say', message: 'Hello' }, { do: 'ask', message: 'Go on?' }]);
    await flush();
    expect(said).toEqual(['Hello']);
    expect(toasts()).toEqual([]);
    expect(question()?.textContent).toContain('Go on?');
    answer('OK');
    expect((await asking).done).toBe(true);
  });
});

describe('a question asked: the viewer’s own box', () => {
  it('asks Yes or No in a box over the form: OK goes on, Cancel stops', async () => {
    const viewer = mount(order());
    const asked = viewer.run([{ do: 'ask', message: 'Send the order?' }]);
    await flush();
    expect(question()?.textContent).toContain('Send the order?');
    expect(question()?.getAttribute('aria-modal')).toBe('true');
    answer('OK');
    expect(await asked).toEqual({ done: true });
    const refused = viewer.run([{ do: 'ask', message: 'Send the order?' }, { do: 'say', message: 'never' }]);
    await flush();
    answer('Cancel');
    expect(await refused).toMatchObject({ done: false, reason: 'no' });
    expect(toasts()).toEqual([]);
  });

  it('asks through the app’s own confirm when it gives one', async () => {
    const viewer = mount(order(), { confirm: async (message) => message === 'Yes?' });
    expect(await viewer.run([{ do: 'ask', message: 'Yes?' }])).toEqual({ done: true });
    expect((await viewer.run([{ do: 'ask', message: 'No?' }])).reason).toBe('no');
    expect(question()).toBeNull();
  });

  it('asks a button’s confirmation once, before its steps', async () => {
    const pressed: string[] = [];
    const viewer = mount(order([button('send', 'Send', [{ do: 'say', message: 'Sent' }], { confirm: 'Send it now?', action: 'send' })]), {
      onAction: ({ action }) => void pressed.push(action),
    });
    press('Send');
    await flush();
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    answer('OK');
    await viewer.form.settled();
    await flush();
    expect(question()).toBeNull();
    expect(pressed).toEqual(['send']);
    press('Send');
    await flush();
    answer('Cancel');
    await viewer.form.settled();
    expect(question()).toBeNull();
    expect(pressed).toEqual(['send']);
  });

  it('keeps Escape to itself: answered No, the panel under it stays open', async () => {
    const result = openFormPanel({
      page: newCustomer([button('ask', 'Ask', [{ do: 'ask', message: 'Really?' }])]),
      dataSource: createMemoryDataSource(),
      title: 'New customer',
    });
    await flush();
    press('Ask', panel() as HTMLElement);
    await flush();
    const ok = [...(question() as HTMLElement).querySelectorAll('button')].pop() as HTMLButtonElement;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    ok.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(question()).toBeNull();
    expect(panel()).not.toBeNull();
    // The next Escape is the panel's.
    (panel() as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect((await result).saved).toBe(false);
  });
});

describe('a tab shown', () => {
  it('switches the tabs for a step, and runs the tab’s show steps, as for a tab a person picks', async () => {
    const viewer = mount(order([], { show: { more: [{ do: 'say', message: 'Anything else?' }] } }));
    const tab = (id: string) => host.querySelector(`.fd-tab[data-node="${id}"]`) as HTMLButtonElement;
    expect(await viewer.run([{ do: 'goTo', target: 'more' }])).toEqual({ done: true });
    expect(tab('more').getAttribute('aria-selected')).toBe('true');
    await viewer.form.settled();
    expect(toasts().map((t) => t.firstChild?.textContent)).toEqual(['Anything else?']);
    tab('main').click();
    tab('more').click();
    await viewer.form.settled();
    expect(toasts()).toHaveLength(2);
  });

  it('stops, saying so, for a tab not on the page', async () => {
    const viewer = mount(order());
    // Past the page's own check, as an app's own steps may be.
    const result = await viewer.run([{ do: 'goTo', target: 'elsewhere' }]);
    expect(result).toMatchObject({ done: false, reason: 'cannot' });
  });
});

describe('a button pressed', () => {
  it('is busy while its steps run: marked so, and not run twice', async () => {
    let release!: () => void;
    const calls: string[] = [];
    const viewer = mount(order([button('price', 'Price it', [{ do: 'call', action: 'price' }])]), {
      onAction: ({ action }) => {
        calls.push(action);
        return new Promise<void>((done) => (release = done));
      },
    });
    const pressed = host.querySelector('[data-node="price"]') as HTMLButtonElement;
    pressed.click();
    await flush();
    expect(pressed.getAttribute('aria-busy')).toBe('true');
    expect(pressed.getAttribute('aria-disabled')).toBe('true');
    pressed.click();
    await flush();
    expect(calls).toEqual(['price']);
    release();
    await viewer.form.settled();
    await flush();
    expect(pressed.hasAttribute('aria-busy')).toBe(false);
    expect(pressed.hasAttribute('aria-disabled')).toBe(false);
  });

  it('takes the focus to the first problem when its check stops it', async () => {
    const viewer = mount(order([button('send', 'Send', [{ do: 'check' }, { do: 'save' }])]));
    press('Send');
    await viewer.form.settled();
    await flush();
    expect(document.activeElement).toBe(box('f-product', host));
  });

  it('says why when a step cannot run here', async () => {
    const viewer = mount(order([button('open', 'Open', [{ do: 'open', page: 'ghost', as: 'panel' }])]), { pages: {} });
    press('Open');
    await viewer.form.settled();
    await flush();
    expect(toasts().map((t) => [t.firstChild?.textContent, t.getAttribute('data-tone')])).toEqual([['The page “ghost” cannot be found.', 'warning']]);
  });

  it('runs a stat button’s steps, and a list’s, with the records chosen', async () => {
    const viewer = mount({
      fieldia: '0.1',
      id: 'customer',
      data: { kind: 'record', model: 'partner' },
      fields: { name: { type: 'char', label: 'Name' }, orders: { type: 'integer', label: 'Orders' } },
      layout: {
        type: 'sheet',
        id: 'root',
        statButtons: [{ id: 'orders', label: 'Orders', field: 'orders', steps: [{ do: 'say', message: 'Four orders' }] }],
        children: [field('n', 'name')],
      },
    });
    (host.querySelector('[data-node="orders"]') as HTMLButtonElement).click();
    await viewer.form.settled();
    expect(toasts().map((t) => t.firstChild?.textContent)).toEqual(['Four orders']);
  });
});

describe('a page opened', () => {
  const into = { customer_id: 'id' };
  const then: ActionStep[] = [{ do: 'say', message: 'Customer added', tone: 'success' }];
  const opening = (as: 'dialog' | 'panel' | 'page', more: Partial<ActionStep> = {}) =>
    order([button('new', 'New customer', [{ do: 'open', page: 'new-customer', as, values: { name: 'caller' }, into, then, ...more } as ActionStep])]);

  it('in a panel: started with the values asked, saved, its record set here by its name, and the run goes on', async () => {
    const dataSource = createMemoryDataSource();
    const viewer = mount(opening('panel'), { dataSource, pages: { 'new-customer': newCustomer() } });
    typeIn(box('f-caller', host), 'Nadia Farouk');
    press('New customer');
    await until(panel);
    const opened = panel() as HTMLElement;
    expect(opened.querySelector('.fd-form-dialog-title')?.textContent).toBe('New customer');
    expect(box('c-name', opened).value).toBe('Nadia Farouk');
    typeIn(box('c-email', opened), 'nadia@example.com');
    press('Save & Close', opened);
    await until(() => !panel() && toasts().length);
    await viewer.form.settled();
    const saved = viewer.form.getState().values['customer_id'] as { id: number; label: string };
    expect(saved.label).toBe('Nadia Farouk');
    expect(dataSource.records['partner'][saved.id]).toMatchObject({ name: 'Nadia Farouk', email: 'nadia@example.com' });
    expect(toasts().map((t) => t.firstChild?.textContent)).toEqual(['Customer added']);
  });

  it('in a panel from the side the step names, the end of the line unless it names one', async () => {
    const viewer = mount(opening('panel', { side: 'bottom' }), { pages: { 'new-customer': newCustomer() } });
    press('New customer');
    await until(panel);
    expect(panel()?.getAttribute('data-side')).toBe('bottom');
    expect(panel()?.classList.contains('fd-height-medium')).toBe(true);
    press('Discard', panel() as HTMLElement);
    await viewer.form.settled();
    viewer.destroy();
    mount(opening('panel'), { pages: { 'new-customer': newCustomer() } });
    press('New customer');
    await until(panel);
    expect(panel()?.getAttribute('data-side')).toBe('end');
  });

  it('in a dialog by default, of the page’s own title unless the step gives one', async () => {
    const viewer = mount(opening('dialog', { title: 'Add a customer' }), { pages: { 'new-customer': newCustomer() } });
    press('New customer');
    await until(dialog);
    expect(panel()).toBeNull();
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Add a customer');
    press('Discard', dialog() as HTMLElement);
    await viewer.form.settled();
    expect(viewer.form.getState().values['customer_id']).toBeNull();
    expect(toasts()).toEqual([]);
  });

  it('closed without saving, stops the run there', async () => {
    const runs: unknown[] = [];
    const viewer = mount(opening('panel'), { pages: { 'new-customer': newCustomer() } });
    viewer.on('run', ({ result }) => runs.push(result));
    press('New customer');
    await until(panel);
    press('Discard', panel() as HTMLElement);
    await viewer.form.settled();
    expect(runs).toEqual([expect.objectContaining({ done: false, reason: 'closed' })]);
  });

  it('gives the page opened a host of its own: its steps say, open further, and close it unsaved', async () => {
    const inside = newCustomer([
      button('hello', 'Hello', [{ do: 'say', message: 'Hello from the panel' }]),
      button('leave', 'Leave', [{ do: 'close' }]),
    ]);
    const viewer = mount(opening('panel'), { pages: { 'new-customer': inside } });
    press('New customer');
    await until(panel);
    press('Hello', panel() as HTMLElement);
    await until(() => toasts().length);
    expect((panel() as HTMLElement).contains(toasts()[0])).toBe(true);
    press('Leave', panel() as HTMLElement);
    await until(() => !panel());
    await viewer.form.settled();
    expect(viewer.form.getState().values['customer_id']).toBeNull();
  });

  it('in its place: this form steps aside for it, and Back brings it back as it was, the run stopped', async () => {
    const runs: unknown[] = [];
    const viewer = mount(opening('page'), { pages: { 'new-customer': newCustomer() } });
    viewer.on('run', ({ result }) => runs.push(result));
    typeIn(box('f-caller', host), 'Nadia Farouk');
    (host.querySelector('[data-node="new"]') as HTMLButtonElement).focus();
    press('New customer');
    await until(() => box('c-name', host));
    expect(viewer.element.hidden).toBe(true);
    expect(document.activeElement).toBe(box('c-name', host));
    expect(host.querySelectorAll('.fd-form')).toHaveLength(2);
    expect(box('c-name', host).value).toBe('Nadia Farouk');
    press('Back');
    await viewer.form.settled();
    expect(viewer.element.hidden).toBe(false);
    expect(host.querySelectorAll('.fd-form')).toHaveLength(1);
    expect(box('f-caller', host).value).toBe('Nadia Farouk');
    expect(document.activeElement?.textContent).toBe('New customer');
    expect(runs).toEqual([expect.objectContaining({ done: false, reason: 'closed' })]);
  });

  it('in its place: saved, it gives way back to this form and the run goes on', async () => {
    const viewer = mount(opening('page'), { pages: { 'new-customer': newCustomer() } });
    typeIn(box('f-caller', host), 'Nadia Farouk');
    press('New customer');
    await until(() => box('c-name', host));
    typeIn(box('c-email', host), 'nadia@example.com');
    press('Save');
    await until(() => !viewer.element.hidden && toasts().length);
    await viewer.form.settled();
    expect(host.querySelectorAll('.fd-form')).toHaveLength(1);
    expect((viewer.form.getState().values['customer_id'] as { label: string }).label).toBe('Nadia Farouk');
    expect(toasts().map((t) => t.firstChild?.textContent)).toEqual(['Customer added']);
  });

  it('stops with words when the app has no such page', async () => {
    const viewer = mount(opening('panel'), { pages: {} });
    const result = await viewer.run([{ do: 'open', page: 'ghost', as: 'panel' }]);
    expect(result).toMatchObject({ done: false, reason: 'cannot', message: 'The page “ghost” cannot be found.' });
    expect(panel()).toBeNull();
  });

  it('asks the app first: its own answer opens nothing here, and undefined leaves it to the viewer', async () => {
    const asked: OpenRequest[] = [];
    const viewer = mount(opening('panel'), {
      pages: { 'new-customer': newCustomer() },
      onOpen: (request) => {
        asked.push(request);
        return request.as === 'page' ? Promise.resolve({ saved: true, recordId: 7, values: { name: 'Petra Tours' } }) : undefined;
      },
    });
    typeIn(box('f-caller', host), 'Petra');
    await viewer.run([{ do: 'open', page: 'new-customer', as: 'page', values: { name: 'caller' }, into }]);
    expect(asked).toEqual([{ page: 'new-customer', as: 'page', recordId: null, values: { name: 'Petra' } }]);
    expect(viewer.form.getState().values['customer_id']).toEqual({ id: 7, label: 'Petra Tours' });
    expect(viewer.element.hidden).toBe(false);
    void viewer.run([{ do: 'open', page: 'new-customer', as: 'panel' }]);
    await until(panel);
    expect(panel()).not.toBeNull();
  });

  it('lets the app give its own open, and keeps the viewer’s say and ask', async () => {
    const viewer = mount(opening('panel'), { host: { open: async () => ({ saved: true, recordId: 3, values: { name: 'Delta Foods' } }) } });
    await viewer.run([{ do: 'open', page: 'new-customer', as: 'panel', into, then }]);
    expect(viewer.form.getState().values['customer_id']).toEqual({ id: 3, label: 'Delta Foods' });
    expect(toasts().map((t) => t.firstChild?.textContent)).toEqual(['Customer added']);
  });
});

describe('the handle', () => {
  it('hears the form’s events, sets values as the app, and runs steps', async () => {
    const viewer = mount(order());
    const heard: string[] = [];
    const off = viewer.on('change', ({ field, by }) => heard.push(`${field} by ${by}`));
    viewer.setValues({ product: 'Desk lamp', price: 380 });
    expect(heard).toEqual(['product by app', 'price by app']);
    expect(box('f-product', host).value).toBe('Desk lamp');
    off();
    viewer.setValues({ price: 400 });
    expect(heard).toHaveLength(2);
    expect(await viewer.run([{ do: 'set', field: 'note', value: "'Ring first'" }], { id: 'mine' })).toEqual({ done: true });
    expect(viewer.form.getState().values['note']).toBe('Ring first');
  });
});
