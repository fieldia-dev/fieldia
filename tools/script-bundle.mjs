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
import { copyFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
  absWorkingDir: WORKSPACE,
  logLevel: 'warning',
};

// ---- the parts: code a page loads the first time it uses it, each a script of its own beside fieldia.js ----------------
//
// In the packages a part is a module asked for with import('./x-part') (libs/widgets/src/lib/parts.ts), which an app's
// bundler makes a file of its own. Here the main script asks for fieldia.<name>.js instead (tools/script-parts.ts), and
// each part is built against the main script: what it shares with it — the icons, the words, the helpers — it takes
// from the main script's own modules, passed to it in a table both are built with (`SHARED`), never a copy of its own.

/** What a part takes '@fieldia/core' as: the runtime the main script carries, never the format's schemas. */
const CORE_RUNTIME = join(WORKSPACE, 'libs/core/src/runtime.ts');

/**
 * The main script: each `import('./x-part')` asks for fieldia.x.js instead — the call itself becomes loadPart('x')
 * (tools/script-parts.ts), an import of the main script's own, so no module is made to wait on a lazy start — and
 * `fieldia:shared` is the table of what the parts take from the main script's modules: for each module, an object of
 * the names the parts use of it, in a fixed order (`table`: [file, names][]). Names alone, so the main script carries
 * nothing more than it would — no module's every export kept for one name. (Every export the packages share is a const,
 * a function or a class: a name's value never changes once the main script has started.) Any other import() would be
 * bundled in whole, where it saves nothing: refused.
 */
const asksForParts = (table, parts) => ({
  name: 'asks-for-parts',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(widgets|viewer)\/src\/lib\/[a-z-]+\.ts$/ }, ({ path }) => {
      const source = readFileSync(path, 'utf8');
      /** Whether code, its comments aside, calls import(). */
      const callsImport = (code) => /\bimport\s*\(/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1'));
      if (!callsImport(source)) return undefined;
      const asking = source.replace(/\bimport\('\.\/([a-z]+)-part'\)/g, (_, part) => {
        const file = join(dirname(path), `${part}-part.ts`);
        if (parts.has(part) && parts.get(part) !== file) throw new Error(`two parts are named ${part}: ${parts.get(part)} and ${file}`);
        parts.set(part, file);
        return `__fieldiaPart(${JSON.stringify(part)})`;
      });
      if (callsImport(asking)) throw new Error(`${path} loads a module with import(): the script bundle loads only parts (a ./x-part module) on demand`);
      return { contents: `import { loadPart as __fieldiaPart } from ${JSON.stringify(join(WORKSPACE, 'tools/script-parts.ts'))};\n${asking}`, loader: 'ts' };
    });
    builder.onResolve({ filter: /^fieldia:shared$/ }, () => ({ path: 'shared', namespace: 'fieldia-shared-table' }));
    builder.onLoad({ filter: /.*/, namespace: 'fieldia-shared-table' }, () => ({
      contents: [
        ...table.map(([file, names], i) => `import { ${names.map((name) => `${name} as m${i}_${name}`).join(', ')} } from ${JSON.stringify(file)};`),
        `export const SHARED = [${table.map(([, names], i) => `{ ${names.map((name) => `${name}: m${i}_${name}`).join(', ')} }`).join(', ')}];`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      loader: 'js',
    }));
  },
});

/**
 * A part: a module of the main script is taken from the table — `__fieldia`, its factory's argument — or, while the
 * table is worked out (`table` null), left an import of its own, so the part's code says which names it uses of it.
 */
const takesShared = (inMain, table) => ({
  name: 'takes-shared',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData?.inner || args.kind === 'entry-point') return undefined;
      const found = await builder.resolve(args.path === '@fieldia/core' ? CORE_RUNTIME : args.path, { kind: args.kind, importer: args.importer, resolveDir: args.resolveDir, pluginData: { inner: true } });
      if (found.errors.length) return { errors: found.errors };
      if (args.kind === 'dynamic-import') return { errors: [{ text: `${args.path} is loaded with import() from ${args.importer}, inside a part` }] };
      if (!inMain.has(found.path)) return { path: found.path, sideEffects: found.sideEffects };
      if (!table) return { path: found.path, external: true };
      const i = table.findIndex(([file]) => file === found.path);
      if (i < 0) return { errors: [{ text: `${found.path} is the main script's, but not in the parts' table` }] };
      return { path: String(i), namespace: 'fieldia-shared' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'fieldia-shared' }, ({ path: i }) => ({ contents: `module.exports = __fieldia[${i}];`, loader: 'js' }));
  },
});

