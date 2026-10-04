import type { ElementFactory } from './chrome';
import { designerIcon } from './icons';
import type { InspectorShell, SettingRow } from './panel-inspector';
import { TAB_NAMES, type PanelTab } from './panel-tabs';

/**
 * Searching the panel's settings by name, across all its tabs: what is found
 * is listed by tab, the best first, and Enter or a click goes to it — its tab
 * chosen, its control focused. A setting is found by its name, or by the
 * words of one of its choices ("beside" finds Labels).
 */

export interface Rankable {
  name: string;
  /** Its place in the panel: of two that match as well, the earlier comes first. */
  order: number;
  /** The words of its choices, which find it too. */
  words: string;
}

/** How well a name matches: itself, from its start, from a word's start, anywhere; found only by its choices, least. */
function score(name: string, query: string): number {
  const text = name.toLowerCase();
  if (text === query) return 4;
  if (text.startsWith(query)) return 3;
  if (text.split(/[\s-]+/).some((word) => word.startsWith(query))) return 2;
  return text.includes(query) ? 1 : 0;
}

/** The settings with every word typed in their name or their choices, the best first. */
export function rankSettings<T extends Rankable>(rows: readonly T[], typed: string): T[] {
  const query = typed.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!query) return [];
  const words = query.split(' ');
  return rows
    .filter((row) => {
      const text = `${row.name} ${row.words}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .map((row) => ({ row, score: score(row.name, query) }))
    .sort((a, b) => b.score - a.score || a.row.order - b.row.order)
    .map(({ row }) => row);
}

let made = 0;

export interface SettingSearch {
  element: HTMLElement;
  /** Look again, as what is picked has changed. */
  refresh(): void;
}

export function settingSearch(el: ElementFactory, doc: Document, shell: InspectorShell): SettingSearch {
  const id = `fd-insp-search-${++made}`;
  const box = el('input', {
    type: 'search',
    class: 'fd-input fd-insp-search-box',
    role: 'combobox',
    'aria-label': 'Search settings',
    'aria-expanded': 'false',
    'aria-controls': `${id}-list`,
    'aria-autocomplete': 'list',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Search settings',
  }) as HTMLInputElement;
  const list = el('div', { class: 'fd-insp-found', role: 'listbox', id: `${id}-list`, 'aria-label': 'Settings found', hidden: '' });
  const none = el('p', { class: 'fd-properties-hint fd-insp-none', role: 'status', hidden: '' });
  const element = el('div', { class: 'fd-insp-search' }, el('span', { class: 'fd-insp-search-icon' }, designerIcon(doc, 'search')), box);

  let found: SettingRow[] = [];
  let at = 0;

  function draw() {
    const query = box.value;
    const searching = query.trim() !== '';
    const rows = shell.rows();
    found = searching ? rankSettings(rows.map((row, order) => ({ ...row, order, words: row.choices.map((c) => c.words).join(' ') })), query) : [];
    at = Math.min(at, Math.max(0, found.length - 1));
    shell.setTabsHidden(searching);
    list.hidden = !found.length;
    none.hidden = !searching || found.length > 0;
    none.textContent = `No setting called “${query.trim()}”.`;
    box.setAttribute('aria-expanded', String(found.length > 0));
    // Grouped by tab, the tab of the best first.
    const tabs: PanelTab[] = [];
    for (const row of found) if (!tabs.includes(row.tab)) tabs.push(row.tab);
    list.replaceChildren(
      ...tabs.map((tab) =>
        el(
          'div',
          { class: 'fd-insp-found-group', role: 'group', 'aria-label': TAB_NAMES[tab] },
          el('div', { class: 'fd-insp-found-tab', 'aria-hidden': 'true' }, TAB_NAMES[tab]),
          ...found.flatMap((row, index) => (row.tab === tab ? [option(row, index)] : []))
        )
      )
    );
    if (found.length) box.setAttribute('aria-activedescendant', `${id}-${at}`);
    else box.removeAttribute('aria-activedescendant');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }

  function option(row: SettingRow, index: number): HTMLElement {
    const pressed = row.choices.find((c) => c.button.getAttribute('aria-pressed') === 'true');
    const item = el(
      'div',
      { class: 'fd-insp-found-option', role: 'option', id: `${id}-${index}`, 'aria-selected': String(index === at) },
      el('span', { class: 'fd-insp-found-name' }, row.name),
      ...(pressed ? [el('span', { class: 'fd-insp-found-value' }, pressed.words)] : [])
    );
    // A press keeps the cursor in the box until the click goes to the setting.
    item.addEventListener('pointerdown', (event) => event.preventDefault());
    item.addEventListener('click', () => go(row));
    return item;
  }

  function go(row: SettingRow) {
    box.value = '';
    at = 0;
    draw();
    shell.go(row);
  }

  box.addEventListener('input', () => {
    at = 0;
    draw();
  });
  box.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!found.length) return;
      event.preventDefault();
      at = (at + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
      draw();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (found[at]) go(found[at]);
    } else if (event.key === 'Escape' && box.value) {
      // Escape empties the box first; the editor's own Escape comes after.
      event.preventDefault();
      event.stopPropagation();
      box.value = '';
      at = 0;
      draw();
    }
  });

  shell.top.append(element, list, none);
  return {
    element,
    refresh() {
      if (box.value.trim()) draw();
    },
  };
}
