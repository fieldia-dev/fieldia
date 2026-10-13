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
const BUDGET_KB = 612.7;
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
const GZIP_BUDGET_KB = 182.5;
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
const ADD_ON_BUDGET_KB = { ar: [27.2, 5.6], de: [11.7, 4.9], fr: [11.8, 4.8] };
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
