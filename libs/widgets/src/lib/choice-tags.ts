import type { Option } from '@fieldia/core';
import { describeState, fillIn, maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * Several answers from a list, as tags in a box (`selection.tags`): the box
 * is an ARIA combobox whose list holds the options not chosen yet, those whose
 * words hold what is typed. The arrows reach one and Enter adds it — or the
 * first match, when none is reached — as does a click. A tag goes with its ×,
 * or the last with Backspace in the empty box. The answer keeps the order the
 * tags were added in; a value not among the options shows as its own words.
 */
export const choiceTagsWidget: WidgetFactory = ({ form, name, field, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const options: Option[] = field.type === 'selection' ? field.options : [];
  const listId = `${id}-list`;
  const input = make('input', {
    id,
    type: 'text',
    class: 'fd-input fd-combo-input',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
    autocomplete: 'off',
    placeholder: words.search,
  });
  const list = make('ul', { id: listId, class: 'fd-listbox', role: 'listbox', hidden: '' });
  const chips = make('ul', { class: 'fd-chips' });
  const element = make('div', { class: 'fd-tags fd-choice-tags' }, chips, make('div', { class: 'fd-combo' }, input, list));

  const chosen = (): (string | number)[] => {
    const value = form.getState().values[name];
    return Array.isArray(value) ? (value as (string | number)[]) : [];
  };
  const write = (values: (string | number)[]) => form.setValue(name, values);
  const labelOf = (value: unknown) => options.find((o) => o.value === value)?.label ?? String(value);

  /** The options on offer now, and the one the arrows reached. */
  let found: Option[] = [];
  let active = -1;
  let readonly = false;

  function draw() {
    list.replaceChildren(
      ...found.map((option, i) => {
        const item = make('li', { id: `${listId}-${i}`, role: 'option', class: `fd-option${i === active ? ' fd-active' : ''}`, 'aria-selected': String(i === active) }, option.label);
        // The box keeps the focus; the click adds it.
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => add(option));
        return item;
      })
    );
    if (!found.length) list.append(make('li', { class: 'fd-empty' }, words.noResults));
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }
  function open() {
    const typed = input.value.trim().toLowerCase();
    const taken = new Set(chosen());
    found = options.filter((o) => !taken.has(o.value) && o.label.toLowerCase().includes(typed));
    active = -1;
    draw();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function add(option: Option) {
    input.value = '';
    write([...chosen(), option.value]);
    if (document.activeElement === input) open();
    else close();
  }

  input.addEventListener('focus', () => !readonly && open());
  input.addEventListener('input', () => !readonly && open());
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (readonly) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (list.hidden) return open();
        if (!found.length) return;
        const down = event.key === 'ArrowDown';
        // From none reached, down is the first and up the last; past either end it goes round.
        active = active === -1 ? (down ? 0 : found.length - 1) : (active + (down ? 1 : -1) + found.length) % found.length;
        draw();
        list.children[active]?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      case 'Enter': {
        const pick = found[active] ?? (input.value.trim() ? found[0] : undefined);
        if (list.hidden || !pick) return;
        event.preventDefault();
        add(pick);
        return;
      }
      case 'Escape':
        if (!list.hidden) event.preventDefault();
        close();
        return;
      case 'Backspace':
        if (input.value === '' && chosen().length) write(chosen().slice(0, -1));
        return;
    }
  });

  let drawn = '';
  return {
    element,
    focus: () => input.focus(),
    update(state) {
      readonly = state.readonly;
      const values = Array.isArray(state.value) ? (state.value as unknown[]) : [];
      input.hidden = readonly;
      if (readonly) close();
      describeState(input, state);
      const key = JSON.stringify([readonly, values]);
      if (key === drawn) return;
      drawn = key;
      chips.replaceChildren(
        ...values.map((value) => {
          const label = labelOf(value);
          const chip = make('li', { class: 'fd-chip' }, make('span', { class: 'fd-chip-label' }, label));
          if (!readonly) {
            const remove = make('button', { type: 'button', class: 'fd-chip-remove', 'aria-label': fillIn(words.remove, { name: label }) }, '×');
            remove.addEventListener('click', () => write(chosen().filter((v) => v !== value)));
            chip.append(remove);
          }
          return chip;
        })
      );
      // The list follows what is chosen while it is open.
      if (!list.hidden) open();
    },
  };
};
