/**
 * @jest-environment node
 */
import type { Page } from '@fieldia/core';

/**
 * A server's first paint in a language whose words come in a chunk of their own (every language but English, 0.35): no
 * word of Fieldia's own is in it — its labels, options and help are the page's — so it is drawn at once, the same
 * before that language's chunk has come as after, fetching nothing and saying nothing. This file starts without any
 * language's chunk (a `*-lazy.spec.ts`).
 */

const page: Page = {
  fieldia: '0.13',
  id: 'enquiry',
  title: 'Property enquiry',
  data: { kind: 'record', model: 'crm.enquiry' },
  fields: {
    name: { type: 'char', label: 'Client', required: true },
    kind: { type: 'selection', label: 'Looking for', options: [{ value: 'villa', label: 'Villa' }, { value: 'office', label: 'Office' }] },
    budget: { type: 'float', label: 'Budget' },
    moving: { type: 'date', label: 'Moving on' },
    lines: { type: 'one2many', label: 'Viewings', relation: 'viewing', fields: { day: { type: 'date', label: 'Day' }, ok: { type: 'boolean', label: 'Liked' }, price: { type: 'float', label: 'Price' } } },
  },
  layout: {
    type: 'sections',
    id: 'sections',
    children: [
      {
        type: 'section',
        id: 'what',
        title: 'What they need',
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-kind', field: 'kind' },
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-moving', field: 'moving' },
          { type: 'field', id: 'f-lines', field: 'lines' },
        ],
      },
    ],
  },
  translations: { ar: { Client: 'العميل', 'Looking for': 'نبحث عن', Villa: 'فيلا' }, de: { Client: 'Kunde' } },
};
const values = { name: 'Nour', kind: 'villa', budget: 1234567.5, moving: '2026-11-03', lines: [{ id: 1, values: { day: '2026-10-30', ok: true, price: 9876.25 } }] };

describe.each(['ar', 'de', 'fr'])('a first paint in %s', (locale) => {
  it('is the same before its words have come as after, and fetches and says nothing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let fieldia!: typeof import('./server') & Pick<typeof import('@fieldia/core'), 'wordsComing' | 'wordsReady'>;
    await jest.isolateModulesAsync(async () => {
      const [server, core] = await Promise.all([import('./server'), import('@fieldia/core')]);
      fieldia = { ...server, wordsComing: core.wordsComing, wordsReady: core.wordsReady };
    });
    expect(fieldia.wordsComing(locale)).toBe(true);
    const before = fieldia.firstPaint(page, { locale, values, styles: false });
    // Nothing asked for: its words are still to come, and nothing was said.
    expect(fieldia.wordsComing(locale)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    expect(before).toContain(`lang="${locale}"`);
    if (locale === 'ar') expect(before).toContain('dir="rtl"');
    if (locale === 'ar') expect(before).toContain('>العميل</label>');
    await fieldia.wordsReady(locale);
    expect(fieldia.firstPaint(page, { locale, values, styles: false })).toBe(before);
    warn.mockRestore();
  });
});
