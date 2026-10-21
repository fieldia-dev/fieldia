import { checkPage, pageWarnings, validatePage, type Page } from '../../index';

/**
 * The page's checks read every function an expression calls: Fieldia's own
 * and the app's (`functions`), how many values each takes, and — where pages
 * are made (`validatePage`) — the kinds of value it is given, said in words.
 */

function page(fields: Record<string, unknown>, more: Record<string, unknown> = {}): Page {
  return {
    fieldia: '0.8',
    id: 'patient',
    data: { kind: 'record', model: 'clinic.patient' },
    fields: {
      name: { type: 'char', label: 'Name' },
      birth: { type: 'date', label: 'Birth date' },
      notes: { type: 'text', label: 'Notes' },
      amount: { type: 'monetary', label: 'Amount', currency: 'EGP' },
      country: { type: 'char', label: 'Country' },
      ...fields,
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }] },
    ...more,
  } as Page;
}

const issues = (result: ReturnType<typeof validatePage>) => (result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`));
const warnings = (result: ReturnType<typeof validatePage>) => (result.warnings ?? []).map((i) => `${i.path}: ${i.message}`);

describe('functions in a page’s expressions', () => {
  it('reads Fieldia’s new functions where fields are worked out', () => {
    const result = validatePage(page({ age: { type: 'integer', label: 'Age', compute: 'age(birth)' }, code: { type: 'char', label: 'Code', compute: "upper(join('-', country, name))" } }));
    expect(issues(result)).toEqual([]);
  });

  it('refuses a function there is none of, naming those there are', () => {
    const result = validatePage(page({ x: { type: 'integer', label: 'X', compute: 'agee(birth)' } }));
    expect(issues(result)).toEqual([expect.stringMatching(/^fields\.x\.compute: cannot read "agee\(birth\)": no function "agee": the functions are round, abs, .*firstOf$/)]);
  });

  it('refuses too many or too few values', () => {
    const result = validatePage(page({ x: { type: 'date', label: 'X', compute: 'addMonths(birth)' } }));
    expect(issues(result)).toEqual(['fields.x.compute: cannot read "addMonths(birth)": addMonths takes 2 values']);
  });

  it('warns of a value of a kind a function does not take, and passes the page all the same: it worked before', () => {
    const wrong = page({
      a: { type: 'integer', label: 'A', compute: 'age(notes)' },
      b: { type: 'char', label: 'B', compute: 'upper(amount)' },
      c: { type: 'date', label: 'C', compute: "addDays(birth, 'two')" },
      d: { type: 'float', label: 'D', compute: 'round(name)' },
    });
    const result = validatePage(wrong);
    expect(result.ok).toBe(true);
    expect(checkPage(wrong).ok).toBe(true);
    expect(pageWarnings(wrong)).toEqual(result.warnings);
    expect(warnings(result)).toEqual([
      'fields.a.compute: "age(notes)": age takes a date as its first value; "notes" is text',
      'fields.b.compute: "upper(amount)": upper takes text as its first value; "amount" is a number',
      `fields.c.compute: "addDays(birth, 'two')": addDays takes a number as its second value; 'two' is text`,
      'fields.d.compute: "round(name)": round takes a number as its first value; "name" is text',
    ]);
    // A page with none says none.
    expect(validatePage(page({}))).toEqual({ ok: true, page: page({}) });
  });

  it('reads kinds in conditions too, and takes what cannot be known', () => {
    const shown = page({}, { layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name', invisible: "startsWith(amount, '2') or startsWith(birth, '2026')" }, { type: 'field', id: 'b', field: 'birth', invisible: 'age(context.born) < 18 or contains(user.roles, "nurse")' }] } });
    expect(warnings(validatePage(shown))).toEqual([`layout.children[0].invisible: "startsWith(amount, '2') or startsWith(birth, '2026')": startsWith takes text as its first value; "amount" is a number`]);
  });

  it('calls the app’s functions where they are given, and checks what they take', () => {
    const functions = { vatRate: { takes: [1, 1] as const, values: ['text'] as const, gives: 'number' as const, call: () => 14 } };
    const worked = page({ vat: { type: 'monetary', label: 'VAT', currency: 'EGP', compute: 'amount * vatRate(country) / 100' } });
    expect(issues(validatePage(worked))).toEqual([expect.stringMatching(/no function "vatRate"/)]);
    expect(issues(validatePage(worked, { functions }))).toEqual([]);
    expect(checkPage(worked, { functions }).ok).toBe(true);
    const wrong = page({ vat: { type: 'monetary', label: 'VAT', currency: 'EGP', compute: 'vatRate(amount, country)' } });
    expect(issues(validatePage(wrong, { functions }))).toEqual(['fields.vat.compute: cannot read "vatRate(amount, country)": vatRate takes 1 value']);
    const kind = page({ vat: { type: 'monetary', label: 'VAT', currency: 'EGP', compute: 'vatRate(amount)' } });
    expect(issues(validatePage(kind, { functions }))).toEqual([]);
    expect(warnings(validatePage(kind, { functions }))).toEqual(['fields.vat.compute: "vatRate(amount)": vatRate takes text as its first value; "amount" is a number']);
  });

  it('says a name the app cannot give a function', () => {
    expect(issues(validatePage(page({}), { functions: { round: () => 1 } }))).toEqual([`(functions): functions: "round" is Fieldia's own function: give the app's another name`]);
  });

  it('reads a function the app gives inside a line’s condition', () => {
    const lines = page({
      lines: { type: 'one2many', label: 'Lines', relation: 'x.line', fields: { kind: { type: 'char', label: 'Kind' }, price: { type: 'float', label: 'Price' } } },
      special: { type: 'integer', label: 'Special', compute: `count(lines, "isSpecial(kind)")` },
    });
    expect(issues(validatePage(lines, { functions: { isSpecial: () => true } }))).toEqual([]);
  });
});
