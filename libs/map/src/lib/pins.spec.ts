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

  it('reads a picture from its data, its address, or the first of several', () => {
    expect(imageSource({ name: 'a', type: 'image/jpeg', size: 1, url: 'https://x.test/a.jpg' })).toBe('https://x.test/a.jpg');
    expect(imageSource([{ name: 'a', type: 'image/png', size: 1, data: 'QQ' }])).toBe('data:image/png;base64,QQ');
    expect(imageSource('https://x.test/b.jpg')).toBe('https://x.test/b.jpg');
    expect(imageSource(null)).toBe('');
  });
});
