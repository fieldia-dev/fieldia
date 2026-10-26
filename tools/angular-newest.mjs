/**
 * @fieldia/angular and @fieldia/designer/angular on the newest Angular major they support.
 *
 * The workspace builds them with the OLDEST major they support (package.json's @angular/*): an Angular library ships
 * partial declarations, which the app's own Angular links, and a linker refuses a declaration written by a compiler
 * newer than itself — built with the newest, the packages would not link in an app on the oldest. So the workspace
 * stays on the oldest, every other gate runs there, and this checks the packages on the newest, from an install of its
 * own (tools/angular-newest: `npm ci --prefix tools/angular-newest`, its TypeScript the one that Angular asks for):
 *
 *   1. both majors are in the packages' peer range, the workspace's and the newest;
 *   2. the sources build with the newest ngc, in partial mode with strict templates, as the workspace builds them;
 *   3. the packages as built — as npm serves them — link with the newest Angular's linker, as an Angular CLI app links
 *      them, refusing any declaration it does not know;
 *   4. an app on the newest Angular compiles against the packages as built: ngc, strict templates, its libraries
 *      checked (skipLibCheck off);
 *   5. the bindings' own specs run on the newest Angular.
 *
 * CI's angular-newest job runs it, then the browser gates of the Angular demos built on the newest Angular
 * (FIELDIA_ANGULAR=tools/angular-newest node tools/build-demos.mjs …). Needs the packages built (`npx nx run-many -t
 * build -p angular designer`).
 *
 *   node tools/angular-newest.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const NEWEST = join(WORKSPACE, 'tools/angular-newest');
const TMP = join(WORKSPACE, 'tmp/angular-newest');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const fail = (message) => {
  console.error(`\nangular-newest: ${message}\n`);
  process.exit(1);
};
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: WORKSPACE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...options });
/** A step's command, its output said only when it fails. */
const step = (what, command, args, options) => {
  try {
    run(command, args, options);
  } catch (error) {
    fail(`${what} failed:\n${[error.stdout, error.stderr].filter(Boolean).join('\n').trim()}`);
  }
};
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

if (!existsSync(join(NEWEST, 'node_modules/@angular/core'))) fail('tools/angular-newest is not installed: npm ci --prefix tools/angular-newest');
for (const built of ['dist/libs/angular/src/index.js', 'dist/libs/designer/angular/index.mjs']) {
  if (!existsSync(join(WORKSPACE, built))) fail(`${built} is not built: npx nx run-many -t build -p angular designer`);
}

// ---- 1. the peer range names both majors -------------------------------------------------------------------------
const ANGULAR = ['@angular/common', '@angular/compiler', '@angular/compiler-cli', '@angular/core', '@angular/platform-browser'];
/** Every @angular/* an install names, at one version: its major. */
const majorOf = (manifest, where) => {
  const versions = new Set(ANGULAR.map((name) => manifest.devDependencies?.[name]));
  if (versions.size !== 1 || versions.has(undefined)) fail(`${where} names ${ANGULAR.join(', ')} at ${[...versions].join(', ')}: one version for them all`);
  const [version] = versions;
  const major = /^(\d+)\.\d+\.\d+$/.exec(version)?.[1];
  if (!major) fail(`${where} names Angular ${version}: an exact version, as the gates run it`);
  return { version, major: Number(major) };
};
const oldest = majorOf(read(join(WORKSPACE, 'package.json')), 'package.json');
const newest = majorOf(read(join(NEWEST, 'package.json')), 'tools/angular-newest/package.json');
const installed = read(join(NEWEST, 'node_modules/@angular/core/package.json')).version;
if (installed !== newest.version) fail(`tools/angular-newest has Angular ${installed} installed, its package.json names ${newest.version}: npm ci --prefix tools/angular-newest`);
if (newest.major <= oldest.major) fail(`tools/angular-newest names Angular ${newest.version}, not newer than the workspace's ${oldest.version}`);
for (const manifest of ['libs/angular/package.json', 'libs/designer/package.json']) {
  const range = read(join(WORKSPACE, manifest)).peerDependencies?.['@angular/core'] ?? '';
  const majors = range.split('||').map((part) => Number(/^\s*\^(\d+)\.0\.0\s*$/.exec(part)?.[1]));
  if (!range || majors.some((major) => !major)) fail(`${manifest}: @angular/core's peer range "${range}" is not majors alone (^21.0.0 || ^22.0.0)`);
  const want = Array.from({ length: newest.major - oldest.major + 1 }, (_, i) => oldest.major + i);
  if (majors.join() !== want.join()) fail(`${manifest}: @angular/core's peer range is "${range}"; the gates run Angular ${oldest.major} and ${newest.major}, so it is ${want.map((major) => `^${major}.0.0`).join(' || ')}`);
}
console.log(`angular-newest: the peer ranges name Angular ${oldest.major} (the workspace's ${oldest.version}) to ${newest.major} (${newest.version})`);

