import type { FieldNode, FormState, LayoutNode, Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';

/**
 * Under the page being tried, a drawer with what the form holds as it is
 * filled: the answers as JSON, and the problems they have now — each by its
 * question, a click going to it — with the warnings beside them. What a
 * person tries stays in Try it; the drawer only shows it.
 */

type Tab = 'data' | 'problems';

/** Which tab is open and whether the drawer is folded, kept while the same Try it draws the page again. */
const kept = new WeakMap<HTMLElement, { tab: Tab; folded: boolean }>();

/** The step a field is asked on, for a survey of several pages. */
function stepOf(page: Page, field: string): string | null {
  if (page.layout.type !== 'wizard') return null;
  const holds = (nodes: LayoutNode[]): boolean =>
    nodes.some((node) => (node.type === 'field' && node.field === field) || ('children' in node && holds(node.children as LayoutNode[])));
  return page.layout.children.find((step) => holds(step.children))?.id ?? null;
}

/** The fields the page shows, each once, in the order it shows them. */
function shownFields(page: Page): string[] {
  const names: string[] = [];
  const walk = (value: unknown) => {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    const node = value as Partial<FieldNode>;
    if (node.type === 'field' && typeof node.field === 'string' && !names.includes(node.field)) names.push(node.field);
    Object.values(value).forEach(walk);
  };
  walk(page.layout);
  return names;
}

export function tryDrawer(el: ElementFactory, frame: HTMLElement, viewer: ViewerHandle): HTMLElement | null {
  const doc = frame.ownerDocument;
  const form = viewer.form;
  const page = form.page;
  const mine = kept.get(frame) ?? { tab: 'data', folded: false };
  kept.set(frame, mine);
  frame.parentElement?.querySelector(':scope > .fd-try-drawer')?.remove();
  // A list holds no answers of its own to show.
  if (page.layout.type === 'list') return null;

  const id = `${frame.id || 'fd-try'}-drawer`;
  const tab = (name: Tab, words: string) =>
    el('button', { type: 'button', class: 'fd-try-tab', role: 'tab', id: `${id}-${name}`, 'aria-controls': `${id}-${name}-panel` }, words);
  const tabs: Record<Tab, HTMLButtonElement> = { data: tab('data', 'Data'), problems: tab('problems', 'Problems') };
  const count = el('span', { class: 'fd-try-count' });
  tabs.problems.append(count);
  const said = el('span', { class: 'fd-try-said', role: 'status' });
  const copy = el('button', { type: 'button', class: 'fd-button fd-button-link fd-try-copy' }, 'Copy data');
  const fold = el('button', { type: 'button', class: 'fd-button fd-button-link fd-try-fold', 'aria-controls': `${id}-panels` });
  const data = el('pre', { class: 'fd-try-data', tabindex: '0', 'aria-label': 'The answers as JSON' });
  const list = el('ul', { class: 'fd-try-problems' });
  const none = el('p', { class: 'fd-try-none' }, 'Nothing stands in the way of sending this.');
  const panels: Record<Tab, HTMLElement> = {
    data: el('div', { class: 'fd-try-panel', role: 'tabpanel', id: `${id}-data-panel`, 'aria-labelledby': `${id}-data` }, data),
    problems: el('div', { class: 'fd-try-panel', role: 'tabpanel', id: `${id}-problems-panel`, 'aria-labelledby': `${id}-problems` }, list, none),
  };
  const drawer = el(
    'section',
    { class: 'fd-try-drawer', 'aria-label': 'Data and problems' },
    el('div', { class: 'fd-try-drawer-bar' }, el('div', { class: 'fd-try-tabs', role: 'tablist', 'aria-label': 'Data and problems' }, tabs.data, tabs.problems), said, copy, fold),
    el('div', { class: 'fd-try-panels', id: `${id}-panels` }, panels.data, panels.problems)
  );

  function show() {
    for (const name of ['data', 'problems'] as const) {
      tabs[name].setAttribute('aria-selected', String(name === mine.tab));
      tabs[name].tabIndex = name === mine.tab ? 0 : -1;
      panels[name].hidden = name !== mine.tab;
    }
    (drawer.querySelector('.fd-try-panels') as HTMLElement).hidden = mine.folded;
    fold.textContent = mine.folded ? 'Show' : 'Hide';
    fold.setAttribute('aria-expanded', String(!mine.folded));
  }

  /** The question a field is asked by, as the page shows it. */
  const labelOf = (name: string) =>
    viewer.element.querySelector(`.fd-field[data-field="${name}"] .fd-label`)?.firstChild?.textContent?.trim() || page.fields[name]?.label || name;

  /** Put the cursor in a field: on its page first, for a survey of several. */
  function goTo(name: string) {
    const box = () => viewer.element.querySelector<HTMLElement>(`.fd-field[data-field="${name}"]:not([hidden])`);
    const step = stepOf(page, name);
    if ((!box() || box()?.closest('[hidden]')) && step) form.goTo(step);
    box()?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])')?.focus();
  }

  function draw(state: FormState) {
    data.textContent = JSON.stringify(state.values, null, 2);
    const rows: { name: string; message: string; warning: boolean }[] = [];
    for (const name of shownFields(page)) {
      const problem = form.problem(name);
      if (problem) rows.push({ name, message: problem, warning: false });
      const warning = state.warnings[name] ?? (state.warningField === name ? state.warning : null);
      if (warning) rows.push({ name, message: warning, warning: true });
    }
    const problems = rows.filter((row) => !row.warning).length;
    count.textContent = problems ? String(problems) : '';
    count.hidden = !problems;
    none.hidden = rows.length > 0;
    list.replaceChildren(
      ...rows.map((row) => {
        const button = el('button', { type: 'button', class: 'fd-try-problem', 'data-field': row.name, 'data-warning': row.warning ? '' : undefined }, el('strong', {}, labelOf(row.name)), el('span', {}, row.message));
        button.addEventListener('click', () => goTo(row.name));
        return el('li', {}, button);
      })
    );
  }

  for (const name of ['data', 'problems'] as const) {
    tabs[name].addEventListener('click', () => {
      mine.tab = name;
      mine.folded = false;
      show();
    });
  }
  // Arrows move between the two tabs, as a tab list's do.
  drawer.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    event.preventDefault();
    mine.tab = mine.tab === 'data' ? 'problems' : 'data';
    show();
    tabs[mine.tab].focus();
  });
  fold.addEventListener('click', () => {
    mine.folded = !mine.folded;
    show();
  });
  copy.addEventListener('click', async () => {
    try {
      await (doc.defaultView?.navigator as Navigator).clipboard.writeText(data.textContent ?? '');
      said.textContent = 'Copied.';
    } catch {
      // No clipboard to write to: the data selected, for the person to copy.
      mine.tab = 'data';
      mine.folded = false;
      show();
      doc.getSelection()?.selectAllChildren(data);
      said.textContent = 'Selected: copy it with the keyboard.';
    }
  });

  show();
  draw(form.getState());
  form.subscribe((state) => {
    said.textContent = '';
    draw(state);
  });
  frame.after(drawer);
  return drawer;
}
