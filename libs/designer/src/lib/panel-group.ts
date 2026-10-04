import type { FieldNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import type { Designer } from './designer';
import { contains, isSection, nodeOf } from './layout-tree';
import { allSections, findNode } from './page-tree';
import { onTab, setting } from './panel-controls';
import { columnsSetting, labelsSetting, widthSetting } from './panel-layout';
import { groupStyleSetting } from './panel-look';
import { movers, type PropertiesView } from './screen-properties';

/**
 * A group's settings, on the panel's tabs: its title, its place among the
 * others and taking it away (Content); its columns (Layout); and when it
 * shows (Rules). An arrangement — parts side by side — has only its layout.
 */

export function groupProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const title = el('input', { class: 'fd-input', 'aria-label': 'Section title' });
  title.addEventListener('input', () => designer.renameContainer(id, title.value));
  const columns = columnsSetting(el, designer, id);
  const labels = labelsSetting(el, designer, id, 'group');
  const width = widthSetting(el, designer, id);
  const style = groupStyleSetting(el, designer, id);
  const moves = movers(el, designer, id, ['Move up', 'Move down']);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete section');
  remove.addEventListener('click', () => designer.removeNode(id));
  // When it shows: rules on the fields outside it that hold one of a list, or yes or no.
  const when = conditionEditor(el, designer, id, 'group');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, 'Show only when…');
  showWhen.addEventListener('click', () => when.start());
  const noRules = el('p', { class: 'fd-properties-hint', hidden: '' }, 'Always. A rule needs a field outside it that holds one of a list, or yes or no.');
  const element = el(
    'div',
    { class: 'fd-props' },
    setting(el, 'content', 'Title', title),
    onTab(el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove), 'content', 'Move or delete'),
    ...columns.rows,
    ...labels.rows,
    ...width.rows,
    ...style.rows,
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, 'When it shows'), when.element, showWhen, noRules), 'rules', 'When it shows')
  );
  return {
    element,
    update(page) {
      const section = nodeOf(page, id);
      if (!isSection(section)) return;
      if (!focused(title)) title.value = section.title ?? '';
      for (const part of [columns, labels, width, style]) part.update(page);
      moves.update(page);
      // A page keeps one thing at its top, and a tab its last section.
      const holder = findNode(page, id)?.parent;
      remove.hidden = !holder || holder.children.length === 1;
      const outside = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && !contains(page, id, n.id) && choicesOf(page.fields[n.field]) !== null));
      when.update(page, outside, section.invisible);
      showWhen.hidden = !when.element.hidden || !when.canStart();
      noRules.hidden = !when.element.hidden || when.canStart();
    },
  };
}

/** Parts side by side: the columns they take, and how wide they are where they sit. */
export function arrangementProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const columns = columnsSetting(el, designer, id, 'Columns');
  const width = widthSetting(el, designer, id);
  const element = el('div', { class: 'fd-props' }, ...columns.rows, ...width.rows);
  return {
    element,
    update(page) {
      if (!isSection(nodeOf(page, id))) return;
      columns.update(page);
      width.update(page);
    },
  };
}
