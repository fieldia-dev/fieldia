import type { FieldNode } from '@fieldia/core';
import { optionsEditor, type ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import { choicesOf, conditionEditor } from './condition-editor';
import type { Designer } from './designer';
import { kindsReason } from './field-bar';
import { kindOfField, storedAs } from './kinds';
import { onTab, setting } from './panel-controls';
import { labelsSetting, widthSetting } from './panel-layout';
import { allSections, findField, sectionLabel } from './page-tree';
import { fieldRules } from './rules-panel';
import type { PropertiesView } from './screen-properties';

/**
 * A field's settings, on the panel's tabs: its words and how it is shown
 * (Content), how wide it is and where it sits (Layout), when it shows and
 * must be answered (Rules), and what it is stored as (Data).
 */

/** The kinds whose empty box shows words of their own. */
const TAKES_PLACEHOLDER = new Set(['char', 'text', 'integer', 'float', 'monetary']);

export function fieldProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;

  // ---- Content: its words, and how it is shown ----
  const label = el('input', { class: 'fd-input fd-prop-label', 'aria-label': 'Label' });
  label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
  const help = el('input', { class: 'fd-input', 'aria-label': 'Help text', placeholder: 'Optional' });
  help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
  const placeholder = el('input', { class: 'fd-input', 'aria-label': 'Placeholder', placeholder: 'Words inside the empty box' });
  placeholder.addEventListener('input', () => designer.updateQuestion(id, { placeholder: placeholder.value }));
  const placeholderRow = setting(el, 'content', 'Placeholder', placeholder);
  // Only the kinds that suit what the field holds, as the bar on the canvas offers them, and why.
  const kind = el('select', { class: 'fd-input fd-select', 'aria-label': 'Shown as' });
  kind.addEventListener('change', () => designer.changeKind(id, kind.value));
  const kindNote = el('p', { class: 'fd-properties-hint fd-kind-note' });
  const options = optionsEditor(el, designer, id);
  const optionsRow = setting(el, 'content', 'Options', options.element);
  const lineColumns = columnsEditor(el, designer, id);
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, 'Duplicate');
  duplicate.addEventListener('click', () => {
    const copy = designer.duplicateNode(id);
    if (copy) designer.select(copy);
  });
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete field');
  remove.addEventListener('click', () => designer.removeNode(id));

  // ---- Layout: how wide it is, and where it sits ----
  const width = widthSetting(el, designer, id);
  const labels = labelsSetting(el, designer, id, 'field');
  const section = el('select', { class: 'fd-input fd-select', 'aria-label': 'Section' });
  section.addEventListener('change', () => {
    const target = allSections(designer.getPage()).find((s) => s.id === section.value);
    if (target) designer.placeNode(id, target.id, target.children.length);
  });

  // ---- Rules: required, read-only, when it shows ----
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
  // When it shows: rules on the other fields that hold one of a list, or yes or no.
  const when = conditionEditor(el, designer, id, 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, 'Show only when…');
  showWhen.addEventListener('click', () => when.start());
  const noRules = el('p', { class: 'fd-properties-hint', hidden: '' }, 'Always. A rule needs another field that holds one of a list, or yes or no.');
  const whenBox = onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, 'When it shows'), when.element, showWhen, noRules), 'rules', 'When it shows');
  // Worked out from others, set when, and the rules its answer keeps.
  const own = fieldRules(el, designer, id);

  // ---- Data: what it is stored under and as ----
  const name = el('code', { class: 'fd-insp-code' });
  const nameHint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const stored = el('span', { class: 'fd-insp-chip' });
  const fromModelNote = el('p', { class: 'fd-properties-hint fd-set-hint', hidden: '' });
  const relation = el('input', { class: 'fd-input', 'aria-label': 'Links to', placeholder: 'contact' });
  relation.addEventListener('input', () => designer.setRelation(id, relation.value));
  const relationRow = setting(el, 'data', 'Links to', relation);
  const currency = el('input', { class: 'fd-input', 'aria-label': 'Currency', maxlength: '3', placeholder: 'USD' });
  // Only a whole code: two letters on the way to three are not a currency yet.
  currency.addEventListener('input', () => currency.value.trim().length === 3 && designer.setCurrency(id, currency.value));
  const currencyRow = setting(el, 'data', 'Currency', currency);

  const element = el(
    'div',
    { class: 'fd-props' },
    setting(el, 'content', 'Label', label),
    setting(el, 'content', 'Help text', help),
    placeholderRow,
    setting(el, 'content', 'Shown as', kind, { hint: kindNote }),
    optionsRow,
    onTab(lineColumns.element, 'content', 'Columns'),
    onTab(el('div', { class: 'fd-props-actions' }, duplicate, remove), 'content', 'Duplicate or delete'),
    ...width.rows,
    ...labels.rows,
    setting(el, 'layout', 'Section', section),
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('div', { class: 'fd-q-required-row' }, el('label', { class: 'fd-q-required' }, required, el('span', {}, 'Required')), requiredOnly), requiredWhen.element), 'rules', 'Required'),
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, readonlyWhen.element, readonlyOnly), 'rules', 'Read-only'),
    whenBox,
    ...own.rows,
    setting(el, 'data', 'Field name', name, { hint: nameHint }),
    setting(el, 'data', 'Stored as', stored, { hint: fromModelNote }),
    relationRow,
    currencyRow
  );

  return {
    element,
    update(page) {
      const found = findField(page, id);
      if (!found) return;
      const def = page.fields[found.node.field];
      const fromModel = designer.isFromModel(id);
      if (!focused(label)) label.value = found.node.label ?? def.label;
      if (!focused(help)) help.value = found.node.help ?? def.help ?? '';
      placeholderRow.hidden = !TAKES_PLACEHOLDER.has(def.type) || !!found.node.widget && !['email', 'phone', 'url'].includes(found.node.widget);
      if (!focused(placeholder)) placeholder.value = found.node.placeholder ?? '';
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
      options.update(def, found.node);
      options.element.hidden ||= fromModel;
      optionsRow.hidden = options.element.hidden;
      lineColumns.update(def);
      lineColumns.element.hidden ||= fromModel;

      // Layout.
      width.update(page);
      labels.update(page);
      section.replaceChildren(...allSections(page).map((s) => el('option', { value: s.id }, sectionLabel(page, s))));
      section.value = found.section.id;

      // Rules.
      required.checked = def.required === true || found.node.required === true;
      const others = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && n.id !== id && choicesOf(page.fields[n.field]) !== null));
      requiredWhen.update(page, others, found.node.required);
      requiredOnly.hidden = required.checked || !requiredWhen.element.hidden || !requiredWhen.canStart();
      readonlyWhen.update(page, others, found.node.readonly);
      readonlyOnly.hidden = !readonlyWhen.element.hidden || !readonlyWhen.canStart();
      when.update(page, others, found.node.invisible);
      showWhen.hidden = !when.element.hidden || !when.canStart();
      noRules.hidden = !when.element.hidden || when.canStart();
      own.update(page);

      // Data.
      name.textContent = found.node.field;
      nameHint.textContent = fromModel ? 'From your model: it keeps its name.' : 'What the answer is stored under.';
      stored.textContent = fromModel ? `${capital(storedAs(def))} · from your model` : capital(storedAs(def));
      // What the model keeps for itself, for the kind of field this is.
      const kept = def.type === 'selection' ? 'Its options come from the model.' : def.type === 'monetary' ? 'Its currency comes from the model.' : ['many2one', 'many2many', 'one2many'].includes(def.type) ? 'The records it points to come from the model.' : '';
      fromModelNote.textContent = kept;
      fromModelNote.hidden = !fromModel || !kept;
      relationRow.hidden = !('relation' in def) || fromModel;
      if (!focused(relation)) relation.value = 'relation' in def ? def.relation : '';
      currencyRow.hidden = def.type !== 'monetary' || fromModel;
      if (!focused(currency)) currency.value = def.type === 'monetary' ? (def.currency ?? '') : '';
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

/** "an amount" as a value is said on its own: "An amount". */
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
