import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { checkValue, fileProblem } from './check';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES } from './messages';

/**
 * The input rules for dates, times and choices (0.21), as the form checks
 * them: a time between its steps, stars past the points they draw, a range's
 * end as a field of its own, a file judged by its name when it has no type,
 * and a search that finds Arabic words however their letters are written.
 */

/** One question on a page of its own, as the form checks it. */
function ask(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: keyof typeof MESSAGES = 'en') {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Arrival', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page, messages: MESSAGES[locale] });
  return (value: unknown) => {
    form.setValue('x', value as never);
    return form.problem('x');
  };
}

describe('a time of day in steps', () => {
  const time = ask({ type: 'char' }, { widget: 'time', options: { min: '07:00', max: '11:00', step: 15 } });

  it('takes a time on a step, counted from its earliest', () => {
    for (const ok of ['07:00', '07:15', '09:45', '11:00']) expect({ ok, says: time(ok) }).toEqual({ ok, says: null });
  });

  it('says a time between its steps, with the two steps either side', () => {
    expect(time('07:10')).toBe('Arrival: times go in steps of 15 minutes, like 07:00 or 07:15');
    expect(time('09:59')).toBe('Arrival: times go in steps of 15 minutes, like 09:45 or 10:00');
  });

  it('counts the steps from midnight when it has no earliest, in the page’s language', () => {
    const half = ask({ type: 'char' }, { widget: 'time', options: { step: 30 } }, 'fr');
    expect(half('08:30')).toBeNull();
    expect(half('08:20')).toBe('Arrival : les heures vont par pas de 30 minutes, par exemple 08:00 ou 08:30');
    expect(ask({ type: 'char' }, { widget: 'time', options: { step: 30 } }, 'ar')('23:50')).toBe('Arrival: اختر وقتًا من الخطوات المتاحة، مثل 23:30 أو 23:00');
  });
});

describe('stars and a scale', () => {
  it('say a value past the points they draw, the widget’s own 1 to 5 and 0 to 10 when the field has none', () => {
    const stars = ask({ type: 'integer' }, { widget: 'rating' });
    expect(stars(5)).toBeNull();
    expect(stars(9)).toBe('Arrival must be at most 5');
    expect(stars(0)).toBe('Arrival must be at least 1');
    const scale = ask({ type: 'integer' }, { widget: 'scale' });
    expect(scale(0)).toBeNull();
    expect(scale(11)).toBe('Arrival must be at most 10');
  });

  it('keep to the field’s own range when it has one', () => {
    const scale = ask({ type: 'integer', min: 1, max: 7 }, { widget: 'scale' });
    expect(scale(7)).toBeNull();
    expect(scale(9)).toBe('Arrival must be at most 7');
  });
});

describe('a range’s end', () => {
  function range(end: Record<string, unknown> = {}, type: 'date' | 'datetime' = 'date', required = false) {
    const page = {
      fieldia: '0.1',
      id: 'stay',
      data: { kind: 'responses' },
      fields: { from_day: { type, label: 'From' }, to_day: { type, label: 'To', ...end } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-days', field: 'from_day', widget: 'daterange', options: { endField: 'to_day' }, ...(required ? { required: true } : {}) }] },
    } as Page;
    return createForm({ page, now: () => new Date(2026, 9, 13, 12) });
  }

  it('can’t be before its start, said as either box is left', () => {
    const form = range();
    form.setValue('from_day', '2026-11-10');
    form.setValue('to_day', '2026-10-20');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ to_day: 'To can’t be before From' });
    form.reset();
    form.setValue('from_day', '2026-11-10');
    form.setValue('to_day', '2026-10-20');
    form.boxLeft('to_day');
    expect(form.getState().errors).toEqual({ to_day: 'To can’t be before From' });
    form.setValue('to_day', '2026-11-12');
    expect(form.getState().errors).toEqual({});
  });

  it('compares a date and time by its instant', () => {
    const form = range({}, 'datetime');
    form.setValue('from_day', '2026-10-13T08:30:00.000Z');
    form.setValue('to_day', '2026-10-12T11:00:00.000Z');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['to_day']).toBe('To can’t be before From');
    form.setValue('to_day', '2026-10-13T09:00:00.000Z');
    expect(form.validate()).toBe(true);
  });

  it('is required as its field is, or as the range is, and only at Save', () => {
    const form = range({ required: true });
    form.setValue('from_day', '2026-10-14');
    form.boxLeft('to_day');
    expect(form.getState().errors).toEqual({});
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ to_day: 'To is required' });
    const whole = range({}, 'date', true);
    whole.setValue('from_day', '2026-10-14');
    expect(whole.validate()).toBe(false);
    expect(whole.getState().errors).toEqual({ to_day: 'To is required' });
  });

  it('keeps its own earliest, latest and days of the week', () => {
    const form = range({ min: '2026-10-01', days: [7, 1, 2, 3, 4] });
    form.setValue('from_day', '2026-09-20');
    form.setValue('to_day', '2026-10-17');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['to_day']).toBe('To can’t be on a Friday or Saturday');
    form.setValue('to_day', '2026-09-28');
    expect(form.getState().errors['to_day']).toBe('To can’t be before October 1, 2026');
  });

  it('keeps unread text typed in its box, and Save refuses with it', () => {
    const form = range();
    form.setValue('from_day', '2026-10-14');
    form.setUnread('to_day', { text: '31/02/2026', message: 'To: February 2026 has 28 days' });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ to_day: 'To: February 2026 has 28 days' });
  });
});

