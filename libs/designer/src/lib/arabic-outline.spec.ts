import { blankPage, createDesigner, type Designer } from './designer';
import { elementFactory } from './chrome';
import { clipboardKeys } from './clipboard-keys';
import { ar } from './locales/ar';
import { outlineKeyMove } from './outline-key-moves';
import { outlineRows } from './outline-rows';
import { outlineView } from './outline-view';

/** The outline and the clipboard in Arabic: the tree's rows and their kinds, what a move by drag or by key says, and each copy, cut and paste. */

const q = (name: string) => `«⁨${name}⁩»`;

function visit() {
  const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
  const ids: Record<string, string> = {};
  for (const [key, kind, label] of [
    ['customer', 'short-answer', 'العميل'],
    ['date', 'date', 'تاريخ الزيارة'],
  ] as const) {
    ids[key] = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    designer.updateQuestion(ids[key], { label });
  }
  designer.updateQuestion(ids['customer'], { required: true });
  designer.addContainer('المتابعة');
  designer.select(null);
  return { designer, ids };
}

function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'رضا العملاء', { locale: 'ar' }), locale: 'ar' });
  const page = designer.getPage().layout as { children: { id: string }[] };
  const first = page.children[0].id;
  const question = designer.addQuestion('short-answer', { parent: first }) as string;
  designer.updateQuestion(question, { label: 'الاسم' });
  return { designer, first, question };
}

let said: string[];
function mountOutline(designer: Designer) {
  said = [];
  const view = outlineView({ el: elementFactory(document), doc: document, designer, survey: false, reveal: () => undefined, several: () => true, say: (words) => said.push(words) });
  document.body.append(view.element);
  view.update(designer.getState(), true);
  designer.subscribe((state) => view.update(state, true));
  return view.element;
}

function fire(type: 'copy' | 'cut' | 'paste', data: Map<string, string>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { setData: (t: string, text: string) => void data.set(t, text), getData: (t: string) => data.get(t) ?? '' } });
  document.body.dispatchEvent(event);
}

afterEach(() => document.body.replaceChildren());

describe('the outline, in Arabic', () => {
  it('names the tree, its help and each row in Arabic; the names as written', () => {
    const { designer, ids } = visit();
    const outline = mountOutline(designer);
    expect(outline.getAttribute('aria-label')).toBe('المخطط');
    expect(outline.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe('أجزاء الصفحة');
    const help = outline.querySelector('.fd-outline-help') as HTMLElement;
    expect([...help.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['⇧', 'Alt', '?']);
    expect(help.textContent).toBe('اسحب صفًا لنقله، أو إلى داخل مجموعة من منتصفها. ⇧ مع النقر يختار عدة صفوف، وAlt مع سهم ينقل المختار، و? يعرض كل المفاتيح.');
    const row = outline.querySelector(`[data-pick="${ids['customer']}"]`) as HTMLElement;
    expect(row.getAttribute('aria-label')).toBe('العميل، إجابة قصيرة، مطلوب');
    expect(row.querySelector('.fd-outline-required')?.getAttribute('title')).toBe('مطلوب');
    expect(row.querySelector('.fd-outline-kind')?.textContent).toBe(' · إجابة قصيرة');
  });

  it('says an empty page, tabs and blocks by their Arabic kinds', () => {
    const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
    designer.addBlock('heading', { parent: 'section-1' });
    designer.addBlock('divider', { parent: 'section-1' });
    const rows = outlineRows(designer.getPage(), ar);
    expect(rows.map((r) => r.kind)).toEqual(['مجموعة', 'عنوان', 'خط فاصل']);
    expect(rows[1].label).toBe('عنوان جديد');
    const empty = createDesigner({ page: { ...blankPage('screen', 'زيارة', { locale: 'ar' }), layout: { type: 'form', id: 'form', children: [] } } as never, locale: 'ar' });
    expect(mountOutline(empty).querySelector('.fd-properties-hint')?.textContent).toBe('لا شيء في الصفحة بعد.');
  });

  it('says where a move goes, and why one cannot, in Arabic', () => {
    const { designer, ids } = visit();
    const second = (designer.getPage().layout as { children: { id: string }[] }).children[1].id;
    expect(designer.describeMove([ids['customer']], 'section-1', 0)).toBe('في مكانه الحالي');
    expect(designer.describeMove([ids['customer']], 'section-1', 2)).toBe(`بعد ${q('تاريخ الزيارة')}`);
    expect(designer.describeMove([ids['customer']], second, 0)).toBe(`إلى داخل ${q('المتابعة')}، في النهاية`);
    expect(designer.describeMove([ids['customer'], ids['date']], designer.getPage().layout.id, 0)).toBe(`إلى الصفحة، قبل ${q('القسم 1')}`);
    expect(designer.moveRefusal(['section-1'], 'section-1')).toBe('لا يمكن وضع الجزء داخل نفسه');
    expect(designer.moveRefusal([], 'section-1')).toBe('اختر جزءًا لنقله');
    expect(designer.moveRefusal([ids['customer']], 'nowhere')).toBe(`لا يوجد جزء ${q('nowhere')}`);
  });

  it('says what Alt and an arrow cannot do, and a move done, in Arabic', () => {
    const { designer, ids } = visit();
    const page = designer.getPage();
    expect(outlineKeyMove(page, [ids['customer']], { key: 'ArrowUp', altKey: true }, true, ar)).toEqual({ said: `في أعلى ${q('القسم 1')} بالفعل: اضغط ⁦Alt+→⁩ لإخراجه` });
    expect(outlineKeyMove(page, [ids['customer'], ids['date']], { key: 'ArrowUp', altKey: true }, false, ar)).toEqual({ said: `في أعلى ${q('القسم 1')} بالفعل: اضغط ⁦Alt+←⁩ لإخراجها` });
    expect(outlineKeyMove(page, ['section-1'], { key: 'ArrowUp', altKey: true }, true, ar)).toEqual({ said: 'في أعلى الصفحة بالفعل' });
    expect(outlineKeyMove(page, ['section-1'], { key: 'ArrowRight', altKey: true }, true, ar)).toEqual({ said: 'على الصفحة نفسها، خارج أي مجموعة' });
    expect(outlineKeyMove(page, ['section-1'], { key: 'ArrowLeft', altKey: true }, true, ar)).toEqual({ said: 'لا مجموعة قبله لوضعه فيها' });
    const outline = mountOutline(designer);
    designer.select(ids['customer']);
    const row = outline.querySelector(`[data-pick="${ids['customer']}"]`) as HTMLElement;
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));
    expect(said.pop()).toBe(`العميل: بعد ${q('تاريخ الزيارة')}`);
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(said.pop()).toBe(`تمت إزالة ${q('العميل')} من الصفحة`);
  });

  it('says a survey’s edges and refusals in Arabic', () => {
    const { designer, first, question } = survey();
    expect(outlineKeyMove(designer.getPage(), [question], { key: 'ArrowUp', altKey: true }, true, ar)).toEqual({ said: 'في أعلى الصفحة الأولى بالفعل' });
    expect(outlineKeyMove(designer.getPage(), [question], { key: 'ArrowRight', altKey: true }, true, ar)).toEqual({ said: 'يوضع السؤال في صفحة' });
    expect(designer.moveRefusal([question], (designer.getPage().layout as { id: string }).id)).toBe('يوضع السؤال في صفحة');
    designer.addContainer('الصفحة 2');
    const second = (designer.getPage().layout as { children: { id: string }[] }).children[1].id;
    expect(designer.moveRefusal([second], first)).toBe('الصفحة تحمل أسئلة، لا صفحات أخرى');
  });
});

