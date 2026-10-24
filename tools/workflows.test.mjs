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

test('Dependabot keeps npm and the actions up to date, weekly, grouped', () => {
  const file = join(WORKSPACE, '.github/dependabot.yml');
  assert.ok(existsSync(file), '.github/dependabot.yml is missing');
  const text = readFileSync(file, 'utf8');
  assert.match(text, /^version: 2$/m);
  const updates = text.split(/^ {2}- package-ecosystem:\s*/m).slice(1);
  const ecosystems = updates.map((block) => block.split('\n')[0].replace(/['"]/g, '').trim()).sort();
  assert.deepEqual(ecosystems, ['github-actions', 'npm']);
  for (const block of updates) {
    assert.match(block, /interval:\s*['"]?weekly/, `${block.split('\n')[0]} is not weekly`);
    assert.match(block, /\n\s+groups:\n/, `${block.split('\n')[0]} is not grouped`);
  }
});

test('SECURITY.md says how to report privately, the disclosure window and the versions supported', () => {
  const file = join(WORKSPACE, 'SECURITY.md');
  assert.ok(existsSync(file), 'SECURITY.md is missing');
  const text = readFileSync(file, 'utf8');
  assert.match(text, /github\.com\/fieldia-dev\/fieldia\/security\/advisories\/new/, 'no link to GitHub\'s private advisory form');
  assert.match(text, /90 days/, 'no disclosure window');
  assert.match(text, /^## Supported versions/m, 'no supported versions');
});
