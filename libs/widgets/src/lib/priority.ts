import type { Value } from '@fieldia/core';
import { describeState, maker, rightToLeft, setAttr } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * Priority stars: Flectra's widget="priority". Over a selection, a star for
 * each option after the first — '0'…'3' is three stars, '0'/'1' one — the
 * first option meaning none; over a yes or no, one star. The star picked,
 * clicked again, takes the stars back to none, so no "Clear selection" is
 * needed. A group of radios, each named by its option; the arrow keys move
 * one star at a time, mirrored right to left.
 */
export const priorityWidget: WidgetFactory = ({ form, name, field, id, document }) => {
  const make = maker(document);
  // The levels in order, the first being none: a selection's options, or no and yes.
  const levels: { value: Value; label: string }[] =
    field.type === 'selection' ? field.options.map((option) => ({ value: option.value, label: option.label })) : [{ value: false, label: '' }, { value: true, label: field.label }];
  const group = make('div', { id, class: 'fd-priority', role: 'radiogroup' });
  const stars = levels.slice(1).map((level, i) => {
    const star = make('button', { type: 'button', role: 'radio', class: 'fd-priority-star', 'aria-label': level.label, title: level.label, 'data-value': String(level.value) }, '★');
    star.addEventListener('click', () => form.setValue(name, levelOf(form.getState().values[name]) === i + 1 ? levels[0].value : level.value));
    group.append(star);
    return star;
  });
  const levelOf = (value: Value | undefined) => Math.max(0, levels.findIndex((level) => level.value === value));
  let readonly = false;
  group.addEventListener('keydown', (event) => {
    if (readonly) return;
    const forward = rightToLeft(group) ? 'ArrowLeft' : 'ArrowRight';
    const back = rightToLeft(group) ? 'ArrowRight' : 'ArrowLeft';
    const step = event.key === forward || event.key === 'ArrowUp' ? 1 : event.key === back || event.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.min(levels.length - 1, Math.max(0, levelOf(form.getState().values[name]) + step));
    form.setValue(name, levels[next].value);
    stars[Math.max(0, next - 1)]?.focus();
  });
  return {
    element: group,
    focus: () => (stars.find((star) => star.tabIndex === 0) ?? stars[0])?.focus(),
    update(state) {
      readonly = state.readonly;
      const level = levelOf(state.value);
      stars.forEach((star, i) => {
        setAttr(star, 'aria-checked', String(level === i + 1));
        star.classList.toggle('fd-on', i < level);
        const tab = level === i + 1 || (level === 0 && i === 0) ? 0 : -1;
        if (star.tabIndex !== tab) star.tabIndex = tab;
        if (star.disabled !== state.readonly) star.disabled = state.readonly;
      });
      describeState(group, state);
    },
  };
};