describe('the clipboard, in Arabic', () => {
  it('says each copy, cut and paste in Arabic, a count after the word it belongs to', () => {
    const { designer, ids } = visit();
    const root = document.createElement('div');
    document.body.append(root);
    clipboardKeys({ root, designer, active: () => true });
    const said = () => root.querySelector('.fd-clipboard-said')?.textContent;
    const data = new Map<string, string>();
    designer.select(ids['date']);
    fire('copy', data);
    expect(said()).toBe(`تم نسخ ${q('تاريخ الزيارة')}`);
    designer.pickMany([ids['customer'], ids['date']]);
    fire('copy', data);
    expect(said()).toBe('تم نسخ جزأين');
    fire('paste', data);
    expect(said()).toBe('تم لصق جزأين');
    fire('cut', data);
    expect(said()).toBe('تم قص جزأين');
    fire('paste', new Map([['text/plain', 'مرحبا']]));
    expect(said()).toBe('لا أجزاء من Fieldia للصق: انسخ أجزاء في مصمم Fieldia أولًا');
  });

  it('says the rules left off a paste, in each count', () => {
    expect(ar.clipboard.pasted(q('س'), 1)).toBe(`تم لصق ${q('س')}؛ وتُركت قاعدة واحدة: تقرأ حقلًا ليس في هذه الصفحة`);
    expect(ar.clipboard.pasted(q('س'), 2)).toBe(`تم لصق ${q('س')}؛ وتُركت قاعدتان: تقرآن حقلًا ليس في هذه الصفحة`);
    expect(ar.clipboard.pasted(q('س'), 3)).toBe(`تم لصق ${q('س')}؛ وتُركت 3 قواعد: تقرأ حقلًا ليس في هذه الصفحة`);
  });

  it('refuses a survey’s pages on a screen in Arabic', () => {
    const { designer } = visit();
    const text = JSON.stringify({ fieldia: 'fieldia-parts', version: 1, parts: [{ type: 'step', id: 's', label: 'ص', children: [] }], fields: {} });
    expect(designer.pasteParts(text)).toBe(false);
    expect(designer.getState().issues).toEqual(['صفحات الاستبيان توضع في استبيان']);
  });
});
