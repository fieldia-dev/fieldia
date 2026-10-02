import { createForm, type Field, type FieldNode, type Form, type Page } from '@fieldia/core';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/** A one-field page, so each test sees one widget and its form. */
function setup(field: Record<string, unknown>, node: Partial<FieldNode> = {}, registry?: Record<string, WidgetFactory>) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'X', ...field } as Field, currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget(
    { form, name: 'x', field: page.fields['x'], node: page.layout.children[0] as FieldNode, id: 'fd-x', document },
    registry
  );
  document.body.replaceChildren(widget.element);
  const refresh = (extra: Partial<{ readonly: boolean; required: boolean; invalid: boolean }> = {}) =>
    widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false, ...extra });
  form.subscribe(() => refresh());
  refresh();
  return { form, widget, refresh, el: widget.element };
}

function type(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const valueOf = (form: Form) => form.getState().values['x'];
/** The element itself when it matches — a widget is often the input — or the first match inside it. */
const q = <T extends Element>(el: Element, selector: string) => (el.matches(selector) ? el : el.querySelector(selector)) as T;

describe('text widgets', () => {
  it('writes what is typed, and an emptied box as null', () => {
    const { form, el } = setup({ type: 'char' });
    const input = q<HTMLInputElement>(el, 'input');
    expect(input.id).toBe('fd-x');
    type(input, 'Sara');
    expect(valueOf(form)).toBe('Sara');
    type(input, '');
    expect(valueOf(form)).toBeNull();
  });

  it('keeps focus and the caret when the form updates while someone types', () => {
    const { form, el } = setup({ type: 'char' });
    const input = q<HTMLInputElement>(el, 'input');
    type(input, 'Nile');
    input.setSelectionRange(2, 2);
    form.setValue('x', 'Nile'); // a state change reaches the widget mid-edit
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
  });

  it('shows a value set from outside', () => {
    const { form, el } = setup({ type: 'char' });
    form.setValue('x', 'From the server');
    expect(q<HTMLInputElement>(el, 'input').value).toBe('From the server');
  });

  it.each([
    ['email', 'email'],
    ['phone', 'tel'],
    ['url', 'url'],
    ['password', 'password'],
  ])('uses the %s input type', (widget, inputType) => {
    const { el } = setup({ type: 'char' }, { widget });
    expect(q<HTMLInputElement>(el, 'input').type).toBe(inputType);
  });

  it('limits length to the field size, and uses a textarea for text', () => {
    expect(q<HTMLInputElement>(setup({ type: 'char', size: 12 }).el, 'input').maxLength).toBe(12);
    const { form, el } = setup({ type: 'text' });
    type(q<HTMLTextAreaElement>(el, 'textarea'), 'Line one\nLine two');
    expect(valueOf(form)).toBe('Line one\nLine two');
  });

  it('shows a placeholder from the layout', () => {
    expect(q<HTMLInputElement>(setup({ type: 'char' }, { placeholder: 'Your name' }).el, 'input').placeholder).toBe('Your name');
  });
});

describe('number widgets — typing a number is not one keystroke', () => {
  it('keeps "1." in the box while the value is already 1', () => {
    const { form, el } = setup({ type: 'float' });
    const input = q<HTMLInputElement>(el, 'input');
    type(input, '1.');
    expect(valueOf(form)).toBe(1);
    expect(input.value).toBe('1.');
    type(input, '1.5');
    expect(valueOf(form)).toBe(1.5);
  });

  it('keeps a lone minus sign without changing the value', () => {
    const { form, el } = setup({ type: 'float' });
    const input = q<HTMLInputElement>(el, 'input');
    type(input, '-');
    expect(input.value).toBe('-');
    expect(valueOf(form)).toBeNull();
    type(input, '-4');
    expect(valueOf(form)).toBe(-4);
  });

  it('tidies the box when focus leaves', () => {
    const { el } = setup({ type: 'float' });
    const input = q<HTMLInputElement>(el, 'input');
    type(input, '2.');
    input.blur();
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('2');
  });

  it('passes text that is not a number on, so validation can name it', () => {
    const { form, el } = setup({ type: 'integer' });
    type(q<HTMLInputElement>(el, 'input'), '12a');
    expect(valueOf(form)).toBe('12a');
  });

  it('asks for a decimal keypad, or a numeric one for integers', () => {
    expect(q<HTMLInputElement>(setup({ type: 'float' }).el, 'input').inputMode).toBe('decimal');
    expect(q<HTMLInputElement>(setup({ type: 'integer' }).el, 'input').inputMode).toBe('numeric');
  });

  it('shows the currency beside a monetary amount', () => {
    const { form, el } = setup({ type: 'monetary', currencyField: 'currency_id' });
    form.setValue('currency_id', { id: 1, label: 'EGP' });
    expect(q<HTMLElement>(el, '.fd-currency').textContent).toBe('EGP');
  });
});

describe('choice widgets', () => {
  const options = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];

  it('toggles a checkbox for a boolean', () => {
    const { form, el } = setup({ type: 'boolean' });
    const box = q<HTMLInputElement>(el, 'input[type=checkbox]');
    box.click();
    expect(valueOf(form)).toBe(true);
    box.click();
    expect(valueOf(form)).toBe(false);
  });

  it('offers a dropdown with a blank first choice', () => {
    const { form, el } = setup({ type: 'selection', options });
    const select = q<HTMLSelectElement>(el, 'select');
    expect([...select.options].map((o) => o.textContent)).toEqual(['', 'Yes', 'No']);
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(valueOf(form)).toBe('no');
  });

  it('keeps numeric option values numeric', () => {
    const { form, el } = setup({ type: 'selection', options: [{ value: 1, label: 'One' }, { value: 2, label: 'Two' }] });
    const select = q<HTMLSelectElement>(el, 'select');
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(valueOf(form)).toBe(2);
  });

  it('shows radio buttons when asked, and selects by click', () => {
    const { form, el } = setup({ type: 'selection', options }, { widget: 'radio' });
    const radios = el.querySelectorAll<HTMLInputElement>('input[type=radio]');
    expect(radios).toHaveLength(2);
    radios[0].click();
    expect(valueOf(form)).toBe('yes');
    expect(radios[0].checked).toBe(true);
  });

  it('collects several choices as a list, in option order', () => {
    const { form, el } = setup({ type: 'selection', options: [...options, { value: 'maybe', label: 'Maybe' }], multiple: true });
    const boxes = el.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
    boxes[2].click();
    boxes[0].click();
    expect(valueOf(form)).toEqual(['yes', 'maybe']);
    boxes[2].click();
    expect(valueOf(form)).toEqual(['yes']);
  });

  it('rates with stars, as a radio group a keyboard can use', () => {
    const { form, el } = setup({ type: 'integer', min: 1, max: 5 }, { widget: 'rating' });
    const group = q<HTMLElement>(el, '[role=radiogroup]');
    const stars = group.querySelectorAll<HTMLButtonElement>('[role=radio]');
    expect(stars).toHaveLength(5);
    stars[3].click();
    expect(valueOf(form)).toBe(4);
    expect(stars[3].getAttribute('aria-checked')).toBe('true');
    stars[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(valueOf(form)).toBe(5);
  });

  it('offers a numbered scale', () => {
    const { form, el } = setup({ type: 'integer', min: 0, max: 10 }, { widget: 'scale' });
    const points = el.querySelectorAll<HTMLButtonElement>('[role=radio]');
    expect([...points].map((p) => p.textContent)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    points[7].click();
    expect(valueOf(form)).toBe(7);
  });
});

describe('dates', () => {
  it('reads and writes YYYY-MM-DD', () => {
    const { form, el } = setup({ type: 'date' });
    const input = q<HTMLInputElement>(el, 'input');
    expect(input.type).toBe('date');
    type(input, '2026-10-02');
    expect(valueOf(form)).toBe('2026-10-02');
  });

  it('stores a date and time as ISO in UTC, shown in local time', () => {
    const { form, el } = setup({ type: 'datetime' });
    const input = q<HTMLInputElement>(el, 'input');
    expect(input.type).toBe('datetime-local');
    type(input, '2026-10-02T10:30');
    const stored = valueOf(form) as string;
    expect(new Date(stored).getTime()).toBe(new Date(2026, 9, 2, 10, 30).getTime());
    expect(stored).toMatch(/Z$/);
  });
});

describe('every widget', () => {
  it('respects readonly', () => {
    const text = setup({ type: 'char' });
    text.refresh({ readonly: true });
    expect(q<HTMLInputElement>(text.el, 'input').readOnly).toBe(true);
    const choice = setup({ type: 'selection', options: [{ value: 'a', label: 'A' }] }, { widget: 'radio' });
    choice.refresh({ readonly: true });
    expect(q<HTMLInputElement>(choice.el, 'input').disabled).toBe(true);
  });

  it('marks itself invalid and required for assistive technology', () => {
    const { el, refresh } = setup({ type: 'char' });
    refresh({ invalid: true, required: true });
    const input = q<HTMLInputElement>(el, 'input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('can be replaced by the app, per type or per type and widget', () => {
    const custom: WidgetFactory = ({ form, name }) => {
      const element = document.createElement('button');
      element.textContent = 'Sign';
      element.onclick = () => form.setValue(name, 'signed');
      return { element, update: () => undefined, focus: () => element.focus() } satisfies Widget;
    };
    const { form, el } = setup({ type: 'char' }, { widget: 'signature' }, { 'char.signature': custom });
    (el as HTMLButtonElement).click();
    expect(valueOf(form)).toBe('signed');
  });

  it('shows what it holds for a type that has no editor yet', () => {
    const { form, el } = setup({ type: 'many2one', relation: 'country' });
    form.setValue('x', { id: 1, label: 'Egypt' });
    expect(el.textContent).toBe('Egypt');
    expect(el.getAttribute('data-fd-pending')).toBe('many2one');
  });
});

describe('installStyles', () => {
  it('adds the stylesheet once, scoped to Fieldia forms', async () => {
    const { installStyles, FIELDIA_CSS } = await import('./styles');
    installStyles(document);
    installStyles(document);
    expect(document.querySelectorAll('style#fieldia-styles')).toHaveLength(1);
    const unscoped = FIELDIA_CSS.split('}')
      .map((rule) => rule.split('{')[0].trim())
      .filter((selector) => selector && !selector.startsWith('@') && !selector.includes('.fd-') && !selector.includes('[dir'));
    expect(unscoped).toEqual([]);
  });
});
