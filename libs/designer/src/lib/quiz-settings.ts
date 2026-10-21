import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { settingNumber } from './number-box';
import { setting } from './panel-controls';

/**
 * A form of responses' quiz results (`quiz`), on the screen's panel (panel-page.ts) beside its limits: whether the
 * person sees them — as the answers are sent, or once reviewed — what a right answer earns where its question says
 * nothing, and whether a question missed shows its right answer. Each question's right answers are its own settings.
 */
export function quizSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void; destroy(): void } {
  const w = designer.words.panel;
  const shown = el(
    'select',
    { class: 'fd-input fd-select', 'aria-label': w.quizResults },
    el('option', { value: '' }, w.quizResultsAs.off),
    el('option', { value: 'now' }, w.quizResultsAs.now),
    el('option', { value: 'later' }, w.quizResultsAs.later)
  ) as HTMLSelectElement;
  shown.addEventListener('change', () => designer.setPageQuiz(shown.value ? { results: shown.value as 'now' | 'later' } : null));
  const each = settingNumber(el, designer, {
    label: w.quizPointsEach,
    attrs: { class: 'fd-input', 'aria-label': w.quizPointsEach, placeholder: '1' },
    above: 0,
    optional: true,
    saved: () => designer.getPage().quiz?.points ?? null,
    commit: (n) => designer.setPageQuiz({ points: n }),
  });
  const right = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.quizShowRight }) as HTMLInputElement;
  right.addEventListener('change', () => designer.setPageQuiz({ rightAnswers: right.checked }));
  const shownRow = setting(el, 'rules', 'Quiz results', shown, { hint: w.quizResultsHint, words: w.quizResults });
  const eachRow = setting(el, 'rules', 'Points for a right answer', each.input, { hint: w.quizPointsEachHint, words: w.quizPointsEach });
  const rightRow = setting(el, 'rules', 'Show the right answer to one missed', right, { words: w.quizShowRight });
  return {
    rows: [shownRow, eachRow, rightRow],
    destroy: () => each.destroy(),
    update(page) {
      // A form of responses shows its results; the rest once it is a quiz.
      const responses = page.data.kind === 'responses' && page.layout.type !== 'list';
      shownRow.hidden = !responses;
      eachRow.hidden = rightRow.hidden = !responses || !page.quiz;
      shown.value = page.quiz ? page.quiz.results ?? 'now' : '';
      each.refresh();
      right.checked = page.quiz?.rightAnswers !== false;
    },
  };
}
