import type { Page } from '@fieldia/core';
import { createDesigner } from './designer';
import { ar } from './locales/ar';
import { languageTag } from './translations';
import { readTranslationsCsv } from './translations-csv';
import { button, mount } from './test-editor';

/** The Translations view with the designer in Arabic: its bar, its grid and its sentences in Arabic, each language by its Arabic name; the page's words as written. */

const start = (): Page => ({
  fieldia: '0.1',
  id: 'signup',
  title: 'Sign up',
  data: { kind: 'record', model: 'signup' },
  fields: { name: { type: 'char', label: 'Your name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', title: 'About you', children: [{ type: 'field', id: 'n', field: 'name' }] }] },
});

function open(page: Page = start()) {
  const designer = createDesigner({ page, locale: 'ar' });
  const { host } = mount(designer);
  const view = () => host.querySelector('.fd-words') as HTMLElement;
  (host.querySelector('.fd-mode [data-mode="translations"]') as HTMLButtonElement).click();
  return { designer, host, view };
}
const note = (view: HTMLElement) => {
  const picker = view.querySelector('.fd-words-own-language') as HTMLSelectElement;
  return [...(view.querySelector('.fd-words-note') as HTMLElement).childNodes].map((n) => (n === picker ? `[${picker.selectedOptions[0]?.textContent}]` : n.textContent)).join('');
};

afterEach(() => document.body.replaceChildren());

describe('translations, in Arabic', () => {
  it('says the bar and the note in Arabic, the page’s language picked where the sentence names it', () => {
    const { host, view } = open();
    expect((host.querySelector('.fd-mode [data-mode="translations"]') as HTMLElement).textContent).toBe('الترجمات');
    expect(view().querySelector('.fd-words-title')?.textContent).toBe('الترجمات');
    expect(note(view())).toBe('3 كلمات، مكتوبة باللغة [الإنجليزية]. أضف لغة لترجمتها إليها.');
    const add = view().querySelector('.fd-words-add input') as HTMLInputElement;
    expect([add.getAttribute('aria-label'), add.placeholder]).toEqual(['إضافة لغة', 'الفرنسية، ⁦es⁩، ⁦pt-BR⁩…']);
    expect([...view().querySelectorAll('datalist option')].map((o) => (o as HTMLOptionElement).value)).toContain('الفرنسية');
  });

  it('adds a language by its Arabic name, and draws its column in Arabic', () => {
    const { designer, view } = open();
    const add = view().querySelector('.fd-words-add input') as HTMLInputElement;
    add.value = 'الفرنسية';
    (view().querySelector('.fd-words-add') as HTMLFormElement).requestSubmit();
    expect(Object.keys(designer.getPage().translations ?? {})).toEqual(['fr']);
    expect(view().querySelector('.fd-words-status')?.textContent).toBe('تمت إضافة الفرنسية.');
    const head = view().querySelector('.fd-words-grid thead') as HTMLElement;
    expect([...head.querySelectorAll('.fd-words-lang')].map((n) => n.textContent)).toEqual(['الإنجليزية', 'الفرنسية']);
    expect(head.querySelector('.fd-words-own')?.textContent).toBe('كلمات الصفحة الأصلية');
    expect([...head.querySelectorAll('th')][1].getAttribute('aria-label')).toBe('الفرنسية: تُرجم 0 من 3');
    expect(view().querySelector('textarea[data-lang="fr"]')?.getAttribute('aria-label')).toBe('الفرنسية لـ«⁨Sign up⁩»');
    expect(button(view(), 'إزالة الفرنسية')).toBeDefined();
  });

  it('asks before a language with translations goes, in Arabic', () => {
    const { designer, view } = open();
    designer.addLanguage('fr');
    designer.setTranslation('fr', 'Your name', 'Votre nom');
    button(view(), 'إزالة الفرنسية')?.click();
    expect(view().querySelector('.fd-words-ask')?.textContent).toBe('هل تريد إزالة الفرنسية؟ ستُزال معها ترجمتها الوحيدة.');
    button(view(), 'الإبقاء عليها')?.click();
    expect(Object.keys(designer.getPage().translations ?? {})).toEqual(['fr']);
  });

  it('refuses in Arabic', () => {
    const { designer } = open();
    expect(designer.addLanguage('en')).toBe(false);
    expect(designer.getState().issues).toEqual(['الصفحة مكتوبة باللغة الإنجليزية: كلماتها بهذه اللغة بالفعل']);
    expect(designer.addLanguage('!!')).toBe(false);
    expect(designer.getState().issues).toEqual(['«⁨!!⁩» ليس رمز لغة، مثل ⁦ar⁩ أو ⁦es⁩ أو ⁦pt-BR⁩']);
    expect(designer.removeLanguage('de')).toBe(false);
    expect(designer.getState().issues).toEqual(['اللغة الألمانية ليست في الصفحة']);
  });

  it('reads a CSV naming its languages in Arabic or English, and says what is wrong in Arabic', () => {
    expect(languageTag('العربية', ar)).toBe('ar');
    expect(languageTag('Arabic', ar)).toBe('ar');
    const read = readTranslationsCsv('en,الفرنسية\r\nYour name,Votre nom\r\n', start(), ar);
    expect(read).toEqual({ words: { fr: { 'Your name': 'Votre nom' } }, notOnPage: 0 });
    expect(readTranslationsCsv('', start(), ar)).toEqual({ problem: 'لا شيء للقراءة: الصق ملف CSV يسمّي صفه الأول اللغات' });
    expect(readTranslationsCsv('en,???\r\n', start(), ar)).toEqual({ problem: '«⁨???⁩» في الصف الأول ليست لغة: سمّها برمزها أو باسمها، مثل ⁦ar⁩ أو ⁦العربية⁩' });
  });

  it('says what filling and copying did, in Arabic counts', () => {
    expect(ar.translations.copied(2, 1)).toBe('تم نسخ كلمتين في لغة واحدة بصيغة CSV.');
    expect(ar.translations.filled(11, 0)).toBe('تم ملء 11 ترجمة.');
    expect(ar.translations.filled(3, 2)).toBe('تم ملء 3 ترجمات. وتُرك ما لم يعد في الصفحة: كلمتان.');
  });
});
