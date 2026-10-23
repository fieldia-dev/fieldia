import type { FieldNode, InputMode, JsonValue } from '@fieldia/core';
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
import { whenItChanges } from './steps-panel';
import type { SampleOptions } from './rules-sample';
import type { PropertiesView } from './screen-properties';
import { printSetting } from './print-setting';
import { rolesSetting } from './roles-setting';
import { tableSettings } from './table-panel';
import { shownWhileSetting } from './shown-while';
import { fieldHotkeySetting } from './head-properties';
import { placeholderWhenList } from './placeholder-when';
import { withAnswers } from './answer-picker';
import { removeWithUndo } from './deleted-toast';

/**
 * A field's settings, on the panel's tabs: its words and how it is shown
 * (Content), how wide it is and where it sits (Layout), when it shows and
 * must be answered and what its change does (Rules), and what it is stored as (Data).
 */

/** The kinds whose empty box shows words of their own. */
const TAKES_PLACEHOLDER = new Set(['char', 'text', 'integer', 'float', 'monetary']);
/** The kinds typed into a box, as their type draws them or as a line's email, phone, web address or password. */
const TYPED = new Set(['char', 'text', 'integer', 'float', 'monetary', 'date', 'datetime']);
const TYPED_WIDGETS = new Set(['email', 'phone', 'url', 'password']);

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
  // Other words while a condition holds: a company's name or a person's.
  const placeholderWhen = placeholderWhenList(el, designer, id);
  // The field that takes the focus as the record opens, as Flectra's default_focus.
  const focusBox = el('input', { type: 'checkbox', class: 'fd-checkbox', 'aria-label': w.focusOnOpen }) as HTMLInputElement;
  focusBox.addEventListener('change', () => designer.updateQuestion(id, { focus: focusBox.checked }));
  const focusRow = setting(el, 'content', 'Focused as the record opens', focusBox, { words: w.focusOnOpen, hint: w.focusOnOpenHint });
  const placeholderRow = setting(el, 'content', 'Placeholder', [placeholder, el('span', { class: 'fd-answer-rule-word' }, w.placeholderWhen), placeholderWhen.element], { words: w.placeholder });
  // What the browser fills its box in with, from what the person saved, and the keyboard a phone shows for it.
  const purpose = el('select', { class: 'fd-input fd-select', 'aria-label': w.filledInAs }) as HTMLSelectElement;
  purpose.addEventListener('change', () => designer.updateQuestion(id, { autocomplete: purpose.value }));
  const purposeRow = setting(el, 'content', 'Filled in by the browser as', purpose, { hint: w.filledInHint, words: w.filledInAs });
  const keyboard = el('select', { class: 'fd-input fd-select', 'aria-label': w.keyboard }, ...Object.entries(w.keyboards).map(([value, words]) => el('option', { value }, words))) as HTMLSelectElement;
  keyboard.addEventListener('change', () => designer.updateQuestion(id, { inputmode: keyboard.value as InputMode | '' }));
  const keyboardRow = setting(el, 'content', 'Keyboard on a phone', keyboard, { hint: w.keyboardHint, words: w.keyboard });
  // Scanned with the camera (`options.scan`): a Scan button beside its box; a link's record found by the field of its
  // records holding their codes. Settings beyond these (formats, a GS1 code's parts, a table counted) are the JSON's.
  const scanSwitch = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': w.scanWithCamera }) as HTMLButtonElement;
  scanSwitch.addEventListener('click', () => designer.setWidgetOptions(id, { scan: scanSwitch.getAttribute('aria-checked') === 'true' ? null : true }));
  const scanRow = setting(el, 'content', 'Scan with the camera', scanSwitch, { hint: w.scanHint, words: w.scanWithCamera });
  const codeField = el('input', { class: 'fd-input', 'aria-label': w.scanCodeField, placeholder: 'barcode', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  codeField.addEventListener('input', () => {
    const scan = findField(designer.getPage(), id)?.node.options?.['scan'];
    const { by: _by, ...rest } = scan && typeof scan === 'object' && !Array.isArray(scan) ? (scan as Record<string, JsonValue>) : {};
    const by = codeField.value.trim();
    const next = by ? { ...rest, by } : rest;
    designer.setWidgetOptions(id, { scan: Object.keys(next).length ? next : true });
  });
  const codeFieldRow = setting(el, 'content', 'Code kept in', codeField, { hint: w.scanCodeFieldHint, words: w.scanCodeField });
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
  remove.addEventListener('click', () => removeWithUndo(designer, id));

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
  // Why, in plain words, while its rule keeps it read-only: said by the lock by its label.
  const readonlyReason = el('input', { class: 'fd-input', 'aria-label': w.readonlyReason, placeholder: w.readonlyReasonHint, autocomplete: 'off' }) as HTMLInputElement;
  readonlyReason.addEventListener('input', () => designer.updateQuestion(id, { readonlyReason: readonlyReason.value }));
  const readonlyReasonRow = el('label', { class: 'fd-q-reason' }, el('span', { class: 'fd-prop-name' }, w.readonlyReason), readonlyReason);
  // When it shows: rules on the other fields that hold one of a list, or yes or no.
  const when = conditionEditor(el, designer, id, 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, w.showOnlyWhen);
  showWhen.addEventListener('click', () => when.start());
  const noRules = el('p', { class: 'fd-properties-hint', hidden: '' }, w.noRulesField);
  const roles = rolesSetting(el, designer, id);
  const paper = printSetting(el, designer, id);
  const shownWhile = shownWhileSetting(el, designer, id);
  const whenBox = onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, w.whenItShows), when.element, showWhen, noRules), 'rules', 'When it shows');
  // Worked out from others, set when, and the rules its answer keeps.
  const own = fieldRules(el, designer, id, sampling);
  // steps lane: what a person's change of it does.
  const changes = whenItChanges(el, designer, id);
  // tables lane: its value's tone; a table's line rules, buttons and shape; the widths it is hidden at.
  const table = tableSettings(el, designer, id);
  // Its access key: a letter of its label, Alt with it focusing the field (head-properties.ts).
  const accessKey = fieldHotkeySetting(el, designer, id);

  // ---- Data: what it is stored under and as ----
  const name = el('code', { class: 'fd-insp-code' });
  const nameHint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const stored = el('span', { class: 'fd-insp-chip' });
  const fromModelNote = el('p', { class: 'fd-properties-hint fd-set-hint', hidden: '' });

  const element = el(
    'div',
    { class: 'fd-props' },
    // Words that may show an answer given — "How was your visit to {branch}?" — with a button that puts one in (answer-picker.ts).
    setting(el, 'content', 'Label', withAnswers(el, designer, label), { words: w.label }),
    setting(el, 'content', 'Help text', withAnswers(el, designer, help), { words: w.helpText }),
    placeholderRow,
    purposeRow,
    keyboardRow,
    scanRow,
    codeFieldRow,
    focusRow,
    ...accessKey.rows,
    setting(el, 'content', 'Shown as', kind, { hint: kindNote, words: w.shownAs }),
    appSettings.element,
    optionsRow,
    kindRow,
    onTab(el('div', { class: 'fd-props-actions' }, duplicate, remove), 'content', 'Duplicate or delete'),
    ...width.rows,
    ...labels.rows,
    setting(el, 'layout', 'Section', section, { words: w.section }),
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, el('div', { class: 'fd-q-required-row' }, el('label', { class: 'fd-q-required' }, required, el('span', {}, w.required)), requiredOnly), requiredWhen.element), 'rules', 'Required'),
    onTab(el('div', { class: 'fd-prop fd-prop-when' }, readonlyWhen.element, readonlyOnly, readonlyReasonRow), 'rules', 'Read-only'),
    whenBox,
    roles.element,
    shownWhile.element,
    paper.element,
    ...own.rows,
    changes.element,
    ...table.rows,
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
      if (!placeholderRow.hidden) placeholderWhen.update(page);
      // A box typed in, a list to choose from, an address in parts (whose it is, before each part's own).
      const widget = found.node.widget;
      const address = def.type === 'json' && widget === 'address';
      const typed = TYPED.has(def.type) && (!widget || TYPED_WIDGETS.has(widget));
      purposeRow.hidden = !(typed || address || (def.type === 'selection' && !widget && !def.multiple));
      keyboardRow.hidden = !typed;
      const filled = found.node.autocomplete ?? '';
      const purposes = address ? w.addressPurposes : w.purposes;
      // One the page names that the list does not offer is kept, as it is written.
      const shown = Object.prototype.hasOwnProperty.call(purposes, filled) ? Object.entries(purposes) : [...Object.entries(purposes), [filled, filled]];
      const purposeKey = JSON.stringify(shown);
      if (purpose.dataset['offered'] !== purposeKey) {
        purpose.dataset['offered'] = purposeKey;
        purpose.replaceChildren(...shown.map(([value, words]) => el('option', { value }, words)));
      }
      purpose.value = filled;
      keyboard.value = found.node.inputmode ?? '';
      // A box a code is written into: words, or a link's record.
      const scan = found.node.options?.['scan'];
      const scannable = (def.type === 'char' && (!widget || ['email', 'phone', 'url'].includes(widget))) || ((def.type === 'text' || def.type === 'many2one') && !widget);
      scanRow.hidden = !scannable;
      scanSwitch.setAttribute('aria-checked', String(!!scan));
      codeFieldRow.hidden = !scannable || !scan || def.type !== 'many2one';
      const by = scan && typeof scan === 'object' && !Array.isArray(scan) ? (scan as { by?: unknown }).by : undefined;
      if (!focused(codeField)) codeField.value = typeof by === 'string' ? by : '';
      focusBox.checked = found.node.focus === true;
      accessKey.update(page);
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
      // Only a field a rule makes read-only has anything to say why.
      readonlyReasonRow.hidden = found.node.readonly === undefined || found.node.readonly === false;
      if (!focused(readonlyReason)) readonlyReason.value = found.node.readonlyReason ?? '';
      when.update(page, others, found.node.invisible);
      roles.update(page);
      paper.update(page);
      shownWhile.update(page);
      showWhen.hidden = !when.element.hidden || !when.canStart();
      noRules.hidden = !when.element.hidden || when.canStart();
      own.update(page);
      changes.update(page);
      table.update(page);

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
