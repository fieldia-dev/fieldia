/**
 * The publish workflow's last step (.github/workflows/publish.yml): publish the packs `node tools/release.mjs check`
 * made and proved in the workflow's build job, from GitHub Actions, by npm's trusted publishing — npm asks GitHub for
 * a short-lived OIDC token for this one run and trades it for a publish; no npm token exists anywhere — with
 * provenance, so npm's page for each version links the commit and the run that built it.
 *
 *   node tools/publish-packs.mjs <packs> --tag v0.34.0   publish: in the workflow's publish job alone, on its tag
 *   node tools/publish-packs.mjs <packs> --dry-run       everything a publish does, with `npm publish --dry-run`: nothing
 *                                                        is published, and what a real run would refuse is said
 *
 * It refuses, in words: packs that are not the ones packs.json names (release-publish.mjs), packs made from another
 * commit or version than this checkout's, a release that is not tagged at HEAD with its own version, not on
 * origin/main, from a tree with changes, a patch with an Upgrading part or a minor that changes what was not deprecated
 * a minor before (release-guards.mjs, release-train.mjs), a minor no one checked on a real iPhone and Android phone
 * (real-devices.mjs), an npm too old for
 * trusted publishing, and a run with no OIDC token to ask for (anywhere but the publish job). On a maintainer's machine
 * a release is published by `node tools/release.mjs publish` instead, until npm is switched to trusted publishing
 * (docs/maintainers/publishing.md).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gitFacts, releaseProblems } from './release-guards.mjs';
import { readDeprecations } from './release-train.mjs';
import { devicesProblem } from './real-devices.mjs';
import { npmProblem, publishPacks, readPacks } from './release-publish.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const {
  positionals: [dir],
  values: { 'dry-run': dryRun = false, tag = null },
} = parseArgs({ options: { 'dry-run': { type: 'boolean' }, tag: { type: 'string' } }, allowPositionals: true });
const fail = (message) => {
  console.error(`publish: ${message}`);
  process.exit(1);
};
if (!dir) fail('usage: node tools/publish-packs.mjs <packs folder> (--tag v<version> | --dry-run)');
if (!dryRun && !tag) fail('a real publish names the tag it was started by (--tag v<version>); a test of it is --dry-run');

const version = JSON.parse(readFileSync(join(WORKSPACE, 'libs/core/package.json'), 'utf8')).version;
const changelog = readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8');
let manifest;
try {
  manifest = readPacks(resolve(dir));
} catch (error) {
  fail(error.message);
}

const problems = [];
const facts = gitFacts(WORKSPACE);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WORKSPACE, encoding: 'utf8' }).trim();
if (manifest.version !== version) problems.push(`the packs are ${manifest.version}, but this checkout's packages are ${version}`);
if (manifest.commit !== head) problems.push(`the packs were made from ${manifest.commit.slice(0, 12)}, but this checkout is ${head.slice(0, 12)}`);
problems.push(...releaseProblems({ version, changelog, facts, tag, deprecations: await readDeprecations(WORKSPACE) }));
// A minor, once a real iPhone and a real Android phone were checked for it (real-devices.mjs).
const devices = devicesProblem(WORKSPACE, version);
if (devices) problems.push(devices);
const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const tooOld = npmProblem(npmVersion);
if (tooOld) problems.push(tooOld);
// npm asks GitHub for the OIDC token through these; a job is given them by `permissions: id-token: write` alone.
const oidc = Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);

console.log(`${dryRun ? 'dry run of the publish' : 'publish'} of Fieldia ${version} from ${head.slice(0, 12)}${tag ? ` (${tag})` : ''}, npm ${npmVersion}: ${manifest.packs.map((p) => p.name).join(', ')}`);
if (dryRun) {
  for (const problem of problems) console.log(`  a real run would refuse: ${problem}`);
  console.log(oidc ? '  this run could ask GitHub for an OIDC token: a dry run is not given one (permissions: id-token)' : '  no OIDC token can be asked for here, as a dry run should be: a real run asks for one in the publish job alone');
} else {
  if (!oidc) problems.push('no OIDC token can be asked for here: this publishes from the publish workflow\'s publish job alone (`permissions: id-token: write`); on a maintainer\'s machine a release is published by `node tools/release.mjs publish`');
  if (problems.length) fail(`nothing was published:\n  ${problems.join('\n  ')}`);
}

try {
  publishPacks({ dir: resolve(dir), manifest, env: process.env, dryRun, provenance: true });
} catch (error) {
  fail(error.message);
}

if (dryRun) {
  console.log(`\nDry run: nothing was published.${problems.length ? ` A real run from here would refuse (${problems.length} above).` : ' A real run from here would publish what is above.'}`);
} else {
  // Its GitHub release is a person's to make: this job may read the repository, never write to it.
  const said = `Fieldia ${version} is on npm, with provenance. Next, on a maintainer's machine (docs/maintainers/publishing.md): \`node tools/release-notes.mjs ${version}\` prints the command that makes its GitHub release from its notes, and \`node tools/release.mjs verify\` checks what npm serves and records its script tags' hashes, to commit.`;
  console.log(`\n${said}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${said}\n`);
}
