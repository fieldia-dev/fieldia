import { blankPage, createDesigner } from './designer';
import { employeeDesigner, expectValid, nodeOf, watched, where } from './test-layout';

/**
 * Moving parts in reading order, as the outline does: into a group, a tab or
 * a page at a place, one edit for all of them. Nothing is put side by side
 * by accident; widths stay within the columns where they land; arrangements
 * left with one part fold away; and what cannot be done is said in words.
 */

const kids = (d: ReturnType<typeof employeeDesigner>, id: string) => ((id === 'root' ? d.getPage().layout : nodeOf(d.getPage(), id)) as { children?: { id: string }[] } | undefined)?.children?.map((c) => c.id) ?? [];

describe('moveParts', () => {
  it('puts parts into another group at a place, in reading order, as one edit; they stay picked', () => {
    const d = employeeDesigner();
    const steps = d.getState().canUndo;
    expect(d.moveParts(['f-mobile', 'f-email'], 'address', 1)).toEqual(['f-email', 'f-mobile']);
    expect(kids(d, 'address')).toEqual(['f-street', 'f-email', 'f-mobile', 'f-city', 'f-postcode', 'f-country']);
    expect(kids(d, 'who')).toEqual(['f-first_name', 'f-last_name', 'f-birthday', 'f-nationality']);
    expect(d.getState().picked).toEqual(['f-email', 'f-mobile']);
    d.undo();
    expect(kids(d, 'address')).toEqual(['f-street', 'f-city', 'f-postcode', 'f-country']);
    expect(d.getState().canUndo).toBe(steps);
    expectValid(d.getPage());
  });

  it('counts the place in the list as it is, the parts moved still in it', () => {
    const d = employeeDesigner();
    // Before “Postcode”, from above it and from below it.
    d.moveParts(['f-street'], 'address', 2);
    expect(kids(d, 'address')).toEqual(['f-city', 'f-street', 'f-postcode', 'f-country']);
    d.moveParts(['f-country'], 'address', 2);
    expect(kids(d, 'address')).toEqual(['f-city', 'f-street', 'f-country', 'f-postcode']);
    // At the end.
    d.moveParts(['f-city'], 'address', 4);
    expect(kids(d, 'address')).toEqual(['f-street', 'f-country', 'f-postcode', 'f-city']);
  });

  it('keeps each part no wider than the group it lands in', () => {
    const d = employeeDesigner();
    d.moveParts(['f-street'], 'emergency', 0);
    expect(nodeOf(d.getPage(), 'f-street')?.['colspan']).toBeUndefined();
    d.moveParts(['f-contract'], 'personal', 0);
    expect(nodeOf(d.getPage(), 'f-contract')?.['colspan']).toBe(2);
  });

  it('makes no arrangement, and folds one left holding one part', () => {
    const d = employeeDesigner();
    // Home address and Emergency contact sit side by side: one of them out, and the other stands alone.
    d.moveParts(['emergency'], 'root', 3);
    expect(nodeOf(d.getPage(), 'side-1')).toBeUndefined();
    expect(where(d.getPage(), 'address')?.parent).toBe('root');
    expect(kids(d, 'root').slice(0, 4)).toEqual(['personal', 'address', 'job-tabs', 'emergency']);
    expectValid(d.getPage());
  });

  it('a row of parts on the page takes one more column, up to four', () => {
    const d = employeeDesigner();
    d.moveParts(['h-send'], 'side-1', 1);
    expect(where(d.getPage(), 'h-send')).toMatchObject({ parent: 'side-1', kids: ['address', 'h-send', 'emergency'], columns: { wide: 3, medium: 1 } });
    d.moveParts(['emergency'], 'root', 0);
    expect(where(d.getPage(), 'h-send')).toMatchObject({ parent: 'side-1', kids: ['address', 'h-send'], columns: { wide: 2, medium: 1 } });
    expectValid(d.getPage());
  });

  it('moves tabs among their tabs, and pages among the pages', () => {
    const d = employeeDesigner();
    d.moveParts(['tab-pay'], 'job-tabs', 0);
    expect(kids(d, 'job-tabs')).toEqual(['tab-pay', 'tab-job', 'tab-docs']);
    const survey = watched(createDesigner({ page: blankPage('survey', 'Feedback') }));
    const two = survey.addContainer('Page 2') as string;
    survey.moveParts([two], 'steps', 0);
    expect((survey.getPage().layout as { children: { id: string }[] }).children.map((s) => s.id)).toEqual([two, 'step-1']);
  });

  it('moves a question to another page', () => {
    const d = watched(createDesigner({ page: blankPage('survey', 'Feedback') }));
    const q = d.addQuestion('short-answer') as string;
    const two = d.addContainer('Page 2') as string;
    d.moveParts([q], two, 0);
    expect(where(d.getPage(), q)?.parent).toBe(two);
  });

  it('moves a group with what is in it: a part picked inside a part picked goes with it', () => {
    const d = employeeDesigner();
    expect(d.moveParts(['f-city', 'address'], 'root', 0)).toEqual(['address']);
    expect(kids(d, 'address')).toContain('f-city');
  });
});

