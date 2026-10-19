/**
 * What a change can break: CI runs only the site's gates for a change to fieldia.dev alone, and none twice for a
 * commit its pull request already tested.
 *   node --test tools/ci-scope.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedFiles, siteOnly, testedOnPullRequest } from './ci-scope.mjs';

test('a change to the site alone is the site’s', () => {
  assert.equal(siteOnly(['site/pages/home.mjs', 'site/home.css', 'site/home.js', 'e2e/site.spec.ts']), true);
  assert.equal(siteOnly(['docs/plans/input-rules.md', 'site/hero.mjs']), true);
  assert.equal(siteOnly(['tools/build-site.mjs', 'site/hero-map.mjs', 'e2e/site.spec.ts']), true);
});

test('anything the site is built from, or that tests more than the site, runs every gate', () => {
  for (const other of ['libs/viewer/src/lib/list.ts', 'demos/catalog.mjs', 'examples/pages/customer.page.json', 'tools/build-demos.mjs', '.github/workflows/ci.yml', 'e2e/a11y.spec.ts', 'CHANGELOG.md', 'package-lock.json']) {
    assert.equal(siteOnly(['site/home.css', other]), false, other);
  }
});

test('nothing known changed runs every gate', () => {
  assert.equal(siteOnly([]), false);
  assert.equal(changedFiles('', 'abc'), null);
  assert.equal(changedFiles('0000000000000000000000000000000000000000', 'abc'), null);
  assert.equal(changedFiles('a', 'b', () => { throw new Error('bad object'); }), null);
  assert.deepEqual(changedFiles('a', 'b', () => 'site/home.css\nsite/home.js\n'), ['site/home.css', 'site/home.js']);
});

test('a commit is tested only when CI passed on a pull request for exactly it', async () => {
  const asked = [];
  const answer = (count, ok = true) => async (url) => { asked.push(url); return { ok, json: async () => ({ total_count: count }) }; };
  assert.equal(await testedOnPullRequest('o/r', 'abc', 't', answer(1)), true);
  assert.match(asked[0], /head_sha=abc&event=pull_request&status=success/);
  assert.equal(await testedOnPullRequest('o/r', 'abc', 't', answer(0)), false);
  assert.equal(await testedOnPullRequest('o/r', 'abc', 't', answer(1, false)), false);
  assert.equal(await testedOnPullRequest('o/r', 'abc', 't', async () => { throw new Error('offline'); }), false);
  assert.equal(await testedOnPullRequest('', 'abc', 't', answer(1)), false);
});
