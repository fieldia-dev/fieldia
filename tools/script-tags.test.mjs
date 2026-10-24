/**
 * The script tags Fieldia's docs print (the audits' S-M8, R-H9): each names an exact version of @fieldia/viewer and
 * carries the sha384 of the file npm serves for it, with crossorigin — written by tools/script-tags.mjs, never by hand.
 *   node --test tools/script-tags.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CDN, hashesOf, readReleased, READMES, scriptTag, tagProblems, writeTags } from './script-tags.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const RELEASED = { version: '0.4.0', integrity: { 'fieldia.js': 'sha384-MAIN', 'fieldia.ar.js': 'sha384-ARABIC', 'fieldia-embed.js': 'sha384-EMBED' } };

test('a tag names the version, the file\'s integrity and crossorigin', () => {
  assert.equal(scriptTag('fieldia.js', RELEASED), `<script src="${CDN}@0.4.0/bundle/fieldia.js"\n  integrity="sha384-MAIN"\n  crossorigin="anonymous"></script>`);
  assert.equal(
    scriptTag('fieldia-embed.js', RELEASED, '\n  data-src="https://forms.example.com/enquiry" async'),
    `<script src="${CDN}@0.4.0/bundle/fieldia-embed.js"\n  integrity="sha384-EMBED"\n  crossorigin="anonymous"\n  data-src="https://forms.example.com/enquiry" async></script>`
  );
  assert.throws(() => scriptTag('fieldia.xx.js', RELEASED), /fieldia\.xx\.js is not in @fieldia\/viewer 0\.4\.0/);
});

test('a README\'s tags are written from the release: an unversioned one, an old one and a hand-typed hash all made right', () => {
  const before = [
    '```html',
    `<script src="${CDN}/bundle/fieldia.js"></script>`,
    `<script src="${CDN}@0.3.0/bundle/fieldia.ar.js" integrity="sha384-OLD" crossorigin="anonymous"></script>`,
    `  <script src="${CDN}@0.4.0/bundle/fieldia-embed.js"`,
    '    data-src="https://forms.example.com/enquiry" async></script>',
    '```',
  ].join('\n');
  const after = writeTags(before, RELEASED);
  assert.equal(
    after,
    [
      '```html',
      `<script src="${CDN}@0.4.0/bundle/fieldia.js"\n  integrity="sha384-MAIN"\n  crossorigin="anonymous"></script>`,
      `<script src="${CDN}@0.4.0/bundle/fieldia.ar.js"\n  integrity="sha384-ARABIC"\n  crossorigin="anonymous"></script>`,
      `  <script src="${CDN}@0.4.0/bundle/fieldia-embed.js"\n    integrity="sha384-EMBED"\n    crossorigin="anonymous"`,
      '    data-src="https://forms.example.com/enquiry" async></script>',
      '```',
    ].join('\n')
  );
  // Written once, it is as it should be: writing again changes nothing, and nothing is said of it.
  assert.equal(writeTags(after, RELEASED), after);
  assert.deepEqual(tagProblems(after, RELEASED), []);
  assert.equal(tagProblems(before, RELEASED).length, 3);
  assert.match(tagProblems(before, RELEASED)[0], /line 2: .*fieldia\.js/);
});

test('each file\'s hash is the sha384 of its bytes, as a browser checks it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fieldia-tags-'));
  try {
    writeFileSync(join(dir, 'fieldia.js'), 'alert(1)');
    writeFileSync(join(dir, 'fieldia.js.map'), '{}');
    // openssl dgst -sha384 -binary | base64, for "alert(1)".
    const expected = execFileSync('node', ['-e', "process.stdout.write(require('crypto').createHash('sha384').update('alert(1)').digest('base64'))"], { encoding: 'utf8' });
    assert.deepEqual(hashesOf(dir), { 'fieldia.js': `sha384-${expected}` });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the release the docs name is recorded, with every script of the bundle', () => {
  const released = readReleased(WORKSPACE);
  assert.match(released.version, /^\d+\.\d+\.\d+$/);
  for (const file of ['fieldia.js', 'fieldia.ar.js', 'fieldia-embed.js', 'fieldia.list.js']) assert.match(released.integrity[file] ?? '', /^sha384-[A-Za-z0-9+/]{64}$/, file);
});

test('every README\'s script tags are the ones the release gives (`node tools/script-tags.mjs write` writes them)', () => {
  const released = readReleased(WORKSPACE);
  for (const file of READMES(WORKSPACE)) {
    const problems = tagProblems(readFileSync(file, 'utf8'), released);
    assert.deepEqual(problems, [], `${file.replace(`${WORKSPACE}/`, '')}: run \`node tools/script-tags.mjs write\``);
  }
});

/** Every file git tracks, but the changelog (history, as it was) and this module and its test. */
const tracked = () =>
  execFileSync('git', ['ls-files'], { cwd: WORKSPACE, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => !['CHANGELOG.md', 'tools/script-tags.mjs', 'tools/script-tags.test.mjs'].includes(file))
    .filter((file) => /\.(m?js|ts|tsx|vue|html|md|json)$/.test(file));

test('no file names a CDN copy of Fieldia unversioned, and none but a README types a tag of its own', () => {
  const unversioned = [];
  const typed = [];
  for (const file of tracked()) {
    const text = readFileSync(join(WORKSPACE, file), 'utf8');
    for (const [at] of text.matchAll(/(?:cdn\.jsdelivr\.net|unpkg\.com)\/(?:npm\/)?@fieldia\/[a-z]+(?![@\w-])/g)) unversioned.push(`${file}: ${at}`);
    // In code, a version is the running one (`@${…}`), and a whole tag comes from scriptTag(); in a README, from write.
    if (/\.md$/.test(file)) continue;
    for (const [at] of text.matchAll(/cdn\.jsdelivr\.net\/npm\/@fieldia\/viewer@(?!\$\{)[^\s"'`]*/g)) typed.push(`${file}: ${at}`);
  }
  assert.deepEqual(unversioned, [], 'a script tag that takes whatever version is newest, at once, on every page that has it');
  assert.deepEqual(typed.filter((one) => !/\.spec\.ts:/.test(one)), [], 'a version typed by hand: write the tag with scriptTag() (tools/script-tags.mjs)');
});
