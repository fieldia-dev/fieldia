/**
 * Build the `<script>` bundle: core, widgets and viewer in one file that sets
 * the global `Fieldia`, for pages with no build step —
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
 *   <script>Fieldia.mountViewer(element, { page, dataSource })</script>
 *
 * Its own words are English. Arabic, German and French ship as add-on
 * scripts beside it — `fieldia.ar.js`, `fieldia.de.js`, `fieldia.fr.js` — each
 * carrying that language's words alone, which a page loads after the main one:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.ar.js"></script>
 *
 * They ship inside @fieldia/viewer (the `bundle/` folder), so their version is
 * always the viewer's. Then it checks the files: the main one must run on its
 * own and define the global with the viewer in it, and each add-on must give
 * it that language's words.
 */
import { build, transform } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle');
const OUT = join(BUNDLE, 'fieldia.js');
/** The languages besides English, each an add-on script of its own. */
const LANGUAGES = { ar: 'Arabic', de: 'German', fr: 'French' };
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

/**
 * English alone in the main script: each package's module of the other
 * languages (`locales/all.ts`) is built as an empty one, so their words stay
 * out; the add-ons bring them.
 */
const englishOnly = {
  name: 'english-only',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(core|widgets|viewer)\/src\/lib\/(record\/)?locales\/all\.ts$/ }, () => ({ contents: 'export const LANGUAGES = {};', loader: 'ts' }));
  },
};

/** What the main script and the add-ons are built with alike: ASCII, minified, for browsers since 2020. */
const common = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  charset: 'ascii',
  define: { __FIELDIA_VERSION__: JSON.stringify(version) },
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  logLevel: 'warning',
};

await build({
  ...common,
  entryPoints: [join(WORKSPACE, 'tools/script-entry.ts')],
  plugins: [minifiedStyles, englishOnly],
  globalName: 'Fieldia',
  banner: { js: `/*! Fieldia ${version} · MIT · https://fieldia.dev */` },
  outfile: OUT,
});

// Each language's add-on: its words from the three packages, handed to the main script's addLanguage.
for (const [locale, name] of Object.entries(LANGUAGES)) {
  await build({
    ...common,
    stdin: {
      contents: [
        `import { ${locale} as messages } from './libs/core/src/lib/record/locales/${locale}';`,
        `import { ${locale} as widgets } from './libs/widgets/src/lib/locales/${locale}';`,
        `import { ${locale} as viewer } from './libs/viewer/src/lib/locales/${locale}';`,
        `import { addOn } from './tools/script-language';`,
        `addOn('${locale}', { messages, widgets, viewer });`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      sourcefile: `fieldia.${locale}.ts`,
      loader: 'ts',
    },
    banner: { js: `/*! Fieldia ${version} · ${name} · MIT · https://fieldia.dev */` },
    outfile: join(BUNDLE, `fieldia.${locale}.js`),
  });
}

// It must stand on its own: run it with nothing but a window and look for the viewer.
const sandbox = { window: {}, self: {}, globalThis: {} };
runInNewContext(readFileSync(OUT, 'utf8'), sandbox);
const Fieldia = sandbox.Fieldia;
for (const name of ['mountViewer', 'createMemoryDataSource', 'createForm', 'checkPage', 'translatePage', 'addLanguage']) {
  if (typeof Fieldia?.[name] !== 'function') throw new Error(`the script bundle does not define Fieldia.${name}`);
}
// Light enough for a page with no build step: no validation library, English alone, and under budget.
const code = readFileSync(OUT, 'utf8');
if (/ZodError|\$ZodType/.test(code)) throw new Error('the script bundle carries zod: something imports the format schemas');
for (const table of ['MESSAGES', 'WIDGET_LABELS', 'VIEWER_LABELS']) {
  const held = Object.keys(Fieldia[table] ?? {}).join(', ');
  if (held !== 'en') throw new Error(`the script bundle's ${table} holds ${held}: English alone belongs in it, the other languages in their add-ons`);
}
// esbuild writes ASCII, so an Arabic letter is an escape: \u0621 to \u064A (Arabic-Indic digits, read in numbers, sit above).
if (/\\u06[2-4][0-9a-f]/i.test(code)) throw new Error('the script bundle carries Arabic letters: some words in Arabic got past the add-on');
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
// English alone in the one-tag script; the other languages as add-ons save 29.8, to 262.2.
// Each kind of part's own look (text boxes, choices, groups, buttons and tables: a ground, an edge,
// corners, a size of words and an accent, each kept readable in either scheme) adds 4.8, to 267.
// A saved form placed in another — the part checked, its answers nested under its name and checked by
// its own page, drawn in place from the app's pages, said in words when it cannot be — adds 6, to 273.
const BUDGET_KB = 273;
if (statSync(OUT).size > BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(statSync(OUT).size / 1024)} KB, over its ${BUDGET_KB} KB budget`);
// What a visitor downloads: the bundle gzipped, as servers send it. 76 at 0.9; the choices' details add
// 2.3 and several files with their viewer 3.9, to 82.3; the inputs' details (web, phone, email and time
// checked, a date's limits, a count of characters, units and symbols, rating looks and NPS) 2.8, to 85.1;
// signatures' pens and undo, addresses' parts and countries, lines' and cards' moves and pictures' captions
// 3.4, to 88.5. English alone, the other languages as add-ons (fieldia.ar.js, …) save 8, to 80.6.
// Each kind of part's own look adds 1.2, to 81.8; a saved form placed in another, its answers nested
// and checked inside it, 2.3, to 84.1.
const GZIP_BUDGET_KB = 85;
const gzipped = gzipSync(code, { level: 9 }).length;
if (gzipped > GZIP_BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(gzipped / 1024)} KB gzipped, over its ${GZIP_BUDGET_KB} KB budget`);
if (Fieldia.VERSION !== version) throw new Error(`the script bundle says version ${Fieldia.VERSION}, the viewer is ${version}`);
console.log(`script bundle: ${OUT.replace(WORKSPACE + '/', '')} (${Math.round(statSync(OUT).size / 1024)} KB, ${Math.round(gzipped / 1024)} KB gzipped)`);

