import { checkPage } from './check-page';
import { validatePage } from './validate';
import { fieldPattern, patternRisk, PATTERN_MOST, rulePattern } from './pattern';
import type { Page } from './page';
import { checkValue } from '../record/check';
import { createForm } from '../record/form';
import { createMemoryDataSource } from '../record/memory-data-source';
import { compileRules } from '../record/rules';
import { PROOF_MS, timed } from '../../../../../testing/proof-time';

/** How many times `run` tries the page's pattern (`^(?:…)$`, its source) on an answer: the work it would backtrack in. */
const tries = (pattern: string, run: () => unknown) => {
  let n = 0;
  const real = RegExp.prototype.test;
  const spy = jest.spyOn(RegExp.prototype, 'test').mockImplementation(function (this: RegExp, text: string) {
    if (this.source === `^(?:${pattern})$`) n++;
    return real.call(this, text);
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return n;
};

/** The audit's page: a company's name, as an author writes a pattern for it without thinking of backtracking (S-M2). */
const page = (pattern: string): Page => ({ fieldia: '0.13', id: 'p', data: { kind: 'responses' }, fields: { company: { type: 'char', label: 'Company', pattern } }, layout: { type: 'sheet', id: 'root', children: [{ type: 'field', id: 'n0', field: 'company' }] } });

/** Every pattern Fieldia's own pages, demos and schemas write: each one taken. */
const WRITTEN = [
  '^[A-Za-z_][A-Za-z0-9_]*$', '^[A-Za-z0-9][A-Za-z0-9._-]*$', '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', '^#[0-9a-fA-F]{6}$', '^(\\d{4}-\\d{2}-\\d{2}|today([+-]\\d{1,4})?)$', '\\S',
  '^(shift\\+)?[a-z0-9]$', '^[A-Z]{3}$', '[A-Z]{2}-\\d{4}', '^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:\\d{2})?)?$', '^\\d+(\\.\\d+)?(px|%|fr)$',
  '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$', '^[A-Za-z]{2}[0-9]{2}( ?[A-Za-z0-9]){10,30}$', '^[A-Za-z][\\w+-]*(\\/[\\w+-]+)*$', '^[A-Za-z0-9_.~-]{1,100}$', '^[0-9]*$', '^(https?:\\/\\/|mailto:)\\S+$',
  '^(https?:\\/\\/|data:image\\/|\\/|\\.{0,2}\\/?[^:\\s]+$)', '^(\\d|[1-9]\\d|[1-3]\\d{2}|400)px$', '^([01]\\d|2[0-3]):[0-5]\\d$', '^((parent|user|context)\\.)?[A-Za-z_][A-Za-z0-9_]*$', '^!?[A-Za-z0-9_][A-Za-z0-9_.:-]*$', '\\d{5}',
  '\\p{L}+( \\p{L}+)*', '(?:\\s*,\\s*\\w+)*', '(com|org)+', '[^<>]*', '(?<year>\\d{4})-\\k<year>', '\\u0041+', '\\x41+b', '\\+?[0-9 ]{6,15}', '[0-9]{4} ?[A-Z]{2}',
];
/** Patterns that backtrack for seconds on a short answer: each one refused. */
const RISKY = ['([A-Za-z0-9]+\\s?)*', '(a+)+', '(a*)*', '(a?)*', '(a|ab)*', '(\\w|\\d)+', '\\d+\\d+', '\\w+\\s*\\w+', '.*.*', '(\\d+\\.?)*', '^(([a-z])+.)+[A-Z]([a-z])+$', '(x+x+)+y', '^([a-zA-Z0-9]+[-._]?)+@example\\.com$'];

describe('a page’s pattern can never take seconds on an answer (S-M2)', () => {
  it('refuses the audit’s pattern in validatePage and checkPage, saying why — and checks an answer at once (its proof: 1.87 s, 4× a character)', () => {
    for (const check of [validatePage, checkPage]) {
      const result = check(page('([A-Za-z0-9]+\\s?)*'));
      expect(result.ok).toBe(false);
      expect(!result.ok && result.issues[0]).toEqual({ path: 'fields.company.pattern', message: expect.stringMatching(/can take seconds on a short answer/) });
    }
    const field = page('([A-Za-z0-9]+\\s?)*').fields['company'];
    // The work it bounds, counted: the refused pattern is never tried on an answer — and the clock never runs away.
    for (const n of [20, 24, 28, 40]) {
      expect(tries('([A-Za-z0-9]+\\s?)*', () => checkValue(field, 'a'.repeat(n) + '!', false))).toBe(0);
      expect(timed(() => checkValue(field, 'a'.repeat(n) + '!', false))).toBeLessThan(PROOF_MS);
    }
    const form = createForm({ page: page('([A-Za-z0-9]+\\s?)*'), dataSource: createMemoryDataSource() });
    expect(tries('([A-Za-z0-9]+\\s?)*', () => form.setValue('company', 'a'.repeat(27) + '!'))).toBe(0);
    expect(timed(() => form.setValue('company', 'a'.repeat(28) + '!'))).toBeLessThan(PROOF_MS);
    form.dispose();
    // A pattern it takes is tried once, as ever: the count counts.
    expect(tries('[A-Z]{2}-\\d{4}', () => checkValue(page('[A-Z]{2}-\\d{4}').fields['company'], 'EG-1234', false))).toBe(1);
  });

  it('takes every pattern Fieldia’s pages, demos and schemas write', () => {
    for (const pattern of WRITTEN) {
      expect([pattern, patternRisk(pattern)]).toEqual([pattern, null]);
      expect(fieldPattern(pattern)).toBeInstanceOf(RegExp);
    }
  });

  it('refuses nested, overlapping and ambiguous repeats, in a field’s pattern and an answer rule’s alike', () => {
    for (const pattern of RISKY) {
      expect([pattern, patternRisk(pattern)]).toEqual([pattern, expect.any(String)]);
      expect(fieldPattern(pattern)).toBeInstanceOf(Error);
      expect(rulePattern(pattern)).toBeInstanceOf(Error);
      // A rule's pattern refused is never tried on an answer: it is the page's to fix.
      expect(compileRules([{ pattern }])[0].pattern).toBeInstanceOf(Error);
    }
  });

  it('tries no pattern on an answer longer than it checks, refusing it at once', () => {
    const field = page('[^@\\s]+@[^@\\s]+\\.[^@\\s]+').fields['company'];
    // The most a pattern of its kind can take: quadratic, kept to PATTERN_MOST characters.
    const longest = 'a@' + 'a.'.repeat((PATTERN_MOST - 2) / 2);
    expect(longest.length).toBe(PATTERN_MOST);
    // Never tried on an answer one character over its most — only on one within it — and never slow.
    expect(tries('[^@\\s]+@[^@\\s]+\\.[^@\\s]+', () => checkValue(field, longest + 'x', false))).toBe(0);
    expect(tries('[^@\\s]+@[^@\\s]+\\.[^@\\s]+', () => checkValue(field, longest, false))).toBe(1);
    expect(timed(() => checkValue(field, longest + 'x', false))).toBeLessThan(PROOF_MS);
    expect(checkValue(field, 'a@b.c' + ' '.repeat(PATTERN_MOST), false)).toBe('Company is not in the expected format');
    expect(checkValue(field, 'mona@example.com', false)).toBeUndefined();
  });
});
