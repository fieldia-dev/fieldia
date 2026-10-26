/**
 * What a change can break, read before CI runs its gates: the first job of .github/workflows/ci.yml.
 *
 *   tested  a push to main of a commit whose CI run on a pull request passed: main is fast-forwarded to the commit
 *           the pull request tested, so its gates ran on these very files; nothing runs twice.
 *   site    every file changed is fieldia.dev's own (site/, the tool that builds it, its specs, docs/): the site is built and its own
 *           specs run, not the gates of the packages and the demos, which the change cannot reach.
 *
 * Anything else — a package, a demo, an example page, a tool, the workflow itself — runs every gate.
 *   node tools/ci-scope.mjs   (in CI: EVENT, BASE, HEAD, GITHUB_REPOSITORY, GH_TOKEN, GITHUB_OUTPUT)
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/**
 * Files that only fieldia.dev is made of, or that nothing is built from. A spec here tests the site alone. Not the page of
 * promises nor the guide for agents: what holds them is the packages' tests and the tools' (tools/promises.test.mjs,
 * agents-guide.spec.ts), which run with every gate.
 */
const SITE_ONLY = [/^site\//, /^docs\/(?!promises\.md$|agents\.md$)/, /^tools\/build-site\.mjs$/, /^e2e\/site\.spec\.ts$/, /^e2e\/site-pages\.ts$/];

/** Whether every file changed is the site's own; an empty list is not (nothing known, so everything runs). */
export function siteOnly(files) {
  return files.length > 0 && files.every((file) => SITE_ONLY.some((pattern) => pattern.test(file)));
}

/** The files changed between two commits, or null when they cannot be compared (a first push, a lost base). */
export function changedFiles(base, head, run = (args) => execFileSync('git', args, { encoding: 'utf8' })) {
  if (!base || /^0+$/.test(base) || !head) return null;
  try {
    return run(['diff', '--name-only', `${base}...${head}`]).split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

/** Whether CI passed on a pull request for exactly this commit. */
export async function testedOnPullRequest(repo, sha, token, get = fetch) {
  if (!repo || !sha) return false;
  const url = `https://api.github.com/repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=pull_request&status=success&per_page=1`;
  try {
    const answer = await get(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
    if (!answer.ok) return false;
    const { total_count } = await answer.json();
    return total_count > 0;
  } catch {
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { EVENT, BASE, HEAD, GITHUB_REPOSITORY, GH_TOKEN, GITHUB_OUTPUT } = process.env;
  const tested = EVENT === 'push' && (await testedOnPullRequest(GITHUB_REPOSITORY, HEAD, GH_TOKEN));
  const files = changedFiles(BASE, HEAD);
  const site = !tested && files !== null && siteOnly(files);
  console.log(tested ? `${HEAD} passed CI on its pull request: its gates are not run again.` : site ? `Only fieldia.dev changed (${files.length} files): the site's gates run.` : `Every gate runs (${files === null ? 'the change could not be read' : `${files.length} files changed`}).`);
  if (files) console.log(files.map((file) => `  ${file}`).join('\n'));
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `tested=${tested}\nsite=${site}\n`);
}
