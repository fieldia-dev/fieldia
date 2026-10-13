/**
 * The release notes: CHANGELOG.md has a section for every version released, and the tools read it back right.
 *   node --test tools/release-notes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { notesFor, releaseCommands, releasedVersions } from './release-notes.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const changelog = readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8');

const SAMPLE = `# Changelog

Words before the first release.

## 0.3.0 — 2026-10-03

**Lists.** A list page sorts.

- A search bar.

## 0.2.1 — 2026-10-02

- A fix.
`;

test('a version\'s notes are its section, up to the next one', () => {
  assert.deepEqual(notesFor(SAMPLE, '0.3.0'), { version: '0.3.0', date: '2026-10-03', body: '**Lists.** A list page sorts.\n\n- A search bar.' });
  assert.deepEqual(notesFor(SAMPLE, '0.2.1'), { version: '0.2.1', date: '2026-10-02', body: '- A fix.' });
});

test('a version with no section has no notes, and 0.2.1 is not 0.2.10', () => {
  assert.equal(notesFor(SAMPLE, '0.4.0'), null);
  assert.equal(notesFor(`${SAMPLE}\n## 0.2.10 — 2026-10-09\n\n- Later.\n`, '0.2.1')?.body, '- A fix.');
});

test('the commands tag the commit and make the GitHub release from the notes file, exactly', () => {
  assert.deepEqual(releaseCommands({ version: '0.21.0', commit: 'abc1234', notesFile: 'tmp/release/notes-0.21.0.md' }), [
    'git tag -a v0.21.0 abc1234 -m "Fieldia 0.21.0"',
    'git push origin v0.21.0',
    'gh release create v0.21.0 --verify-tag --title "Fieldia 0.21.0" --notes-file tmp/release/notes-0.21.0.md',
  ]);
});

test('the packages\' version has its notes', () => {
  const { version } = JSON.parse(readFileSync(join(WORKSPACE, 'libs/core/package.json'), 'utf8'));
  const notes = notesFor(changelog, version);
  assert.ok(notes, `CHANGELOG.md has no section for ${version}`);
  assert.ok(notes.body.length > 40, `the notes for ${version} say almost nothing`);
});

test('every version a release commit set has its notes, with that commit\'s date', () => {
  const released = releasedVersions(WORKSPACE);
  assert.ok(released.length >= 25, `only ${released.length} releases found in the history`);
  for (const { version, date } of released) {
    const notes = notesFor(changelog, version);
    assert.ok(notes, `CHANGELOG.md has no section for ${version}, released ${date}`);
    assert.equal(notes.date, date, `${version} was released on ${date}`);
  }
});

test('the sections run newest first', () => {
  const order = [...changelog.matchAll(/^## (\d+)\.(\d+)\.(\d+)/gm)].map((m) => m.slice(1).map(Number));
  for (let i = 1; i < order.length; i++) {
    const [a, b] = [order[i - 1], order[i]];
    const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    assert.ok(newer > 0, `${a.join('.')} comes before ${b.join('.')}`);
  }
});

test('run on its own, it prints the notes and the commands, and runs nothing', () => {
  const out = execFileSync('node', [join(WORKSPACE, 'tools/release-notes.mjs'), '0.20.0'], { cwd: WORKSPACE, encoding: 'utf8' });
  assert.match(out, /Fieldia 0\.20\.0/);
  assert.match(out, /A work item in a popup/);
  assert.match(out, /git tag -a v0\.20\.0 [0-9a-f]{7,} -m "Fieldia 0\.20\.0"/);
  assert.match(out, /gh release create v0\.20\.0 --verify-tag/);
});
