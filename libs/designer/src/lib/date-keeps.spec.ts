import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount } from './test-editor';

/**
 * What a date keeps, as the designer sets it on the field itself: a day, a month alone or a year alone — its weekends
 * going with a day, a month having every day of the week — and a day's Hijri date beside it. Each change one undo step;
 * a Hijri month or year refused, as the format refuses it.
 */

afterEach(() => document.body.replaceChildren());

type DateFieldLike = { precision?: string; hijri?: boolean; days?: number[] };

const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('a date’s month, year and Hijri calendar in the designer', () => {
  it('keeps a day, a month or a year, and shows the Hijri date beside a day', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Lease') });
    const id = designer.addQuestion('date', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const card = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    const keeps = card.querySelector('[aria-label="Keeps"]') as HTMLSelectElement;
    const hijri = card.querySelector('[role="switch"][aria-label="Hijri date beside it"]') as HTMLButtonElement;
    const field = () => Object.values(designer.getPage().fields)[0] as unknown as DateFieldLike;
    expect([...keeps.options].map((o) => o.textContent)).toEqual(['A day', 'A month: Oct 2026', 'A year: 2026']);
    expect(keeps.value).toBe('');
    hijri.click();
    expect(field().hijri).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // A month alone: the Hijri date goes, the toggle hidden — a Hijri date is a day.
    designer.setLimits(id, { days: [1, 2, 3, 4, 5] });
    choose(keeps, 'month');
    expect(field().precision).toBe('month');
    expect(field().hijri).toBeUndefined();
    expect(field().days).toBeUndefined();
    expect((hijri.closest('.fd-inline-toggle') as HTMLElement).hidden).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setDateKeeps(id, { hijri: true })).toBe(false);
    choose(keeps, 'year');
    expect(field().precision).toBe('year');
    designer.undo();
    expect(field().precision).toBe('month');
    choose(keeps, '');
    expect(field().precision).toBeUndefined();
  });

  it('is said in Arabic too', () => {
    const designer = createDesigner({ page: blankPage('screen', 'عقد', { locale: 'ar' }), locale: 'ar' });
    const id = designer.addQuestion('date', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const keeps = host.querySelector('.fd-canvas-field.fd-editing [aria-label="يحفظ"]') as HTMLSelectElement;
    expect([...keeps.options].map((o) => o.textContent)).toEqual(['يومًا', 'شهرًا: أكتوبر 2026', 'سنة: 2026']);
  });
});
