import type { Field, LineField } from './field';
import type { FieldNode } from './layout';
import type { FieldTools } from './part-checks';

/** The kinds a code read is written into, as a field scanned or one a GS1 code fills. */
const FILLED = new Set(['char', 'text', 'date', 'integer', 'float', 'monetary', 'many2one']);
/** The widgets a char field may be drawn with and still be scanned into: a box of words. */
const BOXES = new Set(['email', 'url', 'phone']);

type Settings = { by?: unknown; part?: unknown; fills?: unknown; field?: unknown; count?: unknown };
type Fields = Record<string, Field | LineField>;

/** What a scan's settings are, `true` aside: its object, or none. */
const settingsOf = (scan: unknown): Settings => (scan && typeof scan === 'object' && !Array.isArray(scan) ? (scan as Settings) : {});

/**
 * A field scanned into with the camera (`options.scan`), and a table's columns scanned into (`cells.<column>.options.scan`):
 * each on a kind a code is written into — a char drawn as a box of words, a text, a link — or a table of lines that
 * counts what is scanned, by a column a code names (`field`: words or a link) and a whole number counted (`count`); a
 * link's code by a field of its records (`by`), on a link alone; the fields a GS1 code fills, each one of the page's — a
 * line's for a cell or a counted line — of a kind a code's part is written into, never the field scanned itself. Run
 * with a page's reference check; in the one-tag script they come with the scan part, owed till it came.
 */
export function checkScan(node: FieldNode, def: Field | LineField | undefined, path: string, tools: FieldTools): void {
  const scan = node.options?.['scan'];
  if (def && scan !== undefined && scan !== false) checkOne(node.field, def, node.widget, scan, `${path}.options.scan`, tools, tools.page.fields);
  if (def?.type !== 'one2many') return;
  for (const [column, rules] of Object.entries(node.cells ?? {})) {
    const cell = rules?.options?.['scan'];
    const sub = def.fields[column];
    if (cell === undefined || cell === false || !sub) continue;
    checkOne(column, sub, rules.widget, cell, `${path}.cells.${column}.options.scan`, tools, def.fields);
  }
}

function checkOne(name: string, def: Field | LineField, widget: string | undefined, scan: unknown, at: string, tools: FieldTools, scope: Fields): void {
  const settings = settingsOf(scan);
  const counts = def.type === 'one2many';
  const box = (def.type === 'char' && (!widget || BOXES.has(widget))) || (def.type === 'text' && !widget) || (def.type === 'many2one' && !widget);
  if (!box && !counts) {
    tools.report(at, `scan is for a char, text or many2one field drawn as its box, or a table of lines that counts what is scanned; "${name}" is a ${def.type}${widget ? ` drawn as ${widget}` : ''}`);
    return;
  }
  // A table counts by a column of its lines: what a code names, and the number counted.
  const columns: Fields = counts ? (def.fields as Fields) : scope;
  let named: Field | LineField | undefined = counts ? undefined : def;
  if (counts) {
    if (typeof settings.field !== 'string' || typeof settings.count !== 'string') {
      tools.report(at, `a table of lines scanned into counts what a code names: say its column ("field") and the column counted ("count")`);
      return;
    }
    named = tools.need(settings.field, `${at}.field`, columns);
    if (named && named.type !== 'char' && named.type !== 'many2one') tools.report(`${at}.field`, `"${settings.field}" is a ${named.type}; a code names words (a char column) or a record (a many2one)`);
    const counted = tools.need(settings.count, `${at}.count`, columns);
    if (counted && counted.type !== 'integer' && counted.type !== 'float') tools.report(`${at}.count`, `"${settings.count}" is a ${counted.type}; what is counted is a number (an integer column)`);
    if (settings.count === settings.field) tools.report(`${at}.count`, 'the column counted is not the one a code names');
  } else {
    for (const key of ['field', 'count'] as const) if (settings[key] !== undefined) tools.report(`${at}.${key}`, `${key} is for a table of lines that counts what is scanned; "${name}" is a ${def.type}`);
  }
  if (settings.by !== undefined && named && named.type !== 'many2one') tools.report(`${at}.by`, `by names the field holding a linked record's code: for a many2one; "${counts ? settings.field : name}" is a ${named.type}`);
  if (settings.part !== undefined && named && !FILLED.has(named.type)) tools.report(`${at}.part`, `a GS1 part is written into words, a number, a day or a link; "${counts ? settings.field : name}" is a ${named.type}`);
  const fills = settings.fills;
  if (!fills || typeof fills !== 'object') return;
  const own = counts ? settings.field : name;
  for (const [field, fill] of Object.entries(fills as Record<string, unknown>)) {
    const where = `${at}.fills.${field}`;
    if (field === own) {
      tools.report(where, `"${field}" is the field scanned: its own part is "part"`);
      continue;
    }
    if (counts && field === settings.count) {
      tools.report(where, `"${field}" is the column counted`);
      continue;
    }
    const filled = tools.need(field, where, columns);
    if (!filled) continue;
    if (!FILLED.has(filled.type)) tools.report(where, `"${field}" is a ${filled.type}; a GS1 part is written into words, a number, a day or a link`);
    else if (fill && typeof fill === 'object' && (fill as { by?: unknown }).by !== undefined && filled.type !== 'many2one') tools.report(`${where}.by`, `by names the field holding a linked record's code: for a many2one; "${field}" is a ${filled.type}`);
  }
}
