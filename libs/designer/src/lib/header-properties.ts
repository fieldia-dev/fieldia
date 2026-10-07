import type { Alert, ButtonNode, FieldNode, Page, Ribbon, SheetNode, StatButton, Tone } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import type { Designer } from './designer';
import { findHeaderPart, wordsOf } from './header-commands';
import { allSections } from './page-tree';
import { whenClicked } from './steps-panel';
import type { PropertiesView } from './screen-properties';
import { rolesSetting } from './roles-setting';
import { hotkeyShown } from './hotkey-setting';
import { shownWhileSetting } from './shown-while';

/**
 * The panel for a part of a record's header: a button, a counter or a badge
 * — its words, what it does, how it looks and when it shows — and for the
 * status steps: which field, whether a step can be clicked, and where they sit.
 */

const prop = (el: ElementFactory, text: string, control: HTMLElement) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
const select = (el: ElementFactory, label: string, options: [string, string][]) =>
  el('select', { class: 'fd-input fd-select', 'aria-label': label }, ...options.map(([value, text]) => el('option', { value }, text))) as HTMLSelectElement;

/** The fields a rule can test: those holding one of a list, or yes or no, on the page or as its status steps. */
function testable(page: Page): FieldNode[] {
  const nodes = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field'));
  const root = page.layout as SheetNode;
  const steps: FieldNode[] = root.statusbar ? [{ type: 'field', id: '#statusbar', field: root.statusbar.field }] : [];
  return [...steps, ...nodes].filter((n) => choicesOf(page.fields[n.field]) !== null);
}

