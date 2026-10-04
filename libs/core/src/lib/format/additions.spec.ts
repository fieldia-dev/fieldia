import { checkPage, localizePage, validatePage, type Page } from '../../index';
import { checkValue } from '../record/check';

/**
 * The format additions that close the designer's gaps: groups side by side and
 * their look, blocks between fields, the page's look, answer rules, worked-out
 * values, translations, pictures and points on choices, and a matrix question.
 */

const base = (layout: unknown, fields: Record<string, unknown> = { name: { type: 'char', label: 'Name' } }, extra: Record<string, unknown> = {}) => ({
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'responses' },
  fields,
  layout,
  ...extra,
});
const sections = (...children: unknown[]) => ({ type: 'sections', id: 'root', children });
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const runtime = (input: unknown) => {
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('groups side by side, and how a group looks', () => {
  const page = base(
    sections({
      type: 'section', id: 'outer', title: 'Personal', columns: 3, style: 'card', labels: 'beside', labelWidth: 140,
      children: [
        { type: 'field', id: 'n', field: 'name', labels: 'hidden' },
        { type: 'section', id: 'pair', style: 'plain', colspan: 2, columns: 2, children: [] },
      ],
    })
  );

  it('takes a width for a group within its group, a style, and where labels sit', () => {
    expect(problems(page)).toEqual([]);
    expect(runtime(page)).toEqual([]);
  });

  it('refuses a style or a label place it does not know, and a width beyond twelve columns', () => {
    const bad = base(sections({ type: 'section', id: 's', style: 'shadow', labels: 'left', colspan: 13, children: [] }));
    expect(problems(bad)).toEqual(expect.arrayContaining([expect.stringMatching(/style/), expect.stringMatching(/labels/), expect.stringMatching(/colspan/)]));
  });

  it('takes a group in twelfths: each row divided its own way, kept full or with gaps as the designer is told', () => {
    const twelfths = (rows?: unknown) =>
      base(
        sections({
          type: 'section', id: 's', title: 'Visit', columns: { wide: 12, medium: 12, narrow: 1 }, ...(rows === undefined ? {} : { rows }),
          children: [
            { type: 'field', id: 'a', field: 'name', colspan: 7 },
            { type: 'text', id: 't', text: 'Hello', colspan: 5 },
            { type: 'section', id: 'pair', style: 'plain', colspan: 6, columns: 6, children: [] },
            { type: 'button', id: 'b', label: 'Go', action: 'go', colspan: 6 },
          ],
        })
      );
    for (const rows of [undefined, 'full', 'gaps']) {
      expect(problems(twelfths(rows))).toEqual([]);
      expect(runtime(twelfths(rows))).toEqual([]);
    }
    expect(problems(twelfths('loose'))).toEqual([expect.stringMatching(/rows/)]);
  });

  it('gives tabs, words and buttons a width too', () => {
    const p = base(
      sections({
        type: 'section', id: 's', columns: 2,
        children: [
          { type: 'text', id: 't', text: 'Hello', colspan: 2 },
          { type: 'button', id: 'b', label: 'Go', action: 'go', colspan: 1 },
          { type: 'tabs', id: 'tb', colspan: 2, children: [{ type: 'tab', id: 'tab', label: 'One', children: [] }] },
        ],
      })
    );
    expect(problems(p)).toEqual([]);
  });
});

describe('blocks between fields', () => {
  const page = base(
    sections(
      { type: 'divider', id: 'd' },
      { type: 'spacer', id: 'sp', colspan: 1 },
      { type: 'image', id: 'logo', src: 'https://example.com/logo.png', alt: 'Acme', colspan: 2, invisible: "name == 'x'" }
    )
  );

  it('has a divider, a spacer and an image, each with its own id', () => {
    expect(problems(page)).toEqual([]);
    expect(runtime(page)).toEqual([]);
  });

  it('wants an image described, and its ids unique like every other part', () => {
    expect(problems(base(sections({ type: 'image', id: 'i', src: 'x.png' })))).toEqual([expect.stringMatching(/alt/)]);
    expect(runtime(base(sections({ type: 'divider', id: 'same' }, { type: 'spacer', id: 'same' })))).toEqual([expect.stringMatching(/same/)]);
  });

  it('checks the condition that hides an image', () => {
    expect(runtime(base(sections({ type: 'image', id: 'i', src: 'x.png', alt: 'X', invisible: "nope == 1" })))).toEqual([expect.stringMatching(/nope/)]);
  });
});

describe('the page’s look', () => {
  it('takes an accent, a font, spacing, corners, where labels sit and a colour scheme', () => {
    const p = base(sections(), undefined, { look: { accent: '#1f7a4d', font: 'serif', density: 'compact', corners: 'round', labels: 'above', labelWidth: 120, scheme: 'auto' } });
    expect(problems(p)).toEqual([]);
  });

  it('wants the accent as a #rrggbb colour', () => {
    expect(problems(base(sections(), undefined, { look: { accent: 'green' } }))).toEqual([expect.stringMatching(/accent/)]);
  });
});

describe('answer rules', () => {
  const rules = (validate: unknown) => base(sections({ type: 'field', id: 'n', field: 'name', validate }));

  it('takes length, a pattern, an ending, ranges, ticks, dates, a condition, a message and a level', () => {
    expect(
      problems(
        rules([
          { minLength: 2, maxLength: 40, message: 'Between 2 and 40 letters' },
          { pattern: '^[A-Z]', message: 'Starts with a capital' },
          { endsWith: '@acme.com', level: 'warning' },
          { min: 1, max: 10 },
          { atLeast: 1, atMost: 3 },
          { date: 'past' },
          { when: "name != ''", maxLength: 10 },
        ])
      )
    ).toEqual([]);
  });

  it('refuses a rule that asks for nothing, and a level it does not know', () => {
    expect(problems(rules([{ message: 'Hm' }]))).toEqual([expect.stringMatching(/validate/)]);
    expect(problems(rules([{ minLength: 1, level: 'fatal' }]))).toEqual(expect.arrayContaining([expect.stringMatching(/level/)]));
  });

  it('refuses a pattern that is not a regular expression, and checks the condition', () => {
    expect(runtime(rules([{ pattern: '([a-z' }]))).toEqual([expect.stringMatching(/pattern/)]);
    expect(runtime(rules([{ when: 'nope == 1', minLength: 1 }]))).toEqual([expect.stringMatching(/nope/)]);
  });
});

describe('values worked out, and values set when something holds', () => {
  it('takes an expression for a field’s value, and values to set when a condition holds', () => {
    const p = base(sections({ type: 'field', id: 'n', field: 'total' }), {
      price: { type: 'float', label: 'Price' },
      qty: { type: 'integer', label: 'Quantity' },
      total: { type: 'float', label: 'Total', compute: 'price * qty' },
      kind: { type: 'char', label: 'Kind', setWhen: [{ when: 'qty > 10', value: "'bulk'" }] },
    });
    expect(problems(p)).toEqual([]);
  });

  it('refuses an empty expression', () => {
    const p = base(sections(), { total: { type: 'float', label: 'Total', compute: '' } });
    expect(problems(p)).toEqual([expect.stringMatching(/compute/)]);
  });
});

describe('choices with a picture and points', () => {
  it('takes an image and a score on an option', () => {
    const p = base(sections({ type: 'field', id: 'c', field: 'colour' }), {
      colour: { type: 'selection', label: 'Colour', options: [{ value: 'r', label: 'Red', image: 'https://example.com/red.png', score: 1 }, { value: 'b', label: 'Blue', score: 0 }] },
    });
    expect(problems(p)).toEqual([]);
  });
});

describe('a matrix question: one answer per row', () => {
  const matrix = {
    type: 'matrix',
    label: 'How was it?',
    rows: [{ value: 'food', label: 'Food' }, { value: 'service', label: 'Service' }],
    columns: [{ value: 1, label: 'Poor' }, { value: 2, label: 'Fine' }, { value: 3, label: 'Great' }],
  };
  const page = base(sections({ type: 'field', id: 'm', field: 'rate' }), { rate: matrix });

  it('is a kind of field with rows and columns', () => {
    expect(problems(page)).toEqual([]);
    expect(runtime(page)).toEqual([]);
  });

  it('takes an answer per row from the columns, and several per row when asked', () => {
    const field = matrix as never;
    expect(checkValue(field, { food: 3, service: 2 }, false)).toBeUndefined();
    expect(checkValue(field, { food: 9 }, false)).toMatch(/Poor, Fine, Great/);
    expect(checkValue(field, { drinks: 1 }, false)).toMatch(/Food, Service/);
    expect(checkValue({ ...matrix, multiple: true } as never, { food: [1, 3] }, false)).toBeUndefined();
    expect(checkValue(field, 'great', false)).toBeDefined();
  });

  it('is answered only when every row is, when required', () => {
    const field = matrix as never;
    expect(checkValue(field, { food: 3 }, true)).toMatch(/every row/i);
    expect(checkValue(field, { food: 3, service: 1 }, true)).toBeUndefined();
  });
});

describe('translations kept in the page', () => {
  const page = base(
    sections({ type: 'section', id: 's', title: 'About you', children: [{ type: 'field', id: 'n', field: 'name', help: 'As on your ID' }] }),
    { name: { type: 'char', label: 'Your name' } },
    { title: 'Sign up', translations: { ar: { 'Sign up': 'التسجيل', 'Your name': 'اسمك', 'About you': 'عنك' } } }
  );

  it('keeps the words of each language by the words they translate', () => {
    expect(problems(page)).toEqual([]);
  });

  it('shows the page in a language it has, leaving words with no translation as they are', () => {
    const ar = localizePage(page as unknown as Page, 'ar');
    expect(ar.title).toBe('التسجيل');
    expect(ar.fields['name'].label).toBe('اسمك');
    const section = (ar.layout as { children: { title: string; children: { help: string }[] }[] }).children[0];
    expect(section.title).toBe('عنك');
    expect(section.children[0].help).toBe('As on your ID');
    // A language it lacks, and the base language: the page as written.
    expect(localizePage(page as unknown as Page, 'de').title).toBe('Sign up');
  });

  it('wants a language tag for each language', () => {
    expect(problems({ ...page, translations: { 'not a tag': {} } })).toEqual([expect.stringMatching(/translations/)]);
  });
});
