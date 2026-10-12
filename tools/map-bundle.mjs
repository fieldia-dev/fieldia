/**
 * @fieldia/map's size, as an app's bundler would make it: the package's own
 * code (loaded with the page), for a form with a place or an area and for
 * everything with a list's map, and Leaflet (loaded the first time a map is
 * shown, in a chunk of its own), each against its budget. Fieldia's own
 * packages are left out: an app has them already.
 *
 *   node tools/map-bundle.mjs
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'tmp/map-bundle');

/**
 * What an app carries, in KB gzipped: a form with a place or an area (the
 * fields and the providers, which is all most apps use), and everything (the
 * list's map too); and Leaflet, loaded the first time a map is shown.
 */
const BUDGET = { fields: 21.3, all: 30.4, leaflet: 47 };

/** One app's import of the package, bundled and split as its bundler would: its own code and Leaflet's chunk, gzipped. */
async function measure(name, exports) {
  const dir = join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, exports ? `export { ${exports} } from '../../../libs/map/src/index';\n` : `export * from '../../../libs/map/src/index';\n`);
  await build({
    entryPoints: { map: entry },
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    target: 'es2022',
    outdir: join(dir, 'out'),
    tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
    external: ['@fieldia/core', '@fieldia/widgets', '@fieldia/viewer', 'tslib'],
    logLevel: 'warning',
  });
  const files = readdirSync(join(dir, 'out')).filter((file) => file.endsWith('.js'));
  const sizes = files.map((file) => {
    const text = readFileSync(join(dir, 'out', file));
    return { file, raw: text.length, gzip: gzipSync(text).length, leaflet: file !== 'map.js' && /Leaflet|leaflet-container/.test(String(text)) };
  });
  for (const s of sizes) console.log(`${name} · ${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.leaflet ? ' (Leaflet, loaded with the first map)' : ''}`);
  if (!sizes.some((s) => s.leaflet)) throw new Error('Leaflet is not in a chunk of its own: a page without a map would load it');
  return {
    own: sizes.filter((s) => !s.leaflet).reduce((sum, s) => sum + s.gzip, 0),
    leaflet: sizes.filter((s) => s.leaflet).reduce((sum, s) => sum + s.gzip, 0),
  };
}

const fields = await measure('fields', 'mapWidgets, mapKinds, azureMaps, googleMaps, mapbox, openStreetMap, tiles');
const all = await measure('all');
const kb = (n) => (n / 1024).toFixed(1);
if (fields.own > BUDGET.fields * 1024) throw new Error(`@fieldia/map for a place and an area is ${kb(fields.own)} KB gzipped, over its ${BUDGET.fields} KB budget`);
if (all.own > BUDGET.all * 1024) throw new Error(`@fieldia/map with a list's map is ${kb(all.own)} KB gzipped, over its ${BUDGET.all} KB budget`);
if (all.leaflet > BUDGET.leaflet * 1024) throw new Error(`Leaflet's chunk is ${kb(all.leaflet)} KB gzipped, over its ${BUDGET.leaflet} KB budget`);
console.log(`@fieldia/map: ${kb(fields.own)} KB gzipped for a place and an area (budget ${BUDGET.fields}), ${kb(all.own)} KB with a list's map (budget ${BUDGET.all}); Leaflet ${kb(all.leaflet)} KB with the first map (budget ${BUDGET.leaflet})`);
