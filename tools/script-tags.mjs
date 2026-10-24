/**
 * The script tags Fieldia's docs print for a page with no build step — fieldia.dev's, the READMEs', the demos' — each
 * naming an exact version of @fieldia/viewer on jsDelivr and carrying the sha384 of the file npm serves for it as
 * `integrity`, with `crossorigin="anonymous"`, so a page runs the file that version released and no other: never the
 * newest at once (a release, a bad one too, would reach every page that has the tag on its day), never two versions
 * mixed while caches turn over, never a file changed on the way (the audits' S-M8, R-H9). Written here, never typed
 * by hand: tools/script-tags.test.mjs refuses an unversioned address anywhere, a version typed in code, and a README
 * tag that is not what `write` writes.
 *
 * What a tag names is the release on npm, recorded in tools/script-tags.json — its version and each script's hash, as
 * npm serves it — by `node tools/release.mjs verify` after a publish (or `record` below): fieldia.dev, built from main
 * between releases, names the last version published, whose files are the ones on the CDN. The README inside a
 * package is written as that package is built (tools/script-bundle.mjs), with its own version and its own bundle's
 * hashes: the files beside it in the same tarball.
 *
 *   node tools/script-tags.mjs write             the READMEs' tags, written from tools/script-tags.json
 *   node tools/script-tags.mjs record <version>  that version's scripts as npm serves them, recorded; then write
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withoutAuth } from './release-env.mjs';

/** @fieldia/viewer on jsDelivr, which serves each file of each version npm has, unchanged, with CORS. */
export const CDN = 'https://cdn.jsdelivr.net/npm/@fieldia/viewer';
const RECORD = 'tools/script-tags.json';

/** The release the docs' tags name: `{ version, integrity: { 'fieldia.js': 'sha384-…', … } }`. */
export function readReleased(workspace) {
  return JSON.parse(readFileSync(join(workspace, RECORD), 'utf8'));
}

/** Every script of a bundle folder, by its name, with the sha384 a browser checks it by. */
export function hashesOf(dir) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .sort()
      .map((name) => [name, `sha384-${createHash('sha384').update(readFileSync(join(dir, name))).digest('base64')}`])
  );
}

/** A tag's opening — its address, integrity and crossorigin — each attribute after the first on a line of its own. */
export function openTag(file, { version, integrity }, indent = '') {
  const hash = integrity[file];
  if (!hash) throw new Error(`${file} is not in @fieldia/viewer ${version}, the release the docs' script tags name (${RECORD})`);
  return `<script src="${CDN}@${version}/bundle/${file}"\n${indent}  integrity="${hash}"\n${indent}  crossorigin="anonymous"`;
}

/** A whole tag, with `attributes` after the integrity (each new line of them starting with its own break). */
export function scriptTag(file, released, attributes = '') {
  return `${openTag(file, released)}${attributes}></script>`;
}

/**
 * A tag's opening as a README may hold it: the address, with a version or none, and any integrity and crossorigin
 * after it, on its line or the next; its line's indentation kept.
 */
const TAG = new RegExp(`^([ \\t]*)<script src="${CDN.replace(/[./]/g, (c) => `\\${c}`)}(?:@[^/"]*)?/bundle/([\\w.-]+\\.js)"(?:\\s+integrity="[^"]*")?(?:\\s+crossorigin="[^"]*")?`, 'gm');

/** A README with each of its script tags written from `released`, whatever it had. */
export function writeTags(text, released) {
  return text.replace(TAG, (_, indent, file) => `${indent}${openTag(file, released, indent)}`);
}

/** Each tag of a README that is not what `writeTags` writes, by its line, in words. */
export function tagProblems(text, released) {
  const problems = [];
  for (const match of text.matchAll(TAG)) {
    const [whole, indent, file] = match;
    let wanted;
    try {
      wanted = `${indent}${openTag(file, released, indent)}`;
    } catch (error) {
      wanted = error.message;
    }
    if (whole !== wanted) problems.push(`line ${text.slice(0, match.index).split('\n').length}: ${file}'s tag is not @fieldia/viewer ${released.version}'s, with its integrity`);
  }
  return problems;
}

/** The READMEs a tag may be in: the repository's and each package's. */
export const READMES = (workspace) => [join(workspace, 'README.md'), ...readdirSync(join(workspace, 'libs')).map((dir) => join(workspace, 'libs', dir, 'README.md'))].filter((file) => existsSync(file));

/** Each README's tags written from the release recorded; the READMEs it changed. */
export function writeReadmes(workspace) {
  const released = readReleased(workspace);
  return READMES(workspace).filter((file) => {
    const before = readFileSync(file, 'utf8');
    const after = writeTags(before, released);
    if (after !== before) writeFileSync(file, after);
    return after !== before;
  });
}

/** A version's scripts as npm serves them, from its installed (or unpacked) bundle folder: recorded for the docs. */
export function recordReleased(workspace, version, bundle) {
  const released = { version, integrity: hashesOf(bundle) };
  writeFileSync(join(workspace, RECORD), `${JSON.stringify(released, null, 2)}\n`);
  return released;
}

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [mode, version] = process.argv.slice(2);
  if (mode === 'record') {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('usage: node tools/script-tags.mjs record <version on npm>');
    // The tarball npm serves, unpacked and read: nothing of it runs, and npm is given no token.
    const work = join(WORKSPACE, 'tmp/script-tags');
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    const [packed] = JSON.parse(execFileSync('npm', ['pack', `@fieldia/viewer@${version}`, '--ignore-scripts', '--json', '--pack-destination', work], { cwd: work, env: withoutAuth(process.env), encoding: 'utf8' }));
    execFileSync('tar', ['-xzf', join(work, packed.filename), '-C', work]);
    const released = recordReleased(WORKSPACE, version, join(work, 'package/bundle'));
    rmSync(work, { recursive: true, force: true });
    console.log(`${RECORD}: @fieldia/viewer ${version}, ${Object.keys(released.integrity).length} scripts`);
  } else if (mode !== 'write') {
    throw new Error('usage: node tools/script-tags.mjs write | record <version>');
  }
  const changed = writeReadmes(WORKSPACE);
  console.log(changed.length ? `script tags written in ${changed.map((file) => file.replace(`${WORKSPACE}/`, '')).join(', ')}` : 'every README\'s script tags are the release\'s');
}
