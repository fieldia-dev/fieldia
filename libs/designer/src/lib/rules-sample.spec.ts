import type { AnswerRule, Field, FieldNode, Page, SectionNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { button, choose, field, mount, openTab, type } from './test-editor';

/**
 * Try a value: under a field's answer rules, the field drawn by its own
 * widget, and what the form would say of what is typed in it — "Passes", the
 * message of a rule that stops sending, a warning's that still sends — said
 * by the form's own checks. A rule across fields gives the field it reads a
 * box of its own. Nothing typed here is kept in the page, or undone.
 */

const fields: Record<string, Field> = {
  email: { type: 'char', label: 'Email' },
  age: { type: 'integer', label: 'Age' },
  starts: { type: 'date', label: 'Starts' },
  ends: { type: 'date', label: 'Ends' },
  total: { type: 'float', label: 'Total', compute: 'age * 2' },
  vip: { type: 'boolean', label: 'VIP' },
};

function screen(pick: string, rules: Record<string, AnswerRule[]> = {}, extra: Partial<Page> = {}) {
  const page = { ...blankPage('screen', 'Sign up'), ...extra };
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name, ...(rules[name] ? { validate: rules[name] } : {}) }));
  page.fields = JSON.parse(JSON.stringify(fields));
  const designer = createDesigner({ page });
  designer.select(`f-${pick}`);
  const { host } = mount(designer, { mode: 'advanced' });
  openTab(host, 'Rules');
  const panel = () => host.querySelector('.fd-properties') as HTMLElement;
  const sample = () => panel().querySelector('.fd-answer-sample') as HTMLElement;
  /** The sample's box for a field, as a person finds it: by its label. */
  const box = (label: string) => {
    const wrap = [...sample().querySelectorAll<HTMLElement>('.fd-answer-sample-field')].find((w) => w.querySelector('.fd-label')?.textContent === label);
    return wrap?.querySelector('input, select, textarea') as HTMLInputElement | undefined;
  };
  const results = () => [...sample().querySelectorAll<HTMLElement>('.fd-answer-sample-result')].map((r) => `${r.dataset['level']}: ${r.querySelector('.fd-answer-sample-message')?.textContent}`);
  return { designer, host, panel, sample, box, results };
}

