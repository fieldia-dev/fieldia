import { createForm, type Field, type FieldNode, type FileValue, type Page } from '@fieldia/core';
import { memoryPreferences, type PreferenceStore } from './preferences';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * Files as cards (`options.files: 'cards'`): a picture over each file's name
 * and size — the image's own, or a large icon by its kind — the tile opening
 * the viewer, × on its corner asking first, and the add tile the last card.
 * And `options.filesSwitch`: the person filling the form flips the files
 * between a list and the page's pictures, the choice kept where the page keeps
 * its preferences.
 */

// jsdom has no object URLs: the browser's are stood in for.
beforeAll(() => Object.assign(URL, { createObjectURL: () => 'blob:1', revokeObjectURL: () => undefined }));

function setup(field: Record<string, unknown>, options: { readonly?: boolean; node?: Record<string, unknown>; locale?: 'en' | 'ar'; preferences?: PreferenceStore } = {}) {
  const page = {
    fieldia: '0.1',
    id: 'visit',
    data: { kind: 'responses' },
    fields: { x: { label: 'Documents', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...(options.node ? { options: options.node } : {}) }] },
  } as Page;
  const form = createForm({ page });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const locale = options.locale ?? 'en';
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node, id: 'fd-x', document, labels: WIDGET_LABELS[locale], locale, preferences: options.preferences });
  const root = document.createElement('div');
  root.className = 'fd-form';
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, value: () => form.getState().values['x'] as FileValue[] };
}

