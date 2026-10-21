import { createMemoryDataSource, type Page } from '@fieldia/core';
import { languagesPart, memoryPreferences } from '@fieldia/widgets';
import { until } from './test-list';
import { partsFor } from './viewer-parts';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A text kept in several languages, typed by people (`translate`), on a page: a listing's title and description in
 * Arabic and English — a switch between them over each box, the reader's language first — and a list of listings
 * showing each title in the reader's language, else another's, marked with it, its search finding either.
 */

const listing: Page = {
  fieldia: '0.9',
  id: 'listing',
  title: 'Listing',
  data: { kind: 'record', model: 'listing' },
  fields: {
    title: { type: 'char', label: 'Title', translate: ['ar', 'en'], required: true },
    description: { type: 'text', label: 'Description', translate: ['ar', 'en'], required: true, requiredIn: ['en'] },
    price: { type: 'monetary', label: 'Price', currency: 'EGP' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-title', field: 'title' },
      { type: 'field', id: 'f-description', field: 'description' },
      { type: 'field', id: 'f-price', field: 'price' },
    ],
  },
};

const listings: Page = {
  ...listing,
  id: 'listings',
  title: 'Listings',
  layout: { type: 'list', id: 'list', columns: ['title', 'price'], sort: [{ field: 'price' }], pageSize: 10, card: { title: 'title', fields: ['price'] } },
};

const records = () => ({
  1: { title: { ar: 'فيلا على البحر', en: 'Sea-view villa' }, description: { en: 'Four bedrooms.' }, price: 15000000 },
  2: { title: { ar: 'شقة في الزمالك' }, description: { en: 'A flat.' }, price: 6000000 },
  3: { title: { en: 'Studio in Maadi' }, description: { en: 'A studio.' }, price: 2500000 },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { listing: records() } }), preferences: memoryPreferences(), ...options });
  return host;
}
const titles = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row td[data-col="title"]')] as HTMLElement[];

describe('a page with a text in several languages', () => {
  it('asks for the languages part: a record’s page, a list, a related list’s records', () => {
    expect(partsFor(listing)).toContain(languagesPart);
    expect(partsFor(listings)).toContain(languagesPart);
    expect(partsFor({ ...listing, fields: { price: listing.fields['price'] }, layout: { type: 'sheet', id: 's', children: [{ type: 'field', id: 'p', field: 'price' }] } })).not.toContain(languagesPart);
  });

  it('a list shows each in the reader’s language, else another’s marked with it', async () => {
    const host = await mount(listings);
    await until(() => titles(host).length === 3);
    expect(titles(host).map((cell) => cell.textContent)).toEqual(['Studio in Maadi', 'شقة في الزمالكAR (in Arabic)', 'Sea-view villa']);
    const arabic = titles(host)[1];
    expect(arabic.querySelector('bdi')?.getAttribute('lang')).toBe('ar');
    expect(arabic.querySelector('.fd-lang-mark')?.getAttribute('title')).toBe('in Arabic');
  });

  it('a list in Arabic shows Arabic first, and marks the English a listing has alone', async () => {
    const host = await mount(listings, { locale: 'ar' });
    await until(() => titles(host).length === 3);
    expect(titles(host).map((cell) => cell.querySelector('bdi')?.textContent)).toEqual(['Studio in Maadi', 'شقة في الزمالك', 'فيلا على البحر']);
    expect(titles(host).map((cell) => cell.querySelector('.fd-lang-mark')?.textContent ?? '')).toEqual(['EN (باللغة الإنجليزية)', '', '']);
  });

  it('a record’s page draws a switch over each, the reader’s language first, and refuses a save without the languages required', async () => {
    const source = createMemoryDataSource({ records: { listing: records() } });
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: listing, dataSource: source, recordId: 3, preferences: memoryPreferences() });
    await until(() => host.querySelectorAll('[data-node="f-title"] [role="tab"]').length === 2);
    const title = host.querySelector('[data-node="f-title"]') as HTMLElement;
    expect([...title.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('lang'))).toEqual(['en', 'ar']);
    expect(title.querySelector('[role="group"]')?.getAttribute('aria-labelledby')).toBe(title.querySelector('label')?.id);
    await until(() => (title.querySelector('[role="tabpanel"]:not([hidden]) input') as HTMLInputElement | null)?.value === 'Studio in Maadi');
    await handle.form.save();
    expect(handle.form.getState().errors['title']).toBe('Title is required in Arabic');
    // Description is required in English alone: Arabic may wait.
    expect(handle.form.getState().errors['description']).toBeUndefined();
    expect(source.calls.filter((call) => call.method === 'save')).toEqual([]);
  });
});
