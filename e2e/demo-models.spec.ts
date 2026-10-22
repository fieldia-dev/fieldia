import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Page } from '@playwright/test';
import { build } from 'esbuild';
import ts from 'typescript';
import { expect, test } from './fixtures';

/**
 * The demos share one memory source (demos/shared/sample-data.ts): each demo's records go into one object under their
 * models' names, and a model two demos give is the later one's alone — the other demo's records silently gone, its page
 * drawn empty. It happened three times: 0.29's `enquiry` and `clinic.service`, 0.31's face chart's treatment over the
 * scanned one (its patient's box empty); and a work item's areas and iterations under the picker's, since 0.2x. So
 * every model is given by one demo, or by several with the same records; and where the real pages' lanes, the business
 * and code demos are merged in row by row, no row is given twice differently.
 *
 * Read from the source itself: each entry of the source's `records` — a model given by name, or a demo's records spread
 * in — named by the file its records come from (read in Node), and worked out by the modules it imports (run in a page).
 */

const ROOT = process.cwd();
const SHARED = join(ROOT, 'demos/shared');
const FILE = join(SHARED, 'sample-data.ts');

type Rows = Record<string, unknown>;
type Records = Record<string, Rows>;
/** An entry of the source's records: who gives it, what it says, and the models it gives (their records, where read). */
interface Entry {
  demo: string;
  text: string;
  models: Map<string, Rows | null>;
}

const source = ts.createSourceFile(FILE, readFileSync(FILE, 'utf8'), ts.ScriptTarget.Latest, true);

/** The names the file imports, each with the module it comes from. */
const imported = new Map<string, { from: string; name: string }>();
for (const statement of source.statements) {
  if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly) continue;
  const from = (statement.moduleSpecifier as ts.StringLiteral).text;
  const clause = statement.importClause;
  if (clause.name) imported.set(clause.name.text, { from, name: 'default' });
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) for (const one of bindings.elements) if (!one.isTypeOnly) imported.set(one.name.text, { from, name: (one.propertyName ?? one.name).text });
  if (bindings && ts.isNamespaceImport(bindings)) imported.set(bindings.name.text, { from, name: '*' });
}

/** The file's own constants made of an object written out, by name: their models read from the words. */
const locals = new Map<string, ts.ObjectLiteralExpression>();
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const one of statement.declarationList.declarations) if (ts.isIdentifier(one.name) && one.initializer && ts.isObjectLiteralExpression(one.initializer)) locals.set(one.name.text, one.initializer);
}

/** The demos' records: the object under `records` that the demos' data source is made with. */
function recordsLiteral(): ts.ObjectLiteralExpression {
  let found: ts.ObjectLiteralExpression | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text !== 'sampleDataSource') return;
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'records' && ts.isObjectLiteralExpression(node.initializer)) found = node.initializer;
    else ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) throw new Error('demos/shared/sample-data.ts: no `records` in sampleDataSource');
  return found;
}

const keyOf = (name: ts.PropertyName) => (ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name) ? name.text : name.getText(source));
/** The names an expression reads, each once. */
function namesIn(node: ts.Node, names = new Set<string>()): Set<string> {
  if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) names.add(node.text);
  ts.forEachChild(node, (child) => void namesIn(child, names));
  return names;
}
/** The expression a spread puts in where it puts anything: `(asked ? records : {})` read as its records. */
const spreadOf = (node: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(node) ? spreadOf(node.expression) : ts.isConditionalExpression(node) ? spreadOf(node.whenTrue) : node);

/**
 * The demos' own modules, as the browser gets them: bundled once (esbuild, the workspace's paths to the packages' source,
 * the pages' JSON) and run in a blank page — every module a records entry reads, and those merged in row by row. A
 * demo's records are worked out there as the demos work them out (a photo drawn on a canvas among them).
 */
