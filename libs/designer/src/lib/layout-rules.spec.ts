import { blankPage, createDesigner } from './designer';
import { nameOf } from './layout-tree';
import { employeeDesigner, employeePage, nodeOf, spot, watched, where } from './test-layout';

/**
 * The rules under the drops, case by case: how wide a part is where it lands,
 * when parts make a row, the columns an arrangement covers in a grid, what is
 * folded away, and what a drop calls each part.
 */

const span = (d: ReturnType<typeof employeeDesigner>, id: string) => nodeOf(d.getPage(), id)?.['colspan'];
const parentOf = (d: ReturnType<typeof employeeDesigner>, id: string) => where(d.getPage(), id)?.parent;

describe('how wide a part is where it lands', () => {
  it('one column wide under a part in one column, in a free cell, in a shared cell, or as a row’s new column', () => {
    const under = employeeDesigner();
    under.place('f-street', { how: 'under', target: 'f-ec_phone', after: true });
    expect(span(under, 'f-street')).toBeUndefined();
    const free = employeeDesigner();
    free.place('f-street', { how: 'beside', target: 'f-salary', after: true });
    expect([parentOf(free, 'f-street'), span(free, 'f-street')]).toEqual(['role', undefined]);
    const shared = employeeDesigner();
    shared.place('f-street', { how: 'beside', target: 'f-ec_phone', after: true });
    expect(span(shared, 'f-street')).toBeUndefined();
    const column = employeeDesigner();
    column.place('f-street', { how: 'beside', target: 'side-1', after: true });
    expect(span(column, 'f-street')).toBeUndefined();
    const inRow = employeeDesigner();
    inRow.place('f-street', { how: 'beside', target: 'emergency', after: true });
    expect(where(inRow.getPage(), 'f-street')?.kids).toEqual(['address', 'emergency', 'f-street']);
    expect(span(inRow, 'f-street')).toBeUndefined();
  });

  it('halves a part two columns wide in a grid of two', () => {
    const d = employeeDesigner();
    const id = d.place({ kind: 'short-answer' }, { how: 'beside', target: 'f-street', after: true }) as string;
    expect(where(d.getPage(), id)).toMatchObject({ parent: 'address', kids: ['f-street', id, 'f-city', 'f-postcode', 'f-country'] });
    expect([span(d, 'f-street'), span(d, id)]).toEqual([undefined, undefined]);
  });

  it('narrows a part written wider than its grid when another goes under or beside it', () => {
    const page = employeePage();
    Object.assign(spot(page, 'f-first_name')?.node ?? {}, { colspan: 4 });
    Object.assign(spot(page, 'f-confirm')?.node ?? {}, { colspan: 2 });
    const d = watched(createDesigner({ page }));
    d.place('f-mobile', { how: 'under', target: 'f-first_name', after: true });
    expect([span(d, 'f-first_name'), span(d, 'f-mobile')]).toEqual([2, 2]);
    d.place('send', { how: 'beside', target: 'f-confirm', after: true });
    expect(span(d, 'f-confirm')).toBeUndefined();
  });

  it('the part left in an arrangement takes the arrangement’s width', () => {
    const d = employeeDesigner();
    d.wrap(['f-job_title', 'f-department'], 'side');
    expect(nodeOf(d.getPage(), parentOf(d, 'f-job_title') as string)).toMatchObject({ colspan: 2, columns: 2 });
    d.place('f-department', { how: 'into', container: 'emergency' });
    expect([parentOf(d, 'f-job_title'), span(d, 'f-job_title')]).toEqual(['role', 2]);
  });
});

