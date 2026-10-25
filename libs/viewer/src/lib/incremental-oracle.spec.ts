import { createMemoryDataSource, recomputeInFull } from '@fieldia/core';
import { chance, makePage, pick, seeded, valueOf, type Made } from '../../../core/src/lib/record/test-random-pages';
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
function source(made: Made) {
  const texts = made.writable.filter((name) => made.kinds[name] === 'char');
  const dataSource = createMemoryDataSource({ records: { 'lab.thing': { 1: { f0: null } } } });
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

function mount(made: Made, full: boolean, recordId: number | null): Side {
  recomputeInFull(full);
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: made.page, dataSource: source(made), ...(recordId !== null ? { recordId } : {}) });
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
