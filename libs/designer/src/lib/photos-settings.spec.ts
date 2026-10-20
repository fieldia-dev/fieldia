import { validatePage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { kindOfField } from './kinds';
import { choose, mount } from './test-editor';

/**
 * A photo set on the designer: made from the toolbox as a picture field of several photos drawn as a set, its own
 * settings — the cover, captions, crop and turn, the original kept, the shape of a crop — set on the field's card and
 * in the side panel alike, said in words when the page is published; a picture field of the model shown as a set only
 * where it holds several; and one photo refused, as a set is several.
 */

const nodes = (page: Page) => (page.layout as unknown as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const nodeOf = (page: Page, id: string) => nodes(page).find((n) => n.id === id) as FieldNode;
const fieldOf = (page: Page, id: string) => page.fields[nodeOf(page, id).field];

function made(model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Listing'), model });
  const id = designer.addQuestion('photos', { parent: 'section-1' }) as string;
  designer.updateQuestion(id, { label: 'Photos' });
  return { designer, id, page: () => designer.getPage() };
}

describe('a photo set, on the designer', () => {
  it('is a picture field of several photos drawn as a set, known as one again, and a valid page', () => {
    const { id, page } = made();
    expect(fieldOf(page(), id)).toEqual({ type: 'image', label: 'Photos', multiple: true, maxFiles: 20 });
    expect(nodeOf(page(), id).widget).toBe('photos');
    expect(kindOfField(fieldOf(page(), id), nodeOf(page(), id))).toBe('photos');
    expect(validatePage(page()).ok).toBe(true);
  });

  it('keeps its settings in the node’s options, each usual one kept as nothing', () => {
    const { designer, id, page } = made();
    designer.setWidgetOptions(id, { cover: false, captions: true, aspect: '4:3' });
    expect(nodeOf(page(), id).options).toEqual({ cover: false, captions: true, aspect: '4:3' });
    expect(validatePage(page()).ok).toBe(true);
    designer.setWidgetOptions(id, { cover: null, captions: null, aspect: null });
    expect(nodeOf(page(), id).options).toBeUndefined();
  });

  it('refuses one photo: a set is several', () => {
    const { designer, id, page } = made();
    expect(designer.setFileRules(id, { multiple: false })).toBe(false);
    expect(designer.getState().issues).toEqual(['A photo set holds several photos']);
    expect(fieldOf(page(), id)).toMatchObject({ multiple: true });
    expect(designer.setFileRules(id, { maxFiles: 12 })).toBe(true);
    expect(fieldOf(page(), id)).toMatchObject({ maxFiles: 12 });
  });

  it('shows a picture field of the model as a set only where it holds several photos', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Listing'), model: { gallery: { type: 'image', label: 'Gallery', multiple: true }, logo: { type: 'image', label: 'Logo' } } });
    const gallery = designer.addModelField('gallery', { parent: 'section-1' }) as string;
    expect(designer.changeKind(gallery, 'photos')).toBe(true);
    expect(nodeOf(designer.getPage(), gallery).widget).toBe('photos');
    const logo = designer.addModelField('logo', { parent: 'section-1' }) as string;
    expect(designer.changeKind(logo, 'photos')).toBe(false);
    expect(designer.getState().issues[0]).toMatch(/^Logo is stored as an image in the model, so it can only be shown as Image$/);
  });

  it('says each change in words when the page is published', () => {
    const { designer, id, page } = made();
    const said = (change: () => void) => {
      const before = page();
      change();
      return pageChanges(before, page());
    };
    expect(said(() => designer.setWidgetOptions(id, { captions: true }))).toEqual(['“Photos”: a caption under each photo']);
    expect(said(() => designer.setWidgetOptions(id, { aspect: '1:1' }))).toEqual(['“Photos”: photos are cropped to 1:1']);
    expect(said(() => designer.setWidgetOptions(id, { cover: false, aspect: null }))).toEqual(['“Photos”: no photo is marked the cover', '“Photos”: photos are cropped to any shape']);
    expect(said(() => designer.setWidgetOptions(id, { keepOriginal: false }))).toEqual(['“Photos”: a photo cropped no longer keeps its original']);
    expect(said(() => designer.setWidgetOptions(id, { edit: false, keepOriginal: null }))).toEqual(['“Photos”: photos can no longer be cropped and turned', '“Photos”: a photo cropped keeps its original']);
    expect(said(() => designer.setFileRules(id, { maxFiles: 12 }))).toEqual(['“Photos”: up to 12 files']);
  });
});

describe('a photo set, on the card and in the side panel', () => {
  const panel = (host: Element) => host.querySelector('.fd-properties') as HTMLElement;
  const card = (host: Element) => host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
  const named = <T extends HTMLElement>(scope: Element, name: string) => [...scope.querySelectorAll<T>(`[aria-label="${name}"]`)].filter((e) => !e.closest('[hidden]'));

  function picked() {
    const result = made();
    const { host } = mount(result.designer, { mode: 'simple' });
    result.designer.select(result.id);
    return { ...result, host };
  }

  it('offers its cover, captions, crop and turn, the original and the shape — never one file, nor a list of files', () => {
    const { id, host, page } = picked();
    expect(named(panel(host), 'More than one file')).toHaveLength(0);
    expect(named(panel(host), 'Show chosen files as')).toHaveLength(0);
    expect(named(panel(host), 'At most')).toHaveLength(1);
    expect(named(panel(host), 'Camera on phones')).toHaveLength(1);
    const cover = named<HTMLButtonElement>(panel(host), 'The first photo is the cover');
    expect(cover).toHaveLength(1);
    expect([cover[0].getAttribute('role'), cover[0].getAttribute('aria-checked')]).toEqual(['switch', 'true']);
    cover[0].click();
    expect(nodeOf(page(), id).options).toEqual({ cover: false });
    expect(named<HTMLButtonElement>(card(host), 'The first photo is the cover')[0].getAttribute('aria-checked')).toBe('false');
    named<HTMLButtonElement>(panel(host), 'A caption under each photo')[0].click();
    expect(nodeOf(page(), id).options).toEqual({ cover: false, captions: true });
    const shape = named<HTMLSelectElement>(panel(host), 'Shape of a crop')[0];
    expect([...shape.options].map((o) => o.textContent)).toEqual(['Any shape', '1:1', '4:3', '3:2', '16:9', '3:4']);
    choose(shape, '4:3');
    expect(nodeOf(page(), id).options).toMatchObject({ aspect: '4:3' });
    // The card draws the set as the page does: its tiles' shape the page's.
    expect((card(host).querySelector('.fd-photos') as HTMLElement | null)?.style.getPropertyValue('--fd-photo-shape')).toBe(String(4 / 3));
  });

  it('hides what a crop keeps where photos are not cropped, never disabling it', () => {
    const { id, host, page } = picked();
    expect(named(panel(host), 'Keep the original of a photo cropped')).toHaveLength(1);
    named<HTMLButtonElement>(panel(host), 'Crop and turn')[0].click();
    expect(nodeOf(page(), id).options).toEqual({ edit: false });
    expect(named(panel(host), 'Keep the original of a photo cropped')).toHaveLength(0);
    expect(named(panel(host), 'Shape of a crop')).toHaveLength(0);
    named<HTMLButtonElement>(panel(host), 'Crop and turn')[0].click();
    expect(nodeOf(page(), id).options).toBeUndefined();
    named<HTMLButtonElement>(panel(host), 'Keep the original of a photo cropped')[0].click();
    expect(nodeOf(page(), id).options).toEqual({ keepOriginal: false });
  });
});
