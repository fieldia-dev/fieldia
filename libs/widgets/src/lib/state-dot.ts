import type { Tone, Value } from '@fieldia/core';
import { describeState, maker, setAttr, setText } from './kind-parts';
import { popup } from './popup';
import type { WidgetFactory } from './widgets';

/**
 * A state's dot: Flectra's state_selection, a grey, red or green dot that
 * opens a menu of the states, each with its dot and its words. Its tones are
 * the page's (`options.tones`, a tone by value), else known by the value —
 * `normal` grey, `blocked` red, `done` green — else by place: the first grey,
 * the second red, the third green. `options.label` shows the state's words
 * beside the dot. A button with its menu, used with the arrow keys; in a form
 * the menu floats over the page, so a table's cell does not clip it.
 */

const KNOWN: Record<string, Tone> = { normal: 'muted', grey: 'muted', blocked: 'danger', red: 'danger', done: 'success', green: 'success', waiting: 'warning' };
const BY_PLACE: Tone[] = ['muted', 'danger', 'success', 'warning', 'info'];
const TONES = new Set<string>(['info', 'success', 'warning', 'danger', 'muted']);

export const stateDotWidget: WidgetFactory = ({ form, name, field, node, id, document }) => {
  const make = maker(document);
  const options = field.type === 'selection' ? field.options : [];
  const own = (node.options?.['tones'] ?? {}) as Record<string, unknown>;
  const toneOf = (value: Value | undefined, at: number): Tone => {
    const set = own[String(value)];
    if (typeof set === 'string' && TONES.has(set)) return set as Tone;
    return KNOWN[String(value)] ?? BY_PLACE[at % BY_PLACE.length];
  };
  const dot = () => make('span', { class: 'fd-dot', 'aria-hidden': 'true' });
  const button = make('button', { type: 'button', id, class: 'fd-dot-button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': `${id}-menu` }, dot());
  const words = node.options?.['label'] === true ? make('span', { class: 'fd-dot-label' }) : null;
  const items = options.map((option, at) => {
    const item = make('div', { role: 'menuitemradio', class: 'fd-dot-item', tabindex: '-1', 'data-tone': toneOf(option.value, at) }, dot(), option.label);
    item.addEventListener('click', () => pick(at));
    return item;
  });
  const menu = make('div', { id: `${id}-menu`, role: 'menu', class: 'fd-dot-menu', 'aria-label': field.label, hidden: '' }, ...items);
  const element = make('span', { class: 'fd-dot-box' }, button, ...(words ? [words] : []), menu);

  const current = () => options.findIndex((option) => option.value === form.getState().values[name]);
  let refocus = false;
  const floating = popup(element, button, menu, () => {
    if (refocus) button.focus();
    refocus = false;
  });
  function open(at = Math.max(0, current())) {
    floating.open();
    items[at]?.focus();
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
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open(event.key === 'ArrowUp' ? (current() < 0 ? items.length - 1 : current()) : undefined);
  });
  menu.addEventListener('keydown', (event) => {
    const at = items.indexOf(document.activeElement as HTMLDivElement);
    const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 } as Record<string, number>)[event.key];
    if (to !== undefined) {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (at >= 0) pick(at);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Only the menu closes: not a dialog the field is in.
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(true);
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
      if (words) setText(words, label);
      items.forEach((item, i) => setAttr(item, 'aria-checked', String(i === at)));
      if (button.disabled !== state.readonly) button.disabled = state.readonly;
      if (state.readonly) close(false);
      describeState(button, state);
    },
  };
};
