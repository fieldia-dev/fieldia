import type { AnswerRule, Field, Page } from '@fieldia/core';
import { answerRuleKinds, answerRuleMust, answerRuleSentence, kindsFitting, pageRules, ruleAsks } from './rules-words';

/** Every rule as a sentence a person reads, and which rules fit which fields. */

const fields: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  email: { type: 'char', label: 'Email' },
  age: { type: 'integer', label: 'Age' },
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total', compute: 'price * qty' },
  kind: { type: 'char', label: 'Kind', setWhen: [{ when: 'qty > 10', value: "'bulk'" }] },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
  vip: { type: 'boolean', label: 'VIP' },
  topics: { type: 'selection', label: 'Topics', multiple: true, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  born: { type: 'date', label: 'Born' },
  notes: { type: 'text', label: 'Notes' },
};

const page: Page = {
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'record', model: 'order' },
  fields,
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section',
        id: 's1',
        title: 'Order',
        invisible: "state != 'active'",
        children: [
          { type: 'field', id: 'n', field: 'name', validate: [{ minLength: 2 }] },
          { type: 'field', id: 'e', field: 'email', label: 'Work email', validate: [{ endsWith: '@acme.com', level: 'warning', when: 'vip == True' }] },
          { type: 'field', id: 'p', field: 'price' },
          { type: 'field', id: 'q', field: 'qty', required: "state == 'active'", readonly: 'vip == True' },
          { type: 'field', id: 't', field: 'total' },
          { type: 'field', id: 'k', field: 'kind', invisible: 'qty > 100' },
          { type: 'field', id: 's', field: 'state' },
          { type: 'field', id: 'v', field: 'vip' },
        ],
      },
    ],
  },
};

const say = (rule: AnswerRule) => answerRuleSentence(page, rule);

describe('an answer rule as a sentence', () => {
  it('reads each ask the way a person says it', () => {
    expect(say({ minLength: 2 })).toBe('At least 2 letters');
    expect(say({ minLength: 1 })).toBe('At least 1 letter');
    expect(say({ maxLength: 40 })).toBe('At most 40 letters');
    expect(say({ minLength: 2, maxLength: 40 })).toBe('Between 2 and 40 letters');
    expect(say({ minLength: 5, maxLength: 5 })).toBe('Exactly 5 letters');
    expect(say({ endsWith: '@acme.com' })).toBe('Ends with @acme.com');
    expect(say({ min: 1, max: 10 })).toBe('Between 1 and 10');
    expect(say({ min: 18 })).toBe('At least 18');
    expect(say({ max: 99 })).toBe('At most 99');
    expect(say({ atLeast: 2 })).toBe('Tick at least 2');
    expect(say({ atMost: 3 })).toBe('Tick at most 3');
    expect(say({ atLeast: 1, atMost: 3 })).toBe('Tick between 1 and 3');
    expect(say({ date: 'past' })).toBe('A date in the past');
    expect(say({ date: 'future' })).toBe('A date in the future');
    expect(say({ pattern: '[A-Za-z ]+' })).toBe('Letters only');
    expect(say({ pattern: '\\d+' })).toBe('Digits only');
    expect(say({ pattern: '^[A-Z]' })).toBe('Matches the pattern ^[A-Z]');
  });

  it('joins several asks, and says when it only warns, and when it holds', () => {
    expect(say({ minLength: 2, endsWith: '.com' })).toBe('At least 2 letters, ends with .com');
    expect(say({ endsWith: '@acme.com', level: 'warning' })).toBe('Ends with @acme.com — only warns');
    expect(say({ minLength: 2, when: "state == 'active'" })).toBe('At least 2 letters — only when Status is Active');
    expect(say({ minLength: 2, level: 'warning', when: 'vip == True' })).toBe('At least 2 letters — only warns, only when VIP is Yes');
  });

  it('says what it must be, for the words before publishing', () => {
    expect(answerRuleMust(page, { endsWith: '@acme.com', level: 'warning' })).toBe('Must end with @acme.com (only warns)');
    expect(answerRuleMust(page, { minLength: 2, maxLength: 40 })).toBe('Must be between 2 and 40 letters');
    expect(answerRuleMust(page, { min: 1, max: 10 })).toBe('Must be between 1 and 10');
    expect(answerRuleMust(page, { atLeast: 2 })).toBe('Must tick at least 2');
    expect(answerRuleMust(page, { date: 'past' })).toBe('Must be a date in the past');
    expect(answerRuleMust(page, { pattern: '[A-Za-z ]+' })).toBe('Must be letters only');
    expect(answerRuleMust(page, { pattern: 'x+', when: 'vip == True' })).toBe('Must match the pattern x+ (only when VIP is Yes)');
  });

  it('knows a rule that asks for nothing', () => {
    expect(ruleAsks({ message: 'Hm' })).toEqual([]);
    expect(ruleAsks({ minLength: 2, endsWith: 'x', level: 'warning' })).toEqual(['minLength', 'endsWith']);
  });
});

describe('the rules that fit a field', () => {
  it('offers lengths, endings and patterns for text, a range for numbers, ticks for several, the past or future for dates', () => {
    const ids = (field: Field) => kindsFitting(field).map((k) => k.id);
    expect(ids(fields['name'])).toEqual(['length', 'ending', 'pattern']);
    expect(ids(fields['notes'])).toEqual(['length', 'ending', 'pattern']);
    expect(ids(fields['age'])).toEqual(['range']);
    expect(ids(fields['topics'])).toEqual(['count']);
    expect(ids(fields['born'])).toEqual(['past', 'future']);
    expect(ids(fields['state'])).toEqual([]);
    expect(ids(fields['vip'])).toEqual([]);
  });

  it('starts each kind with a rule that reads', () => {
    for (const kind of answerRuleKinds()) expect(say(kind.start)).not.toBe('');
  });
});

describe('every rule on the page', () => {
  it('lists each as a sentence, by the part it acts on', () => {
    const rules = pageRules(page).map((r) => `${r.kind} · ${r.name} · ${r.sentence}`);
    expect(rules).toEqual([
      'shows · Order · Shows when Status is Active',
      'answer · Name · At least 2 letters',
      'answer · Work email · Ends with @acme.com — only warns, only when VIP is Yes',
      'required · Quantity · Required when Status is Active',
      'readonly · Quantity · Read-only when VIP is Yes',
      'compute · Total · Worked out from Price × Quantity',
      'shows · Kind · Hidden when Quantity > 100',
      'set · Kind · Set to “bulk” when Quantity > 10',
    ]);
  });

  it('says which fields each reads, and where it is', () => {
    const total = pageRules(page).find((r) => r.kind === 'compute');
    expect(total).toMatchObject({ part: 't', field: 'total', reads: ['price', 'qty'] });
    const email = pageRules(page).find((r) => r.kind === 'answer' && r.part === 'e');
    expect(email).toMatchObject({ index: 0, reads: ['vip'] });
  });
});
