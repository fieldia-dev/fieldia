import { createMemoryDataSource, literalPage, type Page } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
import { mapParts, tiles } from '../index';

/**
 * The gate of literal words for what @fieldia/map draws of a page (literal-words.spec.ts in @fieldia/viewer holds the
 * rest): a map's own words over it and each layer's, written with `literalWords`, shown exactly as written.
 */

const TRICKY = ['{list} \\{x} {{customer}} a\\b |: عميل', '={{ $json.customer }} \\\\{name} {a|b}'];

const page = {
  fieldia: '0.13',
  id: 'site',
  data: { kind: 'record', model: 'site' },
  fields: { name: { type: 'char', label: 'Site' }, lat: { type: 'float', label: 'Latitude' }, lng: { type: 'float', label: 'Longitude' } },
  layout: {
    type: 'sections',
    id: 'r',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'map', id: 'm', label: TRICKY[0], layers: [{ id: 'site', label: TRICKY[1], latitude: 'lat', longitude: 'lng' }] },
    ],
  },
} as unknown as Page;

const until = async (ready: () => unknown, ms = 2000) => {
  for (const started = Date.now(); !ready(); ) {
    if (Date.now() - started > ms) throw new Error('waited too long');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

it('shows a map’s words and its layers’ exactly as written with literalWords', async () => {
  const provider = tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } });
  const dataSource = createMemoryDataSource({ records: { site: { 1: { name: 'Zamalek', lat: 30.06, lng: 31.22 } } } });
  const host = document.body.appendChild(document.createElement('div'));
  const handle = mountViewer(host, { page: literalPage(page), dataSource, recordId: 1, maps: mapParts({ provider }) });
  await handle.drawn;
  await until(() => host.querySelector('[data-node="m"] .fd-map-box'));
  await until(() => host.innerHTML.includes(TRICKY[1]));
  const read = host.innerHTML;
  expect(read).toContain(TRICKY[0]);
  expect(read).toContain(TRICKY[1]);
  // Never with the backslashes they were written with.
  expect(read).not.toContain('\\{list}');
  expect(read).not.toContain('\\\\\\{name}');
  handle.destroy();
});
