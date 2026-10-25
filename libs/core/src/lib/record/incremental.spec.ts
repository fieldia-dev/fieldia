import type { Page } from '../format/page';
import { createForm, type Form, type FormState } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { chance, makePage, pick, seeded, valueOf, type Made } from './test-random-pages';
import type { Line, Values } from './values';
import { recomputeInFull, workCounts } from './work';

/**
 * A form works a change out the quick way (0.35): a condition is read again once a value it reads changed, a value
 * worked out again once one it is worked out from did, a field checked again once its answer or what its rules read did.
 * Held here to the plain way, which works everything out again at each change (`recomputeInFull`), on pages made at
 * random with random edits — and `nodeReads` held to what it promises: a part whose reads did not change keeps its state.
 */

afterEach(() => recomputeInFull(false));

/** The app's answers as fields change: another field written, and a warning, from what changed. */
function source(made: Made) {
  const texts = made.writable.filter((name) => made.kinds[name] === 'char');
  const dataSource = createMemoryDataSource({ records: { 'lab.thing': { 1: { f0: 'kept' } } } });
  dataSource.onchange = async ({ changed, values }) => {
    const n = Number(changed.slice(1));
    if (!texts.length || Number.isNaN(n) || n % 2) return {};
    const target = texts[n % texts.length];
    return target === changed ? {} : { values: { [target]: `from ${changed}: ${JSON.stringify(values[changed])}` } };
  };
  return dataSource;
}

function make(made: Made, full: boolean, recordId: number | null): Form {
  recomputeInFull(full);
  try {
    return createForm({ page: made.page, dataSource: source(made), ...(recordId !== null ? { recordId } : {}) });
  } finally {
    recomputeInFull(false);
  }
}

type Edit = { what: string; run(form: Form): void };
function edits(made: Made, seed: number, count: number): Edit[] {
  const r = seeded(seed * 13 + 5);
  const out: Edit[] = [];
  for (let i = 0; i < count; i++) {
    const field = pick(r, made.writable);
    const value = valueOf(r, made.kinds[field]);
    const which = Math.floor(r() * 10);
    if (which <= 4) out.push({ what: `sets ${field} = ${JSON.stringify(value)}`, run: (form) => form.setValue(field, value) });
    else if (which === 5) out.push({ what: `the app sets ${field}`, run: (form) => form.setValues({ [field]: value }) });
    else if (which === 6 && made.lines) {
      const qty = Math.floor(r() * 6);
      out.push({ what: `adds a line of ${qty}`, run: (form) => void form.addLine('lines', { product: 'P', qty, price: 2.5 }) });
    } else if (which === 7 && made.lines) {
      const at = r();
      const qty = Math.floor(r() * 8);
      out.push({
        what: `a line's quantity ${qty}`,
        run: (form) => {
          const all = (form.getState().values['lines'] as Line[] | null) ?? [];
          if (all.length) form.updateLine('lines', all[Math.floor(at * all.length)].key, 'qty', qty);
        },
      });
    } else if (which === 8) {
      const editing = chance(r, 0.5);
      out.push({ what: editing ? 'edited' : 'locked', run: (form) => form.setEditing(editing) });
    } else out.push({ what: 'checked', run: (form) => void form.validate() });
  }
  return out;
}

const seen = (state: FormState) => {
  const { values, errors, warnings, dirty, takenOut, unread, asked, warning, status, unsent } = state;
  return JSON.parse(JSON.stringify({ values, errors, warnings, dirty, takenOut, unread, asked, warning, status, unsent }));
};

describe('a form working out only what reads what changed', () => {
  for (let seed = 101; seed <= 160; seed++) {
    it(`finds what working everything out finds, on random page ${seed}`, async () => {
      const made = makePage(seed);
      const recordId = seed % 4 === 0 ? 1 : null;
      const plain = make(made, true, recordId);
      const quick = make(made, false, recordId);
      await Promise.all([plain.settled(), quick.settled()]);
      const parts = (form: Form) => Object.fromEntries(made.nodes.map((id) => [id, form.node(id)]));
      expect(seen(quick.getState())).toEqual(seen(plain.getState()));
      expect(parts(quick)).toEqual(parts(plain));
      let editing: boolean = true;
      for (const edit of edits(made, seed, 30)) {
        // What each part reads, and its state, before: a part none of whose reads changed keeps its state.
        const before = quick.getState();
        const kept = made.nodes.map((id) => ({ id, reads: quick.nodeReads(id), state: { ...quick.node(id) } }));
        recomputeInFull(true);
        edit.run(plain);
        recomputeInFull(false);
        edit.run(quick);
        await Promise.all([plain.settled(), quick.settled()]);
        expect({ edit: edit.what, state: seen(quick.getState()) }).toEqual({ edit: edit.what, state: seen(plain.getState()) });
        expect({ edit: edit.what, parts: parts(quick) }).toEqual({ edit: edit.what, parts: parts(plain) });
        const after = quick.getState();
        const wasEditing: boolean = editing;
        if (edit.what === 'edited' || edit.what === 'locked') editing = edit.what === 'edited';
        if (after.recordId !== before.recordId || after.can !== before.can || editing !== wasEditing) continue;
        for (const part of kept) {
          if (!part.reads || part.reads.some((name) => (before.values as Values)[name] !== (after.values as Values)[name])) continue;
          expect({ edit: edit.what, part: part.id, state: quick.node(part.id) }).toEqual({ edit: edit.what, part: part.id, state: part.state });
        }
      }
      plain.dispose();
      quick.dispose();
    });
  }
});

