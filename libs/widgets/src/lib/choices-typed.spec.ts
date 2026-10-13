import { createForm, createMemoryDataSource, type Field, type FieldNode, type Form, type Locale, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { memoryPreferences } from './preferences';
import { mountKind, press } from './test-kinds';
import { typeAhead } from './pick-list';
import { createWidget } from './widgets';

/**
 * Choices and links typed in as a person types (the input rules, 7): Enter
 * takes the match reached, the only match, or the exact name, and never sends
 * the form; leaving takes the exact name, or puts back what the field held
 * and says so; Arabic words are found however their letters are written, and
 * digits in any script; own answers are trimmed, and one that names an option
 * ticks it; a limit is said, never a box turned off; arrows follow the
 * screen right to left; an uploaded signature is checked like a file.
 */

const settle = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));
const hintSays = (root: ParentNode = document) => {
  const hint = [...root.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden);
  return hint ? hint.textContent : null;
};
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
/** Enter pressed: whether the form would be sent with it (its default not prevented). */
const enterSends = (input: HTMLInputElement) => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

describe('a link typed into', () => {
  const page = {
    fieldia: '0.1',
    id: 'customer',
    data: { kind: 'record', model: 'partner' },
    fields: {
      country_id: { type: 'many2one', label: 'Country', relation: 'country' },
      tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
      city_id: { type: 'many2one', label: 'City', relation: 'city' },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'n-country', field: 'country_id', options: { create: false } },
        { type: 'field', id: 'n-tags', field: 'tag_ids', options: { create: false } },
        { type: 'field', id: 'n-city', field: 'city_id', options: { create: false } },
      ],
    },
  } as unknown as Page;
  const source = () =>
    createMemoryDataSource({
      records: {
        country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Japan' } },
        tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' } },
        city: { 1: { name: 'أسوان' }, 2: { name: 'الإسكندرية' }, 3: { name: 'القاهرة' } },
      },
    });
  function mount(nodeId: string, form: Form = createForm({ page, dataSource: source() })) {
    const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === nodeId) as FieldNode;
    const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: `fd-${nodeId}`, document, labels: WIDGET_LABELS.en });
    const after = document.createElement('input');
    document.body.replaceChildren(widget.element, after);
    const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element, input: widget.element.querySelector('input') as HTMLInputElement, after };
  }

  it('takes the only match on Enter, and Enter never sends the form', async () => {
    const { form, input } = mount('n-country');
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    type(input, 'Jordan');
    expect(enterSends(input)).toBe(false);
    await settle();
    expect(form.getState().values['country_id']).toEqual({ id: 2, label: 'Jordan' });
    expect(input.value).toBe('Jordan');
  });

  it('with no match, says so under the box and still sends nothing', async () => {
    const { form, input } = mount('n-country');
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    type(input, 'Narnia');
    expect(enterSends(input)).toBe(false);
    await settle();
    expect(form.getState().values['country_id']).toEqual({ id: 1, label: 'Egypt' });
    expect(hintSays()).toBe('Country: nothing is called “⁨Narnia⁩”; pick one from the list. Country still holds Egypt');
    expect(input.getAttribute('aria-describedby')).toContain((document.querySelector('.fd-refusal-hint') as HTMLElement).id);
  });

  it('takes the exact name typed and left, and puts the held record back for words that name none, saying so', async () => {
    const { form, input, after } = mount('n-country');
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    type(input, 'jordan');
    after.focus();
    await settle(20);
    expect(form.getState().values['country_id']).toEqual({ id: 2, label: 'Jordan' });
    type(input, 'Ja');
    after.focus();
    await settle(20);
    expect(form.getState().values['country_id']).toEqual({ id: 2, label: 'Jordan' });
    expect(input.value).toBe('Jordan');
    expect(hintSays()).toBe('Country: nothing is called “⁨Ja⁩”; pick one from the list. Country still holds Jordan');
  });

  it('adds a tag typed by its name, on Enter or on leaving', async () => {
    const { form, input, after } = mount('n-tags');
    type(input, 'VIP');
    expect(enterSends(input)).toBe(false);
    await settle();
    expect((form.getState().values['tag_ids'] as RelatedRecord[]).map((r) => r.label)).toEqual(['VIP']);
    type(input, 'wholesale');
    after.focus();
    await settle(20);
    expect((form.getState().values['tag_ids'] as RelatedRecord[]).map((r) => r.label)).toEqual(['VIP', 'Wholesale']);
  });

  it('finds Arabic names without their hamza, with ه for ة, and sends the data source digits as 0-9', async () => {
    const { form, input } = mount('n-city');
    for (const [typed, found] of [['اسوان', 'أسوان'], ['الاسكندرية', 'الإسكندرية'], ['القاهره', 'القاهرة']]) {
      type(input, typed);
      enterSends(input);
      await settle();
      expect({ typed, found: (form.getState().values['city_id'] as RelatedRecord | null)?.label }).toEqual({ typed, found });
    }
    const asked: string[] = [];
    const watched = createForm({ page, dataSource: { ...source(), search: async (request) => (asked.push(request.query), []) } });
    const box = mount('n-city', watched).input;
    type(box, 'Floor ١٢');
    await settle();
    expect(asked).toContain('Floor 12');
  });
});

