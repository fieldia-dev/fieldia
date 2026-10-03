import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { branchMap } from './branch-map';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** A survey's pages and where each answer leads: every page on one line, a page shown only for some answers branching off it and back. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

/** About you · Using it · (Yes) Your experience · (No) What stops you · Last thing. */
function branching() {
  const designer = createDesigner({ page: blankPage('survey', 'Product feedback') });
  const steps = () => (designer.getPage().layout as WizardNode).children;
  designer.renameContainer(steps()[0].id, 'About you');
  designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Your name' });
  const using = designer.addContainer('Using it') as string;
  const uses = designer.addQuestion('yes-no', { parent: using }) as string;
  designer.updateQuestion(uses, { label: 'Do you use it?' });
  const field = (steps()[1].children[0] as FieldNode).field;
  const yes = designer.addContainer('Your experience') as string;
  designer.setCondition(yes, { field, equals: true });
  const no = designer.addContainer('What stops you') as string;
  designer.setCondition(no, { field, equals: false });
  const last = designer.addContainer('Last thing') as string;
  designer.select(null);
  return { designer, using, yes, no, last };
}

describe('the branch map', () => {
  it('puts every page on the line, a page for some answers off it, labelled with them', () => {
    const { designer } = branching();
    const map = branchMap(designer.getPage());
    expect(map.nodes.map((n) => [n.label, n.lane, n.when ?? '', n.answer ?? ''])).toEqual([
      ['About you', 0, '', ''],
      ['Using it', 0, '', ''],
      ['Your experience', 1, 'Do you use it? is Yes', 'Yes'],
      ['What stops you', 1, 'Do you use it? is No', 'No'],
      ['Last thing', 0, '', ''],
    ]);
    // Left to right, one column a page.
    expect(map.nodes.map((n) => n.column)).toEqual([0, 1, 2, 3, 4]);
  });

  it('says an answer it is not, and how many rules when there are several', () => {
    const { designer, yes, no } = branching();
    const field = ((designer.getPage().layout as WizardNode).children[1].children[0] as FieldNode).field;
    designer.setCondition(yes, { join: 'all', rules: [{ field, op: 'is not', value: false }] });
    designer.setCondition(no, { join: 'any', rules: [{ field, op: 'is', value: false }, { field, op: 'is not', value: true }] });
    const map = branchMap(designer.getPage());
    expect(map.nodes.find((n) => n.id === yes)?.answer).toBe('not No');
    expect(map.nodes.find((n) => n.id === no)?.answer).toBe('2 rules');
    expect(map.nodes.find((n) => n.id === no)?.when).toBe('Do you use it? is No or Do you use it? is not Yes');
  });

  it('says a rule of several, and one written by hand', () => {
    const { designer, yes, no } = branching();
    const page = designer.getPage() as Page;
    const steps = (page.layout as WizardNode).children;
    steps.find((s) => s.id === no)!.invisible = 'not (x)';
    const map = branchMap(page);
    expect(map.nodes.find((n) => n.id === no)?.when).toBe('a rule written by hand');
    expect(map.nodes.find((n) => n.id === yes)?.when).toBe('Do you use it? is Yes');
  });

  it('draws above the questions, a page picked from it opening that page', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const { designer, yes } = branching();
    handle = mountSurveyEditor(host, { designer });
    const map = host.querySelector('.fd-branch-map svg') as SVGElement;
    expect(map.getAttribute('role')).toBe('img');
    expect([...map.querySelectorAll('[data-pick] .fd-branch-title')].map((t) => t.textContent)).toEqual(['About you', 'Using it', 'Your experience', 'What stops you', 'Last thing']);
    // The answer on the branch; the whole rule on hover and for a screen reader.
    expect([...map.querySelectorAll('.fd-branch-when')].map((t) => t.textContent)).toEqual(['Yes', 'No']);
    expect([...map.querySelectorAll('.fd-branch-label title')].map((t) => t.textContent)).toEqual(['Only when Do you use it? is Yes', 'Only when Do you use it? is No']);
    expect(map.querySelector(`[data-pick="${yes}"]`)?.getAttribute('aria-label')).toBe('Your experience, only when Do you use it? is Yes');
    (map.querySelector(`[data-pick="${yes}"]`) as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(designer.getState().selected).toBe(yes);
    expect(host.querySelector(`.fd-branch-map [data-pick="${yes}"]`)?.classList.contains('fd-picked')).toBe(true);
    // Renamed, the map follows.
    designer.renameContainer(yes, 'How it goes');
    expect(host.querySelector(`.fd-branch-map [data-pick="${yes}"] .fd-branch-title`)?.textContent).toBe('How it goes');
  });

  it('is left out while the survey is one page', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountSurveyEditor(host, { designer: createDesigner({ page: blankPage('survey', 'Quick') }) });
    expect((host.querySelector('.fd-branch-map') as HTMLElement).hidden).toBe(true);
  });
});
