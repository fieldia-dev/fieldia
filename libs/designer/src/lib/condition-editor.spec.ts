import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { conditionEditor } from './condition-editor';
import { blankPage, createDesigner } from './designer';

/**
 * A page's "Show this page when": its lists of questions and answers are drawn
 * again only when those questions change, so a long survey's pages are not
 * all redrawn at each key typed — and what they show is always the rule.
 */

function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'Visit') });
  const role = designer.addQuestion('multiple-choice') as string;
  designer.updateQuestion(role, { label: 'Role' });
  designer.setOptions(role, ['Developer', 'Manager']);
  const dinner = designer.addQuestion('yes-no') as string;
  designer.updateQuestion(dinner, { label: 'Dinner' });
  const name = designer.addQuestion('short-answer') as string;
  const page2 = designer.addContainer('Page 2') as string;
  return { designer, role, dinner, name, page2 };
}
const before = (page: Page) => (page.layout as WizardNode).children[0].children as FieldNode[];
const step = (page: Page, id: string) => (page.layout as WizardNode).children.find((s) => s.id === id);

describe('a page’s condition, drawn again', () => {
  it('keeps the lists it drew while the questions before it are the same', () => {
    const { designer, page2 } = survey();
    const editor = conditionEditor(elementFactory(document), designer, page2, 'page');
    const page = designer.getPage();
    editor.update(page, before(page), step(page, page2)?.invisible);
    const [field] = [...editor.element.querySelectorAll('select.fd-when-field')] as HTMLSelectElement[];
    expect([...field.options].map((o) => o.textContent)).toEqual(['Always', 'Role', 'Dinner']);
    const drawn = field.options[1];
    designer.select(null);
    const same = designer.getPage();
    editor.update(same, before(same), step(same, page2)?.invisible);
    expect(field.options[1]).toBe(drawn);
  });

  it('draws them again when a question before it is renamed, and when its rule changes', () => {
    const { designer, role, page2 } = survey();
    const editor = conditionEditor(elementFactory(document), designer, page2, 'page');
    const draw = () => {
      const page = designer.getPage();
      editor.update(page, before(page), step(page, page2)?.invisible);
    };
    draw();
    designer.updateQuestion(role, { label: 'Job' });
    draw();
    const [field] = [...editor.element.querySelectorAll('select.fd-when-field')] as HTMLSelectElement[];
    expect([...field.options].map((o) => o.textContent)).toEqual(['Always', 'Job', 'Dinner']);
    designer.setCondition(page2, { field: 'q_1', equals: 'manager' });
    draw();
    const answer = editor.element.querySelector('select.fd-when-answer') as HTMLSelectElement;
    expect(field.value).toBe('q_1');
    expect([...answer.options].map((o) => o.textContent)).toEqual(['is Developer', 'is Manager', 'is not Developer', 'is not Manager']);
    expect(answer.value).toBe('is:manager');
  });

  it('shows the rule again when a choice was not taken, though nothing else changed', () => {
    const { designer, page2 } = survey();
    designer.setCondition(page2, { field: 'q_2', equals: true });
    const editor = conditionEditor(elementFactory(document), designer, page2, 'page');
    const page = designer.getPage();
    editor.update(page, before(page), step(page, page2)?.invisible);
    const [field] = [...editor.element.querySelectorAll('select.fd-when-field')] as HTMLSelectElement[];
    expect(field.value).toBe('q_2');
    field.value = 'q_1';
    editor.update(page, before(page), step(page, page2)?.invisible);
    expect(field.value).toBe('q_2');
  });
});
