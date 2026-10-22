import { foldForSearch, type Option } from '@fieldia/core';
import { withAlone } from './choice-rules';
import { floatUnder } from './float';
import { quoted, refusalHint } from './input-rules';
import { fillIn, maker, setAttr, wordsFor } from './kind-parts';
import { optionCaption, optionMark } from './option-look';
import { seatWords } from './seats';
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
 * list — the box shows the choice, typing finds others; emptied, it takes the
 * choice away.
 *
 * Words are found as people write them: in any case, Arabic letters in any of
 * their forms (أ إ آ as ا, ة as ه, ى as ي, no tatweel or short vowels), digits
 * in any script. Enter takes the match the arrows reached, else the only
 * match, else the option of that exact name, and never sends the form. Left
 * with words typed, the box takes the option of that name (or, with
 * `ownAnswers`, adds them as an answer of one's own); words that name nothing
 * stay as typed, kept unread with why, and the box says so under itself: the
 * field holds what it held, and a save is refused rather than made with it.
 * Escape puts it back. A save, a check or a step forward made while words are
 * still typed reads them as leaving would (`form.settling`).
 *
 * An option's places left show after its words in the list, as a radio's do
 * ("3 left", "Full"); a full one taken is refused by the form, and the box
 * keeps the choice it held — a tag is never added.
 */
export const choiceTagsWidget: WidgetFactory = (context) => combo(context, false);
export const searchWidget: WidgetFactory = (context) => combo(context, true);

function combo({ form, name, field, node, id, document, labels, locale }: WidgetContext, single: boolean) {
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
    // A long list's one choice — a country among two hundred — the browser may fill in by name, where the page says.
    autocomplete: (single && node.autocomplete) || 'off',
    placeholder: node.placeholder || words.search,
  });
  const list = make('ul', { id: listId, class: 'fd-listbox', role: 'listbox', hidden: '' });
  const chips = make('ul', { class: 'fd-chips' });
  const box = make('div', { class: 'fd-combo' }, input, list);
  const floating = floatUnder(input, list);
  // Why typed words were not taken: under the box, polite, gone at the next key.
  const hint = refusalHint(input, box);
  const label = node.label ?? field.label;
  const fold = (text: string) => foldForSearch(text).trim();
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
    const places = form.getState().limits?.seats?.[name];
    list.replaceChildren(
      ...found.map((option, i) => {
        const shown = places?.[String(option.value)];
        const left = seatWords(shown, words);
        // Its icon or colour before its words and its second line under them, where the page gives them.
        const mark = optionMark(make, option);
        const caption = optionCaption(make, option, `${listId}-${i}-more`);
        const item = make(
          'li',
          { id: `${listId}-${i}`, role: 'option', class: `fd-option${mark || caption ? ' fd-option-rich' : ''}${i === active ? ' fd-active' : ''}`, 'aria-selected': String(i === active), 'aria-describedby': caption?.id },
          ...(mark ? [mark] : []),
          caption ? make('span', { class: 'fd-option-text' }, option.label, caption) : option.label,
          ...(left ? [make('small', { class: 'fd-seats', ...(shown?.left === 0 ? { 'data-full': '' } : {}) }, left)] : [])
        );
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
    const typed = single && written === labelOf(current()) ? '' : fold(written);
    const taken = new Set(chosen());
    found = options.filter((o) => !taken.has(o.value) && fold(o.label).includes(typed));
    // Words that match nothing, offered as an answer of one's own.
    if (own && typed && !taken.has(written) && !options.some((o) => fold(o.label) === typed)) found.push({ value: written, label: fillIn(words.createNamed, { name: written }) });
    active = -1;
    draw();
    floating.show();
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    floating.hide();
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function add(option: Option) {
    letGo();
    if (single) {
      write(option.value);
      // Refused — a full option — the box shows the choice it still holds.
      input.value = labelOf(current());
      return close();
    }
    input.value = '';
    write(withAlone(options, chosen(), option.value));
    if (document.activeElement === input) open();
    else close();
  }

  /** The option typed words name exactly, folded: one not chosen yet. */
  const named = (text: string) => {
    const taken = new Set(chosen());
    return options.find((o) => !taken.has(o.value) && fold(o.label) === fold(text));
  };
  /** Nothing is called what was typed: said under the box — left, with the choice the field still holds. */
  const noMatch = (text: string, left = false) => {
    const said = fillIn(words.noMatch, { label, text: quoted(text) });
    const held = left && single ? labelOf(current()) : '';
    hint.show(held ? `${said}. ${fillIn(words.stillHolds, { label, value: held })}` : said);
  };
  /** Words that name nothing, left or read for a save: they stay as typed, kept unread with why, and it is said. */
  const keepUnread = (typed: string, left = false) => {
    const text = typed.trim();
    noMatch(text, left);
    form.setUnread(name, { text: typed, message: fillIn(words.noMatch, { label, text: quoted(text) }) });
  };
  const unreadNow = () => form.getState().unread?.[name];
  const letGo = () => unreadNow() && form.setUnread(name, null);

  /**
   * Words typed and not yet a choice, read for a save, a check or a step forward, as if the box were left: the option
   * of that name taken (or an answer of one's own added); else they stay, kept unread with why, and the save waits.
   */
  function readNow() {
    if (readonly || document.activeElement !== input) return;
    const typed = input.value;
    const text = typed.trim();
    if (single) {
      if (!text) {
        letGo();
        if (current() !== null && current() !== undefined) write(null);
        return;
      }
      if (text === labelOf(current())) return letGo();
    } else if (!text) return letGo();
    const option = named(text);
    if (option) {
      letGo();
      if (single) return add(option);
      input.value = '';
      return write(withAlone(options, chosen(), option.value));
    }
    if (!single && (chosen().some((value) => fold(labelOf(value)) === fold(text)) || own)) {
      input.value = '';
      letGo();
      if (own && !chosen().some((value) => fold(labelOf(value)) === fold(text))) write([...chosen(), text]);
      return;
    }
    close();
    keepUnread(typed);
  }
  // Still typed in (words that are no choice yet): autosave, which nobody pressed, waits until the box is left.
  const typingHere = () => document.activeElement === input && !readonly && input.value.trim() !== (single ? labelOf(current()) : '');
  const stopReading = typeof form.settling === 'function' ? form.settling(readNow, typingHere) : null;

  // Its list drops open for a person — a click (or a tap), a word typed, Alt+Down or the arrows — never for the focus
  // alone, which the program may put there (a dialog's first field, a refused save to the field to fix).
  input.addEventListener('click', () => !readonly && list.hidden && open());
  input.addEventListener('input', () => {
    hint.hide();
    if (readonly) return;
    // Written while the person is elsewhere — the browser's autofill, from a pick in another box: read as it is left.
    if (document.activeElement !== input) return left();
    open();
  });
  input.addEventListener('blur', () => left());
  function left() {
    close();
    if (readonly) return;
    const typed = input.value;
    const text = typed.trim();
    // Words a save kept unread, left again as they were: still unread, with why.
    if (unreadNow()?.text === typed) return;
    // Left, the words are read as leaving reads them: what a save kept unread goes with them.
    letGo();
    if (single) {
      // One answer: a box emptied takes the choice away; the exact name of an option picks it.
      if (!text) return write(null);
      if (text === labelOf(current())) return;
      const option = named(text);
      if (option) return add(option);
      return keepUnread(typed, true);
    }
    if (!text) return;
    // Tags: the option of that name is added, or the words as an answer of one's own; a tag there already, they go.
    const option = named(text);
    if (option) {
      input.value = '';
      return write(withAlone(options, chosen(), option.value));
    }
    if (chosen().some((value) => fold(labelOf(value)) === fold(text))) {
      input.value = '';
      return;
    }
    if (own) {
      input.value = '';
      return write([...chosen(), text]);
    }
    keepUnread(typed, true);
  }
  input.addEventListener('keydown', (event) => {
    // A key an IME is composing with — the Enter that takes its word — is the IME's.
    if (readonly || event.isComposing || event.keyCode === 229) return;
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
        const text = input.value.trim();
        // Words typed: never the form's Enter. The match reached, the only one, or the option of that exact name.
        if (!text && !(found[active] && !list.hidden)) return;
        event.preventDefault();
        if (list.hidden) open();
        // The options themselves, not the offer of an answer of one's own, which Enter takes when nothing else matches.
        const real = found.filter((o) => options.includes(o));
        const pick = found[active] ?? (real.length === 1 ? real[0] : undefined) ?? real.find((o) => fold(o.label) === fold(text)) ?? (real.length ? undefined : found[0]);
        if (pick) add(pick);
        else if (!(single && text === labelOf(current()))) noMatch(text);
        return;
      }
      case 'Escape': {
        if (!list.hidden) event.preventDefault();
        close();
        // Words typed, or kept unread by a save, are let go: the box shows the choice it holds, as a link's Escape puts
        // back what it held — never words of none left to be kept unread as the box is left.
        const held = single ? labelOf(current()) : '';
        if (unreadNow() || input.value !== held) {
          letGo();
          input.value = held;
        }
        return;
      }
      case 'Backspace':
        if (!single && input.value === '' && chosen().length) write(chosen().slice(0, -1));
        return;
    }
  });

  let drawn = '';
  return {
    element,
    focus: () => input.focus(),
    destroy: () => {
      // Taken away with words typed in it — a cell's editor closed, which a browser may do without a blur: read as
      // leaving reads them, never dropped.
      const typed = input.value.trim();
      if (typed !== (single ? labelOf(current()) : '') && unreadNow()?.text !== input.value) left();
      stopReading?.();
    },
    update(state) {
      readonly = state.readonly;
      if (readonly) close();
      const kept = unreadNow();
      setAttr(input, 'aria-invalid', String(state.invalid || (!!kept && document.activeElement !== input)));
      setAttr(input, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
      setAttr(input, 'aria-required', String(state.required));
      if (single) {
        input.readOnly = readonly;
        // Words a save kept unread stay as typed, marked; else the choice held.
        if (document.activeElement !== input) input.value = kept ? kept.text : labelOf(state.value);
        return;
      }
      const values = Array.isArray(state.value) ? (state.value as unknown[]) : [];
      input.hidden = readonly;
      // Words a save or leaving kept unread stay as typed; once the form lets them go (another record, Escape), they go.
      if (document.activeElement !== input && input.value && !kept) input.value = '';
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
