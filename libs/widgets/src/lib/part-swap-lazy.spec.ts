import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { lazyPart } from './parts';
import { businessPart, datePart, partWidget, surveyPart, textPart } from './widget-parts';
import { createWidget, type TypedText, type Widget, type WidgetContext, type WidgetFactory } from './widgets';

/**
 * A part's box taking its plain stand-in's place while the person types (partWidget, e7d349e): the text as typed, the
 * caret and the focus go to the part's box — never the value the stand-in made of it — and the stand-in's box, taken
 * away, reads nothing as it goes (Chromium sends it a change and a blur; Firefox and Safari none). A part's widget with
 * no box to take the text in leaves the stand-in's box beside it until it is left. This file starts with no part loaded.
 */

const fields: Record<string, Field> = {
  share: { type: 'float', label: 'Share' },
  spent: { type: 'float', label: 'Hours' },
  day: { type: 'date', label: 'Day' },
  tags: { type: 'many2many', label: 'Tags', relation: 'tag' },
  others: { type: 'many2many', label: 'Others', relation: 'tag' },
  n: { type: 'float', label: 'N' },
  days: { type: 'integer', label: 'Days', min: 0, max: 10 },
  level: { type: 'float', label: 'Level', min: 0, max: 10 },
};
const page = { fieldia: '0.1', id: 'p', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
const formFor = (values: Record<string, unknown> = {}) =>
  createForm({ page, values: values as never, dataSource: createMemoryDataSource({ records: { tag: { 1: { name: 'Alpha' }, 2: { name: 'Beta' } } } }) });

/** A field's widget, drawn as an app that did not wait for its part draws it, and kept up to date with its form. */
function drawn(form: ReturnType<typeof formFor>, name: string, widget?: string) {
  const node = { type: 'field', id: `f-${name}`, field: name, ...(widget ? { widget } : {}) } as FieldNode;
  const made = createWidget({ form, name, field: fields[name], node, id: `w-${name}`, document });
  document.body.append(made.element);
  const refresh = () => made.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return made;
}

/** Keys typed where the focus is: each lands, then an input says so. */
function type(box: HTMLInputElement, text: string) {
  for (const char of text) {
    const start = box.selectionStart ?? box.value.length;
    box.setRangeText(char, start, box.selectionEnd ?? start, 'end');
    box.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}

const focused = () => document.activeElement as HTMLInputElement;
const settle = () => new Promise((done) => setTimeout(done, 0));

afterEach(() => document.body.replaceChildren());

describe('typing across a part’s coming, its own boxes', () => {
  it('a per cent typed "2." keeps "2." in the part’s box, focused at its end: "5" then makes 2.5 %, never 25 %', async () => {
    const form = formFor();
    drawn(form, 'share', 'percentage');
    const plain = document.getElementById('w-share') as HTMLInputElement;
    plain.focus();
    type(plain, '2.');
    await businessPart.load();
    await settle();
    const box = focused();
    expect(box).not.toBe(plain);
    expect(box.classList.contains('fd-percentage')).toBe(true);
    expect({ text: box.value, caret: box.selectionStart }).toEqual({ text: '2.', caret: 2 });
    type(box, '5');
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(form.getState().values['share']).toBe(0.025);
  });

  it('hours typed "1." are never read as 01:00 under the keys: "1.5" is an hour and a half', async () => {
    const form = formFor();
    drawn(form, 'spent', 'duration');
    const plain = document.getElementById('w-spent') as HTMLInputElement;
    plain.focus();
    type(plain, '1.');
    await businessPart.load();
    await settle();
    expect(focused().value).toBe('1.');
    type(focused(), '5');
    focused().blur();
    expect({ value: form.getState().values['spent'], unread: form.getState().unread['spent'] ?? null }).toEqual({ value: 1.5, unread: null });
  });

  it('a date typed over its value, its part come, is read as the part’s box is left — never the old day', async () => {
    const form = formFor({ day: '2026-01-01' });
    drawn(form, 'day');
    const plain = document.getElementById('w-day') as HTMLInputElement;
    plain.focus();
    plain.select();
    type(plain, '15/10/2026');
    await datePart.load();
    await settle();
    expect(focused().value).toBe('15/10/2026');
    focused().blur();
    expect(form.getState().values['day']).toBe('2026-10-15');
  });
});

describe('typing across a part’s coming, a box with none to type in', () => {
  it('a links box reads the words typed in the tags box before it: the record so called is linked; words that name nothing are kept unread, with why', async () => {
    const form = formFor({ tags: [], others: [] });
    drawn(form, 'tags', 'links');
    drawn(form, 'others', 'links');
    // Two tags boxes typed in, the second last: the first's words already read as it was left, the second's still typed.
    const [first, second] = ['w-tags', 'w-others'].map((id) => document.getElementById(id) as HTMLInputElement);
    first.focus();
    type(first, 'Gamma');
    second.focus();
    type(second, 'Alpha');
    await textPart.load();
    await settle();
    await form.settle();
    expect((form.getState().values['others'] as { label: string }[]).map((tag) => tag.label)).toEqual(['Alpha']);
    expect(form.getState().unread['others'] ?? null).toBeNull();
    // The first box, left with words that name nothing, said so then; its links box is drawn with the field as it holds.
    expect(form.getState().values['tags']).toEqual([]);
  });

  it('words handed that name nothing are kept unread with why, marked, and a save waits for the reading', async () => {
    // The links box itself handed the words, as partWidget hands them.
    const form = formFor({ tags: [] });
    const node = { type: 'field', id: 'f-tags', field: 'tags', widget: 'links' } as FieldNode;
    const links = (await textPart.load()).linksWidget({ form, name: 'tags', field: fields['tags'], node, id: 'w-tags', document });
    document.body.append(links.element);
    form.subscribe(() => links.update({ value: form.getState().values['tags'], values: form.getState().values, readonly: false, required: false, invalid: false }));
    links.takeTyped?.({ text: 'Gamma', start: 5, end: 5, entered: [] });
    expect(form.getState().unread['tags']).toMatchObject({ text: 'Gamma', message: expect.stringContaining('still looking for') });
    await form.settle();
    expect(form.getState().unread['tags']).toMatchObject({ text: 'Gamma', message: expect.stringContaining('nothing is called') });
    expect(document.querySelector('.fd-links-box')?.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('typing across a slider’s coming', () => {
  it('"4" typed in its number box is the slider’s, focused; "2." on its way to 2.5 stays in its box until it is left', async () => {
    const form = formFor();
    drawn(form, 'days', 'slider');
    drawn(form, 'level', 'slider');
    const [days, level] = ['w-days', 'w-level'].map((id) => document.getElementById(id) as HTMLInputElement);
    days.focus();
    type(days, '4');
    // The second typed in last: it has the focus as the part comes, the first was left.
    level.focus();
    type(level, '2.');
    await surveyPart.load();
    await settle();
    expect(document.querySelectorAll('.fd-slider')).toHaveLength(2);
    expect(focused()).toBe(level);
    type(level, '5');
    level.blur();
    await settle();
    expect({ days: form.getState().values['days'], level: form.getState().values['level'], boxLeft: level.isConnected }).toEqual({ days: 4, level: 2.5, boxLeft: false });
  });
});

describe('partWidget’s hand-over', () => {
  /** What the stand-in says was typed, keys its guard holds among it; its box's text while null. */
  let saying: string | null = null;
  const standInSays = (text: string) => (saying = text);
  afterEach(() => (saying = null));

  /** A stand-in reading its box on change and blur; and a part whose widget takes typed text, or has no box. */
  function setUp(takes: boolean | 'declines') {
    let release: (module: { real: WidgetFactory }) => void = () => undefined;
    const part = lazyPart('swap', () => new Promise<{ real: WidgetFactory }>((done) => (release = done)));
    const form = formFor();
    const reads: string[] = [];
    const plain: WidgetFactory = ({ document: doc }) => {
      const input = doc.createElement('input');
      input.className = 'plain';
      input.addEventListener('change', () => reads.push(`change ${input.value}`));
      input.addEventListener('blur', () => reads.push(`blur ${input.value}`));
      return { element: input, focus: () => input.focus(), update: () => undefined, destroy: () => reads.push('plain destroyed'), typedText: () => saying ?? input.value };
    };
    const handed: TypedText[] = [];
    const real: WidgetFactory = ({ document: doc }) => {
      const input = doc.createElement('input');
      input.className = 'real';
      const widget: Widget = { element: input, focus: () => input.focus(), update: () => undefined };
      if (takes === 'declines') return { ...widget, takeTyped: () => false };
      return takes
        ? {
            ...widget,
            takeTyped: (typed) => {
              handed.push(typed);
              input.focus();
              return true;
            },
          }
        : widget;
    };
    const context = { form, name: 'n', field: fields['n'], node: { type: 'field', id: 'f', field: 'n' }, id: 'w', document } as WidgetContext;
    const widget = partWidget(part, context, (module) => module.real(context), plain);
    document.body.append(widget.element);
    return { form, widget, reads, handed, release: () => release({ real }), box: widget.element as HTMLInputElement };
  }

  it('hands the text, the caret and what the field held as the box was entered to the part’s widget', async () => {
    const { form, reads, handed, release, box } = setUp(true);
    form.setValue('n', 7);
    box.focus();
    type(box, '12');
    box.setSelectionRange(1, 1);
    release();
    await settle();
    expect(handed).toEqual([{ text: '12', start: 1, end: 1, entered: 7 }]);
    expect(focused().className).toBe('real');
    // Chromium's change and blur on the box taken away: never heard by the stand-in.
    box.dispatchEvent(new Event('change', { bubbles: true }));
    box.dispatchEvent(new FocusEvent('blur'));
    expect(reads).toEqual(['plain destroyed']);
  });

  it('hands the text as typed, keys its guard holds among it, the caret after them', async () => {
    const { handed, release, box } = setUp(true);
    // A stand-in whose guard holds a refused key: its box shows "12", "12x" was typed.
    box.focus();
    type(box, '12');
    standInSays('12x');
    release();
    await settle();
    expect(handed).toEqual([{ text: '12x', start: 3, end: 3, entered: null }]);
  });

  it('hands nothing when nothing was typed since the box was entered or read', async () => {
    const { handed, release, box } = setUp(true);
    box.focus();
    type(box, '3');
    box.dispatchEvent(new Event('change', { bubbles: true }));
    release();
    await settle();
    expect(handed).toEqual([]);
    expect(focused().className).toBe('real');
  });

  it.each([[false], ['declines' as const]])('a part’s widget that cannot take the text as it stands (%s): the stand-in’s box stays beside it until it is left, then reads and goes', async (takes) => {
    const { widget, reads, release, box } = setUp(takes);
    box.focus();
    type(box, '2.');
    release();
    await settle();
    expect((widget.element as HTMLElement).className).toBe('real');
    expect(widget.element.nextElementSibling).toBe(box);
    expect(focused()).toBe(box);
    type(box, '5');
    box.blur();
    await settle();
    // Left, it reads what it holds, all of it, then goes.
    expect(reads.slice(-2)).toEqual(['blur 2.5', 'plain destroyed']);
    expect(box.isConnected).toBe(false);
  });
});
