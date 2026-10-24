/**
 * A release's notes, read from CHANGELOG.md, and the commands that tag it and make its GitHub release.
 * Nothing here runs those commands: a person runs them — the tag before the packages are published (release-guards.mjs),
 * the GitHub release once they are on npm.
 *
 *   node tools/release-notes.mjs [version]   the notes and the commands for a version (the packages' own by default)
 *   node tools/release-notes.mjs --history   the commands for every release before, each tagged at the commit that made it
 *
 * tools/release.mjs refuses a version with no notes, and prints these at the end of `publish`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** A version's section of the changelog: `## 0.20.0 — 2026-10-13`, up to the next `## `. Null when it has none. */
export function notesFor(changelog, version) {
  const lines = changelog.split('\n');
  const escaped = version.replace(/\./g, '\\.');
  const head = new RegExp(`^## ${escaped}(?![0-9.])(?:\\s+[—-]\\s+(\\d{4}-\\d{2}-\\d{2}))?`);
  const at = lines.findIndex((line) => head.test(line));
  if (at === -1) return null;
  const end = lines.findIndex((line, i) => i > at && /^## /.test(line));
  const body = lines.slice(at + 1, end === -1 ? undefined : end).join('\n').trim();
  return { version, date: head.exec(lines[at])?.[1] ?? null, body };
}

/**
 * The commands, exactly as a person types them: the annotated tag at the release's commit, its push, the GitHub release.
 * A release published by `release.mjs publish` is tagged before it is (release-guards.mjs): its tag is there to push.
 */
export function releaseCommands({ version, commit, notesFile, tagged = false }) {
  const tag = `v${version}`;
  return [
    ...(tagged ? [] : [`git tag -a ${tag} ${commit} -m "Fieldia ${version}"`]),
    `git push origin ${tag}`,
    `gh release create ${tag} --verify-tag --title "Fieldia ${version}" --notes-file ${notesFile}`,
  ];
}

/**
 * The version a release commit set, by its subject — `chore(release): 0.20.0, …` up to 0.20, `chore: release 0.25.0`
 * from 0.21 — or null for any other commit.
 */
export function releaseVersionOf(subject) {
  return /^chore(?:\(release\):|: release) (\d+\.\d+\.\d+)(?=$|[ ,])/.exec(subject)?.[1] ?? null;
}

/** Every version a release commit set (`releaseVersionOf`), oldest first, with that commit and its date (the first such commit). */
export function releasedVersions(workspace) {
  // Either subject: git's patterns given twice are either.
  const log = execFileSync('git', ['log', '--reverse', '--date=short', '--format=%H%x09%ad%x09%s', '--grep=^chore(release): [0-9]', '--grep=^chore: release [0-9]'], { cwd: workspace, encoding: 'utf8' });
  const seen = new Map();
  for (const line of log.split('\n').filter(Boolean)) {
    const [commit, date, subject] = line.split('\t');
    const version = releaseVersionOf(subject);
    if (version && !seen.has(version)) seen.set(version, { version, commit, date });
  }
  return [...seen.values()];
}

/** The notes as a GitHub release shows them, written to a file the release command reads. */
export function writeNotes(workspace, notes) {
  const file = join(workspace, 'tmp/release', `notes-${notes.version}.md`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${notes.body}\n\nThe whole history: [CHANGELOG.md](https://github.com/fieldia-dev/fieldia/blob/main/CHANGELOG.md).\n`);
  return relative(workspace, file);
}

/** What `publish` prints at its end, once every package is on npm: the notes, then the commands to run. */
export function printRelease(workspace, version, commit, { tagged = false } = {}) {
  const notes = notesFor(readFileSync(join(workspace, 'CHANGELOG.md'), 'utf8'), version);
  if (!notes) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const notesFile = writeNotes(workspace, notes);
  console.log(`\nFieldia ${version}${notes.date ? ` (${notes.date})` : ''}\n${'-'.repeat(40)}\n${notes.body}\n${'-'.repeat(40)}`);
  console.log(`\n${tagged ? 'Push its tag' : 'Tag this release'} and publish its notes on GitHub (nothing has been run):\n`);
  for (const command of releaseCommands({ version, commit, notesFile, tagged })) console.log(`  ${command}`);
  console.log('');
}

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const asked = process.argv[2];
  if (asked === '--history') {
    const changelog = readFileSync(join(WORKSPACE, 'CHANGELOG.md'), 'utf8');
    console.log('Every release so far, tagged at the commit that made it (nothing has been run):\n');
    for (const { version, commit, date } of releasedVersions(WORKSPACE)) {
      const notes = notesFor(changelog, version);
      if (!notes) throw new Error(`CHANGELOG.md has no section for ${version}, released ${date}`);
      const notesFile = writeNotes(WORKSPACE, notes);
      console.log(`# ${version}, ${date}`);
      for (const command of releaseCommands({ version, commit: commit.slice(0, 12), notesFile })) console.log(command);
      console.log('');
    }
  } else {
    const version = asked ?? JSON.parse(readFileSync(join(WORKSPACE, 'libs/core/package.json'), 'utf8')).version;
    const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: WORKSPACE, encoding: 'utf8' }).trim();
    const released = releasedVersions(WORKSPACE).find((one) => one.version === version);
    printRelease(WORKSPACE, version, released ? released.commit.slice(0, 12) : commit);
  }
}
