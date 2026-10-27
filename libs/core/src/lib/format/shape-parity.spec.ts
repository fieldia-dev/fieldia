import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage } from './check-page';
import { wholeCheck } from './check-whole';
import { validatePage } from './validate';
import { shapeIssues, type ShapeData } from './shape-check';
import { PAGE_SHAPE } from './page-shape';
import { upgradePage } from './upgrade';

/**
 * One check, not a weaker copy (the audit's R-M5): the whole check every viewer runs after a page's first draw
 * (`checkPageWhole`, check-whole.ts, no validation library in it) and `validatePage` give one verdict on every example
 * page, on thousands of mistakes made in them one at a time, and on the mistakes an AI agent writing a page makes most.
 * And the mistakes are enough to tell: a check without its rules, or one that lets keys it does not know through,
 * disagrees with `validatePage` on hundreds of them. The check before the draw (`checkPage`, 0.35's) refuses a part of
 * what they refuse, never more: in 0.36 the rest is drawn and said, refused from 0.37 (`page.invalid`).
 */
const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const NAMES = readdirSync(EXAMPLES).filter((name) => name.endsWith('.page.json'));
const PAGES = NAMES.map((name) => ({ name, page: JSON.parse(readFileSync(join(EXAMPLES, name), 'utf8')) as Record<string, unknown> }));
type Json = unknown;
type Place = { parent: Record<string, Json> | Json[]; key: string | number };

/** A seeded stream of numbers in [0, 1): the same mistakes on every run. */
function stream(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every place in a value: its parent and key, each object and array and leaf. */
function places(value: Json, out: Place[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      out.push({ parent: value, key: i });
      places(item, out);
    });
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      out.push({ parent: value as Record<string, Json>, key });
      places(item, out);
    }
  }
  return out;
}

/** Values of each kind, as a mistake puts one where another belongs. */
const STRANGE: Json[] = ['', 'x', 'Draft', 'constructor', 'yes', 'a b', '0.13', 'today', '#zzzzzz', 'EG,sa', 'Mars/Olympus', '4:3', '30:1', '99-99', 'between', 'within', -1, 0, 1.5, 3, 100000, 9e15, true, false, null, [], [1], ['a', 'a'], ['EG'], {}, { value: 'x', label: 'X' }, { south: 1, west: 2, north: 3, east: 4 }];
/** The keys the format's rules read: a mistake there tries a rule. */
const RULED_KEYS = new Set(['options', 'mask', 'maskKeeps', 'shorthand', 'timeout', 'delay', 'slowAfter', 'warn', 'minutes', 'minFiles', 'maxFiles', 'multiple', 'precision', 'hijri', 'days', 'translate', 'requiredIn', 'op', 'value', 'valueFrom', 'area', 'within', 'lines', 'model', 'filter', 'period', 'widget', 'scan', 'aspect', 'countries', 'level', 'image', 'imageField', 'timeZone', 'optionsFrom', 'when', 'on', 'record', 'maxSeconds', 'loading', 'signs', 'length', 'size']);
const WIDGETS = ['phone', 'slots', 'signature', 'photos', 'one-time-code', 'qrcode', 'barcode', 'pins', 'path', 'dot', 'tree', 'address-search'];

/** One mistake made in a copy of a page — a key taken out, a key added, a value of another kind or another value, a list emptied or doubled — anywhere, or where a rule reads (`ruled`). */
function mistake(page: Json, next: () => number, ruled = false): Json {
  const copy = JSON.parse(JSON.stringify(page)) as Json;
  const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)];
  const all = places(copy);
  const near = ruled ? all.filter((one) => RULED_KEYS.has(String(one.key))) : all;
  const at = pick(near.length ? near : all);
  const { parent, key } = at;
  const value = (parent as Record<string | number, Json>)[key];
  const kind = Math.floor(next() * 7);
  if (kind === 0 && !Array.isArray(parent)) delete (parent as Record<string, Json>)[key as string];
  else if (kind === 1 && value && typeof value === 'object' && !Array.isArray(value)) (value as Record<string, Json>)[pick(['widget', 'read-only', 'version', 'options', 'label', 'invisible', 'type', 'id', 'colour', 'min', 'mask', 'scan', 'loading', 'record'])] = pick(STRANGE);
  else if (kind === 2 && Array.isArray(value)) {
    if (next() < 0.5) value.length = 0;
    else if (value.length) value.push(JSON.parse(JSON.stringify(value[0])));
  } else if (kind === 3 && typeof value === 'string') (parent as Record<string | number, Json>)[key] = pick(['', 'x', 'Draft', value.toUpperCase(), `${value} `, 'constructor', 'select', 'char', 'list']);
  else if (kind === 4 && value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, Json>)['type'] === 'field') {
    // A field shown by a widget whose own options the format knows, with options of every kind.
    Object.assign(value as Record<string, Json>, { widget: pick(WIDGETS), options: { [pick(['countries', 'length', 'signs', 'aspect', 'level', 'size', 'image', 'imageField', 'mask', 'scan', 'loading', 'placeField', 'maxPins', 'colors'])]: pick(STRANGE) } });
  } else (parent as Record<string | number, Json>)[key] = pick(STRANGE);
  return copy;
}

