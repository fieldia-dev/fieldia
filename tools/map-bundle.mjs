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
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
 * 0.24's lanes joined: a place, a route or an area found late laid on no
 * other record (save safety), the Enter an IME takes its word with left to it
 * (the input rules for names), typed coordinates keeping their places and a
 * pasted pair filling both boxes (the input rules for boxes) — 334 bytes more
 * for a place and an area (27,073: 26.2 goes to 26.5), 363 more for all
 * (47,198: 46.2); a list's map in a page of its own stays within its 31.1
 * (31,608).
 * 0.25's lanes joined, measured in the merged build: a place and an area as
 * it was (27,073); 140 bytes more for all (47,338: 46.3), from the core
 * and widgets code a list's map draws with, grown in this release; a list's
 * map in a page of its own 135 more, within its 31.1 (31,743).
 * 0.26's four lanes joined, measured in the merged build: a place and an area
 * as it was (27,072); 101 bytes more for all (47,441: 46.4) — a list's map
 * saying it could not load in the words its page names its records by, and
 * the one rule for a label inside a sentence (open-names), the core and
 * widgets code it draws with; a list's map in a page of its own 91 more,
 * within its 31.1 (31,830).
 * 0.26.1: the credits' links a 24px target (11 to 15 bytes) took a list's map
 * in a page of its own from 31,830 to the 31.1 itself, over it on CI's build:
 * 31.2.
 * A list's map whose data source gathers its records (`clusters`, Wave 5's
 * w5-map-clusters): the asks themselves — a view's bubbles a moment after the
 * map stops, the last one winning, a new search's extent first to fit to, a
 * bubble's records on one spot, a lit row's place — in a chunk of their own
 * (server-clusters, 1.1), loaded with the first map whose source gathers; with
 * the page, what every list's map needs to know of them: the search sent to
 * the source or loaded, its bubbles drawn and gathered again with the records
 * standing alone (by their counts), a bubble of the source's pressed, its count
 * for Search this area, its heat, the keys kept on a record drawn again, an
 * open card's record on its own pin, and "And 10 more here" in four languages
 * — 1,083 bytes more for all (47,484 to 48,567: 47.5), 1,040 more for a list's
 * map in a page of its own (31,865 to 32,905: 32.2); a place and an area as
 * they were (27,084).
 * Turkish, Persian, Urdu and Spanish (0.31, w6-languages — machine-assisted, not yet reviewed by a native speaker),
 * each in a chunk of its own (locales/), fetched where it is spoken before a page in it is drawn (`wordsReady` in
 * @fieldia/core): what a bundle carries is the loader alone — `inChunks`, kept out of a bundle that never reads its table
 * — and a list's map in a page of its own drawn once they have come; the Arabic comma for Persian and Urdu and a day's
 * tag on the Gregorian calendar from @fieldia/core. A place and an area 27,088 bytes measured before, 27,315 after, to
 * 26.7; all 48,566 to 48,980, to 47.9; a list's map in a page of its own 32,907 to 33,289, to 32.6. (Carried inline, as
 * Arabic, German and French are, they took them to 31,514, 54,854 and 38,586.)
 * The owner's observations of 23 Oct (obs-1023, 0.32): a card's tick box the size every tick box is (`--fd-tick-size`,
 * 18px), drawn as the form's own in a form and the browser's in the accent on a page of its own, said in its rule —
 * all 48,982 bytes measured before, 49,050 after, to 48.0; a list's map in a page of its own 33,289 to 33,360, inside
 * its 32.6; a place and an area as they were (27,314).
 * While it waits (w7-loading, 0.33): a list's map and a form's waiting the one way (loading.ts in @fieldia/widgets) — a
 * skeleton block as tall as the map until its map and its places are in, its places asked again under a bar, a failure
 * in its place with Retry (list-view.ts, form-map.ts) — all 49,054 bytes measured before, 49,373 after, to 48.3; a list's
 * map in a page of its own 33,359 to 33,663, to 32.9; a place and an area as they were (27,315).
 */
