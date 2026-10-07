import { wideColumns, type FieldNode, type FieldType, type LabelPlace, type SectionNode } from '@fieldia/core';

/**
 * Where a part sits, as the viewer lays a page out: how many columns the grid
 * round it has, whether anything is drawn round it yet, and where labels go
 * there. Worked out once, top down, so the stylesheet is handed plain facts.
 */
export interface Place {
  /** The columns of the grid it sits in, at full width: one on the page, in a tab or in a step. */
  columns: number;
  /** Nothing is drawn round it yet: a card here is a box of its own. */
  onPage: boolean;
  /** Where labels sit here, as the page or a group round it says; undefined leaves them to the skin. */
  labels?: LabelPlace;
  /** On a line of parts: words are drawn as words in the line, not a paragraph of their own. */
  inline?: boolean;
}

export type SectionStyle = NonNullable<SectionNode['style']>;

export interface SectionPlan {
  style: SectionStyle;
  /**
   * An arrangement: untitled and plain, it only holds parts side by side or
   * one under another. In a grid with columns it lays them on the `tracks` it
   * covers there; one column wide with columns of its own, they share that
   * one cell (`shared`). Anywhere else it has a grid of its own.
   */
  arrangement: boolean;
  at?: 'tracks' | 'shared';
  /** Where the parts inside it sit. */
  inner: Place;
}

/** How a section is drawn where it sits, and where that leaves the parts inside it. */
export function planSection(node: SectionNode, place: Place): SectionPlan {
  const style = node.style ?? 'card';
  const arrangement = style === 'plain' && !node.title;
  const own = wideColumns(node.columns);
  const span = node.colspan ?? 1;
  const at = arrangement && place.columns > 1 ? (span === 1 && own > 1 ? 'shared' : 'tracks') : undefined;
  return {
    style,
    arrangement,
    at,
    inner: {
      columns: at === 'tracks' ? Math.min(span, place.columns) : own,
      // A line under a title and a plain group draw no box: what is inside them still sits on the page.
      onPage: place.onPage && (style === 'plain' || style === 'line'),
      labels: node.labels ?? place.labels,
    },
  };
}

/** Kinds shown as a table: no room beside them for a label, which goes above. */
const TABLES = new Set<FieldType>(['one2many', 'matrix']);

/**
 * Where a field's label sits: its own place, else where it is put; a table's label beside it goes above.
 * A tick box's words always come after the box: they are all it says, and beside or out of sight would part them from it.
 */
export function labelPlace(node: FieldNode, type: FieldType, place: LabelPlace | undefined): LabelPlace | 'after' | undefined {
  if (type === 'boolean' && node.widget === 'tick') return 'after';
  const chosen = node.labels ?? place;
  return chosen === 'beside' && TABLES.has(type) ? 'above' : chosen;
}
