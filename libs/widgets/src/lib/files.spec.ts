import { createForm, type Field, type FieldNode, type FileValue, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { sanitizeHtml } from './extras';

function setup(field: Record<string, unknown>, readonly = false, options?: Record<string, unknown>) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Contract', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...(options ? { options } : {}) }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
/** The element itself when it matches — a widget is often the editable element — or the first match inside it. */
const q = <T extends Element>(el: Element, selector: string) => (el.matches(selector) ? el : el.querySelector(selector)) as T;
function choose(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('file upload', () => {
  it('reads a chosen file into the value, as base64', async () => {
    const { form, el } = setup({ type: 'binary', accept: ['application/pdf'] });
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.accept).toBe('application/pdf');
    choose(input, new File(['hello'], 'contract.pdf', { type: 'application/pdf' }));
    await settle();
    expect(form.getState().values['x']).toEqual({ name: 'contract.pdf', type: 'application/pdf', size: 5, data: 'aGVsbG8=' });
    expect(el.querySelector('.fd-file-name')?.textContent).toBe('contract.pdf · 5 bytes');
  });

  it('can be replaced and removed, unless readonly', async () => {
    const { form, el } = setup({ type: 'binary' });
    form.setValue('x', { name: 'a.txt', type: 'text/plain', size: 3, data: 'YWJj' });
    const remove = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Remove') as HTMLButtonElement;
    remove.click();
    expect(form.getState().values['x']).toBeNull();
    expect(el.querySelector('.fd-file-pick')?.textContent).toContain('Upload a file');
    const readonly = setup({ type: 'binary' }, true);
    readonly.form.setValue('x', { name: 'a.txt', type: 'text/plain', size: 3 });
    expect([...readonly.el.querySelectorAll('button')].filter((b) => !b.hidden)).toEqual([]);
  });

  it('takes a file dropped on it', async () => {
    const { form, el } = setup({ type: 'binary' });
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    drop.dataTransfer = { files: [new File(['x'], 'drop.txt', { type: 'text/plain' })] };
    el.dispatchEvent(drop);
    await settle();
    expect((form.getState().values['x'] as FileValue).name).toBe('drop.txt');
  });
});

describe('image', () => {
  it('shows a preview of what was chosen', async () => {
    const { el } = setup({ type: 'image' });
    choose(el.querySelector('input[type=file]') as HTMLInputElement, new File(['png'], 'logo.png', { type: 'image/png' }));
    await settle();
    expect((el.querySelector('img') as HTMLImageElement).src).toBe('data:image/png;base64,cG5n');
  });

  it('shows a stored image by its address', () => {
    const { form, el } = setup({ type: 'image' });
    form.setValue('x', { name: 'logo.png', type: 'image/png', size: 10, url: 'https://cdn.example/logo.png' });
    expect((el.querySelector('img') as HTMLImageElement).src).toBe('https://cdn.example/logo.png');
  });
});

describe('json', () => {
  it('writes valid JSON and says so when it is not', () => {
    const { form, el } = setup({ type: 'json' });
    const area = el.querySelector('textarea') as HTMLTextAreaElement;
    area.value = '{"a": 1}';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['x']).toEqual({ a: 1 });
    area.value = '{"a": ';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['x']).toEqual({ a: 1 });
    expect(el.querySelector('.fd-cell-error')?.textContent).toBe('Not valid JSON');
  });
});

describe('formatted text', () => {
  it('edits in place and keeps only safe markup', () => {
    const { form, el } = setup({ type: 'html' });
    const area = q<HTMLElement>(el, '[contenteditable]');
    area.innerHTML = '<p>Pays <b>on time</b><img src=x onerror="alert(1)"></p><script>alert(2)</script>';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['x']).toBe('<p>Pays <b>on time</b></p>');
  });

  it('shows a value from outside, made safe', () => {
    const { form, el } = setup({ type: 'html' });
    form.setValue('x', '<p onclick="steal()">Hello <a href="javascript:alert(1)">there</a></p>');
    expect((q<HTMLElement>(el, '[contenteditable]')).innerHTML).toBe('<p>Hello <a>there</a></p>');
  });

  it('is not editable when readonly', () => {
    const { el } = setup({ type: 'html' }, true);
    expect((q<HTMLElement>(el, '[contenteditable]')).getAttribute('contenteditable')).toBe('false');
  });
});

