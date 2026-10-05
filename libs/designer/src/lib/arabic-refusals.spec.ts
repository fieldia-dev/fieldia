import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

/** Why an edit is refused, in Arabic: the bar says it in the designer's language, the edit not made. */

const arabic = (page: Page, model?: Parameters<typeof createDesigner>[0]['model']) => createDesigner({ page, model, locale: 'ar' });
const said = (designer: ReturnType<typeof createDesigner>) => designer.getState().issues;
const fieldOf = (designer: ReturnType<typeof createDesigner>, id: string) => {
  const page = designer.getPage();
  const node = (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children).find((n) => n.id === id) as FieldNode;
  return page.fields[node.field] as unknown as Record<string, unknown>;
};

describe('refusals, in Arabic', () => {
  it('says a currency is three letters', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    const id = designer.addQuestion('amount', { parent: 'section-1' }) as string;
    expect(designer.setCurrency(id, 'pounds')).toBe(false);
    expect(said(designer)).toEqual(['العملة ثلاثة أحرف، مثل USD']);
    // The edit after it clears it.
    expect(designer.setCurrency(id, 'EGP')).toBe(true);
    expect(said(designer)).toEqual([]);
  });

  it('says a field of the model keeps its own settings, naming it', () => {
    const designer = arabic(blankPage('sheet', 'عميل', { locale: 'ar' }), { limit: { type: 'monetary', label: 'حد الائتمان', currency: 'EGP' } });
    const id = designer.addModelField('limit') as string;
    expect(designer.setCurrency(id, 'USD')).toBe(false);
    expect(said(designer)).toEqual(['عملة «⁨حد الائتمان⁩» تأتي من نموذج البيانات']);
  });

  it('says what a limit may be', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    const id = designer.addQuestion('number', { parent: 'section-1' }) as string;
    expect(designer.setLimits(id, { decimals: 9 })).toBe(false);
    expect(said(designer)).toEqual(['المنازل العشرية من 0 إلى 6']);
    expect(designer.setLimits(id, { min: 10, max: 2 })).toBe(false);
    expect(said(designer)).toEqual(['«من» ليس أصغر من «إلى»']);
  });

  it('says why a picture is refused, its size in Latin digits', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    const id = designer.addQuestion('image-choice', { parent: 'section-1' }) as string;
    expect(designer.setOptionPicture(id, 0, { src: 'data:image/png;base64,AAAA', bytes: 7.3 * 1024 * 1024 })).toBe(false);
    expect(said(designer)).toEqual(['أكبر حجم للصورة 5 ميغابايت، وحجم هذه 7.3 ميغابايت']);
  });

  it('says a page keeps one page at least, and that a version is not there', () => {
    const designer = arabic(blankPage('survey', 'استبيان', { locale: 'ar' }));
    expect(designer.removeNode('step-1')).toBe(false);
    expect(said(designer)).toEqual(['تحتاج الصفحة إلى صفحة أو قسم واحد على الأقل']);
    expect(designer.revertTo(4)).toBe(false);
    expect(said(designer)).toEqual(['لا يوجد الإصدار 4']);
  });

  it('writes what it adds in Arabic: “None of these”, and a scale made NPS', () => {
    const designer = arabic(blankPage('screen', 'زيارة', { locale: 'ar' }));
    const boxes = designer.addQuestion('checkboxes', { parent: 'section-1' }) as string;
    designer.addNoneOption(boxes);
    expect((fieldOf(designer, boxes)['options'] as { label: string }[]).map((o) => o.label)).toEqual(['الخيار 1', 'لا شيء مما سبق']);
    expect(designer.addNoneOption(boxes)).toBe(false);
    expect(said(designer)).toEqual(['لـ«⁨سؤال بلا عنوان⁩» خيار يُختار وحده بالفعل']);
    const scale = designer.addQuestion('scale', { parent: 'section-1' }) as string;
    designer.makeNps(scale);
    const node = (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === scale) as FieldNode;
    expect(node.options).toMatchObject({ startLabel: 'غير مرجّح إطلاقًا', endLabel: 'مرجّح للغاية' });
  });

  it('says a list needs a column, and a sheet’s header part needs words', () => {
    const designer = arabic(blankPage('list', 'العملاء', { locale: 'ar' }));
    expect(designer.removeColumn('name')).toBe(false);
    expect(said(designer)).toEqual(['تحتاج القائمة إلى عمود']);
    const sheet = arabic(blankPage('sheet', 'عميل', { locale: 'ar' }));
    expect(sheet.addHeaderPart('button', '  ')).toBe(false);
    expect(said(sheet)).toEqual(['يحتاج الزر أو العدّاد أو الشارة إلى نص']);
  });

  it('refuses to publish a broken page in Arabic', async () => {
    const page = blankPage('screen', 'زيارة', { locale: 'ar' });
    // A field shown that the page does not define.
    const designer = arabic({ ...page, layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'q', field: 'missing' }] }] } } as Page);
    await expect(designer.publish()).rejects.toThrow('في هذه الصفحة مشكلات تمنع نشرها');
  });
});
