import type { ActionStep, Field, OpenStep, Page, Tone } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { DesignerWords } from './designer-words';
import { segmented } from './panel-controls';
import { formulaBox } from './rules-formula-box';
import { formulaProblem } from './rules-formula';
import type { SavedFormRef } from './saved-forms';
import { shownTitle } from './saved-forms';
import { SETTABLE, type StepPatch } from './steps-commands';
import { stepMap, type MapChoice } from './steps-map';
import { showTargets } from './steps-places';

/**
 * A step's settings, opened in place under its sentence: for each kind only
 * what it takes — the page it opens and how, what that page starts with and
 * where its answers go; the field a value is set in and the value; what is
 * said or asked; the app's action — and, for every kind, "Only when…". The
 * page's fields are picked by their labels; formulas are typed in the rules'
 * formula box, the fields they read suggested.
 */

export interface StepContext {
  words: DesignerWords;
  page(): Page;
  /** Change the step: kept when it can be, else said why under it. With `typing`, a run in one box is one undo step. */
  change(patch: StepPatch, typing?: boolean): void;
  /** A saved page by its id, when the app's saved pages have it. */
  saved(id: string): Page | null | undefined;
  /** The app's saved pages to open; null without a store that lists them, or while they load. */
  listed(): SavedFormRef[] | null;
}

export interface StepSettings {
  element: HTMLElement;
  update(step: ActionStep): void;
  focusFirst(): void;
}

const focused = (node: Element) => node.ownerDocument.activeElement === node;
const ANOTHER = '#another';

/** A field's words for a choice of fields: its label, or its name. */
const choiceOf = ([name, def]: [string, Field]): MapChoice => ({ value: name, label: def.label || name });

function row(el: ElementFactory, label: string, ...controls: HTMLElement[]): HTMLElement {
  return el('div', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, label), ...controls);
}

function select(el: ElementFactory, label: string): HTMLSelectElement {
  return el('select', { class: 'fd-input fd-select', 'aria-label': label });
}

/** The options of a select, drawn again only when they change. */
function fill(el: ElementFactory, box: HTMLSelectElement, options: MapChoice[]) {
  const key = JSON.stringify(options);
  if (box.dataset['options'] === key) return;
  box.dataset['options'] = key;
  const was = box.value;
  box.replaceChildren(...options.map((o) => el('option', { value: o.value }, o.label)));
  box.value = was;
}