const MERGED = ['./real', './business', './code-page'];
const FROMS = [...new Set([...[...imported.values()].map((one) => one.from).filter((from) => from.startsWith('./') && !from.endsWith('.json')), ...MERGED])];
let script: Promise<string> | null = null;
const demoScript = () =>
  (script ??= build({
    stdin: { contents: FROMS.map((from, at) => `export * as m${at} from '${from}';`).join('\n'), resolveDir: SHARED, loader: 'ts' },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: '__demos',
    target: 'es2022',
    tsconfig: join(ROOT, 'tsconfig.base.json'),
    loader: { '.json': 'json', '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'text' },
    logLevel: 'silent',
  }).then((out) => out.outputFiles[0].text));

/** What a name an entry reads stands for in the page: a module's export, or the demo's address and its 20,000 homes asked. */
type Ref = { kind: 'export'; at: number; name: string } | { kind: 'params' } | { kind: 'many' };

/** A reader of the demos' records in a page of the browser: what an expression of the source is, there; null where it reads the file's own. */
async function reader(page: Page) {
  const failed: string[] = [];
  page.on('pageerror', (error) => failed.push(error.message));
  // A page of the demos' own origin, empty: their modules keep things in its storage as they load.
  await page.goto('/demo-models-blank.html');
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: await demoScript() });
  if (failed.length || !(await page.evaluate(() => 'm0' in ((window as unknown as { __demos?: object }).__demos ?? {})))) throw new Error(`the demos' modules did not run in a page: ${failed.join('; ')}`);
  const run = (names: string[], refs: Ref[], body: string) =>
    page.evaluate(
      ({ names, refs, body }) => {
        const modules = (window as unknown as { __demos: Record<string, Record<string, unknown>> }).__demos;
        const values = refs.map((ref) => (ref.kind === 'params' ? new URLSearchParams('page=map-many-homes') : ref.kind === 'many' ? true : ref.name === '*' ? modules[`m${ref.at}`] : modules[`m${ref.at}`][ref.name]));
        const value = new Function(...names, `return (${body});`)(...values);
        return value === undefined ? null : JSON.parse(JSON.stringify(value));
      },
      { names, refs, body }
    ) as Promise<unknown>;
  return {
    async evaluate(node: ts.Expression): Promise<unknown> {
      const names = [...namesIn(node)].filter((name) => !['undefined', 'Object', 'Array', 'JSON', 'String', 'Number'].includes(name));
      const refs: Ref[] = [];
      for (const name of names) {
        const from = imported.get(name);
        if (name === 'params' || name === 'many') refs.push({ kind: name });
        else if (from && FROMS.includes(from.from)) refs.push({ kind: 'export', at: FROMS.indexOf(from.from), name: from.name });
        else return null;
      }
      const js = ts.transpileModule(`export default (${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
      return run(names, refs, js.replace(/^[\s\S]*?exports\.default = /, '').replace(/;\s*$/, ''));
    },
    /** A module's export, as JSON: the records of a demo merged in row by row. */
    exported: (from: string, name: string) => run([], [], `window.__demos.m${FROMS.indexOf(from)}[${JSON.stringify(name)}]`),
  };
}
type Reader = Awaited<ReturnType<typeof reader>>;

/** The demo an entry's records come from: the file whose name the entry reads, else this file's own. */
function demoOf(node: ts.Node): string {
  for (const name of namesIn(node)) {
    const from = imported.get(name)?.from;
    if (from?.startsWith('.')) return relative(ROOT, join(SHARED, from));
  }
  return 'demos/shared/sample-data.ts';
}

async function entries(read: Reader): Promise<Entry[]> {
  const all: Entry[] = [];
  for (const property of recordsLiteral().properties) {
    const text = property.getText(source).replace(/\s+/g, ' ').slice(0, 90);
    if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
      const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
      // A model given by name: its records worked out only where another entry gives it too.
      all.push({ demo: demoOf(value), text, models: new Map([[keyOf(property.name), null]]) });
      continue;
    }
    if (!ts.isSpreadAssignment(property)) continue;
    const spread = spreadOf(property.expression);
    const local = ts.isIdentifier(spread) ? locals.get(spread.text) : undefined;
    if (local) {
      // The file's own constant: its models by their names, as written.
      all.push({ demo: 'demos/shared/sample-data.ts', text, models: new Map(local.properties.filter((p) => p.name).map((p) => [keyOf(p.name!), null])) });
      continue;
    }
    const records = (await read.evaluate(spread)) as Records | null;
    if (!records) throw new Error(`demos/shared/sample-data.ts: the records of "${text}" could not be read here — import them from a module of their own`);
    all.push({ demo: demoOf(spread), text, models: new Map(Object.entries(records)) });
  }
  return all;
}

const same = (one: unknown, other: unknown) => one !== null && other !== null && JSON.stringify(one) === JSON.stringify(other);

test('no two demos give one model different records: each model in the shared source is one demo’s', async ({ page }) => {
  const read = await reader(page);
  const given = await entries(read);
  expect(given.length).toBeGreaterThan(40);
  const clashes: string[] = [];
  const first = new Map<string, Entry>();
  for (const entry of given) {
    for (const [model, rows] of entry.models) {
      const before = first.get(model);
      if (!before) {
        first.set(model, entry);
        continue;
      }
      // Given twice: the same records twice is no harm; anything else, the later entry's records replace the earlier's.
      const property = recordsLiteral().properties.find((p) => p.getText(source).replace(/\s+/g, ' ').slice(0, 90) === entry.text);
      const theirs = rows ?? (property && ts.isPropertyAssignment(property) ? await read.evaluate(property.initializer) : null);
      const earlier = before.models.get(model) ?? null;
      if (!same(earlier, theirs)) clashes.push(`model "${model}": ${before.demo} (${before.text}) and ${entry.demo} (${entry.text}) — the second's records replace the first's`);
    }
  }
  expect(clashes).toEqual([]);
});

test('the demos merged in row by row — the real pages, the business and the code demos — give no row twice differently', async ({ page }) => {
  const read = await reader(page);
  const merged: [string, Records][] = [
    ['demos/shared/real', ((await read.exported('./real', 'real')) as { records?: Records }).records ?? {}],
    ['demos/shared/business.ts', ((await read.exported('./business', 'businessData')) as { records?: Records }).records ?? {}],
    ['demos/shared/code-page.ts', ((await read.exported('./code-page', 'codeData')) as { records?: Records }).records ?? {}],
  ];
  // The shared source's own records, where they can be read here, merged under them.
  for (const entry of await entries(read)) {
    const rows = [...entry.models].filter(([, one]) => one !== null) as [string, Rows][];
    if (rows.length) merged.unshift([entry.demo, Object.fromEntries(rows)]);
  }
  const clashes: string[] = [];
  const seen = new Map<string, { demo: string; row: string }>();
  for (const [demo, records] of merged) {
    for (const [model, rows] of Object.entries(records)) {
      for (const [id, row] of Object.entries(rows ?? {})) {
        const key = `${model} #${id}`;
        const before = seen.get(key);
        const json = JSON.stringify(row);
        if (before && before.demo !== demo && before.row !== json) clashes.push(`${key}: ${before.demo} and ${demo}`);
        else if (!before) seen.set(key, { demo, row: json });
      }
    }
  }
  expect(clashes).toEqual([]);
});
