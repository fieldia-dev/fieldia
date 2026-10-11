import { createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { createMonacoWidgets, monacoWidgets } from './monaco';
import type { MonacoApi, MonacoEditor, MonacoLoader, MonacoModel, MonacoThemeData } from './types';

/**
 * Monaco itself is driven in the browser gates (e2e/code-editors.spec.ts);
 * here a stand-in implements the whole of the API the widgets use, so each
 * step of theirs can be watched: what they create, set, and dispose of.
 */
class FakeModel implements MonacoModel {
  disposed = false;
  listeners: (() => void)[] = [];
  constructor(public value: string, public language: string) {}
  getValue = () => this.value;
  getLanguageId = () => this.language;
  setValue(value: string) {
    this.value = value;
    for (const listener of this.listeners) listener();
  }
  dispose() {
    this.disposed = true;
  }
}

class FakeEditor implements MonacoEditor {
  disposed = false;
  focused = false;
  layouts = 0;
  sizeListeners: ((event: { contentHeight: number }) => void)[] = [];
  /** Monaco's own input, where the keyboard's typing lands. */
  input: HTMLTextAreaElement;
  constructor(public element: HTMLElement, public options: Record<string, unknown>) {
    this.input = element.ownerDocument.createElement('textarea');
    this.input.className = 'inputarea';
    this.input.setAttribute('aria-label', 'Editor content');
    element.append(this.input);
  }
  get model() {
    return this.options['model'] as FakeModel;
  }
  getModel = () => this.model;
  updateOptions(options: Record<string, unknown>) {
    Object.assign(this.options, options);
  }
  focus() {
    this.focused = true;
    this.input.focus();
  }
  hasTextFocus = () => this.element.ownerDocument.activeElement === this.input;
  layout() {
    this.layouts++;
  }
  getContentHeight = () => 19 * this.model.value.split('\n').length;
  onDidChangeModelContent(listener: () => void) {
    this.model.listeners.push(listener);
    return { dispose: () => (this.model.listeners = this.model.listeners.filter((l) => l !== listener)) };
  }
  onDidContentSizeChange(listener: (event: { contentHeight: number }) => void) {
    this.sizeListeners.push(listener);
    return { dispose: () => (this.sizeListeners = this.sizeListeners.filter((l) => l !== listener)) };
  }
  dispose() {
    this.disposed = true;
    this.input.remove();
  }
  /** A person typing over the whole text. */
  type(text: string) {
    this.model.setValue(text);
    for (const listener of this.sizeListeners) listener({ contentHeight: this.getContentHeight() });
  }
}

function fakeMonaco() {
  const seen = {
    editors: [] as FakeEditor[],
    models: [] as FakeModel[],
    themes: new Map<string, MonacoThemeData>(),
    theme: null as string | null,
    languages: new Set<string>(),
    tokenizers: new Map<string, unknown>(),
  };
  const api: MonacoApi = {
    editor: {
      create(element, options) {
        const editor = new FakeEditor(element, options);
        seen.editors.push(editor);
        return editor;
      },
      createModel(value, language = 'plaintext') {
        const model = new FakeModel(value, language);
        seen.models.push(model);
        return model;
      },
      defineTheme: (name, theme) => void seen.themes.set(name, theme),
      setTheme: (name) => void (seen.theme = name),
    },
    languages: {
      register: ({ id }) => void seen.languages.add(id),
      getLanguages: () => [...seen.languages].map((id) => ({ id })),
      setMonarchTokensProvider: (id, language) => {
        seen.tokenizers.set(id, language);
        return { dispose: () => seen.tokenizers.delete(id) };
      },
      setLanguageConfiguration: () => ({ dispose: () => undefined }),
    },
  };
  /** Monaco and each language arrive when the test says, as a slow network would bring them. */
  let release: () => void = () => undefined;
  let arrived = new Promise<void>((resolve) => (release = resolve));
  const asked = { monaco: [] as boolean[], languages: [] as string[] };
  const loader: MonacoLoader = {
    async monaco(services) {
      asked.monaco.push(services);
      await arrived;
      return api;
    },
    async language(_monaco, name, services) {
      asked.languages.push(`${String(name)}${services ? '+services' : ''}`);
      return name === 'python' ? 'python' : name === 'json' ? 'json' : 'plaintext';
    },
  };
  return {
    api,
    seen,
    asked,
    loader,
    arrive: async () => {
      release();
      // Every promise waiting on Monaco settles.
      for (let i = 0; i < 10; i++) await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    /** A load that fails, as a bundler with no rule for Monaco's CSS would make it. */
    failing: () => {
      arrived = Promise.reject(new Error('monaco could not be loaded'));
      arrived.catch(() => undefined);
    },
  };
}

function pageWith(type: 'text' | 'json', options: FieldNode['options'] = {}, node: Partial<FieldNode> = {}, field: Partial<Field> = {}): Page {
  return {
    fieldia: '0.1',
    id: 'job',
    title: 'Job',
    data: { kind: 'record', model: 'job' },
    fields: { script: { type, label: 'Cleanup script', ...field } as Field, locked: { type: 'boolean', label: 'Locked' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-script', field: 'script', widget: 'monaco', options, ...node }] }],
    },
  };
}

let handle: ViewerHandle | null = null;
/** The form taken down, as a page leaving it does. */
function drop() {
  handle?.destroy();
  handle = null;
}
afterEach(() => {
  drop();
  document.body.replaceChildren();
  delete (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment;
  jest.restoreAllMocks();
});

async function mount(page: Page, script: unknown = 'def total():\n    return 1', options: Parameters<typeof createMonacoWidgets>[0] = {}, fake = fakeMonaco()) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { job: { 1: { script: script as never } } } });
  handle = mountViewer(host, { page, dataSource, recordId: 1, widgets: createMonacoWidgets({ loader: fake.loader, ...options }) });
  await handle.form.settled();
  const box = host.querySelector('[data-node="f-script"]') as HTMLElement;
  const label = box.querySelector('label') as HTMLLabelElement;
  return { ...fake, host, box, label, form: handle.form, editor: () => fake.seen.editors[0] };
}

describe('text in VS Code’s editor', () => {
  it('is offered for text and json fields', () => {
    expect(Object.keys(monacoWidgets).sort()).toEqual(['json.monaco', 'text.monaco']);
  });

  it('shows a plain box at once, named by the label, while Monaco loads; then Monaco, which the label points at', async () => {
    const { box, label, arrive, editor, seen } = await mount(pageWith('text', { language: 'python' }));
    const plain = box.querySelector('textarea') as HTMLTextAreaElement;
    expect(plain.id).toBe(label.htmlFor);
    expect(plain.value).toBe('def total():\n    return 1');
    expect(seen.editors).toHaveLength(0);
    await arrive();
    expect(editor()).toBeDefined();
    expect(box.querySelector('textarea:not(.inputarea)')).toBeNull();
    expect(editor().input.id).toBe(label.htmlFor);
    expect(editor().input.getAttribute('aria-labelledby')).toBe(label.id);
    expect(editor().model.getValue()).toBe('def total():\n    return 1');
    // Code reads left to right, on an Arabic page too.
    expect(box.querySelector('.fd-monaco')?.getAttribute('dir')).toBe('ltr');
  });

  it('writes what is typed to the form as text, and an empty editor as nothing', async () => {
    const { arrive, editor, form } = await mount(pageWith('text', { language: 'python' }));
    await arrive();
    editor().type('print("hi")');
    expect(form.getState().values['script']).toBe('print("hi")');
    editor().type('');
    expect(form.getState().values['script']).toBeNull();
  });

  it('writes what is typed in the plain box too, before Monaco arrives', async () => {
    const { box, form } = await mount(pageWith('text', { language: 'python' }));
    const plain = box.querySelector('textarea') as HTMLTextAreaElement;
    plain.value = 'x = 1';
    plain.dispatchEvent(new Event('input'));
    expect(form.getState().values['script']).toBe('x = 1');
  });

  it('asks for the language the page names, and draws its text in it; a language Monaco lacks is plain text', async () => {
    const python = await mount(pageWith('text', { language: 'python' }));
    await python.arrive();
    expect(python.asked.languages).toEqual(['python']);
    expect(python.editor().model.getLanguageId()).toBe('python');
    drop();
    const other = await mount(pageWith('text', { language: 'klingon' }));
    await other.arrive();
    expect(other.editor().model.getLanguageId()).toBe('plaintext');
  });

  it('leaves Tab to the page, reads its input from a text area, and keeps the page scrolling past it', async () => {
    const { arrive, editor } = await mount(pageWith('text', { language: 'python' }));
    await arrive();
    expect(editor().options).toMatchObject({ tabFocusMode: true, editContext: false, automaticLayout: true });
    // Several on a form: only the one being typed in marks its line.
    expect(editor().options).toMatchObject({ renderLineHighlightOnlyWhenFocus: true });
    expect(editor().options['scrollbar']).toMatchObject({ alwaysConsumeMouseWheel: false });
  });

  it('replaces its text with a value from elsewhere, and keeps what is typed when the form only echoes it', async () => {
    const { arrive, editor, form } = await mount(pageWith('text', { language: 'python' }));
    await arrive();
    const setValue = jest.spyOn(editor().model, 'setValue');
    editor().type('x = 1');
    setValue.mockClear();
    form.setValue('script', 'x = 2', { by: 'app' });
    expect(editor().model.getValue()).toBe('x = 2');
    expect(setValue).toHaveBeenCalledTimes(1);
    // Its own echo sets nothing.
    editor().type('x = 3');
    expect(setValue).toHaveBeenCalledTimes(2);
  });

  it('cannot be edited when read-only, in the plain box or in Monaco, and can again when it is not', async () => {
    const { box, arrive, editor, form } = await mount(pageWith('text', { language: 'python' }, { readonly: 'locked' }));
    const plain = box.querySelector('textarea') as HTMLTextAreaElement;
    form.setValue('locked', true);
    expect(plain.readOnly).toBe(true);
    await arrive();
    expect(editor().options).toMatchObject({ readOnly: true, domReadOnly: true });
    // Shaded as a box only to be read is.
    expect(box.querySelector('.fd-monaco')?.hasAttribute('data-readonly')).toBe(true);
    form.setValue('locked', false);
    expect(editor().options).toMatchObject({ readOnly: false, domReadOnly: false });
    expect(box.querySelector('.fd-monaco')?.hasAttribute('data-readonly')).toBe(false);
  });

  it('says it is required, invalid and where the message is, on Monaco’s input', async () => {
    const { arrive, editor, form } = await mount(pageWith('text', { language: 'python' }, {}, { required: true }), null);
    await arrive();
    expect(editor().options['ariaRequired']).toBe(true);
    expect(editor().input.getAttribute('aria-invalid')).toBe('false');
    form.validate();
    await form.settled();
    expect(editor().input.getAttribute('aria-invalid')).toBe('true');
    const described = editor().input.getAttribute('aria-describedby') ?? '';
    expect(described).not.toBe('');
    for (const id of described.split(' ')) expect(document.getElementById(id)).not.toBeNull();
  });

  it('gives the focus to the plain box, or to Monaco once it is there; a focus asked for while it loads moves into Monaco', async () => {
    const { box, label, arrive, editor } = await mount(pageWith('text', { language: 'python' }));
    label.click();
    expect(document.activeElement).toBe(box.querySelector('textarea'));
    await arrive();
    expect(editor().focused).toBe(true);
    expect(document.activeElement).toBe(editor().input);
  });

  it('grows with its text, between a few lines and a screenful, laid out again each time', async () => {
    const { box, arrive, editor } = await mount(pageWith('text', { language: 'python' }));
    await arrive();
    const frame = box.querySelector('.fd-monaco-box') as HTMLElement;
    editor().type('a\n'.repeat(10));
    expect(frame.style.height).toBe(`${19 * 11 + 2}px`);
    editor().type('a');
    expect(frame.style.height).toBe('96px');
    editor().type('a\n'.repeat(100));
    expect(frame.style.height).toBe('360px');
    expect(editor().layouts).toBeGreaterThan(0);
  });

  it('wears a theme made from Fieldia’s tokens', async () => {
    const { arrive, seen } = await mount(pageWith('text', { language: 'python' }));
    await arrive();
    expect(seen.theme).not.toBeNull();
    const theme = seen.themes.get(seen.theme as string) as MonacoThemeData;
    expect(theme.rules.some((rule) => rule.token === 'keyword')).toBe(true);
    expect(theme.colors['editor.background']).toMatch(/^#[0-9a-f]{6,8}$/);
  });

  it('disposes of its editor and its text when destroyed, and makes none when destroyed before Monaco arrives', async () => {
    const first = await mount(pageWith('text', { language: 'python' }));
    await first.arrive();
    drop();
    expect(first.editor().disposed).toBe(true);
    expect(first.seen.models.every((model) => model.disposed)).toBe(true);
    const second = await mount(pageWith('text', { language: 'python' }));
    drop();
    await second.arrive();
    expect(second.seen.editors).toHaveLength(0);
    expect(second.seen.models).toHaveLength(0);
  });

  it('keeps the plain box, working, when Monaco cannot be loaded, and says nothing of it', async () => {
    const errors = jest.spyOn(console, 'error');
    const fake = fakeMonaco();
    fake.failing();
    const { box, form, seen } = await mount(pageWith('text', { language: 'python' }), undefined, {}, fake);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen.editors).toHaveLength(0);
    const plain = box.querySelector('textarea') as HTMLTextAreaElement;
    expect(plain).not.toBeNull();
    plain.value = 'y = 1';
    plain.dispatchEvent(new Event('input'));
    expect(form.getState().values['script']).toBe('y = 1');
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('JSON in VS Code’s editor', () => {
  it('shows the value as indented JSON, and writes valid JSON to the form as it is typed', async () => {
    const { arrive, editor, form } = await mount(pageWith('json'), { readers: 4 });
    await arrive();
    expect(editor().model.getValue()).toBe('{\n  "readers": 4\n}');
    expect(editor().model.getLanguageId()).toBe('json');
    editor().type('{ "readers": 6 }');
    expect(form.getState().values['script']).toEqual({ readers: 6 });
  });

  it('says when the text is not valid JSON, and keeps the last good value', async () => {
    const { box, arrive, editor, form } = await mount(pageWith('json'), { readers: 4 });
    await arrive();
    editor().type('{ "readers": ');
    expect(form.getState().values['script']).toEqual({ readers: 4 });
    const message = box.querySelector('.fd-monaco-error') as HTMLElement;
    expect(message.hidden).toBe(false);
    expect(message.textContent).toBe('Not valid JSON');
    expect(editor().input.getAttribute('aria-invalid')).toBe('true');
    editor().type('[]');
    expect(message.hidden).toBe(true);
    expect(editor().input.getAttribute('aria-invalid')).toBe('false');
    expect(form.getState().values['script']).toEqual([]);
  });
});

describe('language services, when the app gives workers', () => {
  it('are left out unless the app gives a way to make workers', async () => {
    const { arrive, asked } = await mount(pageWith('json'), {});
    await arrive();
    expect(asked.monaco).toEqual([false]);
    expect(asked.languages).toEqual(['json']);
    expect((globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment).toBeUndefined();
  });

  it('are loaded with the app’s workers, which Monaco is told of', async () => {
    const getWorker = jest.fn();
    const { arrive, asked } = await mount(pageWith('json'), {}, { getWorker });
    await arrive();
    expect(asked.monaco).toEqual([true]);
    expect(asked.languages).toEqual(['json+services']);
    const environment = (globalThis as { MonacoEnvironment?: { getWorker?: unknown } }).MonacoEnvironment;
    expect(environment?.getWorker).toBe(getWorker);
  });

  it('are only those the app names workers for: a TypeScript field asks for none when the app has JSON’s alone', async () => {
    const getWorker = jest.fn();
    const typescript = await mount(pageWith('text', { language: 'typescript' }), 'let total = 1', { getWorker, services: ['json'] });
    await typescript.arrive();
    expect(typescript.asked.languages).toEqual(['typescript']);
    expect(typescript.asked.monaco).toEqual([false]);
    drop();
    const json = await mount(pageWith('json'), {}, { getWorker, services: ['json'] });
    await json.arrive();
    expect(json.asked.languages).toEqual(['json+services']);
  });

  it('are every one Monaco has — JSON, TypeScript and JavaScript, CSS, HTML — when the app names none', async () => {
    const typescript = await mount(pageWith('text', { language: 'js' }), 'let total = 1', { getWorker: jest.fn() });
    await typescript.arrive();
    expect(typescript.asked.languages).toEqual(['js+services']);
  });

  it('leave an environment the app set itself as it is', async () => {
    const own = { getWorker: jest.fn() };
    (globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = own;
    const { arrive } = await mount(pageWith('json'), {}, { getWorker: jest.fn() });
    await arrive();
    expect((globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment).toBe(own);
  });
});
