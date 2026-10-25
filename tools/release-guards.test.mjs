/**
 * What a release must be before anything of it is published (the audits' R-H7, R-M15, S-H4): a commit, tagged with its
 * version, already on origin/main, from a tree with nothing else in it; and a patch holds fixes alone.
 *   node --test tools/release-guards.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gitFacts, machinePathIn, patchProblem, releaseProblems } from './release-guards.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const changelog = readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8');

const SAMPLE = `# Changelog

## 0.4.1 — 2026-10-05

**Fixes:** a list scrolls again.

**Upgrading.** A test that pressed OK presses Yes.

## 0.4.0 — 2026-10-04

**Lists.** A list page sorts.

**Upgrading** — what an app sees change: a list's header is a button.

## 0.3.2 — 2026-10-03

- A fix.

### Upgrading

- A selector changed.

## 0.3.1 — 2026-10-02

- A fix. Nothing an app writes changes — no upgrading needed.
`;

/** A release as it should be: tagged, on main, nothing changed. */
const READY = { head: 'a1b2c3d4e5f6', changed: [], onMain: true, tags: ['v0.4.0'] };

test('a patch whose section has an Upgrading part is refused, a minor\'s is not', () => {
  assert.match(patchProblem('0.4.1', SAMPLE), /0\.4\.1 is a patch, but its CHANGELOG section has an Upgrading part/);
  assert.match(patchProblem('0.3.2', SAMPLE), /0\.3\.2 is a patch/);
  assert.equal(patchProblem('0.4.0', SAMPLE), null);
  // Saying there is nothing to upgrade is not an Upgrading part.
  assert.equal(patchProblem('0.3.1', SAMPLE), null);
});

test('the patches the reliability audit found carrying breaking changes are refused (0.26.1, 0.30.1, 0.31.1)', () => {
  for (const version of ['0.26.1', '0.30.1', '0.31.1']) assert.match(patchProblem(version, changelog) ?? '', /is a patch, but its CHANGELOG section has an Upgrading part/, version);
  // The fixes-only patches before them pass.
  for (const version of ['0.19.1', '0.14.1', '0.13.1', '0.9.2']) assert.equal(patchProblem(version, changelog), null, version);
});

test('a release ready to publish has no problems', () => {
  assert.deepEqual(releaseProblems({ version: '0.4.0', changelog: SAMPLE, facts: READY }), []);
});

test('a tree with changes, a HEAD not on origin/main, a missing tag: each refused, in words that say what to do', () => {
  const problems = releaseProblems({ version: '0.4.0', changelog: SAMPLE, facts: { ...READY, changed: [' M libs/core/src/index.ts', '?? stray.txt'], onMain: false, tags: ['v0.3.9'] } });
  assert.equal(problems.length, 3, problems.join('\n'));
  assert.match(problems[0], /changes not committed \(2 files: libs\/core\/src\/index\.ts, stray\.txt\)/);
  assert.match(problems[1], /HEAD \(a1b2c3d4e5f6\) is not on origin\/main/);
  assert.match(problems[1], /git fetch origin/);
  assert.match(problems[2], /HEAD has no tag v0\.4\.0/);
  assert.match(problems[2], /git tag -a v0\.4\.0 -m "Fieldia 0\.4\.0"/);
});

test('no origin/main to compare with is a problem of its own', () => {
  assert.match(releaseProblems({ version: '0.4.0', changelog: SAMPLE, facts: { ...READY, onMain: null } })[0], /no origin\/main/);
});

test('a tag pushed for another version than the packages\' is refused', () => {
  const [problem] = releaseProblems({ version: '0.4.0', changelog: SAMPLE, facts: READY, tag: 'v0.4.1' });
  assert.match(problem, /the tag v0\.4\.1 is not this release's: the packages are 0\.4\.0/);
});

test('the facts are read from git as they are', () => {
  const repo = mkdtempSync(join(tmpdir(), 'fieldia-guards-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } });
    git('init', '-q', '-b', 'main');
    writeFileSync(join(repo, 'a.txt'), 'a\n');
    git('add', 'a.txt');
    git('commit', '-q', '-m', 'one');
    // No remote yet: nothing to compare HEAD with.
    assert.equal(gitFacts(repo).onMain, null);
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('tag', '-a', 'v1.0.0', '-m', 'Fieldia 1.0.0');
    const ready = gitFacts(repo);
    assert.deepEqual([ready.changed, ready.onMain, ready.tags], [[], true, ['v1.0.0']]);
    // A commit not pushed, and a file changed and one not tracked.
    writeFileSync(join(repo, 'a.txt'), 'b\n');
    git('commit', '-q', '-am', 'two');
    writeFileSync(join(repo, 'a.txt'), 'c\n');
    writeFileSync(join(repo, 'new.txt'), 'n\n');
    const later = gitFacts(repo);
    assert.equal(later.onMain, false);
    assert.deepEqual(later.tags, []);
    assert.deepEqual(later.changed, [' M a.txt', '?? new.txt']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a file that names a path on the machine it was built on is found; a web address that holds /home/ is not', () => {
  assert.equal(machinePathIn('{"sourcesContent":["export * from \\"/home/rthm/IWork/fieldia/libs/core/src/index.ts\\";"]}'), '/home/rthm/IWork/fieldia/libs/core/src/index.ts');
  assert.equal(machinePathIn('import x from "/Users/sara/dev/fieldia/tools/script-parts.ts"'), '/Users/sara/dev/fieldia/tools/script-parts.ts');
  assert.equal(machinePathIn('//# sourceMappingURL=file:///home/runner/work/fieldia/fieldia/dist/x.js.map'), '/home/runner/work/fieldia/fieldia/dist/x.js.map');
  assert.equal(machinePathIn('"sources":["../../../../libs/core/src/index.ts"]'), null);
  assert.equal(machinePathIn('<a href="https://example.com/home/">Home</a> and https://example.com/Users/list'), null);
});
