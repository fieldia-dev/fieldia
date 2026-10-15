import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Leaving a box: the field's own problem — min, max, a whole number, decimals,
 * a format, text that does not read — is said at once under it, politely and
 * once, in the page's language; that it is required waits for Save.
 */

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page: Page = {
  fieldia: '0.1',
  id: 'leave',
  data: { kind: 'responses' },
  fields: {
    seats: { type: 'integer', label: 'Workstations', min: 1, required: true },
    team: { type: 'integer', label: 'People in your team', max: 500 },
    area: { type: 'float', label: 'Floor area', digits: [10, 1] },
    note: { type: 'char', label: 'Note' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-seats', field: 'seats' },
      { type: 'field', id: 'f-team', field: 'team' },
      { type: 'field', id: 'f-area', field: 'area' },
      { type: 'field', id: 'f-note', field: 'note' },
    ],
  },
};

function mount(locale: 'en' | 'ar' = 'en') {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, locale });
  return { host, form: handle.form };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const input = (host: Element, node: string) => at(host, node).querySelector('input') as HTMLInputElement;
const errorOf = (host: Element, node: string) => at(host, node).querySelector('.fd-error') as HTMLElement;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function type(box: HTMLInputElement, text: string) {
  box.focus();
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
}
function moveTo(host: Element, node: string) {
  input(host, node).focus();
}

describe('leaving a field', () => {
  it('says a value outside its limits at once, politely, and the box is marked', async () => {
    const { host } = mount();
    type(input(host, 'f-seats'), '0');
    moveTo(host, 'f-team');
    await flush();
    const error = errorOf(host, 'f-seats');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Workstations must be at least 1');
    expect(error.getAttribute('aria-live')).toBe('polite');
    expect(input(host, 'f-seats').getAttribute('aria-invalid')).toBe('true');
    type(input(host, 'f-team'), '700');
    moveTo(host, 'f-area');
    await flush();
    expect(errorOf(host, 'f-team').textContent).toBe('People in your team must be at most 500');
  });

  it('never says a field is required as it is left: that waits for Save', async () => {
    const { host } = mount();
    input(host, 'f-seats').focus();
    moveTo(host, 'f-team');
    await flush();
    expect(errorOf(host, 'f-seats').hidden).toBe(true);
    expect(errorOf(host, 'f-seats').hasAttribute('aria-live')).toBe(false);
  });

  it('says text left that does not read, keeping it in the box, in the page’s language', async () => {
    const { host, form } = mount('ar');
    type(input(host, 'f-area'), '12 34');
    moveTo(host, 'f-note');
    await flush();
    expect(input(host, 'f-area').value).toBe('12 34');
    expect(errorOf(host, 'f-area').textContent).toBe('تُجمع الأرقام في مجموعات من ثلاثة، مثل 1,234,567');
    expect(form.getState().values['area']).toBeNull();
    expect(await form.save()).toBe(false);
  });

  it('is said by the error once: entered again, it is quiet until it is left again', async () => {
    const { host } = mount();
    type(input(host, 'f-seats'), '0');
    moveTo(host, 'f-team');
    await flush();
    expect(errorOf(host, 'f-seats').getAttribute('aria-live')).toBe('polite');
    input(host, 'f-seats').focus();
    expect(errorOf(host, 'f-seats').hasAttribute('aria-live')).toBe(false);
    expect(errorOf(host, 'f-seats').textContent).toBe('Workstations must be at least 1');
  });
});
