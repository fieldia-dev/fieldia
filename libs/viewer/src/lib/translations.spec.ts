import type { Page } from '@fieldia/core';
import { openSearchDialog } from './dialog';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A page shown in a language: the page's own words in it when the page keeps
 * them, the viewer's own words in it when Fieldia has them (English when it
 * has none), and right to left for a language written so.
 */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page: Page = {
  fieldia: '0.1',
  id: 'signup',
  title: 'Sign up',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name', required: true, help: 'As on your ID' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', title: 'About you', children: [{ type: 'field', id: 'n', field: 'name' }] }] },
  translations: {
    ar: { 'Sign up': 'التسجيل', 'Your name': 'اسمك', 'About you': 'عنك' },
    es: { 'Sign up': 'Registro', 'Your name': 'Tu nombre', 'As on your ID': 'Como en tu documento' },
    he: { 'Your name': 'השם שלך' },
  },
};

function mount(options: Partial<ViewerOptions> = {}, shown: Page = page) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: shown, ...options });
  return host;
}
const form = (host: HTMLElement) => host.querySelector('.fd-form') as HTMLElement;
const text = (host: HTMLElement, selector: string) => host.querySelector(selector)?.textContent;

describe('a page shown in a language', () => {
  it('shows the page’s own words in the language asked for, its messages too, right to left', () => {
    const host = mount({ locale: 'ar' });
    expect(text(host, '.fd-label')).toBe('اسمك');
    expect(text(host, '.fd-section-title')).toBe('عنك');
    expect(form(host).getAttribute('dir')).toBe('rtl');
    expect(form(host).getAttribute('lang')).toBe('ar');
    handle?.check();
    // The viewer's own message, with the field's translated label in it.
    expect(text(host, '[data-node="n"] .fd-error')).toBe('اسمك مطلوب');
  });

  it('takes any language tag for the page’s words; the viewer’s own fall back to English', () => {
    const host = mount({ locale: 'es' });
    expect(text(host, '.fd-label')).toBe('Tu nombre');
    expect(text(host, '.fd-help')).toBe('Como en tu documento');
    expect(form(host).getAttribute('dir')).toBeNull();
    expect(form(host).getAttribute('lang')).toBe('es');
    handle?.check();
    expect(text(host, '[data-node="n"] .fd-error')).toBe('Tu nombre is required');
  });

  it('falls back from a regional tag to its language, for the page’s words and the viewer’s', () => {
    const host = mount({ locale: 'ar-EG' });
    expect(text(host, '.fd-label')).toBe('اسمك');
    expect(form(host).getAttribute('dir')).toBe('rtl');
    handle?.check();
    expect(text(host, '[data-node="n"] .fd-error')).toBe('اسمك مطلوب');
  });

  it('runs right to left for any language written so, unless told otherwise', () => {
    expect(form(mount({ locale: 'he' })).getAttribute('dir')).toBe('rtl');
    handle?.destroy();
    document.body.replaceChildren();
    expect(form(mount({ locale: 'fa', dir: 'ltr' })).getAttribute('dir')).toBe('ltr');
  });

  it('shows the page as written in a language it does not keep', () => {
    const host = mount({ locale: 'de' });
    expect(text(host, '.fd-label')).toBe('Your name');
    handle?.check();
    expect(text(host, '[data-node="n"] .fd-error')).toBe('Your name ist erforderlich');
  });

  it('speaks the language the page is written in when no language is asked for', () => {
    const arabic: Page = { ...page, language: 'ar', fields: { name: { type: 'char', label: 'اسمك', required: true } }, translations: undefined };
    const host = mount({}, arabic);
    expect(form(host).getAttribute('dir')).toBe('rtl');
    handle?.check();
    expect(text(host, '[data-node="n"] .fd-error')).toBe('اسمك مطلوب');
  });

  it('puts the page’s own words first, and the app’s translator over the rest', () => {
    const host = mount({ locale: 'es', translate: (words) => (words === 'About you' ? 'Sobre ti' : words) });
    expect(text(host, '.fd-label')).toBe('Tu nombre');
    expect(host.textContent).toContain('Sobre ti');
  });
});

describe('a dialog in a language Fieldia has no words for', () => {
  it('speaks English, rather than nothing', async () => {
    const found = openSearchDialog({ title: 'Buscar', search: async () => [], locale: 'es' });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('.fd-dialog-close')?.getAttribute('aria-label')).toBe('Close');
    (dialog.querySelector('.fd-dialog-close') as HTMLButtonElement).click();
    await expect(found).resolves.toBeNull();
  });
});
