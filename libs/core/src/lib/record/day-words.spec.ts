import type { Page } from '../format/page';
import { checkValue } from './check';
import { dayWords } from './day-words';
import { createForm } from './form';
import { takingWords, whenWords } from './form-limits';
import { MESSAGES } from './messages';

/**
 * A day or a time a message names, written as the page's date boxes write one: in the page's order (`look.dateOrder`),
 * its language and its time zone — "Built on can't be after 20 Oct 2026" beside a box that shows "20 Oct 2026", never
 * the US form "October 20, 2026" (the site lane's walk of 0.27). Every kind: a day's earliest and latest, a date and
 * time's, a range's end, the days a form opens and closes.
 */

const page = (fields: Record<string, unknown>, more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.12',
    id: 'days',
    data: { kind: 'responses' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((field) => ({ type: 'field', id: `f-${field}`, field })) },
    ...more,
  }) as Page;
const NOW = () => new Date('2026-10-20T10:00:00Z');

describe('a day in a message', () => {
  it('is written in the page’s order and language, as a box writes it at rest', () => {
    expect(dayWords('2026-10-20', MESSAGES.en)).toBe('20 Oct 2026');
    expect(dayWords('2026-10-20', { ...MESSAGES.en, dateOrder: 'mdy' })).toBe('Oct 20, 2026');
    expect(dayWords('2026-10-20', { ...MESSAGES.en, dateOrder: 'ymd' })).toBe('2026-10-20');
    expect(dayWords('2026-10-20', MESSAGES.de)).toBe('20. Okt. 2026');
    expect(dayWords('2026-10-20', MESSAGES.fr)).toBe('20 oct. 2026');
  });

  it('with its time on the page’s clock, the zone named where it is not the reader’s', () => {
    const at = Date.parse('2026-11-01T07:00:00.000Z');
    expect(whenWords('2026-11-01T09:00', at, MESSAGES.en, 'Africa/Cairo')).toMatch(/^1 Nov 2026, 09:00( (EET|GMT\+2))?$/);
    expect(whenWords('2026-11-01T09:00', at, MESSAGES.en, 'Africa/Cairo', 'mdy')).toMatch(/^Nov 1, 2026, 09:00( (EET|GMT\+2))?$/);
    expect(whenWords('2026-11-01T09:00', at, MESSAGES.en, 'Africa/Cairo', 'ymd')).toMatch(/^2026-11-01 09:00( (EET|GMT\+2))?$/);
    // Tokyo is no reader's own here (the tests run on another clock): its name said.
    expect(whenWords('2026-11-01T16:00', at, MESSAGES.en, 'Asia/Tokyo')).toMatch(/^1 Nov 2026, 16:00 (GMT\+9|JST)$/);
  });

  it('a day’s earliest and latest, as the page writes its days', () => {
    const days = { built_on: { type: 'date', label: 'Built on', max: 'today' }, visit: { type: 'date', label: 'Visit', min: '2026-03-02' } };
    const form = createForm({ page: page(days), now: NOW });
    form.setValue('built_on', '2030-01-01');
    form.setValue('visit', '2026-03-01');
    expect(form.problem('built_on')).toBe('Built on can’t be after 20 Oct 2026');
    expect(form.problem('visit')).toBe('Visit can’t be before 2 Mar 2026');
    const monthFirst = createForm({ page: page(days, { look: { dateOrder: 'mdy' } } as Partial<Page>), now: NOW });
    monthFirst.setValue('built_on', '2030-01-01');
    expect(monthFirst.problem('built_on')).toBe('Built on can’t be after Oct 20, 2026');
    // A date and time's earliest day, by the day it falls on.
    expect(checkValue({ type: 'datetime', label: 'Meeting', min: '2026-03-02' }, '2026-02-20T12:00:00.000Z', false, MESSAGES.en)).toBe('Meeting can’t be before 2 Mar 2026');
  });

  it('a range’s end, by its own earliest', () => {
    const form = createForm({
      page: {
        ...page({ from_day: { type: 'date', label: 'From' }, to_day: { type: 'date', label: 'To', min: '2026-10-01' } }),
        layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-range', field: 'from_day', widget: 'daterange', options: { endField: 'to_day' } }] },
      } as Page,
      now: NOW,
    });
    form.setValue('from_day', '2026-09-20');
    form.setValue('to_day', '2026-09-28');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['to_day']).toBe('To can’t be before 1 Oct 2026');
  });

  it('the days a form opens and closes, on its clock, in its order', () => {
    const signup = page({ name: { type: 'char', label: 'Name' } }, { timeZone: 'Africa/Cairo', limits: { opens: '2026-11-01T09:00', closes: '2026-11-20' } } as Partial<Page>);
    expect(takingWords(signup, { state: 'soon', opens: '2026-11-01T07:00:00.000Z', closes: '2026-11-20T22:00:00.000Z', seats: {} }, MESSAGES.en)).toMatch(/^This form opens on 1 Nov 2026, 09:00( \S+)?\.$/);
    expect(takingWords(signup, { state: 'closed', opens: '2026-11-01T07:00:00.000Z', closes: '2026-11-20T22:00:00.000Z', seats: {} }, MESSAGES.en)).toBe('This form closed on 20 Nov 2026.');
    const monthFirst = { ...signup, look: { dateOrder: 'mdy' } } as Page;
    expect(takingWords(monthFirst, { state: 'closed', opens: '2026-11-01T07:00:00.000Z', closes: '2026-11-20T22:00:00.000Z', seats: {} }, MESSAGES.en)).toBe('This form closed on Nov 20, 2026.');
  });
});
