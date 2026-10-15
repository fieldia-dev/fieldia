import { createForm, type Field, type Page } from '@fieldia/core';
import { plainDateWidget } from './date-text';
import { WIDGET_LABELS } from './labels';

/**
 * The plain date box, drawn while the date part has not come: what it reads is
 * what the date box reads, and what it changes it says — a day and time typed
 * where a day goes keeps the day, and the time it leaves out is said under the
 * box, never dropped in silence.
 */

const page = {
  fieldia: '0.1',
  id: 'visit',
  data: { kind: 'responses' },
  fields: { day: { type: 'date', label: 'Visit day' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-day', field: 'day' }] },
} as unknown as Page;

it('says the time a day and time leaves out where a day goes', () => {
  const form = createForm({ page });
  const widget = plainDateWidget('date')({ form, name: 'day', field: page.fields['day'] as Field, node: { type: 'field', id: 'f-day', field: 'day' }, id: 'fd-day', document, labels: WIDGET_LABELS.en, locale: 'en' });
  const holder = document.createElement('div');
  holder.append(widget.element);
  document.body.replaceChildren(holder);
  const input = widget.element as HTMLInputElement;
  input.focus();
  const instant = '2026-10-13T12:30:00Z';
  const at = new Date(instant);
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  input.value = instant;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(form.getState().values['day']).toBe(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`);
  const hint = holder.querySelector('.fd-refusal-hint') as HTMLElement;
  expect(hint.hidden).toBe(false);
  expect(hint.textContent).toBe(`Visit day takes a day only: the time ${time} was left out`);
  // A day alone, typed next: nothing is left out, and nothing is said.
  input.value = '14/10/2026';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(hint.hidden).toBe(true);
});