export function stepSettings(el: ElementFactory, kind: ActionStep['do'], ctx: StepContext): StepSettings {
  const words = ctx.words;
  const w = words.steps;
  const parts: HTMLElement[] = [];
  const updates: ((step: ActionStep) => void)[] = [];
  let first: HTMLElement | null = null;
  const firstIs = (control: HTMLElement) => (first = first ?? control);
  let current: ActionStep = { do: kind } as ActionStep;
  const fieldsOf = (test: (def: Field) => boolean = () => true) => Object.entries(ctx.page().fields).filter(([, def]) => test(def)).map(choiceOf);

  /** A field picked from this page's: the kinds it may be. */
  const fieldPicker = (label: string, key: 'field', test?: (def: Field) => boolean) => {
    const box = select(el, label);
    box.addEventListener('change', () => ctx.change({ [key]: box.value }));
    parts.push(row(el, label, box));
    firstIs(box);
    updates.push((step) => {
      fill(el, box, fieldsOf(test));
      if (!focused(box)) box.value = (step as { field?: string }).field ?? '';
    });
  };
  /** Words typed: what is said or asked, the app's action, a title. */
  const text = (label: string, key: 'message' | 'action' | 'title', placeholder: string, extra: Record<string, string> = {}) => {
    const box = el('input', { class: 'fd-input', 'aria-label': label, placeholder, autocomplete: 'off', ...extra });
    box.addEventListener('input', () => ctx.change({ [key]: box.value.trim() ? box.value : key === 'title' ? null : '' }, true));
    parts.push(row(el, label, box));
    firstIs(box);
    updates.push((step) => {
      if (!focused(box)) box.value = String((step as unknown as Record<string, unknown>)[key] ?? '');
    });
    return box;
  };
  /** A formula over this page's fields. */
  const formula = (label: string, key: 'value' | 'record', placeholder: string, optional = false) => {
    const box = formulaBox(el, {
      words,
      label,
      placeholder,
      check: (page, source) => formulaProblem(page, source, words),
      commit: (source) => ctx.change({ [key]: source || (optional ? null : '') }, true),
    });
    parts.push(row(el, label, box.element, box.problem));
    firstIs(box.input);
    updates.push((step) => box.update(ctx.page(), String((step as unknown as Record<string, unknown>)[key] ?? '')));
  };

  switch (kind) {
    case 'open':
      openSettings();
      break;
    case 'set':
      fieldPicker(w.field, 'field', (def) => SETTABLE.has(def.type));
      formula(w.setTo, 'value', w.setToPlaceholder);
      break;
    case 'clear':
      fieldPicker(w.field, 'field');
      break;
    case 'addLine':
      addLineSettings();
      break;
    case 'check':
      checkSettings();
      break;
    case 'goTo': {
      const box = select(el, w.goToTarget);
      box.addEventListener('change', () => ctx.change({ target: box.value }));
      parts.push(row(el, w.goToTarget, box));
      firstIs(box);
      updates.push((step) => {
        fill(el, box, showTargets(ctx.page()).map((t) => ({ value: t.id, label: t.label || t.id })));
        if (!focused(box) && step.do === 'goTo') box.value = step.target;
      });
      break;
    }
    case 'say': {
      text(w.words, 'message', w.sayPlaceholder);
      // Five tones do not sit side by side in a narrow panel: a list of them.
      const tone = select(el, w.tone);
      tone.append(...(['info', 'success', 'warning', 'danger', 'muted'] as const).map((value) => el('option', { value }, w.tones[value])));
      tone.addEventListener('change', () => ctx.change({ tone: tone.value === 'info' ? null : (tone.value as Tone) }));
      parts.push(row(el, w.tone, tone));
      updates.push((step) => {
        if (!focused(tone)) tone.value = step.do === 'say' ? (step.tone ?? 'info') : 'info';
      });
      break;
    }
    case 'ask':
      text(w.words, 'message', w.askPlaceholder);
      break;
    case 'call': {
      text(w.action, 'action', w.actionPlaceholder, { spellcheck: 'false', class: 'fd-input fd-answer-rule-code' });
      parts.push(el('p', { class: 'fd-properties-hint fd-set-hint' }, w.actionHint));
      break;
    }
    default:
      break;
  }
  whenSetting();

  // ---- open a page ----
  function openSettings() {
    const page = select(el, w.page);
    const byId = el('input', { class: 'fd-input fd-answer-rule-code', 'aria-label': w.pageId, placeholder: w.pageIdPlaceholder, spellcheck: 'false', autocomplete: 'off' });
    let another = false;
    page.addEventListener('change', () => {
      another = page.value === ANOTHER;
      byId.hidden = !another;
      if (another) byId.focus();
      else if (page.value) ctx.change({ page: page.value });
    });
    byId.addEventListener('input', () => byId.value.trim() && ctx.change({ page: byId.value.trim() }, true));
    parts.push(row(el, w.page, page, byId));
    firstIs(page);
    const as = segmented<'dialog' | 'panel' | 'page'>(
      el,
      w.opensIn,
      (['dialog', 'panel', 'page'] as const).map((value) => ({ value, words: w.asShort[value], label: w.as[value] })),
      (value) => value && ctx.change({ as: value === 'dialog' ? null : value })
    );
    parts.push(row(el, w.opensIn, as.element));
    text(w.title, 'title', w.titlePlaceholder);
    formula(w.record, 'record', w.recordPlaceholder, true);
    const opened = () => (current.do === 'open' ? ctx.saved(current.page) : null);
    const startsWith = stepMap(el, {
      words,
      label: w.startsWith,
      addWords: w.addValue,
      nameLabel: w.itsField,
      names: () => {
        const other = opened();
        return other ? Object.entries(other.fields).map(choiceOf) : null;
      },
      valueLabel: (name) => w.valueFrom(name),
      reads: () => ctx.page(),
      commit: (map) => ctx.change({ values: map }, true),
    });
    // What comes back is read over the opened page's answers, and the record it saved.
    const answers = (): Page => {
      const other = opened();
      return { ...ctx.page(), fields: { ...(other?.fields ?? {}), id: { type: 'integer', label: w.theRecordItSaved } } };
    };
    const into = stepMap(el, {
      words,
      label: w.answersGo,
      addWords: w.addAnswer,
      nameLabel: w.thisFormsField,
      names: () => fieldsOf(),
      values: () => {
        const other = opened();
        return other ? [...Object.entries(other.fields).map(choiceOf), { value: 'id', label: w.theRecordItSaved }] : null;
      },
      valueLabel: (name) => w.valueFrom(name),
      reads: answers,
      commit: (map) => ctx.change({ into: map }, true),
    });
    parts.push(startsWith.element, into.element);
    updates.push((step) => {
      if (step.do !== 'open') return;
      const listed = ctx.listed();
      const known = !!listed?.some((ref) => ref.id === step.page);
      const choices = [
        ...(!step.page ? [{ value: '', label: w.pick }] : []),
        ...(listed ?? []).map((ref) => ({ value: ref.id, label: shownTitle(ctx.saved(ref.id), ctx.page().language) || ref.title || ref.id })),
        ...(listed ? [{ value: ANOTHER, label: w.pageById }] : []),
      ];
      fill(el, page, choices);
      page.hidden = !listed;
      // A page the list has not got is typed by its id.
      another = another || (!!step.page && !known);
      if (!focused(page)) page.value = another || !listed ? ANOTHER : step.page;
      // The list come while its id box had the cursor: the list takes it.
      const typing = focused(byId);
      byId.hidden = !!listed && !another;
      if (typing && byId.hidden) page.focus();
      if (!focused(byId)) byId.value = known ? '' : step.page;
      as.set(step.as ?? 'dialog');
      startsWith.update(step.values ?? {});
      into.update(step.into ?? {});
    });
  }

  // ---- a line added to a table ----
  function addLineSettings() {
    fieldPicker(w.table, 'field', (def) => def.type === 'one2many');
    const lines = () => {
      const def = current.do === 'addLine' ? ctx.page().fields[current.field] : undefined;
      return def?.type === 'one2many' ? Object.entries(def.fields).map(([name, f]) => ({ value: name, label: f.label || name })) : [];
    };
    const values = stepMap(el, {
      words,
      label: w.lineValues,
      addWords: w.addValue,
      nameLabel: w.field,
      names: lines,
      valueLabel: (name) => w.valueFrom(name),
      reads: () => ctx.page(),
      commit: (map) => ctx.change({ values: map }, true),
    });
    parts.push(values.element);
    updates.push((step) => step.do === 'addLine' && values.update(step.values ?? {}));
  }

  // ---- what is checked ----
  function checkSettings() {
    const which = segmented<'all' | 'some'>(el, w.check, [{ value: 'all', words: w.wholeForm }, { value: 'some', words: w.onlyFields }], (value) => {
      if (value === 'all') ctx.change({ fields: null });
      else if (value === 'some') {
        const first = fieldsOf()[0];
        if (first) ctx.change({ fields: [first.value] });
      }
    });
    const boxes = el('div', { class: 'fd-do-fields', role: 'group', 'aria-label': w.onlyFields });
    parts.push(row(el, w.check, which.element, boxes));
    updates.push((step) => {
      if (step.do !== 'check') return;
      which.set(step.fields?.length ? 'some' : 'all');
      boxes.hidden = !step.fields?.length;
      const all = fieldsOf();
      const key = JSON.stringify(all);
      if (boxes.dataset['fields'] !== key) {
        boxes.dataset['fields'] = key;
        boxes.replaceChildren(
          ...all.map((f) => {
            const tick = el('input', { type: 'checkbox', value: f.value }) as HTMLInputElement;
            tick.addEventListener('change', () => {
              const picked = [...boxes.querySelectorAll<HTMLInputElement>('input:checked')].map((t) => t.value);
              ctx.change({ fields: picked.length ? picked : null });
            });
            return el('label', { class: 'fd-q-required' }, tick, el('span', {}, f.label));
          })
        );
      }
      for (const tick of boxes.querySelectorAll<HTMLInputElement>('input')) tick.checked = !!step.fields?.includes(tick.value);
    });
  }

  // ---- only when ----
  function whenSetting() {
    const start = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when fd-do-when-start' }, w.onlyWhen);
    let begun = false;
    const box = formulaBox(el, {
      words,
      label: w.runsOnlyWhen,
      placeholder: w.whenPlaceholder,
      check: (page, source) => formulaProblem(page, source, words),
      commit: (source) => ctx.change({ when: source || null }, true),
    });
    const holder = row(el, w.runsOnlyWhen, box.element, box.problem);
    holder.classList.add('fd-do-when');
    start.addEventListener('click', () => {
      begun = true;
      holder.hidden = false;
      start.hidden = true;
      box.input.focus();
    });
    parts.push(holder, start);
    updates.push((step) => {
      const has = step.when !== undefined;
      holder.hidden = !has && !begun;
      start.hidden = !holder.hidden;
      box.update(ctx.page(), typeof step.when === 'string' ? step.when : '');
    });
  }

  const element = el('div', { class: 'fd-do-settings' }, ...parts);
  return {
    element,
    update(step) {
      current = step;
      for (const update of updates) update(step);
    },
    focusFirst() {
      // The first control on show: an open step's page list waits for the app's list of pages.
      const shown = (control: HTMLElement) => !control.closest('[hidden]');
      const controls = [...(first ? [first] : []), ...element.querySelectorAll<HTMLElement>('select, input, button')];
      controls.find(shown)?.focus();
    },
  };
}

/** A new step of a kind, as "Add a step" begins it: what can be picked first is; what must be written waits for it. */
export function newStep(page: Page, kind: ActionStep['do']): ActionStep {
  const first = (test: (def: Field) => boolean) => Object.entries(page.fields).find(([, def]) => test(def))?.[0] ?? '';
  switch (kind) {
    case 'open':
      return { do: 'open', page: '' } as OpenStep;
    case 'set':
      return { do: 'set', field: first((def) => SETTABLE.has(def.type)), value: '' };
    case 'clear':
      return { do: 'clear', field: first(() => true) };
    case 'addLine':
      return { do: 'addLine', field: first((def) => def.type === 'one2many') };
    case 'goTo':
      return { do: 'goTo', target: showTargets(page)[0]?.id ?? '' };
    case 'say':
      return { do: 'say', message: '' };
    case 'ask':
      return { do: 'ask', message: '' };
    case 'call':
      return { do: 'call', action: '' };
    default:
      return { do: kind } as ActionStep;
  }
}
