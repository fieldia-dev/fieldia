import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { splitShownWhile, type ShownWhile } from './conditions';
import type { Designer } from './designer';
import { findHeaderPart } from './header-commands';
import { segmented, setting } from './panel-controls';
import type { PanelTab } from './panel-tabs';
import { findContainer, findNode } from './page-tree';

/**
 * "Shown while": a part for editing only — a button beside the name, a
 * warning — or for reading only, as Flectra's oe_edit_only and oe_read_only;
 * or always. A form that is always being edited shows its editing parts.
 */
export function shownWhileSetting(el: ElementFactory, designer: Designer, id: string, options: { tab?: PanelTab; tabbed?: boolean } = {}): { element: HTMLElement; update(page: Page): void } {
  const w = designer.words.rulesUi;
  const choice = segmented<ShownWhile>(
    el,
    w.shownWhile,
    (['always', 'editing', 'reading'] as const).map((value) => ({ value, words: w.shownWhileWays[value] })),
    (value) => value && designer.setShownWhile(id, value)
  );
  const element = setting(el, options.tab ?? 'rules', 'Shown while', choice.element, { hint: w.shownWhileHint, words: w.shownWhile });
  if (options.tabbed === false) element.removeAttribute('data-tab');
  return {
    element,
    update(page) {
      const part = (findContainer(page, id) ?? findNode(page, id)?.node ?? findHeaderPart(page, id)?.part) as { invisible?: unknown } | null | undefined;
      element.hidden = !part || part.invisible === true;
      choice.set(splitShownWhile(part?.invisible).mode);
    },
  };
}
