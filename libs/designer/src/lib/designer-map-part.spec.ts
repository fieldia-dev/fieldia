import { validatePage, type Field, type MapNode, type SectionNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { mapContent } from './panel-map';

/**
 * A map on a page, in the designer (`type: "map"`): added as a block, its
 * layers set in its panel by picking fields, the fields they name brought
 * onto the page from the model.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Order' },
  kitchen_lat: { type: 'float', label: 'Kitchen latitude' },
  kitchen_lng: { type: 'float', label: 'Kitchen longitude' },
  door: { type: 'json', label: 'Deliver to' },
  courier_photo: { type: 'image', label: 'Courier' },
  eta_seconds: { type: 'integer', label: 'Seconds left' },
  route_line: { type: 'json', label: 'Route' },
  stop_ids: { type: 'one2many', label: 'Stops', relation: 'stop', fields: { name: { type: 'char', label: 'Stop' }, place: { type: 'json', label: 'Place' } } },
};

function withMap() {
  const designer = createDesigner({ page: blankPage('sheet', 'Order'), model });
  const id = designer.addBlock('map') as string;
  const map = () => {
    const sections = (designer.getPage().layout as { children: SectionNode[] }).children;
    return sections.flatMap((s) => s.children).find((n) => n.id === id) as MapNode;
  };
  return { designer, id, map };
}

describe('a map on a page, in the designer', () => {
  it('is added as a block with the reader’s own place, which needs no field, and the page is valid', () => {
    const { designer, map } = withMap();
    expect(map()).toEqual({ type: 'map', id: expect.stringMatching(/^map/), label: 'Map', layers: [{ id: 'me', label: 'You', myLocation: true }] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('takes layers that name the model’s fields, bringing them onto the page, and refuses a route to no layer', () => {
    const { designer, id, map } = withMap();
    expect(
      designer.updateMap(id, {
        layers: [
          { id: 'kitchen', latitude: 'kitchen_lat', longitude: 'kitchen_lng' },
          { id: 'door', point: 'door' },
          { id: 'way', route: { from: 'kitchen', to: 'door', progress: true, write: { seconds: 'eta_seconds', line: 'route_line' } } },
        ],
      })
    ).toBe(true);
    for (const name of ['kitchen_lat', 'kitchen_lng', 'door', 'eta_seconds', 'route_line']) expect([name, designer.getPage().fields[name]]).toEqual([name, model[name]]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.updateMap(id, { layers: [{ id: 'way', route: { from: 'kitchen', to: 'door' } }] })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/no layer "kitchen" on this map/);
    expect(map().layers).toHaveLength(3);
    // Its name and height; undone, as any change.
    expect(designer.updateMap(id, { label: 'Where it is', height: 480 })).toBe(true);
    expect(map()).toMatchObject({ label: 'Where it is', height: 480 });
    designer.undo();
    expect(map().label).toBe('Map');
  });
});

describe('a map’s panel', () => {
  function mount() {
    const made = withMap();
    const content = mapContent(elementFactory(document), made.designer, made.id);
    const host = document.createElement('div');
    host.append(...content.rows);
    document.body.replaceChildren(host);
    const update = () => content.update(made.designer.getPage());
    made.designer.subscribe(update);
    update();
    const add = (kind: string) => {
      [...host.querySelectorAll('button')].find((b) => b.textContent === 'Add a layer')!.click();
      [...document.querySelectorAll<HTMLButtonElement>('.fd-menu [role^="menuitem"]')].find((b) => b.textContent?.includes(kind))!.click();
    };
    const layer = (layerId: string) => host.querySelector<HTMLElement>(`[data-layer="${layerId}"]`)!;
    const control = <T extends HTMLElement>(within: HTMLElement, label: string) => within.querySelector<T>(`[aria-label="${label}"]`)!;
    const change = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLInputElement && input.type !== 'checkbox' ? 'input' : 'change', { bubbles: true }));
    };
    return { ...made, host, add, layer, control, change };
  }

  it('adds a place where the fields say one is kept, and sets what its pin shows and how it moves', () => {
    const { add, layer, control, change, map, designer } = mount();
    add('A place');
    // A JSON field the model has comes first: one point.
    expect(map().layers[1]).toEqual({ id: 'place', label: 'A place', point: 'door' });
    const place = layer('place');
    const where = control<HTMLSelectElement>(place, 'Where it is');
    expect([...where.options].map((o) => o.textContent)).toEqual(['Deliver to, one point', 'Route, one point', 'A latitude and a longitude']);
    change(where, 'latlng');
    expect(map().layers[1]).toEqual({ id: 'place', label: 'A place', latitude: 'kitchen_lat', longitude: 'kitchen_lng' });
    change(control<HTMLInputElement>(place, 'Words'), 'Kitchen');
    change(control<HTMLSelectElement>(place, 'Its pin looks like'), 'photo');
    change(control<HTMLSelectElement>(place, 'Photo'), 'courier_photo');
    const moves = [...place.querySelectorAll('label')].find((l) => l.textContent?.startsWith('It moves'))!.querySelector('input')!;
    moves.checked = true;
    moves.dispatchEvent(new Event('change', { bubbles: true }));
    expect(map().layers[1]).toEqual({ id: 'place', label: 'Kitchen', latitude: 'kitchen_lat', longitude: 'kitchen_lng', pin: { look: 'photo', image: 'courier_photo' }, live: {} });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('adds a route between two places, by car unless said, its numbers written where it is told', () => {
    const { add, layer, control, change, map, host } = mount();
    add('A route');
    // One place only, the reader's: a route needs two.
    expect(host.querySelector('[role="status"]')!.textContent).toBe('A route joins two places: add a place first.');
    add('A place');
    add('A route');
    expect(map().layers[2]).toEqual({ id: 'route', label: 'A route', route: { from: 'me', to: 'place' } });
    const route = layer('route');
    change(control<HTMLSelectElement>(route, 'By'), 'foot');
    change(control<HTMLSelectElement>(route, 'Seconds left go into'), 'eta_seconds');
    const progress = [...route.querySelectorAll('label')].find((l) => l.textContent?.startsWith('The way travelled'))!.querySelector('input')!;
    progress.checked = true;
    progress.dispatchEvent(new Event('change', { bubbles: true }));
    expect(map().layers[2].route).toEqual({ from: 'me', to: 'place', mode: 'foot', progress: true, write: { seconds: 'eta_seconds' } });
  });

  it('adds a place for each line, reading the line’s own fields, and takes a layer away', () => {
    const { add, layer, control, map } = mount();
    add('A place for each line');
    expect(map().layers[1]).toEqual({ id: 'lines', label: 'A place for each line', lines: 'stop_ids', point: 'place' });
    expect([...control<HTMLSelectElement>(layer('lines'), 'Its pin shows').options].map((o) => o.textContent)).toEqual(['Nothing', 'Stop']);
    layer('lines').querySelector<HTMLButtonElement>('[aria-label="Remove the layer A place for each line"]')!.click();
    expect(map().layers.map((l) => l.id)).toEqual(['me']);
  });

  it('says why a kind cannot be added', () => {
    const { add, host } = mount();
    add('The reader’s own place');
    expect(host.querySelector('[role="status"]')!.textContent).toBe('The map has the reader’s own place already.');
  });
});

