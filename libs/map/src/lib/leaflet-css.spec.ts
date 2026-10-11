/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEAFLET_CSS, LEAFLET_VERSION } from './leaflet-css';

describe('Leaflet’s stylesheet', () => {
  it('is the installed Leaflet’s, copied whole: after an upgrade, run tools/leaflet-css.mjs', () => {
    const root = join(__dirname, '../../../..');
    const installed = JSON.parse(readFileSync(join(root, 'node_modules/leaflet/package.json'), 'utf8')).version;
    expect(LEAFLET_VERSION).toBe(installed);
    expect(LEAFLET_CSS).toBe(readFileSync(join(root, 'node_modules/leaflet/dist/leaflet.css'), 'utf8'));
  });
});
