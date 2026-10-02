import { validatePage, type FieldNode, type Page, type SectionNode, type StepNode, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, QUESTION_KINDS } from './designer';

const wizard = (page: Page) => page.layout as WizardNode;
const fieldNodes = (page: Page) =>
  wizard(page).children.flatMap((step) => step.children.filter((n): n is FieldNode => n.type === 'field'));

describe('blankPage', () => {
  it('starts a survey with one step, and it validates', () => {
    const page = blankPage('survey', 'Event feedback');
    expect(validatePage(page).ok).toBe(true);
    expect(page.title).toBe('Event feedback');
    expect(wizard(page).children).toHaveLength(1);
  });

  it('starts an app screen as sections, and it validates', () => {
    const page = blankPage('screen', 'Visit report');
    expect(validatePage(page).ok).toBe(true);
    expect(page.layout.type).toBe('sections');
  });
});

describe('createDesigner — building a survey', () => {
  it('adds questions of every kind, each one valid', () => {
    const designer = createDesigner({ page: blankPage('survey', 'All kinds') });
    for (const kind of QUESTION_KINDS) expect(designer.addQuestion(kind.id)).toBeTruthy();
    expect(fieldNodes(designer.getPage())).toHaveLength(QUESTION_KINDS.length);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('gives a new question a label, a field and a selection', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const id = designer.addQuestion('multiple-choice') as string;
    const node = fieldNodes(designer.getPage())[0];
    expect(node.id).toBe(id);
    expect(node.widget).toBe('radio');
    const field = designer.getPage().fields[node.field];
    expect(field).toMatchObject({ type: 'selection', label: 'Untitled question', options: [{ value: 'option_1', label: 'Option 1' }] });
    expect(designer.getState().selected).toBe(id);
  });

  it('edits a question: label, required, help and options', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const id = designer.addQuestion('checkboxes') as string;
    designer.updateQuestion(id, { label: 'What do you like?', required: true, help: 'Pick any' });
    designer.setOptions(id, ['Speed', 'Design', 'Price']);
    const node = fieldNodes(designer.getPage())[0];
    expect(designer.getPage().fields[node.field]).toMatchObject({
      type: 'selection',
      multiple: true,
      label: 'What do you like?',
      required: true,
      help: 'Pick any',
      options: [
        { value: 'speed', label: 'Speed' },
        { value: 'design', label: 'Design' },
        { value: 'price', label: 'Price' },
      ],
    });
  });

  it('keeps option values when options are renamed, so stored answers still match', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const id = designer.addQuestion('dropdown') as string;
    designer.setOptions(id, ['Cairo', 'Giza']);
    designer.setOptions(id, ['Cairo city', 'Giza']);
    const field = designer.getPage().fields[fieldNodes(designer.getPage())[0].field];
    expect(field).toMatchObject({ options: [{ value: 'cairo', label: 'Cairo city' }, { value: 'giza', label: 'Giza' }] });
  });

  it('changes a question’s kind, keeping its label', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: 'Rate us' });
    designer.changeKind(id, 'rating');
    const node = fieldNodes(designer.getPage())[0];
    expect(node.widget).toBe('rating');
    expect(designer.getPage().fields[node.field]).toMatchObject({ type: 'integer', label: 'Rate us', min: 1, max: 5 });
  });

  it('moves, duplicates and removes questions', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const a = designer.addQuestion('short-answer') as string;
    const b = designer.addQuestion('paragraph') as string;
    designer.moveNode(b, -1);
    expect(fieldNodes(designer.getPage()).map((n) => n.id)).toEqual([b, a]);
    const copy = designer.duplicateNode(a) as string;
    expect(fieldNodes(designer.getPage()).map((n) => n.id)).toEqual([b, a, copy]);
    expect(fieldNodes(designer.getPage())[2].field).not.toBe(fieldNodes(designer.getPage())[1].field);
    designer.removeNode(a);
    expect(fieldNodes(designer.getPage()).map((n) => n.id)).toEqual([b, copy]);
    expect(Object.keys(designer.getPage().fields)).toHaveLength(2);
  });

  it('adds a step and makes it a branch shown only for one answer', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const q = designer.addQuestion('multiple-choice') as string;
    designer.setOptions(q, ['Yes', 'No']);
    const step = designer.addContainer('Why not') as string;
    designer.addQuestion('paragraph', { parent: step });
    const field = fieldNodes(designer.getPage())[0].field;
    expect(designer.setCondition(step, { field, equals: 'no' })).toBe(true);
    const branch = wizard(designer.getPage()).children[1] as StepNode;
    expect(branch.invisible).toBe(`${field} != 'no'`);
    expect(designer.setCondition(step, null)).toBe(true);
    expect((wizard(designer.getPage()).children[1] as StepNode).invisible).toBeUndefined();
  });

  it('refuses an edit that would break the page, and says why', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const step = wizard(designer.getPage()).children[0].id;
    expect(designer.setCondition(step, { field: 'nope', equals: 'x' })).toBe(false);
    expect(designer.getState().issues.join('\n')).toMatch(/"nope"/);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});

