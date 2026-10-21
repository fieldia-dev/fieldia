/**
 * Release Fieldia's packages — and prove them first, the way someone else
 * would meet them: packed, installed into an empty project, imported.
 *
 *   node tools/release.mjs check              pack every package, install the packs into
 *                                             an empty project, require/import/type-check them
 *   NPM_TOKEN=… node tools/release.mjs publish  the same check, then publish what is not on npm yet
 *   node tools/release.mjs verify             after publishing: the same checks on what npm serves
 *
 * Every mode refuses a version with no section in CHANGELOG.md. `publish` refuses a page format whose shape changed
 * under its old version (format-shape.mjs; `check` only says so), and ends by printing the version's section and the
 * exact commands that tag the release and make its GitHub release, for a person to run (see release-notes.mjs).
 *
 * Build first: `npx nx run-many -t build`. A package marked `"private": true`
 * is never packed or published.
 *
 * The token is read from the environment and written only into a throwaway
 * npmrc under tmp/, as a reference npm expands itself — never into a command
 * line, where any process listing would show it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { notesFor, printRelease } from './release-notes.mjs';
import { checkFormatShape } from './format-shape.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const WORK = join(WORKSPACE, 'tmp/release');
const PACKS = join(WORK, 'packs');
const SMOKE = join(WORK, 'smoke');
const mode = process.argv[2] ?? 'check';
if (!['check', 'publish', 'verify'].includes(mode)) throw new Error(`usage: node tools/release.mjs check|publish|verify (got "${mode}")`);
/** verify installs what npm serves, so it needs no build and packs nothing. */
const fromRegistry = mode === 'verify';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const run = (cmd, args, cwd = WORKSPACE, env = process.env) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fail = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};

