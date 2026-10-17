/**
 * The cards part (parts.ts in @fieldia/widgets): a record list's rows as cards — on a phone, where the list has
 * `card`, and in its gallery on any width — what a card shows, read from the page with the columns' defaults, each card
 * drawn in its row (list-cards.ts), and their sheet (cards-styles.ts), put in after the list's own. Loaded the first
 * time a page draws a list with `card` or `gallery`, through `cardsPart`, beside the list part; the viewer waits for
 * it before it draws that page. Where it could not come, the list is its table, and offers no gallery.
 */
export { cardReads, cardSpec, drawCard } from './list-cards';
export type { CardContext, CardSpec } from './list-cards';
export { installCardStyles } from './cards-styles';
