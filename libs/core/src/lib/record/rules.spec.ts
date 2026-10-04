import type { AnswerRule } from '../format/layout';
import type { Page } from '../format/page';
import { createForm, type FormOptions } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES, type Locale } from './messages';

/**
 * Answer rules (`validate` on a field node), checked like the field's own:
 * an empty answer passes, `when` limits a rule, an error blocks sending and
 * a warning is shown without blocking.
 */

const fields = {
  name: { type: 'char', label: 'Name' },
  email: { type: 'char', label: 'Email' },
  postcode: { type: 'char', label: 'Postcode' },
  age: { type: 'integer', label: 'Age' },
  interests: {
    type: 'selection',
    label: 'Interests',
    multiple: true,
    options: [{ value: 'a', label: 'Art' }, { value: 'b', label: 'Books' }, { value: 'c', label: 'Cinema' }, { value: 'd', label: 'Dance' }],
  },
  born: { type: 'date', label: 'Born' },
  visit: { type: 'date', label: 'Visit' },
  meeting: { type: 'datetime', label: 'Meeting' },
  country: { type: 'char', label: 'Country' },
};

type Rules = Partial<Record<keyof typeof fields, AnswerRule[]>>;

const page = (rules: Rules, extra: { required?: string[]; invisible?: Record<string, string>; label?: Record<string, string> } = {}): Page =>
  ({
    fieldia: '0.1',
    id: 'rules',
    data: { kind: 'responses' },
    fields,
    layout: {
      type: 'sections',
      id: 'root',
      children: Object.keys(fields).map((name) => ({
        type: 'field',
        id: `n_${name}`,
        field: name,
        ...(rules[name as keyof Rules] ? { validate: rules[name as keyof Rules] } : {}),
        ...(extra.required?.includes(name) ? { required: true } : {}),
        ...(extra.invisible?.[name] ? { invisible: extra.invisible[name] } : {}),
        ...(extra.label?.[name] ? { label: extra.label[name] } : {}),
      })),
    },
  }) as Page;

/** A form on these rules, with the clock at 4 October 2026, 12:00. */
const formWith = (rules: Rules, extra: Parameters<typeof page>[1] = {}, options: Partial<FormOptions> = {}) =>
  createForm({ page: page(rules, extra), now: () => new Date(2026, 9, 4, 12, 0), dataSource: createMemoryDataSource(), ...options });

/** The error the field would show after a check, or undefined. */
function errorFor(rules: Rules, field: string, value: unknown, extra: Parameters<typeof page>[1] = {}) {
  const form = formWith(rules, extra);
  form.setValue(field, value as never);
  form.validate();
  return form.getState().errors[field];
}

