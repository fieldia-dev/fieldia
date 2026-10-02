import type { Field, FieldNode } from '@fieldia/core';

/**
 * The geometry of a screen on the canvas. A page stores only an order and a
 * width per field; the viewer's CSS grid decides where each one lands. The
 * canvas has to show those same places, so it computes them here rather than
 * letting the board pack fields its own way.
 */

export interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How many canvas rows a field takes: a paragraph or a table of lines needs more than one line. */
export function rowsOf(field: Field, node: FieldNode): number {
  switch (field.type) {
    case 'one2many':
    case 'html':
    case 'json':
      return 3;
    case 'text':
    case 'image':
      return 2;
    case 'selection': {
      const listed = field.multiple || node.widget === 'radio';
      return listed && field.options.length > 4 ? 2 : 1;
    }
    case 'many2many':
      return node.widget === 'checkboxes' ? 2 : 1;
    default:
      return 1;
  }
}

/**
 * Where each field sits: in order, and a field too wide for what is left of a
 * row starts the next one, leaving the gap — the way a CSS grid places items.
 * Each row is as tall as its tallest field, as it is in the viewer.
 */
export function flowCells(items: readonly { id: string; span: number; rows: number }[], columns: number): Map<string, Cell> {
  const placed: { id: string; x: number; row: number; w: number; h: number }[] = [];
  let row = 0;
  let x = 0;
  for (const item of items) {
    const w = Math.max(1, Math.min(columns, item.span));
    if (x + w > columns) {
      row += 1;
      x = 0;
    }
    placed.push({ id: item.id, x, row, w, h: Math.max(1, item.rows) });
    x += w;
  }
  const heights: number[] = [];
  for (const p of placed) heights[p.row] = Math.max(heights[p.row] ?? 0, p.h);
  const tops: number[] = [];
  heights.forEach((_, i) => (tops[i] = i === 0 ? 0 : tops[i - 1] + (heights[i - 1] ?? 0)));
  return new Map(placed.map((p) => [p.id, { x: p.x, y: tops[p.row], w: p.w, h: p.h }]));
}

/** Read a section back off its canvas: top to bottom, then start to end, with each field's width. */
export function orderFromCells(widgets: readonly { id: string; x?: number; y?: number; span?: number }[]): { id: string; colspan: number }[] {
  return [...widgets]
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
    .map((w) => ({ id: w.id, colspan: w.span ?? 1 }));
}
