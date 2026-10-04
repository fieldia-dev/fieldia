import type { ElementFactory } from './chrome';
import type { PanelTab } from './panel-tabs';

/**
 * The panel's controls: a setting's row — its name, its control, a line of
 * help — on the tab it belongs to, and a choice of a few, pressed like the
 * mockup's segmented buttons. A row says which tab it is on (`data-tab`) and
 * what a person calls it (`data-setting`), so the search and Find anything
 * can find it, and the panel can sort it into its tab.
 */

const BOXES = 'input, select, textarea';

/**
 * A setting's row. One box is wrapped in a label, so its name points at it;
 * anything else — a choice of a few, a list — sits in a group of that name.
 */
export function setting(el: ElementFactory, tab: PanelTab, name: string, control: Node | Node[], options: { hint?: string | HTMLElement; words?: string } = {}): HTMLElement {
  const controls = Array.isArray(control) ? control : [control];
  const single = controls.length === 1 && controls[0] instanceof Element && controls[0].matches(BOXES);
  const hint = typeof options.hint === 'string' ? el('p', { class: 'fd-properties-hint fd-set-hint' }, options.hint) : options.hint;
  const row = el(single ? 'label' : 'div', { class: 'fd-prop fd-set', 'data-tab': tab, 'data-setting': name }, el('span', { class: 'fd-prop-name' }, options.words ?? name), ...controls, ...(hint ? [hint] : []));
  return row;
}

/** Put a row someone else made on a tab, under the name the search finds it by. */
export function onTab<T extends HTMLElement>(row: T, tab: PanelTab, name?: string): T {
  row.dataset['tab'] = tab;
  if (name) row.dataset['setting'] = name;
  return row;
}

export interface Choice<T> {
  value: T;
  words: string;
  /** Said in full where the words are short, such as "1" for one column. */
  title?: string;
  /** Drawn above the words, such as a small picture of a group's style. */
  picture?: Node;
}

export interface Segmented<T> {
  element: HTMLElement;
  /** Press the choice of this value, or none. */
  set(value: T | null | undefined): void;
  /** Show only the choices that apply now. */
  only(keep: (value: T) => boolean): void;
}

/**
 * A choice of a few, side by side: each a button pressed or not. With
 * `toggle`, pressing the one pressed takes the setting back (`null`).
 */
export function segmented<T extends string | number>(
  el: ElementFactory,
  name: string,
  choices: Choice<T>[],
  choose: (value: T | null) => void,
  options: { toggle?: boolean; className?: string } = {}
): Segmented<T> {
  const element = el('div', { class: `fd-seg fd-insp-seg ${options.className ?? ''}`.trim(), role: 'group', 'aria-label': name });
  const buttons = choices.map((choice) => {
    const button = el(
      'button',
      { type: 'button', class: 'fd-seg-button', 'data-choice': String(choice.value), 'aria-pressed': 'false', title: choice.title, 'aria-label': choice.title },
      ...(choice.picture ? [choice.picture] : []),
      el('span', { class: 'fd-seg-words' }, choice.words)
    );
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') === 'true';
      if (on && !options.toggle) return;
      choose(on ? null : choice.value);
    });
    element.append(button);
    return { button, choice };
  });
  return {
    element,
    set(value) {
      for (const { button, choice } of buttons) button.setAttribute('aria-pressed', String(value !== null && value !== undefined && choice.value === value));
    },
    only(keep) {
      for (const { button, choice } of buttons) button.hidden = !keep(choice.value);
    },
  };
}

/** Whether an element shows within `scope`: nothing between them hidden. */
export function shownWithin(element: Element, scope: Element): boolean {
  for (let at: Element | null = element; at && at !== scope; at = at.parentElement) if ((at as HTMLElement).hidden) return false;
  return true;
}