// ---- 2. the sources build with the newest ngc --------------------------------------------------------------------
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const NGC = join(NEWEST, 'node_modules/.bin/ngc');
const TSC = join(NEWEST, 'node_modules/.bin/tsc');
/** @angular/* from the newest install, wherever in the program it is imported from. */
const NEWEST_ANGULAR = { '@angular/*': [join(NEWEST, 'node_modules/@angular/*')] };
const sources = [
  { name: '@fieldia/angular', config: 'libs/angular/tsconfig.build.json', out: 'angular' },
  { name: '@fieldia/designer/angular', config: 'libs/designer/tsconfig.angular.json', out: 'designer-angular' },
];
for (const { name, config, out } of sources) {
  const file = join(TMP, `${out}.tsconfig.json`);
  // The workspace's config as it is, its output elsewhere: its paths are relative to the workspace (tsconfig.base.json's
  // baseUrl), which TypeScript 6 says is deprecated, and builds.
  const paths = Object.fromEntries(Object.entries(read(join(WORKSPACE, config)).compilerOptions.paths).map(([key, [path]]) => [key, [join(WORKSPACE, path)]]));
  writeFileSync(file, JSON.stringify({ extends: join(WORKSPACE, config), compilerOptions: { outDir: join(TMP, 'out', out), ignoreDeprecations: '6.0', paths: { ...paths, ...NEWEST_ANGULAR } } }, null, 2));
  // Angular's types are the newest's, never the workspace's.
  const files = run(TSC, ['-p', file, '--listFilesOnly']).split('\n');
  const theirs = files.filter((one) => one.startsWith(join(WORKSPACE, 'node_modules/@angular/')));
  if (theirs.length || !files.some((one) => one.startsWith(join(NEWEST, 'node_modules/@angular/core/')))) fail(`${name}: the program reads Angular's types from the workspace's install, not the newest's (${relative(WORKSPACE, theirs[0] ?? '')})`);
  step(`${name}: ngc ${newest.version}`, NGC, ['-p', file]);
  const emitted = walk(join(TMP, 'out', out)).filter((one) => /\.m?js$/.test(one));
  const declared = emitted.map((one) => readFileSync(one, 'utf8')).join('\n');
  if (!declared.includes(`version: "${newest.version}"`)) fail(`${name}: ngc ${newest.version} wrote no partial declaration of its version`);
  console.log(`angular-newest: ${name}'s sources build with ngc ${newest.version} (partial, strict templates)`);
}

