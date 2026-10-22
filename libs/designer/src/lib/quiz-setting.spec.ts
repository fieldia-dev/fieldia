import { validatePage, type Field, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { mount, openTab, typeAndLeave } from './test-editor';

/**
 * A quiz's results as the designer sets them (`quiz`): shown as the answers are sent or once reviewed, on a form of
 * responses' Rules tab, with the points a right answer earns and whether the right answers show; on each question once
 * the form is a quiz, a choice's right answers ticked, a typed one's answers named, its points and what is said when
 * right and when wrong. A record's screen has no quiz; each change is one undo, listed as Publish lists it.
 */

let survey: SurveyEditorHandle | null = null;
afterEach(() => {
  survey?.destroy();
  survey = null;
  document.body.replaceChildren();
});
const rowOf = (panel: HTMLElement, name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;

describe('a quiz in the designer', () => {
  it('is turned on on a form of responses’ Rules tab, with its points and whether the right answers show', () => {
    const page = blankPage('screen', 'Injectables check');
    page.data = { kind: 'responses' };
    const designer = createDesigner({ page });
    const before = designer.getPage();
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const shown = rowOf(panel, 'Quiz results').querySelector('select') as HTMLSelectElement;
    expect(rowOf(panel, 'Points for a right answer').hidden).toBe(true);
    shown.value = 'now';
    shown.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().quiz).toEqual({});
    expect(rowOf(panel, 'Points for a right answer').hidden).toBe(false);
    typeAndLeave(rowOf(panel, 'Points for a right answer').querySelector('input') as HTMLInputElement, '2');
    (rowOf(panel, 'Show the right answer to one missed').querySelector('input') as HTMLInputElement).click();
    shown.value = 'later';
    shown.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().quiz).toEqual({ points: 2, rightAnswers: false, results: 'later' });
    expect(pageChanges(before, designer.getPage())).toContain('It shows a quiz’s results');
    shown.value = '';
    shown.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().quiz).toBeUndefined();
    // A record's screen has none.
    const sheet = createDesigner({ page: blankPage('screen', 'Customer') });
    expect(sheet.setPageQuiz({ results: 'now' })).toBe(false);
    expect(sheet.getState().issues[0]).toBe('A quiz’s results are for a form that collects responses');
  });

  it('marks a choice’s right answers, a typed question’s answers, its points and its feedback, once the form is a quiz', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Injectables check') });
    const choice = designer.addQuestion('multiple-choice') as string;
    designer.setOptions(choice, ['Hyaluronic acid', 'Calcium hydroxylapatite']);
    const typed = designer.addQuestion('number') as string;
    designer.select(choice);
    const host = document.createElement('div');
    document.body.append(host);
    survey = mountSurveyEditor(host, { designer });
    const card = () => host.querySelector('.fd-q-selected') as HTMLElement;
    const quizBlock = () => card().querySelector('.fd-kind-quiz') as HTMLElement;
    const field = (id: string) => {
      const node = (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as { field: string };
      return designer.getPage().fields[node.field] as Field & { quiz?: unknown };
    };
    // Not a quiz yet: nothing to mark.
    expect(quizBlock().hidden).toBe(true);
    designer.setPageQuiz({});
    expect(quizBlock().hidden).toBe(false);
    (card().querySelector('[aria-label="Hyaluronic acid is a right answer"]') as HTMLInputElement).click();
    expect((field(choice) as Extract<Field, { type: 'selection' }>).options.map((o) => o.correct)).toEqual([true, undefined]);
    typeAndLeave(card().querySelector('[aria-label="Points for a right answer to this question"]') as HTMLInputElement, '3');
    const wrong = card().querySelector('[aria-label="Said when wrong"]') as HTMLInputElement;
    wrong.value = 'Only hyaluronic acid can be dissolved.';
    wrong.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field(choice).quiz).toEqual({ points: 3, feedback: { wrong: 'Only hyaluronic acid can be dissolved.' } });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // A number names the answers it takes, as numbers; words are refused there, said.
    expect(designer.setQuizQuestion(typed, { answers: [30] })).toBe(true);
    expect(field(typed).quiz).toEqual({ answers: [30] });
    expect(designer.setQuizQuestion(typed, { answers: ['thirty'] })).toBe(false);
    expect(designer.getState().issues[0]).toBe('A number’s answers are numbers, such as 20 or 2.5');
    expect(designer.setQuizQuestion(typed, { answers: null })).toBe(true);
    expect(field(typed)).not.toHaveProperty('quiz');
    // A matrix's columns are no right answers.
    const matrix = designer.addQuestion('matrix') as string;
    expect(designer.setOptionDetails(matrix, 0, { correct: true })).toBe(false);
    expect(designer.getState().issues[0]).toBe('Right answers are a choice’s options: a matrix’s columns take none');
  });
});
