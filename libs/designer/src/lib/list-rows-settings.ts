import type { ButtonNode, ListNode, Modifier, Page, Tone, ToneWhen } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { RowRulesPatch } from './list-commands';
import { formulaProblem } from './rules-formula';
import { formulaBox, type FormulaBox } from './rules-formula-box';

/**
 * A list's rows in its panel: each row's tone while a condition on its record
 * holds (the first that holds), its words in bold while one does, and the
 * buttons on each row — their words, the app's action and when each is hidden
 * — as a table of lines sets its own (table-panel.ts), read on the row's
 * record. A related list's panel has the same, read on its own records.
 */

const TONES: Tone[] = ['danger', 'warning', 'success', 'info', 'muted'];
const listOf = (page: Page) => page.layout as ListNode;

/** Rows' own rules as a list holds them: a list page's list, or a related list. */
interface RowRules {
  rowTones?: ToneWhen[];
  rowBold?: Modifier;
  rowBoldLabel?: string;
  rowButtons?: ButtonNode[];
}

/** Where a list's rows' own rules are kept, and what their conditions read. */
export interface RowsSource {
  /** Its rules as the page holds them. */
  rules(page: Page): RowRules;
  /** Its rules changed; false where the change was refused. */
  set(patch: RowRulesPatch): boolean;
  /** A page whose fields are its records': the list page itself, or one of a related list's own fields. */
  reads(page: Page): Page;
}

/** A list page's rows in its panel. */
export function rowsSection(el: ElementFactory, designer: Designer) {
  return rowSettings(el, designer, { rules: (page) => listOf(page), set: (patch) => designer.setListOptions(patch), reads: (page) => page });
}

