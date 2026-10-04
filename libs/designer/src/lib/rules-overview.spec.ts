import type { Field, SectionNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { button, mount, type } from './test-editor';

/**
 * The rules overview: every rule on the page as a sentence, grouped by what
 * it does, filtered by words; a rule clicked picks its part and opens its
 * Rules tab. From the bar and from Find anything, in both editors.
 */

const fields: Record<string, Field> = {
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total', compute: 'price * qty' },
  email: { type: 'char', label: 'Email' },
  vip: { type: 'boolean', label: 'VIP' },
};

function screen(withRules = true) {
  const page = blankPage('screen', 'Order');
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  page.fields = JSON.parse(JSON.stringify(fields));
  if (!withRules) delete page.fields['total'].compute;
  else {
    section.children[3] = { ...section.children[3], invisible: 'vip != True', validate: [{ endsWith: '@acme.com', level: 'warning' }] } as never;
    section.children[1] = { ...section.children[1], required: 'vip == True' } as never;
  }
  const designer = createDesigner({ page });
  const { host } = mount(designer, { mode: 'advanced' });
  const view = () => host.querySelector('.fd-rules-view') as HTMLElement;
  const toggle = () => host.querySelector('.fd-designer-bar [data-mode="rules"]') as HTMLButtonElement;
  const groups = () =>
    [...view().querySelectorAll<HTMLElement>('.fd-rules-group')].filter((g) => !g.hidden).map((g) => [g.querySelector('.fd-rules-group-title')?.textContent, ...[...g.querySelectorAll<HTMLElement>('.fd-rules-item')].filter((i) => !i.closest('[hidden]')).map((i) => `${i.querySelector('.fd-rules-item-name')?.textContent}: ${i.querySelector('.fd-rules-item-say')?.textContent}`)]);
  return { designer, host, view, toggle, groups };
}

describe('the rules overview, in the screen editor', () => {
  it('opens from the bar in place of the editor, every rule a sentence, grouped by what it does', () => {
    const { host, view, toggle, groups } = screen();
    expect(view().hidden).toBe(true);
    toggle().click();
    expect(view().hidden).toBe(false);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(true);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(groups()).toEqual([
      ['Shows when', 'Email: Shows when VIP is Yes'],
      ['Required when', 'Quantity: Required when VIP is Yes'],
      ['Worked out from', 'Total: Worked out from Price × Quantity'],
      ['Answer rules', 'Email: Ends with @acme.com — only warns'],
    ]);
    expect(view().querySelector('.fd-rules-note')?.textContent).toBe('4 rules on this page.');
  });

  it('filters by words', () => {
    const { view, toggle, groups } = screen();
    toggle().click();
    type(view().querySelector('input[aria-label="Filter the rules"]') as HTMLInputElement, 'vip');
    expect(groups()).toEqual([
      ['Shows when', 'Email: Shows when VIP is Yes'],
      ['Required when', 'Quantity: Required when VIP is Yes'],
    ]);
    type(view().querySelector('input[aria-label="Filter the rules"]') as HTMLInputElement, 'nothing like it');
    expect(groups()).toEqual([]);
    expect(view().querySelector('.fd-rules-empty')?.textContent).toBe('No rule says “nothing like it”.');
  });

  it('goes to a rule clicked: its part picked, its Rules tab open, its setting in hand', () => {
    const { designer, host, view, toggle } = screen();
    toggle().click();
    const item = [...view().querySelectorAll<HTMLButtonElement>('.fd-rules-item')].find((i) => i.textContent?.includes('Worked out')) as HTMLButtonElement;
    item.click();
    expect(view().hidden).toBe(true);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(false);
    expect(designer.getState().selected).toBe('f-total');
    expect(host.querySelector('.fd-properties [role="tab"][aria-selected="true"]')?.textContent).toBe('Rules');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Worked out from');
  });

  it('opens an answer rule clicked', () => {
    const { host, view, toggle } = screen();
    toggle().click();
    ([...view().querySelectorAll<HTMLButtonElement>('.fd-rules-item')].find((i) => i.textContent?.includes('Ends with')) as HTMLButtonElement).click();
    const say = host.querySelector('.fd-properties .fd-answer-rule-say') as HTMLElement;
    expect(say.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(say);
  });

  it('says how to begin when there are none', () => {
    const { view, toggle } = screen(false);
    toggle().click();
    expect(view().querySelector('.fd-rules-empty')?.textContent).toBe('No rules yet: pick a field and open Rules.');
  });

  it('gives way to Translations and to Design, and comes back from Find anything', () => {
    const { host, view, toggle } = screen();
    toggle().click();
    (host.querySelector('[data-mode="translations"]') as HTMLButtonElement).click();
    expect(view().hidden).toBe(true);
    expect((host.querySelector('.fd-words') as HTMLElement).hidden).toBe(false);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(true);
    toggle().click();
    expect((host.querySelector('.fd-words') as HTMLElement).hidden).toBe(true);
    expect(view().hidden).toBe(false);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(true);
    (host.querySelector('[data-mode="design"]') as HTMLButtonElement).click();
    expect(view().hidden).toBe(true);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(false);
    expect(host.querySelector('[data-mode="design"]')?.getAttribute('aria-pressed')).toBe('true');
    // Find anything: the overview, and each rule by its words.
    (button(host, 'Find anything') ?? (host.querySelector('.fd-find-button') as HTMLButtonElement)).click();
    const labels = [...document.querySelectorAll('.fd-find-option .fd-find-label')].map((l) => l.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Rules', 'Rule: Total — Worked out from Price × Quantity']));
    ([...document.querySelectorAll<HTMLElement>('.fd-find-option')].find((o) => o.textContent?.startsWith('Rules')) as HTMLElement).click();
    expect(view().hidden).toBe(false);
  });
});

let surveyHandle: SurveyEditorHandle | null = null;
afterEach(() => {
  surveyHandle?.destroy();
  surveyHandle = null;
});

describe('the rules overview, in the survey editor', () => {
  it('lists where answers lead, and opens the question of a rule clicked', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event') });
    const coming = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(coming, { label: 'Coming?' });
    const email = designer.addQuestion('email') as string;
    designer.updateQuestion(email, { label: 'Email' });
    designer.addAnswerRule(email, { endsWith: '.com' });
    const second = designer.addContainer('Travel') as string;
    const field = ((designer.getPage().layout as WizardNode).children[0].children[0] as { field: string }).field;
    designer.setCondition(second, { field, equals: true });
    const host = document.createElement('div');
    document.body.append(host);
    surveyHandle = mountSurveyEditor(host, { designer });
    (host.querySelector('.fd-designer-bar [data-mode="rules"]') as HTMLButtonElement).click();
    const view = host.querySelector('.fd-rules-view') as HTMLElement;
    const titles = [...view.querySelectorAll<HTMLElement>('.fd-rules-group')].filter((g) => !g.hidden).map((g) => g.querySelector('.fd-rules-group-title')?.textContent);
    expect(titles).toEqual(['Where answers lead', 'Answer rules']);
    expect(view.querySelector('.fd-rules-group .fd-rules-item-say')?.textContent).toBe('Shows when Coming? is Yes');
    ([...view.querySelectorAll<HTMLButtonElement>('.fd-rules-item')].find((i) => i.textContent?.includes('Ends with')) as HTMLButtonElement).click();
    expect(designer.getState().selected).toBe(email);
    expect(host.querySelector('.fd-q-selected .fd-answer-rule-say')).toBe(document.activeElement);
  });
});
