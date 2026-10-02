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

/**
 * The canvas grid is fine — short rows, so a card can be about as tall as
 * its content rather than rounded up to a whole field's height.
 */
export const ROW_HEIGHT = 12;
export const GAP = 8;

/** The rows that hold `px` of content. */
export function rowsForHeight(px: number): number {
  return Math.max(1, Math.ceil((px + GAP - 0.5) / (ROW_HEIGHT + GAP)));
}

/** The px that `rows` rows take, gaps between them included. */
export function heightOfRows(rows: number): number {
  return rows * ROW_HEIGHT + (rows - 1) * GAP;
}

/**
 * Rows a field starts with, before the canvas has measured its card: a label
 * and one line for most, more for a paragraph or a table of lines.
 */
export function rowsOf(field: Field, node: FieldNode): number {
  switch (field.type) {
    case 'one2many':
    case 'html':
    case 'json':
      return rowsForHeight(240);
    case 'text':
    case 'image':
      return rowsForHeight(160);
    case 'selection': {
      const listed = field.multiple || node.widget === 'radio';
      return rowsForHeight(listed && field.options.length > 4 ? 100 : 70);
    }
    case 'many2many':
      return rowsForHeight(node.widget === 'checkboxes' ? 130 : 70);
    default:
      return rowsForHeight(70);
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