/** The mistakes the stream makes, in every example page: the smaller pages more often, as each costs a check of the whole page. */
function mistakes(): Json[] {
  const next = stream(0x0f1e1d1a);
  const out: Json[] = [];
  for (const { page } of PAGES) {
    const times = JSON.stringify(page).length > 40000 ? 2 : 10;
    for (let i = 0; i < times; i++) out.push(mistake(page, next), mistake(page, next, true));
  }
  return out;
}
const MADE = mistakes();
const VALIDATED = MADE.map((page) => validatePage(page).ok);

/**
 * Where a check says otherwise than `validatePage` among the mistakes (every `step`th): how many, and the first few with
 * what the one refusing said.
 */
function disagreements(check: (page: Json, i: number) => boolean, step = 1) {
  const at: number[] = [];
  MADE.forEach((page, i) => {
    if (i % step === 0 && check(page, i) !== VALIDATED[i]) at.push(i);
  });
  const said = (i: number) => {
    const refused = VALIDATED[i] ? wholeCheck(MADE[i]) : validatePage(MADE[i]);
    return { validate: VALIDATED[i], said: refused.ok ? '' : refused.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' | ').slice(0, 300) };
  };
  return { count: at.length, first: at.slice(0, 5).map(said) };
}

/** The format's schema with every node changed by `change`: a weaker check, to show the mistakes tell it apart. */
function weakened(change: (node: Record<string, unknown>) => void): ShapeData {
  const copy = JSON.parse(JSON.stringify(PAGE_SHAPE)) as ShapeData;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      change(node as Record<string, unknown>);
      Object.values(node).forEach(walk);
    }
  };
  walk(copy);
  return copy;
}

const verdict = (page: Json) => ({ check: wholeCheck(page).ok, validate: validatePage(page).ok });

