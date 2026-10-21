import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';
import { decodePart, scanPart } from './widget-parts';

/**
 * Before the scan part comes — an app drawing a field without waiting for its page's parts, as the viewer waits — a
 * field scanned into is its box alone, typed in as ever (a scanner gun types into it); as the part comes, the Scan
 * button stands beside the box, what was typed kept. The decode part is never asked for by drawing.
 */
it('is its box alone until the scan part comes, then has the Scan button beside it, what was typed kept', async () => {
  expect(scanPart.loaded).toBeUndefined();
  const fields: Record<string, Field> = { lot: { type: 'char', label: 'Lot' } };
  const page = { fieldia: '0.8', id: 'p', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lot', field: 'lot', options: { scan: true } }] } } as unknown as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'lot', field: fields['lot'], node: (page.layout as unknown as { children: FieldNode[] }).children[0], id: 'fd-lot', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['lot'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  expect(document.querySelector('.fd-scan-button')).toBeNull();
  const box = document.querySelector<HTMLInputElement>('input.fd-input');
  if (!box) throw new Error('no box');
  // A scanner gun's keys, and its Enter's change.
  box.value = '25A1234';
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
  expect(form.getState().values['lot']).toBe('25A1234');
  await scanPart.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector('.fd-scan > .fd-scan-button')?.textContent).toBe('Scan');
  expect(document.querySelector<HTMLInputElement>('.fd-scan input.fd-input')?.value).toBe('25A1234');
  expect(decodePart.loaded).toBeUndefined();
  widget.destroy?.();
});
