import { createMemoryDataSource, recomputeInFull, type Page, type Values } from '@fieldia/core';
import { chance, makePage, pick, seeded, valueOf, type Made } from '../../../core/src/lib/record/test-random-pages';
import { windowDefaults } from './list-window';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * The quick way a form works a change out (0.35) — a condition read again once what it reads changed, a value worked
 * out again once what it is worked out from did, a part drawn again once what it shows did — held to the plain way,
 * which works everything out again at each change (`recomputeInFull`). On pages made at random — conditions on fields
 * and on sections, values worked out from others and from a table's lines, values set when a condition starts to hold,
 * required, read-only and hidden by conditions, answer rules, tones, the app's onchange answers — the same edits made on
 * both, one by one: after each, the two forms' states, every part's state and the two pages drawn are the same.
 */

interface Side {
  host: HTMLElement;
  handle: ViewerHandle;
  full: boolean;
}
type Edit = { what: string; run(side: Side): void };

/** The edits made on a page, at random: a person's, the app's, typed in its boxes, lines, a lock, a check. */
function makeEdits(made: Made, seed: number, count: number): Edit[] {
  const r = seeded(seed * 7 + 3);
  const edits: Edit[] = [];
  for (let i = 0; i < count; i++) {
    const field = pick(r, made.writable);
    const kind = made.kinds[field];
    const value = valueOf(r, kind);
    const which = Math.floor(r() * 12);
    if (which <= 3) edits.push({ what: `person sets ${field} = ${JSON.stringify(value)}`, run: ({ handle }) => handle.form.setValue(field, value) });
    else if (which === 4) {
      const other = pick(r, made.writable);
      const more = valueOf(r, made.kinds[other]);
      edits.push({ what: `app sets ${field}, ${other}`, run: ({ handle }) => handle.form.setValues({ [field]: value, [other]: more }) });
    } else if (which === 5 && ['char', 'text', 'integer', 'float', 'monetary'].includes(kind)) {
      const text = kind === 'char' || kind === 'text' ? String(value ?? '') : value === null ? '' : String(value);
      edits.push({
        what: `types "${text}" in ${field}`,
        run: ({ host }) => {
          const box = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-node="n-${field}"] input.fd-input, [data-node="n-${field}"] textarea`);
          if (!box || box.readOnly || box.closest('[hidden]')) return;
          box.focus();
          box.value = text;
          box.dispatchEvent(new Event('input', { bubbles: true }));
          box.dispatchEvent(new Event('change', { bubbles: true }));
          box.blur();
        },
      });
    } else if (which === 6 && made.lines) {
      const qty = Math.floor(r() * 6);
      const price = Math.round(r() * 1000) / 100;
      edits.push({ what: `adds a line of ${qty} at ${price}`, run: ({ handle }) => void handle.form.addLine('lines', { product: 'P', qty, price }) });
    } else if (which === 7 && made.lines) {
      const at = r();
      const qty = Math.floor(r() * 8);
      edits.push({
        what: `changes a line's quantity to ${qty}`,
        run: ({ handle }) => {
          const all = (handle.form.getState().values['lines'] as { key: string }[] | null) ?? [];
          if (all.length) handle.form.updateLine('lines', all[Math.floor(at * all.length)].key, 'qty', qty);
        },
      });
    } else if (which === 8 && made.lines) {
      const at = r();
      edits.push({
        what: 'takes a line away',
        run: ({ handle }) => {
          const all = (handle.form.getState().values['lines'] as { key: string }[] | null) ?? [];
          if (all.length) handle.form.removeLine('lines', all[Math.floor(at * all.length)].key);
        },
      });
    } else if (which === 9) {
      const locked = chance(r, 0.5);
      edits.push({ what: locked ? 'locks the form' : 'unlocks the form', run: ({ handle }) => handle.setReadonly(locked) });
    } else if (which === 10) edits.push({ what: 'checks the form', run: ({ handle }) => void handle.form.validate() });
    else edits.push({ what: `leaves ${field}`, run: ({ handle }) => handle.form.boxLeft(field) });
  }
  return edits;
}

/** The app's answers as fields change: another field written, and a warning, from what changed. */
function source(made: Made, more: Record<string, Record<number, Values>> = {}) {
  const texts = made.writable.filter((name) => made.kinds[name] === 'char');
  const dataSource = createMemoryDataSource({ records: { 'lab.thing': { 1: { f0: null } }, ...JSON.parse(JSON.stringify(more)) } });
  dataSource.onchange = async ({ changed, values }) => {
    const n = Number(changed.slice(1));
    if (!texts.length || Number.isNaN(n) || n % 2) return {};
    const target = texts[n % texts.length];
    if (target === changed) return {};
    const value = values[changed];
    return { values: { [target]: `from ${changed}: ${JSON.stringify(value)}` }, ...(typeof value === 'number' && value > 40 ? { warning: 'Quite a lot' } : {}) };
  };
  return dataSource;
}

