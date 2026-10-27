/**
 * A minor is published only once a real iPhone and a real Android phone were checked for it (tools/real-devices.mjs,
 * docs/maintainers/real-devices.md), and both ways of publishing ask.
 *   node --test tools/real-devices.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHECKED_FROM, DEVICES, deviceCheckProblem, deviceRecord } from './real-devices.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const record = (...rows) => `# Real devices\n\n## The checklist\n\n| 1.2.3 | not a row of the record |\n\n## The record\n\n| Version | Day | iPhone | Android | Checked by | Result |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
const PASSED = '| 0.37.0 | 2026-11-16 | iPhone 15, iOS 26.0, Safari | Pixel 8, Android 16, Chrome 156 | Ramy | passed |';

test('the record is read from its own section, a row per version', () => {
  assert.deepEqual(deviceRecord(record(PASSED)), [{ version: '0.37.0', date: '2026-11-16', iphone: 'iPhone 15, iOS 26.0, Safari', android: 'Pixel 8, Android 16, Chrome 156', by: 'Ramy', result: 'passed' }]);
});

test('a minor checked on both phones, and passed, may be published; a patch is not asked', () => {
  assert.equal(deviceCheckProblem('0.37.0', record(PASSED)), null);
  assert.equal(deviceCheckProblem('0.37.1', record()), null);
  assert.equal(deviceCheckProblem('0.37.0', record('| 0.37.0 | 2026-11-16 | iPhone 15 | Pixel 8 | Ramy | passed, the map’s legend noted for 0.38 |')), null);
});

test('the gate bites from 0.37.0: 0.36.0, checked only by CI’s phones, is not asked for a row; 0.37.0 without one is refused', () => {
  assert.equal(CHECKED_FROM, '0.37.0');
  assert.equal(deviceCheckProblem('0.36.0', record()), null);
  assert.equal(deviceCheckProblem('0.36.0', readFileSync(resolve(WORKSPACE, DEVICES), 'utf8')), null);
  assert.match(deviceCheckProblem('0.37.0', record()), /^0\.37\.0 is a minor, and no real iPhone and Android phone were checked for it/);
  assert.match(deviceCheckProblem('0.37.0', readFileSync(resolve(WORKSPACE, DEVICES), 'utf8')), /^0\.37\.0 is a minor, and no real iPhone and Android phone were checked for it/);
  assert.match(deviceCheckProblem('0.38.0', record(PASSED)), /^0\.38\.0 is a minor/);
  assert.match(deviceCheckProblem('1.0.0', record(PASSED)), /^1\.0\.0 is a minor/);
});

test('a minor with no row, a row half filled, or a check that did not pass is refused, saying what to do', () => {
  assert.match(deviceCheckProblem('0.37.0', record('| 0.36.0 | 2026-10-27 | iPhone 15 | Pixel 8 | Ramy | passed |')), /0\.37\.0 is a minor, and no real iPhone and Android phone were checked for it: run the checklist in docs\/maintainers\/real-devices\.md/);
  assert.match(deviceCheckProblem('0.37.0', record('| 0.37.0 | soon | — | Pixel 8 |  | passed |')), /does not say the day \(YYYY-MM-DD\), the iPhone, who checked/);
  assert.match(deviceCheckProblem('0.37.0', record('| 0.37.0 | 2026-11-16 | iPhone 15 | Pixel 8 | Ramy | failed: the camera never opened |')), /did not pass \("failed: the camera never opened"\)/);
});

test('the record in the repository reads, and both ways of publishing refuse a minor without its row', () => {
  const text = readFileSync(resolve(WORKSPACE, DEVICES), 'utf8');
  assert.ok(/## The checklist/.test(text) && /## The record/.test(text), `${DEVICES} has its checklist and its record`);
  for (const file of ['tools/release.mjs', 'tools/publish-packs.mjs']) {
    assert.match(readFileSync(resolve(WORKSPACE, file), 'utf8'), /devicesProblem\(WORKSPACE, version\)/, `${file} publishes a minor no one checked on a real phone`);
  }
});

test('every demo the checklist sends a person to is one the gallery has, and its file to scan is there', async () => {
  const { DEMOS } = await import('../demos/catalog.mjs');
  const pages = new Set(DEMOS.map((demo) => new URLSearchParams(demo.query ?? '').get('page')));
  const text = readFileSync(resolve(WORKSPACE, DEVICES), 'utf8');
  const linked = [...text.matchAll(/https:\/\/fieldia\.dev\/demos\/plain\/\?page=([\w-]+)/g)].map((m) => m[1]);
  assert.ok(linked.length >= 10, `${linked.length} demos linked`);
  for (const page of linked) assert.ok(pages.has(page), `the checklist links page=${page}, which no demo shows`);
  for (const [, file] of text.matchAll(/https:\/\/fieldia\.dev\/demos\/(samples\/[\w.-]+)/g)) assert.ok(existsSync(resolve(WORKSPACE, 'demos', file)), `the checklist links demos/${file}, which is not there`);
});