describe('answer rules — what each asks', () => {
  it('lets an empty answer pass every rule; required decides whether one is needed', () => {
    const rules: Rules = { name: [{ minLength: 2 }], email: [{ endsWith: '@acme.com' }], interests: [{ atLeast: 2 }] };
    const form = formWith(rules);
    expect(form.validate()).toBe(true);
    expect(errorFor(rules, 'name', null, { required: ['name'] })).toBe('Name is required');
  });

  it('asks for a length', () => {
    expect(errorFor({ name: [{ minLength: 2 }] }, 'name', 'A')).toBe('Name must be at least 2 characters');
    expect(errorFor({ name: [{ minLength: 2 }] }, 'name', 'Al')).toBeUndefined();
    expect(errorFor({ name: [{ maxLength: 5 }] }, 'name', 'Abcdef')).toBe('Maximum 5 characters allowed');
    expect(errorFor({ name: [{ maxLength: 5 }] }, 'name', 'Abcde')).toBeUndefined();
  });

  it('matches a pattern against the whole answer', () => {
    const rules: Rules = { postcode: [{ pattern: '\\d{5}' }] };
    expect(errorFor(rules, 'postcode', '123456')).toBe('Postcode is not in the expected format');
    expect(errorFor(rules, 'postcode', 'x12345')).toBe('Postcode is not in the expected format');
    expect(errorFor(rules, 'postcode', '12345')).toBeUndefined();
    expect(errorFor({ postcode: [{ pattern: 'a|b' }] }, 'postcode', 'b')).toBeUndefined();
  });

  it('asks for an ending, whatever the case', () => {
    const rules: Rules = { email: [{ endsWith: '@acme.com' }] };
    expect(errorFor(rules, 'email', 'sara@gmail.com')).toBe('Email must end with @acme.com');
    expect(errorFor(rules, 'email', 'Sara@ACME.com ')).toBeUndefined();
  });

  it('asks for a number in a range', () => {
    expect(errorFor({ age: [{ min: 18 }] }, 'age', 17)).toBe('Age must be at least 18');
    expect(errorFor({ age: [{ min: 18 }] }, 'age', 18)).toBeUndefined();
    expect(errorFor({ age: [{ max: 65 }] }, 'age', 66)).toBe('Age must be at most 65');
    expect(errorFor({ age: [{ max: 65 }] }, 'age', 65)).toBeUndefined();
  });

  it('asks how many may be ticked', () => {
    expect(errorFor({ interests: [{ atLeast: 2 }] }, 'interests', ['a'])).toBe('Choose at least 2 for Interests');
    expect(errorFor({ interests: [{ atLeast: 2 }] }, 'interests', ['a', 'b'])).toBeUndefined();
    expect(errorFor({ interests: [{ atMost: 2 }] }, 'interests', ['a', 'b', 'c'])).toBe('Choose at most 2 for Interests');
    expect(errorFor({ interests: [{ atMost: 2 }] }, 'interests', ['a', 'b'])).toBeUndefined();
  });

  it('asks for a day in the past or the future, today being neither', () => {
    expect(errorFor({ born: [{ date: 'past' }] }, 'born', '2026-10-04')).toBe('Born must be in the past');
    expect(errorFor({ born: [{ date: 'past' }] }, 'born', '2026-10-03')).toBeUndefined();
    expect(errorFor({ visit: [{ date: 'future' }] }, 'visit', '2026-10-04')).toBe('Visit must be in the future');
    expect(errorFor({ visit: [{ date: 'future' }] }, 'visit', '2026-10-05')).toBeUndefined();
  });

  it('compares a date and time with the clock itself', () => {
    expect(errorFor({ meeting: [{ date: 'future' }] }, 'meeting', '2026-10-04T11:00')).toBe('Meeting must be in the future');
    expect(errorFor({ meeting: [{ date: 'future' }] }, 'meeting', '2026-10-04T13:00')).toBeUndefined();
    expect(errorFor({ meeting: [{ date: 'past' }] }, 'meeting', '2026-10-04T11:00')).toBeUndefined();
  });

  it('says what the rule says, when it says something, and names the field as its node labels it', () => {
    expect(errorFor({ name: [{ minLength: 2, message: 'Two letters at least' }] }, 'name', 'A')).toBe('Two letters at least');
    expect(errorFor({ name: [{ minLength: 2 }] }, 'name', 'A', { label: { name: 'Your name' } })).toBe('Your name must be at least 2 characters');
  });

  it('checks the field’s own rules first', () => {
    expect(errorFor({ age: [{ min: 18 }] }, 'age', 'twelve')).toBe('Age must be a number');
  });

  it('applies a rule only while its condition holds', () => {
    const rules: Rules = { postcode: [{ when: "country == 'EG'", pattern: '\\d{5}' }] };
    const form = formWith(rules);
    form.setValue('postcode', 'SW1A 1AA');
    expect(form.validate()).toBe(true);
    form.setValue('country', 'EG');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['postcode']).toBe('Postcode is not in the expected format');
  });

  it('takes the first broken rule, in order', () => {
    expect(errorFor({ name: [{ minLength: 3, message: 'first' }, { pattern: '[A-Z].*', message: 'second' }] }, 'name', 'ab')).toBe('first');
    expect(errorFor({ name: [{ minLength: 3, message: 'first' }, { pattern: '[A-Z].*', message: 'second' }] }, 'name', 'abc')).toBe('second');
  });
});