describe('formatted text toolbar', () => {
  let commands: [string, string | undefined][] = [];
  beforeEach(() => {
    commands = [];
    (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, value?: string) => {
      commands.push([command, value]);
      return true;
    };
  });

  it('offers the formatting a business text needs, as a toolbar', () => {
    const { el } = setup({ type: 'html' });
    const bar = el.querySelector('[role="toolbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-label')).toBe('Formatting');
    expect([...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Align left', 'Align centre', 'Align right', 'Link',
    ]);
    expect((bar.querySelector('select') as HTMLSelectElement).getAttribute('aria-label')).toBe('Text style');
    const area = q<HTMLElement>(el, '[contenteditable]');
    expect(area.id).toBe('fd-x');
    expect(area.getAttribute('aria-labelledby')).toBe('fd-x-label');
  });

  it('applies each format to what is selected', () => {
    const { el } = setup({ type: 'html' });
    const press = (name: string) => (el.querySelector(`[role="toolbar"] button[aria-label="${name}"]`) as HTMLButtonElement).click();
    press('Bold');
    press('Bulleted list');
    press('Align centre');
    const style = el.querySelector('[role="toolbar"] select') as HTMLSelectElement;
    style.value = 'h2';
    style.dispatchEvent(new Event('change', { bubbles: true }));
    expect(commands).toEqual([
      ['bold', undefined],
      ['insertUnorderedList', undefined],
      ['justifyCenter', undefined],
      ['formatBlock', '<h2>'],
    ]);
  });

  it('asks for a link’s address in place, and only takes a web or mail address', () => {
    const { el } = setup({ type: 'html' });
    (el.querySelector('[role="toolbar"] button[aria-label="Link"]') as HTMLButtonElement).click();
    const address = el.querySelector('input[aria-label="Link address"]') as HTMLInputElement;
    expect(address).not.toBeNull();
    address.value = 'javascript:alert(1)';
    (el.querySelector('button.fd-link-apply') as HTMLButtonElement).click();
    expect(commands).toEqual([]);
    address.value = 'niletraders.example/terms';
    (el.querySelector('button.fd-link-apply') as HTMLButtonElement).click();
    expect(commands).toEqual([['createLink', 'https://niletraders.example/terms']]);
  });

  it('has no toolbar when read-only, or when the page turns it off', () => {
    expect(setup({ type: 'html' }, true).el.querySelector('[role="toolbar"]')?.closest('[hidden]')).not.toBeFalsy();
    expect(setup({ type: 'html' }, false, { toolbar: false }).el.querySelector('[role="toolbar"]')).toBeNull();
  });
});

describe('sanitizeHtml', () => {
  it('keeps a block’s alignment, and no other style', () => {
    expect(sanitizeHtml('<p style="text-align: center; color: red">x</p><h2 style="text-align:right">t</h2>')).toBe(
      '<p style="text-align: center;">x</p><h2 style="text-align: right;">t</h2>'
    );
    expect(sanitizeHtml('<span style="text-align: center">x</span><p style="text-align: url(evil)">y</p>')).toBe('<span>x</span><p>y</p>');
  });


  it('keeps text structure and safe links, and drops everything else', () => {
    expect(sanitizeHtml('<h2>Terms</h2><ul><li>One</li></ul><a href="https://x.example" target="_blank">x</a><iframe src="//e"></iframe>')).toBe(
      '<h2>Terms</h2><ul><li>One</li></ul><a href="https://x.example">x</a>'
    );
    expect(sanitizeHtml('<div style="color:red">plain <span class="x">text</span></div>')).toBe('<div>plain <span>text</span></div>');
  });
});
