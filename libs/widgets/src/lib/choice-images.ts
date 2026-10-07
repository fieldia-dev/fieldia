import type { Option } from '@fieldia/core';
import { layOut, limiter, withAlone } from './choice-rules';
import { clearSelection, describeState, maker, rightToLeft, wordsFor } from './kind-parts';
import { shownOptions } from './shuffle';
import type { WidgetFactory } from './widgets';

/**
 * Pictures to choose from (`selection.image-choice`): each option a card of
 * its `image` over its words. One answer is a radio group with one stop for
 * Tab — the arrows move and pick, going round at the ends, Home and End go to
 * the ends, and left is forward on a right-to-left page — with "Clear
 * selection" when it need not be answered. Several answers, when the field
 * takes several, are checkboxes, each its own stop. "Other" is not offered:
 * an answer of one's own has no picture. `options.shuffle` shows the cards
 * in an order of the form's own. Each picture is described by its option's
 * `alt`. `options.showLabels: false` keeps the words out of sight (still each
 * card's name), `imageSize` is small, medium or large, `imageFit: "whole"`
 * shows the whole picture rather than filling the card, and `columns` lays
 * the cards in columns or in a row.
 */

/** A frame with a hill and a sun: the tile of an option without a picture. */
const BLANK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';

export const imageChoiceWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const multiple = field.type === 'selection' && field.multiple === true;
  const written: Option[] = field.type === 'selection' ? field.options : [];
  const options = shownOptions(written, form, name, node);
  const look = node.options ?? {};
  const bare = look['showLabels'] === false;
  const group = make('div', { id, class: `fd-image-choices${bare ? ' fd-image-choices-bare' : ''}`, role: multiple ? 'group' : 'radiogroup', 'data-size': look['imageSize'] as string, 'data-fit': look['imageFit'] as string });
  layOut(group, node);
  const limit = multiple ? limiter(make, words, node) : null;
  const cards = options.map((option) => {
    const picture = option.image ? make('img', { src: option.image, alt: option.alt ?? '', loading: 'lazy', draggable: 'false' }) : make('span', { class: 'fd-image-card-blank' });
    if (!option.image) picture.innerHTML = BLANK; // a constant drawing, never words from the page
    const card = make(
      'button',
      { type: 'button', class: 'fd-image-card', role: multiple ? 'checkbox' : 'radio', 'aria-checked': 'false', 'aria-label': bare ? option.label : undefined },
      make('span', { class: 'fd-image-card-picture' }, picture),
      make('span', { class: 'fd-image-card-words' }, option.label)
    );
    card.addEventListener('click', () => pick(option));
    group.append(card);
    return card;
  });

  const current = () => form.getState().values[name];
  function pick(option: Option) {
    if (!multiple) return form.setValue(name, option.value);
    const now = Array.isArray(current()) ? (current() as unknown[]) : [];
    const on = new Set(now.includes(option.value) ? now.filter((v) => v !== option.value) : withAlone(written, now, option.value));
    // In the options' own order, as checkboxes keep them, however they are shown.
    form.setValue(name, written.filter((o) => on.has(o.value)).map((o) => o.value));
  }

  let readonly = false;
  if (!multiple) {
    group.addEventListener('keydown', (event) => {
      if (readonly) return;
      const at = cards.indexOf(event.target as HTMLButtonElement);
      if (at === -1) return;
      const back = rightToLeft(group);
      const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, ArrowRight: back ? -1 : 1, ArrowLeft: back ? 1 : -1 };
      const to = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : event.key in steps ? (at + steps[event.key] + cards.length) % cards.length : -1;
      if (to === -1) return;
      event.preventDefault();
      pick(options[to]);
      cards[to].focus();
    });
  }
  const clear = multiple
    ? null
    : clearSelection(document, words, () => {
        form.setValue(name, null);
        cards[0]?.focus();
      }, node);

  if (limit?.element) group.append(limit.element);
  return {
    element: clear ? make('div', { class: 'fd-choices-box' }, group, clear.button) : group,
    focus: () => (cards.find((c) => c.getAttribute('aria-checked') === 'true') ?? cards[0])?.focus(),
    update(state) {
      readonly = state.readonly;
      const chosen = new Set<unknown>(Array.isArray(state.value) ? state.value : [state.value]);
      const stop = multiple ? -1 : Math.max(0, options.findIndex((o) => chosen.has(o.value)));
      const full = !!limit?.full(Array.isArray(state.value) ? state.value.length : 0);
      cards.forEach((card, i) => {
        const on = chosen.has(options[i].value);
        card.setAttribute('aria-checked', String(on));
        card.tabIndex = multiple || i === stop ? 0 : -1;
        card.disabled = readonly || (full && !on && !options[i].exclusive);
      });
      clear?.allow(state);
      clear?.show(options.some((o) => chosen.has(o.value)));
      describeState(group, state);
    },
  };
};
