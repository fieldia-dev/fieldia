import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { checkValue } from './check';
import { createForm } from './form';
import { dayOf } from './limits';
import { MESSAGES } from './messages';
import { initialValues } from './values';

/** One question on a page of its own, as the form checks it. */
function ask(field: Record<string, unknown>, node: Partial<FieldNode> = {}, options: { now?: Date; locale?: keyof typeof MESSAGES } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Answer', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page, messages: MESSAGES[options.locale ?? 'en'], now: options.now ? () => options.now as Date : undefined });
  return (value: unknown) => {
    form.setValue('x', value as never);
    return form.problem('x');
  };
}

describe('a website', () => {
  const site = ask({ type: 'char' }, { widget: 'url' });

  it('takes an address with or without its https://, as Typeform does', () => {
    for (const ok of ['example.com', 'www.example.com', 'https://example.com', 'http://shop.example.co.uk/a/b?c=1#d', 'https://example.com:8080/x', 'مثال.مصر']) expect({ ok, says: site(ok) }).toEqual({ ok, says: null });
  });

  it('refuses anything else, saying what to type', () => {
    for (const bad of ['example', 'not a site', 'ftp://example.com', 'https://', 'example .com', 'mailto:sara@example.com', 'www.example.c']) {
      expect({ bad, says: site(bad) }).toEqual({ bad, says: 'Enter a web address, like example.com' });
    }
  });

  it('keeps what was typed, and asks nothing of an empty one', () => {
    const page = { fieldia: '0.1', id: 't', data: { kind: 'responses' }, fields: { x: { type: 'char', label: 'Site' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'n', field: 'x', widget: 'url' }] } } as Page;
    const form = createForm({ page });
    form.setValue('x', 'example.com');
    expect(form.getState().values['x']).toBe('example.com');
    expect(site(null)).toBeNull();
    expect(ask({ type: 'char', required: true }, { widget: 'url' })(null)).toBe('Answer is required');
  });
});

describe('a phone number', () => {
  const phone = ask({ type: 'char' }, { widget: 'phone' });

  it('takes a plus, digits, spaces, dots, dashes and brackets, with 7 to 15 digits', () => {
    for (const ok of ['+20 100 123 4567', '(02) 2345-6789', '010.0123.4567', '1234567', '+123456789012345', '٠١٠٠١٢٣٤٥٦٧']) expect({ ok, says: phone(ok) }).toEqual({ ok, says: null });
  });

  it('refuses too few digits, too many, or anything else', () => {
    for (const bad of ['123456', '+1234567890123456', 'call me', '010-abc-4567', '20+ 100 123 4567', '++20 100 123 4567']) {
      expect({ bad, says: phone(bad) }).toEqual({ bad, says: 'Enter a phone number, like +20 100 123 4567' });
    }
  });
});

describe('an email', () => {
  it('says what to type instead of naming a format, the pattern or not', () => {
    const pattern = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';
    for (const email of [ask({ type: 'char', pattern }, { widget: 'email' }), ask({ type: 'char' }, { widget: 'email' })]) {
      expect(email('sara@')).toBe('Enter an email address, like name@example.com');
      expect(email('sara example.com')).toBe('Enter an email address, like name@example.com');
      expect(email('sara@example.com')).toBeNull();
    }
  });

  it('keeps the field’s own pattern where the page has one of its own', () => {
    expect(ask({ type: 'char', pattern: '@nile\\.example$' }, { widget: 'email' })('sara@example.com')).toBe('Answer is not in the expected format');
  });
});

describe('a time of day', () => {
  const time = ask({ type: 'char' }, { widget: 'time', options: { min: '09:00', max: '17:30' } });

  it('is hours and minutes, HH:MM', () => {
    expect(time('09:00')).toBeNull();
    expect(time('17:30')).toBeNull();
    for (const bad of ['9:30', '25:00', '12:60', 'noon']) expect({ bad, says: time(bad) }).toEqual({ bad, says: 'Enter a time, like 14:30' });
  });

  it('keeps between its earliest and latest, naming them', () => {
    expect(time('08:59')).toBe('Answer can’t be before 09:00');
    expect(time('17:31')).toBe('Answer can’t be after 17:30');
  });
});

describe('keywords', () => {
  it('take at most as many as the page says', () => {
    const tags = ask({ type: 'char', label: 'Materials' }, { widget: 'tags', options: { max: 2 } });
    expect(tags('oak, glass')).toBeNull();
    expect(tags('oak, glass, steel')).toBe('Choose at most 2 for Materials');
    expect(ask({ type: 'char' }, { widget: 'tags', options: { max: 1, separator: ';' } })('a, b')).toBeNull();
  });
});

describe('the checks in other languages', () => {
  it('speaks Arabic, German and French', () => {
    expect(ask({ type: 'char' }, { widget: 'url' }, { locale: 'ar' })('x')).toBe(MESSAGES.ar.url);
    expect(ask({ type: 'char' }, { widget: 'phone' }, { locale: 'de' })('x')).toBe(MESSAGES.de.phone);
    expect(ask({ type: 'char' }, { widget: 'email' }, { locale: 'fr' })('x')).toBe(MESSAGES.fr.email);
    for (const locale of ['ar', 'de', 'fr'] as const) for (const key of ['email', 'url', 'phone', 'time', 'before', 'after', 'weekday'] as const) expect(MESSAGES[locale][key]).not.toBe(MESSAGES.en[key]);
  });
});

