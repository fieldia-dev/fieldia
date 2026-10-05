import { checkPage, pageJsonSchema, pageWords, translatePage, validatePage } from '../../index';
import Ajv2020 from 'ajv/dist/2020';

/**
 * A saved form placed in another: a part that names another page by its id,
 * and the name its answers are kept under, so a block made once — an
 * address, a contact person, a consent — is reused on many forms.
 */

const page = (...parts: Record<string, unknown>[]) => ({
  fieldia: '0.1',
  id: 'delivery',
  data: { kind: 'responses' },
  fields: { full_name: { type: 'char', label: 'Full name' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'field', id: 'n', field: 'full_name' }, ...parts.map((part, i) => ({ type: 'form', id: `part-${i}`, page: 'address', name: `address_${i}`, ...part }))],
  },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a saved form placed in another', () => {
  it('names the page, the latest version or one kept to, where its answers go, and its own title', () => {
    expect(problems(page({ name: 'home' }))).toEqual([]);
    expect(problems(page({ name: 'home', version: 2, title: 'Home address', colspan: 2, invisible: 'not full_name', readonly: false }))).toEqual([]);
    // Words over it left out: an empty title hides the saved form's own.
    expect(problems(page({ name: 'home', title: '' }))).toEqual([]);
  });

  it('places the same form twice, each copy with answers of its own', () => {
    expect(problems(page({ name: 'home', title: 'Home address' }, { name: 'work', title: 'Work address' }))).toEqual([]);
  });

  it('refuses a part without a page or a name, a name that is no field name, and a version that is none', () => {
    expect(problems(page({ page: undefined }))).not.toEqual([]);
    expect(problems(page({ name: undefined }))).not.toEqual([]);
    expect(problems(page({ name: 'home address' }))).not.toEqual([]);
    expect(problems(page({ version: 0 }))).not.toEqual([]);
    expect(problems(page({ version: 1.5 }))).not.toEqual([]);
    expect(problems(page({ onLoad: 'x' }))).not.toEqual([]);
  });

  it('says where the answers of two copies would mix, and where a name is taken by a field', () => {
    expect(problems(page({ name: 'home' }, { name: 'home' }))).toEqual([
      'layout.children[2].name: the answers of the saved form at layout.children[1] go under "home" already: give each copy a name of its own',
    ]);
    expect(problems(page({ name: 'full_name' }))).toEqual(['layout.children[1].name: "full_name" is a field of this page: the saved form’s answers need a name of their own']);
  });

  it('refuses a page placed inside itself', () => {
    expect(problems(page({ page: 'delivery' }))).toEqual(['layout.children[1].page: a page cannot be placed inside itself']);
  });

  it('reads its conditions as any part’s, against this page’s fields', () => {
    expect(problems(page({ invisible: 'ghost == 1' }))).toEqual(['layout.children[1].invisible: "ghost == 1" reads "ghost", which is not a field of this page']);
  });

  it('is checked the same by the quick check a viewer runs', () => {
    const twice = page({ name: 'home' }, { name: 'home' });
    const quick = checkPage(twice);
    const full = validatePage(twice);
    expect(quick.ok).toBe(false);
    expect(!quick.ok && quick.issues).toEqual(!full.ok && full.issues);
    expect(checkPage(page({ name: 'home' })).ok).toBe(true);
  });

  it('is in the JSON Schema, which refuses a key it does not define', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(pageJsonSchema());
    expect(validate(page({ name: 'home', version: 3, title: 'Home' }))).toBe(true);
    expect(validate(page({ name: 'home', onLoad: 'x' }))).toBe(false);
  });

  it('has its title translated with the page’s other words, its page and name kept', () => {
    const with_ = page({ name: 'home', title: 'Home address' }) as never;
    expect(pageWords(with_)).toContain('Home address');
    const translated = translatePage(with_, (text) => `«${text}»`) as unknown as { layout: { children: { title?: string; page?: string; name?: string }[] } };
    expect(translated.layout.children[1]).toMatchObject({ title: '«Home address»', page: 'address', name: 'home' });
  });
});
