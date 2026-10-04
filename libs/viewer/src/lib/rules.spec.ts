import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * What a person sees of worked-out values and answer rules: a worked-out
 * field read-only, a warning under its field once they leave it — told
 * apart from an error, and never stopping the form — and an error as before.
 */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page: Page = {
  fieldia: '0.1',
  id: 'rules',
  data: { kind: 'responses' },
  fields: {
    qty: { type: 'integer', label: 'Quantity' },
    price: { type: 'float', label: 'Price' },
    total: { type: 'float', label: 'Total', compute: 'qty * price' },
    lines: {
      type: 'one2many',
      label: 'Lines',
      relation: 'line',
      fields: { n: { type: 'integer', label: 'N' }, double: { type: 'integer', label: 'Double', compute: 'n * 2' } },
    },
    email: { type: 'char', label: 'Email' },
    postcode: { type: 'char', label: 'Postcode' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-qty', field: 'qty' },
      { type: 'field', id: 'f-price', field: 'price' },
      { type: 'field', id: 'f-total', field: 'total' },
      { type: 'field', id: 'f-lines', field: 'lines' },
      { type: 'field', id: 'f-email', field: 'email', validate: [{ endsWith: '@acme.com', level: 'warning', message: 'Use your work address if you can' }] },
      { type: 'field', id: 'f-postcode', field: 'postcode', validate: [{ pattern: '\\d{5}', message: 'Five digits' }, { minLength: 3, level: 'warning', message: 'Short' }] },
    ],
  },
};

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource();
  handle = mountViewer(host, { page, dataSource });
  return { host, form: handle.form, dataSource };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const input = (host: Element, node: string) => at(host, node).querySelector('input') as HTMLInputElement;
const shown = (el: Element | null) => !!el && !el.closest('[hidden]');
const warningOf = (host: Element, node: string) => at(host, node).querySelector('.fd-warning') as HTMLElement;
const errorOf = (host: Element, node: string) => at(host, node).querySelector('.fd-error') as HTMLElement;
function type(el: HTMLInputElement, text: string) {
  el.focus();
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a worked-out field', () => {
  it('shows the value worked out, and cannot be typed in', () => {
    const { host } = mount();
    expect(input(host, 'f-total').readOnly).toBe(true);
    expect(input(host, 'f-qty').readOnly).toBe(false);
    type(input(host, 'f-qty'), '3');
    type(input(host, 'f-price'), '2.5');
    expect(input(host, 'f-total').value).toBe('7.50');
  });

  it('is read-only in a line too', () => {
    const { host, form } = mount();
    form.addLine('lines', { n: 4 });
    const cells = at(host, 'f-lines').querySelectorAll('tbody tr input');
    expect((cells[0] as HTMLInputElement).readOnly).toBe(false);
    expect((cells[1] as HTMLInputElement).readOnly).toBe(true);
    expect((cells[1] as HTMLInputElement).value).toBe('8');
  });
});

describe('a warning from an answer rule', () => {
  it('waits until the person leaves the field, then shows under it, politely', async () => {
    const { host } = mount();
    type(input(host, 'f-email'), 'sara@gmail.com');
    expect(shown(warningOf(host, 'f-email'))).toBe(false);
    input(host, 'f-postcode').focus();
    await flush();
    const warning = warningOf(host, 'f-email');
    expect(shown(warning)).toBe(true);
    expect(warning.textContent).toBe('Use your work address if you can');
    expect(warning.getAttribute('role')).toBe('status');
    expect(input(host, 'f-email').getAttribute('aria-describedby')).toContain(warning.id);
    expect(input(host, 'f-email').getAttribute('aria-invalid')).toBe('false');
  });

  it('goes as soon as the answer is put right, even while typing', async () => {
    const { host } = mount();
    type(input(host, 'f-email'), 'sara@gmail.com');
    input(host, 'f-postcode').focus();
    await flush();
    expect(shown(warningOf(host, 'f-email'))).toBe(true);
    type(input(host, 'f-email'), 'sara@acme.com');
    expect(shown(warningOf(host, 'f-email'))).toBe(false);
    expect(input(host, 'f-email').getAttribute('aria-describedby') ?? '').not.toContain('warning');
  });

  it('never stops the answers being sent', async () => {
    const { host, form, dataSource } = mount();
    type(input(host, 'f-email'), 'sara@gmail.com');
    input(host, 'f-qty').focus();
    expect(await form.save()).toBe(true);
    expect(dataSource.responses).toHaveLength(1);
    await flush();
  });
});

describe('an error from an answer rule', () => {
  it('stops the form, with its message under the field, and the warning gives way to it', async () => {
    const { host, form, dataSource } = mount();
    type(input(host, 'f-postcode'), '12');
    input(host, 'f-qty').focus();
    await flush();
    expect(shown(warningOf(host, 'f-postcode'))).toBe(true);
    expect(await form.save()).toBe(false);
    expect(dataSource.responses).toHaveLength(0);
    expect(shown(errorOf(host, 'f-postcode'))).toBe(true);
    expect(errorOf(host, 'f-postcode').textContent).toBe('Five digits');
    expect(shown(warningOf(host, 'f-postcode'))).toBe(false);
    expect(input(host, 'f-postcode').getAttribute('aria-invalid')).toBe('true');
  });
});
