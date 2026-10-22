import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { setting } from './panel-controls';
import { settingNumber } from './number-box';

/**
 * How a form of responses is gone through, on the screen's panel (panel-page.ts) beside its quiz: a review of the
 * answers before they are sent (`review`), with its own heading; one question at a time (`flow: "one"`).
 */
export function flowSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void; destroy(): void } {
  const w = designer.words.panel;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const review = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.reviewOn }) as HTMLInputElement;
  review.addEventListener('change', () => designer.setReview(review.checked ? {} : null));
  const heading = el('input', { class: 'fd-input', 'aria-label': w.reviewHeading, placeholder: w.reviewHeadingPlaceholder }) as HTMLInputElement;
  heading.addEventListener('input', () => designer.setReview({ title: heading.value }));
  const reviewRow = setting(el, 'rules', 'Review before sending', review, { hint: w.reviewHint, words: w.review });
  const headingRow = setting(el, 'rules', 'Review’s heading', heading, { words: w.reviewHeading });
  const one = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.flowOneOn }) as HTMLInputElement;
  one.addEventListener('change', () => designer.setFlowOne(one.checked));
  const oneRow = setting(el, 'rules', 'One question at a time', one, { hint: w.flowOneHint, words: w.flowOne });
  const pages = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.pagesRandomOn }) as HTMLInputElement;
  pages.addEventListener('change', () => designer.setPagesOrder(pages.checked));
  const pagesRow = setting(el, 'rules', 'Pages in random order', pages, { hint: w.pagesRandomHint, words: w.pagesRandom });
  const limit = () => designer.getPage().timeLimit;
  const minutes = settingNumber(el, designer, { label: w.timeMinutes, attrs: { class: 'fd-input', 'aria-label': w.timeMinutes, placeholder: w.noTimeLimit }, above: 0, optional: true, saved: () => limit()?.minutes ?? null, commit: (n) => designer.setTimeLimit(null, n === null ? null : { minutes: n }) });
  const warn = settingNumber(el, designer, { label: w.timeWarn, attrs: { class: 'fd-input', 'aria-label': w.timeWarn, placeholder: '1' }, above: 0, optional: true, saved: () => limit()?.warn ?? null, commit: (n) => designer.setTimeLimit(null, { warn: n }) });
  const then = el('select', { class: 'fd-input fd-select', 'aria-label': w.timeThen }, el('option', { value: 'send' }, w.timeThenAs.send), el('option', { value: 'lock' }, w.timeThenAs.lock)) as HTMLSelectElement;
  then.addEventListener('change', () => designer.setTimeLimit(null, { then: then.value === 'lock' ? 'lock' : null }));
  const minutesRow = setting(el, 'rules', 'Time limit', minutes.input, { hint: w.timeMinutesHint, words: w.timeLimit });
  const warnRow = setting(el, 'rules', 'Warn before the end', warn.input, { words: w.timeWarn });
  const thenRow = setting(el, 'rules', 'When the time runs out', then, { words: w.timeThen });
  const rows = [reviewRow, headingRow, oneRow, pagesRow, minutesRow, warnRow, thenRow];
  return {
    rows,
    destroy() {
      minutes.destroy();
      warn.destroy();
    },
    update(page) {
      const responses = page.data.kind === 'responses' && page.layout.type !== 'list';
      reviewRow.hidden = !responses;
      headingRow.hidden = !responses || !page.review;
      review.checked = !!page.review;
      if (!focused(heading)) heading.value = typeof page.review === 'object' ? page.review.title ?? '' : '';
      oneRow.hidden = !responses || page.layout.type === 'sheet';
      one.checked = page.flow === 'one';
      pagesRow.hidden = !responses || page.layout.type !== 'wizard';
      pages.checked = page.layout.type === 'wizard' && page.layout.order === 'random';
      minutesRow.hidden = !responses;
      warnRow.hidden = thenRow.hidden = !responses || !page.timeLimit;
      minutes.refresh();
      warn.refresh();
      then.value = page.timeLimit?.then ?? 'send';
    },
  };
}

