import { fill, type Form, type LineField, type Locale, type Page, type QuizResults, type Value, type Values } from '@fieldia/core';
import { displayValue } from '@fieldia/widgets';
import type { ViewerLabels } from './labels';
import { installFlowStyles } from './flow-styles';

/** What a quiz's results are drawn with: the page, its words and the answers as they were sent. */
export interface QuizContext {
  doc: Document;
  page: Page;
  labels: ViewerLabels;
  locale: Locale;
  /** The results the form worked out as the answers went, or the app's source gave (`state.sent.quiz`). */
  results: QuizResults | null | undefined;
  /** The answers as they were sent: how each question's answer reads. */
  values: Readonly<Values>;
  /** A page's own words as they read with the answers given ("How was your visit to {branch}?"). */
  words(text: string): string;
  /** An id of the form's own, for what is named by it. */
  uid(id: string): string;
}

/**
 * A quiz's results under a page of responses' ending (`quiz` on the page): the score — "You scored 7 of 10 (70%)" — and
 * each question asked, in the order it was asked, marked right or wrong in words and by a sign, its points, the
 * person's answer, the right answer to one missed (unless the page keeps it back: `rightAnswers: false`) and the
 * question's feedback. With `results: "later"`, only that they come once the answers are reviewed. Its heading takes
 * the focus where the page shows no ending's words, so what it says is read out.
 */
export function drawQuizResults(context: QuizContext): HTMLElement | null {
  const { doc, page, labels, locale, results, values } = context;
  // Nothing marked — no question asked has right answers or points — and nothing to come later: no results.
  if (!results && page.quiz?.results !== 'later') return null;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag);
    element.className = className;
    element.append(...children);
    return element;
  };
  const box = make('section', 'fd-quiz');
  const title = make('h2', 'fd-quiz-title', labels.quizTitle);
  title.id = context.uid('quiz-results');
  title.tabIndex = -1;
  box.setAttribute('aria-labelledby', title.id);
  box.append(title);
  if (page.quiz?.results === 'later' || !results) {
    box.append(make('p', 'fd-quiz-later', labels.quizLater));
    return box;
  }
  // Numbers as everywhere in Fieldia: Latin digits, in the page's language's way.
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, numberingSystem: 'latn' } as Intl.NumberFormatOptions);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, numberingSystem: 'latn' } as Intl.NumberFormatOptions);
  box.setAttribute('data-score', String(results.score));
  box.append(make('p', 'fd-quiz-score', fill(labels.quizScore, { score: number.format(results.score), max: number.format(results.max), percent: percent.format(results.max ? results.score / results.max : 0) })));
  const list = make('ol', 'fd-quiz-list');
  /** An answer as the field shows it: a choice by its label, several joined. */
  const said = (field: string, value: Value | undefined) => {
    const def = page.fields[field] as LineField | undefined;
    return def ? displayValue(def, value, values as Record<string, Value>, locale) : String(value ?? '');
  };
  for (const mark of results.questions) {
    const def = page.fields[mark.field];
    const state = mark.right === null ? 'points' : mark.right ? 'right' : mark.answered ? 'wrong' : 'missed';
    const item = make('li', 'fd-quiz-item');
    item.dataset['field'] = mark.field;
    item.dataset['mark'] = state;
    const sign = make('span', 'fd-quiz-sign', state === 'right' ? '✓' : state === 'points' ? '•' : '✗');
    sign.setAttribute('aria-hidden', 'true');
    const verdict = state === 'points' ? null : make('span', 'fd-quiz-verdict', state === 'right' ? labels.quizRight : state === 'wrong' ? labels.quizWrong : labels.quizNotAnswered);
    const head = make(
      'p',
      'fd-quiz-head',
      sign,
      make('span', 'fd-quiz-question', context.words(def?.label ?? mark.field)),
      make('span', 'fd-quiz-points', fill(labels.quizPoints, { points: number.format(mark.points), max: number.format(mark.max) }))
    );
    item.append(head);
    if (verdict) item.append(verdict);
    if (mark.answered) item.append(make('p', 'fd-quiz-answer', fill(labels.quizYourAnswer, { answer: said(mark.field, values[mark.field] as Value) })));
    if (mark.rightAnswer !== undefined) item.append(make('p', 'fd-quiz-right-answer', fill(labels.quizRightAnswer, { answer: said(mark.field, mark.rightAnswer) })));
    if (mark.feedback) item.append(make('p', 'fd-quiz-feedback', context.words(mark.feedback)));
    list.append(item);
  }
  box.append(list);
  return box;
}

/** What the done screen hands over: the page, its form, and what the results go before (its button to start again). */
export interface QuizShown {
  doc: Document;
  page: Page;
  form: Form;
  labels: ViewerLabels;
  locale: Locale;
  uid(id: string): string;
  before: HTMLElement;
}

/**
 * A quiz's results for the answers just sent, in the done screen before its button to start again — in place of the
 * last response's — and their heading, to take the focus where no ending does; null where nothing was marked.
 */
export function showQuiz(shown: QuizShown): HTMLElement | null {
  const { doc, form, before } = shown;
  before.parentElement?.querySelector(':scope > .fd-quiz')?.remove();
  const sent = form.getState().sent;
  if (!sent) return null;
  installFlowStyles(doc);
  const box = drawQuizResults({ ...shown, results: sent.quiz, values: sent.values, words: (text) => (text.includes('{') ? form.words(text) : text) });
  if (!box) return null;
  before.before(box);
  return box.querySelector<HTMLElement>('.fd-quiz-title');
}
