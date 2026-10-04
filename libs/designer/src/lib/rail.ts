import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import { storedAs } from './kinds';
import { outlineView } from './outline-view';
import type { ToolboxHandle } from './toolbox';

/**
 * The editor's left side, in three tabs: Add — the toolbox; Outline — the
 * page as a tree to pick from and move parts about in (outline-view.ts);
 * and Data — where the page's records live, the model's fields on the page
 * or not, and a made-up record to fill the canvas with.
 */

export interface RailOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  tools: ToolboxHandle;
  /** A survey keeps answers, not records: no model, no made-up record. */
  survey: boolean;
  /** Bring a part picked in the outline into view on the canvas. */
  reveal(id: string): void;
  /** Whether several parts may be picked at once in the outline: always, unless said. */
  several?(): boolean;
  /** Add a field of the model to the page, or as a column. */
  addModelField?(name: string): void;
  /** Fill the canvas with the made-up record at `index`, or with nothing. */
  onSample?(index: number | null): void;
}

export interface Rail {
  element: HTMLElement;
  update(state: DesignerState): void;
  destroy(): void;
}

type Pane = 'add' | 'outline' | 'data';

let count = 0;

export function rail(options: RailOptions): Rail {
  const { el, doc, designer } = options;
  let pane: Pane = 'add';
  let sample: number | null = null;
  // Said aloud, politely: what a move in the outline did. Outside the panes, so it is heard whichever is on show.
  const said = el('div', { class: 'fd-outline-said', role: 'status', 'aria-live': 'polite' });
  const tree = outlineView({ el, doc, designer, survey: options.survey, reveal: options.reveal, several: () => options.several?.() ?? true, say: (words) => (said.textContent = words) });
  const outline = tree.element;
  const data = el('div', { class: 'fd-data', hidden: '' });
  const panes: Record<Pane, HTMLElement> = { add: options.tools.element, outline, data };
  const id = `fd-rail-${++count}`;
  for (const [name, p] of Object.entries(panes)) p.id ||= `${id}-${name}`;
  const tabs = (['add', 'outline', 'data'] as const).map((name) => {
    const button = el('button', { type: 'button', role: 'tab', class: 'fd-rail-tab', 'data-rail': name, 'aria-selected': String(name === pane), 'aria-controls': panes[name].id, tabindex: name === pane ? '0' : '-1' }, { add: 'Add', outline: 'Outline', data: 'Data' }[name]);
    button.addEventListener('click', () => open(name));
    return button;
  });
  function open(name: Pane) {
    pane = name;
    draw(designer.getState());
  }
  // A row of tabs as a keyboard knows one: the tab open takes Tab; the arrows (mirrored right to left), Home and End open another.
  const tablist = el('div', { class: 'fd-rail-tabs', role: 'tablist', 'aria-label': 'Beside the page' }, ...tabs);
  tablist.addEventListener('keydown', (event) => {
    const at = tabs.indexOf(event.target as HTMLButtonElement);
    if (at === -1) return;
    const rtl = doc.defaultView?.getComputedStyle(tablist).direction === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    const to = step !== undefined ? (at + step + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (to === -1) return;
    event.preventDefault();
    open(tabs[to].dataset['rail'] as Pane);
    tabs[to].focus();
  });
  const element = el('aside', { class: 'fd-rail', 'aria-label': 'Add, outline and data' }, tablist, options.tools.element, outline, data, said);
  // The toolbox is its own aside; inside the rail it is a pane.
  options.tools.element.classList.add('fd-rail-pane');

  function drawData(state: DesignerState) {
    const page = state.page;
    if (page.data.kind !== 'record') {
      data.replaceChildren(
        el('div', { class: 'fd-data-card' }, el('span', {}, 'Answers are kept as responses:'), el('b', { class: 'fd-data-model' }, 'one record per person, one field per question')),
        el('p', { class: 'fd-properties-hint' }, 'A survey makes its own fields: each question added is a new one, so every kind is offered.')
      );
      return;
    }
    const unused = designer.modelFields();
    const onPage = Object.entries(page.fields);
    const list = page.layout.type === 'list';
    const row = (name: string, label: string, type: string, used: boolean, stored: string) => {
      const add = !used && options.addModelField ? el('button', { type: 'button', class: 'fd-button fd-button-link' }, list ? 'Add as a column' : 'Add') : null;
      add?.addEventListener('click', () => options.addModelField?.(name));
      return el(
        'div',
        { class: 'fd-data-row', 'data-field': name, title: `${label}: ${stored}` },
        el('span', { class: 'fd-data-label' }, label),
        el('span', { class: `fd-data-used${used ? ' fd-data-on' : ''}` }, used ? 'On the page' : 'Not used'),
        el('code', {}, `${name} · ${type}`),
        ...(add ? [add] : [])
      );
    };
    const samples = list
      ? []
      : [
          el(
            'div',
            { class: 'fd-prop' },
            el('span', { class: 'fd-prop-name' }, 'Record on the canvas'),
            el(
              'div',
              { class: 'fd-seg', role: 'group', 'aria-label': 'Record on the canvas' },
              ...([['none', 'Empty', 'Empty'], ['0', '1', 'Record 1'], ['1', '2', 'Record 2'], ['2', '3', 'Record 3']] as const).map(([key, words, name]) => {
                const button = el('button', { type: 'button', class: 'fd-seg-button', 'data-sample': key, 'aria-label': name, title: name, 'aria-pressed': String((sample === null ? 'none' : String(sample)) === key) }, words);
                button.addEventListener('click', () => {
                  sample = key === 'none' ? null : Number(key);
                  options.onSample?.(sample);
                  drawData(designer.getState());
                });
                return button;
              })
            ),
            el('p', { class: 'fd-properties-hint' }, 'A made-up record fills the page, so it reads as it will with real ones. Nothing here is saved.')
          ),
        ];
    data.replaceChildren(
      el('div', { class: 'fd-data-card' }, el('span', {}, list ? 'This list shows records of' : 'This page shows records of'), el('b', { class: 'fd-data-model' }, page.data.model), el('span', { class: 'fd-data-count' }, `${onPage.length + unused.length} fields · ${onPage.length} on this page`)),
      ...samples,
      el('div', { class: 'fd-data-rows' }, ...onPage.map(([name, field]) => row(name, field.label, field.type, true, storedAs(field))), ...unused.map(({ name, field }) => row(name, field.label, field.type, false, storedAs(field))))
    );
  }

  function draw(state: DesignerState) {
    for (const t of tabs) {
      t.setAttribute('aria-selected', String(t.dataset['rail'] === pane));
      t.tabIndex = t.dataset['rail'] === pane ? 0 : -1;
    }
    for (const [name, p] of Object.entries(panes)) p.hidden = name !== pane;
    tree.update(state, pane === 'outline');
    if (pane === 'data') drawData(state);
  }

  return { element, update: draw, destroy: () => tree.destroy() };
}