/**
 * Each add-on: small, the language's words alone (never a second copy of
 * Fieldia), and with the main script — after it, before it (an `async` script
 * may run first) or twice — Fieldia then has every word of that language, as
 * the packages have it.
 */
// A saved form's four messages take Arabic's to 18.1.
const ADD_ON_BUDGET_KB = { ar: [18.5, 4], de: [8, 3.5], fr: [8, 3.5] };
const sourceWords = async (locale) => {
  const { outputFiles } = await build({
    ...common,
    sourcemap: false,
    write: false,
    globalName: 'words',
    stdin: {
      contents: [
        `export { ${locale} as messages } from './libs/core/src/lib/record/locales/${locale}';`,
        `export { ${locale} as widgets } from './libs/widgets/src/lib/locales/${locale}';`,
        `export { ${locale} as viewer } from './libs/viewer/src/lib/locales/${locale}';`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      loader: 'ts',
    },
  });
  const sandbox = {};
  runInNewContext(outputFiles[0].text, sandbox);
  return sandbox.words;
};
/** Words compared whatever their order. */
const sorted = (tables) => JSON.stringify(Object.fromEntries(Object.entries(tables).sort().map(([part, words]) => [part, Object.fromEntries(Object.entries(words ?? {}).sort())])));
const runTogether = (files, sandbox = {}) => {
  const warnings = [];
  Object.assign(sandbox, { console: { warn: (message) => warnings.push(message) } });
  for (const file of files) runInNewContext(readFileSync(file, 'utf8'), sandbox);
  return { Fieldia: sandbox.Fieldia, warnings };
};
const sizes = [];
for (const locale of Object.keys(LANGUAGES)) {
  const file = join(BUNDLE, `fieldia.${locale}.js`);
  const addOn = readFileSync(file, 'utf8');
  const name = `the ${LANGUAGES[locale]} add-on`;
  if (/mountViewer|createForm/.test(addOn)) throw new Error(`${name} carries a copy of Fieldia: it must carry the language's words alone`);
  const [raw, gzip] = ADD_ON_BUDGET_KB[locale];
  const addOnGzipped = gzipSync(addOn, { level: 9 }).length;
  if (addOn.length > raw * 1024) throw new Error(`${name} is ${(addOn.length / 1024).toFixed(1)} KB, over its ${raw} KB budget`);
  if (addOnGzipped > gzip * 1024) throw new Error(`${name} is ${(addOnGzipped / 1024).toFixed(1)} KB gzipped, over its ${gzip} KB budget`);
  const expected = sorted(await sourceWords(locale));
  for (const order of [[OUT, file], [file, OUT], [OUT, file, file]]) {
    const { Fieldia: withIt, warnings } = runTogether(order);
    const got = sorted({ messages: withIt.MESSAGES[locale], widgets: withIt.WIDGET_LABELS[locale], viewer: withIt.VIEWER_LABELS[locale] });
    const loaded = order.map((f) => f.replace(BUNDLE + '/', '')).join(', then ');
    if (got !== expected) throw new Error(`${loaded}: Fieldia does not have every ${LANGUAGES[locale]} word`);
    if (warnings.length) throw new Error(`${loaded}: ${warnings.join(' ')}`);
    if (withIt.FieldiaLanguages !== undefined) throw new Error(`${loaded}: the add-on's words were left waiting`);
  }
  // A main script of another version: the add-on says so, and still gives its words.
  const other = runTogether([file], { Fieldia: { VERSION: '0.0.0', addLanguage: () => undefined } });
  if (other.warnings.length !== 1 || !other.warnings[0].includes(`fieldia.${locale}.js is version ${version}`)) throw new Error(`${name} does not warn of a main script of another version`);
  sizes.push(`${locale} ${(addOn.length / 1024).toFixed(1)} KB, ${(addOnGzipped / 1024).toFixed(1)} KB gzipped`);
}
console.log(`language add-ons: ${sizes.join('; ')}`);
