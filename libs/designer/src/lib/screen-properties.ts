import { wideColumns, type FieldNode, type Page, type SheetNode } from '@fieldia/core';
import { optionsEditor, type ElementFactory } from './chrome';
import { QUESTION_KINDS, type Designer } from './designer';
import { allSections, findField, findNode, findTab, sectionLabel } from './page-tree';
import { kindOfQuestion } from './survey-editor';

/**
 * The screen editor's properties panel: what can be changed about the field,
 * section, tab or tabs selected, or about the screen itself when nothing is.
 */

export interface PropertiesView {
  element: HTMLElement;
  update(page: Page): void;
}

export function prop(el: ElementFactory, text: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
}

export function fieldProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const label = el('input', { class: 'fd-input fd-prop-label', 'aria-label': 'Label' });
  label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
  const kind = el('select', { class: 'fd-input fd-select', 'aria-label': 'Kind of field' });
  for (const k of QUESTION_KINDS) kind.append(el('option', { value: k.id }, k.label));
  kind.addEventListener('change', () => designer.changeKind(id, kind.value));
  const options = optionsEditor(el, designer, id);
  const required = el('input', { type: 'checkbox', 'aria-label': 'Required' });
  required.addEventListener('change', () => designer.updateQuestion(id, { required: required.checked }));
  const help = el('input', { class: 'fd-input', 'aria-label': 'Help text', placeholder: 'Optional' });
  help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
  const width = el('select', { class: 'fd-input fd-select', 'aria-label': 'Width' });
  width.addEventListener('change', () => designer.setColspan(id, Number(width.value)));
  const section = el('select', { class: 'fd-input fd-select', 'aria-label': 'Section' });
  section.addEventListener('change', () => {
    const target = allSections(designer.getPage()).find((s) => s.id === section.value);
    if (target) designer.placeNode(id, target.id, target.children.length);
  });
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, 'Duplicate');
  duplicate.addEventListener('click', () => {
    const copy = designer.duplicateNode(id);
    if (copy) designer.select(copy);
  });
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete field');
  remove.addEventListener('click', () => designer.removeNode(id));
  const widthRow = prop(el, 'Width', width);
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, 'Label', label),
    prop(el, 'Kind', kind),
    options.element,
    el('label', { class: 'fd-q-required' }, required, el('span', {}, 'Required')),
    prop(el, 'Help text', help),
    widthRow,
    prop(el, 'Section', section),
    el('div', { class: 'fd-props-actions' }, duplicate, remove)
  );

  return {
    element,
    update(page) {
      const found = findField(page, id);
      if (!found) return;
      const def = page.fields[found.node.field];
      if (!focused(label)) label.value = found.node.label ?? def.label;
      const current = kindOfQuestion(def, found.node);
      kind.value = current ?? '';
      kind.disabled = current === null;
      options.update(def);
      required.checked = def.required === true;
      if (!focused(help)) help.value = found.node.help ?? def.help ?? '';
      const columns = wideColumns(found.section.columns);
      widthRow.hidden = columns === 1;
      if (width.options.length !== columns) {
        width.replaceChildren(
          ...Array.from({ length: columns }, (_, i) => {
            const n = i + 1;
            const text = n === 1 ? '1 column' : `${n} columns${n === columns ? ' (full width)' : ''}`;
            return el('option', { value: String(n) }, text);
          })
        );
      }
      width.value = String(Math.min(found.node.colspan ?? 1, columns));
      section.replaceChildren(...allSections(page).map((s) => el('option', { value: s.id }, sectionLabel(page, s))));
      section.value = found.section.id;
    },
  };
}

export function sectionProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const title = el('input', { class: 'fd-input', 'aria-label': 'Section title' });
  title.addEventListener('input', () => designer.renameContainer(id, title.value));
  const columns = el('select', { class: 'fd-input fd-select', 'aria-label': 'Columns' });
  for (const n of [1, 2, 3, 4]) columns.append(el('option', { value: String(n) }, String(n)));
  columns.addEventListener('change', () => designer.setColumns(id, Number(columns.value) as 1 | 2 | 3 | 4));
  const moves = movers(el, designer, id, ['Move up', 'Move down']);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete section');
  remove.addEventListener('click', () => designer.removeNode(id));
  const element = el('div', { class: 'fd-props' }, prop(el, 'Title', title), prop(el, 'Columns', columns), el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove));
  return {
    element,
    update(page) {
      const section = allSections(page).find((s) => s.id === id);
      if (!section) return;
      if (!focused(title)) title.value = section.title ?? '';
      columns.value = String(section.columns ?? 1);
      moves.update(page);
      // A page keeps one thing at its top, and a tab its last section.
      const holder = findNode(page, id)?.parent;
      remove.hidden = !holder || holder.children.length === 1;
    },
  };
}

/** Earlier and later among its neighbours; a button that cannot move it is hidden. */
function movers(el: ElementFactory, designer: Designer, id: string, words: [string, string]) {
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

/** Nothing selected: the screen itself — sections or a record sheet, and a sheet's title. */
export function pageProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const layout = el('select', { class: 'fd-input fd-select', 'aria-label': 'Layout' }, el('option', { value: 'sections' }, 'Sections'), el('option', { value: 'sheet' }, 'Record sheet'));
  layout.addEventListener('change', () => designer.setLayoutKind(layout.value as 'sections' | 'sheet'));
  const title = el('select', { class: 'fd-input fd-select', 'aria-label': 'Title field' });
  title.addEventListener('change', () => designer.setTitleField(title.value === '' ? null : title.value === CURRENT_TITLE ? (designer.getPage().layout as SheetNode).title?.field ?? null : title.value));
  const titleRow = prop(el, 'Title field', title);
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, 'Layout', layout),
    titleRow,
    el('p', { class: 'fd-properties-hint' }, 'Select a field or a section to change it.')
  );
  return {
    element,
    update(page) {
      const root = page.layout;
      layout.value = root.type === 'sheet' ? 'sheet' : 'sections';
      titleRow.hidden = root.type !== 'sheet';
      if (root.type !== 'sheet') return;
      // The text fields that could be the title, and the one that is.
      const texts = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && page.fields[n.field]?.type === 'char'));
      title.replaceChildren(
        el('option', { value: '' }, 'No title'),
        ...(root.title ? [el('option', { value: CURRENT_TITLE }, page.fields[root.title.field]?.label ?? root.title.field)] : []),
        ...texts.map((n) => el('option', { value: n.id }, n.label ?? page.fields[n.field].label))
      );
      title.value = root.title ? CURRENT_TITLE : '';
    },
  };
}
/** The title's own entry in the list: it has no node, being out of every section. */
const CURRENT_TITLE = '#title';

/** A set of tabs: where it sits on the sheet, and taking it away with its tabs. */
export function tabsProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const moves = movers(el, designer, id, ['Move up', 'Move down']);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete tabs');
  remove.addEventListener('click', () => designer.removeNode(id));
  const element = el('div', { class: 'fd-props' }, el('p', { class: 'fd-properties-hint' }, 'Tabs show one page of sections at a time. Select a tab to rename it.'), el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove));
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
  const element = el('div', { class: 'fd-props' }, prop(el, 'Label', label), el('div', { class: 'fd-props-actions' }, ...moves.buttons, remove));
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
