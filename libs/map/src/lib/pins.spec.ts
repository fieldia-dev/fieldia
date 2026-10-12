import type { Page, Pin } from '@fieldia/core';
import { imageSource, makePins, pinText } from './pins';

/**
 * Each record's pin as the page says: its look, its words, its tone and its
 * turn, and its name for a screen reader. A record's words go in as text,
 * never as HTML.
 */

const page = {
  fieldia: '0.1',
  id: 'homes',
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Name' },
    price: { type: 'monetary', label: 'Price', currencyField: 'currency' },
    currency: { type: 'char', label: 'Currency' },
    rating: { type: 'float', label: 'Rating' },
    offer: { type: 'selection', label: 'Offer', options: [{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }] },
    kind: { type: 'char', label: 'Vehicle' },
    heading: { type: 'float', label: 'Heading' },
    face: { type: 'image', label: 'Face' },
  },
  layout: { type: 'list', id: 'list', columns: ['name'] },
} as unknown as Page;

const pins = (pin: Pin, more: Partial<Parameters<typeof makePins>[0]> = {}) => makePins({ document, page, locale: 'en', pin, title: 'name', ...more });
const villa = { id: 7, values: { name: 'Villa <b>Nile</b>', price: 9_500_000, currency: 'EGP', rating: 4.6, offer: 'rent', kind: 'scooter', heading: 135, face: null } };

