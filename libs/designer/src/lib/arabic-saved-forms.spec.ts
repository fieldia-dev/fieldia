import type { FormNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore } from './designer';
import { lookChanges } from './layout-changes';
import { formChecks } from './saved-forms';
import { ar } from './locales/ar';
import { mount, openTab, tile } from './test-editor';

/** Each kind of part's look, and a saved form placed in another, with the designer in Arabic: the Look tab, the tile, the frame, the panel, the checks and what is refused. */

const q = (name: string) => `«⁨${name}⁩»`;
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A saved Address written in English, keeping its Arabic words, as an app's saved forms do. */
const address: Page = {
  fieldia: '0.1',
  id: 'address',
  title: 'Address',
  data: { kind: 'responses' },
  fields: { street: { type: 'char', label: 'Street', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 'where', children: [{ type: 'field', id: 'street', field: 'street' }] }] },
  translations: { ar: { Address: 'العنوان', Street: 'الشارع' } },
};

async function editor() {
  const store = createMemoryPageStore();
  await store.publish(address);
  const designer = createDesigner({ page: { ...blankPage('screen', 'زيارة', { locale: 'ar' }), id: 'visit' }, store, locale: 'ar', openForm: () => undefined });
  designer.updateQuestion(designer.addQuestion('short-answer', { parent: 'section-1' }) as string, { label: 'الزائر' });
  const { host } = mount(designer, { mode: 'advanced' });
  return { designer, host };
}
const parts = (page: Page) => (page.layout as { children: SectionNode[] }).children[0].children.filter((n) => n.type === 'form') as FormNode[];

afterEach(() => document.body.replaceChildren());

describe('a saved form, in Arabic', () => {
  it('offers the tile and its menu in Arabic, and draws the frame in Arabic, the saved form in the page’s language', async () => {
    const { designer, host } = await editor();
    const more = tile(host, 'form:saved');
    expect([more.textContent, more.getAttribute('title')]).toEqual(['نموذج محفوظ', 'نموذج محفوظ: ضع أحد النماذج المحفوظة في التطبيق، مثل عنوان']);
    more.click();
    await settle();
    const menu = document.querySelector('.fd-menu') as HTMLElement;
    expect(menu.textContent).toContain('يوضع كاملًا، وتُحفظ إجاباته على حدة؛ ويُعدَّل في صفحته الخاصة.');
    (menu.querySelector('[data-item="address"]') as HTMLButtonElement).click();
    await settle();
    const [part] = parts(designer.getPage());
    const frame = host.querySelector(`.fd-canvas-form[data-node="${part.id}"]`) as HTMLElement;
    expect(frame.querySelector('.fd-canvas-form-tag')?.textContent).toBe(`نموذج محفوظ ${q('العنوان')} · أحدث إصدار`);
    expect(frame.querySelector('.fd-canvas-form-open')?.textContent).toBe('فتح النموذج');
    expect(frame.querySelector('.fd-canvas-form-body .fd-label')?.textContent).toContain('الشارع');
  });

  it('sets it from a panel in Arabic', async () => {
    const { designer, host } = await editor();
    const id = designer.addForm('address', { parent: 'section-1' }) as string;
    await designer.loadSavedForm('address');
    designer.select(id);
    await settle();
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('نموذج محفوظ');
    const names = [...panel.querySelectorAll('[data-setting]:not([hidden]) > .fd-prop-name')].map((n) => n.textContent);
    expect(names).toEqual(expect.arrayContaining(['النموذج المحفوظ', 'الإصدار', 'العنوان', 'تُحفظ الإجابات تحت', 'فتح النموذج']));
    const version = panel.querySelector('[aria-label="الإصدار"]') as HTMLSelectElement;
    expect(version.options[0].textContent).toBe('أحدث إصدار');
    expect(version.options[1].textContent).toMatch(/^الإصدار 1 · /);
    expect(designer.setForm(id, { name: 'عنوان' })).toBe(false);
    expect(designer.getState().issues).toEqual([`مكان حفظ الإجابات اسم من حروف وأرقام و⁦_⁩، يبدأ بحرف: ${q('answers')} مثلًا`]);
  });

  it('says what the Checks list finds in Arabic, and refuses a page inside itself in Arabic', async () => {
    const { designer } = await editor();
    // Written by hand: a copy's answers under a field's name, and a saved form the store has not got.
    const page = designer.getPage();
    const section = (page.layout as { children: SectionNode[] }).children[0];
    const written = {
      ...page,
      layout: { ...page.layout, children: [{ ...section, children: [...section.children, { type: 'form', id: 'f1', page: 'address', name: 'q_1' }, { type: 'form', id: 'f2', page: 'nowhere', name: 'other' }] }] },
    } as Page;
    const cache = { versions: (id: string) => (id === 'address' ? [{ version: 1, page: address }] : null), page: (id: string) => (id === 'address' ? address : null), load: async () => undefined, cycle: () => null };
    expect(formChecks(written, cache, ar).map((c) => [c.text, c.fix?.label])).toEqual([
      [`يحفظ نموذج محفوظ إجاباته تحت ${q('q_1')}، وهو اسم حقل: ستختلط الإجابات. أعطه اسمًا خاصًا به.`, undefined],
      [`تعذّر العثور على النموذج المحفوظ ${q('nowhere')}: سيقول النموذج ذلك في مكانه.`, 'إزالته من الصفحة'],
    ]);
    expect(designer.addForm('visit', { parent: 'section-1' })).toBe(false);
    expect(designer.getState().issues).toEqual(['لا يمكن وضع صفحة داخل نفسها']);
    expect(ar.savedForms.holdsThisPage('متابعة', ar.savedForms.way(['زيارة', 'متابعة', 'زيارة']))).toBe(`${q('متابعة')} يحتوي هذه الصفحة: ستوضع داخل نفسها (${q('زيارة')} ← ${q('متابعة')} ← ${q('زيارة')})`);
  });
});