/** The names a part's code imports from each of the main script's modules, read from its build with them left out. */
const namesUsed = (code) => {
  const used = new Map();
  const add = (file, names) => used.set(file, new Set([...(used.get(file) ?? []), ...names]));
  const list = (inside) => inside.split(',').map((one) => one.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  for (const [, names, file] of code.matchAll(/\b(?:import|export)\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) add(file, list(names));
  for (const [, file] of code.matchAll(/\b(?:import\s*\*\s*as\s*\w+|export\s*\*)\s*from\s*"([^"]+)"/g)) throw new Error(`a part takes every name of ${file}: name the ones it uses`);
  for (const [, file] of code.matchAll(/\bimport\s+\w+\s*(?:,\s*\{[^}]*\})?\s*from\s*"([^"]+)"/g)) add(file, ['default']);
  return used;
};

const mainScript = async (table) => {
  const parts = new Map();
  const { metafile } = await build({
    ...common,
    entryPoints: [join(WORKSPACE, 'tools/script-entry.ts')],
    plugins: [minifiedStyles, englishOnly, asksForParts(table, parts)],
    globalName: 'Fieldia',
    banner: { js: `/*! Fieldia ${version} · MIT · https://fieldia.dev */` },
    outfile: OUT,
    metafile: true,
  });
  const inMain = new Set(Object.keys(metafile.inputs).filter((input) => input.startsWith('libs/') || input.startsWith('tools/')).map((input) => join(WORKSPACE, input)));
  for (const [part, file] of parts) PART_SOURCES[part] = file;
  return { inMain, parts: [...parts.keys()].sort(), metafile };
};
/**
 * What a part carries of another project's work, named in its banner: the phone part's table of countries is made from
 * libphonenumber's metadata (Apache-2.0), its notice in libs/widgets/THIRD_PARTY_NOTICES.md, beside the bundle too.
 */
const NOTICES = { phone: " · its phone numbers' table derived from libphonenumber's metadata, (C) 2009 The Libphonenumber Authors, Apache-2.0: see THIRD_PARTY_NOTICES.md" };
const partScript = (part, inMain, table) =>
  build({
    ...common,
    stdin: { contents: `export * from ${JSON.stringify(PART_SOURCES[part])};`, resolveDir: WORKSPACE, sourcefile: `fieldia.${part}.ts`, loader: 'ts' },
    plugins: [minifiedStyles, englishOnly, takesShared(inMain, table)],
    globalName: 'part',
    // It hands itself to the main script (tools/script-parts.ts), or waits for it in the queue.
    banner: { js: `/*! Fieldia ${version} · ${part} · MIT · https://fieldia.dev${NOTICES[part] ?? ''} */\n(globalThis.FieldiaParts = globalThis.FieldiaParts || []).push([${JSON.stringify(part)}, ${JSON.stringify(version)}, function (__fieldia) {` },
    footer: { js: 'return part; }]);' },
    outfile: join(BUNDLE, `fieldia.${part}.js`),
    metafile: true,
  });
/** What a part uses of the main script's modules: its code built as a module, theirs left out, unminified. */
const partNeeds = async (part, inMain) => {
  const { outputFiles } = await build({
    ...common,
    format: 'esm',
    minify: false,
    sourcemap: false,
    write: false,
    stdin: { contents: `export * from ${JSON.stringify(PART_SOURCES[part])};`, resolveDir: WORKSPACE, sourcefile: `fieldia.${part}.ts`, loader: 'ts' },
    plugins: [minifiedStyles, englishOnly, takesShared(inMain, null)],
    outfile: join(BUNDLE, `fieldia.${part}.mjs`),
  });
  return namesUsed(outputFiles[0].text);
};

/** Each part's module, by its name, as the main script asks for it. */
const PART_SOURCES = {};

// The table settles in a round or two: the main script built with it may carry a module a part would otherwise have copied.
let table = [];
let main;
for (let round = 0; ; round++) {
  main = await mainScript(table);
  const wanted = new Map(table.map(([file, names]) => [file, new Set(names)]));
  for (const part of main.parts) for (const [file, names] of await partNeeds(part, main.inMain)) wanted.set(file, new Set([...(wanted.get(file) ?? []), ...names]));
  const next = [...wanted].map(([file, names]) => [file, [...names].sort()]).sort(([a], [b]) => (a < b ? -1 : 1));
  if (JSON.stringify(next) === JSON.stringify(table)) break;
  if (round === 4) throw new Error('the parts\' table of shared names does not settle');
  table = next;
}
const PARTS = main.parts;
// The notice a part's banner names, beside it: the bundle's folder is what a CDN serves and @fieldia/viewer ships.
copyFileSync(join(WORKSPACE, 'libs/widgets/THIRD_PARTY_NOTICES.md'), join(BUNDLE, 'THIRD_PARTY_NOTICES.md'));
const partFiles = {};
const partInputs = {};
for (const part of PARTS) {
  const { metafile } = await partScript(part, main.inMain, table);
  partFiles[part] = join(BUNDLE, `fieldia.${part}.js`);
  partInputs[part] = Object.keys(metafile.inputs).filter((input) => input.startsWith('libs/'));
  // A part made from another project's work says so where it is read: its first line names the notice.
  if (NOTICES[part] && !readFileSync(partFiles[part], 'utf8').split('\n')[0].includes('THIRD_PARTY_NOTICES.md')) throw new Error(`fieldia.${part}.js does not name the third-party notice its table needs`);
}
// A part's own code is in it alone: never in the main script, never in another part (it would be a second copy, its state twice).
for (const part of PARTS) {
  const inBoth = partInputs[part].filter((input) => main.inMain.has(join(WORKSPACE, input)));
  if (inBoth.length) throw new Error(`fieldia.${part}.js carries ${inBoth.join(', ')}, which the main script has too`);
  for (const other of PARTS.filter((one) => one > part)) {
    const twice = partInputs[part].filter((input) => partInputs[other].includes(input));
    if (twice.length) throw new Error(`fieldia.${part}.js and fieldia.${other}.js both carry ${twice.join(', ')}: a part's code belongs to one part`);
  }
}

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
// A page's steps and moments checked as it is shown — the fields each step names, its expressions, the
// tabs and wizard steps it goes to — add 2.3, to 275.3.
// The steps run — each kind, a page opened and its answers taken back, the app's answers, the moments one
// at a time, a person's change told from a step's, and the events an app hears — add 8.2, to 283.5.
// A page in a side panel — the dialog's own code at the screen's edge, a width, Done for values, a question
// before Escape or × drops changes, panels stacked one stepped back, and its slide in — adds 1.6, to 285.1.
// The viewer as the host of a page's steps — a page opened in a dialog, a panel or in the form's place with
// Back, words said as toasts, a button busy while its steps run, a tab shown for a step, and the app's own
// host and onOpen over it — adds 4.2, to 289.3.
// A panel from any side — the start or end of the line, or the left, right, top or bottom whatever the page
// reads, a height for the top and bottom, each sliding in and stepping back from its own edge — adds 1, to 290.2.
// Files as cards — a picture over each one's name, cut in the middle across two lines — and a switch that
// lets a person flip them between a list and the pictures, kept as a preference, add 2.9, to 293.1.
// The real pages' defects mended — a statusbar searched again as its filter's values change, placeholders on
// links, tags and formatted text, Clear selection left out on request, a dialog's words said by its opener,
// a tab strip that fades and scrolls, rows of twelfths that fit a column, and tabs built when first shown and
// updated only while shown — add 6.8, to 300.1.
// What real Flectra pages need of steps and conditions — roles on any part, the record's id, the person and a
// line's parent read in conditions, Python's tuples and and/or values, counts and sums where a condition holds
// and days between dates, defaults handed to new lines, links and records, reload, a web address and a list of
// related records opened, a wizard's own footer buttons — and a table's own rules (cells by line, columns by
// record, tones, row buttons, drawn in the plain table) and help behind a (?) add 17.1, to 317.2.
// The rest of what real Flectra tables need — a field's value in a tone and a value as a pill, buttons for the
// lines chosen and beside Add a line, a line copied, a line opening its own record's page, a many2many as a
// table, lines as cards on a phone and columns fit to content, a part hidden on a phone, a line's money in its
// record's currency, setWhen on a field's change, no value twice in a column, contains and =? in filters —
// add 17.2, to 334.4.
// How a dense sheet reads, as Flectra draws one — read-only values as words and a choice as a badge, several
// ribbons by condition, alerts holding a field's value with buttons inside and alerts in a tab, stat buttons
// that format money, hours and dates with a unit and a second value, a statusbar's condition, time per step,
// folded stages and a click that saves, keys on buttons with Alt, parts for editing or reading only, links'
// pictures, address lines and tag colours, and parts on one line — add 21.1 more, to 355.5.
// The business widgets real ERP screens lean on — priority stars and a state's dot (on the title's line too),
// hours as HH:MM, a per cent, a live timer, a range of dates on its own calendar, tag colours, a value to copy,
// a PDF or a page shown inline, an analytic distribution, tax totals, payments, properties from a linked record
// added to in place, a column drawn by its own widget — and their stylesheet add 40.1 more, to 395.6.
// What sits around a record — the bar over it with the breadcrumbs, a gear menu that is a real menu and the
// pager the app fills, the record's own steps (archive, duplicate, delete, a post in its conversation) and
// another record shown in place, the attachment beside the sheet in the browser's own PDF viewer, and the
// side panel kept beside it (5.3 of it the stylesheet) — add 20.3 more, to 415.9.
// Phase 26's last ten — a line opened in a form of its own (its parts checked against the line, the record
// as parent, its own lines held in it), a placeholder by condition, a field focused as the record opens, a
// table's order, a line kept from deletion, the app's context in conditions and filters, a stat button's
// help, a distribution's words in a cell, a column for some roles, a calendar's pick announced — add 6, to 422.4.
// What using the real pages showed: a line that follows the pointer as it is dragged, lists that float over the page
// where no table or cell clips them, tables' columns sized by their values and cells quiet until worked in — add 4.4, to 426.8.
// The form fields' defects mended (a (?) that only shows its help, kept on screen; values cut with an ellipsis and shown
// whole on hover; links and dates filling their one-line rows; a number edited without grouping) — add 2.4, to 429.2;
// the grid's editors as wide as their values, headers wrapping, an empty grid saying so, and a floating list that
// follows its control however the page moves it — 0.6 more, to 429.8;
// the live real pages swept again (a link's editor wide enough to read, words kept with their value, a line's
// buttons held in sight, words in a number box said at once, a link reopened by a click, numbers' columns as wide
// as their values) — 2 more, to 431.8; the merged demo records' money spaced from its symbol, properties laid out
// as the sheet's fields — 0.7 more, to 432.5; eight themes in known systems' styles (Material, Fluent, Apple, Bootstrap,
// shadcn, Ant, Odoo, Google Forms), light and dark, with their own shapes — 11.9 more, to 444.4; Fieldia's tokens in a
// cascade layer, so a host's own colours win whole, and labels beside set at their value's top — 0.6 more, to 445.0;
// a host's tokens worn by the form and its dialogs (tokens, setTokens) — 0.4 more, to 445.4.
// A list's records on a map (the List, Map and both switch, the map's place beside the table, its records lit and
// chosen with the rows, the page's checks of a map) — 4.8 more, to 452.2; a map on a form (drawn by the app's maps, its
// layers checked: places, lines, routes, the reader's own place) — 3.3 more, to 455.5; a list's buttons on its map's
// cards — 0.6 more, to 456.1; a map's areas by colour, reachable areas, fences and tools checked on a page, and a
// list put nearest a place first — 1.1 more, to 457.2; Enter moving on from a one-line code editor, as from a
// text box — 0.1 more, to 457.3; an address with suggestions checked as a page is shown (a char field, the
// kinds of the fields it fills with a place and an address's parts) — 1.1 more, to 458.4. The quiet look, a third skin (each value plain words until pointed at or entered,
// as Azure DevOps draws a work item: its stylesheet of rest, hover and editing for every kind of field that wears it,
// a state's dot with its words and a tick, a date opened at a click, the empty field's words, Escape putting a value
// back, the lock of a field locked by a rule with why, a choice's chevron and a date's calendar right to left) — 12.2
// more, to 469.5 alone: two thirds of it the stylesheet, whose rules each name the quiet field to win over the themes' own shapes.
// The money look alone: an amount's money look (its currency by code, after it, short, the home one
// unsaid, "/month" on a rent) in every list, field and card, a map card's lines, units and link checked on a
// page and translated with it — 2.7 more, to 460.0.
// Together in 0.19, the address's checks, the quiet look and the money look: 473.3.
// A record's head, as a work tracker draws a bug in a popup over its backlog (0.20's wi-header): the kind's strip
// and badge, the title line with Copy title, the row of people and counts, buttons split, toggled and by their icon
// alone with the record's ⋮, the band of fields with their access keys and a lock at the value, "Updated by", the
// tabs in the head with their counts; the dialog's inset size, clear backdrop, maximise and grip, the head as its own
// head and foot; values the server keeps (stored); the page's checks of it all; and the work item's shared icons —
// 38.3 more, to 511.6: 15 of it the stylesheet, 3 the icons, 4.4 the checks.
// The work item's pickers (docs/plans/work-item-replica.md, lane wi-picker) — a path picker for a record of a tree
// with its suggestions, the person's latest picks, the tree folded to the value, each row's words at its end and the
// tree's keys; Fieldia's own list with a tick for a choice and a state's list; a state's exact colours and its dot in
// a lead slot; tags added from a button; a person's outline while no one is picked; their checks on a page; their
// stylesheet (7 of it) and the icons the replica's lanes share (3) — add 25.3, to 498.6.
// A work item's body, as a work tracker draws one: groups with their own column widths and gap, their heading's tools
// at its end (⤢ alone over the body, ^ and ⌄, a field's own Edit and Done), help in a light box with links in its words;
// the formatted text's own editor — its toolbar only while worked in, inside the box at its foot, twenty named tools in
// a roving bar with "…" for those with no room, colours, sizes and emoji in real menus, people and records linked as
// they are typed, Remove link saying why — Markdown both ways written by hand (no library: a CommonMark subset, raw
// HTML escaped) with its card, hint and Preview, asking before formatting is lost; a links box with Add link and its
// menu; the sanitizer's spans, pictures and links in place; and their stylesheet (16 of it) — 62.5 more, to 536.
// A work item's icons, drawn as Fieldia's own (icons-work.ts: its kind, its window's and toolbars' tools, history,
// branch and pull request), which every part of the work item's popup names — 3.0 more, to 476.3.
// A list drawn as a work tracker's backlog: its cells (a state's dot in its colour, a kind's icon before the title, a
// width in characters with "…" past it, the side its words keep to) and their page checks, no box to choose a row, the
// filter bar (a keyword, each field's values to tick from its choices or its records, the gear that chooses the
// fields, × that clears them, with their keys), rows nested under their parent with Expand all and Collapse all,
// the list asking again when a row's dialog closes, Fluent's list look, empty quiet fields that say nothing, and the
// work item's icons (3 of it, shared with the record head, the pickers, the text and the history), a dialog's focus past
// a hidden box and a quiet field's Escape after its record came — 21.5 more, to 494.8.
// Joined for 0.20, the work item's popup over its backlog: the five lanes above in one bundle, their icons once — 612.7.
// The popup and its backlog set side by side with the tracker's screens: a list's columns in pixels kept as given (the
// card scrolling sideways), headers a ranked list does not sort by, a filter's own name, the row of the record open lit,
// Fluent's list as measured (36px rows, its headers' and cells' insets, the toggles' room) and its slim scroll bar; the
// popup's own slim scroll bars and grip band, a state's list leaving its words bare, a path picker open without a ring,
// Markdown's own tool drawings, a ladybird, a padlock, two rings for a link, a filter of three lines, and the CSS that
// says why for each — 9.3 more, to 622.0.
// The second side-by-side: a list's header rules each column can drop or set in (and their page checks), a record
// opened by the app with no row lit, the links help's icon on a tile of its colour, an open path picker ringed with a
// halo and its own slim bar, Undo, Remove link and an empty comment's Save drawn idle with their reasons in their
// tooltips, the grip's triangle, the head's tab pills and icons, the filter bar's measured room, and the CSS that says
// why for each — 4.0 more, to 626.0.
// The work item's parts loaded on first use (libs/widgets/src/lib/parts.ts, each a script beside this one): a record's
// head with its band, its split and toggled buttons, a group's heading with its tools and the inset dialog's ⤢ and grip
// (fieldia.head.js); the formatted text's editors, Markdown both ways, their menus and the links box (fieldia.text.js);
// a path picker (fieldia.path.js); a choice in Fieldia's own list (fieldia.choice.js); a list's filter bar
// (fieldia.filters.js) — their code and their stylesheets out of this script, which keeps what every page draws at mount
// (the page's checks of a head, buttons, groups and list cells, which checkPage gives at once; a list's backlog cells,
// nested rows and Fluent's list look; a state's dot and the rows of Fieldia's lists it opens; the access key and a lock at
// a value; help boxes and a group's tracks; the work item's icons, which any page may name; the dialog's choice of its
// head) and the parts' loader with the table of names they share with it (1.9) — 104.4 less, to 521.6.
// The third side-by-side: the head's eye, back arrow, copy, paperclip, padlock and speech bubble redrawn in one-pixel
// lines as the tracker's, a person's outline as small as its, the State list's rows 30.3px apart, and the backlog's
// title lead and the room after its grid as measured — 0.2 more, to 521.8.
// 0.21's data source contract (docs/plans/wave1-contract.md): a loaded record with its version and permissions, a
// save's conflict, and the memory source keeping them — versions, a change from elsewhere, permissions kept to as a
// backend keeps them, every id a search matches, totals by field and group, a file stored with its progress — 3.4
// more, to 525.2.
// 0.21's safety kit: errors kept to their part (a widget, a slot, a map or any part that throws draws a box that names
// it, tells the console and onError, and the rest of the form goes on — libs/widgets/src/lib/contain.ts and the viewer's
// guards, the box's words and look), and the page format's versions (upgradePage, and checks that say a page is newer
// than this Fieldia) — 5.2 more, to 530.4.
// What Firefox and WebKit showed (a centred line written as a style in Firefox, an old align attribute kept as one, a
// group's parts in a flex column, as Safari lays a narrowed group's title out again only there) — 0.2 more, to 530.6.
// Then a group laid out as blocks instead, its gaps as margins (layout-styles.ts): Safari floats nothing in a flex
// column, so every card's title was drawn on the card's border — 0.2 more, to 530.8.
// Files stored as they are picked (0.21, lane w1-files): the form's uploads — three at a time, each photo made smaller
// first, put in its place in the order picked, a save that waits for them and stops under the field for one that
// failed, a file's bytes stored by the save and never kept in a draft — uploadTo for a plain endpoint or a signed
// address, the memory source as a slow store, a field's files on their way (a bar, × and Retry, said to a screen
// reader) and their stylesheet, photos made smaller with their EXIF turn, a signature's picture through the store, and
// the viewer saying why Save waits — 20.8 more, to 551.6 (with the safety kit's above).
// A photo picked in a table's cell stored as its line's, the cell showing its line's on their way (form.uploading),
// 0.2 more, to 551.8.
// Save safety on that contract (lane w1-save): the form keeping a record's version and what the person may do —
// fields locked or hidden, a save refused before the source is asked, Archive, Duplicate and Delete and the buttons
// that would do them hidden — a conflict's who, when and fields, Reload with the person's changes set aside to put
// back, Keep mine; the viewer's banner, the list of changes set aside, the line over a record only to read, a locked
// field’s reason, the gear menu’s note, their words and their stylesheet (2.3 of it) — 10.9 more, to 562.7 (over the
// safety kit's and the files').
// Keep mine reading the record first when a conflict did not carry it (so a source that saves whole records never
// wipes the other person's work), Put back kept at the end of its change's row on a phone, and what a field set aside
// holds now kept in its own direction (a phone number among Arabic words) — 0.4 more, to 563.1.
// 0.21's calendar (lane w1-calendar): a list's `calendar` (its start, end, words, colour, person, views, first day,
// hours and slot) with its page checks, and a list's switcher open to other views — each by its name and its own
// words, made the first time it is shown, asking the app for a new record (or the model's page in a dialog) — the
// calendar itself being @fieldia/calendar's, never in this script — 2.8 more, to 565.9 (over
// the three lanes above).
// The four lanes joined (the safety kit, files, save safety, the calendar), 0.05 more than the sum of their own: Save
// shown for a file on its way only where the person may edit, a reset letting go of both the uploads and the conflict,
// and the minifier's names a little longer with all four in one scope — 0.1 more, to 566.0.
// Wave 1's save safety mended (lane w1-fix-save): one save at a time, the next carrying the version the first got back;
// what changed while a save was on its way kept as a change, a new line keeping the id it was given; Keep mine saving
// nothing over a version it could not read, and the banner saying so; a saved form placed in a record storing its
// files for the record, its uploads shown, waited for and stopping the save; Retry taking the save's problem with it;
// drafts keeping files as before where there is no store; changes set aside asked about by every way out; a picture
// the browser cannot draw shown as its file's icon — 3.4 more (565.95 measured before, 569.33 after), to 569.4.
// A field that fails on the person's change keeps nothing it never showed (lane w1-fix-safety): the form each widget
// is handed notes what it writes in its field, the field goes back to the value it last showed and its box says so
// with that value, the focus it held goes to the box (named by its words, in the order the field had), a framework's
// component says what it drew, and a slot's or a part's box takes the focus too — 2.4 more, to 568.4.
// The two mended lanes joined (w1-fix-save, w1-fix-safety): 565.95 measured before either, 571.69 with both — their
// sum, nothing more for the join — to 571.7.
// Every way out asking before it leaves work behind (lane w1-fix-save2): Save & Close, a page's own button that saved
// or a `close` after a save, the pager, Duplicate, an action's answer naming another record, a page opened in a
// record's place, Done and answers sent each asking "Discard your changes?" when a change made while it saved, files
// on their way or changes set aside would go — one question, shared by the dialog and a page in place; the list's ×
// asking too; the focus after each button of the banner and the list on a field; the status saying "Saved, but not
// all your changes" (and "Sent, …" once answers went); Save & Close taking back the focus it let go of while it
// saved; and a field's box naming its value as the field shows it — 2.8 more (571.69 measured before, 574.49 after),
// to 574.5.
// A run that saved asks before it leaves what changed meanwhile: an action's answer naming another record after a
// `save` step, and a page in a record's place whose own button saves, then closes it, asked once — 0.2 more (574.49
// measured before, 574.68 after), to 574.7.
// One check in the form before its values go (lane w1-choke): `form.leave()` and `workAtRisk`, each change told by its
// origin and those of the person's a save went through without kept as `unsent`, the host's close taken once with the
// check before it, a reset step, a reload and an address in this tab through it too; the dialog's, the panel's and a
// page in place's own questions gone for it, each reporting a save that went through as saved however it closes; the
// pager looking up its next id before it saves; the breadcrumbs asking; the safety kit's focus passed on to a box that
// takes it — 0.7 more (574.68 measured before, 575.39 after), to 575.4.
// Ways out serialised, answers kept to their record (lane w1-serial): every way out waiting for the save on its way and
// the files on theirs (`leaving`, said where Saving… would be, and at a dialog's foot), a way out taken meanwhile
// joining it; each record shown a generation of its own, a save's or a call's answer laid only on the record it was
// started for and a run stopping on one replaced; the person's work at risk told against the record as the last save
// left it, a file the store holds that no save sent among it; `leaveNow`; Discard waiting too; the app's breadcrumbs
// inside a page in place through the record under it, its question shown over that page; Done saving a file on its
// way first — 2.9 more (575.39 measured before, 578.23 after), to 578.3.
// The input rules (0.21), what every box needs at mount: one set of readers in @fieldia/core — a number in any script
// with the page's marks or ٫ ، ٬, its places and digits, a pasted amount with its own currency or an accounting minus,
// hours, a date and a time in the page's order, words folded for finding (10.1); the box's guard on keystrokes, pastes,
// drops and an IME's edits, with its hint (5.2); text left that does not read, kept by the form and said as the box is
// left, and Save refusing it (1.4); the number boxes, shares, tax amounts and a bar's box on them (3.5); and the rules'
// English words (3.2) — 24.3 more, to 546.1. The hint floating under a table's cell or a grid's editor (above it where the
// table cuts it off), numbers read left to right in a right-to-left box, and the guard's names on window.Fieldia, 1.5
// more, to 547.6.
// The input rules for text (0.21): a text box's guard — a key at the most refused, a paste over it kept and counted
// by code point, a phone number's characters, an email's spaces, a line break pasted into one line — and what a box
// keeps once left (2.5); web addresses read as a browser does, localhost, IP addresses and ports, javascript: and its
// kind refused, a postcode by its country, a pattern about the whole answer with its digits folded, checkPage naming
// one that does not read (2.4); a property checked by its kind on its own row (1.6); tags ended at ، and line breaks,
// told when there already or past the most (1.2); JSON kept as typed with its reason in words (1.1); a colour's code
// box, its swatch empty when it has none, and a way to clear it (2.5) — 11.6 more, to 559.2.
// The dates', times' and choices' input rules — Fieldia's own date, date-and-time and time box in the page's order with
// its calendar on every date (date-box.ts, 6.8), a range's end checked as a field of its own with its note and limits on
// its calendar (0.8), a time's steps and stars' range checked, a file's kind by its name (1.4), and words typed into
// links, choices, tags, own answers and ranks taken or said, Arabic letters folded (2.8) — 11.5 more beside the text's
// (sharing their readers), to 570.7 (measured 570.62).
// The input rules in tables and lists: a table's totals that add only numbers and wait, in words, for the line that
// does not read, a cell's message linked to its box and said as it is left, words where a number goes shown as they
// are; a custom filter's value read and refused as every box's is, a day in the page's order, and words beside it when
// Apply waits; a list's search reading the page's numbers and a phone by its digits, the memory source finding them;
// and a formula's Arabic digits — 2.6 more, to 573.3 (measured 573.25). (A grid's block paste is the grid's own: never in this script.)
// Numbers never made of what was typed by dropping a key (0.20.1): the keys typed after a refused one held with it,
// Backspace taking them back, and leaving with them saying why (1.0); a decimal mark judged only once it can no longer
// group ("1.234,56" typed on an English page), trailing zeros no places, a 0 never leading a group, and a number read
// whole as its box is left or pasted (0.9); the boxes on it — a field's, an hours' or per cent's, shares, tax amounts in
// their currency's places, the custom filter's (0.7); the hint kept as a box is left with keys held, so nothing under
// the pointer moves (0.1) — 2.7 more, to 576.0 (measured 575.96). A formula list's numbers read as the formula's own
// (Arabic and Persian digits, ٫; never hex or an exponent) — 0.1 more, to 576.1 (measured 576.05).
// The input rules' last gaps (0.20.1): a date read as Fieldia writes it at rest, its month in words in any of its four
// languages from Intl's own names (none carried in the code), and an instant with its zone, and a year of two digits
// said with both centuries it could be (core 1.4; the date box's guard letting a month's name be typed, 0.4); the
// calendar closed as its box is left and saying why its text was not read, for a date and a range (0.6); a colour's
// code never changing the colour held (0.3); an email's link and zero-width characters cleaned, and its ":" refused
// (0.4); their English words (0.3) — 3.4 more; with the numbers' gaps above, measured together, to 579.8 (measured
// 579.75).
// Fieldia's own date box loaded on first use (0.20.1): the box with its guard and what it keeps once left, a date's
// calendar and a range of dates on its own calendar out of this script, into fieldia.date.js (date-box, calendar,
// date-range: 19.8 of code). This script keeps what every box that reads a date shares (date-text.ts) — the reader in
// the page's order, a date's words at rest and while typed, its placeholder and example, the ISO week (3.0) — and a
// plain box on that reader for a date drawn before its part came, or if it cannot come (1.0); the parts a table's lines
// and a properties field draw from, found before a page is drawn, and a saved form placed in a page waiting for its own
// as the page does (0.4); the date part's names in the parts' table and its wiring (0.3) — 15.0 less, to 564.8
// (measured 564.71).
// The keys that save, with the input rules (0.20.1): Enter in a one-line box never judged as typing, and a paste that
// says what it left out (0.2); every save, check and step forward reading what is still typed first — the form's
// readers, the viewer's change to the box typed in, a number's, hours', per cent's, share's and colour's reading
// split from their leaving (0.6); a phone number's, an email's, a line's and a colour code's keys held after a refused
// one (0.3); a time's or hours' one-digit minute named with both times it could be, never quietly :03, and the time a
// day leaves out named (0.8); a count of one said in the singular by the language's own rules (0.3); their English
// words (0.4) — 2.6 more, to 567.4 (measured 567.32).
// Every way a value is committed reading every kind of box (0.20.1): a save, a check and a step waiting for a name
// still looked up, a link's, tags', a choice's and a path's own reader of what is typed, a line's cells read no more
// once it goes, autosave waiting while a box is typed in, the hold kept through a paste, a drop, an IME and an
// autocorrection, a plain date box saying the time it leaves out, a count of one's own words for a language added,
// a designer's setting read before it publishes — 5.6 more, to 573.0 (measured 572.94).
// A late answer's words said though its record is gone, and a closed form's run stopping quietly — 0.1 more
// (578.23 measured before, 578.38 after), to 578.4.
// The input rules (0.21) and Wave 1 joined for 0.22: each line's growth above was measured on 0.20 alone; together,
// with the box-left call renamed boxLeft and unread text counted as unsaved work, 629.73 measured — to 629.8.
// The list screen loaded on first use (0.23 size pass): its table, rows under their parent and their groups, the
// records chosen and their buttons, the pager and the switcher to another view, the search bar with its menu, a filter
// of a person's own and the favourites, and its stylesheet out of this script, into fieldia.list.js (list, list-groups,
// search-bar, custom-filter, favourites, list-styles: 41.4 of code). This script keeps a list drawn before its part
// came, if it cannot come ("Loading…", then Retry: 0.8), the list's look put in a page by the designer's canvas
// through the part, and the names the list part takes from this script in the parts' table, and its wiring (0.4) —
// 629.78 measured before, 589.44 after, to 589.5.
// The looks loaded on first use (0.23 size pass): the eight themes — their tokens, light and dark, and their own
// shapes (themes.ts) — out of this script, into fieldia.themes.js, and the quiet look's sheet (styles-quiet.ts) into
// fieldia.quiet.js. This script keeps the page's look's tokens (look-styles.ts, cut from the layout's sheet, which the
// themes' sheet carries again after its own), a state's words and a field's lock (styles-lock.ts), a theme worn as its
// part comes with none meanwhile and the quiet look's sheet asked for as a quiet field is drawn (look-parts.ts), and the
// two parts a page's look names (viewer-parts.ts) — 629.78 measured before, 612.05 after: 17.7 less, to 612.1.
// A table of lines and a many2many's table of records loaded on first use (0.23): the table with its cells, grips, moves,
// sections, totals and ticks (lines-table, 12.6 of code), the records' table (links-table, 2.8) and their own rules — the
// grips and drags, columns sized to their kind, a line's tone and bold, sections and notes, cards on a phone (6.2 of
// CSS, minified) — out of this script, into fieldia.lines.js. This script keeps what a line is edited through, which a
// grid and cards draw with too (lines.ts: the form a cell sees, its unread text and its uploads as its line's, a
// column's total, a line's dialog: 2.4), the rules a grid's lines and a distribution's table share with a table's (the
// table, its heads and cells, ×, a line's buttons, the totals, the add buttons, the bar for lines chosen), the lines as
// plain words for a table drawn before its part came (lines-plain, 1.0), and the registry reading the widgets that
// import it back as a field is drawn — 20.1 less (629.78 measured before, 609.68 after), to 609.7.
// Flectra's business widgets loaded on first use (0.23): a record's statusbar, priority stars, the boxes hours and a per
// cent are typed in, an analytic distribution's lines, tax totals and payments, with their stylesheet, out of this
// script into fieldia.business.js (statusbar, priority, duration-box, distribution-lines, tax-totals, payments and their
// sheet: 24.1 of code). This script keeps how hours, a per cent and a distribution are written and read (a cell's, a
// total's, a pasted cell's), a state's dot (a work item's State, its list drawn as the pickers draw theirs), and each
// kind drawn plainly until its part comes (2.5) — 19.9 less, to 609.9 (629.78 measured before, 609.84 after).
// File and picture fields loaded on first use (0.23): a file field's list, thumbnails and cards with their switch and
// dialog, files on their way with their bar, × and Retry, photos made smaller, a signature's pad, a PDF under its file
// box and their stylesheet out of this script, into fieldia.files.js (files, files-going, shrink, signature, pdf,
// styles-files: 30.9 of code). This script keeps what the form does with files whatever draws them (core's uploads and
// a save that waits for them), a file shown as its dialog shows it, for a sheet's attachment preview (file-shown.ts),
// the names of the files a value holds for a field drawn before its part came, the fields a sheet's title names (its
// avatar, a picture) among the parts a page draws from, a save's status put back in its corner or across the top once
// a page that waited for its parts is drawn, and the part's names in the parts' table — 629.78 measured before, 602.14
// after: 27.6 less, to 602.2.
// The survey kinds loaded on first use (0.23): a ranking, a matrix, a slider, pictures to choose from, a colour,
// properties, an address and a progress bar, with the rules only they use, out of this script into fieldia.survey.js
// (ranking, matrix, slider, choice-images, colour, properties, address, progress and their two sheets: 35.0 of code).
// This script keeps the countries an address lists, which the designer and the map list too (countries.ts), and each
// kind's value shown plainly before its part came — a ranking's order, a matrix's answers by row, a colour's code, an
// address's lines, properties a line each, a slider in the number box (survey-plain.ts) — and the part's name in the
// parts' table: 30.2 less (629.78 measured before, 599.59 after), to 599.7.
// The six joined (0.23 size pass: the list screen, the looks, a table of lines, the business widgets, files, the survey
// kinds), each measured above against 0.22.0 alone; together, 629.78 measured before, 474.25 after — 155.5 less, to 474.3.
// Every late answer laid only on the record it was asked for (after 0.23.0): the form's one test (`recordShown`) and
// the guards that ask it — an onchange, a record step, a button's question, a change's steps run again, a check or a
// save waiting for a name, a step's own move, Keep mine — the person's claim told by a table's line, Discard putting
// their changes back as saved, a conflict waiting counted at risk (core, 2.0 of code); the parts' test (`whileShown`)
// and a link's, a line dialog's and a name's answers (widgets, 0.4); the pager told of a record deleted elsewhere, a
// locked record's pager, a dialog of values asking on Escape and `warnOnLeave` (viewer, 0.6): 474.29 measured before,
// 477.23 after — 2.9 more, to 477.3.
// Wave 2's autofill and bot check (0.24): what the browser fills each box in with and a phone's keyboard, the page's
// over the kind's own (kind-parts.ts, the boxes), a value the browser fills in read as typed (the guard's write in a box
// the person is not in, a number's, a date's and a long list's box read as left, the viewer's read of a box filled from
// a pick in another), and a public page's bot check (its hidden box, the time the answers took, the captcha's token on
// the send, their checks and words). The purposes the standard lists stay out, with the format's check
// (validatePage): the quick check keeps only that a box names what it holds and an address whose it is
// (autofill-group.ts). The bot check is in this script, not a part: 1.2 of it, 0.5 gzipped, on the very pages — a
// public sign-up — that are drawn the moment they are opened. 474.25 measured before, 477.88 after, to 477.9.
// The input rules held for names, tables and ways out (inputs-fix-names): a run of steps reading what is typed before
// it hands values on, and stopping on text that does not read (run.ts `typedFirst`, form.ts); text unread counted as
// work at risk and kept through Reload; a search asked for an exact name (core); a link's, its tags', a reference's
// and a choice's words of none kept unread on leaving, several of one name said, an exact name taken whatever row is
// reached, the IME's Enter left to it, tags waiting for room read by a save, a line's dialog and × reading what is
// typed, a box's words read when it is taken away without a blur, a box's words waiting for a press to end (widgets,
// press.ts): 480.83 measured before, 484.98 after — 4.2 more, to 485.0.
// The input rules checked again on 0.23 (inputs-fix-boxes): a part's box taking what was typed in its stand-in
// (partWidget's hand-over, 1.1), the plain hours and per cent reading as their part's box does (0.7), a date and time
// read in a time zone that says a time the clocks skip or pass twice, an instant's impossible day, a full-width keyboard's
// marks, the whole part's digits and a currency as people write it (core's readers, 2.8), JSON numbers kept as written
// (0.6), money read again when its currency changes, a date's and the email's words (widgets, 2.5) and their English
// words (0.6), a table cell placed for its hint as its box is entered: 480.83 measured before, 489.58 after — 8.8
// more, to 489.6.
// Lists that add up and filter by time (Wave 2, lane F): the words of a period, a date's span, a total and its kinds
// (labels.ts, 25 of them, in English), what both a list and the memory data source count days by — the day an instant
// falls on and a day's first moment in a time zone, the span a date falls in (core's periods.ts, 1.9) — the memory
// source's groups by a span and amounts totalled in one currency, a period kept in a facet and counted again, and the
// viewer's clock handed to a list: 474.29 measured before, 477.70 after — 3.4 more, to 477.8. Where a span ends, a
// period's days and their conditions, the totals row, a heading's sums and the menu's spans are the list part's.
// Lists people take away and change in bulk (0.24): the words of "Select all 1,284 that match", Export and Edit in the
// viewer's labels (29 of them), the page check of a list's bulkEdit and the fields it may offer (bulk-edit.ts), the
// memory source's writeMany, the viewer handing a list its toasts, its questions and its dialog of values, and the
// names the list part takes from this script — the list, the workbook and the zip themselves in the list part (listed
// with the part budgets below): 474.29 measured before, 477.31 after — 3.0 more, to 477.4.
// A phone read the world over (0.24): its words (a number's country, Call and WhatsApp, five reasons a number does not
// read), whether a page or a field reads its phones so (phone-settings.ts), the phone part asked for by such a field, a
// list's phone column and a line's dialog, a card's cells drawn with their column's widget, and a text box's hint taken
// away with it — the box, its country table and its sheet in fieldia.phone.js — 474.29 measured before, 475.79 after:
// 1.5 more, to 475.9.
// A page's time zone (0.24): its clock read with Intl (zones.ts in core: a zone's time, its day, the instants a time on
// it is, the change that skips one, 2.0), its zone written into its date and time fields (0.4), today on its clock,
// its name checked, and every reader and writer of a date and time on it — a box, a cell, a pasted cell, a filter, a
// list's words: a time the clocks repeat or skip said, a zone's name read back (date-text, 2.5), their English words —
// what every page that names a zone draws with, 6.2 of it. Booking slots (0.24): the data source's slots, the form's
// findSlots, the widget's checks, its part's name and its English words, 2.1 (the memory source's schedules are
// scheduleSlots, outside this script). A cell's date and time written as the box writes it, the instant it is rather than
// the clock it was written with, 0.3 less. 474.29 measured before, 482.29 after — 8.0 more, to 482.3.
// The business owner's walk of 0.23 mended, in what every page carries: a press kept to the button that was under the
// pointer (steady-press.ts), a box's message shown once the press that left it has ended (press.ts, the one mechanism
// the boxes' hints use too), a record's button that saves first and puts back what its steps wrote when its save is
// refused (core's runner), a record's title that wraps on a phone, lines named by their number among the items and a
// worked-out number that waits for its line, one message for a paste past a field's most, the currency sign where the
// language puts it — 474.25 measured before, 479.71 after: 5.5 more, to 479.8.
// 0.24's lanes joined, measured in the merged build: 474.29 at 0.23.0, 512.82 now — 38.5 more (the lanes' growths
// above add to 40.8: merged, two lanes' ways of one thing are one — one set of time zone functions, one press rule),
// to 512.9.
// A related list inside a record (Wave 3, w3-related): the format's part and its page check — its columns, order,
// search and cells held to its own records' fields (the list's own checks, shared now), its link to a many2one of
// theirs to this model, on a record's page — the form's `relatedFilter`, the viewer's box handing the list part its
// dialogs and its host's `open`, the list part asked for by a page with one, a list in a dialog closed with Close
// alone (nothing to save) and a dialog's own button hidden when it is (Save & Close showed for a record only to read
// too), and its six English words. Its heading, count, New, View all and asks are the list part's: 512.84 measured
// before, 515.32 after — 2.5 more, to 515.4.
const BUDGET_KB = 515.4;
if (statSync(OUT).size > BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(statSync(OUT).size / 1024)} KB, over its ${BUDGET_KB} KB budget`);
// What a visitor downloads: the bundle gzipped, as servers send it. 76 at 0.9; the choices' details add
// 2.3 and several files with their viewer 3.9, to 82.3; the inputs' details (web, phone, email and time
// checked, a date's limits, a count of characters, units and symbols, rating looks and NPS) 2.8, to 85.1;
// signatures' pens and undo, addresses' parts and countries, lines' and cards' moves and pictures' captions
// 3.4, to 88.5. English alone, the other languages as add-ons (fieldia.ar.js, …) save 8, to 80.6.
// Each kind of part's own look adds 1.2, to 81.8; a saved form placed in another, its answers nested
// and checked inside it, 2.3, to 84.1; a page's steps checked, 0.6, to 84.7; the steps run, the moments
// and the events an app hears, 3, to 87.7; a page in a side panel, 0.5, to 88.2; the viewer as the host
// of the steps (pages opened, toasts, busy buttons, tabs shown), 1.7, to 89.5; a panel from any side, 0.3, to 89.8;
// files as cards and the switch between them and a list, 1, to 90.8; the real pages' defects mended, 1.9, to 92.7;
// what real Flectra pages need of steps, conditions, defaults and tables' own rules, and help behind a (?), 5.1, to 97.8;
// the rest of what real Flectra tables need (tones on a field, chosen lines, line pages, cards on a phone,
// hideOn, a line's money in its record's currency, setWhen on a change, distinct, contains and =?), 4.3, to 102.1.
// how a dense sheet reads (values as words, ribbons, alerts, stat buttons, statusbar, keys, links, lines), 6 more, to 108.1.
// the business widgets (stars, a state's dot, HH:MM, per cents, a timer, a range of dates, colours, copy, a PDF and
// a page inline, a distribution, tax totals, payments, linked properties, a column's own widget), 11.9 more, to 120.
// what sits around a record (breadcrumbs, gear menu, pager, the record's own steps and posts, the attachment beside it), 5.9 more, to 125.9.
// Phase 26's last ten (a line's own form, placeholders by condition, focus on open, order, a line kept, context,
// a stat button's help, a distribution's words, a column's roles, a calendar's pick), 2.2 more, to 128.2.
// what using the real pages showed (a dragged line following the pointer, floating lists, columns by their values), 1.5 more, to 129.7.
// the form fields' defects mended (help kept on screen, cut values shown whole, one-line rows, numbers edited plain), 0.7 more, to 130.4.
// the live real pages swept again (wide link editors, words with their values, buttons in sight, numbers checked), 0.7 more, to 131.1.
// eight themes, light and dark, with their own shapes, 3.3 more, to 134.3.
// a host's colours: tokens in a cascade layer, the tokens option, labels at their value's top, 0.4 more, to 134.7.
// a list's records on a map (the view switch, the map beside the table, its page checks), 1.4 more, to 137.5;
// a map on a form, its layers checked, 0.8 more, to 138.3.
// a map's areas, reachable areas, fences and tools checked, a list nearest a place first, 0.8 more, to 139.1.
// the quiet look, a third skin: its stylesheet, the empty field’s words, Escape, the lock and why, 2.4 more, to 141.5.
// an amount's money look, and a map card's lines, units and link checked and translated, 0.7 more, to 139.8.
// together in 0.19 (an address's checks, the quiet look, the money look), to 142.7.
// a record's head and its popup (the strip, badge, title line, row, split and toggled buttons, band, head tabs,
// inset dialog with maximise and grip, stored values, their checks, the work item's icons), 10 more, to 152.7.
// the work item's pickers (a path picker and its tree, own lists with a tick, a state's colours, tags from a button,
// their stylesheet and the replica's shared icons), 7 more, to 149.7.
// a work item's body (groups' widths and heading tools, help boxes, the formatted text's editor with its Markdown, menus
// and links in place, a links box, and their stylesheet), 19.4 more, to 162.1.
// a work item's icons (icons-work.ts), 1.0 more, to 143.7.
// a list drawn as a backlog (cells, the filter bar, rows under their parent, Fluent's list look) and the work item's icons, 6.6 more, to 149.3.
// Joined for 0.20 (the five work item lanes in one bundle, their shared icons once), to 182.5.
// set side by side with the tracker's screens (a list's pixel columns, unsorted headers, a filter's own name, the open
// row lit, Fluent's list as measured, slim scroll bars, the state's and path's open looks, Markdown's tool drawings,
// the redrawn icons), 1.8 more, to 184.3.
// the second side-by-side (header rules, an unlit open, a help icon's tile, the picker's halo and bar, idle buttons
// with their reasons, the grip's triangle, the tabs' pills, the filter bar's room), 0.7 more, to 185.0.
// the work item's parts loaded on first use, each a script of its own (a record's head and its window, the formatted
// text's editors with their Markdown and menus, a path picker, Fieldia's own list for a choice, a filter bar): 27.1 less,
// to 157.9 — 15.2 over 0.19's 142.7, for what a page draws at mount (listed with the raw budget above).
// the third side-by-side (the head's icons in one-pixel lines, a smaller outline, the State list's pitch, the backlog's
// lead and the room after its grid), 0.1 more, to 158.0.
// 0.21's data source contract (a loaded record's version and permissions, a save's conflict, and the memory source
// keeping them, with every matching id, totals and a stored file's progress), 1.4 more, to 159.4.
// 0.21's safety kit (errors kept to their part, with the box that names it; the page format's versions and upgradePage,
// listed with the raw budget above), 1.9 more, to 161.3; what Firefox and WebKit showed (listed there too), 0.1, to 161.4.
// files stored as they are picked (the form's uploads and a save that waits for them, uploadTo, files on their way
// with a bar, × and Retry and their stylesheet, photos made smaller, the viewer saying why Save waits), 7.5 more, to 168.9.
// Save safety on that contract (a conflict's banner with Reload and Keep mine, the changes set aside, a record only to
// read and what the person may do kept to, with their words and stylesheet), 3.5 more, to 172.4.
// Keep mine reading the record first when a conflict did not carry it, Put back at the end of its row, and the value
// it holds now in its own direction, 0.1 more, to 172.5.
// 0.21's calendar (a list's `calendar` and its checks, the switcher open to other views and a new record asked of the
// app; the calendar itself is @fieldia/calendar's), 1.0 more, to 173.5.
// The four lanes joined (listed with the raw budget above), 0.04 more than their sum, 0.1 more, to 173.6.
// Wave 1's save safety mended (listed with the raw budget above): 173.54 measured before, 174.84 after, to 174.9.
// A field that fails on the person's change goes back to what it showed, says so, and hands its focus to its box
// (listed with the raw budget above), 0.8 more, to 174.4.
// The two mended lanes joined (listed with the raw budget above): 173.54 measured before either, 175.63 with both,
// to 175.7.
// Every way out asking before it leaves work behind (listed with the raw budget above): 175.63 measured before,
// 176.54 after, to 176.6.
// A run that saved asks before it leaves what changed meanwhile (listed with the raw budget above): 176.54 measured
// before, 176.62 after, to 176.7.
// One check in the form before its values go (listed with the raw budget above): 176.62 measured before, 176.84 after,
// to 176.9.
// Ways out serialised, answers kept to their record (listed with the raw budget above): 176.84 measured before, 177.83
// after, to 177.9.
// the input rules (one set of readers, the box's guard and hint, unread text kept and said on leaving, the number boxes on
// them, and their English words; listed with the raw budget above), 9.1 more, to 167.1; the cells' floating hint and
// right-to-left numbers, 0.4 more, to 167.5; the input rules for text (a text box's guard and what it keeps once
// left, web addresses, postcodes and patterns, properties checked by row, tags, JSON's reasons, a colour's code box;
// listed with the raw budget above), 4.1 more, to 171.6; the dates', times' and choices' input rules (Fieldia's own date
// box with its calendar on every date, a range's end as a field of its own, a time's steps, words typed into links and
// choices taken or said; listed with the raw budget above), 4.2 more, to 175.8 (measured 175.74); the input rules in
// tables and lists (totals that wait for the line that does not read, a cell's message said as it is left, the custom
// filter's number and day, the search's numbers and phones, a formula's Arabic digits; listed with the raw budget
// above), 1.1 more, to 176.9 (measured 176.87); numbers never made of what was typed by dropping a key (keys held after
// a refused one, a decimal mark judged once it can no longer group, trailing zeros, a number read whole as its box is
// left, a tax amount's places; listed with the raw budget above), 1.0 more, to 177.9 (measured 177.86); the input
// rules' last gaps (dates as written at rest, a year of two digits said, the calendar never over why, a colour's code,
// an email's link; listed with the raw budget above), 1.3 more; with the numbers', measured together, to 179.3
// (measured 179.22). Fieldia's own date box, its calendar and a range of dates loaded on first use, in fieldia.date.js
// (7.0 gzipped), the reader they share with tables, pastes and filters kept, and a plain box on it for a date drawn
// before its part came (listed with the raw budget above): 4.9 less, to 174.4 (measured 174.35) — 16.5 over 0.20.0's
// 157.9 for the input rules every page draws at mount. The keys that save with the input rules (Enter never judged,
// a save reading what is still typed first, keys held in every text box, a one-digit minute named, a count of one in
// the singular; listed with the raw budget above), 0.8 more, to 175.2 (measured 175.11). Every way a value is
// committed reading every kind of box (listed with the raw budget above), 1.7 more, to 176.9 (measured 176.83).
// The input rules (0.21) and Wave 1 joined for 0.22 (listed with the raw budget above): 197.21 measured, to 197.3 —
// 39.3 over 0.20.0's 157.9, a size pass still owed.
// The list screen loaded on first use, in fieldia.list.js (12.8 gzipped; listed with the raw budget above): 197.23
// measured before, 185.99 after, to 186.1.
// The themes and the quiet look loaded on first use, in fieldia.themes.js (3.8 gzipped) and fieldia.quiet.js (2.2),
// two parts rather than one: a themed page loads 3.8, not the 5.3 of both together, a quiet one 2.2; a page with both,
// a work item's, 0.7 more and one more file (listed with the raw budget above): 197.23 measured before, 193.42 after —
// 3.8 less, to 193.5.
// A table of lines and a many2many's table of records loaded on first use, in fieldia.lines.js (7.9 gzipped), what a
// line is edited through kept for the grid and the cards, and the lines as plain words before their part came (listed
// with the raw budget above): 197.23 measured before, 191.76 after — 5.5 less, to 191.8.
// Flectra's business widgets loaded on first use, in fieldia.business.js (9.6 gzipped), their words in a cell and a
// state's dot kept, each kind drawn plainly until it comes (listed with the raw budget above): 197.23 measured before,
// 191.42 after, to 191.5.
// 39.3 over 0.20.0's 157.9, a size pass still owed. File and picture fields, files on their way, photos made smaller and
// a signature's pad loaded on first use, in fieldia.files.js (11.3 gzipped), the attachment preview's file and a field's
// files' names drawn before its part came kept (listed with the raw budget above): 197.23 measured before, 188.45
// after — 8.8 less, to 188.5.
// The survey kinds loaded on first use, in fieldia.survey.js (12.1 gzipped), each value shown plainly before it came
// (listed with the raw budget above): 197.23 measured before, 188.88 after — 8.4 less, to 188.9.
// The six joined (listed with the raw budget above): 197.23 measured before, 153.61 after — 43.6 less, to 153.7, under
// 0.20.0's 157.9 again; what a page uses beyond it comes in its parts.
// Every late answer laid only on the record it was asked for (listed with the raw budget above): 153.62 measured
// before, 154.68 after — 1.1 more, to 154.7, under 0.20.0's 157.9 still.
// Wave 2's autofill and bot check (listed with the raw budget above): 153.62 measured before, 154.78 after — 1.2 more,
// what every box and every public page draws at mount — to 154.8.
// The input rules held for names, tables and ways out (listed with the raw budget above): 155.86 measured before,
// 157.24 after — 1.4 more, to 157.3.
// The input rules checked again on 0.23 (listed with the raw budget above): 155.86 measured before, 159.02 after —
// 3.2 more, to 159.1.
// Lists that add up and filter by time (Wave 2, lane F; listed with the raw budget above): 153.62 measured before,
// 154.91 after — 1.3 more, to 155.0.
// Lists people take away and change in bulk (listed with the raw budget above): 153.62 measured before, 154.57 after —
// 1.0 more, to 154.6.
// A phone read the world over (0.24), its words and what asks for its part (listed with the raw budget above): 153.62
// measured before, 154.16 after — 0.5 more, to 154.2.
// A page's time zone, its clock read in every box, cell, filter and list of a date and time, a time the clocks skip or
// repeat said (about 2.1), and booking slots' data source member, form call, checks and words (about 0.7), both 0.24
// (listed with the raw budget above): 153.62 measured before, 156.38 after — 2.8 more, to 156.4.
// The business owner's walk of 0.23 mended (listed with the raw budget above): 153.61 measured before, 155.40 after —
// 1.8 more, to 155.5.
// 0.24's lanes joined (listed with the raw budget above): 153.62 at 0.23.0, 167.10 now — 13.5 more, to 167.2.
// A related list inside a record (listed with the raw budget above): 167.12 measured before, 167.80 after — 0.7
// more, to 167.9.
const GZIP_BUDGET_KB = 167.9;
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
// A saved form's four messages take Arabic's to 18.1; the switch over the files, four words, Arabic's
// to 18.7 and German's and French's to 8.1. The (?) that shows a field's help, named in each, a little more: to 18.8 and 8.2.
// A table's lines chosen (a line's tick, every line's, how many), and a value on two lines of a column, to 19.1 and 8.3.
// A statusbar's More and the time spent in a step, two words in each, add a little more to each.
// The business widgets' words — twelve colours' names, copy, a distribution's, tax totals', payments', a property
// added in place — add about 2 to Arabic's and 0.8 to German's and French's.
// What sits around a record — the gear menu's and its built-ins' words, the trail, the pager, the attachment,
// and what Archive and Delete ask — eighteen words in each, a little more again.
// A list's switch between its table and its map, four words in each: Arabic's to 23.
// The quiet look's three — what an empty field and an empty question say, and its lock's name — Arabic's to 23.1,
// German's to 9.9 and 4.2, French's to 10.0.
// What an amount is for — /day, /night, /week, /month, /year — five words in each: Arabic's to 23.1, German's
// to 9.9 (4.2 gzipped) and French's to 10.0.
// Both together in 0.19: Arabic's to 23.3 and 4.9, German's 10.0 and 4.2, French's 10.1 and 4.1.
// A record's head and its popup — Maximise, Restore, Resize, Copy title, Title copied, More actions, a split
// button's options, Updated by, Nothing has changed, a tab's count — ten words in each: Arabic's to 23.9 and 5.0,
// German's to 10.3 and 4.3, French's to 10.3 and 4.2.
// The work item's pickers' four — Suggestions, a branch's Expand and Collapse, Add {label} — Arabic's to 23.5,
// German's to 10.1 and 4.3, French's to 10.2 and 4.2.
// A work item's text — its tools' names, the Markdown editor's hint and switch, what switching would lose, a group's
// Maximise, Collapse and Expand, Add link's Existing item and New item, 32 words in each — Arabic's to 25.8 and 5.4,
// German's to 11.1 and 4.7, French's to 11.2 and 4.6.
// A list's filter bar and its nested rows — Filter by keyword, Clear filters, Filter by {label}, Filter settings,
// Expand all, Collapse all — six words in each: Arabic's to 23.7, German's to 10.2 and 4.3, French's to 10.3 and 4.2.
// Joined for 0.20, the five work item lanes' words together: Arabic's 27.2 and 5.6, German's 11.7 and 4.9, French's 11.8 and 4.8.
// 0.21's safety kit — the box where a part could not be shown: "This field could not be shown", "This part could not
// be shown", with its name and without — three in each: Arabic's to 27.5 and 5.7, German's to 11.9, French's to 12.0.
// Files stored as they are picked (0.21) — where a file on its way is (waiting, made smaller, its share sent, not
// uploaded, not taken), its bar's, Cancel's and Retry's names, files uploaded, a save or a send waiting for them, and
// why a save stopped for one — 20 words in each: 2.3 and 0.3 more in Arabic, 1.0 and 0.2 in German, 1.1 and 0.2 in
// French, over the safety kit's: Arabic's to 29.8 and 6.0, German's to 12.9 and 5.1, French's to 13.1 and 5.0.
// Save safety (lane w1-save) — who changed the record and when, what each changed, what Reload and Keep mine do and
// their buttons, the changes set aside and Put back, a record only to read, a field locked for this person, what the
// gear leaves out, and the four refusals core says when the source gives no reason — 21 words in each: 3.0 and 0.4
// more in Arabic, 1.2 and 0.3 in German, 1.2 and 0.4 in French, over the two above: Arabic's to 32.8 and 6.4, German's
// to 14.1 and 5.4, French's to 14.3 and 5.4.
// The three lanes' words joined: each lane rounded its own figures, and gzip does not add up a word at a time —
// measured 32.82 and 6.32 in Arabic, 14.05 and 5.47 in German, 14.31 and 5.40 in French: Arabic's to 32.9, German's
// gzipped to 5.5, French's to 14.4 and 5.5.
// Wave 1's save safety mended (lane w1-fix-save): one sentence, Keep mine saying it could not read their version and
// saved nothing — measured 32.82 and 6.32 before, 33.32 and 6.39 after in Arabic (its letters escaped), 14.05 and 5.47,
// 14.21 and 5.53 in German, 14.31 and 5.40, 14.48 and 5.45 in French: Arabic's to 33.4, German's to 14.3 and 5.6,
// French's to 14.5.
// A field's change not kept, and what it went back to or that it is empty again (lane w1-fix-safety): two sentences
// in each, measured 33.22 and 6.37 in Arabic, 14.22 and 5.52 in German, 14.52 and 5.46 in French: Arabic's to 33.3,
// German's to 14.3 and 5.6, French's to 14.6.
// The two mended lanes' words joined (w1-fix-save, w1-fix-safety): three sentences in each, measured 33.72 and 6.44
// in Arabic, 14.38 and 5.57 in German, 14.68 and 5.51 in French: Arabic's to 33.8 and 6.5, German's to 14.4 and 5.6,
// French's to 14.7 and 5.6.
// Every way out asking before it leaves work behind (lane w1-fix-save2): "Discard your changes?" said by core for a
// step that leaves the record, and the status's "Saved" and "Sent" when not all of it was — three sentences in each,
// measured 34.22 and 6.50 in Arabic, 14.55 and 5.62 in German, 14.86 and 5.55 in French: Arabic's to 34.3, German's
// to 14.6 and 5.7, French's to 14.9.
// Ways out serialised (lane w1-serial): what a way out waits for — the save, one file, {n} files — Done's "Not all your
// changes are saved", and core's word for a run whose record was replaced — five sentences in each, measured 35.15 and
// 6.60 in Arabic, 14.94 and 5.71 in German, 15.28 and 5.65 in French: Arabic's to 35.2 and 6.6, German's to 15.0 and
// 5.8, French's to 15.3 and 5.7.
// The input rules' words (0.21) — every hint a box gives as it refuses a keystroke or a paste, text that does not read,
// the decimals' plural forms, a postcode's, a web address's, a range's and a time step's checks, a date box's shapes,
// a table's totals and pastes, a list's filters, 61 in each — Arabic's to 35.3 and 7.0 (Arabic letters are six ASCII
// bytes each), German's to 15.1 and 6.0, French's to 15.5 and 6.0.
// Their last gaps (0.20.1) — a year of two digits and both centuries it could be, several choices of one name, a ":"
// before an email's @, three in each — Arabic's to 35.9 and 7.1, German's to 15.4 and 6.1, French's to 15.7 and 6.1.
// The keys that save (0.20.1) — a time's one-digit minute and both times it could be, the time a day leaves out, and a
// pasted count, a count of lines and the characters over said for one — five in each: Arabic's to 36.6, German's to
// 15.7 and 6.2, French's to 16.1 and 6.2.
// Every box by every commit (0.20.1) — "still looking for" a name, a cell a paste left named with why, one character
// over said as one, three in each — Arabic's to 37.0 and 7.2, German's to 15.9, French's to 16.3 (as measured 36.96
// and 7.15, 15.86, 16.27).
// The input rules' words and Wave 1's joined for 0.22, as measured: Arabic's 45.0 and 8.2, German's 19.2 and 7.1,
// French's 19.8 and 7.1 — each to 0.1 over.
// A public page's hidden box (0.24, Wave 2's bot check): "Leave this box empty", one in each, read by no person but one
// whose page has lost its look — measured 45.11 and 8.25 in Arabic, 19.22 in German, 19.84 in French: Arabic's to 45.2.
// The input rules checked again on 0.23: six sentences in each — a domain's mark, a date in another order, a time the
// clocks skip and one they pass twice, decimal hours, a JSON number not kept as written — and the whole part's digits:
// measured 46.93 and 8.51 in Arabic, 19.99 and 7.31 in German, 20.62 and 7.31 in French (before: 45.11 and 8.25,
// 19.22 and 7.09, 19.84 and 7.10), each to 0.1 over.
// Lists that add up and filter by time (Wave 2, lane F): a period, a date's span, a total and its kinds, 25 words in
// each — Arabic's 44.99 and 8.23 measured before, 46.47 and 8.50 after, to 46.5 and 8.6; German's 19.18 and 7.08 to
// 19.83 and 7.33, to 19.9 and 7.4; French's 19.81 and 7.09 to 20.49 and 7.34, to 20.5 and 7.4.
// Lists people take away and change in bulk (0.24): "Select all 1,284 that match", Export's menu, its progress and how
// it ended, and Edit's dialog, question, progress and report, 29 in each, as measured: Arabic's 47.74 and 8.63, German's
// 20.36 and 7.39, French's 21.08 and 7.43 — Arabic's to 47.8 and 8.7, German's to 20.4 and 7.4, French's to 21.1 and 7.5.
// A phone read the world over (0.24) — a number's country, Call and WhatsApp, and five reasons a number does not read,
// eleven in each — as measured 46.14 and 8.44 in Arabic, 19.75 and 7.25 in German, 20.42 and 7.27 in French: Arabic's
// to 46.2 and 8.5, German's to 19.8 and 7.3, French's to 20.5 and 7.3.
// A date and time on its zone's clock and booking slots (0.24) — a time the clocks skip or repeat, a zone's name another
// day's, and the slots' 19 (finding, failed, Try again, a day's state, its times, a time checked or taken, the zone) —
// 22 in each: Arabic's to 47.6 and 8.7, German's to 20.2 and 7.5, French's to 20.9 and 7.5 (as measured 47.51 and
// 8.62, 20.16 and 7.41, 20.86 and 7.43).
// 0.24's lanes joined, measured in the merged build: Arabic's 54.23 and 9.70 (44.99 and 8.23 at 0.23.0), German's
// 23.15 and 8.30 (19.18 and 7.08), French's 23.97 and 8.34 (19.81 and 7.09) — each to the next 0.1 over, German's
// gzipped to 8.4, its 8.30 a fifth of a byte under 8.3.
// A related list inside a record (Wave 3): View all and New, each with its title and without, what it says before a
// record's first save and with none yet, six in each — Arabic's 54.23 and 9.70 measured before, 54.66 and 9.78 after,
// to 54.7; German's 23.15 and 8.30 to 23.36 and 8.37, to 23.4; French's 23.97 and 8.34 to 24.21 and 8.41, to 24.3
// and 8.5.
const ADD_ON_BUDGET_KB = { ar: [54.7, 9.8], de: [23.4, 8.4], fr: [24.3, 8.5] };
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

/**
 * Each part: its own code alone (never a second copy of Fieldia), what it shares taken from the main script, and with
 * it — after it, before it (a part's tag written into the page may run first) or twice — Fieldia then draws from it. A
 * part of another version is refused with a warning, and what would have been drawn from it is drawn plainly.
 */
// Each part's budget, raw and gzipped, in KB, as measured when they were cut out of the main script: the head with its
// window (record-head, rich-button, section-tools, dialog-window and their sheets: 33.8, 9.9); the text (html-field,
// formatted-text, markdown, text-tools, text-menu, links and their sheet: 54.1, 18.0); the path picker and its sheet
// (13.0, 5.1); Fieldia's own list for a choice and its sheet (5.4, 2.4); the filter bar and its sheet (11.1, 4.2). Each
// carries esbuild's small helpers of its own (0.6). The third side-by-side: the head's band rows on whole pixels, its
// comments' link led by its bubble and its paperclip's box (head 34.0); the rich toolbar's lists, colour, emoji lit
// from above, code, clear formatting and links drawn as the tracker's, and Markdown's own smaller </> (text 54.8, 18.2);
// the path picker's chevron and divider as measured (path 13.1, 5.2). A path found as typed whatever its separator and
// script, Tab taking the match typing reached, and words naming nothing said under the box (path 13.6, 5.4). The filter
// bar's keyword read in the page's language — its marks, Arabic digits — as every box reads a number (filters 11.2).
// Words typed in a path picker and left — by a click, Tab or Enter, before or after their list came — taking the
// record they name exactly, by its path or its own name, or saying that nothing or several are called so (path 14.4, 5.7).
// Fieldia's own date box (0.20.1) — its guard and what it keeps once left — with a date's calendar and a range of dates
// on its own calendar, cut out of the main script (date-box, calendar, date-range: 18.9, 7.1, as measured, 18.89 and 7.02).
// The date box's input rules given to every other box a date is typed into — a designer's day, time and value set
// when (dateRules) — their label and order read as they stand (date 19.1, as measured 19.03). The keys typed after a
// refused one waiting with it, read whole as the box is left, so "1x5/10/2026" is never 15 October (date 7.2 gzipped,
// as measured 19.09 and 7.1). A date's box read as a save reads it first (a change), and a date and time pasted into
// it saying the time it left out (date 19.3, as measured 19.29 and 7.17). Words typed in a path picker read by every
// save, check and step — the record they name taken, waited for while it is found, kept unread with why when none or
// several are called so — and autosave waiting while they are typed (path 15.4, 6.0, as measured 15.34 and 6.00).
// The list screen (0.23 size pass) — its table, groups, chosen records' buttons, pager and switcher, the search bar
// with its menu, a person's own filter and the favourites, and its sheet — cut out of the main script (list,
// list-groups, search-bar, custom-filter, favourites, list-styles: 42.7, 12.8, as measured 42.62 and 12.75).
// The eight themes, cut out of the main script (0.23): their tokens, light and dark, the page's look's tokens again
// after them, and their own shapes, as one sheet (themes 12.3, 3.9, as measured 12.23 and 3.83). The quiet look's sheet,
// cut out with them, its state's words and lock left in the main script (quiet 8.5, 2.2, as measured 8.46 and 2.19).
// A table of lines and a many2many's table of records with their own rules (0.23), cut out of the main script
// (lines-table, links-table, styles-lines: 23.0, 8.0, as measured 22.92 and 7.92).
// Flectra's business widgets (0.23) — a record's statusbar, priority stars, the boxes hours and a per cent are typed in,
// an analytic distribution's lines, tax totals and payments, with their sheet — cut out of the main script (business
// 26.0, 9.6, as measured 25.91 and 9.55).
// File and picture fields with their list, thumbnails, cards and dialog, files on their way, photos made smaller, a
// signature's pad and a PDF under its file box, with their sheet, cut out of the main script (files, files-going,
// shrink, signature, pdf, styles-files: 30.9, 11.3, as measured 30.82 and 11.28).
// The survey kinds (0.23) — a ranking, a matrix, a slider, pictures to choose from, a colour, properties, an address
// and a progress bar — with their two sheets, one of the rules cut from Fieldia's first sheet and one of those cut
// from the head of the page's own looks, cut out of the main script (survey 35.0, 12.2, as measured 34.99 and 12.10).
// Late answers laid only on the record they were asked for (after 0.23.0), each part carrying its own copy of the
// parts' test (shown.ts): a path picker's name found once the record was replaced (path 15.5, 6.1, as measured 15.34
// and 6.00 before, 15.49 and 6.06 after); a link's record opened or picked, and a picture read into formatted text
// (text 55.0, 18.3: 54.72 and 18.15 before, 54.92 and 18.23 after); a statusbar's save (business 26.1, 9.6: 25.92 and
// 9.55 before, 26.01 and 9.59 after). The files part (a file or a signature read: 30.75 and 11.20 before, 30.89 and
// 11.26 after) and the lines part (a table's records picked or opened: 22.86 and 7.91 before, 22.99 and 7.96 after)
// stay within theirs.
// What the browser fills a box in with (0.24, Wave 2): a date's box takes the page's purpose and keyboard, and one
// filled from a pick in another box is read as left (date 19.5, 7.3, as measured 19.45 and 7.23); an address's parts
// each take whose address it is (survey 35.1, as measured 35.06 and 12.13); hours and a per cent the page's purpose and
// keyboard, and read as left when filled from elsewhere (business as it was, measured 25.99 and 9.58).
// Save safety round 6 and autofill joined (inputs-fix-base): the business part measured 26.08 and 9.62 there, over
// its 9.6 gzipped before any fix of the input rules — to 9.7.
// The input rules held for names, tables and ways out (inputs-fix-names): a path's words of none or several kept unread
// as it is left or taken away, an exact name taken whatever row is reached, Ctrl+Enter reading the words, a name past
// the search's limit asked for exactly (path 16.0, 6.3: 15.49 and 6.06 before, 15.91 and 6.24 after); a line's × asking over text
// typed in it (lines 23.2, 8.1: 22.99 and 7.96 before, 23.11 and 8.01 after); a filter's day and time written the
// page's way (list 43.0, 12.9: 42.62 and 12.75 before, 42.99 and 12.85 after).
// The input rules checked again on 0.23 (inputs-fix-boxes), each part's box taking what was typed in its stand-in
// (`takeTyped`) and reading, never rewriting: hours and a per cent passed through, hours kept to the field's places and
// decimal hours said (business 26.7, 9.9, as measured 26.60 and 9.82; 26.08 and 9.62 before — save safety round 6 and
// autofill joined had left it at 9.62, over its 9.6); a date's box typed back to what it showed, its paste saying the
// reader's why (date 19.7, 7.4: 19.63 and 7.31, from 19.45 and 7.23); a path picker's (path 15.6: 15.53, from 15.49);
// a slider's, which marks text its number box left unread (survey 35.4, 12.3: 35.35 and 12.23, from 35.06 and 12.13);
// a links box reading the words typed before it came (text 55.6, 18.6: 55.57 and 18.50, from 54.92 and 18.23).
// Lists that add up and filter by time (Wave 2, lane F), in the list part: the totals row under a list, the ticked
// rows' and a Group By heading's sums, each amount in the one currency its source names (list-totals.ts); a date
// grouped by its year, quarter, month, week or day, its headings in words and each opened to its span (list-groups.ts);
// where a span ends, a period's days and the plain conditions for them (list-days.ts); the menu's spans and a person's
// own period (search-bar.ts, custom-filter.ts) and their rules — 42.62 and 12.75 measured before, 50.80 and 15.80
// after, to 50.9 and 15.9.
// Lists people take away and change in bulk (0.24), in the list part: every record that matches chosen and its ids
// paged through where a source gives none (list-every), Export's menu and an export as CSV or as an Excel workbook
// written with no library (list-export; xlsx and zip: 6.5 raw, 2.8 gzipped of the whole), and Edit's dialog, question,
// writes and report (list-bulk) — list 42.62 and 12.75 measured before, 63.58 and 20.54 after (list 63.6, 20.6).
// A list's phone column written as people read it (0.24): list 42.9, 12.9, as measured 42.82 and 12.81.
// A phone read the world over (0.24) — its box, its country picked or typed, the number checked by it and kept as
// E.164, its call and WhatsApp links, its sheet, and every country's numbers in a table made from libphonenumber's
// metadata (phone-table.ts, 23.1 of it, 9.6 gzipped: libphonenumber-js's own smallest build is 147.4 and 34.1) — new,
// in fieldia.phone.js (phone 34.7, 15.2, as measured 34.63 and 15.11).
// A date and time on its zone's clock (0.24): the box's zone beside it and its letters let through, its calendar's and a
// range's days, today and hours on that clock, and a day whose time the clocks skip said (date 21.6, 8.2, as measured
// 21.53 and 8.12: 2.2 and 1.0 more). Booking slots (0.24), a part of their own — the month shaded by how it is booked,
// the day's times as chips, the arrows across both, a time taken meanwhile said, and their sheet (slots 14.7, 5.6, as
// measured 14.64 and 5.58) — loaded with the date part, whose box they are without the data source's slots. In the
// date part they would have added 14.6 and 5.6 to every page with a date; on their own, a booking page loads both.
// The business owner's walk of 0.23 mended: a cell's, a range's end's and a property's message shown once the press
// that left it has ended (date 19.4, 7.3, as measured 19.38 and 7.21; survey 35.2, as measured 35.15); and a table of
// lines naming a line by its number among the items, its worked-out numbers waiting, said in words, for a cell of it
// that does not read (lines 23.7, 8.2, as measured 23.63 and 8.18).
// 0.24's lanes joined, measured in the merged build (0.23.0's in brackets): text 55.60 and 18.52 (54.72, 18.15), path
// 15.95 and 6.26 (15.34, 6.00), date 21.96 and 8.30 (19.29, 7.17), list 72.41 and 23.71 (42.62, 12.75), lines 23.88
// and 8.28 (22.86, 7.91), business 26.60 and 9.82 (25.92, 9.55), files 30.89 and 11.26 (30.75, 11.20), survey 35.50
// and 12.29 (35.00, 12.10), and the new phone 34.77 and 15.21 and slots 14.63 and 5.57 — each to the next 0.1 over
// (business's raw to 26.7, 4 bytes under 26.6 being no room; date's gzipped to 8.4, its 8.30 at the line); head,
// choice, filters, themes and the quiet look as at 0.23.0, unchanged.
// A related list inside a record (Wave 3), in the list part and drawn with its table: its heading, count, View all and
// New, what it says before a first save, each ask kept to the record shown (list-related.ts: 3.6, 1.6 gzipped on its
// own), its look (1.2), and the list's search as a box alone, its search and pager once a page is full, its count told
// and an answer for a record no longer shown dropped (list.ts, search-bar.ts) — list 72.41 and 23.71 measured before,
// 77.37 and 25.26 after (list 77.4, 25.3). A part of its own would have spared a plain list page about 1.2 gzipped and
// cost a record page with one a second request: a related list draws with the list part's table, so it loads that.
const PART_BUDGET_KB = { head: [34.0, 9.9], text: [55.7, 18.6], path: [16.0, 6.3], choice: [5.4, 2.4], filters: [11.2, 4.2], date: [22.0, 8.4], list: [77.4, 25.3], themes: [12.3, 3.9], quiet: [8.5, 2.2], lines: [23.9, 8.3], business: [26.7, 9.9], files: [30.9, 11.3], survey: [35.6, 12.4], phone: [34.8, 15.3], slots: [14.7, 5.6] };
// What each part gives, by the names the packages draw from.
const PART_GIVES = {
  head: ['recordHead', 'richButton', 'sectionHeading', 'wireMaximise', 'wireGrip', 'installHeadStyles', 'installGroupStyles'],
  text: ['modernHtml', 'linksWidget', 'formattedText', 'decorateLinks', 'markdownToHtml', 'htmlToMarkdown', 'markdownLoses', 'textMenu'],
  path: ['pathPickerWidget'],
  choice: ['ownListWidget'],
  filters: ['filterBar', 'installFilterStyles'],
  date: ['dateBox', 'dateBoxWidget', 'dateRules', 'withCalendar', 'weekdayHead', 'dateRangeWidget'],
  list: ['listView', 'relatedList', 'relatedListPage', 'installListStyles'],
  themes: ['installThemeStyles'],
  quiet: ['installQuietStyles'],
  lines: ['linesWidget', 'linksTableWidget'],
  business: ['statusbarWidget', 'priorityWidget', 'durationWidget', 'percentageWidget', 'distributionWidget', 'taxTotalsWidget', 'paymentsWidget'],
  files: ['binaryWidget', 'imageWidget', 'signatureWidget', 'pdfWidget', 'readFile', 'goingItem', 'goingList', 'goingWords', 'shrinkPhoto', 'shrinkFor', 'shrinkable', 'installFilesStyles'],
  survey: ['rankingWidget', 'matrixWidget', 'sliderWidget', 'imageChoiceWidget', 'colourWidget', 'propertiesWidget', 'addressWidget', 'progressbarWidget'],
  phone: ['phoneWidget', 'readPhone', 'writePhone', 'shownPhone', 'phoneLinks', 'phoneParts', 'phoneCountries', 'phoneCountry', 'flagOf'],
  slots: ['slotsWidget'],
};
// The Fieldia object each part is reached through, as the packages ask for it.
const PART_OF = { head: 'headPart', text: 'textPart', path: 'pathPart', choice: 'choicePart', filters: 'filtersPart', date: 'datePart', list: 'listPart', themes: 'themesPart', quiet: 'quietPart', lines: 'linesPart', business: 'businessPart', files: 'filesPart', survey: 'surveyPart', phone: 'phonePart', slots: 'slotsPart' };
if (PARTS.join() !== Object.keys(PART_GIVES).sort().join()) throw new Error(`the main script asks for the parts ${PARTS.join(', ')}; this check knows ${Object.keys(PART_GIVES).sort().join(', ')}`);
// The parts a part comes with, in as it is: booking slots bring the date part, whose box they are without the data
// source's slots.
const PART_BESIDE = { slots: ['date'] };
const partSizes = [];
for (const part of PARTS) {
  const file = partFiles[part];
  const partCode = readFileSync(file, 'utf8');
  const name = `fieldia.${part}.js`;
  if (/mountViewer|createForm/.test(partCode)) throw new Error(`${name} carries a copy of Fieldia: it must carry its own code alone`);
  if (/ZodError|\$ZodType/.test(partCode)) throw new Error(`${name} carries zod`);
  if (/\\u06[2-4][0-9a-f]/i.test(partCode)) throw new Error(`${name} carries Arabic letters: a part's words are the packages' tables', in the language add-ons`);
  const [raw, gzip] = PART_BUDGET_KB[part];
  const partBytes = statSync(file).size;
  const partGzipped = gzipSync(partCode, { level: 9 }).length;
  if (partBytes > raw * 1024) throw new Error(`${name} is ${(partBytes / 1024).toFixed(2)} KB, over its ${raw} KB budget`);
  if (partGzipped > gzip * 1024) throw new Error(`${name} is ${(partGzipped / 1024).toFixed(1)} KB gzipped, over its ${gzip} KB budget`);
  const beside = (PART_BESIDE[part] ?? []).map((other) => partFiles[other]);
  for (const order of [[OUT, ...beside, file], [file, ...beside, OUT], [OUT, file, ...beside, file]]) {
    const { Fieldia: withIt, warnings } = runTogether(order);
    const loaded = order.map((f) => f.replace(BUNDLE + '/', '')).join(', then ');
    const gives = await runInNewContext(`Fieldia.${PART_OF[part]}.load()`, withIt ? { Fieldia: withIt } : {});
    const missing = PART_GIVES[part].filter((one) => typeof gives?.[one] !== 'function');
    if (missing.length) throw new Error(`${loaded}: ${name} does not give ${missing.join(', ')}`);
    if (withIt[PART_OF[part]].loaded !== gives) throw new Error(`${loaded}: Fieldia.${PART_OF[part]} does not hold what ${name} gave`);
    if (warnings.length) throw new Error(`${loaded}: ${warnings.join(' ')}`);
  }
  // A part of another version: refused with a warning, and the part asked for fails, so the page draws plainly.
  const older = partCode.replace(`, ${JSON.stringify(version)}, function`, ', "0.0.0", function');
  if (older === partCode) throw new Error(`${name} does not say its version where the main script reads it`);
  const warned = [];
  const host = { console: { warn: (message) => warned.push(message) } };
  runInNewContext(readFileSync(OUT, 'utf8'), host);
  runInNewContext(older, host);
  const refused = await host.Fieldia[PART_OF[part]].load().then(() => false, () => true);
  if (!refused || warned.length !== 1 || !warned[0].includes(`${name} is version 0.0.0`)) throw new Error(`${name} of another version is not refused with a warning`);
  partSizes.push(`${part} ${(partBytes / 1024).toFixed(1)} KB, ${(partGzipped / 1024).toFixed(1)} KB gzipped`);
}
// Every name the parts take from the main script is set as the main script starts: the table is made then, and a const
// of a module the main script has not run by that time (one in an import cycle with the table, as the parts' holders
// are) would be undefined in it — a part takes a function of it instead.
{
  const host = { console: { warn: () => undefined } };
  runInNewContext(readFileSync(OUT, 'utf8'), host);
  let shared;
  host.FieldiaParts.push(['shared-names', version, (given) => (shared = given)]);
  const unset = table.flatMap(([file, names], i) => names.filter((name) => shared?.[i]?.[name] === undefined).map((name) => `${name} (${file.replace(`${WORKSPACE}/`, '')})`));
  if (unset.length) throw new Error(`the parts take names the main script has not set as it starts: ${unset.join(', ')}`);
}
// Asked for with no address to load it from (no document here), a part not on the page fails — and is asked again next time.
{
  const host = { console: { warn: () => undefined } };
  runInNewContext(readFileSync(OUT, 'utf8'), host);
  const failed = await host.Fieldia.headPart.load().then(() => false, () => true);
  runInNewContext(readFileSync(partFiles.head, 'utf8'), host);
  const later = await host.Fieldia.headPart.load().then((gives) => typeof gives.recordHead === 'function', () => false);
  if (!failed || !later) throw new Error('a part that could not come is not asked for again');
}
console.log(`parts: ${partSizes.join('; ')}`);

