import type { Page } from '@fieldia/core';
import { branchMap, drawBranchMap } from './branch-map';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { openRules } from './rules-open';
import { pageRules, type RuleEntry, type RuleKind } from './rules-words';

/**
 * Every rule on the page in one place, in place of the editor, beside
 * Design, Try it and Translations: each rule a sentence, grouped by what it
 * does — where answers lead (a survey's pages shown only for some answers),
 * when parts show, when fields are required or read-only, values worked out
 * and set, and the rules answers keep. Words typed filter it; a rule clicked
 * goes back to designing with its part picked and its rules open.
 */

export interface RulesOverviewOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** The editor: the view goes at its end. */
  root: HTMLElement;
  /** What the editor shows when designing: hidden while the view shows. */
  body: HTMLElement;
  /** Design, Try it and the other views: Rules goes beside them. */
  modes: HTMLElement;
}

export interface RulesOverview {
  element: HTMLElement;
  readonly open: boolean;
  /** For Find anything: open it, and each rule by its words. */
  items(): FindItem[];
  destroy(): void;
}

type GroupKey = 'branches' | RuleKind;

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'branches', title: 'Where answers lead' },
  { key: 'shows', title: 'Shows when' },
  { key: 'required', title: 'Required when' },
  { key: 'readonly', title: 'Read-only when' },
  { key: 'compute', title: 'Worked out from' },
  { key: 'set', title: 'Set when' },
  { key: 'answer', title: 'Answer rules' },
];

/** The group a rule is listed under: a survey's page shown only sometimes is where answers lead. */
function groupOf(page: Page, rule: RuleEntry): GroupKey {
  if (rule.kind === 'shows' && page.layout.type === 'wizard' && page.layout.children.some((step) => step.id === rule.part)) return 'branches';
  return rule.kind;
}

let views = 0;