describe('createDesigner — undo and redo', () => {
  it('undoes and redoes every edit, one at a time', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const start = designer.getPage();
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: 'Name' });
    expect(designer.getState().canUndo).toBe(true);
    designer.undo();
    expect(designer.getPage().fields[fieldNodes(designer.getPage())[0].field].label).toBe('Untitled question');
    designer.undo();
    expect(designer.getPage()).toEqual(start);
    expect(designer.getState().canUndo).toBe(false);
    designer.redo();
    designer.redo();
    expect(designer.getPage().fields[fieldNodes(designer.getPage())[0].field].label).toBe('Name');
    expect(designer.getState().canRedo).toBe(false);
  });

  it('forgets the redo path once a new edit is made', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    designer.addQuestion('short-answer');
    designer.undo();
    designer.addQuestion('paragraph');
    expect(designer.getState().canRedo).toBe(false);
  });

  it('merges a run of typing in one label into one undo step', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const id = designer.addQuestion('short-answer') as string;
    for (const label of ['N', 'Na', 'Nam', 'Name']) designer.updateQuestion(id, { label });
    designer.undo();
    expect(designer.getPage().fields[fieldNodes(designer.getPage())[0].field].label).toBe('Untitled question');
  });
});

describe('createDesigner — drafts and published versions', () => {
  it('publishes versions, and a draft never changes what is published', async () => {
    const store = createMemoryPageStore();
    const designer = createDesigner({ page: blankPage('survey', 'S'), store });
    const id = designer.addQuestion('short-answer') as string;
    expect(await designer.publish()).toBe(1);
    designer.updateQuestion(id, { label: 'Changed after publishing' });
    await designer.settled();
    const saved = await store.load('s');
    expect(saved.versions).toHaveLength(1);
    expect(fieldNodes(saved.versions[0].page).length).toBe(1);
    expect(saved.versions[0].page.fields[fieldNodes(saved.versions[0].page)[0].field].label).toBe('Untitled question');
    expect(saved.draft?.fields[fieldNodes(saved.draft as Page)[0].field].label).toBe('Changed after publishing');
    expect(designer.getState().unpublished).toBe(true);
    expect(await designer.publish()).toBe(2);
    expect(designer.getState().unpublished).toBe(false);
  });

  it('reopens the latest draft from the store', async () => {
    const store = createMemoryPageStore();
    const first = createDesigner({ page: blankPage('survey', 'S'), store });
    first.addQuestion('rating');
    await first.settled();
    const reopened = await createDesigner.open('s', store);
    expect(fieldNodes(reopened.getPage())).toHaveLength(1);
  });

  it('can start again from a published version', async () => {
    const store = createMemoryPageStore();
    const designer = createDesigner({ page: blankPage('survey', 'S'), store });
    designer.addQuestion('short-answer');
    await designer.publish();
    designer.addQuestion('paragraph');
    designer.revertTo(1);
    expect(fieldNodes(designer.getPage())).toHaveLength(1);
    designer.undo();
    expect(fieldNodes(designer.getPage())).toHaveLength(2);
  });
});

