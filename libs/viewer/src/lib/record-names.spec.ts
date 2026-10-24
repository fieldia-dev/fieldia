import { createMemoryDataSource, MESSAGES, type Page, type PageRecords } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import { addLanguage } from './add-language';
import { VIEWER_LABELS, viewerWords } from './labels';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A page names its records (`records`): Fieldia's own sentences say "customer" where they said "record", or said no
 * noun at all — over a list (nothing found, its pager, select all), over a record (its crumb, its pager, the gear
 * menu's Print and Delete, a record only to be read, someone else's save) — and, without the setting, read as before.
 * Other languages take the page's words through its translations, and say their own sentence where they have none
 * with a noun.
 */

const named: PageRecords = { one: 'customer', other: 'customers', a: 'a customer' };

const customer: Page = {
  fieldia: '0.13',
  id: 'customer',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: { menu: [{ id: 'm-print', builtin: 'print' }, { id: 'm-archive', builtin: 'archive' }, { id: 'm-delete', builtin: 'delete' }] },
    children: [{ type: 'field', id: 'f-phone', field: 'phone' }],
  },
};

const people = () => createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', phone: '+20223456789' }, 2: { name: 'Delta Foods', phone: null } } } });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mountList(options: Partial<ViewerOptions> = {}, page: Page = customers) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: partners(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
async function mountRecord(options: Partial<ViewerOptions> = {}, page: Page = customer) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: people(), recordId: 1, records: [1, 2], breadcrumbs: [{ label: 'Customers' }], ...options });
  await handle.form.settled();
  return host;
}
const text = (host: Element, selector: string) => host.querySelector(selector)?.textContent;
const label = (host: Element, selector: string) => host.querySelector(selector)?.getAttribute('aria-label');
const item = (host: Element, words: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent === words);
const tickAll = (host: Element) => (host.querySelector('thead .fd-list-checkbox') as HTMLInputElement).click();

describe('a list whose page names its records', () => {
  it('says them in its pager and in Select all', async () => {
    const host = await mountList({}, { ...customers, records: named });
    expect(text(host, '.fd-pager-text')).toBe('1–2 of 4 customers');
    tickAll(host);
    await until(() => !(host.querySelector('.fd-list-every') as HTMLElement)?.hidden);
    expect(text(host, '.fd-list-every')).toBe('Select all 4 customers that match');
  });

  it('says none of them match', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: { ...customers, records: named }, dataSource: createMemoryDataSource() });
    await until(() => !(host.querySelector('.fd-list-empty') as HTMLElement)?.hidden);
    expect(text(host, '.fd-list-empty')).toBe('No customers match.');
  });

  it('reads as before without them', async () => {
    const host = await mountList();
    expect(text(host, '.fd-pager-text')).toBe('1–2 / 4');
    tickAll(host);
    await until(() => !(host.querySelector('.fd-list-every') as HTMLElement)?.hidden);
    expect(text(host, '.fd-list-every')).toBe('Select all 4 that match');
  });
});

describe('a record whose page names its records', () => {
  it('names a new one in its trail, and its pager’s buttons and group', async () => {
    const host = await mountRecord({ recordId: null }, { ...customer, records: named });
    expect(text(host, '[aria-current="page"]')).toBe('New customer');
    expect(label(host, '.fd-record-pager')).toBe('Customers');
    expect([...host.querySelectorAll('.fd-record-pager button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Previous customer', 'Next customer']);
  });

  it('prints this one, and asks before it archives or deletes this one', async () => {
    const asked: string[] = [];
    const host = await mountRecord({ confirm: async (message) => (asked.push(message), false) }, { ...customer, records: named });
    expect(item(host, 'This customer')).toBeTruthy();
    item(host, 'Archive')?.click();
    await until(() => asked.length === 1 && !host.querySelector('.fd-record-gear')?.hasAttribute('aria-busy'));
    item(host, 'Delete')?.click();
    await until(() => asked.length === 2);
    expect(asked).toEqual(['Are you sure that you want to archive this customer?', 'Are you sure you want to delete this customer?']);
  });

  it('says this one is only to be read, and that someone else changed this one', async () => {
    const readOnly = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', phone: null } } }, can: { partner: () => ({ edit: false }) } });
    const host = await mountRecord({ dataSource: readOnly }, { ...customer, records: named });
    expect(host.querySelector('.fd-read-only-note')?.textContent).toBe('You can read this customer, but not change it.');
    handle?.destroy();
    const versioned = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', phone: null } } }, versions: { by: 'Sara' } });
    const other = await mountRecord({ dataSource: versioned }, { ...customer, records: named });
    const phone = other.querySelector('.fd-field[data-path="phone"] input') as HTMLInputElement;
    phone.value = '+20 2 1111 2222';
    phone.dispatchEvent(new Event('input', { bubbles: true }));
    phone.dispatchEvent(new Event('change', { bubbles: true }));
    versioned.changeElsewhere('partner', 1, { name: 'Nile Traders Co.' }, { by: 'Mona' });
    expect(await handle?.save()).toBe(false);
    expect(other.querySelector('.fd-conflict [role="alert"]')?.textContent).toMatch(/^Mona changed this customer at \d\d:\d\d\./);
  });

  it('reads as before without them', async () => {
    const asked: string[] = [];
    const host = await mountRecord({ recordId: null, confirm: async (message) => (asked.push(message), false) });
    expect(text(host, '[aria-current="page"]')).toBe('New');
    expect(label(host, '.fd-record-pager')).toBe('Records');
    expect(item(host, 'This record')).toBeTruthy();
  });
});

describe('the words for them in other languages', () => {
  it('come through the page’s translations; a sentence a language has no words with them for is its own', async () => {
    const page: Page = { ...customers, records: named, translations: { de: { customer: 'Kunde', customers: 'Kunden', 'a customer': 'ein Kunde' } } };
    const host = await mountList({ locale: 'de' }, page);
    expect(text(host, '.fd-pager-text')).toBe('1–2 von 4 Kunden');
    // German has no sentence for one with a noun that agrees whatever it is: its own, plainly.
    expect(VIEWER_LABELS.de.exportAllNounOne).toBeUndefined();
    expect(VIEWER_LABELS.de.exportAllNoun).toBe('Alle {n} passenden {records}');
  });

  it('take an app’s own sentence, given without one for the records, on a page that names them too', () => {
    const words = viewerWords('en', { exported: '{n} rows written.' });
    expect(words.exportedNoun).toBe('{n} rows written.');
    expect(words.importDoneNoun).toBe(VIEWER_LABELS.en.importDoneNoun);
  });

  it('are left out of a language added without them, never English round its words', () => {
    const before = { viewer: VIEWER_LABELS.fr, messages: MESSAGES.fr, widgets: WIDGET_LABELS.fr };
    const { exportedNoun: _, ...french } = VIEWER_LABELS.fr;
    try {
      addLanguage('fr', { ...before, viewer: { ...french, exported: '{n} lignes exportées.' } });
      expect(VIEWER_LABELS.fr.exported).toBe('{n} lignes exportées.');
      expect('exportedNoun' in VIEWER_LABELS.fr).toBe(false);
      expect(VIEWER_LABELS.fr.bulkAskNoun).toBe('Mettre à jour {n} {records} ?');
      // A sentence French has no words with a noun for: its own, never English's.
      expect('selectAllFailedNoun' in VIEWER_LABELS.fr).toBe(false);
    } finally {
      Object.assign(VIEWER_LABELS, { fr: before.viewer });
      Object.assign(MESSAGES, { fr: before.messages });
      Object.assign(WIDGET_LABELS, { fr: before.widgets });
    }
  });
});