export function rulesOverview(options: RulesOverviewOptions): RulesOverview {
  const { el, doc, designer, root, body, modes } = options;
  const id = `fd-rules-${++views}`;
  const toggle = el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': 'rules', 'aria-pressed': 'false' }, designerIcon(doc, 'rules'), 'Rules');
  modes.append(toggle);

  const note = el('p', { class: 'fd-rules-note' });
  const filter = el('input', { type: 'search', class: 'fd-input fd-rules-filter-box', 'aria-label': 'Filter the rules', placeholder: 'Filter by words: a field, a value…', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const bar = el(
    'div',
    { class: 'fd-rules-bar' },
    el('div', { class: 'fd-rules-heading' }, el('h2', { class: 'fd-rules-title' }, 'Rules'), note),
    el('label', { class: 'fd-rules-filter' }, el('span', { class: 'fd-rules-filter-icon', 'aria-hidden': 'true' }, designerIcon(doc, 'search')), filter)
  );
  const groups = el('div', { class: 'fd-rules-groups' });
  const empty = el('p', { class: 'fd-rules-empty', hidden: '' });
  const element = el('section', { class: 'fd-rules-view', 'aria-label': 'Rules', hidden: '' }, bar, groups, empty);
  root.append(element);

  let open = false;
  const otherViewOpen = () => !!root.querySelector('.fd-try:not([hidden]), .fd-words:not([hidden])');
  const modeButton = (name: string) => modes.querySelector<HTMLButtonElement>(`[data-mode="${name}"]`);

  function show(next: boolean) {
    // From Try it: back to designing first, then here.
    if (next && root.querySelector('.fd-try:not([hidden])')) modeButton('design')?.click();
    open = next;
    element.hidden = !open;
    body.hidden = open || otherViewOpen();
    toggle.setAttribute('aria-pressed', String(open));
    if (open) modeButton('design')?.setAttribute('aria-pressed', 'false');
    else if (!otherViewOpen()) modeButton('design')?.setAttribute('aria-pressed', 'true');
    if (!open) return;
    // Nothing on the page is picked here: keys meant for a picked part must not reach it.
    designer.select(null);
    render();
  }
  // On the bar, after the other views: one that was open closes first, then this opens.
  const onMode = (event: Event) => {
    const button = (event.target as Element).closest('[data-mode]');
    if (button === toggle) show(true);
    else if (open && button) show(false);
  };
  modes.addEventListener('click', onMode);

  /** Back to designing, the rule's part picked and its rules open. */
  function go(rule: RuleEntry) {
    if (!rule.part) return;
    show(false);
    openRules(root, designer, { part: rule.part, kind: rule.kind, index: rule.index });
  }

  function itemOf(rule: RuleEntry): HTMLElement {
    const button = el('button', { type: 'button', class: 'fd-rules-item' }, el('span', { class: 'fd-rules-item-name', dir: 'auto' }, rule.name), el('span', { class: 'fd-rules-item-say', dir: 'auto' }, rule.sentence));
    if (!rule.part) button.setAttribute('aria-disabled', 'true');
    button.addEventListener('click', () => go(rule));
    return el('li', {}, button);
  }

  function render() {
    const page = designer.getPage();
    const rules = pageRules(page);
    // English words keep their order in a page right to left, on the page's side.
    note.replaceChildren(el('span', { dir: 'ltr' }, rules.length === 1 ? '1 rule on this page.' : `${rules.length} rules on this page.`));
    const words = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
    const titleOf = new Map(GROUPS.map((g) => [g.key, g.title]));
    const kept = rules.filter((rule) => {
      const text = `${rule.name} ${rule.sentence} ${titleOf.get(groupOf(page, rule))}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
    groups.replaceChildren(
      ...GROUPS.flatMap(({ key, title }) => {
        const own = kept.filter((rule) => groupOf(page, rule) === key);
        if (!own.length) return [];
        const titleId = `${id}-${key}`;
        const map = key === 'branches' && !words.length ? branches(page) : null;
        return [el('section', { class: 'fd-rules-group', 'aria-labelledby': titleId }, el('h3', { class: 'fd-rules-group-title', id: titleId }, title), ...(map ? [map] : []), el('ul', { class: 'fd-rules-list' }, ...own.map(itemOf)))];
      })
    );
    empty.hidden = kept.length > 0;
    empty.textContent = rules.length ? `No rule says “${filter.value.trim()}”.` : 'No rules yet: pick a field and open Rules.';
  }

  /** A survey's pages and where answers lead, as the map above the pages draws it. */
  function branches(page: Page): HTMLElement | null {
    const drawn = branchMap(page);
    if (drawn.nodes.length < 2) return null;
    return el('div', { class: 'fd-branch-scroll fd-rules-branches' }, drawBranchMap(doc, drawn, null, (part) => go({ kind: 'shows', part, name: '', sentence: '', reads: [] })));
  }

  filter.addEventListener('input', render);
  // Up and down the list with the arrows, from the box too; Escape empties the box, then goes back to designing.
  element.addEventListener('keydown', (event) => {
    const items = [...groups.querySelectorAll<HTMLElement>('.fd-rules-item')];
    const at = items.indexOf(doc.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!items.length || (at === -1 && doc.activeElement !== filter)) return;
      event.preventDefault();
      const next = at === -1 ? 0 : Math.max(0, Math.min(items.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)));
      if (at === 0 && event.key === 'ArrowUp') filter.focus();
      else items[next].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (filter.value) {
        filter.value = '';
        render();
        filter.focus();
      } else {
        show(false);
        toggle.focus();
      }
    }
  });

  const leave = designer.subscribe((state) => {
    if (!open) return;
    // Something picked on the page: back to the editor, where it is.
    if (state.selected !== null) return show(false);
    render();
  });

  return {
    element,
    get open() {
      return open;
    },
    items() {
      const page = designer.getPage();
      const titleOf = new Map(GROUPS.map((g) => [g.key, g.title]));
      const each = pageRules(page)
        .filter((rule) => rule.part)
        .map((rule) => ({ label: `Rule: ${rule.name} — ${rule.sentence}`, hint: titleOf.get(groupOf(page, rule)) ?? 'Rules', run: () => go(rule) }));
      if (!open) return [{ label: 'Rules', hint: 'every rule on the page, in words', icon: 'rules', run: () => show(true) }, ...each];
      return [{ label: 'Back to designing', hint: 'Design', run: () => show(false) }, { label: 'Filter the rules', hint: 'Rules', run: () => filter.focus() }, ...each];
    },
    destroy() {
      leave();
      modes.removeEventListener('click', onMode);
      toggle.remove();
      element.remove();
    },
  };
}
