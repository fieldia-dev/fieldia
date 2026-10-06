import type { ButtonNode, Field, Page } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, type Designer } from './designer';
import { button, choose, field, mount, openTab, press, type } from './test-editor';

/**
 * The steps editor, as a person uses it on the panel: a body button's When
 * clicked, a field's When it changes, the page's moments — each a list of
 * sentences, Add a step offering the kinds that fit, a step's settings opened
 * in place, moved by keys, removed with Undo at hand, in English and Arabic.
 */

const fields: Record<string, Field> = {
  customer: { type: 'char', label: 'Customer' },
  product: { type: 'char', label: 'Product' },
  price: { type: 'float', label: 'Price' },
  quantity: { type: 'integer', label: 'Quantity' },
};

/** An order screen with a body button, and an app whose store lists a saved Customer page. */
async function order(locale?: string): Promise<{ designer: Designer; store: ReturnType<typeof createMemoryPageStore> }> {
  const store = createMemoryPageStore();
  const customer: Page = { ...blankPage('screen', 'Customer'), id: 'customer', fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } } };
  await store.publish(customer);
  const page: Page = {
    ...blankPage('screen', 'Order'),
    id: 'order',
    fields: JSON.parse(JSON.stringify(fields)),
    layout: {
      type: 'sections',
      id: 'sections',
      children: [
        {
          type: 'section',
          id: 'section-1',
          columns: 2,
          children: [...Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name })), { type: 'button', id: 'new-customer', label: 'New customer', action: 'button' }],
        },
      ],
    },
  };
  return { designer: createDesigner({ page, store, locale }), store };
}

