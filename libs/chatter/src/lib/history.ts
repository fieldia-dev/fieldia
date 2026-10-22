import { fill, labelAt, recordSentence, type Locale, type PageRecords } from '@fieldia/core';
import { drawIcon, installStyles, sanitizeHtml, showHtml, type IconSet } from '@fieldia/widgets';
import { initials } from './chatter';
import { installHistoryStyles } from './history-styles';
import { chatterLabels, type ChatterLabels } from './labels';
import { ageOf, empty, firstDayOfWeek, HISTORY_AGES, historyEntries, type HistoryAge, type HistoryEntry } from './history-data';
import type { ChatterSource, Person, RecordRef } from './source';

export { HISTORY_STYLES, installHistoryStyles } from './history-styles';
export * from './history-data';

/**
 * A record's history, as a work item's History tab shows it: the State
 * Graph, how its state moved and why; then each change, grouped by age, the
 * one chosen beside the list with its new values and those they replaced.
 * It reads the chatter source's messages: events with `tracking` are field
 * changes, messages are comments. It asks nothing more of the source.
 */
export interface HistoryOptions {
  source: ChatterSource;
  /** The selection field whose changes the State Graph shows. Without it there is no State Graph. */
  stateField?: string;
  /** The field whose new value names each move in the State Graph ("Approved"). */
  reasonField?: string;
  /** What the record is called where its making is told, in the reader's language: "work item" ("created the work item"). The words' own `recordKind` unless said. */
  kind?: string;
  /** What the page calls its records (`Page.records`): its making told in them — "created the customer" — where `kind` is not given. */
  records?: PageRecords;
  /** A field's label small inside the history's sentences — "changed status to …" — as the page asks (`Page.lowerLabels`). */
  lowerLabels?: boolean;
  locale?: Locale;
  labels?: Partial<ChatterLabels>;
  dir?: 'ltr' | 'rtl';
  /** The app's own icons, by name, as the viewer takes them. */
  icons?: IconSet;
  /** The clock the groups by age are counted from; the real one unless a test pins it. */
  now?: () => Date;
}

export interface MountHistoryOptions extends HistoryOptions {
  /** The record whose history it shows; null for one not saved yet. */
  record: RecordRef | null;
  /** A state's colour by its words, as its dot draws it (see `stateColours`); a neutral grey unless given. */
  stateColour?: (words: string) => string | null;
}

export interface HistoryHandle {
  readonly element: HTMLElement;
  /** Fetch the history again. */
  refresh(): Promise<void>;
  /** Show another record's, or none while one is not saved. */
  setRecord(record: RecordRef | null): Promise<void>;
  destroy(): void;
}

/** The scrolling box round an element, which its list fills to the foot of; null for the window. */
function scrollerOf(element: HTMLElement): HTMLElement | null {
  const view = element.ownerDocument.defaultView;
  for (let at = element.parentElement; at && at !== element.ownerDocument.body; at = at.parentElement) {
    if (/(auto|scroll|overlay)/.test(view?.getComputedStyle(at).overflowY ?? '')) return at;
  }
  return null;
}

/**
 * A record's history in an element of the app's: the State Graph, then the
 * changes grouped by age, the chosen one's before and after beside them.
 * Plain DOM, worked by keyboard as by pointer: the list is a listbox per
 * group, ↑ and ↓ moving through the groups' headings and rows, the change
 * shown following the row chosen.
 */
