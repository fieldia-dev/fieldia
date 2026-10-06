import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode } from './page-tree';
import { setting } from './panel-controls';
import type { PanelTab } from './panel-tabs';
import { stepsEditor, type StepsEditor } from './steps-editor';
import { MOMENTS, showTargets } from './steps-places';

/**
 * Where steps are set, on the panel: a button's "When clicked" (a body
 * button, a record header's button or counter, a list's button), a field's
 * "When it changes" on its Rules tab, and the form's own moments — when it
 * opens, before and after it is saved or sent, when a tab or step is shown —
 * on the page's Rules tab. Each is a setting's row, so the panel sorts it into
 * its tab and the search finds it.
 */

export interface StepsSetting {
  /** The setting's row. */
  element: HTMLElement;
  update(page: Page): void;
  focus(): void;
}

/** What a button does when it is pressed: its steps, its app action among them. */
export function whenClicked(el: ElementFactory, designer: Designer, id: string, tab: PanelTab = 'content'): StepsSetting {
  const w = designer.words.steps;
  const editor = stepsEditor(el, designer, { press: id }, { label: w.whenClicked });
  const element = setting(el, tab, 'When clicked', editor.element, { words: w.whenClicked });
  element.classList.add('fd-do-setting');
  return { element, update: (page) => editor.update(page), focus: () => editor.focus() };
}

/** What a field's change does: steps run as a person changes it. */
export function whenItChanges(el: ElementFactory, designer: Designer, nodeId: string): StepsSetting {
  const w = designer.words.steps;
  const found = findNode(designer.getPage(), nodeId)?.node;
  const field = found?.type === 'field' ? found.field : '';
  const editor = stepsEditor(el, designer, { change: field }, { label: w.whenItChanges });
  const element = setting(el, 'rules', 'When it changes', editor.element, { words: w.whenItChanges, hint: w.changeHint });
  element.classList.add('fd-do-setting');
  return { element, update: (page) => editor.update(page), focus: () => editor.focus() };
}

/** The form's own moments, one list each, and a list for each tab or step shown that has one. */
export function formMoments(el: ElementFactory, designer: Designer): StepsSetting {
  const w = designer.words.steps;
  const moment = (name: string, editor: StepsEditor, hint?: string) =>
    el('div', { class: 'fd-do-moment' }, el('span', { class: 'fd-do-moment-name' }, name), editor.element, ...(hint ? [el('p', { class: 'fd-properties-hint fd-set-hint' }, hint)] : []));
  const editors = MOMENTS.map((at) => ({ at, editor: stepsEditor(el, designer, { moment: at }, { label: w.momentNames[at] }) }));
  // A tab or step shown: one list each, for those that have steps or were picked to have some.
  const shows = el('div', { class: 'fd-do-shows' });
  const pick = el('select', { class: 'fd-input fd-select fd-do-show-pick', 'aria-label': w.stepsForATab });
  const showRow = el('div', { class: 'fd-do-moment' }, el('span', { class: 'fd-do-moment-name' }, w.momentNames.show), shows, pick);
  const showEditors = new Map<string, { element: HTMLElement; editor: StepsEditor; name: HTMLElement }>();
  const begun = new Set<string>();
  pick.addEventListener('change', () => {
    if (!pick.value) return;
    begun.add(pick.value);
    const id = pick.value;
    pick.value = '';
    update(designer.getPage());
    showEditors.get(id)?.editor.focus();
  });
  const element = el(
    'div',
    { class: 'fd-prop fd-do-setting fd-do-moments', 'data-tab': 'rules', 'data-setting': 'When…' },
    el('span', { class: 'fd-prop-name' }, w.moments),
    ...editors.map(({ at, editor }) => moment(w.momentNames[at], editor, at === 'beforeSave' ? w.beforeSaveHint : undefined)),
    showRow
  );

  function update(page: Page) {
    for (const { editor } of editors) editor.update(page);
    const targets = showTargets(page);
    const withSteps = new Set(Object.keys(page.on?.show ?? {}));
    const listed = targets.filter((t) => withSteps.has(t.id) || begun.has(t.id));
    for (const [id, view] of showEditors) {
      if (listed.some((t) => t.id === id)) continue;
      view.element.remove();
      showEditors.delete(id);
    }
    for (const target of listed) {
      let view = showEditors.get(target.id);
      if (!view) {
        const editor = stepsEditor(el, designer, { show: target.id }, { label: w.whenShown(target.label || target.id) });
        const name = el('span', { class: 'fd-do-show-name' });
        view = { element: el('div', { class: 'fd-do-show' }, name, editor.element), editor, name };
        showEditors.set(target.id, view);
      }
      view.name.textContent = w.whenShown(target.label || target.id);
      if (shows.children[listed.indexOf(target)] !== view.element) shows.insertBefore(view.element, shows.children[listed.indexOf(target)] ?? null);
      view.editor.update(page);
    }
    const free = targets.filter((t) => !listed.includes(t));
    const key = JSON.stringify(free);
    if (pick.dataset['targets'] !== key) {
      pick.dataset['targets'] = key;
      pick.replaceChildren(el('option', { value: '' }, w.stepsForATab), ...free.map((t) => el('option', { value: t.id }, t.label || t.id)));
    }
    pick.hidden = !free.length;
    showRow.hidden = !targets.length;
  }

  return {
    element,
    update,
    focus: () => editors[0].editor.focus(),
  };
}
