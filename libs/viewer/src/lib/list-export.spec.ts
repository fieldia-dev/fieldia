import { createMemoryDataSource, type ExportRequest, type ListRequest, type Page } from '@fieldia/core';
import { VIEWER_LABELS } from './labels';
import { csvOf, csvSeparator, exportList, exportName, serialDay } from './list-export';
import { until } from './test-list';
import { unzip } from './test-unzip';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Export, in a list's bar: the rows ticked, or every record the search finds,
 * as an Excel workbook or a CSV file — the columns as the list shows them, in
 * its order, under a header row, each value as a person reads it there (a
 * date, money with its currency, a choice by its label), in a file named
 * after the list and the day. Hidden with `"export": false`; written on the
 * server where the source has `exportRecords`.
 */

const contacts: Page = {
  fieldia: '0.8',
  id: 'contacts',
  title: 'Contacts',
  data: { kind: 'record', model: 'contact' },
  fields: {
    name: { type: 'char', label: 'Name' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }] },
    since: { type: 'date', label: 'Since' },
    seen: { type: 'datetime', label: 'Last seen' },
    credit: { type: 'monetary', label: 'Credit, limit', currencyField: 'currency_id' },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' },
    news: { type: 'boolean', label: 'Newsletter' },
    orders: { type: 'integer', label: 'Orders' },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'state', 'since', 'seen', 'credit', 'news', 'orders'], sort: [{ field: 'name' }], pageSize: 2, export: true },
};
const people = () =>
  createMemoryDataSource({
    records: {
      contact: {
        1: { name: 'Nile Traders', state: 'customer', since: '2024-03-05', seen: '2026-10-15 14:30:00', credit: 250000, currency_id: { id: 1, label: 'EGP' }, news: true, orders: 1284 },
        2: { name: 'Amira "AC" Clinics', state: 'lead', since: null, seen: null, credit: 18000, currency_id: { id: 2, label: 'JOD' }, news: false, orders: 0 },
        3: { name: 'Petra, Tours', state: 'customer', since: '2025-12-31', seen: null, credit: null, currency_id: null, news: null, orders: 7 },
      },
    },
  });

