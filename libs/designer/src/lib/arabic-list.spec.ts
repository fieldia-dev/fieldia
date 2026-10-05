import type { Field } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountScreenEditor } from './screen-editor';
import { button, field } from './test-editor';

/** A list page in Arabic: the designer's words on its canvas and in its panels; what the viewer says on it in the page's own language. */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'الاسم' },
  state: { type: 'selection', label: 'الحالة', options: [{ value: 'active', label: 'نشط' }, { value: 'blocked', label: 'موقوف' }] },
  credit_limit: { type: 'monetary', label: 'حد الائتمان', currency: 'EGP' },
};

function visit(lang = 'ar') {
  const designer = createDesigner({ page: blankPage('list', 'العملاء', { locale: 'ar' }), model, locale: 'ar' });
  designer.addColumn('state');
  designer.select(null);
  const host = document.createElement('div');
  host.lang = lang;
  host.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.append(host);
  const handle = mountScreenEditor(host, { designer });
  return { designer, host, handle };
}
const names = (host: Element) => [...host.querySelectorAll('.fd-properties .fd-prop-name')].filter((n) => !n.closest('[hidden]')).map((n) => n.textContent);

afterEach(() => document.body.replaceChildren());

describe('a list page, in Arabic', () => {
  it('says the designer’s words on the canvas in Arabic, and the viewer’s in the page’s language', () => {
    const { host, designer } = visit();
    designer.select(null);
    const search = host.querySelector('.fd-canvas-search') as HTMLElement;
    expect(search.getAttribute('aria-label')).toBe('البحث وعوامل التصفية');
    expect(host.querySelector('.fd-search-placeholder')?.textContent).toBe('بحث…');
    expect(host.querySelector('.fd-list-count')?.textContent).toBe('تم تحديد 2');
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–40 من 128');
    expect(host.querySelector('.fd-canvas-selection-hint')?.textContent).toBe('يظهر عند تحديد صفوف');
    expect(button(host, 'إضافة زر')).toBeDefined();
    expect(button(host, 'إضافة عمود')).toBeDefined();
  });

  it('keeps the viewer’s words in English on a page in English', () => {
    const { host, designer } = visit('en');
    designer.select(null);
    expect(host.querySelector('.fd-search-placeholder')?.textContent).toBe('Search…');
    expect(host.querySelector('.fd-list-count')?.textContent).toBe('2 selected');
    expect(host.querySelector('.fd-canvas-search')?.getAttribute('aria-label')).toBe('البحث وعوامل التصفية');
  });

  it('puts the list’s panel in Arabic, its filters and their tests too', () => {
    const { host, designer } = visit();
    expect(names(host)).toEqual(expect.arrayContaining(['عدد الصفوف في الصفحة', 'الترتيب حسب', 'البحث يشمل', 'عوامل التصفية', 'التجميع حسب']));
    button(host, 'إضافة عامل تصفية')?.click();
    const filter = designer.getPage().layout as { filters?: { label: string }[] };
    expect(filter.filters?.[0].label).toBe('عامل تصفية جديد');
    const test = field(host, 'شرط عامل التصفية') as HTMLSelectElement;
    expect([...test.options].map((o) => o.textContent)).toEqual(['يحتوي على', 'يساوي', 'لا يساوي', 'غير فارغ', 'فارغ']);
    expect(button(host, 'إزالة عامل التصفية عامل تصفية جديد')).toBeDefined();
    expect((field(host, 'الترتيب حسب') as HTMLSelectElement).options[0].textContent).toBe('كما يرتّبها التطبيق');
  });

  it('puts a column’s panel and bar, and a button’s, in Arabic', () => {
    const { host, designer } = visit();
    designer.select('column:state');
    expect([...host.querySelectorAll('.fd-properties .fd-properties-hint')].map((h) => h.textContent)).toContain('الحالة: عنصر واحد من قائمة، من نموذج البيانات. يعرض العمود الحقل باسمه.');
    expect([...host.querySelectorAll('.fd-column-bar button')].map((b) => b.getAttribute('aria-label'))).toEqual(['نقل إلى السابق', 'إزالة العمود']);
    const action = designer.addListAction('أرشفة') as string;
    designer.select(action);
    expect(names(host)).toEqual(['النص', 'الإجراء', 'المظهر', 'يسأل أولًا']);
    expect([...(field(host, 'المظهر') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['عادي', 'رئيسي', 'خطر', 'رابط']);
  });
});
