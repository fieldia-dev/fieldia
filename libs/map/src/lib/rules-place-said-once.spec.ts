import { createMemoryDataSource, FORMAT_VERSION, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { tiles } from './providers';
import { mapWidgets } from './widgets';

/**
 * A coordinate that does not read, said once (0.37; the class of a 0.36.1 report, "At: nothing is called “08:15”" said
 * twice under a box). The place says why under its map ("Latitude: a number from -90 to 90"), and the form keeps the
 * same words as the field's error, which the viewer draws under the field: two sentences for one problem, as the boxes
 * are left and as a save is refused. One is in sight, the boxes described by it; the save is still refused.
 */

const page = {
  fieldia: FORMAT_VERSION,
  id: 'site',
  title: 'Site',
  data: { kind: 'record', model: 'site' },
  fields: { lat: { type: 'float', label: 'Latitude of the site' }, lng: { type: 'float', label: 'Longitude of the site' } },
  layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f-lat', field: 'lat', widget: 'place', options: { longitudeField: 'lng', search: false } }] },
} as unknown as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

/** The places `words` are in sight: each piece of text holding them whose element is drawn — none round it hidden. */
function said(root: ParentNode, words: string): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const element = text.parentElement;
    if (!element || !(text.nodeValue ?? '').includes(words) || element.closest('[hidden], [aria-hidden="true"], .fd-sr-only')) continue;
    found.push(`${element.className}: ${text.nodeValue}`);
  }
  return found;
}

it('a latitude past the poles: said once under the place, as its boxes are left and as a save is refused', async () => {
  const host = document.createElement('div');
  const away = document.createElement('button');
  document.body.append(host, away);
  const dataSource = createMemoryDataSource({ records: { site: { 1: { lat: 30, lng: 31 } } } });
  handle = mountViewer(host, { page, dataSource, recordId: 1, widgets: mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }) }) });
  await handle.form.settled();
  const [latitude, longitude] = [...host.querySelectorAll<HTMLInputElement>('.fd-map-coords input')];
  latitude.focus();
  latitude.value = '95';
  latitude.dispatchEvent(new Event('change', { bubbles: true }));
  longitude.focus();
  away.focus();
  const words = 'Latitude: a number from -90 to 90';
  expect(handle.form.getState().unread['lat']?.message).toBe(words);
  expect(said(host, words)).toEqual([`fd-map-note: ${words}`]);
  expect(await handle.form.save()).toBe(false);
  expect(said(host, words)).toEqual([`fd-map-note: ${words}`]);
  expect(dataSource.records['site'][1]['lat']).toBe(30);
  // The box the field's label names is described by the words in sight, never by the field's error out of sight.
  const described = (latitude.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id));
  expect(described.filter((element) => element?.textContent?.includes(words))).toEqual([host.querySelector('.fd-map-note')]);
});
