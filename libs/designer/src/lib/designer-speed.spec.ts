import { validatePage, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChecks } from './designer';

/**
 * What keeps the designer quick on a big page, without changing what it does:
 * an edit leaves what it did not touch as the same objects, so the views skip
 * them; and what is worked out from a page is worked out once for it.
 */

function screen(fields: number): Page {
  const page = blankPage('screen', 'Big');
  const section = (page.layout as { children: SectionNode[] }).children[0];
  for (let i = 1; i <= fields; i++) {
    page.fields[`f${i}`] = { type: 'char', label: `Field ${i}` };
    section.children.push({ type: 'field', id: `n${i}`, field: `f${i}` });
  }
  return page;
}
const nodes = (page: Page) => (page.layout as { children: SectionNode[] }).children[0].children as FieldNode[];

describe('an edit on a big page', () => {
  it('keeps every field and part it did not touch as they were, the same objects', () => {
    const designer = createDesigner({ page: screen(20) });
    const before = designer.getPage();
    expect(designer.updateQuestion('n3', { label: 'Third' })).toBe(true);
    const after = designer.getPage();
    expect(after).not.toBe(before);
    expect(after.fields['f3']).toEqual({ type: 'char', label: 'Third' });
    expect(after.fields['f3']).not.toBe(before.fields['f3']);
    for (const name of Object.keys(before.fields).filter((n) => n !== 'f3')) expect(after.fields[name]).toBe(before.fields[name]);
    // Only a field's definition changed: the layout is the one before.
    expect(after.layout).toBe(before.layout);
  });

  it('keeps the other parts when one is added among them, and undo gives back the page before', () => {
    const designer = createDesigner({ page: screen(5) });
    const before = designer.getPage();
    const added = designer.addQuestion('short-answer', { after: 'n2' }) as string;
    const after = designer.getPage();
    expect(nodes(after).map((n) => n.id)).toEqual(['n1', 'n2', added, 'n3', 'n4', 'n5']);
    nodes(before).forEach((node) => expect(nodes(after)).toContain(node));
    designer.undo();
    expect(designer.getPage()).toBe(before);
  });

  it('works out whether the draft is published once for each page, however often the state is asked for', () => {
    const designer = createDesigner({ page: screen(20) });
    designer.updateQuestion('n1', { label: 'First' });
    designer.getState();
    const stringify = jest.spyOn(JSON, 'stringify');
    try {
      for (let i = 0; i < 10; i++) expect(designer.getState().unpublished).toBe(true);
      expect(stringify).not.toHaveBeenCalled();
    } finally {
      stringify.mockRestore();
    }
  });

  it('still says when the draft is the version published, and when it is not', async () => {
    const designer = createDesigner({ page: screen(2) });
    expect(designer.getState().unpublished).toBe(true);
    await designer.publish();
    expect(designer.getState().unpublished).toBe(false);
    designer.updateQuestion('n1', { label: 'First' });
    expect(designer.getState().unpublished).toBe(true);
    designer.undo();
    expect(designer.getState().unpublished).toBe(false);
  });

  it('works out the checks once for each page', () => {
    const designer = createDesigner({ page: screen(3) });
    designer.addQuestion('short-answer');
    const checks = designer.checks();
    expect(checks.length).toBeGreaterThan(0);
    expect(designer.checks()[0]).toBe(checks[0]);
    designer.select(null);
    expect(designer.checks()[0]).toBe(checks[0]);
    designer.updateQuestion('n1', { label: 'First' });
    expect(designer.checks()[0]).not.toBe(checks[0]);
    expect(designer.checks()).toEqual(checks);
  });
});