describe('a file with no media type', () => {
  const pdf = { type: 'binary', label: 'Contract', accept: ['application/pdf'] } as Field & { type: 'binary' };

  it('is judged by its name’s extension, in any case', () => {
    expect(fileProblem(pdf, { name: 'ok.pdf', type: '', size: 10 })).toBeUndefined();
    expect(fileProblem(pdf, { name: 'UPPER.PDF', type: '', size: 10 })).toBeUndefined();
    expect(fileProblem({ type: 'image', label: 'Photo' }, { name: 'me.JPG', type: '', size: 10 })).toBeUndefined();
  });

  it('is still refused when its name says another kind, or none', () => {
    expect(fileProblem(pdf, { name: 'notes.txt', type: '', size: 10 })).toBe('notes.txt must be a PDF file');
    expect(fileProblem(pdf, { name: 'README', type: '', size: 10 })).toBe('README must be a PDF file');
    expect(fileProblem(pdf, { name: 'fake.pdf', type: 'text/plain', size: 10 })).toBe('fake.pdf must be a PDF file');
  });
});

describe('a date from outside', () => {
  it('with a year under 1000 is no date people write', () => {
    expect(checkValue({ type: 'date', label: 'Start' }, '0002-10-13', false)).toBe('Invalid date (check month/day values)');
    expect(checkValue({ type: 'datetime', label: 'Start' }, '0002-10-13T07:54:51.000Z', false)).toBe('Invalid date and time (check the values)');
    expect(checkValue({ type: 'date', label: 'Start' }, '2026-10-13', false)).toBeUndefined();
  });
});

describe('the page’s order for dates', () => {
  it('is day, month, year unless the page says month first or year first', () => {
    const page = { fieldia: '0.1', id: 't', data: { kind: 'responses' }, fields: {}, layout: { type: 'sections', id: 'r', children: [] } } as unknown as Page;
    for (const dateOrder of ['dmy', 'mdy', 'ymd']) expect(validatePage({ ...page, look: { dateOrder } }).ok).toBe(true);
    expect(validatePage({ ...page, look: { dateOrder: 'ydm' } }).ok).toBe(false);
  });
});

describe('the demo data source’s search', () => {
  const source = createMemoryDataSource({
    shows: { iteration: { path: 'path' } },
    records: {
      city: { 1: { name: 'أسوان' }, 2: { name: 'الإسكندرية' }, 3: { name: 'القاهرة' }, 4: { name: 'Floor 12' } },
      iteration: { 1: { name: 'Sprint 13', path: ['Portal', 'Sprint 13'] }, 2: { name: 'Sprint 14', path: ['Portal', 'Sprint 14'] } },
    },
  });
  const find = async (model: string, query: string) => (await source.search({ model, query })).map((r) => r.label);

  it('finds Arabic words without their hamza, with ه for ة, and digits in any script', async () => {
    expect(await find('city', 'اسوان')).toEqual(['أسوان']);
    expect(await find('city', 'الاسكندرية')).toEqual(['الإسكندرية']);
    expect(await find('city', 'القاهره')).toEqual(['القاهرة']);
    expect(await find('city', '١٢')).toEqual(['Floor 12']);
    expect(await find('city', 'FLOOR ۱۲')).toEqual(['Floor 12']);
  });

  it('finds a path written with / or with spaces round its separator', async () => {
    expect(await find('iteration', 'Portal/Sprint 13')).toEqual(['Sprint 13']);
    expect(await find('iteration', 'Portal \\ Sprint 13')).toEqual(['Sprint 13']);
    expect(await find('iteration', 'portal / sprint 1')).toEqual(['Sprint 13', 'Sprint 14']);
  });
});
