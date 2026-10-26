/**
 * docs/promises.md held to its gates (tools/promises.mjs), and each check shown to bite: a page that names a gate the
 * repository lacks, quotes a test that is not there, makes a promise with no gate, gives a number the code does not
 * hold, lists deprecations the list does not have, or names browsers CI does not run, is refused.
 *   node --test tools/promises.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { siteOnly } from './ci-scope.mjs';
import { browserProblems, browsersRun, deprecationProblems, gateProblems, namedProblems, numberProblems, PAGE, promiseProblems } from './promises.mjs';
import { readDeprecations } from './release-train.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const doc = readFileSync(join(WORKSPACE, PAGE), 'utf8');
/** The page with one passage written otherwise: the passage must be there. */
const changed = (from, to) => {
  assert.ok(doc.includes(from), `the page says "${from}"`);
  return doc.replace(from, to);
};

test('every promise of docs/promises.md names its gate, and every gate, test and number it names is what the repository holds', async () => {
  assert.deepEqual(await promiseProblems(WORKSPACE), []);
});

test('a gate the repository lacks, or a test its file does not have, is refused', () => {
  assert.deepEqual(gateProblems(doc, WORKSPACE), []);
  const gone = gateProblems(changed('`libs/viewer/src/lib/unzip.spec.ts`', '`libs/viewer/src/lib/unzipped.spec.ts`'), WORKSPACE);
  assert.deepEqual(gone, ['libs/viewer/src/lib/unzipped.spec.ts is named as a gate and is not in the repository']);
  const renamed = gateProblems(changed('("fuzzed: no control character")', '("fuzzed: every control character")'), WORKSPACE);
  assert.deepEqual(renamed, ['libs/core/src/lib/safe-url.spec.ts has no test "fuzzed: every control character"']);
  // A quote across a line break of the page is read as one line, as the title is.
  assert.ok(/\("a password box’s\n {2}and a secret field’s values are never kept"\)/.test(doc));
});

test('a promise of security or stability with no gate, which does not say it has none, is refused', () => {
  assert.deepEqual(namedProblems(doc), []);
  const bare = changed('- **Decide who may see and change what.**', '- **Fieldia keeps every answer private.** Always.\n- **Decide who may see and change what.**');
  assert.deepEqual(namedProblems(bare), ['"**Fieldia keeps every answer private.** Always.…" (Security: what the app\'s server must still do) names no gate, and does not say it has none']);
  const said = changed('- **Decide who may see and change what.**', '- **Fieldia keeps every answer private.** No gate: a person checks it.\n- **Decide who may see and change what.**');
  assert.deepEqual(namedProblems(said), []);
  const row = changed('| Text read as a date | 100 characters | `libs/widgets/src/lib/long-text.spec.ts` ("reads no date from text longer than a date is written") |', '| Text read as a date | 100 characters | a test |');
  assert.deepEqual(namedProblems(row), ['"Text read as a date" names no gate']);
});

