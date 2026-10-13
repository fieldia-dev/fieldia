import { drawIcon } from './icons';
import type { Make } from './kind-parts';

/**
 * What Fieldia's own lists share, drawn as a work tracker draws its lists: a
 * row for each choice, a tick before the one picked and its words after,
 * the row being worked on in the selection colour with a focus rectangle
 * round its words (styles-picker). A choice's own list and a state's list of
 * states are made of these rows, each with its own role.
 */

/** A row of a list: a tick shown while it is the one picked, and its words. */
export function pickRow(make: Make, attrs: Record<string, string | undefined>, words: string): HTMLElement {
  const tick = make('span', { class: 'fd-pick-tick', 'aria-hidden': 'true' });
  const check = drawIcon(tick.ownerDocument, 'check');
  if (check) tick.append(check);
  return make('div', { ...attrs, class: `${attrs['class'] ? `${attrs['class']} ` : ''}fd-pick-row` }, tick, make('span', { class: 'fd-pick-words' }, words));
}

/** Whether a key pressed is a letter or a digit typed to find a row by its first words, and not a command. */
export const typedKey = (event: KeyboardEvent): boolean => event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;

/**
 * Type-ahead: the letters typed in a moment find the next row whose words
 * start with them; the same letter again moves on to the next row it starts.
 * Hands back the row's place, or -1 when none starts so.
 */
export function typeAhead(words: () => readonly string[]) {
  let typed = '';
  let last = 0;
  return (key: string, from: number): number => {
    const now = Date.now();
    if (now - last > 700) typed = '';
    last = now;
    typed += key.toLocaleLowerCase();
    const all = words().map((text) => text.trim().toLocaleLowerCase());
    const seek = (wanted: string, start: number) => {
      for (let step = 0; step < all.length; step++) {
        const at = (start + step) % all.length;
        if (all[at].startsWith(wanted)) return at;
      }
      return -1;
    };
    // One letter pressed again and again moves through the rows it starts.
    const again = [...typed].every((letter) => letter === typed[0]);
    const found = again ? seek(typed[0], from + 1) : seek(typed, Math.max(from, 0));
    if (found >= 0 || typed.length === 1) return found;
    // Nothing starts with all the letters typed: the last one starts afresh.
    typed = key.toLocaleLowerCase();
    return seek(typed, from + 1);
  };
}

/** A row brought into its list's view, the list alone scrolled: never the page round it. */
export function scrollToRow(list: HTMLElement, row: HTMLElement | undefined | null): void {
  if (!row) return;
  const [box, own] = [list.getBoundingClientRect(), row.getBoundingClientRect()];
  if (own.top < box.top) list.scrollTop -= box.top - own.top + 8;
  else if (own.bottom > box.bottom) list.scrollTop += own.bottom - box.bottom + 8;
}
