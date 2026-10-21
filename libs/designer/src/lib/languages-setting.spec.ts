import { validatePage, type Field, type FieldNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { findNode } from './page-tree';
import { choose, mount } from './test-editor';
import { firstPair } from './kind-settings-inputs';
import { pageChanges } from './page-checks';

/**
 * A short answer, a paragraph or formatted text typed in several languages, each by a person (`translate`), as the
 * designer sets it: a switch in the field's own settings — the page's language first — its languages as chips, one added
 * from the common ones, one taken away while three or more are kept; and, while the field is required, the languages a
 * required answer is typed in (`requiredIn`). Each change one undo; a model's field keeps the model's.
 */

const nodeOf = (designer: Designer, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
const fieldOf = (designer: Designer, id: string) => designer.getPage().fields[nodeOf(designer, id).field] as Field & { translate?: string[]; requiredIn?: string[] };
const inline = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as HTMLElement | null;

function screenWith(kind: string, locale?: 'ar') {
  const page = blankPage('screen', 'Listing');
  const designer = createDesigner({ page, ...(locale ? { locale } : {}) });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer);
  return { designer, id, host };
}

afterEach(() => document.body.replaceChildren());

describe('a text typed in several languages, in the designer', () => {
  it('is turned on in a short answer’s settings, the page’s language first, its languages chips, one added', () => {
    const { designer, id, host } = screenWith('short-answer');
    const switched = inline(host, 'Typed in several languages') as HTMLButtonElement;
    expect(switched.getAttribute('aria-checked')).toBe('false');
    expect((inline(host, 'Typed in') as HTMLElement).closest('[hidden]')).not.toBeNull();
    switched.click();
    expect(fieldOf(designer, id).translate).toEqual(['en', 'ar']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect([...(inline(host, 'Typed in') as HTMLElement).querySelectorAll('li')].map((li) => li.textContent)).toEqual(['English', 'Arabic']);
    // Two at the least: neither is taken away.
    expect((inline(host, 'Typed in') as HTMLElement).querySelectorAll('button')).toHaveLength(0);
    choose((inline(host, 'Add a language') as HTMLSelectElement) ?? undefined, 'fr');
    expect(fieldOf(designer, id).translate).toEqual(['en', 'ar', 'fr']);
    (inline(host, 'Take Arabic away') as HTMLButtonElement).click();
    expect(fieldOf(designer, id).translate).toEqual(['en', 'fr']);
    designer.undo();
    expect(fieldOf(designer, id).translate).toEqual(['en', 'ar', 'fr']);
    (inline(host, 'Typed in several languages') as HTMLButtonElement).click();
    expect(fieldOf(designer, id)).not.toHaveProperty('translate');
  });

  it('asks, while it is required, which languages a required answer is typed in; none is refused, said', () => {
    const { designer, id, host } = screenWith('paragraph');
    designer.setLanguages(id, ['ar', 'en']);
    expect((inline(host, 'Required in') as HTMLElement).hidden).toBe(true);
    designer.updateQuestion(id, { required: true });
    const required = inline(host, 'Required in') as HTMLElement;
    expect(required.hidden).toBe(false);
    const [arabic, english] = [...required.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect([arabic.checked, english.checked]).toEqual([true, true]);
    arabic.click();
    expect(fieldOf(designer, id).requiredIn).toEqual(['en']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // The last one kept: refused in words, and still ticked.
    const last = [...(inline(host, 'Required in') as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][1];
    last.click();
    expect(last.checked).toBe(true);
    expect(designer.getState().issues[0]).toBe('A required answer is typed in one language at least: to ask for none, take Required off');
    expect(fieldOf(designer, id).requiredIn).toEqual(['en']);
    designer.setRequiredIn(id, null);
    expect(fieldOf(designer, id)).not.toHaveProperty('requiredIn');
  });

  it('stays so as a short answer is made a paragraph or formatted text, and goes as it is made an email', () => {
    const { designer, id } = screenWith('short-answer');
    designer.setLanguages(id, ['ar', 'en']);
    designer.updateQuestion(id, { required: true });
    designer.setRequiredIn(id, ['en']);
    designer.changeKind(id, 'paragraph');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'text', translate: ['ar', 'en'], requiredIn: ['en'] });
    designer.changeKind(id, 'rich-text');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'html', translate: ['ar', 'en'] });
    designer.changeKind(id, 'email');
    expect(fieldOf(designer, id)).not.toHaveProperty('translate');
  });

  it('refuses a code that is no language’s, a number’s field, and a model’s field', () => {
    const { designer, id } = screenWith('short-answer');
    expect(designer.setLanguages(id, ['ar', 'english'])).toBe(false);
    expect(designer.getState().issues[0]).toBe('“english” is not a language’s code: write it as ar, en or pt-BR');
    const number = designer.addQuestion('number', { parent: 'section-1' }) as string;
    expect(designer.setLanguages(number, ['ar', 'en'])).toBe(false);
    expect(designer.getState().issues[0]).toBe('Only a short answer, a paragraph or formatted text is typed in several languages');
    const model = createDesigner({ page: blankPage('screen', 'Product'), model: { name: { type: 'char', label: 'Name' } } });
    const placed = model.addModelField('name') as string;
    expect(model.setLanguages(placed, ['ar', 'en'])).toBe(false);
    expect(model.getState().issues[0]).toBe('The languages of Name come from the model');
  });

  it('starts from the page’s language, then English — or Arabic on an English page; in Arabic, its names in Arabic', () => {
    expect(firstPair('en')).toEqual(['en', 'ar']);
    expect(firstPair('ar-EG')).toEqual(['ar', 'en']);
    expect(firstPair('fr')).toEqual(['fr', 'en']);
    const { designer, id, host } = screenWith('short-answer', 'ar');
    (inline(host, 'يُكتب بعدة لغات') as HTMLButtonElement).click();
    expect(fieldOf(designer, id).translate).toEqual(['ar', 'en']);
    expect([...(inline(host, 'يُكتب بـ') as HTMLElement).querySelectorAll('li')].map((li) => li.textContent)).toEqual(['العربية', 'الإنجليزية']);
  });
});

describe('a text’s languages, as Publish lists what changed', () => {
  it('says the languages it is typed in, and those a required answer is typed in, by their names', () => {
    const { designer, id } = screenWith('short-answer');
    designer.updateQuestion(id, { label: 'Title' });
    const before = designer.getPage();
    designer.setLanguages(id, ['ar', 'en']);
    expect(pageChanges(before, designer.getPage())).toEqual(['“Title”: typed in Arabic and English']);
    designer.updateQuestion(id, { required: true });
    const required = designer.getPage();
    designer.setRequiredIn(id, ['en']);
    expect(pageChanges(required, designer.getPage())).toEqual(['“Title”: a required answer typed in English']);
    const both = designer.getPage();
    designer.setLanguages(id, null);
    expect(pageChanges(both, designer.getPage())).toEqual(['“Title”: typed in one language']);
  });
});
