/**
 * Build the `<script>` bundle: core, widgets and viewer in one file that sets
 * the global `Fieldia`, for pages with no build step —
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
 *   <script>Fieldia.mountViewer(element, { page, dataSource })</script>
 *
 * It ships inside @fieldia/viewer (the `bundle/` folder), so its version is
 * always the viewer's. Then it checks the file: it must run on its own and
 * define the global with the viewer in it.
 */
import { build, transform } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/libs/viewer/bundle/fieldia.js');
const { version } = JSON.parse(readFileSync(join(WORKSPACE, 'libs/viewer/package.json'), 'utf8'));

/**
 * The stylesheets ship as text inside the code, which the code's minifier
 * leaves alone: minify that text as CSS, with esbuild's own CSS minifier.
 */
const minifiedStyles = {
  name: 'minified-styles',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(widgets|viewer)\/src\/lib\/(([a-z-]+-)?styles|styles-[a-z-]+)\.ts$/ }, async ({ path }) => {
      const source = readFileSync(path, 'utf8');
      const literal = /(= (?:\/\* css \*\/ )?`)([^`]*)(`;)/;
      const found = literal.exec(source);
      if (!found) throw new Error(`no stylesheet found in ${path}`);
      const { code: css } = await transform(found[2], { loader: 'css', minify: true, charset: 'utf8', logLevel: 'error' });
      // Text that could end the literal, or be read as part of it, would break the code.
      if (/[`\\]|\$\{/.test(css)) throw new Error(`the minified stylesheet of ${path} cannot sit in a template literal`);
      return { contents: source.replace(literal, (_, open, _css, close) => open + css.trim() + close), loader: 'ts' };
    });
  },
};

await build({
  entryPoints: [join(WORKSPACE, 'tools/script-entry.ts')],
  plugins: [minifiedStyles],
  bundle: true,
  format: 'iife',
  globalName: 'Fieldia',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  banner: { js: `/*! Fieldia ${version} · MIT · https://fieldia.dev */` },
  define: { __FIELDIA_VERSION__: JSON.stringify(version) },
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  outfile: OUT,
  logLevel: 'warning',
});

// It must stand on its own: run it with nothing but a window and look for the viewer.
const sandbox = { window: {}, self: {}, globalThis: {} };
runInNewContext(readFileSync(OUT, 'utf8'), sandbox);
const Fieldia = sandbox.Fieldia;
for (const name of ['mountViewer', 'createMemoryDataSource', 'createForm', 'checkPage', 'translatePage']) {
  if (typeof Fieldia?.[name] !== 'function') throw new Error(`the script bundle does not define Fieldia.${name}`);
}
// Light enough for a page with no build step: no validation library, and under budget.
const code = readFileSync(OUT, 'utf8');
if (/ZodError|\$ZodType/.test(code)) throw new Error('the script bundle carries zod: something imports the format schemas');
// 190 until 0.9; lists, their search bar and their groups take it to 192 with the stylesheets minified;
// the format's additions to 200. The seven question kinds (signature, slider, tags, pictures, ranking,
// address, repeating group) and shuffled options add 26; values worked out from others, values set by a
// condition and answer rules add 13; groups side by side, arrangements, group styles, labels and the
// page's look add 7. The page's translations, choices from the app's lists, the tick box and dialogs in
// the page's look add 2.5 more, to 252. The choices' details (a yes or no as two buttons, a limit on
// boxes ticked, "None of these", columns, a dropdown that searches, pictures' words and sizes, a ranking's
// top few, a matrix's cards on a phone) add 7, to 267. Several files with a count, their list and
// thumbnails, the viewer and their words in four languages add 12, to 279.
// The inputs' details (web, phone, email and time checks, a date's limits and weekends, a count of
// characters, units and currency symbols, ratings' icons, NPS colours, keywords' most, in four languages)
// add 8.3, to 281.7.
// The structures' details (a signature's ink, undo and upload; an address's line 2, region, country list and
// parts that must be filled; a table's least and most lines, moves and asking before a line goes; cards moved
// and copied; links searched in full and opened; a heading button; a picture's width, place, link and caption,
// in four languages) add 10, to 291.7.
const BUDGET_KB = 292;
if (statSync(OUT).size > BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(statSync(OUT).size / 1024)} KB, over its ${BUDGET_KB} KB budget`);
// What a visitor downloads: the bundle gzipped, as servers send it. 76 at 0.9; the choices' details add
// 2.3 and several files with their viewer 3.9, to 82.3; the inputs' details (web, phone, email and time
// checked, a date's limits, a count of characters, units and symbols, rating looks and NPS) 2.8, to 85.1.
const GZIP_BUDGET_KB = 86;
const gzipped = gzipSync(code, { level: 9 }).length;
if (gzipped > GZIP_BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(gzipped / 1024)} KB gzipped, over its ${GZIP_BUDGET_KB} KB budget`);
if (Fieldia.VERSION !== version) throw new Error(`the script bundle says version ${Fieldia.VERSION}, the viewer is ${version}`);
console.log(`script bundle: ${OUT.replace(WORKSPACE + '/', '')} (${Math.round(statSync(OUT).size / 1024)} KB, ${Math.round(gzipped / 1024)} KB gzipped)`);