describe('try a value beside the answer rules', () => {
  it('shows no sample for a field with no rules: Add a rule is the invitation', () => {
    const { sample, panel } = screen('email');
    expect(button(panel(), 'Add a rule')).toBeDefined();
    expect(sample() === null || sample().closest('[hidden]') !== null).toBe(true);
  });

  it('draws the field by its own widget, and says Passes or the stopping rule’s message', () => {
    const { sample, box, results } = screen('email', { email: [{ minLength: 3, message: 'Too short' }] });
    expect(sample().closest('[hidden]')).toBeNull();
    expect(sample().getAttribute('role')).toBe('group');
    expect(document.getElementById(sample().getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Try a value');
    // Before anything is typed: what to do, not a verdict.
    expect(results()).toEqual(['idle: Type or pick an answer to see what the form says.']);
    type(box('Email'), 'ab');
    expect(results()).toEqual(['error: Too short']);
    expect(box('Email')?.getAttribute('aria-invalid')).toBe('true');
    type(box('Email'), 'abcd');
    expect(results()).toEqual(['pass: Passes']);
    expect(sample().querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('says a warning, marked as still sending', () => {
    const { sample, box, results } = screen('email', { email: [{ endsWith: '@acme.com', level: 'warning', message: 'Use your work address' }] });
    type(box('Email'), 'sara@gmail.com');
    expect(results()).toEqual(['warning: Use your work address']);
    expect(sample().querySelector('[data-level="warning"] .fd-answer-sample-tag')?.textContent).toBe('Still sends');
    expect(box('Email')?.getAttribute('aria-invalid')).toBe('false');
  });

  it('says every rule that speaks, in the rules’ order, with the form’s own words when a rule has none', () => {
    const { box, results } = screen('email', { email: [{ minLength: 5 }, { pattern: '[a-z@.]+', message: 'Small letters only' }, { endsWith: '@acme.com', level: 'warning', message: 'Use your work address' }] });
    type(box('Email'), 'A@b');
    expect(results()).toEqual(['error: Email must be at least 5 characters', 'error: Small letters only', 'warning: Use your work address']);
  });

  it('a number by its number box, its range checked', () => {
    const { box, results } = screen('age', { age: [{ min: 18, max: 99 }] });
    type(box('Age'), '12');
    expect(results()).toEqual(['error: Age must be at least 18']);
    type(box('Age'), '30');
    expect(results()).toEqual(['pass: Passes']);
  });

  it('runs again when a rule is edited, added or removed', () => {
    const { designer, panel, box, results } = screen('email', { email: [{ minLength: 2 }] });
    type(box('Email'), 'abc');
    expect(results()).toEqual(['pass: Passes']);
    (panel().querySelector('.fd-answer-rule-say') as HTMLButtonElement).click();
    type(field(panel(), 'Shortest'), '5');
    expect(results()).toEqual(['error: Email must be at least 5 characters']);
    type(field(panel(), 'Message when it does not fit'), 'Five at least');
    expect(results()).toEqual(['error: Five at least']);
    designer.addAnswerRule('f-email', { endsWith: '.org', level: 'warning' });
    expect(results()).toEqual(['error: Five at least', 'warning: Email must end with .org']);
    designer.removeAnswerRule('f-email', 0);
    expect(results()).toEqual(['warning: Email must end with .org']);
    // What was typed is still there.
    expect(box('Email')?.value).toBe('abc');
  });

  it('gives a field a rule across fields reads a box of its own, labelled by its label', () => {
    const { sample, box, results } = screen('ends', { ends: [{ holds: 'ends > starts', message: 'Ends after it starts' }] });
    expect(sample().querySelector('.fd-answer-sample-reads')?.textContent).toBe('The rules also read');
    expect(box('Starts')).toBeDefined();
    type(box('Ends'), '2026-01-10');
    // Starts not filled in yet: the rule waits, as the form's does.
    expect(results()).toEqual(['pass: Passes']);
    type(box('Starts'), '2026-02-01');
    expect(results()).toEqual(['error: Ends after it starts']);
    type(box('Starts'), '2026-01-01');
    expect(results()).toEqual(['pass: Passes']);
  });

  it('gives the field a rule’s condition reads a box too, so the rule can be made to apply', () => {
    const { box, results } = screen('email', { email: [{ minLength: 5, when: 'vip == True' }] });
    type(box('Email'), 'ab');
    expect(results()).toEqual(['pass: Passes']);
    const vip = box('VIP') as HTMLInputElement;
    expect(vip).toBeDefined();
    vip.click();
    expect(results()).toEqual(['error: Email must be at least 5 characters']);
  });

  it('says in words which field a rule reads that cannot be tried here, and offers Try it', () => {
    const { sample, box, host } = screen('age', { age: [{ holds: 'age < total', message: 'Less than the total' }] });
    expect(box('Total')).toBeUndefined();
    const elsewhere = sample().querySelector('.fd-answer-sample-elsewhere') as HTMLElement;
    expect(elsewhere.textContent).toContain('Also reads Total, worked out from other answers: try it with the whole form.');
    (button(elsewhere, 'Try it') as HTMLButtonElement).click();
    expect((host.querySelector('.fd-try') as HTMLElement).hidden).toBe(false);
  });

  it('keeps nothing in the page and makes no undo step; lasts while the field stays picked', () => {
    const { designer, host, box, results } = screen('email', { email: [{ minLength: 3 }] });
    const before = JSON.stringify(designer.getPage());
    type(box('Email'), 'ab');
    expect(results()).toEqual(['error: Email must be at least 3 characters']);
    expect(JSON.stringify(designer.getPage())).toBe(before);
    expect(designer.getState().canUndo).toBe(false);
    // Another edit redraws the panel: the sample's value stays.
    designer.updateQuestion('f-email', { label: 'Work email' });
    expect(box('Work email')?.value).toBe('ab');
    // Another field picked and this one again: a fresh sample.
    designer.select('f-age');
    designer.select('f-email');
    openTab(host, 'Rules');
    expect(box('Work email')?.value).toBe('');
  });

  it('says the messages in the language picked, right to left where it is written so', () => {
    const translations = { ar: { 'Too short': 'قصير جدا', Email: 'البريد' } };
    const { sample, box, results, panel } = screen('email', { email: [{ minLength: 3, message: 'Too short' }, { maxLength: 5 }] }, { translations });
    const words = field(panel(), 'Words in') as HTMLSelectElement;
    expect([...words.options].map((o) => o.textContent)).toEqual(['English, as written', 'Arabic']);
    choose(words, 'ar');
    type(box('البريد'), 'ab');
    expect(results()).toEqual(['error: قصير جدا']);
    const message = sample().querySelector('.fd-answer-sample-message') as HTMLElement;
    expect(message.getAttribute('lang')).toBe('ar');
    expect(message.getAttribute('dir')).toBe('rtl');
    type(box('البريد'), 'abcdefg');
    expect(results()[0]).toMatch(/^error: .*5/);
    expect(results()[0]).not.toContain('Maximum');
  });

  it('hides Words in when the page keeps no other language', () => {
    const { panel } = screen('email', { email: [{ minLength: 3 }] });
    expect(field(panel(), 'Words in')).toBeUndefined();
  });
});

describe('try a value in a survey card', () => {
  let handle: SurveyEditorHandle | null = null;
  afterEach(() => {
    handle?.destroy();
    handle = null;
  });

  it('tries the question’s rules in its open card, and forgets the value once the card closes', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage('survey', 'Sign up') });
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: 'Your name' });
    handle = mountSurveyEditor(host, { designer });
    designer.select(id);
    designer.addAnswerRule(id, { minLength: 2, message: 'Two letters at least' });
    const card = () => host.querySelector('.fd-q-selected') as HTMLElement;
    const sample = () => card().querySelector('.fd-answer-sample') as HTMLElement;
    const input = () => sample().querySelector('.fd-answer-sample-field input') as HTMLInputElement;
    const before = JSON.stringify(designer.getPage());
    type(input(), 'A');
    expect(sample().querySelector('.fd-answer-sample-result')?.textContent).toContain('Two letters at least');
    const node = (designer.getPage().layout as WizardNode).children[0].children[0] as FieldNode;
    expect(node.validate).toEqual([{ minLength: 2, message: 'Two letters at least' }]);
    expect(JSON.stringify(designer.getPage())).toBe(before);
    designer.select(null);
    designer.select(id);
    expect(input().value).toBe('');
  });
});
