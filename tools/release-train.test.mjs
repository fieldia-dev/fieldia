/**
 * The release train (docs/maintainers/release-train.md; the audit's R-H7, R-H8): a minor changes nothing that was not
 * deprecated in the minor before, says what it deprecates, and every console warning of a deprecation is one the list
 * has.
 *   node --test tools/release-train.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { itemsOf, partOf, readDeprecations, registryProblems, TRAIN_FROM, trainProblems } from './release-train.mjs';
import { releaseProblems } from './release-guards.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const changelog = readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8');

/** A deprecation as the list writes one. */
const entry = (id, since, changesIn, more = {}) => ({ id, since, changesIn, who: 'app code', words: 'something that changes, and what to write instead', warns: 'console', ...more });

const SAMPLE = `# Changelog

## 0.38.0 — 2026-12-01

**Lists.** A list sorts.

**Upgrading** — grouped by who it touches:

- *Page authors:* nothing changes.
- *App code:*
  - \`mountViewer\` no longer throws for a page it refuses (deprecated in 0.37: \`viewer.mount-throws\`): give
    \`onError\`.
  - The \`Form\` interface gains \`nodeReads\`: a fake adds it (adds).
- *Tests and CSS:* a press ends a drag where it began (fix).

## 0.37.0 — 2026-11-10

**Deprecated:**

- \`viewer.mount-throws\`: \`mountViewer\` throws for a page it refuses; from 0.38 it shows why and tells \`onError\`.

**Upgrading:** a list's header is a button (fix).

## 0.36.0 — 2026-10-27

**Upgrading** — grouped by who it touches:

- *App code:* the viewer refuses a page \`validatePage\` refuses.
`;

const LIST = [entry('viewer.mount-throws', '0.37', '0.38')];

test('a minor whose Upgrading items each say what they are, its changes deprecated a minor before, keeps the train', () => {
  assert.deepEqual(trainProblems({ version: '0.38.0', changelog: SAMPLE, deprecations: LIST }), []);
  assert.deepEqual(trainProblems({ version: '0.37.0', changelog: SAMPLE, deprecations: LIST }), []);
});

