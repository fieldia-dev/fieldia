import type { ElementFactory } from './chrome';
import { designerIcon } from './icons';
import type { DesignerWords } from './designer-words';

/**
 * Find anything: one box over a list of everything the editor can add, go to
 * or do. Every word typed must appear in what is found, in any order; the
 * arrows move, Enter or a click runs it, Escape closes. The editor says what
 * there is; this only finds it.
 */

export interface FindItem {
  label: string;
  /** A quiet word on the right: what kind of thing it is. */
  hint?: string;
  /** Its icon by name, as it shows elsewhere — the Rules view's, as in the bar. */
  icon?: string;
  run(): void;
}

let count = 0;

export function openFind(el: ElementFactory, root: HTMLElement, items: FindItem[], words: DesignerWords): { close(): void } {
  const doc = root.ownerDocument;
  const w = words.bar;
  const opener = doc.activeElement as HTMLElement | null;
  const id = `fd-find-${++count}`;
  const input = el('input', {
    class: 'fd-find-input',
    role: 'combobox',
    'aria-label': w.findAnything,
    'aria-expanded': 'true',
    'aria-controls': `${id}-list`,
    'aria-autocomplete': 'list',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: w.findPlaceholder,
  }) as HTMLInputElement;
  const list = el('div', { class: 'fd-find-list', role: 'listbox', id: `${id}-list`, 'aria-label': w.found });
  const none = el('p', { class: 'fd-find-none', hidden: '' }, w.nothingFound);
  const box = el('div', { class: 'fd-find', role: 'dialog', 'aria-modal': 'true', 'aria-label': w.findAnything }, input, list, none);
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-find-backdrop' }, box);

  let found: FindItem[] = items;
  let at = 0;
  function draw() {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    found = items.filter((item) => words.every((word) => item.label.toLowerCase().includes(word)));
    at = Math.min(at, Math.max(0, found.length - 1));
    const iconed = found.some((item) => item.icon);
    list.replaceChildren(
      ...found.map((item, i) => {
        const option = el(
          'div',
          { class: 'fd-find-option', role: 'option', id: `${id}-${i}`, 'aria-selected': String(i === at) },
          ...(item.icon ? [designerIcon(doc, item.icon)] : iconed ? [el('span', { class: 'fd-find-icon-room', 'aria-hidden': 'true' })] : []),
          el('span', { class: 'fd-find-label' }, item.label),
          ...(item.hint ? [el('span', { class: 'fd-find-hint' }, item.hint)] : [])
        );
        option.addEventListener('pointerdown', (event) => event.preventDefault());
        option.addEventListener('click', () => run(item));
        return option;
      })
    );
    none.hidden = found.length > 0;
    if (found.length) input.setAttribute('aria-activedescendant', `${id}-${at}`);
    else input.removeAttribute('aria-activedescendant');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }
  function close(refocus = true) {
    backdrop.remove();
    if (refocus) opener?.focus?.();
  }
  function run(item: FindItem) {
    // Closed first, focus back where it was: what it runs may put the cursor somewhere else,
    // and a dialog it opens gives focus back there when it closes.
    close();
    item.run();
  }
  input.addEventListener('input', () => {
    at = 0;
    draw();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!found.length) return;
      at = (at + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
      draw();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (found[at]) run(found[at]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') event.preventDefault();
  });
  backdrop.addEventListener('pointerdown', (event) => event.target === backdrop && close());
  draw();
  root.append(backdrop);
  // Focused now, not a frame later: what is typed straight after ⌘K lands in the box.
  input.focus();
  return { close };
}

/** A setting of the panel, as Find anything lists it. */
export interface SettingEntry {
  name: string;
  /** Where it is, in words: its tab, or the page's look. */
  tab: string;
  /** Its choices, when it is a choice of a few; `group` names the choices' own group where a setting has several. */
  choices: { value: string; words: string; group?: string }[];
}

/**
 * The panel's settings as things to find: each by its name, and each of its
 * choices as "Labels: beside" — by the choices' own group where a setting
 * has several, as Columns has one for each size of screen.
 */
export function settingItems<T extends SettingEntry>(entries: readonly T[], open: (entry: T, choice?: string) => void, words: DesignerWords, kind = words.bar.setting): FindItem[] {
  return entries.flatMap((entry) => {
    const hint = words.bar.settingHint(kind, entry.tab);
    const groups = new Set(entry.choices.map((c) => c.group));
    return [
      { label: entry.name, hint, run: () => open(entry) },
      ...entry.choices.map((choice) => ({
        label: words.bar.settingChoice(groups.size > 1 && choice.group ? choice.group : entry.name, choice.words),
        hint,
        run: () => open(entry, choice.value),
      })),
    ];
  });
}
