/**
 * What a release must be before anything of it is published — by `node tools/release.mjs publish` on a maintainer's
 * machine, or by the publish workflow (.github/workflows/publish.yml, tools/publish-packs.mjs) on its tag:
 *
 * - a commit, and nothing else: the working tree has no change and no file git does not track;
 * - one already on origin/main: merged, pushed and through CI before it is published;
 * - tagged with its version (`v0.34.0`) — the tag is made first, and the publish follows it;
 * - a patch (0.x.**y**, y > 0) holds fixes alone: its CHANGELOG section has no Upgrading part. Anything an app, a page or
 *   a test writes that has to change waits for the next minor (npm's default `^0.34.0` installs a patch by itself).
 *
 * The audits' R-H7, R-M15 and S-H4. Each problem is said in words, with what to do.
 */
import { execFileSync } from 'node:child_process';
import { notesFor } from './release-notes.mjs';

/** An Upgrading part of a section: `**Upgrading**`, `**Upgrading.**`, `### Upgrading`, at the start of a line. */
const UPGRADING = /^(?:\*\*Upgrading\b|#{2,6}\s+Upgrading\b)/m;

/** Why a patch version may not be released as it is written, or null: a patch whose section has an Upgrading part. */
export function patchProblem(version, changelog) {
  const [, , patch] = version.split('.').map(Number);
  if (!(patch > 0)) return null;
  const notes = notesFor(changelog, version);
  if (!notes || !UPGRADING.test(notes.body)) return null;
  const [major, minor] = version.split('.');
  return `${version} is a patch, but its CHANGELOG section has an Upgrading part: a patch holds fixes alone — nothing an app, a page or a test writes changes, since npm's default range (^${major}.${minor}.0) installs it by itself. Release it as ${major}.${Number(minor) + 1}.0, or keep what changes for the next minor.`;
}

/**
 * The facts about the working tree a release is published from, read from git: each change (`git status --porcelain`
 * lines, files not tracked among them), HEAD, whether HEAD is on origin/main as last fetched (null when there is no
 * origin/main), and the tags at HEAD.
 */
export function gitFacts(workspace, git = (args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) {
  const changed = git(['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);
  const head = git(['rev-parse', '--short=12', 'HEAD']).trim();
  let onMain;
  try {
    git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']);
    try {
      git(['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main']);
      onMain = true;
    } catch {
      onMain = false;
    }
  } catch {
    onMain = null;
  }
  const tags = git(['tag', '--points-at', 'HEAD']).split('\n').filter(Boolean);
  return { changed, head, onMain, tags };
}

/**
 * Every reason `version` may not be published from where the facts say it is, in words; none when it may. `tag`, where
 * a workflow was started by one, is that tag's name: it must be this release's.
 */
export function releaseProblems({ version, changelog, facts, tag = null }) {
  const problems = [];
  const wanted = `v${version}`;
  if (facts.changed.length) {
    const files = facts.changed.map((line) => line.slice(3));
    const named = files.length > 5 ? `${files.slice(0, 5).join(', ')} and ${files.length - 5} more` : files.join(', ');
    problems.push(`the working tree has changes not committed (${files.length} files: ${named}): a release is built from a commit and nothing else — commit them, or remove them, first`);
  }
  if (facts.onMain === null) problems.push(`there is no origin/main to compare HEAD with: \`git fetch origin\`, then publish again`);
  else if (!facts.onMain) problems.push(`HEAD (${facts.head}) is not on origin/main: a release is a commit already merged and pushed to main, through CI, before it is tagged and published — or this checkout's origin/main is stale: \`git fetch origin\``);
  if (tag && tag !== wanted) problems.push(`the tag ${tag} is not this release's: the packages are ${version}, whose tag is ${wanted}`);
  else if (!facts.tags.includes(wanted)) problems.push(`HEAD has no tag ${wanted}: tag the release's commit first (\`git tag -a ${wanted} -m "Fieldia ${version}"\`), then publish it`);
  const patch = patchProblem(version, changelog);
  if (patch) problems.push(patch);
  return problems;
}