describe('a day a limit names', () => {
  it('is the day itself, or today with days added or taken away', () => {
    expect(dayOf('2026-05-01', '2026-03-02')).toBe('2026-05-01');
    expect(dayOf('today', '2026-03-02')).toBe('2026-03-02');
    expect(dayOf('today+30', '2026-03-02')).toBe('2026-04-01');
    expect(dayOf('today-1', '2026-03-01')).toBe('2026-02-28');
  });
});

describe('a date’s earliest, latest and days', () => {
  const today = '2026-03-02'; // a Monday
  const visit = (extra: Record<string, unknown>) => ({ type: 'date', label: 'Visit', ...extra }) as Field;

  it('keeps between its earliest and latest, fixed or counted from today, naming the day', () => {
    const field = visit({ min: 'today', max: 'today+30' });
    expect(checkValue(field, '2026-03-01', false, MESSAGES.en, today)).toBe('Visit can’t be before March 2, 2026');
    expect(checkValue(field, '2026-04-02', false, MESSAGES.en, today)).toBe('Visit can’t be after April 1, 2026');
    expect(checkValue(field, '2026-03-02', false, MESSAGES.en, today)).toBeUndefined();
    expect(checkValue(field, '2026-04-01', false, MESSAGES.en, today)).toBeUndefined();
    expect(checkValue(visit({ min: '2026-06-01' }), '2026-05-31', false, MESSAGES.en, today)).toBe('Visit can’t be before June 1, 2026');
  });

  it('refuses a day of the week it may not fall on, naming those days', () => {
    const weekdays = visit({ days: [1, 2, 3, 4, 5] });
    expect(checkValue(weekdays, '2026-03-07', false, MESSAGES.en, today)).toBe('Visit can’t be on a Saturday or Sunday');
    expect(checkValue(weekdays, '2026-03-06', false, MESSAGES.en, today)).toBeUndefined();
    // Egypt's weekend: Friday and Saturday.
    const egypt = visit({ days: [7, 1, 2, 3, 4] });
    expect(checkValue(egypt, '2026-03-06', false, MESSAGES.en, today)).toBe('Visit can’t be on a Friday or Saturday');
    expect(checkValue(egypt, '2026-03-08', false, MESSAGES.en, today)).toBeUndefined();
  });

  it('writes the day in the page’s language', () => {
    expect(checkValue(visit({ min: 'today', label: 'الزيارة' }), '2026-03-01', false, MESSAGES.ar, today)).toBe('لا يمكن أن يكون الزيارة قبل 2 مارس 2026');
    expect(checkValue(visit({ days: [1, 2, 3, 4, 5], label: 'Besuch' }), '2026-03-08', false, MESSAGES.de, today)).toBe('Besuch darf nicht auf einen Samstag oder Sonntag fallen');
    expect(checkValue(visit({ max: 'today', label: 'Visite' }), '2026-03-03', false, MESSAGES.fr, today)).toBe('Visite : au plus tard 2 mars 2026');
  });

  it('asks the same of a date and time, by the day it falls on', () => {
    const meeting = { type: 'datetime', label: 'Meeting', min: 'today', days: [1, 2, 3, 4, 5] } as Field;
    expect(checkValue(meeting, '2026-02-20T12:00:00.000Z', false, MESSAGES.en, today)).toBe('Meeting can’t be before March 2, 2026');
    expect(checkValue(meeting, '2026-03-07T12:00:00.000Z', false, MESSAGES.en, today)).toBe('Meeting can’t be on a Saturday or Sunday');
    expect(checkValue(meeting, '2026-03-04T12:00:00.000Z', false, MESSAGES.en, today)).toBeUndefined();
  });

  it('reads today from the form’s clock', () => {
    const date = ask({ type: 'date', min: 'today' }, {}, { now: new Date(2026, 2, 2, 10) });
    expect(date('2026-03-01')).toBe('Answer can’t be before March 2, 2026');
    expect(date('2026-03-02')).toBeNull();
  });
});

describe('a date that starts on today', () => {
  it('is today when the form opens, by its clock', () => {
    const page = { fieldia: '0.1', id: 't', data: { kind: 'responses' }, fields: { visit: { type: 'date', label: 'Visit', default: 'today' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'n', field: 'visit' }] } } as Page;
    const form = createForm({ page, now: () => new Date(2026, 2, 2, 10) });
    expect(form.getState().values['visit']).toBe('2026-03-02');
    expect(form.getState().dirty).toEqual([]);
    expect(initialValues(page.fields, '2026-03-05')['visit']).toBe('2026-03-05');
  });
});

describe('the format', () => {
  const page = (field: Record<string, unknown>) => ({ fieldia: '0.1', id: 't', data: { kind: 'responses' }, fields: { x: { label: 'X', ...field } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'n', field: 'x' }] } });

  it('takes a date’s earliest and latest, fixed or from today, and the days of the week it may fall on', () => {
    expect(validatePage(page({ type: 'date', min: 'today', max: 'today+30', days: [1, 2, 3, 4, 5], default: 'today' })).ok).toBe(true);
    expect(validatePage(page({ type: 'datetime', min: '2026-03-02', max: 'today-1' })).ok).toBe(true);
    for (const bad of [{ min: 'tomorrow' }, { max: '2026-3-2' }, { days: [0] }, { days: [8] }, { days: [] }]) expect({ bad, ok: validatePage(page({ type: 'date', ...bad })).ok }).toEqual({ bad, ok: false });
  });
});
