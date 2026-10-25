/**
 * Fold the ESM compile into the CJS package, and prove the result.
 *
 * Adapted from Quantia's tools/dual-build.mjs, which settled this problem first.
 *
 * `@nx/js:tsc` emits ONE module format per invocation — it reads `module` out
 * of the tsconfig and that is that. So each Fieldia package compiles twice:
 *
 *   compile-cjs -> dist/libs/<pkg>            (module: commonjs)
 *   compile-esm -> tmp/<pkg>/esm              (module: es2022)
 *
 * and this script folds the second tree into the first, side by side in the
 * SAME directories, distinguished by extension:
 *
 *   dist/libs/core/src/lib/page.js      + .d.ts    CommonJS
 *   dist/libs/core/src/lib/page.mjs     + .d.mts   ESM
 *
 * WHY SIDE BY SIDE RATHER THAN esm/ AND cjs/ DIRECTORIES. `sideEffects` globs
 * are resolved against the NEAREST package.json. A `type: module` marker inside
 * an `esm/` directory would shadow the root `sideEffects` field for every file
 * under it, silently turning tree-shaking off — or, for a module whose
 * registration side effect is the point, silently dropping it. One directory
 * with two extensions makes every glob match both trees unchanged.
 *
 * WHAT THE REWRITE IS FOR. tsc emits relative specifiers verbatim, so ESM
 * output carries `from "./lib/page"` — which every bundler resolves and Node
 * does not. So every relative specifier in the `.mjs` and `.d.mts` files is
 * resolved against the emitted tree and given its real extension. A specifier
 * that cannot be resolved is a hard error: a silent miss here is a package that
 * installs and then throws ERR_MODULE_NOT_FOUND on the consumer's first import.
 *
 * Then it checks the package: every path in `exports` exists, every
 * `sideEffects` glob matches in BOTH outputs, and no declaration names a path
 * that exists only in this workspace.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { minifyStylesheet, STYLE_MODULE, STYLED_PACKAGES } from './minified-styles.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const SCOPE = '@fieldia';

/** Every form tsc can put a module specifier in, across .js and .d.ts. */
const SPECIFIER_PATTERNS = [
  // import x from "./y" / export * from "./y" / export { a } from "./y"
  /(\bfrom\s*)(["'])(\.\.?\/[^"']*)\2/g,
  // import("./y") — d.ts import types, and any dynamic import
  /(\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g,
  // import "./y" — the side-effect import
  /(\bimport\s+)(["'])(\.\.?\/[^"']*)\2/g,
];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

/** Resolve one relative specifier against the compiled ESM tree. Throws rather than guessing. */
function resolveSpecifier(spec, fromFile, esmRoot) {
  const base = resolve(dirname(fromFile), spec);
  if (existsSync(`${base}.js`)) return `${spec}.mjs`;
  if (existsSync(join(base, 'index.js'))) return `${spec}/index.mjs`;
  // Already extensioned by hand in the source — leave it, but only if it is real.
  if (existsSync(base)) return spec;
  throw new Error(
    `unresolvable relative specifier ${JSON.stringify(spec)} in ` +
      `${relative(esmRoot, fromFile)} — the ESM output would throw ` +
      `ERR_MODULE_NOT_FOUND on the consumer's first import`
  );
}

function rewrite(text, fromFile, esmRoot) {
  let out = text;
  for (const pattern of SPECIFIER_PATTERNS) {
    out = out.replace(pattern, (_m, lead, quote, spec) =>
      `${lead}${quote}${resolveSpecifier(spec, fromFile, esmRoot)}${quote}`
    );
  }
  return out;
}

function write(file, contents) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

/** `./src/lib/builtins.*` -> a regexp. `*` never crosses a `/`, as in webpack. */
function globToRegExp(glob) {
  const body = glob
    .replace(/^\.\//, '')
    .split('**')
    .map((chunk) =>
      chunk
        .split('*')
        .map((lit) => lit.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*')
    )
    .join('.*');
  return new RegExp(`^${body}$`);
}

function foldEsmIntoDist(esmRoot, distRoot) {
  let written = 0;
  for (const file of walk(esmRoot)) {
    const rel = relative(esmRoot, file);
    if (rel === 'package.json') continue; // only there so tsc could resolve siblings
    if (file.endsWith('.d.ts')) {
      write(join(distRoot, rel.replace(/\.d\.ts$/, '.d.mts')), rewrite(readFileSync(file, 'utf8'), file, esmRoot));
    } else if (file.endsWith('.js')) {
      const body = rewrite(readFileSync(file, 'utf8'), file, esmRoot).replace(
        /(\/\/# sourceMappingURL=)(\S+)\.js\.map/g,
        '$1$2.mjs.map'
      );
      write(join(distRoot, rel.replace(/\.js$/, '.mjs')), body);
    } else if (file.endsWith('.js.map')) {
      const map = JSON.parse(readFileSync(file, 'utf8'));
      if (typeof map.file === 'string') map.file = map.file.replace(/\.js$/, '.mjs');
      write(join(distRoot, rel.replace(/\.js\.map$/, '.mjs.map')), JSON.stringify(map));
    } else {
      continue;
    }
    written++;
  }
  return written;
}

/** Every path the exports map promises has to be on disk. */
function checkExports(pkg, distRoot) {
  const problems = [];
  const seen = [];
  const visit = (node, trail) => {
    if (typeof node === 'string') {
      seen.push(node);
      if (!existsSync(join(distRoot, node))) problems.push(`exports${trail} -> ${node} does not exist`);
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) visit(v, `${trail}[${JSON.stringify(k)}]`);
    }
  };
  if (!pkg.exports) problems.push('no "exports" field — every internal path is public API');
  else visit(pkg.exports, '');
  for (const field of ['main', 'module', 'types']) {
    if (pkg[field] && !existsSync(join(distRoot, pkg[field]))) {
      problems.push(`"${field}" -> ${pkg[field]} does not exist`);
    }
  }
  return { problems, seen };
}

/**
 * A `sideEffects` entry that matches the CommonJS output and not the ESM one
 * lets a bundler conclude the ESM copy is pure and drop a registration import —
 * with nothing in the console.
 */
function checkSideEffects(pkg, distRoot) {
  if (!Array.isArray(pkg.sideEffects)) return [];
  const files = walk(distRoot).map((f) => relative(distRoot, f).split('\\').join('/'));
  const problems = [];
  for (const glob of pkg.sideEffects) {
    const re = globToRegExp(glob);
    const hits = files.filter((f) => re.test(f));
    if (!hits.some((f) => f.endsWith('.js'))) problems.push(`sideEffects ${glob} matches no CommonJS file`);
    if (!hits.some((f) => f.endsWith('.mjs'))) problems.push(`sideEffects ${glob} matches no ESM file`);
  }
  return problems;
}

/** Every module specifier in a file, whatever syntax it arrived in. */
const ANY_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\1/g;

/**
 * Put `@fieldia/<pkg>` back where the build wrote a workspace path.
 *
 * `@nx/js:tsc` remaps a sibling package to its output DIRECTORY. When
 * declaration emit has to NAME that module again — an inlined
 * `import("...").Type` — it can fall back to the baseUrl-relative path and
 * ship it, which does not exist on a consumer's disk. Only the barrel is
 * rewritten; a specifier that reaches INTO a sibling's source tree is a real
 * encapsulation break, so it is left alone and the guard below fails the build.
 */
function repairWorkspaceSpecifiers(distRoot) {
  const BARREL = /^(?:dist\/libs|tmp)\/([a-z-]+)(?:\/esm)?\/src$/;
  let repaired = 0;
  for (const file of walk(distRoot)) {
    if (!file.endsWith('.d.ts') && !file.endsWith('.d.mts')) continue;
    const before = readFileSync(file, 'utf8');
    const after = before.replace(ANY_SPECIFIER, (m, quote, spec) => {
      const hit = BARREL.exec(spec);
      if (!hit) return m;
      repaired++;
      return m.replace(spec, `${SCOPE}/${hit[1]}`);
    });
    if (after !== before) writeFileSync(file, after);
  }
  return repaired;
}

/** No declaration may name a path that exists only on this machine. */
function checkNoWorkspacePaths(distRoot) {
  const problems = [];
  for (const file of walk(distRoot)) {
    if (!file.endsWith('.d.ts') && !file.endsWith('.d.mts')) continue;
    for (const [, , spec] of readFileSync(file, 'utf8').matchAll(ANY_SPECIFIER)) {
      if (/^(dist|tmp)\//.test(spec)) {
        problems.push(
          `${relative(distRoot, file)} imports ${JSON.stringify(spec)} — a path that ` +
            `exists only in this workspace, so the published types cannot resolve it`
        );
      }
    }
  }
  return problems;
}

/** A .mjs that still carries an extensionless relative specifier is broken in Node. */
function checkNoBareSpecifiers(distRoot) {
  const problems = [];
  for (const file of walk(distRoot)) {
    if (!file.endsWith('.mjs') && !file.endsWith('.d.mts')) continue;
    const text = readFileSync(file, 'utf8');
    for (const pattern of SPECIFIER_PATTERNS) {
      for (const [, , , spec] of text.matchAll(pattern)) {
        if (!/\.(mjs|js|json|css)$/.test(spec)) {
          problems.push(`${relative(distRoot, file)} imports ${JSON.stringify(spec)} with no extension`);
        }
      }
    }
  }
  return problems;
}

/**
 * Entries whose ESM build is one file of their own, carrying the modules that would otherwise drag a library into every
 * page: `[package, the entry's module, what it carries]` — the package's exports map names the `.bundle.mjs` made of it.
 *
 * `@fieldia/core/schema` — zod and every schema of the format, with `validatePage` — is what the designer fetches as it
 * opens (its `pageSchemaPart`). Fetched as the package's own ESM files, those are the very modules core's entry
 * re-exports, and esbuild puts a module that any static import reaches — a re-export no one reads included — in a
 * chunk the page loads at once: zod came with the designer's first paint anyway. So the entry is bundled here (esbuild,
 * tree-shaken) with zod and every module that imports it inside — `carries` — and every other module of core imported
 * from its own file as before: one chunk, reached by nothing static, loaded when asked for. An app that also imports
 * `validatePage` from @fieldia/core itself carries the schemas twice: once at once, once in that chunk. zod's notice is
 * in THIRD_PARTY_NOTICES.md beside the package.
 */
const OWN_FILE = [['core', 'src/lib/format/schema-part.mjs', /node_modules\/zod\/|\/src\/lib\/format\/(validate|jitless|schema-part)\.mjs$/]];

/** Each entry of OWN_FILE bundled into a file of its own: a problem where it cannot be. */
async function entriesInFilesOfTheirOwn(distRoot, pkgDir) {
  const problems = [];
  for (const [pkgName, entry, carries] of OWN_FILE.filter(([name]) => name === pkgDir)) {
    const from = join(distRoot, entry);
    const own = from.replace(/\.mjs$/, '.bundle.mjs');
    if (!existsSync(from)) {
      problems.push(`${pkgName}: ${entry} is not built: OWN_FILE (tools/dual-build.mjs)`);
      continue;
    }
    const { build } = await import('esbuild');
    const result = await build({
      entryPoints: [from],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      outfile: own,
      write: false,
      logLevel: 'warning',
      nodePaths: [join(WORKSPACE, 'node_modules')],
      mainFields: ['module', 'main'],
      legalComments: 'inline',
      // Whitespace and syntax made small, names kept, so a stack trace through it still reads (an app's own bundler
      // minifies it the rest of the way): about half its size in the package.
      minifyWhitespace: true,
      minifySyntax: true,
      banner: { js: `// @fieldia/${pkgName}: ${entry} with zod (MIT, Colin McDonnell: THIRD_PARTY_NOTICES.md) and the schemas inside — tools/dual-build.mjs, OWN_FILE.` },
      plugins: [
        {
          name: 'own-file',
          setup(builder) {
            // zod, and a module that imports it (a schema), carried; any other module of the package imported from its file.
            builder.onResolve({ filter: /.*/ }, async (args) => {
              if (args.pluginData?.inner || args.kind === 'entry-point') return undefined;
              const found = await builder.resolve(args.path, { kind: args.kind, importer: args.importer, resolveDir: args.resolveDir, pluginData: { inner: true } });
              if (found.errors.length) return { errors: found.errors };
              if (carries.test(found.path) || /\bfrom ["']zod/.test(existsSync(found.path) ? readFileSync(found.path, 'utf8') : '')) return { path: found.path };
              if (!found.path.startsWith(distRoot)) return { errors: [{ text: `${args.path} (from ${args.importer}) is neither zod, a schema, nor a module of @fieldia/${pkgName}` }] };
              const path = relative(dirname(own), found.path).split('\\').join('/');
              return { path: path.startsWith('.') ? path : `./${path}`, external: true };
            });
          },
        },
      ],
    });
    writeFileSync(own, result.outputFiles[0].text);
  }
  return problems;
}

/**
 * The stylesheets the widgets, the viewer and the designer ship as text inside their code, minified as CSS in the built
 * package as the one-tag script and the demos minify them (tools/minified-styles.mjs: the same modules, the same literal,
 * the same minifier), so an app's bundle carries them small: its minifier leaves a string alone (0.35: about 13 KB
 * gzipped of every app's first load). Each line the stylesheet took is kept as a line break at its end, so the source
 * maps of the code after it still point where they did.
 */
async function minifyStyles(distRoot, pkgDir) {
  if (!STYLED_PACKAGES.includes(pkgDir)) return { problems: [], minified: 0 };
  const problems = [];
  let minified = 0;
  const lib = join(distRoot, 'src/lib');
  for (const name of readdirSync(lib).filter((file) => STYLE_MODULE.test(file) && !file.endsWith('.ts'))) {
    const path = join(lib, name);
    try {
      writeFileSync(path, await minifyStylesheet(readFileSync(path, 'utf8'), relative(distRoot, path), { lines: true }));
      minified++;
    } catch (error) {
      problems.push(`${(error instanceof Error ? error.message : String(error))} (tools/minified-styles.mjs)`);
    }
  }
  return { problems, minified };
}

const pkgDir = process.argv[2];
if (!pkgDir) {
  console.error('usage: node tools/dual-build.mjs <package-directory-name>');
  process.exit(1);
}

const distRoot = join(WORKSPACE, 'dist/libs', pkgDir);
const esmRoot = join(WORKSPACE, 'tmp', pkgDir, 'esm');

for (const [label, dir] of [['CommonJS', distRoot], ['ESM', esmRoot]]) {
  if (!existsSync(dir)) {
    console.error(`${pkgDir}: the ${label} compile produced nothing at ${relative(WORKSPACE, dir)}`);
    process.exit(1);
  }
}

const written = foldEsmIntoDist(esmRoot, distRoot);
const ownFiles = await entriesInFilesOfTheirOwn(distRoot, pkgDir);
const styles = await minifyStyles(distRoot, pkgDir);
const repaired = repairWorkspaceSpecifiers(distRoot);
const pkg = JSON.parse(readFileSync(join(distRoot, 'package.json'), 'utf8'));
const { problems: exportProblems, seen } = checkExports(pkg, distRoot);
const problems = [
  ...ownFiles,
  ...styles.problems,
  ...exportProblems,
  ...checkSideEffects(pkg, distRoot),
  ...checkNoBareSpecifiers(distRoot),
  ...checkNoWorkspacePaths(distRoot),
];

if (problems.length) {
  console.error(`\n${pkg.name}: the package is not consumable\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

const entries = Object.keys(pkg.exports ?? {}).filter((k) => k !== './package.json');
console.log(
  `${pkg.name}: ${written} ESM files folded in, ${entries.length} export ` +
    `${entries.length === 1 ? 'entry' : 'entries'} (${entries.join(', ')}), ` +
    `${seen.length} resolved paths checked` +
    (repaired ? `, ${repaired} workspace path${repaired === 1 ? '' : 's'} repaired` : '') +
    (styles.minified ? `, ${styles.minified} stylesheets minified` : '')
);
