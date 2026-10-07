import { createForm, type Field, type FieldNode, type Locale, type Page, type Value } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget, type WidgetDialogs, type WidgetState } from './widgets';

type Shown = Partial<Pick<WidgetState, 'readonly' | 'required' | 'invalid' | 'describedBy'>>;

/**
 * One question on a page of its own, its widget mounted in the document and
 * kept up to date with its form, as the viewer keeps it: for the specs of the
 * question kinds.
 */
export function mountKind(field: Record<string, unknown>, node: Partial<FieldNode> = {}, options: { locale?: Locale; dir?: 'rtl'; dialogs?: WidgetDialogs } = {}) {
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
    ...(options.dialogs ? { dialogs: options.dialogs } : {}),
  });
  const host = document.createElement('div');
  if (options.dir) host.setAttribute('dir', options.dir);
  host.append(widget.element);
  document.body.replaceChildren(host);
  let shown: Shown = {};
  const refresh = (extra: Shown = shown) => {
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

/** The rules of `css` that name no class of its own: none that `base` does not use already. */
export function foreignRules(css: string, base: string): string[] {
  const taken = new Set(base.match(/\.fd-[\w-]+/g) ?? []);
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((rule) => rule.split('{').slice(-2)[0]?.trim() ?? '')
    .filter((selector) => selector && !selector.startsWith('@'))
    .flatMap((selector) => selector.split(',').map((one) => one.trim()))
    .filter((one) => !(one.match(/\.fd-[\w-]+/g) ?? []).some((name) => !taken.has(name)));
}
