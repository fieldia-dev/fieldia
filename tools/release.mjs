/**
 * Release Fieldia's packages — and prove them first, the way someone else
 * would meet them: packed, installed into an empty project, imported.
 *
 *   node tools/release.mjs check              pack every package, install the packs into
 *                                             an empty project, require/import/type-check them
 *   NPM_TOKEN=… node tools/release.mjs publish  the same check, then publish what is not on npm yet
 *   node tools/release.mjs verify             after publishing: the same checks on what npm serves
 *
 * Every mode refuses a version with no section in CHANGELOG.md. `publish` refuses, before anything is checked, a
 * release that is not a commit tagged with its version, already on origin/main, from a tree with no changes, or a
 * patch whose section has an Upgrading part, or a minor that changes what was not deprecated a minor before
 * (release-guards.mjs, release-train.mjs; `check` says these two); and a page format whose shape
 * changed under its old version (format-shape.mjs; `check` only says so). It publishes the packs `check` proved
 * (release-publish.mjs: each against the hash it was packed with, in order, stopping where one fails), and once every
 * one is on npm it prints the version's section and the commands that push its tag and make its GitHub release, for a
 * person to run (see release-notes.mjs).
 *
 * `check` leaves the packs in tmp/release/packs with packs.json, their order and hashes: what the publish workflow
 * (.github/workflows/publish.yml) publishes from CI by npm's trusted publishing, with no token (tools/publish-packs.mjs).
 * This mode's own `publish`, with a token, is for a maintainer's machine until npm is switched over
 * (docs/maintainers/publishing.md).
 *
 * Build first: `npx nx run-many -t build`. A package marked `"private": true`
 * is never packed or published.
 *
 * The token is read from the environment and written only into a throwaway
 * npmrc under tmp/, as a reference npm expands itself — never into a command
 * line, where any process listing would show it. And it is given to `npm
 * publish` alone: every check — the install of the packs and their peers,
 * node and tsc run over them — runs without it (release-env.mjs), and the
 * install runs no package's install scripts (`--ignore-scripts`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { notesFor, printRelease } from './release-notes.mjs';
import { checkFormatShape } from './format-shape.mjs';
import { withoutAuth } from './release-env.mjs';
import { gitFacts, machinePathIn, patchProblem, releaseProblems } from './release-guards.mjs';
import { readDeprecations, trainProblems } from './release-train.mjs';
import { publishPacks, readPacks, writePacks } from './release-publish.mjs';
import { auditProblems } from './release-audit.mjs';
import { hashesOf, recordReleased, tagProblems, writeReadmes } from './script-tags.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const WORK = join(WORKSPACE, 'tmp/release');
const PACKS = join(WORK, 'packs');
const SMOKE = join(WORK, 'smoke');
const mode = process.argv[2] ?? 'check';
if (!['check', 'publish', 'verify'].includes(mode)) throw new Error(`usage: node tools/release.mjs check|publish|verify (got "${mode}")`);
/** verify installs what npm serves, so it needs no build and packs nothing. */
const fromRegistry = mode === 'verify';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
/** The environment every check runs in: no npm token, nor any npm setting that carries one (release-env.mjs). */
const CHECKS_ENV = withoutAuth(process.env);
const run = (cmd, args, cwd = WORKSPACE, env = CHECKS_ENV) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fail = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};

