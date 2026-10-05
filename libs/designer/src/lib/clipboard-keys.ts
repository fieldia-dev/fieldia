import type { Designer } from './designer';
import { FIELDIA_MIME, readParts } from './clipboard-ops';
import { en } from './locales/en';

/**
 * ⌘C, ⌘X and ⌘V (Ctrl on Windows) on the parts picked — on the canvas or in
 * the outline — through the system clipboard, so parts go between two
 * designers and two tabs of the browser: the parts as Fieldia's own type,
 * and the same JSON as plain text. What is typed in a box, and words chosen
 * on the page, copy and paste as ever. Each copy, cut and paste is said in a
 * polite line that shows a moment and goes, as is a paste of words that are
 * not Fieldia's, which pastes nothing.
 */

export interface ClipboardKeysOptions {
  /** The editor: what happens outside it is not its to handle. */
  root: HTMLElement;
  designer: Designer;
  /** Whether the editor is designing: not while trying the form, or writing JSON. */
  active(): boolean;
}

/** The keys, as the sheet of shortcuts lists them (in the designer's words: `words.clipboard.keys`). */
export const CLIPBOARD_KEYS: [string, string][] = en.clipboard.keys;

/** How long the line saying what was done stays. */
const SHOWN_FOR = 2600;

export function clipboardKeys(options: ClipboardKeysOptions): { destroy(): void } {
  const { root, designer } = options;
  const w = designer.words.clipboard;
  const doc = root.ownerDocument;
  const said = doc.createElement('div');
  said.className = 'fd-clipboard-said';
  said.setAttribute('role', 'status');
  said.setAttribute('aria-live', 'polite');
  root.append(said);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const say = (words: string) => {
    said.textContent = words;
    said.classList.add('fd-clipboard-shown');
    clearTimeout(timer);
    timer = setTimeout(() => said.classList.remove('fd-clipboard-shown'), SHOWN_FOR);
  };

  /** A copy, a cut or a paste the editor answers: in it, not in a box being typed in, and no words chosen on the page. */
  function ours(event: Event): boolean {
    const target = event.target as Element | null;
    if (!target || !options.active() || (target !== doc.body && !root.contains(target))) return false;
    if (target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
    return true;
  }
  const wordsChosen = () => !!doc.getSelection()?.toString().trim();
  const named = (parts: { id: string; label?: string; title?: string; field?: string }[], fields: Record<string, { label?: string }>) =>
    parts.length === 1 ? designer.words.parts.quote(parts[0].label ?? fields[parts[0].field ?? '']?.label ?? parts[0].title ?? w.part) : w.parts(parts.length);

  function copy(event: ClipboardEvent, cut: boolean) {
    if (!ours(event) || wordsChosen()) return;
    const text = designer.copyParts(designer.getState().picked);
    const copied = text ? readParts(text) : null;
    if (!text || !copied || !event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData(FIELDIA_MIME, text);
    event.clipboardData.setData('text/plain', text);
    const name = named(copied.parts as never, copied.fields);
    if (!cut) return say(w.copied(name));
    say(designer.remove(copied.parts.map((p) => p.id)) ? w.cut(name) : (designer.getState().issues[0] ?? w.copiedNotCut));
  }

  function paste(event: ClipboardEvent) {
    if (!ours(event)) return;
    const data = event.clipboardData;
    const text = data?.getData(FIELDIA_MIME) || data?.getData('text/plain') || '';
    event.preventDefault();
    const pasted = designer.pasteParts(text);
    if (!pasted) return say(designer.getState().issues[0] ?? w.nothingPasted);
    const copied = readParts(text);
    const name = copied ? named(copied.parts as never, copied.fields) : w.parts(pasted.ids.length);
    say(w.pasted(name, pasted.dropped));
  }

  const onCopy = (event: ClipboardEvent) => copy(event, false);
  const onCut = (event: ClipboardEvent) => copy(event, true);
  doc.addEventListener('copy', onCopy);
  doc.addEventListener('cut', onCut);
  doc.addEventListener('paste', paste);
  return {
    destroy() {
      clearTimeout(timer);
      said.remove();
      doc.removeEventListener('copy', onCopy);
      doc.removeEventListener('cut', onCut);
      doc.removeEventListener('paste', paste);
    },
  };
}
