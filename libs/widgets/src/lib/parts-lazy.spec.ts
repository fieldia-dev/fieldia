import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lazyPart, settleParts } from './parts';
import { installPartStyles, installStyles, PART_RANK } from './styles';
import { quietPart, themesPart, wearQuiet, wearTheme } from './look-parts';
import { choicePart, datePart, htmlPart, pathPart, relationsPart, surveyPart, textPart } from './widget-parts';
import { createWidget, widgetPart, type Widget } from './widgets';

/**
 * Before its part has come (parts.ts): a widget made by something that did
 * not wait for it, as the viewer does, is drawn plainly — a formatted text's
 * box alone for a work item's text and for the classic toolbar's, the plain box for a path picker — then by its part,
 * in the same place, with the last state it was given and the focus if it had
 * it. This file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const fields: Record<string, Field> = {
  notes: { type: 'html', label: 'Notes' },
  area: { type: 'many2one', label: 'Area', relation: 'area' },
  priority: { type: 'selection', label: 'Priority', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
  due: { type: 'date', label: 'Due' },
  at: { type: 'datetime', label: 'At' },
  slot: { type: 'char', label: 'Slot' },
  order: { type: 'selection', label: 'Order', multiple: true, options: [{ value: 'kitchen', label: 'Kitchen' }, { value: 'gym', label: 'Gym' }, { value: 'garden', label: 'Garden' }] },
  desk: { type: 'selection', label: 'Desk', options: [{ value: 'standing', label: 'Standing' }, { value: 'corner', label: 'Corner' }] },
  days: { type: 'integer', label: 'Days', min: 0, max: 5 },
  share: { type: 'float', label: 'Share' },
  rooms: { type: 'matrix', label: 'Rooms', rows: [{ value: 'kitchen', label: 'Kitchen' }, { value: 'quiet', label: 'Quiet room' }], columns: [{ value: 1, label: 'Mornings' }, { value: 2, label: 'Afternoons' }] },
  tag: { type: 'integer', label: 'Tag' },
  hex: { type: 'char', label: 'Hex' },
  home: { type: 'json', label: 'Home' },
  extra: { type: 'properties', label: 'Extra', definitions: [{ name: 'lift', label: 'Lift', type: 'boolean' }, { name: 'floor', label: 'Floor', type: 'integer' }] },
  done: { type: 'integer', label: 'Done' },
  cost: { type: 'monetary', label: 'Cost' },
};
const page = { fieldia: '0.1', id: 'p', title: 'P', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
const make = (node: FieldNode, form = createForm({ page, dataSource: createMemoryDataSource() })): Widget =>
  createWidget({ form, name: node.field, field: fields[node.field], node, id: `w-${node.id}`, document });
const state = (value: unknown) => ({ value: value as never, values: {}, readonly: false, required: false, invalid: false });

afterEach(() => document.body.replaceChildren());

describe('a part', () => {
  it('is asked for once, and asked for again after it failed', async () => {
    let asked = 0;
    let fail = true;
    const part = lazyPart('try', async () => {
      asked++;
      if (fail) throw new Error('offline');
      return { ok: true };
    });
    await expect(part.load()).rejects.toThrow('offline');
    expect(part.loaded).toBeUndefined();
    fail = false;
    await settleParts([part]);
    expect(await part.load()).toEqual({ ok: true });
    expect(part.loaded).toEqual({ ok: true });
    expect(asked).toBe(2);
  });

  it('is named by the widget that needs it, for the field that needs it', () => {
    expect(widgetPart(fields['notes'], { type: 'field', id: 'n', field: 'notes', options: { toolbar: 'focus' } })).toBe(textPart);
    // The classic formatted text: its toolbar the html part's, its box drawn plainly until it comes.
    expect(widgetPart(fields['notes'], { type: 'field', id: 'n', field: 'notes' })).toBe(htmlPart);
    expect(widgetPart(fields['area'], { type: 'field', id: 'a', field: 'area', widget: 'path' })).toBe(pathPart);
    // A link to another record: the relations part's box (relations-lazy.spec.ts).
    expect(widgetPart(fields['area'], { type: 'field', id: 'a', field: 'area' })).toBe(relationsPart);
    expect(widgetPart(fields['priority'], { type: 'field', id: 'p', field: 'priority', options: { list: 'own' } })).toBe(choicePart);
    expect(widgetPart(fields['priority'], { type: 'field', id: 'p', field: 'priority' })).toBeUndefined();
    // A choice searched as it is typed — asked for, or of more than 15 options — and several chosen as tags: the choice
    // part's too. A long list the page says not to search is the browser's.
    const long = { ...fields['priority'], options: Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: `Floor ${i}` })) } as Field;
    expect(widgetPart(long, { type: 'field', id: 'p', field: 'priority' })).toBe(choicePart);
    expect(widgetPart(long, { type: 'field', id: 'p', field: 'priority', options: { search: false } })).toBeUndefined();
    expect(widgetPart(fields['priority'], { type: 'field', id: 'p', field: 'priority', options: { search: true } })).toBe(choicePart);
    expect(widgetPart(fields['order'], { type: 'field', id: 'o', field: 'order', widget: 'tags' })).toBe(choicePart);
    // A date, a date and time, a time of day and a range of dates: Fieldia's own box and its calendar.
    expect(widgetPart(fields['due'], { type: 'field', id: 'd', field: 'due' })).toBe(datePart);
    expect(widgetPart(fields['at'], { type: 'field', id: 't', field: 'at' })).toBe(datePart);
    expect(widgetPart(fields['slot'], { type: 'field', id: 's', field: 'slot', widget: 'time' })).toBe(datePart);
    expect(widgetPart(fields['due'], { type: 'field', id: 'd', field: 'due', widget: 'daterange' })).toBe(datePart);
    expect(widgetPart(fields['slot'], { type: 'field', id: 's', field: 'slot' })).toBeUndefined();
    // The survey kinds: a ranking, pictures to choose from, a slider, a matrix, a colour, an address, properties, a progress bar.
    const survey: [string, string | undefined][] = [
      ['order', 'ranking'], ['desk', 'image-choice'], ['days', 'slider'], ['share', 'slider'], ['rooms', undefined], ['tag', 'color'], ['hex', 'color'],
      ['home', 'address'], ['extra', undefined], ['done', 'progressbar'], ['share', 'progressbar'], ['cost', 'progressbar'],
    ];
    for (const [name, widget] of survey) expect(widgetPart(fields[name], { type: 'field', id: name, field: name, ...(widget ? { widget } : {}) })).toBe(surveyPart);
    // Their neighbours stay in the main script: a plain choice, checkboxes, a number box, a rating, JSON as text.
    for (const [name, widget] of [['desk', undefined], ['order', undefined], ['days', undefined], ['days', 'rating'], ['home', undefined]] as const) {
      expect(widgetPart(fields[name], { type: 'field', id: name, field: name, ...(widget ? { widget } : {}) })).toBeUndefined();
    }
  });

  it('never reaches the registry (widgets.ts) but for its types: a bundler would split the registry off with the part, and run it before the widgets it holds', () => {
    // The modules a module takes values from, or hands on: its imports and re-exports of this folder, types aside.
    const takes = (name: string) =>
      [...readFileSync(join(__dirname, `${name}.ts`), 'utf8').matchAll(/^(?:import|export)\s+(type\s+)?\{[^}]*\}\s+from\s+'\.\/([a-z-]+)'/gm)].filter(([, types]) => !types).map(([, , from]) => from);
    const parts = readdirSync(__dirname).filter((file) => file.endsWith('-part.ts')).map((file) => file.slice(0, -3));
    expect(parts).toEqual(expect.arrayContaining(['text-part', 'path-part', 'choice-part', 'date-part', 'survey-part']));
    for (const part of parts) {
      const reached = new Set<string>();
      const visit = (name: string): void => {
        if (reached.has(name)) return;
        reached.add(name);
        for (const next of takes(name)) visit(next);
      };
      visit(part);
      expect([part, reached.has('widgets')]).toEqual([part, false]);
    }
  });

  it('puts its sheet between Fieldia’s two, by its rank, once', () => {
    document.head.replaceChildren();
    installStyles(document);
    installPartStyles(document, 'later', '.b{}', PART_RANK.text);
    installPartStyles(document, 'earlier', '.a{}', PART_RANK.picker);
    installPartStyles(document, 'later', '.b{}', PART_RANK.text);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'earlier', 'later', 'fieldia-styles-looks']);
  });
});

describe('a widget made before its part came', () => {
  it('is drawn plainly, then by its part in the same place, with its last state and the focus it had', async () => {
    expect(textPart.loaded).toBeUndefined();
    const widget = make({ type: 'field', id: 'n', field: 'notes', options: { toolbar: 'focus' } });
    const box = document.createElement('div');
    document.body.append(box);
    box.append(widget.element);
    // Its box alone meanwhile, its words cleaned: it works.
    expect(widget.element.matches('.fd-richtext[contenteditable="true"]')).toBe(true);
    widget.update(state('<p>First</p>'));
    widget.focus();
    expect(document.activeElement).toBe(widget.element);
    await textPart.load();
    await Promise.resolve();
    // The work item's editor in its place, the text it was given, the focus in it.
    expect(box.children).toHaveLength(1);
    expect(box.firstElementChild).toBe(widget.element);
    expect(widget.element.classList.contains('fd-text')).toBe(true);
    expect(widget.element.textContent).toContain('First');
    expect(widget.element.contains(document.activeElement)).toBe(true);
    expect(document.getElementById('fieldia-editor-styles')).not.toBeNull();
    // From now on it is the part's own, at once.
    expect(make({ type: 'field', id: 'm', field: 'notes', options: { toolbar: 'focus' } }).element.classList.contains('fd-text')).toBe(true);
    widget.destroy?.();
  });

  it('a choice in Fieldia’s own list: the browser’s list meanwhile, then Fieldia’s own with the value it was given', async () => {
    expect(choicePart.loaded).toBeUndefined();
    const widget = make({ type: 'field', id: 'p', field: 'priority', options: { list: 'own' } });
    document.body.append(widget.element);
    expect(widget.element.tagName).toBe('SELECT');
    widget.update(state('2'));
    await choicePart.load();
    await Promise.resolve();
    expect(widget.element.classList.contains('fd-own-box')).toBe(true);
    expect(widget.element.textContent).toContain('2');
    expect(document.getElementById('fieldia-choice-styles')).not.toBeNull();
    widget.destroy?.();
  });

  it('a date: a plain box meanwhile that reads the page’s order and keeps what does not read, then Fieldia’s own box with its calendar, the value and the focus', async () => {
    expect(datePart.loaded).toBeUndefined();
    const form = createForm({ page, dataSource: createMemoryDataSource() });
    const widget = make({ type: 'field', id: 'd', field: 'due' }, form);
    const box = document.createElement('div');
    document.body.append(box);
    box.append(widget.element);
    const shown = () => widget.update({ ...state(form.getState().values['due'] ?? null), invalid: !!form.getState().unread['due'] });
    form.subscribe(shown);
    shown();
    // Meanwhile a text box that works: typed in the page's order, read as it is left, shown in words at rest.
    const plain = widget.element as HTMLInputElement;
    expect(plain.tagName).toBe('INPUT');
    expect(plain.type).toBe('text');
    expect(plain.placeholder).toBe('dd/mm/yyyy');
    plain.focus();
    plain.value = '31/02/2026';
    plain.dispatchEvent(new Event('change', { bubbles: true }));
    plain.blur();
    // Text that does not read is kept, marked, with why; the field keeps what it held.
    expect(form.getState().values['due'] ?? null).toBeNull();
    expect(form.getState().unread['due']).toEqual({ text: '31/02/2026', message: 'Due: February 2026 has 28 days' });
    expect(plain.value).toBe('31/02/2026');
    expect(plain.getAttribute('aria-invalid')).toBe('true');
    plain.focus();
    plain.value = '١٥/١٠/٢٠٢٦';
    plain.dispatchEvent(new Event('change', { bubbles: true }));
    plain.blur();
    expect(form.getState().values['due']).toBe('2026-10-15');
    expect(form.getState().unread['due']).toBeUndefined();
    expect(plain.value).toBe('15 Oct 2026');
    widget.focus();
    expect(plain.value).toBe('15/10/2026');
    await datePart.load();
    await Promise.resolve();
    // Fieldia's own box and its calendar button in its place (its hint beside it), the day it was given, the focus in it.
    expect(box.firstElementChild).toBe(widget.element);
    expect(box.querySelectorAll('input')).toHaveLength(1);
    expect(widget.element.classList.contains('fd-date-pick')).toBe(true);
    expect(widget.element.querySelector('.fd-calendar-button')).not.toBeNull();
    const input = widget.element.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('15/10/2026');
    // From now on it is the part's own, at once.
    expect(make({ type: 'field', id: 'e', field: 'at' }).element.classList.contains('fd-date-pick')).toBe(true);
    widget.destroy?.();
  });

  it('a survey kind: its value shown plainly and kept, a slider typed in its number box and a picture picked from radios, then the part’s own widget with it and the focus', async () => {
    expect(surveyPart.loaded).toBeUndefined();
    const form = createForm({ page, dataSource: createMemoryDataSource() });
    const box = document.createElement('div');
    document.body.append(box);
    const drawn = (node: FieldNode) => {
      const widget = make(node, form);
      box.append(widget.element);
      const shown = () => widget.update({ ...state(form.getState().values[node.field] ?? null), values: form.getState().values });
      form.subscribe(shown);
      shown();
      return widget;
    };
    const values = {
      order: ['garden', 'kitchen', 'gym'],
      rooms: { quiet: 2, kitchen: 1 },
      tag: 7,
      hex: '#2c8397',
      home: { city: 'Cairo', street: '1 Nile Street', country: 'EG' },
      extra: { lift: true, floor: 3 },
      done: 45,
    };
    for (const [name, value] of Object.entries(values)) form.setValue(name, value as never);
    const ranking = drawn({ type: 'field', id: 'order', field: 'order', widget: 'ranking' });
    const matrix = drawn({ type: 'field', id: 'rooms', field: 'rooms' });
    const tag = drawn({ type: 'field', id: 'tag', field: 'tag', widget: 'color' });
    const hex = drawn({ type: 'field', id: 'hex', field: 'hex', widget: 'color' });
    const address = drawn({ type: 'field', id: 'home', field: 'home', widget: 'address' });
    const extra = drawn({ type: 'field', id: 'extra', field: 'extra' });
    const done = drawn({ type: 'field', id: 'done', field: 'done', widget: 'progressbar' });
    const desk = drawn({ type: 'field', id: 'desk', field: 'desk', widget: 'image-choice' });
    const days = drawn({ type: 'field', id: 'days', field: 'days', widget: 'slider' });
    // Meanwhile each value plainly, in words, a line each — never changed by being shown.
    const lines = (widget: Widget) => [...widget.element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent);
    expect(lines(ranking)).toEqual(['1. Garden', '2. Kitchen', '3. Gym']);
    expect(lines(matrix)).toEqual(['Kitchen: Mornings', 'Quiet room: Afternoons']);
    expect(lines(tag)).toEqual(['Teal']);
    expect(lines(hex)).toEqual(['#2c8397']);
    expect(lines(address)).toEqual(['1 Nile Street', 'Cairo', 'Egypt']);
    expect(lines(extra)).toEqual(['Lift: Yes', 'Floor: 3']);
    expect(done.element.textContent).toBe('45');
    for (const [name, value] of Object.entries(values)) expect(form.getState().values[name]).toEqual(value);
    // Pictures to choose from: the choices' own radios, one picked; a slider: the number box, typed in.
    const radios = [...desk.element.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual(['Standing', 'Corner']);
    radios[1].click();
    expect(form.getState().values['desk']).toBe('corner');
    const number = days.element.matches('input') ? (days.element as HTMLInputElement) : (days.element.querySelector('input') as HTMLInputElement);
    number.focus();
    number.value = '4';
    number.dispatchEvent(new Event('input', { bubbles: true }));
    number.dispatchEvent(new Event('change', { bubbles: true }));
    expect(form.getState().values['days']).toBe(4);
    await surveyPart.load();
    await Promise.resolve();
    // The part's own widgets in their places, each with the value it was given, the slider with the focus.
    expect(box.children).toHaveLength(9);
    expect([...ranking.element.querySelectorAll('.fd-rank-words')].map((words) => words.textContent)).toEqual(['Garden', 'Kitchen', 'Gym']);
    expect(matrix.element.querySelectorAll('input:checked')).toHaveLength(2);
    expect(tag.element.querySelector('.fd-colour-button')?.getAttribute('aria-label')).toBe('Tag: Teal');
    expect((hex.element.querySelector('.fd-colour-code') as HTMLInputElement).value).toBe('#2c8397');
    expect((address.element.querySelector('[data-part="city"]') as HTMLInputElement).value).toBe('Cairo');
    expect(extra.element.querySelectorAll('.fd-property')).toHaveLength(2);
    expect(done.element.getAttribute('aria-valuenow')).toBe('45');
    expect(desk.element.querySelector('.fd-image-card[aria-checked="true"]')?.textContent).toBe('Corner');
    expect(days.element.classList.contains('fd-slider')).toBe(true);
    expect((days.element.querySelector('input[type="range"]') as HTMLInputElement).value).toBe('4');
    expect(document.activeElement).toBe(days.element.querySelector('input[type="range"]'));
    for (const [name, value] of Object.entries({ ...values, desk: 'corner', days: 4 })) expect(form.getState().values[name]).toEqual(value);
    // Their sheets, once each, in their places; from now on the part's own, at once.
    expect([...document.head.querySelectorAll('style')].map((style) => style.id).filter((sheet) => sheet.startsWith('fieldia-survey'))).toEqual(['fieldia-survey-styles', 'fieldia-survey-looks']);
    expect(make({ type: 'field', id: 'o2', field: 'order', widget: 'ranking' }).element.classList.contains('fd-ranking')).toBe(true);
    for (const widget of [ranking, matrix, tag, hex, address, extra, done, desk, days]) widget.destroy?.();
  });

  it('destroyed before its part came, is never drawn by it', async () => {
    expect(pathPart.loaded).toBeUndefined();
    const widget = make({ type: 'field', id: 'a', field: 'area', widget: 'path' });
    const box = document.createElement('div');
    document.body.append(box);
    box.append(widget.element);
    const plain = widget.element;
    expect(plain.querySelector('.fd-path')).toBeNull();
    widget.destroy?.();
    await pathPart.load();
    await Promise.resolve();
    expect(box.firstElementChild).toBe(plain);
    expect(document.getElementById('fieldia-path-styles')).toBeNull();
  });
});

describe('a look worn before its part came', () => {
  it('a theme: none meanwhile, worn as it comes, its sheet in first; the last one asked for wins, and none stays none', async () => {
    document.head.replaceChildren();
    expect(themesPart.loaded).toBeUndefined();
    const form = document.createElement('form');
    const off = document.createElement('div');
    document.body.append(form, off);
    // What a code editor does: read the tokens as the attribute changes — the theme's sheet is in by then.
    const seen: boolean[] = [];
    new MutationObserver(() => seen.push(!!document.getElementById('fieldia-theme-styles'))).observe(form, { attributes: true, attributeFilter: ['data-fd-theme'] });
    wearTheme(form, 'material');
    wearTheme(form, 'google-forms');
    off.setAttribute('data-fd-theme', 'apple');
    wearTheme(off, 'apple');
    wearTheme(off, null);
    expect(form.hasAttribute('data-fd-theme')).toBe(false);
    expect(off.hasAttribute('data-fd-theme')).toBe(false);
    await themesPart.load();
    await Promise.resolve();
    expect(form.getAttribute('data-fd-theme')).toBe('google-forms');
    expect(off.hasAttribute('data-fd-theme')).toBe(false);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'fieldia-theme-styles', 'fieldia-styles-looks']);
    await Promise.resolve();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
    // In now: at once.
    wearTheme(off, 'shadcn');
    expect(off.getAttribute('data-fd-theme')).toBe('shadcn');
  });

  it('the quiet look: its sheet in as it comes, after the themes’ and before every other part’s', async () => {
    expect(quietPart.loaded).toBeUndefined();
    wearQuiet(document);
    expect(document.getElementById('fieldia-quiet-styles')).toBeNull();
    await quietPart.load();
    await Promise.resolve();
    installPartStyles(document, 'fieldia-path-styles', '.p{}', PART_RANK.picker);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'fieldia-theme-styles', 'fieldia-quiet-styles', 'fieldia-path-styles', 'fieldia-styles-looks']);
    document.head.replaceChildren();
  });
});
