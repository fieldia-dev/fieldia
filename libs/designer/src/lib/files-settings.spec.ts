import { validatePage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { ar } from './locales/ar';
import { choose, mount, type } from './test-editor';

/**
 * A file upload or an image that takes several files: "More than one file",
 * then as few and as many as it takes, how the chosen files show — a list,
 * thumbnails or cards, and whether people can switch — and, for an image, a
 * phone's camera. Set on the field's card and in the side panel, the same
 * controls in both; said in words when the page is published, in English and
 * in Arabic.
 */

const nodes = (page: Page) => (page.layout as unknown as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const nodeOf = (page: Page, id: string) => nodes(page).find((n) => n.id === id) as FieldNode;
const fieldOf = (page: Page, id: string) => page.fields[nodeOf(page, id).field];

function made(kind: 'file' | 'image' = 'file', model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  designer.updateQuestion(id, { label: kind === 'file' ? 'Documents' : 'Photos' });
  return { designer, id, page: () => designer.getPage() };
}

describe('several files, on the designer', () => {
  it('takes several files, as few and as many as asked, and lifts the limits', () => {
    const { designer, id, page } = made();
    expect(designer.setFileRules(id, { multiple: true, minFiles: 2, maxFiles: 5 })).toBe(true);
    expect(fieldOf(page(), id)).toMatchObject({ multiple: true, minFiles: 2, maxFiles: 5 });
    expect(validatePage(page()).ok).toBe(true);
    designer.setFileRules(id, { minFiles: null });
    expect(fieldOf(page(), id)).not.toHaveProperty('minFiles');
    // One file again: no fewest or most is left behind.
    designer.setFileRules(id, { multiple: false });
    expect(fieldOf(page(), id)).not.toHaveProperty('multiple');
    expect(fieldOf(page(), id)).not.toHaveProperty('maxFiles');
    expect(validatePage(page()).ok).toBe(true);
  });

  it('refuses a fewest or a most without several files, a fewest above the most, and counts that are not whole', () => {
    const { designer, id } = made();
    const refused = (rules: Parameters<typeof designer.setFileRules>[1], words: string) => {
      expect(designer.setFileRules(id, rules)).toBe(false);
      expect(designer.getState().issues).toEqual([words]);
    };
    refused({ maxFiles: 3 }, 'Turn on More than one file first');
    designer.setFileRules(id, { multiple: true });
    refused({ minFiles: 4, maxFiles: 3 }, 'At least cannot be more than at most');
    refused({ maxFiles: 0 }, 'At most is a whole number of files, one or more');
    refused({ minFiles: 1.5 }, 'At least is a whole number of files');
  });

  it('gives an image field several files and a largest size, but no kinds: it takes images', () => {
    const { designer, id, page } = made('image');
    expect(designer.setFileRules(id, { multiple: true, maxFiles: 6, maxSize: 1048576 })).toBe(true);
    expect(fieldOf(page(), id)).toMatchObject({ type: 'image', multiple: true, maxFiles: 6, maxSize: 1048576 });
    expect(designer.setFileRules(id, { accept: ['application/pdf'] })).toBe(false);
    expect(designer.getState().issues).toEqual(['An image takes images only']);
  });

  it('leaves a field of the model as the model has it', () => {
    const { designer } = made('file', { scan: { type: 'binary', label: 'Scan' } });
    const id = designer.addModelField('scan', { parent: 'section-1' }) as string;
    expect(designer.setFileRules(id, { multiple: true })).toBe(false);
    expect(designer.getState().issues).toEqual(['The files Scan takes come from the model']);
  });

  it('says each change in words when the page is published', () => {
    const { designer, id, page } = made();
    const said = (change: () => void) => {
      const before = page();
      change();
      return pageChanges(before, page());
    };
    expect(said(() => designer.setFileRules(id, { multiple: true }))).toEqual(['“Documents” now takes several files']);
    expect(said(() => designer.setFileRules(id, { maxFiles: 5 }))).toEqual(['“Documents”: up to 5 files']);
    expect(said(() => designer.setFileRules(id, { minFiles: 2 }))).toEqual(['“Documents”: from 2 to 5 files']);
    expect(said(() => designer.setFileRules(id, { minFiles: null, maxFiles: null }))).toEqual(['“Documents”: any number of files']);
    expect(said(() => designer.setWidgetOptions(id, { files: 'thumbnails' }))).toEqual(['“Documents”: chosen files shown as thumbnails']);
    expect(said(() => designer.setWidgetOptions(id, { files: 'cards' }))).toEqual(['“Documents”: chosen files shown as cards']);
    expect(said(() => designer.setWidgetOptions(id, { filesSwitch: true }))).toEqual(['“Documents”: people can switch how chosen files show']);
    expect(said(() => designer.setWidgetOptions(id, { files: null, filesSwitch: null }))).toEqual(['“Documents”: chosen files shown as a list', '“Documents”: people can no longer switch how chosen files show']);
    expect(said(() => designer.setFileRules(id, { multiple: false }))).toEqual(['“Documents” takes one file again']);
    const photos = made('image');
    const before = photos.page();
    photos.designer.setWidgetOptions(photos.id, { camera: true, files: 'list' });
    expect(pageChanges(before, photos.page())).toEqual(['“Photos”: chosen files shown as a list', '“Photos”: phones offer the rear camera']);
    const front = photos.page();
    photos.designer.setWidgetOptions(photos.id, { camera: 'user' });
    expect(pageChanges(front, photos.page())).toEqual(['“Photos”: phones offer the front camera']);
    const off = photos.page();
    photos.designer.setWidgetOptions(photos.id, { camera: null });
    photos.designer.setFileRules(photos.id, { maxSize: 2048 });
    expect(pageChanges(off, photos.page())).toEqual(['“Photos”: the files it takes changed', '“Photos”: phones no longer offer the camera']);
  });
});

describe('several files, on the card and in the side panel', () => {
  const panel = (host: Element) => host.querySelector('.fd-properties') as HTMLElement;
  const card = (host: Element) => host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
  const named = <T extends HTMLElement>(scope: Element, name: string) => [...scope.querySelectorAll<T>(`[aria-label="${name}"]`)].filter((e) => !e.closest('[hidden]'));

  function picked(kind: 'file' | 'image' = 'file') {
    const result = made(kind);
    const { host } = mount(result.designer, { mode: 'simple' });
    result.designer.select(result.id);
    return { ...result, host };
  }

  it('turns on More than one file, and then asks at least and at most, once each in the panel and on the card', () => {
    const { designer, id, host, page } = picked();
    expect(named(panel(host), 'At most')).toHaveLength(0);
    const several = named<HTMLButtonElement>(panel(host), 'More than one file');
    expect(several).toHaveLength(1);
    expect(several[0].getAttribute('role')).toBe('switch');
    several[0].click();
    expect(fieldOf(page(), id)).toMatchObject({ multiple: true });
    expect(named<HTMLButtonElement>(card(host), 'More than one file')[0].getAttribute('aria-checked')).toBe('true');
    const most = named<HTMLInputElement>(panel(host), 'At most');
    expect(most).toHaveLength(1);
    type(most[0], '3');
    most[0].dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldOf(page(), id)).toMatchObject({ maxFiles: 3 });
    expect(named<HTMLInputElement>(card(host), 'At most')[0].value).toBe('3');
    // Empty: no limit.
    type(most[0], '');
    most[0].dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldOf(page(), id)).not.toHaveProperty('maxFiles');
    void designer;
  });

  it('shows the card honestly: the drop zone says the most it takes', () => {
    const { designer, id, host } = picked();
    designer.setFileRules(id, { multiple: true, maxFiles: 5 });
    expect(card(host).querySelector('.fd-file-limits')?.textContent).toContain('up to 5 files');
    expect(card(host).querySelector('.fd-file-pick')?.textContent).toContain('Add files');
  });

  it('shows chosen files as a list, as thumbnails or as cards', () => {
    const { id, host, page } = picked();
    const group = named(panel(host), 'Show chosen files as')[0];
    const choice = (words: string) => [...group.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === words) as HTMLButtonElement;
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['List', 'Thumbnails', 'Cards']);
    expect(choice('List').getAttribute('aria-pressed')).toBe('true');
    choice('Thumbnails').click();
    expect(nodeOf(page(), id).options).toEqual({ files: 'thumbnails' });
    expect(card(host).querySelector('.fd-file')?.classList.contains('fd-files-thumbs')).toBe(true);
    choice('Cards').click();
    expect(nodeOf(page(), id).options).toEqual({ files: 'cards' });
    expect(choice('Cards').getAttribute('aria-pressed')).toBe('true');
    expect(card(host).querySelector('.fd-file')?.classList.contains('fd-files-cards')).toBe(true);
    // Back to how a file upload shows them anyway: nothing kept.
    choice('List').click();
    expect(nodeOf(page(), id).options).toBeUndefined();
  });

  it('lets people switch how the files show, once in the panel and on the card', () => {
    const { id, host, page } = picked('image');
    const switches = named<HTMLButtonElement>(panel(host), 'People can switch');
    expect(switches).toHaveLength(1);
    expect([switches[0].getAttribute('role'), switches[0].getAttribute('aria-checked')]).toEqual(['switch', 'false']);
    switches[0].click();
    expect(nodeOf(page(), id).options).toEqual({ filesSwitch: true });
    expect(named<HTMLButtonElement>(card(host), 'People can switch')[0].getAttribute('aria-checked')).toBe('true');
    // Off: nothing kept.
    named<HTMLButtonElement>(card(host), 'People can switch')[0].click();
    expect(nodeOf(page(), id).options).toBeUndefined();
  });

  it('offers a phone’s camera on an image, with the largest size and no kinds of file', () => {
    const { id, host, page } = picked('image');
    expect(named(panel(host), 'Kinds of file')).toHaveLength(0);
    expect(named(panel(host), 'Largest file')).toHaveLength(1);
    const camera = named<HTMLSelectElement>(panel(host), 'Camera on phones')[0];
    expect([...camera.options].map((o) => o.textContent)).toEqual(['No', 'Rear camera', 'Front camera']);
    choose(camera, 'environment');
    expect(nodeOf(page(), id).options).toEqual({ camera: true });
    choose(camera, 'user');
    expect(nodeOf(page(), id).options).toEqual({ camera: 'user' });
    expect(named(panel(picked('file').host), 'Camera on phones')).toHaveLength(0);
  });

  it('says an image with no largest size takes any size', () => {
    const { id, host, page } = picked('image');
    const largest = named<HTMLSelectElement>(panel(host), 'Largest file')[0];
    expect(largest.value).toBe('');
    expect(largest.selectedOptions[0].textContent).toBe('Any size');
    choose(largest, String(1024 * 1024));
    expect(fieldOf(page(), id)).toMatchObject({ maxSize: 1048576 });
    choose(largest, '');
    expect(fieldOf(page(), id)).not.toHaveProperty('maxSize');
  });

  it('shows a largest size of the page’s own as it is', () => {
    const { designer, id, host } = picked('image');
    designer.setFileRules(id, { maxSize: 2 * 1048576 });
    const largest = named<HTMLSelectElement>(panel(host), 'Largest file')[0];
    expect([largest.value, largest.selectedOptions[0].textContent]).toEqual(['2097152', '2 MB']);
  });
});