/** Rows' own rules — tones, bold and buttons, read on each row's record — over where they are kept. */
export function rowSettings(el: ElementFactory, designer: Designer, source: RowsSource) {
  const words = designer.words;
  const w = words.tables;
  const own = words.list.rows;
  const page = () => designer.getPage();
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const list = () => source.rules(page());
  const condition = (label: string, commit: (source: string) => void) => formulaBox(el, { words, label, placeholder: w.whenPlaceholder, check: (on, source) => formulaProblem(on, source, words, designer.functions()), commit });

  // ---- each row's tone, the first that holds ----
  const tonesList = el('ul', { class: 'fd-table-tones' });
  const addTone = el('button', { type: 'button', class: 'fd-button fd-button-link fd-table-add-tone' }, w.addTone);
  let drafting = false;
  const toneRows: { element: HTMLElement; tone: HTMLSelectElement; when: FormulaBox; says: HTMLInputElement }[] = [];
  const saveTones = (tones: ToneWhen[]) => source.set({ rowTones: tones.length ? tones : null });
  addTone.addEventListener('click', () => {
    drafting = true;
    drawTones();
    toneRows[toneRows.length - 1]?.when.input.focus();
  });
  function toneRow(index: number) {
    const tone = el('select', { class: 'fd-input fd-select fd-table-tone', 'aria-label': w.toneOf }, ...TONES.map((t) => el('option', { value: t }, w.tones[t]))) as HTMLSelectElement;
    // Its words for the key over the rows, kept as they are left.
    const says = el('input', { class: 'fd-input fd-table-tone-says', 'aria-label': own.toneSays, placeholder: own.saysPlaceholder }) as HTMLInputElement;
    const keep = (when: string) => {
      if (!when) return;
      const items = [...(list().rowTones ?? [])];
      const begun = index >= items.length;
      const label = says.value.trim();
      items[index] = { tone: tone.value as Tone, when, ...(label ? { label } : {}) };
      if (begun) drafting = false;
      if (!saveTones(items) && begun) drafting = true;
    };
    const when = condition(w.when, keep);
    tone.addEventListener('change', () => keep(when.input.value.trim()));
    says.addEventListener('change', () => keep(when.input.value.trim() || String(list().rowTones?.[index]?.when ?? '')));
    const remove = iconButton(el, w.removeTone(index + 1), '×', () => {
      if (index >= (list().rowTones ?? []).length) {
        drafting = false;
        return drawTones();
      }
      saveTones((list().rowTones ?? []).filter((_, i) => i !== index));
    });
    return {
      element: el('li', { class: 'fd-table-tone-row' }, tone, el('div', { class: 'fd-table-tone-when' }, when.element, when.problem, el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, own.says), says)), remove),
      tone,
      when,
      says,
    };
  }
  function drawTones() {
    const items = list().rowTones ?? [];
    const count = items.length + (drafting ? 1 : 0);
    while (toneRows.length > count) toneRows.pop()?.element.remove();
    while (toneRows.length < count) {
      const made = toneRow(toneRows.length);
      toneRows.push(made);
      tonesList.append(made.element);
    }
    toneRows.forEach((row, i) => {
      const item = items[i];
      if (!focused(row.tone)) row.tone.value = item?.tone ?? 'danger';
      if (!focused(row.says)) row.says.value = item?.label ?? '';
      row.when.update(source.reads(page()), item ? String(item.when) : row.when.input.value);
    });
    tonesList.hidden = !count;
    addTone.hidden = drafting;
  }

  // ---- each row in bold while a condition holds ----
  const bold = condition(w.boldWhen, (said) => source.set({ rowBold: said || null }));
  const boldSays = el('input', { class: 'fd-input', 'aria-label': own.boldSays, placeholder: own.boldPlaceholder }) as HTMLInputElement;
  boldSays.addEventListener('change', () => source.set({ rowBoldLabel: boldSays.value.trim() || null }));
  const boldSaysRow = el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, own.says), boldSays);
  const boldRow = el('div', { class: 'fd-answer-rule-field fd-table-when' }, el('span', { class: 'fd-answer-rule-word' }, w.boldWhen), bold.element, bold.problem, boldSaysRow);

  // ---- the buttons on each row ----
  const buttonsList = el('ul', { class: 'fd-table-buttons', 'data-place': 'rowButtons' });
  const addButton = el('button', { type: 'button', class: 'fd-button fd-button-link' }, own.addButton);
  const plain = (buttons: ButtonNode[]) => buttons.map((b) => ({ id: b.id, label: b.label, ...(b.action ? { action: b.action } : {}), ...(typeof b.invisible === 'string' ? { invisible: b.invisible } : {}) }));
  const saveButtons = (buttons: ReturnType<typeof plain>) => source.set({ rowButtons: buttons.length ? buttons : null });
  addButton.addEventListener('click', () => {
    saveButtons([...plain(list().rowButtons ?? []), { id: '', label: w.newButton }]);
    (buttonsList.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
  });
  const drawn: { element: HTMLElement; label: HTMLInputElement; action: HTMLInputElement; hidden: FormulaBox; remove: HTMLButtonElement }[] = [];
  function drawButtons() {
    const items = list().rowButtons ?? [];
    while (drawn.length > items.length) drawn.pop()?.element.remove();
    while (drawn.length < items.length) {
      const index = drawn.length;
      const change = (patch: { label?: string; action?: string; invisible?: string }) => saveButtons(plain(list().rowButtons ?? []).map((b, i) => (i === index ? { ...b, ...patch } : b)));
      const label = el('input', { class: 'fd-input', 'aria-label': w.buttonWords }) as HTMLInputElement;
      label.addEventListener('input', () => label.value.trim() && change({ label: label.value }));
      const action = el('input', { class: 'fd-input fd-answer-rule-code', 'aria-label': w.action, spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
      action.addEventListener('change', () => change({ action: action.value.trim() }));
      const hidden = condition(w.hiddenWhen, (said) => change({ invisible: said }));
      const remove = iconButton(el, w.removeButton(items[index]?.label ?? ''), '×', () => saveButtons(plain(list().rowButtons ?? []).filter((_, i) => i !== index)));
      const element = el(
        'li',
        { class: 'fd-table-button' },
        el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.buttonWords), label),
        el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.action), action),
        el('div', { class: 'fd-answer-rule-field fd-table-when' }, el('span', { class: 'fd-answer-rule-word' }, w.hiddenWhen), hidden.element, hidden.problem),
        remove
      );
      drawn.push({ element, label, action, hidden, remove });
      buttonsList.append(element);
    }
    drawn.forEach((row, i) => {
      const item = items[i];
      if (!focused(row.label)) row.label.value = item.label;
      if (!focused(row.action)) row.action.value = item.action ?? '';
      row.hidden.update(source.reads(page()), typeof item.invisible === 'string' ? item.invisible : '');
      row.remove.setAttribute('aria-label', w.removeButton(item.label));
      row.remove.title = w.removeButton(item.label);
    });
  }

  const element = el(
    'div',
    { class: 'fd-prop', 'data-part': 'rows' },
    el('span', { class: 'fd-prop-name' }, own.title),
    el('div', { class: 'fd-table-tone-list' }, tonesList, addTone),
    el('p', { class: 'fd-properties-hint' }, own.toneHint),
    boldRow,
    el('p', { class: 'fd-properties-hint' }, own.saysHint),
    el('div', { class: 'fd-table-button-place' }, el('span', { class: 'fd-answer-rule-word' }, own.buttons), buttonsList, addButton),
    el('p', { class: 'fd-properties-hint' }, own.buttonsHint)
  );
  return {
    element,
    update(next: Page) {
      drawTones();
      const said = source.rules(next).rowBold;
      bold.update(source.reads(next), typeof said === 'string' ? said : '');
      // Its words, offered while there is a bold to name.
      boldSaysRow.hidden = typeof said !== 'string';
      if (!focused(boldSays)) boldSays.value = source.rules(next).rowBoldLabel ?? '';
      drawButtons();
    },
  };
}
