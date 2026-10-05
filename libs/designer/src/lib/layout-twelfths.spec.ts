import type { LayoutNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { relay, shares } from './layout-twelfths';
import { employeeDesigner, employeePage, expectValid, nodeOf, spot, watched, where } from './test-layout';

/**
 * Groups in twelfths: a row divides twelve ways, its own way. A drop beside a
 * part re-divides only that row; a part leaving a row closes it up, or leaves
 * a gap where the group allows gaps; a group of one to four columns is
 * divided in twelfths the first time a gesture needs it, nothing moving.
 */

/** The site visit as the screen demo starts it: Customer and Visit date side by side, Notes under them; then Follow-up. */
function visit(rows?: 'gaps') {
  const d = watched(createDesigner({ page: blankPage('screen', 'Site visit') }));
  d.renameContainer('section-1', 'Visit');
  const add = (kind: string, label: string, parent: string) => {
    const id = d.addQuestion(kind, { parent }) as string;
    d.updateQuestion(id, { label });
    return id;
  };
  const [customer, date, notes] = [add('short-answer', 'Customer', 'section-1'), add('date', 'Visit date', 'section-1'), add('paragraph', 'Notes', 'section-1')];
  d.setColspan(notes, 2);
  const follow = d.addContainer('Follow-up') as string;
  const [next, due, call] = [add('dropdown', 'Next step', follow), add('date', 'Due by', follow), add('yes-no', 'Manager to call?', follow)];
  if (rows) d.setSectionLook('section-1', { rows });
  const span = (id: string) => (nodeOf(d.getPage(), id)?.['colspan'] as number | undefined) ?? 1;
  const kids = (group: string) => (nodeOf(d.getPage(), group)?.['children'] as { id: string }[]).map((c) => c.id);
  const columns = (group: string) => nodeOf(d.getPage(), group)?.['columns'];
  return { d, customer, date, notes, follow, next, due, call, span, kids, columns };
}

const spans = (d: Designer, ids: string[]) => ids.map((id) => (nodeOf(d.getPage(), id)?.['colspan'] as number | undefined) ?? 1);

describe('shares: widths scaled to a total in whole columns', () => {
  it('divides equally in halves, thirds and quarters', () => {
    expect(shares([1, 1], 12)).toEqual([6, 6]);
    expect(shares([1, 1, 1], 12)).toEqual([4, 4, 4]);
    expect(shares([1, 1, 1, 1], 12)).toEqual([3, 3, 3, 3]);
  });

  it('grows the rest proportionally, the largest remainders rounding up, each keeping one', () => {
    expect(shares([4, 4], 12)).toEqual([6, 6]);
    expect(shares([4, 4, 3], 12)).toEqual([5, 4, 3]);
    expect(shares([4, 4], 7)).toEqual([4, 3]);
    expect(shares([10, 1, 1], 3)).toEqual([1, 1, 1]);
    expect(shares([7, 5], 2)).toEqual([1, 1]);
  });
});

describe('a group divided in twelfths', () => {
  it('two columns: each part six times as wide, the group twelve, nothing else', () => {
    const { d, customer, date, notes, span, columns } = visit();
    d.place(customer, { how: 'beside', target: date, after: true });
    expect(columns('section-1')).toBe(12);
    expect([span(date), span(customer), span(notes)]).toEqual([6, 6, 12]);
    expectValid(d.getPage());
  });

  it('one, three and four columns: ×12, ×4 and ×3; a tablet’s and a phone’s two or more become twelfths, one stays one', () => {
    const d = employeeDesigner();
    // Emergency contact: one column, each part the whole width.
    d.place('f-ec_name', { how: 'beside', target: 'f-ec_phone', after: false });
    expect(nodeOf(d.getPage(), 'emergency')?.['columns']).toBe(12);
    expect(spans(d, ['f-ec_relation', 'f-ec_name', 'f-ec_phone'])).toEqual([12, 6, 6]);
    // Role: three on a desktop, two on a tablet, one on a phone.
    d.place('f-street', { how: 'beside', target: 'f-salary', after: true });
    expect(nodeOf(d.getPage(), 'role')?.['columns']).toEqual({ wide: 12, medium: 12, narrow: 1 });
    expect(spans(d, ['f-job_title', 'f-contract', 'f-end_date', 'f-salary', 'f-street'])).toEqual([4, 8, 4, 4, 4]);
    // Bank account: four on a desktop, one on a phone, its IBAN two of them.
    d.setColumns('bank', 4);
    d.place('f-city', { how: 'beside', target: 'f-iban', after: true });
    expect(nodeOf(d.getPage(), 'bank')?.['columns']).toEqual({ wide: 12, narrow: 1 });
    expect(spans(d, ['f-bank_name', 'f-pay_currency', 'f-iban', 'f-city'])).toEqual([3, 3, 3, 3]);
    expectValid(d.getPage());
  });

  it('an arrangement on its columns takes its parts along: Personal details’ three columns, the six fields on two of them', () => {
    const d = employeeDesigner();
    d.place('f-photo', { how: 'beside', target: 'who', after: true });
    expect(nodeOf(d.getPage(), 'personal')?.['columns']).toEqual({ wide: 12, medium: 12, narrow: 1 });
    // A reorder of the row: the photo after the fields, every width kept.
    expect(spans(d, ['who', 'f-photo', 'f-first_name', 'f-nationality'])).toEqual([8, 4, 4, 4]);
    expectValid(d.getPage());
  });

  it('an arrangement sharing one column, and one in a group of one column, are laid on the twelfths', () => {
    const page = employeePage();
    const f = (name: string) => ({ type: 'field', id: `f-${name}`, field: name });
    const side = (id: string, kids: unknown[]) => ({ type: 'section', id, style: 'plain', columns: { wide: 2, narrow: 1 }, children: kids });
    const address = spot(page, 'address')?.node as unknown as { children: unknown[] };
    address.children.splice(1, 1, side('shared', [f('city'), f('mobile')]));
    const emergency = spot(page, 'emergency')?.node as unknown as { children: unknown[] };
    emergency.children.splice(0, 1, side('own', [f('ec_name'), f('email')]));
    (spot(page, 'who')?.node as unknown as { children: unknown[] }).children.splice(2, 2);
    const d = watched(createDesigner({ page }));
    d.place('f-street', { how: 'beside', target: 'f-country', after: true });
    expect(spans(d, ['shared', 'f-city', 'f-mobile', 'f-postcode'])).toEqual([6, 3, 3, 6]);
    d.place('f-ec_relation', { how: 'beside', target: 'f-ec_phone', after: true });
    expect(spans(d, ['own', 'f-ec_name', 'f-email'])).toEqual([12, 6, 6]);
    expectValid(d.getPage());
  });

  it('relays rows exactly where the twelfths allow, and as near as they go where not', () => {
    const list = [
      { type: 'field', id: 'a', field: 'a', colspan: 2 },
      { type: 'field', id: 'b', field: 'b' },
      { type: 'divider', id: 'line' },
      { type: 'field', id: 'c', field: 'c', colspan: 9 },
    ] as LayoutNode[];
    relay(list, 3, 12);
    expect(list.map((p) => (p as { colspan?: number }).colspan ?? 1)).toEqual([8, 4, 1, 12]);
    relay(list, 12, 2);
    expect(list.map((p) => (p as { colspan?: number }).colspan ?? 1)).toEqual([1, 1, 1, 2]);
  });
});

describe('a drop beside a part in a group in twelfths', () => {
  it('at the end of a row: only that row re-divides — the user’s gesture on the site visit', () => {
    const { d, customer, date, notes, next, due, call, span, kids, follow } = visit();
    const drop = { how: 'beside', target: date, after: true } as const;
    expect(d.describeDrop(drop, next)).toBe('at the end of the row, after “Visit date” — the row in thirds');
    expect(d.place(next, drop)).toBe(next);
    expect(kids('section-1')).toEqual([customer, date, next, notes]);
    expect([span(customer), span(date), span(next), span(notes)]).toEqual([4, 4, 4, 12]);
    // Follow-up, two columns, closes up as its grid lays it out.
    expect(kids(follow)).toEqual([due, call]);
    expectValid(d.getPage());
  });

  it('between two parts, and at the start of a row', () => {
    const { d, customer, date, notes, next, due, span, kids } = visit();
    expect(d.describeDrop({ how: 'beside', target: customer, after: true }, next)).toBe('between “Customer” and “Visit date” — the row in thirds');
    expect(d.describeDrop({ how: 'beside', target: date, after: false }, next)).toBe('between “Customer” and “Visit date” — the row in thirds');
    expect(d.describeDrop({ how: 'beside', target: customer, after: false }, next)).toBe('at the start of the row, before “Customer” — the row in thirds');
    d.place(next, { how: 'beside', target: customer, after: true });
    expect(kids('section-1')).toEqual([customer, next, date, notes]);
    d.place(due, { how: 'beside', target: customer, after: false });
    expect(kids('section-1')).toEqual([due, customer, next, date, notes]);
    expect([span(due), span(customer), span(next), span(date), span(notes)]).toEqual([3, 3, 3, 3, 12]);
  });

  it('beside a part alone in its row: halves', () => {
    const { d, notes, next, span } = visit();
    expect(d.describeDrop({ how: 'beside', target: notes, after: true }, next)).toBe('at the end of the row, after “Notes” — the row in halves');
    d.place(next, { how: 'beside', target: notes, after: true });
    expect([span(notes), span(next)]).toEqual([6, 6]);
  });

  it('a new part from the toolbox, the same way', () => {
    const { d, customer, date, span, kids } = visit();
    const id = d.place({ kind: 'number' }, { how: 'beside', target: customer, after: true }) as string;
    expect(kids('section-1').slice(0, 3)).toEqual([customer, id, date]);
    expect([span(customer), span(id), span(date)]).toEqual([4, 4, 4]);
    expect(d.getState().selected).toBe(id);
  });

  it('along its own row: it moves, every width kept, and the words say only where', () => {
    const { d, customer, date, next, span, kids } = visit();
    d.place(next, { how: 'beside', target: date, after: true });
    expect(d.describeDrop({ how: 'beside', target: customer, after: false }, next)).toBe('at the start of the row, before “Customer”');
    d.setWidths([{ id: customer, span: 6 }, { id: date, span: 2 }]);
    d.place(next, { how: 'beside', target: customer, after: false });
    expect(kids('section-1').slice(0, 3)).toEqual([next, customer, date]);
    expect([span(next), span(customer), span(date)]).toEqual([4, 6, 2]);
  });

  it('a row holds four: a fifth is refused, saying so, and nothing changes', () => {
    const { d, customer, date, next, due, call, notes } = visit();
    d.place(next, { how: 'beside', target: date, after: true });
    d.place(due, { how: 'beside', target: date, after: true });
    expect(spans(d, [customer, date, due, next])).toEqual([3, 3, 3, 3]);
    const before = d.getPage();
    expect(d.dropRefusal({ how: 'beside', target: date, after: true }, call)).toBe('A row holds four');
    expect(d.describeDrop({ how: 'beside', target: date, after: true }, call)).toBe('A row holds four');
    expect(d.place(call, { how: 'beside', target: customer, after: false })).toBe(false);
    expect(d.getState().issues).toEqual(['A row holds four']);
    expect(d.getPage()).toBe(before);
    // Moving one of the four along the row is no fifth; beside Notes, a row of its own, is room.
    expect(d.place(next, { how: 'beside', target: customer, after: false })).toBe(next);
    expect(d.place(call, { how: 'beside', target: notes, after: true })).toBe(call);
  });

  it('is one undo step, conversion and all', () => {
    const { d, date, next } = visit();
    const before = d.getPage();
    d.place(next, { how: 'beside', target: date, after: true });
    d.undo();
    expect(d.getPage()).toEqual(before);
  });
});

describe('a part leaving a row that keeps full', () => {
  /** The visit in twelfths, Next step the third of the first row. */
  function thirds() {
    const v = visit();
    v.d.place(v.next, { how: 'beside', target: v.date, after: true });
    return v;
  }

  it('the rest grow to fill the row, as they shared it: removed, cut, deleted from its bar', () => {
    for (const take of [(v: ReturnType<typeof thirds>) => v.d.remove([v.next]), (v: ReturnType<typeof thirds>) => v.d.removeNode(v.next)]) {
      const v = thirds();
      v.d.setWidths([{ id: v.customer, span: 6 }, { id: v.date, span: 2 }]);
      take(v);
      expect([v.span(v.customer), v.span(v.date), v.span(v.notes)]).toEqual([9, 3, 12]);
      expectValid(v.d.getPage());
    }
  });

  it('moved out: by a drop, the outline and Simple’s drag', () => {
    const moves = [
      (v: ReturnType<typeof thirds>) => v.d.place(v.next, { how: 'into', container: v.follow }),
      (v: ReturnType<typeof thirds>) => v.d.moveParts([v.next], v.follow, 0),
      (v: ReturnType<typeof thirds>) => v.d.placeNode(v.next, v.follow, 0),
    ];
    for (const move of moves) {
      const v = thirds();
      move(v);
      expect([v.span(v.customer), v.span(v.date)]).toEqual([6, 6]);
      expectValid(v.d.getPage());
    }
  });

  it('several taken at once leave one to fill the row', () => {
    const v = thirds();
    v.d.remove([v.next, v.date]);
    expect(v.span(v.customer)).toBe(12);
  });

  it('a part under another keeps the row: its cell becomes a column', () => {
    const v = thirds();
    v.d.place(v.due, { how: 'under', target: v.next, after: true });
    expect([v.span(v.customer), v.span(v.date)]).toEqual([4, 4]);
    expect(where(v.d.getPage(), v.due)).toMatchObject({ colspan: 4, kids: [v.next, v.due], grand: 'section-1' });
  });
});

describe('a group that allows gaps', () => {
  it('a part leaving a row leaves its room; a part beside takes the room, saying so', () => {
    const { d, customer, date, next, due, span } = visit('gaps');
    d.place(next, { how: 'beside', target: date, after: true });
    expect([span(customer), span(date), span(next)]).toEqual([4, 4, 4]);
    d.place(next, { how: 'into', container: 'section-1' });
    expect([span(customer), span(date)]).toEqual([4, 4]);
    expect(d.describeDrop({ how: 'beside', target: customer, after: true }, due)).toBe('beside “Customer”, in the room left');
    d.place(due, { how: 'beside', target: customer, after: true });
    expect([span(customer), span(due), span(date)]).toEqual([4, 4, 4]);
    // No room left: the row divides as a full one does.
    const id = d.place({ kind: 'number' }, { how: 'beside', target: date, after: true }) as string;
    expect([span(customer), span(due), span(date), span(id)]).toEqual([3, 3, 3, 3]);
    expectValid(d.getPage());
  });
});

describe('parts landing in a group in twelfths', () => {
  it('in a full group, into it or at a place, a row of its own; a row it splits closes up either side', () => {
    const v = visit();
    v.d.place(v.next, { how: 'beside', target: v.date, after: true });
    v.d.place(v.due, { how: 'into', container: 'section-1' });
    expect(v.span(v.due)).toBe(12);
    v.d.place(v.call, { how: 'at', container: 'section-1', index: 1 });
    expect(v.kids('section-1').slice(0, 4)).toEqual([v.customer, v.call, v.date, v.next]);
    expect([v.span(v.customer), v.span(v.call), v.span(v.date), v.span(v.next)]).toEqual([12, 12, 6, 6]);
    expectValid(v.d.getPage());
  });

  it('a new field added from the toolbox takes the whole row', () => {
    const v = visit();
    v.d.place(v.next, { how: 'beside', target: v.date, after: true });
    const id = v.d.addQuestion('short-answer', { parent: 'section-1' }) as string;
    expect(v.span(id)).toBe(12);
  });

  it('from a group of columns into one that allows gaps: as wide a share of the row as it had', () => {
    const v = visit('gaps');
    v.d.place(v.next, { how: 'beside', target: v.date, after: true });
    v.d.place(v.due, { how: 'into', container: 'section-1' });
    expect(v.span(v.due)).toBe(6);
    v.d.place(v.customer, { how: 'into', container: v.follow });
    expect(v.span(v.customer)).toBe(1);
  });
});

describe('widths and columns in twelfths', () => {
  it('Twelfths as a group’s columns divides it, nothing moving; one to four again, as near as they go', () => {
    const { d, customer, date, notes, span, columns } = visit();
    expect(d.setColumns('section-1', 12)).toBe(true);
    expect([columns('section-1'), span(customer), span(date), span(notes)]).toEqual([12, 6, 6, 12]);
    d.setWidths([{ id: customer, span: 7 }, { id: date, span: 5 }]);
    expect(d.setColumns('section-1', 3)).toBe(true);
    expect([columns('section-1'), span(customer), span(date), span(notes)]).toEqual([3, 2, 1, 3]);
    expectValid(d.getPage());
  });

  it('a gutter’s widths in twelfths divide a group of columns first, as one edit', () => {
    const { d, customer, date, span, columns } = visit();
    const before = d.getPage();
    expect(d.setWidths([{ id: customer, span: 7 }, { id: date, span: 5 }], { twelfths: true })).toBe(true);
    expect([columns('section-1'), span(customer), span(date)]).toEqual([12, 7, 5]);
    d.undo();
    expect(d.getPage()).toEqual(before);
  });

  it('in a group that keeps its rows full, one width set hands the difference to the rest of its row', () => {
    const { d, customer, date, next, notes, span } = visit();
    d.place(next, { how: 'beside', target: date, after: true });
    expect(d.setColspan(customer, 6)).toBe(true);
    expect([span(customer), span(date), span(next)]).toEqual([6, 3, 3]);
    expect(d.setColspan(customer, 11)).toBe(false);
    expect(d.getState().issues).toEqual(['The rest of its row needs room beside it']);
    expect(d.setColspan(notes, 6)).toBe(false);
    expect(d.getState().issues).toEqual(['Alone in its row, it fills it: let the group’s rows leave gaps to make it narrower']);
    // The whole row: the parts before and after it each a row of their own.
    expect(d.setColspan(date, 12)).toBe(true);
    expect([span(customer), span(date), span(next)]).toEqual([12, 12, 12]);
    expectValid(d.getPage());
  });

  it('in a group that allows gaps, a width is only its own', () => {
    const { d, customer, date, span } = visit('gaps');
    d.setColumns('section-1', 12);
    expect(d.setColspan(customer, 4)).toBe(true);
    expect([span(customer), span(date)]).toEqual([4, 6]);
  });

  it('only a group keeps its rows full or with gaps; full is no setting at all', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('who', { rows: 'gaps' })).toBe(false);
    expect(d.getState().issues).toEqual(['Only a group keeps its rows full or with gaps']);
    d.setSectionLook('address', { rows: 'gaps' });
    expect(nodeOf(d.getPage(), 'address')?.['rows']).toBe('gaps');
    d.setSectionLook('address', { rows: 'full' });
    expect(nodeOf(d.getPage(), 'address')).not.toHaveProperty('rows');
  });
});

