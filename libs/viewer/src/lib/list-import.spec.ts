import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DecompressionStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { createMemoryDataSource, saveRefused, type CreateManyRequest, type MemoryDataSource, type Page } from '@fieldia/core';
import type { PickedFile } from './import-file';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A list's Import, as a person goes through it: Import pressed, a file chosen
 * or dropped, its columns matched to the page's fields (a picker for each),
 * its rows checked — those refused named with why and downloadable to fix,
 * the first shown as they will be saved — then written by `createMany` or a
 * save of each, stopped if asked; and the list saying how it ended, with
 * Undo, which deletes what it made. Offered only where the page asks and the
 * source can make records.
 */

// jsdom has none of these, which every browser has: Node's, for the tests.
Object.assign(globalThis, { TextEncoder, TextDecoder, DecompressionStream });

const contacts: Page = {
  fieldia: '0.5',
  id: 'contacts',
  title: 'Contacts',
  data: { kind: 'record', model: 'contact' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    company: { type: 'char', label: 'Company' },
    email: { type: 'char', label: 'Email' },
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    state: { type: 'selection', label: 'Status', required: true, options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }, { value: 'inactive', label: 'Inactive' }, { value: 'blocked', label: 'Blocked' }] },
    owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' },
    last_order: { type: 'date', label: 'Last order' },
    newsletter: { type: 'boolean', label: 'Newsletter' },
    lifetime_value: { type: 'monetary', label: 'Lifetime value', currency: 'EGP', readonly: true },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'company', 'country_id', 'state'], sort: [{ field: 'name' }], pageSize: 5, import: true },
};
const records = () => ({
  contact: { 1: { name: 'Sara Haddad', company: 'Petra Tours', state: 'customer' } },
  country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Saudi Arabia' } },
  // Two users of one name, as the demo has: a row naming that owner is refused, never given the first.
  'res.users': { 9001: { name: 'Mona Adel' }, 9002: { name: 'Omar Said' }, 9003: { name: 'Sara Haddad' }, 9004: { name: 'Karim Nasser' }, 9005: { name: 'Lina Khalil' }, 4104: { name: 'Omar Said' } },
});
const SAMPLES = join(__dirname, '../../../../demos/samples');

let handle: ViewerHandle | null = null;
let saved: { name: string; blob?: Blob }[] = [];
const blobs = new Map<string, Blob>();
beforeEach(() => {
  saved = [];
  let made = 0;
  // A browser saves a file a link names; jsdom has no such thing: what would be saved is kept here.
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${++made}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ name: this.download, blob: blobs.get(this.getAttribute('href') ?? '') });
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = contacts) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: records() }), confirm: async () => true, ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const file = (bytes: Uint8Array | string, name: string): PickedFile => {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return { name, size: data.length, type: '', arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
};
const sample = (name: string) => file(new Uint8Array(readFileSync(join(SAMPLES, name))), name);
const importButton = (host: Element) => host.querySelector('.fd-list-import-button') as HTMLButtonElement;
const dialog = () => document.querySelector('.fd-import') as HTMLElement | null;
const button = (words: string | RegExp) => [...(dialog() as HTMLElement).querySelectorAll<HTMLButtonElement>('button')].find((one) => !one.hidden && (typeof words === 'string' ? one.textContent === words : words.test(one.textContent ?? ''))) as HTMLButtonElement;
const columns = () => [...(dialog() as HTMLElement).querySelectorAll<HTMLSelectElement>('.fd-import-columns select')];
const goesInto = () => columns().map((select) => [select.closest('tr')?.querySelector('th')?.textContent, select.value]);
/** A file chosen in the dialog's box, as the browser hands it over. */
async function choose(picked: PickedFile) {
  const input = (dialog() as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [picked], configurable: true });
  input.dispatchEvent(new Event('change'));
  await until(() => dialog()?.querySelector('.fd-import-columns') ?? dialog()?.querySelector('.fd-import-problem:not([hidden])'));
}
const pick = (header: string, field: string) => {
  const select = columns().find((one) => one.closest('tr')?.querySelector('th')?.textContent === header) as HTMLSelectElement;
  select.value = field;
  select.dispatchEvent(new Event('change'));
};
async function open(host: Element) {
  importButton(host).click();
  await until(() => dialog());
}
async function checkRows() {
  button(/^Check /).click();
  await until(() => dialog()?.querySelector('.fd-import-ready'));
}
async function importRows(host: Element) {
  button(/^Import \d/).click();
  await until(() => !dialog() && !importButton(host).hasAttribute('aria-busy'));
}
const report = (host: Element) => host.querySelector('.fd-list-report') as HTMLElement;