describe('a record’s pin', () => {
  it('writes an amount short, in its currency and the page’s language', () => {
    expect(pinText(page, 'price', villa.values, 'en')).toBe('E£9.5M');
    expect(pinText(page, 'price', { price: 850_000, currency: 'USD' }, 'en')).toBe('$850K');
    expect(pinText(page, 'price', { price: 1_850_000.5, currency: 'EUR' }, 'de')).toMatch(/^1,9\sMio\.\s€$/);
    expect(pinText(page, 'rating', villa.values, 'en')).toBe('4.6');
    expect(pinText(page, 'price', { price: 1200, currency: 'Gold coins' }, 'en')).toBe('Gold coins 1.2K');
    expect(pinText(page, 'offer', villa.values, 'en')).toBe('For rent');
    expect(pinText(page, 'name', { name: null }, 'en')).toBe('');
  });

  it('shows a label by default when the pin has words, and the record’s words only as text', () => {
    const face = pins({ label: 'name' }).face(villa);
    expect(face.element.dataset['look']).toBe('label');
    expect(face.stands).toBe('foot');
    expect(face.element.textContent).toBe('Villa <b>Nile</b>');
    expect(face.element.querySelector('b')).toBeNull();
  });

  it('falls to a dot when a label has nothing to say', () => {
    expect(pins({ label: 'name' }).face({ id: 1, values: { name: '' } }).element.dataset['look']).toBe('dot');
  });

  it('turns an icon the way the record faces, and takes the icon from a field when it names one', () => {
    // A scooter is drawn from its side: it stays upright, and a pointer on its edge turns.
    const face = pins({ look: 'icon', icon: 'car', iconField: 'kind', turn: 'heading' }).face(villa);
    const glyph = face.element.querySelector<HTMLElement>('.fd-map-face-icon')!;
    expect(glyph.querySelector('svg')!.dataset['icon']).toBe('scooter');
    expect(glyph.style.transform).toBe('');
    expect(face.element.querySelector<HTMLElement>('.fd-map-face-turn')!.style.transform).toBe('rotate(135deg)');
    // A car is drawn from above, facing north: it turns whole, with no pointer.
    const car = pins({ look: 'icon', icon: 'car', iconField: 'kind', turn: 'heading' }).face({ id: 8, values: { kind: 'car', heading: 90 } });
    expect(car.element.querySelector<HTMLElement>('.fd-map-face-icon')!.style.transform).toBe('rotate(90deg)');
    expect(car.element.querySelector('.fd-map-face-turn')).toBeNull();
    // No heading: nothing turns.
    expect(pins({ look: 'icon', icon: 'car', turn: 'heading' }).face({ id: 9, values: { heading: null } }).element.querySelector('.fd-map-face-turn')).toBeNull();
    // A value that is no icon's name: the pin's own icon.
    const plain = pins({ look: 'icon', icon: 'car', iconField: 'kind' }).face({ id: 2, values: { kind: 'hovercraft' } });
    expect(plain.element.querySelector('svg')!.dataset['icon']).toBe('car');
    // The app's own icon by the same name wins over the map's.
    const own = pins({ look: 'icon', icon: 'car' }, { icons: { car: '<circle cx="12" cy="12" r="3"/>' } }).face(villa);
    expect(own.element.querySelector('svg')!.innerHTML).toBe('<circle cx="12" cy="12" r="3"></circle>');
  });

  it('takes the tone of the first condition that holds', () => {
    const toned = pins({ label: 'price', tones: [{ tone: 'warning', when: 'rating < 3' }, { tone: 'info', when: "offer == 'rent'" }, { tone: 'success', when: true }] });
    expect(toned.face(villa).element.dataset['tone']).toBe('info');
    expect(toned.face({ id: 3, values: { ...villa.values, rating: 2 } }).element.dataset['tone']).toBe('warning');
    expect(pins({ label: 'price' }).face(villa).element.dataset['tone']).toBeUndefined();
    // The fields its conditions read are asked for with the records.
    expect(toned.fields).toEqual(['name', 'price', 'currency', 'rating', 'offer']);
  });

  it('draws a round photo, or a person where there is none', () => {
    const withFace = pins({ look: 'photo', image: 'face', label: 'name' }).face({ id: 4, values: { name: 'Mona', face: { name: 'm.png', type: 'image/png', size: 3, data: 'AAA' } } });
    expect(withFace.element.querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(withFace.element.querySelector('img')!.alt).toBe('');
    expect(withFace.element.querySelector('.fd-map-face-text')!.textContent).toBe('Mona');
    const without = pins({ look: 'photo', image: 'face' }).face({ id: 5, values: { face: null } });
    expect(without.element.querySelector('img')).toBeNull();
    expect(without.element.querySelector('svg')!.dataset['icon']).toBe('user');
  });

  it('draws the app’s own pin by its name', () => {
    const drawer = jest.fn((record: { id: unknown }) => Object.assign(document.createElement('b'), { textContent: `#${record.id}` }));
    const face = pins({ widget: 'mine' }, { drawers: { mine: drawer } }).face(villa);
    expect(face.element.textContent).toBe('#7');
    expect(drawer).toHaveBeenCalledWith(villa, expect.objectContaining({ locale: 'en', page }));
  });

  it('is named by the record’s title and what the pin says', () => {
    expect(pins({ label: 'price' }).name(villa)).toBe('Villa <b>Nile</b>, E£\u00a09,500,000.00');
    expect(pins({ label: 'name' }).name(villa)).toBe('Villa <b>Nile</b>');
    expect(pins({}).name({ id: 9, values: {} })).toBe('9');
  });

  it('writes a price as the page says: short, the home currency unsaid, another named, per month on a rent', () => {
    const dawarly = { label: 'price', money: { home: 'EGP', currency: 'symbol', at: 'before', per: [{ period: 'month', when: "offer == 'rent'" }] } } as Pin;
    const said = (values: Record<string, unknown>, locale: 'en' | 'ar' = 'en', pin: Pin = dawarly) =>
      pins(pin, { locale }).face({ id: 1, values: { name: 'Villa', ...values } as never }).element.textContent;
    expect(said({ price: 13_900_000, currency: 'EGP', offer: 'sale' })).toBe('13.9M');
    expect(said({ price: 450_000, currency: 'USD', offer: 'sale' })).toBe('$\u00a0450K');
    expect(said({ price: 25_000, currency: 'EGP', offer: 'rent' })).toBe('25K/month');
    // Arabic: its own short words, Latin digits, a symbol kept whole.
    expect(said({ price: 13_900_000, currency: 'EGP', offer: 'sale' }, 'ar')).toBe('13.9\u00a0مليون');
    expect(said({ price: 25_000, currency: 'EGP', offer: 'rent' }, 'ar')).toBe('\u206825\u00a0ألف\u2069/شهر');
    expect(said({ price: 450_000, currency: 'USD', offer: 'sale' }, 'ar')).toBe('\u2068US$\u2069\u00a0450\u00a0ألف');
    // The fields its words read are asked for with the records: the currency, and the condition's.
    expect(pins(dawarly).fields).toEqual(['name', 'price', 'currency', 'offer']);
    // The app's home currency, under the page's own.
    expect(said({ price: 9_500_000, currency: 'EGP' }, 'en', { label: 'price' })).toBe('E£9.5M');
    expect(pins({ label: 'price' }, { homeCurrency: 'EGP' }).face(villa).element.textContent).toBe('9.5M');
    expect(pins({ label: 'price', money: { home: 'USD' } }, { homeCurrency: 'EGP' }).face(villa).element.textContent).toBe('E£\u00a09.5M');
    // In full, when the page says: the field's own money look over a pin's short.
    expect(said({ price: 13_900_000, currency: 'EGP' }, 'en', { label: 'price', money: { short: false, currency: 'code', at: 'after' } })).toBe('13,900,000.00\u00a0EGP');
  });

  it('names a priced pin in full, its currency named and what it is for', () => {
    const dawarly = { label: 'price', money: { home: 'EGP', per: [{ period: 'month', when: "offer == 'rent'" }] } } as Pin;
    expect(pins(dawarly).name(villa)).toBe('Villa <b>Nile</b>, E£\u00a09,500,000.00/month');
  });

  it('keeps a symbol whole on a right-to-left page, the amount written as ever', () => {
    // Intl writes "E£" after the amount in Arabic; isolated, the page round it cannot turn it to "£E".
    expect(pinText(page, 'price', villa.values, 'ar')).toMatch(/^\u200f?9\.5\u00a0مليون\u00a0\u2068E£\u2069$/);
    expect(pins({ label: 'name' }, { locale: 'ar' }).name(villa)).toBe('Villa <b>Nile</b>');
    expect(pins({ label: 'price' }, { locale: 'ar' }).name(villa)).toBe('Villa <b>Nile</b>، \u200f9,500,000.00\u00a0\u2068E£\u2069');
    // Left to right, and a symbol that is letters alone, as ever.
    expect(pinText(page, 'price', villa.values, 'en')).toBe('E£9.5M');
    expect(pinText(page, 'price', { price: 9_500_000, currency: 'Gold' }, 'ar')).toBe('Gold 9.5\u00a0مليون');
  });

  it('writes a record’s words on its pin in their own direction', () => {
    expect(pins({ label: 'name' }).face(villa).element.querySelector<HTMLElement>('.fd-map-face-text')!.dir).toBe('auto');
    const photo = pins({ look: 'photo', image: 'face', label: 'name' }).face(villa);
    expect(photo.element.querySelector<HTMLElement>('.fd-map-face-text')!.dir).toBe('auto');
  });

  it('reads a picture from its data, its address, or the first of several', () => {
    expect(imageSource({ name: 'a', type: 'image/jpeg', size: 1, url: 'https://x.test/a.jpg' })).toBe('https://x.test/a.jpg');
    expect(imageSource([{ name: 'a', type: 'image/png', size: 1, data: 'QQ' }])).toBe('data:image/png;base64,QQ');
    expect(imageSource('https://x.test/b.jpg')).toBe('https://x.test/b.jpg');
    expect(imageSource(null)).toBe('');
  });
});
