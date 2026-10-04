import { createForm, type Field, type FieldNode, type Locale, type Page, type Value } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * One question on a page of its own, its widget mounted in the document and
 * kept up to date with its form, as the viewer keeps it: for the specs of the
 * question kinds.
 */
export function mountKind(field: Record<string, unknown>, node: Partial<FieldNode> = {}, options: { locale?: Locale; dir?: 'rtl' } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'X', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page });
  const locale = options.locale ?? 'en';
  const widget = createWidget({
    form,
    name: 'x',
    field: page.fields['x'],
    node: (page.layout as { children: FieldNode[] }).children[0],
    id: 'fd-x',
    document,
    labels: WIDGET_LABELS[locale],
    locale,
  });
  const host = document.createElement('div');
  if (options.dir) host.setAttribute('dir', options.dir);
  host.append(widget.element);
  document.body.replaceChildren(host);
  let shown: Partial<{ readonly: boolean; required: boolean; invalid: boolean }> = {};
  const refresh = (extra: Partial<{ readonly: boolean; required: boolean; invalid: boolean }> = shown) => {
    shown = extra;
    widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false, ...extra });
  };
  form.subscribe(() => refresh());
  refresh();
  return { form, widget, el: widget.element, refresh, value: (): Value | undefined => form.getState().values['x'] };
}

/** A key pressed where the focus is, as a person presses it. */
export function press(target: Element, key: string, extra: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
}

/** Text typed into a box. */
export function typeInto(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