describe('how the files show, in Arabic', () => {
  const q = (name: string) => `«⁨${name}⁩»`;
  it('offers a list, thumbnails and cards, and people switching, in Arabic', () => {
    const designer = createDesigner({ page: blankPage('screen', 'زيارة', { locale: 'ar' }), locale: 'ar' });
    const id = designer.addQuestion('file', { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label: 'المستندات' });
    const { host } = mount(designer, { mode: 'simple' });
    designer.select(id);
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    const group = panel.querySelector('[aria-label="عرض الملفات المختارة بشكل"]') as HTMLElement;
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['قائمة', 'صور مصغّرة', 'بطاقات']);
    expect(panel.querySelector('[role="switch"][aria-label="يمكن للناس تبديل العرض"]')).not.toBeNull();
    const before = designer.getPage();
    designer.setWidgetOptions(id, { files: 'cards', filesSwitch: true });
    expect(pageChanges(before, designer.getPage(), ar)).toEqual([`${q('المستندات')}: تُعرض الملفات المختارة بطاقاتٍ`, `${q('المستندات')}: يمكن للناس تبديل طريقة عرض الملفات المختارة`]);
    const after = designer.getPage();
    designer.setWidgetOptions(id, { filesSwitch: null });
    expect(pageChanges(after, designer.getPage(), ar)).toEqual([`${q('المستندات')}: لم يعد بإمكان الناس تبديل طريقة عرض الملفات المختارة`]);
  });
});
