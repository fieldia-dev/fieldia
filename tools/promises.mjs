/**
 * docs/promises.md, "What Fieldia promises", held to what holds each promise (the audit's S-I12, R-M10, R-M12): a page
 * of promises is only as true as the gates it names. Each check reads the page and the repository as they are:
 *
 * - every file the page names exists, and every test it quotes ("…" after a file) is in that file;
 * - every promise of its security and stability sections names a gate, or says it has none ("No gate");
 * - every number it gives is the one the code holds: the bounds, the deadline, the perf budgets, the first-load and
 *   script budgets, the slack; and every budget of the viewer's timings (`viewer…` in e2e/perf.spec.ts) is one it gives;
 * - its deprecations table is the list (`DEPRECATIONS`), entry for entry;
 * - its browsers are the ones CI runs: Playwright's engines and their versions, the smoke set, the jobs, the targets.
 *
 *   node tools/promises.mjs   say what on the page is not what the repository holds (exit 1), or that it all is
 *
 * tools/promises.test.mjs runs it on every pull request, and shows each check biting.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readDeprecations } from './release-train.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
export const PAGE = 'docs/promises.md';

const read = (workspace, file) => readFileSync(join(workspace, file), 'utf8');
/** A number as the page writes it: 32,767; 1,600; 0.5. */
const written = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const WORDS = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

/** One constant of a source file, by the pattern that finds it: its number, worked out where it is a product. */
function constant(workspace, file, pattern) {
  const match = pattern.exec(read(workspace, file));
  if (!match) throw new Error(`${file}: ${pattern} finds nothing — tools/promises.mjs reads it`);
  return Function(`return (${match[1].replace(/_/g, '')})`)();
}

