import type { FieldNode, Page, SectionNode, StepNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount } from './test-editor';

/** The toolbox, the rail and the words a new part starts with, in Arabic. */

const arabic = (page: Page, model?: Parameters<typeof createDesigner>[0]['model']) => createDesigner({ page, model, locale: 'ar' });
const firstField = (page: Page) => (page.layout as { children: SectionNode[] }).children[0].children[0] as FieldNode;

afterEach(() => document.body.replaceChildren());

describe('a new page and its parts, in Arabic', () => {
  it('names a blank page’s first page and section in the designer’s language', () => {
    expect(((blankPage('survey', 'استبيان', { locale: 'ar' }).layout as { children: StepNode[] }).children[0]).label).toBe('الصفحة 1');
    expect(((blankPage('screen', 'زيارة', { locale: 'ar' }).layout as { children: SectionNode[] }).children[0]).title).toBe('القسم 1');
    expect(blankPage('sheet', 'عميل', { locale: 'ar' }).fields['name'].label).toBe('الاسم');
    // English unless said.
    expect(((blankPage('screen', 'Visit').layout as { children: SectionNode[] }).children[0]).title).toBe('Section 1');
  });

  it('starts a question, and its first option, in Arabic', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    designer.addQuestion('dropdown', { parent: 'section-1' });
    const page = designer.getPage();
    const field = page.fields[firstField(page).field] as { label: string; options: { value: string; label: string }[] };
    expect(field.label).toBe('سؤال بلا عنوان');
    expect(field.options).toEqual([{ value: 'option_1', label: 'الخيار 1' }]);
  });

  it('keeps an option written in Arabic by a value of its own, as English ones are', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    const id = designer.addQuestion('dropdown', { parent: 'section-1' }) as string;
    designer.setOptions(id, ['نعم', 'لا']);
    const page = designer.getPage();
    expect((page.fields[firstField(page).field] as { options: { value: string }[] }).options.map((o) => o.value)).toEqual(['option_1', 'option_2']);
  });

  it('refuses a kind a field of the model cannot be shown as, saying why in Arabic', () => {
    const designer = arabic(blankPage('sheet', 'عميل', { locale: 'ar' }), { visits: { type: 'integer', label: 'Visits' } });
    const id = designer.addModelField('visits') as string;
    expect(designer.changeKind(id, 'email')).toBe(false);
    expect(designer.getState().issues[0]).toBe('«\u2068Visits\u2069» في نموذج البيانات من نوع: عدد صحيح، لذا لا يُعرض إلا على هيئة: تقييم أو مقياس خطي أو رقم أو شريط تمرير أو نسبة الإنجاز أو لون');
  });
});

describe('the toolbox and the rail, in Arabic', () => {
  it('names its groups and kinds, its search and its tabs in Arabic', () => {
    const { host } = mount(arabic(blankPage('screen', 'زيارة', { locale: 'ar' })));
    const box = host.querySelector('.fd-toolbox') as HTMLElement;
    expect((box.querySelector('.fd-tool-find') as HTMLInputElement).placeholder).toBe('ابحث عن حقل أو نوع');
    const groups = [...box.querySelectorAll('.fd-tool-group:not([hidden]) .fd-tool-heading-name')].map((h) => h.textContent);
    expect(groups).toEqual(expect.arrayContaining(['نص', 'أرقام وتواريخ', 'اختيارات', 'سجلات', 'المزيد', 'التخطيط']));
    const tile = box.querySelector('[data-tool="kind:short-answer"]') as HTMLElement;
    expect(tile.textContent).toBe('إجابة قصيرة');
    expect(tile.title).toBe('إجابة قصيرة: إضافة حقل جديد');
    expect([...host.querySelectorAll('.fd-rail-tab')].map((t) => t.textContent)).toEqual(['إضافة', 'المخطط', 'البيانات']);
  });

  it('says what a field of the model holds, in Arabic', () => {
    const { host } = mount(arabic(blankPage('sheet', 'عميل', { locale: 'ar' }), { email: { type: 'char', label: 'Email' } }));
    expect((host.querySelector('[data-tool="model:email"]') as HTMLElement).title).toBe('Email: موجود في نموذج البيانات، من نوع: نص');
    (host.querySelector('[data-rail="data"]') as HTMLButtonElement).click();
    expect(host.querySelector('.fd-data-count')?.textContent).toBe('حقلان · واحد منها في هذه الصفحة');
  });

  it('types options the Google Forms way, in Arabic', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    const id = designer.addQuestion('multiple-choice', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer);
    const add = [...host.querySelectorAll<HTMLButtonElement>('.fd-q-add-option')].find((b) => !b.closest('[hidden]')) as HTMLButtonElement;
    expect(add.textContent).toBe('إضافة خيار');
    add.click();
    const page = designer.getPage();
    expect((page.fields[firstField(page).field] as { options: { label: string }[] }).options.map((o) => o.label)).toEqual(['الخيار 1', 'الخيار 2']);
  });
});
