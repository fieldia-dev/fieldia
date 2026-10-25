import { checkPage, validatePage, type Page } from '../../index';

/**
 * A photo set in the page format (`"widget": "photos"`): on a picture field of several photos, its settings in the
 * node's options — a cover, captions, crop and turn, the original kept, a shape — each refused where written wrong.
 */

const page = (options?: Record<string, unknown>, photos: Record<string, unknown> = { type: 'image', label: 'Photos', multiple: true, maxFiles: 12 }): Page =>
  ({
    fieldia: '0.13',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields: { name: { type: 'char', label: 'Title' }, photos, plan: { type: 'binary', label: 'Floor plan' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-name', field: 'name' },
        { type: 'field', id: 'f-photos', field: 'photos', widget: 'photos', ...(options ? { options } : {}) },
      ],
    },
  }) as unknown as Page;

const issues = (given: Page) => {
  const full = validatePage(given);
  const quick = checkPage(given);
  return { full: full.ok ? [] : full.issues.map((i) => `${i.path}: ${i.message}`), quick: quick.ok ? [] : quick.issues.map((i) => `${i.path}: ${i.message}`) };
};
const at = 'layout.children[1]';

describe('a photo set in the page format', () => {
  it('takes its settings: a cover, captions, crop and turn, the original kept, a shape — beside a picture field’s own', () => {
    expect(issues(page())).toEqual({ full: [], quick: [] });
    expect(issues(page({ cover: false, captions: true, edit: true, keepOriginal: false, aspect: '4:3', camera: true }))).toEqual({ full: [], quick: [] });
    for (const aspect of ['1:1', '16:9', '3:4', '1.91:1', '5:1', '1:5']) expect(issues(page({ aspect })).full).toEqual([]);
  });

  it('refuses a setting written wrong, and a shape no photo has', () => {
    const shape = 'aspect is a shape, its width and its height: "4:3", "16:9", "1:1" — no longer than five to one either way';
    expect(issues(page({ aspect: '4x3' })).full).toEqual([`${at}.options.aspect: ${shape}`]);
    expect(issues(page({ aspect: '6:1' })).full).toEqual([`${at}.options.aspect: ${shape}`]);
    expect(issues(page({ aspect: '0:3' })).full).toEqual([`${at}.options.aspect: ${shape}`]);
    expect(issues(page({ captions: 'yes' })).full).toEqual([expect.stringMatching(/^layout\.children\[1\]\.options\.captions: /)]);
    expect(issues(page({ cover: 1 })).full).toEqual([expect.stringMatching(/^layout\.children\[1\]\.options\.cover: /)]);
  });

  it('is a picture field’s of several photos: one photo, or a file field, is said', () => {
    const one = `${at}.widget: photos is for an image field of several photos (multiple); "photos" is not one`;
    expect(issues(page(undefined, { type: 'image', label: 'Photo' })).quick).toEqual([one]);
    expect(issues(page(undefined, { type: 'binary', label: 'Photos', multiple: true })).quick).toEqual([one]);
    // Its settings are its own: another widget's options named so are not read as a photo set's.
    const other = page();
    (other.layout as unknown as { children: Record<string, unknown>[] }).children[1] = { type: 'field', id: 'f-plan', field: 'plan', options: { aspect: 'square' } };
    expect(issues(other)).toEqual({ full: [], quick: [] });
  });
});
