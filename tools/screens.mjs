/**
 * The key screens (e2e/screens.spec.ts) compared with their stored images — or stored again — in the Playwright
 * container CI runs them in, so a machine's own browser build or fonts never make a difference (docs/maintainers/
 * screens.md):
 *
 *   node tools/build-demos.mjs plain         the plain demo, which the screens are shot from (once, after a change)
 *   node tools/screens.mjs                   compare: a difference fails, its images in test-results/screens-run
 *   node tools/screens.mjs --update          store the screens again, to review in the pull request
 *
 * IMAGE is the one place the container is named: CI's `screens` job runs in the same image, by the same digest, and
 * its Playwright is the one package.json installs (tools/workflows.test.mjs holds both to it).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const IMAGE = 'mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);

function main(argv) {
  if (!existsSync(join(WORKSPACE, 'dist/demos/plain/index.html'))) {
    console.error('The plain demo is not built: node tools/build-demos.mjs plain (or every demo: node tools/build-demos.mjs), then again.');
    return 1;
  }
  const port = process.env['FIELDIA_SCREENS_PORT'] ?? '6795';
  // The workspace at its own path in the container, and the install its node_modules may link to (a worktree's), too.
  const modules = realpathSync(join(WORKSPACE, 'node_modules'));
  const mounts = [WORKSPACE, ...(modules.startsWith(`${WORKSPACE}/`) ? [] : [modules])].flatMap((path) => ['-v', `${path}:${path}`]);
  const args = [
    'run', '--rm', '--network', 'host', '--ipc', 'host',
    '--user', `${process.getuid()}:${process.getgid()}`, '-e', 'HOME=/tmp',
    '-e', 'FIELDIA_SCREENS=container', '-e', 'FIELDIA_SITE=off', '-e', `FIELDIA_DEMO_PORT=${port}`,
    ...mounts, '-w', WORKSPACE, IMAGE,
    'npx', 'playwright', 'test', '--project=screens', '--output=test-results/screens-run',
    // Every screen stored again, as docs/maintainers/screens.md says — not only those over the tolerance (Playwright's
    // `changed`), which would let a screen drift a little at each update.
    ...(argv.includes('--update') ? ['--update-snapshots=all'] : []),
    ...argv.filter((arg) => arg !== '--update'),
  ];
  return spawnSync('docker', args, { stdio: 'inherit' }).status ?? 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
