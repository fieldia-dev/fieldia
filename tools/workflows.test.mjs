import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The rules every GitHub workflow keeps (the audit's S-L12), read from the files as GitHub reads them:
 * - read access alone at the top (`permissions: contents: read`); a job that needs more says so for itself;
 * - each action named by the full commit it runs (a tag can be moved to other code; a commit cannot), with the tag it
 *   was in a comment beside it, for a person and for Dependabot;
 * - no checkout leaving its token in .git for the steps after it (`npm ci` runs third-party install scripts);
 * - never `pull_request_target`, which runs a fork's change with this repository's rights;
 * and the files beside them: Dependabot for npm and for the actions, and SECURITY.md.
 */

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const WORKFLOWS = join(WORKSPACE, '.github/workflows');
const workflows = readdirSync(WORKFLOWS)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(WORKFLOWS, name), 'utf8') }));

/** A top-level key's block: its line and the lines indented under it, up to the next top-level key. */
export function topLevel(text, key) {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (at === -1) return null;
  const end = lines.findIndex((line, i) => i > at && /^[A-Za-z_]/.test(line));
  return lines.slice(at, end === -1 ? undefined : end).join('\n');
}

/** Each job's block, by its id: the lines under `jobs:` indented two spaces, up to the next job. */
export function jobsOf(text) {
  const block = topLevel(text, 'jobs') ?? '';
  const jobs = {};
  let id = null;
  for (const line of block.split('\n').slice(1)) {
    const head = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (head) id = head[1];
    if (id) jobs[id] = `${jobs[id] ?? ''}${line}\n`;
  }
  return jobs;
}

test('there are workflows to read', () => {
  assert.ok(workflows.length >= 2, workflows.map((w) => w.name).join(', '));
});

