import { blankPage, createDesigner } from './designer';
import { dropSpot } from './outline-drop';
import { outlineRows, shownRows } from './outline-rows';
import { employeePage } from './test-layout';

/**
 * Where a row let go over the outline lands: the top of a row puts it
 * before, the bottom after, the middle of a group, a tab or a page into it;
 * between rows of different depths, how far in the pointer is says which
 * depth — the drop line is drawn that far in.
 */

const page = employeePage();
const rows = outlineRows(page);
const at = (id: string, list = rows) => list.findIndex((r) => r.id === id);
const yes = () => true;

describe('dropSpot', () => {
  it('the top of a row puts it before, the bottom after, in the row’s own list', () => {
    expect(dropSpot(rows, 'root', at('f-city'), 0.1, 9, new Set(), yes)).toEqual({ parent: 'address', index: 1, level: 2, gap: at('f-city') });
    expect(dropSpot(rows, 'root', at('f-city'), 0.9, 9, new Set(), yes)).toEqual({ parent: 'address', index: 2, level: 2, gap: at('f-city') + 1 });
    // A part that holds none splits at its middle.
    expect(dropSpot(rows, 'root', at('f-city'), 0.45, 9, new Set(), yes)).toMatchObject({ parent: 'address', index: 1 });
    expect(dropSpot(rows, 'root', at('f-city'), 0.55, 9, new Set(), yes)).toMatchObject({ parent: 'address', index: 2 });
  });

  it('the middle of a group puts it into the group, at its end', () => {
    expect(dropSpot(rows, 'root', at('address'), 0.5, 0, new Set(), yes)).toEqual({ parent: 'address', index: 4, level: 2, gap: -1, into: 'address' });
    expect(dropSpot(rows, 'root', at('tab-docs'), 0.5, 0, new Set(), yes)).toMatchObject({ parent: 'tab-docs', index: 1, into: 'tab-docs' });
  });

  it('where into is refused — a tab over a tab — the middle splits as for a part', () => {
    const tabOnly = (parent: string) => parent === 'job-tabs';
    expect(dropSpot(rows, 'root', at('tab-docs'), 0.45, 0, new Set(), tabOnly)).toEqual({ parent: 'job-tabs', index: 1, level: 1, gap: at('tab-docs') });
  });

  it('just under a group open, it goes first in the group', () => {
    expect(dropSpot(rows, 'root', at('address'), 0.9, 0, new Set(), yes)).toMatchObject({ parent: 'address', index: 0, level: 2 });
  });

  it('under the last part of a group, the pointer’s depth says whether it goes in the group or after it', () => {
    // After “Country”, the last of Home address, before “Emergency contact”: in Home address, or after it in the row.
    const after = at('f-country');
    expect(dropSpot(rows, 'root', after, 0.9, 9, new Set(), yes)).toMatchObject({ parent: 'address', index: 4, level: 2 });
    expect(dropSpot(rows, 'root', after, 0.9, 1, new Set(), yes)).toMatchObject({ parent: 'side-1', index: 1, level: 1 });
    expect(dropSpot(rows, 'root', after, 0.9, 0, new Set(), yes)).toMatchObject({ parent: 'side-1', index: 1, level: 1 });
    // After “Phone”, the last of Emergency contact, the last of the row, before “Tabs”: three depths to choose from.
    const last = at('f-ec_phone');
    expect(dropSpot(rows, 'root', last, 0.9, 0, new Set(), yes)).toMatchObject({ parent: 'root', index: 2, level: 0 });
    expect(dropSpot(rows, 'root', last, 0.9, 1, new Set(), yes)).toMatchObject({ parent: 'side-1', index: 2, level: 1 });
    expect(dropSpot(rows, 'root', last, 0.9, 2, new Set(), yes)).toMatchObject({ parent: 'emergency', index: 3, level: 2 });
  });

  it('takes the depth nearest the pointer’s that takes the part', () => {
    // A survey's question: never on the page itself, always on a page.
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    d.addQuestion('short-answer');
    d.addContainer('Page 2');
    const survey = outlineRows(d.getPage());
    const onPage = (parent: string) => parent !== 'steps';
    expect(dropSpot(survey, 'steps', 1, 0.9, 0, new Set(), onPage)).toMatchObject({ parent: 'step-1', index: 1, level: 1 });
    // Nothing takes it: the depth asked for, to say why not.
    expect(dropSpot(survey, 'steps', 1, 0.9, 0, new Set(), () => false)).toMatchObject({ parent: 'steps', level: 0 });
  });

  it('a folded group is gone into only by its middle', () => {
    const folded = new Set(['address']);
    const shown = shownRows(rows, folded);
    expect(dropSpot(shown, 'root', at('address', shown), 0.9, 9, folded, yes)).toMatchObject({ parent: 'side-1', index: 1, level: 1 });
    expect(dropSpot(shown, 'root', at('address', shown), 0.5, 9, folded, yes)).toMatchObject({ parent: 'address', index: 4, into: 'address' });
  });

  it('counts only the page’s own parts: a sheet’s header rows hold no place', () => {
    const d = createDesigner({ page: blankPage('sheet', 'Customer') });
    d.addHeaderPart('button', 'Confirm');
    const sheet = outlineRows(d.getPage());
    expect(dropSpot(sheet, 'sheet', 1, 0.1, 0, new Set(), yes)).toMatchObject({ parent: 'sheet', index: 0, level: 0 });
  });

  it('below every row, at the end of the page', () => {
    expect(dropSpot(rows, 'root', rows.length - 1, 1, 0, new Set(), yes)).toMatchObject({ parent: 'root', index: 8, level: 0, gap: rows.length });
  });
});
