import { validatePage, type Field, type MapNode, type SectionNode } from '@fieldia/core';
import { pageSteps } from './steps-words';
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
  zone: { type: 'json', label: 'Drop-off zone' },
  district: { type: 'selection', label: 'District', options: [{ value: 'zam', label: 'Zamalek' }] },
  arriving: { type: 'boolean', label: 'Arriving' },
  stop_ids: { type: 'one2many', label: 'Stops', relation: 'stop', fields: { name: { type: 'char', label: 'Stop' }, place: { type: 'json', label: 'Place' } } },
};

const DISTRICTS = { name: 'cairo-districts', key: 'code', nameKey: 'name', numbers: ['fee', 'homes'] };

function withMap(regionSets = [DISTRICTS]) {
  const designer = createDesigner({ page: blankPage('sheet', 'Order'), model, regionSets });
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
  function mount(regionSets = [DISTRICTS]) {
    const made = withMap(regionSets);
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
    expect([...where.options].map((o) => o.textContent)).toEqual(['Deliver to, one point', 'Route, one point', 'Drop-off zone, one point', 'A latitude and a longitude']);
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

  it('adds areas by colour from the app’s borders, shaded by one of their numbers, a press choosing into a field', () => {
    const { add, layer, control, change, map, designer } = mount();
    add('Areas by colour');
    expect(map().layers[1]).toEqual({ id: 'areas', label: 'Areas by colour', regions: { from: 'cairo-districts', key: 'code', name: 'name' } });
    const areas = layer('areas');
    expect([...control<HTMLSelectElement>(areas, 'Shaded by').options].map((o) => o.textContent)).toEqual(['Nothing', 'fee', 'homes']);
    change(control<HTMLSelectElement>(areas, 'Shaded by'), 'fee');
    change(control<HTMLSelectElement>(areas, 'A press chooses it into'), 'district');
    expect(map().layers[1].regions).toEqual({ from: 'cairo-districts', key: 'code', name: 'name', shade: 'fee', choose: 'district' });
    // The field it chooses into comes onto the page.
    expect(designer.getPage().fields['district']).toEqual(model['district']);
    const legend = [...areas.querySelectorAll('label')].find((l) => l.textContent === 'A legend of the shades')!.querySelector('input')!;
    expect(legend.checked).toBe(true);
    legend.checked = false;
    legend.dispatchEvent(new Event('change', { bubbles: true }));
    expect(map().layers[1].regions?.legend).toBe(false);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('says so when the app gives no borders', () => {
    const { add, host, map } = mount([]);
    add('Areas by colour');
    expect(host.querySelector('[role="status"]')!.textContent).toBe('This app gives its maps no areas to shade.');
    expect(map().layers).toHaveLength(1);
  });

  it('adds the area within some minutes of a place, by car unless said', () => {
    const { add, layer, control, change, map, host, designer } = mount();
    // From the reader's own place, the only one there.
    add('The area within some minutes');
    expect(map().layers[1]).toEqual({ id: 'reach', label: 'The area within some minutes', reachable: { from: 'me', minutes: 15 } });
    change(control<HTMLInputElement>(layer('reach'), 'Minutes'), '10');
    change(control<HTMLSelectElement>(layer('reach'), 'By'), 'bike');
    expect(map().layers[1].reachable).toEqual({ from: 'me', minutes: 10, mode: 'bike' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Without any place: said why.
    designer.updateMap(map().id, { layers: [{ id: 'areas', regions: { from: 'cairo-districts', key: 'code' } }] });
    add('The area within some minutes');
    expect(host.querySelector('[role="status"]')!.textContent).toBe('A reachable area is worked out from a place: add a place first.');
    expect(map().layers).toHaveLength(1);
  });

  it('ticks the tools under the map’s zoom', () => {
    const { host, map } = mount();
    const tool = (name: string) => [...host.querySelectorAll('.fd-map-tools label')].find((l) => l.textContent === name)!.querySelector('input')!;
    tool('Full screen').checked = true;
    tool('Full screen').dispatchEvent(new Event('change', { bubbles: true }));
    tool('Measure a distance').checked = true;
    tool('Measure a distance').dispatchEvent(new Event('change', { bubbles: true }));
    expect(map().tools).toEqual(['fullscreen', 'measure']);
    tool('Full screen').checked = false;
    tool('Full screen').dispatchEvent(new Event('change', { bubbles: true }));
    tool('Measure a distance').checked = false;
    tool('Measure a distance').dispatchEvent(new Event('change', { bubbles: true }));
    expect(map().tools).toBeUndefined();
  });

  it('adds a fence on a place that moves and an area, its steps set as a button’s, named in words', () => {
    const { layer, change, host, map, designer } = mount();
    const addFence = () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Add a fence')!.click();
    const said = () => host.querySelectorAll('[role="status"]')[1]?.textContent;
    // The reader's own place moves; an area is wanted.
    designer.updateMap(map().id, { layers: [{ id: 'kitchen', label: 'Kitchen', latitude: 'kitchen_lat', longitude: 'kitchen_lng' }] });
    addFence();
    expect(said()).toBe('A fence watches a place that moves: tick “It moves” on a place, or add the reader’s own place.');
    const moves = [...layer('kitchen').querySelectorAll('label')].find((l) => l.textContent?.startsWith('It moves'))!.querySelector('input')!;
    moves.checked = true;
    moves.dispatchEvent(new Event('change', { bubbles: true }));
    addFence();
    // A JSON field the model has holds the area: the first, Deliver to.
    expect(map().fences).toEqual([{ layer: 'kitchen', area: 'door', when: 'enter', steps: [{ do: 'say', message: 'Kitchen is in Deliver to.' }] }]);
    const fence = host.querySelector<HTMLElement>('[data-fence="0"]')!;
    change(fence.querySelector<HTMLSelectElement>('[aria-label="The area"]')!, 'area:zone');
    change(fence.querySelector<HTMLSelectElement>('[aria-label="When it"]')!, 'leave');
    expect(map().fences![0]).toMatchObject({ layer: 'kitchen', area: 'zone', when: 'leave' });
    expect(fence.querySelector('.fd-map-layer-head strong')!.textContent).toBe('When Kitchen comes out of Drop-off zone');
    // Its steps: the same editor as a button's, named by the fence.
    expect(fence.querySelector('.fd-do')!.getAttribute('aria-label')).toBe('When Kitchen comes out of Drop-off zone');
    expect(designer.addStep({ fence: { map: map().id, at: 0 } }, { do: 'say', message: 'Out of the zone', tone: 'warning' })).toEqual([1]);
    expect(map().fences![0].steps).toEqual([{ do: 'say', message: 'Kitchen is in Deliver to.' }, { do: 'say', message: 'Out of the zone', tone: 'warning' }]);
    // The Rules view lists it among the moments, by its words.
    expect(pageSteps(designer.getPage()).map((e) => [e.group, e.name, e.lines.length])).toEqual([['moments', 'When Kitchen comes out of Drop-off zone', 2]]);
    // Its last step kept: a fence runs something.
    expect(designer.removeStep({ fence: { map: map().id, at: 0 } }, [1])).toBe(true);
    expect(designer.removeStep({ fence: { map: map().id, at: 0 } }, [0])).toBe(false);
    expect(designer.getState().issues).toEqual(['A fence needs something to do: add another step before taking this one away, or remove the fence.']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Taken away.
    fence.querySelector<HTMLButtonElement>('[aria-label^="Remove the fence"]')!.click();
    expect(map().fences).toBeUndefined();
  });
});

