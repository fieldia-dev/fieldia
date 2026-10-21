import { checkPage } from '../format/check-page';
import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { zonedPage } from '../format/zoned';
import { createForm } from './form';

/**
 * A page's time zone (`timeZone`), and a date and time field's own: the
 * format takes an IANA name and refuses another; the zone is written into each
 * date and time field naming none (`zonedPage`); today — a date's default, its
 * limits counted from today, `today()`, a rule's past and future — is that
 * zone's day; a date and time's limits keep to the day it falls on there.
 */

const page = (more: Partial<Page> = {}, fields: Page['fields'] = {}): Page => ({
  fieldia: '0.8',
  id: 'visit',
  data: { kind: 'responses' },
  fields: {
    day: { type: 'date', label: 'Day', default: 'today' },
    at: { type: 'datetime', label: 'At' },
    ...fields,
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 's', children: Object.keys({ day: 1, at: 1, ...fields }).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name })) }],
  },
  ...more,
});

const issues = (input: unknown) => {
  const result = validatePage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};
const quickIssues = (input: unknown) => {
  const result = checkPage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('a time zone in the page format', () => {
  it('takes a page’s zone and a date and time field’s own, by their IANA names', () => {
    const zoned = page({ timeZone: 'Africa/Cairo' }, { flight: { type: 'datetime', label: 'Departs', timeZone: 'Europe/Berlin' } });
    expect(issues(zoned)).toEqual([]);
    expect(quickIssues(zoned)).toEqual([]);
  });

  it('refuses a zone no browser knows, or one written as an offset, in both checks', () => {
    for (const bad of ['Mars/Olympus', 'Africa/Cairo ']) {
      expect(issues(page({ timeZone: bad }))).toEqual([expect.stringMatching(/^timeZone: /)]);
      expect(quickIssues(page({ timeZone: bad }))).toEqual([expect.stringContaining(`timeZone: ${JSON.stringify(bad)} is not a time zone this browser knows`)]);
    }
    expect(issues(page({ timeZone: '+02:00' }))).toEqual([expect.stringContaining('timeZone: a time zone is named as the IANA names it')]);
    expect(quickIssues(page({}, { flight: { type: 'datetime', label: 'Departs', timeZone: 'Berlin' } }))).toEqual([expect.stringContaining('fields.flight.timeZone: "Berlin" is not a time zone')]);
  });

  it('refuses a zone on a date, which is a day on no clock', () => {
    expect(issues(page({}, { due: { type: 'date', label: 'Due', timeZone: 'Africa/Cairo' } as never }))).toEqual([expect.stringMatching(/^fields\.due: /)]);
  });
});

describe('zonedPage: the page’s zone written into its date and time fields', () => {
  it('gives each date and time field naming none the page’s zone, in its lines and its links too', () => {
    const given = page(
      { timeZone: 'Africa/Cairo' },
      {
        flight: { type: 'datetime', label: 'Departs', timeZone: 'Europe/Berlin' },
        visits: { type: 'one2many', label: 'Visits', relation: 'visit', fields: { when: { type: 'datetime', label: 'When' }, note: { type: 'char', label: 'Note' } } },
        meetings: { type: 'many2many', label: 'Meetings', relation: 'meeting', fields: { start: { type: 'datetime', label: 'Starts' } } },
      }
    );
    const zoned = zonedPage(given);
    expect(zoned.fields['at']).toEqual({ type: 'datetime', label: 'At', timeZone: 'Africa/Cairo' });
    expect(zoned.fields['flight']).toBe(given.fields['flight']);
    expect(zoned.fields['day']).toBe(given.fields['day']);
    expect((zoned.fields['visits'] as { fields: Record<string, unknown> }).fields['when']).toEqual({ type: 'datetime', label: 'When', timeZone: 'Africa/Cairo' });
    expect((zoned.fields['meetings'] as { fields: Record<string, unknown> }).fields['start']).toEqual({ type: 'datetime', label: 'Starts', timeZone: 'Africa/Cairo' });
    // The page given is never changed.
    expect(given.fields['at']).toEqual({ type: 'datetime', label: 'At' });
  });

  it('hands back the very page that names no zone, or whose fields all name their own', () => {
    const plain = page();
    expect(zonedPage(plain)).toBe(plain);
    const own = page({ timeZone: 'Africa/Cairo' }, {});
    own.fields['at'] = { type: 'datetime', label: 'At', timeZone: 'UTC' };
    expect(zonedPage(own)).toBe(own);
  });
});

describe('today, on the clock of the page’s zone', () => {
  // 22:30 UTC on the 15th: already the 16th in Cairo, still the 15th in New York.
  const now = () => new Date('2026-10-15T22:30:00Z');

  it('starts a date at today in the page’s zone, and today() is that day', () => {
    const cairo = createForm({ page: page({ timeZone: 'Africa/Cairo' }), now });
    expect(cairo.getState().values['day']).toBe('2026-10-16');
    expect(cairo.today()).toBe('2026-10-16');
    const newYork = createForm({ page: page({ timeZone: 'America/New_York' }), now });
    expect(newYork.getState().values['day']).toBe('2026-10-15');
    // A page naming no zone: the browser's own day, as before.
    const own = createForm({ page: page(), now });
    const local = now();
    expect(own.today()).toBe(`${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`);
  });

  it('counts a date’s earliest from today in the page’s zone', () => {
    const form = createForm({ page: page({ timeZone: 'Africa/Cairo' }, { visit: { type: 'date', label: 'Visit', min: 'today' } }), now });
    form.setValue('visit', '2026-10-15');
    expect(form.problem('visit')).toMatch(/Visit/);
    form.setValue('visit', '2026-10-16');
    expect(form.problem('visit')).toBeNull();
  });

  it('keeps a date and time’s limits by the day it falls on in its zone', () => {
    // 23:30 in Cairo on Friday the 16th is 22:30 in Berlin on Friday too, and 20:30 UTC: Fridays are refused.
    const fields = { slot: { type: 'datetime' as const, label: 'Slot', days: [1, 2, 3, 4, 6, 7] } };
    const cairo = createForm({ page: page({ timeZone: 'Africa/Cairo' }, fields), now });
    cairo.setValue('slot', '2026-10-15T21:30:00.000Z');
    // 21:30 UTC on Thursday the 15th is 00:30 on Friday the 16th in Cairo.
    expect(cairo.problem('slot')).toMatch(/Friday/);
    const london = createForm({ page: page({ timeZone: 'Europe/London' }, fields), now });
    london.setValue('slot', '2026-10-15T21:30:00.000Z');
    expect(london.problem('slot')).toBeNull();
  });

  it('reads a rule’s future against today in the page’s zone', () => {
    const rules = page({ timeZone: 'Africa/Cairo' }, { visit: { type: 'date', label: 'Visit' } });
    const node = (rules.layout as { children: { children: { field: string; validate?: unknown }[] }[] }).children[0].children.find((child) => child.field === 'visit')!;
    node.validate = [{ date: 'future' }];
    const form = createForm({ page: rules, now });
    form.setValue('visit', '2026-10-16');
    expect(form.problem('visit')).toMatch(/Visit/);
    form.setValue('visit', '2026-10-17');
    expect(form.problem('visit')).toBeNull();
  });
});
