import type { Field, FieldNode } from '@fieldia/core';
import { flowCells, GAP, heightOfRows, orderFromCells, ROW_HEIGHT, rowsForHeight, rowsOf } from './screen-layout';

const node = (widget?: string): FieldNode => ({ type: 'field', id: 'n', field: 'f', ...(widget ? { widget } : {}) });

describe('rows', () => {
  it('turns a height into rows and back, gaps included', () => {
    expect(rowsForHeight(ROW_HEIGHT)).toBe(1);
    expect(rowsForHeight(ROW_HEIGHT + 1)).toBe(2);
    expect(heightOfRows(3)).toBe(3 * ROW_HEIGHT + 2 * GAP);
    expect(rowsForHeight(heightOfRows(3))).toBe(3);
  });
});

describe('rowsOf', () => {
  const height = (rows: number) => heightOfRows(rows);

  it('starts a one-line field with room for its label and input', () => {
    expect(height(rowsOf({ type: 'char', label: 'Name' }, node()))).toBeGreaterThanOrEqual(70);
  });

  it('gives a paragraph, a table of lines, rich text and an image more', () => {
    const line = rowsOf({ type: 'char', label: 'Name' }, node());
    expect(rowsOf({ type: 'text', label: 'Notes' }, node())).toBeGreaterThan(line);
    expect(rowsOf({ type: 'image', label: 'Photo' }, node())).toBeGreaterThan(line);
    const lines = rowsOf({ type: 'one2many', label: 'Lines', relation: 'x', fields: {}, columns: [] } as unknown as Field, node());
    expect(lines).toBeGreaterThan(rowsOf({ type: 'text', label: 'Notes' }, node()));
    expect(rowsOf({ type: 'html', label: 'Body' }, node())).toBeGreaterThan(lines);
  });

  it('gives a long list of choices a second line', () => {
    const options = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `o${i}`, label: `Option ${i}` }));
    const line = rowsOf({ type: 'char', label: 'Name' }, node());
    expect(rowsOf({ type: 'selection', label: 'A', options: options(3) }, node('radio'))).toBe(line);
    expect(rowsOf({ type: 'selection', label: 'A', options: options(6) }, node('radio'))).toBeGreaterThan(line);
    expect(rowsOf({ type: 'selection', label: 'A', options: options(6) }, node())).toBe(line); // a dropdown
  });
});

describe('flowCells', () => {
  const at = (cells: Map<string, unknown>, id: string) => cells.get(id);

  it('places fields in order, wrapping at the column count, like the viewer’s grid', () => {
    const cells = flowCells([{ id: 'a', span: 1, rows: 1 }, { id: 'b', span: 1, rows: 1 }, { id: 'c', span: 1, rows: 1 }], 2);
    expect(at(cells, 'a')).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(at(cells, 'b')).toEqual({ x: 1, y: 0, w: 1, h: 1 });
    expect(at(cells, 'c')).toEqual({ x: 0, y: 1, w: 1, h: 1 });
  });

  it('starts a new row when a field is too wide for what is left, leaving the gap', () => {
    const cells = flowCells([{ id: 'a', span: 1, rows: 1 }, { id: 'wide', span: 2, rows: 1 }, { id: 'b', span: 1, rows: 1 }], 2);
    expect(at(cells, 'wide')).toEqual({ x: 0, y: 1, w: 2, h: 1 });
    expect(at(cells, 'b')).toEqual({ x: 0, y: 2, w: 1, h: 1 });
  });

  it('makes each row as tall as its tallest field, as the viewer does', () => {
    const cells = flowCells([{ id: 'notes', span: 1, rows: 2 }, { id: 'a', span: 1, rows: 1 }, { id: 'b', span: 1, rows: 1 }], 2);
    expect(at(cells, 'notes')).toEqual({ x: 0, y: 0, w: 1, h: 2 });
    expect(at(cells, 'a')).toEqual({ x: 1, y: 0, w: 1, h: 1 });
    expect(at(cells, 'b')).toEqual({ x: 0, y: 2, w: 1, h: 1 });
  });

  it('never makes a field wider than its section', () => {
    expect(flowCells([{ id: 'a', span: 3, rows: 1 }], 2).get('a')).toEqual({ x: 0, y: 0, w: 2, h: 1 });
  });
});

describe('orderFromCells', () => {
  it('reads fields top to bottom, then start to end, with their widths', () => {
    expect(
      orderFromCells([
        { id: 'b', x: 1, y: 0, span: 1 },
        { id: 'c', x: 0, y: 2, span: 2 },
        { id: 'a', x: 0, y: 0, span: 1 },
      ])
    ).toEqual([
      { id: 'a', colspan: 1 },
      { id: 'b', colspan: 1 },
      { id: 'c', colspan: 2 },
    ]);
  });

  it('puts a field that starts lower after one that starts higher, whatever its column', () => {
    expect(orderFromCells([{ id: 'low', x: 0, y: 1, span: 1 }, { id: 'high', x: 1, y: 0, span: 1 }]).map((i) => i.id)).toEqual(['high', 'low']);
  });
});
