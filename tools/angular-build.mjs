/**
 * Build @fieldia/angular with ngc in partial mode — the format Angular
 * libraries ship in, linked by the consumer's Angular CLI (or by the JIT
 * compiler when one is loaded) — then make the output a consumable package.
 *
 * Angular packages are ES modules only. tsc leaves relative specifiers
 * extensionless, which bundlers resolve and Node does not, so each one is given
 * its real extension here; one that cannot be resolved fails the build.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/libs/angular');
const PROJECT = join(WORKSPACE, 'libs/angular');

rmSync(OUT, { recursive: true, force: true });
execFileSync(join(WORKSPACE, 'node_modules/.bin/ngc'), ['-p', join(PROJECT, 'tsconfig.build.json')], { stdio: 'inherit', cwd: WORKSPACE });

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
};

const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.?\/[^"']*)\2/g;
let rewritten = 0;
for (const file of walk(OUT)) {
  if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue;
  const text = readFileSync(file, 'utf8');
  const next = text.replace(RELATIVE, (_m, lead, quote, spec) => {
    const base = resolve(dirname(file), spec);
    let fixed;
    if (existsSync(`${base}.js`)) fixed = `${spec}.js`;
    else if (existsSync(join(base, 'index.js'))) fixed = `${spec}/index.js`;
    else if (existsSync(base)) fixed = spec;
    else throw new Error(`unresolvable ${JSON.stringify(spec)} in ${relative(OUT, file)}`);
    rewritten++;
    return `${lead}${quote}${fixed}${quote}`;
  });
  if (next !== text) writeFileSync(file, next);
}

for (const file of ['package.json', 'README.md', 'LICENSE']) {
  if (existsSync(join(PROJECT, file))) cpSync(join(PROJECT, file), join(OUT, file));
}

const pkg = JSON.parse(readFileSync(join(OUT, 'package.json'), 'utf8'));
const problems = [];
const visit = (node) => {
  if (typeof node === 'string') {
    if (!existsSync(join(OUT, node))) problems.push(`exports -> ${node} does not exist`);
  } else if (node && typeof node === 'object') Object.values(node).forEach(visit);
};
visit(pkg.exports);
const component = readFileSync(join(OUT, 'src/lib/fieldia-form.component.js'), 'utf8');
if (!component.includes('ɵɵngDeclareComponent')) problems.push('the component is not in partial form (no ɵɵngDeclareComponent)');
for (const file of walk(OUT)) {
  if (file.endsWith('.d.ts') && /from ["'](dist|\.\.\/\.\.\/dist)\//.test(readFileSync(file, 'utf8'))) problems.push(`${relative(OUT, file)} names a workspace path`);
}
if (problems.length) {
  console.error(`\n@fieldia/angular: the package is not consumable\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`@fieldia/angular: partial compilation, ${rewritten} relative imports given extensions, exports checked`);
