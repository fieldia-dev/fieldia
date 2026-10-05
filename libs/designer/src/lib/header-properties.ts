import type { ButtonNode, FieldNode, Page, SheetNode, Tone } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import type { Designer } from './designer';
import { findHeaderPart } from './header-commands';
import { allSections } from './page-tree';
import type { PropertiesView } from './screen-properties';

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
  const action = el('input', { class: 'fd-input', 'aria-label': w.action, placeholder: 'confirm' }) as HTMLInputElement;
  action.addEventListener('input', () => action.value.trim() && designer.updateHeaderPart(id, { action: action.value }));
  const actionRow = el('div', { class: 'fd-prop' }, prop(el, w.action, action), el('p', { class: 'fd-properties-hint' }, w.actionHint));
  const look = select(el, w.look, [['secondary', w.buttonLooks.secondary], ['primary', w.buttonLooks.primary], ['danger', w.buttonLooks.danger], ['link', w.buttonLooks.link]]);
  look.addEventListener('change', () => designer.updateHeaderPart(id, { style: look.value as ButtonNode['style'] }));
  const lookRow = prop(el, w.look, look);
  const asks = el('input', { class: 'fd-input', 'aria-label': w.asksFirst, placeholder: w.actsAtOnce }) as HTMLInputElement;
  asks.addEventListener('input', () => designer.updateHeaderPart(id, { confirm: asks.value }));
  const asksRow = prop(el, w.asksFirst, asks);
  const count = el('select', { class: 'fd-input fd-select', 'aria-label': w.numberFrom }) as HTMLSelectElement;
  count.addEventListener('change', () => designer.updateHeaderPart(id, { field: count.value }));
  const countRow = prop(el, w.numberFrom, count);
  const tone = select(el, w.tone, [['muted', w.tones.muted], ['info', w.tones.info], ['success', w.tones.success], ['warning', w.tones.warning], ['danger', w.tones.danger]]);
  tone.addEventListener('change', () => designer.updateHeaderPart(id, { tone: tone.value as Tone }));
  const toneRow = prop(el, w.tone, tone);
  const when = conditionEditor(el, designer, id, 'question');
  const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, w.showOnlyWhen);
  showWhen.addEventListener('click', () => when.start());
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
    actionRow,
    lookRow,
    asksRow,
    countRow,
    toneRow,
    el('div', { class: 'fd-prop fd-prop-when' }, el('span', { class: 'fd-prop-name' }, w.whenItShows), when.element, showWhen),
    el('div', { class: 'fd-props-actions' }, left, right, remove)
  );

  return {
    element,
    update(page) {
      const found = findHeaderPart(page, id);
      if (!found) return;
      const { kind, part, index, list } = found;
      if (!focused(words)) words.value = part.label;
      actionRow.hidden = kind === 'badge';
      if (kind !== 'badge' && !focused(action)) action.value = (part as ButtonNode).action;
      lookRow.hidden = asksRow.hidden = kind !== 'button';
      if (kind === 'button') {
        look.value = (part as ButtonNode).style ?? 'secondary';
        if (!focused(asks)) asks.value = (part as ButtonNode).confirm ?? '';
      }
      countRow.hidden = kind !== 'stat';
      if (kind === 'stat') {
        const numbers = Object.entries(page.fields).filter(([, f]) => ['integer', 'float', 'monetary'].includes(f.type));
        const offered = [...numbers, ...designer.modelFields().filter((m) => ['integer', 'float', 'monetary'].includes(m.field.type)).map((m) => [m.name, m.field] as const)];
        count.replaceChildren(el('option', { value: '' }, w.nothing), ...offered.map(([name, f]) => el('option', { value: name }, f.label)));
        count.value = (part as { field?: string }).field ?? '';
      }
      toneRow.hidden = kind !== 'badge';
      if (kind === 'badge') tone.value = (part as { tone?: string }).tone ?? 'muted';
      when.update(page, testable(page), part.invisible);
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
  const current = () => (designer.getPage().layout as SheetNode).statusbar;
  const save = () => {
    const position = where.value as 'header' | 'title';
    designer.setStatusbar(which.value, { clickable: clickable.checked, position });
  };
  which.addEventListener('change', save);
  clickable.addEventListener('change', save);
  where.addEventListener('change', save);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.removeStatus);
  remove.addEventListener('click', () => {
    if (designer.setStatusbar(null)) designer.select(null);
  });
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.stepsFrom, which),
    el('label', { class: 'fd-q-required' }, clickable, el('span', {}, w.clickStep)),
    prop(el, w.where, where),
    el('p', { class: 'fd-properties-hint' }, w.stepsHint),
    el('div', { class: 'fd-props-actions' }, remove)
  );
  return {
    element,
    update(page) {
      const config = current();
      if (!config) return;
      const fields = [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()].filter(({ field }) => field.type === 'selection' && !field.multiple);
      which.replaceChildren(...fields.map(({ name, field }) => el('option', { value: name }, field.label)));
      which.value = config.field;
      clickable.checked = config.clickable === true;
      where.value = config.position ?? 'header';
    },
  };
}
