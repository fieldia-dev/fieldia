import type { Tone, Value } from '@fieldia/core';
import { describeState, maker, setAttr, setText } from './kind-parts';
import { pickRow, scrollToRow, typeAhead, typedKey } from './pick-list';
import { popup } from './popup';
import type { WidgetFactory } from './widgets';

/**
 * A state's dot: Flectra's state_selection, a grey, red or green dot that
 * opens a menu of the states, each with its dot and its words. Its tones are
 * the page's (`options.tones`, a tone by value), else known by the value —
 * `normal` grey, `blocked` red, `done` green — else by place: the first grey,
 * the second red, the third green. `options.colours` gives a value its exact
 * colour (#rrggbb), over any tone, as a work tracker colours its states.
 * `options.label` shows the state's words beside the dot, as the quiet look
 * always does. A button with its menu, the state picked ticked in it, used
 * with the arrow keys and by typing a state's first letters; in a form the
 * menu floats over the page, so a table's cell does not clip it.
 *
 * `options.listDots: false` draws the menu as Fieldia's own lists are drawn
 * (pick-list): no dots, a tick by the state picked, lined up with the start
 * of the value's box and as wide. A press anywhere on the box opens it, and
 * where the field has a lead slot before its value (`data-lead`, a work item's
 * head band), the dot sits in it (styles-picker).
 */

const KNOWN: Record<string, Tone> = { normal: 'muted', grey: 'muted', blocked: 'danger', red: 'danger', done: 'success', green: 'success', waiting: 'warning' };
const BY_PLACE: Tone[] = ['muted', 'danger', 'success', 'warning', 'info'];
const TONES = new Set<string>(['info', 'success', 'warning', 'danger', 'muted']);
const COLOUR = /^#[0-9a-fA-F]{6}$/;

export const stateDotWidget: WidgetFactory = ({ form, name, field, node, id, document }) => {
  const make = maker(document);
  const options = field.type === 'selection' ? field.options : [];
  const own = (node.options?.['tones'] ?? {}) as Record<string, unknown>;
  const colours = (node.options?.['colours'] ?? {}) as Record<string, unknown>;
  const ticked = node.options?.['listDots'] === false;
  const toneOf = (value: Value | undefined, at: number): Tone => {
    const set = own[String(value)];
    if (typeof set === 'string' && TONES.has(set)) return set as Tone;
    return KNOWN[String(value)] ?? BY_PLACE[at % BY_PLACE.length];
  };
  /** A value's own colour, which wins over its tone; null for one the page gives none. */
  const colourOf = (value: Value | undefined): string | null => {
    const set = colours[String(value)];
    return typeof set === 'string' && COLOUR.test(set) ? set : null;
  };
  const paint = (element: HTMLElement, value: Value | undefined) => {
    const colour = colourOf(value);
    if (colour) element.style.setProperty('--fd-dot', colour);
    else element.style.removeProperty('--fd-dot');
  };
  const dot = () => make('span', { class: 'fd-dot', 'aria-hidden': 'true' });
  const button = make('button', { type: 'button', id, class: 'fd-dot-button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': `${id}-menu` }, dot());
  // The state's words beside its dot: always there, shown where the page asks, and in the quiet look, where the value reads as words.
  const words = make('span', { class: 'fd-dot-label', 'data-quiet-words': node.options?.['label'] === true ? undefined : '' });
  const items = options.map((option, at) => {
    const item = ticked
      ? pickRow(make, { role: 'menuitemradio', class: 'fd-dot-item', tabindex: '-1' }, option.label)
      : make('div', { role: 'menuitemradio', class: 'fd-dot-item', tabindex: '-1', 'data-tone': toneOf(option.value, at) }, dot(), option.label);
    if (!ticked) paint(item, option.value);
    item.addEventListener('click', () => pick(at));
    return item;
  });
  const menu = make('div', { id: `${id}-menu`, role: 'menu', class: ticked ? 'fd-dot-menu fd-pick-list' : 'fd-dot-menu', 'aria-label': field.label, hidden: '' }, ...items);
  const element = make('span', { class: 'fd-dot-box' }, button, words, menu);

  const current = () => options.findIndex((option) => option.value === form.getState().values[name]);
  let refocus = false;
  // Drawn as Fieldia's own lists, it starts where the value's box does, as wide, right under it.
  const floating = popup(element, button, menu, () => {
    if (refocus) button.focus();
    refocus = false;
  }, ticked ? { alignTo: element, matchWidth: true, gap: 0 } : {});
  const find = typeAhead(() => options.map((option) => option.label));
  function reach(at: number) {
    items[at]?.focus();
    scrollToRow(menu, items[at]);
  }
  function open(at = Math.max(0, current())) {
    floating.open();
    reach(at);
  }
  function close(focusBack: boolean) {
    refocus = focusBack;
    floating.close();
  }
  function pick(at: number) {
    form.setValue(name, options[at].value);
    close(true);
  }
  button.addEventListener('click', () => (menu.hidden ? open() : close(true)));
  // Its words pressed open it too: the dot may sit apart from them, in the lead slot before the value's box.
  element.addEventListener('click', (event) => {
    if (button.disabled || button.contains(event.target as Node) || menu.contains(event.target as Node)) return;
    if (menu.hidden) open();
    else close(true);
  });
  button.addEventListener('keydown', (event) => {
    if (typedKey(event)) {
      const at = find(event.key, current());
      if (at >= 0) {
        event.preventDefault();
        open(at);
      }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open(event.key === 'ArrowUp' ? (current() < 0 ? items.length - 1 : current()) : undefined);
  });
  menu.addEventListener('keydown', (event) => {
    const at = items.indexOf(document.activeElement as HTMLDivElement);
    const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 } as Record<string, number>)[event.key];
    if (to !== undefined) {
      event.preventDefault();
      reach((to + items.length) % items.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (at >= 0) pick(at);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Only the menu closes: not a dialog the field is in.
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(true);
    else if (typedKey(event)) {
      const found = find(event.key, at);
      if (found >= 0) {
        event.preventDefault();
        reach(found);
      }
    }
  });

  return {
    element,
    focus: () => button.focus(),
    destroy: () => close(false),
    update(state) {
      const at = options.findIndex((option) => option.value === state.value);
      const label = at < 0 ? '' : options[at].label;
      setAttr(button, 'aria-label', label ? `${field.label}: ${label}` : field.label);
      setAttr(button, 'title', label || null);
      setAttr(button, 'data-tone', at < 0 ? 'muted' : toneOf(state.value, at));
      paint(button, at < 0 ? undefined : state.value);
      setText(words, label);
      items.forEach((item, i) => setAttr(item, 'aria-checked', String(i === at)));
      if (button.disabled !== state.readonly) button.disabled = state.readonly;
      if (state.readonly) close(false);
      describeState(button, state);
    },
  };
};
