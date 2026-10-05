import type { FieldNode } from '@fieldia/core';
import { appKindPanel } from './app-kinds-ui';
import { optionsEditor, type ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import type { Designer } from './designer';
import { kindsReason } from './field-bar';
import { inlineSettings } from './inline-settings';
import { kindName, kindOfField, storedAs } from './kinds';
import { onTab, setting } from './panel-controls';
import { labelsSetting, widthSetting } from './panel-layout';
import { allSections, findField, sectionLabel } from './page-tree';
import { fieldRules } from './rules-panel';
import type { SampleOptions } from './rules-sample';
import type { PropertiesView } from './screen-properties';

/**
 * A field's settings, on the panel's tabs: its words and how it is shown
 * (Content), how wide it is and where it sits (Layout), when it shows and
 * must be answered (Rules), and what it is stored as (Data).
 */

/** The kinds whose empty box shows words of their own. */
const TAKES_PLACEHOLDER = new Set(['char', 'text', 'integer', 'float', 'monetary']);

export function fieldProperties(el: ElementFactory, designer: Designer, id: string, sampling: SampleOptions = {}): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const w = designer.words.panel;

  // ---- Content: its words, and how it is shown ----
  const label = el('input', { class: 'fd-input fd-prop-label', 'aria-label': w.label });
  label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
  const help = el('input', { class: 'fd-input', 'aria-label': w.helpText, placeholder: w.optional });
  help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
  const placeholder = el('input', { class: 'fd-input', 'aria-label': w.placeholder, placeholder: w.placeholderHint });
  placeholder.addEventListener('input', () => designer.updateQuestion(id, { placeholder: placeholder.value }));
  const placeholderRow = setting(el, 'content', 'Placeholder', placeholder, { words: w.placeholder });
  // Only the kinds that suit what the field holds, as the bar on the canvas offers them, and why.
  const kind = el('select', { class: 'fd-input fd-select', 'aria-label': w.shownAs });
  kind.addEventListener('change', () => designer.changeKind(id, kind.value));
  const kindNote = el('p', { class: 'fd-properties-hint fd-kind-note' });
  const appSettings = appKindPanel(el, designer, id);
  const options = optionsEditor(el, designer, id);
  const optionsRow = setting(el, 'content', 'Options', options.element, { words: w.options });
  // Its kind's own settings — levels, a range, the files it takes, a link's records, a table's columns — the card's own, here too.
  const kindOwn = inlineSettings(el, designer, id);
  const ownKind = el('span', { class: 'fd-prop-name' });
  const kindRow = onTab(el('div', { class: 'fd-prop fd-prop-kind' }, ownKind, kindOwn.element), 'content', 'Settings for its kind');
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, w.duplicate);
  duplicate.addEventListener('click', () => {
    const copy = designer.duplicateNode(id);
    if (copy) designer.select(copy);
  });
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.deleteField);
  remove.addEventListener('click', () => designer.removeNode(id));

  // ---- Layout: how wide it is, and where it sits ----
  const width = widthSetting(el, designer, id);
  const labels = labelsSetting(el, designer, id, 'field');
  const section = el('select', { class: 'fd-input fd-select', 'aria-label': w.section });
  section.addEventListener('change', () => {
    const target = allSections(designer.getPage()).find((s) => s.id === section.value);
    if (target) designer.placeNode(id, target.id, target.children.length);
  });

  // ---- Rules: required, read-only, when it shows ----
  const required = el('input', { type: 'checkbox', 'aria-label': w.required, 'data-required': '' });
  required.addEventListener('change', () => {
    // Read before anything redraws the panel.
    const always = required.checked;
    // Required always, or not at all: a rule for it goes.
    if (requiredWhen.element.hidden === false) designer.setRule(id, 'required', null);
    designer.updateQuestion(id, { required: always });
  });
  // Required, or read-only, only when a rule holds.
  const requiredWhen = conditionEditor(el, designer, id, 'question', 'required');
  const requiredOnly = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when', 'aria-label': w.requiredOnlyWhen }, w.onlyWhen);
  requiredOnly.addEventListener('click', () => requiredWhen.start());
  const readonlyWhen = conditionEditor(el, designer, id, 'question', 'readonly');
  const readonlyOnly = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, w.readonlyWhen);
  readonlyOnly.addEventListener('click', () => readonlyWhen.start());
  // When it shows: rules on the other fields that hold one of a list, or yes or no.
  const when = conditionEditor(el, designer, id, 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, w.showOnlyWhen);
  showWhen.addEventListener('click', () => when.start());
  const noRules = el('p', { class: 'fd-properties-hint', hidden: '' }, w.noRulesField);
  const whenBox = onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, w.whenItShows), when.element, showWhen, noRules), 'rules', 'When it shows');
  // Worked out from others, set when, and the rules its answer keeps.
  const own = fieldRules(el, designer, id, sampling);

  // ---- Data: what it is stored under and as ----
  const name = el('code', { class: 'fd-insp-code' });
  const nameHint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const stored = el('span', { class: 'fd-insp-chip' });
  const fromModelNote = el('p', { class: 'fd-properties-hint fd-set-hint', hidden: '' });

  const element = el(
    'div',
    { class: 'fd-props' },
    setting(el, 'content', 'Label', label, { words: w.label }),
    setting(el, 'content', 'Help text', help, { words: w.helpText }),
    placeholderRow,
    setting(el, 'content', 'Shown as', kind, { hint: kindNote, words: w.shownAs }),
    appSettings.element,
    optionsRow,
    kindRow,
    onTab(el('div', { class: 'fd-props-actions' }, duplicate, remove), 'content', 'Duplicate or delete'),
    ...width.rows,
    ...labels.rows,
    setting(el, 'layout', 'Section', section, { words: w.section }),
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('div', { class: 'fd-q-required-row' }, el('label', { class: 'fd-q-required' }, required, el('span', {}, w.required)), requiredOnly), requiredWhen.element), 'rules', 'Required'),
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, readonlyWhen.element, readonlyOnly), 'rules', 'Read-only'),
    whenBox,
    ...own.rows,
    setting(el, 'data', 'Field name', name, { hint: nameHint, words: w.fieldName }),
    setting(el, 'data', 'Stored as', stored, { hint: fromModelNote, words: w.storedAs })
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
        kind.replaceChildren(...offered.map((k) => el('option', { value: k.id }, kindName(k, designer.words))));
      }
      kind.value = current ?? '';
      kind.disabled = current === null || offered.length < 2;
      kindNote.textContent = kindsReason(designer, page, id);
      appSettings.update(page, found.node);
      options.update(def, found.node);
      options.element.hidden ||= fromModel;
      optionsRow.hidden = options.element.hidden;
      kindOwn.update(page, found.node);
      kindRow.hidden = kindOwn.element.hidden;
      const shownKind = offered.find((k) => k.id === current);
      ownKind.textContent = shownKind ? kindName(shownKind, designer.words) : '';

      // Layout.
      width.update(page);
      labels.update(page);
      section.replaceChildren(...allSections(page).map((s) => el('option', { value: s.id }, sectionLabel(page, s, designer.words))));
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
      nameHint.textContent = fromModel ? w.keepsName : w.storedUnder;
      stored.textContent = fromModel ? w.fromYourModel(capital(storedAs(def, designer.words))) : capital(storedAs(def, designer.words));
      // What the model keeps for itself, for the kind of field this is.
      const kept = def.type === 'selection' ? w.optionsFromModel : def.type === 'monetary' ? w.currencyFromModel : ['many2one', 'many2many', 'one2many'].includes(def.type) ? w.recordsFromModel : '';
      fromModelNote.textContent = kept;
      fromModelNote.hidden = !fromModel || !kept;
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
    destroy: () => own.destroy(),
  };
}

/** "an amount" as a value is said on its own: "An amount". */
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
