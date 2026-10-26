/**
 * The release train's rule, as the release tools check it (docs/maintainers/release-train.md; the audit's R-H7, R-H8):
 * nothing an app, a page or a test relies on changes without a minor's warning first.
 *
 * - Every deprecation is written in `DEPRECATIONS` (libs/core/src/lib/deprecations.ts): its id, the minor that first
 *   warns of it (`since`) and the minor that changes it (`changesIn`, later than `since`), who it touches.
 * - The minor that first warns of one lists it under **Deprecated** in its CHANGELOG section, by its id.
 * - From `TRAIN_FROM` on, every item of a minor's Upgrading part says what it is: `(adds)` — something new an app may
 *   have to follow, a label key, a member a fake adds —, `(fix)` — Fieldia made to do what its docs already said —, or
 *   `(deprecated in 0.N: \`id\`)`, a change warned of a minor before, whose entry says it changes in this minor. And
 *   every entry that says it changes in this minor is cited there.
 *
 * - A minor comes every 2–4 weeks: from `TRAIN_FROM` on, none is dated sooner than `MINOR_DAYS` after the minor before.
 *
 * `release.mjs check` says what is wrong; `publish` (and the publish workflow's tools/publish-packs.mjs) refuses it, as
 * it refuses a patch with an Upgrading part (release-guards.mjs).
 */
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { notesFor } from './release-notes.mjs';

/** The first minor the train holds to: 0.36 brought the deprecations list, so nothing could be deprecated before it. */
export const TRAIN_FROM = '0.37.0';
/** The fewest days between two minors: one comes every 2–4 weeks, fixes between. */
export const MINOR_DAYS = 14;
/** Who a change touches, as an Upgrading part groups them. */
const WHO = ['page authors', 'app code', 'tests and CSS', 'self-hosters'];
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const MINOR = /^(\d+)\.(\d+)$/;
/** A part of a section: a bold heading at a line's start (`**Upgrading**`, `**Deprecated:**`, `**Size:**`). */
const PART = /^\*\*([A-Z][^*]*)\*\*/;

/**
 * The deprecations recorded in the workspace: the core's own list, its file read as a module with its types left out
 * (it imports nothing).
 */
export async function readDeprecations(workspace) {
  const source = stripTypeScriptTypes(readFileSync(join(workspace, 'libs/core/src/lib/deprecations.ts'), 'utf8'));
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  return module.DEPRECATIONS;
}

/** `[major, minor]` of `0.36` or `0.36.2`, or null. */
function minorOf(version) {
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(String(version));
  return match ? [Number(match[1]), Number(match[2])] : null;
}
const compare = (a, b) => a[0] - b[0] || a[1] - b[1];

/** What is wrong with the list itself, in words: each entry well formed, its id once, a change later than its warning. */
export function registryProblems(deprecations) {
  const problems = [];
  const seen = new Set();
  for (const entry of deprecations) {
    const name = entry?.id ?? '(an entry with no id)';
    if (typeof entry?.id !== 'string' || !ID.test(entry.id)) problems.push(`deprecation ${name}: an id is dotted words in small letters, the package or area first: "viewer.mount-throws"`);
    if (seen.has(entry?.id)) problems.push(`deprecation ${name} is listed twice`);
    seen.add(entry?.id);
    const since = MINOR.test(entry?.since ?? '') ? minorOf(entry.since) : null;
    const changes = MINOR.test(entry?.changesIn ?? '') ? minorOf(entry.changesIn) : null;
    if (!since) problems.push(`deprecation ${name}: since is the minor that first warns of it, as "0.36"`);
    if (!changes) problems.push(`deprecation ${name}: changesIn is the minor that changes it, as "0.37"`);
    if (since && changes && compare(changes, since) <= 0) problems.push(`deprecation ${name}: it changes in ${entry.changesIn}, which is not after ${entry.since}, the minor that warns of it: a change waits a minor`);
    if (!WHO.includes(entry?.who)) problems.push(`deprecation ${name}: who is one of ${WHO.map((w) => `"${w}"`).join(', ')}`);
    if (typeof entry?.words !== 'string' || entry.words.trim().length < 12) problems.push(`deprecation ${name}: words say what changes and what to write instead`);
    if (entry?.warns !== 'console' && entry?.warns !== 'changelog') problems.push(`deprecation ${name}: warns is "console", where a use is seen as Fieldia runs, or "changelog", where none can be`);
  }
  return problems;
}

/** The lines of a section's part named `name` (`Upgrading`, `Deprecated`), from its heading to the next part; null when it has none. */
export function partOf(body, name) {
  const lines = body.split('\n');
  const at = lines.findIndex((line) => PART.test(line) && PART.exec(line)[1].replace(/[.:]\s*$/, '').trim().startsWith(name));
  if (at === -1) return null;
  const end = lines.findIndex((line, i) => i > at && PART.test(line));
  return lines.slice(at, end === -1 ? undefined : end);
}

/**
 * The items of a part: each bullet with the lines under it, a group's heading (`- *App code:*` with bullets under it)
 * not one of them; a part written as words alone, with no bullets, is one item. "Nothing changes" says there is none.
 */
