import type { Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import { createDesigner } from './designer';
import { tryIt, type TryIt } from './try-it';

/**
 * Try it in a language: the page's languages to pick from beside English and
 * العربية; the page tried in the one picked, in its words, right to left
 * where it is written so — and the Arabic button still trying it in Arabic.
 */

let handle: TryIt | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const signup = (translations?: Page['translations']): Page => ({
  fieldia: '0.1',
  id: 'signup',
  title: 'Sign up',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }] },
  ...(translations ? { translations } : {}),
});

function setup(page: Page) {
  const designer = createDesigner({ page });
  handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined });
  document.body.append(handle.toggle, handle.element);
  (handle.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
  const picker = () => handle?.element.querySelector('.fd-try-language') as HTMLElement;
  const select = () => picker().querySelector('select') as HTMLSelectElement;
  const viewer = () => handle?.element.querySelector('.fd-try-frame form.fd-form') as HTMLFormElement;
  const label = () => viewer().querySelector('.fd-label')?.textContent;
  const control = (name: string) => handle?.element.querySelector(`button[data-try="${name}"]`) as HTMLButtonElement;
  const pick = (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event('change', { bubbles: true }));
  };
  return { designer, picker, select, viewer, label, control, pick };
}

describe('try it in a language', () => {
  it('offers nothing to pick on a page with no other languages', () => {
    const { picker } = setup(signup());
    expect(picker().hidden).toBe(true);
  });

  it('lists the page’s own language, then each language it keeps', () => {
    const { picker, select } = setup(signup({ es: { 'Your name': 'Tu nombre' }, ar: { 'Your name': 'اسمك' } }));
    expect(picker().hidden).toBe(false);
    expect([...select().options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'English, as written'],
      ['es', 'Spanish'],
      ['ar', 'Arabic'],
    ]);
    expect(select().value).toBe('');
  });

  it('tries the page in the language picked, right to left where it is written so', () => {
    const { pick, viewer, label, control } = setup(signup({ es: { 'Your name': 'Tu nombre' }, he: { 'Your name': 'השם שלך' } }));
    pick('es');
    expect(label()).toBe('Tu nombre');
    expect(viewer().getAttribute('lang')).toBe('es');
    expect(viewer().getAttribute('dir')).toBe('ltr');
    pick('he');
    expect(label()).toBe('השם שלך');
    expect(viewer().getAttribute('dir')).toBe('rtl');
    expect(control('rtl').getAttribute('aria-pressed')).toBe('true');
    pick('');
    expect(label()).toBe('Your name');
    expect(viewer().getAttribute('dir')).toBe('ltr');
    expect(control('ltr').getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the Arabic button trying it in Arabic: in the page’s Arabic words when it keeps them', () => {
    const { control, label, viewer, select } = setup(signup({ ar: { 'Your name': 'اسمك' }, es: { 'Your name': 'Tu nombre' } }));
    control('rtl').click();
    expect(label()).toBe('اسمك');
    expect(viewer().getAttribute('dir')).toBe('rtl');
    expect(select().value).toBe('ar');
    control('ltr').click();
    expect(label()).toBe('Your name');
    expect(select().value).toBe('');
  });

  it('still tries a page with no Arabic right to left, in its own words', () => {
    const { control, label, viewer, select } = setup(signup({ es: { 'Your name': 'Tu nombre' } }));
    control('rtl').click();
    expect(label()).toBe('Your name');
    expect(viewer().getAttribute('dir')).toBe('rtl');
    expect(viewer().getAttribute('lang')).toBe('ar');
    expect(select().value).toBe('');
  });

  it('keeps a left-to-right language picked when English is pressed', () => {
    const { pick, control, label } = setup(signup({ es: { 'Your name': 'Tu nombre' } }));
    pick('es');
    control('ltr').click();
    expect(label()).toBe('Tu nombre');
  });

  it('forgets a language the page no longer keeps, the next time it is tried', () => {
    const { designer, pick, select, label } = setup(signup({ es: { 'Your name': 'Tu nombre' } }));
    pick('es');
    (handle?.toggle.querySelector('button[data-mode="design"]') as HTMLButtonElement).click();
    designer.removeLanguage('es');
    (handle?.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    expect(label()).toBe('Your name');
    expect(select().value).toBe('');
  });
});
