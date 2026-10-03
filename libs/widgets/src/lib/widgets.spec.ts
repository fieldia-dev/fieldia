import { createForm, type Field, type FieldNode, type Form, type Locale, type Page } from '@fieldia/core';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/** A one-field page, so each test sees one widget and its form. */
function setup(
  field: Record<string, unknown>,
  node: Partial<FieldNode> = {},
  registry?: Record<string, WidgetFactory>,
  locale?: Locale,
  extra: Record<string, Field> = {}
) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'X', ...field } as Field, currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' } as Field, ...extra },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget(
    { form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, locale },
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

describe('money', () => {
  const cur = { cur: { type: 'selection', label: 'Currency', options: [{ value: 'EGP', label: 'EGP' }, { value: 'USD', label: 'USD' }] } as Field };

  it('puts the currency before the amount, or after it when asked', () => {
    const before = setup({ type: 'monetary', currency: 'EGP' });
    expect([...before.el.children].map((c) => c.tagName)).toEqual(['SPAN', 'INPUT']);
    const after = setup({ type: 'monetary', currency: 'EGP' }, { options: { symbol: 'after' } });
    expect([...after.el.children].map((c) => c.tagName)).toEqual(['INPUT', 'SPAN']);
    expect(after.el.classList.contains('fd-currency-after')).toBe(true);
  });

  it('lets the currency be changed beside the amount', () => {
    const { form, el, refresh } = setup({ type: 'monetary', currencyField: 'cur' }, { options: { pickCurrency: true } }, undefined, 'en', cur);
    form.setValue('cur', 'EGP');
    refresh();
    const picker = el.querySelector('select') as HTMLSelectElement;
    expect(picker.getAttribute('aria-label')).toBe('Currency');
    expect(picker.selectedOptions[0]?.textContent).toBe('EGP');
    expect(el.querySelector('.fd-currency')).toBeNull();
    picker.selectedIndex = [...picker.options].findIndex((o) => o.textContent === 'USD');
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    expect(form.getState().values['cur']).toBe('USD');
    expect(q<HTMLInputElement>(el, 'input').id).toBe('fd-x');
  });
});

describe('label', () => {
  const out = (el: Element) => q<HTMLOutputElement>(el, 'output');

  it('shows the value between a prefix and a suffix, as text, in the page’s language', () => {
    const { form, el } = setup({ type: 'integer' }, { widget: 'label', options: { prefix: 'About', suffix: 'months' } }, undefined, 'de');
    form.setValue('x', 2400);
    expect(out(el).id).toBe('fd-x');
    expect(out(el).textContent).toBe('About 2.400 months');
  });

  it('takes its prefix or suffix from another field, and follows it', () => {
    const extra = { unit: { type: 'char', label: 'Unit' } as Field };
    const { form, el, refresh } = setup({ type: 'float', digits: [8, 1] }, { widget: 'label', options: { suffixField: 'unit' } }, undefined, 'en', extra);
    form.setValue('x', 240);
    form.setValue('unit', 'm');
    refresh();
    expect(out(el).textContent).toBe('240.0 m');
    form.setValue('unit', 'ft');
    refresh();
    expect(out(el).textContent).toBe('240.0 ft');
  });

  it('shows nothing, not a lone prefix, when there is no value', () => {
    const { el } = setup({ type: 'integer' }, { widget: 'label', options: { prefix: 'About', suffix: 'months' } });
    expect(out(el).textContent).toBe('');
  });
});