describe('a new column inside a group, beside all its rows (as Grafloria splits a section’s content)', () => {
  const holder = (d: Designer, id: string) => spot(d.getPage(), id)?.parent;

  it('after them: the rows go into a column on the group’s tracks, the part beside it, the two in halves', () => {
    const { d, customer, date, notes, span, kids, columns } = visit();
    const drop = { how: 'column', container: 'section-1', after: true } as const;
    expect(d.describeDrop(drop)).toBe('new column inside “Visit”, after all its rows — in halves');
    const id = d.place({ kind: 'email' }, drop) as string;
    expect(columns('section-1')).toBe(12);
    const rows = holder(d, customer) as { id: string; style?: string; title?: string };
    expect(kids('section-1')).toEqual([rows.id, id]);
    expect([rows.style, rows.title]).toEqual(['plain', undefined]);
    expect(kids(rows.id)).toEqual([customer, date, notes]);
    // The rows keep their shares, on the six tracks they now have: Customer and Visit date a half each, Notes all six.
    expect([span(rows.id), span(id), span(customer), span(date), span(notes)]).toEqual([6, 6, 3, 3, 6]);
    expectValid(d.getPage());
  });

  it('before them, and said so; right to left the same, the words being the reading order', () => {
    const { d, customer, kids } = visit();
    const drop = { how: 'column', container: 'section-1', after: false } as const;
    expect(d.describeDrop(drop)).toBe('new column inside “Visit”, before all its rows — in halves');
    const id = d.place({ kind: 'email' }, drop) as string;
    expect(kids('section-1')).toEqual([id, holder(d, customer)?.id]);
  });

  it('a part of the group moved there leaves its row first: Notes beside the one row left joins it, in thirds', () => {
    const { d, customer, date, notes, span, kids } = visit();
    const drop = { how: 'column', container: 'section-1', after: true } as const;
    expect(d.describeDrop(drop, notes)).toBe('at the end of the row, after “Visit date” — the row in thirds');
    d.place(notes, drop);
    expect(kids('section-1')).toEqual([customer, date, notes]);
    expect([span(customer), span(date), span(notes)]).toEqual([4, 4, 4]);
  });

  it('a group of one row: the part joins that row, as at its end; an empty group takes it', () => {
    const { d, follow, next, due, call, kids } = visit();
    const id = d.place({ kind: 'number' }, { how: 'column', container: follow, after: false }) as string;
    // Follow-up is Next step and Due by, then Manager to call?: two rows, so a column; a group of one row is joined.
    expect(kids(follow)).toHaveLength(2);
    const one = d.addContainer('One row') as string;
    const a = d.place({ kind: 'number' }, { how: 'into', container: one }) as string;
    const b = d.place({ kind: 'date' }, { how: 'column', container: one, after: true }) as string;
    expect(kids(one)).toEqual([a, b]);
    const empty = d.addContainer('Empty') as string;
    const c = d.place({ kind: 'date' }, { how: 'column', container: empty, after: true }) as string;
    expect(kids(empty)).toEqual([c]);
    void [id, next, due, call];
    expectValid(d.getPage());
  });

  it('is refused anywhere but a group, and for a group inside itself', () => {
    const { d } = visit();
    expect(d.dropRefusal({ how: 'column', container: 'section-1', after: true }, 'section-1')).toBe('A part cannot go inside itself');
    expect(d.dropRefusal({ how: 'column', container: d.getPage().layout.id, after: true })).toBe('A new column goes inside a group');
    expect(d.dropRefusal({ how: 'column', container: 'nothing', after: true })).toBe('There is no part “nothing”');
  });

  it('undoes in one step', () => {
    const { d } = visit();
    const before = JSON.stringify(d.getPage());
    d.place({ kind: 'email' }, { how: 'column', container: 'section-1', after: true });
    d.undo();
    expect(JSON.stringify(d.getPage())).toBe(before);
  });
});