// ---- 3. the packages as built link with the newest linker --------------------------------------------------------
const fromNewest = createRequire(join(NEWEST, 'package.json'));
const babel = createRequire(fromNewest.resolve('@angular/compiler-cli/package.json'))('@babel/core');
const { default: linkerPlugin } = await import(pathToFileURL(fromNewest.resolve('@angular/compiler-cli/linker/babel')).href);
const built = [...walk(join(WORKSPACE, 'dist/libs/angular/src')), ...walk(join(WORKSPACE, 'dist/libs/designer/angular'))].filter((one) => /\.m?js$/.test(one));
let linked = 0;
for (const file of built) {
  const code = readFileSync(file, 'utf8');
  if (!code.includes('ɵɵngDeclare')) continue;
  const declarations = code.match(/ɵɵngDeclare\w+\(/g).length;
  let output;
  try {
    ({ code: output } = await babel.transformAsync(code, {
      filename: file,
      babelrc: false,
      configFile: false,
      sourceType: 'module',
      plugins: [[linkerPlugin, { linkerJitMode: false, unknownDeclarationVersionHandling: 'error' }]],
    }));
  } catch (error) {
    fail(`${relative(WORKSPACE, file)} does not link with Angular ${newest.version}'s linker: ${error.message}`);
  }
  if (output.includes('ɵɵngDeclare')) fail(`${relative(WORKSPACE, file)}: Angular ${newest.version}'s linker left a partial declaration unlinked`);
  linked += declarations;
}
if (!linked) fail('the packages as built hold no partial declaration to link');
console.log(`angular-newest: the packages as built (Angular ${oldest.version}) link with Angular ${newest.version}'s linker (${linked} declarations)`);

// ---- 4. an app on the newest Angular compiles against the packages as built -------------------------------------
// The packages as an app's node_modules has them: each built package by its name, read through its own package.json.
const APP = join(TMP, 'app');
mkdirSync(join(APP, 'node_modules/@fieldia'), { recursive: true });
for (const dir of ['core', 'widgets', 'viewer', 'angular', 'designer']) symlinkSync(join(WORKSPACE, 'dist/libs', dir), join(APP, 'node_modules/@fieldia', dir), 'dir');
writeFileSync(
  join(APP, 'main.ts'),
  `import { Component, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FieldiaFormComponent, FieldiaSlotDirective, formState, type ViewerHandle } from '@fieldia/angular';
import { FieldiaScreenEditorComponent, FieldiaSurveyEditorComponent } from '@fieldia/designer/angular';
import { createMemoryDataSource, type ActionRequest, type FormState, type Page, type Values } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore } from '@fieldia/designer';

/** A field of the app's own, as an Angular component. */
@Component({ selector: 'app-badge', template: '<strong>{{ text() }}</strong>' })
export class Badge {
  readonly text = signal('');
}

@Component({
  selector: 'app-root',
  imports: [FieldiaFormComponent, FieldiaSlotDirective, FieldiaScreenEditorComponent, FieldiaSurveyEditorComponent],
  template: \`
    <fieldia-form [page]="page" [dataSource]="dataSource" [recordId]="1" skin="underline" [answer]="answer" [fieldTypes]="{ badge: badge }"
      [warnOnLeave]="true" (ready)="ready($event)" (fieldChange)="changes.set(changes() + 1)" (partError)="failed($event.where)" (openRecord)="opened($event)">
      <ng-template fieldiaSlot="footer" let-form><p>{{ form.page.id }}</p></ng-template>
    </fieldia-form>
    @if (state(); as now) { <p>{{ now().dirty.length ? 'Changed' : now().status }}</p> }
    <fieldia-screen-editor [designer]="designer" (ready)="editing.set(true)" />
    <fieldia-survey-editor [designer]="designer" skin="underline" />
  \`,
})
export class App {
  readonly page: Page = blankPage('screen', 'Order');
  readonly dataSource = createMemoryDataSource();
  readonly designer = createDesigner({ page: blankPage('screen', 'Order'), store: createMemoryPageStore() });
  readonly badge = Badge;
  readonly changes = signal(0);
  readonly editing = signal(false);
  readonly state = signal<Signal<FormState> | undefined>(undefined);
  private readonly destroyRef = inject(DestroyRef);
  readonly answer = async ({ action }: ActionRequest): Promise<{ values: Values } | undefined> => (action === 'check' ? { values: {} } : undefined);
  ready(handle: ViewerHandle): void {
    this.state.set(formState(handle.form, this.destroyRef));
  }
  failed(where: unknown): void {
    console.warn(where);
  }
  opened(id: unknown): void {
    console.log(id);
  }
}

bootstrapApplication(App).catch((error: unknown) => console.error(error));
`
);
writeFileSync(
  join(TMP, 'app.tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'es2022',
        module: 'es2022',
        moduleResolution: 'bundler',
        lib: ['es2022', 'dom', 'dom.iterable'],
        strict: true,
        skipLibCheck: false,
        // The packages are linked into the app's node_modules: read there, beside each other, as npm puts them.
        preserveSymlinks: true,
        types: [],
        rootDir: APP,
        outDir: join(TMP, 'out/app'),
        paths: NEWEST_ANGULAR,
      },
      files: [join(APP, 'main.ts')],
      angularCompilerOptions: { compilationMode: 'full', strictTemplates: true, strictInjectionParameters: true, strictInputAccessModifiers: true },
    },
    null,
    2
  )
);
step(`an app on Angular ${newest.version} against the packages as built`, NGC, ['-p', join(TMP, 'app.tsconfig.json')]);
console.log(`angular-newest: an app on Angular ${newest.version} compiles against the packages as built (strict templates, libraries checked)`);

