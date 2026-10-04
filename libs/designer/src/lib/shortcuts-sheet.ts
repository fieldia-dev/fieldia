import type { ElementFactory } from './chrome';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { forPlatform, shortcutGroups, type KeyRow } from './shortcuts-list';

/**
 * The sheet of shortcuts: “?” pressed outside a box, or “Keyboard shortcuts”
 * in Find anything, opens a dialog of every key the editor answers, in
 * groups (shortcuts-list.ts), with a box to find one by its words. Keys show
 * as this computer has them: ⌘ on a Mac, Ctrl elsewhere. Escape, its button
 * or the room round it closes it, and the keyboard goes back where it was.
 */

export interface ShortcutKeysOptions {
  el: ElementFactory;
  /** The editor: the sheet opens over it, and “?” counts only in it. */
  root: HTMLElement;
  survey: boolean;
  /** Whether the editor is designing: not while trying the form, or writing JSON. */
  active(): boolean;
}

export interface ShortcutKeys {
  /** For Find anything. */
  items(): FindItem[];
  open(): void;
  destroy(): void;
}

let count = 0;

/** Keys as boxes to read, and the words between them (“/”, “or”) as words. */
function keyBoxes(el: ElementFactory, keys: string): (Node | string)[] {
  return keys.split(/( \/ | or )/).map((part) => (/^( \/ | or )$/.test(part) || / /.test(part) ? part : el('kbd', {}, part)));
}

export function shortcutKeys(options: ShortcutKeysOptions): ShortcutKeys {
  const { el, root } = options;
  const doc = root.ownerDocument;
  const mac = /Mac|iPhone|iPad/.test(doc.defaultView?.navigator.platform ?? '');
  let close: (() => void) | null = null;

  function open() {
    if (close) return;
    const opener = doc.activeElement as HTMLElement | null;
    const id = `fd-keys-${++count}`;
    const find = el('input', { class: 'fd-keys-find', type: 'search', 'aria-label': 'Find a key', placeholder: 'Find a key, or what it does', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    const shut = el('button', { type: 'button', class: 'fd-keys-close', 'aria-label': 'Close', title: 'Close' }, designerIcon(doc, 'plus'));
    const rows: { row: HTMLElement; words: string }[] = [];
    const groups = shortcutGroups({ survey: options.survey }).map((group) => {
      const heading = `${id}-${group.name.toLowerCase()}`;
      const list = el(
        'dl',
        {},
        ...group.keys.map(([keys, what]: KeyRow) => {
          const shown = forPlatform(keys, mac);
          const said = forPlatform(what, mac);
          const row = el('div', { class: 'fd-keys-row' }, el('dt', {}, ...keyBoxes(el, shown)), el('dd', {}, said));
          rows.push({ row, words: `${shown} ${said} ${group.name}`.toLowerCase() });
          return row;
        })
      );
      return el('section', { class: 'fd-keys-group', 'aria-labelledby': heading }, el('h3', { id: heading }, group.name), ...(group.when ? [el('p', { class: 'fd-keys-when' }, group.when)] : []), list);
    });
    const none = el('p', { class: 'fd-keys-none', hidden: '' }, 'No key does that.');
    const dialog = el(
      'div',
      { class: 'fd-keys', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-title` },
      el('div', { class: 'fd-keys-head' }, el('h2', { class: 'fd-keys-title', id: `${id}-title` }, 'Keyboard shortcuts'), shut),
      find,
      el('div', { class: 'fd-keys-groups' }, ...groups),
      none
    );
    const backdrop = el('div', { class: 'fd-dialog-backdrop fd-keys-backdrop' }, dialog);

    find.addEventListener('input', () => {
      const words = find.value.toLowerCase().split(/\s+/).filter(Boolean);
      for (const { row, words: has } of rows) row.hidden = !words.every((word) => has.includes(word));
      for (const group of groups) group.hidden = ![...group.querySelectorAll<HTMLElement>('.fd-keys-row')].some((row) => !row.hidden);
      none.hidden = groups.some((group) => !group.hidden);
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close?.();
      } else if (event.key === 'Tab') {
        // The keyboard stays in the sheet: its box and its button.
        event.preventDefault();
        (doc.activeElement === find ? shut : find).focus();
      }
    });
    shut.addEventListener('click', () => close?.());
    backdrop.addEventListener('pointerdown', (event) => event.target === backdrop && close?.());
    close = () => {
      backdrop.remove();
      close = null;
      opener?.focus?.();
    };
    root.append(backdrop);
    find.focus();
  }

  // Before the editors' own keys: on the Advanced canvas, “?” would otherwise only show the canvas's.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || close || !options.active()) return;
    const target = event.target as Element;
    if (target !== doc.body && !root.contains(target)) return;
    if (target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    event.preventDefault();
    open();
  };
  doc.addEventListener('keydown', onKey, true);

  return {
    items: () => [{ label: 'Keyboard shortcuts', hint: '?', run: open }],
    open,
    destroy() {
      close?.();
      doc.removeEventListener('keydown', onKey, true);
    },
  };
}
