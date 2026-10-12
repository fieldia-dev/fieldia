/**
 * @fieldia/map's size, as an app's bundler would make it: the package's own
 * code (loaded with the page), for a form with a place or an area and for
 * everything with a list's map and a form's, Leaflet (loaded the first time
 * a map is shown, in a chunk of its own), and the routes (loaded the first
 * time a route is asked for), each against its budget. Fieldia's own
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
 * Phase 4's tools under a map's zoom (satellite, full screen, measuring a way:
 * the button's code and the drawing both loaded with the first map that has
 * them), their words in four languages, and the hooks that load areas by
 * colour, a heat map, reachable areas and fences when a map has them — 1.8
 * more for a place and an area, to 23.4; with a list's map and a form's,
 * Nearest first, the heat map's place and the list's words too — 3.1 more,
 * to 38.5. Live traffic: each provider's traffic (Azure's, Google's own
 * session, Mapbox's and any map images' from the app's style or address),
 * its credits said with the map's, its word in four languages (its button is
 * in the tools' chunk) — 0.3 more, to 23.8. A form's map gathering pins that
 * crowd (its bubbles, a place that moves leading the pins round it, the
 * keys kept where they were, a list of pins on one spot), their count's
 * style and their words — with the traffic, 1.4 more, to 39.9. A pin's
 * price as a page says it (short, the home currency unsaid, "/month" on a
 * rent, named in full to a screen reader), a card's bare lines, several
 * fields on one line with their words in the plural they need, its lead
 * line, its link and its box to choose left off, each word of a record in
 * its own direction, and an area's words given as text — 1.0 more, to 40.9.
 */
const BUDGET = { fields: 23.8, all: 40.9, leaflet: 47, routes: 2 };

/** One app's import of the package, bundled and split as its bundler would: its own code and Leaflet's chunk, gzipped. */
const metafiles = {};
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
    metafile: true,
  }).then((result) => (metafiles[name] = result.metafile));
  // What loads with the page: map.js and the chunks it imports outright; the rest waits for an `import()`.
  const outputs = metafiles[name].outputs;
  const withPage = new Set();
  const reach = (path) => {
    if (withPage.has(path)) return;
    withPage.add(path);
    for (const used of outputs[path]?.imports ?? []) if (used.kind === 'import-statement') reach(used.path);
  };
  reach(Object.keys(outputs).find((path) => path.endsWith('/map.js')));
  const sizes = Object.keys(outputs).filter((path) => path.endsWith('.js')).map((path) => {
    const text = readFileSync(path);
    const file = path.split('/').pop();
    const leaflet = !withPage.has(path) && /Leaflet|leaflet-container/.test(String(text));
    const routes = !withPage.has(path) && !leaflet && /route\/v1|computeRoutes|route\/directions/.test(String(text));
    return { file, raw: text.length, gzip: gzipSync(text).length, leaflet, routes, later: !withPage.has(path) };
  });
  for (const s of sizes) console.log(`${name} · ${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.leaflet ? ' (Leaflet, loaded with the first map)' : s.routes ? ' (routes, loaded with the first route)' : s.later ? ' (loaded when first needed)' : ''}`);
  if (!sizes.some((s) => s.leaflet)) throw new Error('Leaflet is not in a chunk of its own: a page without a map would load it');
  return {
    own: sizes.filter((s) => !s.later).reduce((sum, s) => sum + s.gzip, 0),
    leaflet: sizes.filter((s) => s.leaflet).reduce((sum, s) => sum + s.gzip, 0),
    routes: sizes.filter((s) => s.routes).reduce((sum, s) => sum + s.gzip, 0),
  };
}

const fields = await measure('fields', 'mapWidgets, mapKinds, azureMaps, googleMaps, mapbox, openStreetMap, tiles');
const all = await measure('all');
const kb = (n) => (n / 1024).toFixed(1);
if (fields.own > BUDGET.fields * 1024) throw new Error(`@fieldia/map for a place and an area is ${kb(fields.own)} KB gzipped, over its ${BUDGET.fields} KB budget`);
if (all.own > BUDGET.all * 1024) throw new Error(`@fieldia/map with a list's map is ${kb(all.own)} KB gzipped, over its ${BUDGET.all} KB budget`);
if (all.leaflet > BUDGET.leaflet * 1024) throw new Error(`Leaflet's chunk is ${kb(all.leaflet)} KB gzipped, over its ${BUDGET.leaflet} KB budget`);
if (!all.routes) throw new Error('The routes are not in a chunk of their own: every map would carry them');
if (all.routes > BUDGET.routes * 1024) throw new Error(`The routes' chunk is ${kb(all.routes)} KB gzipped, over its ${BUDGET.routes} KB budget`);
console.log(`@fieldia/map: ${kb(fields.own)} KB gzipped for a place and an area (budget ${BUDGET.fields}), ${kb(all.own)} KB with a list's map and a form's (budget ${BUDGET.all}); Leaflet ${kb(all.leaflet)} KB with the first map (budget ${BUDGET.leaflet}); routes ${kb(all.routes)} KB with the first route (budget ${BUDGET.routes})`);
