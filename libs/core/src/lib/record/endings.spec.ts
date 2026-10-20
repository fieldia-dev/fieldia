import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { SubmitResult } from './data-source';

/** A clinic's feedback: the branch visited, a rating asked of it by name, and a name to thank. */
const feedback = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.5',
  id: 'feedback',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name' },
    branch: {
      type: 'selection',
      label: 'Which branch did you visit?',
      options: [
        { value: 'zamalek', label: 'Zamalek' },
        { value: 'maadi', label: 'Maadi' },
      ],
    },
    overall: { type: 'integer', label: 'How was your visit to {branch}?', required: true },
    contact: { type: 'selection', label: 'Should {branch} call you?', options: [{ value: 'yes', label: 'Yes, call me at {branch}' }, { value: 'no', label: 'No' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-branch', field: 'branch' },
      { type: 'field', id: 'f-overall', field: 'overall' },
      { type: 'field', id: 'f-contact', field: 'contact' },
    ],
  },
  ...more,
});

const ENDINGS: Page['endings'] = [
  { when: 'overall <= 2', title: 'We are sorry, {name}', text: '{branch} will call you today.' },
  { when: "id == 'VIP-1'", title: 'Welcome back' },
  { title: 'Thank you, {name}', text: 'Your reference is {id}.' },
];

describe('endings: what a page of responses shows once it is sent', () => {
  it('keeps what the source answered — the id it gave, the values it added — over the answers as sent', async () => {
    const ds = createMemoryDataSource({ submitted: (request, count) => ({ id: `B-${1042 + count}`, values: { name: `${request.values['name']} A.` } }) });
    const form = createForm({ page: feedback(), dataSource: ds });
    expect(form.getState().sent).toBeNull();
    form.setValues({ name: 'Mona', branch: 'maadi', overall: 5 });
    expect(await form.save()).toBe(true);
    expect(form.getState().sent).toEqual({ id: 'B-1043', values: { name: 'Mona A.', branch: 'maadi', overall: 5, contact: null } });
    // The answers themselves are as they were sent.
    expect(form.getState().values['name']).toBe('Mona');
    expect(ds.responses[0].values['name']).toBe('Mona');
  });

  it('shows none on a page without endings, and the viewer says its own thanks', async () => {
    const form = createForm({ page: feedback(), dataSource: createMemoryDataSource() });
    form.setValues({ overall: 4 });
    await form.save();
    expect(form.getState().sent?.id).toBe(1);
    expect(form.ending()).toBeNull();
  });

  it('picks the first ending whose condition holds on the answers sent, else the default', async () => {
    const ds = createMemoryDataSource();
    const form = createForm({ page: feedback({ endings: ENDINGS }), dataSource: ds });
    expect(form.ending()).toBeNull();
    form.setValues({ name: 'Mona', branch: 'zamalek', overall: 2 });
    await form.save();
    expect(form.ending()?.title).toBe('We are sorry, {name}');
    expect(form.endingWords('{branch} will call you today.')).toBe('Zamalek will call you today.');
    form.reset();
    expect(form.getState().sent).toBeNull();
    expect(form.ending()).toBeNull();
    form.setValues({ name: 'Sara', overall: 5 });
    await form.save();
    expect(form.ending()?.title).toBe('Thank you, {name}');
    expect(form.endingWords('Thank you, {name}. Your reference is {id}.')).toBe('Thank you, Sara. Your reference is 2.');
  });

  it('reads the response’s id and the values the source added in its conditions', async () => {
    const answers: SubmitResult[] = [{ id: 'VIP-1' }, { id: 7, values: { overall: 1 } }];
    const ds = createMemoryDataSource({ submitted: () => answers.shift() as SubmitResult });
    const form = createForm({ page: feedback({ endings: ENDINGS }), dataSource: ds });
    form.setValues({ overall: 5 });
    await form.save();
    expect(form.ending()?.title).toBe('Welcome back');
    form.reset();
    form.setValues({ overall: 5 });
    await form.save();
    // The source rated it 1 as it kept it: the ending reads what it kept.
    expect(form.ending()?.title).toBe('We are sorry, {name}');
  });

  it('shows none where none holds and the page gives no default', async () => {
    const form = createForm({ page: feedback({ endings: [{ when: 'overall <= 2', title: 'Sorry' }] }), dataSource: createMemoryDataSource() });
    form.setValues({ overall: 5 });
    await form.save();
    expect(form.ending()).toBeNull();
  });

  it('takes a source that answers nothing as one that gave no id', async () => {
    const ds = createMemoryDataSource();
    ds.submit = async () => undefined as unknown as SubmitResult;
    const form = createForm({ page: feedback({ endings: ENDINGS }), dataSource: ds });
    form.setValues({ name: 'Mona', overall: 4 });
    expect(await form.save()).toBe(true);
    expect(form.getState().sent).toEqual({ id: null, values: expect.objectContaining({ name: 'Mona' }) });
    expect(form.endingWords('Reference: {id}')).toBe('Reference: ');
  });

  it('lays no answer over a response started again while it was on its way', async () => {
    const ds = createMemoryDataSource({ delayMs: 20 });
    const form = createForm({ page: feedback({ endings: ENDINGS }), dataSource: ds });
    form.setValues({ overall: 5 });
    const saving = form.save();
    // Sent, its answer still to come: the app starts a new response.
    while (!ds.calls.some((call) => call.method === 'submit')) await new Promise((resolve) => setTimeout(resolve, 1));
    form.reset();
    await saving;
    expect(ds.responses[0].values['overall']).toBe(5);
    expect(form.getState().sent).toBeNull();
    expect(form.ending()).toBeNull();
  });

  it('says a page field named id before the response’s id', async () => {
    const page = feedback({ endings: [{ title: 'Ticket {id}' }] });
    const layout = page.layout as Extract<Page['layout'], { type: 'sections' }>;
    const own = { ...page, fields: { ...page.fields, id: { type: 'char', label: 'Ticket' } }, layout: { ...layout, children: [...layout.children, { type: 'field', id: 'f-id', field: 'id' }] } } as Page;
    const form = createForm({ page: own, dataSource: createMemoryDataSource({ submitted: () => ({ id: 99 }) }) });
    form.setValues({ id: 'T-5', overall: 3 });
    await form.save();
    expect(form.endingWords('Ticket {id}')).toBe('Ticket T-5');
  });
});

