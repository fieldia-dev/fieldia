import type { FieldNode, Page, SectionNode, WizardNode } from '@fieldia/core';
import type { AppKind } from './app-kinds';
import { blankPage, createDesigner, kindOfField, pageChanges } from './designer';
import { kindById } from './kinds';

/** An app's own kind of field, as an app registers it: an IBAN, kept as text, drawn by the app's widget. */
const iban: AppKind = {
  id: 'iban',
  label: 'IBAN',
  icon: '<rect x="3" y="6" width="18" height="12" rx="2"/>',
  field: (label) => ({ type: 'char', label, pattern: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' }),
};

const nodesOf = (page: Page): FieldNode[] =>
  ((page.layout as WizardNode | { children: SectionNode[] }).children as { children: FieldNode[] }[]).flatMap((c) => c.children);
const nodeOf = (page: Page, id: string) => nodesOf(page).find((n) => n.id === id) as FieldNode;

describe('an app adds its own kinds', () => {
  it('adds a question of the app’s kind, drawn by a widget named after it', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Payout'), kinds: [iban] });
    const id = designer.addQuestion('iban') as string;
    expect(id).toBeTruthy();
    const page = designer.getPage();
    const node = nodeOf(page, id);
    expect(node.widget).toBe('iban');
    expect(page.fields[node.field]).toEqual({ type: 'char', label: 'Untitled question', pattern: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' });
    // Known again from the field, as a built-in kind is.
    expect(kindOfField(page.fields[node.field], node)).toBe('iban');
    expect(kindById('iban').label).toBe('IBAN');
    expect(designer.appKinds().map((k) => k.id)).toEqual(['iban']);
  });

  it('draws with the widget it names, and is known by it', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Member'), kinds: [{ id: 'member-no', label: 'Member number', widget: 'member', field: (label) => ({ type: 'char', label }) }] });
    const id = designer.addQuestion('member-no') as string;
    const page = designer.getPage();
    const node = nodeOf(page, id);
    expect(node.widget).toBe('member');
    expect(kindOfField(page.fields[node.field], node)).toBe('member-no');
    // The same widget on another type is not the app's kind.
    expect(kindOfField({ type: 'integer', label: 'N' }, { ...node, widget: 'member' })).toBe('number');
    // Text without the widget is a short answer, as before.
    expect(kindOfField(page.fields[node.field], { ...node, widget: undefined })).toBe('short-answer');
  });

  it('refuses a kind whose id is one of Fieldia’s', () => {
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [{ ...iban, id: 'email' }] })).toThrow('The kind “email” is one of Fieldia’s own: give the app’s kind an id of its own');
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [{ ...iban, id: 'lines' }] })).toThrow('“lines”');
  });

  it('refuses two kinds of one id, or two drawn by one widget, which could not be told apart', () => {
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [iban, { ...iban, label: 'Other' }] })).toThrow('Two of the app’s kinds have the id “iban”');
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [iban, { ...iban, id: 'iban-2', widget: 'iban' }] })).toThrow('“iban” and “iban-2” are both drawn by the widget “iban”: give each a widget of its own');
  });

  it('refuses a kind drawn by a widget one of Fieldia’s kinds uses, which would be read back as that kind', () => {
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [{ id: 'stars', label: 'Stars', widget: 'rating', field: (label) => ({ type: 'integer', label, min: 1, max: 10 }) }] })).toThrow(
      'The kind “stars” is drawn by “rating”, as Fieldia’s Rating is: give it a widget of its own'
    );
  });

  it('refuses a kind without an id, a label or a field', () => {
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [{ ...iban, id: ' ' }] })).toThrow('An app’s kind needs an id, a label and a field');
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [{ ...iban, label: '' }] })).toThrow('An app’s kind needs an id, a label and a field');
    expect(() => createDesigner({ page: blankPage('survey', 'S'), kinds: [{ ...iban, field: undefined as unknown as AppKind['field'] }] })).toThrow('An app’s kind needs an id, a label and a field');
  });

  it('is offered in “Shown as”: for a field of the page always, for one of the model where it fits', () => {
    const model = { account: { type: 'char', label: 'Account' }, visits: { type: 'integer', label: 'Visits' } } as const;
    const designer = createDesigner({ page: blankPage('screen', 'Customer'), model, kinds: [iban] });
    const own = designer.addQuestion('number') as string;
    const account = designer.addModelField('account') as string;
    const visits = designer.addModelField('visits') as string;
    expect(designer.kindsFor(own).map((k) => k.id)).toContain('iban');
    expect(designer.kindsFor(account).map((k) => k.id)).toContain('iban');
    expect(designer.kindsFor(visits).map((k) => k.id)).not.toContain('iban');
    // Shown as the app's kind, a field of the model keeps what it holds and only changes widget.
    expect(designer.changeKind(account, 'iban')).toBe(true);
    const page = designer.getPage();
    expect(nodeOf(page, account).widget).toBe('iban');
    expect(page.fields['account']).toEqual({ type: 'char', label: 'Account' });
    expect(designer.changeKind(visits, 'iban')).toBe(false);
    expect(designer.getState().issues[0]).toContain('can only be shown as');
  });

  it('fits only where the app says, when it says', () => {
    const narrow: AppKind = { ...iban, fits: (field) => field.type === 'char' && /iban|account/i.test(field.label) };
    const model = { account: { type: 'char', label: 'Account' }, email: { type: 'char', label: 'Email' } } as const;
    const designer = createDesigner({ page: blankPage('screen', 'Customer'), model, kinds: [narrow] });
    const account = designer.addModelField('account') as string;
    const email = designer.addModelField('email') as string;
    expect(designer.kindsFor(account).map((k) => k.id)).toContain('iban');
    expect(designer.kindsFor(email).map((k) => k.id)).not.toContain('iban');
  });

  it('turns a question into the app’s kind and back, in the Publish list’s words', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Payout'), kinds: [iban] });
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: 'Your account' });
    const before = designer.getPage();
    expect(designer.changeKind(id, 'iban')).toBe(true);
    expect(pageChanges(before, designer.getPage())).toEqual(['“Your account” is now IBAN']);
    expect(designer.changeKind(id, 'short-answer')).toBe(true);
    expect(nodeOf(designer.getPage(), id).widget).toBeUndefined();
    expect(pageChanges(before, designer.getPage())).toEqual([]);
  });

  it('is the designer’s own: one not given it neither offers nor adds it', () => {
    createDesigner({ page: blankPage('survey', 'A'), kinds: [iban] });
    const other = createDesigner({ page: blankPage('survey', 'B') });
    const id = other.addQuestion('short-answer') as string;
    expect(other.kindsFor(id).map((k) => k.id)).not.toContain('iban');
    expect(other.appKinds()).toEqual([]);
    expect(() => other.addQuestion('iban')).toThrow('Unknown question kind "iban"');
  });

  it('sits in a survey as well as on a screen', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Payout'), kinds: [iban] });
    expect(designer.addQuestion('iban')).toBeTruthy();
    expect(designer.getState().issues).toEqual([]);
  });
});
