/**
 * @fieldia/map's size, as an app's bundler would make it: the package's own
 * code (loaded with the page) and Leaflet (loaded the first time a map is
 * shown, in a chunk of its own), each against its budget. Fieldia's own
 * packages are left out: an app has them already.
 *
 *   node tools/map-bundle.mjs
 */
import { build } from 'esbuild';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'tmp/map-bundle');
rmSync(OUT, { recursive: true, force: true });
await build({
  entryPoints: { map: join(WORKSPACE, 'libs/map/src/index.ts') },
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  outdir: OUT,
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  external: ['@fieldia/core', '@fieldia/widgets', 'tslib'],
  logLevel: 'warning',
});

/** In KB, gzipped: the package's own code with the page, and Leaflet when a map is shown. */
const BUDGET = { own: 19, leaflet: 47 };
const files = readdirSync(OUT).filter((file) => file.endsWith('.js'));
const sizes = files.map((file) => {
  const text = readFileSync(join(OUT, file));
  return { file, raw: text.length, gzip: gzipSync(text).length, leaflet: file !== 'map.js' && /Leaflet|leaflet-container/.test(String(text)) };
});
const own = sizes.filter((s) => !s.leaflet).reduce((sum, s) => sum + s.gzip, 0);
const leaflet = sizes.filter((s) => s.leaflet).reduce((sum, s) => sum + s.gzip, 0);
for (const s of sizes) console.log(`${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.leaflet ? ' (Leaflet, loaded with the first map)' : ''}`);
if (!leaflet) throw new Error('Leaflet is not in a chunk of its own: a page without a map would load it');
if (own > BUDGET.own * 1024) throw new Error(`@fieldia/map's own code is ${(own / 1024).toFixed(1)} KB gzipped, over its ${BUDGET.own} KB budget`);
if (leaflet > BUDGET.leaflet * 1024) throw new Error(`Leaflet's chunk is ${(leaflet / 1024).toFixed(1)} KB gzipped, over its ${BUDGET.leaflet} KB budget`);
console.log(`@fieldia/map: ${(own / 1024).toFixed(1)} KB gzipped with the page (budget ${BUDGET.own}), Leaflet ${(leaflet / 1024).toFixed(1)} KB with the first map (budget ${BUDGET.leaflet})`);