// ---- which packages, in what order --------------------------------------------
/** Dependencies before dependants, so a publish never points at a version npm does not have yet. */
const ORDER = ['core', 'widgets', 'viewer', 'grid', 'code', 'monaco', 'map', 'calendar', 'chatter', 'react', 'vue', 'angular', 'designer'];
const packages = ORDER.map((dir) => ({ dir, manifest: read(join(WORKSPACE, 'libs', dir, 'package.json')) })).filter((p) => !p.manifest.private);
const version = packages[0].manifest.version;
for (const { dir, manifest } of packages) {
  if (manifest.version !== version) fail(`libs/${dir} is ${manifest.version}; every package releases together at ${version}`);
  for (const [name, wanted] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith('@fieldia/') && wanted !== version) fail(`libs/${dir} depends on ${name}@${wanted}, not ${version}`);
  }
  if (fromRegistry) continue;
  const built = join(WORKSPACE, 'dist/libs', dir, 'package.json');
  if (!existsSync(built) || read(built).version !== version) fail(`dist/libs/${dir} is missing or stale: run \`npx nx run-many -t build\``);
  if (!existsSync(join(WORKSPACE, 'dist/libs', dir, 'README.md'))) fail(`dist/libs/${dir} has no README.md — its npm page would be empty`);
}
// What changed, in plain words, before anything is packed: CHANGELOG.md's section for this version.
if (!notesFor(readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8'), version)) fail(`CHANGELOG.md has no section for ${version}: write what changed, in plain words, before releasing it`);
// A page this release writes says a format version: one whose shape older readers know (format-shape.mjs). Said on
// every check, while lanes add to the format; refused at publish, where the version has to be right.
const format = checkFormatShape(WORKSPACE);
if (!format.ok && mode === 'publish') fail(format.message);
if (!format.ok) console.warn(`release: before publishing, ${format.message}`);
console.log(`release ${version}: ${packages.map((p) => p.manifest.name).join(', ')}`);

// ---- pack ----------------------------------------------------------------------
rmSync(WORK, { recursive: true, force: true });
mkdirSync(PACKS, { recursive: true });
const tarballs = packages.map(({ dir, manifest }) => {
  if (fromRegistry) return `${manifest.name}@${version}`;
  const [packed] = JSON.parse(run('npm', ['pack', join(WORKSPACE, 'dist/libs', dir), '--pack-destination', PACKS, '--json']));
  const files = packed.files.map((f) => f.path);
  const stray = files.filter((f) => /\.spec\.|\.tsbuildinfo$|(^|\/)tmp\//.test(f));
  if (stray.length) fail(`${packed.name} would ship ${stray.join(', ')}`);
  console.log(`  packed ${packed.filename} (${files.length} files, ${Math.round(packed.size / 1024)} KB)`);
  return join(PACKS, packed.filename);
});

// ---- install into an empty project -------------------------------------------------
const root = read(join(WORKSPACE, 'package.json'));
const pin = (name) => `${name}@${(root.dependencies ?? {})[name] ?? root.devDependencies[name]}`.replace(/@[~^]/, '@');
mkdirSync(SMOKE, { recursive: true });
writeFileSync(join(SMOKE, 'package.json'), JSON.stringify({ name: 'fieldia-smoke', private: true, version: '0.0.0' }, null, 2));
const peers = ['react', 'react-dom', '@types/react', 'vue', '@angular/core', '@angular/compiler', 'rxjs', 'ag-grid-community'].map(pin);
run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...tarballs, ...peers], SMOKE);
for (const { manifest } of packages) {
  const installed = read(join(SMOKE, 'node_modules', manifest.name, 'package.json')).version;
  if (installed !== version) fail(`${manifest.name} installed as ${installed}, not ${version}`);
}

// What each package must export, by name.
const EXPECT = {
  '@fieldia/core': ['validatePage', 'createForm', 'createMemoryDataSource', 'evaluateModifier'],
  '@fieldia/widgets': ['createWidget', 'installStyles', 'sanitizeHtml'],
  '@fieldia/viewer': ['mountViewer', 'VIEWER_LABELS', 'addLanguage'],
  '@fieldia/grid': ['gridWidgets', 'gridWidget', 'gridApiOf'],
  '@fieldia/code': ['codeWidgets', 'codeWidget', 'textCodeWidget', 'CODE_LANGUAGES', 'loadCodeLanguage'],
  '@fieldia/monaco': ['monacoWidgets', 'createMonacoWidgets', 'MONACO_LANGUAGES', 'monacoTheme'],
  '@fieldia/map': ['mapWidgets', 'mapKinds', 'azureMaps', 'googleMaps', 'mapbox', 'openStreetMap', 'tiles', 'readArea', 'writePoint', 'MAP_LABELS'],
  '@fieldia/calendar': ['calendarListViews'],
  '@fieldia/chatter': ['mountChatter', 'chatterSlot', 'createMemoryChatter', 'CHATTER_LABELS'],
  '@fieldia/react': ['FieldiaForm', 'useFormState'],
  '@fieldia/vue': ['FieldiaForm', 'useFormState'],
  '@fieldia/angular': ['FieldiaFormComponent', 'FieldiaSlotDirective', 'formState'],
  '@fieldia/designer': ['createDesigner', 'blankPage', 'createMemoryPageStore', 'mountScreenEditor', 'mountSurveyEditor'],
};
const names = packages.map((p) => p.manifest.name);
const esmOnly = new Set(['@fieldia/angular']);
// Every language in the packages with no extra import: only the script bundle leaves them to add-ons.
const languagesCheck = (load) => `for (const [name, table] of [['@fieldia/core', 'MESSAGES'], ['@fieldia/widgets', 'WIDGET_LABELS'], ['@fieldia/viewer', 'VIEWER_LABELS']]) {
  const held = Object.keys((${load})[table]).sort().join(',');
  if (held !== 'ar,de,en,fr') throw new Error(name + ' has ' + table + ' in ' + held + ', not in all four languages');
}
`;

// CommonJS: require() every package that ships CommonJS.
writeFileSync(
  join(SMOKE, 'require.cjs'),
  `const expect = ${JSON.stringify(EXPECT)};
for (const name of ${JSON.stringify(names.filter((n) => !esmOnly.has(n)))}) {
  const mod = require(name);
  for (const key of expect[name]) if (mod[key] === undefined) throw new Error(name + ' (require) has no ' + key);
}
${languagesCheck('require(name)')}const schema = require('@fieldia/core/page.schema.json');
if (!schema.$schema) throw new Error('@fieldia/core/page.schema.json is not a JSON Schema');
`
);
run('node', ['require.cjs'], SMOKE);

// ES modules: import every package; Angular's partial declarations link through the JIT compiler here.
writeFileSync(
  join(SMOKE, 'import.mjs'),
  `import '@angular/compiler';
const expect = ${JSON.stringify(EXPECT)};
for (const name of ${JSON.stringify(names)}) {
  const mod = await import(name);
  for (const key of expect[name]) if (mod[key] === undefined) throw new Error(name + ' (import) has no ' + key);
}
${languagesCheck('await import(name)')}`
);
run('node', ['import.mjs'], SMOKE);

// What the code editors load only when a page asks (a language's grammar, Monaco and its parts): each
// resolves where the packages are installed. A name mistyped would fail only on that language's first use.
writeFileSync(
  join(SMOKE, 'lazy.mjs'),
  `import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const found = new Set();
for (const name of ['code', 'monaco']) {
  const dir = 'node_modules/@fieldia/' + name + '/src/lib';
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
    for (const [, specifier] of readFileSync(dir + '/' + file, 'utf8').matchAll(/import\\(['"]([^'".][^'"]*)['"]\\)/g)) found.add(specifier);
  }
}
if (found.size < 100) throw new Error('only ' + found.size + ' modules loaded on demand were found in @fieldia/code and @fieldia/monaco');
// Resolved by the import conditions a bundler uses, to a file that is there.
const missing = [...found].filter((specifier) => {
  try {
    return !existsSync(fileURLToPath(import.meta.resolve(specifier)));
  } catch {
    return true;
  }
});
if (missing.length) throw new Error('these modules loaded on demand do not resolve: ' + missing.join(', '));
console.log(found.size);
`
);
const lazy = run('node', ['lazy.mjs'], SMOKE).trim();
console.log(`  the code editors' ${lazy} modules loaded on demand all resolve`);

// The parts the packages load the first time a page uses them (a work item's head, its text, a path picker, Fieldia's
// own list, a filter bar, Fieldia's own date box and its calendar, a list screen, a list's cards, the columns a person shapes, a list's Import, a table of lines, the business widgets, files, the survey kinds, a phone read the world over, booking slots, possible duplicates, the answers said in a page's words and its endings, a page's limits and Continue later, a survey's flow, a page on paper, a link to other records, the themes, the quiet look, a Discussion, a History): each import('./x') of the ES modules, and each require('./x') of CommonJS, is a file
// that is there — and each loads, and gives what is asked of it, as an app's bundler would load it.
const PARTS = {
  core: { 'expression/functions-part': ['functionBody', 'appCall'], 'record/limits-part': ['formLimits', 'takingWords'], 'format/options-part': ['optionRules'], 'record/surveyflow-part': ['quizResults', 'surveyKit'] },
  widgets: { 'text-part': ['modernHtml', 'formattedText', 'linksWidget', 'markdownToHtml'], 'path-part': ['pathPickerWidget'], 'choice-part': ['ownListWidget', 'searchWidget', 'choiceTagsWidget'], 'date-part': ['dateBox', 'dateBoxWidget', 'withCalendar', 'dateRangeWidget'], 'themes-part': ['installThemeStyles'], 'quiet-part': ['installQuietStyles'], 'lines-part': ['linesWidget', 'linksTableWidget', 'cardsWidget'], 'survey-part': ['rankingWidget', 'matrixWidget', 'sliderWidget', 'progressbarWidget'] , 'business-part': ['statusbarWidget', 'copyWidget', 'timerWidget'], 'files-part': ['binaryWidget', 'readFile'], 'phone-part': ['phoneWidget', 'readPhone', 'writePhone'], 'slots-part': ['slotsWidget'], 'relations-part': ['many2oneWidget', 'tagsWidget', 'charTagsWidget'] },
  viewer: { 'head-part': ['recordHead', 'richButton', 'sectionHeading', 'wireMaximise'], 'filters-part': ['filterBar'], 'list-part': ['listView', 'relatedList'], 'cards-part': ['drawCard'], 'columns-part': ['columnChoices'], 'import-part': ['openImport'], 'duplicates-part': ['watchDuplicates', 'openMergeScreen'], 'answers-part': ['sentenceValue', 'wordedWidget', 'drawEnding'], 'limits-part': ['drawLimits'], 'print-part': ['printLook', 'printPage', 'printAlone'], 'surveyflow-part': ['surveyFlow', 'showQuiz'] },
  calendar: { 'calendar-view': ['calendarPart'] },
  chatter: { discussion: ['mountDiscussion'], history: ['mountHistory'] },
};
writeFileSync(
  join(SMOKE, 'parts.mjs'),
  `import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const expected = ${JSON.stringify(PARTS)};
let count = 0;
for (const [name, parts] of Object.entries(expected)) {
  const dir = 'node_modules/@fieldia/' + name + '/src/lib';
  const found = { mjs: new Set(), js: new Set() };
  // Its modules and those in folders below (@fieldia/core's form keeps its parts beside the modules that ask for them).
  const files = (at) => readdirSync(join(dir, at), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(at, entry.name)) : [join(at, entry.name)]));
  for (const file of files('')) {
    const kind = file.endsWith('.mjs') ? 'mjs' : file.endsWith('.js') ? 'js' : null;
    if (!kind) continue;
    const code = readFileSync(join(dir, file), 'utf8');
    const asked = kind === 'mjs' ? code.matchAll(/\\bimport\\((['"])(\\.[^'"]+)\\1\\)/g) : code.matchAll(/then\\(\\(\\) => require\\((['"])(\\.[^'"]+)\\1\\)\\)/g);
    for (const [, , specifier] of asked) {
      const target = join(dir, dirname(file), specifier);
      const there = kind === 'mjs' ? existsSync(target) : (() => { try { return !!createRequire(join(process.cwd(), dir, file)).resolve(specifier); } catch { return false; } })();
      if (!there) throw new Error('@fieldia/' + name + ': ' + file + ' loads ' + specifier + ', which is not there');
      found[kind].add(join(dirname(file), specifier).replace(/\\.mjs$/, ''));
      count++;
    }
  }
  for (const [part, gives] of Object.entries(parts)) {
    for (const kind of ['mjs', 'js']) if (!found[kind].has(part)) throw new Error('@fieldia/' + name + ' (' + kind + ') does not load ' + part + ' on demand');
    const esm = await import(pathToFileURL(join(process.cwd(), dir, part + '.mjs')).href);
    const cjs = createRequire(join(process.cwd(), dir, 'x.js'))('./' + part);
    for (const [kind, loaded] of [['import', esm], ['require', cjs]]) {
      const missing = gives.filter((one) => typeof loaded[one] !== 'function');
      if (missing.length) throw new Error('@fieldia/' + name + '/' + part + ' (' + kind + ') gives no ' + missing.join(', '));
    }
  }
}
console.log(count);
`
);
const partsLoaded = run('node', ['parts.mjs'], SMOKE).trim();
console.log(`  the parts loaded on first use: ${partsLoaded} imports of them resolve, and each part loads`);

// Types, both ways a project resolves them: an .mts file reads the ESM types, a .cts file the CommonJS ones.
writeFileSync(
  join(SMOKE, 'types.mts'),
  `import { createForm, createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import { createMonacoWidgets, monacoWidgets, type MonacoLoader } from '@fieldia/monaco';
import { mapKinds, mapListViews, mapWidgets, openStreetMap } from '@fieldia/map';
import { calendarListViews, type CalendarSettings } from '@fieldia/calendar';
import { chatterSlot, createMemoryChatter, type ChatterSource } from '@fieldia/chatter';
import type { FieldiaFormProps } from '@fieldia/react';
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor, type Designer } from '@fieldia/designer';
declare const page: Page;
declare const host: HTMLElement;
const form = createForm({ page, dataSource: createMemoryDataSource() });
const source: ChatterSource = createMemoryChatter({ me: { id: 1, name: 'Sara' } });
const calendarSettings: CalendarSettings = { now: () => new Date(), limit: 200 };
const viewer: ViewerHandle = mountViewer(host, { page, form, skin: 'outlined', widgets: { ...gridWidgets, ...codeWidgets, ...monacoWidgets, ...mapWidgets({ provider: openStreetMap() }) }, listViews: { ...mapListViews({ provider: openStreetMap() }), ...calendarListViews(calendarSettings) }, onNewRecord: () => undefined, slots: { chatter: chatterSlot({ source }) } });
declare const loader: MonacoLoader;
const withWorkers = createMonacoWidgets({ getWorker: (_id, label) => new Worker(label + '.js', { type: 'module' }), loader });
const props: FieldiaFormProps = { page, skin: 'underline' };
const designer: Designer = createDesigner({ page: blankPage('screen', 'Site visit'), store: createMemoryPageStore(), kinds: mapKinds({ locale: 'ar' }) });
mountScreenEditor(host, { designer });
export { viewer, props, designer, withWorkers };
`
);
writeFileSync(
  join(SMOKE, 'types.cts'),
  `import { validatePage } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
const checked = validatePage({});
export const ok: boolean = checked.ok && typeof mountViewer === 'function';
`
);
writeFileSync(
  join(SMOKE, 'tsconfig.json'),
  JSON.stringify({ compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'es2022', lib: ['es2022', 'dom'], strict: true, noEmit: true, skipLibCheck: false, types: [] }, files: ['types.mts', 'types.cts'] }, null, 2)
);
try {
  run(join(WORKSPACE, 'node_modules/.bin/tsc'), ['-p', join(SMOKE, 'tsconfig.json')], SMOKE);
} catch (error) {
  fail(`the packed types do not check in an empty project:\n${error.stdout}${error.stderr}`);
}