const sides: Side[] = [];
afterEach(() => {
  for (const side of sides.splice(0)) side.handle.destroy();
  document.body.replaceChildren();
  recomputeInFull(false);
});

function mount(made: Made, full: boolean, recordId: number | null, more?: Record<string, Record<number, Values>>): Side {
  recomputeInFull(full);
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: made.page, dataSource: source(made, more), ...(recordId !== null ? { recordId } : {}) });
  recomputeInFull(false);
  const side = { host, handle, full };
  sides.push(side);
  return side;
}

const flush = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function act(side: Side, edit: Edit) {
  recomputeInFull(side.full);
  try {
    edit.run(side);
    await side.handle.form.settled();
    await flush();
  } finally {
    recomputeInFull(false);
  }
}

/** Where two pages drawn part first, with what each holds round it: a short difference to read. */
function apart(mine: string, theirs: string): { mine: string; theirs: string } | null {
  if (mine === theirs) return null;
  let at = 0;
  while (at < mine.length && mine[at] === theirs[at]) at++;
  const from = Math.max(0, at - 160);
  return { mine: mine.slice(from, at + 160), theirs: theirs.slice(from, at + 160) };
}

/** What a side shows: its state, every part's state, and its page as drawn — ids alike whichever viewer drew them. */
function shown(side: Side, made: Made) {
  const state = side.handle.form.getState();
  const { values, errors, warnings, dirty, takenOut, unread, asked, warning, warningField, status, unsent } = state;
  return {
    state: JSON.parse(JSON.stringify({ values, errors, warnings, dirty, takenOut, unread, asked, warning, warningField, status, unsent })),
    parts: Object.fromEntries(made.nodes.map((id) => [id, side.handle.form.node(id)])),
    // A viewer's own ids, and those of the parts counted page-wide (`fd-set-aside-2-title`), told apart by a number.
    page: side.host.innerHTML.replace(/fd\d+-/g, 'fd-').replace(/(fd-[a-z]+(?:-[a-z]+)*-)\d+(?=[-"])/g, '$1N'),
  };
}

describe('the quick way a change is worked out, held to working everything out again', () => {
  const PAGES = 36;
  const EDITS = 28;
  for (let seed = 1; seed <= PAGES; seed++) {
    it(`gives the same state and the same page on random page ${seed}`, async () => {
      const made = makePage(seed);
      const recordId = seed % 3 === 0 ? 1 : null;
      const plain = mount(made, true, recordId);
      const quick = mount(made, false, recordId);
      await Promise.all([plain.handle.form.settled(), quick.handle.form.settled()]);
      await flush();
      const same = (edit: string) => {
        const [mine, oracle] = [shown(quick, made), shown(plain, made)];
        // Said with the edit that parted them: the states, the parts, then where the pages drawn part.
        expect({ edit, state: mine.state, parts: mine.parts }).toEqual({ edit, state: oracle.state, parts: oracle.parts });
        expect({ edit, page: apart(mine.page, oracle.page) }).toEqual({ edit, page: null });
      };
      same('opened');
      for (const edit of makeEdits(made, seed, EDITS)) {
        await act(plain, edit);
        await act(quick, edit);
        same(edit.what);
      }
    });
  }
});

/**
 * With the lists' quick ways beside the form's (0.35's merge): a record holding a related list past a hundred rows —
 * windowed, only the rows near the view in the page (list-window.ts) — and a table of lines whose money takes its
 * currency from the record (`parent.cur`), whose cells are read-only, and whose lines may be taken away, by conditions
 * on the record (`parent.`). The form leaves alone what reads nothing that changed, the table draws again only the
 * lines whose inputs changed, and the list draws only the rows near the view: all three held to the plain way at once.
 * The lines' part reads the record (`parent.`): it is brought up to date at every change, never left alone for its
 * inputs (the lines widget says no `reads`), and draws again the lines a change of the record touches.
 */
// A related list's most (`limit`), windowed past 40 rows here.
const OTHERS = 100;
const others = (): Record<number, Values> =>
  Object.fromEntries(Array.from({ length: OTHERS }, (_, i) => [i + 1, { name: `Other ${String(i + 1).padStart(3, '0')}`, amount: (i * 37) % 1000, thing_id: { id: 1, label: 'Thing' } }]));

/** A random page with lines (made so), its lines reading the record, and a related list of 100 others. */
function withListsAndParent(seed: number): Made {
  let made = makePage(seed);
  for (let next = seed; !made.lines; next += 1000) made = makePage(next);
  const page = JSON.parse(JSON.stringify(made.page)) as Page & { fields: Record<string, Record<string, unknown>> };
  const lines = page.fields['lines'] as { fields: Record<string, Record<string, unknown>> };
  const tick = Object.keys(made.kinds).find((name) => made.kinds[name] === 'boolean' && !page.fields[name]['compute']);
  lines.fields['price'] = { type: 'monetary', label: 'Price', currencyField: 'parent.cur', digits: [12, 2] };
  lines.fields['amount'] = { type: 'monetary', label: 'Amount', currencyField: 'parent.cur', compute: 'qty * price' };
  const sections = (page.layout as unknown as { children: { children: Record<string, unknown>[] }[] }).children;
  for (const section of sections)
    for (const node of section.children)
      if (node['field'] === 'lines')
        Object.assign(node, {
          columns: ['product', 'qty', 'price', 'sub', 'amount', ...('share' in lines.fields ? ['share'] : [])],
          totals: ['amount'],
          // On half the pages the rules read the currency too; on the others its money alone does.
          ...(seed % 2
            ? { cells: { qty: { readonly: tick ? `parent.${tick}` : 'parent.id == False' } } }
            : { cells: { qty: { readonly: tick ? `parent.${tick}` : "parent.cur == 'USD'" }, price: { invisible: "parent.cur == 'EUR'" } }, lineDelete: "parent.cur != 'USD'" }),
        });
  sections[sections.length - 1].children.push({
    type: 'related',
    id: 'others',
    title: 'Others',
    model: 'lab.other',
    field: 'thing_id',
    fields: { name: { type: 'char', label: 'Name' }, amount: { type: 'integer', label: 'Amount' }, thing_id: { type: 'many2one', label: 'Thing', relation: 'lab.thing' } },
    columns: ['name', 'amount'],
    sort: [{ field: 'name' }],
    limit: OTHERS,
  });
  return { ...made, page: page as unknown as Page, nodes: [...made.nodes, 'others'] };
}

describe('the form’s quick way, a table of lines reading the record and a windowed related list, held to the plain way', () => {
  const PAGES = 8;
  const EDITS = 24;
  // jsdom lays nothing out: the view and the rows' heights are the test's, as list-window.spec has them.
  beforeAll(() => {
    windowDefaults.geometry = { view: (body) => (body.isConnected ? { top: 0, bottom: 600 } : null), height: (nodes) => nodes.length * 30, top: () => null };
    windowDefaults.from = 40;
  });
  afterAll(() => {
    delete windowDefaults.geometry;
    windowDefaults.from = 100;
  });
  for (let seed = 101; seed < 101 + PAGES; seed++) {
    it(`gives the same state and the same page on random page ${seed}, its lines and its related list too`, async () => {
      const made = withListsAndParent(seed);
      const plain = mount(made, true, 1, { 'lab.other': others() });
      const quick = mount(made, false, 1, { 'lab.other': others() });
      await Promise.all([plain.handle.form.settled(), quick.handle.form.settled()]);
      await flush();
      await flush();
      // The related list windowed, as it is on both: its 100 rows counted, fewer in the page.
      for (const side of [plain, quick]) {
        const table = side.host.querySelector('[data-node="others"] table');
        expect(table?.getAttribute('aria-rowcount')).toBeTruthy();
        expect(side.host.querySelectorAll('[data-node="others"] .fd-list-row').length).toBeLessThan(OTHERS);
      }
      const same = (edit: string) => {
        const [mine, oracle] = [shown(quick, made), shown(plain, made)];
        expect({ edit, state: mine.state, parts: mine.parts }).toEqual({ edit, state: oracle.state, parts: oracle.parts });
        expect({ edit, page: apart(mine.page, oracle.page) }).toEqual({ edit, page: null });
      };
      same('opened');
      const r = seeded(seed * 13 + 5);
      // A line the table keeps (its `lineDelete` not holding) is refused alike on both: the edit made, nothing changed.
      const edits = makeEdits(made, seed, EDITS).map((edit) => ({
        what: edit.what,
        run: (side: Side) => {
          try {
            edit.run(side);
          } catch (error) {
            if (!/cannot be deleted now/.test(String(error))) throw error;
          }
        },
      }));
      // The record's fields the lines read, changed among the rest: its currency, by its box.
      for (let i = 0; i < 6; i++) {
        const currency = pick(r, ['EGP', 'USD', 'EUR']);
        edits.splice(Math.floor(r() * edits.length), 0, { what: `sets the currency to ${currency}`, run: ({ handle }) => handle.form.setValue('cur', currency) });
      }
      for (const edit of edits) {
        await act(plain, edit);
        await act(quick, edit);
        same(edit.what);
      }
    });
  }
});
