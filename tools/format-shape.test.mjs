/**
 * The page format's shape, recorded per version: a release cannot change what a page may say under the old version.
 *   node --test tools/format-shape.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkFormatShape, formatVersionIn, shapeOf } from './format-shape.mjs';

const schema = (more = {}) => ({ type: 'object', description: 'A page.', properties: { fieldia: { type: 'string', const: '0.1' }, id: { type: 'string', title: 'Id' }, ...more } });

test('the shape is the structure alone: words and key order do not change it', () => {
  const words = schema();
  words.description = 'A form, survey or record screen as data.';
  words.properties.id.title = 'The page id';
  assert.equal(shapeOf(words), shapeOf(schema()));
  assert.equal(shapeOf({ properties: schema().properties, type: 'object' }), shapeOf(schema()));
  assert.match(shapeOf(schema()), /^sha256:[0-9a-f]{16}$/);
});

test('a new setting, or a renamed one, is a new shape', () => {
  assert.notEqual(shapeOf(schema({ calendar: { type: 'object' } })), shapeOf(schema()));
  const renamed = schema();
  renamed.properties.key = renamed.properties.id;
  delete renamed.properties.id;
  assert.notEqual(shapeOf(renamed), shapeOf(schema()));
});

/** A workspace of its own: the version the source says, the schema, and the shapes recorded. */
function workspace(version, page, shapes) {
  const root = mkdtempSync(join(tmpdir(), 'fieldia-format-'));
  mkdirSync(join(root, 'libs/core/src/lib/format'), { recursive: true });
  mkdirSync(join(root, 'libs/core/schema'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'libs/core/src/lib/format/version.ts'), `/** The page format version. */\nexport const FORMAT_VERSION = '${version}' as const;\n`);
  writeFileSync(join(root, 'libs/core/schema/page.schema.json'), JSON.stringify(page));
  if (shapes) writeFileSync(join(root, 'tools/format-shapes.json'), JSON.stringify(shapes));
  return root;
}

test('the check: as recorded, changed under the same version, or not recorded yet', () => {
  const roots = [];
  try {
    const same = workspace('0.1', schema(), { '0.1': shapeOf(schema()) });
    const changed = workspace('0.1', schema({ calendar: { type: 'object' } }), { '0.1': shapeOf(schema()) });
    const fresh = workspace('0.2', schema({ calendar: { type: 'object' } }), { '0.1': shapeOf(schema()) });
    roots.push(same, changed, fresh);
    assert.equal(formatVersionIn(same), '0.1');
    assert.equal(checkFormatShape(same).ok, true);
    const moved = checkFormatShape(changed);
    assert.equal(moved.ok, false);
    assert.match(moved.message, /changed since format 0\.1 was recorded/);
    assert.match(moved.message, /FORMAT_VERSIONS/);
    const unrecorded = checkFormatShape(fresh);
    assert.equal(unrecorded.ok, false);
    assert.match(unrecorded.message, /format 0\.2 has no shape recorded/);
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});
