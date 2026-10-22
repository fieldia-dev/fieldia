import { createMemoryDataSource, saveRefused, type MemoryDataSource, type Page, type SaveRequest } from '@fieldia/core';
import { relationsPart } from '@fieldia/widgets';
import { rowReads } from './list-editable';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';
import { editablePart, partsFor } from './viewer-parts';

/**
 * A list whose cells are changed in place (`editable`): a press opens a cell in its field's own box, each row is saved
 * as it is left — the fields it changed alone, with the version it was listed at — one refused says why under it and
 * keeps the typing, a row whose record may not be changed stays as it is, a row is added at the end, and rows given
 * the same change by a paste are written in one `writeMany`. A list without `editable`, or a source without `save`,
 * is read and opened as ever.
 */

const prices: Page = {
  fieldia: '0.10',
  id: 'prices',
  title: 'Prices',
  records: { one: 'service', other: 'services', a: 'a service' },
  data: { kind: 'record', model: 'service' },
  fields: {
    name: { type: 'char', label: 'Service', required: true },
    minutes: { type: 'integer', label: 'Minutes', min: 5 },
    price: { type: 'monetary', label: 'Price', currency: 'EGP', min: 0 },
    per_hour: { type: 'float', label: 'Per hour', compute: 'price / minutes * 60' },
    code: { type: 'char', label: 'Code', readonly: true },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'minutes', 'price', 'per_hour', 'code'], sort: [{ field: 'name' }], editable: true },
};
const records = () => ({
  service: {
    1: { name: 'Chemical peel', minutes: 45, price: 2200, per_hour: 2933, code: 'CP' },
    2: { name: 'Hydrafacial', minutes: 60, price: 2800, per_hour: 2800, code: 'HF' },
    3: { name: 'Microneedling', minutes: 60, price: 3200, per_hour: 3200, code: 'MN' },
  },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = prices) {
  await Promise.all(partsFor(page).map((part) => part.load()));
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: records(), versions: true }), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr.fd-list-row'));
  return host;
}
const row = (host: Element, id: number) => host.querySelector(`.fd-list-row[data-id="${id}"]`) as HTMLTableRowElement;
const cell = (host: Element, id: number, column: string) => row(host, id).querySelector(`td[data-col="${column}"]`) as HTMLTableCellElement;
const saves = (source: MemoryDataSource) => source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);
/** A box in a cell typed in and read, as leaving it reads it. */
function type(td: HTMLElement, text: string) {
  const box = td.querySelector('input') as HTMLInputElement;
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
}
/** A row left: the focus on another row's cell. */
const leaveTo = (td: HTMLElement) => td.focus();

