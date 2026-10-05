import type { Option } from '@fieldia/core';
import { withAlone } from './choice-rules';
import { describeState, fillIn, maker, setAttr, wordsFor } from './kind-parts';
import type { WidgetContext, WidgetFactory } from './widgets';

/**
 * Several answers from a list, as tags in a box (`selection.tags`): the box
 * is an ARIA combobox whose list holds the options not chosen yet, those whose
 * words hold what is typed. The arrows reach one and Enter adds it — or the
 * first match, when none is reached — as does a click. A tag goes with its ×,
 * or the last with Backspace in the empty box. The answer keeps the order the
 * tags were added in; a value not among the options shows as its own words.
 * With `ownAnswers`, words that match nothing are offered as an answer of
 * their own; "None of these" goes alone.
 *
 * One answer, the same box (`searchWidget`): a dropdown that searches its
 * list — the box shows the choice, typing finds others, and a box left half
 * typed shows the choice again; emptied, it takes the choice away.
 */
export const choiceTagsWidget: WidgetFactory = (context) => combo(context, false);
export const searchWidget: WidgetFactory = (context) => combo(context, true);

function combo({ form, name, field, id, document, labels, locale }: WidgetContext, single: boolean) {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const options: Option[] = field.type === 'selection' ? field.options : [];
  const own = field.type === 'selection' && field.ownAnswers === true && !single;
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
  const box = make('div', { class: 'fd-combo' }, input, list);
  const element = single ? make('div', { class: 'fd-choice-search' }, box) : make('div', { class: 'fd-tags fd-choice-tags' }, chips, box);

  const current = () => form.getState().values[name];
  const chosen = (): (string | number)[] => (Array.isArray(current()) ? (current() as (string | number)[]) : []);
  const write = (values: unknown[] | unknown) => form.setValue(name, values as never);
  const labelOf = (value: unknown) => options.find((o) => o.value === value)?.label ?? (value === null || value === undefined ? '' : String(value));

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
    setAttr(input, 'aria-activedescendant', active >= 0 ? `${listId}-${active}` : null);
  }
  function open() {
    const written = input.value.trim();
    // The choice's own words in the box find every option, not only itself.
    const typed = single && written === labelOf(current()) ? '' : written.toLowerCase();
    const taken = new Set(chosen());
    found = options.filter((o) => !taken.has(o.value) && o.label.toLowerCase().includes(typed));
    // Words that match nothing, offered as an answer of one's own.
    if (own && typed && !taken.has(written) && !options.some((o) => o.label.toLowerCase() === typed)) found.push({ value: written, label: fillIn(words.createNamed, { name: written }) });
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
    if (single) {
      input.value = option.label;
      write(option.value);
      return close();
    }
    input.value = '';
    write(withAlone(options, chosen(), option.value));
    if (document.activeElement === input) open();
    else close();
  }

  if (!single) input.addEventListener('focus', () => !readonly && open());
  input.addEventListener('click', () => !readonly && list.hidden && open());
  input.addEventListener('input', () => !readonly && open());
  input.addEventListener('blur', () => {
    close();
    // One answer: a box emptied takes the choice away; one left half typed shows the choice again.
    if (single && !readonly) {
      if (!input.value.trim()) write(null);
      else input.value = labelOf(current());
    }
  });
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
        if (!single && input.value === '' && chosen().length) write(chosen().slice(0, -1));
        return;
    }
  });

  let drawn = '';
  return {
    element,
    focus: () => input.focus(),
    update(state) {
      readonly = state.readonly;
      if (readonly) close();
      describeState(input, state);
      setAttr(input, 'aria-required', String(state.required));
      if (single) {
        input.readOnly = readonly;
        if (document.activeElement !== input) input.value = labelOf(state.value);
        return;
      }
      const values = Array.isArray(state.value) ? (state.value as unknown[]) : [];
      input.hidden = readonly;
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
  } satisfies ReturnType<WidgetFactory>;
}
