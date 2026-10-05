import { clearSelection, describeState, maker, setAttr, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A yes or no as two buttons, "Yes" and "No" (`boolean.buttons`): a radio
 * group with one stop for Tab, an arrow key going to the other and picking
 * it. Nothing is picked until one is — the field starts empty, its default
 * `null` — so a required one waits for an answer, and "No" is one.
 * `options.yesLabel` and `noLabel` give them other words.
 */
export const yesNoWidget: WidgetFactory = ({ form, name, node, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  // The points' look: a button each, the one picked filled.
  const group = make('div', { id, class: 'fd-points fd-yes-no', role: 'radiogroup' });
  let readonly = false;
  const buttons = [true, false].map((value) => {
    const own = node.options?.[value ? 'yesLabel' : 'noLabel'];
    const button = make('button', { type: 'button', role: 'radio' }, typeof own === 'string' && own ? own : value ? words.yes : words.no);
    button.addEventListener('click', () => form.setValue(name, value));
    group.append(button);
    return button;
  });
  // Two of them: every arrow goes to the other one.
  group.addEventListener('keydown', (event) => {
    const at = buttons.indexOf(event.target as HTMLButtonElement);
    if (readonly || at === -1 || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    form.setValue(name, at === 1);
    buttons[1 - at].focus();
  });
  const clear = clearSelection(document, words, () => {
    form.setValue(name, null);
    buttons[0].focus();
  });
  return {
    element: make('div', { class: 'fd-choices-box' }, group, clear.button),
    focus: () => (buttons.find((b) => b.getAttribute('aria-checked') === 'true') ?? buttons[0]).focus(),
    update(state) {
      readonly = state.readonly;
      const picked = state.value === true ? 0 : state.value === false ? 1 : -1;
      buttons.forEach((button, i) => {
        setAttr(button, 'aria-checked', String(i === picked));
        button.classList.toggle('fd-on', i === picked);
        button.tabIndex = i === Math.max(0, picked) ? 0 : -1;
        button.disabled = readonly;
      });
      setAttr(group, 'aria-required', String(state.required));
      clear.allow(state);
      clear.show(picked !== -1);
      describeState(group, state);
    },
  };
};