export function itemsOf(lines) {
  const [head, ...rest] = lines;
  const bullets = [];
  for (const line of rest) {
    const bullet = /^(\s*)- (.*)$/.exec(line);
    if (bullet) bullets.push({ depth: bullet[1].length, text: bullet[2] });
    else if (bullets.length && line.trim()) bullets[bullets.length - 1].text += ` ${line.trim()}`;
  }
  const inline = head.replace(PART, '').replace(/^[\s.:—-]+/, '').trim();
  const items = bullets.filter((bullet, i) => !(bullets[i + 1] && bullets[i + 1].depth > bullet.depth)).map((bullet) => bullet.text);
  if (!bullets.length && inline) items.push(inline);
  return items.filter((item) => !/\bnothing (?:changes|to upgrade)\b/i.test(item));
}

/** The deprecation ids an item cites: `(deprecated in 0.36: \`a.b\`, \`c.d\`)`, with the minor it says. */
function citedIn(item) {
  const cited = [];
  for (const match of item.matchAll(/\(deprecated in (\d+\.\d+): ((?:`[^`]+`(?:,\s*)?)+)\)/g)) {
    for (const id of match[2].matchAll(/`([^`]+)`/g)) cited.push({ id: id[1], since: match[1] });
  }
  return cited;
}

/**
 * Every reason `version`'s CHANGELOG section breaks the train, in words; none when it keeps it. A patch is held by
 * release-guards.mjs (no Upgrading part at all); here, a minor: what its Upgrading part changes was deprecated a minor
 * before, and what it deprecates it says.
 */
export function trainProblems({ version, changelog, deprecations = [] }) {
  const problems = [...registryProblems(deprecations)];
  const [major, minor, patch] = String(version).split('.').map(Number);
  if (patch > 0) return problems;
  const notes = notesFor(changelog, version);
  if (!notes) return problems;
  const here = `${major}.${minor}`;
  // What this minor first warns of: listed under its Deprecated part, each by its id, and nothing else there.
  const deprecatedPart = partOf(notes.body, 'Deprecated');
  const listed = new Set((deprecatedPart ?? []).join('\n').match(/`[a-z][a-z0-9.-]*\.[a-z0-9.-]+`/g)?.map((id) => id.slice(1, -1)) ?? []);
  for (const entry of deprecations.filter((one) => one.since === here)) {
    if (!listed.has(entry.id)) problems.push(`${version} first warns of \`${entry.id}\` (DEPRECATIONS: since ${entry.since}): list it under **Deprecated** in its CHANGELOG section, by its id, with what to write instead`);
  }
  for (const id of listed) {
    const entry = deprecations.find((one) => one.id === id);
    if (!entry) problems.push(`${version}'s Deprecated part names \`${id}\`, which DEPRECATIONS (libs/core/src/lib/deprecations.ts) does not have: write it there, since ${here}`);
    else if (entry.since !== here) problems.push(`${version}'s Deprecated part names \`${id}\`, which DEPRECATIONS says was first warned of in ${entry.since}`);
  }
  if (compare([major, minor], minorOf(TRAIN_FROM)) < 0) return problems;
  // A minor every 2–4 weeks: none sooner than MINOR_DAYS after the minor before it, by their headings' dates.
  const before = [...changelog.matchAll(/^## (\d+)\.(\d+)\.0\b/gm)].map((m) => [Number(m[1]), Number(m[2])]).filter((one) => compare(one, [major, minor]) < 0).sort(compare).pop();
  const previous = before && notesFor(changelog, `${before[0]}.${before[1]}.0`);
  if (notes.date && previous?.date) {
    const days = Math.round((Date.parse(notes.date) - Date.parse(previous.date)) / 86_400_000);
    if (days < MINOR_DAYS) problems.push(`${version} is dated ${notes.date}, ${days} day${days === 1 ? '' : 's'} after ${previous.version} (${previous.date}): a minor comes ${MINOR_DAYS} days after the one before at the soonest — release what is ready as a patch of fixes, or wait`);
  }
  // What this minor changes: each item of its Upgrading part says what it is; a change, the deprecation that warned of it.
  const upgrading = partOf(notes.body, 'Upgrading');
  const cites = new Set();
  for (const item of upgrading ? itemsOf(upgrading) : []) {
    const cited = citedIn(item);
    const short = item.length > 90 ? `${item.slice(0, 87)}…` : item;
    if (!cited.length && !/\((?:adds|fix)\)/.test(item)) {
      problems.push(`${version}'s Upgrading item "${short}" does not say what it is: (adds) for something new to follow, (fix) for Fieldia made to do what its docs said, or (deprecated in 0.N: \`id\`) for a change warned of a minor before`);
    }
    for (const { id, since } of cited) {
      cites.add(id);
      const entry = deprecations.find((one) => one.id === id);
      if (!entry) problems.push(`${version}'s Upgrading item cites \`${id}\`, which DEPRECATIONS does not have: a change is deprecated a minor before it is made`);
      else if (entry.changesIn !== here) problems.push(`${version}'s Upgrading item cites \`${id}\`, which DEPRECATIONS says changes in ${entry.changesIn}, not ${here}`);
      else if (entry.since !== since) problems.push(`${version}'s Upgrading item says \`${id}\` was deprecated in ${since}; DEPRECATIONS says ${entry.since}`);
      else if (compare(minorOf(entry.since), [major, minor]) >= 0) problems.push(`\`${id}\` is deprecated in ${entry.since} and changed in ${here}: a change waits a minor after its warning`);
    }
  }
  for (const entry of deprecations.filter((one) => one.changesIn === here)) {
    if (!cites.has(entry.id)) problems.push(`DEPRECATIONS says \`${entry.id}\` changes in ${here}: cite it in ${version}'s Upgrading part as (deprecated in ${entry.since}: \`${entry.id}\`), or move its changesIn to a later minor`);
  }
  return problems;
}