describe('Import, offered', () => {
  it('in the list’s bar where the page asks and the source can make records; hidden otherwise', async () => {
    let host = await mount();
    expect(importButton(host).hidden).toBe(false);
    expect(importButton(host).textContent).toBe('Import');
    handle?.destroy();
    host = await mount({}, { ...contacts, layout: { ...contacts.layout, import: undefined } } as Page);
    expect(importButton(host).hidden).toBe(true);
    handle?.destroy();
    const source = createMemoryDataSource({ records: records() });
    delete (source as Partial<MemoryDataSource>).save;
    delete (source as Partial<MemoryDataSource>).createMany;
    host = await mount({ dataSource: source });
    expect(importButton(host).hidden).toBe(true);
  });
});

describe('Import, a workbook as Excel writes one', () => {
  it('matches its columns, says what is left out and what is needed, and lets the person pick', async () => {
    const host = await mount();
    await open(host);
    expect(dialog()?.getAttribute('role')).toBe('dialog');
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Import into Contacts');
    expect(dialog()?.querySelector('.fd-import-drop')?.textContent).toContain('Drop an Excel or CSV file here');
    await choose(sample('contacts-to-import.xlsx'));
    expect(dialog()?.querySelector('.fd-import-file')?.textContent).toBe('contacts-to-import.xlsx: 17 rows');
    expect(goesInto()).toEqual([
      ['Full name', ''],
      ['Company', 'company'],
      ['E-mail', 'email'],
      ['Country', 'country_id'],
      ['Status', 'state'],
      ['Owner', 'owner_id'],
      ['Last order', 'last_order'],
      ['Newsletter', 'newsletter'],
      ['Notes', ''],
    ]);
    // A read-only field is no choice; Leave out is.
    expect([...columns()[0].options].map((option) => option.textContent)).toEqual(['Leave out', 'Name', 'Company', 'Email', 'Country', 'Status', 'Owner', 'Last order', 'Newsletter']);
    const said = () => [...(dialog() as HTMLElement).querySelectorAll('.fd-import-said p')].map((p) => p.textContent);
    expect(said()).toEqual(['Left out: Full name, Notes', 'Name is required, and no column fills it: every row would be refused.']);
    pick('Full name', 'name');
    expect(said()).toEqual(['Left out: Notes']);
    // A field comes from one column: picked for another, the first lets it go, and says so.
    pick('Notes', 'company');
    expect(said()).toEqual(['Company comes from “Notes” now; “Company” is left out.', 'Left out: Company']);
    expect(goesInto()[1]).toEqual(['Company', '']);
    pick('Notes', '');
    pick('Company', 'company');
    expect(button('Check 17 rows')).toBeTruthy();
  });

  it('checks every row before writing: those refused named with why, the first shown as they will be saved', async () => {
    const host = await mount();
    await open(host);
    await choose(sample('contacts-to-import.xlsx'));
    pick('Full name', 'name');
    await checkRows();
    const body = dialog() as HTMLElement;
    expect(body.querySelector('.fd-import-ready')?.textContent).toBe('10 rows can be imported.');
    expect(body.querySelector('.fd-import-refused > p')?.textContent).toBe('7 rows cannot be imported:');
    expect([...body.querySelectorAll('.fd-import-refused li')].map((li) => li.textContent)).toEqual([
      'Row 11: Owner: more than one is called “Omar Said”',
      'Row 12: Name is required',
      'Row 13: Status: nothing is called “Prospect”',
      'Row 14: Country: nothing is called “Atlantis”',
      'Row 15: Owner: nothing is called “Mona”',
      'Row 16: Last order: February 2026 has 28 days',
      'Row 17: Newsletter: “maybe” is neither yes nor no',
    ]);
    const preview = body.querySelector('.fd-import-preview') as HTMLTableElement;
    expect([...preview.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Name', 'Company', 'Email', 'Country', 'Status', 'Owner', 'Last order', 'Newsletter']);
    expect([...preview.querySelectorAll('tbody tr:first-child td')].map((td) => td.textContent)).toEqual(['Amira Hassan', 'Delta Foods', 'amira.hassan@deltafoods.example', 'Egypt', 'Customer', 'Sara Haddad', '14 Sept 2026', 'Yes']);
    expect(preview.querySelectorAll('tbody tr')).toHaveLength(5);
    // The rows refused, in a workbook like the one read, why in a last column.
    button('Download the rows to fix').click();
    await until(() => saved.length > 0);
    expect(saved[0].name).toBe('contacts-to-import – not imported.xlsx');
  });

  it('writes the good rows by createMany, then says so under the list, which shows them', async () => {
    const source = createMemoryDataSource({ records: records() });
    const host = await mount({ dataSource: source });
    await open(host);
    await choose(sample('contacts-to-import.xlsx'));
    pick('Full name', 'name');
    await checkRows();
    await importRows(host);
    const calls = source.calls.filter((call) => call.method === 'createMany');
    expect(calls).toHaveLength(1);
    expect((calls[0].request as CreateManyRequest).records[0]).toEqual({
      name: 'Amira Hassan',
      company: 'Delta Foods',
      email: 'amira.hassan@deltafoods.example',
      country_id: { id: 1, label: 'Egypt' },
      state: 'customer',
      owner_id: { id: 9003, label: 'Sara Haddad' },
      last_order: '2026-09-14',
      newsletter: true,
    });
    expect(Object.keys(source.records['contact'])).toHaveLength(11);
    expect(report(host).hidden).toBe(false);
    expect(report(host).querySelector('.fd-list-report-words')?.textContent).toBe('10 of 17 records imported. Not imported:');
    expect(report(host).querySelectorAll('li')).toHaveLength(7);
    expect((report(host).querySelector('.fd-list-report-fix') as HTMLElement).hidden).toBe(false);
    expect((report(host).querySelector('.fd-list-report-undo') as HTMLElement).hidden).toBe(false);
    await until(() => host.querySelector('.fd-pager-text')?.textContent === '1–5 / 11');
  });

  it('undoes the import once asked: the records it made deleted, those that cannot be named with why', async () => {
    const source = createMemoryDataSource({ records: records() });
    const asked: string[] = [];
    const said: string[] = [];
    const host = await mount({ dataSource: source, confirm: async (message) => (asked.push(message), true), host: { say: (message) => void said.push(message) } });
    await open(host);
    await choose(sample('contacts-to-import.xlsx'));
    pick('Full name', 'name');
    await checkRows();
    await importRows(host);
    (report(host).querySelector('.fd-list-report-undo') as HTMLButtonElement).click();
    await until(() => said.length > 0);
    expect(asked).toEqual(['Delete the 10 records this import made?']);
    expect(said).toEqual(['Import undone: 10 records deleted.']);
    expect(Object.keys(source.records['contact'])).toEqual(['1']);
    expect(report(host).hidden).toBe(true);
  });
});

describe('Import, a CSV file', () => {
  it('guesses its separator and encoding, reads days in the page’s order and yes or no in Arabic too', async () => {
    const source = createMemoryDataSource({ records: records() });
    delete (source as Partial<MemoryDataSource>).createMany;
    const host = await mount({ dataSource: source });
    await open(host);
    await choose(sample('contacts-to-import.csv'));
    const selects = [...(dialog() as HTMLElement).querySelectorAll<HTMLSelectElement>('.fd-import-how select')];
    expect(selects.map((select) => select.value)).toEqual(['utf-8', ';']);
    expect(goesInto().map(([, field]) => field)).toEqual(['name', 'company', 'email', 'country_id', 'state', 'owner_id', 'last_order', 'newsletter']);
    await checkRows();
    expect([...(dialog() as HTMLElement).querySelectorAll('.fd-import-refused li')].map((li) => li.textContent)).toEqual([
      'Row 8: Status: nothing is called “Customr”',
      'Row 9: Country: nothing is called “Egypte”',
      'Row 10: Last order: months go from 1 to 12',
      'Row 11: Newsletter: “sometimes” is neither yes nor no',
    ]);
    await importRows(host);
    // No createMany: a save of each as a new record.
    expect(source.calls.filter((call) => call.method === 'save')).toHaveLength(6);
    const made = Object.values(source.records['contact']).map((values) => values['name']);
    expect(made).toContain('سلمى العتيبي');
    expect(Object.values(source.records['contact']).find((values) => values['name'] === 'سلمى العتيبي')?.['newsletter']).toBe(true);
    expect(report(host).querySelector('.fd-list-report-words')?.textContent).toBe('6 of 10 records imported. Not imported:');
  });

  it('names the rows the source refuses as it writes, beside those the check refused', async () => {
    const source = createMemoryDataSource({ records: records() });
    source.createMany = async (request) => ({ records: request.records.map((values, i) => (values['name'] === 'Jonas Weber' ? { message: 'This email is someone else’s', problem: saveRefused({ kind: 'fields', message: 'Refused', fields: { email: 'Email is already a contact’s' } }).problem } : { id: 100 + i })) });
    const host = await mount({ dataSource: source });
    await open(host);
    await choose(sample('contacts-to-import.csv'));
    await checkRows();
    await importRows(host);
    expect(report(host).querySelector('.fd-list-report-words')?.textContent).toBe('5 of 10 records imported. Not imported:');
    expect([...report(host).querySelectorAll('li')].map((li) => li.textContent)).toContain('Row 4: Email is already a contact’s');
  });
});

describe('Import, stopped', () => {
  it('stops between two saves once Stop is pressed, and says how many were made', async () => {
    const source = createMemoryDataSource({ records: records() });
    delete (source as Partial<MemoryDataSource>).createMany;
    const save = source.save.bind(source);
    let saves = 0;
    // A slow source, four saves at once: Stop is pressed as the fourth is on its way.
    source.save = async (request) => {
      saves++;
      if (saves === 4) (dialog() as HTMLElement).querySelector<HTMLButtonElement>('.fd-import-foot button:not([hidden])')?.click();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return save(request);
    };
    const host = await mount({ dataSource: source });
    await open(host);
    await choose(sample('contacts-to-import.csv'));
    await checkRows();
    button('Import 6 records').click();
    await until(() => !dialog() && !importButton(host).hasAttribute('aria-busy'));
    // The four saves on their way when Stop came finish; none starts after.
    expect(saves).toBe(4);
    expect(report(host).querySelector('.fd-list-report-words')?.textContent).toBe('Stopped: 4 of 10 records imported.');
  });
});

describe('Import, a file it cannot take', () => {
  it('says why it cannot read one, and lets another be chosen', async () => {
    const host = await mount();
    await open(host);
    await choose(file(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]), 'old.xls'));
    expect(dialog()?.querySelector('.fd-import-problem')?.textContent).toBe('old.xls cannot be read: it is an older Excel file (.xls), or one locked with a password: save it as .xlsx without a password, or as CSV.');
    expect(dialog()?.querySelector('.fd-import-drop')).toBeTruthy();
  });

  it('says plainly a file past the most it reads at once', async () => {
    const host = await mount();
    await open(host);
    await choose(file(`Name\n${Array.from({ length: 50001 }, (_, i) => `Contact ${i}`).join('\n')}\n`, 'everyone.csv'));
    expect(dialog()?.querySelector('.fd-import-problem')?.textContent).toBe('everyone.csv has 50,001 rows: at most 50,000 can be imported here at once. Split it into files of 50,000 rows or fewer.');
  });

  it('hands a file to the source’s own import, which may take one of any size', async () => {
    const source = createMemoryDataSource({ records: records() });
    const asked: unknown[] = [];
    source.importRecords = async (request) => (asked.push({ ...request, file: request.file.name }), { message: 'Your file is being imported: you will get an email.' });
    const said: string[] = [];
    const host = await mount({ dataSource: source, host: { say: (message) => void said.push(message) } });
    await open(host);
    await choose(file(`Name;Email\n${Array.from({ length: 50001 }, (_, i) => `Contact ${i};c${i}@example.com`).join('\n')}\n`, 'everyone.csv'));
    await until(() => button(/^Check /));
    button(/^Check /).click();
    await until(() => !dialog());
    expect(asked).toEqual([{ model: 'contact', file: 'everyone.csv', columns: [{ header: 'Name', field: 'name' }, { header: 'Email', field: 'email' }], rows: 50001, fields: contacts.fields, locale: 'en', dateOrder: 'dmy' }]);
    await until(() => said.length > 0);
    expect(said).toEqual(['Your file is being imported: you will get an email.']);
  });

  it('closes on Escape before anything is written, and gives the focus back to Import', async () => {
    const host = await mount();
    importButton(host).focus();
    await open(host);
    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await until(() => !dialog());
    expect(document.activeElement).toBe(importButton(host));
  });
});

describe('Import, on a page that names its records', () => {
  it('says them on its button, in its report, its Undo’s question and what it undid', async () => {
    const asked: string[] = [];
    const said: string[] = [];
    const host = await mount({ confirm: async (message) => (asked.push(message), true), host: { say: (message) => void said.push(message) } }, { ...contacts, records: { one: 'contact', other: 'contacts', a: 'a contact' } });
    await open(host);
    await choose(sample('contacts-to-import.xlsx'));
    pick('Full name', 'name');
    await checkRows();
    expect(button(/^Import \d/).textContent).toBe('Import 10 contacts');
    await importRows(host);
    expect(report(host).querySelector('.fd-list-report-words')?.textContent).toBe('10 of 17 contacts imported. Not imported:');
    (report(host).querySelector('.fd-list-report-undo') as HTMLButtonElement).click();
    await until(() => said.length > 0);
    expect(asked).toEqual(['Delete the 10 contacts this import made?']);
    expect(said).toEqual(['Import undone: 10 contacts deleted.']);
  });
});
