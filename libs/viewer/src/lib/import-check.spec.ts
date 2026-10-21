import { createForm, createMemoryDataSource, MESSAGES, type Page } from '@fieldia/core';
import { linesPart, phonePart, WIDGET_LABELS } from '@fieldia/widgets';
import { checkRows, type RowsCheck } from './import-check';
import type { FileCell, FileSheet } from './import-file';
import { matchColumns, matchKey } from './import-match';
import { VIEWER_LABELS } from './labels';

/**
 * A file's columns matched to a page's fields, and its rows read and checked
 * by the page's own rules before anything is written (a list's Import): a
 * header by a field's name or its label in any of the page's languages; each
 * cell as its field's box reads what is typed — numbers in any script and the
 * page's marks, a day in the page's order, money in its record's currency,
 * yes or no in any language, a choice by its label, a link by its name, none
 * or several said — then required, the most characters, the least and most.
 */

const page: Page = {
  fieldia: '0.9',
  id: 'contacts',
  title: 'Contacts',
  data: { kind: 'record', model: 'crm.contact' },
  fields: {
    name: { type: 'char', label: 'Name', required: true, size: 40 },
    email: { type: 'char', label: 'Email' },
    phone: { type: 'char', label: 'Phone' },
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
    state: { type: 'selection', label: 'Status', required: true, default: 'lead', options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }] },
    since: { type: 'date', label: 'Customer since' },
    seats: { type: 'integer', label: 'Seats', min: 1 },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' },
    budget: { type: 'monetary', label: 'Budget', currencyField: 'currency_id' },
    newsletter: { type: 'boolean', label: 'Newsletter' },
    score: { type: 'float', label: 'Score', readonly: true },
  },
  translations: { ar: { Name: 'الاسم', Country: 'البلد', Lead: 'عميل محتمل', Customer: 'عميل' }, fr: { Name: 'Nom', Status: 'Statut', Customer: 'Client' } },
  layout: { type: 'list', id: 'contacts-list', columns: ['name', 'country_id', 'state'], import: true, cells: { phone: { widget: 'phone', options: { country: 'EG' } } } },
};

describe('a file’s columns matched to the page’s fields', () => {
  const fields = ['name', 'email', 'phone', 'country_id', 'tag_ids', 'state', 'since', 'seats', 'currency_id', 'budget', 'newsletter'];

  it('by a field’s label or its name, in any case, with or without its marks', () => {
    expect(matchColumns(page, ['NAME', 'E-mail', 'country', 'Customer Since', 'tag_ids', 'Notes'], fields)).toEqual(['name', 'email', 'country_id', 'since', 'tag_ids', null]);
  });

  it('by its label in any of the page’s languages, the page shown in one of them too', () => {
    expect(matchColumns(page, ['الاسم', 'Statut', 'البلد'], fields)).toEqual(['name', 'state', 'country_id']);
    const inArabic = { ...page, fields: { ...page.fields, name: { ...page.fields['name'], label: 'الاسم' } } } as Page;
    expect(matchColumns(inArabic, ['Nom'], fields)).toEqual(['name']);
  });

  it('gives each field to its first column only', () => {
    expect(matchColumns(page, ['Name', 'name', 'Email'], fields)).toEqual(['name', null, 'email']);
  });

  it('folds accents, spaces and marks away', () => {
    expect(matchKey(' Société  Générale ')).toBe('societegenerale');
    expect(matchKey('البريد-الإلكتروني')).toBe(matchKey('البريد الالكتروني'));
  });
});

const sheetOf = (headers: string[], rows: FileCell[][]): FileSheet => ({ kind: 'csv', headers, rows, numbers: rows.map((_, i) => i + 2), total: rows.length });

async function check(headers: string[], rows: FileCell[][], options: { locale?: 'en' | 'ar' | 'de'; dateOrder?: 'dmy' | 'mdy' | 'ymd'; phones?: boolean; lowerLabels?: boolean } = {}) {
  const dataSource = createMemoryDataSource({
    records: {
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Georgia' }, 4: { name: 'Georgia' } },
      tag: { 1: { name: 'VIP' }, 2: { name: 'Press' } },
      currency: { 1: { name: 'EGP' }, 2: { name: 'KWD' } },
    },
  });
  const form = createForm({ page, dataSource });
  const locale = options.locale ?? 'en';
  const viewer = VIEWER_LABELS[locale];
  const rowsCheck: RowsCheck = {
    page,
    form,
    cells: (page.layout as { cells: RowsCheck['cells'] }).cells,
    locale,
    dateOrder: options.dateOrder ?? 'dmy',
    today: '2026-10-16',
    messages: options.lowerLabels ? { ...MESSAGES[locale], lowerLabels: true } : MESSAGES[locale],
    labels: WIDGET_LABELS[locale],
    words: { importNoneCalled: viewer.importNoneCalled, importSeveralCalled: viewer.importSeveralCalled, importNotYesNo: viewer.importNotYesNo },
    yes: Object.values(VIEWER_LABELS).map((words) => words.yes).concat(['yes', 'true', '1', 'x']),
    no: Object.values(VIEWER_LABELS).map((words) => words.no).concat(['no', 'false', '0']),
    readers: linesPart.loaded as NonNullable<typeof linesPart.loaded>,
    ...(options.phones ? { phones: await phonePart.load() } : {}),
  };
  const columns = matchColumns(page, headers, Object.keys(page.fields).filter((name) => name !== 'score'));
  return { rows: await checkRows(rowsCheck, sheetOf(headers, rows), columns), dataSource };
}

