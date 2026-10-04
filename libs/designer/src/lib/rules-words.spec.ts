import type { AnswerRule, Field, Page } from '@fieldia/core';
import { answerRuleKinds, answerRuleMust, answerRuleSentence, conditionInWords, kindsFitting, pageRules, ruleAsks } from './rules-words';

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

  it('says what each ask alone must be, and several asks and notes together', () => {
    const must = (rule: AnswerRule) => answerRuleMust(page, rule);
    expect(must({ minLength: 2 })).toBe('Must be at least 2 letters');
    expect(must({ maxLength: 1 })).toBe('Must be at most 1 letter');
    expect(must({ min: 18 })).toBe('Must be at least 18');
    expect(must({ max: 99 })).toBe('Must be at most 99');
    expect(must({ min: 5, max: 5 })).toBe('Must be exactly 5');
    expect(must({ atLeast: 1, atMost: 3 })).toBe('Must tick between 1 and 3');
    expect(must({ atMost: 3 })).toBe('Must tick at most 3');
    expect(must({ minLength: 2, endsWith: '.com' })).toBe('Must be at least 2 letters, must end with .com');
    expect(must({ minLength: 2, level: 'warning', when: 'vip == True' })).toBe('Must be at least 2 letters (only warns, only when VIP is Yes)');
    expect(must({ message: 'Hm' })).toBe('Asks for nothing');
  });

  it('says a range of one number, a rule always or never checked, and one that asks for nothing yet', () => {
    expect(say({ min: 5, max: 5 })).toBe('Exactly 5');
    expect(say({ minLength: 2, when: true })).toBe('At least 2 letters');
    expect(say({ minLength: 2, when: false })).toBe('At least 2 letters — never checked');
    expect(say({ message: 'Hm' })).toBe('Asks for nothing yet');
  });

  it('knows a rule that asks for nothing', () => {
    expect(ruleAsks({ message: 'Hm' })).toEqual([]);
    expect(ruleAsks({ minLength: 2, endsWith: 'x', level: 'warning' })).toEqual(['minLength', 'endsWith']);
  });
});

describe('the rules that fit a field', () => {
  it('offers lengths, endings and patterns for text, a range for numbers, ticks for several, the past or future for dates', () => {
    const ids = (field: Field) => kindsFitting(field).map((k) => k.id);
    expect(ids(fields['name'])).toEqual(['length', 'ending', 'pattern', 'across']);
    expect(ids(fields['notes'])).toEqual(['length', 'ending', 'pattern', 'across']);
    expect(ids(fields['age'])).toEqual(['range', 'across']);
    expect(ids(fields['topics'])).toEqual(['count']);
    expect(ids(fields['born'])).toEqual(['past', 'future', 'across']);
    expect(ids(fields['state'])).toEqual([]);
    expect(ids(fields['vip'])).toEqual([]);
  });

  it('starts each kind with a rule that reads; a rule across fields starts empty, kept once its formula reads', () => {
    for (const kind of answerRuleKinds()) if (kind.start) expect(say(kind.start)).not.toBe('');
    expect(answerRuleKinds().filter((kind) => !kind.start).map((kind) => kind.id)).toEqual(['across']);
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

describe('a condition in words', () => {
  it('joins its parts with and, or with or', () => {
    const rules = [{ field: 'vip', op: 'is' as const, value: true }, { field: 'state', op: 'is not' as const, value: 'draft' }];
    expect(conditionInWords(page, { join: 'all', rules })).toBe('VIP is Yes and Status is not Draft');
    expect(conditionInWords(page, { join: 'any', rules })).toBe('VIP is Yes or Status is not Draft');
  });
});

describe('every rule of other kinds of page', () => {
  const base = (layout: Page['layout'], kind: 'record' | 'responses' = 'record'): Page => ({
    fieldia: '0.1',
    id: 'p',
    data: kind === 'record' ? { kind, model: 'x' } : { kind },
    fields: { name: fields['name'], state: fields['state'], vip: fields['vip'] },
    layout,
  });

  it('names a survey’s pages, an untitled one too', () => {
    const survey = base(
      {
        type: 'wizard',
        id: 'w',
        children: [
          { type: 'step', id: 'p1', label: 'About', children: [{ type: 'field', id: 'v', field: 'vip' }] },
          { type: 'step', id: 'p2', label: '', invisible: 'vip != True', children: [] },
          { type: 'step', id: 'p3', label: 'Travel', invisible: 'vip == True', children: [] },
        ],
      },
      'responses'
    );
    expect(pageRules(survey).map((r) => `${r.part} · ${r.name} · ${r.sentence}`)).toEqual(['p2 · Untitled page · Shows when VIP is Yes', 'p3 · Travel · Shows when VIP is not Yes']);
  });

  it('reads a sheet’s header, a group read-only by a rule, and a part always hidden', () => {
    const sheet = base({
      type: 'sheet',
      id: 'sheet',
      buttons: [{ type: 'button', id: 'b-confirm', label: 'Confirm', action: 'confirm', invisible: "state != 'draft'" }],
      badges: [{ id: 'badge-vip', label: 'VIP', invisible: 'vip != True' }],
      // A field always required, as the model has it, has no rule to list.
      children: [{ type: 'section', id: 's1', title: 'Order', readonly: 'vip == True', children: [{ type: 'field', id: 'n', field: 'name', invisible: true }, { type: 'field', id: 'v', field: 'vip', required: true }] }],
    });
    expect(pageRules(sheet).map((r) => `${r.kind} · ${r.part} · ${r.name} · ${r.sentence}`)).toEqual([
      'shows · b-confirm · Confirm · Shows when Status is Draft',
      'shows · badge-vip · VIP · Shows when VIP is Yes',
      'readonly · s1 · Order · Read-only when VIP is Yes',
      'shows · n · Name · Always hidden',
    ]);
  });

  it('finds none on a list', () => {
    expect(pageRules(base({ type: 'list', id: 'l', columns: ['name'] }))).toEqual([]);
  });
});
