import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { carriesAuth, withoutAuth } from './release-env.mjs';

/**
 * The release's checks run third-party code (the packs' dependencies and peers, installed fresh, run by node and tsc):
 * none of it is given a way to publish (release-env.mjs), the install runs no install scripts, and the token reaches
 * `npm publish` alone (release.mjs).
 */

const TOKENS = {
  NPM_TOKEN: 'npm_secret',
  NODE_AUTH_TOKEN: 'node_secret',
  npm_config__authToken: 'a',
  'npm_config_//registry.npmjs.org/:_authToken': 'b',
  NPM_CONFIG__AUTH: 'c',
  NPM_CONFIG_TOKEN: 'd',
  npm_config__password: 'e',
  npm_config_username: 'f',
};

test('the environment given to the checks carries no npm token, nor any npm setting that carries auth', () => {
  const env = withoutAuth({ ...TOKENS, PATH: '/usr/bin', HOME: '/home/someone', npm_config_loglevel: 'error', npm_config_registry: 'https://registry.npmjs.org/' });
  assert.deepEqual(env, { PATH: '/usr/bin', HOME: '/home/someone', npm_config_loglevel: 'error', npm_config_registry: 'https://registry.npmjs.org/' });
  for (const name of Object.keys(TOKENS)) assert.equal(carriesAuth(name), true, name);
  for (const value of Object.values(TOKENS)) assert.ok(!Object.values(env).includes(value));
});

test('from this process too: a token in the environment is not in what the checks are given', () => {
  const had = process.env.NPM_TOKEN;
  process.env.NPM_TOKEN = 'npm_from_the_shell';
  try {
    assert.equal(withoutAuth().NPM_TOKEN, undefined);
    assert.ok(!Object.values(withoutAuth()).includes('npm_from_the_shell'));
  } finally {
    if (had === undefined) delete process.env.NPM_TOKEN;
    else process.env.NPM_TOKEN = had;
  }
});

test('release.mjs runs every check in that environment, installs with no install scripts, and gives the token to the publish alone', () => {
  const source = readFileSync(join(import.meta.dirname, 'release.mjs'), 'utf8');
  // run()'s environment unless one is given: the one without auth.
  assert.match(source, /const CHECKS_ENV = withoutAuth\(process\.env\);/);
  assert.match(source, /const run = \(cmd, args, cwd = WORKSPACE, env = CHECKS_ENV\) =>/);
  // Every install of packages runs no install scripts.
  const installs = source.match(/run\('npm', \['install'[^\]]*\]/g) ?? [];
  assert.ok(installs.length > 0);
  for (const install of installs) assert.match(install, /'--ignore-scripts'/);
  // No run() is handed an environment of its own: every one is the checks'.
  assert.deepEqual([...source.matchAll(/run\(([^;]*?), (WORKSPACE|SMOKE), (\w+)\)/g)].map((m) => m[3]), []);
  // The token is read from this process's environment to be said missing, and to be handed to the publish of the packs
  // alone (release-publish.mjs: to `npm publish`, never to `npm view`; release-publish.test.mjs).
  assert.deepEqual([...source.matchAll(/process\.env\.NPM_TOKEN/g)].length, 2);
  assert.match(source, /publishPacks\(\{ dir: PACKS, manifest: readPacks\(PACKS\), env: CHECKS_ENV, token: \{ NPM_TOKEN: process\.env\.NPM_TOKEN, npm_config_userconfig: npmrc \} \}\)/);
});
