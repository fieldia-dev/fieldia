import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { columnProperties, listProperties } from './list-properties';

/**
 * A list people read anywhere and shape themselves, as the designer sets it:
 * its cards on a phone and its gallery (the list's panel, beside its map and
 * its calendar), what a card shows — brought from the model and kept while
 * it names them — and, in a column's panel, the new ways to draw its cells
 * and whether people may hide it.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  company: { type: 'char', label: 'Company' },
  photo: { type: 'image', label: 'Photo' },
  phone: { type: 'char', label: 'Phone' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }] },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
  score: { type: 'integer', label: 'Score' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const contacts = () => {
  const designer = createDesigner({ page: blankPage('list', 'Contacts'), model });
  for (const field of ['name', 'state', 'score', 'tag_ids', 'phone']) designer.addColumn(field);
  return designer;
};
const toggle = (box: HTMLInputElement) => {
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const choose = (box: HTMLSelectElement, value: string) => {
  box.value = value;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('a list’s cards and gallery, by the designer', () => {
  it('gives the list cards and a gallery, and takes them away', () => {
    const designer = contacts();
    expect(designer.setListOptions({ card: {}, gallery: { opens: 'gallery' } })).toBe(true);
    expect(list(designer).card).toEqual({});
    expect(list(designer).gallery).toEqual({ opens: 'gallery' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ card: null, gallery: null })).toBe(true);
    expect(list(designer).card).toBeUndefined();
    expect(list(designer).gallery).toBeUndefined();
  });

  it('brings what a card shows from the model, and lets it go when nothing names it', () => {
    const designer = contacts();
    expect(designer.setListOptions({ card: { subtitle: 'company', image: 'photo', fields: ['phone'] } })).toBe(true);
    expect(designer.getPage().fields['company']).toEqual(model['company']);
    expect(designer.getPage().fields['photo']).toEqual(model['photo']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ card: null })).toBe(true);
    expect(designer.getPage().fields['company']).toBeUndefined();
    expect(designer.getPage().fields['photo']).toBeUndefined();
  });

  it('the list’s panel: cards on a phone, a gallery opened on and sized, and what a card shows', () => {
    const designer = contacts();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const part = panel.element.querySelector('[data-part="cards"]') as HTMLElement;
    const control = <T extends Element>(name: string) => part.querySelector<T>(`[aria-label="${name}"]`) as T;
    const details = control<HTMLSelectElement>('Title').closest('.fd-props') as HTMLElement;
    expect(details.hidden).toBe(true);
    toggle(control('Each record as a card on a phone'));
    expect(list(designer).card).toEqual({});
    expect(details.hidden).toBe(false);
    choose(control('Under the title'), 'company');
    choose(control('Picture'), 'photo');
    choose(control('Status pill'), 'state');
    expect(list(designer).card).toEqual({ subtitle: 'company', image: 'photo', status: 'state' });
    toggle(control('Labels beside the card’s lines'));
    expect(list(designer).card?.labels).toBe(false);
    toggle(control('A gallery of cards, on any width'));
    expect(list(designer).gallery).toEqual({});
    toggle(control('Open on the gallery'));
    choose(control('Card size'), 'large');
    expect(list(designer).gallery).toEqual({ opens: 'gallery', size: 'large' });
    choose(control('Card size'), 'medium');
    expect(list(designer).gallery).toEqual({ opens: 'gallery' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});

describe('a column’s new ways and its hiding, by the designer', () => {
  const panelFor = (designer: ReturnType<typeof createDesigner>, column: string) => {
    const panel = columnProperties(elementFactory(document), designer, column);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    return panel.element;
  };
  const ways = (element: HTMLElement) => [...(element.querySelector('[aria-label="Drawn as"]') as HTMLSelectElement).options].map((option) => option.value);

  it('offers each kind the ways it can be drawn', () => {
    const designer = contacts();
    expect(ways(panelFor(designer, 'state'))).toEqual(['', 'dot', 'badge']);
    expect(ways(panelFor(designer, 'tag_ids'))).toEqual(['', 'tags']);
    expect(ways(panelFor(designer, 'score'))).toEqual(['', 'progressbar']);
    expect(ways(panelFor(designer, 'phone'))).toEqual(['', 'badge', 'avatar', 'image', 'phone']);
  });

  it('draws a phone with its links, a choice as a pill keeping its colours, and refuses a way its kind has not', () => {
    const designer = contacts();
    const phone = panelFor(designer, 'phone');
    choose(phone.querySelector('[aria-label="Drawn as"]') as HTMLSelectElement, 'phone');
    const links = phone.querySelector('[aria-label="Call and WhatsApp links"]') as HTMLInputElement;
    expect(links.closest('[data-part]')?.hasAttribute('hidden')).toBe(false);
    toggle(links);
    expect(list(designer).cells?.['phone']).toEqual({ widget: 'phone', options: { links: true } });
    toggle(links);
    expect(list(designer).cells?.['phone']).toEqual({ widget: 'phone' });
    designer.setListCell('state', { widget: 'dot', options: { colours: { lead: '#2563eb' } } });
    const state = panelFor(designer, 'state');
    choose(state.querySelector('[aria-label="Drawn as"]') as HTMLSelectElement, 'badge');
    expect(list(designer).cells?.['state']).toEqual({ widget: 'badge', options: { colours: { lead: '#2563eb' } } });
    expect(state.querySelector('[aria-label="Pill colour for Lead"]')).not.toBeNull();
    expect(designer.setListCell('state', { widget: 'tags' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Status cannot be drawn so: chips are a link’s records, a bar is a number’s, a phone is a text’s']);
  });

  it('lets people hide a column, shown or hidden at first, never every one hidden; a column taken away takes it with it', () => {
    const designer = contacts();
    const score = panelFor(designer, 'score');
    const mayHide = score.querySelector('[aria-label="People may hide it"]') as HTMLSelectElement;
    expect(mayHide.value).toBe('no');
    choose(mayHide, 'hide');
    expect(list(designer).optionalColumns).toEqual({ score: 'hide' });
    expect(designer.setListOptions({ optionalColumn: { field: 'phone', starts: 'show' } })).toBe(true);
    expect(list(designer).optionalColumns).toEqual({ score: 'hide', phone: 'show' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    for (const field of ['name', 'state', 'tag_ids', 'phone']) designer.setListOptions({ optionalColumn: { field, starts: 'hide' } });
    // The last asked for shows: the list opens with a column.
    expect(Object.values(list(designer).optionalColumns ?? {}).filter((starts) => starts === 'show')).toHaveLength(1);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    designer.removeColumn('score');
    expect(list(designer).optionalColumns?.['score']).toBeUndefined();
    expect(designer.setListOptions({ optionalColumn: { field: 'company', starts: 'show' } })).toBe(false);
  });
});

describe('a list’s rows, by the designer: their tones, bold and own buttons', () => {
  it('sets each row’s tone and bold by conditions on its record, refusing one that does not read', () => {
    const designer = contacts();
    expect(designer.setListOptions({ rowTones: [{ tone: 'muted', when: "state == 'lead'" }], rowBold: 'score > 80' })).toBe(true);
    expect(list(designer).rowTones).toEqual([{ tone: 'muted', when: "state == 'lead'" }]);
    expect(list(designer).rowBold).toBe('score > 80');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ rowBold: 'floors > 3' })).toBe(false);
    expect(designer.getState().issues[0]).toMatch(/^When: /);
    expect(designer.setListOptions({ rowTones: null, rowBold: null })).toBe(true);
    expect(list(designer).rowTones).toBeUndefined();
    expect(list(designer).rowBold).toBeUndefined();
  });

  it('puts buttons on each row: their words, the app’s action, hidden by a condition, kept by their ids', () => {
    const designer = contacts();
    expect(designer.setListOptions({ rowButtons: [{ label: 'Call back' }] })).toBe(true);
    const made = list(designer).rowButtons?.[0];
    expect(made).toEqual({ type: 'button', id: expect.any(String), label: 'Call back', action: 'call_back' });
    expect(designer.setListOptions({ rowButtons: [{ id: made?.id, label: 'Call back', action: 'call_contact', invisible: "state == 'customer'" }] })).toBe(true);
    expect(list(designer).rowButtons).toEqual([{ type: 'button', id: made?.id, label: 'Call back', action: 'call_contact', invisible: "state == 'customer'" }]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ rowButtons: [{ label: '  ' }] })).toBe(false);
    expect(designer.setListOptions({ rowButtons: null })).toBe(true);
    expect(list(designer).rowButtons).toBeUndefined();
  });

  it('the list’s panel: a tone added by its condition, and a button on each row', () => {
    const designer = contacts();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const part = panel.element.querySelector('[data-part="rows"]') as HTMLElement;
    ([...part.querySelectorAll('button')].find((b) => b.textContent === 'Add a tone') as HTMLButtonElement).click();
    const when = part.querySelector('.fd-table-tone-row input[aria-label="When"]') as HTMLInputElement;
    when.value = "state == 'lead'";
    when.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).rowTones).toEqual([{ tone: 'danger', when: "state == 'lead'" }]);
    ([...part.querySelectorAll('button')].find((b) => b.textContent === 'Add a button on each row') as HTMLButtonElement).click();
    expect(list(designer).rowButtons?.map((b) => b.label)).toEqual(['Button']);
    const words = part.querySelector('.fd-table-button input[aria-label="Words"]') as HTMLInputElement;
    words.value = 'Book a viewing';
    words.dispatchEvent(new Event('input', { bubbles: true }));
    expect(list(designer).rowButtons?.map((b) => b.label)).toEqual(['Book a viewing']);
  });

  it('names what a tone and the bold mean, for the key over the rows; the bold let go takes its words with it', () => {
    const designer = contacts();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const part = panel.element.querySelector('[data-part="rows"]') as HTMLElement;
    const boldWords = part.querySelector('input[aria-label="What bold means"]') as HTMLInputElement;
    // No bold yet: nothing to name.
    expect(boldWords.closest('label')?.hidden).toBe(true);
    expect(designer.setListOptions({ rowTones: [{ tone: 'danger', when: "state == 'lead'" }], rowBold: 'score > 80' })).toBe(true);
    expect(boldWords.closest('label')?.hidden).toBe(false);
    boldWords.value = 'Your best customers';
    boldWords.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).rowBoldLabel).toBe('Your best customers');
    const toneWords = part.querySelector('.fd-table-tone-row input[aria-label="What this tone means"]') as HTMLInputElement;
    toneWords.value = 'Still a lead';
    toneWords.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).rowTones).toEqual([{ tone: 'danger', when: "state == 'lead'", label: 'Still a lead' }]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ rowBold: null })).toBe(true);
    expect(list(designer).rowBoldLabel).toBeUndefined();
  });
});