describe('free cells and rows', () => {
  it('a free cell in a row that is not the last, and what comes after stays', () => {
    const d = employeeDesigner();
    d.setColspan('f-manager', 3);
    const id = d.place({ kind: 'number' }, { how: 'beside', target: 'f-department', after: true }) as string;
    expect(where(d.getPage(), id)?.kids.slice(0, 4)).toEqual(['f-job_title', 'f-department', id, 'f-manager']);
    const other = employeeDesigner();
    const end = other.place({ kind: 'number' }, { how: 'beside', target: 'f-end_date', after: true }) as string;
    expect(where(other.getPage(), end)?.kids.slice(-3)).toEqual(['f-end_date', end, 'f-salary']);
  });

  it('in a one-column group, parts beside one give the group a column each, the rest staying the whole width', () => {
    const d = employeeDesigner();
    d.place('f-mobile', { how: 'beside', target: 'f-ec_phone', after: true });
    d.place('f-email', { how: 'beside', target: 'f-ec_phone', after: true });
    expect(where(d.getPage(), 'f-email')).toMatchObject({ parent: 'emergency', kids: ['f-ec_name', 'f-ec_relation', 'f-ec_phone', 'f-email', 'f-mobile'], columns: 3 });
    expect(['f-ec_name', 'f-ec_relation', 'f-ec_phone', 'f-email', 'f-mobile'].map((id) => nodeOf(d.getPage(), id)?.['colspan'])).toEqual([3, 3, undefined, undefined, undefined]);
  });

  it('in a grid, a second part beside one sharing a cell shares a cell of its own there', () => {
    const d = employeeDesigner();
    d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: true });
    const shared = parentOf(d, 'f-nationality') as string;
    const id = d.place({ kind: 'number' }, { how: 'beside', target: 'f-first_name', after: true }) as string;
    expect(where(d.getPage(), id)).toMatchObject({ kids: ['f-first_name', id], grand: shared });
  });

  it('a titled group is never a row — it takes a column more, its parts in its own columns — nor is a row with a line across it', () => {
    const d = employeeDesigner();
    const group = d.wrap(['h-send', 't-note'], 'group') as string;
    d.place('send', { how: 'beside', target: 'h-send', after: true });
    expect(nodeOf(d.getPage(), group)?.['columns']).toEqual({ wide: 3, narrow: 1 });
    expect(where(d.getPage(), 'send')).toMatchObject({ parent: group, kids: ['h-send', 'send', 't-note'] });
    const other = employeeDesigner();
    const row = other.wrap(['f-confirm', 'send'], 'side') as string;
    other.addBlock('divider', { after: 'f-confirm' });
    const id = other.place({ kind: 'number' }, { how: 'beside', target: 'f-confirm', after: true }) as string;
    expect(nodeOf(other.getPage(), row)?.['columns']).toEqual({ wide: 2, medium: 2, narrow: 1 });
    expect(where(other.getPage(), id)?.kids.slice(0, 2)).toEqual(['f-confirm', id]);
  });
});

describe('the columns an arrangement covers in a grid', () => {
  it('lays its parts on the columns it covers there, not on its own count', () => {
    const d = employeeDesigner();
    d.setColspan('who', 3);
    expect(d.setColspan('f-mobile', 3)).toBe(true);
    const pair = employeeDesigner();
    pair.wrap(['f-city', 'f-postcode'], 'side');
    pair.setColumns(parentOf(pair, 'f-city') as string, 1);
    expect(pair.setColspan('f-city', 2)).toBe(true);
  });

  it('in a group of one column, keeps its own', () => {
    const page = employeePage();
    const emergency = spot(page, 'emergency')?.node as unknown as { children: unknown[] };
    emergency.children.splice(0, 2, { type: 'section', id: 'pair', style: 'plain', colspan: 2, columns: 2, children: [{ type: 'field', id: 'f-ec_name', field: 'ec_name' }, { type: 'field', id: 'f-ec_relation', field: 'ec_relation' }] });
    const d = watched(createDesigner({ page }));
    expect(d.setColspan('f-ec_name', 2)).toBe(true);
  });
});

describe('what is folded away', () => {
  it('a column put where there is one column joins it, and so does one an ungroup sets free', () => {
    const d = employeeDesigner();
    d.place('f-mobile', { how: 'under', target: 'f-first_name', after: true });
    d.place(parentOf(d, 'f-mobile') as string, { how: 'into', container: 'emergency' });
    expect(where(d.getPage(), 'f-mobile')?.kids).toEqual(['f-ec_name', 'f-ec_relation', 'f-ec_phone', 'f-first_name', 'f-mobile']);
    const other = employeeDesigner();
    const group = other.place({ block: 'group' }, { how: 'under', target: 'f-confirm', after: true }) as string;
    other.place('f-mobile', { how: 'into', container: group });
    other.place('f-email', { how: 'under', target: 'f-mobile', after: true });
    expect(parentOf(other, 'f-email')).not.toBe(group);
    other.ungroup(group);
    expect(where(other.getPage(), 'f-email')?.kids.slice(-4)).toEqual(['f-confirm', 'f-mobile', 'f-email', 'send']);
  });

  it('a row emptied at once goes, and nothing after it', () => {
    const d = employeeDesigner();
    d.remove(['address', 'emergency']);
    expect(where(d.getPage(), 'job-tabs')?.kids.slice(0, 2)).toEqual(['personal', 'job-tabs']);
  });

  it('a tab taken from among its tabs leaves the rest', () => {
    const d = employeeDesigner();
    d.remove(['tab-docs']);
    expect((nodeOf(d.getPage(), 'job-tabs')?.['children'] as { id: string }[]).map((t) => t.id)).toEqual(['tab-job', 'tab-pay']);
  });
});

