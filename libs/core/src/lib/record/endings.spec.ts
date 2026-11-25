import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { pageWarnings, validatePage } from '../format/validate';
import { FORMAT_VERSION } from '../format/version';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { SubmitResult } from './data-source';

/** A clinic's feedback: the branch visited, a rating asked of it by name, and a name to thank. */
const feedback = (more: Partial<Page> = {}): Page => ({
  fieldia: FORMAT_VERSION,
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

  it('say the page’s words while an answer is empty, after a bar, and the answer once given', () => {
    const form = createForm({ page: feedback() });
    expect(form.words('How was your visit to {branch|this branch}?')).toBe('How was your visit to this branch?');
    expect(form.words('{branch|}{name|you}')).toBe('you');
    form.setValues({ branch: 'maadi', name: 'Mona' });
    expect(form.words('How was your visit to {branch|this branch}, {name|you}?')).toBe('How was your visit to Maadi, Mona?');
  });

  it('name an empty answer by its words while empty in the form’s messages', async () => {
    const page = feedback();
    page.fields['overall'] = { ...page.fields['overall'], label: 'How was your visit to {branch|this branch}?' } as Page['fields'][string];
    const form = createForm({ page, dataSource: createMemoryDataSource() });
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['overall']).toBe('Please answer “How was your visit to this branch?”');
  });

  it('say an ending’s reference’s words while the source gave none', async () => {
    const ds = createMemoryDataSource();
    ds.submit = async () => ({});
    const form = createForm({ page: feedback({ endings: [{ title: 'Thanks' }] }), dataSource: ds });
    form.setValues({ overall: 4 });
    await form.save();
    expect(form.endingWords('Your reference: {id|on its way by email}')).toBe('Your reference: on its way by email');
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
    expect(form.getState().errors['overall']).toBe('Please answer “How was your visit to Zamalek?”');
  });

  it('name a choice in the form’s messages as the page shows it', () => {
    const form = createForm({ page: feedback() });
    form.setValues({ branch: 'maadi', contact: 'later' as never, overall: 3 });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['contact']).toContain('Yes, call me at Maadi');
  });
});

describe('endings and {field} words with the functions, Fieldia’s and the app’s own', () => {
  /** The feedback with a name worked out in capitals, and endings chosen by functions. */
  const shouted = (endings: Page['endings']) => {
    const page = feedback({ endings });
    const layout = page.layout as Extract<Page['layout'], { type: 'sections' }>;
    return { ...page, fields: { ...page.fields, shout: { type: 'char', label: 'Name', compute: 'upper(name)' } }, layout: { ...layout, children: [...layout.children, { type: 'field', id: 'f-shout', field: 'shout' }] } } as Page;
  };

  it('choose an ending by a condition calling the new functions and the app’s own', async () => {
    const endings: Page['endings'] = [
      { when: "startsWith(lower(name), 'dr')", title: 'Thank you, doctor' },
      { when: 'vip(name)', title: 'Welcome back, {shout}' },
      { title: 'Thank you' },
    ];
    const form = createForm({ page: shouted(endings), dataSource: createMemoryDataSource(), functions: { vip: (name: unknown) => name === 'Mona' } });
    form.setValues({ name: 'Dr Hana', overall: 4 });
    await form.save();
    expect(form.ending()?.title).toBe('Thank you, doctor');
    form.reset();
    form.setValues({ name: 'Mona', overall: 4 });
    await form.save();
    expect(form.ending()?.title).toBe('Welcome back, {shout}');
    // A {field} whose value the functions work out reads it as worked out.
    expect(form.endingWords('Welcome back, {shout}')).toBe('Welcome back, MONA');
    expect(form.words('{shout|you}, how was {branch|your branch}?')).toBe('MONA, how was your branch?');
  });

  it('are checked as the page is read: a function no one gives refused in an ending, as anywhere', () => {
    const result = checkPage(shouted([{ when: 'vip(name)', title: 'Welcome back' }, { title: 'Thanks' }]));
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual(['endings[0].when']);
  });

  it('say an option’s words with an answer as they read now when a condition takes it out', () => {
    const page = feedback();
    const contact = page.fields['contact'] as Extract<Page['fields'][string], { type: 'selection' }>;
    const ruled = { ...page, fields: { ...page.fields, contact: { ...contact, options: [{ value: 'yes', label: 'Yes, call me at {branch}', invisible: 'overall >= 4' }, { value: 'no', label: 'No' }] } } } as Page;
    const form = createForm({ page: ruled });
    form.setValues({ branch: 'zamalek', overall: 2 });
    form.setValue('contact', 'yes');
    form.setValue('overall', 5);
    expect(form.getState().values['contact']).toBeNull();
    expect(form.getState().takenOut['contact']).toBe('Yes, call me at Zamalek is no longer offered, so it was taken out');
  });
});

describe('a page’s checks in one place: endings’ words and the kinds functions take', () => {
  const page = (endings: Page['endings'], label = 'How was your visit to {branch}?') => {
    const base = feedback({ endings });
    return { ...base, fields: { ...base.fields, overall: { ...base.fields['overall'], label } } } as Page;
  };

  it('refuse a {name} naming no field — in an ending or a label — in validatePage and checkPage alike', () => {
    for (const check of [validatePage, checkPage]) {
      const ending = check(page([{ title: 'Thanks, {nmae}' }]));
      expect(ending.ok ? [] : ending.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['endings[0].title: no field "nmae"']);
      const label = check(page(undefined, 'How was {brnch}?'));
      expect(label.ok ? [] : label.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['fields.overall.label: no field "brnch"']);
    }
  });

  it('warn of a value of a kind a function does not take in an ending’s condition, beside the page, never refusing it', () => {
    const warned = page([{ when: 'age(name) > 2', title: 'Welcome back' }, { title: 'Thanks' }]);
    const checked = validatePage(warned);
    expect(checked.ok).toBe(true);
    expect(checked.warnings?.map((warning) => warning.path)).toEqual(['endings[0].when']);
    expect(pageWarnings(warned).map((warning) => warning.path)).toEqual(['endings[0].when']);
    // Where a page is shown, nothing is warned: the check that refuses is the same.
    expect(checkPage(warned)).toEqual({ ok: true, page: warned });
  });
});