// The script bundle: on its own, it defines the global.
const bundle = join(SMOKE, 'node_modules/@fieldia/viewer/bundle/fieldia.js');
if (!existsSync(bundle)) fail('@fieldia/viewer has no bundle/fieldia.js');
const sandbox = {};
runInNewContext(readFileSync(bundle, 'utf8'), sandbox);
if (typeof sandbox.Fieldia?.mountViewer !== 'function' || sandbox.Fieldia.VERSION !== version) fail('the packed script bundle does not define Fieldia.mountViewer at this version');
// Each language's add-on beside it: after the main script, Fieldia has that language's words.
for (const locale of ['ar', 'de', 'fr']) {
  const addOn = join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${locale}.js`);
  if (!existsSync(addOn)) fail(`@fieldia/viewer has no bundle/fieldia.${locale}.js`);
  const page = {};
  for (const file of [bundle, addOn]) runInNewContext(readFileSync(file, 'utf8'), page);
  if (page.Fieldia.MESSAGES[locale]?.locale !== locale || !page.Fieldia.VIEWER_LABELS[locale] || !page.Fieldia.WIDGET_LABELS[locale]) fail(`the packed fieldia.${locale}.js does not give the script bundle its words`);
}
// Each part beside it: after the main script, Fieldia draws from it (the main script asks for it from beside itself) —
// booking slots with the date part, which they come with.
for (const [part, holder, gives, beside = []] of [['head', 'headPart', 'recordHead'], ['text', 'textPart', 'modernHtml'], ['path', 'pathPart', 'pathPickerWidget'], ['choice', 'choicePart', 'ownListWidget'], ['filters', 'filtersPart', 'filterBar'], ['date', 'datePart', 'dateBoxWidget'], ['list', 'listPart', 'listView'], ['cards', 'cardsPart', 'drawCard'], ['columns', 'columnsPart', 'columnChoices'], ['import', 'importPart', 'openImport'], ['themes', 'themesPart', 'installThemeStyles'], ['quiet', 'quietPart', 'installQuietStyles'], ['lines', 'linesPart', 'linesWidget'], ['files', 'filesPart', 'binaryWidget'], ['evidence', 'evidencePart', 'signingFor'], ['survey', 'surveyPart', 'rankingWidget'], ['business', 'businessPart', 'statusbarWidget'], ['phone', 'phonePart', 'phoneWidget'], ['slots', 'slotsPart', 'slotsWidget', ['date']], ['duplicates', 'duplicatesPart', 'watchDuplicates'], ['answers', 'answersPart', 'drawEnding'], ['limits', 'limitsPart', 'drawLimits'], ['print', 'printPart', 'printLook'], ['relations', 'relationsPart', 'many2oneWidget'], ['memory', 'memoryPart', 'memorySource'], ['functions', 'functionsPart', 'functionBody'], ['options', 'optionRulesPart', 'optionRules'], ['mapchecks', 'mapChecksPart', 'checkMap'], ['surveyflow', 'surveyFlowPart', 'surveyFlow']]) {
  const file = join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${part}.js`);
  if (!existsSync(file)) fail(`@fieldia/viewer has no bundle/fieldia.${part}.js`);
  const page = {};
  for (const one of [bundle, ...beside.map((other) => join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${other}.js`)), file]) runInNewContext(readFileSync(one, 'utf8'), page);
  const given = await runInNewContext(`Fieldia.${holder}.load()`, page);
  if (typeof given?.[gives] !== 'function') fail(`the packed fieldia.${part}.js does not give the script bundle its part`);
}
// The phone part's table is derived from libphonenumber's metadata (Apache-2.0): its notice ships with the package whose
// source carries the table, and beside the bundle, whose phone part names it in its first line.
for (const notice of ['@fieldia/widgets/THIRD_PARTY_NOTICES.md', '@fieldia/viewer/bundle/THIRD_PARTY_NOTICES.md']) {
  const file = join(SMOKE, 'node_modules', notice);
  if (!existsSync(file) || !/libphonenumber/.test(readFileSync(file, 'utf8')) || !/Apache License, Version 2\.0/.test(readFileSync(file, 'utf8'))) fail(`${notice} is not packed, or does not name libphonenumber and its licence`);
}
if (!readFileSync(join(SMOKE, 'node_modules/@fieldia/viewer/bundle/fieldia.phone.js'), 'utf8').split('\n')[0].includes('THIRD_PARTY_NOTICES.md')) fail('the packed fieldia.phone.js does not name its third-party notice');

console.log(`  installed ${fromRegistry ? 'from npm' : 'the packs'} into an empty project: require, import, types (.mts and .cts), the script bundle, its language add-ons and its parts all check`);

// ---- publish ---------------------------------------------------------------------
if (mode === 'publish') {
  if (!process.env.NPM_TOKEN) fail('publishing needs NPM_TOKEN in the environment');
  const npmrc = join(WORK, '.npmrc');
  // A reference, expanded by npm from the environment; the token itself is never written.
  writeFileSync(npmrc, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');
  const env = { ...process.env, npm_config_userconfig: npmrc };
  const onNpm = (name) => {
    try {
      return run('npm', ['view', `${name}@${version}`, 'version'], WORKSPACE, env).trim() === version;
    } catch {
      return false; // npm answers 404 for a version it does not have
    }
  };
  for (const [i, { manifest }] of packages.entries()) {
    if (onNpm(manifest.name)) {
      console.log(`  ${manifest.name}@${version} is already on npm`);
      continue;
    }
    run('npm', ['publish', tarballs[i], '--access', 'public'], WORKSPACE, env);
    console.log(`  published ${manifest.name}@${version}`);
  }
  rmSync(npmrc, { force: true });
  // The notes, and the tag and GitHub release to make from them: printed, never run.
  printRelease(WORKSPACE, version, run('git', ['rev-parse', '--short=12', 'HEAD']).trim());
}
