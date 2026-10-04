import { rangeOf } from './outline-picks';
import { outlineRows, shownRows } from './outline-rows';
import { employeeDesigner, employeePage } from './test-layout';

/** Several picked from the outline: a range of rows, one added or let go, all at once in the store. */

const rows = outlineRows(employeePage());

describe('rangeOf', () => {
  it('runs from where the pick began to the row reached, that one last', () => {
    expect(rangeOf(rows, 'f-first_name', 'f-mobile')).toEqual(['f-first_name', 'f-last_name', 'f-email', 'f-mobile']);
    expect(rangeOf(rows, 'f-mobile', 'f-last_name')).toEqual(['f-mobile', 'f-email', 'f-last_name']);
    expect(rangeOf(rows, 'f-city', 'f-city')).toEqual(['f-city']);
  });

  it('takes only the rows on show', () => {
    const shown = shownRows(rows, new Set(['who']));
    expect(rangeOf(shown, 'f-photo', 'f-street')).toEqual(['f-photo', 'who', 'side-1', 'address', 'f-street']);
  });

  it('is the row reached alone when where it began is not on show', () => {
    expect(rangeOf(shownRows(rows, new Set(['who'])), 'f-email', 'f-city')).toEqual(['f-city']);
    expect(rangeOf(rows, null, 'f-city')).toEqual(['f-city']);
  });
});

describe('pickMany', () => {
  it('picks the parts given, at once, the last leading', () => {
    const d = employeeDesigner();
    const seen: string[][] = [];
    d.subscribe((state) => seen.push(state.picked));
    d.pickMany(['f-city', 'f-postcode', 'f-street']);
    expect([d.getState().picked, d.getState().selected]).toEqual([['f-city', 'f-postcode', 'f-street'], 'f-street']);
    expect(seen).toHaveLength(1);
  });

  it('leaves out what is not on the page, and parts named twice', () => {
    const d = employeeDesigner();
    d.pickMany(['f-city', 'nothing', 'f-city', 'f-country']);
    expect(d.getState().picked).toEqual(['f-city', 'f-country']);
    d.pickMany([]);
    expect([d.getState().picked, d.getState().selected]).toEqual([[], null]);
  });
});
