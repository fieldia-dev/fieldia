import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { openFormDialog, openSearchDialog } from './dialog';
import { pageDialogs } from './related';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const customerSource = () =>
  createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', is_company: true, state: 'active', email: 'hello@nile.example' } } } });
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
/** A button of the dialog itself (its head and foot), not of the page inside it. */
const button = (name: string) =>
  [...(dialog()?.querySelectorAll('.fd-form-dialog-head button, .fd-form-dialog-foot button') ?? [])].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent) === name
  ) as HTMLButtonElement;
const field = (id: string) => dialog()?.querySelector(`[data-node="${id}"] input`) as HTMLInputElement;
function typeIn(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

let opener: HTMLButtonElement;
beforeEach(() => {
  document.body.replaceChildren();
  opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(opener);
  opener.focus();
});

describe('a form in a dialog', () => {
  it('opens a page in a modal dialog of the size asked, named by its title, with the focus inside', async () => {
    void openFormDialog({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders', size: 'large' });
    await flush();
    const box = dialog() as HTMLElement;
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(box.getAttribute('aria-labelledby') as string)?.textContent).toBe('Nile Traders');
    expect(box.classList.contains('fd-size-large')).toBe(true);
    expect(box.contains(document.activeElement)).toBe(true);
    // The dialog saves; the page's own Save and Discard are not shown.
    expect([...box.querySelectorAll('.fd-form button')].map((b) => b.textContent)).not.toContain('Save');
    expect(button('Save & Close')).toBeDefined();
  });

  it('Save & Close saves through the data source, hands back the record and gives the focus back', async () => {
    const dataSource = customerSource();
    const result = openFormDialog({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
    await flush();
    typeIn(dialog()?.querySelector('[data-node="#title"] input') as HTMLInputElement, 'Nile Traders Ltd');
    button('Save & Close').click();
    const done = await result;
    expect(done.saved).toBe(true);
    expect(done.recordId).toBe(1);
    expect(done.values['name']).toBe('Nile Traders Ltd');
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders Ltd');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it.each(['Discard', 'Close', 'Escape'])('%s closes it without saving', async (way) => {
    const dataSource = customerSource();
    const result = openFormDialog({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
    await flush();
    typeIn(dialog()?.querySelector('[data-node="#title"] input') as HTMLInputElement, 'Changed');
    if (way === 'Escape') (dialog() as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else button(way).click();
    expect((await result).saved).toBe(false);
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('stays open, at the problem, when the form refuses to save', async () => {
    let settled = false;
    void openFormDialog({ page: page('customer'), dataSource: customerSource(), title: 'New customer' }).then(() => (settled = true));
    await flush();
    button('Save & Close').click();
    await flush();
    await flush();
    expect(dialog()).not.toBeNull();
    expect(settled).toBe(false);
    expect(document.activeElement).toBe(dialog()?.querySelector('[data-node="#title"] input'));
  });

  it('in values mode checks the form and hands back its values, with no data source', async () => {
    const result = openFormDialog({ page: page('signup'), title: 'Your details', mode: 'values', values: { full_name: 'Sara', role: 'designer' } });
    await flush();
    typeIn(field('f-email'), 'sara@example.com');
    button('Save & Close').click();
    const done = await result;
    expect(done.saved).toBe(true);
    expect(done.values).toEqual(expect.objectContaining({ full_name: 'Sara', role: 'designer', email: 'sara@example.com' }));
  });

  /** A line's fields: its subtotal is worked out from the others. */
  const linePage: Page = {
    fieldia: '0.1',
    id: 'values',
    title: 'Order line',
    data: { kind: 'record', model: 'values' },
    fields: {
      qty: { type: 'float', label: 'Quantity' },
      price: { type: 'float', label: 'Unit price' },
      subtotal: { type: 'float', label: 'Subtotal', readonly: true },
    },
    layout: { type: 'sections', id: 'values', children: [{ type: 'section', id: 's', children: ['qty', 'price', 'subtotal'].map((name) => ({ type: 'field' as const, id: `values-${name}`, field: name })) }] },
  };

  it('in values mode recalculates the values as they change, and shows what comes back', async () => {
    const asked: unknown[] = [];
    const recompute = async (values: Values): Promise<Values> => {
      asked.push(values['qty']);
      return { ...values, subtotal: Number(values['qty']) * Number(values['price']) };
    };
    const result = openFormDialog({ page: linePage, title: 'Order line', mode: 'values', values: { qty: 2, price: 100, subtotal: 200 }, recompute });
    await flush();
    typeIn(field('values-qty'), '5');
    await flush();
    await flush();
    expect(field('values-subtotal').value).toBe('500.00');
    // Writing the answer back is no change to recalculate again.
    expect(asked).toEqual([5]);
    button('Save & Close').click();
    expect((await result).values).toEqual({ qty: 5, price: 100, subtotal: 500 });
  });

  it('writes what comes back as the app’s change, not a person’s: the page’s change steps do not run for it', async () => {
    const calls: string[] = [];
    const watched: Page = { ...linePage, on: { change: { subtotal: [{ do: 'call', action: 'subtotal_typed' }], qty: [{ do: 'call', action: 'qty_typed' }] } } };
    const recompute = async (values: Values): Promise<Values> => ({ ...values, subtotal: Number(values['qty']) * Number(values['price']) });
    const result = openFormDialog({ page: watched, title: 'Order line', mode: 'values', values: { qty: 2, price: 100, subtotal: 200 }, recompute, onAction: ({ action }) => void calls.push(action) });
    await flush();
    typeIn(field('values-qty'), '5');
    await flush();
    await flush();
    expect(field('values-subtotal').value).toBe('500.00');
    expect(calls).toEqual(['qty_typed']);
    button('Save & Close').click();
    expect((await result).values['subtotal']).toBe(500);
  });

  it('drops an answer for values that have changed since', async () => {
    const pending: { qty: unknown; answer: () => void }[] = [];
    const recompute = (values: Values) =>
      new Promise<Values>((answer) => pending.push({ qty: values['qty'], answer: () => answer({ ...values, subtotal: Number(values['qty']) * 100 }) }));
    const result = openFormDialog({ page: linePage, title: 'Order line', mode: 'values', values: { qty: 2, price: 100, subtotal: 200 }, recompute });
    await flush();
    typeIn(field('values-qty'), '5');
    typeIn(field('values-qty'), '6');
    expect(pending.map((p) => p.qty)).toEqual([5, 6]);
    pending[1].answer();
    await flush();
    pending[0].answer();
    await flush();
    expect(field('values-subtotal').value).toBe('600.00');
    button('Save & Close').click();
    expect((await result).values['subtotal']).toBe(600);
  });

  it('leaves Escape to a list open inside it, and closes on the next one', async () => {
    const countries = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } }, country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } } } });
    const result = openFormDialog({ page: page('customer'), dataSource: countries, recordId: 1, title: 'Nile Traders' });
    await flush();
    const country = dialog()?.querySelector('[data-node="f-country"] input') as HTMLInputElement;
    typeIn(country, 'jor');
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(country.getAttribute('aria-expanded')).toBe('true');
    const escape = () => country.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    escape();
    expect(country.getAttribute('aria-expanded')).toBe('false');
    expect(dialog()).not.toBeNull();
    escape();
    expect(dialog()).toBeNull();
    expect((await result).saved).toBe(false);
  });

  it('saves and closes on Ctrl+Enter or Cmd+Enter', async () => {
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      const dataSource = customerSource();
      const result = openFormDialog({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
      await flush();
      const phone = field('f-phone');
      typeIn(phone, '+20 2 1111 2222');
      phone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...modifier }));
      const done = await result;
      expect(done.saved).toBe(true);
      expect(dataSource.records['partner'][1]['phone']).toBe('+20 2 1111 2222');
      expect(dialog()).toBeNull();
    }
  });

  it('keeps Tab inside the dialog', async () => {
    void openFormDialog({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    const focusables = [...(dialog() as HTMLElement).querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')].filter((e) => !e.closest('[hidden]') && !(e as HTMLButtonElement).disabled);
    const last = focusables[focusables.length - 1];
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(focusables[0]);
  });
});

describe('a searchable list in a dialog', () => {
  const countries = [
    { id: 1, label: 'Egypt' },
    { id: 2, label: 'Jordan' },
    { id: 3, label: 'Japan' },
  ];
  const search = async (query: string) => countries.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  const items = () => [...(dialog()?.querySelectorAll('[role="option"]') ?? [])].map((o) => o.textContent);

  it('lists the records, narrows them as you type, and picks with the keyboard', async () => {
    const result = openSearchDialog({ title: 'Country', search });
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(document.getElementById(dialog()?.getAttribute('aria-labelledby') as string)?.textContent).toBe('Country');
    expect(items()).toEqual(['Egypt', 'Jordan', 'Japan']);
    const box = dialog()?.querySelector('input[type="search"]') as HTMLInputElement;
    expect(document.activeElement).toBe(box);
    box.value = 'ja';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(items()).toEqual(['Japan']);
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(await result).toEqual({ id: 3, label: 'Japan' });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // A modal dialog (WCAG 2.4.3): Tab goes round inside it, both ways, never out to the page under it.
  it('keeps Tab inside, both ways round', async () => {
    void openSearchDialog({ title: 'Country', search });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const buttons = [...(dialog() as HTMLElement).querySelectorAll('button')];
    const [first, last] = [buttons[0], buttons[buttons.length - 1]];
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
    (dialog() as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  it('picks with a click, and Escape closes it picking nothing', async () => {
    const clicked = openSearchDialog({ title: 'Country', search });
    await new Promise((resolve) => setTimeout(resolve, 250));
    ([...(dialog()?.querySelectorAll('[role="option"]') ?? [])][1] as HTMLElement).click();
    expect(await clicked).toEqual({ id: 2, label: 'Jordan' });
    const escaped = openSearchDialog({ title: 'Country', search });
    await new Promise((resolve) => setTimeout(resolve, 250));
    (dialog() as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await escaped).toBeNull();
  });
});

describe('a dialog in the look of the page that opened it', () => {
  const look = { accent: '#1f7a4d', scheme: 'dark', corners: 'round', density: 'compact', font: 'serif' } as const;
  const worn = (element: Element) => Object.fromEntries(['scheme', 'corners', 'density', 'font'].map((name) => [name, element.getAttribute(`data-${name}`)]));

  it('wears its accent, scheme, corners, room and font, and so does the page inside it', async () => {
    void openFormDialog({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders', look });
    await flush();
    const box = dialog() as HTMLElement;
    expect(worn(box)).toEqual({ scheme: 'dark', corners: 'round', density: 'compact', font: 'serif' });
    expect(box.hasAttribute('data-accent')).toBe(true);
    expect(box.style.getPropertyValue('--fd-look-accent')).toBe('#1f7a4d');
    expect(worn(box.querySelector('.fd-form') as HTMLElement)).toEqual(worn(box));
  });

  it('gives way to a look the page inside has of its own, the box and the page alike', async () => {
    const own: Page = { ...page('customer'), look: { scheme: 'light', accent: '#aa3300' } };
    void openFormDialog({ page: own, dataSource: customerSource(), recordId: 1, title: 'Nile Traders', look });
    await flush();
    const box = dialog() as HTMLElement;
    expect(box.getAttribute('data-scheme')).toBe('light');
    expect(box.style.getPropertyValue('--fd-look-accent')).toBe('#aa3300');
    expect((box.querySelector('.fd-form') as HTMLElement).getAttribute('data-scheme')).toBe('light');
  });

  it('wears it in a list to search in too', async () => {
    void openSearchDialog({ title: 'Country', search: async () => [], look });
    await flush();
    expect(worn(dialog() as HTMLElement)).toEqual({ scheme: 'dark', corners: 'round', density: 'compact', font: 'serif' });
  });

  it('has a linked record’s page say its words through the page whose field opens it', async () => {
    const said: string[] = [];
    const inside: Page = { ...page('customer'), layout: { type: 'sections', children: [{ type: 'section', id: 's', children: [{ type: 'button', id: 'hi', label: 'Hi', steps: [{ do: 'say', message: 'Hello from the record' }] }] }] } as never };
    const dialogs = pageDialogs({ page: page('customer'), dataSource: customerSource(), relatedPages: { partner: inside } }, (message) => said.push(message));
    void dialogs.openRecord('partner', { title: 'Nile Traders', recordId: 1 });
    await flush();
    ([...(dialog() as HTMLElement).querySelectorAll('button')].find((b) => b.textContent === 'Hi') as HTMLButtonElement).click();
    await flush();
    expect(said).toEqual(['Hello from the record']);
    expect((dialog() as HTMLElement).querySelector('.fd-say')).toBeNull();
  });

  it('is handed the look by the page whose field opens it', async () => {
    const opening: Page = { ...page('customer'), look };
    const dialogs = pageDialogs({ page: opening, dataSource: customerSource(), relatedPages: { partner: page('customer') } });
    void dialogs.openRecord('partner', { title: 'Nile Traders', recordId: 1 });
    await flush();
    expect((dialog() as HTMLElement).getAttribute('data-scheme')).toBe('dark');
    document.body.replaceChildren();
    void dialogs.searchMore({ title: 'Country', search: async () => [] } as never);
    await flush();
    expect((dialog() as HTMLElement).getAttribute('data-scheme')).toBe('dark');
  });
});

describe('a dialog a page opens reads what the page does', () => {
  it('hands a linked record’s page the person and the values the app passed in', async () => {
    const related: Page = {
      fieldia: '0.1',
      id: 'partner',
      data: { kind: 'record', model: 'partner' },
      fields: { name: { type: 'char', label: 'Name' }, vat: { type: 'char', label: 'Tax ID' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-vat', field: 'vat', invisible: "context.partner_kind != 'company'" }] },
    };
    const opener: Page = { fieldia: '0.1', id: 'order', data: { kind: 'record', model: 'sale.order' }, fields: {}, layout: { type: 'sections', id: 'root', children: [] } };
    const dialogs = pageDialogs({ page: opener, pages: { partner: related }, context: { partner_kind: 'company' }, user: { id: 4 } });
    void dialogs.openRecord('partner', { title: 'New partner' });
    await flush();
    expect((dialog()?.querySelector('[data-node="f-vat"]') as HTMLElement).hidden).toBe(false);
    button('Discard').click();
    void pageDialogs({ page: opener, pages: { partner: related } }).openRecord('partner', { title: 'New partner' });
    await flush();
    expect((dialog()?.querySelector('[data-node="f-vat"]') as HTMLElement).hidden).toBe(true);
  });
});
