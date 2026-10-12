import type { CardLine, CardPart, MapCard, PluralWords } from './layout';

/**
 * A map card's lines, read: each line's parts, each part its field and the
 * words after its value. A line is one part ("price") or several on one
 * line, parted by a dot ("Sheikh Zayed · 4 beds · 280 m²").
 */

export interface CardLinePart {
  field: string;
  unit?: string | PluralWords;
}

/** One part of a line, the same whether written as a name or with its words. */
export function cardPart(part: CardPart): CardLinePart {
  return typeof part === 'string' ? { field: part } : part;
}

/** A card's lines, each as its parts. */
export function cardLines(card: Pick<MapCard, 'fields'> | undefined): CardLinePart[][] {
  return (card?.fields ?? []).map((line: CardLine) => (Array.isArray(line) ? line : [line]).map(cardPart));
}

/** Every field a card's lines show, once each, in order. */
export function cardLineFields(card: Pick<MapCard, 'fields'> | undefined): string[] {
  return [...new Set(cardLines(card).flatMap((parts) => parts.map((part) => part.field)))];
}
