/**
 * Build the designer's Angular editors, `@fieldia/designer/angular`, with ngc
 * in partial mode, against the designer as built (its CommonJS compile runs
 * first). The package is CommonJS, and Angular code is ES modules only, so
 * the output is named .mjs and .d.mts, its relative imports given those
 * extensions. dual-build then checks the whole package, this entry included.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/libs/designer/angular');

rmSync(OUT, { recursive: true, force: true });
execFileSync(join(WORKSPACE, 'node_modules/.bin/ngc'), ['-p', join(WORKSPACE, 'libs/designer/tsconfig.angular.json')], { stdio: 'inherit', cwd: WORKSPACE });

const files = readdirSync(OUT).map((name) => join(OUT, name));
// .d.ts first: its name must not be taken for a .js one.
for (const file of files) {
  if (file.endsWith('.d.ts')) renameSync(file, file.replace(/\.d\.ts$/, '.d.mts'));
  else if (file.endsWith('.js')) renameSync(file, file.replace(/\.js$/, '.mjs'));
  else if (file.endsWith('.js.map')) renameSync(file, file.replace(/\.js\.map$/, '.mjs.map'));
}

const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.?\/[^"']*)\2/g;
const problems = [];
for (const name of readdirSync(OUT)) {
  const file = join(OUT, name);
  if (!file.endsWith('.mjs') && !file.endsWith('.d.mts')) continue;
  const text = readFileSync(file, 'utf8');
  const next = text.replace(RELATIVE, (_m, lead, quote, spec) => {
    const base = resolve(dirname(file), spec);
    if (!existsSync(`${base}.mjs`)) {
      problems.push(`unresolvable ${JSON.stringify(spec)} in ${relative(OUT, file)}`);
      return _m;
    }
    return `${lead}${quote}${spec}.mjs${quote}`;
  });
  if (next !== text) writeFileSync(file, next);
}
const editors = readFileSync(join(OUT, 'editors.mjs'), 'utf8');
if ((editors.match(/ɵɵngDeclareComponent/g) ?? []).length !== 2) problems.push('the editors are not both in partial form (ɵɵngDeclareComponent)');
if (problems.length) {
  console.error(`\n@fieldia/designer/angular: the entry is not consumable\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log('@fieldia/designer/angular: partial compilation, ES modules, imports given extensions');