const stored = (name: string, type: string): FileValue => ({ name, type, size: 2048, data: 'aGVsbG8=' });
const FILES = [stored('Lobby.png', 'image/png'), stored('Quote for the 12th floor, revised.pdf', 'application/pdf'), stored('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), stored('site.zip', 'application/zip')];
const cards = (el: Element) => [...el.querySelectorAll<HTMLElement>('.fd-file-item')];
const button = (scope: Element, words: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === words) as HTMLButtonElement;
const views = (el: Element) => el.querySelector('[role="group"].fd-file-views') as HTMLElement | null;
const pressed = (el: Element) => [...(views(el)?.querySelectorAll('button') ?? [])].map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? ' ✓' : ''}`);

describe('files as cards', () => {
  it('draws each file as a card: its picture or a large icon by kind, then its name, then its size', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards' } });
    form.setValue('x', FILES);
    expect(el.classList.contains('fd-files-cards')).toBe(true);
    expect(el.classList.contains('fd-files-list')).toBe(false);
    const [photo, quote, sheet, zip] = cards(el);
    expect((photo.querySelector('img.fd-file-thumb') as HTMLImageElement).src).toBe('data:image/png;base64,aGVsbG8=');
    expect([quote, sheet, zip].map((c) => c.querySelector('.fd-file-icon')?.getAttribute('data-kind'))).toEqual(['pdf', 'sheet', 'zip']);
    // The picture first, the name under it, the size under that.
    const open = quote.querySelector('.fd-file-open') as HTMLButtonElement;
    expect([...open.children].map((c) => c.className)).toEqual(['fd-file-picture', 'fd-file-name', 'fd-file-size']);
    expect(open.querySelector('.fd-file-picture > .fd-file-icon')?.textContent).toBe('PDF');
    expect(open.querySelector('.fd-file-size')?.textContent).toBe('2 KB');
    // Whole on hover and to a screen reader.
    expect(open.querySelector('.fd-file-name')?.getAttribute('title')).toBe('Quote for the 12th floor, revised.pdf');
    expect(open.getAttribute('aria-label')).toBe('Quote for the 12th floor, revised.pdf, 2 KB');
  });

  it('parts a name in two at the space nearest its middle, the second half reading from its end', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards' } });
    const halves = (name: string) => {
      form.setValue('x', [stored(name, 'application/pdf')]);
      const parts = el.querySelector('.fd-file-name') as HTMLElement;
      return [parts.getAttribute('dir'), ...[...parts.children].map((part) => `${part.textContent}${part.getAttribute('dir') ? ` (${part.getAttribute('dir')})` : ''}`)];
    };
    // The first half ends in an ellipsis where it must; the second, in a box of the other direction, starts with one, its extension kept.
    expect(halves('Quote for the 12th floor, revised.pdf')).toEqual(['ltr', 'Quote for the 12th ', 'floor, revised.pdf (rtl)']);
    // No space near the middle: the middle itself.
    expect(halves('IMG_20261006_093412_HDR_panorama.pdf')).toEqual(['ltr', 'IMG_20261006_09341', '2_HDR_panorama.pdf (rtl)']);
    expect(halves('a.pdf')).toEqual(['ltr', 'a.p', 'df (rtl)']);
    // An Arabic name the other way round.
    expect(halves('عرض السعر للطابق الثاني عشر.pdf')).toEqual(['rtl', 'عرض السعر للطابق ', 'الثاني عشر.pdf (ltr)']);
  });

  it('names a file by the list’s parts again when the list is chosen', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards', filesSwitch: true } });
    form.setValue('x', FILES);
    button(views(el) as HTMLElement, 'List').click();
    const name = cards(el)[1].querySelector('.fd-file-name') as HTMLElement;
    expect([name.getAttribute('dir'), name.firstElementChild?.textContent, name.lastChild?.textContent]).toEqual(['auto', 'Quote for the 12th floor, re', 'vised.pdf']);
  });

  it('opens a file in the viewer from its card', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards' } });
    form.setValue('x', FILES);
    (cards(el)[1].querySelector('.fd-file-open') as HTMLButtonElement).click();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('h2')?.textContent).toBe('Quote for the 12th floor, revised.pdf');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('asks before × takes a card away', () => {
    const { el, form, value } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards' } });
    form.setValue('x', FILES);
    (cards(el)[3].querySelector('.fd-file-remove') as HTMLButtonElement).click();
    expect(el.querySelector('.fd-file-confirm span')?.textContent).toBe('Remove site.zip?');
    button(el.querySelector('.fd-file-confirm') as HTMLElement, 'Keep').click();
    expect(value()).toHaveLength(4);
    (cards(el)[3].querySelector('.fd-file-remove') as HTMLButtonElement).click();
    button(el.querySelector('.fd-file-confirm') as HTMLElement, 'Remove').click();
    expect(value().map((f) => f.name)).toEqual(['Lobby.png', 'Quote for the 12th floor, revised.pdf', 'budget.xlsx']);
  });

  it('ends with the add tile, after the cards in the order the keys go through them', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards' } });
    form.setValue('x', FILES);
    const pick = el.querySelector('.fd-file-pick') as HTMLElement;
    expect(pick.classList.contains('fd-image-pick')).toBe(true);
    expect(pick.textContent).toBe('Add filesor drop them here');
    // The picker's input and its tile come after the last card, as they are seen.
    const order = [...el.querySelectorAll('.fd-file-open, input[type=file]')].map((e) => (e.tagName === 'INPUT' ? 'add' : e.getAttribute('aria-label')?.split(',')[0]));
    expect(order).toEqual(['Lobby.png', 'Quote for the 12th floor', 'budget.xlsx', 'site.zip', 'add']);
  });

  it('reads only: cards to open, no × and no add tile', () => {
    const { el, form } = setup({ type: 'image', multiple: true }, { node: { files: 'cards' }, readonly: true });
    form.setValue('x', [stored('Lobby.png', 'image/png')]);
    expect(el.classList.contains('fd-files-cards')).toBe(true);
    expect(el.querySelector('.fd-file-remove')).toBeNull();
    expect((el.querySelector('.fd-file-pick') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.fd-file-open')).not.toBeNull();
  });
});

describe('a switch between a list and the pictures', () => {
  it('shows none unless the page asks for one', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards' } });
    form.setValue('x', FILES);
    expect(views(el)).toBeNull();
  });

  it('shows List and Cards over the files once there are files, and flips how they show', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards', filesSwitch: true } });
    const group = views(el) as HTMLElement;
    expect(group.getAttribute('aria-label')).toBe('Show files as');
    expect(group.closest('[hidden]')).not.toBeNull();
    form.setValue('x', FILES);
    expect(group.closest('[hidden]')).toBeNull();
    expect(pressed(el)).toEqual(['List', 'Cards ✓']);
    // Each with an icon, hidden from screen readers.
    expect([...group.querySelectorAll('button svg')].map((s) => s.getAttribute('aria-hidden'))).toEqual(['true', 'true']);
    button(group, 'List').click();
    expect(pressed(el)).toEqual(['List ✓', 'Cards']);
    expect([el.classList.contains('fd-files-list'), el.classList.contains('fd-files-cards')]).toEqual([true, false]);
    expect((el.querySelector('.fd-file-pick') as HTMLElement).classList.contains('fd-image-pick')).toBe(false);
    // In a list the drop zone is over the files again.
    expect(el.querySelector('input[type=file]')?.compareDocumentPosition(el.querySelector('.fd-files') as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // The files themselves are as they were, and the switch keeps its place.
    expect(cards(el)).toHaveLength(4);
    button(group, 'Cards').click();
    expect(el.classList.contains('fd-files-cards')).toBe(true);
    expect(views(el)).toBe(group);
  });

  it('flips a list to cards, and an image’s thumbnails to a list', () => {
    const listed = setup({ type: 'binary', multiple: true }, { node: { filesSwitch: true } });
    listed.form.setValue('x', FILES);
    expect(pressed(listed.el)).toEqual(['List ✓', 'Cards']);
    const photos = setup({ type: 'image', multiple: true }, { node: { filesSwitch: true } });
    photos.form.setValue('x', [stored('Lobby.png', 'image/png')]);
    expect(pressed(photos.el)).toEqual(['List', 'Thumbnails ✓']);
    button(views(photos.el) as HTMLElement, 'List').click();
    expect(photos.el.classList.contains('fd-files-list')).toBe(true);
  });

  it('keeps the choice where the page keeps its preferences, for this page and this field', () => {
    const preferences = memoryPreferences();
    const first = setup({ type: 'binary', multiple: true }, { node: { files: 'cards', filesSwitch: true }, preferences });
    first.form.setValue('x', FILES);
    button(views(first.el) as HTMLElement, 'List').click();
    expect(preferences.get('visit.n.files')).toBe('list');
    // Drawn again, as when the page is opened again: still a list.
    const again = setup({ type: 'binary', multiple: true }, { node: { files: 'cards', filesSwitch: true }, preferences });
    again.form.setValue('x', FILES);
    expect(again.el.classList.contains('fd-files-list')).toBe(true);
    expect(pressed(again.el)).toEqual(['List ✓', 'Cards']);
    // A kept choice the switch does not offer is not taken.
    preferences.set('visit.n.files', 'thumbnails');
    expect(setup({ type: 'binary', multiple: true }, { node: { files: 'cards', filesSwitch: true }, preferences }).el.classList.contains('fd-files-cards')).toBe(true);
  });

  it('switches while reading only, too, and says itself in Arabic', () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { node: { files: 'cards', filesSwitch: true }, readonly: true, locale: 'ar' });
    form.setValue('x', FILES);
    expect(views(el)?.getAttribute('aria-label')).toBe('عرض الملفات');
    expect(pressed(el)).toEqual(['قائمة', 'بطاقات ✓']);
    button(views(el) as HTMLElement, 'قائمة').click();
    expect(el.classList.contains('fd-files-list')).toBe(true);
  });
});
