import type { JsonValue, Value } from '@fieldia/core';
import { jsonProblem, readJson as readJsonText, WIDGET_LABELS, type WidgetContext, type WidgetFactory, type WidgetState } from '@fieldia/widgets';
import { MONACO_SERVICES, serviceOf, type MonacoService } from './languages';
import { defaultLoader } from './loader';
import { installMonacoStyles } from './styles';
import { monacoTheme, readColours } from './theme';
import type { MonacoApi, MonacoContentChange, MonacoEditor, MonacoLoader, MonacoModel } from './types';

/**
 * Text, char and JSON fields in VS Code's editor, Monaco: `"widget": "monaco"`,
 * with `"options": { "language": "python" }` on a text or char field. Until
 * Monaco has loaded — it is large, and loads only when a page has such a
 * field — the field is a plain text box that works as one; if Monaco cannot
 * be loaded, it stays one. Tab moves on to the next field, as in every field
 * (Ctrl+] and Ctrl+[ indent). A char field is one line, as tall as a text
 * box. The editor wears a theme made from the page's tokens, and reads left to
 * right on an Arabic page too.
 */

export interface MonacoWidgetsOptions {
  /**
   * Workers for Monaco's language services — JSON checked as it is typed,
   * suggestions and checks for TypeScript, JavaScript, CSS and HTML — as
   * Monaco asks for them (`MonacoEnvironment.getWorker`): by the label of
   * the service (`json`, `typescript`, `javascript`, `css`, `html`, or
   * `editorWorkerService` for the editor's own). Left out, there are none:
   * the code is coloured, and no worker is started.
   */
  getWorker?: (workerId: string, label: string) => Worker | Promise<Worker>;
  /**
   * The language services `getWorker` has workers for — `json`, `typescript`
   * (for JavaScript too), `css` (SCSS and Less too), `html` — each turned on
   * for the fields in its languages. Every one, when left out.
   */
  services?: readonly MonacoService[];
  /** How Monaco and each language are loaded: monaco-editor's own modules unless an app, or a test, hands its own. */
  loader?: MonacoLoader;
}

