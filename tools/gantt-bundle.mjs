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
 * Turkish, Persian, Urdu and Spanish (0.31, w6-languages — machine-assisted, not yet reviewed by a native speaker): the
 * view's name and its failure on the switcher in them, fetched with their words where they are spoken, the loader with
 * the page (642 bytes measured before, 817 after, under 0.8 — inline they took it to 826);
 * the code that fetches their words, and a day's tag on the Gregorian calendar and Persian's Saturday week (14,273 bytes
 * measured before, 14,404 after, under 14.1); and each language's words in a chunk of its own, fetched with the first
 * timeline shown in it, each against its own budget (`LANGUAGE_BUDGET`: Turkish 713 bytes, Persian 878, Urdu 861,
 * Spanish 661 measured) — a timeline in any other language never carries them (inline, they took its chunk to 16,540).
 * The week's first day where CLDR starts it for the page's own tag where it is shown in its own language (en-GB's, not
 * en's): 14,404 bytes measured before, 14,444 after, to 14.2.
 * The owner's walk of 0.31 mended (walkfix31-engine): a day's letter in the language's own script (Urdu's short names),
 * the timeline opened on the plan from its first task, a sign at either edge of the days shown saying how many bars run
 * off it, and Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y taking a move back and making it again — 14,486 bytes measured before,
 * 15,525 after, to 15.2; Persian's words 878 before, 925 after, to 1.0 (Turkish's 751, Urdu's 908, Spanish's 701,
 * inside theirs).
 * While it waits (w7-loading, 0.33): the timeline's records waiting the one way (loading.ts in @fieldia/widgets) — drawn
 * the first time, asked again under a bar, a failure in its place with Retry (gantt-view.ts) — 15,525 bytes measured
 * before, 15,611 after, to 15.3; with the page 817 before, 815 after, inside its 0.8.
 * 0.34's speed (harden-perf): a bar moved drawn once — not again when its save brings back what is shown — the chart
 * read before it is written, and its axis's height told by the browser once it is laid out (a ResizeObserver), never
 * read in the middle of drawing: 15,541 bytes measured before, 15,723 after, to 15.4.
 * 0.34's merge: the timeline's wait (0.33) over its draw once — a reload that brings back what is drawn draws nothing
 * again — 15,611 bytes measured before (0.33.0), 15,799 after, to 15.5; with the page 815, 816, inside its 0.8.
 * 0.34.1 (the owner's walk of 0.33.0): the timeline's place waits as the list says while its code comes — its skeleton,
 * never an empty space under the list's search — the timeline's first wait going on from it (list-view.ts): with the
 * page 816 bytes measured before, 865 after, to 0.9; the timeline 15,799, 15,834, inside its 15.5.
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'tmp/gantt-bundle');
const BUDGET = { page: 0.9, gantt: 15.5 };
const LANGUAGE_BUDGET = { tr: 0.8, fa: 1.0, ur: 0.9, es: 0.7 };

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
    // A language's own words (Turkish, Persian, Urdu, Spanish): a chunk of their own, fetched with the first timeline in them.
    const language = /locales\/(\w+)\.ts$/.exec(outputs[path].entryPoint ?? '')?.[1];
    return { file: path.split('/').pop(), raw: text.length, gzip: gzipSync(text).length, later: !withPage.has(path), drawing: /fd-gantt-sheet/.test(String(text)), language };
  });
for (const s of sizes) console.log(`gantt · ${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.later ? ' (loaded with the first timeline shown)' : ''}`);
const kb = (n) => (n / 1024).toFixed(1);
const page = sizes.filter((s) => !s.later).reduce((sum, s) => sum + s.gzip, 0);
const gantt = sizes.filter((s) => s.later && !s.language).reduce((sum, s) => sum + s.gzip, 0);
// Each language that comes in a chunk of its own, in it alone, against its own budget: never in the timeline's chunk.
for (const [locale, budget] of Object.entries(LANGUAGE_BUDGET)) {
  const words = sizes.filter((s) => s.language === locale);
  if (words.length !== 1 || !words[0].later) throw new Error(`The timeline's words in ${locale} are not in a chunk of their own, fetched with the first timeline in them`);
  if (words[0].gzip > budget * 1024) throw new Error(`The timeline's words in ${locale} are ${kb(words[0].gzip)} KB gzipped, over their ${budget} KB budget`);
}
if (sizes.some((s) => !s.later && s.drawing)) throw new Error('The timeline is not in a chunk of its own: every page with a list would load it');
if (!sizes.some((s) => s.later && s.drawing)) throw new Error('No chunk draws the timeline: the lazy import is gone');
if (page > BUDGET.page * 1024) throw new Error(`@fieldia/gantt with the page is ${kb(page)} KB gzipped, over its ${BUDGET.page} KB budget`);
if (gantt > BUDGET.gantt * 1024) throw new Error(`The timeline's chunk is ${kb(gantt)} KB gzipped, over its ${BUDGET.gantt} KB budget`);
console.log(`@fieldia/gantt: ${kb(page)} KB gzipped with the page (budget ${BUDGET.page}); the timeline ${kb(gantt)} KB with the first one shown (budget ${BUDGET.gantt}) — ${page} and ${gantt} bytes`);
