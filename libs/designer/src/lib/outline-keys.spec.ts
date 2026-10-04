import { OUTLINE_KEYS, treeKey, typeAhead } from './outline-keys';
import { outlineRows, shownRows } from './outline-rows';
import { employeePage } from './test-layout';

/** The outline answers the keys a tree does: up and down, fold and unfold, to the parent and the first child, Home and End, and the first letters of a name. */

const rows = outlineRows(employeePage());
const at = (id: string, list = rows) => list.findIndex((r) => r.id === id);
const key = (name: string, more: Partial<KeyboardEventInit> = {}) => ({ key: name, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...more });
const none = new Set<string>();

describe('treeKey', () => {
  it('↓ and ↑ go to the next and the row before, and no further than the ends', () => {
    expect(treeKey(rows, 0, key('ArrowDown'), false, none)).toEqual({ to: 1, extend: false });
    expect(treeKey(rows, 3, key('ArrowUp'), false, none)).toEqual({ to: 2, extend: false });
    expect(treeKey(rows, 0, key('ArrowUp'), false, none)).toEqual({ none: true });
    expect(treeKey(rows, rows.length - 1, key('ArrowDown'), false, none)).toEqual({ none: true });
  });

  it('with Shift, they take the pick along', () => {
    expect(treeKey(rows, 3, key('ArrowDown', { shiftKey: true }), false, none)).toEqual({ to: 4, extend: true });
    expect(treeKey(rows, 3, key('ArrowUp', { shiftKey: true }), false, none)).toEqual({ to: 2, extend: true });
  });

  it('Home and End go to the first and the last row', () => {
    expect(treeKey(rows, 5, key('Home'), false, none)).toEqual({ to: 0, extend: false });
    expect(treeKey(rows, 5, key('End'), false, none)).toEqual({ to: rows.length - 1, extend: false });
    expect(treeKey(rows, 5, key('End', { shiftKey: true }), false, none)).toEqual({ to: rows.length - 1, extend: true });
  });

  it('→ unfolds a folded row, then goes to its first part; on a part that holds none it does nothing', () => {
    const folded = new Set(['personal']);
    const shown = shownRows(rows, folded);
    expect(treeKey(shown, at('personal', shown), key('ArrowRight'), false, folded)).toEqual({ unfold: 'personal' });
    expect(treeKey(rows, at('personal'), key('ArrowRight'), false, none)).toEqual({ to: at('f-photo'), extend: false });
    expect(treeKey(rows, at('f-photo'), key('ArrowRight'), false, none)).toEqual({ none: true });
  });

  it('← folds an open row, or goes to the row it sits in; at the top, folded, it does nothing', () => {
    expect(treeKey(rows, at('who'), key('ArrowLeft'), false, none)).toEqual({ fold: 'who' });
    expect(treeKey(rows, at('f-email'), key('ArrowLeft'), false, none)).toEqual({ to: at('who'), extend: false });
    const folded = new Set(['personal']);
    expect(treeKey(shownRows(rows, folded), 0, key('ArrowLeft'), false, folded)).toEqual({ none: true });
    expect(treeKey(rows, at('send'), key('ArrowLeft'), false, none)).toEqual({ none: true });
  });

  it('a group with nothing in it neither folds nor unfolds', () => {
    const empty = [{ id: 'g', label: 'Group', level: 0, parent: null, holds: true, children: 0 }];
    expect(treeKey(empty, 0, key('ArrowRight'), false, none)).toEqual({ none: true });
    expect(treeKey(empty, 0, key('ArrowLeft'), false, none)).toEqual({ none: true });
  });

  it('right to left, ← goes in and → comes out', () => {
    expect(treeKey(rows, at('personal'), key('ArrowLeft'), true, none)).toEqual({ to: at('f-photo'), extend: false });
    expect(treeKey(rows, at('who'), key('ArrowRight'), true, none)).toEqual({ fold: 'who' });
    expect(treeKey(rows, at('f-email'), key('ArrowRight'), true, none)).toEqual({ to: at('who'), extend: false });
  });

  it('Enter picks and shows it on the page; Space picks, and with ⌘ or Ctrl adds it or lets it go', () => {
    expect(treeKey(rows, 2, key('Enter'), false, none)).toEqual({ pick: 'one', reveal: true });
    expect(treeKey(rows, 2, key(' '), false, none)).toEqual({ pick: 'one', reveal: false });
    expect(treeKey(rows, 2, key(' ', { metaKey: true }), false, none)).toEqual({ pick: 'toggle', reveal: false });
    expect(treeKey(rows, 2, key(' ', { ctrlKey: true }), false, none)).toEqual({ pick: 'toggle', reveal: false });
  });

  it('leaves Alt and ⌘ with the arrows, and every other key, to others', () => {
    expect(treeKey(rows, 2, key('ArrowDown', { altKey: true }), false, none)).toBeNull();
    expect(treeKey(rows, 2, key('ArrowDown', { metaKey: true }), false, none)).toBeNull();
    expect(treeKey(rows, 2, key('ArrowDown', { ctrlKey: true }), false, none)).toBeNull();
    expect(treeKey(rows, 2, key('Home', { ctrlKey: true }), false, none)).toBeNull();
    expect(treeKey(rows, 2, key('Enter', { altKey: true }), false, none)).toBeNull();
    expect(treeKey(rows, 2, key('a'), false, none)).toBeNull();
    expect(treeKey(rows, 2, key('Delete'), false, none)).toBeNull();
  });
});

describe('typeAhead', () => {
  it('goes to the next row whose name starts with the letters typed, from the one after, round to the top', () => {
    expect(typeAhead(rows, 0, 'c')).toBe(at('f-city'));
    expect(typeAhead(rows, at('f-city'), 'c')).toBe(at('f-country'));
    expect(typeAhead(rows, at('f-city'), 'co')).toBe(at('f-country'));
    expect(typeAhead(rows, at('f-country'), 'con')).toBe(at('f-contract'));
    expect(typeAhead(rows, rows.length - 1, 'p')).toBe(at('personal'));
  });

  it('keeps to the row it is on while more letters still fit it, whatever the case', () => {
    expect(typeAhead(rows, at('f-city'), 'CI')).toBe(at('f-city'));
  });

  it('the same letter again goes round the rows starting with it', () => {
    expect(typeAhead(rows, at('f-city'), 'cc')).toBe(at('f-country'));
  });

  it('nothing for letters no row starts with', () => {
    expect(typeAhead(rows, 0, 'zz')).toBe(-1);
    expect(typeAhead(rows, 0, '')).toBe(-1);
  });
});

describe('the outline’s keys, for the sheet of shortcuts', () => {
  it('names each key and what it does', () => {
    expect(OUTLINE_KEYS.map(([keys]) => keys)).toEqual(expect.arrayContaining(['↑ / ↓', '← / →', 'Home / End', 'Enter', 'A letter']));
    for (const [, what] of OUTLINE_KEYS) expect(what).toMatch(/^[A-Z]/);
  });
});
