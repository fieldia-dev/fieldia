import type { Page } from '@fieldia/core';
import { pageChanges } from './page-checks';
import { employeeDesigner, employeePage, expectValid, spot } from './test-layout';

/** What the Publish dialog says for each layout edit: the words a person would use for what they did. */

/** The words for one edit made on the employee page. */
function words(edit: (d: ReturnType<typeof employeeDesigner>) => unknown): string[] {
  const d = employeeDesigner();
  const before = d.getPage();
  edit(d);
  expectValid(d.getPage());
  return pageChanges(before, d.getPage());
}

describe('words for a drop', () => {
  it('a part put beside another, sharing its cell', () => {
    expect(words((d) => d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: true }))).toEqual(['Put “Nationality” beside “First name”']);
  });

  it('a part put under another in a grid', () => {
    expect(words((d) => d.place('f-mobile', { how: 'under', target: 'f-first_name', after: true }))).toEqual(['Put “Mobile” under “First name”']);
    expect(words((d) => d.place('f-mobile', { how: 'under', target: 'f-first_name', after: false }))).toEqual(['Put “Mobile” above “First name”']);
  });

  it('a part put beside its neighbour: the two side by side', () => {
    expect(words((d) => d.place('f-last_name', { how: 'beside', target: 'f-first_name', after: true }))).toEqual(['Put “First name” and “Last name” side by side']);
  });

  it('a part put beside a part in another group: put there, not just moved — the group in twelfths once, not the widths that only kept up', () => {
    expect(words((d) => d.place('f-mobile', { how: 'beside', target: 'f-ec_phone', after: true }))).toEqual(['Put “Mobile” beside “Phone”', '“Emergency contact”: rows divided in twelfths', '“Phone”: half the row']);
  });

  it('a part put in another row of its group: that row in thirds, and the row it left closed up', () => {
    expect(words((d) => d.place('f-job_title', { how: 'beside', target: 'f-salary', after: true }))).toEqual([
      'Put “Job title” beside “Monthly salary”',
      '“Role”: rows divided in twelfths',
      '“Department”: half the row',
      '“Manager”: half the row',
    ]);
  });

  it('a new part put beside another, or as a new column of a row', () => {
    expect(words((d) => d.place({ kind: 'number' }, { how: 'beside', target: 'f-confirm', after: true }))).toEqual(['Added “Untitled question” beside “I confirm these details are correct”']);
    expect(words((d) => d.place({ kind: 'email' }, { how: 'beside', target: 'emergency', after: true, whole: true }))).toEqual(['Added “Untitled question” beside “Emergency contact”']);
  });

  it('a new part in a row of a group, or on a row of its own, is simply added', () => {
    expect(words((d) => d.place({ kind: 'number' }, { how: 'beside', target: 'f-salary', after: true }))).toEqual(['Added “Untitled question”', '“Role”: rows divided in twelfths']);
    expect(words((d) => d.place({ kind: 'paragraph' }, { how: 'row', container: 'who', index: 2 }))).toEqual(['Added “Untitled question”']);
  });

  it('a part moved to a row of its own: its width, and the new order', () => {
    expect(words((d) => d.place('f-first_name', { how: 'row', container: 'who', index: 1 }))).toEqual(['“First name”: 2 columns wide', 'Reordered the fields in “Personal details”']);
  });

  it('a part moved into another group, and a group moved into a tab', () => {
    expect(words((d) => d.place('f-city', { how: 'into', container: 'bank' }))).toEqual(['Moved “City” to “Bank account”']);
    expect(words((d) => d.place('address', { how: 'into', container: 'tab-pay' }))).toEqual(['Moved “Home address” to “Pay”']);
  });

  it('a part put before another says beside it too', () => {
    expect(words((d) => d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: false }))).toEqual(['Put “Nationality” beside “First name”']);
  });

  it('a part moved from the end of its group to the start: only it moved', () => {
    expect(words((d) => d.place('f-salary', { how: 'row', container: 'role', index: 0 }))).toEqual(['“Monthly salary”: 3 columns wide', 'Reordered the fields in “Role”']);
    expect(words((d) => d.place('f-job_title', { how: 'row', container: 'role', index: 6 }))).toEqual(['“Job title”: 3 columns wide', 'Reordered the fields in “Role”']);
  });

  it('two parts moved in one version: the rest kept their order, so only they moved', () => {
    const moves = (d: ReturnType<typeof employeeDesigner>) => {
      d.place('f-salary', { how: 'row', container: 'role', index: 0 });
      d.place('f-job_title', { how: 'row', container: 'role', index: 7 });
    };
    expect(words(moves)).toEqual(['“Monthly salary”: 3 columns wide', '“Job title”: 3 columns wide', 'Reordered the fields in “Role”']);
  });

  it('a part moved away from the one whose cell it shared: only its own move', () => {
    const d = employeeDesigner();
    d.place('f-nationality', { how: 'beside', target: 'f-first_name', after: true });
    const before = d.getPage();
    d.place('f-nationality', { how: 'beside', target: 'f-birthday', after: true });
    expect(pageChanges(before, d.getPage())).toEqual(['Put “Nationality” beside “Date of birth”']);
  });
});

