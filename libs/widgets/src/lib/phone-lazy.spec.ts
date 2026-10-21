import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { phonePart } from './widget-parts';
import { createWidget } from './widgets';

/**
 * A phone read the world over, made before the phone part came — by something that did not wait for it, as the
 * viewer does: the text box it was, which reads and writes the same value, then the part's own box in its place,
 * with the value, what was typed and the focus. This file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const FIELD: Field = { type: 'char', label: 'Mobile' };
const NODE: FieldNode = { type: 'field', id: 'f-mobile', field: 'mobile', widget: 'phone' };
const page = { fieldia: '0.8', id: 'p', data: { kind: 'responses' }, fields: { mobile: FIELD }, layout: { type: 'sections', id: 's', children: [NODE] }, phone: { country: 'EG' } } as Page;

it('is the text box it was until the part comes, then the part’s own box in its place, with the value and the focus', async () => {
  expect(phonePart.loaded).toBeUndefined();
  const form = createForm({ page, values: { mobile: '+201012345678' } });
  const widget = createWidget({ form, name: 'mobile', field: FIELD, node: NODE, id: 'fd-mobile', document });
  const host = document.createElement('div');
  host.append(widget.element);
  document.body.append(host);
  const update = () => widget.update({ value: form.getState().values['mobile'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(update);
  update();
  // Meanwhile: the box it was, the value as it is kept.
  const plain = host.querySelector('input') as HTMLInputElement;
  expect(plain.type).toBe('tel');
  expect(plain.value).toBe('+201012345678');
  expect(host.querySelector('.fd-phone')).toBeNull();
  widget.focus();
  await phonePart.load();
  await Promise.resolve();
  // The part's: the number as the page shows it, the focus in its box.
  expect(host.children).toHaveLength(1);
  expect(widget.element.matches('.fd-phone')).toBe(true);
  expect((widget.element.querySelector('.fd-phone-input') as HTMLInputElement).value).toBe('+20 10 1234 5678');
  expect(document.activeElement).toBe(widget.element.querySelector('.fd-phone-input'));
  widget.destroy?.();
});
