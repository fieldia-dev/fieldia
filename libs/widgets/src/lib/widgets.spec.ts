import { createForm, type Field, type FieldNode, type Form, type Locale, type Page } from '@fieldia/core';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/** A one-field page, so each test sees one widget and its form. */
function setup(field: Record<string, unknown>, node: Partial<FieldNode> = {}, registry?: Record<string, WidgetFactory>, locale?: Locale) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'X', ...field } as Field, currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget(
    { form, name: 'x', field: page.fields['x'], node: page.layout.children[0] as FieldNode, id: 'fd-x', document, locale },
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

describe('number widgets — in the reader’s language', () => {
  const focusIn = (input: HTMLInputElement) => {
    input.focus();
    input.dispatchEvent(new Event('focus'));
  };
  const focusOut = (input: HTMLInputElement) => {
    input.blur();
    input.dispatchEvent(new Event('blur'));
  };

  it.each([
    ['en', '1,850,000.50', '1850000.5'],
    ['de', '1.850.000,50', '1850000,5'],
    ['fr', '1\u202f850\u202f000,50', '1850000,5'],
    ['ar', '1,850,000.50', '1850000.5'],
  ] as const)('%s: grouped, with its decimals; entering the box changes nothing, and typing is read back', (locale, shown, typing) => {
    const { form, el } = setup({ type: 'float', digits: [12, 2] }, {}, undefined, locale);
    form.setValue('x', 1850000.5);
    const input = q<HTMLInputElement>(el, 'input');
    expect(input.value).toBe(shown);
    focusIn(input);
    expect(input.value).toBe(shown);
    type(input, typing);
    expect(valueOf(form)).toBe(1850000.5);
    focusOut(input);
    expect(input.value).toBe(shown);
  });

  it.each([
    ['en', '1,234.5', 1234.5],
    ['de', '1.234,5', 1234.5],
    ['de', '12,5', 12.5],
    ['fr', '1 234,5', 1234.5],
    ['ar', '١٢٣٤٫٥', 1234.5],
  ] as const)('%s: reads "%s" as %s', (locale, typed, value) => {
    const { form, el } = setup({ type: 'float' }, {}, undefined, locale);
    type(q<HTMLInputElement>(el, 'input'), typed);
    expect(valueOf(form)).toBe(value);
  });

  it('keeps a whole-text selection as the box is entered, so typing replaces it', () => {
    const { form, el } = setup({ type: 'monetary', currency: 'EGP' });
    form.setValue('x', 250000);
    const input = q<HTMLInputElement>(el, 'input');
    input.select(); // as a browser does on Tab, and a test tool before it types
    focusIn(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
    type(input, '5000');
    expect(valueOf(form)).toBe(5000);
  });

  it('reads a grouped number typed into a box', () => {
    const { form, el } = setup({ type: 'monetary', currency: 'EGP' });
    type(q<HTMLInputElement>(el, 'input'), '250,000.5');
    expect(valueOf(form)).toBe(250000.5);
  });

  it('keeps "1," in the box while a German number is still being typed', () => {
    const { form, el } = setup({ type: 'float' }, {}, undefined, 'de');
    const input = q<HTMLInputElement>(el, 'input');
    type(input, '1,');
    expect(valueOf(form)).toBe(1);
    expect(input.value).toBe('1,');
  });

  it('shows whole numbers grouped, and money with its currency’s two decimals', () => {
    const whole = setup({ type: 'integer' });
    whole.form.setValue('x', 12000);
    expect(q<HTMLInputElement>(whole.el, 'input').value).toBe('12,000');
    const money = setup({ type: 'monetary', currency: 'EGP' });
    money.form.setValue('x', 64656);
    expect(q<HTMLInputElement>(money.el, 'input').value).toBe('64,656.00');
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
    expect(input.value).toBe('2.00');
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

  it('every field type has an editor', async () => {
    const { FIELD_TYPES } = await import('@fieldia/core');
    const { builtInWidgets } = await import('./widgets');
    expect(FIELD_TYPES.filter((type) => !builtInWidgets[type])).toEqual([]);
  });
});

describe('installStyles', () => {
  it('adds the stylesheet once, scoped to Fieldia forms', async () => {
    const { installStyles, FIELDIA_CSS } = await import('./styles');
    installStyles(document);
    installStyles(document);
    expect(document.querySelectorAll('style#fieldia-styles')).toHaveLength(1);
    const unscoped = FIELDIA_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.split('{')[0].trim())
      .filter((selector) => selector && !selector.startsWith('@') && !selector.includes('.fd-') && !selector.includes('[dir'));
    expect(unscoped).toEqual([]);
  });
});

describe('the example pages', () => {
  it('show every built-in widget at least once, so every one can be seen and tested in the demos', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { builtInWidgets } = await import('./widgets');
    const dir = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
    const used = new Set<string>();
    // The same order createWidget picks a widget in.
    const keyOf = (field: any, node: any) =>
      [node.widget ? `${field.type}.${node.widget}` : null, field.type === 'selection' && field.multiple ? 'selection.checkboxes' : null, field.type].find(
        (key): key is string => !!key && key in builtInWidgets
      );
    const walk = (node: any, fields: Record<string, any>) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach((child) => walk(child, fields));
      if (node.type === 'field' && fields[node.field]) {
        const key = keyOf(fields[node.field], node);
        if (key) used.add(key);
        const def = fields[node.field];
        // A table of lines shows each of its columns with the plain widget for its type.
        if (def.type === 'one2many') for (const column of node.columns ?? Object.keys(def.fields)) used.add(keyOf(def.fields[column], {}) ?? '');
      }
      for (const value of Object.values(node)) walk(value, fields);
    };
    for (const file of readdirSync(dir).filter((f: string) => f.endsWith('.page.json'))) {
      const page = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      walk(page.layout, page.fields);
    }
    expect(Object.keys(builtInWidgets).filter((key) => !used.has(key))).toEqual([]);
  });
});
