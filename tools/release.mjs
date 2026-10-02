/**
 * Release Fieldia's packages — and prove them first, the way someone else
 * would meet them: packed, installed into an empty project, imported.
 *
 *   node tools/release.mjs check              pack every package, install the packs into
 *                                             an empty project, require/import/type-check them
 *   NPM_TOKEN=… node tools/release.mjs publish  the same check, then publish what is not on npm yet
 *   node tools/release.mjs verify             after publishing: the same checks on what npm serves
 *
 * Build first: `npx nx run-many -t build`. A package marked `"private": true`
 * (the designer, until it is decided) is never packed or published.
 *
 * The token is read from the environment and written only into a throwaway
 * npmrc under tmp/, as a reference npm expands itself — never into a command
 * line, where any process listing would show it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const WORK = join(WORKSPACE, 'tmp/release');
const PACKS = join(WORK, 'packs');
const SMOKE = join(WORK, 'smoke');
const mode = process.argv[2] ?? 'check';
if (!['check', 'publish', 'verify'].includes(mode)) throw new Error(`usage: node tools/release.mjs check|publish|verify (got "${mode}")`);
/** verify installs what npm serves, so it needs no build and packs nothing. */
const fromRegistry = mode === 'verify';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const run = (cmd, args, cwd = WORKSPACE, env = process.env) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fail = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};

// ---- which packages, in what order --------------------------------------------
/** Dependencies before dependants, so a publish never points at a version npm does not have yet. */
const ORDER = ['core', 'widgets', 'viewer', 'grid', 'code', 'react', 'vue', 'angular', 'designer'];
const packages = ORDER.map((dir) => ({ dir, manifest: read(join(WORKSPACE, 'libs', dir, 'package.json')) })).filter((p) => !p.manifest.private);
const version = packages[0].manifest.version;
for (const { dir, manifest } of packages) {
  if (manifest.version !== version) fail(`libs/${dir} is ${manifest.version}; every package releases together at ${version}`);
  for (const [name, wanted] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith('@fieldia/') && wanted !== version) fail(`libs/${dir} depends on ${name}@${wanted}, not ${version}`);
  }
  if (fromRegistry) continue;
  const built = join(WORKSPACE, 'dist/libs', dir, 'package.json');
  if (!existsSync(built) || read(built).version !== version) fail(`dist/libs/${dir} is missing or stale: run \`npx nx run-many -t build\``);
  if (!existsSync(join(WORKSPACE, 'dist/libs', dir, 'README.md'))) fail(`dist/libs/${dir} has no README.md — its npm page would be empty`);
}
console.log(`release ${version}: ${packages.map((p) => p.manifest.name).join(', ')}`);

// ---- pack ----------------------------------------------------------------------
rmSync(WORK, { recursive: true, force: true });
mkdirSync(PACKS, { recursive: true });
const tarballs = packages.map(({ dir, manifest }) => {
  if (fromRegistry) return `${manifest.name}@${version}`;
  const [packed] = JSON.parse(run('npm', ['pack', join(WORKSPACE, 'dist/libs', dir), '--pack-destination', PACKS, '--json']));
  const files = packed.files.map((f) => f.path);
  const stray = files.filter((f) => /\.spec\.|\.tsbuildinfo$|(^|\/)tmp\//.test(f));
  if (stray.length) fail(`${packed.name} would ship ${stray.join(', ')}`);
  console.log(`  packed ${packed.filename} (${files.length} files, ${Math.round(packed.size / 1024)} KB)`);
  return join(PACKS, packed.filename);
});

// ---- install into an empty project -------------------------------------------------
const root = read(join(WORKSPACE, 'package.json'));
const pin = (name) => `${name}@${(root.dependencies ?? {})[name] ?? root.devDependencies[name]}`.replace(/@[~^]/, '@');
mkdirSync(SMOKE, { recursive: true });
writeFileSync(join(SMOKE, 'package.json'), JSON.stringify({ name: 'fieldia-smoke', private: true, version: '0.0.0' }, null, 2));
const peers = ['react', 'react-dom', '@types/react', 'vue', '@angular/core', '@angular/compiler', 'rxjs', 'ag-grid-community'].map(pin);
run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...tarballs, ...peers], SMOKE);
for (const { manifest } of packages) {
  const installed = read(join(SMOKE, 'node_modules', manifest.name, 'package.json')).version;
  if (installed !== version) fail(`${manifest.name} installed as ${installed}, not ${version}`);
}