export function headerPartProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const w = designer.words.panel;
  const words = el('input', { class: 'fd-input', 'aria-label': w.words }) as HTMLInputElement;
  words.addEventListener('input', () => designer.updateHeaderPart(id, { label: words.value }));
  // steps lane: what a button or a counter does when clicked, its app action one of the steps.
  const kindNow = findHeaderPart(designer.getPage(), id)?.kind;
  const pressed = kindNow === 'button' || kindNow === 'stat' ? whenClicked(el, designer, id) : null;
  const look = select(el, w.look, [['secondary', w.buttonLooks.secondary], ['primary', w.buttonLooks.primary], ['danger', w.buttonLooks.danger], ['link', w.buttonLooks.link]]);
  look.addEventListener('change', () => designer.updateHeaderPart(id, { style: look.value as ButtonNode['style'] }));
  const lookRow = prop(el, w.look, look);
  const asks = el('input', { class: 'fd-input', 'aria-label': w.asksFirst, placeholder: w.actsAtOnce }) as HTMLInputElement;
  asks.addEventListener('input', () => designer.updateHeaderPart(id, { confirm: asks.value }));
  const asksRow = prop(el, w.asksFirst, asks);
  // A key that presses it with Alt, as Flectra's hotkeys.
  const hotkey = el('input', { class: 'fd-input fd-hotkey-input', 'aria-label': w.hotkey, placeholder: 'V', autocomplete: 'off', spellcheck: 'false', maxlength: '11' }) as HTMLInputElement;
  hotkey.addEventListener('change', () => designer.updateHeaderPart(id, { hotkey: hotkey.value }));
  const hotkeyRow = el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.hotkey), hotkey, el('p', { class: 'fd-properties-hint' }, w.hotkeyHint));
  const count = el('select', { class: 'fd-input fd-select', 'aria-label': w.numberFrom }) as HTMLSelectElement;
  count.addEventListener('change', () => designer.updateHeaderPart(id, { field: count.value }));
  const countRow = prop(el, w.numberFrom, count);
  // A counter's value written as its field shows it, with a unit, its words from a field, and a second value.
  const fieldSelect = (label: string, key: 'unitField' | 'labelField' | 'secondField') => {
    const box = el('select', { class: 'fd-input fd-select', 'aria-label': label }) as HTMLSelectElement;
    box.addEventListener('change', () => designer.updateHeaderPart(id, { [key]: box.value }));
    return box;
  };
  const unit = el('input', { class: 'fd-input', 'aria-label': w.unitWords, placeholder: w.optional }) as HTMLInputElement;
  unit.addEventListener('input', () => designer.updateHeaderPart(id, { unit: unit.value }));
  const unitField = fieldSelect(w.unitFrom, 'unitField');
  const labelField = fieldSelect(w.labelFrom, 'labelField');
  const secondField = fieldSelect(w.secondFrom, 'secondField');
  const secondLabel = el('input', { class: 'fd-input', 'aria-label': w.secondWords, placeholder: w.secondWordsHint }) as HTMLInputElement;
  secondLabel.addEventListener('input', () => designer.updateHeaderPart(id, { secondLabel: secondLabel.value }));
  const statRows = [prop(el, w.unitWords, unit), prop(el, w.unitFrom, unitField), prop(el, w.labelFrom, labelField), prop(el, w.secondFrom, secondField), prop(el, w.secondWords, secondLabel)];
  const tone = select(el, w.tone, [['muted', w.tones.muted], ['info', w.tones.info], ['success', w.tones.success], ['warning', w.tones.warning], ['danger', w.tones.danger]]);
  tone.addEventListener('change', () => designer.updateHeaderPart(id, { tone: tone.value as Tone }));
  const toneRow = prop(el, w.tone, tone);
  // A ribbon's or an alert's words from a field, a ribbon's tooltip, an alert's ×, a field's value put in the words, an alert's own buttons.
  const wordsFrom = el('select', { class: 'fd-input fd-select', 'aria-label': w.wordsFrom }) as HTMLSelectElement;
  wordsFrom.addEventListener('change', () => designer.updateHeaderPart(id, { wordsField: wordsFrom.value }));
  const wordsFromRow = el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.wordsFrom), wordsFrom, el('p', { class: 'fd-properties-hint' }, w.wordsFromHint));
  const tooltip = el('input', { class: 'fd-input', 'aria-label': w.tooltip, placeholder: w.optional }) as HTMLInputElement;
  tooltip.addEventListener('input', () => designer.updateHeaderPart(id, { tooltip: tooltip.value }));
  const tooltipRow = prop(el, w.tooltip, tooltip);
  const closes = el('input', { type: 'checkbox', 'aria-label': w.canBeClosed }) as HTMLInputElement;
  closes.addEventListener('change', () => designer.updateHeaderPart(id, { dismissible: closes.checked }));
  const closesRow = el('label', { class: 'fd-q-required' }, closes, el('span', {}, w.canBeClosed));
  const value = el('select', { class: 'fd-input fd-select', 'aria-label': w.showValue }) as HTMLSelectElement;
  value.addEventListener('change', () => {
    const found = findHeaderPart(designer.getPage(), id);
    if (found && value.value) designer.updateHeaderPart(id, { label: `${wordsOf(found.part).trimEnd()} {${value.value}}`.trimStart() });
    value.value = '';
  });
  const valueRow = el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.showValue), value, el('p', { class: 'fd-properties-hint' }, w.valueHint));
  const buttonsList = el('div', { class: 'fd-alert-buttons' });
  const addInside = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.addButtonInside);
  addInside.addEventListener('click', () => {
    const made = designer.addAlertButton(id, designer.words.defaults.newButton);
    if (made) (buttonsList.querySelector(`[data-button="${made}"] input`) as HTMLInputElement | null)?.focus();
  });
  const buttonsRow = el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.buttonsInside), buttonsList, addInside);
  let buttonsDrawn = '';
  const when = conditionEditor(el, designer, id, 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, w.showOnlyWhen);
  showWhen.addEventListener('click', () => when.start());
  const roles = rolesSetting(el, designer, id, { tabbed: false });
  const shownWhile = shownWhileSetting(el, designer, id, { tabbed: false });
  const left = el('button', { type: 'button', class: 'fd-button' }, w.moveLeft);
  const right = el('button', { type: 'button', class: 'fd-button' }, w.moveRight);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.delete);
  left.addEventListener('click', () => designer.moveHeaderPart(id, -1));
  right.addEventListener('click', () => designer.moveHeaderPart(id, 1));
  remove.addEventListener('click', () => designer.removeHeaderPart(id));
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.words, words),
    ...(pressed ? [pressed.element] : []),
    lookRow,
    asksRow,
    hotkeyRow,
    countRow,
    ...statRows,
    toneRow,
    wordsFromRow,
    valueRow,
    tooltipRow,
    closesRow,
    buttonsRow,
    el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, w.whenItShows), when.element, showWhen),
    roles.element,
    shownWhile.element,
    el('div', { class: 'fd-props-actions' }, left, right, remove)
  );

  return {
    element,
    update(page) {
      const found = findHeaderPart(page, id);
      if (!found) return;
      const { kind, part, index, list } = found;
      if (!focused(words)) words.value = wordsOf(part);
      pressed?.update(page);
      lookRow.hidden = asksRow.hidden = hotkeyRow.hidden = kind !== 'button';
      if (kind === 'button') {
        look.value = (part as ButtonNode).style ?? 'secondary';
        if (!focused(asks)) asks.value = (part as ButtonNode).confirm ?? '';
        if (!focused(hotkey)) hotkey.value = hotkeyShown((part as ButtonNode).hotkey);
      }
      countRow.hidden = kind !== 'stat';
      for (const row of statRows) row.hidden = kind !== 'stat';
      if (kind === 'stat') {
        const stat = part as StatButton;
        const all = [...Object.entries(page.fields), ...designer.modelFields().map((m) => [m.name, m.field] as const)];
        const options = (types: string[]) => [el('option', { value: '' }, w.nothing), ...all.filter(([, f]) => types.includes(f.type)).map(([name, f]) => el('option', { value: name }, f.label))];
        const counted = ['integer', 'float', 'monetary', 'date', 'datetime', 'char', 'selection'];
        const worded = ['char', 'selection', 'many2one'];
        count.replaceChildren(...options(counted));
        count.value = stat.field ?? '';
        unitField.replaceChildren(...options(worded));
        unitField.value = stat.unitField ?? '';
        labelField.replaceChildren(...options(worded));
        labelField.value = stat.labelField ?? '';
        secondField.replaceChildren(...options(counted));
        secondField.value = stat.secondField ?? '';
        if (!focused(unit)) unit.value = stat.unit ?? '';
        if (!focused(secondLabel)) secondLabel.value = stat.secondLabel ?? '';
        (secondLabel.closest('.fd-prop') as HTMLElement).hidden = !stat.secondField;
      }
      toneRow.hidden = kind !== 'badge' && kind !== 'ribbon' && kind !== 'alert';
      if (!toneRow.hidden) tone.value = (part as { tone?: string }).tone ?? (kind === 'alert' ? 'info' : 'muted');
      const worded = kind === 'ribbon' || kind === 'alert';
      wordsFromRow.hidden = !worded;
      valueRow.hidden = kind !== 'alert';
      tooltipRow.hidden = kind !== 'ribbon';
      closesRow.hidden = buttonsRow.hidden = kind !== 'alert';
      if (worded) {
        // Fields that hold words: text, a choice (by its label), a link (by its record's name).
        const texts = [...Object.entries(page.fields), ...designer.modelFields().map((m) => [m.name, m.field] as const)].filter(([, f]) => ['char', 'text', 'selection', 'many2one'].includes(f.type));
        const from = kind === 'ribbon' ? (part as Ribbon).labelField : (part as Alert).messageField;
        wordsFrom.replaceChildren(el('option', { value: '' }, w.nothing), ...texts.map(([name, f]) => el('option', { value: name }, f.label)));
        wordsFrom.value = from ?? '';
      }
      if (kind === 'alert') {
        const alert = part as Alert;
        value.replaceChildren(el('option', { value: '' }, '—'), ...Object.entries(page.fields).map(([name, f]) => el('option', { value: name }, f.label)));
        value.value = '';
        closes.checked = alert.dismissible === true;
        const key = JSON.stringify(alert.buttons ?? []);
        if (key !== buttonsDrawn && !buttonsList.contains(buttonsList.ownerDocument.activeElement)) {
          buttonsDrawn = key;
          buttonsList.replaceChildren(
            ...(alert.buttons ?? []).map((button) => {
              const label = el('input', { class: 'fd-input', 'aria-label': w.buttonInsideWords, value: button.label }) as HTMLInputElement;
              label.addEventListener('input', () => designer.updateAlertButton(id, button.id, { label: label.value }));
              const action = el('input', { class: 'fd-input', 'aria-label': w.action, value: button.action ?? '', spellcheck: 'false' }) as HTMLInputElement;
              action.addEventListener('change', () => designer.updateAlertButton(id, button.id, { action: action.value }));
              const remove = el('button', { type: 'button', class: 'fd-icon-button', 'aria-label': w.removeNamed(button.label), title: w.removeNamed(button.label) }, '×');
              remove.addEventListener('click', () => designer.removeAlertButton(id, button.id));
              return el('div', { class: 'fd-alert-button-row', 'data-button': button.id }, label, action, remove);
            })
          );
        }
      }
      if (kind === 'ribbon' && !focused(tooltip)) tooltip.value = (part as Ribbon).tooltip ?? '';
      when.update(page, testable(page), part.invisible);
      roles.update(page);
      shownWhile.update(page);
      showWhen.hidden = !when.element.hidden || !when.canStart();
      left.hidden = index === 0;
      right.hidden = index === list.length - 1;
    },
    focus() {
      words.focus();
    },
  };
}

