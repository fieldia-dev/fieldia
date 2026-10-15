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
 * style and their words — with the traffic, 1.4 more, to 39.9. An address
 * with suggestions (`char.address-search`): its suggestions, their style and
 * their words in a chunk of their own (1.8, with the first address field
 * shown), each provider's address parts in another (0.8, with the first
 * search that asks for parts or countries); with the page, the box itself,
 * the providers' countries and parts asked for, an address's line said once
 * in the page's language (a place's too), and its kind in the designer with
 * its words in four languages (the words a chunk of their own, shared with
 * the suggestions) — 1.6 more, to 25.4; 1.6 more, to 41.5. A page with no
 * designer (`mapWidgets` and a provider) carries 0.7 of it.
 *
 * A list's map in a page of the app's own (mountListMap: the page checked
 * and in its language, the app's search and choices, its own base and its
 * tokens light and dark, which the viewer's form gave it before), a list's
 * map's height and gestures, its starting view, its view said as it stops,
 * the closest a fit comes, and "Search this area (24)" with its word in four
 * languages (the counting itself is a chunk of its own, loaded when the
 * button first shows), none of it offered when nothing takes a search — 2.4
 * more, to 42.3. An app of the viewer's carries none of the page of its own:
 * its bundler leaves mountListMap out.
 * `embed`: a site's own page with mountListMap and the providers alone: 29.4.
 * A pin's
 * price as a page says it (short, the home currency unsaid, "/month" on a
 * rent, named in full to a screen reader), a card's bare lines, several
 * fields on one line with their words in the plural they need, its lead
 * line, its link and its box to choose left off, each word of a record in
 * its own direction, an amount's symbol kept whole on an Arabic page ("E£",
 * never "£E"), and an area's words given as text — 1.1 more, to 41.0.
 * All three together in 0.19 (the address, the page of its own, the
 * money look, and Search this area stepping aside from an open card; the
 * page of its own carries the card's and the pin's money
 * too): 25.6 for a place and an area, 45.1 for all, 31.1 for the page of
 * its own. Azure's and Google's addresses as they answer them live (a
 * search kept to each country, a picked one checked in its district, the
 * city where each country keeps it, Google's plus codes and numbers): read
 * in the address chunk, loaded now with any of their searches (3.2), which
 * takes Azure's places out of the page — 0.4 less, 0.3 less, 0.3 less.
 * The search box (with every place's map, so in the page) dropping a search
 * on Escape as it does on a pick and on leaving, saying none is going once
 * dropped, keeping each search's places until a pick so no words are paid
 * for twice, and asking nothing for Enter on the place picked; Google's
 * token sent with its session's first Place Details alone: 5 bytes over
 * 45.1 for all, which goes to 45.2. A search dropped on its way let come
 * back (the provider has it, and may bill it), its answer kept for its
 * words, and the same words waiting for it rather than asked again; a pick
 * calling back what is still on its way; ArrowUp from no row marking the
 * last: 30 bytes more for a place and an area (2 under its 25.6), 59 more
 * for all, 16 over 45.2, which goes to 45.3.
 * A place's coordinates read by Fieldia's one number reader (Persian digits,
 * direction marks, never grouped) and guarded as every number box is: a
 * letter refused as it is typed and said under its box, the keys after it
 * held, and leaving with them saying why in the note, its hint giving way —
 * about 165 bytes more for a place and an area (26,378: 25.6 goes to 25.8),
 * 95 over 45.3 for all (46,482: 45.4). The reader and the guard are @fieldia/core's and @fieldia/widgets',
 * which every form carries already.
 * A coordinate that does not read stopping every save (as an unread number
 * does), a save waiting for a place still being found, and a coordinate that
 * reads kept as typed beside one still to come: 361 bytes more for a place
 * and an area (26,739: 25.8 goes to 26.2), 353 more for all (46,835: 45.8).
 */
const BUDGET = { fields: 26.2, all: 45.8, embed: 31.1, leaflet: 47, routes: 2 };

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
const embed = await measure('embed', 'mountListMap, azureMaps, googleMaps, mapbox, openStreetMap, tiles');
const kb = (n) => (n / 1024).toFixed(1);
if (fields.own > BUDGET.fields * 1024) throw new Error(`@fieldia/map for a place and an area is ${kb(fields.own)} KB gzipped, over its ${BUDGET.fields} KB budget`);
if (all.own > BUDGET.all * 1024) throw new Error(`@fieldia/map with a list's map is ${kb(all.own)} KB gzipped, over its ${BUDGET.all} KB budget`);
if (embed.own > BUDGET.embed * 1024) throw new Error(`@fieldia/map for a list's map in a page of its own is ${kb(embed.own)} KB gzipped, over its ${BUDGET.embed} KB budget`);
if (all.leaflet > BUDGET.leaflet * 1024) throw new Error(`Leaflet's chunk is ${kb(all.leaflet)} KB gzipped, over its ${BUDGET.leaflet} KB budget`);
if (!all.routes) throw new Error('The routes are not in a chunk of their own: every map would carry them');
if (all.routes > BUDGET.routes * 1024) throw new Error(`The routes' chunk is ${kb(all.routes)} KB gzipped, over its ${BUDGET.routes} KB budget`);
console.log(`@fieldia/map: ${kb(fields.own)} KB gzipped for a place and an area (budget ${BUDGET.fields}), ${kb(all.own)} KB with a list's map and a form's (budget ${BUDGET.all}), ${kb(embed.own)} KB for a list's map in a page of its own (budget ${BUDGET.embed}); Leaflet ${kb(all.leaflet)} KB with the first map (budget ${BUDGET.leaflet}); routes ${kb(all.routes)} KB with the first route (budget ${BUDGET.routes})`);
