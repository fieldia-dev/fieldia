import type { Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { employeeDesigner, expectValid, nodeOf, spot, where } from './test-layout';

/**
 * Laying a page out as the approved mockup does (c-model.html, and the browser
 * checks beside it, whose outcomes these are): a part dropped beside, under,
 * into or as a new row; grouped, put side by side, made tabs; and the words
 * the drag chip says.
 */

const picked = (d: ReturnType<typeof employeeDesigner>) => d.getState().picked;

describe('a drop beside a part', () => {
  it('beside a one-column field in a full row: the two share its cell, and nothing else moves', () => {
    const d = employeeDesigner();
    const drop = { how: 'beside', target: 'f-first_name', after: true } as const;
    expect(d.describeDrop(drop, 'f-nationality')).toBe('beside “First name”');
    expect(d.place('f-nationality', drop)).toBe('f-nationality');
    const w = where(d.getPage(), 'f-nationality');
    expect(w).toMatchObject({ style: 'plain', title: undefined, columns: { wide: 2, narrow: 1 }, colspan: undefined, kids: ['f-first_name', 'f-nationality'], grand: 'who' });
    expect(where(d.getPage(), 'f-last_name')?.parent).toBe('who');
    expect(picked(d)).toEqual(['f-nationality']);
    expect(d.getState().selected).toBe('f-nationality');
    expectValid(d.getPage());
  });

  it('before it, when dropped on its leading edge', () => {
    const d = employeeDesigner();
    d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: false });
    expect(where(d.getPage(), 'f-nationality')?.kids).toEqual(['f-nationality', 'f-first_name']);
  });

  it('moved on, the cell it shared folds away: First name is back in its grid', () => {
    const d = employeeDesigner();
    d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: true });
    d.place('f-nationality', { how: 'beside', target: 'f-birthday', after: true });
    expect(where(d.getPage(), 'f-first_name')?.kids).toEqual(['f-first_name', 'f-last_name', 'f-email', 'f-mobile', 'f-birthday', 'f-nationality']);
    expect(where(d.getPage(), 'f-first_name')?.parent).toBe('who');
    expectValid(d.getPage());
  });

  it('beside a field whose row has room: it takes the free cell, no arrangement', () => {
    const d = employeeDesigner();
    const drop = { how: 'beside', target: 'f-salary', after: true } as const;
    expect(d.describeDrop(drop)).toBe('beside “Monthly salary”');
    const id = d.place({ kind: 'number' }, drop) as string;
    const at = spot(d.getPage(), id);
    expect([at?.parent.id, (at?.parent.children as { id: string }[])[(at?.index ?? 0) - 1].id]).toEqual(['role', 'f-salary']);
    expect(nodeOf(d.getPage(), id)?.['colspan']).toBeUndefined();
    expect(picked(d)).toEqual([id]);
    expectValid(d.getPage());
  });

  it('beside a part two or more columns wide: it gives half its width, both stay on the columns', () => {
    const d = employeeDesigner();
    const id = d.place({ kind: 'short-answer' }, { how: 'beside', target: 'f-contract', after: true }) as string;
    const page = d.getPage();
    expect(where(page, id)?.parent).toBe('role');
    expect(where(page, id)?.kids.slice(4, 6)).toEqual(['f-contract', id]);
    expect([nodeOf(page, 'f-contract')?.['colspan'], nodeOf(page, id)?.['colspan']]).toEqual([undefined, undefined]);
    expectValid(page);
  });

  it('beside a part four columns wide: two each', () => {
    const d = employeeDesigner();
    d.setColumns('role', 4);
    d.setColspan('f-contract', 4);
    const id = d.place({ kind: 'short-answer' }, { how: 'beside', target: 'f-contract', after: false }) as string;
    expect([nodeOf(d.getPage(), id)?.['colspan'], nodeOf(d.getPage(), 'f-contract')?.['colspan']]).toEqual([2, 2]);
    expect(where(d.getPage(), id)?.kids.indexOf(id)).toBe((where(d.getPage(), id)?.kids.indexOf('f-contract') ?? 0) - 1);
  });

  it('on the outer edge of a group in a row of groups: a new column of that row', () => {
    const d = employeeDesigner();
    const drop = { how: 'beside', target: 'emergency', after: true, whole: true } as const;
    expect(d.describeDrop(drop)).toBe('new column beside “Emergency contact”');
    const id = d.place({ kind: 'email' }, drop) as string;
    expect(nodeOf(d.getPage(), 'side-1')).toMatchObject({ columns: { wide: 3, medium: 1 } });
    expect(where(d.getPage(), id)?.kids).toEqual(['address', 'emergency', id]);
    expectValid(d.getPage());
  });

  it('beside the row itself: one more column at its end, named by the part it goes next to', () => {
    const d = employeeDesigner();
    const drop = { how: 'beside', target: 'side-1', after: true, whole: true } as const;
    expect(d.describeDrop(drop)).toBe('new column beside “Emergency contact”');
    expect(d.describeDrop({ ...drop, after: false })).toBe('new column beside “Home address”');
    const id = d.place({ kind: 'email' }, { ...drop, after: false }) as string;
    expect(where(d.getPage(), id)?.kids).toEqual([id, 'address', 'emergency']);
    expect(nodeOf(d.getPage(), 'side-1')?.['columns']).toEqual({ wide: 3, medium: 1 });
  });

  it('a row holds four: a fifth column is refused, saying so', () => {
    const d = employeeDesigner();
    d.place({ kind: 'email' }, { how: 'beside', target: 'emergency', after: true });
    d.place({ kind: 'phone' }, { how: 'beside', target: 'emergency', after: true });
    const before = d.getPage();
    expect(d.dropRefusal({ how: 'beside', target: 'emergency', after: true })).toBe('A row holds four');
    expect(d.place({ kind: 'date' }, { how: 'beside', target: 'emergency', after: true })).toBe(false);
    expect(d.getState().issues).toEqual(['A row holds four']);
    expect(d.getPage()).toBe(before);
    expect(d.place({ kind: 'date' }, { how: 'beside', target: 'side-1', after: true })).toBe(false);
    // Moving a part along its own row is no fifth column.
    expect(d.place('address', { how: 'beside', target: 'emergency', after: true })).toBe('address');
  });

  it('beside a part on the page, where there is one column: a row of two', () => {
    const d = employeeDesigner();
    d.place('send', { how: 'beside', target: 'f-confirm', after: true });
    expect(where(d.getPage(), 'send')).toMatchObject({ style: 'plain', columns: { wide: 2, narrow: 1 }, kids: ['f-confirm', 'send'], grand: 'root' });
    expectValid(d.getPage());
  });

  it('beside a part in a row of parts on the page: one more column of the row', () => {
    const d = employeeDesigner();
    d.place('send', { how: 'beside', target: 'f-confirm', after: true });
    const row = where(d.getPage(), 'send')?.parent as string;
    d.place('h-send', { how: 'beside', target: 'f-confirm', after: true });
    expect(where(d.getPage(), 'h-send')).toMatchObject({ parent: row, kids: ['f-confirm', 'h-send', 'send'] });
    expect(nodeOf(d.getPage(), row)?.['columns']).toEqual({ wide: 3, narrow: 1 });
    expectValid(d.getPage());
  });
});