/** The editor's settings: VS Code's look, kept to a field's size; Tab left to the page; the page scrolling past it. */
const EDITOR_OPTIONS = {
  automaticLayout: true,
  tabFocusMode: true,
  // A text area takes the keyboard: labelled by the field's label, and read-only when the field is.
  editContext: false,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  scrollbar: { alwaysConsumeMouseWheel: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  fixedOverflowWidgets: true,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 13,
  lineHeight: 20,
  lineNumbersMinChars: 3,
  glyphMargin: false,
  padding: { top: 6, bottom: 6 },
  links: false,
  // Several on a form: only the one being typed in marks its line.
  renderLineHighlightOnlyWhenFocus: true,
};

/**
 * A char field's editor: one line, as tall as a text box (its frame drawn as
 * one), nothing beside the code, scrolled sideways by the caret as a text box is.
 */
const LINE_OPTIONS = {
  lineNumbers: 'off',
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  scrollBeyondLastColumn: 0,
  padding: { top: 0, bottom: 0 },
  scrollbar: { vertical: 'hidden', horizontal: 'hidden', alwaysConsumeMouseWheel: false, useShadows: false },
};

/** Between a few lines and a screenful, as the field's text grows. */
const LEAST = 96;
const MOST = 360;

/** The context key a one-line editor sets, for the keys turned off in it alone. */
const ONE_LINE = 'fieldiaOneLine';
/** Each Monaco whose keys that add a line are turned off in one-line editors: once each. */
const LINE_KEYS = new WeakSet<MonacoApi>();

/**
 * Keys a one-line editor leaves to the page, as a text box leaves them, bound
 * to nothing in it: Ctrl+Enter and Ctrl+Shift+Enter (Cmd on a Mac), which add
 * a line in Monaco — Ctrl+Enter saves the form; and find's keys, for VS Code's
 * find has no room in one line — the browser's find opens.
 */
function lineKeys(monaco: MonacoApi) {
  if (LINE_KEYS.has(monaco)) return;
  LINE_KEYS.add(monaco);
  // Monaco's numbers for the keys: Ctrl (Cmd on a Mac), Shift, Alt; Enter, E, F, G, H, F3.
  const [ctrlCmd, shift, alt] = [2048, 1024, 512];
  const [enter, e, f, g, h, f3] = [3, 35, 36, 37, 38, 61];
  const lines = [ctrlCmd | enter, ctrlCmd | shift | enter];
  // Find, find and replace (Cmd+Alt+F on a Mac), find again and back (F3, or Cmd+G on a Mac), find the chosen text.
  const find = [ctrlCmd | f, ctrlCmd | h, ctrlCmd | alt | f, f3, shift | f3, ctrlCmd | f3, ctrlCmd | shift | f3, ctrlCmd | g, ctrlCmd | shift | g, ctrlCmd | e];
  monaco.editor.addKeybindingRules([...lines, ...find].map((keybinding) => ({ keybinding, command: null, when: `${ONE_LINE} && editorTextFocus` })));
}

/** Text as one line, as a text box takes it: each line break, and the spaces round it, one space. */
const oneLineOf = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ');
const BREAK = /[\r\n]/;

/** Each Monaco's themes defined so far, by name: one is defined once, and worn by any editor that wants it. */
const THEMES = new WeakMap<MonacoApi, Set<string>>();

/** A short name for a theme, the same for the same colours. */
function nameOf(data: unknown): string {
  const text = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  return `fieldia-${(hash >>> 0).toString(36)}`;
}

/** Tell Monaco of the app's workers, unless the app has told it already. */
function giveWorkers(getWorker: NonNullable<MonacoWidgetsOptions['getWorker']>) {
  const scope = globalThis as { MonacoEnvironment?: { getWorker?: unknown } };
  scope.MonacoEnvironment ??= { getWorker };
}

const textOf = (value: Value | undefined) => (value === null || value === undefined ? '' : String(value));
/** The text as JSON, `null` for nothing, or `undefined` when it is not valid. */
function readJson(text: string): JsonValue | undefined {
  // A number JSON.parse would change (an id of 20 digits, 1e400) is not JSON as written: kept unread, never changed.
  return readJsonText(text) as JsonValue | undefined;
}

function monacoWidget(context: WidgetContext, json: boolean, loader: MonacoLoader, { getWorker, services: named = MONACO_SERVICES }: MonacoWidgetsOptions) {
  const { form, name, field, node, id, document, labels = WIDGET_LABELS.en } = context;
  installMonacoStyles(document);
  const language = json ? 'json' : node.options?.['language'];
  // A char field is one line.
  const line = !json && field.type === 'char';
  // This field's language service, when it has one and the app gives a worker for it.
  const service = serviceOf(language);
  const services = typeof getWorker === 'function' && service !== null && named.includes(service);
  const element = document.createElement('div');
  element.className = line ? 'fd-monaco fd-monaco-line' : 'fd-monaco';
  element.dir = 'ltr';

  /** The value as text, as the editor shows it. */
  const show = (value: Value | undefined) => (json ? (value === null || value === undefined ? '' : JSON.stringify(value, null, 2)) : textOf(value));
  /** The value as the widget compares it with what the form holds. */
  const keyOf = (value: Value | undefined) => (json ? JSON.stringify(value ?? null) : textOf(value));

  // Until Monaco is here, and for good if it cannot be loaded: a plain box that works as one.
  const plain = line ? Object.assign(document.createElement('input'), { type: 'text' }) : Object.assign(document.createElement('textarea'), { rows: 4 });
  plain.id = id;
  plain.className = line ? 'fd-input fd-monaco-plain' : 'fd-input fd-textarea fd-code fd-monaco-plain';
  plain.spellcheck = false;
  if (node.placeholder) plain.placeholder = node.placeholder;
  plain.value = show(form.getState().values[name]);
  const error = json ? document.createElement('div') : null;
  if (error) {
    error.className = 'fd-error fd-monaco-error';
    error.dir = 'auto';
    error.setAttribute('role', 'alert');
    error.textContent = labels.invalidJson;
    error.hidden = true;
  }
  element.append(plain, ...(error ? [error] : []));

  /** What the form holds, as last written or shown: its echo of what was typed changes nothing. */
  let known = keyOf(form.getState().values[name]);
  let valid = true;
  let last: WidgetState | null = null;
  let writing = false;
  let gone = false;
  let monaco: MonacoApi | null = null;
  let editor: MonacoEditor | null = null;
  let model: MonacoModel | null = null;
  let box: HTMLElement | null = null;
  /** A one-line editor's frame, drawn as a text box is. */
  let frame: HTMLElement | null = null;
  let worn = '';
  const leave: (() => void)[] = [];

  /** Monaco's own input, or the plain box while there is no Monaco. */
  const input = (): HTMLElement => box?.querySelector<HTMLElement>('textarea.inputarea, textarea') ?? plain;

  /** Its state, said on the box that takes the keyboard. */
  function describe() {
    const at = input();
    at.setAttribute('aria-invalid', String(!valid || !!last?.invalid));
    if (last?.describedBy) at.setAttribute('aria-describedby', last.describedBy);
    else at.removeAttribute('aria-describedby');
    if (at === plain) at.setAttribute('aria-required', String(!!last?.required));
    element.toggleAttribute('data-invalid', !valid);
  }

  function typed(text: string) {
    if (!json) {
      known = text;
      form.setValue(name, text === '' ? null : text);
      return;
    }
    const parsed = readJson(text);
    valid = parsed !== undefined;
    // Where it goes wrong, as the CodeMirror editor and the plain JSON box say it.
    const problem = valid ? null : jsonProblem(text);
    const at = (template: string) => template.replace('{number}', problem?.char ?? '').replace('{line}', String(problem?.line)).replace('{column}', String(problem?.column));
    const words = problem ? at(problem.reason === 'number' ? labels.jsonNumber : labels.invalidJsonAt) : labels.invalidJson;
    if (error) {
      error.hidden = valid;
      if (problem) error.textContent = words;
    }
    describe();
    // Text that is not JSON is kept unread, with where it breaks: a save made meanwhile is refused, never made with the
    // last good value in place of what the editor shows.
    if (parsed === undefined) return form.setUnread(name, { text, message: words });
    known = JSON.stringify(parsed);
    form.setValue(name, parsed);
    if (form.getState().unread?.[name]) form.setUnread(name, null);
  }
  plain.addEventListener('input', () => typed(plain.value));

  /** The theme made from the page's tokens as they are now, worn when they changed. */
  function wear() {
    if (!monaco || !element.isConnected) return;
    const data = monacoTheme(readColours(element));
    const themeName = nameOf(data);
    if (themeName === worn) return;
    const defined = THEMES.get(monaco) ?? new Set<string>();
    if (!defined.has(themeName)) monaco.editor.defineTheme(themeName, data);
    THEMES.set(monaco, defined.add(themeName));
    monaco.editor.setTheme(themeName);
    worn = themeName;
  }

  /** The page's look or scheme changing — or the reader's system going dark — gives the editor its colours again. */
  function follow() {
    const root = element.closest('.fd-form, .fd-form-dialog, .fd-theme');
    const view = document.defaultView;
    if (root && view && 'MutationObserver' in view) {
      const observer = new view.MutationObserver(() => wear());
      observer.observe(root, { attributes: true, attributeFilter: ['data-scheme', 'data-fd-theme', 'data-fd-skin', 'data-accent', 'style', 'class'] });
      leave.push(() => observer.disconnect());
    }
    const dark = typeof view?.matchMedia === 'function' ? view.matchMedia('(prefers-color-scheme: dark)') : null;
    if (dark) {
      dark.addEventListener('change', wear);
      leave.push(() => dark.removeEventListener('change', wear));
    }
  }

  /** Monaco's own input, which the event is for: not a box of its find, say. */
  const forInput = (event: Event) => !!editor && !!(event.target as Element | null)?.classList?.contains('inputarea');

  /**
   * In one line, Enter adds none, with Shift, Alt or Ctrl too. The key is left
   * to the form, as a text box leaves it: Ctrl+Enter saves, and Enter moves on
   * where the page asks it to (`enterMovesToNext`). A key being composed is
   * the input method's.
   */
  function enter(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || !forInput(event)) return;
    event.preventDefault();
  }

  /** Lines pasted into one line are joined, as a text box joins them, in one paste; line breaks alone paste nothing. */
  function pasted(event: ClipboardEvent) {
    if (!forInput(event) || last?.readonly) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!BREAK.test(text)) return;
    event.preventDefault();
    event.stopPropagation();
    if (text.trim() !== '') editor?.trigger('keyboard', 'paste', { text: oneLineOf(text) });
  }

  /**
   * A line break that came in some other way — a line copied down, a
   * suggestion of several lines — is joined at once. Undo and Redo step over
   * the join together with what brought the line break.
   */
  function rejoin({ isUndoing, isRedoing }: MonacoContentChange) {
    if (gone || !editor || !model || model.getLineCount() < 2) return;
    if (isUndoing || isRedoing) {
      editor.trigger('fieldia', isUndoing ? 'undo' : 'redo', null);
      return;
    }
    const text = model.getValue();
    const joined = oneLineOf(text);
    const before = oneLineOf(text.slice(0, model.getOffsetAt(editor.getPosition() ?? { lineNumber: 1, column: 1 })));
    const column = Math.min(before.length, joined.length) + 1;
    editor.executeEdits('fieldia', [{ range: model.getFullModelRange(), text: joined }], [{ selectionStartLineNumber: 1, selectionStartColumn: column, positionLineNumber: 1, positionColumn: column }]);
  }

  function fit(contentHeight: number) {
    if (!box || !editor) return;
    box.style.height = `${Math.min(MOST, Math.max(LEAST, contentHeight + 2))}px`;
    editor.layout();
  }

  async function start() {
    if (getWorker) giveWorkers(getWorker);
    const loaded = await loader.monaco(services);
    const monacoId = await loader.language(loaded, language, services);
    if (gone) return;
    monaco = loaded;
    box = document.createElement('div');
    box.className = 'fd-monaco-box';
    if (line) {
      frame = document.createElement('div');
      frame.className = 'fd-monaco-frame';
      frame.append(box);
      // A press on the frame, round the code, goes into it, as one on a text box's edge does.
      frame.addEventListener('mousedown', (event) => {
        if (event.target !== frame || !editor) return;
        event.preventDefault();
        editor.focus();
      });
      element.addEventListener('keydown', enter, true);
      element.addEventListener('paste', pasted, true);
      lineKeys(monaco);
    }
    element.insertBefore(frame ?? box, plain);
    const focused = document.activeElement === plain;
    model = monaco.editor.createModel(plain.value, monacoId);
    editor = monaco.editor.create(box, {
      ...EDITOR_OPTIONS,
      ...(line ? LINE_OPTIONS : {}),
      model,
      readOnly: !!last?.readonly,
      domReadOnly: !!last?.readonly,
      ariaRequired: !!last?.required,
      wordBasedSuggestions: services ? 'currentDocument' : 'off',
      quickSuggestions: services,
      ...(plain.placeholder ? { placeholder: plain.placeholder } : {}),
    });
    wear();
    follow();
    // The field's label names Monaco's input now, and points at it.
    plain.remove();
    plain.removeAttribute('id');
    const area = input();
    area.id = id;
    area.setAttribute('aria-labelledby', `${id}-label`);
    if (line) {
      // One line, said to assistive technology, and to the form, which moves on from it at Enter as from a text box.
      area.setAttribute('aria-multiline', 'false');
      editor.createContextKey(ONE_LINE, true);
    }
    describe();
    const current = model;
    editor.onDidChangeModelContent((change) => {
      if (writing) return;
      // A line break typed into one line: joined in a moment, and never in the form.
      const broken = line && change.changes.some(({ text }) => BREAK.test(text));
      if (broken) queueMicrotask(() => rejoin(change));
      typed(broken ? oneLineOf(current.getValue()) : current.getValue());
    });
    if (!line) {
      editor.onDidContentSizeChange(({ contentHeight }) => fit(contentHeight));
      fit(editor.getContentHeight());
    }
    if (focused) editor.focus();
  }
  // Monaco not loaded: the plain box stays, and works.
  start().catch(() => undefined);

  return {
    element,
    focus: () => (editor ? editor.focus() : plain.focus()),
    destroy() {
      gone = true;
      element.removeEventListener('keydown', enter, true);
      element.removeEventListener('paste', pasted, true);
      for (const stop of leave.splice(0)) stop();
      editor?.dispose();
      model?.dispose();
    },
    update(state: WidgetState) {
      last = state;
      plain.readOnly = state.readonly;
      element.toggleAttribute('data-readonly', state.readonly);
      editor?.updateOptions({ readOnly: state.readonly, domReadOnly: state.readonly, ariaRequired: state.required });
      if (!worn) wear();
      describe();
      // A value from elsewhere (loaded, discarded, set by a step) replaces the text; the echo of what was typed does not.
      // Text that is not JSON stays while the form keeps it unread; let go (the record put back, saved), the value shows.
      const incoming = keyOf(state.value);
      if (incoming === known && (valid || !json || form.getState().unread?.[name])) return;
      known = incoming;
      valid = true;
      if (error) error.hidden = true;
      const text = show(state.value);
      if (model) {
        writing = true;
        model.setValue(text);
        writing = false;
      } else plain.value = text;
      describe();
    },
  };
}

/**
 * The widgets, made with the app's choices: `text.monaco` for text in a
 * language, `char.monaco` for one line of it, `json.monaco` for JSON. Pass
 * them to the viewer (`widgets`).
 */
export function createMonacoWidgets(options: MonacoWidgetsOptions = {}): Record<string, WidgetFactory> {
  const loader = options.loader ?? defaultLoader;
  const factory = (json: boolean): WidgetFactory => (context) => monacoWidget(context, json, loader, options);
  const text = factory(false);
  return { 'text.monaco': text, 'char.monaco': text, 'json.monaco': factory(true) };
}

/** The widgets with no language services: code coloured, no worker started. */
export const monacoWidgets: Record<string, WidgetFactory> = createMonacoWidgets();
