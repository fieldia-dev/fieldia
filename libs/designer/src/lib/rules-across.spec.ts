import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges, pageChecks } from './designer';
import { sampleHolds } from './rules-formula';
import { answerRuleKinds, answerRuleMust, answerRuleSentence, kindsFitting, pageRules } from './rules-words';
import { button, field, mount, openTab, press, type } from './test-editor';

/**
 * A rule across fields, SurveyJS's expression validator: an expression the
 * answers must keep together — Contract ends on or after Start date — said
 * in words built from labels, kept only once it reads, checked against made-up
 * values as it is typed, and named by the checks when a field it reads goes.
 */

const fields: Record<string, Field> = {
  start: { type: 'date', label: 'Start date' },
  end: { type: 'date', label: 'Contract ends' },
  paid: { type: 'monetary', label: 'Paid', currency: 'EGP' },
  total: { type: 'monetary', label: 'Total', currency: 'EGP' },
  name: { type: 'char', label: 'Name' },
  photo: { type: 'binary', label: 'Photo' },
};

function contract(): { page: Page; designer: ReturnType<typeof createDesigner>; node: (name: string) => FieldNode } {
  const page = blankPage('screen', 'Contract');
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  page.fields = JSON.parse(JSON.stringify(fields));
  const designer = createDesigner({ page });
  const node = (name: string) => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.field === name) as FieldNode;
  return { page, designer, node };
}

describe('a rule across fields, in words', () => {
  const { page } = contract();

  it('reads as “Must hold:” and the formula by its fields’ labels, ≥ and ≤ for >= and <=', () => {
    expect(answerRuleSentence(page, { holds: 'end >= start' })).toBe('Must hold: Contract ends ≥ Start date');
    expect(answerRuleSentence(page, { holds: 'paid <= total', level: 'warning' })).toBe('Must hold: Paid ≤ Total — only warns');
    expect(answerRuleMust(page, { holds: 'end >= start' })).toBe('Must hold: Contract ends ≥ Start date');
  });

  it('is offered for text, a number or a date, and not for a file or a choice', () => {
    expect(kindsFitting(fields['end']).map((k) => k.id)).toEqual(['past', 'future', 'across']);
    expect(kindsFitting(fields['name']).map((k) => k.id)).toEqual(['length', 'ending', 'pattern', 'across']);
    expect(kindsFitting(fields['photo']).map((k) => k.id)).toEqual([]);
    expect(kindsFitting({ type: 'boolean', label: 'Agreed' }).map((k) => k.id)).toEqual([]);
    const across = answerRuleKinds().find((k) => k.id === 'across');
    expect(across?.label).toBe('A rule across fields');
    // It starts empty in the editor, and is kept once its formula reads.
    expect(across?.start).toBeNull();
  });

  it('lists the fields it reads, with those its condition reads', () => {
    const { designer } = contract();
    designer.addAnswerRule('f-end', { holds: 'end >= start', when: 'total > 0' });
    expect(pageRules(designer.getPage()).find((r) => r.kind === 'answer')).toMatchObject({ part: 'f-end', reads: ['total', 'end', 'start'], sentence: 'Must hold: Contract ends ≥ Start date — only when Total > 0' });
  });
});

