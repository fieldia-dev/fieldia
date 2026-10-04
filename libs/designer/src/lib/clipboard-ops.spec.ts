import { validatePage, type Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { FIELDIA_PARTS } from './clipboard-ops';
import { renameIn, namesIn } from './clipboard-names';
import { employeeDesigner, expectValid, nodeOf, watched, where } from './test-layout';

/**
 * Copying parts and pasting them, in this designer or another: what is
 * copied carries the parts and their fields' definitions as JSON; a paste
 * goes after the part picked, or into the group picked, as one edit, with
 * ids of its own, each field under its own name unless the page has that
 * name already, and the rules inside reading the pasted fields' names.
 */

const page = (d: { getPage(): Page }) => d.getPage() as Page & { layout: { children: { id: string }[] } };

describe('copyParts', () => {
  it('carries the parts picked, in reading order, and the definitions of their fields', () => {
    const d = employeeDesigner();
    const copied = JSON.parse(d.copyParts(['f-email', 'f-first_name']) as string);
    expect(copied.fieldia).toBe(FIELDIA_PARTS);
    expect(copied.parts.map((p: { id: string }) => p.id)).toEqual(['f-first_name', 'f-email']);
    expect(copied.fields).toEqual({ first_name: page(d).fields['first_name'], email: page(d).fields['email'] });
  });

  it('carries a group with everything in it, and nothing twice', () => {
    const d = employeeDesigner();
    const copied = JSON.parse(d.copyParts(['address', 'f-city']) as string);
    expect(copied.parts.map((p: { id: string }) => p.id)).toEqual(['address']);
    expect(Object.keys(copied.fields)).toEqual(['street', 'city', 'postcode', 'country']);
  });

  it('has nothing to carry for what is not a part of the page', () => {
    expect(employeeDesigner().copyParts([])).toBe(false);
    expect(employeeDesigner().copyParts(['nothing'])).toBe(false);
  });
});

describe('pasteParts', () => {
  it('pastes after the part picked, as one edit, with new ids; a field whose name is taken takes a free one', () => {
    const d = employeeDesigner();
    const text = d.copyParts(['f-city', 'f-postcode']) as string;
    d.select('f-country');
    const pasted = d.pasteParts(text);
    expect(pasted).toMatchObject({ dropped: 0 });
    const ids = (pasted as { ids: string[] }).ids;
    expect(ids).toHaveLength(2);
    expect(ids.some((id) => ['f-city', 'f-postcode'].includes(id))).toBe(false);
    expect(where(d.getPage(), ids[0])?.kids).toEqual(['f-street', 'f-city', 'f-postcode', 'f-country', ...ids]);
    expect(ids.map((id) => nodeOf(d.getPage(), id)?.['field'])).toEqual(['city_2', 'postcode_2']);
    expect(page(d).fields['city_2']).toEqual(page(d).fields['city']);
    expect(d.getState().picked).toEqual(ids);
    d.undo();
    expect(page(d).fields['city_2']).toBeUndefined();
    expectValid(d.getPage());
  });

  it('pastes into the group picked, at its end', () => {
    const d = employeeDesigner();
    const text = d.copyParts(['f-first_name']) as string;
    d.select('emergency');
    const { ids } = d.pasteParts(text) as { ids: string[] };
    expect(where(d.getPage(), ids[0])?.kids).toEqual(['f-ec_name', 'f-ec_relation', 'f-ec_phone', ids[0]]);
  });

  it('pastes at the end of the page when nothing is picked; a group comes with its parts', () => {
    const d = employeeDesigner();
    const text = d.copyParts(['address']) as string;
    d.select(null);
    const { ids } = d.pasteParts(text) as { ids: string[] };
    expect(page(d).layout.children[page(d).layout.children.length - 1].id).toBe(ids[0]);
    expect(nodeOf(d.getPage(), ids[0])?.['title']).toBe('Home address');
    expect(nodeOf(d.getPage(), ids[0])?.children?.map((c) => (c as { field?: string }).field)).toEqual(['street_2', 'city_2', 'postcode_2', 'country_2']);
    expectValid(d.getPage());
  });

  it('keeps a field’s own name where the page has none of it: into another designer', () => {
    const from = employeeDesigner();
    const text = from.copyParts(['f-first_name', 'f-email']) as string;
    const to = watched(createDesigner({ page: blankPage('screen', 'Other') }));
    to.select('section-1');
    const { ids } = to.pasteParts(text) as { ids: string[] };
    expect(ids.map((id) => nodeOf(to.getPage(), id)?.['field'])).toEqual(['first_name', 'email']);
    expect(to.getPage().fields['email']).toEqual(from.getPage().fields['email']);
  });

  it('never takes a name the backend’s model has: the model’s field stays the model’s', () => {
    const from = employeeDesigner();
    const text = from.copyParts(['f-mobile']) as string;
    const to = createDesigner({ page: blankPage('screen', 'Other'), model: { mobile: { type: 'char', label: 'Mobile' } } });
    to.select('section-1');
    const { ids } = to.pasteParts(text) as { ids: string[] };
    expect(nodeOf(to.getPage(), ids[0])?.['field']).toBe('mobile_2');
  });

  it('renames the fields its rules and worked-out values read to the names they were pasted under', () => {
    const d = employeeDesigner();
    d.setCondition('f-end_date', { field: 'contract', equals: 'fixed_term' });
    d.setRule('f-salary', 'required', { field: 'contract', equals: 'permanent' });
    const text = d.copyParts(['f-contract', 'f-end_date', 'f-salary']) as string;
    d.select('f-salary');
    const { ids, dropped } = d.pasteParts(text) as { ids: string[]; dropped: number };
    expect(dropped).toBe(0);
    const [, end, salary] = ids.map((id) => nodeOf(d.getPage(), id) as Record<string, unknown>);
    expect(end['invisible']).toBe(nodeOf(d.getPage(), 'f-end_date')?.['invisible']?.toString().replace(/\bcontract\b/g, 'contract_2'));
    expect(salary['required']).toContain('contract_2');
    expectValid(d.getPage());
  });

  it('leaves off a rule that reads a field the page it lands on has not got, and says how many', () => {
    const d = employeeDesigner();
    d.setCondition('f-end_date', { field: 'contract', equals: 'fixed_term' });
    const text = d.copyParts(['f-end_date']) as string;
    const to = watched(createDesigner({ page: blankPage('screen', 'Other') }));
    to.select('section-1');
    const { ids, dropped } = to.pasteParts(text) as { ids: string[]; dropped: number };
    expect(dropped).toBe(1);
    expect(nodeOf(to.getPage(), ids[0])?.['invisible']).toBeUndefined();
  });

  it('a survey’s questions go on a page; its pages go among the pages', () => {
    const d = watched(createDesigner({ page: blankPage('survey', 'Feedback') }));
    const q = d.addQuestion('short-answer') as string;
    d.updateQuestion(q, { label: 'Name' });
    const two = d.addContainer('Page 2') as string;
    const question = d.copyParts([q]) as string;
    d.select(two);
    const { ids } = d.pasteParts(question) as { ids: string[] };
    expect(where(d.getPage(), ids[0])?.parent).toBe(two);
    const pageCopy = d.copyParts(['step-1']) as string;
    d.select(ids[0]);
    const pages = d.pasteParts(pageCopy) as { ids: string[] };
    expect(page(d).layout.children.map((s) => s.id)).toEqual(['step-1', two, pages.ids[0]]);
    expect(validatePage(d.getPage()).ok).toBe(true);
  });

  it('pastes nothing from words that are not Fieldia’s, and says so', () => {
    const d = employeeDesigner();
    const before = d.getPage();
    expect(d.pasteParts('Hello there')).toBe(false);
    expect(d.pasteParts('{"some":"json"}')).toBe(false);
    expect(d.getState().issues).toEqual(['There are no Fieldia parts to paste: copy parts in a Fieldia designer first']);
    expect(d.getPage()).toBe(before);
  });

  it('a tab is pasted among tabs, after the tab picked', () => {
    const d = employeeDesigner();
    const text = d.copyParts(['tab-pay']) as string;
    d.select('tab-job');
    const { ids } = d.pasteParts(text) as { ids: string[] };
    expect(where(d.getPage(), ids[0])?.kids).toEqual(['tab-job', ids[0], 'tab-docs', 'tab-pay']);
    d.select('f-city');
    expect(d.pasteParts(text)).toBe(false);
    expect(d.getState().issues).toEqual(['A tab goes among tabs: pick a tab to paste it after']);
  });
});

describe('the names in rules and worked-out values', () => {
  it('finds the fields an expression reads, not its words, functions or strings', () => {
    expect([...namesIn("contract == 'fixed_term' and not (salary > 0 or len(notes) in [1, 2])")]).toEqual(['contract', 'salary', 'notes']);
    expect([...namesIn('partner_id.country_id == 3')]).toEqual(['partner_id']);
  });

  it('renames them, and only them', () => {
    const names = new Map([['contract', 'contract_2'], ['notes', 'notes_9']]);
    expect(renameIn("contract == 'contract' and len(notes) > contract_count", names)).toBe("contract_2 == 'contract' and len(notes_9) > contract_count");
    expect(renameIn('notes.length', names)).toBe('notes_9.length');
  });
});