describe('answer rules — errors block, warnings do not', () => {
  const rules: Rules = { email: [{ endsWith: '@acme.com', level: 'warning', message: 'Use your work address if you can' }], postcode: [{ pattern: '\\d{5}' }] };

  it('blocks sending on an error, with the message under its field', async () => {
    const form = formWith(rules);
    form.setValue('postcode', '12');
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ postcode: 'Postcode is not in the expected format' });
    expect(form.problem('postcode')).toBe('Postcode is not in the expected format');
  });

  it('shows a warning as soon as the answer breaks the rule, and sends anyway', async () => {
    const source = createMemoryDataSource();
    const form = formWith(rules, {}, { dataSource: source });
    expect(form.getState().warnings).toEqual({});
    form.setValue('email', 'sara@gmail.com');
    expect(form.getState().warnings).toEqual({ email: 'Use your work address if you can' });
    expect(form.problem('email')).toBeNull();
    expect(form.validate()).toBe(true);
    expect(await form.save()).toBe(true);
    expect(source.responses).toHaveLength(1);
    form.setValue('email', 'sara@acme.com');
    expect(form.getState().warnings).toEqual({});
  });

  it('warns only about fields people can see', () => {
    const form = formWith(rules, { invisible: { email: "country == 'EG'" } });
    form.setValue('email', 'sara@gmail.com');
    expect(Object.keys(form.getState().warnings)).toEqual(['email']);
    form.setValue('country', 'EG');
    expect(form.getState().warnings).toEqual({});
  });

  it('warns about a record as it loads, and as it is again after a reset', async () => {
    const source = createMemoryDataSource({ records: { contact: { 1: { email: 'old@gmail.com' } } } });
    const p = { ...page(rules), data: { kind: 'record', model: 'contact' } } as Page;
    const form = createForm({ page: p, dataSource: source, recordId: 1 });
    await form.load();
    expect(form.getState().warnings).toEqual({ email: 'Use your work address if you can' });
    form.setValue('email', 'new@acme.com');
    expect(form.getState().warnings).toEqual({});
    form.reset();
    expect(form.getState().warnings).toEqual({ email: 'Use your work address if you can' });
  });

  it('does not check a rule on a field no one can see', () => {
    expect(errorFor({ postcode: [{ pattern: '\\d{5}' }] }, 'postcode', '12', { invisible: { postcode: 'True' } })).toBeUndefined();
  });

  it('clears an error shown once the answer is put right', () => {
    const form = formWith(rules);
    form.setValue('postcode', '12');
    form.validate();
    form.setValue('postcode', '12345');
    expect(form.getState().errors).toEqual({});
  });
});

describe('answer rules — messages in each language', () => {
  const kinds = ['minLength', 'maxLength', 'pattern', 'endsWith', 'min', 'max', 'atLeast', 'atMost', 'datePast', 'dateFuture'] as const;

  it.each(['en', 'ar', 'de', 'fr'] as Locale[])('%s has a message for every kind of rule, naming the field', (locale) => {
    for (const kind of kinds) {
      expect(MESSAGES[locale][kind]).toBeTruthy();
      if (kind !== 'maxLength') expect(MESSAGES[locale][kind]).toContain('{label}');
    }
  });

  it('speaks the page’s language', () => {
    const form = formWith({ name: [{ minLength: 2 }] }, {}, { messages: MESSAGES.ar });
    form.setValue('name', 'A');
    form.validate();
    expect(form.getState().errors['name']).toBe('يجب ألا يقل Name عن 2 حرفًا');
  });
});
