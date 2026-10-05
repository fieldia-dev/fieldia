import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { readJson } from './json-text';
import { jsonView, type JsonView } from './json-view';
import { ar } from './locales/ar';
import { tryIt, type TryIt } from './try-it';

/** The page as JSON, with the designer in Arabic: the view and its state in Arabic, each mistake in the text said in Arabic, the JSON itself left to right. */

let view: JsonView | null = null;
let trial: TryIt | null = null;
afterEach(() => {
  view?.destroy();
  trial?.destroy();
  view = trial = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});

function setup() {
  jest.useFakeTimers();
  const designer = createDesigner({ page: blankPage('survey', 'رأي الحضور', { locale: 'ar' }), locale: 'ar' });
  const coming = designer.addQuestion('yes-no') as string;
  designer.updateQuestion(coming, { label: 'هل ستحضر؟' });
  const el = elementFactory(document);
  const body = el('div', { class: 'body' });
  trial = tryIt({ el, doc: document, designer, skin: 'outlined', onChange: (trying) => (body.hidden = trying) });
  view = jsonView({ el, doc: document, designer, trial, body });
  document.body.append(trial.toggle, body, trial.element, view.element);
  const box = () => view?.element.querySelector('textarea') as HTMLTextAreaElement;
  const type = (text: string) => {
    box().value = text;
    box().dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(400);
  };
  const state = () => view?.element.querySelector('.fd-json-state')?.textContent;
  const rows = () => [...(view?.element.querySelectorAll('.fd-json-problem') ?? [])].map((li) => [...li.children].map((c) => c.textContent));
  return { designer, box, type, state, rows, open: () => (trial?.toggle.querySelector('[data-mode="json"]') as HTMLButtonElement).click() };
}

describe('the page as JSON, in Arabic', () => {
  it('says the view, its buttons and its state in Arabic; the JSON runs left to right', () => {
    const { open, box, type, state } = setup();
    open();
    const element = view?.element as HTMLElement;
    expect(element.getAttribute('aria-label')).toBe('الصفحة بصيغة JSON');
    expect(element.querySelector('.fd-json-heading')?.textContent).toBe('الصفحة بصيغة JSON');
    expect(element.querySelector('.fd-json-code')?.getAttribute('dir')).toBe('ltr');
    expect(state()).toBe('لا شيء للتطبيق: النص هو الصفحة كما هي.');
    expect([...element.querySelectorAll('.fd-json-actions button')].map((b) => b.textContent)).toEqual(['نسخ JSON', 'تطبيق', 'تطبيق', 'تجاهل', 'متابعة التحرير']);
    type(box().value.replace('"رأي الحضور"', '"رأي"'));
    expect(state()).toMatch(/^تغيّر هنا ولم يُطبَّق بعد: اضغط «تطبيق» أو ⁦(⌘|Ctrl\+)Enter⁩\.$/);
  });

  it('says each mistake in the text in Arabic, on its line', () => {
    const { open, type, state, rows } = setup();
    open();
    type('{ "title": "رأي", }');
    expect(rows()).toEqual([['السطر 1', 'لا يمكن التطبيق', 'لا شيء بعد هذه الفاصلة: احذفها']]);
    expect(state()).toBe('مشكلة واحدة يجب إصلاحها قبل التطبيق.');
    type('');
    expect(rows()[0][2]).toBe('المربع فارغ: الصفحة كائن JSON، ⁦{ … }⁩');
  });

  it('says a check in Arabic, and the format’s own words as the format words them', () => {
    const { open, box, type, rows } = setup();
    open();
    const page = JSON.parse(box().value);
    page.layout.children[0].children[0].field = 'nope';
    type(JSON.stringify(page, null, 2));
    const said = rows().map((row) => row.slice(1));
    expect(said).toContainEqual(['لا يمكن التطبيق', 'لا تقبله صيغة الصفحة: ⁦no field "nope"⁩']);
  });

  it('words every mistake JSON can have in Arabic', () => {
    const said = (text: string) => {
      const read = readJson(text, ar);
      return read.ok ? null : read.problem.message;
    };
    expect(said("{ 'a': 1 }")).toBe('يوضع النص بين علامتي تنصيص مزدوجتين');
    expect(said('{ a: 1 }')).toBe('يوضع المفتاح بين علامتي تنصيص مزدوجتين، مثل ⁦"a"⁩');
    expect(said('{ "a" 1 }')).toBe('تنقص نقطتان بعد المفتاح');
    expect(said('{ "a": 1 "b": 2 }')).toBe('تنقص فاصلة قبل هذا');
    expect(said('[1 2]')).toBe('تنقص هنا فاصلة أو ⁦]⁩ للإغلاق');
    expect(said('{ "a": [1, 2')).toBe('ينتهي النص مبكرًا: تنقص ⁦]⁩ للإغلاق');
    expect(said('{ "a": 01 }')).toBe('لا يمكن أن يبدأ الرقم بأصفار زائدة');
    expect(said('{} {}')).toBe('يوجد نص بعد النهاية: ⁦{ … }⁩ واحد هو الصفحة كلها');
    expect(said('{ "a": // no\n1 }')).toBe('لا تقبل JSON التعليقات');
  });
});
