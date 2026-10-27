import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageShapeData, writeShape, type FormatSince } from './test-shape-source';
import { PAGE_SHAPE } from './page-shape';
import { readShape } from './shape-check';

/**
 * The format's schema as the viewer's check reads it (page-shape.ts) is made from the zod definitions `validatePage`
 * parses with, checked in, and never drifts from them — as page.schema.json never does (json-schema.spec.ts).
 *
 * To make it again after changing the format: UPDATE_SHAPE=1 npx nx test core
 */
const FILE = join(__dirname, 'page-shape.ts');
/** Which format each place came in, read from the format's history by tools/format-since.mjs. */
const SINCE = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'tools', 'format-since.json'), 'utf8')) as FormatSince;

/** page-shape.ts as the definitions make it. */
export function pageShapeModule(): string {
  const { data } = pageShapeData(SINCE);
  const json = writeShape(data);
  const quoted = `'${json.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return [
    '// Made by page-shape.spec.ts from the format\'s zod definitions (test-shape-source.ts): never edited by hand.',
    '// To make it again after changing the format: UPDATE_SHAPE=1 npx nx test core',
    "import { readShape, type ShapeData } from './shape-check';",
    '',
    '/** The format\'s schema, its words left out, its rules named where they run: what the viewer checks a page with. */',
    `export const PAGE_SHAPE: ShapeData = readShape(${quoted});`,
    '',
  ].join('\n');
}

describe('page-shape.ts', () => {
  it('holds every refinement as a rule the viewer runs too, every rule somewhere, every pattern its own', () => {
    expect(pageShapeData(SINCE).problems).toEqual([]);
  });

  it('is the format\'s schema the zod definitions make', () => {
    const made = pageShapeModule();
    if (process.env['UPDATE_SHAPE']) writeFileSync(FILE, made);
    expect(readFileSync(FILE, 'utf8')).toBe(made);
    expect(PAGE_SHAPE).toEqual(pageShapeData(SINCE).data);
    // Written short and read back, the same schema.
    expect(readShape(writeShape(pageShapeData(SINCE).data))).toEqual(pageShapeData(SINCE).data);
  });
});