test('a number the code does not hold is refused: the page written otherwise, or the code changed under it', () => {
  assert.deepEqual(numberProblems(doc, WORKSPACE), []);
  const key = numberProblems(changed('| A key typed in a field a rule reads, 500 fields | 16 ms | 64 ms |', '| A key typed in a field a rule reads, 500 fields | 12 ms | 64 ms |'), WORKSPACE);
  assert.equal(key.length, 1);
  assert.match(key[0], /^perf: a key: the code holds "16 ms"/);
  const bound = numberProblems(changed('No pattern is tried on an answer longer than 1,000 characters', 'No pattern is tried on an answer longer than 10,000 characters'), WORKSPACE);
  assert.match(bound.join('\n'), /the bounds: a pattern: the code holds "1,000 characters"/);
  // The code moved on — a budget raised, a bound lowered — and the page not with it.
  const copy = mkdtempSync(join(tmpdir(), 'fieldia-promises-'));
  try {
    for (const file of ['libs/core/src/lib/record/compute.ts', 'libs/viewer/src/lib/unzip.ts', 'libs/core/src/lib/record/submission.ts', 'e2e/perf.spec.ts', 'e2e/perf-scale.spec.ts', 'tools/npm-first-load.mjs', 'libs/core/src/lib/format/pattern.ts', 'libs/core/src/lib/record/input-rules.ts', 'libs/viewer/src/lib/import-dialog.ts', 'libs/viewer/src/lib/import-file.ts', 'libs/core/src/lib/record/deadline.ts', 'tools/script-bundle.mjs']) {
      mkdirSync(dirname(join(copy, file)), { recursive: true });
      cpSync(join(WORKSPACE, file), join(copy, file));
    }
    assert.deepEqual(numberProblems(doc, copy), []);
    const edit = (file, from, to) => {
      const text = readFileSync(join(copy, file), 'utf8');
      assert.ok(text.includes(from), `${file} says ${from}`);
      writeFileSync(join(copy, file), text.replace(from, to));
    };
    edit('e2e/perf.spec.ts', '  viewerKey: 16,', '  viewerKey: 24,');
    edit('libs/viewer/src/lib/import-dialog.ts', 'export const IMPORT_MOST = 50000;', 'export const IMPORT_MOST = 20000;');
    edit('tools/script-bundle.mjs', 'const GZIP_BUDGET_KB = 191.2;', 'const GZIP_BUDGET_KB = 230.0;');
    const moved = numberProblems(doc, copy).map((one) => one.replace(/ \(its row: .*\)$/, ''));
    assert.deepEqual(moved, [
      'the bounds: an import: the code holds "20,000 rows", which the page does not say',
      'perf: a key: the code holds "24 ms", which the page does not say',
      'perf: a key: the code holds "96 ms", which the page does not say',
      'the one-tag script: the code holds "held to 230.0 KB gzipped", which the page does not say',
    ]);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test('every deprecation is in the table, as the list says it — and the table holds no other', async () => {
  const list = await readDeprecations(WORKSPACE);
  assert.ok(list.length > 0);
  assert.deepEqual(deprecationProblems(doc, list), []);
  const more = [...list, { id: 'viewer.mount-throws', since: '0.36', changesIn: '0.38', who: 'app code' }];
  assert.deepEqual(deprecationProblems(doc, more), ['viewer.mount-throws is deprecated (libs/core/src/lib/deprecations.ts) and not in the table']);
  const later = deprecationProblems(changed('| `format.under-stamped` | 0.36 | 0.37 |', '| `format.under-stamped` | 0.36 | 0.38 |'), list);
  assert.deepEqual(later, ['format.under-stamped: the table says 0.36, 0.38, page authors; the list 0.36, 0.37, page authors']);
  assert.deepEqual(deprecationProblems(doc, list.filter((one) => one.id !== 'page.invalid')), ['page.invalid is in the table and not in the list']);
});

test('the browsers CI runs are the ones this page names: Playwright\'s engines and versions, the smoke set, the jobs, the targets', () => {
  const run = browsersRun(WORKSPACE);
  assert.deepEqual(browserProblems(doc, run), []);
  assert.ok(run.chromiumWhole && run.enginesSmoke && run.phone && Object.values(run.jobs).every(Boolean), JSON.stringify(run));
  // Playwright moved on to another WebKit, the smoke set grew, Chromium no longer ran everything: each refused.
  assert.deepEqual(browserProblems(doc, { ...run, webkit: '26.4' }), ['the browsers: "WebKit 26.4" is what CI runs, and the page does not say it']);
  assert.equal(browserProblems(doc, { ...run, smoke: run.smoke + 1 }).length, 2);
  assert.match(browserProblems(doc, { ...run, chromiumWhole: false }).join('\n'), /Chromium runs every browser spec/);
  assert.match(browserProblems(doc, { ...run, jobs: { ...run.jobs, engines: false } }).join('\n'), /Firefox and WebKit run the smoke set/);
  assert.match(browserProblems(changed('| Safari on iOS |', '| Safari on an iPad |'), run).join('\n'), /no row for Safari on iOS/);
});

test('a change to the page of promises or the guide for agents runs every gate, not the site\'s alone: their gates are the packages\'', () => {
  assert.equal(siteOnly(['docs/promises.md']), false);
  assert.equal(siteOnly(['docs/agents.md']), false);
  assert.equal(siteOnly(['docs/plans/input-rules.md', 'site/pages/promises.mjs']), true);
});
