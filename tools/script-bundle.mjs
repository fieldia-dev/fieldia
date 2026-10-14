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
const partScript = (part, inMain, table) =>
  build({
    ...common,
    stdin: { contents: `export * from ${JSON.stringify(PART_SOURCES[part])};`, resolveDir: WORKSPACE, sourcefile: `fieldia.${part}.ts`, loader: 'ts' },
    plugins: [minifiedStyles, englishOnly, takesShared(inMain, table)],
    globalName: 'part',
    // It hands itself to the main script (tools/script-parts.ts), or waits for it in the queue.
    banner: { js: `/*! Fieldia ${version} · ${part} · MIT · https://fieldia.dev */\n(globalThis.FieldiaParts = globalThis.FieldiaParts || []).push([${JSON.stringify(part)}, ${JSON.stringify(version)}, function (__fieldia) {` },
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
const partFiles = {};
const partInputs = {};
for (const part of PARTS) {
  const { metafile } = await partScript(part, main.inMain, table);
  partFiles[part] = join(BUNDLE, `fieldia.${part}.js`);
  partInputs[part] = Object.keys(metafile.inputs).filter((input) => input.startsWith('libs/'));
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
const BUDGET_KB = 574.7;
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
const GZIP_BUDGET_KB = 176.7;
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
const ADD_ON_BUDGET_KB = { ar: [34.3, 6.5], de: [14.6, 5.7], fr: [14.9, 5.6] };
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
// the path picker's chevron and divider as measured (path 13.1, 5.2).
const PART_BUDGET_KB = { head: [34.0, 9.9], text: [54.8, 18.2], path: [13.1, 5.2], choice: [5.4, 2.4], filters: [11.1, 4.2] };
// What each part gives, by the names the packages draw from.
const PART_GIVES = {
  head: ['recordHead', 'richButton', 'sectionHeading', 'wireMaximise', 'wireGrip', 'installHeadStyles', 'installGroupStyles'],
  text: ['modernHtml', 'linksWidget', 'formattedText', 'decorateLinks', 'markdownToHtml', 'htmlToMarkdown', 'markdownLoses', 'textMenu'],
  path: ['pathPickerWidget'],
  choice: ['ownListWidget'],
  filters: ['filterBar', 'installFilterStyles'],
};
// The Fieldia object each part is reached through, as the packages ask for it.
const PART_OF = { head: 'headPart', text: 'textPart', path: 'pathPart', choice: 'choicePart', filters: 'filtersPart' };
if (PARTS.join() !== Object.keys(PART_GIVES).sort().join()) throw new Error(`the main script asks for the parts ${PARTS.join(', ')}; this check knows ${Object.keys(PART_GIVES).sort().join(', ')}`);
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
  for (const order of [[OUT, file], [file, OUT], [OUT, file, file]]) {
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
 * part, and for each part the first time a page uses one, from beside itself — a work item's head, text and path
 * picker for its bug, the filter bar for its backlog — and the page is drawn whole once they have come.
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
  const host = doc.getElementById('app');
  const read = (name) => JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages', name), 'utf8'));
  // A page of plain parts: drawn at once, nothing asked for.
  const plain = inPage.mountViewer(host, { page: read('customer.page.json'), dataSource: inPage.createMemoryDataSource() });
  if (!host.querySelector('.fd-field')) throw new Error('in a page, a page using no part is not drawn at once');
  await plain.drawn;
  if (loaded()) throw new Error(`in a page, a page using no part asked for ${loaded()}`);
  plain.destroy();
  // A work item's bug: its parts asked for, the page drawn once they came — nothing of it before.
  const bug = inPage.mountViewer(host, { page: read('work-item-bug.page.json'), dataSource: inPage.createMemoryDataSource() });
  if (host.querySelector('.fd-field') || bug.element.getAttribute('aria-busy') !== 'true') throw new Error('in a page, a page drew before its parts came');
  await bug.drawn;
  if (loaded() !== 'choice, head, path, text') throw new Error(`in a page, a work item's bug asked for ${loaded() || 'no part'}, not its choices, head, path and text`);
  if (!host.querySelector('.fd-head') || !host.querySelector('.fd-path') || !host.querySelector('.fd-text') || !host.querySelector('.fd-own-box') || bug.element.hasAttribute('aria-busy')) throw new Error('in a page, a work item\'s bug is not drawn from its parts');
  for (const id of ['fieldia-head-styles', 'fieldia-editor-styles', 'fieldia-path-styles', 'fieldia-choice-styles']) if (doc.getElementById(id)?.nextElementSibling === null) throw new Error(`in a page, ${id} is not before the page's own looks`);
  bug.destroy();
  // Its backlog: the filter bar's part too.
  const backlog = inPage.mountViewer(host, { page: read('backlog.page.json'), dataSource: inPage.createMemoryDataSource() });
  await backlog.drawn;
  if (loaded() !== 'choice, filters, head, path, text' || !host.querySelector('.fd-filter-bar')) throw new Error(`in a page, a backlog's filter bar is not drawn from its part (${loaded()})`);
  backlog.destroy();
  if (problems.length) throw new Error(`in a page: ${problems.join('; ')}`);
  dom.window.close();
  console.log("in a page: nothing asked for by a page of plain parts; a bug's head, text, path picker and own lists, and a backlog's filter bar, each as first used");
}
