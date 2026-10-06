import { blankPage, createDesigner } from './designer';
import { mount, openTab, press } from './test-editor';

/** The panel in Arabic: its head, its tabs, each setting by its name, its search; each setting still known by its English name in `data-setting`. */

function visit() {
  const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
  const id = designer.addQuestion('dropdown', { parent: 'section-1' }) as string;
  designer.updateQuestion(id, { label: 'الحالة' });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  const tabs = () => [...panel.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
  const names = () => [...panel.querySelectorAll('[data-setting]:not([hidden]) > .fd-prop-name')].filter((n) => !n.closest('[hidden]')).map((n) => n.textContent);
  return { designer, host, panel, id, tabs, names };
}

afterEach(() => document.body.replaceChildren());

describe('the panel, in Arabic', () => {
  it('heads the page with its kind and tabs in Arabic', () => {
    const { panel, tabs } = visit();
    expect(panel.getAttribute('aria-label')).toBe('الخصائص');
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('شاشة');
    expect(tabs()).toEqual(['المحتوى', 'التخطيط', 'المظهر', 'القواعد']);
    expect([...panel.querySelectorAll('.fd-properties-hint')].map((h) => h.textContent)).toContain('لم يُختر شيء، فهذه إعدادات الشاشة نفسها. اختر حقلًا أو قسمًا لتغييره.');
  });

  it('names a field’s settings in Arabic, keeping the English name each is known by', () => {
    const { designer, panel, id, tabs, names } = visit();
    designer.select(id);
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('قائمة منسدلة');
    expect(tabs()).toEqual(['المحتوى', 'التخطيط', 'القواعد', 'البيانات']);
    expect(names()).toEqual(expect.arrayContaining(['التسمية', 'نص المساعدة', 'العرض بشكل', 'الخيارات']));
    expect(panel.querySelector('[data-setting="Label"] .fd-prop-name')?.textContent).toBe('التسمية');
    openTab(panel, 'البيانات');
    expect(panel.querySelector('[data-setting="Stored as"] .fd-insp-chip')?.textContent).toBe('عنصر واحد من قائمة');
    openTab(panel, 'القواعد');
    expect(panel.querySelector('[data-setting="When it shows"] .fd-prop-name')?.textContent).toBe('متى يظهر');
  });

  it('finds a setting by its Arabic name, listed under its tab', () => {
    const { designer, panel, id } = visit();
    designer.select(id);
    const box = panel.querySelector('.fd-insp-search-box') as HTMLInputElement;
    expect(box.placeholder).toBe('البحث في الإعدادات');
    box.value = 'نص';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const found = [...panel.querySelectorAll('.fd-insp-found-option .fd-insp-found-name')].map((n) => n.textContent);
    expect(found).toEqual(expect.arrayContaining(['نص المساعدة']));
    expect(panel.querySelector('.fd-insp-found-tab')?.textContent).toBe('المحتوى');
    box.value = 'zebra';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(panel.querySelector('.fd-insp-none')?.textContent).toBe('لا إعداد باسم «⁨zebra⁩».');
  });

  it('lists the page’s look in Arabic, from its presets to its colours', () => {
    const { panel, names } = visit();
    openTab(panel, 'المظهر');
    expect(names()).toEqual(['ابدأ من', 'لون التمييز', 'الخط', 'التباعد', 'الزوايا', 'التسميات', 'الألوان', 'كل نوع من الأجزاء']);
    expect([...panel.querySelectorAll('.fd-look-preset-name')].map((n) => n.textContent)).toEqual(['Fieldia', 'هادئ', 'متقارب', 'مستدير', 'ليلي']);
    expect([...panel.querySelectorAll('[data-setting="Spacing"] .fd-seg-words')].map((n) => n.textContent)).toEqual(['متقارب', 'مريح', 'واسع']);
  });

  it('finds a setting from Find anything in Arabic', () => {
    const { designer, host, id } = visit();
    designer.select(id);
    press('k', { metaKey: true }, document.body);
    const box = host.querySelector('.fd-find-input') as HTMLInputElement;
    box.value = 'المساعدة';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const found = [...host.querySelectorAll('.fd-find-option')].map((o) => [o.querySelector('.fd-find-label')?.textContent, o.querySelector('.fd-find-hint')?.textContent]);
    expect(found).toContainEqual(['نص المساعدة', 'إعداد · المحتوى']);
  });
});