describe('a drop under a part', () => {
  it('under a field in a grid: its cell becomes a column of two, its row neighbour stays beside it', () => {
    const d = employeeDesigner();
    const drop = { how: 'under', target: 'f-first_name', after: true } as const;
    expect(d.describeDrop(drop, 'f-mobile')).toBe('under “First name”');
    d.place('f-mobile', drop);
    const w = where(d.getPage(), 'f-mobile');
    expect(w).toMatchObject({ style: 'plain', columns: 1, kids: ['f-first_name', 'f-mobile'], grand: 'who' });
    expect(where(d.getPage(), w?.parent as string)?.kids.slice(0, 2)).toEqual([w?.parent, 'f-last_name']);
    expectValid(d.getPage());
  });

  it('above a field in a grid: the same column, the new part first', () => {
    const d = employeeDesigner();
    const drop = { how: 'under', target: 'f-first_name', after: false } as const;
    expect(d.describeDrop(drop)).toBe('above “First name”');
    d.place('f-mobile', drop);
    expect(where(d.getPage(), 'f-mobile')?.kids).toEqual(['f-mobile', 'f-first_name']);
  });

  it('under a part two columns wide: a column on the same two columns', () => {
    const d = employeeDesigner();
    d.place('f-city', { how: 'under', target: 'f-street', after: true });
    const w = where(d.getPage(), 'f-city');
    expect(w).toMatchObject({ colspan: 2, columns: 2, kids: ['f-street', 'f-city'], grand: 'address' });
    expect([nodeOf(d.getPage(), 'f-street')?.['colspan'], nodeOf(d.getPage(), 'f-city')?.['colspan']]).toEqual([2, 2]);
    expectValid(d.getPage());
  });

  it('under a column of two: it joins the column, never a column in a column', () => {
    const d = employeeDesigner();
    d.place('f-mobile', { how: 'under', target: 'f-first_name', after: true });
    d.place('f-birthday', { how: 'under', target: 'f-mobile', after: true });
    const w = where(d.getPage(), 'f-birthday');
    expect(w).toMatchObject({ kids: ['f-first_name', 'f-mobile', 'f-birthday'], grand: 'who' });
    expectValid(d.getPage());
  });

  it('under the last field of a one-column group: it goes in the group, after it, and is picked', () => {
    const d = employeeDesigner();
    const id = d.place({ kind: 'email' }, { how: 'under', target: 'f-ec_phone', after: true }) as string;
    expect(where(d.getPage(), id)?.kids).toEqual(['f-ec_name', 'f-ec_relation', 'f-ec_phone', id]);
    expect(d.getState().selected).toBe(id);
  });

  it('on the bottom edge of a group on the page: a new row under the whole group', () => {
    const d = employeeDesigner();
    const drop = { how: 'under', target: 'personal', after: true, whole: true } as const;
    expect(d.describeDrop(drop)).toBe('new row under “Personal details”');
    const id = d.place({ block: 'heading' }, drop) as string;
    expect(where(d.getPage(), id)?.kids.slice(0, 2)).toEqual(['personal', id]);
  });
});

