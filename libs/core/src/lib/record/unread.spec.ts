import type { Page } from '../format/page';
import { createForm } from './form';
import { MESSAGES } from './messages';
import type { Line } from './values';

/** A page with a few number fields and a table of lines, as the input rules meet them. */
function page(extra: Partial<Page> = {}): Page {
  return {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: {
      seats: { type: 'integer', label: 'Workstations', min: 1, required: true },
      area: { type: 'float', label: 'Floor area', digits: [10, 1] },
      email: { type: 'char', label: 'Email' },
      progress: { type: 'integer', label: 'Progress' },
      show: { type: 'boolean', label: 'Show' },
      hidden: { type: 'float', label: 'Hidden' },
      lines: { type: 'one2many', label: 'Lines', relation: 'l', fields: { qty: { type: 'integer', label: 'Quantity', min: 0 }, note: { type: 'char', label: 'Note' } } },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'n-seats', field: 'seats' },
        { type: 'field', id: 'n-area', field: 'area' },
        { type: 'field', id: 'n-email', field: 'email', widget: 'email' },
        { type: 'field', id: 'n-progress', field: 'progress', widget: 'progressbar', options: { editable: true } },
        { type: 'field', id: 'n-show', field: 'show' },
        { type: 'field', id: 'n-hidden', field: 'hidden', invisible: 'not show' },
        { type: 'field', id: 'n-lines', field: 'lines' },
      ],
    },
    ...extra,
  } as Page;
}

const ask = { text: '12 34', message: 'Workstations: “12 34” is not a number' };

describe('text left in a box that does not read', () => {
  it('is kept with its reason, and the field keeps its value', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 5);
    form.setUnread('seats', ask);
    expect(form.getState().unread).toEqual({ seats: ask });
    expect(form.getState().values['seats']).toBe(5);
    // Nothing is said until the box is left, or the form is checked.
    expect(form.getState().errors).toEqual({});
  });

  it('refuses to validate and to save until it is fixed, in its own words', async () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 5);
    form.setUnread('seats', ask);
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['seats']).toBe(ask.message);
    expect(form.problem('seats')).toBe(ask.message);
    expect(await form.save()).toBe(false);
    form.setUnread('seats', null);
    expect(form.getState().errors['seats']).toBeUndefined();
    expect(form.validate()).toBe(true);
  });

  it('goes once the field is written another way: a value that reads, or the app’s', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 5);
    form.setUnread('seats', ask);
    form.setValue('seats', 7);
    expect(form.getState().unread).toEqual({});
    form.setUnread('seats', ask);
    form.reset();
    expect(form.getState().unread).toEqual({});
  });

  it('takes its words with it when it goes, once they are on screen', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 5);
    form.setUnread('seats', ask);
    form.leave('seats');
    expect(form.getState().errors['seats']).toBe(ask.message);
    form.setValues({ seats: 9 });
    expect(form.getState().unread).toEqual({});
    expect(form.getState().errors['seats']).toBeUndefined();
  });

  it('stays while other fields change', () => {
    const form = createForm({ page: page() });
    form.setUnread('seats', ask);
    form.setValue('area', 2);
    expect(form.getState().unread).toEqual({ seats: ask });
  });

  it('answers only while its field is shown', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 1);
    form.setUnread('hidden', { text: 'x', message: 'Hidden: “x” is not a number' });
    expect(form.validate()).toBe(true);
    form.setValue('show', true);
    expect(form.validate()).toBe(false);
  });

  it('is kept for a line’s cell by its path, and goes with its line', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 1);
    const key = form.addLine('lines', { qty: 2 });
    const path = `lines.${key}.qty`;
    form.setUnread(path, { text: '1 2', message: 'Quantity: “1 2” is not a number' });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors[path]).toBe('Quantity: “1 2” is not a number');
    // Another cell of the line changing leaves it be.
    form.updateLine('lines', key, 'note', 'Hi');
    expect(form.getState().unread[path]).toBeDefined();
    form.removeLine('lines', key);
    expect(form.getState().unread).toEqual({});
  });

  it('refuses a path that names no field', () => {
    const form = createForm({ page: page() });
    expect(() => form.setUnread('nope', ask)).toThrow(/no field "nope"/);
    expect(() => form.setUnread('seats.x.y', ask)).toThrow(/not a one2many/);
  });
});

describe('leaving a box', () => {
  it('says a field’s own problem at once: min, a whole number, decimals, a format', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 0);
    form.leave('seats');
    expect(form.getState().errors).toEqual({ seats: 'Workstations must be at least 1' });
    form.setValue('seats', 1.5);
    expect(form.getState().errors).toEqual({ seats: 'Workstations must be a whole number' });
    form.setValue('area', 12.34);
    form.leave('area');
    expect(form.getState().errors['area']).toBe('Floor area takes at most 1 decimal place');
    form.setValue('email', 'sara@');
    form.leave('email');
    expect(form.getState().errors['email']).toBe('Enter an email address, like name@example.com');
  });

  it('never says a field is required: that waits for Save', () => {
    const form = createForm({ page: page() });
    form.leave('seats');
    expect(form.getState().errors).toEqual({});
  });

  it('says unread text in its own words, and they go once it is fixed', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 3);
    form.setUnread('seats', ask);
    form.leave('seats');
    expect(form.getState().errors).toEqual({ seats: ask.message });
    form.setUnread('seats', null);
    expect(form.getState().errors).toEqual({});
  });

  it('keeps what it said current as the value is put right', () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 0);
    form.leave('seats');
    form.setValue('seats', 4);
    expect(form.getState().errors).toEqual({});
  });

  it('says a line cell’s problem by its path', () => {
    const form = createForm({ page: page() });
    const key = form.addLine('lines', { qty: -1 });
    form.leave(`lines.${key}.qty`);
    expect(form.getState().errors).toEqual({ [`lines.${key}.qty`]: 'Quantity must be at least 0' });
    expect(((form.getState().values['lines'] as Line[])[0]).values['qty']).toBe(-1);
  });

  it('says nothing of a field that is not shown', () => {
    const form = createForm({ page: page() });
    form.setValue('hidden', Number.NaN);
    form.leave('hidden');
    expect(form.getState().errors).toEqual({});
  });

  it('speaks the page’s language', () => {
    const form = createForm({ page: page(), messages: MESSAGES.ar });
    form.setValue('area', 1.25);
    form.leave('area');
    expect(form.getState().errors['area']).toBe('Floor area: منزلة عشرية واحدة على الأكثر');
  });
});

describe('an editable progress bar', () => {
  it('keeps to its own range, 0 to 100 unless the page says, said on leaving and at Save', async () => {
    const form = createForm({ page: page() });
    form.setValue('seats', 1);
    form.setValue('progress', 150);
    form.leave('progress');
    expect(form.getState().errors['progress']).toBe('Progress must be at most 100');
    form.setValue('progress', -20);
    expect(form.getState().errors['progress']).toBe('Progress must be at least 0');
    expect(await form.save()).toBe(false);
    form.setValue('progress', 80);
    expect(form.validate()).toBe(true);
  });

  it('takes the range its options give', () => {
    const custom = page();
    (custom.layout as { children: { id: string; options?: object }[] }).children[3].options = { editable: true, min: 10, max: 200 };
    const form = createForm({ page: custom });
    form.setValue('seats', 1);
    form.setValue('progress', 150);
    expect(form.validate()).toBe(true);
    form.setValue('progress', 5);
    expect(form.problem('progress')).toBe('Progress must be at least 10');
  });
});
