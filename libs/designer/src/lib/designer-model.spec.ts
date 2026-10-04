import { validatePage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField } from './designer';

const nodes = (page: Page) => (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const nodeOf = (page: Page, id: string) => nodes(page).find((n) => n.id === id) as FieldNode;

/** A customer as the backend has it: its fields, typed, before any page shows them. */
const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name', required: true },
  email: { type: 'char', label: 'Email' },
  credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  visits: { type: 'integer', label: 'Visits' },
  score: { type: 'float', label: 'Score' },
  payment_terms: { type: 'selection', label: 'Payment terms', options: [{ value: 'now', label: 'Immediate' }, { value: '30', label: '30 days' }] },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'customer.tag' },
};

const customer = () => createDesigner({ page: blankPage('screen', 'Customer'), model });

describe('fields the backend already has', () => {
  it('lists the model’s fields not on the page yet, and adds one as the backend has it', () => {
    const designer = customer();
    expect(designer.modelFields().map((f) => f.name)).toEqual(['name', 'email', 'credit_limit', 'visits', 'score', 'payment_terms', 'tag_ids']);
    const id = designer.addModelField('credit_limit') as string;
    expect(id).toBeTruthy();
    const page = designer.getPage();
    // Its own name and definition: the page stores what the backend stores.
    expect(nodeOf(page, id).field).toBe('credit_limit');
    expect(page.fields['credit_limit']).toEqual(model['credit_limit']);
    expect(designer.getState().selected).toBe(id);
    expect(designer.modelFields().map((f) => f.name)).not.toContain('credit_limit');
    expect(validatePage(page).ok).toBe(true);
  });

  it('puts it after a field, or at the end of a section, as a new field goes', () => {
    const designer = customer();
    const first = designer.addModelField('name') as string;
    const second = designer.addModelField('email') as string;
    const between = designer.addModelField('visits', { after: first }) as string;
    expect(nodes(designer.getPage()).map((n) => n.id)).toEqual([first, between, second]);
  });

  it('adds at a place within a section, as a drop does, in one step', () => {
    const designer = customer();
    const name = designer.addModelField('name') as string;
    const email = designer.addModelField('email') as string;
    const steps = designer.getState().canUndo;
    const credit = designer.addModelField('credit_limit', { parent: 'section-1', index: 1 }) as string;
    const date = designer.addQuestion('date', { parent: 'section-1', index: 0 }) as string;
    expect(steps).toBe(true);
    expect(nodes(designer.getPage()).map((n) => n.id)).toEqual([date, name, credit, email]);
    designer.undo();
    expect(nodes(designer.getPage()).map((n) => n.id)).toEqual([name, credit, email]);
  });

  it('refuses a field the model does not have, or one already on the page', () => {
    const designer = customer();
    expect(designer.addModelField('nickname')).toBe(false);
    expect(designer.getState().issues).toEqual(['The model has no field "nickname"']);
    designer.addModelField('email');
    expect(designer.addModelField('email')).toBe(false);
    expect(designer.getState().issues).toEqual(['Email is on the page already']);
  });

  it('refuses a field the page defines but the model does not, even off the page', () => {
    const page = blankPage('screen', 'Customer');
    page.fields['nickname'] = { type: 'char', label: 'Nickname' };
    const designer = createDesigner({ page, model });
    expect(designer.addModelField('nickname')).toBe(false);
    expect(designer.getState().issues).toEqual(['The model has no field "nickname"']);
  });

  it('is listed again once it leaves the page', () => {
    const designer = customer();
    const id = designer.addModelField('email') as string;
    designer.removeNode(id);
    expect(designer.modelFields().map((f) => f.name)).toContain('email');
  });

  it('switches a model field only between editors that suit what it holds, keeping its definition', () => {
    const designer = customer();
    const email = designer.addModelField('email') as string;
    expect(designer.kindsFor(email).map((k) => k.id)).toEqual(['short-answer', 'email', 'phone', 'keywords', 'website']);
    expect(designer.changeKind(email, 'email')).toBe(true);
    const page = designer.getPage();
    expect(nodeOf(page, email).widget).toBe('email');
    // The backend's definition is not the designer's to change: no pattern added, nothing else.
    expect(page.fields['email']).toEqual(model['email']);
    expect(kindOfField(page.fields['email'], nodeOf(page, email))).toBe('email');
  });

  it('refuses an editor that would change what a model field holds, saying why', () => {
    const designer = customer();
    const credit = designer.addModelField('credit_limit') as string;
    expect(designer.kindsFor(credit).map((k) => k.id)).toEqual(['amount']);
    expect(designer.changeKind(credit, 'short-answer')).toBe(false);
    expect(designer.getState().issues).toEqual(['Credit limit is stored as an amount in the model, so it can only be shown as Amount']);
    expect(designer.getPage().fields['credit_limit']).toEqual(model['credit_limit']);
  });

  it('offers a whole number every number editor, a decimal only Number or a slider, and a choice the choice editors', () => {
    const designer = customer();
    const visits = designer.addModelField('visits') as string;
    const score = designer.addModelField('score') as string;
    const terms = designer.addModelField('payment_terms') as string;
    expect(designer.kindsFor(visits).map((k) => k.id)).toEqual(['rating', 'scale', 'number', 'slider', 'progress']);
    expect(designer.kindsFor(score).map((k) => k.id)).toEqual(['number', 'slider']);
    // One answer stays one answer: checkboxes would make it many.
    expect(designer.kindsFor(terms).map((k) => k.id)).toEqual(['multiple-choice', 'dropdown', 'image-choice', 'status']);
    expect(designer.changeKind(terms, 'status')).toBe(true);
    expect(designer.getPage().fields['payment_terms']).toEqual(model['payment_terms']);
    expect(nodeOf(designer.getPage(), terms).widget).toBe('statusbar');
    expect(designer.changeKind(terms, 'dropdown')).toBe(true);
    expect(nodeOf(designer.getPage(), terms).widget).toBeUndefined();
  });

  it('lets a field made in the designer become any kind, its data following', () => {
    const designer = customer();
    const made = designer.addQuestion('short-answer') as string;
    const all = designer.kindsFor(made).map((k) => k.id);
    expect(all).toContain('amount');
    expect(all).toContain('link');
    expect(designer.changeKind(made, 'amount')).toBe(true);
    const field = designer.getPage().fields[nodeOf(designer.getPage(), made).field];
    expect(field.type).toBe('monetary');
  });

  it('offers a survey question only what a survey can ask', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('short-answer') as string;
    const kinds = designer.kindsFor(q).map((k) => k.id);
    expect(kinds).toContain('multiple-choice');
    expect(kinds).not.toContain('link');
    expect(kinds).not.toContain('amount');
  });

  it('says which fields came from the model, for the editor to explain itself', () => {
    const designer = customer();
    const credit = designer.addModelField('credit_limit') as string;
    const made = designer.addQuestion('short-answer') as string;
    expect(designer.isFromModel(credit)).toBe(true);
    expect(designer.isFromModel(made)).toBe(false);
    expect(designer.isFromModel('nothing')).toBe(false);
  });

  it('keeps a model field’s label, help and required on the page, leaving the model’s definition alone', () => {
    const designer = customer();
    const email = designer.addModelField('email') as string;
    expect(designer.updateQuestion(email, { label: 'Work email' })).toBe(true);
    expect(designer.updateQuestion(email, { help: 'Where invoices go' })).toBe(true);
    expect(designer.updateQuestion(email, { required: true })).toBe(true);
    const page = designer.getPage();
    expect(nodeOf(page, email)).toMatchObject({ label: 'Work email', help: 'Where invoices go', required: true });
    expect(page.fields['email']).toEqual(model['email']);
    designer.updateQuestion(email, { required: false, help: '' });
    expect(nodeOf(designer.getPage(), email).required).toBeUndefined();
    expect(nodeOf(designer.getPage(), email).help).toBeUndefined();
  });

  it('leaves the options, links and currency of a model field to the model', () => {
    const designer = customer();
    const terms = designer.addModelField('payment_terms') as string;
    expect(designer.setOptions(terms, ['Now', 'Later'])).toBe(false);
    expect(designer.getState().issues).toEqual(['The options of Payment terms come from the model']);
    const tags = designer.addModelField('tag_ids') as string;
    expect(designer.setRelation(tags, 'label')).toBe(false);
    const credit = designer.addModelField('credit_limit') as string;
    expect(designer.setCurrency(credit, 'USD')).toBe(false);
    expect(designer.getState().issues).toEqual(['The currency of Credit limit comes from the model']);
    expect(designer.getPage().fields).toEqual({ payment_terms: model['payment_terms'], tag_ids: model['tag_ids'], credit_limit: model['credit_limit'] });
  });

  it('has no model fields to offer when it was given no model', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Note') });
    expect(designer.modelFields()).toEqual([]);
    expect(designer.addModelField('name')).toBe(false);
  });
});
