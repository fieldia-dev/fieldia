import { createForm, createMemoryDataSource, formLanguagesPart, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { languagesPart } from './widget-parts';

/**
 * Before the languages part has come: a text kept in several languages drawn by something that did not wait for its
 * part, as the viewer does, reads its first text typed, and is its switch and boxes in the same place once the part
 * came. This file starts with no part loaded.
 */

const page = {
  fieldia: '0.13',
  id: 'service',
  data: { kind: 'record', model: 'service' },
  fields: { name: { type: 'char', label: 'Service', translate: ['en', 'ar'] } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
} as unknown as Page;

it('reads its first text until its part comes, then is its switch in the same place, with the form’s code for it', async () => {
  const form = createForm({ page, dataSource: createMemoryDataSource() });
  const made = createWidget({ form, name: 'name', field: page.fields['name'], node: { type: 'field', id: 'f-name', field: 'name' }, id: 'fd-name', document });
  const host = document.createElement('div');
  host.append(made.element);
  document.body.replaceChildren(host);
  made.update({ value: { en: 'Whitening', ar: 'تبييض' }, values: {}, readonly: false, required: false, invalid: false });
  expect(made.element.textContent).toBe('Whitening');
  expect(languagesPart.loaded).toBeUndefined();
  await languagesPart.load();
  expect(formLanguagesPart.loaded).toBeDefined();
  expect(host.firstElementChild).toBe(made.element);
  expect(made.element.querySelectorAll('[role="tab"]')).toHaveLength(2);
  expect((made.element.querySelector('[role="tabpanel"]:not([hidden]) input') as HTMLInputElement).value).toBe('Whitening');
});
