import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { lazyPart, settleParts } from './parts';
import { installPartStyles, installStyles, PART_RANK } from './styles';
import { choicePart, pathPart, textPart } from './widget-parts';
import { createWidget, widgetPart, type Widget } from './widgets';

/**
 * Before its part has come (parts.ts): a widget made by something that did
 * not wait for it, as the viewer does, is drawn plainly — the classic editor
 * for a work item's text, the plain box for a path picker — then by its part,
 * in the same place, with the last state it was given and the focus if it had
 * it. This file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const fields: Record<string, Field> = {
  notes: { type: 'html', label: 'Notes' },
  area: { type: 'many2one', label: 'Area', relation: 'area' },
  priority: { type: 'selection', label: 'Priority', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
};
const page = { fieldia: '0.1', id: 'p', title: 'P', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
const make = (node: FieldNode): Widget => {
  const form = createForm({ page, dataSource: createMemoryDataSource() });
  return createWidget({ form, name: node.field, field: fields[node.field], node, id: `w-${node.id}`, document });
};
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
    expect(widgetPart(fields['notes'], { type: 'field', id: 'n', field: 'notes' })).toBeUndefined();
    expect(widgetPart(fields['area'], { type: 'field', id: 'a', field: 'area', widget: 'path' })).toBe(pathPart);
    expect(widgetPart(fields['area'], { type: 'field', id: 'a', field: 'area' })).toBeUndefined();
    expect(widgetPart(fields['priority'], { type: 'field', id: 'p', field: 'priority', options: { list: 'own' } })).toBe(choicePart);
    expect(widgetPart(fields['priority'], { type: 'field', id: 'p', field: 'priority' })).toBeUndefined();
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
    // The classic editor meanwhile: it works.
    expect(widget.element.querySelector('.fd-richtext')).not.toBeNull();
    widget.update(state('<p>First</p>'));
    widget.focus();
    expect(document.activeElement).toBe(widget.element.querySelector('.fd-richtext'));
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
