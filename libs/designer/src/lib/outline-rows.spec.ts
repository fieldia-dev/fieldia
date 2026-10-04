import { blankPage, createDesigner } from './designer';
import { outlineRows, shownRows } from './outline-rows';
import { employeePage } from './test-layout';

/** The page as the outline's rows: every part in reading order, named as a person reads it, and what each holds. */

const drawn = (rows: { label: string; level: number }[]) => rows.map((r) => `${'  '.repeat(r.level)}${r.label}`);

describe('outlineRows', () => {
  it('lists every part in reading order: groups, arrangements, tabs, fields and the blocks between them', () => {
    expect(drawn(outlineRows(employeePage()))).toEqual([
      'Personal details',
      '  Photo',
      '  2 columns',
      '    First name',
      '    Last name',
      '    Work email',
      '    Mobile',
      '    Date of birth',
      '    Nationality',
      'Side by side',
      '  Home address',
      '    Street and number',
      '    City',
      '    Postcode',
      '    Country',
      '  Emergency contact',
      '    Name',
      '    Relation',
      '    Phone',
      'Tabs',
      '  Job',
      '    Role',
      '      Job title',
      '      Department',
      '      Manager',
      '      Start date',
      '      Contract',
      '      Contract ends',
      '      Monthly salary',
      '  Documents',
      '    Side by side',
      '      ID or passport',
      '      Signed contract',
      '      Certificates',
      '  Pay',
      '    Bank account',
      '      Bank',
      '      Paid in',
      '      IBAN',
      'Divider',
      'Before you send',
      'HR goes through every detail…',
      'I confirm these details are correct',
      'Send to HR',
    ]);
  });

  it('says what each row is, what holds it, and whether it holds parts', () => {
    const rows = outlineRows(employeePage());
    const row = (id: string) => rows.find((r) => r.id === id);
    expect(row('f-first_name')).toMatchObject({ kind: 'Short answer', parent: 'who', holds: false, required: true, movable: true });
    expect(row('who')).toMatchObject({ kind: 'Side by side', parent: 'personal', holds: true, children: 6 });
    expect(row('personal')).toMatchObject({ kind: 'Group', parent: null, holds: true, badge: '3·3·1', badgeWords: 'Columns: desktop 3, tablet 3, phone 1' });
    expect(row('side-1')).toMatchObject({ badge: '2·1·–', badgeWords: 'Columns: desktop 2, tablet 1, phone as the skin stacks them' });
    expect(row('job-tabs')).toMatchObject({ kind: '3 tabs', holds: true, children: 3 });
    expect(row('tab-job')).toMatchObject({ kind: 'Tab', parent: 'job-tabs', holds: true });
    expect(row('h-send')).toMatchObject({ kind: 'Heading', holds: false });
    expect(row('send')).toMatchObject({ kind: 'Button' });
    expect(row('f-mobile')?.required).toBe(false);
  });

  it('outlines a survey: its pages, and the questions on each', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(q, { label: 'Coming?' });
    designer.addContainer('Page 2');
    const rows = outlineRows(designer.getPage());
    expect(drawn(rows)).toEqual(['Page 1', '  Coming?', 'Page 2']);
    expect(rows[0]).toMatchObject({ kind: 'Page', holds: true, children: 1 });
    expect(rows[2]).toMatchObject({ kind: 'Page', holds: true, children: 0 });
  });

  it('keeps a sheet’s header parts at the top, picked but never moved', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    designer.addHeaderPart('button', 'Confirm');
    const rows = outlineRows(designer.getPage());
    expect(rows[0]).toMatchObject({ label: 'Confirm', kind: 'Button', movable: false, level: 0 });
    expect(rows.find((r) => r.label === 'Untitled section')).toMatchObject({ movable: true, holds: true });
  });
});

describe('shownRows', () => {
  it('leaves out what is inside a folded row, however deep', () => {
    const rows = outlineRows(employeePage());
    const shown = shownRows(rows, new Set(['personal', 'tab-job']));
    expect(drawn(shown).slice(0, 4)).toEqual(['Personal details', 'Side by side', '  Home address', '    Street and number']);
    expect(drawn(shown).slice(11, 15)).toEqual(['Tabs', '  Job', '  Documents', '    Side by side']);
  });

  it('folds nothing a row does not hold', () => {
    const rows = outlineRows(employeePage());
    expect(shownRows(rows, new Set(['f-photo']))).toEqual(rows);
  });
});