// ---- which packages, in what order --------------------------------------------
/** Dependencies before dependants, so a publish never points at a version npm does not have yet. */
const ORDER = ['core', 'widgets', 'viewer', 'grid', 'code', 'monaco', 'map', 'calendar', 'gantt', 'chatter', 'react', 'vue', 'angular', 'designer', 'testing'];
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
const changelog = readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8');
if (!notesFor(changelog, version)) fail(`CHANGELOG.md has no section for ${version}: write what changed, in plain words, before releasing it`);
// What a release must be before it is published (release-guards.mjs), refused before minutes of checks; a patch's
// Upgrading part, and a minor's changes not deprecated a minor before (release-train.mjs), said on every check, while
// the release's commit is written.
const deprecations = await readDeprecations(WORKSPACE);
if (mode === 'publish') {
  if (!process.env.NPM_TOKEN) fail('publishing needs NPM_TOKEN in the environment');
  const problems = releaseProblems({ version, changelog, facts: gitFacts(WORKSPACE), deprecations });
  if (problems.length) fail(`nothing was published:\n  ${problems.join('\n  ')}`);
} else if (mode === 'check') {
  const patch = patchProblem(version, changelog);
  if (patch) console.warn(`release: before publishing, ${patch}`);
  for (const problem of trainProblems({ version, changelog, deprecations })) console.warn(`release: before publishing, ${problem}`);
}
// A page this release writes says a format version: one whose shape older readers know (format-shape.mjs). Said on
// every check, while lanes add to the format; refused at publish, where the version has to be right.
const format = checkFormatShape(WORKSPACE);
if (!format.ok && mode === 'publish') fail(format.message);
if (!format.ok) console.warn(`release: before publishing, ${format.message}`);
console.log(`release ${version}: ${packages.map((p) => p.manifest.name).join(', ')}`);