describe('a file’s rows read and checked', () => {
  it('reads each cell as its field’s box reads it, the page’s defaults for the rest', async () => {
    const { rows } = await check(
      ['Name', 'Country', 'Tags', 'Customer since', 'Seats', 'Currency', 'Budget', 'Newsletter', 'Status'],
      [['Mona Adel', 'egypt', 'VIP, press', '14/03/2026', '١٢', 'EGP', 'LE 1,500', 'Yes', 'customer'], ['Omar', null, null, { at: '2026-01-02' }, 3, 'KWD', '12.345', false, null]]
    );
    expect(rows[0]).toEqual({
      number: 2,
      problems: [],
      values: { name: 'Mona Adel', country_id: { id: 1, label: 'Egypt' }, tag_ids: [{ id: 1, label: 'VIP' }, { id: 2, label: 'Press' }], since: '2026-03-14', seats: 12, currency_id: { id: 1, label: 'EGP' }, budget: 1500, newsletter: true, state: 'customer' },
    });
    // Its status left empty: the page's default, as a new record starts.
    expect(rows[1].values).toEqual({ name: 'Omar', since: '2026-01-02', seats: 3, currency_id: { id: 2, label: 'KWD' }, budget: 12.345, newsletter: false, state: 'lead' });
    expect(rows[1].problems).toEqual([]);
  });

  it('names what does not read, with the words its box says them in', async () => {
    const { rows } = await check(
      ['Name', 'Country', 'Customer since', 'Seats', 'Newsletter', 'Status', 'Currency', 'Budget'],
      [
        ['Sara', 'Atlantis', '31/02/2026', '2.5', 'maybe', 'Prospect', 'EGP', '12.345'],
        ['Karim', 'Georgia', '2026-13-01', '0', 'yes', 'Lead', null, null],
      ]
    );
    // In the file's order, whether its cell did not read or the record's own rules refuse it (money's places).
    expect(rows[0].problems).toEqual([
      'Country: nothing is called “Atlantis”',
      'Customer since: February 2026 has 28 days',
      'Seats must be a whole number',
      'Newsletter: “maybe” is neither yes nor no',
      'Status: nothing is called “Prospect”',
      'Budget takes at most 2 decimal places',
    ]);
    expect(rows[1].problems).toEqual(['Country: more than one is called “Georgia”', 'Customer since: months go from 1 to 12', 'Seats must be at least 1']);
  });

  it('keeps a label that heads its reason, “Status: …”, or begins it, as written where the page asks labels small', async () => {
    const { rows } = await check(['Name', 'Country', 'Seats', 'Status'], [['Sara', 'Atlantis', '2.5', 'Prospect']], { lowerLabels: true });
    expect(rows[0].problems).toEqual(['Country: nothing is called “Atlantis”', 'Seats must be a whole number', 'Status: nothing is called “Prospect”']);
  });

  it('says a required field is empty, and words past a field’s most', async () => {
    const { rows } = await check(['Name', 'Email'], [[null, 'x@example.com'], ['A name far too long to fit in forty characters, surely', null]]);
    expect(rows[0].problems).toEqual(['Name is required']);
    expect(rows[1].problems).toEqual(['Name is 14 characters too long: shorten it to 40']);
  });

  it('reads days in the page’s order, and a choice by its label in another of the page’s languages', async () => {
    const { rows } = await check(['Name', 'Customer since', 'Status'], [['Lina', '03/14/2026', 'عميل']], { dateOrder: 'mdy' });
    expect(rows[0].values).toMatchObject({ since: '2026-03-14', state: 'customer' });
    expect(rows[0].problems).toEqual([]);
  });

  it('reads a phone the world over where its column does, kept as E.164', async () => {
    const { rows } = await check(['Name', 'Phone'], [['Hana', '010 1234 5678'], ['Tarek', '12']], { phones: true });
    expect(rows[0].values['phone']).toBe('+201012345678');
    expect(rows[1].problems).toEqual(['Phone: too short for a +20 number (Egypt)']);
  });

  it('looks a name up once however many rows hold it', async () => {
    const { dataSource } = await check(['Name', 'Country'], Array.from({ length: 40 }, (_, i) => [`Contact ${i}`, i % 2 ? 'Egypt' : 'Jordan']));
    expect(dataSource.calls.filter((call) => call.method === 'search')).toHaveLength(2);
  });

  it('says it in the page’s language', async () => {
    const { rows } = await check(['Name', 'Country'], [['Sara', 'Atlantis']], { locale: 'ar' });
    expect(rows[0].problems).toEqual(['Country: لا شيء باسم «Atlantis»']);
  });
});

