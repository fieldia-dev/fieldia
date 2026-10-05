import { pageWords, translatePage, validatePage } from '../../index';

/** A picture between fields: how wide, where it sits, an address it opens, and words under it. */

const page = (image: Record<string, unknown>) => ({
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'image', id: 'i', src: 'https://example.com/map.png', alt: 'A map of the venue', ...image }] },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a picture between fields', () => {
  it('takes a width by name or in pixels, a place in its row, a link and a caption', () => {
    for (const width of ['small', 'medium', 'large', 'full', 240]) expect(problems(page({ width, align: 'center', href: 'https://example.com/venue', caption: 'The hall is on the first floor' }))).toEqual([]);
    expect(problems(page({ href: 'mailto:events@example.com', align: 'end' }))).toEqual([]);
  });

  it('refuses a width that is none, a side for a place, and a link that is not to a web or mail address', () => {
    expect(problems(page({ width: 'huge' }))).not.toEqual([]);
    expect(problems(page({ width: 0 }))).not.toEqual([]);
    expect(problems(page({ align: 'left' }))).not.toEqual([]);
    expect(problems(page({ href: 'javascript:alert(1)' }))).not.toEqual([]);
  });

  it('has its caption translated with the page’s other words', () => {
    const with_ = page({ caption: 'The hall is on the first floor' }) as never;
    expect(pageWords(with_)).toContain('The hall is on the first floor');
    const translated = translatePage(with_, (text) => `«${text}»`) as unknown as { layout: { children: { caption?: string; href?: string }[] } };
    expect(translated.layout.children[1].caption).toBe('«The hall is on the first floor»');
  });
});