// ---- 5. the bindings' specs on the newest Angular -----------------------------------------------------------------
// Jest as each project runs it, but @angular/* found in the newest install (Nx's resolver for the rest).
writeFileSync(
  join(TMP, 'resolver.cjs'),
  `const nx = require(${JSON.stringify(createRequire(join(WORKSPACE, 'package.json')).resolve('@nx/jest/plugins/resolver'))});
module.exports = (path, options) => nx(path, /^@angular\\//.test(path) ? { ...options, basedir: ${JSON.stringify(NEWEST)} } : options);
`
);
for (const [project, config] of [
  ['angular', 'libs/angular/jest.config.cjs'],
  ['designer-angular', 'libs/designer/jest.angular.config.cjs'],
]) {
  const own = join(WORKSPACE, config);
  const root = dirname(own);
  // The version the specs ran on, said by Angular itself once they have run.
  const probe = join(TMP, `${project}.version.cjs`);
  writeFileSync(probe, `afterAll(() => require('node:fs').appendFileSync(${JSON.stringify(join(TMP, `${project}.versions`))}, require('@angular/core').VERSION.full + '\\n'));\n`);
  const file = join(TMP, `${project}.jest.config.cjs`);
  writeFileSync(
    file,
    `const own = require(${JSON.stringify(own)});
module.exports = {
  ...own,
  displayName: ${JSON.stringify(`${project} on Angular ${newest.version}`)},
  rootDir: ${JSON.stringify(root)},
  resolver: ${JSON.stringify(join(TMP, 'resolver.cjs'))},
  cacheDirectory: ${JSON.stringify(join(TMP, 'jest-cache'))},
  setupFilesAfterEnv: [...own.setupFilesAfterEnv, ${JSON.stringify(probe)}],
};
`
  );
  step(`${project}'s specs on Angular ${newest.version}`, process.execPath, [join(WORKSPACE, 'node_modules/jest/bin/jest.js'), '-c', file, '--ci', '--maxWorkers=2']);
  const versions = new Set(readFileSync(join(TMP, `${project}.versions`), 'utf8').trim().split('\n'));
  if (versions.size !== 1 || !versions.has(newest.version)) fail(`${project}'s specs ran on Angular ${[...versions].join(', ')}, not ${newest.version}`);
  console.log(`angular-newest: ${project}'s specs pass on Angular ${newest.version}`);
}
