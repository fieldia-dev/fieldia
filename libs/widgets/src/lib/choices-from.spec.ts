import { createForm, type DataSource, type Field, type FieldNode, type Option, type Page, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * Choices from the app's lists, in every widget that shows choices: loaded
 * when the widget is drawn, drawn again when they come, loaded again when a
 * field they change with changes, with a way to try again when they fail.
 */

const CITIES: Record<string, Option[]> = {
  eg: [
    { value: 'cai', label: 'Cairo' },
    { value: 'alx', label: 'Alexandria' },
  ],
  jo: [{ value: 'amm', label: 'Amman' }],
};

function mount(widget?: string, extra: Record<string, unknown> = {}, values: Values = {}) {
  const asked: { values: Values; answer(options: Option[]): void; fail(message: string): void }[] = [];
  const dataSource: DataSource = {
    options: (request) => new Promise<Option[]>((resolve, reject) => asked.push({ values: request.values, answer: resolve, fail: (m) => reject(new Error(m)) })),
  };
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: {
      country: { type: 'char', label: 'Country' },
      city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['country'] }, ...extra } as Field,
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'city', ...(widget ? { widget } : {}) }] },
  } as Page;
  const form = createForm({ page, dataSource, values });
  const shown = createWidget({ form, name: 'city', field: page.fields['city'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(shown.element);
  const refresh = () => shown.update({ value: form.getState().values['city'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const el = shown.element;
  const note = () => [...el.querySelectorAll('[role=status], button.fd-button-link')].filter((n) => !(n as HTMLElement).hidden).map((n) => n.textContent);
  return { form, widget: shown, el, asked, note, settle: () => form.settled() };
}

describe('choices from the app’s list', () => {
  it('load when the widget is drawn, saying so, then show as the field’s own widget would', async () => {
    const { el, asked, note, settle } = mount('radio', {}, { country: 'eg' });
    expect(asked.map((a) => a.values['country'])).toEqual(['eg']);
    expect(note()).toEqual(['Loading choices…']);
    expect(el.querySelectorAll('input[type=radio]')).toHaveLength(0);
    asked[0].answer(CITIES['eg']);
    await settle();
    expect([...el.querySelectorAll('label.fd-choice')].map((l) => l.textContent)).toEqual(['Cairo', 'Alexandria']);
    expect(note()).toEqual([]);
  });

  it('name a widget with a role of its own by the field’s label, as the viewer does', async () => {
    const { el, asked, settle } = mount('checkboxes', { multiple: true });
    asked[0].answer(CITIES['eg']);
    await settle();
    expect(el.querySelector('[role=group]')?.getAttribute('aria-labelledby')).toBe('fd-x-label');
  });

  it('take a choice into the form, and the form accepts it', async () => {
    const { form, el, asked, settle } = mount(undefined, {}, { country: 'eg' });
    asked[0].answer(CITIES['eg']);
    await settle();
    const select = el.querySelector('select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['', 'Cairo', 'Alexandria']);
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    expect(form.getState().values['city']).toBe('alx');
    expect(form.problem('city')).toBeNull();
  });

  it('load again when the field they change with changes, keeping a value no longer offered and saying so', async () => {
    const { form, el, asked, note, settle } = mount('radio', {}, { country: 'eg', city: 'cai' });
    asked[0].answer(CITIES['eg']);
    await settle();
    expect((el.querySelector('input:checked') as HTMLInputElement | null)?.closest('label')?.textContent).toBe('Cairo');
    form.setValue('country', 'jo');
    expect(note()).toEqual(['Loading choices…']);
    asked[1].answer(CITIES['jo']);
    await settle();
    expect([...el.querySelectorAll('label.fd-choice')].map((l) => l.textContent)).toEqual(['Amman']);
    expect(form.getState().values['city']).toBe('cai');
    expect(note()).toEqual(['Cairo: no longer offered']);
    (el.querySelector('input[type=radio]') as HTMLInputElement).click();
    expect(note()).toEqual([]);
  });

  it('offer to try again when they did not load', async () => {
    const { el, asked, note, settle } = mount('radio');
    asked[0].fail('away');
    await settle();
    expect(note()).toEqual(['Load the choices again']);
    (el.querySelector('button.fd-button-link') as HTMLButtonElement).click();
    expect(asked).toHaveLength(2);
    expect(note()).toEqual(['Loading choices…']);
    asked[1].answer(CITIES['jo']);
    await settle();
    expect(note()).toEqual([]);
    expect(el.textContent).toContain('Amman');
  });

  it('draw the widget again only when new choices come', async () => {
    const { form, el, asked, settle } = mount(undefined, {}, { country: 'eg' });
    asked[0].answer(CITIES['eg']);
    await settle();
    const select = el.querySelector('select');
    form.setValue('city', 'cai');
    expect(el.querySelector('select')).toBe(select);
    form.setValue('country', 'jo');
    expect(el.querySelector('select')).toBe(select);
    asked[1].answer(CITIES['jo']);
    await settle();
    expect(el.querySelector('select')).not.toBe(select);
    expect(el.querySelectorAll('select')).toHaveLength(1);
  });

  it.each([
    ['dropdown', undefined, {}],
    ['checkboxes', undefined, { multiple: true }],
    ['tags', 'tags', { multiple: true }],
    ['pictures', 'image-choice', {}],
    ['ranking', 'ranking', { multiple: true }],
  ])('come to the %s widget too', async (_, widget, extra) => {
    const { el, asked, settle } = mount(widget, extra, { country: 'eg' });
    asked[0].answer(CITIES['eg']);
    await settle();
    (el.querySelector('input:not([type=checkbox]):not([type=radio])') as HTMLInputElement | null)?.focus();
    expect(el.textContent).toContain('Alexandria');
  });
});
