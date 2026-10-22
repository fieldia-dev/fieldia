import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { quizResults } from './quiz';
import { formSurveyPart } from './survey';

/** A clinic's injectables check: a choice with one right answer, one with several, a number typed, a word typed, and a choice of points alone. */
const check = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.9',
  id: 'injectables-check',
  data: { kind: 'responses' },
  quiz: {},
  fields: {
    name: { type: 'char', label: 'Your name' },
    reversible: {
      type: 'selection',
      label: 'Which filler can be dissolved?',
      options: [
        { value: 'ha', label: 'Hyaluronic acid', correct: true },
        { value: 'caha', label: 'Calcium hydroxylapatite' },
        { value: 'plla', label: 'Poly-L-lactic acid' },
      ],
      quiz: { feedback: { right: 'Yes: hyaluronidase dissolves it.', wrong: 'Only hyaluronic acid: hyaluronidase dissolves it.' } },
    },
    signs: {
      type: 'selection',
      label: 'Which are signs of a blocked vessel?',
      multiple: true,
      options: [
        { value: 'blanching', label: 'Blanching', correct: true },
        { value: 'pain', label: 'Severe pain', correct: true },
        { value: 'swelling', label: 'Mild swelling' },
      ],
      quiz: { points: 2 },
    },
    units: { type: 'integer', label: 'Units of toxin for a glabella, usually?', quiz: { answers: [20] } },
    enzyme: { type: 'char', label: 'Which enzyme dissolves hyaluronic acid?', quiz: { answers: ['Hyaluronidase'] } },
    confidence: {
      type: 'selection',
      label: 'How sure are you?',
      options: [
        { value: 'low', label: 'Not sure', score: 0 },
        { value: 'mid', label: 'Fairly', score: 1 },
        { value: 'high', label: 'Very', score: 2 },
      ],
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: ['name', 'reversible', 'signs', 'units', 'enzyme', 'confidence'].map((field) => ({ type: 'field' as const, id: `q-${field}`, field })),
  },
  ...more,
});

describe('a quiz’s results (quiz on a page)', () => {
  it('marks each question asked, in the order asked: right answers, several exactly, typed words and numbers, points alone', () => {
    const results = quizResults(check(), { name: 'Mona', reversible: 'caha', signs: ['pain', 'blanching'], units: 20, enzyme: '  hyaluronidase ', confidence: 'mid' });
    expect(results).toEqual({
      score: 5,
      max: 7,
      questions: [
        { field: 'reversible', points: 0, max: 1, right: false, answered: true, rightAnswer: 'ha', feedback: 'Only hyaluronic acid: hyaluronidase dissolves it.' },
        { field: 'signs', points: 2, max: 2, right: true, answered: true },
        { field: 'units', points: 1, max: 1, right: true, answered: true },
        { field: 'enzyme', points: 1, max: 1, right: true, answered: true },
        { field: 'confidence', points: 1, max: 2, right: null, answered: true },
      ],
    });
  });

  it('counts several chosen right only when exactly the right ones are, and one not answered as missed', () => {
    const results = quizResults(check(), { reversible: null, signs: ['blanching', 'swelling'], units: 25, enzyme: 'collagenase', confidence: null });
    expect(results?.questions.map((mark) => [mark.field, mark.right, mark.answered, mark.points])).toEqual([
      ['reversible', false, false, 0],
      ['signs', false, true, 0],
      ['units', false, true, 0],
      ['enzyme', false, true, 0],
      ['confidence', null, false, 0],
    ]);
    expect(results?.questions[1].rightAnswer).toEqual(['blanching', 'pain']);
    expect(results?.score).toBe(0);
  });

  it('marks only the questions asked: one not shown, its step skipped, is none', () => {
    const results = quizResults(check(), { reversible: 'ha' }, ['reversible']);
    expect(results).toEqual({ score: 1, max: 1, questions: [{ field: 'reversible', points: 1, max: 1, right: true, answered: true, feedback: 'Yes: hyaluronidase dissolves it.' }] });
  });

  it('gives the page’s points to a right answer whose question says none, and keeps the right answer back where the page says so', () => {
    const results = quizResults(check({ quiz: { points: 5, rightAnswers: false } }), { reversible: 'plla', units: 20 }, ['reversible', 'units']);
    expect(results).toEqual({
      score: 5,
      max: 10,
      questions: [
        { field: 'reversible', points: 0, max: 5, right: false, answered: true, feedback: 'Only hyaluronic acid: hyaluronidase dissolves it.' },
        { field: 'units', points: 5, max: 5, right: true, answered: true },
      ],
    });
  });

  it('has none where no question asked has right answers or points', () => {
    expect(quizResults(check(), { name: 'Mona' })).toBeNull();
  });

  it('works them out as the answers are sent: state.sent.quiz, the source’s own marking in their place', async () => {
    await formSurveyPart.load();
    const form = createForm({ page: check(), dataSource: createMemoryDataSource() });
    form.setValues({ name: 'Mona', reversible: 'ha', signs: ['pain'], units: 20, enzyme: 'hyaluronidase', confidence: 'high' });
    expect(await form.save()).toBe(true);
    expect(form.getState().sent?.quiz).toMatchObject({ score: 5, max: 7 });
    const marked = { score: 9, max: 10, questions: [] };
    const ds = createMemoryDataSource({ submitted: () => ({ id: 'T-1', quiz: marked }) });
    const own = createForm({ page: check(), dataSource: ds });
    own.setValues({ reversible: 'ha' });
    expect(await own.save()).toBe(true);
    expect(own.getState().sent?.quiz).toEqual(marked);
    // A page with no quiz marks nothing.
    const plain = createForm({ page: check({ quiz: undefined, fields: { name: { type: 'char', label: 'Your name' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'q-name', field: 'name' }] } }), dataSource: createMemoryDataSource() });
    expect(await plain.save()).toBe(true);
    expect(plain.getState().sent?.quiz).toBeUndefined();
  });

  it('is checked: a quiz on a page of responses with a question to mark; each question’s quiz where it can be said', () => {
    expect(validatePage(check()).ok).toBe(true);
    const messages = (page: Page) => (checkPage(page).ok ? [] : (checkPage(page) as { issues: { path: string; message: string }[] }).issues.map((issue) => `${issue.path}: ${issue.message}`));
    expect(messages(check({ data: { kind: 'record', model: 'quiz' } })).join('\n')).toContain('quiz: a quiz’s results are for a page of responses');
    // One with nothing to mark yet is being made: it shows no results until a question has right answers or points.
    expect(messages(check({ fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'q-name', field: 'name' }] } }))).toEqual([]);
    const wrong = check();
    wrong.fields['reversible'] = { ...(wrong.fields['reversible'] as object), quiz: { answers: ['ha'], feedback: { right: 'Yes' } } } as Page['fields'][string];
    wrong.fields['confidence'] = { ...(wrong.fields['confidence'] as object), quiz: { feedback: { wrong: 'Be surer' } } } as Page['fields'][string];
    wrong.fields['units'] = { type: 'integer', label: 'Units', quiz: { answers: ['twenty'] } };
    expect(messages(wrong)).toEqual([
      'fields.reversible.quiz.answers: a choice’s right answers are its options marked "correct"',
      'fields.units.quiz.answers: a number’s answers are numbers',
      'fields.confidence.quiz.feedback: feedback is said for a right or a wrong answer: mark the right options "correct"',
    ]);
    expect(messages(check({ quiz: undefined }))).toContain('fields.reversible.quiz: a question’s quiz is shown by the page’s: give the page "quiz": {} to show the results');
  });
});