let handle: ViewerHandle | null = null;
let saved: { name: string; href: string; blob?: Blob }[] = [];
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
    saved.push({ name: this.download, href: this.getAttribute('href') ?? '', blob: blobs.get(this.getAttribute('href') ?? '') });
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
  handle = mountViewer(host, { page, dataSource: people(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')] as HTMLTableRowElement[];
const exportButton = (host: Element) => host.querySelector('.fd-list-export-button') as HTMLButtonElement;
const menu = (host: Element) => host.querySelector('.fd-list-export-menu') as HTMLElement;
const bytes = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
// Its mark that says UTF-8 kept, as a spreadsheet program reads it.
const text = async (blob: Blob) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await bytes(blob));
async function exportAs(host: Element, format: 'xlsx' | 'csv') {
  exportButton(host).click();
  (menu(host).querySelector(`[data-format="${format}"]`) as HTMLButtonElement).click();
  await until(() => saved.length > 0 && !exportButton(host).hasAttribute('aria-busy'));
  return saved[saved.length - 1];
}

describe('a list’s export', () => {
  it('writes every record the search finds as CSV: the columns in order under a header, a spreadsheet’s numbers and days', async () => {
    const host = await mount();
    exportButton(host).click();
    expect(menu(host).hidden).toBe(false);
    expect(menu(host).querySelector('.fd-list-export-what')?.textContent).toBe('All 3 that match');
    expect([...menu(host).querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual(['Excel (.xlsx)', 'CSV (.csv)']);
    exportButton(host).click();
    const file = await exportAs(host, 'csv');
    expect(file.name).toMatch(/^Contacts \d{4}-\d{2}-\d{2}\.csv$/);
    expect(file.blob?.type).toBe('text/csv;charset=utf-8');
    const csv = await text(file.blob as Blob);
    // Amounts and counts as a spreadsheet adds them — digits and a point, no grouping, no sign — each amount's currency in
    // a column of its own beside it; days and times as ISO writes them, on the clock the list shows.
    expect(csv.split('\r\n')).toEqual([
      '\ufeffName,Status,Since,Last seen,"Credit, limit","Credit, limit currency",Newsletter,Orders',
      '"Amira ""AC"" Clinics",Lead,,,18000.000,JOD,No,0',
      'Nile Traders,Customer,2024-03-05,2026-10-15 14:30,250000.00,EGP,Yes,1284',
      '"Petra, Tours",Customer,2025-12-31,,,,,7',
      '',
    ]);
    expect(handle?.element.querySelector('.fd-toast, [role="status"]')).not.toBeNull();
  });

  it('writes a decimal comma where the language does, as a spreadsheet there reads numbers; one currency in the header', async () => {
    const page = { ...contacts, fields: { ...contacts.fields, credit: { type: 'monetary', label: 'Credit', currency: 'EUR' } } } as Page;
    const host = await mount({ locale: 'de' }, page);
    const csv = await text((await exportAs(host, 'csv')).blob as Blob);
    expect(csv.split('\r\n')).toEqual([
      '\ufeffName;Status;Since;Last seen;Credit (EUR);Newsletter;Orders',
      '"Amira ""AC"" Clinics";Lead;;;18000,00;Nein;0',
      'Nile Traders;Customer;2024-03-05;2026-10-15 14:30;250000,00;Ja;1284',
      'Petra, Tours;Customer;2025-12-31;;;;7',
      '',
    ]);
  });

  it('writes the rows ticked alone, in the list’s order, when some are', async () => {
    const source = people();
    const host = await mount({ dataSource: source });
    for (const row of rows(host)) (row.querySelector('.fd-list-checkbox') as HTMLInputElement).click();
    exportButton(host).click();
    expect(menu(host).querySelector('.fd-list-export-what')?.textContent).toBe('2 selected');
    exportButton(host).click();
    const csv = await text((await exportAs(host, 'csv')).blob as Blob);
    expect(csv.split('\r\n').map((line) => line.split(',')[0])).toEqual(['\ufeffName', '"Amira ""AC"" Clinics"', 'Nile Traders', '']);
    // Asked for by their ids.
    const asked = source.calls.map((call) => call.request as ListRequest).filter((request) => JSON.stringify(request.filter).includes('"in"'));
    expect(asked[0].filter).toEqual([{ field: 'id', op: 'in', value: [2, 1] }]);
  });

  it('writes an Excel workbook: numbers, money and days as numbers in the format the list reads them in', async () => {
    const host = await mount();
    const file = await exportAs(host, 'xlsx');
    expect(file.name).toMatch(/^Contacts \d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(file.blob?.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const files = unzip(await bytes(file.blob as Blob));
    const sheet = files.get('xl/worksheets/sheet1.xml') as string;
    const styles = files.get('xl/styles.xml') as string;
    const cells = [...sheet.matchAll(/<c r="([A-Z]+\d+)"(?: t="inlineStr")?(?: s="(\d+)")?>(?:<is><t[^>]*>([^<]*)<\/t><\/is>|<v>([^<]*)<\/v>)<\/c>/g)].map(([, ref, style, words, number]) => [ref, words ?? Number(number), style ? Number(style) : 0]);
    // The cells' formats, past the one style cells are made from.
    const formats = [...styles.matchAll(/<xf numFmtId="(\d+)"[^>]*\/>/g)].slice(1).map(([, id]) => Number(id));
    const own = Object.fromEntries([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].map(([, id, code]) => [Number(id), code.replace(/&quot;/g, '"')]));
    const formatOf = (style: number) => (style < 2 ? null : own[formats[style]] ?? formats[style]);
    const row = (n: number) => cells.filter(([ref]) => String(ref).replace(/[A-Z]+/, '') === String(n)).map(([ref, value, style]) => [ref, value, formatOf(style as number)]);
    expect(row(1).map(([, value]) => value)).toEqual(['Name', 'Status', 'Since', 'Last seen', 'Credit, limit', 'Newsletter', 'Orders']);
    expect(row(2)).toEqual([
      ['A2', 'Amira &quot;AC&quot; Clinics', null],
      ['B2', 'Lead', null],
      ['E2', 18000, '"JOD" #,##0.000'],
      ['F2', 'No', null],
      ['G2', 0, 3],
    ]);
    expect(row(3)).toEqual([
      ['A3', 'Nile Traders', null],
      ['B3', 'Customer', null],
      ['C3', serialDay('2024-03-05'), 'd mmm yyyy'],
      ['D3', serialDay('2026-10-15 14:30:00'), 'd mmm yyyy hh:mm'],
      ['E3', 250000, '"E£" #,##0.00'],
      ['F3', 'Yes', null],
      ['G3', 1284, 3],
    ]);
    expect(serialDay('2024-03-05')).toBe(45356);
    expect(serialDay('2026-10-15 14:30:00')).toBeCloseTo(46310 + 14.5 / 24, 9);
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Contacts"');
  });

  it('writes a time on the clock the list shows it on, in the workbook as in the CSV file: a sheet holds no zone', async () => {
    // Seen at 05:30 UTC, in Tokyo (no summer time): 14:30 on the list's clock, and in both files.
    const page = { ...contacts, fields: { ...contacts.fields, seen: { type: 'datetime', label: 'Last seen', timeZone: 'Asia/Tokyo' } } } as Page;
    const records = { 1: { name: 'Nile Traders', state: 'customer', seen: '2026-10-15T05:30:00.000Z', orders: 1 } };
    const host = await mount({ dataSource: createMemoryDataSource({ records: { contact: records } }) }, page);
    const sheet = unzip(await bytes((await exportAs(host, 'xlsx')).blob as Blob)).get('xl/worksheets/sheet1.xml') as string;
    const seen = Number(/<c r="D2"[^>]*><v>([^<]*)<\/v><\/c>/.exec(sheet)?.[1]);
    expect(seen).toBeCloseTo(serialDay('2026-10-15 14:30:00') as number, 9);
    const csv = await text((await exportAs(host, 'csv')).blob as Blob);
    expect(csv.split('\r\n')[1]).toContain(',2026-10-15 14:30,');
  });

  it('says how far it has got while it asks a page at a time, and that it is done', async () => {
    const said: string[] = [];
    const host = await mount({ host: { say: (message) => void said.push(message) } });
    exportButton(host).click();
    (menu(host).querySelector('[data-format="csv"]') as HTMLButtonElement).click();
    expect(host.querySelector('.fd-list-progress')?.textContent).toBe('Exporting 0 of 3…');
    await until(() => said.length > 0);
    expect(said).toEqual(['3 records exported.']);
    expect(host.querySelector('.fd-list-progress')?.textContent).toBe('');
  });

  it('is written by the source, where it writes the file itself: its bytes, its address or its words', async () => {
    const asked: ExportRequest[] = [];
    const said: string[] = [];
    const source = people();
    let answer: Awaited<ReturnType<NonNullable<typeof source.exportRecords>>> = { name: 'From the server.csv', data: 'a,b\r\n', type: 'text/csv' };
    source.exportRecords = async (request) => {
      asked.push(request);
      return answer;
    };
    const host = await mount({ dataSource: source, host: { say: (message) => void said.push(message) } });
    const file = await exportAs(host, 'csv');
    expect(file.name).toBe('From the server.csv');
    expect(await text(file.blob as Blob)).toBe('a,b\r\n');
    expect(asked[0]).toMatchObject({
      model: 'contact',
      format: 'csv',
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'state', label: 'Status' },
        { field: 'since', label: 'Since' },
        { field: 'seen', label: 'Last seen' },
        { field: 'credit', label: 'Credit, limit' },
        { field: 'news', label: 'Newsletter' },
        { field: 'orders', label: 'Orders' },
      ],
      filter: [],
      sort: [{ field: 'name' }],
      count: 3,
      locale: 'en',
      name: expect.stringMatching(/^Contacts \d{4}-\d{2}-\d{2}\.csv$/),
    });
    expect(asked[0]).not.toHaveProperty('ids');
    // Its address, saved as it is.
    answer = { name: 'Contacts.xlsx', url: 'https://files.example/contacts.xlsx' };
    expect(await exportAs(host, 'xlsx')).toMatchObject({ name: 'Contacts.xlsx', href: 'https://files.example/contacts.xlsx' });
    // Handed over its own way: its words said, nothing saved.
    answer = { message: 'The file will be emailed to you.' };
    const before = saved.length;
    exportButton(host).click();
    (menu(host).querySelector('[data-format="xlsx"]') as HTMLButtonElement).click();
    await until(() => said.includes('The file will be emailed to you.'));
    expect(saved.length).toBe(before);
    // False: written in the browser after all.
    answer = false;
    const csv = await text((await exportAs(host, 'csv')).blob as Blob);
    expect(csv.startsWith('\ufeffName,Status')).toBe(true);
  });

  it('writes the first so many past the most a browser writes, and says so', async () => {
    const source = people();
    const list = source.list.bind(source);
    const most: { done: number; total: number }[] = [];
    const file = await exportList(
      { model: 'contact', title: 'Contacts', fields: contacts.fields, columns: ['name'], reads: ['name'], dataSource: source, locale: 'en', labels: VIEWER_LABELS.en, doc: document, words: (name, values) => String(values[name]), rtl: false },
      { filter: [], sort: [{ field: 'name' }], count: 3 },
      'csv',
      (done, total) => void most.push({ done, total }),
      new Date(2026, 9, 16),
      2
    );
    expect(file).toEqual({ done: 2, total: 3 });
    expect(await text(saved[0].blob as Blob)).toBe('\ufeffName\r\n"Amira ""AC"" Clinics"\r\nNile Traders\r\n');
    // In the list, its words: a source that tells more than it gives stands for one past the most.
    const said: string[] = [];
    source.list = async (request) => ({ ...(await list(request)), total: 60000 });
    const host = await mount({ dataSource: source, host: { say: (message) => void said.push(message) } });
    exportButton(host).click();
    (menu(host).querySelector('[data-format="csv"]') as HTMLButtonElement).click();
    await until(() => said.length > 0);
    expect(said).toEqual(['Only the first 3 of 60,000 were exported.']);
  });

  it('says why it could not', async () => {
    const said: string[] = [];
    const source = people();
    const host = await mount({ dataSource: source, host: { say: (message) => void said.push(message) } });
    source.list = async () => {
      throw new Error('offline');
    };
    exportButton(host).click();
    (menu(host).querySelector('[data-format="csv"]') as HTMLButtonElement).click();
    await until(() => said.length > 0);
    expect(said).toEqual(['Could not export the records.']);
  });

  it('writes every record that matches from a list under groups, whose rows are its groups', async () => {
    const host = await mount({}, { ...contacts, layout: { ...contacts.layout, groupBy: ['state'] } as Page['layout'] });
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    const groupBy = [...host.querySelectorAll<HTMLButtonElement>('[data-group-kind="groupBy"] .fd-search-option')].find((option) => option.textContent === 'Status') as HTMLButtonElement;
    groupBy.click();
    await until(() => host.querySelector('.fd-list-group'));
    exportButton(host).click();
    expect(menu(host).querySelector('.fd-list-export-what')?.textContent).toBe('All 3 that match');
    exportButton(host).click();
    const csv = await text((await exportAs(host, 'csv')).blob as Blob);
    expect(csv.split('\r\n')).toHaveLength(5);
  });

  it('is off unless the page asks for it (export: true), as Edit is, and where the source can neither list nor export', async () => {
    const { export: _, ...plain } = contacts.layout as Page['layout'] & { export?: boolean };
    const host = await mount({}, { ...contacts, layout: plain as Page['layout'] });
    expect(exportButton(host).closest('.fd-list-export')?.hasAttribute('hidden')).toBe(true);
    handle?.destroy();
    const off = await mount({}, { ...contacts, layout: { ...contacts.layout, export: false } as Page['layout'] });
    expect(exportButton(off).closest('.fd-list-export')?.hasAttribute('hidden')).toBe(true);
  });

  it('opens its menu from the keys, goes through it with the arrows, and gives the focus back on Escape', async () => {
    const host = await mount();
    exportButton(host).focus();
    exportButton(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const items = [...menu(host).querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu(host).hidden).toBe(true);
    expect(document.activeElement).toBe(exportButton(host));
    expect(exportButton(host).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the file an export writes', () => {
  it('quotes in CSV only what needs it, a line break between rows, marked as UTF-8', () => {
    expect(csvOf([['a', 'b,c', 'd"e', ' f', 'g\nh']])).toBe('\ufeffa,"b,c","d""e"," f","g\nh"\r\n');
    expect(csvOf([['1,5', 'x;y']], ';')).toBe('\ufeff1,5;"x;y"\r\n');
  });

  it('parts CSV values with a semicolon where the language writes a decimal comma', () => {
    expect((['en', 'ar', 'de', 'fr'] as const).map((locale) => csvSeparator(locale))).toEqual([',', ',', ';', ';']);
  });

  it('is named after the list and the day, with nothing a file name cannot hold', () => {
    expect(exportName('Customers', 'xlsx', new Date(2026, 9, 6))).toBe('Customers 2026-10-06.xlsx');
    expect(exportName('Sales: Q3/Q4 *draft*', 'csv', new Date(2026, 0, 1))).toBe('Sales Q3 Q4 draft 2026-01-01.csv');
  });
});

describe('Export, on a page that names its records', () => {
  it('says them in what goes, and what it did', async () => {
    const said: string[] = [];
    const host = await mount({ host: { say: (message) => void said.push(message) } }, { ...contacts, records: { one: 'contact', other: 'contacts', a: 'a contact' } });
    exportButton(host).click();
    expect(menu(host).querySelector('.fd-list-export-what')?.textContent).toBe('All 3 contacts that match');
    (menu(host).querySelector('[data-format="csv"]') as HTMLButtonElement).click();
    await until(() => said.length > 0);
    expect(said).toEqual(['3 contacts exported.']);
  });
});
