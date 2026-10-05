import type { Page } from '@fieldia/core';

type SelectionField = { options: { value: string | number; label: string }[] };
import type { DesignerAssistant } from './assistant';
import { blankPage, createDesigner } from './designer';
import { ar } from './locales/ar';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { forPlatform, shortcutGroups } from './shortcuts-list';
import { screenTemplates, SURVEY_TEMPLATES, surveyTemplates } from './templates';

/** A blank page's start in Arabic: the templates in Arabic words, the assistant's box and what it says, and the sheet of shortcuts. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function later() {
  let answer: (page: Page) => void = () => undefined;
  const assistant: DesignerAssistant = { describe: () => new Promise<Page>((resolve) => (answer = resolve)), name: 'مساعد تجريبي' };
  return { assistant, answer: (page: Page) => answer(page) };
}
const settle = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
function survey(assistant?: DesignerAssistant) {
  const designer = createDesigner({ page: blankPage('survey', 'رأي العملاء', { locale: 'ar' }), locale: 'ar' });
  const root = document.createElement('div');
  document.body.append(root);
  handle = mountSurveyEditor(root, { designer, assistant });
  return { root, designer };
}
const button = (scope: Element, name: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => !b.closest('[hidden]') && (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);

describe('templates, in Arabic', () => {
  it('offers Fieldia’s templates in Arabic words, their answers kept under the English values', () => {
    const [feedback, event, job] = surveyTemplates('ar');
    expect([feedback.title, event.title, job.title]).toEqual(['رأي العملاء', 'التسجيل في فعالية', 'طلب توظيف']);
    expect(Object.values(feedback.page.fields).map((f) => f.label)).toEqual(['ما تقييمك العام؟', 'ما الذي أعجبك أكثر؟', 'ما الذي يمكننا تحسينه؟', 'ما مدى احتمال أن توصي بنا؟', 'بريدك الإلكتروني، للرد عليك']);
    const sessions = event.page.fields['sessions'] as unknown as SelectionField;
    const english = SURVEY_TEMPLATES[1].page.fields['sessions'] as unknown as SelectionField;
    expect(sessions.options.map((o) => o.value)).toEqual(english.options.map((o) => o.value));
    expect(sessions.options.map((o) => o.label)).toEqual(['محاضرات الصباح', 'ورشة الظهيرة', 'عشاء المساء']);
    const [contact, order] = screenTemplates('ar');
    expect([contact.title, order.title]).toEqual(['جهة اتصال', 'طلب شراء']);
    expect((order.page.fields['status'] as unknown as SelectionField).options.map((o) => o.label)).toEqual(['مسودة', 'مؤكَّد', 'منجز']);
  });

  it('says the start in Arabic, and picks a template in Arabic', () => {
    const { root, designer } = survey();
    const start = root.querySelector('.fd-start') as HTMLElement;
    expect(start.querySelector('.fd-start-title')?.textContent).toBe('البدء من قالب');
    expect(start.querySelector('.fd-start-lead')?.textContent).toBe('اختر قالبًا لتجعله نموذجك، أو ابدأ بصفحة فارغة وأضف الأسئلة واحدًا تلو الآخر.');
    expect([...start.querySelectorAll('.fd-start-card-title')].map((t) => t.textContent)).toEqual(['رأي العملاء', 'التسجيل في فعالية', 'طلب توظيف']);
    expect(button(start, 'البدء بصفحة فارغة')).toBeDefined();
    (start.querySelector('[data-template="feedback"]') as HTMLButtonElement).click();
    expect(root.querySelector('.fd-start-done-words')?.textContent).toBe('تم البدء من القالب «⁨رأي العملاء⁩».');
    expect(button(root.querySelector('.fd-start-done') as HTMLElement, 'تراجع')).toBeDefined();
    expect(designer.getPage().title).toBe('رأي العملاء');
  });

  it('refuses a screen in place of a survey in Arabic', () => {
    const { designer } = survey();
    expect(designer.replacePage(screenTemplates('ar')[0].page)).toBe(false);
    expect(designer.getState().issues).toEqual(['الاستبيان مكوّن من صفحات أسئلة: وهذه شاشة من أقسام']);
  });
});

describe('the assistant, in Arabic', () => {
  it('says its box, its wait and what it built in Arabic', async () => {
    const app = later();
    const { root } = survey(app.assistant);
    const form = root.querySelector('.fd-start .fd-assist') as HTMLFormElement;
    const area = form.querySelector('textarea') as HTMLTextAreaElement;
    expect(form.querySelector(`label[for="${area.id}"]`)?.textContent).toBe('صِف النموذج الذي تحتاجه');
    button(form, 'إنشاء')?.click();
    expect(form.querySelector('.fd-assist-problem')?.textContent).toBe('اكتب الغرض من النموذج، وما الذي ينبغي أن يسأله.');
    area.value = 'نموذج رأي';
    button(form, 'إنشاء')?.click();
    expect(form.querySelector('.fd-assist-busy')?.textContent).toBe('جارٍ إنشاء نموذجك…');
    expect(button(form, 'إلغاء')).toBeDefined();
    app.answer(surveyTemplates('ar')[0].page);
    await settle();
    expect(root.querySelector('.fd-start-done-words')?.textContent).toBe('أنشأ المساعد النموذج:');
  });

  it('says why its answer cannot be used, or what failed, in Arabic', () => {
    expect(ar.assistant.cannotBeUsed(ar.templates.surveyNotScreen)).toBe('لا يمكن استخدام نموذج المساعد: الاستبيان مكوّن من صفحات أسئلة: وهذه شاشة من أقسام');
    expect(ar.assistant.couldNot(null)).toBe('تعذّر على المساعد تنفيذ ذلك.');
  });
});

describe('the sheet of shortcuts, in Arabic', () => {
  it('names its groups, says when each works, and lists the keys in Arabic', () => {
    const groups = shortcutGroups({ survey: false, words: ar });
    expect(groups.map((g) => [g.name, g.title])).toEqual([
      ['Anywhere', 'في أي مكان'],
      ['Canvas', 'مساحة التصميم'],
      ['Outline', 'المخطط'],
      ['Typing', 'أثناء الكتابة'],
    ]);
    expect(groups[0].keys).toEqual(expect.arrayContaining(ar.clipboard.keys));
    expect(groups[2].keys).toEqual(ar.outline.keys);
    expect(forPlatform('⌘ + نقر', false)).toBe('Ctrl + نقر');
    expect(forPlatform('إضافة صف إلى المختار أو إزالته منه (Ctrl + نقر في ويندوز)', true)).toBe('إضافة صف إلى المختار أو إزالته منه');
  });

  it('opens on “?” in Arabic, its keys in boxes and “أو” between them', () => {
    const { root } = survey();
    root.querySelector<HTMLButtonElement>('.fd-start-blank')?.click();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }));
    const sheet = root.querySelector('.fd-keys') as HTMLElement;
    expect(sheet.querySelector('.fd-keys-title')?.textContent).toBe('اختصارات لوحة المفاتيح');
    expect((sheet.querySelector('.fd-keys-find') as HTMLInputElement).placeholder).toBe('ابحث عن مفتاح أو عمّا يفعله');
    expect([...sheet.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['في أي مكان', 'المخطط', 'أثناء الكتابة']);
    const first = sheet.querySelector('.fd-keys-row dt') as HTMLElement;
    expect([...first.childNodes].map((n) => n.textContent)).toEqual([expect.stringMatching(/^(⌘K|Ctrl\+K)$/), ' أو ', '/']);
    const find = sheet.querySelector('.fd-keys-find') as HTMLInputElement;
    find.value = 'تراجع';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...sheet.querySelectorAll('.fd-keys-row:not([hidden]) dd')].map((d) => d.textContent)).toEqual(['تراجع']);
  });
});
