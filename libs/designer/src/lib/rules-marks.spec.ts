import type { Field, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { mount } from './test-editor';

/**
 * Marks on the canvas: a part with a rule says so — shown only sometimes,
 * worked out, has answer rules — its sentence on pointing at it or focusing
 * it, and a click opens its rules.
 */

const fields: Record<string, Field> = {
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total', compute: 'price * qty' },
  email: { type: 'char', label: 'Email' },
  vip: { type: 'boolean', label: 'VIP' },
};

function screen() {
  const page = blankPage('screen', 'Order');
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  section.children[3] = { ...section.children[3], invisible: 'vip != True', validate: [{ endsWith: '@acme.com' }] } as never;
  page.fields = JSON.parse(JSON.stringify(fields));
  const designer = createDesigner({ page });
  const { host } = mount(designer, { mode: 'advanced' });
  const marks = (id: string) => [...host.querySelectorAll<HTMLElement>(`[data-node="${id}"] .fd-rule-mark`)];
  return { designer, host, marks };
}

describe('marks on the screen editor’s canvas', () => {
  it('marks a field worked out, shown only sometimes, or with answer rules, each saying its rule', () => {
    const { marks } = screen();
    expect(marks('f-total').map((m) => m.dataset['mark'])).toEqual(['worked-out']);
    expect(marks('f-email').map((m) => m.dataset['mark'])).toEqual(['sometimes', 'answer']);
    expect(marks('f-price')).toEqual([]);
    const [total] = marks('f-total');
    expect(total.querySelector('.fd-rule-mark-words')?.textContent).toBe('worked out');
    // A field not picked is a button itself, and a button holds no other: its marks are words, its rules its description.
    const card = (id: string) => total.ownerDocument.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;
    expect([card('f-total').getAttribute('role'), total.tagName]).toEqual(['button', 'SPAN']);
    const said = (id: string) => (card(id).getAttribute('aria-describedby') ?? '').split(' ').map((tip) => document.getElementById(tip));
    expect(said('f-total').map((tip) => tip?.getAttribute('role'))).toEqual(['tooltip']);
    expect(said('f-total').map((tip) => tip?.textContent)).toEqual(['Worked out from Price × Quantity']);
    expect(marks('f-email')[1].querySelector('.fd-rule-mark-words')?.textContent).toBe('1 rule');
    expect(said('f-email')[0]?.textContent).toBe('Shows when VIP is Yes');
    expect(card('f-email').querySelector('button')).toBeNull();
  });

  it('opens a part’s rules when its mark is clicked', () => {
    const { designer, host, marks } = screen();
    marks('f-total')[0].click();
    expect(designer.getState().selected).toBe('f-total');
    expect(host.querySelector('.fd-properties [role="tab"][aria-selected="true"]')?.textContent).toBe('Rules');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Worked out from');
  });

  it('follows the rules as they change, and leaves the picked field to its panel', () => {
    const { designer, marks } = screen();
    designer.setCompute('f-total', null);
    expect(marks('f-total')).toEqual([]);
    designer.addAnswerRule('f-email', { minLength: 3 });
    expect(marks('f-email')[1].querySelector('.fd-rule-mark-words')?.textContent).toBe('2 rules');
    designer.select('f-email');
    expect(marks('f-email')).toEqual([]);
  });

  it('marks a group shown only sometimes', () => {
    const { designer, host } = screen();
    designer.setCondition('section-1', { field: 'vip', equals: true });
    expect([...host.querySelectorAll<HTMLElement>('.fd-canvas-section[data-node="section-1"] > .fd-rule-marks .fd-rule-mark')].map((m) => m.dataset['mark'])).toEqual(['sometimes']);
  });
});

let surveyHandle: SurveyEditorHandle | null = null;
afterEach(() => {
  surveyHandle?.destroy();
  surveyHandle = null;
});

describe('marks on the survey designer’s cards', () => {
  it('marks a question with answer rules, and opens them from the mark', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event') });
    const email = designer.addQuestion('email') as string;
    designer.addAnswerRule(email, { endsWith: '.com' });
    designer.select(null);
    const host = document.createElement('div');
    document.body.append(host);
    surveyHandle = mountSurveyEditor(host, { designer });
    const mark = host.querySelector(`.fd-q[data-node="${email}"] .fd-rule-mark[data-mark="answer"]`) as HTMLButtonElement;
    expect(mark).not.toBeNull();
    mark.click();
    expect(designer.getState().selected).toBe(email);
    expect(document.activeElement).toBe(host.querySelector('.fd-q-selected .fd-answer-rule-say'));
  });
});