/** A file's text as its tests' titles are read: an escaped quote as the quote it is. */
const titlesOf = (text) => text.replace(/\\(['"`])/g, '$1');

/** The page's tables: each a list of rows, each a list of its cells' words, the heading row first. */
export function tablesOf(doc) {
  const tables = [];
  let rows = null;
  for (const line of doc.split('\n')) {
    if (line.startsWith('|')) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      rows ??= [];
      rows.push(line.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim()));
    } else if (rows) {
      tables.push(rows);
      rows = null;
    }
  }
  if (rows) tables.push(rows);
  return tables;
}

/** The row of a table whose first cell is `start`, or else starts with it; or null. */
function rowOf(doc, start) {
  const rows = tablesOf(doc).flatMap((table) => table.slice(1));
  const first = (row) => row[0].replace(/`/g, '');
  return rows.find((row) => first(row) === start.replace(/`/g, '')) ?? rows.find((row) => first(row).startsWith(start.replace(/`/g, ''))) ?? null;
}

/** The page's sections: each heading (## or ###) with the lines under it, up to the next. */
function sectionsOf(doc) {
  const out = [];
  let top = '';
  for (const line of doc.split('\n')) {
    const heading = /^(##+) (.+)$/.exec(line);
    if (heading) {
      if (heading[1] === '##') top = heading[2];
      out.push({ top, heading: heading[2], lines: [] });
    } else out.at(-1)?.lines.push(line);
  }
  return out;
}

/** The list items of some lines, each joined into one line. */
function itemsOf(lines) {
  const items = [];
  let open = false;
  for (const line of lines) {
    if (line.startsWith('- ')) {
      items.push(line.slice(2));
      open = true;
    } else if (open && /^ {2,}\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
    else open = false;
  }
  return items;
}

const PATH = /`((?:libs|e2e|tools|docs|site|examples|demos|\.github)\/[\w./-]+\.(?:ts|mjs|json|md|yml))`/g;

/** Every file the page names exists; every test it quotes after a file is in it. */
export function gateProblems(doc, workspace = WORKSPACE) {
  const problems = [];
  const flat = doc.replace(/\s*\n\s*/g, ' ');
  for (const [, file] of flat.matchAll(PATH)) if (!existsSync(join(workspace, file))) problems.push(`${file} is named as a gate and is not in the repository`);
  for (const [, file, quoted] of flat.matchAll(/`([\w./-]+\.(?:ts|mjs))`\s*\(((?:"[^"]+"(?:,\s*)?)+)\)/g)) {
    if (!existsSync(join(workspace, file))) continue;
    const text = titlesOf(read(workspace, file));
    for (const [, words] of quoted.matchAll(/"([^"]+)"/g)) if (!text.includes(words)) problems.push(`${file} has no test "${words}"`);
  }
  return problems;
}

/** Every promise of the security and stability sections names a gate, or says it has none. */
export function namedProblems(doc) {
  const problems = [];
  for (const section of sectionsOf(doc)) {
    if (!/^(Security|Stability)/.test(section.top)) continue;
    for (const item of itemsOf(section.lines)) {
      PATH.lastIndex = 0;
      if (!PATH.test(item) && !/No gate/.test(item)) problems.push(`"${item.slice(0, 60)}…" (${section.heading}) names no gate, and does not say it has none`);
    }
  }
  // A table with a Gate column, anywhere on the page: a gate in every row.
  for (const rows of tablesOf(doc)) {
    const gate = rows[0].findIndex((cell) => cell === 'Gate');
    if (gate < 0) continue;
    for (const row of rows.slice(1)) {
      PATH.lastIndex = 0;
      if (!PATH.test(row[gate] ?? '')) problems.push(`"${row[0]}" names no gate`);
    }
  }
  return problems;
}

/** What the page must say, worked out from the code: [where, the words it must hold]. */
export function numbersHeld(workspace = WORKSPACE) {
  const c = (file, pattern) => constant(workspace, file, pattern);
  const computed = c('libs/core/src/lib/record/compute.ts', /export const COMPUTED_MOST = (\{[^}]+\})/);
  const unzipped = c('libs/viewer/src/lib/unzip.ts', /export const UNZIPPED_MOST = (\{[^}]+\})/);
  const MB = 1024 * 1024;
  // checkSubmission's most, unless the server says: `context.maxBytes ?? MB`.
  if (!/const most = context\.maxBytes \?\? MB;/.test(read(workspace, 'libs/core/src/lib/record/submission.ts'))) throw new Error('libs/core/src/lib/record/submission.ts: checkSubmission\'s most is no longer `context.maxBytes ?? MB` — tools/promises.mjs reads it');
  const submissionMost = c('libs/core/src/lib/record/submission.ts', /^const MB = ([\d\s*]+);/m);
  const perf = read(workspace, 'e2e/perf.spec.ts');
  const budget = Function(`return (${/const BUDGET = (\{[\s\S]*?\n\});/.exec(perf)[1].replace(/\/\*\*[\s\S]*?\*\//g, '')})`)();
  const cpu = Number(/phone\(\) \? (\d+) : 1/.exec(perf)[1]);
  const slack = Number(/FIELDIA_PERF_SLACK'\] \?\? \(process\.env\['CI'\] \? (\d+) : 1\)/.exec(perf)[1]);
  const scale = read(workspace, 'e2e/perf-scale.spec.ts');
  const scaled = (scenario, count) => {
    const line = scale.split('\n').find((one) => one.includes(`'${scenario}':`));
    if (!line) throw new Error(`e2e/perf-scale.spec.ts has no budget "${scenario}"`);
    const of = (profile) => Number(new RegExp(`${profile}: \\{[^}]*\\b${count}: (\\d+)`).exec(line)[1]);
    return [written(of('desktop')), written(of('phone'))];
  };
  const load = read(workspace, 'tools/npm-first-load.mjs');
  const first = (app) => {
    const match = new RegExp(`^  ${app}: \\{ page: ([\\d.]+), usable: ([\\d.]+)`, 'm').exec(load);
    return [`${Number(match[1]).toFixed(1)} KB`, `${Number(match[2]).toFixed(1)} KB`];
  };
  const ms = (n) => `${written(n)} ms`;
  return [
    ['the bounds: a pattern', 'A page\'s pattern', [`${written(c('libs/core/src/lib/format/pattern.ts', /export const PATTERN_MOST = ([\d_]+)/))} characters`]],
    ['the bounds: a date', 'Text read as a date', [`${written(c('libs/core/src/lib/record/input-rules.ts', /export const DATE_TEXT_MOST = ([\d_]+)/))} characters`]],
    ['the bounds: a value worked out', 'A value a page works out', [`${written(computed.text)} characters`, `${written(computed.items)} items`]],
    ['the bounds: an import', 'An imported file', [`${written(c('libs/viewer/src/lib/import-dialog.ts', /export const IMPORT_MOST = ([\d_]+)/))} rows`, `${written(c('libs/viewer/src/lib/import-file.ts', /export const CELL_MOST = ([\d_]+)/))} characters a cell`]],
    ['the bounds: an archive', 'A workbook\'s archive', [`${written(unzipped.entry / MB)} MB a file`, `${written(unzipped.total / MB)} MB in all`]],
    ['the bounds: checkSubmission', 'Answers `checkSubmission` reads', [`${written(submissionMost / MB)} MB`]],
    ['the deadline', null, [`(${written(c('libs/core/src/lib/record/deadline.ts', /export const SEND_TIMEOUT_MS = ([\d_]+)/) / 1000)} s unless the app says)`]],
    ['perf: a key', 'A key typed in a field a rule reads', [ms(budget.viewerKey), ms(budget.viewerKey * cpu)]],
    ['perf: a key\'s paint', 'A key\'s paint in a field nothing reads', [ms(budget.viewerKeyPaint), ms(budget.viewerKeyPaint * cpu)]],
    ['perf: a choice', 'A choice that shows or hides', [ms(budget.viewerClick), ms(budget.viewerClick * cpu)]],
    ['perf: a first paint', 'A viewer\'s first paint', [ms(budget.viewerMount), ms(budget.viewerMount * cpu)]],
    ['perf: the slack and the phone', null, [`${WORDS[slack]} times the budget's slack`, `the phone's budgets are ${WORDS[cpu]} times a desktop's`, `its CPU ${WORDS[cpu]} times slower`]],
    ['perf: a key\'s work', 'A key\'s work, 500 fields', scaled('the work of a key in a field a rule reads, 500 fields', 'updaters')],
    ['perf: 5,000 rows', 'A list of 5,000 rows', scaled('a list of 5,000 rows drawn', 'nodes')],
    ['perf: 200 lines', 'A key in the header of a 200-line table', scaled('a key in the header of a 200-line table', 'mutations')],
    ['perf: 500 tasks', 'A bar dropped, 500 tasks', scaled('a bar dropped, 500 tasks', 'added')],
    ['first load: a record form', 'A record form', first('record')],
    ['first load: a list', 'A list', first('list')],
    ['first load: the designer', 'The screen designer', first('designer')],
    ['the one-tag script', null, [`held to ${c('tools/script-bundle.mjs', /^const GZIP_BUDGET_KB = ([\d.]+);/m).toFixed(1)} KB gzipped`]],
    ['the whole check\'s part', null, [`(\`fieldia.check.js\`) to ${c('tools/script-bundle.mjs', /^const PART_BUDGET_KB = \{.*\bcheck: \[[\d.]+, ([\d.]+)\]/m).toFixed(1)} KB`]],
  ];
}

/** The viewer's timing budgets the page gives (`numbersHeld`): a new one is a promise the page has not made yet. */
export const VIEWER_BUDGETS_SAID = ['viewerKey', 'viewerKeyPaint', 'viewerClick', 'viewerMount'];

/** Every budget of the viewer's timings in e2e/perf.spec.ts is one the page gives. */
export function budgetsUnsaid(workspace = WORKSPACE) {
  const perf = read(workspace, 'e2e/perf.spec.ts');
  const budget = Function(`return (${/const BUDGET = (\{[\s\S]*?\n\});/.exec(perf)[1].replace(/\/\*\*[\s\S]*?\*\//g, '')})`)();
  return Object.keys(budget)
    .filter((name) => name.startsWith('viewer') && !VIEWER_BUDGETS_SAID.includes(name))
    .map((name) => `perf: e2e/perf.spec.ts budgets ${name} (${budget[name]} ms), which the page does not give (tools/promises.mjs, numbersHeld)`);
}

/** Every number the page gives is the one the code holds: each in its row of a table, or in the page's words. */
export function numberProblems(doc, workspace = WORKSPACE) {
  const problems = [...budgetsUnsaid(workspace)];
  const flat = doc.replace(/\s*\n\s*/g, ' ');
  for (const [what, row, words] of numbersHeld(workspace)) {
    const found = row ? rowOf(doc, row) : null;
    if (row && !found) {
      problems.push(`${what}: no row "${row}"`);
      continue;
    }
    const cells = found ? found.slice(1) : null;
    for (const one of words) {
      const said = cells ? cells.some((cell) => cell === one || cell.includes(one)) : flat.includes(one);
      if (!said) problems.push(`${what}: the code holds "${one}", which the page does not say${found ? ` (its row: ${found.slice(1).join(' | ')})` : ''}`);
    }
  }
  return problems;
}

/** The deprecations table is the list, entry for entry: its id, since, changesIn and who. */
export function deprecationProblems(doc, deprecations) {
  const problems = [];
  const table = tablesOf(doc).find((rows) => rows[0][0] === 'Id' && rows[0].includes('Changes in'));
  if (!table) return ['no table of deprecations (Id | Since | Changes in | Who | …)'];
  const rows = new Map(table.slice(1).map((row) => [row[0].replace(/`/g, ''), row]));
  for (const one of deprecations) {
    const row = rows.get(one.id);
    if (!row) problems.push(`${one.id} is deprecated (libs/core/src/lib/deprecations.ts) and not in the table`);
    else if (row[1] !== one.since || row[2] !== one.changesIn || row[3] !== one.who) problems.push(`${one.id}: the table says ${row.slice(1, 4).join(', ')}; the list ${one.since}, ${one.changesIn}, ${one.who}`);
  }
  for (const id of rows.keys()) if (!deprecations.some((one) => one.id === id)) problems.push(`${id} is in the table and not in the list`);
  return problems;
}

/** The browsers CI runs, read from the repository: Playwright's engines and versions, the smoke set, the jobs, the targets. */
export function browsersRun(workspace = WORKSPACE) {
  const require = (file) => JSON.parse(read(workspace, file));
  const engines = require('node_modules/playwright-core/browsers.json').browsers;
  const version = (name) => engines.find((one) => one.name === name).browserVersion;
  const config = read(workspace, 'playwright.config.ts');
  const smoke = /const SMOKE = \[([^\]]+)\]/.exec(config)[1].split(',').filter((name) => name.trim()).length;
  // A project's line in the config: Chromium's is one line.
  const project = (name) => config.split('\n').find((line) => line.includes(`{ name: '${name}',`)) ?? '';
  const ci = read(workspace, '.github/workflows/ci.yml');
  return {
    chromium: version('chromium').split('.')[0],
    firefox: version('firefox').split('.')[0],
    webkit: version('webkit'),
    smoke,
    // Chromium runs every spec but the perf gates and the key screens, which run in their own projects (the screens in
    // Playwright's container, its own job); Firefox and WebKit the smoke set.
    chromiumWhole:
      /testIgnore: \[\.\.\.PERF, 'screens\.spec\.ts'\] \}/.test(project('chromium')) &&
      !/testMatch/.test(project('chromium')) &&
      /name: 'screens',[\s\S]*?testMatch: \['screens\.spec\.ts'\]/.test(config) &&
      /npx playwright test --project=screens\n/.test(ci),
    enginesSmoke: ['firefox', 'webkit'].every((name) => new RegExp(`name: '${name}',[\\s\\S]*?\\.\\.\\.smoke`).test(config)),
    phone: /name: 'perf-phone',[\s\S]*?isMobile: true, hasTouch: true/.test(config),
    jobs: {
      chromium: /npx playwright test --project=chromium --shard=/.test(ci),
      engines: /engine: \[firefox, webkit\]/.test(ci) && /npx playwright test --project=\$\{\{ matrix\.engine \}\}/.test(ci),
      perf: /npx playwright test --project=perf --project=perf-phone/.test(ci),
    },
    npmTarget: /target: '(es\d+)'/.exec(read(workspace, 'tools/dual-build.mjs'))[1].toUpperCase(),
    scriptTarget: /target: '(es\d+)'/.exec(read(workspace, 'tools/script-bundle.mjs'))[1].toUpperCase(),
  };
}

/** The page's browsers are the ones CI runs. */
export function browserProblems(doc, run) {
  const problems = [];
  const flat = doc.replace(/\s*\n\s*/g, ' ');
  const row = (start) => rowOf(doc, start)?.slice(1).join(' | ') ?? '';
  const need = (where, words) => {
    if (!where.includes(words)) problems.push(`the browsers: "${words}" is what CI runs, and the page does not say it`);
  };
  need(row('Chrome, Edge'), `Chromium ${run.chromium}`);
  need(row('Firefox'), `Firefox ${run.firefox}`);
  need(row('Safari'), `WebKit ${run.webkit}`);
  need(row('Firefox'), `the smoke set (${run.smoke} specs)`);
  need(row('Safari'), `the smoke set (${run.smoke} specs)`);
  need(flat, `The npm packages are ${run.npmTarget}`);
  need(flat, `the one-tag script ${run.scriptTarget}`);
  if (!run.chromiumWhole || !run.jobs.chromium) problems.push('the browsers: the page says Chromium runs every browser spec, and playwright.config.ts or ci.yml no longer runs them all');
  if (!run.enginesSmoke || !run.jobs.engines) problems.push('the browsers: the page says Firefox and WebKit run the smoke set in CI, and playwright.config.ts or ci.yml no longer does');
  if (!run.phone || !run.jobs.perf) problems.push('the browsers: the page says the perf gates run on a phone, and playwright.config.ts or ci.yml no longer does');
  for (const engine of ['Chrome, Edge', 'Firefox', 'Safari', 'Safari on iOS', 'Chrome on Android']) if (!rowOf(doc, engine)) problems.push(`the browsers: no row for ${engine}`);
  return problems;
}

/** Where the page is read: SECURITY.md and the README link it, and the site draws it. */
export function placeProblems(workspace = WORKSPACE) {
  const problems = [];
  if (!read(workspace, 'SECURITY.md').includes('docs/promises.md')) problems.push('SECURITY.md does not link docs/promises.md');
  if (!read(workspace, 'README.md').includes('docs/promises.md')) problems.push('README.md does not link docs/promises.md');
  if (!/'docs\/promises\.md': '\/promises\/'/.test(read(workspace, 'site/markdown.mjs'))) problems.push('site/markdown.mjs does not draw docs/promises.md as /promises/');
  if (!existsSync(join(workspace, 'site/pages/promises.mjs'))) problems.push('site/pages/promises.mjs is not there: fieldia.dev has no page of promises');
  if (!/^### Deprecations$/m.test(read(workspace, PAGE))) problems.push(`${PAGE} has no "### Deprecations" heading: the console's warnings link fieldia.dev/promises/#deprecations`);
  return problems;
}

/** Everything on the page that is not what the repository holds. */
export async function promiseProblems(workspace = WORKSPACE, doc = read(workspace, PAGE)) {
  return [
    ...gateProblems(doc, workspace),
    ...namedProblems(doc),
    ...numberProblems(doc, workspace),
    ...deprecationProblems(doc, await readDeprecations(workspace)),
    ...browserProblems(doc, browsersRun(workspace)),
    ...placeProblems(workspace),
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const problems = await promiseProblems();
  if (problems.length) {
    console.error(`promises: ${PAGE} says what the repository does not hold:\n${problems.map((one) => `  - ${one}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`promises: every promise of ${PAGE} names its gate, and says what the code holds`);
}
