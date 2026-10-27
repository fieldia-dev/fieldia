/**
 * A page stamped with the lowest format its settings need (the audit's R-M7), held to the format's own history: each
 * format's schema as it was released, read by a standard JSON Schema validator. A page stamped lower than it needs
 * fails there — the reader of that format would not know a setting it uses — and one stamped higher than it needs
 * fails the second test, which reads it in the format before.
 *   node --test tools/format-since.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { formatSchemas, formatSince } from './format-since.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020').default;

/** @fieldia/core/schema from its source, as a page's maker uses it: `lowestFormat`, `validatePage`. */
async function core() {
  const dir = mkdtempSync(join(tmpdir(), 'fieldia-since-'));
  const file = join(dir, 'core.cjs');
  await build({ entryPoints: [join(WORKSPACE, 'libs/core/src/schema.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: file, logLevel: 'error', tsconfig: join(WORKSPACE, 'tsconfig.base.json') });
  const loaded = require(file);
  rmSync(dir, { recursive: true, force: true });
  return loaded;
}
const { versions, found } = formatSchemas(WORKSPACE);
const validators = new Map();
/** A format's own schema, as it was released, compiled once. */
const readerOf = (format) => {
  if (!validators.has(format)) validators.set(format, new Ajv2020({ strict: false, allErrors: false }).compile(found.get(format).schema));
  return validators.get(format);
};
const EXAMPLES = join(WORKSPACE, 'examples/pages');
const examples = readdirSync(EXAMPLES).filter((name) => name.endsWith('.page.json')).map((name) => ({ name, page: JSON.parse(readFileSync(join(EXAMPLES, name), 'utf8')) }));

test('tools/format-since.json is what the format\'s history says', () => {
  const kept = readFileSync(join(WORKSPACE, 'tools/format-since.json'), 'utf8');
  assert.equal(kept, `${JSON.stringify(formatSince(WORKSPACE), null, 1)}\n`, 'run `node tools/format-since.mjs --write`, then `UPDATE_SHAPE=1 npx nx test core`');
});

test('every example page, stamped with the lowest format it needs, is read by that format\'s own schema — and not by the format before', async () => {
  const { lowestFormat } = await core();
  const stamped = {};
  const lower = [];
  const higher = [];
  for (const { name, page } of examples) {
    const format = lowestFormat(page);
    stamped[format] = (stamped[format] ?? 0) + 1;
    const i = versions.indexOf(format);
    if (i < versions.length - 1) {
      const reader = readerOf(format);
      if (!reader({ ...page, fieldia: format })) lower.push(`${name} stamped ${format}: ${JSON.stringify(reader.errors?.slice(0, 2))}`);
    }
    if (i > 0 && readerOf(versions[i - 1])({ ...page, fieldia: versions[i - 1] })) higher.push(`${name} stamped ${format}, read by ${versions[i - 1]}`);
  }
  assert.deepEqual(lower, [], 'a page stamped lower than it needs');
  assert.deepEqual(higher, [], 'a page stamped higher than it needs');
  // Half of them use nothing past the first format: an older viewer reads them.
  assert.ok((stamped['0.1'] ?? 0) > examples.length / 3, JSON.stringify(stamped));
});

test('every example page of every format released, as it was written then, needs that format at the most — and is read by the one it is stamped with', async () => {
  const { lowestFormat } = await core();
  const git = (args) => execFileSync('git', args, { cwd: WORKSPACE, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  const later = [];
  const lower = [];
  let read = 0;
  for (const format of versions.slice(0, -1)) {
    const commit = found.get(format).commit;
    const names = git(['ls-tree', '--name-only', `${commit}`, 'examples/pages/']).split('\n').filter((name) => name.endsWith('.page.json'));
    for (const name of names) {
      const page = JSON.parse(git(['show', `${commit}:${name}`]));
      read++;
      const needed = lowestFormat(page);
      if (versions.indexOf(needed) > versions.indexOf(format)) later.push(`${name} of ${format} needs ${needed}`);
      if (needed !== versions[versions.length - 1] && !readerOf(needed)({ ...page, fieldia: needed })) lower.push(`${name} of ${format} stamped ${needed}: ${JSON.stringify(readerOf(needed).errors?.slice(0, 1))}`);
    }
  }
  assert.ok(read > 900, `${read} pages read`);
  assert.deepEqual(later, [], 'a page of an older format said to need a later one');
  assert.deepEqual(lower, [], 'a page stamped lower than it needs');
});

test('the history bites: a place said to come earlier than it did stamps a page lower than its format\'s schema reads', async () => {
  // The schema the checks read made again with one place's format taken back to the first — a field's `secret`, which
  // came in 0.13 — and a page that uses it stamped by it: the soundness check above refuses it.
  const dir = mkdtempSync(join(tmpdir(), 'fieldia-since-'));
  const entry = join(dir, 'entry.ts');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(entry, ['test-shape-source', 'shape-check'].map((file) => `export * from ${JSON.stringify(join(WORKSPACE, 'libs/core/src/lib/format', file))};`).join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'made.cjs'), logLevel: 'error', tsconfig: join(WORKSPACE, 'tsconfig.base.json') });
  const { pageShapeData, shapeCheck } = require(join(dir, 'made.cjs'));
  rmSync(dir, { recursive: true, force: true });
  const since = formatSince(WORKSPACE);
  const page = { fieldia: '0.13', id: 'p', data: { kind: 'responses' }, fields: { pin: { type: 'char', label: 'PIN', secret: true } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-pin', field: 'pin' }] } };
  const stampWith = (history) => versions[Math.max(0, shapeCheck(page, pageShapeData(history).data).need)];
  assert.equal(stampWith(since), '0.13');
  const secret = Object.keys(since.places).filter((place) => place.endsWith('/properties/secret'));
  assert.ok(secret.length > 10, 'every kind of field has its secret');
  const wrong = { ...since, places: Object.fromEntries(Object.entries(since.places).filter(([place]) => !secret.includes(place))) };
  const stamped = stampWith(wrong);
  assert.equal(stamped, '0.1');
  assert.equal(readerOf(stamped)({ ...page, fieldia: stamped }), false, 'the format it was stamped with does not read it');
});

test('the 0.30 viewer\'s format check the core\'s tests stand on is the one 0.30 released', () => {
  const kept = readFileSync(join(WORKSPACE, 'libs/core/src/lib/format/test-version-0.30.ts'), 'utf8').split('\n');
  const released = execFileSync('git', ['show', '8a0fa712ea06:libs/core/src/lib/format/version.ts'], { cwd: WORKSPACE, encoding: 'utf8' });
  assert.equal(kept.slice(4).join('\n'), released);
  assert.equal(found.get('0.9').commit, '8a0fa712ea06', '0.30.0 is the release of format 0.9');
});
