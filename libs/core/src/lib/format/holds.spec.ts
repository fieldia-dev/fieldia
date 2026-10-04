import { checkPage, validatePage } from '../../index';

/**
 * A rule across fields (`holds` on an answer rule): an expression the answers
 * must keep together, such as `end_date >= start_date`. The format takes it
 * as a rule that asks for something; the page's check reads it and finds
 * every field it names.
 */

const page = (validate: unknown) => ({
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'responses' },
  fields: { start: { type: 'date', label: 'Start' }, end: { type: 'date', label: 'End' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 's', field: 'start' }, { type: 'field', id: 'e', field: 'end', validate }] },
});
const problems = (input: unknown, check = validatePage) => {
  const r = check(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a rule across fields, in the format', () => {
  it('is a rule that asks for something, with a message, a level and a condition as other rules have', () => {
    expect(problems(page([{ holds: 'end >= start' }]))).toEqual([]);
    expect(problems(page([{ holds: 'end >= start', message: 'Ends after it starts', level: 'warning', when: 'start' }]))).toEqual([]);
  });

  it('is not empty', () => {
    expect(problems(page([{ holds: '' }]))).toEqual([expect.stringMatching(/validate\[0\]/)]);
  });

  it('is said among what a rule can ask for, when a rule asks for nothing', () => {
    expect(problems(page([{ message: 'Hm' }]))).toEqual([expect.stringContaining('an expression that holds')]);
  });

  it('reads, and reads only fields of the page', () => {
    expect(problems(page([{ holds: 'end >= starts' }]))).toEqual(['layout.children[1].validate[0].holds: "end >= starts" reads "starts", which is not a field of this page']);
    expect(problems(page([{ holds: 'end >=' }]))).toEqual([expect.stringMatching(/^layout\.children\[1\]\.validate\[0\]\.holds: cannot read "end >="/)]);
    expect(problems(page([{ holds: 'end >= start' }]), checkPage)).toEqual([]);
  });
});