describe('words for several parts at once', () => {
  it('grouped, put side by side, made tabs', () => {
    expect(words((d) => d.wrap(['f-first_name', 'f-last_name'], 'group'))).toEqual(['Grouped 2 into “New group”']);
    expect(words((d) => d.wrap(['h-send', 't-note'], 'side'))).toEqual(['Put “Before you send” and “HR goes through every detail…” side by side']);
    expect(words((d) => d.wrap(['address', 'emergency'], 'tabs'))).toEqual(['Made 2 tabs: “Home address” and “Emergency contact”']);
  });

  it('ungrouped: a group, parts side by side, and tabs', () => {
    expect(words((d) => d.ungroup('address'))).toEqual(['Ungrouped “Home address”']);
    expect(words((d) => d.ungroup('side-1'))).toEqual(['Ungrouped “Home address” and “Emergency contact”']);
    expect(words((d) => d.ungroup('job-tabs'))).toEqual(['Ungrouped the tabs “Job”, “Documents” and “Pay”']);
  });

  it('removed and duplicated: what went and what came, blocks too', () => {
    expect(words((d) => d.remove(['f-mobile', 'h-send', 'div-1']))).toEqual(['Removed “Mobile”', 'Removed a divider', 'Removed the heading “Before you send”']);
    expect(words((d) => d.duplicate(['send']))).toEqual(['Added the button “Send to HR”']);
  });
});

describe('words for a layout’s settings', () => {
  it('columns on each size of screen', () => {
    expect(words((d) => d.setColumns('personal', { wide: 3, narrow: 1 }))).toEqual(['“Personal details”: 3 columns on a desktop, 1 on a phone']);
    expect(words((d) => d.setColumns('role', { wide: 4, medium: 2, narrow: 1 }))).toEqual(['“Role”: 4 columns on a desktop, 2 on a tablet, 1 on a phone']);
    expect(words((d) => d.setColumns('emergency', { wide: 2 }))).toEqual(['“Emergency contact”: 2 columns']);
    expect(words((d) => d.setColumns('docs', { wide: 1 }))).toEqual(['“ID or passport”, “Signed contract” and “Certificates”: 1 column']);
  });

  it('a width', () => {
    expect(words((d) => d.setColspan('f-mobile', 2))).toEqual(['“Mobile”: 2 columns wide']);
    expect(words((d) => d.setColspan('f-street', 1))).toEqual(['“Street and number”: 1 column wide']);
    expect(words((d) => d.setColspan('address', 2))).toEqual(['“Home address”: 2 columns wide']);
  });

  it('in twelfths: widths as fractions of the row, the group divided once, and how it keeps its rows', () => {
    expect(words((d) => d.setColumns('address', 12))).toEqual(['“Home address”: rows divided in twelfths']);
    expect(words((d) => d.setWidths([{ id: 'f-city', span: 7 }, { id: 'f-postcode', span: 5 }], { twelfths: true }))).toEqual([
      '“Home address”: rows divided in twelfths',
      '“City”: 58% of the row',
      '“Postcode”: 42% of the row',
    ]);
    expect(words((d) => (d.setColumns('address', 12), d.setColspan('f-city', 4)))).toEqual(['“Home address”: rows divided in twelfths', '“City”: a third of the row', '“Postcode”: two thirds of the row']);
    expect(words((d) => (d.setColumns('address', 12), d.setColspan('f-street', 12)))).toEqual(['“Home address”: rows divided in twelfths']);
    expect(words((d) => d.setSectionLook('address', { rows: 'gaps' }))).toEqual(['“Home address”: rows may leave gaps']);
    // Back on three columns, a row of halves cannot stay halves: as near as the columns go.
    expect(words((d) => (d.setColumns('address', 12), d.setColumns('address', 3)))).toEqual(['“Home address”: 3 columns on a desktop, 1 on a phone', '“City”: 2 columns wide']);
  });

  it('a group’s look, and where its labels sit', () => {
    expect(words((d) => d.setSectionLook('bank', { style: 'line', labels: 'above', labelWidth: 160 }))).toEqual([
      '“Bank account”: drawn with a line under its title',
      '“Bank account”: labels above their boxes',
      '“Bank account”: labels 160 px wide',
    ]);
    expect(words((d) => d.setSectionLook('bank', { style: 'card', labels: null, labelWidth: null }))).toEqual([
      '“Bank account”: drawn as a card',
      '“Bank account”: labels where the page puts them',
      '“Bank account”: labels as wide as the page has them',
    ]);
    expect(words((d) => d.setSectionLook('personal', { style: 'framed' }))).toEqual(['“Personal details”: drawn in a frame, its title on it']);
    expect(words((d) => d.setSectionLook('personal', { style: 'plain', labels: 'hidden' }))).toEqual(['“Personal details”: drawn plain, with no box', '“Personal details”: labels inside their boxes']);
  });

  it('one field’s label', () => {
    expect(words((d) => d.setFieldLabels('f-email', 'beside'))).toEqual(['“Work email”: its label beside its box']);
    const d = employeeDesigner();
    d.setFieldLabels('f-email', 'hidden');
    const before = d.getPage();
    d.setFieldLabels('f-email', null);
    expect(pageChanges(before, d.getPage())).toEqual(['“Work email”: its label where its group puts it']);
  });

  it('the page’s look', () => {
    expect(words((d) => d.setLook({ accent: '#1f7a4d', density: 'compact' }))).toEqual(['The accent colour: #1677ff → #1f7a4d', 'The spacing: comfortable → compact']);
    expect(words((d) => d.setLook({ font: 'serif', corners: null, scheme: 'auto', labels: 'beside', labelWidth: 120 }))).toEqual([
      'The font: the system’s → serif',
      'The corners: soft → as the skin has them',
      'Where labels sit: above their boxes → beside their boxes',
      'Labels set beside: 140 px wide → 120 px wide',
      'The colours: as the skin has them → as the reader’s system has them',
    ]);
  });
});

