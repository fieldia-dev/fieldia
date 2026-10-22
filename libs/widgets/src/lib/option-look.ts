import type { Option } from '@fieldia/core';
import { drawIcon } from './icons';
import type { Make } from './kind-parts';

/**
 * What an option says beside its words where its page gives it more (field.ts `Option`): an icon or its colour's dot
 * before them, and a second line under them — a service's length and price, a staff member's role, a stage's colour.
 * Radios and checkboxes draw them (widgets.ts, given these by the choice part, which a page whose options have any asks
 * for), and Fieldia's own lists (own-list.ts, choice-tags.ts); the browser's own list, which shows one line of words, is
 * never used for a choice whose options have any. Their rules are the main sheet's: a link's suggestions draw them too.
 */
export type OptionLook = Pick<Option, 'caption' | 'icon' | 'color'>;


/** The mark before an option's words: its icon (in its colour, where it has one), else its colour's dot; null for neither. */
export function optionMark(make: Make, option: OptionLook): HTMLElement | null {
  const mark = make('span', { 'aria-hidden': 'true' });
  const icon = option.icon ? drawIcon(mark.ownerDocument, option.icon) : null;
  if (!icon && !option.color) return null;
  mark.className = icon ? 'fd-option-icon' : 'fd-option-dot';
  if (icon) mark.append(icon);
  if (option.color) mark.style.setProperty('--fd-option-color', option.color);
  return mark;
}

/**
 * An option's second line, under its words; null where it has none. It describes the option, read after its name —
 * its owner's `aria-describedby` names it by `id` — and never renames it: an option is named by its words alone, as a
 * person's or a test's `getByRole('option', { name })` finds it.
 */
export const optionCaption = (make: Make, option: OptionLook, id: string): HTMLElement | null => (option.caption ? make('span', { class: 'fd-option-caption', id, 'aria-hidden': 'true' }, option.caption) : null);
