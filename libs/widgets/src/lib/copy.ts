import { describeState, maker, setText, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A value with a button that copies it: Flectra's CopyClipboardChar and
 * CopyClipboardText. The value is typed in its box as any text, or read-only;
 * the button, once pressed, says "Copied" for two seconds, to screen readers
 * too. Nothing to copy while it is empty.
 */
export const copyWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const long = field.type === 'text';
  const input = long ? make('textarea', { id, class: 'fd-input fd-textarea', rows: '3' }) : make('input', { id, type: 'text', class: 'fd-input', autocomplete: 'off' });
  if (node.placeholder) input.placeholder = node.placeholder;
  input.addEventListener('input', () => form.setValue(name, input.value === '' ? null : input.value));
  const button = make('button', { type: 'button', class: 'fd-button fd-copy-button', hidden: '' }, words.copyValue);
  const said = make('span', { class: 'fd-sr-only', role: 'status' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', async () => {
    const text = String(form.getState().values[name] ?? '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard to write to (an insecure page): the browser's own copy of the text, selected.
      input.select();
      document.execCommand?.('copy');
    }
    setText(button, words.copied);
    setText(said, words.copied);
    clearTimeout(timer);
    timer = setTimeout(() => {
      setText(button, words.copyValue);
      setText(said, '');
    }, 2000);
  });
  return {
    element: make('span', { class: `fd-copy${long ? ' fd-copy-long' : ''}` }, input, button, said),
    focus: () => input.focus(),
    destroy: () => clearTimeout(timer),
    update(state) {
      const text = state.value === null || state.value === undefined ? '' : String(state.value);
      if (input.value !== text) input.value = text;
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      button.hidden = !text;
      describeState(input, state);
    },
  };
};
