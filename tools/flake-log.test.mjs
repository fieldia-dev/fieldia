/**
 * The flake log (tools/flake-log.mjs): what failed in a browser job and then passed on the same commit is a flake, said
 * in the job's summary and kept as its artifact; what failed again is a failure; and CI keeps `retries: 0`, so a flake
 * is fixed, never retried away (that every browser job of ci.yml keeps its log is tools/workflows.test.mjs's).
 *   node --test tools/flake-log.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MOST_TO_RERUN, failedIn, firstRuns, flakeLog, rerunPlan, summary, testsOf } from './flake-log.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);

/** A Playwright JSON report, as its `json` reporter writes one: files, their describe blocks, their tests by project. */
const report = (tests) => ({
  config: { rootDir: '/work/e2e' },
  suites: [
    {
      title: 'lists.spec.ts',
      file: 'lists.spec.ts',
      specs: [],
      suites: [
        {
          title: 'a list',
          file: 'lists.spec.ts',
          specs: tests.map(([title, line, status, message]) => ({
            title,
            file: 'lists.spec.ts',
            line,
            tests: [{ projectName: 'webkit', status, results: [{ status: status === 'expected' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed', ...(message ? { error: { message } } : {}) }] }],
          })),
        },
      ],
    },
  ],
});

test('every test of a report is known by its project, its file and its titles, with its place and its first error', () => {
  const tests = testsOf(report([['sorts', 12, 'unexpected', '\u001b[31mError: expect(locator).toHaveText\u001b[39m\n\nExpected: "A"']]));
  assert.deepEqual(tests, [{ id: 'webkit › lists.spec.ts › a list › sorts', project: 'webkit', file: 'lists.spec.ts', line: 12, title: 'a list › sorts', outcome: 'unexpected', error: 'Error: expect(locator).toHaveText' }]);
});

test('what failed is run again by its file and line, once a line, and by its title, in its own project, from where the run starts', () => {
  const first = report([['sorts', 12, 'unexpected', 'Error: sorted wrong'], ['groups', 30, 'expected'], ['pages (2+)', 44, 'unexpected', 'Error: timed out'], ['pages again', 44, 'unexpected', 'Error: timed out'], ['skipped', 50, 'skipped']]);
  assert.equal(failedIn(first).length, 3);
  // A loop's line makes many tests: only those that failed are run again, by their titles, its marks taken as words.
  assert.deepEqual(rerunPlan(first, '/work'), [{ project: 'webkit', places: ['e2e/lists.spec.ts:12', 'e2e/lists.spec.ts:44'], grep: 'pages \\(2\\+\\)|pages again|sorts' }]);
  assert.ok(new RegExp(rerunPlan(first, '/work')[0].grep).test('lists.spec.ts a list pages (2+)'));
  assert.ok(!new RegExp(rerunPlan(first, '/work')[0].grep).test('lists.spec.ts a list groups'));
});

test('failed then passed on the same commit is a flake; failed again is a failure; not run again is said so', () => {
  const first = report([['sorts', 12, 'unexpected', 'Error: sorted wrong'], ['groups', 30, 'unexpected', 'Error: closed'], ['pages', 44, 'unexpected', 'Error: timed out'], ['totals', 60, 'expected']]);
  const again = report([['sorts', 12, 'expected'], ['groups', 30, 'unexpected', 'Error: closed again']]);
  const log = flakeLog(first, again, 'webkit 1 of 2');
  assert.deepEqual(log.flakes, [{ spec: 'lists.spec.ts', line: 12, test: 'a list › sorts', engine: 'webkit', error: 'Error: sorted wrong' }]);
  assert.deepEqual(log.failures, [{ spec: 'lists.spec.ts', line: 30, test: 'a list › groups', engine: 'webkit', error: 'Error: closed', again: 'Error: closed again' }]);
  assert.deepEqual(log.notRerun.map((entry) => entry.test), ['a list › pages']);
  // A test Playwright itself passed on a retry is a flake too (were retries ever turned on, the log would still say it).
  assert.equal(flakeLog(report([['sorts', 12, 'flaky', 'Error: once']]), report([['sorts', 12, 'expected']]), 'x').flakes.length, 1);
  // The job's summary says each, in a table a person reads.
  const said = summary(log);
  assert.match(said, /### Flake log — webkit 1 of 2/);
  assert.match(said, /\*\*Flakes — failed, then passed on the same commit: fix each, as retries stay 0\*\* \(1\)/);
  assert.match(said, /\| webkit \| `lists\.spec\.ts:12` \| a list › sorts \| Error: sorted wrong \|/);
  assert.match(said, /\*\*Failures — failed again on the same commit\*\* \(1\)/);
  assert.match(said, /\*\*Not run again\*\* \(1\)/);
  assert.match(summary(flakeLog(report([['totals', 60, 'expected']]), null, 'chromium 2 of 4')), /Nothing failed\./);
});

test('a build that broke is not run again test by test', () => {
  assert.equal(MOST_TO_RERUN, 30);
});

test('CI keeps retries at 0: a flake fails its job and is fixed, never retried away', () => {
  const config = readFileSync(resolve(WORKSPACE, 'playwright.config.ts'), 'utf8');
  assert.ok(/^\s*retries: 0,$/m.test(config), 'playwright.config.ts retries a failed test: a flake is fixed, never retried away');
  // The json reporter, beside the others in CI, writes the report the log reads (where PLAYWRIGHT_JSON_OUTPUT_NAME says).
  assert.ok(/reporter: process\.env\['CI'\] \? \[\['list'\], \['github'\], \['json'\]\] : 'list'/.test(config), 'playwright.config.ts writes no JSON report in CI for the flake log');
});

test('the log of a job: its first runs joined, its runs again read by project, flakes.json written and said', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fieldia-flakes-'));
  try {
    writeFileSync(join(dir, 'first.json'), JSON.stringify(report([['sorts', 12, 'unexpected', 'Error: sorted wrong'], ['groups', 30, 'expected']])));
    writeFileSync(join(dir, 'first-axe.json'), JSON.stringify(report([['axe', 70, 'unexpected', 'Error: 2 violations']])));
    writeFileSync(join(dir, 'rerun-webkit.json'), JSON.stringify(report([['sorts', 12, 'expected'], ['axe', 70, 'unexpected', 'Error: 2 violations']])));
    assert.equal(firstRuns(dir).suites.length, 2);
    const said = execFileSync(process.execPath, [join(WORKSPACE, 'tools/flake-log.mjs'), 'log', dir, '--job', 'site'], { encoding: 'utf8' });
    assert.match(said, /Flakes — failed, then passed on the same commit[^\n]*\(1\)/);
    assert.match(said, /Failures — failed again on the same commit\*\* \(1\)/);
    const log = JSON.parse(readFileSync(join(dir, 'flakes.json'), 'utf8'));
    assert.deepEqual([log.job, log.flakes.map((entry) => entry.test), log.failures.map((entry) => entry.test)], ['site', ['a list › sorts'], ['a list › axe']]);
    // A job that wrote no report says so, and is not a failure of the log's own.
    rmSync(dir, { recursive: true, force: true });
    assert.match(execFileSync(process.execPath, [join(WORKSPACE, 'tools/flake-log.mjs'), 'log', dir, '--job', 'site'], { encoding: 'utf8' }), /The run wrote no report/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
