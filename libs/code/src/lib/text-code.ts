import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type ChangeSpec, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import type { Value } from '@fieldia/core';
import type { WidgetFactory } from '@fieldia/widgets';
import { loadCodeLanguage } from './languages';
import { codeHighlightStyle } from './palette';
import { installCodeStyles } from './styles';

/**
 * A text or char field as code, coloured in the language the page names:
 * `{ "widget": "code", "options": { "language": "python" } }`. The grammar
 * loads when the field is drawn, and only that one; a language the editor
 * does not know is plain text. What is typed reaches the form as text, an
 * empty editor as nothing. Tab is left to move between fields; Ctrl+] and
 * Ctrl+[ indent. Code reads left to right, on an Arabic page too.
 */

const textOf = (value: Value | undefined) => (value === null || value === undefined ? '' : String(value));

/** A char field is one line: Enter adds nothing, and pasted lines join, as a text box joins them. */
const oneLine: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.newDoc.lines === 1) return tr;
  let words = false;
  const changes: ChangeSpec[] = [];
  tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
    const text = inserted.toString();
    if (text.trim() !== '') words = true;
    changes.push({ from, to, insert: text.replace(/\s*[\r\n]+\s*/g, ' ') });
  });
  if (!words) return [];
  const joined = tr.startState.changes(changes);
  return { changes: joined, selection: { anchor: joined.mapPos(tr.startState.selection.main.head, 1) }, scrollIntoView: true };
});

/** No longer than the field's size: a change that would make it longer is refused, as a text box's maxlength does. */
const atMost = (size: number): Extension =>
  EditorState.transactionFilter.of((tr) => (tr.docChanged && tr.newDoc.length > size && tr.newDoc.length > tr.startState.doc.length ? [] : tr));

export const textCodeWidget: WidgetFactory = ({ form, name, field, node, id, document }) => {
  installCodeStyles(document);
  const line = field.type === 'char';
  const element = document.createElement('div');
  element.className = line ? 'fd-code fd-code-text fd-code-line' : 'fd-code fd-code-text';
  element.dir = 'ltr';
  const size = (field.type === 'char' || field.type === 'text') && field.size !== undefined ? field.size : undefined;

  const grammar = new Compartment();
  const editable = new Compartment();
  const described = new Compartment();
  /** What the form holds as text, as last written or shown: its echo of what was typed changes nothing. */
  let known = textOf(form.getState().values[name]);
  let writing = false;
  let readonly: boolean | null = null;
  let attributes = '';

  const view = new EditorView({
    parent: element,
    state: EditorState.create({
      doc: known,
      extensions: [
        line ? oneLine : lineNumbers(),
        size !== undefined ? atMost(size) : [],
        history(),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(codeHighlightStyle),
        grammar.of([]),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        node.placeholder ? placeholder(node.placeholder) : [],
        editable.of([]),
        // Named by the field's label, like every other field; its state said as the form says it.
        EditorView.contentAttributes.of({ id, 'aria-labelledby': `${id}-label` }),
        described.of([]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || writing) return;
          known = update.state.doc.toString();
          form.setValue(name, known === '' ? null : known);
        }),
      ],
    }),
  });

  // The language's grammar, once loaded; nothing if the page names none the editor knows. (An editor
  // destroyed meanwhile takes the change quietly.)
  void loadCodeLanguage(node.options?.['language']).then((support) => {
    if (support) view.dispatch({ effects: grammar.reconfigure(support) });
  });

  return {
    element,
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    update(state) {
      const effects = [];
      if (state.readonly !== readonly) {
        readonly = state.readonly;
        element.toggleAttribute('data-readonly', readonly);
        effects.push(editable.reconfigure([EditorView.editable.of(!readonly), EditorState.readOnly.of(readonly)]));
      }
      const said: Record<string, string> = { 'aria-invalid': String(state.invalid), 'aria-required': String(state.required), 'aria-readonly': String(state.readonly) };
      if (state.describedBy) said['aria-describedby'] = state.describedBy;
      if (JSON.stringify(said) !== attributes) {
        attributes = JSON.stringify(said);
        effects.push(described.reconfigure(EditorView.contentAttributes.of(said)));
      }
      if (effects.length) view.dispatch({ effects });
      // A value from elsewhere (loaded, discarded, set by a step) replaces the text; the echo of what was typed does not.
      const incoming = textOf(state.value);
      if (incoming === known) return;
      known = incoming;
      writing = true;
      // Shown whole, whatever its length or lines: the filters are for what is typed.
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: incoming }, filter: false });
      writing = false;
    },
  };
};
