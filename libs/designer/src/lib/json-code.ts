import type { ElementFactory } from './chrome';
import { offsetOf, type Place } from './json-text';

/**
 * The box JSON is typed in: a plain text box with the line numbers beside
 * it and each problem's line marked, no editor library. It grows with its
 * text, so the numbers and the marks scroll with it in one box of their own;
 * long lines scroll sideways inside the text box, never the page. Tab
 * indents; Escape, then Tab, leaves the box.
 */

/** A line's height in the box, in pixels: the numbers and the marks follow it, and the stylesheet sets it. */
export const CODE_LINE = 20;
/** The room above the first line, in pixels, as the stylesheet sets it. */
export const CODE_TOP = 12;

export interface CodeBox {
  element: HTMLElement;
  input: HTMLTextAreaElement;
  /** Number the lines again after the text changed. */
  refresh(): void;
  /** Mark these lines, each with how much its problem matters. */
  mark(lines: { line: number; severity: string }[]): void;
  /** The cursor at a line and column, that line scrolled into view. */
  goTo(place: Place): void;
  /** The text replaced, the cursor kept where it was. */
  replace(text: string): void;
}

export function codeBox(el: ElementFactory, doc: Document, options: { label: string; describedBy: string; onApply(): void }): CodeBox {
  const input = el('textarea', {
    class: 'fd-json-input',
    'aria-label': options.label,
    'aria-describedby': options.describedBy,
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    wrap: 'off',
  });
  const gutter = el('pre', { class: 'fd-json-gutter', 'aria-hidden': 'true' });
  const marks = el('div', { class: 'fd-json-marks', 'aria-hidden': 'true' });
  // JSON reads left to right, whichever way the page or the designer runs.
  const element = el('div', { class: 'fd-json-code', dir: 'ltr' }, marks, gutter, input);
  let lines = 0;

  function refresh() {
    const count = input.value.split('\n').length;
    if (count === lines) return;
    lines = count;
    gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    element.style.setProperty('--fd-json-lines', String(count));
  }

  /** Put text where the selection is: the browser's own typing, so its undo takes it back; set directly where there is none. */
  function insert(text: string, start: number, end: number, select = false) {
    input.setSelectionRange(start, end);
    // Only into this box: the browser types into whatever has the focus.
    const typed = doc.activeElement === input && typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text);
    if (!typed) {
      input.setRangeText(text, start, end, select ? 'select' : 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (select) input.setSelectionRange(start, start + text.length);
  }

  /** Two spaces in, or out with Shift: at the cursor, or on every line of the selection. */
  function indent(out: boolean) {
    const { selectionStart: start, selectionEnd: end, value } = input;
    if (start === end && !out) return insert('  ', start, end);
    const from = value.lastIndexOf('\n', start - 1) + 1;
    const block = value.slice(from, end);
    const moved = block
      .split('\n')
      .map((line) => (out ? line.replace(/^ {1,2}/, '') : `  ${line}`))
      .join('\n');
    if (moved !== block) insert(moved, from, end, true);
  }

  // Escape lets the next Tab leave the box, so the keyboard is never caught in it.
  let leaving = false;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      leaving = true;
      return;
    }
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (leaving) {
        leaving = false;
        return;
      }
      event.preventDefault();
      indent(event.shiftKey);
      return;
    }
    leaving = false;
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      options.onApply();
    }
  });
  input.addEventListener('input', refresh);
  input.addEventListener('blur', () => (leaving = false));

  return {
    element,
    input,
    refresh,
    mark(found) {
      const seen = new Set<number>();
      marks.replaceChildren(
        ...found
          .filter(({ line }) => !seen.has(line) && seen.add(line))
          .map(({ line, severity }) => {
            const mark = el('div', { class: 'fd-json-mark', 'data-line': String(line), 'data-severity': severity });
            mark.style.top = `${CODE_TOP + (line - 1) * CODE_LINE}px`;
            return mark;
          })
      );
    },
    goTo(place) {
      const at = offsetOf(input.value, place);
      input.focus({ preventScroll: true });
      input.setSelectionRange(at, at);
      // The box scrolls, not the page: the line a third of the way down, when it is out of sight.
      const top = CODE_TOP + (place.line - 1) * CODE_LINE;
      if (top < element.scrollTop || top + CODE_LINE > element.scrollTop + element.clientHeight) element.scrollTop = Math.max(0, top - element.clientHeight / 3);
      element.scrollIntoView?.({ block: 'nearest' });
    },
    replace(text) {
      if (text === input.value) return;
      const caret = Math.min(input.selectionStart, text.length);
      input.value = text;
      input.setSelectionRange(caret, caret);
      refresh();
    },
  };
}