describe('a drop between rows, and into a group', () => {
  it('between two rows of a grid: a new full-width row there', () => {
    const d = employeeDesigner();
    const drop = { how: 'row', container: 'who', index: 2 } as const;
    expect(d.describeDrop(drop)).toBe('new full-width row above “Work email”');
    const id = d.place({ kind: 'paragraph' }, drop) as string;
    const at = spot(d.getPage(), id);
    expect([at?.parent.id, at?.index, at?.node['colspan']]).toEqual(['who', 2, 2]);
    expectValid(d.getPage());
  });

  it('counts the rows without the part that is moving', () => {
    const d = employeeDesigner();
    const drop = { how: 'row', container: 'who', index: 1 } as const;
    expect(d.describeDrop(drop, 'f-first_name')).toBe('new full-width row above “Work email”');
    d.place('f-first_name', drop);
    expect(where(d.getPage(), 'f-first_name')?.kids.slice(0, 3)).toEqual(['f-last_name', 'f-first_name', 'f-email']);
  });

  it('at the end of a grid', () => {
    const d = employeeDesigner();
    expect(d.describeDrop({ how: 'row', container: 'who', index: 6 })).toBe('new full-width row at the end of “2 columns”');
    expect(d.describeDrop({ how: 'row', container: 'role', index: 7 })).toBe('new full-width row at the end of “Role”');
  });

  it('into a group: at its end, no wider than it', () => {
    const d = employeeDesigner();
    const drop = { how: 'into', container: 'bank' } as const;
    expect(d.describeDrop(drop)).toBe('into “Bank account”');
    d.place('f-street', drop);
    expect(where(d.getPage(), 'f-street')?.kids).toEqual(['f-bank_name', 'f-pay_currency', 'f-iban', 'f-street']);
    d.place('f-street', { how: 'into', container: 'emergency' });
    expect(nodeOf(d.getPage(), 'f-street')?.['colspan']).toBeUndefined();
    expectValid(d.getPage());
  });

  it('into an empty tab, and into the page', () => {
    const d = createDesigner({ page: blankPage('screen', 'Visit') });
    const tabs = d.place({ block: 'tabs' }, { how: 'into', container: 'section-1' }) as string;
    const first = (nodeOf(d.getPage(), tabs)?.['children'] as { id: string }[])[0].id;
    expect(d.describeDrop({ how: 'into', container: first })).toBe('into “First”');
    const id = d.place({ kind: 'short-answer' }, { how: 'into', container: first }) as string;
    expect(where(d.getPage(), id)?.parent).toBe(first);
    expect(d.describeDrop({ how: 'into', container: 'sections' })).toBe('into the page');
    expectValid(d.getPage());
  });
});

