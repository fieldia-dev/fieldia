import type { ElementFactory } from './chrome';
import { designerIcon } from './icons';
import { shownWithin } from './panel-controls';
import { tabStrip, tabsFor, type PanelTab, type PartKind } from './panel-tabs';
import type { PropertiesView } from './screen-properties';

/**
 * The panel beside the canvas, as the approved mockup draws it: a head saying
 * what is picked — its kind and its name — then the tabs that apply to it,
 * one tab's settings shown at a time. A view of the part gives its settings
 * as rows, each saying its tab; the panel sorts them into their tabs, shows
 * no tab without one, and keeps the tab a kind of part was last left on.
 */

export interface InspectorHead {
  /** An icon by name, as the toolbox draws it. */
  icon: string;
  /** What kind of part it is: "Dropdown", "Group", "Several". */
  kind: string;
  /** Said after the kind, such as "from the model". */
  note?: string;
  /** Its name: a field's label, a group's title, how many are picked. */
  name: string;
}

/** A setting on show, wherever its tab is. */
export interface SettingRow {
  tab: PanelTab;
  name: string;
  element: HTMLElement;
  /** The choices it offers, when it is a choice of a few. */
  choices: { value: string; words: string; button: HTMLButtonElement }[];
}

export interface InspectorShell {
  element: HTMLElement;
  /** Where the panel's own controls go above the tabs, such as the search. */
  top: HTMLElement;
  /** Show a view of what is picked: its rows in the tabs that apply. */
  show(kind: PartKind, view: PropertiesView): void;
  head(head: InspectorHead): void;
  current(): PanelTab;
  choose(tab: PanelTab): void;
  /** Every setting on show, in every tab, in the tabs' order. */
  rows(): SettingRow[];
  /** Go to a setting: its tab chosen and its control focused — the choice named, or the one pressed. */
  go(row: SettingRow, choice?: string): void;
  /** Show or hide the tabs and their panels, as the search does while it lists what it found. */
  setTabsHidden(hidden: boolean): void;
}

export function inspectorShell(el: ElementFactory, doc: Document): InspectorShell {
  const icon = el('span', { class: 'fd-insp-icon' });
  const title = el('span', { class: 'fd-panel-title' });
  const note = el('span', { class: 'fd-insp-note' });
  const name = el('div', { class: 'fd-insp-name' });
  const headBox = el('div', { class: 'fd-insp-head' }, el('div', { class: 'fd-insp-kind' }, icon, title, note), name);
  const top = el('div', { class: 'fd-insp-top' });
  const strip = tabStrip(el, (tab) => choose(tab));
  const panels = el('div', { class: 'fd-insp-panels' });
  const element = el('aside', { class: 'fd-properties fd-inspector', 'aria-label': 'Properties' }, headBox, top, strip.element, panels);

  let kind: PartKind = 'page';
  let shown: PanelTab[] = [];
  let tab: PanelTab = 'content';
  const lastTab = new Map<PartKind, PanelTab>();
  const panelOf = new Map<PanelTab, HTMLElement>();

  function draw() {
    strip.show(shown, tab);
    for (const [at, panel] of panelOf) panel.hidden = at !== tab;
  }

  function choose(next: PanelTab) {
    if (!shown.includes(next)) return;
    tab = next;
    lastTab.set(kind, next);
    draw();
  }

  return {
    element,
    top,
    show(nextKind, view) {
      kind = nextKind;
      const applies = tabsFor(kind);
      panelOf.clear();
      const make = (at: PanelTab) => {
        const panel = el('div', { class: 'fd-props fd-insp-panel', role: 'tabpanel', id: strip.panelId(at), 'aria-labelledby': strip.tabId(at), 'data-panel': at });
        panelOf.set(at, panel);
        return panel;
      };
      for (const at of applies) make(at);
      // The view's own element is its Content; a row for another tab goes to that tab, and a row for a tab that does not apply is not shown.
      const content = panelOf.get('content');
      for (const row of [...view.element.children] as HTMLElement[]) {
        const at = (row.dataset['tab'] as PanelTab | undefined) ?? 'content';
        if (at === 'content') continue;
        const panel = panelOf.get(at);
        if (panel) panel.append(row);
        else row.remove();
      }
      if (content) {
        if (view.element.children.length) content.append(view.element);
        else panelOf.delete('content');
      }
      for (const [at, panel] of [...panelOf]) if (at !== 'content' && !panel.children.length) panelOf.delete(at);
      shown = applies.filter((at) => panelOf.has(at));
      const kept = lastTab.get(kind);
      tab = kept && shown.includes(kept) ? kept : (shown[0] ?? 'content');
      panels.replaceChildren(...shown.map((at) => panelOf.get(at) as HTMLElement));
      draw();
    },
    head(next) {
      if (icon.dataset['icon'] !== next.icon) {
        icon.dataset['icon'] = next.icon;
        icon.replaceChildren(designerIcon(doc, next.icon));
      }
      title.textContent = next.kind;
      note.textContent = next.note ? ` · ${next.note}` : '';
      name.textContent = next.name;
      name.title = next.name;
    },
    current: () => tab,
    choose,
    rows() {
      return shown.flatMap((at) => {
        const panel = panelOf.get(at) as HTMLElement;
        return [...panel.querySelectorAll<HTMLElement>('[data-setting]')]
          .filter((row) => shownWithin(row, panel))
          .map((row) => ({
            tab: at,
            name: row.dataset['setting'] as string,
            element: row,
            choices: [...row.querySelectorAll<HTMLButtonElement>('[data-choice]')]
              .filter((button) => shownWithin(button, row))
              .map((button) => ({ value: button.dataset['choice'] as string, words: button.textContent?.trim() || button.getAttribute('aria-label') || '', button })),
          }));
      });
    },
    go(row, choice) {
      choose(row.tab);
      const target =
        (choice !== undefined ? row.choices.find((c) => c.value === choice)?.button : undefined) ??
        row.element.querySelector<HTMLElement>('[data-choice][aria-pressed="true"]') ??
        [...row.element.querySelectorAll<HTMLElement>('input, select, textarea, button')].find((c) => shownWithin(c, row.element));
      target?.focus();
      row.element.scrollIntoView?.({ block: 'nearest' });
      // Pointed out, a moment, so the eye finds it.
      row.element.classList.remove('fd-set-found');
      void row.element.offsetWidth;
      row.element.classList.add('fd-set-found');
    },
    setTabsHidden(hidden) {
      strip.element.hidden = hidden;
      panels.hidden = hidden;
    },
  };
}
