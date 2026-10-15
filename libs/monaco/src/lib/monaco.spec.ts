import { createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import { createMonacoWidgets, monacoWidgets } from './monaco';
import type { MonacoApi, MonacoContentChange, MonacoEditor, MonacoKeybindingRule, MonacoLoader, MonacoModel, MonacoPosition, MonacoRange, MonacoSelection, MonacoThemeData } from './types';

/**
 * Monaco itself is driven in the browser gates (e2e/code-editors.spec.ts);
 * here a stand-in implements the whole of the API the widgets use, so each
 * step of theirs can be watched: what they create, set, and dispose of.
 */
class FakeModel implements MonacoModel {
  disposed = false;
  listeners: ((event: MonacoContentChange) => void)[] = [];
  constructor(public value: string, public language: string) {}
  getValue = () => this.value;
  getLanguageId = () => this.language;
  getLineCount = () => this.value.split('\n').length;
  getFullModelRange(): MonacoRange {
    const lines = this.value.split('\n');
    return { startLineNumber: 1, startColumn: 1, endLineNumber: lines.length, endColumn: lines[lines.length - 1].length + 1 };
  }
  getOffsetAt({ lineNumber, column }: MonacoPosition) {
    return this.value.split('\n').slice(0, lineNumber - 1).reduce((sum, line) => sum + line.length + 1, 0) + column - 1;
  }
  setValue(value: string) {
    this.change(value);
  }
  /** The text changed, as Monaco tells of it: what was put in, and whether by Undo or Redo. */
  change(value: string, how: Partial<MonacoContentChange> = {}) {
    this.value = value;
    for (const listener of this.listeners) listener({ changes: [{ text: value }], isUndoing: false, isRedoing: false, ...how });
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
  /** The context keys the widget made, with their values. */
  contextKeys = new Map<string, boolean>();
  /** What the widget asked the editor to do: a paste, an undo, edits of its own. */
  triggered: { source: string; handlerId: string; payload: unknown }[] = [];
  edits: { source: string; edits: { range: MonacoRange; text: string }[]; end?: MonacoSelection[] }[] = [];
  /** Where the cursor is, as an offset in the text: at its end after typing. */
  at = 0;
  constructor(public element: HTMLElement, public options: Record<string, unknown>) {
    this.input = element.ownerDocument.createElement('textarea');
    this.input.className = 'inputarea';
    this.input.setAttribute('aria-label', 'Editor content');
    // Monaco says its input takes several lines.
    this.input.setAttribute('aria-multiline', 'true');
    element.append(this.input);
    this.at = this.model.value.length;
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
  onDidChangeModelContent(listener: (event: MonacoContentChange) => void) {
    this.model.listeners.push(listener);
    return { dispose: () => (this.model.listeners = this.model.listeners.filter((l) => l !== listener)) };
  }
  getPosition(): MonacoPosition {
    const before = this.model.value.slice(0, this.at).split('\n');
    return { lineNumber: before.length, column: before[before.length - 1].length + 1 };
  }
  executeEdits(source: string, edits: { range: MonacoRange; text: string }[], end?: MonacoSelection[]) {
    this.edits.push({ source, edits, end });
    let value = this.model.value;
    for (const { range, text } of edits) {
      const from = this.model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
      const to = this.model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
      value = value.slice(0, from) + text + value.slice(to);
    }
    this.model.change(value);
    if (end?.[0]) this.at = this.model.getOffsetAt({ lineNumber: end[0].positionLineNumber, column: end[0].positionColumn });
    return true;
  }
  trigger(source: string, handlerId: string, payload: unknown) {
    this.triggered.push({ source, handlerId, payload });
    // A paste puts its text in at the cursor, as Monaco's does.
    if (handlerId === 'paste') {
      const { text } = payload as { text: string };
      const value = this.model.value.slice(0, this.at) + text + this.model.value.slice(this.at);
      this.at += text.length;
      this.model.change(value);
    }
  }
  createContextKey(key: string, value: boolean) {
    this.contextKeys.set(key, value);
    return { set: (next: boolean) => void this.contextKeys.set(key, next) };
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
    this.at = text.length;
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
    rules: [] as MonacoKeybindingRule[],
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
      addKeybindingRules(rules) {
        seen.rules.push(...rules);
        return { dispose: () => (seen.rules = seen.rules.filter((rule) => !rules.includes(rule))) };
      },
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

function pageWith(type: 'text' | 'json' | 'char', options: FieldNode['options'] = {}, node: Partial<FieldNode> = {}, field: Partial<Field> = {}): Page {
  return {
    fieldia: '0.1',
    id: 'job',
    title: 'Job',
    data: { kind: 'record', model: 'job' },
    fields: { script: { type, label: 'Cleanup script', ...field } as Field, locked: { type: 'boolean', label: 'Locked' }, owner: { type: 'char', label: 'Owner' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        {
          type: 'section',
          id: 'main',
          children: [
            { type: 'field', id: 'f-script', field: 'script', widget: 'monaco', options, ...node },
            { type: 'field', id: 'f-owner', field: 'owner' },
          ],
        },
      ],
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

async function mount(page: Page, script: unknown = 'def total():\n    return 1', options: Parameters<typeof createMonacoWidgets>[0] = {}, fake = fakeMonaco(), viewer: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { job: { 1: { script: script as never, owner: 'Ops' } } } });
  handle = mountViewer(host, { page, dataSource, recordId: 1, widgets: createMonacoWidgets({ loader: fake.loader, ...options }), ...viewer });
  await handle.form.settled();
  const box = host.querySelector('[data-node="f-script"]') as HTMLElement;
  const label = box.querySelector('label') as HTMLLabelElement;
  return { ...fake, host, box, label, dataSource, form: handle.form, editor: () => fake.seen.editors[0] };
}
/** A key pressed in an element, as the keyboard sends it: whether something took it is on the event. */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
/** Text pasted into an element, as the clipboard hands it over. */
function paste(target: Element, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? text : '') } });
  target.dispatchEvent(event);
  return event;
}

describe('text in VS Code’s editor', () => {
  it('is offered for text, char and json fields', () => {
    expect(Object.keys(monacoWidgets).sort()).toEqual(['char.monaco', 'json.monaco', 'text.monaco']);
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

describe('a one-line field in VS Code’s editor', () => {
  const condition = (options: FieldNode['options'] = { language: 'javascript' }, node: Partial<FieldNode> = {}, field: Partial<Field> = {}) => pageWith('char', options, node, field);

  it('is a plain one-line box while Monaco loads, named by the label, with the placeholder', async () => {
    const { box, label, seen, asked } = await mount(condition({ language: 'javascript' }, { placeholder: 'order.total > 100' }), 'a > 1');
    const plain = box.querySelector('input') as HTMLInputElement;
    // Monaco asked for, and not here yet.
    expect(asked.monaco).toEqual([false]);
    expect(seen.editors).toHaveLength(0);
    expect(plain.classList.contains('fd-monaco-plain')).toBe(true);
    expect(plain.type).toBe('text');
    expect(plain.id).toBe(label.htmlFor);
    expect(plain.value).toBe('a > 1');
    expect(plain.placeholder).toBe('order.total > 100');
    expect(box.querySelector('textarea')).toBeNull();
  });

  it('is then one line, as tall as a text box: no line numbers, minimap, folding or scroll bars, and it does not grow', async () => {
    const { box, label, arrive, editor } = await mount(condition({ language: 'javascript' }, { placeholder: 'order.total > 100' }), 'a > 1');
    await arrive();
    expect(box.querySelector('.fd-monaco')?.classList.contains('fd-monaco-line')).toBe(true);
    expect(editor().options).toMatchObject({ lineNumbers: 'off', glyphMargin: false, folding: false, minimap: { enabled: false }, lineDecorationsWidth: 0, renderLineHighlight: 'none', placeholder: 'order.total > 100' });
    expect(editor().options['scrollbar']).toMatchObject({ vertical: 'hidden', horizontal: 'hidden', alwaysConsumeMouseWheel: false });
    // Tab still moves on, as from any box.
    expect(editor().options).toMatchObject({ tabFocusMode: true });
    expect(editor().input.id).toBe(label.htmlFor);
    expect(editor().input.getAttribute('aria-labelledby')).toBe(label.id);
    // Said to be one line, to assistive technology and to the form.
    expect(editor().input.getAttribute('aria-multiline')).toBe('false');
    expect(box.querySelector('input')).toBeNull();
    // Its height is the text box's, kept by its frame: typing never grows it.
    const frame = box.querySelector('.fd-monaco-frame') as HTMLElement;
    expect(frame.contains(editor().element)).toBe(true);
    editor().type('a');
    expect((box.querySelector('.fd-monaco-box') as HTMLElement).style.height).toBe('');
  });

  it('writes what is typed to the form as text, and an empty editor as nothing', async () => {
    const { arrive, editor, form } = await mount(condition(), 'a > 1');
    await arrive();
    editor().type('order.paid');
    expect(form.getState().values['script']).toBe('order.paid');
    editor().type('');
    expect(form.getState().values['script']).toBeNull();
  });

  it('adds no line on Enter, and Enter does nothing else unless the page asks it to move on', async () => {
    const { arrive, editor, form, host } = await mount(condition(), 'a > 1');
    await arrive();
    editor().focus();
    for (const init of [{}, { shiftKey: true }, { altKey: true }]) {
      expect(press(editor().input, 'Enter', init).defaultPrevented).toBe(true);
    }
    expect(editor().model.getValue()).toBe('a > 1');
    expect(form.getState().values['script']).toBe('a > 1');
    expect(document.activeElement).toBe(editor().input);
    expect(host.querySelector('[data-node="f-owner"] input')).not.toBe(document.activeElement);
  });

  it('moves on to the next field on Enter when the page asks, as a text box does', async () => {
    const { arrive, editor, host } = await mount(condition(), 'a > 1', {}, fakeMonaco(), { keys: { enterMovesToNext: true } });
    await arrive();
    editor().focus();
    press(editor().input, 'Enter');
    expect(document.activeElement).toBe(host.querySelector('[data-node="f-owner"] input'));
    expect(editor().model.getValue()).toBe('a > 1');
  });

  it('leaves a key being composed to the input method, Enter too', async () => {
    const { arrive, editor } = await mount(condition(), 'a > 1');
    await arrive();
    expect(press(editor().input, 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
  });

  it('turns Monaco’s keys that add a line off in it alone: Ctrl+Enter is left to the form, which saves', async () => {
    const { arrive, editor, seen, dataSource, form } = await mount(condition(), 'a > 1');
    await arrive();
    // Ctrl+Enter and Ctrl+Shift+Enter (Cmd on a Mac), bound to nothing where the one-line key is set.
    const key = [...editor().contextKeys].find(([, on]) => on)?.[0] as string;
    expect(key).toBeTruthy();
    const ctrlCmd = 2048, shift = 1024, enter = 3;
    for (const keybinding of [ctrlCmd | enter, ctrlCmd | shift | enter]) {
      expect(seen.rules).toContainEqual(expect.objectContaining({ keybinding, command: null, when: expect.stringContaining(key) }));
    }
    // A second field adds no rules: they are Monaco's, made once.
    const rules = seen.rules.length;
    const second = createMonacoWidgets({ loader: fakeMonaco().loader });
    expect(second['char.monaco']).toBeDefined();
    expect(seen.rules).toHaveLength(rules);
    editor().type('a > 2');
    editor().focus();
    press(editor().input, 'Enter', { ctrlKey: true });
    await form.settled();
    expect(dataSource.records['job'][1]['script']).toBe('a > 2');
  });

  it('leaves the find keys to the browser, as a text box does: VS Code’s find has no room in one line', async () => {
    const { arrive, editor, seen } = await mount(condition(), 'a > 1');
    await arrive();
    const key = [...editor().contextKeys].find(([, on]) => on)?.[0] as string;
    const ctrlCmd = 2048, shift = 1024, alt = 512;
    const [e, f, g, h, f3] = [35, 36, 37, 38, 61];
    // Find, find and replace (Cmd+Alt+F on a Mac), find again and back (F3, or Cmd+G on a Mac), find the chosen text.
    for (const keybinding of [ctrlCmd | f, ctrlCmd | h, ctrlCmd | alt | f, f3, shift | f3, ctrlCmd | f3, ctrlCmd | shift | f3, ctrlCmd | g, ctrlCmd | shift | g, ctrlCmd | e]) {
      expect(seen.rules).toContainEqual(expect.objectContaining({ keybinding, command: null, when: expect.stringContaining(key) }));
    }
  });

  it('joins pasted lines into one, as a text box does, in one paste; a paste of only line breaks adds nothing', async () => {
    const { arrive, editor, form } = await mount(condition(), 'a > 1');
    await arrive();
    const joined = paste(editor().input, '\n&& b\r\n  && c\n');
    expect(joined.defaultPrevented).toBe(true);
    expect(editor().triggered).toEqual([{ source: 'keyboard', handlerId: 'paste', payload: { text: ' && b && c ' } }]);
    expect(editor().model.getValue()).toBe('a > 1 && b && c ');
    expect(form.getState().values['script']).toBe('a > 1 && b && c ');
    const blank = paste(editor().input, '\n \n');
    expect(blank.defaultPrevented).toBe(true);
    expect(editor().triggered).toHaveLength(1);
    // One line already: Monaco pastes it, as it does.
    expect(paste(editor().input, ' && d').defaultPrevented).toBe(false);
    expect(editor().triggered).toHaveLength(1);
  });

  it('joins a line break that gets in some other way at once, a line copied down, say; Undo steps back over the join with it', async () => {
    const { arrive, editor, form } = await mount(condition(), 'a > 1');
    await arrive();
    editor().type('a > 1\na > 1');
    // The form never holds the line break.
    expect(form.getState().values['script']).toBe('a > 1 a > 1');
    await Promise.resolve();
    expect(editor().model.getValue()).toBe('a > 1 a > 1');
    expect(editor().edits).toHaveLength(1);
    expect(editor().edits[0].end).toEqual([{ selectionStartLineNumber: 1, selectionStartColumn: 12, positionLineNumber: 1, positionColumn: 12 }]);
    // Undo takes the join away, and goes on to take away what brought the line break.
    editor().model.change('a > 1\na > 1', { isUndoing: true });
    await Promise.resolve();
    expect(editor().triggered.map((t) => t.handlerId)).toEqual(['undo']);
    editor().model.change('a > 1\na > 1', { isRedoing: true });
    await Promise.resolve();
    expect(editor().triggered.map((t) => t.handlerId)).toEqual(['undo', 'redo']);
    expect(editor().edits).toHaveLength(1);
  });

  it('shows a value from elsewhere whole, line breaks and all, and joins nothing of it, typed in or not', async () => {
    const { arrive, editor, form } = await mount(condition(), 'a > 1');
    await arrive();
    form.setValue('script', 'a\nb', { by: 'app' });
    await Promise.resolve();
    expect(editor().model.getValue()).toBe('a\nb');
    // A letter typed in it brings no line break: the text reaches the form as the editor shows it.
    editor().model.change('a\nbc', { changes: [{ text: 'c' }] });
    await Promise.resolve();
    expect(form.getState().values['script']).toBe('a\nbc');
    expect(editor().model.getValue()).toBe('a\nbc');
    expect(editor().edits).toHaveLength(0);
  });

  it('cannot be edited when read-only, its paste left to Monaco, which refuses it', async () => {
    const { box, arrive, editor, form } = await mount(condition({ language: 'javascript' }, { readonly: 'locked' }), 'a > 1');
    form.setValue('locked', true);
    expect((box.querySelector('input') as HTMLInputElement).readOnly).toBe(true);
    await arrive();
    expect(editor().options).toMatchObject({ readOnly: true, domReadOnly: true });
    expect(box.querySelector('.fd-monaco')?.hasAttribute('data-readonly')).toBe(true);
    expect(paste(editor().input, 'x\ny').defaultPrevented).toBe(false);
    expect(editor().triggered).toEqual([]);
  });

  it('says it is required, invalid and where the message is, on Monaco’s input', async () => {
    const { arrive, editor, form } = await mount(condition({ language: 'javascript' }, {}, { required: true }), null);
    await arrive();
    expect(editor().options['ariaRequired']).toBe(true);
    form.validate();
    await form.settled();
    expect(editor().input.getAttribute('aria-invalid')).toBe('true');
    const described = editor().input.getAttribute('aria-describedby') ?? '';
    expect(described).not.toBe('');
    for (const id of described.split(' ')) expect(document.getElementById(id)).not.toBeNull();
  });

  it('takes the focus at a press on its frame, round the code, as a text box does', async () => {
    const { box, arrive, editor } = await mount(condition(), 'a > 1');
    await arrive();
    const frame = box.querySelector('.fd-monaco-frame') as HTMLElement;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    frame.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(editor().focused).toBe(true);
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
    expect(message.textContent).toBe('Not valid JSON: line 1, column 14');
    expect(editor().input.getAttribute('aria-invalid')).toBe('true');
    editor().type('[]');
    expect(message.hidden).toBe(true);
    expect(editor().input.getAttribute('aria-invalid')).toBe('false');
    expect(form.getState().values['script']).toEqual([]);
  });

  it('keeps text that is not JSON unread, with where it breaks: a check made meanwhile refuses it', async () => {
    const { arrive, editor, form } = await mount(pageWith('json'), { readers: 4 });
    await arrive();
    editor().type('{ "readers": ');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['script']).toBe('Not valid JSON: line 1, column 14');
    editor().type('{ "readers": 6 }');
    expect(form.validate()).toBe(true);
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
