import type { MapCard, Page } from '@fieldia/core';
import { drawCard, webAddress, type CardOptions } from './card';
import { listMapLabels } from './labels';

/**
 * The card a pin opens, as the page says: its lines with their labels or
 * bare, the first leading, several fields on one line with their words, a
 * title and a picture that link to the record's own address, a box to
 * choose it only where a map chooses; and each of the record's words in
 * its own direction, so an English name on an Arabic page reads as typed.
 */

const page = {
  fieldia: '0.1',
  id: 'homes',
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Home' },
    price: { type: 'monetary', label: 'Price', currencyField: 'currency', digits: [16, 0], money: { currency: 'code', at: 'after', per: [{ period: 'month', when: "offer == 'rent'" }] } },
    currency: { type: 'char', label: 'Currency' },
    offer: { type: 'selection', label: 'Offer', options: [{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }] },
    district: { type: 'char', label: 'District' },
    bedrooms: { type: 'integer', label: 'Bedrooms' },
    area: { type: 'integer', label: 'Area' },
    photo: { type: 'image', label: 'Photo' },
    link: { type: 'char', label: 'Link' },
  },
  layout: { type: 'list', id: 'list', columns: ['name'] },
} as unknown as Page;

const home = {
  id: 7,
  values: { name: '5-bedroom townhouse in Nasr City', price: 13_900_000, currency: 'EGP', offer: 'sale', district: 'Sheikh Zayed', bedrooms: 4, area: 280, photo: 'https://x.test/7.jpg', link: '/property/7' },
};
const BARE: MapCard = {
  title: 'name',
  image: 'photo',
  href: 'link',
  labels: false,
  lead: true,
  fields: ['price', ['district', { field: 'bedrooms', unit: { one: 'bed', other: 'beds' } }, { field: 'area', unit: 'm²' }]],
};

const draw = (card: MapCard, more: Partial<CardOptions> = {}) =>
  drawCard({ document, page, locale: 'en', labels: listMapLabels('en'), dir: 'ltr', card, title: card.title ?? 'name', fields: card.fields ?? [], record: home, close: () => undefined, ...more }).element;
const lines = (element: HTMLElement) => [...element.querySelectorAll('.fd-map-card-fields dd')].map((dd) => dd.textContent);
const labels = (element: HTMLElement) => [...element.querySelectorAll('.fd-map-card-fields dt')].map((dt) => dt.textContent);

describe('a pin’s card', () => {
  it('writes its lines bare, the first leading, several fields on one line with their words, the labels kept for a screen reader', () => {
    const card = draw(BARE);
    expect(lines(card)).toEqual(['13,900,000\u00a0EGP', 'Sheikh Zayed · 4\u00a0beds · 280\u00a0m²']);
    expect(labels(card)).toEqual(['Price', 'District · Bedrooms · Area']);
    const list = card.querySelector<HTMLElement>('.fd-map-card-fields')!;
    expect(list.dataset['labels']).toBe('hidden');
    expect(list.hasAttribute('data-lead')).toBe(true);
    // One bed, in the plural the number needs; a rent per month, as the field's money look says.
    expect(lines(draw(BARE, { record: { id: 8, values: { ...home.values, bedrooms: 1, offer: 'rent', price: 25_000 } } }))).toEqual(['25,000\u00a0EGP/month', 'Sheikh Zayed · 1\u00a0bed · 280\u00a0m²']);
    // A part with nothing to say leaves the line, its dot too; a line with nothing leaves the card.
    expect(lines(draw(BARE, { record: { id: 9, values: { ...home.values, bedrooms: null, price: null } } }))).toEqual(['Sheikh Zayed · 280\u00a0m²']);
  });

  it('keeps its labels beside its lines, and none leading, unless the page says', () => {
    const card = draw({ title: 'name', fields: ['price', 'district'] });
    expect(labels(card)).toEqual(['Price', 'District']);
    expect(card.querySelector<HTMLElement>('.fd-map-card-fields')!.dataset['labels']).toBeUndefined();
    expect(card.querySelector('.fd-map-card-fields')!.hasAttribute('data-lead')).toBe(false);
  });

  it('writes each of the record’s words in its own direction, each part of a joined line apart', () => {
    const card = draw(BARE, { locale: 'ar', labels: listMapLabels('ar'), dir: 'rtl' });
    expect(card.dir).toBe('rtl');
    expect(card.querySelector('.fd-map-card-title bdi')!.textContent).toBe('5-bedroom townhouse in Nasr City');
    expect([...card.querySelectorAll('.fd-map-card-fields dd')[1].querySelectorAll('bdi')].map((b) => b.textContent)).toEqual(['Sheikh Zayed', '4\u00a0beds', '280\u00a0m²']);
    expect(card.querySelector('.fd-map-card-fields dd bdi')!.textContent).toBe('13,900,000\u00a0EGP');
  });

  it('links its title and its picture to the record’s own address: one link the keys reach, one for the pointer', () => {
    const card = draw(BARE);
    const title = card.querySelector<HTMLAnchorElement>('.fd-map-card-title a')!;
    expect(title.getAttribute('href')).toBe('/property/7');
    expect(title.textContent).toBe('5-bedroom townhouse in Nasr City');
    const picture = card.querySelector<HTMLAnchorElement>('a.fd-map-card-picture')!;
    expect(picture.getAttribute('href')).toBe('/property/7');
    expect(picture.tabIndex).toBe(-1);
    expect(picture.getAttribute('aria-hidden')).toBe('true');
    expect(picture.querySelector('img')!.alt).toBe('');
    // No address, or one a link must not go to: no link.
    expect(draw(BARE, { record: { id: 7, values: { ...home.values, link: null } } }).querySelector('a')).toBeNull();
    expect(draw(BARE, { record: { id: 7, values: { ...home.values, link: 'javascript:alert(1)' } } }).querySelector('a')).toBeNull();
    expect(draw(BARE, { record: { id: 7, values: { ...home.values, link: 'java\tscript:alert(1)' } } }).querySelector('a')).toBeNull();
  });

  it('reads a web, mail or phone address, or a path of the site; never a script', () => {
    expect(webAddress('https://dawarly.ai/property/7')).toBe('https://dawarly.ai/property/7');
    expect(webAddress(' /property/7 ')).toBe('/property/7');
    expect(webAddress('?page=map-home&record=7')).toBe('?page=map-home&record=7');
    expect(webAddress('mailto:sales@example.com')).toBe('mailto:sales@example.com');
    expect(webAddress('JavaScript:alert(1)')).toBe('');
    expect(webAddress('data:text/html,hi')).toBe('');
    expect(webAddress(42)).toBe('');
    // As the browser reads an address: a control character before it, a tab or a line break in its scheme (the audit's bypass).
    for (const script of ['\x01javascript:alert(document.domain)', 'java\tscript:alert(document.domain)', 'java\nscript:alert(1)', 'JaVa\rScRiPt:alert(1)'])
      expect(webAddress(script)).toBe('');
  });

  it('offers a box to choose the record only where the map chooses, and Open where the app opens records', () => {
    const choosing = draw(BARE, { choose: () => undefined, open: () => undefined });
    expect(choosing.querySelector('.fd-map-card-choose')).not.toBeNull();
    expect(choosing.querySelector('.fd-map-card-open')!.textContent).toBe('Open');
    const looking = draw(BARE, { open: () => undefined });
    expect(looking.querySelector('.fd-map-card-choose')).toBeNull();
    expect(looking.querySelector('input')).toBeNull();
    expect(draw({ ...BARE, open: false }, { open: () => undefined }).querySelector('.fd-map-card-open')).toBeNull();
  });
});
