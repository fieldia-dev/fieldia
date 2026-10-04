import type { Option } from '@fieldia/core';
import { clearSelection, describeState, maker, rightToLeft, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * Pictures to choose from (`selection.image-choice`): each option a card of
 * its `image` over its words. One answer is a radio group with one stop for
 * Tab — the arrows move and pick, going round at the ends, Home and End go to
 * the ends, and left is forward on a right-to-left page — with "Clear
 * selection" when it need not be answered. Several answers, when the field
 * takes several, are checkboxes, each its own stop. "Other" is not offered:
 * an answer of one's own has no picture.
 */

/** A frame with a hill and a sun: the tile of an option without a picture. */
const BLANK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>';

export const imageChoiceWidget: WidgetFactory = ({ form, name, field, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const multiple = field.type === 'selection' && field.multiple === true;
  const options: Option[] = field.type === 'selection' ? field.options : [];
  const group = make('div', { id, class: 'fd-image-choices', role: multiple ? 'group' : 'radiogroup' });
  const cards = options.map((option) => {
    const picture = option.image ? make('img', { src: option.image, alt: '', loading: 'lazy', draggable: 'false' }) : make('span', { class: 'fd-image-card-blank' });
    if (!option.image) picture.innerHTML = BLANK; // a constant drawing, never words from the page
    const card = make(
      'button',
      { type: 'button', class: 'fd-image-card', role: multiple ? 'checkbox' : 'radio', 'aria-checked': 'false' },
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
    const on = new Set(now);
    if (on.has(option.value)) on.delete(option.value);
    else on.add(option.value);
    // In the options' order, as checkboxes keep them.
    form.setValue(name, options.filter((o) => on.has(o.value)).map((o) => o.value));
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
      });

  return {
    element: clear ? make('div', { class: 'fd-choices-box' }, group, clear.button) : group,
    focus: () => (cards.find((c) => c.getAttribute('aria-checked') === 'true') ?? cards[0])?.focus(),
    update(state) {
      readonly = state.readonly;
      const chosen = new Set<unknown>(Array.isArray(state.value) ? state.value : [state.value]);
      const stop = multiple ? -1 : Math.max(0, options.findIndex((o) => chosen.has(o.value)));
      cards.forEach((card, i) => {
        card.setAttribute('aria-checked', String(chosen.has(options[i].value)));
        card.tabIndex = multiple || i === stop ? 0 : -1;
        card.disabled = readonly;
      });
      clear?.allow(state);
      clear?.show(options.some((o) => chosen.has(o.value)));
      describeState(group, state);
    },
  };
};
