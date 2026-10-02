import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { openFormDialog, openSearchDialog } from './dialog';

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
    typeIn(dialog()?.querySelector('.fd-title input') as HTMLInputElement, 'Nile Traders Ltd');
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
    typeIn(dialog()?.querySelector('.fd-title input') as HTMLInputElement, 'Changed');
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
    expect(document.activeElement).toBe(dialog()?.querySelector('.fd-title input'));
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
