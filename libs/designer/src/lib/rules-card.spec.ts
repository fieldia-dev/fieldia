import type { FieldNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** A survey question's rules, from its card: ⋮ → Answer rules, then the same list and settings as the panel's. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function survey(kind: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page: blankPage('survey', 'Sign up') });
  const id = designer.addQuestion(kind) as string;
  designer.updateQuestion(id, { label: 'Email' });
  handle = mountSurveyEditor(host, { designer });
  designer.select(id);
  const card = () => host.querySelector('.fd-q-selected') as HTMLElement;
  const node = () => (designer.getPage().layout as WizardNode).children[0].children[0] as FieldNode;
  const more = () => (card().querySelector('[aria-label="More options"]') as HTMLButtonElement).click();
  const item = (words: string) => [...document.querySelectorAll<HTMLElement>('.fd-menu [role^="menuitem"]')].find((i) => i.textContent?.trim() === words);
  return { host, designer, card, node, more, item };
}

describe('a survey card’s answer rules', () => {
  it('opens from ⋮, and adds a rule that fits', () => {
    const { card, node, more, item } = survey('email');
    expect((card().querySelector('.fd-q-rules') as HTMLElement).hidden).toBe(true);
    more();
    (item('Answer rules') as HTMLElement).click();
    expect((card().querySelector('.fd-q-rules') as HTMLElement).hidden).toBe(false);
    expect(document.activeElement?.textContent).toBe('Add a rule');
    (document.activeElement as HTMLButtonElement).click();
    ([...document.querySelectorAll<HTMLButtonElement>('.fd-menu .fd-menu-item')].find((b) => b.textContent === 'An ending') as HTMLButtonElement).click();
    expect(node().validate).toEqual([{ endsWith: '.com' }]);
    expect([...card().querySelectorAll('.fd-answer-rule-say')].map((b) => b.textContent)).toEqual(['Ends with .com']);
  });

  it('shows the rules a question has, and says so in ⋮', () => {
    const { card, designer, node, more, item } = survey('short-answer');
    designer.addAnswerRule(node().id, { minLength: 2 });
    expect((card().querySelector('.fd-q-rules') as HTMLElement).hidden).toBe(false);
    more();
    expect(item('Answer rules')?.getAttribute('aria-checked')).toBe('true');
  });

  it('is not in ⋮ for a question no rule fits', () => {
    const { more, item } = survey('yes-no');
    more();
    expect(item('Answer rules')).toBeUndefined();
  });
});
