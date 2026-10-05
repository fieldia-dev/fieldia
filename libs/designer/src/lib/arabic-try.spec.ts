import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { tryIt, type TryIt } from './try-it';

/** Try it with the designer in Arabic: its bar, its drawer and Find anything's ways in say Arabic; the form tried keeps the page's own words and direction. */

let handle: TryIt | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function setup(locale: 'ar' | undefined = 'ar') {
  const designer = createDesigner({ page: blankPage('screen', 'Site visit'), locale });
  const id = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(id, { label: 'Customer', required: true });
  handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined });
  document.body.append(handle.toggle, handle.element);
  const mode = (name: string) => handle?.toggle.querySelector(`button[data-mode="${name}"]`) as HTMLButtonElement;
  const control = (name: string) => handle?.element.querySelector(`button[data-try="${name}"]`) as HTMLButtonElement;
  const viewer = () => handle?.element.querySelector('.fd-try-frame form.fd-form') as HTMLFormElement | null;
  return { designer, mode, control, viewer };
}

describe('Try it, in Arabic', () => {
  it('says its switch, its bar and its sizes in Arabic; each language by its own name', () => {
    const { mode, control } = setup();
    expect(handle?.toggle.getAttribute('aria-label')).toBe('تصميم الصفحة أو تجربتها');
    expect([mode('design').textContent, mode('try').textContent]).toEqual(['تصميم', 'تجربة']);
    mode('try').click();
    expect(handle?.element.getAttribute('aria-label')).toBe('تجربة الصفحة');
    expect(handle?.element.querySelector('.fd-try-note')?.textContent).toBe('تعمل الصفحة هنا كما سيستخدمها الناس. لا يُحفظ شيء مما يُكتب هنا.');
    expect(['desktop', 'tablet', 'phone'].map((name) => control(name).getAttribute('aria-label'))).toEqual(['سطح المكتب', 'جهاز لوحي', 'هاتف']);
    expect([control('ltr').textContent, control('ltr').lang, control('rtl').textContent, control('rtl').lang]).toEqual(['English', 'en', 'العربية', 'ar']);
  });

  it('keeps the form tried in the page’s own words and direction', () => {
    const { mode, viewer, control } = setup();
    mode('try').click();
    expect(viewer()?.getAttribute('dir')).toBe('ltr');
    expect(viewer()?.querySelector('.fd-label')?.textContent).toContain('Customer');
    control('rtl').click();
    expect(viewer()?.getAttribute('dir')).toBe('rtl');
  });

  it('tries a page written in Arabic right to left from the start, until a direction is pressed', () => {
    const { designer, mode, viewer, control } = setup();
    designer.setPageLanguage('ar');
    mode('try').click();
    expect(viewer()?.getAttribute('dir')).toBe('rtl');
    expect(control('rtl').getAttribute('aria-pressed')).toBe('true');
    control('ltr').click();
    mode('design').click();
    mode('try').click();
    expect(viewer()?.getAttribute('dir')).toBe('ltr');
  });

  it('says the drawer of data and problems in Arabic', () => {
    const { mode } = setup();
    mode('try').click();
    const drawer = handle?.element.querySelector('.fd-try-drawer') as HTMLElement;
    expect(drawer.getAttribute('aria-label')).toBe('البيانات والمشكلات');
    expect([...drawer.querySelectorAll('.fd-try-tab')].map((t) => t.firstChild?.textContent)).toEqual(['البيانات', 'المشكلات']);
    expect(drawer.querySelector('.fd-try-copy')?.textContent).toBe('نسخ البيانات');
    expect(drawer.querySelector('.fd-try-fold')?.textContent).toBe('إظهار');
    expect(drawer.querySelector('.fd-try-data')?.getAttribute('aria-label')).toBe('الإجابات بصيغة JSON');
  });

  it('offers Find anything’s ways in, in Arabic', () => {
    setup();
    expect(handle?.items().map((item) => [item.label, item.hint])).toEqual([
      ['تجربة', 'كما سيستخدمها الناس'],
      ['التجربة بعرض الهاتف', 'تجربة'],
      ['التجربة بالعربية، من اليمين إلى اليسار', 'تجربة'],
    ]);
    handle?.start();
    expect(handle?.items().map((item) => item.label)).toEqual(['العودة إلى التصميم']);
  });

  it('says the languages the page keeps in Arabic', () => {
    const { designer, mode } = setup();
    designer.addLanguage('fr');
    mode('try').click();
    const picker = handle?.element.querySelector('.fd-try-language') as HTMLElement;
    expect(picker.querySelector('.fd-try-language-words')?.textContent).toBe('النص بلغة');
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['الإنجليزية، كما كُتبت', 'الفرنسية']);
  });
});
