import type { Field, FieldNode } from '@fieldia/core';
import { flowCells, orderFromCells, rowsOf } from './screen-layout';

const node = (widget?: string): FieldNode => ({ type: 'field', id: 'n', field: 'f', ...(widget ? { widget } : {}) });

describe('rowsOf', () => {
  it('gives a one-line field one row and a paragraph two', () => {
    expect(rowsOf({ type: 'char', label: 'Name' }, node())).toBe(1);
    expect(rowsOf({ type: 'text', label: 'Notes' }, node())).toBe(2);
  });

  it('gives a table of lines, rich text and an image room to show', () => {
    expect(rowsOf({ type: 'one2many', label: 'Lines', relation: 'x', fields: {}, columns: [] } as unknown as Field, node())).toBe(3);
    expect(rowsOf({ type: 'html', label: 'Body' }, node())).toBe(3);
    expect(rowsOf({ type: 'image', label: 'Photo' }, node())).toBe(2);
  });

  it('gives a long list of choices a second row', () => {
    const options = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `o${i}`, label: `Option ${i}` }));
    expect(rowsOf({ type: 'selection', label: 'A', options: options(3) }, node('radio'))).toBe(1);
    expect(rowsOf({ type: 'selection', label: 'A', options: options(6) }, node('radio'))).toBe(2);
    expect(rowsOf({ type: 'selection', label: 'A', options: options(6) }, node())).toBe(1); // a dropdown
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
