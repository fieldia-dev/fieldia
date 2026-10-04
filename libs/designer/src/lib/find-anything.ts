import type { ElementFactory } from './chrome';

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
  run(): void;
}

let count = 0;

export function openFind(el: ElementFactory, root: HTMLElement, items: FindItem[]): { close(): void } {
  const doc = root.ownerDocument;
  const opener = doc.activeElement as HTMLElement | null;
  const id = `fd-find-${++count}`;
  const input = el('input', {
    class: 'fd-find-input',
    role: 'combobox',
    'aria-label': 'Find anything',
    'aria-expanded': 'true',
    'aria-controls': `${id}-list`,
    'aria-autocomplete': 'list',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Find a field, a kind, a setting, an action…',
  }) as HTMLInputElement;
  const list = el('div', { class: 'fd-find-list', role: 'listbox', id: `${id}-list`, 'aria-label': 'Found' });
  const none = el('p', { class: 'fd-find-none', hidden: '' }, 'Nothing by that name.');
  const box = el('div', { class: 'fd-find', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Find anything' }, input, list, none);
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-find-backdrop' }, box);

  let found: FindItem[] = items;
  let at = 0;
  function draw() {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    found = items.filter((item) => words.every((word) => item.label.toLowerCase().includes(word)));
    at = Math.min(at, Math.max(0, found.length - 1));
    list.replaceChildren(
      ...found.map((item, i) => {
        const option = el('div', { class: 'fd-find-option', role: 'option', id: `${id}-${i}`, 'aria-selected': String(i === at) }, el('span', { class: 'fd-find-label' }, item.label), ...(item.hint ? [el('span', { class: 'fd-find-hint' }, item.hint)] : []));
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
    // Closed first: what it runs may put the cursor somewhere else.
    close(false);
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
export function settingItems<T extends SettingEntry>(entries: readonly T[], open: (entry: T, choice?: string) => void, kind = 'setting'): FindItem[] {
  return entries.flatMap((entry) => {
    const hint = `${kind} · ${entry.tab}`;
    const groups = new Set(entry.choices.map((c) => c.group));
    return [
      { label: entry.name, hint, run: () => open(entry) },
      ...entry.choices.map((choice) => ({
        label: `${groups.size > 1 && choice.group ? choice.group : entry.name}: ${choice.words.toLowerCase()}`,
        hint,
        run: () => open(entry, choice.value),
      })),
    ];
  });
}