describe('a list whose cells are changed in place', () => {
  it('marks the cells a box can change, and offers a row at the end in the words its records go by', async () => {
    const host = await mount();
    expect([...row(host, 2).querySelectorAll('td[data-edit]')].map((td) => td.getAttribute('data-col'))).toEqual(['name', 'minutes', 'price']);
    expect(host.querySelector('.fd-list-add')?.textContent).toBe('+ Add a service');
    expect(document.getElementById('fd-list-editable-styles')).not.toBeNull();
  });

  it('never opens a text kept in several languages in a cell: read in the reader’s language, a press opens its record', async () => {
    // Each language a person's to type under its switch, on the record's page (translate): a cell holds one box.
    const bilingual: Page = { ...prices, fields: { ...prices.fields, name: { type: 'char', label: 'Service', translate: ['en', 'ar'] } } };
    const opened: unknown[] = [];
    const source = createMemoryDataSource({ records: { service: { 1: { name: { en: 'Chemical peel', ar: 'تقشير كيميائي' }, minutes: 45, price: 2200, per_hour: 2933, code: 'CP' } } }, versions: true });
    const host = await mount({ dataSource: source, onOpenRecord: (id) => void opened.push(id) }, bilingual);
    expect([...row(host, 1).querySelectorAll('td[data-edit]')].map((td) => td.getAttribute('data-col'))).toEqual(['minutes', 'price']);
    expect(cell(host, 1, 'name').textContent).toContain('Chemical peel');
    cell(host, 1, 'name').click();
    await until(() => opened.length);
    expect(opened).toEqual([1]);
    expect(cell(host, 1, 'name').querySelector('input')).toBeNull();
  });

  it('opens a pressed cell in its field’s own box, and saves the row as it is left: its changes alone, with its version', async () => {
    const source = createMemoryDataSource({ records: records(), versions: true });
    const host = await mount({ dataSource: source });
    cell(host, 2, 'price').click();
    await until(() => cell(host, 2, 'price').querySelector('input'));
    expect(cell(host, 2, 'price').hasAttribute('data-editing')).toBe(true);
    expect(document.activeElement).toBe(cell(host, 2, 'price').querySelector('input'));
    type(cell(host, 2, 'price'), '3000');
    // Worked out from the row as it is typed.
    expect(cell(host, 2, 'per_hour').textContent).toBe('3,000.00');
    expect(saves(source)).toEqual([]);
    leaveTo(cell(host, 3, 'name'));
    await until(() => saves(source).length === 1);
    const [save] = saves(source);
    expect(save).toMatchObject({ id: 2, partial: true, values: { price: 3000, per_hour: 3000 } });
    expect(Object.keys(save.fields).sort()).toEqual(['per_hour', 'price']);
    expect(save.version?.token).toBeTruthy();
    await until(() => !row(host, 2).hasAttribute('data-changed'));
    expect(source.records['service']['2']['price']).toBe(3000);
    expect(cell(host, 2, 'price').textContent).toContain('3,000');
  });

  it('leaves a row saved as it was left as saved: Ctrl+Z takes no saved cell back — the row is changed again, as it was (0.31)', async () => {
    const source = createMemoryDataSource({ records: records(), versions: true });
    const host = await mount({ dataSource: source });
    cell(host, 2, 'price').click();
    await until(() => cell(host, 2, 'price').querySelector('input'));
    type(cell(host, 2, 'price'), '3000');
    leaveTo(cell(host, 3, 'name'));
    await until(() => saves(source).length === 1);
    await until(() => !row(host, 2).hasAttribute('data-changed'));
    // The keys pressed where the person is, as Ctrl+Z, and on the list itself: nothing written, nothing taken back.
    for (const target of [document.activeElement ?? host, host.querySelector('.fd-list') as Element]) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise((done) => setTimeout(done, 20));
    }
    expect(saves(source)).toHaveLength(1);
    expect(source.records['service']['2']['price']).toBe(3000);
    expect(cell(host, 2, 'price').textContent).toContain('3,000');
    expect(handle?.form.history().undo).toBeNull();
  });

  it('chooses a cell’s whole value as a press, Enter or Tab opens it, so typing replaces it; F2 puts the caret after it', async () => {
    // The owner's walk of 0.29: a press left the caret after "2,800", and 3000 typed saved 28,003,000.
    const notes: Page = { ...prices, fields: { ...prices.fields, notes: { type: 'text', label: 'Notes' } }, layout: { ...prices.layout, columns: ['name', 'minutes', 'price', 'notes'] } as Page['layout'] };
    const host = await mount({ dataSource: createMemoryDataSource({ records: { service: { 2: { ...records().service[2], notes: 'Twice a month' } } }, versions: true }) }, notes);
    const chosen = () => {
      const box = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      return [box.value, box.selectionStart, box.selectionEnd];
    };
    const keys = (key: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    cell(host, 2, 'price').click();
    await until(() => cell(host, 2, 'price').querySelector('input'));
    // A number's box shows its digits ungrouped as it is entered: all of them chosen.
    await until(() => chosen()[0] === '2800.00');
    expect(chosen()).toEqual(['2800.00', 0, 7]);
    // Tab, on to the next cell: a text of several lines, chosen whole too.
    keys('Tab');
    await until(() => cell(host, 2, 'notes').querySelector('textarea'));
    expect(chosen()).toEqual(['Twice a month', 0, 13]);
    // F2 in it: the caret after its value, to change within it.
    keys('F2');
    expect(chosen()).toEqual(['Twice a month', 13, 13]);
    keys('Escape');
    expect(document.activeElement).toBe(cell(host, 2, 'notes'));
    // F2 on a cell at rest: opened with the caret after its value; Enter: chosen whole.
    cell(host, 2, 'name').focus();
    keys('F2');
    await until(() => cell(host, 2, 'name').querySelector('input'));
    expect(chosen()).toEqual(['Hydrafacial', 11, 11]);
    keys('Escape');
    keys('Enter');
    await until(() => cell(host, 2, 'name').querySelector('input'));
    expect(chosen()).toEqual(['Hydrafacial', 0, 11]);
  });

  it('keeps a row its page refuses as typed, says why under it, and puts it back on Put back', async () => {
    const source = createMemoryDataSource({ records: records(), versions: true });
    const host = await mount({ dataSource: source });
    cell(host, 1, 'minutes').click();
    await until(() => cell(host, 1, 'minutes').querySelector('input'));
    type(cell(host, 1, 'minutes'), '2');
    leaveTo(cell(host, 3, 'name'));
    const note = () => row(host, 1).nextElementSibling as HTMLElement;
    await until(() => note().classList.contains('fd-list-note') && !note().hidden);
    expect(note().querySelector('.fd-list-note-words')?.textContent).toBe('Not saved: Minutes must be at least 5.');
    expect(cell(host, 1, 'minutes').textContent).toBe('2');
    expect(cell(host, 1, 'minutes').getAttribute('aria-invalid')).toBe('true');
    // A value worked out from an answer refused waits, said in words.
    expect(cell(host, 1, 'per_hour').textContent).toBe('—Fix Minutes to see Per hour');
    expect(saves(source)).toEqual([]);
    (note().querySelector('.fd-list-put-back') as HTMLButtonElement).click();
    expect(cell(host, 1, 'minutes').textContent).toBe('45');
    expect(row(host, 1).nextElementSibling?.classList.contains('fd-list-note')).toBe(false);
  });

  it('says why the source refused a row, under it', async () => {
    const source = createMemoryDataSource({ records: records() });
    const save = source.save.bind(source);
    source.save = async (request) => (request.changes.values['price'] === 9999 ? Promise.reject(saveRefused({ kind: 'rule', message: 'Prices over 5,000 need the manager.' })) : save(request));
    const host = await mount({ dataSource: source });
    cell(host, 3, 'price').click();
    await until(() => cell(host, 3, 'price').querySelector('input'));
    type(cell(host, 3, 'price'), '9999');
    leaveTo(cell(host, 1, 'name'));
    await until(() => row(host, 3).nextElementSibling?.querySelector('.fd-list-note-words')?.textContent);
    expect(row(host, 3).nextElementSibling?.querySelector('.fd-list-note-words')?.textContent).toBe('Not saved: Prices over 5,000 need the manager.');
  });

  it('says someone else’s save first under the row, as a record’s page says it', async () => {
    const source = createMemoryDataSource({ records: records(), versions: true });
    const host = await mount({ dataSource: source });
    source.changeElsewhere('service', 2, { price: 2900 }, { by: 'Mona Adel' });
    cell(host, 2, 'minutes').click();
    await until(() => cell(host, 2, 'minutes').querySelector('input'));
    type(cell(host, 2, 'minutes'), '50');
    leaveTo(cell(host, 3, 'name'));
    await until(() => row(host, 2).nextElementSibling?.querySelector('.fd-conflict:not([hidden])'));
    expect(row(host, 2).nextElementSibling?.querySelector('.fd-conflict-title')?.textContent).toMatch(/^Mona Adel changed this service/);
  });

  it('leaves a row its record lets no one change here as it was, and opens it as a list’s row', async () => {
    const opened: unknown[] = [];
    const source = createMemoryDataSource({ records: records(), can: { service: (values) => (values['code'] === 'MN' ? { edit: false, reason: 'Kept by the manager.' } : undefined) } });
    const host = await mount({ dataSource: source, onOpenRecord: (id) => void opened.push(id) });
    expect(row(host, 3).querySelectorAll('td[data-edit]')).toHaveLength(0);
    cell(host, 3, 'price').click();
    expect(opened).toEqual([3]);
    // A cell that cannot change opens the record, as before; one that can is opened for typing.
    cell(host, 1, 'code').click();
    cell(host, 1, 'name').click();
    expect(opened).toEqual([3, 1]);
  });

  it('marks a row its record lets no one change with a lock, and says why as it is pressed where no app opens records', async () => {
    // The owner's walk of 0.29: the won stage looked like the others, and a press on it did nothing, saying nothing.
    const can = (reason?: string) => ({ service: (values: Record<string, unknown>) => (values['code'] === 'MN' ? { edit: false, ...(reason ? { reason } : {}) } : undefined) });
    let host = await mount({ dataSource: createMemoryDataSource({ records: records(), can: can('Kept by the manager.') }) });
    const lock = () => row(host, 3).querySelector('td[data-col] .fd-list-lock');
    expect(lock()?.getAttribute('title')).toBe('Kept by the manager.');
    expect(lock()?.getAttribute('aria-label')).toBe('Kept by the manager.');
    expect(host.querySelectorAll('.fd-list-lock')).toHaveLength(1);
    // In the row's first cell shown, its words after it.
    expect(row(host, 3).querySelector('td[data-col]')?.firstElementChild).toBe(lock());
    const said = () => row(host, 3).nextElementSibling as HTMLElement | null;
    cell(host, 3, 'price').click();
    expect(cell(host, 3, 'price').querySelector('input')).toBeNull();
    expect(said()?.classList.contains('fd-list-note')).toBe(true);
    expect(said()?.hidden).toBe(false);
    expect(said()?.textContent).toBe('Kept by the manager.');
    expect(host.querySelector('.fd-list-adds span[role="status"]')?.textContent).toBe('Kept by the manager.');
    // A press elsewhere: it goes.
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(said()?.hidden).toBe(true);
    handle?.destroy();
    document.body.replaceChildren();
    // No reason given: said in the words the list's records go by.
    host = await mount({ dataSource: createMemoryDataSource({ records: records(), can: can() }) });
    expect(lock()?.getAttribute('title')).toBe('This service can’t be changed here');
    row(host, 3).focus();
    row(host, 3).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(said()?.textContent).toBe('This service can’t be changed here');
  });

  it('adds a row at the end, saved as a new record once it is left; one left empty goes', async () => {
    const source = createMemoryDataSource({ records: records() });
    const host = await mount({ dataSource: source });
    (host.querySelector('.fd-list-add') as HTMLButtonElement).click();
    const added = () => host.querySelector('.fd-list-row[data-new]') as HTMLTableRowElement;
    await until(() => added()?.querySelector('td[data-col="name"] input'));
    type(added().querySelector('td[data-col="name"]') as HTMLElement, 'Laser, back');
    leaveTo(cell(host, 1, 'name'));
    await until(() => saves(source).length === 1);
    expect(saves(source)[0]).toMatchObject({ id: null, values: { name: 'Laser, back' } });
    await until(() => !added() && row(host, 4));
    expect(cell(host, 4, 'name').textContent).toBe('Laser, back');
    (host.querySelector('.fd-list-add') as HTMLButtonElement).click();
    await until(() => added()?.querySelector('td[data-col="name"] input'));
    leaveTo(cell(host, 1, 'name'));
    await until(() => !added());
    expect(saves(source)).toHaveLength(1);
  });

  it('opens a row added at the first cell a new record needs — required and empty, in the columns’ order — else its first', async () => {
    // The owner's walk of 0.29: a stage's name typed in Order, the first cell, and refused as no number.
    const ordered: Page = { ...prices, layout: { ...prices.layout, columns: ['minutes', 'name', 'price'] } as Page['layout'] };
    const opened = async (page: Page) => {
      const host = await mount({}, page);
      (host.querySelector('.fd-list-add') as HTMLButtonElement).click();
      await until(() => host.querySelector('.fd-list-row[data-new] td[data-editing]'));
      const column = host.querySelector('.fd-list-row[data-new] td[data-editing]')?.getAttribute('data-col');
      handle?.destroy();
      handle = null;
      document.body.replaceChildren();
      return column;
    };
    expect(await opened(ordered)).toBe('name');
    // Nothing a new record needs: its first cell that changes.
    expect(await opened({ ...ordered, fields: { ...ordered.fields, name: { type: 'char', label: 'Service' } } })).toBe('minutes');
  });

  it('writes rows a paste gave the same change in one writeMany, each with its version', async () => {
    const source = createMemoryDataSource({ records: records(), versions: true });
    const host = await mount({ dataSource: source });
    // The same name in every row: a change nothing else in the row is worked out from.
    const td = cell(host, 1, 'name');
    td.focus();
    td.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
    const catcher = host.querySelector('.fd-list-paste-catcher') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(catcher);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'Facial\nFacial\nFacial\n' } });
    catcher.dispatchEvent(paste);
    // Three rows changed at once: asked first.
    await until(() => document.querySelector('[role="alertdialog"]'));
    expect(document.querySelector('[role="alertdialog"] p')?.textContent).toBe('Change 3 rows with what you pasted?');
    (document.querySelector('[role="alertdialog"] .fd-button-primary') as HTMLButtonElement).click();
    await until(() => source.calls.some((call) => call.method === 'writeMany'));
    const many = source.calls.filter((call) => call.method === 'writeMany').map((call) => call.request as { ids: unknown[]; values: unknown; versions: Record<string, unknown> });
    expect(many).toHaveLength(1);
    expect(many[0].ids).toEqual([1, 2, 3]);
    expect(Object.keys(many[0].versions)).toEqual(['1', '2', '3']);
    await until(() => host.querySelector('.fd-list-paste-words')?.textContent === 'Pasted into 3 cells.');
    expect(Object.values(source.records['service']).map((one) => one['name'])).toEqual(['Facial', 'Facial', 'Facial']);
  });

  it('offers Undo after a paste: the rows changed put back and saved again, those it added taken away; Ctrl+Z the same', async () => {
    const source = createMemoryDataSource({ records: records(), versions: true });
    const host = await mount({ dataSource: source });
    const pasteOn = (td: HTMLElement, text: string) => {
      td.focus();
      td.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: () => text } });
      (host.querySelector('.fd-list-paste-catcher') as HTMLTextAreaElement).dispatchEvent(paste);
    };
    // Two rows: one on the last service, one added past it.
    pasteOn(cell(host, 3, 'minutes'), '50\t3300\n30\t1500\n');
    await until(() => document.querySelector('[role="alertdialog"]'));
    expect(document.querySelector('[role="alertdialog"] p')?.textContent).toBe('Paste 2 rows: change 1 and add 1?');
    // Its Yes says what it does (the owner's walk read OK there).
    expect([...document.querySelectorAll('[role="alertdialog"] button')].map((one) => one.textContent)).toEqual(['Cancel', 'Paste 2 rows']);
    (document.querySelector('[role="alertdialog"] .fd-button-primary') as HTMLButtonElement).click();
    // The row added has no name: refused, said under it (one row alone says its own).
    await until(() => source.records['service']['3']['price'] === 3300 && host.querySelector('.fd-list-undo:not([hidden])'));
    expect(host.querySelectorAll('.fd-list-row[data-new]')).toHaveLength(1);
    (host.querySelector('.fd-list-undo') as HTMLButtonElement).click();
    await until(() => source.records['service']['3']['price'] === 3200 && !host.querySelector('.fd-list-row[data-new]'));
    expect(source.records['service']['3']['minutes']).toBe(60);
    expect(host.querySelector('.fd-list-paste-words')?.textContent).toBe('Paste undone.');
    // One cell, no question; Ctrl+Z right after it, on the list.
    pasteOn(cell(host, 1, 'price'), '2500');
    await until(() => source.records['service']['1']['price'] === 2500);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    await until(() => host.querySelector('.fd-list-undo:not([hidden])'));
    cell(host, 1, 'price').dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    await until(() => source.records['service']['1']['price'] === 2200);
  });

  it('is read and opened as ever without `editable`, or where the source cannot save', async () => {
    const plain: Page = { ...prices, layout: { ...prices.layout, editable: undefined } as Page['layout'] };
    let host = await mount({}, plain);
    expect(host.querySelectorAll('td[data-edit]')).toHaveLength(0);
    expect(host.querySelector('.fd-list-add')).toBeNull();
    handle?.destroy();
    document.body.replaceChildren();
    const source = createMemoryDataSource({ records: records() }) as unknown as Record<string, unknown>;
    delete source['save'];
    host = await mount({ dataSource: source as never });
    expect(host.querySelectorAll('td[data-edit]')).toHaveLength(0);
    expect(host.querySelector('.fd-list-add')).toBeNull();
  });

  it('asks for its part and its cells’ boxes’ parts before it is drawn, and for what its worked-out columns read', () => {
    const linked: Page = { ...prices, fields: { ...prices.fields, done_by: { type: 'many2one', label: 'Done by', relation: 'role' } }, layout: { ...prices.layout, columns: ['name', 'done_by'] } as Page['layout'] };
    expect(partsFor(linked)).toEqual(expect.arrayContaining([editablePart, relationsPart]));
    expect(partsFor({ ...linked, layout: { ...linked.layout, editable: undefined } as Page['layout'] })).not.toContain(editablePart);
    const list = { ...prices.layout, columns: ['name', 'per_hour'] } as never;
    expect(rowReads(prices, list, ['name', 'per_hour'])).toEqual(['price', 'minutes']);
  });
});
