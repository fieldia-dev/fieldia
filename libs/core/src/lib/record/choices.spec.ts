import type { Field } from '../format/field';
import type { Page } from '../format/page';
import { FieldSchema } from '../format/field';
import { checkValue } from './check';
import { createForm } from './form';
import { MESSAGES } from './messages';

/** The choices lane: a tick box that must be ticked, "None of these", answers of one's own, and a column once per matrix. */

const F = (field: Record<string, unknown>) => ({ label: 'Rooms', ...field }) as Field;
const rooms = (extra: Record<string, unknown> = {}) =>
  F({ type: 'selection', multiple: true, options: [{ value: 'kitchen', label: 'Kitchen' }, { value: 'gym', label: 'Gym' }, { value: 'none', label: 'None of these', exclusive: true }], ...extra });

function onePage(field: Record<string, unknown>, node: Record<string, unknown> = {}): Page {
  return {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'I agree', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
}

describe('a tick box that must be ticked', () => {
  it('is not answered until it is ticked, when it is required', () => {
    const form = createForm({ page: onePage({ type: 'boolean', required: true }, { widget: 'tick' }) });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ x: 'Tick this box to go on' });
    expect(form.problem('x')).toBe('Tick this box to go on');
    form.setValue('x', true);
    expect(form.validate()).toBe(true);
    form.setValue('x', false);
    expect(form.problem('x')).toBe('Tick this box to go on');
  });

  it('is required where its question says so, and speaks the page’s language', () => {
    const form = createForm({ page: onePage({ type: 'boolean' }, { widget: 'tick', required: true }), messages: MESSAGES.fr });
    expect(form.problem('x')).toBe('Cochez cette case pour continuer');
  });

  it('may stay unticked when it is not required', () => {
    const form = createForm({ page: onePage({ type: 'boolean' }, { widget: 'tick' }) });
    expect(form.validate()).toBe(true);
  });

  it('leaves a yes or no alone: “no” answers it, and only nothing at all is missing', () => {
    const form = createForm({ page: onePage({ type: 'boolean', required: true, default: null }, { widget: 'buttons' }) });
    expect(form.problem('x')).toBe('I agree is required');
    form.setValue('x', false);
    expect(form.problem('x')).toBeNull();
    // A model's yes-or-no box, as backends have it: false is a value.
    const plain = createForm({ page: onePage({ type: 'boolean', required: true }) });
    expect(plain.validate()).toBe(true);
  });
});

describe('“None of these”: an option that goes alone', () => {
  it('is an option flag in the format', () => {
    expect(FieldSchema.safeParse(rooms()).success).toBe(true);
    expect(FieldSchema.safeParse(F({ type: 'selection', options: [{ value: 'a', label: 'A', exclusive: 'yes' }] })).success).toBe(false);
  });

  it('is the widgets’ to keep alone: a record holding it with others is still one of the options', () => {
    expect(checkValue(rooms(), ['none'], false)).toBeUndefined();
    expect(checkValue(rooms(), ['kitchen', 'gym'], false)).toBeUndefined();
  });
});

describe('answers of one’s own, as many as people add', () => {
  it('takes any words besides the options when the field lets people add their own', () => {
    const tags = rooms({ ownAnswers: true });
    expect(FieldSchema.safeParse(tags).success).toBe(true);
    expect(checkValue(tags, ['kitchen', 'Bike rack', 'Showers'], false)).toBeUndefined();
    expect(checkValue(tags, ['kitchen', '  '], false)).toMatch(/^Must be one of/);
    expect(checkValue(rooms(), ['kitchen', 'Bike rack'], false)).toMatch(/^Must be one of/);
  });
});

describe('a matrix that takes each column once', () => {
  const ranks = F({
    type: 'matrix',
    label: 'Rank them',
    rows: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    columns: [{ value: 1, label: 'First' }, { value: 2, label: 'Second' }],
    onePerColumn: true,
  });
  it('is a matrix flag in the format', () => {
    expect(FieldSchema.safeParse(ranks).success).toBe(true);
  });
  it('takes an answer per row as any matrix does', () => {
    expect(checkValue(ranks, { a: 1, b: 2 }, true)).toBeUndefined();
  });
});

describe('the options’ other flags', () => {
  it('keeps a picture’s description and an option held in place', () => {
    expect(FieldSchema.safeParse(F({ type: 'selection', options: [{ value: 'a', label: 'A', image: 'a.png', alt: 'A desk by a window', fixed: true }] })).success).toBe(true);
  });
});