describe('progress bar', () => {
  const bar = (el: Element) => q<HTMLElement>(el, '[role="progressbar"]');
  const fill = (el: Element) => (bar(el).querySelector('.fd-progressbar-fill') as HTMLElement).style.width;

  it('fills to the value against a hundred, coloured by how far it has come', () => {
    const { form, el } = setup({ type: 'integer' }, { widget: 'progressbar' });
    form.setValue('x', 64);
    expect([bar(el).getAttribute('aria-valuenow'), bar(el).getAttribute('aria-valuemax'), bar(el).getAttribute('aria-valuetext')]).toEqual(['64', '100', '64%']);
    expect(fill(el)).toBe('64%');
    expect(bar(el).dataset['tone']).toBe('warning');
    expect(bar(el).textContent).toBe('64%');
    form.setValue('x', 20);
    expect(bar(el).dataset['tone']).toBe('danger');
    form.setValue('x', 85);
    expect(bar(el).dataset['tone']).toBe('success');
    form.setValue('x', 150);
    expect(fill(el)).toBe('100%');
  });

  it('takes its maximum from the options, or from another field', () => {
    const fixed = setup({ type: 'float' }, { widget: 'progressbar', options: { max: 200 } });
    fixed.form.setValue('x', 50);
    expect(fill(fixed.el)).toBe('25%');
    const linked = setup({ type: 'float' }, { widget: 'progressbar', options: { maxField: 'cap' } }, undefined, undefined, { cap: { type: 'float', label: 'Cap' } as Field });
    linked.form.setValue('cap', 40);
    linked.form.setValue('x', 30);
    linked.refresh();
    expect(fill(linked.el)).toBe('75%');
    expect(bar(linked.el).getAttribute('aria-valuemax')).toBe('40');
  });

  it('keeps one colour when the options name it, and can leave the percentage out', () => {
    const { form, el } = setup({ type: 'integer' }, { widget: 'progressbar', options: { color: 'info', showPercent: false } });
    form.setValue('x', 10);
    expect(bar(el).dataset['tone']).toBe('info');
    expect(bar(el).textContent).toBe('');
  });

  it('when editable, a box beside the bar takes the value, and goes read-only with the field', () => {
    const { form, el, refresh } = setup({ type: 'integer' }, { widget: 'progressbar', options: { editable: true } });
    const input = el.querySelector('input') as HTMLInputElement;
    expect(input.id).toBe('fd-x');
    expect(bar(el).getAttribute('aria-hidden')).toBe('true');
    type(input, '80');
    expect(valueOf(form)).toBe(80);
    expect(fill(el)).toBe('80%');
    refresh({ readonly: true });
    expect(input.readOnly).toBe(true);
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

  it('offers “Other:” after the options, with a box for an answer of one’s own', () => {
    const { form, el, widget } = setup({ type: 'selection', options, other: true }, { widget: 'radio' });
    const radios = [...el.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(radios).toHaveLength(3);
    expect(el.querySelector('.fd-choice-other')?.textContent).toContain('Other:');
    const own = q<HTMLInputElement>(el, '.fd-other-input');
    expect(own.getAttribute('aria-label')).toBe('Your own answer');
    // Typing picks “Other”, and the answer is what is typed.
    own.value = 'Maybe later';
    own.dispatchEvent(new Event('input', { bubbles: true }));
    expect(radios[2].checked).toBe(true);
    expect(valueOf(form)).toBe('Maybe later');
    // Another choice: that is the answer; the words wait in their box.
    radios[0].click();
    expect(valueOf(form)).toBe('yes');
    expect(own.value).toBe('Maybe later');
    // “Other” again: the words are the answer again, and the cursor goes to them.
    radios[2].click();
    expect(valueOf(form)).toBe('Maybe later');
    expect(document.activeElement).toBe(own);
    // Rubbed out: nothing answered.
    own.value = '  ';
    own.dispatchEvent(new Event('input', { bubbles: true }));
    expect(valueOf(form)).toBeNull();
    // An answer of its own from the record: “Other”, with its words.
    own.blur();
    form.setValue('x', 'Next year');
    expect(radios[2].checked).toBe(true);
    expect(own.value).toBe('Next year');
    widget.update({ ...form.getState(), value: 'Next year', values: form.getState().values, readonly: true, required: false, invalid: false } as never);
    expect(own.disabled).toBe(true);
  });

  it('adds an answer of one’s own to the boxes ticked', () => {
    const { form, el } = setup({ type: 'selection', options, multiple: true, other: true });
    const boxes = [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const own = q<HTMLInputElement>(el, '.fd-other-input');
    boxes[1].click();
    own.value = 'Sometimes';
    own.dispatchEvent(new Event('input', { bubbles: true }));
    expect(boxes[2].checked).toBe(true);
    expect(valueOf(form)).toEqual(['no', 'Sometimes']);
    // Untick “Other”: its words leave the answer.
    boxes[2].click();
    expect(valueOf(form)).toEqual(['no']);
  });

  it('says “Other” in the page’s language', () => {
    const { el } = setup({ type: 'selection', options, other: true }, { widget: 'radio' }, undefined, 'ar');
    expect(el.querySelector('.fd-choice-other')?.textContent).toContain('أخرى:');
  });

  it('puts words at the ends of a scale, when it has them', () => {
    const { el } = setup({ type: 'integer', min: 1, max: 5 }, { widget: 'scale', options: { startLabel: 'Not likely', endLabel: 'Very likely' } });
    expect([...el.querySelectorAll('.fd-scale-ends > span')].map((s) => s.textContent)).toEqual(['Not likely', 'Very likely']);
    expect(el.querySelectorAll('[role=radiogroup] button')).toHaveLength(5);
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
