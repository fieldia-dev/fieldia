/**
 * @fieldia/gantt's size, as an app's bundler would make it: what loads with
 * the page (the list's switcher learns there is a timeline, in four
 * languages) and the timeline itself, loaded the first time one is shown,
 * in a chunk of its own — each against its budget. Fieldia's own packages
 * are left out: an app has them already. Modelled on calendar-bundle.mjs.
 *
 *   node tools/gantt-bundle.mjs
 *
 * 0.31's first timeline (lane w6-gantt): with the page, its name on the
 * switcher in four languages and the code that loads the rest — 0.8, as the
 * calendar's. The timeline, loaded with the first one shown: bars by days,
 * weeks or months on the axis, in groups that close under their headings,
 * a row for a record with no start; the arrows from what each waits for, red
 * where one starts too soon; today's line; a bar dragged to move it or by
 * its ends to stretch it, by whole days, and moved a day at a time from the
 * keys, written once they rest, with Undo; one stop for the keys; on its
 * zone's clock; right to left; on paper, the whole plan on the page's
 * width; its words in four languages and its stylesheet — 14,308 bytes
 * measured, to 14.1 (the page's share 643 bytes, under the calendar's 0.8).
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'tmp/gantt-bundle');
const BUDGET = { page: 0.8, gantt: 14.1 };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const entry = join(OUT, 'entry.ts');
// What an app imports: the views for its lists.
writeFileSync(entry, `export { ganttListViews } from '../../libs/gantt/src/index';\n`);
const result = await build({
  entryPoints: { gantt: entry },
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  outdir: join(OUT, 'out'),
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  external: ['@fieldia/core', '@fieldia/widgets', '@fieldia/viewer', 'tslib'],
  logLevel: 'warning',
  metafile: true,
});
// What loads with the page: gantt.js and what it imports outright; the rest waits for an `import()`.
const outputs = result.metafile.outputs;
const withPage = new Set();
const reach = (path) => {
  if (withPage.has(path)) return;
  withPage.add(path);
  for (const used of outputs[path]?.imports ?? []) if (used.kind === 'import-statement') reach(used.path);
};
reach(Object.keys(outputs).find((path) => path.endsWith('/gantt.js')));
const sizes = Object.keys(outputs)
  .filter((path) => path.endsWith('.js'))
  .map((path) => {
    const text = readFileSync(path);
    return { file: path.split('/').pop(), raw: text.length, gzip: gzipSync(text).length, later: !withPage.has(path), drawing: /fd-gantt-sheet/.test(String(text)) };
  });
for (const s of sizes) console.log(`gantt · ${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.later ? ' (loaded with the first timeline shown)' : ''}`);
const kb = (n) => (n / 1024).toFixed(1);
const page = sizes.filter((s) => !s.later).reduce((sum, s) => sum + s.gzip, 0);
const gantt = sizes.filter((s) => s.later).reduce((sum, s) => sum + s.gzip, 0);
if (sizes.some((s) => !s.later && s.drawing)) throw new Error('The timeline is not in a chunk of its own: every page with a list would load it');
if (!sizes.some((s) => s.later && s.drawing)) throw new Error('No chunk draws the timeline: the lazy import is gone');
if (page > BUDGET.page * 1024) throw new Error(`@fieldia/gantt with the page is ${kb(page)} KB gzipped, over its ${BUDGET.page} KB budget`);
if (gantt > BUDGET.gantt * 1024) throw new Error(`The timeline's chunk is ${kb(gantt)} KB gzipped, over its ${BUDGET.gantt} KB budget`);
console.log(`@fieldia/gantt: ${kb(page)} KB gzipped with the page (budget ${BUDGET.page}); the timeline ${kb(gantt)} KB with the first one shown (budget ${BUDGET.gantt}) — ${page} and ${gantt} bytes`);