// 0.34's merge: a card's and a pin's addresses through safeUrl (harden-edges), their words' formatters made once
// (harden-perf) — for a place and an area 27,317 bytes measured before, 27,389 after, to 26.8; with a list's map
// 49,375, 49,478, to 48.4; a list's map in a page of its own 33,663, 33,763, to 33.0.
// 0.35 (perf-bytes): the map's own code in parts of their own (map-parts.ts), as the calendar's view is — a list's map
// (`mapview`), a form's map (`formmap`) and the place, area and address fields (`mapwidgets`), each fetched the first
// time a page shows what it draws, Leaflet asked for beside them — and the maps' words in Arabic, German and French in
// chunks of their own, as every package's are: with the page, a place and an area 27,389 bytes measured before, 11,930
// after (−56%), to 11.7; with a list's map and a form's 49,478, 13,584 (−73%), to 13.3; a list's map in a page of its
// own 33,763, 10,860 (−68%), to 10.7. Each part against its own budget, with the chunks it shares with the others,
// loaded with the first map that draws it (`PART_BUDGET`): a list's map 22,037 bytes, a form's 19,826, the fields'
// 18,379 measured, to 21.6, 19.5 and 18.0.
// 0.35's merge: a row pointed at moves only the pins whose light changes (perf-lists, list-view.ts), and a list's map
// asks for its images once its records place it, never a screenful at its starting view first (`imagesAfter`,
// map-core.ts and list-view.ts) — a list's map 22,037 bytes at perf-bytes, 22,079 with the pins, 22,174 with its images
// held, to 21.7; a form's 19,826, 19,852, inside its 19.5; the fields' 18,379, 18,416, 18,442, to 18.1.
// 0.36 (p3-real-tests, lane F3 — what the demos' how-to replays found on the maps): a box or a circle drawn, and a shape
// carried, holding off the browser's own selection and drag and drop as Leaflet's drags do (drawing.ts, area.ts); a
// bubble whose pins spread wider than the map shows pressed one step closer on its spot, never a fit that only pans
// (marks.ts); the bar over the map letting presses through but on its buttons, in a finger's words on a touch screen
// (drawPolygonTouch, measureHintTouch) and "1 point" said as one (pointsOne), each in the eight languages; a zoom key
// pressed while the map still zooms kept as a button's press is (map-core.ts) — with the page, the English words alone:
// a place and an area 11,929 bytes measured before, 12,017 after, to 11.8; with a list's map 13,584, 13,671, to 13.4;
// a list's map in a page of its own 10,859, 10,945, inside its 10.7. The parts: a list's map 22,174, 22,483, to 22.0; a
// form's 19,852, 20,042, to 19.6; the fields' 18,442, 18,726, to 18.3. (The legend folded on a phone is the areas'
// chunk's, loaded with the first map that has them.) Then every card a map opens kept inside it on a phone (popCard,
// marks.ts): between the columns of buttons, no taller than the map has room for, its picture shorter and its buttons
// kept at its foot, the words over the map stepping aside while it is open (styles.ts, in the chunk the parts share) —
// a list's map 22,483 bytes, 22,752, to 22.3; a form's 20,042, 20,339, to 19.9; the fields' 18,726, 18,892, to 18.5;
// with the page as it was.
const BUDGET = { fields: 11.8, all: 13.4, embed: 10.7, leaflet: 47, routes: 2 };
const PART_BUDGET = { 'view-part': 22.3, 'form-part': 19.9, 'widgets-part': 18.5 };

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
    // Leaflet's chunk by what it is made of — Leaflet and its stylesheet — never by its words: the maps' own styles name
    // .leaflet-container too, in a chunk of their own since 0.35 (map-parts.ts).
    const inputs = Object.keys(outputs[path].inputs);
    const leaflet = !withPage.has(path) && inputs.some((input) => /node_modules\/leaflet\/|lib\/leaflet-css\.ts$/.test(input));
    const routes = !withPage.has(path) && !leaflet && /route\/v1|computeRoutes|route\/directions/.test(String(text));
    return { file, raw: text.length, gzip: gzipSync(text).length, leaflet, routes, later: !withPage.has(path) };
  });
  for (const s of sizes) console.log(`${name} · ${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.leaflet ? ' (Leaflet, loaded with the first map)' : s.routes ? ' (routes, loaded with the first route)' : s.later ? ' (loaded when first needed)' : ''}`);
  if (!sizes.some((s) => s.leaflet)) throw new Error('Leaflet is not in a chunk of its own: a page without a map would load it');
  // Each of the map's parts, loaded the first time what it draws is shown: its chunk and those it imports outright, less
  // what came with the page — never with the page.
  const parts = {};
  for (const part of Object.keys(PART_BUDGET)) {
    const chunk = Object.keys(outputs).find((path) => outputs[path].entryPoint?.endsWith(`lib/${part}.ts`));
    if (!chunk) continue;
    if (withPage.has(chunk)) throw new Error(`${part} comes with the page: the map's code would be on every page that imports @fieldia/map`);
    const closure = new Set();
    const into = (path) => {
      if (closure.has(path) || withPage.has(path) || !outputs[path]) return;
      closure.add(path);
      for (const used of outputs[path].imports) if (used.kind === 'import-statement') into(used.path);
    };
    into(chunk);
    parts[part] = [...closure].reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0);
  }
  return {
    parts,
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
for (const [part, budget] of Object.entries(PART_BUDGET)) {
  const size = all.parts[part];
  if (!size) throw new Error(`The map's ${part} is not a chunk of its own`);
  console.log(`@fieldia/map's ${part}: ${kb(size)} KB gzipped with the first map that draws it (budget ${budget}) — ${size} bytes`);
  if (budget && size > budget * 1024) throw new Error(`The map's ${part} is ${kb(size)} KB gzipped, over its ${budget} KB budget`);
}
console.log(`@fieldia/map: ${kb(fields.own)} KB gzipped for a place and an area (budget ${BUDGET.fields}), ${kb(all.own)} KB with a list's map and a form's (budget ${BUDGET.all}), ${kb(embed.own)} KB for a list's map in a page of its own (budget ${BUDGET.embed}); Leaflet ${kb(all.leaflet)} KB with the first map (budget ${BUDGET.leaflet}); routes ${kb(all.routes)} KB with the first route (budget ${BUDGET.routes}) — ${fields.own}, ${all.own} and ${embed.own} bytes`);
