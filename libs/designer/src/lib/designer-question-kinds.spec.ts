import { validatePage, type Field, type FieldNode, type Page, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField, kindsFor, QUESTION_KINDS, storedAs } from './designer';
import { kindById } from './kinds';
import { TOOLBOX_GROUPS } from './toolbox';
import { ICON_NAMES } from './icons';

/** The question kinds a survey asks with: signature, slider, tags, image choice, ranking, matrix, address, a repeating group and a tick box. */

const NEW_KINDS = ['signature', 'slider', 'tags', 'image-choice', 'ranking', 'matrix', 'address', 'repeating', 'tick'];
const questions = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);
const fieldOf = (page: Page, id: string) => page.fields[(questions(page).find((n) => n.id === id) as FieldNode).field];
const nodeOf = (page: Page, id: string) => questions(page).find((n) => n.id === id) as FieldNode;

describe('the new kinds of question', () => {
  it('are asked in a survey, each valid, each known again from its field, each with its own icon and place in the toolbox', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Move') });
    const offered = QUESTION_KINDS.map((k) => k.id);
    for (const kind of NEW_KINDS) {
      expect(offered).toContain(kind);
      const id = designer.addQuestion(kind) as string;
      expect(id).toBeTruthy();
      const page = designer.getPage();
      expect(kindOfField(fieldOf(page, id), nodeOf(page, id))).toBe(kind);
      expect(ICON_NAMES).toContain(kind);
      expect(TOOLBOX_GROUPS.flatMap(([, ids]) => ids)).toContain(kind);
    }
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('start with what each needs', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Move') });
    const added = (kind: string) => {
      const id = designer.addQuestion(kind) as string;
      return { field: fieldOf(designer.getPage(), id), node: nodeOf(designer.getPage(), id) };
    };
    expect(added('signature')).toMatchObject({ field: { type: 'binary' }, node: { widget: 'signature' } });
    expect(added('slider')).toMatchObject({ field: { type: 'integer', min: 0, max: 10 }, node: { widget: 'slider' } });
    expect(added('tags')).toMatchObject({ field: { type: 'selection', multiple: true }, node: { widget: 'tags' } });
    expect(added('image-choice')).toMatchObject({ field: { type: 'selection' }, node: { widget: 'image-choice' } });
    const ranking = added('ranking');
    expect(ranking).toMatchObject({ field: { type: 'selection', multiple: true }, node: { widget: 'ranking' } });
    // Nothing to put in order with fewer than two.
    expect((ranking.field as Extract<Field, { type: 'selection' }>).options.length).toBeGreaterThanOrEqual(2);
    expect(added('matrix').field).toMatchObject({ type: 'matrix', rows: [{ label: 'Row 1' }, { label: 'Row 2' }], columns: [{ label: 'Column 1' }, { label: 'Column 2' }] });
    expect(added('address')).toMatchObject({ field: { type: 'json' }, node: { widget: 'address' } });
    expect(added('tick')).toMatchObject({ field: { type: 'boolean' }, node: { widget: 'tick' } });
    const group = added('repeating');
    expect(group).toMatchObject({ field: { type: 'one2many' }, node: { widget: 'cards' } });
    expect(Object.values((group.field as Extract<Field, { type: 'one2many' }>).fields).map((f) => f.label)).toEqual(['Name']);
  });

  it('turn a multiple choice into pictures, tags or a ranking, keeping its options', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Move') });
    const id = designer.addQuestion('multiple-choice') as string;
    designer.setOptions(id, ['Red', 'Blue']);
    for (const kind of ['image-choice', 'tags', 'ranking', 'checkboxes']) {
      expect(designer.changeKind(id, kind)).toBe(true);
      const field = fieldOf(designer.getPage(), id) as Extract<Field, { type: 'selection' }>;
      expect(field.options.map((o) => o.label)).toEqual(['Red', 'Blue']);
      expect(kindOfField(field, nodeOf(designer.getPage(), id))).toBe(kind);
    }
  });

  it('fit a field of the model by what it holds', () => {
    const fits = (field: Field) => kindsFor(field, { fromModel: true, survey: true }).map((k) => k.id);
    const one: Field = { type: 'selection', label: 'Desk', options: [{ value: 'a', label: 'A' }] };
    const several: Field = { ...one, multiple: true };
    expect(fits(one)).toEqual(expect.arrayContaining(['image-choice']));
    expect(fits(one)).not.toContain('tags');
    expect(fits(several)).toEqual(expect.arrayContaining(['image-choice', 'tags', 'ranking']));
    expect(fits({ type: 'float', label: 'Hours' })).toContain('slider');
    expect(fits({ type: 'binary', label: 'Signed' })).toContain('signature');
    expect(fits({ type: 'json', label: 'Where' })).toEqual(['address']);
  });

  it('say what a matrix and an address hold', () => {
    expect(storedAs(kindById('matrix').field('Grid'))).toBe('answers in rows');
    expect(storedAs(kindById('address').field('Where'))).toBe('structured data');
  });
});

describe('the kinds a field can be shown as', () => {
  it('always include the kind it is shown as now, even one the page would not offer to add', () => {
    // A form of answers with a photo: Image is not a kind a survey adds, but this field is one.
    const blank = blankPage('survey', 'New employee');
    const wizard = blank.layout as WizardNode;
    const page = {
      ...blank,
      fields: { ...blank.fields, photo: { type: 'image', label: 'Photo' } },
      layout: { ...wizard, children: [{ ...wizard.children[0], children: [{ type: 'field', id: 'photo-node', field: 'photo' }] }] },
    } as Page;
    const designer = createDesigner({ page });
    expect(designer.kindsFor('photo-node').map((k) => k.id)).toContain('image');
  });
});