describe('a rule across fields, in the store', () => {
  it('is kept as one undo step, its formula on the page as written', () => {
    const { designer, node } = contract();
    expect(designer.addAnswerRule('f-end', { holds: 'end >= start', message: 'Contract ends must not be before Start date' })).toBe(true);
    expect(node('end').validate).toEqual([{ holds: 'end >= start', message: 'Contract ends must not be before Start date' }]);
    designer.undo();
    expect(node('end').validate).toBeUndefined();
  });

  it('is refused in words when its formula does not read, or reads a field the page has not got', () => {
    const { designer } = contract();
    expect(designer.addAnswerRule('f-end', { holds: 'end >= starts' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Must hold: Unknown field “starts” at 8–13']);
    expect(designer.addAnswerRule('f-end', { holds: 'end >=' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Must hold: Something is missing after “>=” at 5–6']);
    expect(designer.addAnswerRule('f-photo', { holds: 'paid <= total' })).toBe(false);
    expect(designer.getState().issues).toEqual(['“Photo” holds a file: a rule across fields does not fit it']);
  });

  it('says what changed for Publish, in the same words', () => {
    const { designer } = contract();
    const before = designer.getPage();
    designer.addAnswerRule('f-end', { holds: 'end >= start' });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Contract ends”: a rule — Must hold: Contract ends ≥ Start date']);
  });
});

describe('a rule across fields, checked', () => {
  it('is named when a field it reads is no longer on the page, and Remove the rule takes it away', () => {
    const { designer, node } = contract();
    designer.addAnswerRule('f-end', { holds: 'end >= start' });
    designer.removeNode('f-start');
    // The field it reads keeps its definition, so the rule can be seen and put right.
    expect(designer.getPage().fields['start']).toBeDefined();
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.at, c.fix?.label])).toEqual([['should', '“Contract ends”: “Must hold: Contract ends ≥ Start date” reads Start date, which is no longer on the page.', 'f-end', 'Remove the rule']]);
    expect(designer.fixCheck(checks[0])).toBe(true);
    expect(node('end').validate).toBeUndefined();
    expect(designer.getPage().fields['start']).toBeUndefined();
  });
});

describe('a rule across fields, on made-up values', () => {
  const { page } = contract();

  it('says whether it holds now, with the values it was tried on', () => {
    expect(sampleHolds(page, 'end >= start')).toBe('With Contract ends 2026-03-14 and Start date 2026-03-01: holds');
    expect(sampleHolds(page, 'end <= start')).toBe('With Contract ends 2026-03-14 and Start date 2026-03-01: does not hold');
    expect(sampleHolds(page, 'paid <= total')).toBe('With Paid 120 and Total 80: does not hold');
    expect(sampleHolds(page, 'True')).toBe('Always holds');
    expect(sampleHolds(page, 'False')).toBe('Never holds');
  });

  it('says nothing for a formula that does not read', () => {
    expect(sampleHolds(page, 'end >=')).toBe('');
    expect(sampleHolds(page, 'ends > start')).toBe('');
  });
});

describe('a rule across fields, in the panel', () => {
  function panelFor(pick: string) {
    const { designer, node } = contract();
    designer.select(`f-${pick}`);
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const panel = () => host.querySelector('.fd-properties') as HTMLElement;
    const sentences = () => [...panel().querySelectorAll('.fd-answer-rule-say')].map((b) => b.textContent);
    const add = () => {
      (button(panel(), 'Add a rule') as HTMLButtonElement).click();
      ([...document.querySelectorAll<HTMLButtonElement>('.fd-menu .fd-menu-item')].find((b) => b.textContent === 'A rule across fields') as HTMLButtonElement).click();
    };
    return { designer, node, panel, sentences, add };
  }

  it('starts with an empty formula box, and keeps the rule once what is typed reads', () => {
    const { panel, node, sentences, add } = panelFor('end');
    add();
    const box = field(panel(), 'Must hold') as HTMLInputElement;
    expect(document.activeElement).toBe(box);
    expect(node('end').validate).toBeUndefined();
    expect(sentences()).toEqual(['Must hold: …']);
    type(box, 'end >= sta');
    expect(node('end').validate).toBeUndefined();
    expect(panel().querySelector('.fd-answer-rule-across .fd-formula-problem')?.textContent).toMatch(/^Unknown field “sta”/);
    type(box, 'end >= start');
    expect(node('end').validate).toEqual([{ holds: 'end >= start' }]);
    expect(sentences()).toEqual(['Must hold: Contract ends ≥ Start date']);
    // Typing on keeps the same rule, and the same box.
    expect(field(panel(), 'Must hold')).toBe(box);
    type(box, 'end > start');
    expect(node('end').validate).toEqual([{ holds: 'end > start' }]);
  });

  it('suggests the page’s fields by their labels, as Worked out from does', () => {
    const { panel, add } = panelFor('end');
    add();
    const box = field(panel(), 'Must hold') as HTMLInputElement;
    type(box, 'st');
    box.setSelectionRange(2, 2);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const options = [...panel().querySelectorAll('.fd-answer-rule-across [role="option"] .fd-formula-suggest-label')].map((o) => o.textContent);
    expect(options).toEqual(['Start date']);
    press('Enter', {}, box);
    expect(box.value).toBe('start');
  });

  it('says live whether it holds on made-up values, and the formula in words above the box', () => {
    const { panel, add } = panelFor('end');
    add();
    type(field(panel(), 'Must hold'), 'end >= start');
    const across = panel().querySelector('.fd-answer-rule-across') as HTMLElement;
    expect(across.querySelector('.fd-formula-outcome')?.textContent).toBe('With Contract ends 2026-03-14 and Start date 2026-03-01: holds');
    expect(across.querySelector('.fd-formula-reads')?.textContent).toBe('Reads: Contract ends ≥ Start date');
    expect(across.querySelector('.fd-formula-result')?.hasAttribute('data-fails')).toBe(false);
    type(field(panel(), 'Must hold'), 'end < start');
    expect(across.querySelector('.fd-formula-outcome')?.textContent).toBe('With Contract ends 2026-03-14 and Start date 2026-03-01: does not hold');
    // Not said as a success.
    expect(across.querySelector('.fd-formula-result')?.hasAttribute('data-fails')).toBe(true);
  });

  it('takes a message, stops sending or only warns, as other rules do', () => {
    const { panel, node, designer } = panelFor('end');
    designer.addAnswerRule('f-end', { holds: 'end >= start' });
    (panel().querySelector('.fd-answer-rule-say') as HTMLButtonElement).click();
    type(field(panel(), 'Message when it does not fit'), 'Contract ends must not be before Start date');
    (button(panel(), 'Only warns') as HTMLButtonElement).click();
    expect(node('end').validate).toEqual([{ holds: 'end >= start', message: 'Contract ends must not be before Start date', level: 'warning' }]);
  });

  it('lets a rule begun go with × before it is kept, leaving the page as it was', () => {
    const { panel, node, sentences, add, designer } = panelFor('end');
    const before = designer.getPage();
    add();
    (button(panel(), 'Remove this new rule') as HTMLButtonElement).click();
    expect(sentences()).toEqual([]);
    expect(designer.getPage()).toBe(before);
    expect(node('end').validate).toBeUndefined();
  });
});