/** Latin words left in Arabic, besides the keys and the example names the Arabic keeps (as designer-words.spec.ts lists them). */
const latinIn = (text: string) => (text.match(/[A-Za-z][A-Za-z0-9_'’-]*/g) ?? []).filter((word) => !['Alt', 'contact', 'confirm'].includes(word));
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
const clicked = (host: Element) => host.querySelector('[data-setting="When clicked"]') as HTMLElement;
const sayings = (scope: Element) => [...scope.querySelectorAll<HTMLElement>('.fd-do-say')].filter((s) => !s.closest('[hidden]')).map((s) => s.textContent);
const menuItems = () => [...document.querySelectorAll('.fd-menu .fd-menu-heading, .fd-menu .fd-menu-item')].map((e) => (e.classList.contains('fd-menu-heading') ? `# ${e.textContent}` : e.textContent));
const pick_ = (label: string) => ([...document.querySelectorAll<HTMLButtonElement>('.fd-menu .fd-menu-item')].find((b) => b.textContent === label) as HTMLButtonElement).click();
const pressed = (designer: Designer) => (designer.getPage().layout as unknown as { children: { children: ButtonNode[] }[] }).children[0].children.find((n) => n.id === 'new-customer') as ButtonNode;

describe('When clicked, on a body button', () => {
  it('shows a button with only an app action as that one step, kept: a button does at least one thing', async () => {
    const { designer } = await order();
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    const steps = clicked(host);
    expect(steps.querySelector('.fd-prop-name')?.textContent).toBe('When clicked');
    expect(sayings(steps)).toEqual(['Run the app’s action button']);
    expect(steps.querySelector('.fd-do-say code')?.textContent).toBe('button');
    expect((steps.querySelector('.fd-do-remove') as HTMLElement).hidden).toBe(true);
    expect((steps.querySelector('.fd-do-keeps') as HTMLElement).hidden).toBe(false);
    // Its look and its question, as a header's button has.
    expect(field(host, 'Asks first')).toBeDefined();
    expect(host.querySelector('[data-setting="Look"] [data-choice="primary"]')).not.toBeNull();
  });

  it('offers the kinds that fit, grouped plainly, and begins one that needs words, kept once they are typed', async () => {
    const { designer } = await order();
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    button(clicked(host), 'Add a step')?.click();
    // No tabs and no table of lines here: what cannot be done is not offered.
    expect(menuItems()).toEqual([
      '# Open and close',
      'Open a page',
      'Open a web address',
      'Close the dialog or panel',
      '# Values',
      'Set a field',
      'Empty a field',
      '# Check and save',
      'Check the form',
      'Save or send',
      'Put the form back',
      '# Talk to the person',
      'Say something',
      'Ask Yes or No',
      '# The app',
      'Run one of the app’s actions',
      'Load the record again',
    ]);
    pick_('Say something');
    const words = field(clicked(host), 'Words') as HTMLInputElement;
    expect(document.activeElement).toBe(words);
    // Begun, not kept: nothing on the page yet.
    expect(pressed(designer).steps).toBeUndefined();
    type(words, 'Customer added');
    expect(pressed(designer).steps).toEqual([{ do: 'call', action: 'button' }, { do: 'say', message: 'Customer added' }]);
    expect(document.activeElement).toBe(words);
    choose(field(clicked(host), 'Tone'), 'success');
    expect(sayings(clicked(host))).toEqual(['Run the app’s action button', 'Say as good news: Customer added']);
    // Typing, then a tone: two undo steps, and the step begun is gone with the first.
    designer.undo();
    designer.undo();
    expect(pressed(designer)).toEqual({ type: 'button', id: 'new-customer', label: 'New customer', action: 'button' });
  });

  it('opens a page the app lists, in a panel, its answer put into a field, then says so — the action taken away after', async () => {
    const { designer } = await order();
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    button(clicked(host), 'Add a step')?.click();
    pick_('Open a page');
    await settled();
    const page = field(clicked(host), 'Page') as HTMLSelectElement;
    expect([...page.options].map((o) => o.textContent)).toEqual(['Pick…', 'Customer', 'Another page, by its id…']);
    choose(page, 'customer');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer' });
    (clicked(host).querySelector('[data-choice="panel"]') as HTMLButtonElement).click();
    button(clicked(host), 'Add an answer')?.click();
    const map = clicked(host).querySelector('[aria-label="Its answers go to"]') as HTMLElement;
    choose(field(map, 'This form’s field'), 'customer');
    choose(field(map, 'Customer gets'), 'name');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' } });
    // Once it is saved: a step of its own, under it.
    button(clicked(host), 'Add a step once it’s saved')?.click();
    pick_('Say something');
    type(field(clicked(host), 'Words'), 'Customer added');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' }, then: [{ do: 'say', message: 'Customer added' }] });
    expect(sayings(clicked(host))).toEqual(['Run the app’s action button', 'Open Customer in a panel, then put its answer in Customer', 'Say: Customer added']);
    // Under the step that opened the page.
    expect(sayings(clicked(host).querySelector('.fd-do-then') as HTMLElement)).toEqual(['Say: Customer added']);
    // The app's action is not wanted here: taken away, with Undo at hand.
    button(clicked(host), 'Remove step 1')?.click();
    expect(pressed(designer).steps).toEqual([{ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' }, then: [{ do: 'say', message: 'Customer added' }] }]);
    expect(pressed(designer).action).toBeUndefined();
    const status = clicked(host).querySelector('.fd-do-status') as HTMLElement;
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('Removed “Run the app’s action button”. Undo');
    button(status, 'Undo')?.click();
    expect(pressed(designer).steps?.[0]).toEqual({ do: 'call', action: 'button' });
  });

  it('keeps what an opened page starts with as a map: its field picked, then a value typed, each its own undo step', async () => {
    const { designer } = await order();
    designer.addStep({ press: 'new-customer' }, { do: 'open', page: 'customer' });
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    await settled();
    ([...clicked(host).querySelectorAll<HTMLButtonElement>('.fd-do-say')][1]).click();
    button(clicked(host), 'Add a value')?.click();
    const map = clicked(host).querySelector('[aria-label="It starts with"]') as HTMLElement;
    // The opened page's fields, by their labels; the value's box named after the one picked.
    expect([...(field(map, 'Its field') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Pick…', 'Name', 'Phone']);
    choose(field(map, 'Its field'), 'phone');
    const value = field(map, 'Phone gets') as HTMLInputElement;
    type(value, 'customer');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', values: { phone: 'customer' } });
    type(value, "customer + ' (new)'");
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', values: { phone: "customer + ' (new)'" } });
    designer.undo();
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer' });
  });

  it('opens a web address worked out from the form, in a new tab unless that is unticked', async () => {
    const { designer } = await order();
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    button(clicked(host), 'Add a step')?.click();
    pick_('Open a web address');
    const address = field(clicked(host), 'Address') as HTMLInputElement;
    expect(document.activeElement).toBe(address);
    type(address, "'https://portal.example/' + customer");
    address.dispatchEvent(new Event('change', { bubbles: true }));
    expect(pressed(designer).steps?.at(-1)).toEqual({ do: 'openUrl', url: "'https://portal.example/' + customer" });
    const newTab = [...clicked(host).querySelectorAll('label')].find((l) => l.textContent === 'In a new tab')?.querySelector('input') as HTMLInputElement;
    expect(newTab.checked).toBe(true);
    newTab.click();
    expect(pressed(designer).steps?.at(-1)).toEqual({ do: 'openUrl', url: "'https://portal.example/' + customer", newTab: false });
    expect(sayings(clicked(host)).at(-1)).toBe('Open the web address “https://portal.example/” + Customer, in this tab');
  });

  it('moves a step with Alt and the arrows on its sentence, the cursor going with it', async () => {
    const { designer } = await order();
    designer.addStep({ press: 'new-customer' }, { do: 'check' });
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    const second = [...clicked(host).querySelectorAll<HTMLButtonElement>('.fd-do-say')][1];
    press('ArrowUp', { altKey: true }, second);
    expect(pressed(designer).steps).toEqual([{ do: 'check' }, { do: 'call', action: 'button' }]);
    expect(document.activeElement?.textContent).toBe('Check the form');
    expect(sayings(clicked(host))).toEqual(['Check the form', 'Run the app’s action button']);
  });

  it('says what is wrong under a step, keeping the last that read', async () => {
    const { designer } = await order();
    designer.addStep({ press: 'new-customer' }, { do: 'set', field: 'price', value: 'quantity * 2' });
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    ([...clicked(host).querySelectorAll<HTMLButtonElement>('.fd-do-say')][1]).click();
    const to = field(clicked(host), 'To') as HTMLInputElement;
    type(to, 'quantity *');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'set', field: 'price', value: 'quantity * 2' });
    type(to, 'quantity * 12.5');
    button(clicked(host), 'Only when…')?.click();
    type(field(clicked(host), 'Runs only when') as HTMLInputElement, 'quantity > 0');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'set', field: 'price', value: 'quantity * 12.5', when: 'quantity > 0' });
    expect(sayings(clicked(host))[1]).toBe('Set Price to Quantity × 12.5 when Quantity > 0');
  });
});

describe('When it changes, on a field’s Rules tab', () => {
  it('writes the page’s change steps under the field’s name: When Product changes, run check_stock', async () => {
    const { designer } = await order();
    designer.select('f-product');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const changes = host.querySelector('[data-setting="When it changes"]') as HTMLElement;
    expect(changes.querySelector('.fd-prop-name')?.textContent).toBe('When it changes');
    button(changes, 'Add a step')?.click();
    pick_('Run one of the app’s actions');
    type(field(changes, 'The app’s action'), 'check_stock');
    expect(designer.getPage().on).toEqual({ change: { product: [{ do: 'call', action: 'check_stock' }] } });
  });

  it('is Advanced’s: Simple keeps the Rules tab to when it shows and whether it is required', async () => {
    const { designer } = await order();
    designer.select('f-product');
    const { host } = mount(designer, { mode: 'simple' });
    expect(host.querySelector('[data-setting="When it changes"]')).toBeNull();
  });
});

describe('the form’s moments, on the page’s Rules tab', () => {
  it('writes before it’s saved: check, then ask', async () => {
    const { designer } = await order();
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const moments = host.querySelector('[data-setting="When…"]') as HTMLElement;
    expect([...moments.querySelectorAll('.fd-do-moment-name')].map((n) => n.textContent)).toEqual(['When the form opens', 'Before it’s saved or sent', 'After it’s saved or sent', 'When a tab or step is shown']);
    // No tabs on this page: no list for one.
    expect((moments.querySelectorAll('.fd-do-moment')[3] as HTMLElement).hidden).toBe(true);
    const before = moments.querySelectorAll('.fd-do')[1] as HTMLElement;
    button(before, 'Add a step')?.click();
    pick_('Check the form');
    button(before, 'Add a step')?.click();
    pick_('Ask Yes or No');
    type(field(before, 'Words'), 'Send the order?');
    expect(designer.getPage().on).toEqual({ beforeSave: [{ do: 'check' }, { do: 'ask', message: 'Send the order?' }] });
    expect(sayings(before)).toEqual(['Check the form', 'Ask: Send the order?']);
  });
});

describe('a tab shown, on the page’s Rules tab', () => {
  it('offers the tabs without steps, and gives the one picked a list of its own, written under its id', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    const tabsId = designer.addTabs() as string;
    designer.addTab(tabsId, 'Invoices');
    const tabs = (designer.getPage().layout as { children: { type: string; id: string; children?: { id: string }[] }[] }).children.find((n) => n.type === 'tabs') as { id: string; children: { id: string }[] };
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const moments = host.querySelector('[data-setting="When…"]') as HTMLElement;
    const pick = field(moments, 'Steps for a tab or step…') as HTMLSelectElement;
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Steps for a tab or step…', 'Tab 1', 'Invoices']);
    choose(pick, tabs.children[1].id);
    const shown = moments.querySelector('.fd-do-show') as HTMLElement;
    expect(shown.querySelector('.fd-do-show-name')?.textContent).toBe('When Invoices is shown');
    expect(document.activeElement?.textContent).toBe('Add a step');
    button(shown, 'Add a step')?.click();
    pick_('Say something');
    type(field(shown, 'Words'), 'Your invoices');
    expect(designer.getPage().on).toEqual({ show: { [tabs.children[1].id]: [{ do: 'say', message: 'Your invoices' }] } });
    // The tab with steps is no longer offered.
    expect([...(field(moments, 'Steps for a tab or step…') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Steps for a tab or step…', 'Tab 1']);
  });
});

describe('an open step’s panel: the side it comes from', () => {
  it('offers From once it opens in a panel — the end of the line unless another is picked — said in its sentence, and dropped with the panel', async () => {
    const { designer } = await order();
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    button(clicked(host), 'Add a step')?.click();
    pick_('Open a page');
    await settled();
    choose(field(clicked(host), 'Page') as HTMLSelectElement, 'customer');
    const from = () => clicked(host).querySelector('select[aria-label="From"]') as HTMLSelectElement;
    // A dialog, or its place, comes from nowhere: no From.
    expect(from().closest('[hidden]')).not.toBeNull();
    (clicked(host).querySelector('[data-choice="panel"]') as HTMLButtonElement).click();
    expect(from().closest('[hidden]')).toBeNull();
    // Plainly: the end of the line first, unset; then the screen's four edges — what each means said under it.
    expect([...from().options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'The end of the line'],
      ['left', 'The left'],
      ['right', 'The right'],
      ['top', 'The top'],
      ['bottom', 'The bottom'],
    ]);
    const hint = () => (from().parentElement?.querySelector('.fd-properties-hint') as HTMLElement);
    expect(from().value).toBe('');
    expect([hint().hidden, hint().textContent]).toEqual([false, 'The right, or the left on a page that reads right to left.']);
    choose(from(), 'left');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', as: 'panel', side: 'left' });
    expect(sayings(clicked(host))[1]).toBe('Open Customer in a panel from the left');
    expect(hint().hidden).toBe(true);
    choose(from(), 'top');
    expect(sayings(clicked(host))[1]).toBe('Open Customer in a panel from the top');
    expect([hint().hidden, hint().textContent]).toEqual([false, 'The whole width of the screen.']);
    // Back to the end of the line: nothing written.
    choose(from(), '');
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', as: 'panel' });
    // A side goes with the panel: a dialog drops it.
    choose(from(), 'bottom');
    (clicked(host).querySelector('[data-choice="dialog"]') as HTMLButtonElement).click();
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer' });
    expect(from().closest('[hidden]')).not.toBeNull();
    // One undo step each: the dialog undone gives back the panel from the bottom.
    designer.undo();
    expect(pressed(designer).steps?.[1]).toEqual({ do: 'open', page: 'customer', as: 'panel', side: 'bottom' });
    expect(from().value).toBe('bottom');
  });

  it('shows a page’s own start of the line as it is, offered only there', async () => {
    const { designer } = await order();
    designer.addStep({ press: 'new-customer' }, { do: 'open', page: 'customer', as: 'panel', side: 'start' });
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    await settled();
    ([...clicked(host).querySelectorAll<HTMLButtonElement>('.fd-do-say')][1]).click();
    const from = field(clicked(host), 'From') as HTMLSelectElement;
    expect(from.value).toBe('start');
    expect(from.selectedOptions[0].textContent).toBe('The start of the line');
    expect(from.parentElement?.querySelector('.fd-properties-hint')?.textContent).toBe('The left, or the right on a page that reads right to left.');
    choose(from, 'right');
    expect([...from.options].map((o) => o.value)).toEqual(['', 'left', 'right', 'top', 'bottom']);
  });
});

describe('the steps editor in Arabic', () => {
  it('says its words in Arabic, the app’s names apart as code', async () => {
    const { designer } = await order('ar');
    designer.addStep({ press: 'new-customer' }, { do: 'open', page: 'customer', as: 'panel', side: 'top', into: { customer: 'name' }, then: [{ do: 'say', message: 'تمت الإضافة' }] });
    designer.select('new-customer');
    const { host } = mount(designer, { mode: 'advanced' });
    await settled();
    const steps = clicked(host);
    expect(steps.querySelector('.fd-prop-name')?.textContent).toBe('عند النقر');
    expect(sayings(steps)[1]).toBe('افتح «⁨Customer⁩» في لوحة من الأعلى، ثم ضع إجابتها في «⁨Customer⁩»');
    ([...steps.querySelectorAll<HTMLButtonElement>('.fd-do-say')][1]).click();
    button(steps, 'إضافة خطوة')?.click();
    const said = [steps, ...document.querySelectorAll('.fd-menu')].flatMap((scope) => {
      const copy = scope.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('code, option').forEach((c) => c.remove());
      const names = [...copy.querySelectorAll('[aria-label], [placeholder], [title]')].flatMap((e) => ['aria-label', 'placeholder', 'title'].map((a) => e.getAttribute(a) ?? ''));
      return latinIn([copy.textContent ?? '', ...names].join(' '));
    });
    // Customer and Name are the page's own words, written so.
    expect(said.filter((word) => !['Customer', 'Name', 'Order', 'Product', 'Price', 'Quantity'].includes(word))).toEqual([]);
    // Where its panel comes from, each choice in Arabic.
    const from = field(steps, 'من جهة') as HTMLSelectElement;
    expect(from.value).toBe('top');
    expect([...from.options].map((o) => o.textContent)).toEqual(['نهاية السطر', 'اليسار', 'اليمين', 'الأعلى', 'الأسفل']);
    expect(from.parentElement?.querySelector('.fd-properties-hint')?.textContent).toBe('بعرض الشاشة كله.');
  });
});

describe('Try it, with steps', () => {
  it('draws the page as it is, its steps and moments with it: running them is the form’s', async () => {
    const { designer } = await order();
    designer.addStep({ press: 'new-customer' }, { do: 'say', message: 'Customer added' });
    designer.addStep({ moment: 'beforeSave' }, { do: 'check' });
    const { host } = mount(designer, { mode: 'advanced' });
    (host.querySelector('.fd-designer-bar [data-mode="try"]') as HTMLButtonElement).click();
    const tried = host.querySelector('.fd-try-frame form.fd-form') as HTMLFormElement;
    expect([...tried.querySelectorAll('button')].map((b) => b.textContent)).toContain('New customer');
    expect(designer.getPage().on).toEqual({ beforeSave: [{ do: 'check' }] });
  });
});
