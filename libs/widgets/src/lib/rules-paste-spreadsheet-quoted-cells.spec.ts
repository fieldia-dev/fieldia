import { blockOf } from './cell-paste';

/**
 * A block copied from a spreadsheet, as Excel, Google Sheets, LibreOffice and Numbers put it on the clipboard as text:
 * a cell holding a line break (Alt+Enter) or a double quote is written in double quotes, its quotes doubled —
 * `"Oak top⏎black frame"⇥7` is ONE row of two cells. The grid's paste (grid.ts `pasteBlock` → cell-paste.ts `blockOf`)
 * splits at every line break, quotes or not: the order demo, a block pasted on line 2's Description, wrote `"Oak top`
 * there, `black frame"` over line 3's Description and 7 over line 3's Quantity ("Pasted into 3 cells.") — a value put
 * in the wrong line, in silence. `"5"" screen"` is pasted as those very characters, quotes and all.
 */

describe('a spreadsheet’s block, its cells quoted as spreadsheets quote them', () => {
  it('a cell holding a line break stays one cell of one row', () => {
    expect(blockOf('"Oak top\nblack frame"\t7\n')).toEqual([['Oak top\nblack frame', '7']]);
  });

  it('a cell holding a double quote is read without the quoting', () => {
    expect(blockOf('"5"" screen"\t3')).toEqual([['5" screen', '3']]);
  });
});
