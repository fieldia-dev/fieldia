import { employeeDesigner, expectValid, nodeOf, where } from './test-layout';

/** A layout's settings: columns on each size of screen, widths, a group's look, where labels sit, the page's look. */

describe('columns per screen size, and widths', () => {
  it('sets a group’s columns on a desktop, a tablet and a phone', () => {
    const d = employeeDesigner();
    expect(d.setColumns('personal', { wide: 3, medium: 2, narrow: 1 })).toBe(true);
    expect(nodeOf(d.getPage(), 'personal')?.['columns']).toEqual({ wide: 3, medium: 2, narrow: 1 });
    d.setColumns('personal', { wide: 3, narrow: 1 });
    expect(nodeOf(d.getPage(), 'personal')?.['columns']).toEqual({ wide: 3, narrow: 1 });
    expectValid(d.getPage());
  });

  it('keeps a plain number when only a desktop’s is set', () => {
    const d = employeeDesigner();
    d.setColumns('address', { wide: 3 });
    expect(nodeOf(d.getPage(), 'address')?.['columns']).toBe(3);
  });

  it('narrows what is wider than the desktop’s columns: fields, groups and blocks alike', () => {
    const d = employeeDesigner();
    d.setColumns('personal', { wide: 1, narrow: 1 });
    expect(nodeOf(d.getPage(), 'who')?.['colspan']).toBe(1);
    d.setColumns('role', 1);
    expect(nodeOf(d.getPage(), 'f-contract')?.['colspan']).toBe(1);
    expectValid(d.getPage());
  });

  it('refuses more columns on a smaller screen, and counts beyond one to four', () => {
    const d = employeeDesigner();
    expect(d.setColumns('personal', { wide: 2, medium: 3 })).toBe(false);
    expect(d.getState().issues).toEqual(['A tablet or a phone shows no more columns than a desktop']);
    expect(d.setColumns('personal', { wide: 3, medium: 1, narrow: 2 })).toBe(false);
    expect(d.getState().issues).toEqual(['A phone shows no more columns than a tablet']);
    expect(d.setColumns('personal', { wide: 5 as never })).toBe(false);
    expect(d.getState().issues).toEqual(['A group has one to four columns']);
    expect(d.setColumns('personal', { wide: 2, narrow: 0 as never })).toBe(false);
    expect(d.getState().issues).toEqual(['A group has one to four columns']);
    expect(d.setColumns('f-email', { wide: 2 })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no section "f-email"']);
  });

  it('gives a group, tabs, words, a button, a spacer and an image a width, as a field has', () => {
    const d = employeeDesigner();
    const spacer = d.place({ block: 'spacer' }, { how: 'into', container: 'role' }) as string;
    const image = d.place({ block: 'image' }, { how: 'into', container: 'role' }) as string;
    d.wrap(['h-send', 't-note', 'send'], 'group');
    const group = where(d.getPage(), 'h-send')?.parent as string;
    for (const [id, span] of [['who', 1], [spacer, 2], [image, 3], ['h-send', 2], ['send', 2], ['f-mobile', 2]] as const) {
      expect(d.setColspan(id, span)).toBe(true);
      expect(nodeOf(d.getPage(), id)?.['colspan']).toBe(span === 1 ? undefined : span);
    }
    const tabs = d.place({ block: 'tabs' }, { how: 'into', container: 'personal' }) as string;
    expect(d.setColspan(tabs, 3)).toBe(true);
    expect(nodeOf(d.getPage(), tabs)?.['colspan']).toBe(3);
    expect(nodeOf(d.getPage(), group)?.['columns']).toEqual({ wide: 2, narrow: 1 });
    expectValid(d.getPage());
  });

  it('no wider than where it sits, and not a divider or a tab', () => {
    const d = employeeDesigner();
    expect(d.setColspan('who', 4)).toBe(false);
    expect(d.getState().issues).toEqual(["A group cannot be wider than its section's 3 columns"]);
    expect(d.setColspan('f-mobile', 3)).toBe(false);
    expect(d.getState().issues).toEqual(["A field cannot be wider than its section's 2 columns"]);
    expect(d.setColspan('div-1', 2)).toBe(false);
    expect(d.getState().issues).toEqual(['A divider runs across the whole row']);
    expect(d.setColspan('tab-pay', 2)).toBe(false);
    expect(d.getState().issues).toEqual(['A tab is as wide as its tabs']);
    expect(d.setColspan('nothing', 2)).toBe(false);
    expect(d.getState().issues).toEqual(['There is no part “nothing”']);
  });
});

describe('how a group looks, where labels sit, and the page’s look', () => {
  it('sets a group’s style, where its labels sit and how wide, and takes each back', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('personal', { style: 'plain', labels: 'beside', labelWidth: 160 })).toBe(true);
    expect(nodeOf(d.getPage(), 'personal')).toMatchObject({ style: 'plain', labels: 'beside', labelWidth: 160 });
    expectValid(d.getPage());
    d.setSectionLook('personal', { style: 'card', labels: null, labelWidth: null });
    const back = nodeOf(d.getPage(), 'personal') ?? {};
    expect(['style', 'labels', 'labelWidth'].filter((k) => k in back)).toEqual([]);
    d.setSectionLook('bank', { style: 'line' });
    expect(nodeOf(d.getPage(), 'bank')).toMatchObject({ style: 'line', labels: 'beside', labelWidth: 120 });
  });

  it('a run of label widths is one undo step', () => {
    const d = employeeDesigner();
    for (const labelWidth of [130, 140, 150]) d.setSectionLook('bank', { labelWidth });
    d.undo();
    expect(nodeOf(d.getPage(), 'bank')?.['labelWidth']).toBe(120);
  });

  it('refuses a label width out of reach, and a part that is not a group', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('bank', { labelWidth: 20 })).toBe(false);
    expect(d.getState().issues).toEqual(['Labels set beside are 60 to 320 px wide']);
    expect(d.setSectionLook('f-email', { style: 'plain' })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no group “f-email”']);
  });

  it('puts one field’s label above, beside or inside its box, or where its group puts it', () => {
    const d = employeeDesigner();
    expect(d.setFieldLabels('f-email', 'beside')).toBe(true);
    expect(nodeOf(d.getPage(), 'f-email')?.['labels']).toBe('beside');
    d.setFieldLabels('f-email', null);
    expect(nodeOf(d.getPage(), 'f-email')).not.toHaveProperty('labels');
    expect(d.setFieldLabels('personal', 'hidden')).toBe(false);
    expect(d.getState().issues).toEqual(['There is no field “personal”']);
  });

  it('sets the page’s look: colour, font, spacing, corners, labels and scheme, and takes a setting back', () => {
    const d = employeeDesigner();
    expect(d.setLook({ accent: '#1f7a4d', density: 'compact', corners: 'round', font: 'serif', scheme: 'dark' })).toBe(true);
    expect(d.getPage().look).toEqual({ accent: '#1f7a4d', font: 'serif', density: 'compact', corners: 'round', labels: 'above', labelWidth: 140, scheme: 'dark' });
    d.setLook({ accent: null, font: null, density: null, corners: null, labels: null, labelWidth: null, scheme: null });
    expect(d.getPage()).not.toHaveProperty('look');
    expect(d.setLook({ accent: 'green' })).toBe(false);
    expect(d.getState().issues).toEqual(['A colour is written #rrggbb, such as #1f7a4d']);
    expect(d.setLook({ labelWidth: 400 })).toBe(false);
    expect(d.getState().issues).toEqual(['Labels set beside are 60 to 320 px wide']);
  });

  it('a run of colours is one undo step', () => {
    const d = employeeDesigner();
    for (const accent of ['#111111', '#222222', '#333333']) d.setLook({ accent });
    d.undo();
    expect(d.getPage().look?.accent).toBe('#1677ff');
  });
});