// What each package must export, by name.
const EXPECT = {
  '@fieldia/core': ['validatePage', 'createForm', 'createMemoryDataSource', 'evaluateModifier'],
  '@fieldia/widgets': ['createWidget', 'installStyles', 'sanitizeHtml'],
  '@fieldia/viewer': ['mountViewer', 'VIEWER_LABELS'],
  '@fieldia/grid': ['gridWidgets', 'gridWidget', 'gridApiOf'],
  '@fieldia/code': ['codeWidgets', 'codeWidget'],
  '@fieldia/react': ['FieldiaForm', 'useFormState'],
  '@fieldia/vue': ['FieldiaForm', 'useFormState'],
  '@fieldia/angular': ['FieldiaFormComponent', 'FieldiaSlotDirective', 'formState'],
};
const names = packages.map((p) => p.manifest.name);
const esmOnly = new Set(['@fieldia/angular']);

// CommonJS: require() every package that ships CommonJS.
writeFileSync(
  join(SMOKE, 'require.cjs'),
  `const expect = ${JSON.stringify(EXPECT)};
for (const name of ${JSON.stringify(names.filter((n) => !esmOnly.has(n)))}) {
  const mod = require(name);
  for (const key of expect[name]) if (mod[key] === undefined) throw new Error(name + ' (require) has no ' + key);
}
const schema = require('@fieldia/core/page.schema.json');
if (!schema.$schema) throw new Error('@fieldia/core/page.schema.json is not a JSON Schema');
`
);
run('node', ['require.cjs'], SMOKE);

// ES modules: import every package; Angular's partial declarations link through the JIT compiler here.
writeFileSync(
  join(SMOKE, 'import.mjs'),
  `import '@angular/compiler';
const expect = ${JSON.stringify(EXPECT)};
for (const name of ${JSON.stringify(names)}) {
  const mod = await import(name);
  for (const key of expect[name]) if (mod[key] === undefined) throw new Error(name + ' (import) has no ' + key);
}
`
);
run('node', ['import.mjs'], SMOKE);

// Types, both ways a project resolves them: an .mts file reads the ESM types, a .cts file the CommonJS ones.
writeFileSync(
  join(SMOKE, 'types.mts'),
  `import { createForm, createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import type { FieldiaFormProps } from '@fieldia/react';
declare const page: Page;
declare const host: HTMLElement;
const form = createForm({ page, dataSource: createMemoryDataSource() });
const viewer: ViewerHandle = mountViewer(host, { page, form, skin: 'outlined', widgets: { ...gridWidgets, ...codeWidgets } });
const props: FieldiaFormProps = { page, skin: 'underline' };
export { viewer, props };
`
);
writeFileSync(
  join(SMOKE, 'types.cts'),
  `import { validatePage } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
const checked = validatePage({});
export const ok: boolean = checked.ok && typeof mountViewer === 'function';
`
);
writeFileSync(
  join(SMOKE, 'tsconfig.json'),
  JSON.stringify({ compilerOptions: { module: 'node16', moduleResolution: 'node16', target: 'es2022', lib: ['es2022', 'dom'], strict: true, noEmit: true, skipLibCheck: false, types: [] }, files: ['types.mts', 'types.cts'] }, null, 2)
);
try {
  run(join(WORKSPACE, 'node_modules/.bin/tsc'), ['-p', join(SMOKE, 'tsconfig.json')], SMOKE);
} catch (error) {
  fail(`the packed types do not check in an empty project:\n${error.stdout}${error.stderr}`);
}

// The script bundle: on its own, it defines the global.
const bundle = join(SMOKE, 'node_modules/@fieldia/viewer/bundle/fieldia.js');
if (!existsSync(bundle)) fail('@fieldia/viewer has no bundle/fieldia.js');
const sandbox = {};
runInNewContext(readFileSync(bundle, 'utf8'), sandbox);
if (typeof sandbox.Fieldia?.mountViewer !== 'function' || sandbox.Fieldia.VERSION !== version) fail('the packed script bundle does not define Fieldia.mountViewer at this version');

console.log(`  installed ${fromRegistry ? 'from npm' : 'the packs'} into an empty project: require, import, types (.mts and .cts) and the script bundle all check`);

// ---- publish ---------------------------------------------------------------------
if (mode === 'publish') {
  if (!process.env.NPM_TOKEN) fail('publishing needs NPM_TOKEN in the environment');
  const npmrc = join(WORK, '.npmrc');
  // A reference, expanded by npm from the environment; the token itself is never written.
  writeFileSync(npmrc, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');
  const env = { ...process.env, npm_config_userconfig: npmrc };
  const onNpm = (name) => {
    try {
      return run('npm', ['view', `${name}@${version}`, 'version'], WORKSPACE, env).trim() === version;
    } catch {
      return false; // npm answers 404 for a version it does not have
    }
  };
  for (const [i, { manifest }] of packages.entries()) {
    if (onNpm(manifest.name)) {
      console.log(`  ${manifest.name}@${version} is already on npm`);
      continue;
    }
    run('npm', ['publish', tarballs[i], '--access', 'public'], WORKSPACE, env);
    console.log(`  published ${manifest.name}@${version}`);
  }
  rmSync(npmrc, { force: true });
}
