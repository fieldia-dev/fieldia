import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode, findTab } from './page-tree';
import { onTab, setting } from './panel-controls';

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
  const moves = movers(el, designer, id, ['Move up', 'Move down']);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete tabs');
  remove.addEventListener('click', () => designer.removeNode(id));
  const element = el(
    'div',
    { class: 'fd-props' },
    el('p', { class: 'fd-properties-hint' }, 'Tabs show one page of sections at a time. Select a tab to rename it.'),
    onTab(el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove), 'content', 'Move or delete')
  );
  return { element, update: (page) => moves.update(page) };
}

/** One tab: its label, its place among the others, and taking it away. */
export function tabProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const label = el('input', { class: 'fd-input', 'aria-label': 'Tab label' });
  label.addEventListener('input', () => designer.renameContainer(id, label.value));
  const moves = movers(el, designer, id, ['Move left', 'Move right']);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete tab');
  remove.addEventListener('click', () => designer.removeNode(id));
  const element = el('div', { class: 'fd-props' }, setting(el, 'content', 'Label', label), onTab(el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove), 'content', 'Move or delete'));
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
