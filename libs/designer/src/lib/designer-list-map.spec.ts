import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePage, type Field, type ListNode, type Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';

/**
 * A list page whose records are also on a map (`map` on the list): the
 * fields the map names stay on the page while it names them, and come and go
 * with it as the designer turns it on and off.
 */

const homes = JSON.parse(readFileSync(join(__dirname, '../../../../examples/pages/map-homes.page.json'), 'utf8')) as Page;
const model: Record<string, Field> = { ...homes.fields, spot: { type: 'json', label: 'Place' } };
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;

describe('a list page on a map', () => {
  it('keeps the fields its map names when a column or a search that named them goes', () => {
    const designer = createDesigner({ page: homes, model });
    expect(designer.removeColumn('bedrooms')).toBe(true);
    expect(designer.setListOptions({ searchFields: [], groupBy: [] })).toBe(true);
    // Where each home is, its pin's price, its card's picture, lines and link, and what its pin's tone reads; and what the price reads, its currency.
    for (const name of ['lat', 'lng', 'price', 'photo', 'bedrooms', 'area_m2', 'district', 'offer', 'link', 'currency']) expect([name, name in designer.getPage().fields]).toEqual([name, true]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('puts the records on a map, bringing its fields from the model, and takes the map away, letting them go', () => {
    const designer = createDesigner({ page: blankPage('list', 'Homes'), model });
    expect(designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng', pin: { label: 'price' }, view: 'both' } })).toBe(true);
    expect(list(designer).map).toEqual({ latitude: 'lat', longitude: 'lng', pin: { label: 'price' }, view: 'both' });
    expect(designer.getPage().fields['lat']).toEqual(model['lat']);
    expect(designer.getPage().fields['price']).toEqual(model['price']);
    // An amount comes with what its words read: its currency's field, and its rent's condition's.
    expect(designer.getPage().fields['currency']).toEqual(model['currency']);
    expect(designer.getPage().fields['offer']).toEqual(model['offer']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // One GeoJSON point instead: the two numbers leave.
    expect(designer.setListOptions({ map: { point: 'spot', view: 'map' } })).toBe(true);
    expect(designer.getPage().fields['lat']).toBeUndefined();
    expect(designer.getPage().fields['spot']).toEqual(model['spot']);
    expect(designer.setListOptions({ map: null })).toBe(true);
    expect(list(designer).map).toBeUndefined();
    expect(Object.keys(designer.getPage().fields)).toEqual(['name']);
    // Undone, the map is back.
    designer.undo();
    expect(list(designer).map).toEqual({ point: 'spot', view: 'map' });
  });

  it('refuses a map that names a field of the wrong kind, or none, saying why', () => {
    const designer = createDesigner({ page: blankPage('list', 'Homes'), model });
    expect(designer.setListOptions({ map: { latitude: 'name', longitude: 'lng' } })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/"name" is a char; a latitude is a number field/);
    expect(designer.setListOptions({ map: { point: 'nowhere' } })).toBe(false);
    expect(designer.getState().issues).toEqual(['There is no field "nowhere"']);
    expect(list(designer).map).toBeUndefined();
  });
});

describe('the list’s Map, in its panel', () => {
  function mount(page: Page, fields: Record<string, Field> = model, regionSets = [{ name: 'cairo-districts', key: 'code', nameKey: 'name' }]) {
    const designer = createDesigner({ page, model: fields, regionSets });
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const map = panel.element.querySelector<HTMLElement>('[data-part="map"]')!;
    const control = <T extends HTMLElement>(name: string) => map.querySelector<T>(`[aria-label="${name}"]`)!;
    const shown = (element: Element) => !element.closest('[hidden]');
    const tick = map.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    return { designer, map, control, shown, tick };
  }
  /** A tick box by the words beside it. */
  const ticked = (map: HTMLElement, words: string) => [...map.querySelectorAll('label')].find((l) => l.textContent === words)!.querySelector<HTMLInputElement>('input')!;
  const change = (input: HTMLInputElement | HTMLSelectElement, value?: string) => {
    if (value !== undefined) input.value = value;
    else if (input instanceof HTMLInputElement) input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('puts the records on a map with a tick, where the fields say each one is, and opens as both', () => {
    const { designer, tick, control, shown } = mount(blankPage('list', 'Homes'));
    expect(shown(tick)).toBe(true);
    change(tick);
    // A JSON field the model has comes first: one point.
    expect(list(designer).map).toEqual({ point: 'spot', view: 'both' });
    const where = control<HTMLSelectElement>('Where each record is');
    expect([...where.options].map((o) => o.textContent)).toEqual(['Place, one point', 'A latitude and a longitude']);
    change(where, 'latlng');
    expect(list(designer).map).toEqual({ latitude: 'lat', longitude: 'lng', view: 'both' });
    expect(shown(control('Latitude'))).toBe(true);
    change(control<HTMLSelectElement>('Longitude'), 'area_m2');
    expect(list(designer).map?.longitude).toBe('area_m2');
    change(tick);
    expect(list(designer).map).toBeUndefined();
  });

  it('sets what each pin shows and how it looks, the card, how the list opens, and the bubbles', () => {
    const { designer, control, shown, map } = mount(blankPage('list', 'Homes'));
    designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng' } });
    change(control<HTMLSelectElement>('Each pin shows'), 'price');
    expect(list(designer).map?.pin).toEqual({ label: 'price' });
    expect(control<HTMLSelectElement>('Pins look like').value).toBe('label');
    // A look's own settings show only with it.
    expect(shown(control('Photo'))).toBe(false);
    change(control<HTMLSelectElement>('Pins look like'), 'photo');
    expect(shown(control('Photo'))).toBe(true);
    change(control<HTMLSelectElement>('Photo'), 'photo');
    expect(list(designer).map?.pin).toEqual({ label: 'price', look: 'photo', image: 'photo' });
    change(control<HTMLSelectElement>('Pins look like'), 'icon');
    expect(shown(control('Icon'))).toBe(true);
    const icon = control<HTMLInputElement>('Icon');
    icon.value = 'car';
    change(icon, 'car');
    change(control<HTMLSelectElement>('Turned by, in degrees'), 'bedrooms');
    expect(list(designer).map?.pin).toMatchObject({ look: 'icon', icon: 'car', turn: 'bedrooms' });
    change(control<HTMLSelectElement>('Card picture'), 'photo');
    change(control<HTMLSelectElement>('Opens as'), 'map');
    change(ticked(map, 'Pins that crowd become a bubble'));
    expect(list(designer).map).toMatchObject({ card: { image: 'photo' }, view: 'map', cluster: false });
    // The card's fields, as chips taken off one by one.
    designer.setListOptions({ map: { ...list(designer).map!, card: { image: 'photo', fields: ['price', 'district'] } } });
    map.querySelector<HTMLButtonElement>('[aria-label="Take Price off the card"]')!.click();
    expect(list(designer).map?.card).toEqual({ image: 'photo', fields: ['district'] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('sets a card for a map people only look at: bare lines, the first leading, a link, no box to choose', () => {
    const fields = { ...model, link: { type: 'char', label: 'Link' } } as Record<string, Field>;
    const { designer, control, map } = mount(blankPage('list', 'Homes'), fields);
    designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng', card: { fields: ['price', ['district', { field: 'bedrooms', unit: 'beds' }]] } } });
    // Each line a chip, several fields on one line named together, and taken off whole.
    expect([...map.querySelectorAll('.fd-chip')].map((c) => c.firstChild?.textContent)).toEqual(['Price', 'District · Bedrooms']);
    expect(ticked(map, 'Labels beside the card’s lines').checked).toBe(true);
    expect(ticked(map, 'A box on the card to choose the record').checked).toBe(true);
    change(ticked(map, 'Labels beside the card’s lines'));
    change(ticked(map, 'The first line large and bold'));
    change(ticked(map, 'A box on the card to choose the record'));
    change(control<HTMLSelectElement>('Card links to the address in'), 'link');
    expect(list(designer).map?.card).toEqual({ fields: ['price', ['district', { field: 'bedrooms', unit: 'beds' }]], labels: false, lead: true, choose: false, href: 'link' });
    expect(designer.getPage().fields['link']).toEqual(fields['link']);
    map.querySelector<HTMLButtonElement>('[aria-label="Take District · Bedrooms off the card"]')!.click();
    expect(list(designer).map?.card?.fields).toEqual(['price']);
    // Back to the usual: said by leaving it out.
    change(ticked(map, 'Labels beside the card’s lines'));
    change(ticked(map, 'The first line large and bold'));
    change(ticked(map, 'A box on the card to choose the record'));
    change(control<HTMLSelectElement>('Card links to the address in'), '');
    expect(list(designer).map?.card).toEqual({ fields: ['price'] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('leaves a pin’s home currency unsaid, offered when the pin says an amount', () => {
    const { designer, control, shown } = mount(blankPage('list', 'Homes'));
    designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng', pin: { label: 'name' } } });
    expect(shown(control('Home currency, unsaid on pins'))).toBe(false);
    change(control<HTMLSelectElement>('Each pin shows'), 'price');
    const home = control<HTMLInputElement>('Home currency, unsaid on pins');
    expect(shown(home)).toBe(true);
    // Saved once it is three letters; empty takes it away.
    home.value = 'eg';
    home.dispatchEvent(new Event('input', { bubbles: true }));
    expect(list(designer).map?.pin).toEqual({ label: 'price' });
    home.value = 'egp';
    home.dispatchEvent(new Event('input', { bubbles: true }));
    expect(list(designer).map?.pin).toEqual({ label: 'price', money: { home: 'EGP' } });
    home.value = '';
    home.dispatchEvent(new Event('input', { bubbles: true }));
    expect(list(designer).map?.pin).toEqual({ label: 'price' });
  });

  it('ticks its tools, a heat map weighed by a number, and areas by colour from the app’s borders', () => {
    const { designer, control, shown, map } = mount(blankPage('list', 'Homes'));
    designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng' } });
    const tick = (name: string) => [...map.querySelectorAll('label')].find((l) => l.textContent === name)!.querySelector('input')!;
    change(tick('Nearest first'));
    change(tick('Full screen'));
    expect(list(designer).map?.tools).toEqual(['nearest', 'fullscreen']);
    change(tick('Nearest first'));
    change(tick('Full screen'));
    expect(list(designer).map?.tools).toBeUndefined();
    // A heat map: each record weighing one, or a number of its own.
    expect(shown(control('Each weighs'))).toBe(false);
    change(tick('A heat map from afar'));
    expect(list(designer).map?.heat).toBe(true);
    change(control<HTMLSelectElement>('Each weighs'), 'price');
    expect(list(designer).map?.heat).toEqual({ weight: 'price' });
    change(control<HTMLSelectElement>('Each weighs'), '');
    expect(list(designer).map?.heat).toBe(true);
    // Areas by colour: the app's borders, each record's area in a field that can hold its key.
    expect(shown(control('Each record’s area is in'))).toBe(false);
    change(control<HTMLSelectElement>('Areas by colour'), 'cairo-districts');
    expect(list(designer).map?.regions).toEqual({ from: 'cairo-districts', key: 'code', name: 'name', field: expect.any(String) });
    change(control<HTMLSelectElement>('Each record’s area is in'), 'district');
    expect(list(designer).map?.regions?.field).toBe('district');
    expect(designer.getPage().fields['district']).toEqual(model['district']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    change(control<HTMLSelectElement>('Areas by colour'), '');
    expect(list(designer).map?.regions).toBeUndefined();
  });

  it('sets how tall the map is, whether it takes every gesture, and the closest it zooms to show the records', () => {
    const { designer, control, map } = mount(blankPage('list', 'Homes'));
    designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng' } });
    const height = control<HTMLSelectElement>('Map height');
    expect(height.value).toBe('');
    expect([...height.options].map((o) => o.textContent)).toEqual([
      'As tall as the window allows',
      'As tall as the place it is put in',
      'Small, 320 pixels',
      'Medium, 480 pixels',
      'Large, 640 pixels',
    ]);
    change(height, 'fill');
    expect(list(designer).map?.height).toBe('fill');
    change(height, '480');
    expect(list(designer).map?.height).toBe(480);
    change(height, '');
    expect(list(designer).map?.height).toBeUndefined();
    // A height of the page's own is offered as it is.
    designer.setListOptions({ map: { ...list(designer).map!, height: 555 } });
    expect(height.value).toBe('555');
    expect(height.selectedOptions[0].textContent).toBe('555 pixels');

    const gestures = [...map.querySelectorAll('label')].find((l) => l.textContent === 'Every gesture moves the map: one finger, and the wheel with no key held')!.querySelector('input')!;
    expect(gestures.checked).toBe(false);
    change(gestures);
    expect(list(designer).map?.gestures).toBe('all');
    change(gestures);
    expect(list(designer).map?.gestures).toBeUndefined();

    const closest = control<HTMLInputElement>('Closest it zooms to show the records');
    expect(closest.placeholder).toBe('16');
    change(closest, '14');
    expect(list(designer).map?.fitZoom).toBe(14);
    // A zoom the maps have, from the world (1) to a building (22): one past it is refused, said, and the zoom kept.
    change(closest, '40');
    expect(list(designer).map?.fitZoom).toBe(14);
    expect(closest.value).toBe('14');
    expect(closest.parentElement?.querySelector('.fd-refusal-hint')?.textContent).toBe('Closest it zooms to show the records is a whole number from 1 to 22. It stays 14.');
    change(closest, '');
    expect(list(designer).map?.fitZoom).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('offers no areas when the app gives no borders', () => {
    const { designer, control, shown } = mount(blankPage('list', 'Homes'), model, []);
    designer.setListOptions({ map: { latitude: 'lat', longitude: 'lng' } });
    expect(shown(control('Areas by colour'))).toBe(false);
  });

  it('says why there can be no map, and offers none, when no field can hold a place', () => {
    const { tick, shown, map } = mount(blankPage('list', 'Notes'), { name: { type: 'char', label: 'Name' }, count: { type: 'integer', label: 'Count' } });
    expect(shown(tick)).toBe(false);
    expect([...map.querySelectorAll('p')].filter(shown).map((p) => p.textContent)).toEqual([
      'A map needs where each record is: a JSON field holding a point, or two number fields for the latitude and the longitude.',
    ]);
  });
});
