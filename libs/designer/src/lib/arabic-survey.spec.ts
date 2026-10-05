import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** The survey editor in Arabic: its cards, the bar beside them, a question's settings. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'استبيان', { locale: 'ar' }), locale: 'ar' });
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountSurveyEditor(host, { designer });
  return { designer, root: handle.element };
}
const text = (scope: Element, selector: string) => scope.querySelector(selector)?.textContent?.trim();
const shownButtons = (scope: Element) => [...scope.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.closest('[hidden]'));

describe('the survey editor, in Arabic', () => {
  it('heads the form and its page in Arabic, its words its own way', () => {
    const { root } = survey();
    const title = root.querySelector('.fd-survey-head-title') as HTMLInputElement;
    expect([title.getAttribute('aria-label'), title.placeholder, title.dir]).toEqual(['رأس النموذج', 'نموذج بلا عنوان', 'auto']);
    expect(text(root, '.fd-step-number')).toBe('الصفحة 1 من 1');
    expect((root.querySelector('.fd-step-title') as HTMLInputElement).value).toBe('الصفحة 1');
    expect(text(root, '.fd-add-question')).toBe('إضافة سؤال');
  });

  it('draws a closed question as people will see it, and an open one with its tools in Arabic', () => {
    const { designer, root } = survey();
    const id = designer.addQuestion('short-answer', { parent: 'step-1' }) as string;
    expect(text(root, `.fd-q[data-node="${id}"] .fd-q-preview`)).toBe('نص إجابة قصيرة');
    designer.select(id);
    const card = root.querySelector(`.fd-q-selected[data-node="${id}"]`) as HTMLElement;
    expect((card.querySelector('.fd-q-label') as HTMLInputElement).placeholder).toBe('السؤال');
    expect(card.querySelector('.fd-q-kind')?.getAttribute('aria-label')).toBe('نوع السؤال: إجابة قصيرة');
    expect(text(card, '.fd-q-required-words')).toBe('مطلوب');
    expect(shownButtons(card).map((b) => b.getAttribute('aria-label')).filter(Boolean)).toEqual(expect.arrayContaining(['تكرار', 'حذف', 'مطلوب', 'خيارات أخرى']));
    (card.querySelector('[aria-label="خيارات أخرى"]') as HTMLButtonElement).click();
    expect([...root.querySelectorAll('.fd-menu .fd-menu-label')].map((l) => l.textContent)).toEqual(['الوصف', 'قواعد الإجابة', 'محسوب من إجابات أخرى']);
    expect((root.querySelector('.fd-menu') as HTMLElement).dir).toBe('rtl');
  });

  it('names the kinds in its menu, and a kind’s own settings, in Arabic', () => {
    const { designer, root } = survey();
    const id = designer.addQuestion('rating', { parent: 'step-1' }) as string;
    designer.select(id);
    const card = root.querySelector(`.fd-q-selected[data-node="${id}"]`) as HTMLElement;
    (card.querySelector('.fd-q-kind') as HTMLButtonElement).click();
    const kinds = [...root.querySelectorAll('.fd-menu .fd-menu-label')].map((l) => l.textContent);
    expect(kinds.slice(0, 3)).toEqual(['إجابة قصيرة', 'فقرة', 'البريد الإلكتروني']);
    expect(root.querySelector('.fd-menu')?.getAttribute('aria-label')).toBe('نوع السؤال');
    expect([...card.querySelectorAll('.fd-inline-setting > span')].map((s) => s.textContent)).toEqual(expect.arrayContaining(['المستويات', 'الرمز', 'البداية', 'النهاية']));
  });

  it('adds a page and a question from the bar beside the card, named in Arabic', () => {
    const { designer, root } = survey();
    const rail = root.querySelector('.fd-q-rail') as HTMLElement;
    expect(rail.getAttribute('aria-label')).toBe('إضافة');
    (rail.querySelector('[aria-label="إضافة صفحة بعد هذا السؤال"]') as HTMLButtonElement).click();
    const steps = (designer.getPage().layout as { children: { label: string }[] }).children;
    expect(steps.map((s) => s.label)).toEqual(['الصفحة 1', 'الصفحة 2']);
  });
});
