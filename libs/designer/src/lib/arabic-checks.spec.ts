import { blankPage, createDesigner, pageChanges } from './designer';
import { ar } from './locales/ar';
import { mount } from './test-editor';

/** Checks before publishing, and what changed since the last version, in Arabic. */

const q = (name: string) => `«⁨${name}⁩»`;
const arabicScreen = () => createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });

afterEach(() => document.body.replaceChildren());

describe('checks, in Arabic', () => {
  it('knows the words it wrote itself, in either language, for words not typed yet', () => {
    const designer = arabicScreen();
    const id = designer.addQuestion('dropdown', { parent: 'section-1' }) as string;
    expect(designer.checks().map((c) => [c.text, c.fix?.label])).toEqual([
      ['حقل بلا نص بعد: سيقرأ الناس «⁨سؤال بلا عنوان⁩».', 'اكتب نصه'],
      [`${q('سؤال بلا عنوان')} ما زال يعرض الخيار 1 خياراتٍ له.`, 'اكتب خياراته'],
    ]);
    designer.updateQuestion(id, { label: 'المدينة' });
    designer.setOptions(id, ['القاهرة', 'الجيزة']);
    expect(designer.checks()).toEqual([]);
    // An English designer knows the Arabic one's words too: the page may be made in one and opened in the other.
    const english = createDesigner({ page: arabicScreen().getPage() });
    english.addQuestion('short-answer', { parent: 'section-1' });
    const page = english.getPage();
    const arabicMade = createDesigner({ page, locale: 'ar' });
    arabicMade.addQuestion('short-answer', { parent: 'section-1' });
    expect(createDesigner({ page: arabicMade.getPage() }).checks().filter((c) => c.text.startsWith('A field has no words yet')).length).toBe(2);
  });

  it('says what would stop people, and its fix, for an empty section and two fields alike', () => {
    const designer = arabicScreen();
    const a = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    const b = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    designer.updateQuestion(a, { label: 'الاسم' });
    designer.updateQuestion(b, { label: 'الاسم' });
    designer.addContainer('المتابعة');
    expect(designer.checks().map((c) => [c.text, c.fix?.label])).toEqual([
      [`لا حقول في ${q('المتابعة')}: سيظهر مربعًا فارغًا.`, 'حذف القسم'],
      [`حقلان نصهما ${q('الاسم')}: قد لا يميّز الناس بينهما.`, 'إعادة تسمية الثاني'],
    ]);
  });

  it('lists the checks in Arabic, each with how much it matters', () => {
    const designer = arabicScreen();
    designer.addQuestion('short-answer', { parent: 'section-1' });
    const { host } = mount(designer);
    const button = host.querySelector('[data-checks]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('التحقق: أمر واحد للمراجعة');
    button.click();
    const panel = host.querySelector('.fd-checks') as HTMLElement;
    expect(panel.getAttribute('aria-label')).toBe('التحقق قبل النشر');
    expect(panel.querySelector('.fd-menu-title')?.textContent).toBe('أمر واحد يحتاج إلى مراجعة قبل النشر');
    expect(panel.querySelector('.fd-check-severity')?.textContent).toBe('يُستحسن إصلاحه');
  });
});

describe('what changed, in Arabic', () => {
  it('says the first version, and each change as a line', async () => {
    const designer = arabicScreen();
    const city = designer.addQuestion('dropdown', { parent: 'section-1' }) as string;
    designer.updateQuestion(city, { label: 'المدينة' });
    designer.setOptions(city, ['القاهرة', 'الجيزة']);
    expect(pageChanges(null, designer.getPage(), ar)).toEqual(['الإصدار الأول: حقل واحد في قسم واحد']);
    await designer.publish();
    const before = designer.getPage();
    designer.updateQuestion(city, { label: 'المحافظة', required: true });
    designer.setOptions(city, ['القاهرة', 'الإسكندرية']);
    designer.setPageInfo({ title: 'زيارة ميدانية' });
    const added = designer.addQuestion('date', { parent: 'section-1' }) as string;
    designer.updateQuestion(added, { label: 'تاريخ الزيارة' });
    expect(pageChanges(before, designer.getPage(), ar)).toEqual([
      `العنوان: ${q('زيارة')} ← ${q('زيارة ميدانية')}`,
      `إضافة ${q('تاريخ الزيارة')}`,
      `إعادة تسمية ${q('المدينة')} إلى ${q('المحافظة')}`,
      `${q('المحافظة')}: أصبح مطلوبًا`,
      // The second option's words changed in place: it keeps its value, so its answers stay.
      `${q('المحافظة')}: تغيّرت خياراته`,
    ]);
  });

  it('says the look and a group’s settings in Arabic, never a value in English', () => {
    const designer = arabicScreen();
    const before = designer.getPage();
    designer.setLook({ density: 'compact', font: 'serif' });
    designer.setColumns('section-1', 3);
    expect(pageChanges(before, designer.getPage(), ar)).toEqual(['الخط: كما في النمط ← خط مذيّل', 'التباعد: كما في النمط ← متقارب', `${q('القسم 1')}: 3 أعمدة`]);
  });

  it('opens Publish in Arabic, with its count of changes', async () => {
    const designer = arabicScreen();
    designer.addQuestion('short-answer', { parent: 'section-1' });
    await designer.publish();
    designer.addQuestion('email', { parent: 'section-1' });
    designer.addQuestion('phone', { parent: 'section-1' });
    const { host } = mount(designer);
    const publish = [...host.querySelectorAll<HTMLButtonElement>('.fd-designer-bar button')].find((b) => b.textContent === 'نشر') as HTMLButtonElement;
    publish.click();
    const dialog = host.querySelector('.fd-publish-dialog') as HTMLElement;
    expect(dialog.querySelector('.fd-form-dialog-title')?.textContent).toBe('نشر الإصدار 2؟');
    expect(dialog.querySelector('.fd-publish-lead')?.textContent).toBe('تغييران منذ الإصدار 1:');
  });
});