test('the train holds from its first minor: before it, an Upgrading item need not say what it is', () => {
  assert.equal(TRAIN_FROM, '0.37.0');
  assert.deepEqual(trainProblems({ version: '0.36.0', changelog: SAMPLE, deprecations: [] }), []);
  const next = SAMPLE.replace(' (fix).\n\n## 0.36.0', '.\n\n## 0.36.0');
  // 0.37.0's "a list's header is a button" says nothing of what it is: refused from the train's first minor.
  assert.match(trainProblems({ version: '0.37.0', changelog: next, deprecations: LIST }).join('\n'), /0\.37\.0's Upgrading item "a list's header is a button\." does not say what it is/);
});

test('a change not deprecated a minor before is refused, in words', () => {
  const untagged = SAMPLE.replace(' (deprecated in 0.37: `viewer.mount-throws`)', '');
  const problems = trainProblems({ version: '0.38.0', changelog: untagged, deprecations: LIST });
  assert.match(problems.join('\n'), /0\.38\.0's Upgrading item "`mountViewer` no longer throws for a page it refuses: give `onError`\." does not say what it is/);
  // …and the deprecation that says it changes in 0.38 is not cited where it changes.
  assert.match(problems.join('\n'), /DEPRECATIONS says `viewer\.mount-throws` changes in 0\.38: cite it in 0\.38\.0's Upgrading part/);
  // Cited, but not in the list: a change is deprecated before it is made.
  assert.match(trainProblems({ version: '0.38.0', changelog: SAMPLE, deprecations: [] }).join('\n'), /cites `viewer\.mount-throws`, which DEPRECATIONS does not have/);
  // Cited, but the list says it changes later.
  assert.match(trainProblems({ version: '0.38.0', changelog: SAMPLE, deprecations: [entry('viewer.mount-throws', '0.37', '0.39')] }).join('\n'), /which DEPRECATIONS says changes in 0\.39, not 0\.38/);
  // Cited with another minor than the list's.
  assert.match(trainProblems({ version: '0.38.0', changelog: SAMPLE.replace('deprecated in 0.37', 'deprecated in 0.36'), deprecations: LIST }).join('\n'), /says `viewer\.mount-throws` was deprecated in 0\.36; DEPRECATIONS says 0\.37/);
});

test('a minor every 2–4 weeks: none sooner than 14 days after the minor before, from the train\'s first', () => {
  const soon = SAMPLE.replace('## 0.38.0 — 2026-12-01', '## 0.38.0 — 2026-11-20');
  assert.match(trainProblems({ version: '0.38.0', changelog: soon, deprecations: LIST }).join('\n'), /0\.38\.0 is dated 2026-11-20, 10 days after 0\.37\.0 \(2026-11-10\): a minor comes 14 days after the one before at the soonest/);
  assert.deepEqual(trainProblems({ version: '0.38.0', changelog: SAMPLE.replace('## 0.38.0 — 2026-12-01', '## 0.38.0 — 2026-11-24'), deprecations: LIST }), []);
  // 0.36 came two days after 0.35, before the train: not refused.
  assert.deepEqual(trainProblems({ version: '0.36.0', changelog: `## 0.36.0 — 2026-10-27\n\nA list.\n\n## 0.35.0 — 2026-10-25\n\nA form.\n`, deprecations: [] }), []);
});

test('a deprecation is listed under Deprecated in the minor that first warns of it, by its id', () => {
  const unlisted = SAMPLE.replace('- `viewer.mount-throws`: `mountViewer` throws', '- `mountViewer` throws');
  assert.match(trainProblems({ version: '0.37.0', changelog: unlisted, deprecations: LIST }).join('\n'), /0\.37\.0 first warns of `viewer\.mount-throws` \(DEPRECATIONS: since 0\.37\): list it under \*\*Deprecated\*\*/);
  // A Deprecated part naming what the list does not have.
  assert.match(trainProblems({ version: '0.37.0', changelog: SAMPLE, deprecations: [] }).join('\n'), /Deprecated part names `viewer\.mount-throws`, which DEPRECATIONS .* does not have/);
});

test('the list itself: ids, minors, a change after its warning, who and how it is said', () => {
  assert.deepEqual(registryProblems(LIST), []);
  const said = registryProblems([
    entry('MountThrows', '0.37', '0.38'),
    entry('viewer.same', '0.37', '0.37'),
    entry('viewer.same', '0.37', '0.38'),
    entry('viewer.who', '0.37', '0.38', { who: 'everyone', warns: 'sometimes', words: '' }),
    entry('viewer.minor', '0.37.1', 'next'),
  ]).join('\n');
  assert.match(said, /deprecation MountThrows: an id is dotted words/);
  assert.match(said, /viewer\.same: it changes in 0\.37, which is not after 0\.37/);
  assert.match(said, /viewer\.same is listed twice/);
  assert.match(said, /viewer\.who: who is one of/);
  assert.match(said, /viewer\.who: words say what changes/);
  assert.match(said, /viewer\.who: warns is "console"/);
  assert.match(said, /viewer\.minor: since is the minor/);
  assert.match(said, /viewer\.minor: changesIn is the minor/);
});

test('an Upgrading part read as items: a group heading is none, words alone are one, "nothing changes" is none', () => {
  const lines = partOf(SAMPLE.split('## 0.38.0')[1].split('## 0.37.0')[0], 'Upgrading');
  const items = itemsOf(lines);
  assert.equal(items.length, 3);
  assert.match(items[0], /^`mountViewer` no longer throws .* give `onError`\.$/);
  assert.deepEqual(itemsOf(['**Upgrading:** a list\'s header is a button (fix).']), ["a list's header is a button (fix)."]);
  assert.deepEqual(itemsOf(['**Upgrading:** nothing changes.']), []);
});

test('publishing refuses a minor that breaks the train (release-guards.mjs)', () => {
  const facts = { head: 'a1b2c3d4e5f6', changed: [], onMain: true, tags: ['v0.38.0'] };
  const untagged = SAMPLE.replace(' (deprecated in 0.37: `viewer.mount-throws`)', '');
  assert.match(releaseProblems({ version: '0.38.0', changelog: untagged, facts, deprecations: LIST }).join('\n'), /does not say what it is/);
  assert.deepEqual(releaseProblems({ version: '0.38.0', changelog: SAMPLE, facts, deprecations: LIST }), []);
});

test('Fieldia\'s own CHANGELOG and deprecations keep the train, every minor', async () => {
  const deprecations = await readDeprecations(WORKSPACE);
  assert.deepEqual(registryProblems(deprecations), []);
  const minors = [...changelog.matchAll(/^## (\d+\.\d+\.0)\b/gm)].map((m) => m[1]);
  assert.ok(minors.length > 30, 'the minors released');
  for (const version of minors) assert.deepEqual(trainProblems({ version, changelog, deprecations }), [], version);
});

// ---- the console warnings and the list held to each other ---------------------------------------------------------

/** Every source file of the packages but their specs. */
function sources(dir = join(WORKSPACE, 'libs')) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.(spec|test)\.|test-parts\.ts$/.test(name)) out.push(path);
  }
  return out;
}

/** The deprecations a source warns of: each `deprecated('id', …, '0.N')` call, by its id and the minor it says. */
export function warnedIn(text) {
  return [...text.matchAll(/\bdeprecated\(\s*'([^']+)'[\s\S]*?,\s*'(\d+\.\d+)'\s*\)/g)].map((m) => ({ id: m[1], changesIn: m[2] }));
}

/** What is wrong between the warnings in `files` (path → text) and the list: an id it lacks, another minor, one never warned. */
export function warningProblems(files, deprecations) {
  const problems = [];
  const warned = new Set();
  for (const [path, text] of Object.entries(files)) {
    if (/lib\/deprecations\.ts$/.test(path)) continue;
    for (const { id, changesIn } of warnedIn(text)) {
      warned.add(id);
      const found = deprecations.find((one) => one.id === id);
      if (!found) problems.push(`${path} warns of \`${id}\`, which DEPRECATIONS does not have`);
      else if (found.changesIn !== changesIn) problems.push(`${path} says \`${id}\` changes in ${changesIn}; DEPRECATIONS says ${found.changesIn}`);
    }
  }
  for (const one of deprecations.filter((d) => d.warns === 'console' && !warned.has(d.id))) problems.push(`\`${one.id}\` is said in the console (warns: "console"), but nothing calls deprecated('${one.id}', …)`);
  return problems;
}

test('every deprecation the packages warn of is in the list, with its minor, and every one the list says is warned of', async () => {
  const files = Object.fromEntries(sources().map((path) => [relative(WORKSPACE, path), readFileSync(path, 'utf8')]));
  assert.ok(Object.keys(files).length > 500, 'the packages\' sources read');
  assert.deepEqual(warningProblems(files, await readDeprecations(WORKSPACE)), []);
});

test('the warnings check bites: an id the list lacks, another minor, a console deprecation never said', () => {
  const files = { 'libs/viewer/src/lib/a.ts': "deprecated('viewer.old-way', 'the old way', '0.38');\ndeprecated(\n  'viewer.other',\n  `words`,\n  '0.39'\n);" };
  const said = warningProblems(files, [entry('viewer.other', '0.37', '0.38'), entry('viewer.never', '0.37', '0.38'), entry('viewer.css', '0.37', '0.38', { warns: 'changelog' })]).join('\n');
  assert.match(said, /warns of `viewer\.old-way`, which DEPRECATIONS does not have/);
  assert.match(said, /says `viewer\.other` changes in 0\.39; DEPRECATIONS says 0\.38/);
  assert.match(said, /`viewer\.never` is said in the console .* nothing calls deprecated\('viewer\.never'/);
  assert.doesNotMatch(said, /viewer\.css/);
});
