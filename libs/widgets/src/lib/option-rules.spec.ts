import { createForm, type FieldNode, type Page, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * Options that change with the other answers, in every widget that shows
 * choices: one shown by its condition, and those carried from an earlier
 * question — drawn again as they change, a value the record held as it was
 * opened kept and said.
 */

const page = {
  fieldia: '0.12',
  id: 'unit',
  data: { kind: 'responses' },
  fields: {
    kind: { type: 'selection', label: 'Unit type', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Apartment' }] },
    outside: { type: 'selection', label: 'Outside', options: [{ value: 'garden', label: 'Garden', invisible: "kind != 'villa'" }, { value: 'balcony', label: 'Balcony' }] },
    tried: { type: 'selection', label: 'Treatments', multiple: true, options: [{ value: 'botox', label: 'Botox' }, { value: 'filler', label: 'Filler' }, { value: 'peel', label: 'Peel' }] },
    again: { type: 'selection', label: 'Again', options: [{ value: 'no_one', label: 'None of them' }], optionsFrom: { field: 'tried' } },
  },
  layout: { type: 'sections', id: 'root', children: [] },
} as unknown as Page;

function mount(name: string, widget?: string, values: Values = {}) {
  const form = createForm({ page, values });
  const node = { type: 'field', id: `f-${name}`, field: name, ...(widget ? { widget } : {}) } as FieldNode;
  const shown = createWidget({ form, name, field: page.fields[name], node, id: `fd-${name}`, document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(shown.element);
  const refresh = () => shown.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const el = shown.element;
  const labels = () => [...el.querySelectorAll('label.fd-choice')].map((l) => l.textContent);
  const options = () => [...el.querySelectorAll('option')].map((o) => o.textContent).filter(Boolean);
  const note = () => [...el.querySelectorAll('[role=status]')].filter((n) => !(n as HTMLElement).hidden).map((n) => n.textContent);
  const ticked = () => [...el.querySelectorAll('label.fd-choice')].filter((l) => (l.querySelector('input') as HTMLInputElement | null)?.checked).map((l) => l.textContent);
  return { form, el, labels, options, note, ticked };
}

describe('an option shown by a condition, in a widget', () => {
  it('appears and goes as the answer it reads changes', () => {
    const { form, labels } = mount('outside', 'radio');
    expect(labels()).toEqual(['Balcony']);
    form.setValue('kind', 'villa');
    expect(labels()).toEqual(['Garden', 'Balcony']);
    form.setValue('kind', 'flat');
    expect(labels()).toEqual(['Balcony']);
  });

  it('does the same in a dropdown', () => {
    const { form, options } = mount('outside');
    expect(options()).toEqual(['Balcony']);
    form.setValue('kind', 'villa');
    expect(options()).toEqual(['Garden', 'Balcony']);
  });

  it('keeps a value the record held as it was opened, and says it is no longer offered', () => {
    const { note } = mount('outside', 'radio', { kind: 'flat', outside: 'garden' });
    expect(note()).toEqual(['Garden: no longer offered']);
  });
});

describe('options carried from an earlier question, in a widget', () => {
  it('are those picked there, by their labels, the question’s own after them', () => {
    const { form, labels } = mount('again', 'radio');
    expect(labels()).toEqual(['None of them']);
    form.setValue('tried', ['peel', 'botox']);
    expect(labels()).toEqual(['Botox', 'Peel', 'None of them']);
  });

  it('change as the question before changes, a choice no longer picked taken out by the form', () => {
    const { form, labels, ticked } = mount('again', 'radio');
    form.setValue('tried', ['botox', 'filler']);
    form.setValue('again', 'filler');
    expect(ticked()).toEqual(['Filler']);
    form.setValue('tried', ['botox']);
    expect(labels()).toEqual(['Botox', 'None of them']);
    expect(form.getState().values['again']).toBeNull();
    expect(form.getState().takenOut['again']).toBe('Filler is no longer offered, so it was taken out');
    expect(ticked()).toEqual([]);
  });
});

describe('an option’s words that show an answer, shown by a condition or carried', () => {
  const worded = {
    ...page,
    fields: {
      ...page.fields,
      branch: { type: 'selection', label: 'Branch', options: [{ value: 'zamalek', label: 'Zamalek' }, { value: 'maadi', label: 'Maadi' }] },
      call: { type: 'selection', label: 'Call', options: [{ value: 'yes', label: 'Yes, call me at {branch}', invisible: "kind != 'villa'" }, { value: 'no', label: 'No' }] },
      tried: { type: 'selection', label: 'Treatments', multiple: true, options: [{ value: 'botox', label: 'Botox at {branch|the clinic}' }, { value: 'peel', label: 'Peel' }] },
    },
  } as unknown as Page;

  function mountWorded(name: string, values: Values) {
    const form = createForm({ page: worded, values });
    const node = { type: 'field', id: `f-${name}`, field: name, widget: 'radio' } as FieldNode;
    const shown = createWidget({ form, name, field: worded.fields[name], node, id: `fd-${name}`, document, labels: WIDGET_LABELS.en, locale: 'en' });
    document.body.replaceChildren(shown.element);
    const refresh = () => shown.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, labels: () => [...shown.element.querySelectorAll('label.fd-choice')].map((l) => l.textContent) };
  }

  it('reads them filled in, and again as that answer changes, while a condition shows it', () => {
    const { form, labels } = mountWorded('call', { kind: 'villa', branch: 'zamalek' });
    expect(labels()).toEqual(['Yes, call me at Zamalek', 'No']);
    form.setValue('branch', 'maadi');
    expect(labels()).toEqual(['Yes, call me at Maadi', 'No']);
    form.setValue('kind', 'flat');
    expect(labels()).toEqual(['No']);
  });

  it('reads them filled in where they are carried to another question', () => {
    const { form, labels } = mountWorded('again', { tried: ['botox', 'peel'] });
    expect(labels()).toEqual(['Botox at the clinic', 'Peel', 'None of them']);
    form.setValue('branch', 'zamalek');
    expect(labels()).toEqual(['Botox at Zamalek', 'Peel', 'None of them']);
  });
});