/**
 * In a page, as a browser runs it: the main script, from an address of its own, asks for nothing while a page uses no
 * part, and for each part the first time a page uses one, from beside itself — a phone read the world over, a list's
 * screen (its phones, its totals, its Export and Edit), a record's related list, a theme, a table of lines, a
 * customer's statusbar and photo, a work item's head, text and path picker for its bug, the filter bar for its backlog,
 * a date's box (on a public page with its bot check), the survey kinds, a booking's slots — and the page is drawn
 * whole once they have come. Pages
 * open in an order where each part's first use is clear, the parts in after each step said in full.
 */
{
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => problems.push(error.message));
  virtualConsole.on('error', (message) => problems.push(String(message)));
  const dom = new JSDOM('<!doctype html><html><head><script src="fieldia.js"></script></head><body><div id="app"></div></body></html>', {
    url: pathToFileURL(join(BUNDLE, 'page.html')).href,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
  });
  await new Promise((done) => dom.window.addEventListener('load', done));
  const { Fieldia: inPage, document: doc } = dom.window;
  const loaded = () => PARTS.filter((part) => inPage[PART_OF[part]].loaded).join(', ');
  /** The parts in after a step, every one so far — as one run of this check found them, each part's first use clear. */
  const hasIn = (step, want) => {
    const now = loaded();
    if (now !== want) throw new Error(`in a page, after ${step} the parts in are ${now || 'none'}, not ${want || 'none'}`);
  };
  const host = doc.getElementById('app');
  const read = (name) => JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages', name), 'utf8'));
  const tick = (ms = 10) => new Promise((done) => dom.window.setTimeout(done, ms));
  /** Wait for what a page draws once its source has answered (a list's rows, its totals). */
  const until = async (ready) => {
    for (let turn = 0; turn < 100 && !ready(); turn++) await tick();
    return ready();
  };
  // Each page taken away whole: nothing of it left in the app's element for the next.
  const gone = (name) => {
    if (host.childElementCount) throw new Error(`in a page, ${name} left ${host.childElementCount} element(s) behind once destroyed: ${[...host.children].map((e) => e.className).join(', ')}`);
  };
  /** A page that waits for a part: nothing of it drawn before the part came, the page busy meanwhile. */
  const waits = (view, what) => {
    if (host.querySelector('.fd-field, .fd-list') || view.element.getAttribute('aria-busy') !== 'true') throw new Error(`in a page, ${what} drew before its part came`);
  };
  // A page of plain parts: drawn at once, nothing asked for.
  const plain = inPage.mountViewer(host, { page: read('new-customer.page.json'), dataSource: inPage.createMemoryDataSource() });
  if (!host.querySelector('.fd-field')) throw new Error('in a page, a page using no part is not drawn at once');
  await plain.drawn;
  hasIn('a page of plain parts', '');
  plain.destroy();
  gone('plain');
  // A form whose phones are read the world over (its page's phone): the phone part, the page drawn once it came,
  // its phone's country before the number, its sheet in.
  const contact = inPage.mountViewer(host, { page: { ...read('new-customer.page.json'), phone: { country: 'EG' } }, dataSource: inPage.createMemoryDataSource() });
  waits(contact, 'a page with a phone read the world over');
  await contact.drawn;
  hasIn('a phone read the world over', 'phone');
  if (!host.querySelector('.fd-phone .fd-phone-country select') || !doc.getElementById('fieldia-phone-styles')) throw new Error('in a page, a phone is not drawn from its part');
  contact.destroy();
  gone('contact');
  // A list with its search bar: the list part, the page drawn once it came; its phone column's numbers written by the
  // phone part, in already. Export and Edit are asked for by the page: neither is in its bar.
  const customers = inPage.mountViewer(host, { page: read('customers.page.json'), dataSource: inPage.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', phone: '+201012345678' } } } }) });
  waits(customers, 'a list');
  await customers.drawn;
  hasIn("a list's screen", 'list, phone');
  if (!host.querySelector('.fd-list-table') || !host.querySelector('.fd-search-input') || !doc.getElementById('fd-list-styles')) throw new Error('in a page, a list is not drawn from its part');
  if (!(await until(() => host.querySelector('.fd-list-row')))?.textContent.includes('+20 10 1234 5678')) throw new Error(`in a page, a list's phone is not written as people read it: ${host.querySelector('.fd-list-row')?.textContent ?? 'no row'}`);
  if (!host.querySelector('.fd-list-export')?.hidden || host.querySelector('.fd-list-edit')) throw new Error("in a page, a list that asks for neither shows Export or Edit");
  customers.destroy();
  gone('customers');
  // Invoices that add up: the list part already in, the totals row under the list from the source's totals.
  const year = new Date().getFullYear();
  const egp = { id: 1, label: 'EGP' };
  const invoiced = { 1: { name: 'INV/1', invoice_date: `${year}-01-15`, due_date: `${year}-02-15`, state: 'paid', currency_id: egp, amount: 100 }, 2: { name: 'INV/2', invoice_date: `${year}-01-20`, due_date: `${year}-02-20`, state: 'sent', currency_id: egp, amount: 250 } };
  const invoices = inPage.mountViewer(host, { page: read('invoices.page.json'), dataSource: inPage.createMemoryDataSource({ records: { invoice: invoiced, currency: { 1: { name: 'EGP' } } } }) });
  await invoices.drawn;
  hasIn('invoices that add up', 'list, phone');
  if (!(await until(() => host.querySelector('.fd-list-total:not([hidden])')?.textContent.includes('350')))) throw new Error(`in a page, a list's totals row is not drawn: ${host.querySelector('.fd-list-total')?.textContent ?? 'no totals row'}`);
  invoices.destroy();
  gone('invoices');
  // Contacts taken away and changed in bulk: Export and Edit in the list's bar, as the page asks.
  const contacts = inPage.mountViewer(host, { page: read('contacts.page.json'), dataSource: inPage.createMemoryDataSource({ records: { 'crm.contact': { 1: { name: 'Nile Traders', state: 'customer' } } } }) });
  await contacts.drawn;
  hasIn('contacts to export and edit in bulk', 'list, phone');
  if (host.querySelector('.fd-list-export')?.hidden !== false || !host.querySelector('.fd-list-edit')) throw new Error("in a page, a list that asks for Export and Edit does not offer them");
  contacts.destroy();
  gone('contacts');
  // A customer with its invoices listed inside it: the list part's table, already in, for the records that point at it.
  const account = inPage.mountViewer(host, {
    page: read('customer-account.page.json'),
    recordId: 1,
    dataSource: inPage.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } }, invoice: { ...invoiced, 3: { ...invoiced[1], name: 'INV/3', partner_id: { id: 1, label: 'Nile Traders' } } } } }),
  });
  await account.drawn;
  hasIn('a customer with its invoices', 'list, phone');
  if (!(await until(() => host.querySelector('[data-node="invoices"] .fd-list-row')))?.textContent.includes('INV/3') || host.querySelectorAll('[data-node="invoices"] .fd-list-row').length !== 1) throw new Error(`in a page, a related list does not list the records that point at its record: ${host.querySelector('[data-node="invoices"]')?.textContent ?? 'no related list'}`);
  account.destroy();
  gone('account');
  // A theme the app gives: the page drawn at once with no theme, which it wears once its part came — then another at once.
  const themed = inPage.mountViewer(host, { page: read('new-customer.page.json'), dataSource: inPage.createMemoryDataSource(), theme: 'material' });
  if (!host.querySelector('.fd-field') || themed.element.hasAttribute('data-fd-theme')) throw new Error('in a page, a theme the app gives held the page back, or was worn before its part came');
  await themed.drawn;
  hasIn('a theme the app gives', 'list, phone, themes');
  if (themed.element.getAttribute('data-fd-theme') !== 'material' || !doc.getElementById('fieldia-theme-styles')) throw new Error('in a page, a theme the app gives is not worn from its part');
  themed.setTheme('odoo');
  if (themed.element.getAttribute('data-fd-theme') !== 'odoo') throw new Error('in a page, a theme switched to is not worn at once once its part is in');
  themed.destroy();
  gone('themed');
  // An order with a table of its items: the lines part, its sheet before the page's own looks, the page drawn once it
  // came — nothing of it before.
  const order = inPage.mountViewer(host, { page: read('rules.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(order, 'a page with a table of lines');
  await order.drawn;
  hasIn('an order with a table of lines', 'lines, list, phone, themes');
  if (!host.querySelector('.fd-lines .fd-lines-table') || host.querySelector('.fd-lines-plain')) throw new Error('in a page, a table of lines is not drawn from its part');
  order.destroy();
  gone('order');
  // A customer's sheet: its statusbar's part, the business widgets', its photo's, the files part, and its table of
  // contacts', the lines part — the page drawn once they came, nothing of it before.
  const customer = inPage.mountViewer(host, { page: read('customer.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(customer, 'a sheet with a statusbar and a photo');
  await customer.drawn;
  hasIn("a customer's sheet", 'business, files, lines, list, phone, themes');
  if (!host.querySelector('.fd-header .fd-statusbar [aria-current="step"]')) throw new Error('in a page, a statusbar is not drawn from its part');
  if (!host.querySelector('.fd-file.fd-file-image .fd-file-pick')) throw new Error('in a page, a customer\'s photo is not drawn from its part');
  customer.destroy();
  gone('customer');
  // A work item's bug: its parts asked for — its quiet skin's among them — the page drawn once they came, nothing of it before.
  const bug = inPage.mountViewer(host, { page: read('work-item-bug.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(bug, "a work item's bug");
  await bug.drawn;
  hasIn("a work item's bug", 'business, choice, files, head, lines, list, path, phone, quiet, text, themes');
  if (!host.querySelector('.fd-head') || !host.querySelector('.fd-path') || !host.querySelector('.fd-text') || !host.querySelector('.fd-own-box') || !host.querySelector('.fd-field[data-quiet]') || bug.element.getAttribute('data-fd-theme') !== 'fluent' || bug.element.hasAttribute('aria-busy')) throw new Error('in a page, a work item\'s bug is not drawn from its parts');
  for (const id of ['fieldia-head-styles', 'fieldia-editor-styles', 'fieldia-path-styles', 'fieldia-choice-styles', 'fieldia-theme-styles', 'fieldia-quiet-styles']) if (doc.getElementById(id)?.nextElementSibling === null) throw new Error(`in a page, ${id} is not before the page's own looks`);
  bug.destroy();
  gone('bug');
  // Its backlog: the filter bar's part too.
  const backlog = inPage.mountViewer(host, { page: read('backlog.page.json'), dataSource: inPage.createMemoryDataSource() });
  await backlog.drawn;
  hasIn('a backlog', 'business, choice, files, filters, head, lines, list, path, phone, quiet, text, themes');
  if (!host.querySelector('.fd-filter-bar')) throw new Error("in a page, a backlog's filter bar is not drawn from its part");
  backlog.destroy();
  gone('backlog');
  // A public sign-up with a date: its box and calendar's part, the page drawn once it came — nothing of it before — and
  // its bot check, which is this script's: the box no person sees, before the answers.
  const signup = inPage.mountViewer(host, { page: read('signup.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(signup, 'a page with a date');
  await signup.drawn;
  hasIn('a sign-up with a date and a bot check', 'business, choice, date, files, filters, head, lines, list, path, phone, quiet, text, themes');
  if (!host.querySelector('.fd-date-pick .fd-calendar-button')) throw new Error('in a page, a date is not drawn from its part');
  if (!host.querySelector('.fd-trap[inert] input[name="website"]')) throw new Error("in a page, a public page's bot check has no hidden box");
  signup.destroy();
  gone('signup');
  // A survey with a matrix: the survey kinds' part, the page drawn once it came — nothing of it before.
  const survey = inPage.mountViewer(host, { page: read('survey.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(survey, 'a survey');
  await survey.drawn;
  hasIn('a survey with a matrix', 'business, choice, date, files, filters, head, lines, list, path, phone, quiet, survey, text, themes');
  if (!host.querySelector('.fd-matrix-table')) throw new Error('in a page, a matrix is not drawn from its part');
  survey.destroy();
  gone('survey');
  // A test drive booked from the times free: the slots part, with the date part beside it, the page drawn once both
  // came — nothing of it before — and the month asked of the data source's slots.
  const asked = [];
  const slots = (request) => (asked.push(request), Promise.resolve({ days: { [request.from]: { state: 'open', free: [] } } }));
  const drive = inPage.mountViewer(host, { page: read('test-drive.page.json'), dataSource: inPage.createMemoryDataSource({ slots }) });
  waits(drive, 'a test drive');
  await drive.drawn;
  await tick(0);
  hasIn("a test drive's slots", 'business, choice, date, files, filters, head, lines, list, path, phone, quiet, slots, survey, text, themes');
  if (!host.querySelector('.fd-slots .fd-slots-days') || !asked.length) throw new Error('in a page, booking slots are not drawn from their part');
  drive.destroy();
  gone('drive');
  // Every part's sheet between Fieldia's two halves, in the order of its rank: where its rules stood in Fieldia's own
  // (PART_RANK) — a table of lines', the business widgets', the survey kinds', the files', then a phone's and booking
  // slots' (new at 0.24, before the themes so a theme still reshapes them), the themes' and the quiet look's before the
  // pickers', the head's and the text's, the survey kinds' own looks last.
  const styles = [...doc.head.querySelectorAll('style[id]')];
  const ids = styles.map((style) => style.id);
  const ranked = styles.filter((style) => style.hasAttribute('data-fd-rank'));
  const ranks = ranked.map((style) => Number(style.getAttribute('data-fd-rank')));
  const inside = ranked.every((style) => ids.indexOf(style.id) > ids.indexOf('fieldia-styles') && ids.indexOf(style.id) < ids.indexOf('fieldia-styles-looks'));
  if (!inside || ranks.some((rank, i) => i > 0 && rank < ranks[i - 1])) throw new Error(`in a page, the parts' sheets are out of their places: ${ids.join(', ')}`);
  for (const id of ['fieldia-lines-styles', 'fieldia-business-styles', 'fieldia-survey-styles', 'fieldia-files-styles', 'fieldia-phone-styles', 'fieldia-slots-styles', 'fieldia-theme-styles', 'fieldia-quiet-styles', 'fieldia-survey-looks']) if (!ids.includes(id)) throw new Error(`in a page, ${id} was never put in`);
  if (problems.length) throw new Error(`in a page: ${problems.join('; ')}`);
  dom.window.close();
  console.log("in a page: nothing asked for by a page of plain parts; a phone read the world over; a list's screen, its phones, its totals, its Export and Edit only where asked; a customer's invoices listed inside it; a theme the app gives, worn as it came; an order's table of lines; a customer's statusbar and photo; a bug's head, text, path picker, own lists, attachments and quiet look; a backlog's filter bar; a sign-up's date box and bot check; a survey's matrix; a test drive's slots — each as first used, each sheet in its place");
}
