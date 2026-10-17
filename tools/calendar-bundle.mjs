/**
 * @fieldia/calendar's size, as an app's bundler would make it: what loads
 * with the page (the list's switcher learns there is a calendar, in four
 * languages) and the calendar itself, loaded the first time one is shown,
 * in a chunk of its own — each against its budget. Fieldia's own packages
 * are left out: an app has them already.
 *
 *   node tools/calendar-bundle.mjs
 *
 * 0.21's first calendar: with the page, its name on the switcher in four
 * languages and the code that loads the rest — 0.8 (0.6 measured). The calendar, loaded
 * with the first one shown: the day, the week, the month and the agenda; a
 * column for each person or room; records side by side; the line of now;
 * dragging to move and to stretch, a slot pressed or dragged for a new
 * record; "Move to…" and the keys; Undo; its words in four languages and
 * its stylesheet — 15 (14.6 measured). Then an agenda's row with a Move to…
 * button of its own for a phone, a screen reader's press on a slot or a
 * record, records and slots never under 24 pixels (an hour of 96 where slots
 * are a quarter of an hour), a short record kept to one line, and a record
 * from the night before taken by its morning's part — 0.5 more, to 15.5.
 * Then the calendar's 960 lines split into four along their sections (the
 * drawing, the pointer's gestures, the keys, Move to…), which share what the
 * calendar shows through an object whose property names a bundler keeps
 * where it shortened the closure's own, and a stretch the browser takes
 * away let go of — 0.5 more, to 16 (15.7 measured). Then a record's words
 * in the whole lines its height holds, each word whole or cut with "…" at
 * the name's own end (a Latin name right to left keeps its start), and the
 * name alone in a block too narrow for its time — 0.4 more, to 16.4 (16.1
 * measured). Then the moves kept safe: a save of the moved fields alone, said
 * to be partial, with Undo the same; records whose times or person are locked
 * kept still and told so; Move to… refusing a day far from the record's, in
 * words, and the keys kept in place wherever the record goes; Escape letting
 * go of a stretch and of slots dragged across; and a crowded slot's lanes
 * kept to its width, with "+N more" and the list it opens — 1.8 more, to 18.2
 * (17.9 measured).
 * On its start field's time zone, else its page's, else the browser's, in
 * every view (0.25's size pass): its days, its hours, today and the line for
 * now on that clock, the zone's short name after the span where it is not
 * the reader's own, and a record moved keeping its real length across a
 * change of the clocks — 19,019 bytes measured, to 18.6.
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'tmp/calendar-bundle');
const BUDGET = { page: 0.8, calendar: 18.6 };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const entry = join(OUT, 'entry.ts');
// What an app imports: the views for its lists.
writeFileSync(entry, `export { calendarListViews } from '../../libs/calendar/src/index';\n`);
const result = await build({
  entryPoints: { calendar: entry },
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
// What loads with the page: calendar.js and what it imports outright; the rest waits for an `import()`.
const outputs = result.metafile.outputs;
const withPage = new Set();
const reach = (path) => {
  if (withPage.has(path)) return;
  withPage.add(path);
  for (const used of outputs[path]?.imports ?? []) if (used.kind === 'import-statement') reach(used.path);
};
reach(Object.keys(outputs).find((path) => path.endsWith('/calendar.js')));
const sizes = Object.keys(outputs)
  .filter((path) => path.endsWith('.js'))
  .map((path) => {
    const text = readFileSync(path);
    return { file: path.split('/').pop(), raw: text.length, gzip: gzipSync(text).length, later: !withPage.has(path), drawing: /fd-cal-grid/.test(String(text)) };
  });
for (const s of sizes) console.log(`calendar · ${s.file}: ${(s.raw / 1024).toFixed(1)} KB, ${(s.gzip / 1024).toFixed(1)} KB gzipped${s.later ? ' (loaded with the first calendar shown)' : ''}`);
const kb = (n) => (n / 1024).toFixed(1);
const page = sizes.filter((s) => !s.later).reduce((sum, s) => sum + s.gzip, 0);
const calendar = sizes.filter((s) => s.later).reduce((sum, s) => sum + s.gzip, 0);
if (sizes.some((s) => !s.later && s.drawing)) throw new Error('The calendar is not in a chunk of its own: every page with a list would load it');
if (!sizes.some((s) => s.later && s.drawing)) throw new Error('No chunk draws the calendar: the lazy import is gone');
if (page > BUDGET.page * 1024) throw new Error(`@fieldia/calendar with the page is ${kb(page)} KB gzipped, over its ${BUDGET.page} KB budget`);
if (calendar > BUDGET.calendar * 1024) throw new Error(`The calendar's chunk is ${kb(calendar)} KB gzipped, over its ${BUDGET.calendar} KB budget`);
console.log(`@fieldia/calendar: ${kb(page)} KB gzipped with the page (budget ${BUDGET.page}); the calendar ${kb(calendar)} KB with the first one shown (budget ${BUDGET.calendar})`);
