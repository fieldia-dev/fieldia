import { wideColumns, type FieldNode, type Page, type SheetNode } from '@fieldia/core';
import { optionsEditor, type ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import { choicesOf, conditionEditor } from './condition-editor';
import type { Designer } from './designer';
import { kindsReason } from './field-bar';
import { kindOfField } from './kinds';
import { allSections, findField, findNode, findTab, sectionLabel } from './page-tree';

/**
 * The screen editor's properties panel: what can be changed about the field,
 * section, tab or tabs selected, or about the screen itself when nothing is.
 */

export interface PropertiesView {
  element: HTMLElement;
  update(page: Page): void;
  /** Bring a part of the panel forward: a field's settings, or when it shows. */
  focus?(part: 'field' | 'when' | 'filters'): void;
}

export function prop(el: ElementFactory, text: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
}

export function fieldProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const label = el('input', { class: 'fd-input fd-prop-label', 'aria-label': 'Label' });
  label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
  // Only the kinds that suit what the field holds, as the bar on the canvas offers them, and why.
  const kind = el('select', { class: 'fd-input fd-select', 'aria-label': 'Shown as' });
  kind.addEventListener('change', () => designer.changeKind(id, kind.value));
  const kindNote = el('p', { class: 'fd-properties-hint fd-kind-note' });
  const fromModelNote = el('p', { class: 'fd-properties-hint', hidden: '' });
  const options = optionsEditor(el, designer, id);
  const relation = el('input', { class: 'fd-input', 'aria-label': 'Links to', placeholder: 'contact' });
  relation.addEventListener('input', () => designer.setRelation(id, relation.value));
  const relationRow = prop(el, 'Links to', relation);
  const currency = el('input', { class: 'fd-input', 'aria-label': 'Currency', maxlength: '3', placeholder: 'USD' });
  // Only a whole code: two letters on the way to three are not a currency yet.
  currency.addEventListener('input', () => currency.value.trim().length === 3 && designer.setCurrency(id, currency.value));
  const currencyRow = prop(el, 'Currency', currency);
  const lineColumns = columnsEditor(el, designer, id);
  const required = el('input', { type: 'checkbox', 'aria-label': 'Required' });
  required.addEventListener('change', () => {
    // Read before anything redraws the panel.
    const always = required.checked;
    // Required always, or not at all: a rule for it goes.
    if (requiredWhen.element.hidden === false) designer.setRule(id, 'required', null);
    designer.updateQuestion(id, { required: always });
  });
  // Required, or read-only, only when a rule holds.
  const requiredWhen = conditionEditor(el, designer, id, 'question', 'required');
  const requiredOnly = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when', 'aria-label': 'Required only when…' }, 'Only when…');
  requiredOnly.addEventListener('click', () => requiredWhen.start());
  const readonlyWhen = conditionEditor(el, designer, id, 'question', 'readonly');
  const readonlyOnly = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, 'Read-only when…');
  readonlyOnly.addEventListener('click', () => readonlyWhen.start());
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
  // When it shows: rules on the other fields that hold one of a list, or yes or no.
  const when = conditionEditor(el, designer, id, 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, 'Show only when…');
  showWhen.addEventListener('click', () => when.start());
  const noRules = el('p', { class: 'fd-properties-hint', hidden: '' }, 'Always. A rule needs another field that holds one of a list, or yes or no.');
  const whenBox = el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, 'When it shows'), when.element, showWhen, noRules);
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, 'Label', label),
    prop(el, 'Shown as', kind),
    kindNote,
    fromModelNote,
    options.element,
    relationRow,
    currencyRow,
    lineColumns.element,
    el('div', { class: 'fd-prop fd-prop-when' }, el('div', { class: 'fd-q-required-row' }, el('label', { class: 'fd-q-required' }, required, el('span', {}, 'Required')), requiredOnly), requiredWhen.element, readonlyWhen.element, readonlyOnly),
    prop(el, 'Help text', help),
    widthRow,
    prop(el, 'Section', section),
    whenBox,
    el('div', { class: 'fd-props-actions' }, duplicate, remove)
  );

  return {
    element,
    update(page) {
      const found = findField(page, id);
      if (!found) return;
      const def = page.fields[found.node.field];
      const fromModel = designer.isFromModel(id);
      if (!focused(label)) label.value = found.node.label ?? def.label;
      const current = kindOfField(def, found.node);
      const offered = designer.kindsFor(id);
      const key = offered.map((k) => k.id).join(',');
      if (kind.dataset['offered'] !== key) {
        kind.dataset['offered'] = key;
        kind.replaceChildren(...offered.map((k) => el('option', { value: k.id }, k.label)));
      }
      kind.value = current ?? '';
      kind.disabled = current === null || offered.length < 2;
      kindNote.textContent = kindsReason(designer, page, id);
      // What the model keeps for itself, for the kind of field this is.
      const kept = def.type === 'selection' ? 'Its options come from the model.' : def.type === 'monetary' ? 'Its currency comes from the model.' : ['many2one', 'many2many', 'one2many'].includes(def.type) ? 'The records it points to come from the model.' : '';
      fromModelNote.textContent = kept;
      fromModelNote.hidden = !fromModel || !kept;
      options.update(def, found.node);
      options.element.hidden ||= fromModel;
      lineColumns.update(def);
      lineColumns.element.hidden ||= fromModel;
      relationRow.hidden = !('relation' in def) || fromModel;
      if (!focused(relation)) relation.value = 'relation' in def ? def.relation : '';
      currencyRow.hidden = def.type !== 'monetary' || fromModel;
      if (!focused(currency)) currency.value = def.type === 'monetary' ? def.currency ?? '' : '';
      required.checked = def.required === true || found.node.required === true;
      const others = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && n.id !== id && choicesOf(page.fields[n.field]) !== null));
      requiredWhen.update(page, others, found.node.required);
      requiredOnly.hidden = required.checked || !requiredWhen.element.hidden || !requiredWhen.canStart();
      readonlyWhen.update(page, others, found.node.readonly);
      readonlyOnly.hidden = !readonlyWhen.element.hidden || !readonlyWhen.canStart();
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
      const candidates = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && n.id !== id && choicesOf(page.fields[n.field]) !== null));
      when.update(page, candidates, found.node.invisible);
      showWhen.hidden = !when.element.hidden || !when.canStart();
      noRules.hidden = !when.element.hidden || when.canStart();
    },
    focus(part) {
      if (part === 'when') {
        if (!showWhen.hidden) showWhen.click();
        (whenBox.querySelector('select, button') as HTMLElement | null)?.focus();
        whenBox.scrollIntoView?.({ block: 'nearest' });
      } else {
        label.focus();
        label.scrollIntoView?.({ block: 'nearest' });
      }
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
