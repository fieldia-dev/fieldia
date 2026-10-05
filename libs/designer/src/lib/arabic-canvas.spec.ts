import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { ar } from './locales/ar';
import { chipWords, valueWords } from './canvas-resize';
import { keyMove } from './canvas-keys';
import { mount, press } from './test-editor';

/** The screen drawn, and the designer's words on it, in Arabic: the field picked, drops, widths and keys. */

const q = (name: string) => `«⁨${name}⁩»`;

function visit() {
  const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
  const ids: Record<string, string> = {};
  for (const [key, kind, label] of [
    ['customer', 'short-answer', 'العميل'],
    ['date', 'date', 'تاريخ الزيارة'],
    ['notes', 'paragraph', 'ملاحظات'],
  ] as const) {
    ids[key] = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    designer.updateQuestion(ids[key], { label });
  }
  designer.setColumns('section-1', 12);
  designer.select(null);
  return { designer, ids };
}
const fields = (page: Page) => (page.layout as { children: SectionNode[] }).children[0].children as FieldNode[];

afterEach(() => document.body.replaceChildren());

describe('drops and layout edits, in Arabic', () => {
  it('says where a drop goes, the names as written', () => {
    const { designer, ids } = visit();
    expect(designer.describeDrop({ how: 'beside', target: ids['date'], after: false }, ids['notes'])).toBe(`بين ${q('العميل')} و${q('تاريخ الزيارة')} — يُقسم الصف ثلاثة أثلاث`);
    expect(designer.describeDrop({ how: 'at', container: 'section-1', index: 0 })).toBe(`قبل ${q('العميل')}`);
    expect(designer.describeDrop({ how: 'into', container: 'section-1' })).toBe(`داخل ${q('القسم 1')}`);
    expect(designer.dropRefusal({ how: 'beside', target: ids['date'], after: false }, ids['date'])).toBe('لا يمكن وضع الجزء بجانب نفسه أو تحته');
  });

  it('names the blocks it adds in Arabic, and refuses what cannot be in Arabic', () => {
    const { designer, ids } = visit();
    const group = designer.addBlock('group', { after: ids['notes'] }) as string;
    const heading = designer.addBlock('heading', { after: ids['notes'] }) as string;
    const page = designer.getPage();
    const nodes = fields(page) as unknown as { id: string; title?: string; text?: string }[];
    expect(nodes.find((n) => n.id === group)?.title).toBe('مجموعة جديدة');
    expect(nodes.find((n) => n.id === heading)?.text).toBe('عنوان جديد');
    expect(designer.wrap([ids['customer']], 'side')).toBe(false);
    expect(designer.getState().issues).toEqual(['اختر جزأين أو أكثر لوضعها جنبًا إلى جنب']);
    expect(designer.setFold('section-1', 'folded')).toBe(true);
    designer.renameContainer('section-1', 'زيارة');
    expect(designer.setColumns('section-1', 7 as never)).toBe(false);
    expect(designer.getState().issues).toEqual(['للمجموعة من عمود إلى أربعة أعمدة، أو أجزاء من اثني عشر']);
  });

  it('says what a key would do, and the chip of a width dragged', () => {
    const { designer, ids } = visit();
    expect(keyMove(designer.getPage(), ids['customer'], { key: 'ArrowUp', altKey: true, shiftKey: false }, true, ar)).toEqual({ said: 'لا يمكن نقله أبعد من ذلك' });
    expect(chipWords(640, 'tablet', ar)).toBe('640 بكسل · جهاز لوحي');
    expect(valueWords(1024, 'desktop', ar)).toBe('1024 بكسل، سطح المكتب');
  });
});

describe('the screen drawn, in Arabic', () => {
  it('puts the field bar’s tools, an empty group’s words and the sizes in Arabic', () => {
    const { designer, ids } = visit();
    designer.addContainer('المتابعة');
    designer.select(ids['customer']);
    const { host } = mount(designer, { mode: 'advanced' });
    const bar = host.querySelector('.fd-field-bar') as HTMLElement;
    expect(bar.getAttribute('aria-label')).toBe('الحقل');
    expect([bar.dir, bar.lang]).toEqual(['rtl', 'ar']);
    expect([...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')).filter(Boolean)).toEqual(['اسحب للنقل', 'العرض بشكل: إجابة قصيرة', 'مطلوب', 'العرض', 'الإظهار فقط عندما…', 'تكرار', 'حذف', 'إعدادات أخرى']);
    expect(host.querySelector('.fd-canvas-section:last-child .fd-canvas-empty')?.textContent).toBe('أفلت حقلًا هنا، أو اختر واحدًا من الأدوات.');
    expect([...host.querySelectorAll('.fd-canvas-size-name')].map((s) => s.textContent)).toEqual(['سطح المكتب', 'جهاز لوحي', 'هاتف']);
    (bar.querySelector('[aria-label="العرض"]') as HTMLButtonElement).click();
    expect([...host.querySelectorAll('.fd-menu .fd-menu-label')].map((l) => l.textContent)).toContain('الصف كله');
  });

  it('draws each field’s own words in the page’s language: a page begun in Arabic is written in Arabic', () => {
    const { designer } = visit();
    expect(designer.getPage().language).toBe('ar');
    designer.updateQuestion(designer.addQuestion('yes-no', { parent: 'section-1' }) as string, { label: 'تم؟' });
    designer.updateQuestion(designer.addQuestion('image', { parent: 'section-1' }) as string, { label: 'الصور' });
    const { host } = mount(designer);
    expect([...host.querySelectorAll('.fd-yes-no button')].map((b) => b.textContent)).toEqual(['نعم', 'لا']);
    expect(host.querySelector('.fd-canvas .fd-button')?.textContent).toBe('إضافة صورة');
    designer.setPageLanguage('en');
    expect([...host.querySelectorAll('.fd-yes-no button')].map((b) => b.textContent)).toEqual(['Yes', 'No']);
  });

  it('offers Find anything’s ways in, in Arabic, and names a new section in Arabic', () => {
    const { designer, ids } = visit();
    designer.select(ids['customer']);
    const { host } = mount(designer, { mode: 'advanced' });
    press('k', { metaKey: true }, document.body);
    const found = [...host.querySelectorAll('.fd-find-option')].map((o) => [o.querySelector('.fd-find-label')?.textContent, o.querySelector('.fd-find-hint')?.textContent]);
    expect(found).toContainEqual(['إضافة حقل: إجابة قصيرة', 'حقل جديد']);
    expect(found).toContainEqual([`الانتقال إلى ${q('العميل')}`, 'القسم 1']);
    expect(found).toContainEqual(['إضافة قسم', 'التخطيط']);
    const add = [...host.querySelectorAll<HTMLElement>('.fd-find-option')].find((o) => o.querySelector('.fd-find-label')?.textContent === 'إضافة قسم') as HTMLElement;
    add.click();
    const sections = (designer.getPage().layout as { children: SectionNode[] }).children;
    expect(sections[sections.length - 1].title).toBe('القسم 2');
  });

  it('says a key’s move in Arabic, after the part’s name', () => {
    const { designer, ids } = visit();
    designer.select(ids['customer']);
    const { host } = mount(designer, { mode: 'advanced' });
    press('ArrowRight', { altKey: true }, document.body);
    expect(host.querySelector('.fd-canvas-said')?.textContent).toBe(`العميل: في نهاية الصف، بعد ${q('تاريخ الزيارة')}`);
  });
});