describe('a choice’s search box and its tags', () => {
  const floors = Array.from({ length: 20 }, (_, i) => ({ value: `f${i + 1}`, label: `Floor ${i + 1}` }));
  const box = (el: HTMLElement) => el.querySelector('input') as HTMLInputElement;

  it('takes an option’s exact name typed and left; words that name none put the choice back and say so', () => {
    const { el, form, value } = mountKind({ type: 'selection', label: 'Floor', options: floors });
    const input = box(el);
    type(input, 'floor 12');
    input.blur();
    expect(value()).toBe('f12');
    expect(input.value).toBe('Floor 12');
    type(input, 'Floor 99');
    input.blur();
    expect(value()).toBe('f12');
    expect(input.value).toBe('Floor 12');
    expect(hintSays()).toBe('Floor: nothing is called “⁨Floor 99⁩”; pick one from the list');
    void form;
  });

  it('takes the only match on Enter, Arabic digits too, and never sends the form; no match is said', () => {
    const { el, value } = mountKind({ type: 'selection', label: 'Floor', options: floors });
    const input = box(el);
    type(input, '١٢');
    expect(enterSends(input)).toBe(false);
    expect(value()).toBe('f12');
    type(input, 'Basement');
    expect(enterSends(input)).toBe(false);
    expect(value()).toBe('f12');
    expect(hintSays()).toBe('Floor: nothing is called “⁨Basement⁩”; pick one from the list');
  });

  it('finds Arabic words written without hamza or with ه', () => {
    const cities = [
      { value: 'aswan', label: 'أسوان' },
      { value: 'alex', label: 'الإسكندرية' },
      { value: 'luxor', label: 'الأقصر' },
      { value: 'cairo', label: 'القاهرة' },
    ];
    for (const [typed, found] of [['اسوان', 'aswan'], ['الاسكندرية', 'alex'], ['الاقصر', 'luxor'], ['القاهره', 'cairo']]) {
      const { el, value } = mountKind({ type: 'selection', label: 'City', options: cities }, { options: { search: true } }, { locale: 'ar', dir: 'rtl' });
      const input = box(el);
      type(input, typed);
      expect(enterSends(input)).toBe(false);
      expect({ typed, value: value() }).toEqual({ typed, value: found });
    }
  });

  it('adds an own answer typed and left to tags, and drops words that name nothing with a word', () => {
    const own = mountKind({ type: 'selection', label: 'Needs', multiple: true, ownAnswers: true, options: [{ value: 'lift', label: 'Lift' }] }, { widget: 'tags' });
    const input = box(own.el);
    type(input, '  Parking ');
    input.blur();
    expect(own.value()).toEqual(['Parking']);
    type(input, 'lift');
    input.blur();
    expect(own.value()).toEqual(['Parking', 'lift']);
    const closed = mountKind({ type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'k', label: 'Kitchen' }] }, { widget: 'tags' });
    const rooms = box(closed.el);
    type(rooms, 'Attic');
    rooms.blur();
    expect(closed.value()).toEqual([]);
    expect(hintSays()).toBe('Rooms: nothing is called “⁨Attic⁩”; pick one from the list');
  });
});

