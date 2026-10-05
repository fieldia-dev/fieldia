import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode, findTab } from './page-tree';
import { onTab, setting } from './panel-controls';
import { widthSetting } from './panel-layout';

/**
 * The screen editor's properties: what a view of a part is, and the views of
 * a sheet's tabs and of one tab. A field's view is in panel-field.ts, a
 * group's in panel-group.ts, the screen's own in panel-page.ts; the panel
 * that shows them, as tabs, in panel-inspector.ts.
 */

export interface PropertiesView {
  /** Its settings as rows, each on the tab its `data-tab` says (Content when it says none). */
  element: HTMLElement;
  update(page: Page): void;
  /** Bring a part of the panel forward: a field's settings, or when it shows. */
  focus?(part: 'field' | 'when' | 'filters'): void;
  /** Let go of what it holds besides its elements, once something else is shown: a sample's widgets. */
  destroy?(): void;
}

export function prop(el: ElementFactory, text: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
}

/** Earlier and later among its neighbours; a button that cannot move it is hidden. */
export function movers(el: ElementFactory, designer: Designer, id: string, words: [string, string]) {
  const earlier = el('button', { type: 'button', class: 'fd-button' }, words[0]);
  const later = el('button', { type: 'button', class: 'fd-button' }, words[1]);
  earlier.addEventListener('click', () => designer.moveNode(id, -1));
  later.addEventListener('click', () => designer.moveNode(id, 1));
  return {
    buttons: [earlier, later],
    update(page: Page) {
      const found = findNode(page, id);
      const tab = found ? null : findTab(page, id);
      const list = (found?.parent.children ?? tab?.tabs.children ?? []) as { id: string }[];
      const index = list.findIndex((n) => n.id === id);
      earlier.hidden = index <= 0;
      later.hidden = index === -1 || index === list.length - 1;
    },
  };
}

/** A set of tabs: where it sits on the sheet, and taking it away with its tabs. */
export function tabsProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const w = designer.words.panel;
  const moves = movers(el, designer, id, [w.moveUp, w.moveDown]);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.deleteTabs);
  remove.addEventListener('click', () => designer.removeNode(id));
  const width = widthSetting(el, designer, id);
  const element = el(
    'div',
    { class: 'fd-props' },
    el('p', { class: 'fd-properties-hint' }, w.tabsHint),
    onTab(el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove), 'content', 'Move or delete'),
    ...width.rows
  );
  return {
    element,
    update(page) {
      moves.update(page);
      width.update(page);
    },
  };
}

/** One tab: its label, its place among the others, and taking it away. */
export function tabProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const w = designer.words.panel;
  const label = el('input', { class: 'fd-input', 'aria-label': w.tabLabel });
  label.addEventListener('input', () => designer.renameContainer(id, label.value));
  const moves = movers(el, designer, id, [w.moveLeft, w.moveRight]);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.deleteTab);
  remove.addEventListener('click', () => designer.removeNode(id));
  const element = el('div', { class: 'fd-props' }, setting(el, 'content', 'Label', label, { words: w.label }), onTab(el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove), 'content', 'Move or delete'));
  return {
    element,
    update(page) {
      const found = findTab(page, id);
      if (!found) return;
      if (!focused(label)) label.value = found.tab.label;
      moves.update(page);
    },
  };
}
