/**
 * The page format's shape, kept per format version, so a release cannot change what a page may say and still call
 * the format by its old version — a page it writes would then reach an older Fieldia that cannot read it, under a
 * version that older Fieldia believes it reads.
 *
 * The shape is the page's JSON Schema (libs/core/schema/page.schema.json) without its words — descriptions, titles,
 * examples — as a short hash. tools/format-shapes.json keeps the shape of each format version released.
 *
 *   node tools/format-shape.mjs            say whether the format still has the shape recorded for its version
 *   node tools/format-shape.mjs --record   record the shape of a new FORMAT_VERSION (never rewrites one recorded)
 *
 * tools/release.mjs runs the check: `check` warns, `publish` refuses.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORDS = new Set(['description', 'title', 'examples', '$comment']);

/** The schema's structure alone, its keys in order: the same for two schemas that differ only in their words. */
export function shapeOf(schema) {
  const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !WORDS.has(key))
        .sort()
        .map((key) => [key, strip(value[key])])
    );
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(strip(schema))).digest('hex').slice(0, 16)}`;
}

/** The format version the source says it writes: FORMAT_VERSION in libs/core/src/lib/format/version.ts. */
export function formatVersionIn(workspace) {
  const source = readFileSync(join(workspace, 'libs/core/src/lib/format/version.ts'), 'utf8');
  const found = /export const FORMAT_VERSION = '([^']+)'/.exec(source)?.[1];
  if (!found) throw new Error('libs/core/src/lib/format/version.ts names no FORMAT_VERSION');
  return found;
}

/**
 * Whether the format has the shape recorded for its version: `{ ok, version, shape, recorded, message }`. A version
 * not recorded yet is not ok either: its shape is written down with --record as the version is made.
 */
export function checkFormatShape(workspace) {
  const version = formatVersionIn(workspace);
  const shape = shapeOf(JSON.parse(readFileSync(join(workspace, 'libs/core/schema/page.schema.json'), 'utf8')));
  const file = join(workspace, 'tools/format-shapes.json');
  const recorded = (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})[version] ?? null;
  if (recorded === shape) return { ok: true, version, shape, recorded, message: `the page format is format ${version}, as recorded` };
  const message = recorded
    ? `the page format changed since format ${version} was recorded: a page this Fieldia writes may say what a reader of format ${version} cannot read, under the version it believes it reads. ` +
      'Before publishing, make it a new format: add the next version to FORMAT_VERSIONS and FORMAT_VERSION (libs/core/src/lib/format/version.ts), ' +
      'a step to PAGE_UPGRADES for anything renamed or reshaped (with its example), then `node tools/format-shape.mjs --record`; ' +
      'and once that format is released, `node tools/format-since.mjs --write` and `UPDATE_SHAPE=1 npx nx test core`, so a page is stamped with the lowest format it needs'
    : `format ${version} has no shape recorded: run \`node tools/format-shape.mjs --record\` as the version is made`;
  return { ok: false, version, shape, recorded, message };
}

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const checked = checkFormatShape(WORKSPACE);
  if (process.argv[2] === '--record') {
    if (checked.recorded && !checked.ok) {
      console.error(`format-shape: format ${checked.version} was released with another shape; it is never rewritten. ${checked.message}`);
      process.exit(1);
    }
    const file = join(WORKSPACE, 'tools/format-shapes.json');
    const shapes = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    writeFileSync(file, `${JSON.stringify({ ...shapes, [checked.version]: checked.shape }, null, 2)}\n`);
    console.log(`format-shape: format ${checked.version} is ${checked.shape}`);
  } else {
    console.log(`format-shape: ${checked.message}`);
    if (!checked.ok) process.exit(1);
  }
}