for (const { name, text } of workflows) {
  test(`${name}: read access alone at the top`, () => {
    const permissions = topLevel(text, 'permissions');
    assert.ok(permissions, `${name} has no top-level permissions: every job would get the repository's default rights`);
    const granted = permissions
      .split('\n')
      .slice(1)
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter(Boolean);
    assert.deepEqual(granted, ['contents: read'], `${name}'s top-level permissions are ${granted.join(', ')}`);
  });

  test(`${name}: every action is named by the full commit it runs, its tag in a comment`, () => {
    const uses = [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)];
    assert.ok(uses.length, `${name} uses no action`);
    for (const [line, action, rest] of uses) {
      if (action.startsWith('./')) continue;
      assert.match(action, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${name}: ${line.trim()} names a tag or a branch, which can be moved to other code`);
      assert.match(rest, /^\s+#\s+v\d+(\.\d+){0,2}\s*$/, `${name}: ${line.trim()} says no tag beside its commit`);
    }
  });

  test(`${name}: no checkout leaves its token in .git for the steps after it`, () => {
    const steps = text.split(/^\s*- /m).filter((step) => /^uses:\s*actions\/checkout@/.test(step));
    for (const step of steps) assert.match(step, /\n\s+persist-credentials:\s*false\s*\n/, `${name}: a checkout keeps its token for the steps after it (npm ci's install scripts among them)`);
  });

  test(`${name}: never pull_request_target`, () => {
    assert.doesNotMatch(text, /pull_request_target/, `${name} runs a fork's change with this repository's rights`);
  });

  test(`${name}: no job is handed an npm token`, () => {
    assert.doesNotMatch(text, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.npm/i, `${name} hands a job an npm token`);
  });
}

test('the same action is pinned to the same commit in every workflow', () => {
  const seen = new Map();
  for (const { name, text } of workflows) {
    for (const [, action, commit, tag] of text.matchAll(/uses:\s*([\w.-]+\/[\w./-]+)@([0-9a-f]{40})\s+#\s+(\S+)/g)) {
      const before = seen.get(action);
      if (before) assert.deepEqual([commit, tag], before.pin, `${name} pins ${action} at ${tag} (${commit}), ${before.name} at ${before.pin[1]} (${before.pin[0]})`);
      else seen.set(action, { name, pin: [commit, tag] });
    }
  }
});

test('publish.yml: started by a v* tag or by hand, never by a branch or a pull request', () => {
  const text = readFileSync(join(WORKFLOWS, 'publish.yml'), 'utf8');
  const on = topLevel(text, 'on');
  assert.match(on, /^ {2}push:\n {4}tags: \['v\*'\]\n/m);
  assert.match(on, /^ {2}workflow_dispatch:\n/m);
  assert.doesNotMatch(on, /branches|pull_request|schedule|workflow_run/);
  assert.match(on, /dry_run:\n(?: {8}.*\n)*? {8}default: true/, 'started by hand, it is a dry run unless said otherwise');
});

test('publish.yml: only the publish job may ask for an OIDC token, on a pushed tag alone, running no npm ci and no build', () => {
  const jobs = jobsOf(readFileSync(join(WORKFLOWS, 'publish.yml'), 'utf8'));
  assert.deepEqual(Object.keys(jobs).sort(), ['build', 'dry-run', 'publish', 'verify']);
  const asking = Object.entries(jobs).filter(([, block]) => /id-token:\s*write/.test(block)).map(([id]) => id);
  assert.deepEqual(asking, ['publish']);
  const publish = jobs.publish;
  assert.match(publish, /^ {4}if: github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/tags\/v'\) && vars\.TRUSTED_PUBLISHING == 'on'$/m);
  assert.match(publish, /^ {4}environment:\n {6}name: npm$/m, 'the publish job is in the npm environment, which npm\'s trusted publisher names');
  assert.match(publish, /^ {4}permissions:\n {6}contents: read\n {6}id-token: write\n/m);
  // No third-party code where the token can be had: node and npm over the packs, nothing installed, nothing built.
  assert.doesNotMatch(publish, /npm ci|npm install|npx|nx run|release\.mjs/);
  assert.match(publish, /run: node tools\/publish-packs\.mjs tmp\/release\/packs --tag "\$TAG"\n/);
  assert.match(publish, /TAG: \$\{\{ github\.ref_name \}\}/);
  for (const [id, block] of Object.entries(jobs)) assert.match(block, /^ {4}permissions:\n {6}contents: read\n/m, `${id} says its own permissions`);
});

test('publish.yml: the build is clean — the lockfile alone, no cache, every package built, then the release check', () => {
  const text = readFileSync(join(WORKFLOWS, 'publish.yml'), 'utf8');
  const { build } = jobsOf(text);
  const code = text.replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(code, /cache:|registry-url/, 'a cache, or an .npmrc that expects a token');
  const order = ['run: npm ci', 'run: npx nx run-many -t build --skip-nx-cache', 'run: node tools/release.mjs check', 'actions/upload-artifact@'].map((step) => build.indexOf(step));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `the build's steps, in order: ${order.join(', ')}`);
});

test('publish.yml: the dry run publishes nothing — no OIDC token, npm publish --dry-run — and refuses to be told otherwise', () => {
  const jobs = jobsOf(readFileSync(join(WORKFLOWS, 'publish.yml'), 'utf8'));
  const dry = jobs['dry-run'];
  assert.match(dry, /^ {4}if: github\.event_name == 'workflow_dispatch'$/m);
  assert.doesNotMatch(dry, /id-token/);
  assert.match(dry, /run: node tools\/publish-packs\.mjs tmp\/release\/packs --dry-run\n/);
  assert.match(dry, /if: \$\{\{ !inputs\.dry_run \}\}\n\s+run: \|\n\s+echo "::error::This run publishes nothing\./);
  // The others do not run by hand: build is the dry run's too.
  assert.match(jobs.verify, /^ {4}needs: \[build, publish\]$/m);
  assert.match(jobs.verify, /^ {4}if: \$\{\{ always\(\) && github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/tags\/v'\)/m);
});

test('publish.yml: the publish job runs only once the owner turns trusted publishing on — a tag before that builds, checks and verifies', () => {
  const text = readFileSync(join(WORKFLOWS, 'publish.yml'), 'utf8');
  const jobs = jobsOf(text);
  // The gate is the repository's variable, nothing a pushed tag or a run's input can set.
  const gate = /^ {4}if: (.*)$/m.exec(jobs.publish)?.[1] ?? '';
  assert.match(gate, /&& vars\.TRUSTED_PUBLISHING == 'on'$/, `the publish job's condition is "${gate}"`);
  assert.doesNotMatch(gate, /inputs\.|github\.event\.inputs|\|\|/, 'the gate can be opened another way');
  // The npm environment is named by the publish job alone: a tag pushed before the gate is on never reaches it (GitHub
  // makes an environment, unprotected, the first time a job names it).
  const naming = Object.entries(jobs).filter(([, block]) => /^ {4}environment:/m.test(block)).map(([id]) => id);
  assert.deepEqual(naming, ['publish']);
  // Verify runs after the publish job, or after a publish of the old way while it is off; never after one that failed.
  assert.match(jobs.verify, /needs\.publish\.result == 'success' \|\| needs\.publish\.result == 'skipped'/);
  assert.match(jobs.verify, /needs\.build\.result == 'success'/);
  // Turning it on is the checklist's last step.
  const checklist = readFileSync(join(WORKSPACE, 'docs/maintainers/publishing.md'), 'utf8');
  const steps = [...checklist.matchAll(/^(\d+)\. (.*)$/gm)];
  assert.ok(steps.length >= 5, 'the checklist has no numbered steps');
  assert.match(steps[steps.length - 1][2], /TRUSTED_PUBLISHING/, `the checklist's last step is "${steps[steps.length - 1][2]}"`);
  assert.equal(steps.filter(([, , words]) => /TRUSTED_PUBLISHING/.test(words)).length, 1);
});

test('Dependabot keeps npm and the actions up to date, weekly, grouped', () => {
  const file = join(WORKSPACE, '.github/dependabot.yml');
  assert.ok(existsSync(file), '.github/dependabot.yml is missing');
  const text = readFileSync(file, 'utf8');
  assert.match(text, /^version: 2$/m);
  const updates = text.split(/^ {2}- package-ecosystem:\s*/m).slice(1);
  const ecosystems = updates.map((block) => `${block.split('\n')[0].replace(/['"]/g, '').trim()} ${/\n\s+directory:\s*(\S+)/.exec(block)?.[1]}`).sort();
  assert.deepEqual(ecosystems, ['github-actions /', 'npm /', 'npm /tools/angular-newest']);
  for (const block of updates) {
    assert.match(block, /interval:\s*['"]?weekly/, `${block.split('\n')[0]} is not weekly`);
    assert.match(block, /\n\s+groups:\n/, `${block.split('\n')[0]} is not grouped`);
  }
});

/** The workspace's npm block in .github/dependabot.yml: what it leaves to a person. */
const workspaceIgnores = () => {
  const text = readFileSync(join(WORKSPACE, '.github/dependabot.yml'), 'utf8');
  const npm = text.split(/^ {2}- package-ecosystem:\s*/m).find((block) => /^npm\n\s+directory: \/\n/.test(block)) ?? '';
  return [...npm.matchAll(/- dependency-name: '([^']+)'\n\s+update-types: \['version-update:semver-major'\]/g)].map(([, name]) => name);
};

test('the workspace builds the Angular bindings with the oldest Angular they support; a new major goes to tools/angular-newest', () => {
  // The bindings are built by the workspace's Angular, and an app's linker refuses a declaration newer than itself.
  assert.ok(workspaceIgnores().includes('@angular/*'), "Dependabot would move the workspace's Angular to a new major, and the bindings would no longer link on the oldest their peer range names");
  const root = JSON.parse(readFileSync(join(WORKSPACE, 'package.json'), 'utf8')).devDependencies;
  const newest = JSON.parse(readFileSync(join(WORKSPACE, 'tools/angular-newest/package.json'), 'utf8')).devDependencies;
  const major = (version) => Number(/^(\d+)\./.exec(version)?.[1]);
  for (const manifest of ['libs/angular/package.json', 'libs/designer/package.json']) {
    const range = JSON.parse(readFileSync(join(WORKSPACE, manifest), 'utf8')).peerDependencies['@angular/core'];
    assert.match(range, new RegExp(`^\\^${major(root['@angular/core'])}\\.0\\.0 \\|\\| .*\\^${major(newest['@angular/core'])}\\.0\\.0$`), `${manifest}'s peer range ${range} does not run from the workspace's Angular to tools/angular-newest's`);
  }
  assert.ok(major(newest['@angular/core']) > major(root['@angular/core']), 'tools/angular-newest is not newer than the workspace');
  assert.match(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'), /\n {6}- run: node tools\/angular-newest\.mjs\n/, 'CI does not run the bindings on the newest Angular');
});

test("@types/node is the Node the tools run on: .nvmrc's major", () => {
  const node = readFileSync(join(WORKSPACE, '.nvmrc'), 'utf8').trim();
  const types = JSON.parse(readFileSync(join(WORKSPACE, 'package.json'), 'utf8')).devDependencies['@types/node'];
  assert.equal(/^[~^]?(\d+)\./.exec(types)?.[1], /^v?(\d+)/.exec(node)?.[1], `@types/node ${types} types another Node than .nvmrc's ${node}, which CI and the tools run on`);
  assert.ok(workspaceIgnores().includes('@types/node'), "Dependabot would move @types/node past .nvmrc's Node");
});

test('SECURITY.md says how to report privately, the disclosure window and the versions supported', () => {
  const file = join(WORKSPACE, 'SECURITY.md');
  assert.ok(existsSync(file), 'SECURITY.md is missing');
  const text = readFileSync(file, 'utf8');
  assert.match(text, /github\.com\/fieldia-dev\/fieldia\/security\/advisories\/new/, 'no link to GitHub\'s private advisory form');
  assert.match(text, /90 days/, 'no disclosure window');
  assert.match(text, /^## Supported versions/m, 'no supported versions');
});

// The flake log (tools/flake-log.mjs, the audit's R-M14): with `retries: 0`, what failed is run once more on the same
// commit, and what passed then is a flake — said in the job's summary and kept as its artifact.
test('every browser job of ci.yml writes its report, runs what failed again, says its flake log and keeps it', () => {
  const jobs = jobsOf(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'));
  const browserJobs = Object.entries(jobs).filter(([, block]) => /npx playwright test/.test(block));
  assert.ok(browserJobs.length >= 5, browserJobs.map(([id]) => id).join(', '));
  for (const [id, block] of browserJobs) {
    const runs = [...block.matchAll(/run: npx playwright test[^\n]*\n(?:\s+env:\n(?:\s{10,}[^\n]*\n)+)?/g)].map((m) => m[0]);
    assert.ok(runs.length, `${id}: no run of Playwright read`);
    for (const run of runs) assert.match(run, /PLAYWRIGHT_JSON_OUTPUT_NAME: flake-log\/first(-[\w-]+)?\.json/, `${id}: a run writes no report for the flake log`);
    assert.match(block, /if: failure\(\) && steps\.[\w-]+\.outcome == 'failure'[^\n]*\n\s+run: node tools\/flake-log\.mjs rerun flake-log /, `${id}: what failed is not run again`);
    assert.match(block, /if: always\(\)\n\s+run: node tools\/flake-log\.mjs log flake-log --job "[^"]+" >> "\$GITHUB_STEP_SUMMARY"/, `${id}: the flake log is not said in the job's summary`);
    assert.match(block, /name: flake-log-[^\n]+\n\s+path: flake-log\/flakes\.json/, `${id}: the flake log is not kept as an artifact`);
  }
});

// The key screens (e2e/screens.spec.ts, the audit's R-M13): compared in one container, the one tools/screens.mjs runs
// locally, by its digest, and its Playwright the one package.json installs — so a stored image and CI's agree.
test('ci.yml: the key screens are compared in the Playwright container tools/screens.mjs names, of package.json’s Playwright', async () => {
  const { IMAGE } = await import('./screens.mjs');
  const { screens } = jobsOf(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'));
  assert.ok(screens, 'ci.yml has no screens job');
  assert.match(IMAGE, /^mcr\.microsoft\.com\/playwright:v[\d.]+-[a-z]+@sha256:[0-9a-f]{64}$/, 'the container is named by its digest, which cannot be moved to other code');
  assert.ok(screens.includes(`    container:\n      image: ${IMAGE}\n`), `the screens job runs in another container than ${IMAGE}`);
  const playwright = JSON.parse(readFileSync(join(WORKSPACE, 'package.json'), 'utf8')).devDependencies['@playwright/test'];
  assert.ok(IMAGE.includes(`:v${playwright}-`), `the container is Playwright ${/:v([\d.]+)-/.exec(IMAGE)?.[1]}, package.json's ${playwright}: move both, and store the screens again`);
  assert.match(screens, /^ {6}FIELDIA_SCREENS: container$/m, 'the screens job does not say it is the container (the spec refuses to compare elsewhere)');
  assert.match(screens, /run: npx playwright test --project=screens\n/);
});
