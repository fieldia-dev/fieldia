import type { Page, SectionNode, StepNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { settingNumber } from './number-box';
import { findContainer } from './page-tree';

/**
 * A step's or a group's draw, on a form of responses (`order: "random"`, `draw`, and a step's `fixed` where the
 * form's pages are drawn): its questions in an order drawn for each respondent, and how many of them each is asked.
 * Drawn in a step's card in the survey editor, and on a group's panel in the screen editor.
 */
export function drawSettings(el: ElementFactory, designer: Designer, id: string): { element: HTMLElement; update(page: Page): void; destroy(): void } {
  const w = designer.words.panel;
  const own = (page: Page) => findContainer(page, id) as (StepNode | SectionNode) | undefined;
  const switchOf = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  const random = switchOf(w.drawRandom, (on) => designer.setDraw(id, { order: on }));
  const fixed = switchOf(w.drawFixed, (on) => designer.setDraw(id, { fixed: on }));
  let drawn: number | null = null;
  const count = settingNumber(el, designer, {
    label: w.drawCount,
    attrs: { class: 'fd-inline-input fd-inline-number', 'aria-label': w.drawCount, placeholder: w.drawAll },
    integer: true,
    min: 1,
    optional: true,
    saved: () => drawn,
    commit: (n) => designer.setDraw(id, { draw: n }),
  });
  const countBox = el('label', { class: 'fd-inline-setting' }, el('span', {}, w.drawCount), count.input);
  const element = el('div', { class: 'fd-inline-row fd-draw-settings' }, random.element, countBox, fixed.element);
  return {
    element,
    destroy: () => count.destroy(),
    update(page) {
      const node = own(page);
      element.hidden = page.data.kind !== 'responses' || !node;
      if (!node) return;
      random.button.setAttribute('aria-checked', String(node.order === 'random'));
      drawn = node.draw ?? null;
      count.refresh();
      // A step keeps its place where the form's pages are drawn: a welcome first, a page about you last.
      fixed.element.hidden = !(node.type === 'step' && page.layout.type === 'wizard' && page.layout.order === 'random');
      fixed.button.setAttribute('aria-checked', String(node.fixed === true));
    },
  };
}
