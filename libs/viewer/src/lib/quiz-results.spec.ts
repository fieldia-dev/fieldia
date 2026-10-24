import { createMemoryDataSource, formSurveyPart, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor, surveyFlowPart } from './viewer-parts';

/**
 * A quiz's results under the thanks, as a person reads them: the score, each question marked in words, the right answer
 * to one missed, the feedback — or that they come later. In Arabic, right to left, in Arabic words with Latin digits.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const words = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}

const quiz = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.12',
  id: 'check',
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
      ],
      quiz: { feedback: { wrong: 'Only hyaluronic acid, by hyaluronidase.' } },
    },
    minutes: { type: 'integer', label: 'Minutes watched after?', quiz: { answers: [30] } },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'q-name', field: 'name' },
      { type: 'field', id: 'q-reversible', field: 'reversible', widget: 'radio' },
      { type: 'field', id: 'q-minutes', field: 'minutes' },
    ],
  },
  ...more,
});

async function send(page: Page, locale?: 'ar') {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource(), values: { name: 'Mona', reversible: 'caha', minutes: 30 }, ...(locale ? { locale } : {}) });
  await handle.drawn;
  (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
  await until(() => host.querySelector('.fd-quiz'));
  await flush();
  return host;
}

describe('a quiz’s results', () => {
  it('are drawn by the survey part, which a page with a quiz asks for', () => {
    expect(partsFor(quiz())).toEqual(expect.arrayContaining([surveyFlowPart, formSurveyPart]));
    expect(partsFor(quiz({ quiz: undefined }))).not.toContain(surveyFlowPart);
  });

  it('say the score and each question, marked in words, with the right answer to one missed and its feedback', async () => {
    const host = await send(quiz());
    const box = host.querySelector('.fd-quiz') as HTMLElement;
    expect(words(box.querySelector('.fd-quiz-score'))).toBe('You scored 1 of 2 (50%)');
    expect(document.activeElement).toBe(box.querySelector('.fd-quiz-title'));
    const items = [...box.querySelectorAll('.fd-quiz-item')].map((item) => [item.getAttribute('data-field'), item.getAttribute('data-mark'), words(item.querySelector('.fd-quiz-verdict')), words(item.querySelector('.fd-quiz-right-answer')), words(item.querySelector('.fd-quiz-feedback'))]);
    expect(items).toEqual([
      ['reversible', 'wrong', 'Wrong', 'Right answer: Hyaluronic acid', 'Only hyaluronic acid, by hyaluronidase.'],
      ['minutes', 'right', 'Right', '', ''],
    ]);
    // Its sign is a picture of the words said beside it, hidden from a screen reader.
    expect(box.querySelector('.fd-quiz-sign')?.getAttribute('aria-hidden')).toBe('true');
    expect(box.getAttribute('aria-labelledby')).toBe(box.querySelector('.fd-quiz-title')?.id);
  });

  it('keep the right answer back where the page says so, and say they come later where it reviews them first', async () => {
    let host = await send(quiz({ quiz: { rightAnswers: false } }));
    expect(host.querySelector('.fd-quiz-right-answer')).toBeNull();
    handle?.destroy();
    document.body.replaceChildren();
    host = await send(quiz({ quiz: { results: 'later' } }));
    expect(words(host.querySelector('.fd-quiz-later'))).toBe('Your results will be shown once your answers have been reviewed.');
    expect(host.querySelector('.fd-quiz-item')).toBeNull();
    expect(host.querySelector('.fd-quiz-score')).toBeNull();
  });

  it('read in Arabic, with Latin digits', async () => {
    const host = await send(quiz(), 'ar');
    // The language's own marks that keep a per cent in its place read right to left are its own: the words round them are these.
    expect(words(host.querySelector('.fd-quiz-score')).replace(/[\u200e\u200f\u061c]/g, '')).toBe('حصلت على 1 من 2 (50%)');
    expect(words(host.querySelector('.fd-quiz-item[data-mark="wrong"] .fd-quiz-verdict'))).toBe('خاطئة');
  });
});
