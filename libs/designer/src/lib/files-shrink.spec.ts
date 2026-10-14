import { validatePage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { ar } from './locales/ar';
import { choose, mount } from './test-editor';

/**
 * Photos made smaller before they are kept (`shrink`), set in the designer:
 * an image is made smaller as usual where the app stores files, and may be
 * kept as taken; a file upload is not, unless a side is picked. How sharp
 * shows only once photos are made smaller. Said in words on publishing, in
 * English and in Arabic.
 */

const nodes = (page: Page) => (page.layout as unknown as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const fieldOf = (page: Page, id: string) => page.fields[(nodes(page).find((n) => n.id === id) as FieldNode).field] as Field & { shrink?: unknown };

function made(kind: 'file' | 'image' = 'image', locale?: 'ar') {
  const designer = createDesigner({ page: blankPage('screen', 'Listing', locale ? { locale } : {}), ...(locale ? { locale } : {}) });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  designer.updateQuestion(id, { label: kind === 'file' ? 'Documents' : 'Photos' });
  return { designer, id, page: () => designer.getPage() };
}

describe('photos made smaller, on the designer', () => {
  it('sets a side and a quality, keeps photos as taken, and goes back to the usual', () => {
    const { designer, id, page } = made();
    expect(designer.setFileRules(id, { shrink: { maxSide: 1600, quality: 0.8 } })).toBe(true);
    expect(fieldOf(page(), id).shrink).toEqual({ maxSide: 1600, quality: 0.8 });
    expect(validatePage(page()).ok).toBe(true);
    designer.setFileRules(id, { shrink: false });
    expect(fieldOf(page(), id).shrink).toBe(false);
    expect(validatePage(page()).ok).toBe(true);
    designer.setFileRules(id, { shrink: null });
    expect(fieldOf(page(), id)).not.toHaveProperty('shrink');
  });

  it('refuses a side or a quality the format does not take, saying what it does', () => {
    const { designer, id } = made();
    for (const shrink of [{ maxSide: 100 }, { maxSide: 1600.5 }, { quality: 1.5 }, { quality: 0.1 }]) {
      expect(designer.setFileRules(id, { shrink })).toBe(false);
      expect(designer.getState().issues).toEqual(['Photos are made smaller to a whole number of pixels from 160 to 16384, at a quality from 0.3 to 1']);
    }
  });

  it('says each change in words when the page is published, in English and in Arabic', () => {
    const { designer, id, page } = made();
    const said = (change: () => void) => {
      const before = page();
      change();
      return pageChanges(before, page());
    };
    expect(said(() => designer.setFileRules(id, { shrink: { maxSide: 1600 } }))).toEqual(['“Photos”: photos are made smaller, to 1600 px at 85%']);
    expect(said(() => designer.setFileRules(id, { shrink: false }))).toEqual(['“Photos”: photos are kept as they were taken']);
    expect(said(() => designer.setFileRules(id, { shrink: null }))).toEqual(['“Photos”: photos are made smaller as usual']);
    const arabic = made('image', 'ar');
    arabic.designer.updateQuestion(arabic.id, { label: 'الصور' });
    const before = arabic.page();
    arabic.designer.setFileRules(arabic.id, { shrink: { maxSide: 1280, quality: 0.7 } });
    expect(pageChanges(before, arabic.page(), ar)).toEqual(['«⁨الصور⁩»: تصغير الصور إلى 1280 بكسل بجودة 70%']);
  });
});

describe('photos made smaller, in the side panel', () => {
  const panel = (host: Element) => host.querySelector('.fd-properties') as HTMLElement;
  const named = <T extends HTMLElement>(scope: Element, name: string) => [...scope.querySelectorAll<T>(`[aria-label="${name}"]`)].filter((e) => !e.closest('[hidden]'));
  function picked(kind: 'file' | 'image') {
    const result = made(kind);
    const { host } = mount(result.designer, { mode: 'simple' });
    result.designer.select(result.id);
    return { ...result, host };
  }
  const shown = (select: HTMLSelectElement) => [...select.options].filter((o) => !o.hidden).map((o) => o.textContent);

  it('offers an image the usual, keeping them as taken, or a side — and how sharp, once they are made smaller', () => {
    const { id, host, page } = picked('image');
    const smaller = named<HTMLSelectElement>(panel(host), 'Make photos smaller')[0];
    expect(shown(smaller)).toEqual(['As usual (2048 px)', 'No', 'To 1280 px', 'To 1600 px', 'To 2048 px', 'To 2560 px', 'To 3200 px', 'To 4096 px']);
    expect(named(panel(host), 'Photo quality')).toHaveLength(1);
    choose(smaller, '1600');
    expect(fieldOf(page(), id).shrink).toEqual({ maxSide: 1600 });
    choose(named<HTMLSelectElement>(panel(host), 'Photo quality')[0], '0.7');
    expect(fieldOf(page(), id).shrink).toEqual({ maxSide: 1600, quality: 0.7 });
    choose(named<HTMLSelectElement>(panel(host), 'Make photos smaller')[0], 'off');
    expect(fieldOf(page(), id).shrink).toBe(false);
    // Kept as taken: no quality to set — hidden, not shown disabled.
    expect(named(panel(host), 'Photo quality')).toHaveLength(0);
    choose(named<HTMLSelectElement>(panel(host), 'Make photos smaller')[0], '');
    expect(fieldOf(page(), id)).not.toHaveProperty('shrink');
  });

  it('offers a file upload no shrinking unless a side is picked, and shows a side of the page’s own as it is', () => {
    const { designer, id, host, page } = picked('file');
    const smaller = named<HTMLSelectElement>(panel(host), 'Make photos smaller')[0];
    expect(shown(smaller)).toEqual(['No', 'To 1280 px', 'To 1600 px', 'To 2048 px', 'To 2560 px', 'To 3200 px', 'To 4096 px']);
    expect(named(panel(host), 'Photo quality')).toHaveLength(0);
    choose(smaller, '2560');
    expect(fieldOf(page(), id).shrink).toEqual({ maxSide: 2560 });
    expect(named(panel(host), 'Photo quality')).toHaveLength(1);
    designer.setFileRules(id, { shrink: { maxSide: 1800 } });
    const now = named<HTMLSelectElement>(panel(host), 'Make photos smaller')[0];
    expect([now.value, now.selectedOptions[0].textContent]).toEqual(['1800', 'To 1800 px']);
    expect(shown(now)).toContain('To 1800 px');
  });
});
