/**
 * The flake log (the audit's R-M14): CI runs every browser test once, `retries: 0` — a test that fails fails its job,
 * and a flake is fixed, never retried away. But a red job alone cannot say whether what failed is a defect or a flake.
 * So each browser job runs what failed once more, on the same commit, after the run (`rerun`), and writes down what it
 * found (`log`): each test that failed and then passed is a FLAKE — its spec, its engine, its first error — kept as the
 * job's artifact and said in its summary; each that failed again is a FAILURE. The job stays red either way.
 *
 *   node tools/flake-log.mjs rerun <dir> [playwright args…]   the first run's failures (<dir>/first*.json), run again
 *                                                             into <dir>/rerun-<project>.json; nothing when none failed
 *   node tools/flake-log.mjs log <dir> --job <name>           <dir>/flakes.json written, a summary in Markdown printed
 *
 * Both read Playwright's JSON report (its `json` reporter, written where PLAYWRIGHT_JSON_OUTPUT_NAME says).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** More failures than this in one job are a build that broke, not flakes: they are not run again. */
export const MOST_TO_RERUN = 30;

/**
 * Every test of a report, by the name it is known by in any run of the same commit — its project, its file and the
 * titles down to it — with its place (file and line), what became of it, and the first error's first line.
 */
export function testsOf(report) {
  const found = new Map();
  const walk = (suite, titles) => {
    const here = suite.title ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const last = results[results.length - 1];
        const error = results.map((result) => result.error?.message ?? result.errors?.[0]?.message).find(Boolean) ?? '';
        const file = spec.file ?? suite.file ?? '';
        const id = [test.projectName ?? '', file, ...here.filter((title) => title !== file), spec.title].join(' › ');
        found.set(id, {
          id,
          project: test.projectName ?? '',
          file,
          line: spec.line,
          title: [...here.filter((title) => title !== file), spec.title].join(' › '),
          // Playwright's own word for a test's outcome: expected, unexpected, flaky (passed on a retry) or skipped.
          outcome: test.status ?? (last?.status === 'passed' ? 'expected' : last?.status === 'skipped' ? 'skipped' : 'unexpected'),
          error: firstLine(error),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return [...found.values()];
}

/** An error's first line, its colours taken out, as a person reads it in a summary. */
const firstLine = (message) =>
  String(message)
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';

/** What failed in a run: its tests that ended other than expected and were not skipped (a retry's pass is a flake too). */
export const failedIn = (report) => testsOf(report).filter((test) => test.outcome === 'unexpected' || test.outcome === 'flaky');

/**
 * What to run again, by project: each failed test by its file and line (`e2e/x.spec.ts:12`), once — a line that makes
 * several tests (a loop over variants) runs them all, and only the failed ones are judged.
 */
export function rerunPlan(report, cwd = process.cwd()) {
  const plan = new Map();
  // A report names each file from the folder its tests are in (its config's rootDir, `testDir`): from here, to run it.
  const root = report.config?.rootDir;
  for (const test of failedIn(report)) {
    const at = `${root ? relative(cwd, join(root, test.file)) : test.file}:${test.line}`;
    const places = plan.get(test.project) ?? new Set();
    places.add(at);
    plan.set(test.project, places);
  }
  return [...plan].map(([project, places]) => ({ project, places: [...places].sort() }));
}

/**
 * The flake log of one job: each test that failed in the first run, and whether the run again passed it (a flake),
 * failed it again (a failure) or never ran it (not run again: too many failed, or the run again could not start).
 */
export function flakeLog(first, again, job) {
  const second = new Map((again ? testsOf(again) : []).map((test) => [test.id, test]));
  const flakes = [];
  const failures = [];
  const notRerun = [];
  for (const test of failedIn(first)) {
    const next = second.get(test.id);
    const entry = { spec: test.file, line: test.line, test: test.title, engine: test.project, error: test.error };
    if (!next || next.outcome === 'skipped') notRerun.push(entry);
    else if (next.outcome === 'expected' || next.outcome === 'flaky') flakes.push(entry);
    else failures.push({ ...entry, again: next.error });
  }
  return { job, flakes, failures, notRerun };
}

/** The log in a job's summary: what flaked, what failed twice, what was not run again. */
export function summary(log) {
  const lines = [`### Flake log — ${log.job}`, ''];
  if (!log.flakes.length && !log.failures.length && !log.notRerun.length) return [...lines, 'Nothing failed.', ''].join('\n');
  const row = (entry) => `| ${entry.engine} | \`${entry.spec}:${entry.line}\` | ${entry.test.replace(/\|/g, '\\|')} | ${entry.error.replace(/\|/g, '\\|').slice(0, 160)} |`;
  const table = (title, entries) => (entries.length ? [`**${title}** (${entries.length})`, '', '| Engine | Spec | Test | First error |', '|---|---|---|---|', ...entries.map(row), ''] : []);
  return [
    ...lines,
    ...table('Flakes — failed, then passed on the same commit: fix each, as retries stay 0', log.flakes),
    ...table('Failures — failed again on the same commit', log.failures),
    ...table('Not run again', log.notRerun),
  ].join('\n');
}

const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

/**
 * A job's first runs, as one report: `first.json`, and `first-<name>.json` for a job that runs Playwright more than
 * once (the site's pages, then their axe) — or null when no run wrote one.
 */
export function firstRuns(dir) {
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => /^first(-[\w-]+)?\.json$/.test(name)).sort() : [];
  const reports = files.map((name) => read(join(dir, name))).filter(Boolean);
  if (!reports.length) return null;
  return { config: reports[0].config, suites: reports.flatMap((report) => report.suites ?? []) };
}

function main(argv) {
  const [command, dir, ...rest] = argv;
  if (!dir || !['rerun', 'log'].includes(command)) {
    console.error('usage: node tools/flake-log.mjs rerun <dir> [playwright args…] | log <dir> --job <name>');
    return 2;
  }
  const first = firstRuns(dir);
  if (command === 'rerun') {
    if (!first) {
      console.log(`${dir} holds no first run's report: the run wrote none, so nothing is run again.`);
      return 0;
    }
    const failed = failedIn(first);
    if (!failed.length) return 0;
    if (failed.length > MOST_TO_RERUN) {
      console.log(`${failed.length} tests failed, more than ${MOST_TO_RERUN}: a build that broke, not flakes — nothing is run again.`);
      return 0;
    }
    for (const { project, places } of rerunPlan(first)) {
      console.log(`Run again in ${project}: ${places.join(' ')}`);
      // One report per project, joined in `log`: Playwright writes one file per run.
      const out = resolve(dir, `rerun-${project}.json`);
      spawnSync('npx', ['playwright', 'test', ...places, `--project=${project}`, '--output=test-results/rerun', ...rest], {
        stdio: 'inherit',
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out },
      });
    }
    return 0;
  }
  const job = rest[rest.indexOf('--job') + 1] ?? 'browser tests';
  if (!first) {
    console.log(`### Flake log — ${job}\n\nThe run wrote no report (${dir}/first.json): it did not reach its tests.\n`);
    return 0;
  }
  const projects = [...new Set(failedIn(first).map((test) => test.project))];
  const reruns = projects.map((project) => read(join(dir, `rerun-${project}.json`))).filter(Boolean);
  const again = reruns.length ? { suites: reruns.flatMap((report) => report.suites ?? []) } : null;
  const log = flakeLog(first, again, job);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'flakes.json'), `${JSON.stringify(log, null, 2)}\n`);
  console.log(summary(log));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