describe('what a drop may not do', () => {
  it('a part cannot go inside itself, nor beside itself', () => {
    const d = employeeDesigner();
    expect(d.dropRefusal({ how: 'into', container: 'who' }, 'personal')).toBe('A part cannot go inside itself');
    expect(d.place('personal', { how: 'beside', target: 'f-email', after: true })).toBe(false);
    expect(d.getState().issues).toEqual(['A part cannot go inside itself']);
    expect(d.place('personal', { how: 'row', container: 'who', index: 0 })).toBe(false);
    expect(d.place('f-email', { how: 'beside', target: 'f-email', after: true })).toBe(false);
    expect(d.getState().issues).toEqual(['A part cannot go beside or under itself']);
    expect(d.dropRefusal({ how: 'under', target: 'f-email', after: true })).toBeNull();
  });

  it('a tab moves only among its tabs, and nothing goes on the tabs themselves', () => {
    const d = employeeDesigner();
    expect(d.place('tab-pay', { how: 'into', container: 'emergency' })).toBe(false);
    expect(d.getState().issues).toEqual(['A tab moves only among its tabs']);
    expect(d.place('f-mobile', { how: 'into', container: 'job-tabs' })).toBe(false);
    expect(d.getState().issues).toEqual(['Put it in one of the tabs']);
    expect(d.place('f-mobile', { how: 'beside', target: 'tab-pay', after: true })).toBe(false);
    expect(d.getState().issues).toEqual(['Put it in one of the tabs']);
  });

  it('only a group, a tab or the page takes parts into it', () => {
    const d = employeeDesigner();
    expect(d.place('f-mobile', { how: 'into', container: 'f-email' })).toBe(false);
    expect(d.getState().issues).toEqual(['“Work email” holds no parts']);
    expect(d.place('f-ghost', { how: 'into', container: 'who' })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no part “f-ghost”']);
    expect(d.place('f-mobile', { how: 'beside', target: 'nowhere', after: true })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no part “nowhere”']);
    expect(d.place({ kind: 'teleporter' }, { how: 'into', container: 'who' })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no kind of part “teleporter”']);
  });

  it('keeps the model’s rules: a field of the model goes on once, and a survey has no records to link', () => {
    const d = employeeDesigner({ model: true });
    expect(d.place({ field: 'email' }, { how: 'into', container: 'emergency' })).toBe(false);
    expect(d.getState().issues).toEqual(['Work email is on the page already']);
    expect(d.place({ field: 'nope' }, { how: 'into', container: 'emergency' })).toBe(false);
    expect(d.getState().issues).toEqual(['The model has no field "nope"']);
    const id = d.place({ field: 'employee_no' }, { how: 'beside', target: 'f-ec_phone', after: true }) as string;
    expect(d.getPage().fields['employee_no']).toEqual({ type: 'char', label: 'Employee number' });
    expect(d.isFromModel(id)).toBe(true);
    const survey = createDesigner({ page: blankPage('survey', 'S') });
    expect(survey.place({ kind: 'link' }, { how: 'into', container: 'step-1' })).toBe(false);
    expect(survey.getState().issues[0]).toMatch(/A survey has no records/);
  });

  it('is one undo step, the page as it was', () => {
    const d = employeeDesigner();
    const before = d.getPage();
    d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: true });
    d.undo();
    expect(d.getPage()).toEqual(before);
  });
});

describe('new parts from the toolbox', () => {
  it('a group, two groups side by side, tabs, and the blocks between fields', () => {
    const d = employeeDesigner();
    const made: Record<string, string> = {};
    for (const block of ['group', 'side', 'tabs', 'heading', 'text', 'divider', 'spacer', 'image', 'button'] as const) {
      made[block] = d.place({ block }, { how: 'under', target: 'f-confirm', after: true }) as string;
      expect(made[block]).toBeTruthy();
    }
    const page: Page = d.getPage();
    expect(nodeOf(page, made['group'])).toMatchObject({ type: 'section', title: 'New group', columns: { wide: 2, narrow: 1 }, children: [] });
    expect(nodeOf(page, made['side'])).toMatchObject({ type: 'section', style: 'plain', columns: { wide: 2, narrow: 1 }, children: [{ title: 'Left' }, { title: 'Right' }] });
    expect(nodeOf(page, made['tabs'])).toMatchObject({ type: 'tabs', children: [{ type: 'tab', label: 'First' }, { type: 'tab', label: 'Second' }] });
    expect(nodeOf(page, made['heading'])).toMatchObject({ type: 'text', style: 'heading', text: 'New heading' });
    expect(nodeOf(page, made['text'])).toMatchObject({ type: 'text', style: 'paragraph' });
    expect(nodeOf(page, made['divider'])).toEqual({ type: 'divider', id: made['divider'] });
    expect(nodeOf(page, made['spacer'])).toEqual({ type: 'spacer', id: made['spacer'] });
    expect(nodeOf(page, made['image'])).toMatchObject({ type: 'image', alt: '' });
    expect(nodeOf(page, made['button'])).toMatchObject({ type: 'button', label: 'Button', action: 'button', style: 'secondary' });
    expect(new Set(Object.values(made)).size).toBe(9);
    expectValid(page);
  });

  it('a field of a kind, its own field named like the store names them', () => {
    const d = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = d.place({ kind: 'dropdown' }, { how: 'into', container: 'section-1' }) as string;
    expect(id).toBe('q-1');
    expect(d.getPage().fields['q_1']).toMatchObject({ type: 'selection', label: 'Untitled question' });
  });
});