describe('{field} words in a page’s own words', () => {
  it('fill each field’s value as the form holds it now: a choice by its label, nothing where it is empty', () => {
    const form = createForm({ page: feedback() });
    expect(form.words('How was your visit to {branch}?')).toBe('How was your visit to ?');
    form.setValue('branch', 'zamalek');
    expect(form.words('How was your visit to {branch}?')).toBe('How was your visit to Zamalek?');
    expect(form.words('No braces')).toBe('No braces');
    expect(form.words('{nothing} here')).toBe(' here');
  });

  it('are written by the app’s valueWords when it gives one, as its viewer shows each value', () => {
    const form = createForm({ page: feedback(), valueWords: (def, value) => `«${def.type}:${String(value)}»` });
    form.setValue('branch', 'maadi');
    expect(form.words('At {branch}')).toBe('At «selection:maadi»');
  });

  it('name the field in the form’s messages as the page shows its label', async () => {
    const form = createForm({ page: feedback(), dataSource: createMemoryDataSource() });
    form.setValue('branch', 'zamalek');
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['overall']).toBe('How was your visit to Zamalek? is required');
  });

  it('name a choice in the form’s messages as the page shows it', () => {
    const form = createForm({ page: feedback() });
    form.setValues({ branch: 'maadi', contact: 'later' as never, overall: 3 });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['contact']).toContain('Yes, call me at Maadi');
  });
});
