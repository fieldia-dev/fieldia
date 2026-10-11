import { indentUnit, language } from '@codemirror/language';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { codeWidgets, textCodeWidget } from './code';
import { loadCodeLanguage } from './languages';

/** A page with one field written in code: `script`, of the type and in the language given. */
function pageWith(field: Partial<Field> & { type: 'text' | 'char' }, options: FieldNode['options'] = {}, node: Partial<FieldNode> = {}): Page {
  return {
    fieldia: '0.1',
    id: 'job',
    title: 'Job',
    data: { kind: 'record', model: 'job' },
    fields: { script: { label: 'Cleanup script', ...field } as Field, locked: { type: 'boolean', label: 'Locked' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-script', field: 'script', widget: 'code', options, ...node }] }],
    },
  };
}

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.restoreAllMocks();
});

async function mount(page: Page, script: string | null = 'def total():\n    return 1') {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { job: { 1: { script } } } });
  handle = mountViewer(host, { page, dataSource, recordId: 1, widgets: codeWidgets });
  await handle.form.settled();
  const box = host.querySelector('[data-node="f-script"]') as HTMLElement;
  const view = EditorView.findFromDOM(box.querySelector('.cm-editor') as HTMLElement) as EditorView;
  const content = box.querySelector('.cm-content') as HTMLElement;
  return { host, box, view, content, form: handle.form };
}
/** Replace the whole text, as typing over a selection would. */
const replaceAll = (view: EditorView, text: string) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
/** Until the editor has a grammar: its language is loaded on its own time. */
async function grammarOf(view: EditorView) {
  for (let i = 0; i < 100 && !view.state.facet(language); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  return view.state.facet(language);
}

describe('text in a code editor', () => {
  it('shows the text in an editor named by the field’s label, the box its label points at, left to right', async () => {
    const { box, view, content } = await mount(pageWith({ type: 'text' }, { language: 'python' }));
    expect(view.state.doc.toString()).toBe('def total():\n    return 1');
    const label = box.querySelector('label') as HTMLLabelElement;
    expect(content.id).toBe(label.htmlFor);
    expect(content.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.textContent).toBe('Cleanup script');
    // Code reads left to right, on an Arabic page too.
    expect(box.querySelector('.fd-code')?.getAttribute('dir')).toBe('ltr');
  });

  it('writes what is typed to the form as text, and an empty editor as nothing', async () => {
    const { view, form } = await mount(pageWith({ type: 'text' }, { language: 'python' }));
    replaceAll(view, 'print("hi")');
    expect(form.getState().values['script']).toBe('print("hi")');
    replaceAll(view, '');
    expect(form.getState().values['script']).toBeNull();
  });

  it('colours the language the page names: its grammar loads, and a keyword is marked as one', async () => {
    const { view, content } = await mount(pageWith({ type: 'text' }, { language: 'python' }));
    expect((await grammarOf(view))?.name).toBe('python');
    // `def` is drawn as a keyword: a span of its own, with a class the editor's colours give a keyword.
    const def = [...content.querySelectorAll('span')].find((span) => span.textContent === 'def');
    expect(def).toBeDefined();
    expect(def?.className).not.toBe('');
  });

  it('takes the language by another of its names, in any case', async () => {
    const { view } = await mount(pageWith({ type: 'text' }, { language: 'PY' }));
    expect((await grammarOf(view))?.name).toBe('python');
  });

  it('shows a language it does not know as plain text, says nothing of it, and still writes', async () => {
    const errors = jest.spyOn(console, 'error');
    const warnings = jest.spyOn(console, 'warn');
    const { view, form } = await mount(pageWith({ type: 'text' }, { language: 'klingon' }));
    await loadCodeLanguage('klingon');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.state.facet(language)).toBeNull();
    replaceAll(view, 'Qapla’');
    expect(form.getState().values['script']).toBe('Qapla’');
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });

  it('with no language, is plain text', async () => {
    const { view } = await mount(pageWith({ type: 'text' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.state.facet(language)).toBeNull();
  });

  it('replaces its text with a value from elsewhere, and keeps what is typed when the form only echoes it', async () => {
    const { view, form } = await mount(pageWith({ type: 'text' }, { language: 'python' }));
    form.setValue('script', 'x = 2', { by: 'app' });
    expect(view.state.doc.toString()).toBe('x = 2');
    // Typing mid-text: the form's echo leaves the caret where it was.
    view.dispatch({ changes: { from: 1, insert: 'y' }, selection: { anchor: 2 } });
    expect(form.getState().values['script']).toBe('xy = 2');
    expect(view.state.selection.main.head).toBe(2);
  });

  it('cannot be edited when read-only, and can again when it is not', async () => {
    const { content, form } = await mount(pageWith({ type: 'text' }, { language: 'python' }, { readonly: 'locked' }));
    expect(content.getAttribute('contenteditable')).toBe('true');
    form.setValue('locked', true);
    expect(content.getAttribute('contenteditable')).toBe('false');
    form.setValue('locked', false);
    expect(content.getAttribute('contenteditable')).toBe('true');
  });

  it('cannot be edited when the field is read-only, and is still reached by Tab, to read and copy from', async () => {
    const { content } = await mount(pageWith({ type: 'text', readonly: true }, { language: 'python' }));
    expect(content.getAttribute('contenteditable')).toBe('false');
    expect(content.getAttribute('tabindex')).toBe('0');
  });

  it('indents as its language does: Python by four spaces, SQL by two', async () => {
    const python = await mount(pageWith({ type: 'text' }, { language: 'python' }));
    await grammarOf(python.view);
    expect(python.view.state.facet(indentUnit)).toBe('    ');
    handle?.destroy();
    const sql = await mount(pageWith({ type: 'text' }, { language: 'sql' }));
    await grammarOf(sql.view);
    expect(sql.view.state.facet(indentUnit)).toBe('  ');
  });

  it('says it is required, invalid and where the message is, as the form does', async () => {
    const { content, form } = await mount(pageWith({ type: 'text', required: true }, { language: 'sql' }), null);
    expect(content.getAttribute('aria-required')).toBe('true');
    expect(content.getAttribute('aria-invalid')).toBe('false');
    form.validate();
    await form.settled();
    expect(content.getAttribute('aria-invalid')).toBe('true');
    const described = content.getAttribute('aria-describedby') ?? '';
    expect(described).not.toBe('');
    for (const id of described.split(' ')) expect(document.getElementById(id)).not.toBeNull();
  });

  it('leaves Tab to the page, so a keyboard moves on to the next field', async () => {
    const { view } = await mount(pageWith({ type: 'text' }, { language: 'python' }));
    for (const shiftKey of [false, true]) {
      const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      expect(runScopeHandlers(view, tab, 'editor')).toBe(false);
    }
  });

  it('shows the node’s placeholder while it is empty', async () => {
    const { box } = await mount(pageWith({ type: 'text' }, { language: 'sql' }, { placeholder: 'SELECT …' }), null);
    expect(box.querySelector('.cm-placeholder')?.textContent).toBe('SELECT …');
  });

  it('draws a char field too, and keeps it to its size', async () => {
    const { view, form } = await mount(pageWith({ type: 'char', size: 12 }, { language: 'javascript' }), 'a + b');
    expect((await grammarOf(view))?.name).toBe('javascript');
    replaceAll(view, 'Math.max(a, b)');
    expect(view.state.doc.toString()).toBe('a + b');
    replaceAll(view, 'a * b');
    expect(form.getState().values['script']).toBe('a * b');
  });

  it('is offered for text and char fields, beside JSON’s', () => {
    expect(Object.keys(codeWidgets).sort()).toEqual(['char.code', 'json.code', 'text.code']);
    expect(codeWidgets['text.code']).toBe(textCodeWidget);
    expect(codeWidgets['char.code']).toBe(textCodeWidget);
  });

  it('takes its editor down when destroyed, the grammar still loading or not', async () => {
    const form = { getState: () => ({ values: { script: 'x' } }), setValue: jest.fn() };
    const context = { form, name: 'script', field: { type: 'text', label: 'Script' }, node: { type: 'field', id: 'n', field: 'script', widget: 'code', options: { language: 'rust' } }, id: 'x', document } as never;
    const widget = textCodeWidget(context);
    document.body.append(widget.element);
    const view = EditorView.findFromDOM(widget.element.querySelector('.cm-editor') as HTMLElement) as EditorView;
    const destroy = jest.spyOn(view, 'destroy');
    widget.destroy?.();
    expect(destroy).toHaveBeenCalled();
    expect(widget.element.querySelector('.cm-editor')).toBeNull();
    // The grammar arriving afterwards finds nothing to colour, and says nothing.
    const errors = jest.spyOn(console, 'error');
    await loadCodeLanguage('rust');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(errors).not.toHaveBeenCalled();
  });
});