describe('the whole check refuses what validatePage refuses', () => {
  it('every example page: one verdict', () => {
    expect(PAGES.length).toBeGreaterThan(100);
    expect(PAGES.filter(({ page }) => {
      const both = verdict(page);
      return both.check !== both.validate;
    }).map(({ name }) => name)).toEqual([]);
  });

  it('thousands of mistakes made in them, one at a time — anywhere, and where a rule reads: one verdict on each', () => {
    expect(MADE.length).toBeGreaterThan(2400);
    // Most of them are refused: the stream makes real mistakes, and some that are not.
    const refused = VALIDATED.filter((ok) => !ok).length;
    expect(refused / MADE.length).toBeGreaterThan(0.6);
    expect(refused / MADE.length).toBeLessThan(0.98);
    expect(disagreements((page) => wholeCheck(page).ok)).toEqual({ count: 0, first: [] });
  });

  it('the check before the draw refuses a part of what they refuse, never a page they pass: the rest is drawn and said in 0.36', () => {
    const before = MADE.map((page) => checkPage(page).ok);
    // Nothing the whole check passes is refused before the draw.
    expect(MADE.filter((_, i) => VALIDATED[i] && !before[i]).length).toBe(0);
    // What 0.35's viewer refused stays refused; much of the rest it drew, which 0.36 draws and says (`page.invalid`).
    const refusedBefore = MADE.filter((_, i) => !before[i]).length;
    const drawnAndSaid = MADE.filter((_, i) => before[i] && !VALIDATED[i]).length;
    expect(refusedBefore).toBeGreaterThan(200);
    expect(drawnAndSaid).toBeGreaterThan(700);
  });

  it('the mistakes tell a weaker check apart: without its rules, or letting keys it does not know through', () => {
    // The whole check without the shape: the outline, the names and the settings held to themselves.
    const named = MADE.map((page) => wholeCheck(page, { shape: false }).ok);
    // The shape read on the page as it comes through the door (upgradePage, as the whole check reads it: from 0.35.3 a
    // choice that writes no options has none).
    const quick = (data: ShapeData) => (page: Json, i: number) => named[i] && !shapeIssues(upgradePage(page), data).length;
    // Each weaker check tried on every third mistake: enough to tell it, in a third of the time.
    const counts = {
      outline: disagreements((_, i) => named[i]).count,
      rules: disagreements(quick(weakened((node) => delete node['x-rule'])), 3).count,
      keys: disagreements(quick(weakened((node) => node['additionalProperties'] === false && delete node['additionalProperties'])), 3).count,
      patterns: disagreements(quick(weakened((node) => delete node['pattern'])), 3).count,
      choices: disagreements(quick(weakened((node) => delete node['enum'])), 3).count,
    };
    // 26 Oct: 999, 10, 7, 43 and 7 of them.
    expect(counts.outline).toBeGreaterThan(700);
    expect(counts.rules).toBeGreaterThan(4);
    expect(counts.keys).toBeGreaterThan(3);
    expect(counts.patterns).toBeGreaterThan(20);
    expect(counts.choices).toBeGreaterThan(3);
    // And the check whole agrees, as above.
    expect(disagreements(quick(PAGE_SHAPE)).count).toBe(0);
  });

  /** The page an agent starts from, and the mistakes agents make in it (the audit's table, "What an AI agent writing page JSON can rely on"). */
  const base = () => ({
    fieldia: '0.13',
    id: 'contact',
    title: 'Contact',
    data: { kind: 'record', model: 'res.partner' },
    fields: {
      name: { type: 'char', label: 'Name' },
      state: { type: 'selection', label: 'State', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
      qty: { type: 'integer', label: 'Qty' },
    },
    layout: { type: 'sheet', id: 'main', children: [{ type: 'field', id: 'name', field: 'name' }, { type: 'field', id: 'state', field: 'state' }, { type: 'field', id: 'qty', field: 'qty' }] },
  });
  type Base = ReturnType<typeof base> & Record<string, unknown>;
  const made = (change: (page: Base) => void) => {
    const page = base() as Base;
    change(page);
    return page;
  };
  const field = (page: Base, name: 'name' | 'state' | 'qty') => page.fields[name] as Record<string, unknown>;
  const MISTAKES: [string, Json][] = [
    ['a field typed "email"', made((p) => (field(p, 'name')['type'] = 'email'))],
    ['required: "yes"', made((p) => (field(p, 'name')['required'] = 'yes'))],
    ['options as plain words', made((p) => (field(p, 'state')['options'] = ['draft', 'active']))],
    ['a step "setValue"', made((p) => (p['on'] = { change: { qty: [{ do: 'setValue', field: 'state', value: "'draft'" }] } }))],
    ['a key the format does not have', made((p) => (field(p, 'name')['read-only'] = true))],
    ['a node with no id', made((p) => delete (p.layout.children[0] as Record<string, unknown>)['id'])],
    ['a phone\'s countries that are neither "list" nor "native"', made((p) => Object.assign(p.layout.children[0], { widget: 'phone', options: { countries: 'all' } }))],
    ['a mask that names nothing', made((p) => Object.assign(p.layout.children[0], { options: { mask: '----' } }))],
    ['a time zone the IANA does not name', made((p) => (p['timeZone'] = 'Mars/Olympus'))],
    ['a filter "between" with one value', made((p) => (p.layout = { type: 'list', id: 'list', columns: ['name'], filters: [{ id: 'f', label: 'F', filter: [{ field: 'qty', op: 'between', value: 3 }] }] } as never))],
    ['"fieldia" left out', made((p) => delete (p as Record<string, unknown>)['fieldia'])],
    ['"fieldia": "0.99"', made((p) => (p.fieldia = '0.99'))],
  ];
  it.each(MISTAKES)('%s: refused by both', (_, page) => {
    expect(verdict(page)).toEqual({ check: false, validate: false });
  });

  it('a page with none of them passes both', () => {
    expect(verdict(base())).toEqual({ check: true, validate: true });
  });
});