// ---- pack ----------------------------------------------------------------------
rmSync(WORK, { recursive: true, force: true });
mkdirSync(PACKS, { recursive: true });
const packs = [];
const tarballs = packages.map(({ dir, manifest }) => {
  if (fromRegistry) return `${manifest.name}@${version}`;
  const [packed] = JSON.parse(run('npm', ['pack', join(WORKSPACE, 'dist/libs', dir), '--pack-destination', PACKS, '--json']));
  const files = packed.files.map((f) => f.path);
  const stray = files.filter((f) => /\.spec\.|\.tsbuildinfo$|(^|\/)tmp\//.test(f));
  if (stray.length) fail(`${packed.name} would ship ${stray.join(', ')}`);
  // Relative paths alone: no file names a path on the machine it was built on (a source map's sources, an import).
  for (const file of files) {
    const path = machinePathIn(readFileSync(join(WORKSPACE, 'dist/libs', dir, file), 'utf8'));
    if (path) fail(`${packed.name} would ship ${file}, which names ${path}, a path on the machine it was built on: write it relative to the workspace`);
  }
  console.log(`  packed ${packed.filename} (${files.length} files, ${Math.round(packed.size / 1024)} KB)`);
  packs.push({ name: packed.name, file: packed.filename, integrity: packed.integrity });
  return join(PACKS, packed.filename);
});
// The packs in their publishing order, with the hash each was packed with and the commit they were made from: what a
// publish takes, here or in the publish workflow (release-publish.mjs), and checks each tarball against.
if (!fromRegistry) writePacks(PACKS, { version, commit: run('git', ['rev-parse', 'HEAD']).trim(), packs });

// ---- install into an empty project -------------------------------------------------
const root = read(join(WORKSPACE, 'package.json'));
const pin = (name) => `${name}@${(root.dependencies ?? {})[name] ?? root.devDependencies[name]}`.replace(/@[~^]/, '@');
mkdirSync(SMOKE, { recursive: true });
const peers = ['react', 'react-dom', '@types/react', 'vue', '@angular/core', '@angular/compiler', 'rxjs', 'ag-grid-community', '@playwright/test', '@types/node'].map(pin);
/** `name@version` as a package.json has it: [name, version]. */
const nameAndVersion = (pinned) => [pinned.slice(0, pinned.lastIndexOf('@')), pinned.slice(pinned.lastIndexOf('@') + 1)];
writeFileSync(
  join(SMOKE, 'package.json'),
  JSON.stringify(
    {
      name: 'fieldia-smoke',
      private: true,
      version: '0.0.0',
      // What an app installs: the packs (or, verifying, the version on npm), with their dependencies — audited below.
      dependencies: Object.fromEntries(packages.map(({ manifest }, i) => [manifest.name, fromRegistry ? version : `file:${tarballs[i]}`])),
      // What an app brings itself, the packages' peers: installed to check them against, not audited as Fieldia's.
      devDependencies: Object.fromEntries(peers.map(nameAndVersion)),
    },
    null,
    2
  )
);
// No package's install scripts run: what is installed is only read, imported and type-checked.
run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error'], SMOKE);
for (const { manifest } of packages) {
  const installed = read(join(SMOKE, 'node_modules', manifest.name, 'package.json')).version;
  if (installed !== version) fail(`${manifest.name} installed as ${installed}, not ${version}`);
}
// npm's advisories for what an app installs with Fieldia, as each range resolves today (release-audit.mjs): high and
// critical refuse the release, unless reviewed and allowed for a time in tools/audit-allowed.json.
{
  let report;
  try {
    report = run('npm', ['audit', '--omit=dev', '--json'], SMOKE);
  } catch (error) {
    report = error.stdout; // npm audit fails when it finds any advisory: its report is still written
  }
  let parsed;
  try {
    parsed = JSON.parse(report);
  } catch {
    fail(`npm audit gave no report for what an app installs: ${String(report).slice(0, 400)}`);
  }
  if (parsed.error) fail(`npm audit could not be run for what an app installs: ${parsed.error.summary ?? JSON.stringify(parsed.error)}`);
  const allowed = read(join(WORKSPACE, 'tools/audit-allowed.json'));
  const problems = auditProblems(parsed, allowed, new Date().toISOString().slice(0, 10));
  if (problems.length) fail(`npm audit finds what an app installs with Fieldia vulnerable:\n  ${problems.join('\n  ')}\nUpgrade the dependency, or review the advisory and allow it until a date in tools/audit-allowed.json, saying why it cannot reach an app.`);
  const counts = parsed.metadata?.vulnerabilities ?? {};
  console.log(`  npm audit of what an app installs (${parsed.metadata?.dependencies?.prod ?? '?'} packages): no high or critical advisory${allowed.length ? ` beyond the ${allowed.length} reviewed in tools/audit-allowed.json` : ''} (${['critical', 'high', 'moderate', 'low'].map((level) => `${counts[level] ?? 0} ${level}`).join(', ')})`);
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
  '@fieldia/gantt': ['ganttListViews'],
  '@fieldia/chatter': ['mountChatter', 'chatterSlot', 'createMemoryChatter', 'CHATTER_LABELS'],
  '@fieldia/react': ['FieldiaForm', 'useFormState'],
  '@fieldia/vue': ['FieldiaForm', 'useFormState'],
  '@fieldia/angular': ['FieldiaFormComponent', 'FieldiaSlotDirective', 'formState'],
  '@fieldia/designer': ['createDesigner', 'blankPage', 'createMemoryPageStore', 'mountScreenEditor', 'mountSurveyEditor'],
  '@fieldia/testing': ['fieldia', 'matchFields', 'readField', 'labelsOf'],
};
/** A package's other entries, by name, and what each must export. */
const SUBPATHS = { '@fieldia/testing/playwright': ['fieldia'], '@fieldia/testing/pages': ['checkPageFiles', 'pageFiles', 'resultLines', 'runCheck'], '@fieldia/viewer/server': ['firstPaint', 'firstPaintStyles'], '@fieldia/core/schema': ['validatePage', 'PageSchema', 'FieldSchema'] };
const names = packages.map((p) => p.manifest.name);
const esmOnly = new Set(['@fieldia/angular']);
// English in the packages with no extra import, and every other language — Arabic, German and French (0.35), Turkish,
// Persian, Urdu and Spanish — each in a chunk of its own, fetched once asked for (@fieldia/core's wordsReady); the script
// bundle leaves them to add-ons.
const languagesCheck = (load) => `for (const [name, table] of [['@fieldia/core', 'MESSAGES'], ['@fieldia/widgets', 'WIDGET_LABELS'], ['@fieldia/viewer', 'VIEWER_LABELS']]) {
  const held = Object.keys((${load})[table]).sort().join(',');
  if (held !== 'en') throw new Error(name + ' has ' + table + ' in ' + held + ', not English alone');
}
Promise.all(['ar', 'de', 'fr', 'tr', 'fa', 'ur', 'es'].map(async (locale) => (${load.replace('name', "'@fieldia/core'")}).wordsReady(locale))).then(async () => {
  for (const [name, table] of [['@fieldia/core', 'MESSAGES'], ['@fieldia/widgets', 'WIDGET_LABELS'], ['@fieldia/viewer', 'VIEWER_LABELS']]) {
    const held = Object.keys((${load})[table]).sort().join(',');
    if (held !== 'ar,de,en,es,fa,fr,tr,ur') throw new Error(name + ' has ' + table + ' in ' + held + ' once its chunks came, not all eight languages');
  }
}).catch((error) => { console.error(error); process.exitCode = 1; });
`;

// CommonJS: require() every package that ships CommonJS.
writeFileSync(
  join(SMOKE, 'require.cjs'),
  `const expect = ${JSON.stringify(EXPECT)};
for (const name of ${JSON.stringify(names.filter((n) => !esmOnly.has(n)))}) {
  const mod = require(name);
  for (const key of expect[name]) if (mod[key] === undefined) throw new Error(name + ' (require) has no ' + key);
}
for (const [name, keys] of Object.entries(${JSON.stringify(SUBPATHS)})) {
  const mod = require(name);
  for (const key of keys) if (mod[key] === undefined) throw new Error(name + ' (require) has no ' + key);
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
for (const [name, keys] of Object.entries(${JSON.stringify(SUBPATHS)})) {
  const mod = await import(name);
  for (const key of keys) if (mod[key] === undefined) throw new Error(name + ' (import) has no ' + key);
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
// own list, a filter bar, Fieldia's own date box and its calendar, a month alone, a year alone and the Hijri calendar, a mask and a one-time code, a list screen, a list's cards, the columns a person shapes, a list's Import, a list's cells changed in place, a list's views kept on the app's server, a list's rows a person works in, a list's timeline, a table of lines, the business widgets, files, the survey kinds, a phone read the world over, booking slots, possible duplicates, the answers said in a page's words and its endings, a page's limits and Continue later, AI help, a record's approvals, a survey's flow, the fields a page's link fills, an email or a phone proved by a code, a payment the answers wait for, what <fieldia-form> does, sends kept without signal, a voice note or a video recorded, a QR code or a barcode, pins on a picture, a repeat and a week's hours, a record's Undo, its templates, who else is here and the changes arriving live, a page on paper, a link to other records, a text in several languages, the themes, the quiet look, a Discussion, a History, a conversation's channels): each import('./x') of the ES modules, and each require('./x') of CommonJS, is a file
// that is there — and each loads, and gives what is asked of it, as an app's bundler would load it.
const PARTS = {
  core: { 'expression/functions-part': ['functionBody', 'appCall'], 'record/limits-part': ['formLimits', 'takingWords'], 'record/approvals-part': ['join', 'approvalWhen'], 'format/options-part': ['optionRules'], 'record/languages-part': ['checkTranslated', 'textIn'], 'record/files-part': ['pumpUploads', 'fileFromBytes'], 'record/surveyflow-part': ['quizResults', 'join'], 'record/prefill-part': ['join', 'linkValues', 'linkParams'], 'record/verify-part': ['join'], 'record/pay-part': ['join'], 'record/outbox-part': ['join', 'memoryOutbox'], 'record/live-part': ['join', 'liveRecord'], 'record/undo-part': ['offerUndo', 'takeStep'] },
  widgets: { 'text-part': ['modernHtml', 'formattedText', 'linksWidget', 'markdownToHtml'], 'path-part': ['pathPickerWidget', 'checkTreeWidget'], 'choice-part': ['ownListWidget', 'searchWidget', 'choiceTagsWidget'], 'date-part': ['dateBox', 'dateBoxWidget', 'withCalendar', 'dateRangeWidget'], 'months-part': ['grainBox', 'hijriBox', 'periodCalendar', 'readHijriText'], 'typed-part': ['maskWidget', 'codeWidget', 'conform'], 'themes-part': ['installThemeStyles'], 'quiet-part': ['installQuietStyles'], 'loading-part': ['installLoadingStyles', 'pageSkeleton', 'drawLoader'], 'lines-part': ['linesWidget', 'linksTableWidget', 'cardsWidget'], 'survey-part': ['rankingWidget', 'matrixWidget', 'sliderWidget', 'progressbarWidget'] , 'business-part': ['statusbarWidget', 'copyWidget', 'timerWidget'], 'files-part': ['binaryWidget', 'readFile'], 'phone-part': ['phoneWidget', 'readPhone', 'writePhone'], 'slots-part': ['slotsWidget'], 'relations-part': ['many2oneWidget', 'tagsWidget', 'charTagsWidget'], 'languages-part': ['languagesWidget', 'languageWords'], 'codes-part': ['codeWidget', 'qrCode', 'code128'], 'pins-part': ['pinsWidget'], 'record-part': ['openRecorder'], 'schedule-part': ['repeatWidget', 'hoursWidget'] },
  viewer: { 'head-part': ['recordHead', 'richButton', 'sectionHeading', 'wireMaximise'], 'filters-part': ['filterBar'], 'list-part': ['listView', 'relatedList'], 'cards-part': ['drawCard'], 'columns-part': ['columnChoices'], 'import-part': ['openImport'], 'editable-part': ['editableRows', 'rowReads'], 'views-part': ['savedViews'], 'rows-part': ['detailRows'], 'duplicates-part': ['watchDuplicates', 'openMergeScreen'], 'answers-part': ['sentenceValue', 'wordedWidget', 'drawEnding'], 'limits-part': ['drawLimits'], 'approvals-part': ['drawApprovals'], 'assist-part': ['watchAssist', 'searchWords'], 'verify-part': ['watchVerify'], 'pay-part': ['drawPay'], 'element-part': ['connect', 'actionSource'], 'outbox-part': ['watchOutbox'], 'print-part': ['printLook', 'printPage', 'printAlone'], 'surveyflow-part': ['surveyFlow', 'showQuiz'], 'live-part': ['presenceStrip'], 'undo-part': ['undoStep', 'undoToast'], 'templates-part': ['templatesMenu', 'startFrom'] },
  calendar: { 'calendar-view': ['calendarPart'] },
  gantt: { 'gantt-view': ['ganttPart'] },
  chatter: { discussion: ['mountDiscussion'], history: ['mountHistory'], channels: ['channelPicker', 'liveConversation', 'messageMark'] },
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
import { ganttListViews, type GanttSettings } from '@fieldia/gantt';
import { chatterSlot, createMemoryChatter, type ChatterSource } from '@fieldia/chatter';
import type { FieldiaFormProps } from '@fieldia/react';
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor, type Designer } from '@fieldia/designer';
import { fieldia } from '@fieldia/testing';
import { checkPageFiles, type PageCheckResult } from '@fieldia/testing/pages';
declare const page: Page;
declare const host: HTMLElement;
const form = createForm({ page, dataSource: createMemoryDataSource() });
const source: ChatterSource = createMemoryChatter({ me: { id: 1, name: 'Sara' } });
const calendarSettings: CalendarSettings = { now: () => new Date(), limit: 200 };
const ganttSettings: GanttSettings = { now: () => new Date(), labels: { en: { today: 'Now' } } };
const viewer: ViewerHandle = mountViewer(host, { page, form, skin: 'outlined', widgets: { ...gridWidgets, ...codeWidgets, ...monacoWidgets, ...mapWidgets({ provider: openStreetMap() }) }, listViews: { ...mapListViews({ provider: openStreetMap() }), ...calendarListViews(calendarSettings), ...ganttListViews(ganttSettings) }, onNewRecord: () => undefined, slots: { chatter: chatterSlot({ source }) } });
declare const loader: MonacoLoader;
const withWorkers = createMonacoWidgets({ getWorker: (_id, label) => new Worker(label + '.js', { type: 'module' }), loader });
const props: FieldiaFormProps = { page, skin: 'underline' };
const designer: Designer = createDesigner({ page: blankPage('screen', 'Site visit'), store: createMemoryPageStore(), kinds: mapKinds({ locale: 'ar' }) });
mountScreenEditor(host, { designer, nonce: 'r4nd0m' });
const errors: string[] = fieldia(host).errorsOf('Email');
const checked: PageCheckResult[] = checkPageFiles(['page.json']);
export { viewer, props, designer, withWorkers, errors, checked };
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
// @fieldia/testing's Playwright helpers, as a Playwright project checks them: Playwright's own types need Node's, whose
// own declarations (not ours) are left unchecked here.
writeFileSync(
  join(SMOKE, 'playwright.mts'),
  `import { test } from '@playwright/test';
import { fieldia, type FieldiaForm } from '@fieldia/testing/playwright';
test('a form', async ({ page }) => {
  const form: FieldiaForm = fieldia(page);
  await form.fill('Email', 'mona@example.com');
  const errors: string[] = await form.errorsOf('Email');
  if (errors.length) throw new Error(errors.join(' '));
});
`
);
writeFileSync(
  join(SMOKE, 'tsconfig.playwright.json'),
  JSON.stringify({ compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'es2022', lib: ['esnext', 'dom'], strict: true, noEmit: true, skipLibCheck: true, types: ['node'] }, files: ['playwright.mts'] }, null, 2)
);
try {
  run(join(WORKSPACE, 'node_modules/.bin/tsc'), ['-p', join(SMOKE, 'tsconfig.playwright.json')], SMOKE);
} catch (error) {
  fail(`@fieldia/testing/playwright's types do not check in a Playwright project:\n${error.stdout}${error.stderr}`);
}

// @fieldia/testing's command, as an app's CI runs it: a valid page passes, a broken one fails with its reason.
writeFileSync(join(SMOKE, 'good.page.json'), JSON.stringify({ fieldia: '0.1', id: 'p', data: { kind: 'responses' }, fields: { a: { type: 'char', label: 'A' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f', field: 'a' }] } }));
writeFileSync(join(SMOKE, 'bad.page.json'), JSON.stringify({ fieldia: '0.1', id: 'p', data: { kind: 'responses' }, fields: {}, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f', field: 'gone' }] } }));
const checkBin = join(SMOKE, 'node_modules/.bin/fieldia-check');
if (!run(checkBin, ['good.page.json'], SMOKE).includes('1 page checked: all valid.')) fail('fieldia-check does not pass a valid page');
try {
  run(checkBin, ['bad.page.json'], SMOKE);
  fail('fieldia-check passes a page that names a field it does not have');
} catch (error) {
  if (error.status !== 1 || !String(error.stdout).includes('gone')) fail(`fieldia-check does not say why a page is refused: ${error.stdout}${error.stderr}`);
}

// The script bundle: on its own, it defines the global.
const bundle = join(SMOKE, 'node_modules/@fieldia/viewer/bundle/fieldia.js');
if (!existsSync(bundle)) fail('@fieldia/viewer has no bundle/fieldia.js');
const sandbox = {};
runInNewContext(readFileSync(bundle, 'utf8'), sandbox);
if (typeof sandbox.Fieldia?.mountViewer !== 'function' || sandbox.Fieldia.VERSION !== version) fail('the packed script bundle does not define Fieldia.mountViewer at this version');
// Each language's add-on beside it: after the main script, Fieldia has that language's words.
for (const locale of ['ar', 'de', 'fr', 'tr', 'fa', 'ur', 'es']) {
  const addOn = join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${locale}.js`);
  if (!existsSync(addOn)) fail(`@fieldia/viewer has no bundle/fieldia.${locale}.js`);
  const page = {};
  for (const file of [bundle, addOn]) runInNewContext(readFileSync(file, 'utf8'), page);
  if (page.Fieldia.MESSAGES[locale]?.locale !== locale || !page.Fieldia.VIEWER_LABELS[locale] || !page.Fieldia.WIDGET_LABELS[locale]) fail(`the packed fieldia.${locale}.js does not give the script bundle its words`);
}
// Each part beside it: after the main script, Fieldia draws from it (the main script asks for it from beside itself) —
// booking slots with the date part, which they come with; the parts that join a form, by their name among its own.
for (const [part, holder, gives, beside = []] of [['head', 'headPart', 'recordHead'], ['text', 'textPart', 'modernHtml'], ['path', 'pathPart', 'pathPickerWidget'], ['choice', 'choicePart', 'ownListWidget'], ['filters', 'filtersPart', 'filterBar'], ['date', 'datePart', 'dateBoxWidget'], ['months', 'monthsPart', 'grainBox'], ['typed', 'typedPart', 'maskWidget'], ['list', 'listPart', 'listView'], ['cards', 'cardsPart', 'drawCard'], ['columns', 'columnsPart', 'columnChoices'], ['import', 'importPart', 'openImport'], ['views', 'viewsPart', 'savedViews'], ['rows', 'rowsPart', 'detailRows'], ['editable', 'editablePart', 'editableRows'], ['themes', 'themesPart', 'installThemeStyles'], ['quiet', 'quietPart', 'installQuietStyles'], ['loading', 'loadingPart', 'installLoadingStyles'], ['lines', 'linesPart', 'linesWidget'], ['files', 'filesPart', 'binaryWidget'], ['evidence', 'evidencePart', 'signingFor'], ['photos', 'photosPart', 'photosWidget', ['files']], ['record', 'recordPart', 'openRecorder'], ['codes', 'codesPart', 'codeWidget'], ['pins', 'pinsPart', 'pinsWidget'], ['survey', 'surveyPart', 'rankingWidget'], ['business', 'businessPart', 'statusbarWidget'], ['phone', 'phonePart', 'phoneWidget'], ['slots', 'slotsPart', 'slotsWidget', ['date']], ['schedule', 'schedulePart', 'repeatWidget', ['date']], ['templates', 'templatesPart', 'templatesMenu'], ['live', 'livePart', 'presenceStrip'], ['undo', 'pressUndoPart', 'offerUndo'], ['duplicates', 'duplicatesPart', 'watchDuplicates'], ['answers', 'answersPart', 'drawEnding'], ['limits', 'limitsPart', 'drawLimits'], ['approvals', 'approvalsPart', 'drawApprovals'], ['assist', 'assistPart', 'watchAssist'], ['verify', `formJoins().find((one) => one.name === 'verify')`, 'watchVerify'], ['pay', `formJoins().find((one) => one.name === 'pay')`, 'drawPay'], ['element', 'elementPart', 'connect'], ['outbox', `formJoins().find((one) => one.name === 'outbox')`, 'watchOutbox'], ['print', 'printPart', 'printLook'], ['relations', 'relationsPart', 'many2oneWidget'], ['memory', 'memoryPart', 'memorySource'], ['functions', 'functionsPart', 'functionBody'], ['options', 'optionRulesPart', 'optionRules'], ['mapchecks', 'mapChecksPart', 'checkMap'], ['languages', 'languagesPart', 'languagesWidget'], ['scan', 'scanPart', 'scanning'], ['decode', 'decodePart', 'codeReader'], ['surveyflow', 'surveyFlowPart', 'surveyFlow'], ['prefill', `formJoins().find((one) => one.name === 'prefill')`, 'linkValues']]) {
  const file = join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${part}.js`);
  if (!existsSync(file)) fail(`@fieldia/viewer has no bundle/fieldia.${part}.js`);
  const page = {};
  for (const one of [bundle, ...beside.map((other) => join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${other}.js`)), file]) runInNewContext(readFileSync(one, 'utf8'), page);
  const given = await runInNewContext(`Fieldia.${holder}.load()`, page);
  if (typeof given?.[gives] !== 'function') fail(`the packed fieldia.${part}.js does not give the script bundle its part`);
}
// The phone part's table is derived from libphonenumber's metadata (Apache-2.0), and the decode part carries ZXing's
// readers (@zxing/library, Apache-2.0): their notices ship with the package whose source carries or imports them, and
// beside the bundle, whose phone and decode parts name it in their first line.
for (const notice of ['@fieldia/widgets/THIRD_PARTY_NOTICES.md', '@fieldia/viewer/bundle/THIRD_PARTY_NOTICES.md']) {
  const file = join(SMOKE, 'node_modules', notice);
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!/libphonenumber/.test(text) || !/@zxing\/library/.test(text) || !/Apache License, Version 2\.0/.test(text)) fail(`${notice} is not packed, or does not name libphonenumber, @zxing/library and their licence`);
}
for (const part of ['phone', 'decode']) {
  if (!readFileSync(join(SMOKE, `node_modules/@fieldia/viewer/bundle/fieldia.${part}.js`), 'utf8').split('\n')[0].includes('THIRD_PARTY_NOTICES.md')) fail(`the packed fieldia.${part}.js does not name its third-party notice`);
}
// `@fieldia/core/schema`'s ESM file carries zod (MIT) inside (tools/dual-build.mjs, OWN_FILE): its notice ships with core,
// and the file names it in its first line.
{
  const notice = join(SMOKE, 'node_modules/@fieldia/core/THIRD_PARTY_NOTICES.md');
  if (!(existsSync(notice) && /zod/.test(readFileSync(notice, 'utf8')) && /MIT License/.test(readFileSync(notice, 'utf8')))) fail('@fieldia/core/THIRD_PARTY_NOTICES.md is not packed, or does not name zod and its licence');
  if (!readFileSync(join(SMOKE, 'node_modules/@fieldia/core/src/lib/format/schema-part.bundle.mjs'), 'utf8').split('\n')[0].includes('THIRD_PARTY_NOTICES.md')) fail("the packed @fieldia/core/schema does not name zod's notice");
}

// The README @fieldia/viewer ships: its script tags name this version, each with the hash of the file beside it in the
// package — what jsDelivr serves for it (tools/script-tags.mjs).
{
  const installed = join(SMOKE, 'node_modules/@fieldia/viewer');
  const readme = readFileSync(join(installed, 'README.md'), 'utf8');
  const shipped = { version, integrity: hashesOf(join(installed, 'bundle')) };
  const problems = tagProblems(readme, shipped);
  if (problems.length || !readme.includes(`@fieldia/viewer@${version}/bundle/fieldia.js`)) fail(`@fieldia/viewer's README does not give ${version}'s script tags, with the hashes of its files: ${problems.join('; ') || 'none names it'}`);
}

console.log(`  installed ${fromRegistry ? 'from npm' : 'the packs'} into an empty project: require, import, types (.mts and .cts), the script bundle, its language add-ons and its parts all check`);

// What npm serves, recorded for the docs: fieldia.dev's script tags and the repository's READMEs name this version
// from now, each with the hash of its file as npm serves it (tools/script-tags.mjs). Committed by a person.
if (fromRegistry) {
  recordReleased(WORKSPACE, version, join(SMOKE, 'node_modules/@fieldia/viewer/bundle'));
  const changed = writeReadmes(WORKSPACE);
  console.log(`  recorded ${version}'s scripts as npm serves them in tools/script-tags.json${changed.length ? `, and wrote the tags in ${changed.map((file) => file.replace(`${WORKSPACE}/`, '')).join(', ')}` : ''}: commit them, so fieldia.dev's and the READMEs' script tags name ${version}`);
}

// ---- publish ---------------------------------------------------------------------
if (mode === 'publish') {
  const npmrc = join(WORK, '.npmrc');
  // A reference, expanded by npm from the environment; the token itself is never written.
  writeFileSync(npmrc, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');
  // The packs the check above installed and ran, each against its hash; the token for `npm publish` alone.
  try {
    publishPacks({ dir: PACKS, manifest: readPacks(PACKS), env: CHECKS_ENV, token: { NPM_TOKEN: process.env.NPM_TOKEN, npm_config_userconfig: npmrc } });
  } catch (error) {
    rmSync(npmrc, { force: true });
    fail(error.message);
  }
  rmSync(npmrc, { force: true });
  // Every package on npm: the notes, and the tag's push and the GitHub release to make from them — printed, never run.
  printRelease(WORKSPACE, version, run('git', ['rev-parse', '--short=12', 'HEAD']).trim(), { tagged: true });
}
