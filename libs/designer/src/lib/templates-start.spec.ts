import type { Page } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { isBlank, SCREEN_TEMPLATES, type PageTemplate } from './templates';

/**
 * The empty state: a blank survey or screen offers templates to start from,
 * each a button with its title, what it is for and its first questions;
 * picking one is one edit, said aloud with Undo beside it; Start blank puts
 * the offer away, and so does the first part added.
 */

let surveyHandle: SurveyEditorHandle | null = null;
let screenHandle: ScreenEditorHandle | null = null;
afterEach(() => {
  surveyHandle?.destroy();
  screenHandle?.destroy();
  surveyHandle = screenHandle = null;
  document.body.replaceChildren();
});

function host() {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}
function survey(options: { page?: Page; templates?: PageTemplate[]; designerTemplates?: PageTemplate[] } = {}) {
  const designer = createDesigner({ page: options.page ?? blankPage('survey', 'Untitled form'), templates: options.designerTemplates });
  const root = host();
  surveyHandle = mountSurveyEditor(root, { designer, templates: options.templates });
  return { root, designer };
}
function screen(page: Page = blankPage('screen', 'Supplier')) {
  const designer = createDesigner({ page });
  const root = host();
  screenHandle = mountScreenEditor(root, { designer });
  return { root, designer };
}

