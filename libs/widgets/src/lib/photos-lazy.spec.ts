import { createForm, type Field, type FieldNode, type FileValue, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { filesPart, photosPart } from './widget-parts';
import { createWidget, widgetPart } from './widgets';

/**
 * A photo set comes in a part of its own (photos-part.ts: its tiles, their order, the cover, captions, the crop and
 * turn dialog) with the files part, asked for only by a picture field of several photos drawn as `"widget": "photos"`:
 * a page with a plain picture field, or a single photo, never asks for it. Before it has come, the set shows the names
 * of its photos, and takes its place once it is in. This file starts with no part loaded (src/test-parts.ts leaves it
 * so). Its tests run in order.
 */

afterEach(() => document.body.replaceChildren());

const photo = (name: string): FileValue => ({ name, type: 'image/jpeg', size: 5, url: `https://files.example/${name}` });

function listing(drawnAs: string | undefined, field: Record<string, unknown> = { type: 'image', label: 'Photos', multiple: true }) {
  const page = {
    fieldia: '0.7',
    id: 'listing',
    data: { kind: 'responses' },
    fields: { photos: field as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-photos', field: 'photos', ...(drawnAs ? { widget: drawnAs } : {}) }] },
  } as unknown as Page;
  const form = createForm({ page, values: { photos: field['multiple'] ? [photo('Kitchen.jpg'), photo('Hall.jpg')] : photo('Kitchen.jpg') } });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'photos', field: page.fields['photos'], node, id: 'fd-photos', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.append(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['photos'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { page, node, widget };
}

describe('the photos part', () => {
  it('shows the photos’ names until it has come with the files part, then the set in their place', async () => {
    const { widget } = listing('photos');
    expect(widget.element.textContent).toBe('Kitchen.jpg, Hall.jpg');
    expect(document.querySelector('.fd-photos')).toBeNull();
    await photosPart.load();
    expect(filesPart.loaded).toBeDefined();
    expect(document.querySelectorAll('.fd-photo')).toHaveLength(2);
    expect(document.querySelector('.fd-photo-cover:not([hidden])')?.textContent).toBe('Cover');
    expect(document.getElementById('fieldia-photos-styles')?.getAttribute('data-fd-rank')).toBe('11');
  });

  it('is the part of a picture field of several photos drawn as a set; a plain picture field’s is the files part’s', () => {
    const set = listing('photos');
    expect(widgetPart(set.page.fields['photos'], set.node, {}, set.page)).toBe(photosPart);
    const plain = listing(undefined);
    expect(widgetPart(plain.page.fields['photos'], plain.node, {}, plain.page)).toBe(filesPart);
  });
});
