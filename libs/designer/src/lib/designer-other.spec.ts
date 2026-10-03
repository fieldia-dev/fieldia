import { validatePage, type FieldNode, type Page, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';

/** An answer of one's own ("Other"), a scale's ends in words, and which files a question takes. */

const nodeOf = (page: Page, id: string) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]).find((n) => n.id === id) as FieldNode;
const fieldOf = (page: Page, id: string) => page.fields[nodeOf(page, id).field];

describe('“Other”, an answer of one’s own', () => {
  it('is added to multiple choice and taken away again', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('multiple-choice') as string;
    const before = designer.getPage();
    expect(designer.setOther(q, true)).toBe(true);
    expect(fieldOf(designer.getPage(), q)).toMatchObject({ other: true });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toEqual(['“Untitled question”: takes an answer of its own (“Other”)']);
    expect(designer.setOther(q, false)).toBe(true);
    expect(fieldOf(designer.getPage(), q)).not.toHaveProperty('other');
  });

  it('stays through checkboxes, and goes with a dropdown, which has none', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('multiple-choice') as string;
    designer.setOther(q, true);
    designer.changeKind(q, 'checkboxes');
    expect(fieldOf(designer.getPage(), q)).toMatchObject({ other: true, multiple: true });
    designer.changeKind(q, 'dropdown');
    expect(fieldOf(designer.getPage(), q)).not.toHaveProperty('other');
    expect(designer.setOther(q, true)).toBe(false);
    expect(designer.getState().issues).toEqual(['Only multiple choice and checkboxes take an answer of one’s own']);
  });

  it('is the model’s to say for a field of the model', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), model: { state: { type: 'selection', label: 'Status', options: [{ value: 'a', label: 'A' }] } } });
    designer.addModelField('state', { parent: 'section-1' });
    const id = ((designer.getPage().layout as unknown as { children: { children: FieldNode[] }[] }).children[0].children[0]).id;
    designer.changeKind(id, 'multiple-choice');
    expect(designer.setOther(id, true)).toBe(false);
    expect(designer.getState().issues).toEqual(['Whether Status takes an answer of its own comes from the model']);
  });
});

describe('a scale’s ends in words', () => {
  it('sets and clears the words at either end', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('scale') as string;
    expect(designer.setWidgetOptions(q, { startLabel: 'Not likely', endLabel: 'Very likely' })).toBe(true);
    expect(nodeOf(designer.getPage(), q).options).toEqual({ startLabel: 'Not likely', endLabel: 'Very likely' });
    designer.setWidgetOptions(q, { startLabel: '' });
    expect(nodeOf(designer.getPage(), q).options).toEqual({ endLabel: 'Very likely' });
    designer.setWidgetOptions(q, { endLabel: null });
    expect(nodeOf(designer.getPage(), q).options).toBeUndefined();
  });

  it('takes words typed letter by letter back in one undo, and says how it shows changed', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('scale') as string;
    const before = designer.getPage();
    designer.setWidgetOptions(q, { startLabel: 'N' });
    designer.setWidgetOptions(q, { startLabel: 'No' });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Untitled question”: how it shows changed']);
    designer.undo();
    expect(nodeOf(designer.getPage(), q).options).toBeUndefined();
  });
});

describe('which files a question takes', () => {
  it('limits the kinds of file and the largest size, and lifts the limits', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('file') as string;
    expect(designer.setFileRules(q, { accept: ['image/*', 'application/pdf'], maxSize: 1024 * 1024 })).toBe(true);
    expect(fieldOf(designer.getPage(), q)).toMatchObject({ accept: ['image/*', 'application/pdf'], maxSize: 1048576 });
    designer.setFileRules(q, { accept: [] });
    expect(fieldOf(designer.getPage(), q)).not.toHaveProperty('accept');
    const text = designer.addQuestion('short-answer') as string;
    expect(designer.setFileRules(text, { maxSize: 10 })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a file upload takes files']);
  });

  it('takes a size in whole bytes, more than nothing, lifts it, and says the files changed', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('file') as string;
    const before = designer.getPage();
    designer.setFileRules(q, { maxSize: 2048 });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Untitled question”: the files it takes changed']);
    for (const size of [0, -1, 1.5]) {
      expect(designer.setFileRules(q, { maxSize: size })).toBe(false);
      expect(designer.getState().issues).toEqual(['The largest file is a size in bytes, more than nothing']);
    }
    expect(designer.setFileRules(q, { maxSize: null })).toBe(true);
    expect(fieldOf(designer.getPage(), q)).not.toHaveProperty('maxSize');
  });
});
