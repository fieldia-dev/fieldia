/**
 * Publishing a release's packs — the one way they reach npm, from a maintainer's machine (`node tools/release.mjs
 * publish`, with the npm token, while publishing moves to CI) or from the publish workflow on its tag
 * (tools/publish-packs.mjs, by npm's trusted publishing: no token at all).
 *
 * `release.mjs check` packs every package into a folder and writes packs.json beside the tarballs: the version, the
 * commit, and each pack's name, file and sha512, in the order they are published — dependencies before dependants, so
 * a published version never points at one npm does not have yet. Here each tarball is checked against that hash (what
 * is published is what the check installed and ran), a package already on npm at this version is left, and a publish
 * that stops part way stops there and says what is out and what is not: run again, it takes the rest.
 *
 * npm is never handed a token it was not given here: the environment's own are left out (release-env.mjs), and asking
 * npm what it has needs none.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withoutAuth } from './release-env.mjs';

const PACKS_FILE = 'packs.json';

/** packs.json, beside the tarballs: `{ version, commit, packs: [{ name, file, integrity }] }`, in publishing order. */
export function writePacks(dir, manifest) {
  writeFileSync(join(dir, PACKS_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** packs.json read back, each tarball beside it checked against the sha512 it was packed with. */
export function readPacks(dir) {
  const file = join(dir, PACKS_FILE);
  if (!existsSync(file)) throw new Error(`${dir} has no ${PACKS_FILE}: run \`node tools/release.mjs check\`, which packs the release and writes it`);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  for (const pack of manifest.packs) {
    const tarball = join(dir, pack.file);
    if (!existsSync(tarball)) throw new Error(`${pack.file} is missing from ${dir}: publish only what the release check packed`);
    const [algorithm, digest] = pack.integrity.split(/-(.*)/s);
    if (createHash(algorithm).update(readFileSync(tarball)).digest('base64') !== digest) throw new Error(`${pack.file} is not the tarball the release check packed (its ${algorithm} is not the one in ${PACKS_FILE}): publish only what the check proved`);
  }
  return manifest;
}

/** Why this npm cannot publish by trusted publishing (OIDC), or null: it needs npm 11.5.1 or later. */
export function npmProblem(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  const atLeast = major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1)));
  return atLeast ? null : `trusted publishing needs npm 11.5.1 or later; this one is ${version}`;
}

const npm = (args, env) => execFileSync('npm', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** What npm said as it failed: its error lines, or the error's own words. */
const npmSaid = (error) => {
  const lines = String(error.stderr ?? '')
    .split('\n')
    .filter((line) => /^npm (error|ERR!)/.test(line) && !/A complete log of this run/.test(line));
  return lines.length ? lines.join(' ') : error.message;
};

/**
 * Publish the packs in `manifest` (readPacks) from `dir`, in order. `env` is the environment npm runs in, without any
 * token of its own; `token` is what is added to it for `npm publish` alone, where one is used. `provenance` asks npm to
 * attest the build (in GitHub Actions); `dryRun` runs `npm publish --dry-run`, which publishes nothing.
 */
export function publishPacks({ dir, manifest, env = process.env, token = null, dryRun = false, provenance = false, run = npm, log = console.log }) {
  const { version } = manifest;
  const asking = withoutAuth(env);
  const publishing = { ...asking, ...(token ?? {}) };
  const onNpm = (name) => {
    try {
      return run(['view', `${name}@${version}`, 'version'], asking).trim() === version;
    } catch {
      return false; // npm answers 404 for a version it does not have
    }
  };
  const out = [];
  for (const [i, { name, file }] of manifest.packs.entries()) {
    if (onNpm(name)) {
      log(`  ${name}@${version} is already on npm`);
      continue;
    }
    try {
      run(['publish', join(dir, file), '--access', 'public', ...(provenance ? ['--provenance'] : []), ...(dryRun ? ['--dry-run'] : [])], publishing);
    } catch (error) {
      const rest = manifest.packs.slice(i).map((pack) => pack.name);
      throw new Error(
        `${name}@${version} could not be published: ${npmSaid(error)}\n` +
          `On npm now: ${out.length ? out.join(', ') : 'none of this release'}. Not published: ${rest.join(', ')}.\n` +
          `Run it again: what is on npm is left as it is, and the rest is published in order.`,
        { cause: error }
      );
    }
    out.push(name);
    log(dryRun ? `  would publish ${name}@${version} (npm publish --dry-run passed)` : `  published ${name}@${version}`);
  }
  return out;
}
