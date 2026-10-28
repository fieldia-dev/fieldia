import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from '@fieldia/widgets';
import { installZonePromises } from '../../../../testing/zone-promises';
import { adoptedSettings } from './adopt';
import { azureMaps, openStreetMap, tiles, type MapProvider } from './providers';
import type { MapSettings } from './settings';
import { mapWidgets } from './widgets';

/**
 * Every answer the app gives the maps — its provider's members, its own search, naming, routes, reachable areas, a set of
 * borders it loads, its count of an area, its own fetch and token — handled the moment it is given (adopt.ts), so one it
 * refuses at once, or refused before it was asked, is never said unhandled by a zone that watches its own promises:
 * Angular's, which tells `NgZone.onError`, while the maps' own `await` — code Angular did not compile — comes to it a
 * microtask late (testing/zone-promises.ts).
 */

let zone: ReturnType<typeof installZonePromises>;
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => zone.restore());
const said = () => zone.said.map((reason) => (reason as Error)?.message ?? String(reason));
const pause = (ms = 0) => new Promise((done) => setTimeout(done, ms));
const turns = async () => {
  for (let i = 0; i < 8; i++) await pause(2);
};
const refused = (what: string) => () => Promise.reject(new Error(`${what} refused`));
/** Awaited as the maps' own code awaits: natively, in an async function of the engine's. */
const awaited = async (answer: unknown) => {
  try {
    return await answer;
  } catch (error) {
    return (error as Error).message;
  }
};

const MEMBERS = ['tiles', 'credits', 'traffic', 'search', 'reverse', 'route', 'reach', 'locate'] as const;

describe('the app’s map settings, as the maps take them', () => {
  it.each(MEMBERS)('its provider’s %s, refused at once: handled as it is given, its refusal still the maps’ to hear', async (member) => {
    const provider = { id: 'app', [member]: refused(member) } as unknown as MapProvider;
    const settings = adoptedSettings({ provider });
    const answer = (settings.provider as unknown as Record<string, (...args: unknown[]) => unknown>)[member]({});
    expect(await awaited(answer)).toBe(`${member} refused`);
    await turns();
    expect(said()).toEqual([]);
  });

  it.each(['search', 'reverse', 'route', 'reach', 'countArea'] as const)('its own %s, refused at once', async (member) => {
    const settings = adoptedSettings({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }), [member]: refused(member) } as MapSettings);
    expect(await awaited((settings[member] as (...args: unknown[]) => unknown)({}))).toBe(`${member} refused`);
    await turns();
    expect(said()).toEqual([]);
  });

  it('a set of borders it loads, refused at once; one given whole, as it is', async () => {
    const whole = { type: 'FeatureCollection', features: [] };
    const settings = adoptedSettings({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }), regions: { districts: refused('districts'), zones: whole } });
    expect(await awaited((settings.regions?.['districts'] as () => unknown)())).toBe('districts refused');
    expect(settings.regions?.['zones']).toBe(whole);
    await turns();
    expect(said()).toEqual([]);
  });

  it('a provider’s method is called on the provider, its words kept as the app wrote them', async () => {
    const provider = {
      id: 'app',
      name: 'App maps',
      prefix: 'https://maps.example.test',
      tiles(this: { prefix: string }) {
        return Promise.resolve({ url: `${this.prefix}/{z}/{x}/{y}.png` });
      },
    } as unknown as MapProvider & { name: string };
    const settings = adoptedSettings({ provider });
    expect((settings.provider as typeof provider).name).toBe('App maps');
    expect(await settings.provider.tiles('road', 'en')).toEqual({ url: 'https://maps.example.test/{z}/{x}/{y}.png' });
  });
});

describe('the providers Fieldia makes, with the app’s own fetch and token', () => {
  it('OpenStreetMap’s search with the app’s fetch refused at once', async () => {
    const provider = openStreetMap({ fetch: refused('fetch') as never });
    expect(await awaited(provider.search?.({ text: 'tahrir', locale: 'en' } as never))).toBe('fetch refused');
    await turns();
    expect(said()).toEqual([]);
  });

  it('Azure Maps’ search with the app’s token refused at once', async () => {
    const provider = azureMaps({ token: refused('token') as never, fetch: (() => Promise.resolve(new Response('{}'))) as never });
    await awaited(provider.search?.({ text: 'tahrir', locale: 'en' } as never));
    await turns();
    expect(said()).toEqual([]);
  });
});

describe('an address typed, with the app’s own search refused at once', () => {
  it('the suggestions’ box stays the person’s, and nothing is left unhandled', async () => {
    const page = {
      fieldia: '0.1',
      id: 'delivery',
      data: { kind: 'responses' },
      fields: { address: { type: 'char', label: 'Address' } },
      layout: { type: 'sections', id: 'r', children: [] },
    } as unknown as Page;
    let asked = 0;
    const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }), search: () => (asked++, Promise.reject(new Error('search refused'))), center: { lat: 30.04, lng: 31.23 } });
    const form = createForm({ page });
    const node: FieldNode = { type: 'field', id: 'address', field: 'address', widget: 'address-search' };
    const widget = createWidget({ form, name: 'address', field: page.fields['address'] as Field, node, id: 'fd-address', document, labels: undefined }, widgets);
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['address'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    await pause(0);
    const box = document.getElementById('fd-address') as HTMLInputElement;
    box.focus();
    for (const letter of 'tahr') {
      box.value += letter;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await pause(400);
    await turns();
    expect(asked).toBeGreaterThan(0);
    expect(form.getState().values['address']).toBe('tahr');
    expect(said()).toEqual([]);
  });
});