export function statusbarProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const w = designer.words.panel;
  const which = el('select', { class: 'fd-input fd-select', 'aria-label': w.stepsFrom }) as HTMLSelectElement;
  const clickable = el('input', { type: 'checkbox', 'aria-label': w.clickStep }) as HTMLInputElement;
  const where = select(el, w.where, [['header', w.inHeaderBar], ['title', w.underTitle]]);
  // The time spent in each step, folded stages, a click that saves.
  const times = el('select', { class: 'fd-input fd-select', 'aria-label': w.timePerStep }) as HTMLSelectElement;
  const fold = el('input', { type: 'checkbox', 'aria-label': w.foldStages }) as HTMLInputElement;
  const saves = el('input', { type: 'checkbox', 'aria-label': w.clickSaves }) as HTMLInputElement;
  const foldRow = el('label', { class: 'fd-q-required' }, fold, el('span', {}, w.foldStages));
  const savesRow = el('label', { class: 'fd-q-required' }, saves, el('span', {}, w.clickSaves));
  const current = () => (designer.getPage().layout as SheetNode).statusbar;
  const save = () => {
    const position = where.value as 'header' | 'title';
    const link = (designer.getPage().fields[which.value] ?? designer.modelFields().find((m) => m.name === which.value)?.field)?.type === 'many2one';
    designer.setStatusbar(which.value, { clickable: clickable.checked, position, durationsField: times.value, fold: fold.checked && link, saves: saves.checked && clickable.checked });
  };
  for (const control of [which, clickable, where, times, fold, saves]) control.addEventListener('change', save);
  // When it shows, as any part of the header.
  const when = conditionEditor(el, designer, '#statusbar', 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, w.showOnlyWhen);
  showWhen.addEventListener('click', () => when.start());
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.removeStatus);
  remove.addEventListener('click', () => {
    if (designer.setStatusbar(null)) designer.select(null);
  });
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.stepsFrom, which),
    el('label', { class: 'fd-q-required' }, clickable, el('span', {}, w.clickStep)),
    savesRow,
    prop(el, w.where, where),
    prop(el, w.timePerStep, times),
    foldRow,
    el('p', { class: 'fd-properties-hint' }, w.stepsHint),
    el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, w.whenItShows), when.element, showWhen),
    el('div', { class: 'fd-props-actions' }, remove)
  );
  return {
    element,
    update(page) {
      const config = current();
      if (!config) return;
      const all = [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()];
      const fields = all.filter(({ field }) => (field.type === 'selection' && !field.multiple) || field.type === 'many2one');
      which.replaceChildren(...fields.map(({ name, field }) => el('option', { value: name }, field.label)));
      which.value = config.field;
      clickable.checked = config.clickable === true;
      where.value = config.position ?? 'header';
      times.replaceChildren(el('option', { value: '' }, w.nothing), ...all.filter(({ field }) => field.type === 'json').map(({ name, field }) => el('option', { value: name }, field.label)));
      times.value = config.durationsField ?? '';
      foldRow.hidden = (page.fields[config.field] ?? all.find((f) => f.name === config.field)?.field)?.type !== 'many2one';
      fold.checked = config.fold === true;
      savesRow.hidden = !config.clickable;
      saves.checked = config.saves === true;
      // Rules on the page's fields that hold one of a list, or yes or no.
      const others = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && choicesOf(page.fields[n.field]) !== null));
      when.update(page, others, config.invisible);
      showWhen.hidden = !when.element.hidden || !when.canStart();
    },
  };
}
