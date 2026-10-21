import { describeState, maker, setAttr, setText, wordsFor } from './kind-parts';
import { pickRow, scrollToRow, typeAhead, typedKey } from './pick-list';
import { popup } from './popup';
import { shownOptions } from './shuffle';
import { seatMarks } from './seats';
import { installChoiceStyles } from './styles-choice';
import { optionCaption, optionMark } from './option-look';
import type { WidgetFactory } from './widgets';

/**
 * A choice in Fieldia's own list (`options.list: "own"` on a selection), in
 * place of the browser's: a button showing the value, and under it a list
 * with a tick by the option picked, as a work tracker's Priority and
 * Severity have — the browser's own list cannot be drawn so. The collapsible
 * listbox of the ARIA practices: the button is named by the field's label and
 * its value; ↓, ↑, Enter and Space open the list on the option picked, the
 * arrows, Home and End move in it, typing an option's first letters goes to
 * it, Enter and Space pick, Escape and Tab close it without picking. Delete
 * empties a choice that need not be made.
 *
 * Drawn as a state's box is (`fd-dot-box`): in the quiet look its words are
 * the value, its box shows when pointed at, and it says what to add while
 * empty; in a boxed skin it is a box as a choice's. An option's places left
 * show after its words, as a radio's do ("3 left", "Full"); a full one picked
 * is refused by the form, the box keeping what it held.
 */
export const ownListWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  installChoiceStyles(document);
  const make = maker(document);
  const choices = shownOptions(field.type === 'selection' ? field.options : [], form, name, node);
  const seats = seatMarks(document, form, name, wordsFor(labels, locale), choices.map((option) => option.value));
  const listId = `${id}-list`;
  const wordsId = `${id}-words`;
  // Named by its field's label, which the viewer gives the id `<id>-label`, and by the value it shows.
  const button = make('button', { type: 'button', id, class: 'fd-dot-button fd-own-button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-labelledby': `${id}-label ${wordsId}` });
  const words = make('span', { class: 'fd-dot-label fd-own-words', id: wordsId, 'data-placeholder': node.placeholder });
  // The option picked's icon or colour before its words, where the page gives one.
  const mark = make('span', { class: 'fd-own-mark', hidden: '' });
  const rows = choices.map((option, at) => {
    const row = pickRow(make, { role: 'option', id: `${listId}-${at}`, 'aria-selected': 'false' }, option.label);
    // Its icon or colour before its words, and its second line under them, where the page gives them.
    const mark = optionMark(make, option);
    const caption = optionCaption(make, option);
    if (mark) row.querySelector('.fd-pick-tick')?.after(mark);
    if (caption) row.querySelector('.fd-pick-words')?.append(caption);
    row.classList.toggle('fd-pick-marked', !!mark);
    row.classList.toggle('fd-pick-two', !!caption);
    row.append(seats.marks[at]);
    row.addEventListener('mousedown', (event) => event.preventDefault()); // the list keeps the focus
    row.addEventListener('click', () => pick(at));
    return row;
  });
  const list = make('div', { id: listId, role: 'listbox', class: 'fd-pick-list fd-own-list', tabindex: '-1', 'aria-labelledby': `${id}-label`, hidden: '' }, ...rows);
  const element = make('span', { class: 'fd-input fd-dot-box fd-own-box' }, button, mark, words, list);

  const current = () => choices.findIndex((option) => option.value === form.getState().values[name]);
  let active = -1;
  let refocus = false;
  let required = false;
  const floating = popup(element, button, list, () => {
    active = -1;
    list.removeAttribute('aria-activedescendant');
    if (refocus) button.focus();
    refocus = false;
  }, { alignTo: element, matchWidth: true, gap: 0 });
  const find = typeAhead(() => choices.map((option) => option.label));

  function reach(at: number) {
    active = Math.max(0, Math.min(at, rows.length - 1));
    rows.forEach((row, i) => setAttr(row, 'data-active', i === active ? '' : null));
    if (rows[active]) list.setAttribute('aria-activedescendant', rows[active].id);
    scrollToRow(list, rows[active]);
  }
  function open(at = Math.max(0, current())) {
    if (!rows.length) return;
    floating.open();
    list.focus();
    reach(at);
  }
  function close(focusBack: boolean) {
    refocus = focusBack;
    floating.close();
  }
  function pick(at: number) {
    form.setValue(name, choices[at].value);
    close(true);
  }

  button.addEventListener('click', () => (list.hidden ? open() : close(true)));
  // Its words pressed open it too.
  element.addEventListener('click', (event) => {
    if (button.disabled || button.contains(event.target as Node) || list.contains(event.target as Node)) return;
    if (list.hidden) open();
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
    if ((event.key === 'Delete' || event.key === 'Backspace') && !required && current() >= 0) {
      event.preventDefault();
      form.setValue(name, null);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    open(event.key === 'ArrowUp' && current() < 0 ? rows.length - 1 : undefined);
  });
  list.addEventListener('keydown', (event) => {
    const to = ({ ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: rows.length - 1, PageDown: active + 8, PageUp: active - 8 } as Record<string, number>)[event.key];
    if (to !== undefined) {
      event.preventDefault();
      reach(to);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (active >= 0) pick(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Only the list closes: not a dialog the field is in.
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
    else if (typedKey(event)) {
      const found = find(event.key, active);
      if (found >= 0) {
        event.preventDefault();
        reach(found);
      }
    }
  });
  // The focus gone elsewhere, the list goes too (not while it closes: moved back into its box, it loses the focus).
  list.addEventListener('focusout', (event) => {
    if (!list.hidden && !list.contains(event.relatedTarget as Node | null) && event.relatedTarget !== button) close(false);
  });

  return {
    element,
    focus: () => button.focus(),
    destroy: () => close(false),
    update(state) {
      const at = choices.findIndex((option) => option.value === state.value);
      required = state.required;
      setText(words, at < 0 ? '' : choices[at].label);
      if (mark.dataset['at'] !== String(at)) {
        mark.dataset['at'] = String(at);
        const shown = at < 0 ? null : optionMark(make, choices[at]);
        mark.replaceChildren(...(shown ? [shown] : []));
        mark.hidden = !shown;
      }
      rows.forEach((row, i) => setAttr(row, 'aria-selected', String(i === at)));
      seats.update();
      if (button.disabled !== state.readonly) button.disabled = state.readonly;
      if (state.readonly) close(false);
      describeState(button, state);
    },
  };
};
