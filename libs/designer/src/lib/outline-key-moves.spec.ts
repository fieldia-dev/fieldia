import { blankPage, createDesigner } from './designer';
import { outlineKeyMove } from './outline-key-moves';
import { employeePage } from './test-layout';

/**
 * Moving the rows picked in the outline from the keyboard: Alt+↑ and Alt+↓
 * before the row above or after the row below, Alt+← out of their group,
 * Alt+→ into the group before them (mirrored right to left).
 */

const page = employeePage();
const alt = (key: string) => ({ key, altKey: true });

describe('outlineKeyMove', () => {
  it('Alt+↑ and Alt+↓ go before the part above or after the part below, in their own list', () => {
    expect(outlineKeyMove(page, ['f-city'], alt('ArrowUp'), false)).toEqual({ parent: 'address', index: 0 });
    expect(outlineKeyMove(page, ['f-city'], alt('ArrowDown'), false)).toEqual({ parent: 'address', index: 3 });
    // Several together, as one block.
    expect(outlineKeyMove(page, ['f-city', 'f-postcode'], alt('ArrowDown'), false)).toEqual({ parent: 'address', index: 4 });
  });

  it('at the edge of an arrangement they step out of it; at the edge of a group they stop, saying how to get out', () => {
    expect(outlineKeyMove(page, ['f-first_name'], alt('ArrowUp'), false)).toEqual({ parent: 'personal', index: 1 });
    expect(outlineKeyMove(page, ['f-nationality'], alt('ArrowDown'), false)).toEqual({ parent: 'personal', index: 2 });
    expect(outlineKeyMove(page, ['f-street'], alt('ArrowUp'), false)).toEqual({ said: 'It is at the top of “Home address”: Alt+← takes it out' });
    expect(outlineKeyMove(page, ['send'], alt('ArrowDown'), false)).toEqual({ said: 'It is at the bottom of the page' });
  });

  it('Alt+← takes them out of their group, after it; Alt+→ puts them into the group before them, at its end', () => {
    expect(outlineKeyMove(page, ['f-city'], alt('ArrowLeft'), false)).toEqual({ parent: 'side-1', index: 1 });
    expect(outlineKeyMove(page, ['f-confirm'], alt('ArrowRight'), false)).toEqual({ said: 'There is no group before it to put it in' });
    expect(outlineKeyMove(page, ['div-1'], alt('ArrowRight'), false)).toEqual({ parent: 'tab-pay', index: 1 });
    expect(outlineKeyMove(page, ['emergency'], alt('ArrowRight'), false)).toEqual({ parent: 'address', index: 4 });
    expect(outlineKeyMove(page, ['personal'], alt('ArrowLeft'), false)).toEqual({ said: 'It is on the page itself, in no group' });
    expect(outlineKeyMove(page, ['f-photo'], alt('ArrowLeft'), false)).toEqual({ parent: 'root', index: 1 });
  });

  it('out of a tab, they go after its tabs', () => {
    expect(outlineKeyMove(page, ['role'], alt('ArrowLeft'), false)).toEqual({ parent: 'root', index: 3 });
  });

  it('right to left, Alt+→ takes out and Alt+← puts in', () => {
    expect(outlineKeyMove(page, ['f-city'], alt('ArrowRight'), true)).toEqual({ parent: 'side-1', index: 1 });
    expect(outlineKeyMove(page, ['emergency'], alt('ArrowLeft'), true)).toEqual({ parent: 'address', index: 4 });
  });

  it('a survey’s question goes on to the next page or back to the one before at the edge of its own', () => {
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = d.addQuestion('short-answer') as string;
    const two = d.addContainer('Page 2') as string;
    const r = d.addQuestion('short-answer', { parent: two }) as string;
    expect(outlineKeyMove(d.getPage(), [q], alt('ArrowDown'), false)).toEqual({ parent: two, index: 0 });
    expect(outlineKeyMove(d.getPage(), [r], alt('ArrowUp'), false)).toEqual({ parent: 'step-1', index: 1 });
    expect(outlineKeyMove(d.getPage(), [q], alt('ArrowUp'), false)).toEqual({ said: 'It is at the top of the first page' });
    expect(outlineKeyMove(d.getPage(), [q], alt('ArrowLeft'), false)).toEqual({ said: 'A question goes on a page' });
    expect(outlineKeyMove(d.getPage(), [two], alt('ArrowUp'), false)).toEqual({ parent: 'steps', index: 0 });
  });

  it('a survey of one page keeps its questions on it', () => {
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = d.addQuestion('short-answer') as string;
    expect(outlineKeyMove(d.getPage(), [q], alt('ArrowLeft'), false)).toEqual({ said: 'A question goes on a page' });
  });

  it('parts from different groups do not move together', () => {
    expect(outlineKeyMove(page, ['f-city', 'f-email'], alt('ArrowUp'), false)).toEqual({ said: 'Pick parts in the same group to move them together' });
  });

  it('says “they” of several', () => {
    expect(outlineKeyMove(page, ['f-street', 'f-city'], alt('ArrowUp'), false)).toEqual({ said: 'They are at the top of “Home address”: Alt+← takes them out' });
  });

  it('nothing for other keys, or without Alt', () => {
    expect(outlineKeyMove(page, ['f-city'], { key: 'ArrowUp', altKey: false }, false)).toBeNull();
    expect(outlineKeyMove(page, ['f-city'], alt('Enter'), false)).toBeNull();
    expect(outlineKeyMove(page, [], alt('ArrowUp'), false)).toBeNull();
  });
});
