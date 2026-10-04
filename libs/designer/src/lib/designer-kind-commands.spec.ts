import type { Field, FieldNode, Page, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { relabel } from './kind-commands';

/** Edits the newer kinds need: an option's picture and points, a matrix's rows and columns, an address's parts, one picture or several. */

const questions = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);
const nodeOf = (page: Page, id: string) => questions(page).find((n) => n.id === id) as FieldNode;
const fieldOf = (page: Page, id: string) => page.fields[nodeOf(page, id).field];
const survey = () => createDesigner({ page: blankPage('survey', 'Quiz') });

describe('an option’s picture and points', () => {
  it('sets and takes away a picture and points, each a single undo', () => {
    const designer = survey();
    const id = designer.addQuestion('image-choice') as string;
    designer.setOptions(id, ['Red', 'Blue']);
    expect(designer.setOptionDetails(id, 1, { image: ' https://example.com/blue.png ' })).toBe(true);
    expect(designer.setOptionDetails(id, 1, { score: 2 })).toBe(true);
    expect((fieldOf(designer.getPage(), id) as Extract<Field, { type: 'selection' }>).options[1]).toEqual({ value: 'blue', label: 'Blue', image: 'https://example.com/blue.png', score: 2 });
    designer.setOptionDetails(id, 1, { image: '', score: null });
    expect((fieldOf(designer.getPage(), id) as Extract<Field, { type: 'selection' }>).options[1]).toEqual({ value: 'blue', label: 'Blue' });
    designer.undo();
    expect((fieldOf(designer.getPage(), id) as Extract<Field, { type: 'selection' }>).options[1]).toMatchObject({ image: 'https://example.com/blue.png', score: 2 });
  });

  it('keeps an option’s picture and points when its words change, or others come and go', () => {
    const designer = survey();
    const id = designer.addQuestion('multiple-choice') as string;
    designer.setOptions(id, ['Cairo', 'Giza']);
    designer.setOptionDetails(id, 0, { score: 1, image: 'cairo.png' });
    designer.setOptions(id, ['Luxor', 'Cairo', 'Giza']);
    designer.setOptions(id, ['Luxor', 'Cairo city', 'Giza']);
    expect((fieldOf(designer.getPage(), id) as Extract<Field, { type: 'selection' }>).options[1]).toEqual({ value: 'cairo', label: 'Cairo city', score: 1, image: 'cairo.png' });
  });

  it('refuses an option that is not there, points that are not a number, and a question without options', () => {
    const designer = survey();
    const id = designer.addQuestion('dropdown') as string;
    expect(designer.setOptionDetails(id, 3, { score: 1 })).toBe(false);
    expect(designer.getState().issues).toEqual(['There is no option 4']);
    expect(designer.setOptionDetails(id, 0, { score: Number.NaN })).toBe(false);
    expect(designer.getState().issues).toEqual(['Points are a number, such as 1 or 0.5']);
    const text = designer.addQuestion('short-answer') as string;
    expect(designer.setOptionDetails(text, 0, { score: 1 })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a question with options has pictures and points']);
  });

  it('leaves the options of a field of the model to the model', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), model: { mood: { type: 'selection', label: 'Mood', options: [{ value: 'ok', label: 'OK' }] } } });
    const id = designer.addModelField('mood', { parent: 'section-1' }) as string;
    expect(designer.setOptionDetails(id, 0, { score: 1 })).toBe(false);
    expect(designer.getState().issues).toEqual(['The options of Mood come from the model']);
  });
});

describe('a matrix’s rows and columns', () => {
  it('renames, adds and takes away rows and columns, keeping the values answers use', () => {
    const designer = survey();
    const id = designer.addQuestion('matrix') as string;
    expect(designer.setMatrixItems(id, 'rows', ['Food', 'Row 2', 'Music'])).toBe(true);
    expect(designer.setMatrixItems(id, 'columns', ['Poor', 'Good'])).toBe(true);
    const field = fieldOf(designer.getPage(), id) as Extract<Field, { type: 'matrix' }>;
    expect(field.rows).toEqual([{ value: 'row_1', label: 'Food' }, { value: 'row_2', label: 'Row 2' }, { value: 'row_3', label: 'Music' }]);
    expect(field.columns).toEqual([{ value: 'column_1', label: 'Poor' }, { value: 'column_2', label: 'Good' }]);
    designer.setMatrixItems(id, 'rows', ['Food', 'Music']);
    expect((fieldOf(designer.getPage(), id) as Extract<Field, { type: 'matrix' }>).rows).toEqual([{ value: 'row_1', label: 'Food' }, { value: 'row_3', label: 'Music' }]);
    expect(designer.setMatrixItems(id, 'columns', ['  '])).toBe(false);
    expect(designer.getState().issues).toEqual(['A matrix needs a column']);
    const text = designer.addQuestion('short-answer') as string;
    expect(designer.setMatrixItems(text, 'rows', ['A'])).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a matrix has rows and columns']);
  });

  it('keeps an item moved, renamed in place or put between others, with its points', () => {
    const old = [{ value: 'a', label: 'A', score: 1 }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }];
    expect(relabel(old, ['C', 'A'], 'x')).toEqual([{ value: 'c', label: 'C' }, { value: 'a', label: 'A', score: 1 }]);
    expect(relabel(old, ['A2', 'B', 'C'], 'x')).toEqual([{ value: 'a', label: 'A2', score: 1 }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]);
    expect(relabel(old, ['New', 'A', 'B', 'C'], 'x')).toEqual([{ value: 'x_1', label: 'New' }, ...old]);
    expect(relabel([{ value: 'x_1', label: 'One' }], ['One', 'Two'], 'x')).toEqual([{ value: 'x_1', label: 'One' }, { value: 'x_2', label: 'Two' }]);
  });
});

describe('an address’s parts and how many pictures', () => {
  it('asks for the parts chosen, in their usual order, all four by saying nothing', () => {
    const designer = survey();
    const id = designer.addQuestion('address') as string;
    expect(designer.setAddressParts(id, ['postcode', 'street'])).toBe(true);
    expect(nodeOf(designer.getPage(), id).options).toEqual({ parts: ['street', 'postcode'] });
    expect(designer.setAddressParts(id, ['street', 'city', 'postcode', 'country'])).toBe(true);
    expect(nodeOf(designer.getPage(), id).options).toBeUndefined();
    expect(designer.setAddressParts(id, ['planet'])).toBe(false);
    expect(designer.getState().issues).toEqual(['An address asks for one part at least']);
    const text = designer.addQuestion('short-answer') as string;
    expect(designer.setAddressParts(text, ['city'])).toBe(false);
  });

  it('lets pictures take several answers, and one again', () => {
    const designer = survey();
    const id = designer.addQuestion('image-choice') as string;
    expect(designer.setSeveral(id, true)).toBe(true);
    expect(fieldOf(designer.getPage(), id)).toMatchObject({ multiple: true });
    expect(designer.setSeveral(id, false)).toBe(true);
    expect(fieldOf(designer.getPage(), id)).not.toHaveProperty('multiple');
    const choice = designer.addQuestion('multiple-choice') as string;
    expect(designer.setSeveral(choice, true)).toBe(false);
  });
});