describe('words for a page written by hand', () => {
  it('a group whose columns are taken back has one', () => {
    const before = employeePage();
    const after: Page = JSON.parse(JSON.stringify(before));
    delete (spot(after, 'emergency')?.node as { columns?: number }).columns;
    Object.assign(spot(after, 'address')?.node ?? {}, { columns: 3 });
    expect(pageChanges(before, after)).toEqual(['“Home address”: 3 columns', '“Emergency contact”: 1 column']);
  });
});

describe('words for what has no name yet', () => {
  it('a group with an empty title is an untitled section, and a page with one is the page', () => {
    const before = employeePage();
    before.title = '';
    (before.layout as { children: unknown[] }).children.push({ type: 'section', id: 'blank', title: '', children: [] });
    const after: Page = JSON.parse(JSON.stringify(before));
    const blank = spot(after, 'blank')?.node as unknown as { children: unknown[] };
    const city = spot(after, 'f-city');
    blank.children.push(...(city?.parent.children as unknown[]).splice(city?.index ?? 0, 1));
    const mobile = spot(after, 'f-mobile');
    (after.layout as { children: unknown[] }).children.push(...(mobile?.parent.children as unknown[]).splice(mobile?.index ?? 0, 1));
    expect(pageChanges(before, after)).toEqual(['Moved “Mobile” to “the page”', 'Moved “City” to “Untitled section”']);
    const added: Page = JSON.parse(JSON.stringify(after));
    (added.layout as { children: unknown[] }).children.push({ type: 'section', id: 'blank-2', title: '', children: [] });
    expect(pageChanges(after, added)).toEqual(['Added the section “Untitled section”']);
  });
});

describe('words for blocks', () => {
  it('each block added, by what it is', () => {
    expect(
      words((d) => {
        for (const kind of ['divider', 'spacer', 'image', 'heading', 'text', 'button'] as const) d.addBlock(kind, { parent: 'root' });
      })
    ).toEqual(['Added a divider', 'Added a spacer', 'Added an image', 'Added the heading “New heading”', 'Added the words “Words that help people fill this…”', 'Added the button “Button”']);
  });

  it('words changed, and a button renamed', () => {
    const before = employeePage();
    const after: Page = JSON.parse(JSON.stringify(before));
    Object.assign(spot(after, 'h-send')?.node ?? {}, { text: 'Last of all' });
    Object.assign(spot(after, 'send')?.node ?? {}, { label: 'Send' });
    expect(pageChanges(before, after)).toEqual(['Changed the heading “Before you send” to “Last of all”', 'Renamed the button “Send to HR” to “Send”']);
  });
});

describe('the first version', () => {
  it('counts groups, not the arrangements that only lay parts side by side', () => {
    expect(pageChanges(null, employeePage())).toEqual(['The first version: 28 fields in 5 sections']);
  });
});