describe('each kind of part’s look, in Arabic', () => {
  it('names the kinds, their settings and their values in Arabic, keeping each setting’s English name', () => {
    const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
    const { host } = mount(designer);
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'المظهر');
    const row = panel.querySelector('[data-setting="Each kind of part"]') as HTMLElement;
    expect(row.querySelector('.fd-prop-name')?.textContent).toBe('كل نوع من الأجزاء');
    expect([...row.querySelectorAll('.fd-insp-kinds .fd-seg-words')].map((s) => s.textContent)).toEqual(['مربعات النص', 'الاختيارات', 'المجموعات', 'الأزرار', 'الجداول']);
    const inputs = row.querySelector('.fd-part-look:not([hidden])') as HTMLElement;
    expect([...inputs.querySelectorAll('.fd-part-setting-name')].map((n) => n.textContent)).toEqual(['الخلفية', 'الحد', 'الزوايا', 'حجم النص', 'لون التمييز']);
    expect(inputs.querySelector('[data-part-setting="Corners"] .fd-seg-words')?.textContent).toBe('حادة');
    expect(inputs.querySelector('input[type="color"]')?.getAttribute('aria-label')).toBe('مربعات النص: الخلفية');
    expect(inputs.querySelector('.fd-part-colour-value')?.textContent).toBe('كما في الصفحة');
    (row.querySelector('[data-choice="tables"]') as HTMLButtonElement).click();
    const tables = row.querySelector('.fd-part-look:not([hidden])') as HTMLElement;
    expect([...tables.querySelectorAll('.fd-part-setting-name')].map((n) => n.textContent)).toEqual(['صف العناوين', 'الخطوط', 'حجم النص']);
  });

  it('says its changes and its refusals in Arabic', () => {
    const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
    const before = designer.getPage();
    designer.setPartLook('inputs', { corners: 'round', background: '#fff7e6' });
    expect(lookChanges(before, designer.getPage(), ar)).toEqual(['مربعات النص، الخلفية: كما في الصفحة ← ⁦#fff7e6⁩', 'مربعات النص، الزوايا: كما في الصفحة ← مستديرة']);
    expect(designer.setPartLook('groups', { textSize: 'large' })).toBe(false);
    expect(designer.getState().issues).toEqual([`لا يمكن ضبط ${q('حجم النص')} في المجموعات`]);
    expect(designer.setPartLook('inputs', { corners: 'oval' as never })).toBe(false);
    expect(designer.getState().issues).toEqual(['الزوايا حادة أو ناعمة أو مستديرة']);
  });
});
