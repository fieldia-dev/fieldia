import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import type { JsonValue, Value } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetFactory } from '@fieldia/widgets';
import { installCodeStyles } from './styles';

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

export const codeWidget: WidgetFactory = ({ form, name, id, document, labels = WIDGET_LABELS.en }) => {
  installCodeStyles(document);
  const element = document.createElement('div');
  element.className = 'fd-code';
  const error = document.createElement('div');
  error.className = 'fd-error fd-code-error';
  error.setAttribute('role', 'alert');
  error.textContent = labels.invalidJson;
  error.hidden = true;

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
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        json(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        editable.of([EditorView.editable.of(true), EditorState.readOnly.of(false)]),
        // Named by the field's label, like every other field.
        EditorView.contentAttributes.of({ id, 'aria-labelledby': `${id}-label` }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || writing) return;
          const parsed = read(update.state.doc.toString());
          const valid = parsed !== undefined;
          error.hidden = valid;
          view.contentDOM.setAttribute('aria-invalid', String(!valid));
          if (!valid) return;
          known = JSON.stringify(parsed);
          form.setValue(name, parsed);
        }),
      ],
    }),
  });
  element.append(error);

  return {
    element,
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    update(state) {
      view.dispatch({
        effects: editable.reconfigure([EditorView.editable.of(!state.readonly), EditorState.readOnly.of(state.readonly)]),
      });
      // A value from elsewhere (loaded, discarded) replaces the text; the echo of what was typed does not.
      const incoming = JSON.stringify(state.value ?? null);
      if (incoming === known) return;
      known = incoming;
      writing = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: show(state.value) } });
      writing = false;
      error.hidden = true;
      view.contentDOM.setAttribute('aria-invalid', 'false');
    },
  };
};

/** Pass these to the viewer (`widgets`) to show json nodes marked `"widget": "code"` in the editor. */
export const codeWidgets: Record<string, WidgetFactory> = { 'json.code': codeWidget };
