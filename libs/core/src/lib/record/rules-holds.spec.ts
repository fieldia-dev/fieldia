import type { AnswerRule } from '../format/layout';
import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES, type Locale } from './messages';

/**
 * A rule across fields (`holds`): the answers must keep an expression
 * together, such as a contract that ends on or after the day it starts. It is
 * checked once the answer and every field it reads are filled in, fails when
 * the expression is false, and says its message as other rules do: under the
 * field, blocking sending, or as a warning that does not.
 */

const page = (rules: AnswerRule[], extra: { required?: boolean } = {}): Page => ({
  fieldia: '0.1',
  id: 'contract',
  data: { kind: 'responses' },
  fields: {
    start: { type: 'date', label: 'Start date' },
    end: { type: 'date', label: 'Contract ends' },
    paid: { type: 'monetary', label: 'Paid' },
    total: { type: 'monetary', label: 'Total' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'n_start', field: 'start' },
      { type: 'field', id: 'n_end', field: 'end', validate: rules, ...(extra.required ? { required: true } : {}) },
      { type: 'field', id: 'n_paid', field: 'paid' },
      { type: 'field', id: 'n_total', field: 'total' },
    ],
  },
});

const formWith = (rules: AnswerRule[], values: Record<string, unknown> = {}) => {
  const source = createMemoryDataSource();
  const form = createForm({ page: page(rules), dataSource: source, values: values as never });
  return { form, source };
};

const errorWith = (rules: AnswerRule[], values: Record<string, unknown>) => {
  const { form } = formWith(rules, values);
  form.validate();
  return form.getState().errors['end'];
};

const endsAfter: AnswerRule = { holds: 'end >= start', message: 'Contract ends must not be before Start date' };

describe('a rule across fields', () => {
  it('refuses answers the expression does not hold for, with its message', () => {
    expect(errorWith([endsAfter], { start: '2026-05-01', end: '2026-04-30' })).toBe('Contract ends must not be before Start date');
  });

  it('lets answers it holds for through: the same day, and after', () => {
    expect(errorWith([endsAfter], { start: '2026-05-01', end: '2026-05-01' })).toBeUndefined();
    expect(errorWith([endsAfter], { start: '2026-05-01', end: '2026-05-02' })).toBeUndefined();
  });

  it('waits for every field it reads: an empty answer, or an empty field it compares with, passes', () => {
    expect(errorWith([endsAfter], { start: '2026-05-01' })).toBeUndefined();
    expect(errorWith([endsAfter], { end: '2026-04-30' })).toBeUndefined();
    expect(errorWith([endsAfter], { start: '', end: '2026-04-30' })).toBeUndefined();
  });

  it('reads any field of the page, not only its own: what is paid is no more than the total', () => {
    const rule: AnswerRule = { holds: 'paid <= total' };
    expect(errorWith([rule], { end: '2026-01-01', paid: 120, total: 100 })).toBe('Contract ends does not agree with the other answers');
    expect(errorWith([rule], { end: '2026-01-01', paid: 100, total: 100 })).toBeUndefined();
    // Zero is an answer, not an empty one.
    expect(errorWith([rule], { end: '2026-01-01', paid: 1, total: 0 })).toBe('Contract ends does not agree with the other answers');
  });

  it('says the language’s own words when it has no message, naming the field', () => {
    const { form } = formWith([{ holds: 'end >= start' }], { start: '2026-05-01', end: '2026-04-30' });
    form.validate();
    expect(form.getState().errors['end']).toBe('Contract ends does not agree with the other answers');
    const arabic = createForm({ page: page([{ holds: 'end >= start' }]), values: { start: '2026-05-01', end: '2026-04-30' }, messages: MESSAGES.ar });
    arabic.validate();
    expect(arabic.getState().errors['end']).toBe(MESSAGES.ar.holds.replace('{label}', 'Contract ends'));
  });

  it.each(['en', 'ar', 'de', 'fr'] as Locale[])('%s has words for it, naming the field', (locale) => {
    expect(MESSAGES[locale].holds).toContain('{label}');
  });

  it('applies only while its condition holds', () => {
    const rule: AnswerRule = { ...endsAfter, when: 'total > 0' };
    expect(errorWith([rule], { start: '2026-05-01', end: '2026-04-30' })).toBeUndefined();
    expect(errorWith([rule], { start: '2026-05-01', end: '2026-04-30', total: 5 })).toBe('Contract ends must not be before Start date');
  });

  it('is checked after the asks of its own rule, and after the rules before it', () => {
    expect(errorWith([{ date: 'future', message: 'first' }, endsAfter], { start: '2000-05-01', end: '2000-04-30' })).toBe('first');
  });

  it('blocks sending at the error level, and clears once the other field is put right', async () => {
    const { form, source } = formWith([endsAfter], { start: '2026-05-01', end: '2026-04-30' });
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ end: 'Contract ends must not be before Start date' });
    expect(source.responses).toHaveLength(0);
    form.setValue('start', '2026-04-01');
    expect(form.getState().errors).toEqual({});
  });

  it('only warns at the warning level, and the form still sends', async () => {
    const { form, source } = formWith([{ ...endsAfter, level: 'warning' }], { start: '2026-05-01' });
    form.setValue('end', '2026-04-30');
    expect(form.getState().warnings).toEqual({ end: 'Contract ends must not be before Start date' });
    expect(await form.save()).toBe(true);
    expect(source.responses).toHaveLength(1);
    form.setValue('start', '2026-04-01');
    expect(form.getState().warnings).toEqual({});
  });

  it('fails for an expression that cannot be worked out on these answers, as a condition does', () => {
    expect(errorWith([{ holds: 'paid / (total - total) > 1' }], { end: '2026-01-01', paid: 1, total: 2 })).toBe('Contract ends does not agree with the other answers');
  });
});
