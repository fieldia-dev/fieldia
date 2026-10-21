import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { setting } from './panel-controls';

/**
 * How a form of responses is gone through, on the screen's panel (panel-page.ts) beside its quiz: a review of the
 * answers before they are sent (`review`), with its own heading.
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
  const rows = [reviewRow, headingRow];
  return {
    rows,
    destroy: () => undefined,
    update(page) {
      const responses = page.data.kind === 'responses' && page.layout.type !== 'list';
      reviewRow.hidden = !responses;
      headingRow.hidden = !responses || !page.review;
      review.checked = !!page.review;
      if (!focused(heading)) heading.value = typeof page.review === 'object' ? page.review.title ?? '' : '';
    },
  };
}