/** A form of n fields in sections of ten: in each, a value worked out from two numbers and a field shown by a choice. */
function formOf(n: number): Page {
  const fields: Record<string, unknown> = {};
  const sections: unknown[] = [];
  for (let s = 0; s < n / 10; s++) {
    const children: unknown[] = [];
    for (let i = 0; i < 10; i++) {
      const name = `s${s}_f${i}`;
      const type = ['char', 'char', 'integer', 'float', 'float', 'date', 'selection', 'boolean', 'char', 'text'][i];
      fields[name] = { type, label: `Field ${s}.${i}`, ...(type === 'selection' ? { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } : {}), ...(i === 4 ? { compute: `s${s}_f2 * s${s}_f3` } : {}), ...(i === 1 ? { required: true } : {}) };
      children.push({ type: 'field', id: `n-${name}`, field: name, ...(i === 8 ? { invisible: `s${s}_f6 != 'b'` } : {}) });
    }
    sections.push({ type: 'section', id: `sec-${s}`, children });
  }
  return { fieldia: '0.13', id: 'counted', title: 'Counted', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 'root', children: sections } } as unknown as Page;
}

describe('a change on a form of 500 fields, counted', () => {
  const ids = (page: Page) => (page.layout as unknown as { children: { id: string; children: { id: string }[] }[] }).children.flatMap((section) => [section.id, ...section.children.map((node) => node.id)]);
  /** The work a change does, its parts' states then read as a viewer draws them. */
  function work(form: Form, page: Page, change: () => void) {
    const before = { ...workCounts };
    change();
    for (const id of ids(page)) form.node(id);
    return { conditions: workCounts.conditions - before.conditions, computes: workCounts.computes - before.computes, checks: workCounts.checks - before.checks };
  }
  const opened = (full = false) => {
    recomputeInFull(full);
    const page = formOf(500);
    const form = createForm({ page });
    recomputeInFull(false);
    for (const id of ids(page)) form.node(id);
    return { form, page };
  };

  it('reads no condition again and works nothing out for a field nothing reads', () => {
    const { form, page } = opened();
    expect(work(form, page, () => form.setValue('s20_f0', 'Nile'))).toEqual({ conditions: 0, computes: 0, checks: 0 });
  });

  it('works out again only the value worked out from the number changed', () => {
    const { form, page } = opened();
    expect(work(form, page, () => form.setValue('s20_f2', 3))).toEqual({ conditions: 0, computes: 1, checks: 0 });
    expect(form.getState().values['s20_f4']).toBe(null);
    expect(work(form, page, () => form.setValue('s20_f3', 2))).toMatchObject({ computes: 1 });
    expect(form.getState().values['s20_f4']).toBe(6);
  });

  it('reads again only the condition on the choice changed', () => {
    const { form, page } = opened();
    expect(work(form, page, () => form.setValue('s20_f6', 'b'))).toEqual({ conditions: 1, computes: 0, checks: 0 });
    expect(form.node('n-s20_f8').invisible).toBe(false);
    expect(form.node('n-s21_f8').invisible).toBe(true);
  });

  it('checks again only the field changed while the problems found are shown', () => {
    const { form, page } = opened();
    form.validate();
    expect(Object.keys(form.getState().errors)).toHaveLength(50);
    expect(work(form, page, () => form.setValue('s20_f1', 'Nile')).checks).toBe(1);
    expect(Object.keys(form.getState().errors)).toHaveLength(49);
  });

  it('reads every condition and works out every value again, working everything out in full: as before 0.35', () => {
    const { form, page } = opened(true);
    form.validate();
    const done = work(form, page, () => form.setValue('s20_f1', 'Nile'));
    // Its 50 conditions read by their parts, and again as the problems shown are found again; every value worked out,
    // and each of the 450 fields shown checked.
    expect(done.conditions).toBeGreaterThanOrEqual(100);
    expect(done.computes).toBeGreaterThanOrEqual(50);
    expect(done.checks).toBeGreaterThanOrEqual(450);
  });
});