describe('several at once, and blocks', () => {
  it('five side by side on the page make four columns; tabs made in a grid are as wide as it', () => {
    const d = employeeDesigner();
    const row = d.wrap(['div-1', 'h-send', 't-note', 'f-confirm', 'send'], 'side') as string;
    expect(nodeOf(d.getPage(), row)?.['columns']).toEqual({ wide: 4, medium: 2, narrow: 1 });
    const tabs = d.wrap(['f-first_name', 'f-last_name'], 'tabs') as string;
    expect(span(d, tabs)).toBe(2);
  });

  it('names copies by what they are', () => {
    const d = employeeDesigner();
    const copies = d.duplicate(['f-mobile', 'address', 'h-send', 'side-1', 'send']) as string[];
    expect(copies.map((id) => id.replace(/-\d+$/, ''))).toEqual(['q', 'section', 'heading', 'side', 'button']);
  });

  it('a block goes at the place given, and what was there stays', () => {
    const d = employeeDesigner();
    const divider = d.addBlock('divider', { after: 'f-mobile' }) as string;
    expect(where(d.getPage(), divider)?.kids.slice(3, 6)).toEqual(['f-mobile', divider, 'f-birthday']);
    const first = d.addBlock('heading', { parent: 'emergency', index: 0 }) as string;
    const second = d.addBlock('spacer', { parent: 'emergency', index: 2 }) as string;
    const last = d.addBlock('text', { parent: 'emergency', index: 99 }) as string;
    const before = d.addBlock('button', { parent: 'emergency', index: -3 }) as string;
    expect(where(d.getPage(), first)?.kids).toEqual([before, first, 'f-ec_name', second, 'f-ec_relation', 'f-ec_phone', last]);
    const side = d.addBlock('side', { parent: 'root' }) as string;
    expect(nodeOf(d.getPage(), side)).toMatchObject({ type: 'section', style: 'plain' });
    expect(nodeOf(d.getPage(), side)).not.toHaveProperty('colspan');
  });

  it('a survey takes every kind but those for records, and a screen takes those too', () => {
    const survey = watched(createDesigner({ page: blankPage('survey', 'S') }));
    expect(survey.place({ kind: 'short-answer' }, { how: 'into', container: 'step-1' })).toBeTruthy();
    expect(employeeDesigner().place({ kind: 'link' }, { how: 'into', container: 'emergency' })).toBeTruthy();
  });
});

describe('what a drop calls a part', () => {
  it('a column, parts side by side, a line, room, a picture', () => {
    const d = employeeDesigner();
    d.place('f-mobile', { how: 'under', target: 'f-first_name', after: true });
    expect(d.describeDrop({ how: 'into', container: parentOf(d, 'f-mobile') as string })).toBe('into “Column”');
    expect(d.describeDrop({ how: 'into', container: 'side-1' })).toBe('into “Side by side”');
    expect(d.describeDrop({ how: 'under', target: 'div-1', after: true })).toBe('under “Divider”');
    const spacer = d.addBlock('spacer', { parent: 'root' }) as string;
    const image = d.addBlock('image', { parent: 'root' }) as string;
    expect(d.describeDrop({ how: 'under', target: spacer, after: true })).toBe('under “Spacer”');
    expect(d.describeDrop({ how: 'under', target: image, after: true })).toBe('under “Image”');
    expect(nameOf(d.getPage(), { type: 'image', id: 'i', src: 'x.png', alt: 'Logo' })).toBe('Logo');
  });

  it('long words cut short at the end of a word, or mid-word when none is near', () => {
    const page = employeePage();
    const text = (words: string) => nameOf(page, { type: 'text', id: 'x', text: words });
    expect(text('x'.repeat(34))).toBe('x'.repeat(34));
    expect(text('Supercalifragilisticexpialidocious, indeed')).toBe('Supercalifragilisticexpialidocio…');
    expect(text('abcdefghijklmnop qrstuvwxyzabcdefghijklmn')).toBe('abcdefghijklmnop qrstuvwxyzabcde…');
    expect(text('abcdefghijklmnopq rstuvwxyzabcdefghijklmn')).toBe('abcdefghijklmnopq…');
  });
});
