/**
 * Publishing the packs a release check proved: in their order, each checked against the hash it was packed with,
 * those already on npm left, and a publish that stops part way saying what is out and what is not.
 *   node --test tools/release-publish.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { npmProblem, publishPacks, readPacks, writePacks } from './release-publish.mjs';

const integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

/** A folder of packs as `release.mjs check` leaves it: the tarballs and packs.json, in publishing order. */
function packsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'fieldia-packs-'));
  const packs = ['core', 'widgets', 'viewer'].map((name) => {
    const file = `fieldia-${name}-0.4.0.tgz`;
    const bytes = `the ${name} tarball`;
    writeFileSync(join(dir, file), bytes);
    return { name: `@fieldia/${name}`, file, integrity: integrity(bytes) };
  });
  writePacks(dir, { version: '0.4.0', commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', packs });
  return dir;
}

/** npm as the publish sees it: `view` answers for what is on npm, `publish` is written down (or fails, for a name). */
function fakeNpm({ onNpm = [], failing = null } = {}) {
  const calls = [];
  const run = (args, env) => {
    calls.push({ args, env });
    if (args[0] === 'view') {
      if (onNpm.includes(args[1].replace(/@[^@]+$/, ''))) return '0.4.0\n';
      throw Object.assign(new Error('E404'), { status: 1 });
    }
    if (args[0] === 'publish' && failing && args[1].includes(failing)) throw Object.assign(new Error('npm error code E503'), { stderr: 'npm error 503 Service Unavailable' });
    return '';
  };
  return { run, calls, published: () => calls.filter((c) => c.args[0] === 'publish').map((c) => c.args) };
}

test('the packs are read back with their order, version and commit', () => {
  const dir = packsDir();
  try {
    const manifest = readPacks(dir);
    assert.equal(manifest.version, '0.4.0');
    assert.deepEqual(manifest.packs.map((p) => p.name), ['@fieldia/core', '@fieldia/widgets', '@fieldia/viewer']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a pack that is not the one the check packed is refused, before anything is published', () => {
  const dir = packsDir();
  try {
    writeFileSync(join(dir, 'fieldia-widgets-0.4.0.tgz'), 'another tarball');
    assert.throws(() => readPacks(dir), /fieldia-widgets-0\.4\.0\.tgz is not the tarball the release check packed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('each pack is published in order, public, with provenance where asked, and with no npm token in its environment', () => {
  const dir = packsDir();
  try {
    const npm = fakeNpm();
    const said = [];
    publishPacks({ dir, manifest: readPacks(dir), env: { PATH: '/usr/bin', NPM_TOKEN: 'leaked', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc' }, provenance: true, run: npm.run, log: (line) => said.push(line) });
    assert.deepEqual(npm.published(), ['core', 'widgets', 'viewer'].map((name) => ['publish', join(dir, `fieldia-${name}-0.4.0.tgz`), '--access', 'public', '--provenance']));
    for (const { env } of npm.calls) {
      assert.equal(env.NPM_TOKEN, undefined, 'a token reached npm');
      assert.equal(env.ACTIONS_ID_TOKEN_REQUEST_URL, 'https://oidc', 'the OIDC request was taken away');
    }
    assert.deepEqual(said, ['  published @fieldia/core@0.4.0', '  published @fieldia/widgets@0.4.0', '  published @fieldia/viewer@0.4.0']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a token is handed to npm only where the caller gives one, as its npmrc', () => {
  const dir = packsDir();
  try {
    const npm = fakeNpm();
    publishPacks({ dir, manifest: readPacks(dir), env: { PATH: '/usr/bin' }, token: { NPM_TOKEN: 'npm_x', npm_config_userconfig: '/tmp/x/.npmrc' }, run: npm.run, log: () => undefined });
    const publishes = npm.calls.filter((c) => c.args[0] === 'publish');
    for (const { env } of publishes) assert.deepEqual([env.NPM_TOKEN, env.npm_config_userconfig], ['npm_x', '/tmp/x/.npmrc']);
    // Asking npm what it has needs none.
    for (const { env } of npm.calls.filter((c) => c.args[0] === 'view')) assert.equal(env.NPM_TOKEN, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dry run publishes nothing: npm publish --dry-run, a package already on npm left as a real run would leave it', () => {
  const dir = packsDir();
  try {
    const npm = fakeNpm({ onNpm: ['@fieldia/core'] });
    const said = [];
    publishPacks({ dir, manifest: readPacks(dir), env: {}, dryRun: true, provenance: true, run: npm.run, log: (line) => said.push(line) });
    for (const args of npm.published()) assert.ok(args.includes('--dry-run'), args.join(' '));
    assert.equal(npm.published().length, 2);
    assert.deepEqual(said, ['  @fieldia/core@0.4.0 is already on npm', '  would publish @fieldia/widgets@0.4.0 (npm publish --dry-run passed)', '  would publish @fieldia/viewer@0.4.0 (npm publish --dry-run passed)']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a publish that stops part way says what is on npm and what is not, and that a second run takes the rest', () => {
  const dir = packsDir();
  try {
    const npm = fakeNpm({ failing: 'widgets' });
    assert.throws(
      () => publishPacks({ dir, manifest: readPacks(dir), env: {}, run: npm.run, log: () => undefined }),
      (error) => {
        assert.match(error.message, /@fieldia\/widgets@0\.4\.0 could not be published: npm error 503 Service Unavailable/);
        assert.match(error.message, /On npm now: @fieldia\/core\. Not published: @fieldia\/widgets, @fieldia\/viewer\./);
        assert.match(error.message, /Run it again: what is on npm is left as it is/);
        return true;
      }
    );
    assert.equal(npm.published().length, 2, 'it went on past a failure');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('trusted publishing needs npm 11.5.1 or later', () => {
  assert.match(npmProblem('10.9.2'), /trusted publishing needs npm 11\.5\.1 or later; this one is 10\.9\.2/);
  assert.match(npmProblem('11.5.0'), /11\.5\.0/);
  assert.equal(npmProblem('11.5.1'), null);
  assert.equal(npmProblem('11.6.1'), null);
  assert.equal(npmProblem('12.0.0'), null);
});