const shown = (element: Element | null | undefined) => !!element && !element.closest('[hidden]');
const start = (root: Element) => root.querySelector<HTMLElement>('.fd-start');
const cards = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>('.fd-start-card')];
const card = (root: Element, title: string) => cards(root).find((c) => c.querySelector('.fd-start-card-title')?.textContent === title) as HTMLButtonElement;
const done = (root: Element) => root.querySelector<HTMLElement>('.fd-start-done');
const button = (scope: Element, name: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => shown(b) && (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
const labels = (designer: Designer) => Object.values(designer.getPage().fields).map((f) => f.label);

describe('a blank survey', () => {
  it('offers templates to start from, each with what it is for and its first questions', () => {
    const { root } = survey();
    const region = start(root) as HTMLElement;
    expect(shown(region)).toBe(true);
    const heading = region.querySelector(`#${region.getAttribute('aria-labelledby')}`);
    expect(heading?.textContent).toBe('Start from a template');
    expect(cards(root).map((c) => c.querySelector('.fd-start-card-title')?.textContent)).toEqual(['Feedback', 'Event registration', 'Job application']);
    const feedback = card(root, 'Feedback');
    expect(document.getElementById(feedback.getAttribute('aria-describedby') ?? '')?.textContent).toBe('How it went, and what to do better, in two minutes.');
    // Its first questions, each with its kind's picture, and how many more.
    const preview = feedback.querySelector('.fd-start-preview') as HTMLElement;
    expect(preview.getAttribute('aria-hidden')).toBe('true');
    expect([...preview.querySelectorAll('.fd-start-preview-row')].map((r) => r.textContent)).toEqual(['How was it overall?', 'What did you like most?', 'What could we do better?']);
    expect(preview.querySelectorAll('.fd-start-preview-row svg')).toHaveLength(3);
    expect(preview.querySelector('.fd-start-preview-more')?.textContent).toBe('and 2 more');
    expect(region.querySelector('ul')?.getAttribute('role')).toBe('list');
    expect(button(region, 'Start blank')).toBeDefined();
  });

  it('starts from the one picked, as one edit said aloud, with Undo beside it', () => {
    const { root, designer } = survey();
    card(root, 'Event registration').click();
    expect(labels(designer)).toContain('Which sessions will you join?');
    expect(designer.getPage().title).toBe('Event registration');
    expect(shown(start(root))).toBe(false);
    const notice = done(root) as HTMLElement;
    expect(shown(notice)).toBe(true);
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.querySelector('.fd-start-done-words')?.textContent).toBe('Started from the template “Event registration”.');
    expect(document.activeElement).toBe(notice);
    // Its cards are drawn.
    expect(root.querySelectorAll('.fd-q')).toHaveLength(7);
    // Undo takes it back in one step: the offer is there again, the first template ready for the keyboard.
    button(notice, 'Undo')?.click();
    expect(isBlank(designer.getPage())).toBe(true);
    expect(designer.getState().canUndo).toBe(false);
    expect(shown(done(root))).toBe(false);
    expect(shown(start(root))).toBe(true);
    expect(document.activeElement).toBe(cards(root)[0]);
    card(root, 'Job application').click();
    expect(labels(designer)).toContain('Your CV');
    expect(labels(designer)).not.toContain('Which sessions will you join?');
  });

  it('puts the notice away once something else is edited, so its Undo never takes back another edit', () => {
    const { root, designer } = survey();
    card(root, 'Feedback').click();
    expect(shown(done(root))).toBe(true);
    designer.setPageInfo({ title: 'Course feedback' });
    expect(shown(done(root))).toBe(false);
  });

  it('puts the offer away for Start blank, the cursor going to add a question, and keeps it away', () => {
    const { root, designer } = survey();
    button(start(root) as HTMLElement, 'Start blank')?.click();
    expect(shown(start(root))).toBe(false);
    expect((document.activeElement as HTMLElement).classList.contains('fd-add-question')).toBe(true);
    const id = designer.addQuestion('short-answer') as string;
    designer.removeNode(id);
    expect(isBlank(designer.getPage())).toBe(true);
    expect(shown(start(root))).toBe(false);
  });

  it('puts the offer away once a question is added', () => {
    const { root } = survey();
    (root.querySelector('[data-tool="kind:short-answer"]') as HTMLButtonElement).click();
    expect(shown(start(root))).toBe(false);
    expect(shown(done(root))).toBe(false);
  });

  it('offers nothing on a survey that has questions', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    designer.addQuestion('short-answer');
    const { root } = survey({ page: designer.getPage() });
    expect(shown(start(root))).toBe(false);
  });

  it('offers the app’s templates after Fieldia’s: the designer’s, then the editor’s, each where it fits', () => {
    const own = (id: string, title: string, page: Page): PageTemplate => ({ id, title, description: `${title}.`, page: { ...page, id, title } });
    const quiz = createDesigner({ page: blankPage('survey', 'Quiz') });
    quiz.addQuestion('multiple-choice');
    const { root } = survey({ designerTemplates: [own('quiz', 'Quiz', quiz.getPage())], templates: [own('poll', 'Poll', quiz.getPage()), SCREEN_TEMPLATES[0]] });
    expect(cards(root).map((c) => c.querySelector('.fd-start-card-title')?.textContent)).toEqual(['Feedback', 'Event registration', 'Job application', 'Quiz', 'Poll']);
  });

  it('lists the templates in Find anything while the page is blank', () => {
    const { designer } = survey();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    const found = [...document.querySelectorAll<HTMLElement>('.fd-find-option')];
    const item = found.find((o) => o.querySelector('.fd-find-label')?.textContent === 'Start from the template “Feedback”');
    expect(item).toBeDefined();
    item?.click();
    expect(labels(designer)).toContain('How was it overall?');
  });
});

describe('a blank screen', () => {
  it('offers screens to start from, and starts from the one picked', () => {
    const { root, designer } = screen();
    expect(cards(root).map((c) => c.querySelector('.fd-start-card-title')?.textContent)).toEqual(['Contact', 'Order request']);
    card(root, 'Order request').click();
    expect(labels(designer)).toContain('Items');
    expect(designer.getPage().id).toBe('supplier');
    expect(root.querySelectorAll('.fd-canvas-field').length).toBeGreaterThan(4);
    expect(shown(start(root))).toBe(false);
  });

  it('puts the offer away for Start blank, the cursor going to the toolbox', () => {
    const { root } = screen();
    button(start(root) as HTMLElement, 'Start blank')?.click();
    expect(shown(start(root))).toBe(false);
    expect((document.activeElement as HTMLElement).classList.contains('fd-tool-find')).toBe(true);
  });

  it('offers nothing on a sheet, which starts with its title field', () => {
    const { root } = screen(blankPage('sheet', 'Customer'));
    expect(shown(start(root))).toBe(false);
  });
});
