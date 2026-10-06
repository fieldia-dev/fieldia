import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { openFormDialog, openFormPanel } from './dialog';

/**
 * A page in a side panel: the dialog's twin, at the inline-end edge. It saves
 * or hands back its values as the dialog does; it asks before Escape or ×
 * drop changes; and it stacks under a dialog, or under another panel.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const customerSource = () =>
  createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', is_company: true, state: 'active', email: 'hello@nile.example' } } } });
const panels = () => [...document.querySelectorAll<HTMLElement>('.fd-form-panel')];
const panel = () => panels().at(-1) ?? null;
/** A button of the panel itself (its head and foot), not of the page inside it. */
const button = (name: string, box = panel()) =>
  [...(box?.querySelectorAll('.fd-form-dialog-head button, .fd-form-dialog-foot button') ?? [])].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent) === name
  ) as HTMLButtonElement;
const nameBox = (box = panel()) => box?.querySelector('[data-node="#title"] input') as HTMLInputElement;
const question = () => panel()?.querySelector('[role="alertdialog"]') as HTMLElement | null;
const answer = (name: string) => [...(question()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === name) as HTMLButtonElement;
const press = (target: Element, key: string, extra: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
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

describe('a form in a side panel', () => {
  it('opens a page in a modal panel of the width asked, named by its title, with its own head and foot and the focus inside', async () => {
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders', width: 'wide' });
    await flush();
    const box = panel() as HTMLElement;
    expect(box.getAttribute('role')).toBe('dialog');
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(box.getAttribute('aria-labelledby') as string)?.textContent).toBe('Nile Traders');
    expect(box.classList.contains('fd-width-wide')).toBe(true);
    // The panel's own look and words: a box like the dialog's, on a backdrop that holds it at the edge.
    expect(box.classList.contains('fd-form-dialog')).toBe(true);
    expect(box.parentElement?.classList.contains('fd-form-panel-backdrop')).toBe(true);
    expect(box.contains(document.activeElement)).toBe(true);
    expect(button('Close')).toBeDefined();
    expect([...box.querySelectorAll('.fd-form-dialog-foot button')].map((b) => b.textContent)).toEqual(['Discard', 'Save & Close']);
    // The page's own Save and Discard are not shown.
    expect([...box.querySelectorAll('.fd-form button')].map((b) => b.textContent)).not.toContain('Save');
  });

  it('is medium unless asked', async () => {
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    expect(panel()?.classList.contains('fd-width-medium')).toBe(true);
  });

  it('Save & Close saves through the data source, hands back the record and gives the focus back', async () => {
    const dataSource = customerSource();
    const result = openFormPanel({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
    await flush();
    typeIn(nameBox(), 'Nile Traders Ltd');
    button('Save & Close').click();
    const done = await result;
    expect(done).toEqual({ saved: true, recordId: 1, values: expect.objectContaining({ name: 'Nile Traders Ltd' }) });
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders Ltd');
    expect(panel()).toBeNull();
    expect(document.querySelector('.fd-form-panel-backdrop')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('stays open, at the problem, when the form refuses to save', async () => {
    let settled = false;
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), title: 'New customer' }).then(() => (settled = true));
    await flush();
    button('Save & Close').click();
    await flush();
    await flush();
    expect(panel()).not.toBeNull();
    expect(settled).toBe(false);
    expect(document.activeElement).toBe(nameBox());
  });

  it('in values mode says Done, checks the form and hands back its values, with no data source', async () => {
    const result = openFormPanel({ page: page('signup'), title: 'Your details', mode: 'values', values: { full_name: 'Sara', role: 'designer' } });
    await flush();
    expect([...(panel()?.querySelectorAll('.fd-form-dialog-foot button') ?? [])].map((b) => b.textContent)).toEqual(['Discard', 'Done']);
    typeIn(panel()?.querySelector('[data-node="f-email"] input') as HTMLInputElement, 'sara@example.com');
    button('Done').click();
    const done = await result;
    expect(done.saved).toBe(true);
    expect(done.recordId).toBeNull();
    expect(done.values).toEqual(expect.objectContaining({ full_name: 'Sara', role: 'designer', email: 'sara@example.com' }));
  });

  it('in values mode recalculates the values as they change, as the dialog does', async () => {
    const linePage: Page = {
      fieldia: '0.1',
      id: 'values',
      title: 'Order line',
      data: { kind: 'record', model: 'values' },
      fields: { qty: { type: 'float', label: 'Quantity' }, price: { type: 'float', label: 'Unit price' }, subtotal: { type: 'float', label: 'Subtotal', readonly: true } },
      layout: { type: 'sections', id: 'values', children: [{ type: 'section', id: 's', children: ['qty', 'price', 'subtotal'].map((name) => ({ type: 'field' as const, id: `values-${name}`, field: name })) }] },
    };
    const recompute = async (values: Values): Promise<Values> => ({ ...values, subtotal: Number(values['qty']) * Number(values['price']) });
    const result = openFormPanel({ page: linePage, title: 'Order line', mode: 'values', values: { qty: 2, price: 100, subtotal: 200 }, recompute });
    await flush();
    typeIn(panel()?.querySelector('[data-node="values-qty"] input') as HTMLInputElement, '5');
    await flush();
    await flush();
    button('Done').click();
    expect((await result).values).toEqual({ qty: 5, price: 100, subtotal: 500 });
  });

  it('Discard closes it without saving, and without asking', async () => {
    const dataSource = customerSource();
    const result = openFormPanel({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
    await flush();
    typeIn(nameBox(), 'Changed');
    button('Discard').click();
    expect(await result).toEqual(expect.objectContaining({ saved: false, recordId: 1 }));
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it.each(['Escape', 'Close'])('%s with nothing changed closes it at once', async (way) => {
    const result = openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    await flush();
    if (way === 'Escape') press(panel() as HTMLElement, 'Escape');
    else button('Close').click();
    expect((await result).saved).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it.each(['Escape', 'Close'])('%s with unsaved changes asks first: Cancel keeps them, Discard drops them', async (way) => {
    const dataSource = customerSource();
    let settled = false;
    const result = openFormPanel({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
    void result.then(() => (settled = true));
    await flush();
    const name = nameBox();
    typeIn(name, 'Someone else');
    const leave = () => (way === 'Escape' ? press(name, 'Escape') : button('Close').click());

    leave();
    await flush();
    const asked = question() as HTMLElement;
    expect(asked).not.toBeNull();
    expect(asked.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(asked.getAttribute('aria-labelledby') as string)?.textContent).toBe('Discard your changes?');
    // The safe answer has the focus: Enter keeps the changes.
    expect(document.activeElement).toBe(answer('Cancel'));
    answer('Cancel').click();
    await flush();
    expect(question()).toBeNull();
    expect(panel()).not.toBeNull();
    expect(settled).toBe(false);
    expect(name.value).toBe('Someone else');
    // Back where it was when it asked.
    expect(document.activeElement).toBe(name);

    leave();
    await flush();
    answer('Discard').click();
    const done = await result;
    expect(done.saved).toBe(false);
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('takes Escape on its question as Cancel, keeping the panel open, and Tab stays in the question', async () => {
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    typeIn(nameBox(), 'Someone else');
    press(nameBox(), 'Escape');
    await flush();
    const [cancel, discard] = [answer('Cancel'), answer('Discard')];
    discard.focus();
    press(discard, 'Tab');
    expect(document.activeElement).toBe(cancel);
    press(cancel, 'Escape');
    await flush();
    expect(question()).toBeNull();
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(nameBox());
  });

  it('asks in the page’s language', async () => {
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders', locale: 'ar' });
    await flush();
    typeIn(nameBox(), 'Someone else');
    press(nameBox(), 'Escape');
    await flush();
    expect(document.getElementById(question()?.getAttribute('aria-labelledby') as string)?.textContent).toBe('هل تريد تجاهل تعديلاتك؟');
    expect([...(question()?.querySelectorAll('button') ?? [])].map((b) => b.textContent)).toEqual(['إلغاء', 'تجاهل']);
  });

  it('keeps Tab inside the panel', async () => {
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    const focusables = [...(panel() as HTMLElement).querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')].filter((e) => !e.closest('[hidden]') && !(e as HTMLButtonElement).disabled);
    const last = focusables[focusables.length - 1];
    last.focus();
    press(last, 'Tab');
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('saves and closes on Ctrl+Enter, as the dialog does', async () => {
    const dataSource = customerSource();
    const result = openFormPanel({ page: page('customer'), dataSource, recordId: 1, title: 'Nile Traders' });
    await flush();
    typeIn(nameBox(), 'Nile Traders Ltd');
    press(nameBox(), 'Enter', { ctrlKey: true });
    expect((await result).saved).toBe(true);
    expect(dataSource.records['partner'][1]['name']).toBe('Nile Traders Ltd');
  });

  it('runs right to left: the backdrop too, so the panel sits at the left edge', async () => {
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders', dir: 'rtl' });
    await flush();
    expect(panel()?.getAttribute('dir')).toBe('rtl');
    expect(panel()?.parentElement?.getAttribute('dir')).toBe('rtl');
  });

  it('wears the look of the page that opened it, and so does the page inside it', async () => {
    const look = { accent: '#1f7a4d', scheme: 'dark', corners: 'round' } as const;
    void openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders', look, skin: 'outlined' });
    await flush();
    const box = panel() as HTMLElement;
    expect(box.getAttribute('data-scheme')).toBe('dark');
    expect(box.getAttribute('data-fd-skin')).toBe('outlined');
    expect(box.style.getPropertyValue('--fd-look-accent')).toBe('#1f7a4d');
    expect((box.querySelector('.fd-form') as HTMLElement).getAttribute('data-scheme')).toBe('dark');
  });
});

describe('panels stacked with dialogs and with each other', () => {
  it('a dialog opened from inside the panel sits above it, and Escape there closes the dialog alone', async () => {
    const result = openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    const name = nameBox();
    name.focus();
    const inner = openFormDialog({ page: page('customer'), dataSource: customerSource(), title: 'New contact' });
    await flush();
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    expect(dialogs).toHaveLength(2);
    // Later in the body, so above it.
    expect(dialogs[0]).toBe(panel());
    const dialog = dialogs[1] as HTMLElement;
    expect(dialog.classList.contains('fd-form-panel')).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
    press(dialog, 'Escape');
    expect((await inner).saved).toBe(false);
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(name);
    press(name, 'Escape');
    expect((await result).saved).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('a panel opened from a panel stacks over it, the older one stepped back, and each gives the focus back as it closes', async () => {
    const first = openFormPanel({ page: page('customer'), dataSource: customerSource(), recordId: 1, title: 'Nile Traders' });
    await flush();
    const older = panel() as HTMLElement;
    const name = nameBox(older);
    name.focus();
    const second = openFormPanel({ page: page('signup'), title: 'Your details', mode: 'values', width: 'narrow' });
    await flush();
    expect(panels()).toHaveLength(2);
    const newer = panel() as HTMLElement;
    expect(newer).not.toBe(older);
    expect(older.hasAttribute('data-behind')).toBe(true);
    expect(newer.hasAttribute('data-behind')).toBe(false);
    expect(newer.contains(document.activeElement)).toBe(true);
    button('Discard', newer).click();
    expect((await second).saved).toBe(false);
    expect(panels()).toEqual([older]);
    expect(older.hasAttribute('data-behind')).toBe(false);
    expect(document.activeElement).toBe(name);
    button('Discard', older).click();
    await first;
    expect(document.activeElement).toBe(opener);
  });
});

describe('the dialog beside it', () => {
  it('keeps its own words and closes on Escape at once, changes or not', async () => {
    const result = openFormDialog({ page: page('signup'), title: 'Your details', mode: 'values' });
    await flush();
    const box = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(box.classList.contains('fd-form-panel')).toBe(false);
    expect([...box.querySelectorAll('.fd-form-dialog-foot button')].map((b) => b.textContent)).toEqual(['Discard', 'Save & Close']);
    typeIn(box.querySelector('[data-node="f-email"] input') as HTMLInputElement, 'sara@example.com');
    press(box, 'Escape');
    expect((await result).saved).toBe(false);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
