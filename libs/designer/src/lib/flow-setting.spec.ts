import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab, typeAndLeave } from './test-editor';
import { mountSurveyEditor } from './survey-editor';
import type { StepNode, WizardNode } from '@fieldia/core';

/**
 * How a form of responses is gone through, as the designer sets it on its Rules tab: a review of the answers before
 * they are sent, with its own heading. A record's screen has none; each change is one undo, listed as Publish lists it.
 */

afterEach(() => document.body.replaceChildren());
const rowOf = (panel: HTMLElement, name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;

function responses() {
  const page = blankPage('screen', 'Clinic intake');
  page.data = { kind: 'responses' };
  const designer = createDesigner({ page });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  openTab(panel, 'Rules');
  return { designer, panel };
}

describe('how a form is gone through, in the designer', () => {
  it('reviews the answers before sending, in Fieldia’s words or its own heading', () => {
    const { designer, panel } = responses();
    const before = designer.getPage();
    expect(rowOf(panel, 'Review’s heading').hidden).toBe(true);
    (rowOf(panel, 'Review before sending').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().review).toBe(true);
    expect(rowOf(panel, 'Review’s heading').hidden).toBe(false);
    const heading = rowOf(panel, 'Review’s heading').querySelector('input') as HTMLInputElement;
    heading.value = 'Before you send';
    heading.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().review).toEqual({ title: 'Before you send' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('It shows every answer before it is sent');
    heading.value = '';
    heading.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().review).toBe(true);
    (rowOf(panel, 'Review before sending').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().review).toBeUndefined();
    const sheet = createDesigner({ page: blankPage('screen', 'Customer') });
    expect(sheet.setFlowOne(true)).toBe(false);
    expect(sheet.getState().issues[0]).toBe('One question at a time is for a form that collects responses, in sections or pages');
    expect(sheet.setReview({})).toBe(false);
    expect(sheet.getState().issues[0]).toBe('A review before sending is for a form that collects responses: a record is saved as it is changed');
  });

  it('asks one question at a time', () => {
    const { designer, panel } = responses();
    const before = designer.getPage();
    (rowOf(panel, 'One question at a time').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().flow).toBe('one');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('It asks one question at a time');
    (rowOf(panel, 'One question at a time').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().flow).toBeUndefined();
  });

  it('draws a page’s questions in an order of each person’s own, and how many of them each is asked, in its card', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Staff check') });
    for (let i = 0; i < 4; i++) designer.addQuestion('short-answer');
    const step = () => (designer.getPage().layout as WizardNode).children[0] as StepNode;
    const host = document.createElement('div');
    document.body.append(host);
    const survey = mountSurveyEditor(host, { designer });
    const card = host.querySelector('.fd-design-step') as HTMLElement;
    (card.querySelector('[role="switch"][aria-label="Questions in random order"]') as HTMLButtonElement).click();
    expect(step().order).toBe('random');
    typeAndLeave(card.querySelector('[aria-label="Ask"]') as HTMLInputElement, '2');
    expect(step().draw).toBe(2);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // More than it holds: refused, said; emptied, every question is asked.
    expect(designer.setDraw(step().id, { draw: 9 })).toBe(false);
    expect(designer.getState().issues[0]).toBe('Ask a whole number of its questions, from 1 to 4');
    typeAndLeave(card.querySelector('[aria-label="Ask"]') as HTMLInputElement, '');
    expect(step()).not.toHaveProperty('draw');
    // Pages drawn too: a page may keep its place.
    expect(designer.setPagesOrder(true)).toBe(true);
    expect((designer.getPage().layout as WizardNode).order).toBe('random');
    expect(designer.setDraw(step().id, { fixed: true })).toBe(true);
    expect(step().fixed).toBe(true);
    expect(pageChanges(blankPage('survey', 'Staff check'), designer.getPage())).toContain('Which questions each person is asked, or their order, changed');
    survey.destroy();
  });

  it('gives the form a time limit — its minutes, its warning, what happens as it runs out — and a page its own', () => {
    const { designer, panel } = responses();
    const before = designer.getPage();
    expect(rowOf(panel, 'Warn before the end').hidden).toBe(true);
    typeAndLeave(rowOf(panel, 'Time limit').querySelector('input') as HTMLInputElement, '20');
    expect(designer.getPage().timeLimit).toEqual({ minutes: 20 });
    expect(rowOf(panel, 'Warn before the end').hidden).toBe(false);
    typeAndLeave(rowOf(panel, 'Warn before the end').querySelector('input') as HTMLInputElement, '2');
    const then = rowOf(panel, 'When the time runs out').querySelector('select') as HTMLSelectElement;
    then.value = 'lock';
    then.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().timeLimit).toEqual({ minutes: 20, warn: 2, then: 'lock' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('Its time limits changed');
    // A warning not before the end: refused, said.
    expect(designer.setTimeLimit(null, { warn: 25 })).toBe(false);
    expect(designer.getState().issues[0]).toBe('It warns before the end: fewer minutes than the limit');
    typeAndLeave(rowOf(panel, 'Time limit').querySelector('input') as HTMLInputElement, '');
    expect(designer.getPage().timeLimit).toBeUndefined();
    // A page of a survey has its own, in its card.
    const survey = createDesigner({ page: blankPage('survey', 'Staff check') });
    const step = (survey.getPage().layout as WizardNode).children[0];
    expect(survey.setTimeLimit(step.id, { minutes: 5 })).toBe(true);
    expect(((survey.getPage().layout as WizardNode).children[0] as StepNode).timeLimit).toEqual({ minutes: 5 });
  });
});