describe('a list of one’s own, typed ahead', () => {
  it('finds a row by its digits typed in any script', () => {
    const find = typeAhead(() => ['1', '2', '3', '4']);
    expect(find('٢', 0)).toBe(1);
    expect(find('۴', 0)).toBe(3);
  });
});

describe('a path picker typed into', () => {
  const ITERATIONS = {
    3: { name: 'Sprint 13', path: ['Portal', 'Sprint 13'] },
    4: { name: 'Sprint 14', path: ['Portal', 'Sprint 14'] },
  };
  function mount() {
    const page = {
      fieldia: '0.1',
      id: 'bug',
      data: { kind: 'record', model: 'work.item' },
      fields: { iteration: { type: 'many2one', label: 'Iteration', relation: 'work.iteration' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-iteration', field: 'iteration', widget: 'path' }] },
    } as unknown as Page;
    const form = createForm({ page, dataSource: createMemoryDataSource({ records: { 'work.iteration': ITERATIONS }, shows: { 'work.iteration': { path: 'path' } } }) });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'iteration', field: page.fields['iteration'] as Field, node, id: 'fd-it', document, labels: WIDGET_LABELS.en, preferences: memoryPreferences() });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['iteration'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    form.setValue('iteration', { id: 4, label: 'Sprint 14', path: ['Portal', 'Sprint 14'] });
    refresh();
    return { form, input: widget.element.querySelector('input') as HTMLInputElement, value: () => (form.getState().values['iteration'] as RelatedRecord | null)?.label };
  }
  const rows = () => [...document.querySelectorAll('[role=treeitem] .fd-path-words')].map((w) => w.textContent);

  it('takes on Tab the match that typing reached', async () => {
    const { input, value } = mount();
    type(input, 'Sprint 13');
    await settle();
    expect(rows()).toEqual(['Portal\\Sprint 13']);
    press(input, 'Tab');
    input.blur();
    expect(value()).toBe('Sprint 13');
  });

  it('finds a path written with /, with spaces round its separator, or with Arabic digits', async () => {
    for (const typed of ['Portal/Sprint 13', 'Portal \\ Sprint 13', 'portal / sprint ١٣']) {
      const { input } = mount();
      type(input, typed);
      await settle();
      expect({ typed, rows: rows() }).toEqual({ typed, rows: ['Portal\\Sprint 13'] });
    }
  });

  it('puts the held record back for words that name none, and says so', async () => {
    const { input, value } = mount();
    type(input, 'Sprint 99');
    await settle();
    input.blur();
    expect(value()).toBe('Sprint 14');
    expect(input.value).toBe('Portal\\Sprint 14');
    expect(hintSays()).toBe('Iteration: nothing is called “⁨Sprint 99⁩”; pick one from the list. Iteration still holds Portal\\Sprint 14');
  });
});

describe('an answer of one’s own under “Other”', () => {
  const colours = [{ value: 'red', label: 'Red' }, { value: 'green', label: 'Green' }];
  for (const widget of ['radio', 'checkboxes'] as const) {
    it(`${widget}: is held trimmed, and words naming an option tick it and say so`, () => {
      const { el, value } = mountKind({ type: 'selection', label: 'Colour', other: true, options: colours, ...(widget === 'checkboxes' ? { multiple: true } : {}) }, { widget });
      const box = el.querySelector('.fd-other-input') as HTMLInputElement;
      type(box, '  Blue  ');
      box.blur();
      expect(value()).toEqual(widget === 'radio' ? 'Blue' : ['Blue']);
      expect(box.value).toBe('Blue');
      for (const typed of ['red', 'RED ', 'Red']) {
        type(box, typed);
        box.blur();
        expect({ typed, value: value() }).toEqual({ typed, value: widget === 'radio' ? 'red' : ['red'] });
        expect(box.value).toBe('');
        expect((el.querySelector('input[value="0"]') as HTMLInputElement).checked).toBe(true);
        expect(hintSays()).toBe('“Red” is one of the choices, so it is ticked');
      }
    });
  }
});

describe('a limit on choices', () => {
  it('leaves the boxes on at the most, and a press on one more ticks nothing and says why', () => {
    const { el, value } = mountKind(
      { type: 'selection', label: 'Bring', multiple: true, options: ['a', 'b', 'c'].map((v) => ({ value: v, label: v.toUpperCase() })) },
      { widget: 'checkboxes', validate: [{ atMost: 2, message: 'Two at most' }] as never }
    );
    const boxes = [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    boxes[0].click();
    boxes[1].click();
    expect(value()).toEqual(['a', 'b']);
    expect(boxes[2].disabled).toBe(false);
    boxes[2].click();
    expect(boxes[2].checked).toBe(false);
    expect(value()).toEqual(['a', 'b']);
    expect(el.querySelector('.fd-choice-limit')?.textContent).toBe('You can choose 2; untick one to choose another');
  });

  it('ranks a Top N: its pick buttons never off, one past them says why; ↑ first and ↓ last out of sight, keeping their places', () => {
    const { el, value } = mountKind({ type: 'selection', label: 'Miss', multiple: true, options: ['a', 'b', 'c', 'd'].map((v) => ({ value: v, label: v.toUpperCase() })) }, { widget: 'ranking', options: { top: 2 } });
    const pick = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.fd-rank-pick')].find((b) => b.textContent === label) as HTMLButtonElement;
    pick('A').click();
    pick('B').click();
    expect(value()).toEqual(['a', 'b']);
    expect(pick('C').disabled).toBe(false);
    pick('C').click();
    expect(value()).toEqual(['a', 'b']);
    expect(el.querySelector('.fd-choice-limit')?.textContent).toBe('Only the top 2 are ranked; take one out to rank another');
    const items = [...el.querySelectorAll<HTMLElement>('.fd-rank-item')];
    const [up, down] = [items[0].querySelector('.fd-rank-up') as HTMLButtonElement, items[1].querySelector('.fd-rank-down') as HTMLButtonElement];
    expect([up.disabled, up.style.visibility, down.disabled, down.style.visibility]).toEqual([false, 'hidden', false, 'hidden']);
    expect((items[0].querySelector('.fd-rank-down') as HTMLButtonElement).style.visibility).toBe('');
  });
});

describe('stars and a scale right to left', () => {
  it('move with the screen: ← to the next point on screen, a higher value', () => {
    for (const [widget, field] of [['scale', { min: 0, max: 10 }], ['rating', { min: 1, max: 5 }]] as const) {
      const { el, form, value } = mountKind({ type: 'integer', ...field }, { widget }, { locale: 'ar' as Locale, dir: 'rtl' });
      form.setValue('x', 3);
      const group = el.querySelector('[role=radiogroup]') as HTMLElement;
      press(group, 'ArrowLeft');
      press(group, 'ArrowLeft');
      expect({ widget, value: value() }).toEqual({ widget, value: 5 });
      press(group, 'ArrowRight');
      expect(value()).toBe(4);
    }
  });
});

describe('a signature uploaded', () => {
  // jsdom draws nothing: the pad's pen is none.
  beforeEach(() => jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));
  afterEach(() => jest.restoreAllMocks());
  function upload(el: HTMLElement, file: File) {
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('is checked like a file: a non-picture or one too large keeps the signature there was, and says why', async () => {
    const { el, form, value } = mountKind({ type: 'binary', label: 'Signature', maxSize: 2048 }, { widget: 'signature', options: { upload: true } });
    const kept = { name: 'signature.png', type: 'image/png', size: 10, data: 'AAAA' };
    form.setValue('x', kept);
    upload(el, new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    await settle(20);
    expect(value()).toEqual(kept);
    const note = el.querySelector('.fd-signature-note') as HTMLElement;
    expect([note.hidden, note.textContent]).toEqual([false, 'notes.txt must be an image file']);
    upload(el, new File([new Uint8Array(3000)], 'big.png', { type: 'image/png' }));
    await settle(20);
    expect(value()).toEqual(kept);
    expect(note.textContent).toBe('big.png is larger than 2 KB');
    upload(el, new File([new Uint8Array(30)], 'mine.png', { type: 'image/png' }));
    await settle(50);
    expect((value() as { name: string }).name).toBe('mine.png');
    expect(note.hidden).toBe(true);
  });
});