describe('an edit checked at the cost of what it changed', () => {
  it('refuses a field made wrong with the same words a whole check gives', () => {
    const designer = createDesigner({ page: screen(3) });
    const choice = designer.addQuestion('dropdown') as string;
    const before = designer.getPage();
    const name = nodes(before).find((n) => n.id === choice)?.field as string;
    const wrong = JSON.parse(JSON.stringify(before)) as Page;
    (wrong.fields[name] as { options: unknown[] }).options = [];
    const whole = validatePage(wrong);
    expect(whole.ok).toBe(false);
    expect(designer.setOptions(choice, [])).toBe(false);
    expect(designer.getPage()).toBe(before);
    expect(designer.getState().issues).toEqual(whole.ok ? [] : whole.issues.map((i) => `${i.path}: ${i.message}`));
  });

  it('refuses a field pointing at one the page has not got, as before', () => {
    const designer = createDesigner({ page: screen(2) });
    expect(designer.setCompute('n1', 'f2 * nowhere')).toBe(false);
    expect(designer.getState().issues.join('\n')).toMatch(/nowhere/);
  });

  it('still refuses every edit of a page that was wrong from the start, saying what is wrong with it', () => {
    const page = screen(2);
    (page.fields['f2'] as { label: unknown }).label = 7;
    const designer = createDesigner({ page });
    expect(designer.updateQuestion('n1', { label: 'First' })).toBe(false);
    expect(designer.getState().issues.join('\n')).toMatch(/^fields\.f2\.label/);
  });

  it('takes a translation, a title and a look typed, keeping the page as a whole check would', () => {
    const designer = createDesigner({ page: screen(20) });
    expect(designer.addLanguage('ar')).toBe(true);
    for (const words of ['ح', 'حق', 'حقل']) expect(designer.setTranslation('ar', 'Field 1', words)).toBe(true);
    expect(designer.setPageInfo({ title: 'Big one' })).toBe(true);
    expect(designer.setLook({ accent: '#123456' })).toBe(true);
    const page = designer.getPage();
    expect(page.translations).toEqual({ ar: { 'Field 1': 'حقل' } });
    const whole = validatePage(page);
    expect(whole.ok && whole.page).toEqual(page);
  });

  it('refuses a look made wrong, as a whole check does', () => {
    const designer = createDesigner({ page: screen(2) });
    designer.setLook({ accent: '#123456' });
    expect(designer.setLook({ accent: 'red' })).toBe(false);
    expect(designer.getPage().look).toEqual({ accent: '#123456' });
  });

  it('takes a label typed into a page of 500 fields, keeping the page as a whole check would', () => {
    const designer = createDesigner({ page: screen(500) });
    designer.updateQuestion('n1', { label: 'First' });
    for (const words of ['Fi', 'Fir', 'Firs', 'First name']) expect(designer.updateQuestion('n250', { label: words })).toBe(true);
    const page = designer.getPage();
    expect(page.fields['f250']).toEqual({ type: 'char', label: 'First name' });
    const whole = validatePage(page);
    expect(whole.ok && whole.page).toEqual(page);
  });
});

describe('an edit that picks what it made', () => {
  it('tells its listeners once, with the page and what is picked together', () => {
    const designer = createDesigner({ page: screen(4) });
    const seen: { page: Page; selected: string | null; picked: string[] }[] = [];
    designer.subscribe((state) => seen.push({ page: state.page, selected: state.selected, picked: state.picked }));
    const made = designer.addQuestion('short-answer', { after: 'n2' }) as string;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ page: designer.getPage(), selected: made, picked: [made] });
    seen.length = 0;
    const group = designer.wrap(['n1', 'n2'], 'group') as string;
    expect(seen.map((s) => s.picked)).toEqual([[group]]);
    seen.length = 0;
    designer.pick('n3');
    seen.length = 0;
    expect(designer.removeNode('n3')).toBe(true);
    expect(seen.map((s) => s.selected)).toEqual([null]);
    seen.length = 0;
    designer.pickMany(['n4', made]);
    expect(designer.remove(['n4'])).toBe(true);
    expect(seen.slice(1).map((s) => [s.picked, s.selected])).toEqual([[[made], made]]);
  });

  it('still picks nothing new when the edit is refused', () => {
    const designer = createDesigner({ page: screen(2) });
    designer.select('n1');
    const seen: (string | null)[] = [];
    designer.subscribe((state) => seen.push(state.selected));
    expect(designer.addQuestion('short-answer', { after: 'nowhere' })).toBe(false);
    expect(seen).toEqual(['n1']);
    expect(designer.getState().issues).toEqual(['There is no element "nowhere"']);
  });
});

describe('the checks of a page the designer has checked already', () => {
  it('are the checks a whole check finds', () => {
    const designer = createDesigner({ page: screen(3) });
    designer.addQuestion('dropdown');
    designer.addContainer('Empty');
    expect(designer.checks()).toEqual(pageChecks(designer.getPage()));
    expect(designer.checks().length).toBeGreaterThan(1);
  });

  it('still say what is wrong with a page that was wrong from the start', () => {
    const page = screen(2);
    (page.fields['f2'] as { colour?: string }).colour = 'red';
    const designer = createDesigner({ page });
    expect(designer.checks()).toEqual(pageChecks(page));
    expect(designer.checks()[0]).toMatchObject({ severity: 'must', text: expect.stringMatching(/^fields\.f2/) });
  });
});
