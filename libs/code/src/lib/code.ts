import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import type { JsonValue, Value } from '@fieldia/core';
import { jsonProblem, WIDGET_LABELS, type WidgetFactory } from '@fieldia/widgets';
import { codeHighlightStyle } from './palette';
import { installCodeStyles } from './styles';
import { textCodeWidget } from './text-code';

export { textCodeWidget } from './text-code';

/**
 * A JSON field in a code editor: CodeMirror 6, bundled with the package, so it
 * works offline and loads only on pages that ask for it (`"widget": "code"` on
 * a json node, with `codeWidgets` passed to the viewer). Valid JSON reaches
 * the form as it is typed; text that is not valid is said so and kept, and the
 * last good value stays. Tab is left to move between fields.
 */

const show = (value: Value | undefined) => (value === null || value === undefined ? '' : JSON.stringify(value, null, 2));

/** The text as JSON, `null` for nothing, or `undefined` when it is not valid. */
function read(text: string): JsonValue | undefined {
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return undefined;
  }
}

/** Where the JSON went wrong, marked: its line shaded, the character that cannot be there underlined. Null takes the marks away. */
const markProblem = StateEffect.define<number | null>();
const problemMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(markProblem)) continue;
      if (effect.value === null) {
        next = Decoration.none;
        continue;
      }
      const at = Math.min(effect.value, tr.state.doc.length);
      const line = tr.state.doc.lineAt(at);
      const ranges = [Decoration.line({ class: 'fd-code-bad-line' }).range(line.from)];
      if (at < line.to) ranges.push(Decoration.mark({ class: 'fd-code-bad-spot' }).range(at, at + 1));
      next = Decoration.set(ranges, true);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** How long typing pauses before a problem is said: not at every key of a word half typed. */
const SETTLE_MS = 500;

export const codeWidget: WidgetFactory = ({ form, name, id, document, labels = WIDGET_LABELS.en }) => {
  installCodeStyles(document);
  const element = document.createElement('div');
  element.className = 'fd-code';
  // JSON reads left to right, on an Arabic page too: drawn right to left, its punctuation moves.
  element.dir = 'ltr';
  const error = document.createElement('div');
  error.className = 'fd-error fd-code-error';
  error.id = `${id}-json-problem`;
  // In the page's language, though the code above it reads left to right: an Arabic message reads right to left.
  error.dir = 'auto';
  error.setAttribute('role', 'alert');
  error.textContent = labels.invalidJson;
  error.hidden = true;
  /** The field's own help and error, from the form. */
  let described = '';
  let invalidByForm = false;
  let saying: ReturnType<typeof setTimeout> | undefined;

  const editable = new Compartment();
  /** What the form holds, as last written or shown: an echo of it is not a change. */
  let known = JSON.stringify(form.getState().values[name] ?? null);
  let writing = false;

  const view = new EditorView({
    parent: element,
    state: EditorState.create({
      doc: show(form.getState().values[name]),
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        // The code colours, light or dark with the page: CodeMirror's own are for light pages only.
        syntaxHighlighting(codeHighlightStyle),
        json(),
        problemMarks,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        editable.of([EditorView.editable.of(true), EditorState.readOnly.of(false)]),
        // Named by the field's label, like every other field.
        EditorView.contentAttributes.of({ id, 'aria-labelledby': `${id}-label` }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || writing) return;
          const text = update.state.doc.toString();
          const parsed = read(text);
          clearTimeout(saying);
          if (parsed === undefined) {
            // Said, and marked where it breaks, once typing pauses.
            saying = setTimeout(() => say(jsonProblem(text)), SETTLE_MS);
            return;
          }
          queueMicrotask(() => say(null));
          known = JSON.stringify(parsed);
          form.setValue(name, parsed);
        }),
      ],
    }),
  });
  element.append(error);

  /** Says where the JSON goes wrong, or that nothing does: under the editor, in it, and to assistive technology. */
  function say(problem: { offset: number; line: number; column: number } | null) {
    error.hidden = !problem;
    if (problem) error.textContent = labels.invalidJsonAt.replace('{line}', String(problem.line)).replace('{column}', String(problem.column));
    view.dispatch({ effects: markProblem.of(problem ? problem.offset : null) });
    describe();
  }

  function describe() {
    const content = view.contentDOM;
    content.setAttribute('aria-invalid', String(invalidByForm || !error.hidden));
    const ids = [described, error.hidden ? '' : error.id].filter(Boolean).join(' ');
    if (ids) content.setAttribute('aria-describedby', ids);
    else content.removeAttribute('aria-describedby');
  }

  return {
    element,
    focus: () => view.focus(),
    destroy: () => {
      clearTimeout(saying);
      view.destroy();
    },
    update(state) {
      view.dispatch({
        effects: editable.reconfigure([EditorView.editable.of(!state.readonly), EditorState.readOnly.of(state.readonly)]),
      });
      described = state.describedBy ?? '';
      invalidByForm = state.invalid;
      view.contentDOM.setAttribute('aria-required', String(state.required));
      describe();
      // A value from elsewhere (loaded, discarded) replaces the text; the echo of what was typed does not.
      const incoming = JSON.stringify(state.value ?? null);
      if (incoming === known) return;
      known = incoming;
      writing = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: show(state.value) } });
      writing = false;
      clearTimeout(saying);
      say(null);
    },
  };
};

/**
 * Pass these to the viewer (`widgets`) to show nodes marked `"widget": "code"`
 * in the editor: json as JSON, text and char in the language the node names
 * (`"options": { "language": "python" }`).
 */
export const codeWidgets: Record<string, WidgetFactory> = { 'json.code': codeWidget, 'text.code': textCodeWidget, 'char.code': textCodeWidget };