export function mountHistory(host: HTMLElement, options: MountHistoryOptions): HistoryHandle {
  const doc = host.ownerDocument;
  installStyles(doc);
  installHistoryStyles(doc);
  const locale = options.locale ?? 'en';
  const labels: ChatterLabels = chatterLabels(locale, options.labels);
  const now = options.now ?? (() => new Date());
  const firstDay = firstDayOfWeek(locale);
  const tag = locale === 'ar' ? 'ar-EG-u-nu-latn' : locale;
  const listDate = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'numeric', day: 'numeric' });
  const graphDate = new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric' });
  const whole = new Intl.DateTimeFormat(tag, { weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  // The day, the date and the time in the language's own forms, set apart by spaces where it puts commas: "Wed 7/22/2026 12:59 PM".
  const fullDate = (at: Date) =>
    whole
      .formatToParts(at)
      .map((part) => (part.type === 'literal' && /^[,،]\s*$/.test(part.value) ? ' ' : part.value))
      .join('');
  const colourOf = (words: string) => options.stateColour?.(words) ?? null;
  const uid = `fd-history-${Math.random().toString(36).slice(2, 8)}`;
  let record = options.record;
  let destroyed = false;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }
  const icon = (name: string) => drawIcon(doc, name, options.icons) ?? doc.createTextNode('');
  function avatar(person: Person | null, size: 16 | 32 | 40): HTMLElement {
    if (person?.avatar) return el('img', { class: 'fd-history-avatar', 'data-size': String(size), src: person.avatar, alt: '' });
    return el('span', { class: 'fd-history-avatar', 'data-size': String(size), 'aria-hidden': 'true' }, initials(person?.name ?? '?'));
  }
  function dot(words: string): HTMLElement {
    const made = el('span', { class: 'fd-history-dot', 'aria-hidden': 'true' });
    const colour = colourOf(words);
    if (colour) made.style.background = colour;
    return made;
  }
  /** A state's words with its dot before them. */
  const stateWords = (words: string) => el('span', { class: 'fd-history-state-words' }, dot(words), words);
  /** A template's words with its `{parts}` put in, as text or as nodes. */
  function words(template: string, parts: Record<string, Node | string>): Node[] {
    const made: Node[] = [];
    let last = 0;
    for (const found of template.matchAll(/\{(\w+)\}/g)) {
      made.push(doc.createTextNode(template.slice(last, found.index)));
      const part = parts[found[1]];
      // Each part set apart, so a name, a field or a value in another script keeps its place in the sentence.
      made.push(part === undefined ? doc.createTextNode(found[0]) : el('bdi', {}, part));
      last = (found.index ?? 0) + found[0].length;
    }
    made.push(doc.createTextNode(template.slice(last)));
    return made;
  }
  /** A field's label as `template` puts it: small inside the sentence where the page asks (`lowerLabels`). */
  const fieldIn = (template: string, label: string) => labelAt(template, 'field', options.lowerLabels, locale)(label);
  /** What a line of the history says it did, its state's words with their dots. */
  function summary(entry: HistoryEntry): Node[] {
    const name = entry.message.author?.name ?? '';
    if (entry.kind === 'created') return words(options.kind === undefined ? recordSentence(options.records, labels.createdNoun, labels.created, locale) : labels.created, { name, kind: options.kind ?? labels.recordKind });
    if (entry.kind === 'comment') return words(labels.commented, { name });
    const { state, changes } = entry;
    if (state && !empty(state.from) && !empty(state.to)) {
      const template = changes.length > 1 ? labels.changedFromToMore : labels.changedFromTo;
      return words(template, { name, field: fieldIn(template, state.label), from: stateWords(state.from as string), to: stateWords(state.to as string) });
    }
    if (changes.length > 1) return words(labels.madeChanges, { name });
    const [change] = changes;
    if (empty(change.to)) return words(labels.cleared, { name, field: fieldIn(labels.cleared, change.label) });
    return words(labels.changedTo, { name, field: fieldIn(labels.changedTo, change.label), value: change.field === options.stateField ? stateWords(change.to as string) : (change.to as string) });
  }

  // ---- the parts ------------------------------------------------------------------

  const root = el('div', { class: 'fd-theme fd-history', dir: options.dir, lang: locale });
  const tool = (name: string, iconName: string, label: string) =>
    el('button', { type: 'button', class: 'fd-history-tool', 'data-tool': name, 'aria-label': label, title: label }, icon(iconName));

  // The State Graph, its heading with its own maximise and fold.
  const graph = el('ol', { class: 'fd-history-graph', id: `${uid}-graph`, 'aria-label': labels.stateGraph });
  const maximise = tool('maximise', 'maximise', fill(labels.maximiseNamed, { name: labels.stateGraph }));
  maximise.setAttribute('aria-pressed', 'false');
  const fold = tool('fold', 'chevron-up', fill(labels.foldNamed, { name: labels.stateGraph }));
  fold.setAttribute('aria-expanded', 'true');
  fold.setAttribute('aria-controls', graph.id);
  const states = el(
    'section',
    { class: 'fd-history-states', 'aria-labelledby': `${uid}-states` },
    el('div', { class: 'fd-history-head' }, el('h3', { class: 'fd-history-title', id: `${uid}-states` }, labels.stateGraph), maximise, fold),
    graph
  );
  states.hidden = true;

  // The list's heading, with the filter at its end.
  const filter = tool('filter', 'filter-lines', labels.filterHistory);
  filter.setAttribute('aria-haspopup', 'menu');
  filter.setAttribute('aria-expanded', 'false');
  filter.setAttribute('aria-controls', `${uid}-menu`);
  const shown = { change: true, comment: true };
  const menuItem = (key: keyof typeof shown, label: string) =>
    el('div', { role: 'menuitemcheckbox', class: 'fd-history-menu-item', tabindex: '-1', 'aria-checked': 'true', 'data-show': key }, icon('check'), label);
  const menuItems = [menuItem('change', labels.fieldChanges), menuItem('comment', labels.comments)];
  const menu = el('div', { role: 'menu', class: 'fd-history-menu', id: `${uid}-menu`, 'aria-label': labels.filterHistory, hidden: '' }, ...menuItems);
  const listHead = el('div', { class: 'fd-history-head' }, el('h3', { class: 'fd-history-title', id: `${uid}-changes` }, labels.history), filter, menu);
  const list = el('div', { class: 'fd-history-list' });
  const detail = el('section', { class: 'fd-history-detail' });
  const changes = el(
    'section',
    { class: 'fd-history-changes', 'aria-labelledby': `${uid}-changes` },
    el('div', { class: 'fd-history-head-row' }, listHead),
    el('div', { class: 'fd-history-panes' }, list, detail)
  );
  root.append(states, changes);
  host.append(root);

  // ---- the State Graph --------------------------------------------------------------

  function drawGraph(entries: HistoryEntry[]) {
    const moves = entries.filter((entry) => entry.kind !== 'comment' && entry.state && !empty(entry.state.to)).reverse();
    states.hidden = !options.stateField || moves.length === 0;
    const chip = (words: string) => el('span', { class: 'fd-history-state' }, dot(words), words);
    const items: HTMLElement[] = [];
    // A history that starts mid-way starts from the state the first move left.
    const start = moves[0]?.state?.from;
    if (!empty(start)) items.push(el('li', { class: 'fd-history-step' }, chip(start as string)));
    for (const move of moves) {
      const who = move.message.author;
      items.push(
        el(
          'li',
          { class: 'fd-history-step' },
          el(
            'span',
            { class: 'fd-history-move' },
            el('span', { class: 'fd-history-reason' }, move.reason?.to ?? ''),
            el('span', { class: 'fd-history-arrow', 'aria-hidden': 'true' }),
            el('span', { class: 'fd-history-who' }, avatar(who, 16), who?.name ?? ''),
            el('time', { class: 'fd-history-when', datetime: move.message.date }, graphDate.format(move.at))
          ),
          chip(move.state?.to as string)
        )
      );
    }
    graph.replaceChildren(...items);
  }

  fold.addEventListener('click', () => {
    const open = graph.hidden;
    graph.hidden = !open;
    fold.setAttribute('aria-expanded', String(open));
    const label = fill(open ? labels.foldNamed : labels.unfoldNamed, { name: labels.stateGraph });
    fold.setAttribute('aria-label', label);
    fold.title = label;
    fold.replaceChildren(icon(open ? 'chevron-up' : 'chevron-down'));
    fit();
  });
  function setMaximised(on: boolean) {
    states.toggleAttribute('data-maximised', on);
    maximise.setAttribute('aria-pressed', String(on));
    const label = fill(on ? labels.restoreNamed : labels.maximiseNamed, { name: labels.stateGraph });
    maximise.setAttribute('aria-label', label);
    maximise.title = label;
    maximise.replaceChildren(icon(on ? 'restore' : 'maximise'));
    maximise.focus();
  }
  maximise.addEventListener('click', () => setMaximised(!states.hasAttribute('data-maximised')));
  states.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !states.hasAttribute('data-maximised')) return;
    event.preventDefault();
    event.stopPropagation();
    setMaximised(false);
  });

  // ---- the list by age, and the change chosen ---------------------------------------

  let entries: HistoryEntry[] = [];
  let chosen: string | null = null;
  const folded = new Set<HistoryAge>();
  const visible = () => entries.filter((entry) => (entry.kind === 'comment' ? shown.comment : shown.change));

  function drawList() {
    const hadFocus = list.contains(doc.activeElement);
    const focused = (doc.activeElement as HTMLElement | null)?.dataset?.['key'] ?? null;
    const showing = visible();
    if (!showing.some((entry) => entry.key === chosen)) chosen = showing[0]?.key ?? null;
    const today = now();
    const groups = new Map<HistoryAge, HistoryEntry[]>();
    for (const entry of showing) {
      const age = ageOf(entry.at, today, firstDay);
      groups.set(age, [...(groups.get(age) ?? []), entry]);
    }
    const parts: HTMLElement[] = [];
    for (const age of HISTORY_AGES) {
      const lines = groups.get(age);
      if (!lines) continue;
      const open = !folded.has(age);
      const box = el('div', { role: 'listbox', id: `${uid}-${age}`, 'aria-label': labels[age] });
      box.hidden = !open;
      for (const entry of lines) {
        const state = entry.state && !empty(entry.state.to) ? (entry.state.to as string) : null;
        const row = el(
          'div',
          { role: 'option', class: 'fd-history-row', 'data-key': entry.key, 'aria-selected': String(entry.key === chosen), tabindex: '-1' },
          avatar(entry.message.author, 32),
          el(
            'div',
            { class: 'fd-history-words' },
            el('span', { class: 'fd-history-summary' }, ...summary(entry)),
            el('time', { class: 'fd-history-when', datetime: entry.message.date }, listDate.format(entry.at))
          )
        );
        if (state) {
          // The state it came to, at the row's end.
          const end = dot(state);
          end.classList.add('fd-history-end-dot');
          row.setAttribute('data-state', '');
          row.append(end);
        }
        box.append(row);
      }
      const head = el(
        'button',
        { type: 'button', class: 'fd-history-group-head', 'data-key': `group-${age}`, 'data-age': age, 'aria-expanded': String(open), 'aria-controls': box.id },
        icon(open ? 'chevron-down' : 'chevron-right'),
        labels[age]
      );
      parts.push(el('div', { class: 'fd-history-group', 'data-age': age }, head, box));
    }
    if (!showing.length) parts.push(el('p', { class: 'fd-history-none' }, labels.noHistory));
    list.replaceChildren(...parts);
    // One stop in the Tab order among the rows: the chosen one if it shows, else the first that does.
    const rows = shownRows();
    (rows.find((row) => row.dataset['key'] === chosen) ?? rows[0])?.setAttribute('tabindex', '0');
    // The focus back where it was, on the same row or heading, drawn anew.
    const again = [...list.querySelectorAll<HTMLElement>('[data-key]')].find((part) => part.dataset['key'] === focused);
    if (hadFocus) (again ?? rows[0] ?? list.querySelector<HTMLElement>('.fd-history-group-head'))?.focus();
    drawDetail();
  }

  const shownRows = () => [...list.querySelectorAll<HTMLElement>('[role=listbox]:not([hidden]) > [role=option]')];
  const stops = () => [...list.querySelectorAll<HTMLElement>('.fd-history-group-head, [role=listbox]:not([hidden]) > [role=option]')];

  function choose(key: string) {
    if (key === chosen) return;
    chosen = key;
    for (const row of list.querySelectorAll<HTMLElement>('[role=option]')) {
      const picked = row.dataset['key'] === key;
      row.setAttribute('aria-selected', String(picked));
      row.setAttribute('tabindex', picked ? '0' : '-1');
    }
    drawDetail();
  }

  function chip(value: string, field: string, kind: 'new' | 'old'): HTMLElement {
    const words = field === options.stateField ? [dot(value), value] : [value];
    if (kind === 'new') return el('span', { class: 'fd-history-chip fd-history-new' }, ...words);
    // Struck through on screen; said as what it was.
    return el(
      'span',
      { class: 'fd-history-chip fd-history-old' },
      el('span', { class: 'fd-sr-only' }, fill(labels.wasValue, { value })),
      el('s', { 'aria-hidden': 'true' }, ...words)
    );
  }

  function drawDetail() {
    const entry = entries.find((e) => e.key === chosen && visible().includes(e));
    if (!entry) {
      detail.replaceChildren();
      detail.removeAttribute('aria-labelledby');
      return;
    }
    const who = entry.message.author;
    const head = el(
      'header',
      { class: 'fd-history-detail-head' },
      avatar(who, 40),
      el('div', {}, el('span', { class: 'fd-history-detail-name' }, who?.name ?? ''), el('span', { id: `${uid}-said` }, ...summary(entry))),
      el('time', { class: 'fd-history-when', datetime: entry.message.date }, fullDate(entry.at))
    );
    detail.setAttribute('aria-labelledby', `${uid}-said`);
    if (entry.kind === 'comment') {
      const body = el('div', { class: 'fd-history-comment' });
      showHtml(body, sanitizeHtml(entry.message.body, doc));
      detail.replaceChildren(head, body);
      return;
    }
    const fields = el(
      'dl',
      { class: 'fd-history-fields' },
      ...entry.changes.map((change) =>
        el(
          'div',
          { class: 'fd-history-field', 'data-field': change.field },
          el('dt', {}, change.label),
          el('dd', {}, ...(empty(change.to) ? [] : [chip(change.to as string, change.field, 'new')]), ...(empty(change.from) ? [] : [chip(change.from as string, change.field, 'old')]))
        )
      )
    );
    detail.replaceChildren(head, fields);
  }

  list.addEventListener('click', (event) => {
    const target = event.target as Element;
    const head = target.closest<HTMLElement>('.fd-history-group-head');
    if (head) {
      const age = head.dataset['age'] as HistoryAge;
      if (folded.has(age)) folded.delete(age);
      else folded.add(age);
      drawList();
      fit();
      return;
    }
    const row = target.closest<HTMLElement>('[role=option]');
    if (row) {
      choose(row.dataset['key'] as string);
      row.focus();
    }
  });
  list.addEventListener('focusin', (event) => {
    const row = (event.target as Element).closest<HTMLElement>('[role=option]');
    if (row) choose(row.dataset['key'] as string);
  });
  list.addEventListener('keydown', (event) => {
    const all = stops();
    const at = all.indexOf(doc.activeElement as HTMLElement);
    const rows = shownRows();
    const rtl = getComputedStyle(root).direction === 'rtl';
    const onHead = (doc.activeElement as HTMLElement | null)?.classList.contains('fd-history-group-head');
    let to: HTMLElement | undefined;
    if (event.key === 'ArrowDown') to = all[Math.min(at + 1, all.length - 1)];
    else if (event.key === 'ArrowUp') to = all[Math.max(at - 1, 0)];
    else if (event.key === 'Home') to = rows[0];
    else if (event.key === 'End') to = rows[rows.length - 1];
    else if (onHead && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      // Unfold toward the reading direction, fold back against it.
      const age = (doc.activeElement as HTMLElement).dataset['age'] as HistoryAge;
      const opening = (event.key === 'ArrowRight') !== rtl;
      if (opening === folded.has(age)) (doc.activeElement as HTMLElement).click();
      event.preventDefault();
      return;
    } else return;
    event.preventDefault();
    to?.focus();
    to?.scrollIntoView?.({ block: 'nearest' });
  });

  // ---- the filter ----------------------------------------------------------------

  function openMenu() {
    menu.hidden = false;
    filter.setAttribute('aria-expanded', 'true');
    menuItems[0].focus();
    doc.addEventListener('pointerdown', outside, true);
  }
  function closeMenu(focusBack: boolean) {
    if (menu.hidden) return;
    menu.hidden = true;
    filter.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', outside, true);
    if (focusBack) filter.focus();
  }
  const outside = (event: Event) => {
    if (!menu.contains(event.target as Node) && !filter.contains(event.target as Node)) closeMenu(false);
  };
  function toggle(item: HTMLElement) {
    const key = item.dataset['show'] as keyof typeof shown;
    shown[key] = !shown[key];
    item.setAttribute('aria-checked', String(shown[key]));
    drawList();
  }
  filter.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
  filter.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    openMenu();
    if (event.key === 'ArrowUp') menuItems[menuItems.length - 1].focus();
  });
  menu.addEventListener('click', (event) => {
    const item = (event.target as Element).closest<HTMLElement>('[role=menuitemcheckbox]');
    if (item) toggle(item);
  });
  menu.addEventListener('keydown', (event) => {
    const at = menuItems.indexOf(doc.activeElement as HTMLDivElement);
    const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: menuItems.length - 1 } as Record<string, number>)[event.key];
    if (to !== undefined) {
      event.preventDefault();
      menuItems[(to + menuItems.length) % menuItems.length].focus();
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (at >= 0) toggle(menuItems[at]);
      if (event.key === 'Enter') closeMenu(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Only the menu closes: not a dialog the history is in.
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === 'Tab') closeMenu(false);
  });

  // ---- filling the window or dialog to its foot -------------------------------------

  let scroller: HTMLElement | null | undefined;
  let frame = 0;
  function fit() {
    const panes = changes.querySelector<HTMLElement>('.fd-history-panes');
    const view = doc.defaultView;
    if (!panes || !view || !root.isConnected) return;
    const box = panes.getBoundingClientRect();
    if (!box.width) return;
    if (scroller === undefined) {
      scroller = scrollerOf(root);
      if (scroller) watcher?.observe(scroller);
    }
    const outer = scroller ? scroller.getBoundingClientRect().top : 0;
    const scrolled = scroller ? scroller.scrollTop : view.scrollY;
    const height = scroller ? scroller.clientHeight : doc.documentElement.clientHeight;
    root.style.setProperty('--fd-history-room', `${Math.round(height - (box.top - outer + scrolled))}px`);
    root.setAttribute('data-fit', '');
  }
  // Shown again — its tab chosen, its dialog grown — it fits again; shown after hiding, it fetches what changed meanwhile.
  let wasShown = false;
  const watcher =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          const showing = root.getBoundingClientRect().width > 0;
          if (showing && !wasShown && entries.length) void load();
          wasShown = showing;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(fit);
        });
  watcher?.observe(root);
  const onResize = () => fit();
  doc.defaultView?.addEventListener('resize', onResize);

  // ---- loading -----------------------------------------------------------------

  async function load() {
    const current = record;
    if (!current) {
      entries = [];
      drawGraph(entries);
      drawList();
      return;
    }
    const messages = await options.source.messages(current);
    if (destroyed || record !== current) return; // another record, or gone, meanwhile
    entries = historyEntries(messages, options.stateField, options.reasonField);
    drawGraph(entries);
    drawList();
    fit();
  }
  void load();

  return {
    element: root,
    refresh: load,
    async setRecord(next) {
      record = next;
      chosen = null;
      await load();
    },
    destroy() {
      destroyed = true;
      watcher?.disconnect();
      cancelAnimationFrame(frame);
      doc.defaultView?.removeEventListener('resize', onResize);
      closeMenu(false);
      root.remove();
    },
  };
}