describe('a day and its time read from a file', () => {
  const visits: Page = {
    fieldia: '0.9',
    id: 'visits',
    title: 'Visits',
    data: { kind: 'record', model: 'visit' },
    timeZone: 'Africa/Cairo',
    fields: { name: { type: 'char', label: 'Name' }, at: { type: 'datetime', label: 'Visit' }, on: { type: 'date', label: 'Day' } },
    layout: { type: 'list', id: 'visits-list', columns: ['name', 'at'], import: true },
  };
  async function read(rows: FileCell[][]) {
    const viewer = VIEWER_LABELS.en;
    const rowsCheck: RowsCheck = {
      page: visits,
      form: createForm({ page: visits, dataSource: createMemoryDataSource({}) }),
      cells: {},
      locale: 'en',
      dateOrder: 'dmy',
      today: '2026-10-16',
      messages: MESSAGES.en,
      labels: WIDGET_LABELS.en,
      words: { importNoneCalled: viewer.importNoneCalled, importSeveralCalled: viewer.importSeveralCalled, importNotYesNo: viewer.importNotYesNo },
      yes: ['yes'],
      no: ['no'],
      readers: linesPart.loaded as NonNullable<typeof linesPart.loaded>,
    };
    return checkRows(rowsCheck, sheetOf(['Name', 'Visit', 'Day'], rows), ['name', 'at', 'on']);
  }

  it('takes a workbook’s day and time on the page’s clock, and its day as a day', async () => {
    const [row] = await read([['Mona', { at: '2026-10-16T14:30:00' }, { at: '2026-10-17' }]]);
    expect(row.problems).toEqual([]);
    expect(row.values).toEqual({ name: 'Mona', at: '2026-10-16T11:30:00.000Z', on: '2026-10-17' });
  });

  it('says the time a day leaves out, and reads a day a workbook keeps as a plain number', async () => {
    const [row] = await read([['Omar', '16/10/2026 09:15', { at: '2026-10-17T08:00:00' }]]);
    expect(row.values['at']).toBe('2026-10-16T06:15:00.000Z');
    expect(row.problems).toEqual(['Day takes a day only: the time 08:00 was left out']);
    const [plain] = await read([['Sara', null, 46312]]);
    expect(plain.values['on']).toBe('2026-10-17');
  });
});

describe('a file’s choices that follow another column of the row', () => {
  const sites: Page = {
    fieldia: '0.9',
    id: 'sites',
    data: { kind: 'record', model: 'site' },
    fields: {
      name: { type: 'char', label: 'Name' },
      country: { type: 'selection', label: 'Country', options: [{ value: 'eg', label: 'Egypt' }, { value: 'jo', label: 'Jordan' }] },
      city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['country'] } },
      size: { type: 'selection', label: 'Size', options: [], optionsFrom: { list: 'sizes' } },
    },
    layout: { type: 'list', id: 'sites-list', columns: ['name', 'country', 'city'], import: true },
  };
  const CITIES: Record<string, { value: string; label: string }[]> = { eg: [{ value: 'cai', label: 'Cairo' }], jo: [{ value: 'amm', label: 'Amman' }] };

  it('reads a city by the cities of the row’s own country, each country asked once', async () => {
    const asked: string[] = [];
    const viewer = VIEWER_LABELS.en;
    const rowsCheck: RowsCheck = {
      page: sites,
      form: createForm({ page: sites, dataSource: createMemoryDataSource({}) }),
      cells: {},
      locale: 'en',
      dateOrder: 'dmy',
      today: '2026-10-16',
      messages: MESSAGES.en,
      labels: WIDGET_LABELS.en,
      words: { importNoneCalled: viewer.importNoneCalled, importSeveralCalled: viewer.importSeveralCalled, importNotYesNo: viewer.importNotYesNo },
      yes: ['yes'],
      no: ['no'],
      readers: linesPart.loaded as NonNullable<typeof linesPart.loaded>,
      options: async (field, values) => {
        asked.push(`${field}:${values['country'] ?? ''}`);
        return field === 'size' ? [{ value: 's', label: 'Small' }] : (CITIES[values['country'] as string] ?? []);
      },
    };
    // The city before its country in the file: read after it all the same.
    const rows = await checkRows(rowsCheck, sheetOf(['City', 'Name', 'Country', 'Size'], [['Cairo', 'Nile', 'Egypt', 'Small'], ['Amman', 'Petra', 'Jordan', 'Small'], ['Cairo', 'Dead Sea', 'Jordan', null], ['Cairo', 'Delta', 'Egypt', null]]), ['city', 'name', 'country', 'size']);
    expect(rows.map((row) => row.values['city'] ?? null)).toEqual(['cai', 'amm', null, 'cai']);
    expect(rows[2].problems).toEqual(['City: nothing is called “Cairo”']);
    expect(asked).toEqual(['size:', 'city:eg', 'city:jo']);
  });
});