describe('createDesigner — app screens', () => {
  it('lays out fields in sections, with spans and columns', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit report') });
    const section = (designer.getPage().layout as { children: SectionNode[] }).children[0].id;
    const a = designer.addQuestion('short-answer', { parent: section }) as string;
    designer.setColumns(section, 2);
    designer.setColspan(a, 2);
    const s = (designer.getPage().layout as { children: SectionNode[] }).children[0];
    expect(s.columns).toBe(2);
    expect((s.children[0] as FieldNode).colspan).toBe(2);
    expect(designer.setColspan(a, 3)).toBe(false); // wider than its section
  });

  it('changes the wide count of columns given per width, keeping the narrower ones under it', () => {
    const page = blankPage('screen', 'Visit report');
    const first = (page.layout as { children: SectionNode[] }).children[0];
    first.columns = { wide: 3, medium: 2, narrow: 1 };
    const designer = createDesigner({ page });
    const a = designer.addQuestion('short-answer', { parent: first.id }) as string;
    designer.setColspan(a, 3);
    designer.setColumns(first.id, 4);
    expect((designer.getPage().layout as { children: SectionNode[] }).children[0].columns).toEqual({ wide: 4, medium: 2, narrow: 1 });
    designer.setColumns(first.id, 1);
    const s = (designer.getPage().layout as { children: SectionNode[] }).children[0];
    expect(s.columns).toEqual({ wide: 1, medium: 1, narrow: 1 });
    expect((s.children[0] as FieldNode).colspan).toBe(1);
  });

  it('puts a field in another section, at a place', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit report') });
    const first = (designer.getPage().layout as { children: SectionNode[] }).children[0].id;
    const second = designer.addContainer('Follow-up') as string;
    const a = designer.addQuestion('short-answer', { parent: first }) as string;
    designer.addQuestion('date', { parent: second });
    designer.placeNode(a, second, 0);
    const sections = (designer.getPage().layout as { children: SectionNode[] }).children;
    expect(sections[0].children).toHaveLength(0);
    expect(sections[1].children.map((n) => n.id)[0]).toBe(a);
  });

  it('narrows a field that moves into a section with fewer columns', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit report') });
    const first = (designer.getPage().layout as { children: SectionNode[] }).children[0].id;
    designer.setColumns(first, 3);
    const second = designer.addContainer('Follow-up') as string;
    designer.setColumns(second, 1);
    const wide = designer.addQuestion('paragraph', { parent: first }) as string;
    designer.setColspan(wide, 3);
    expect(designer.placeNode(wide, second, 0)).toBe(true);
    const moved = (designer.getPage().layout as { children: SectionNode[] }).children[1].children[0] as FieldNode;
    expect(moved.colspan).toBeUndefined();
  });
});

describe('createDesigner — arranging a section from the canvas', () => {
  it('reorders fields and sets their widths in one undo step', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit report') });
    const section = (designer.getPage().layout as { children: SectionNode[] }).children[0].id;
    const a = designer.addQuestion('short-answer', { parent: section }) as string;
    const b = designer.addQuestion('date', { parent: section }) as string;
    const c = designer.addQuestion('paragraph', { parent: section }) as string;
    expect(designer.arrangeSection(section, [{ id: c, colspan: 2 }, { id: a, colspan: 1 }, { id: b, colspan: 1 }])).toBe(true);
    const children = (designer.getPage().layout as { children: SectionNode[] }).children[0].children as FieldNode[];
    expect(children.map((n) => [n.id, n.colspan ?? 1])).toEqual([[c, 2], [a, 1], [b, 1]]);
    designer.undo();
    const back = (designer.getPage().layout as { children: SectionNode[] }).children[0].children as FieldNode[];
    expect(back.map((n) => n.id)).toEqual([a, b, c]);
  });

  it('refuses an arrangement that loses or invents a field', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit report') });
    const section = (designer.getPage().layout as { children: SectionNode[] }).children[0].id;
    const a = designer.addQuestion('short-answer', { parent: section }) as string;
    designer.addQuestion('date', { parent: section });
    expect(designer.arrangeSection(section, [{ id: a, colspan: 1 }])).toBe(false);
    expect(designer.arrangeSection(section, [{ id: a, colspan: 1 }, { id: 'ghost', colspan: 1 }])).toBe(false);
  });
});