describe('moveRefusal', () => {
  it('says in words why a move cannot be made, and the move changes nothing', () => {
    const d = employeeDesigner();
    const page = d.getPage();
    expect(d.moveRefusal(['tab-pay'], 'tab-job')).toBe('A tab holds parts, not other tabs');
    expect(d.moveRefusal(['tab-pay'], 'personal')).toBe('A tab moves only among its tabs');
    expect(d.moveRefusal(['f-city'], 'job-tabs')).toBe('Put it in one of the tabs');
    expect(d.moveRefusal(['personal'], 'who')).toBe('A part cannot go inside itself');
    expect(d.moveRefusal(['f-city'], 'f-street')).toBe('“Street and number” holds no parts');
    expect(d.moveRefusal(['f-city'], 'nowhere')).toBe('There is no part “nowhere”');
    expect(d.moveRefusal(['nothing'], 'root')).toBe('There is no part “nothing”');
    expect(d.moveRefusal([], 'root')).toBe('Pick a part to move');
    expect(d.moveParts(['tab-pay'], 'tab-job', 0)).toBe(false);
    expect(d.getState().issues).toEqual(['A tab holds parts, not other tabs']);
    expect(d.getPage()).toBe(page);
  });

  it('a row holds four', () => {
    const d = employeeDesigner();
    d.moveParts(['h-send', 't-note'], 'side-1', 1);
    expect(d.moveRefusal(['send'], 'side-1')).toBe('A row holds four');
    expect(d.moveRefusal(['h-send'], 'side-1')).toBeNull();
  });

  it('in a survey: a page holds questions, and a question goes on a page', () => {
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = d.addQuestion('short-answer') as string;
    const two = d.addContainer('Page 2') as string;
    expect(d.moveRefusal([two], 'step-1')).toBe('A page holds questions, not other pages');
    expect(d.moveRefusal([q], 'steps')).toBe('A question goes on a page');
    expect(d.moveRefusal([q], two)).toBeNull();
  });
});

describe('describeMove', () => {
  it('says where they would go, in the words the drag chip says', () => {
    const d = employeeDesigner();
    expect(d.describeMove(['f-email'], 'address', 1)).toBe('into “Home address”, before “City”');
    expect(d.describeMove(['f-email'], 'address', 4)).toBe('into “Home address”, at the end');
    expect(d.describeMove(['f-city'], 'address', 3)).toBe('after “Postcode”');
    expect(d.describeMove(['f-country'], 'address', 1)).toBe('before “City”');
    expect(d.describeMove(['f-city'], 'address', 4)).toBe('after “Country”');
    expect(d.describeMove(['f-city'], 'address', 1)).toBe('where it is');
    expect(d.describeMove(['f-city'], 'root', 0)).toBe('onto the page, before “Personal details”');
    expect(d.describeMove(['f-city'], 'job-tabs', 0)).toBe('Put it in one of the tabs');
  });

  it('parts from here and elsewhere go into it; parts gathered up go before the part they meet', () => {
    const d = employeeDesigner();
    expect(d.describeMove(['f-city', 'f-email'], 'address', 0)).toBe('into “Home address”, before “Street and number”');
    expect(d.describeMove(['f-street', 'f-postcode'], 'address', 0)).toBe('before “City”');
  });

  it('names a survey’s page by its title', () => {
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = d.addQuestion('short-answer') as string;
    const two = d.addContainer('Page 2') as string;
    expect(d.describeMove([q], two, 0)).toBe('into “Page 2”, at the end');
    expect(d.describeMove([two], 'steps', 0)).toBe('before “Page 1”');
  });
});
