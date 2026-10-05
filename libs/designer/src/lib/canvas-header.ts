import type { Badge, ButtonNode, FieldNode, Form, Page, SheetNode, StatButton } from '@fieldia/core';
import { createWidget, type Widget } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer, HeaderPartKind } from './designer';
import { designerIcon } from './icons';
import { openMenu } from './menu';
import { setHidden } from './writes';

/**
 * A record's header on the canvas, drawn the way the viewer draws it: the
 * header's buttons and the status steps over the card, the counters and the
 * badges on it. A part is picked by a click and its words typed where they
 * stand, a small bar on it moving or taking it away; a quiet "Add …" after
 * each kind adds one. The status steps are the real widget, from a field
 * picked in a menu of the fields that can be steps.
 */

export interface CanvasHeader {
  /** Over the card: the header's buttons and the status steps. */
  top: HTMLElement;
  /** On the card, over the title: the counters and the badges. */
  card: HTMLElement;
  update(page: Page, selected: string | null, form: () => Form): void;
  /** Put the cursor in a part's words, every word selected. */
  focus(id: string): void;
  destroy(): void;
}


export function canvasHeader(options: { el: ElementFactory; doc: Document; designer: Designer }): CanvasHeader {
  const { el, doc, designer } = options;
  const w = designer.words.canvas;
  const NEW_WORDS: Record<HeaderPartKind, string> = { button: designer.words.defaults.newButton, stat: designer.words.defaults.counter, badge: designer.words.defaults.badge };
  const ADD_WORDS: Record<HeaderPartKind | 'statusbar', string> = { button: w.addButton, statusbar: w.addStatus, stat: w.addCounter, badge: w.addBadge };
  const adder = (kind: HeaderPartKind | 'statusbar') => {
    const button = el('button', { type: 'button', class: 'fd-canvas-add-part', 'data-add-part': kind }, designerIcon(doc, 'plus'), ADD_WORDS[kind]);
    button.addEventListener('click', () => (kind === 'statusbar' ? pickStatusField(button) : add(kind)));
    return button;
  };
  const actions = el('div', { class: 'fd-actions fd-canvas-header-actions' });
  const steps = el('div', { class: 'fd-canvas-header-steps' });
  const top = el('div', { class: 'fd-header fd-canvas-header', hidden: '' }, actions, steps);
  const stats = el('div', { class: 'fd-stats fd-canvas-stats' });
  const badges = el('div', { class: 'fd-badges fd-canvas-badges' });
  const card = el('div', { class: 'fd-canvas-header-card', hidden: '' }, stats, badges);
  const adders = { button: adder('button'), statusbar: adder('statusbar'), stat: adder('stat'), badge: adder('badge') };

  function add(kind: HeaderPartKind) {
    const created = designer.addHeaderPart(kind, NEW_WORDS[kind]);
    if (created) focus(created);
  }
  function pickStatusField(anchor: HTMLElement) {
    const page = designer.getPage();
    const own = Object.entries(page.fields).map(([name, field]) => ({ name, field }));
    const choices = [...own, ...designer.modelFields()].filter(({ field }) => field.type === 'selection' && !field.multiple);
    openMenu({
      el,
      anchor,
      title: w.statusFrom,
      items: choices.map(({ name, field }) => ({ id: name, label: field.label })),
      note: choices.length ? w.statusNote : w.noStatusField,
      onPick: (name) => {
        if (designer.setStatusbar(name)) designer.select('#statusbar');
      },
    });
  }

  // ---- parts ---------------------------------------------------------------------
  interface PartView {
    element: HTMLElement;
    key: string;
    input: HTMLInputElement | null;
    left: HTMLButtonElement | null;
    right: HTMLButtonElement | null;
  }
  const views = new Map<string, PartView>();

  function looks(kind: HeaderPartKind, part: ButtonNode | StatButton | Badge): string {
    if (kind === 'button') return `fd-button fd-button-${(part as ButtonNode).style ?? 'secondary'}`;
    if (kind === 'stat') return 'fd-stat';
    return `fd-badge fd-tone-${(part as Badge).tone ?? 'muted'}`;
  }

  function closedPart(kind: HeaderPartKind, part: ButtonNode | StatButton | Badge, page: Page): HTMLElement {
    const tag = kind === 'badge' ? 'span' : 'button';
    const element = el(tag, { class: `${looks(kind, part)} fd-canvas-part`, 'data-part': part.id, ...(tag === 'button' ? { type: 'button' } : { role: 'button', tabindex: '0' }) });
    if (kind === 'stat') {
      const count = (part as StatButton).field;
      const value = el('span', { class: 'fd-stat-value' }, count ? '12' : '');
      element.append(el('span', { class: 'fd-stat-words' }, value, el('span', { class: 'fd-stat-label' }, part.label)));
      if (count) element.title = w.shows(page.fields[count]?.label ?? count);
    } else element.append(part.label);
    const pick = () => {
      designer.select(part.id);
      focus(part.id, false);
    };
    element.addEventListener('click', pick);
    element.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (tag === 'span' && (key === 'Enter' || key === ' ')) {
        event.preventDefault();
        pick();
      }
    });
    return element;
  }

  function openPart(kind: HeaderPartKind, part: ButtonNode | StatButton | Badge): PartView {
    const input = el('input', { class: 'fd-part-input', 'aria-label': w.words, autocomplete: 'off', size: String(Math.max(4, part.label.length + 1)) }) as HTMLInputElement;
    input.addEventListener('input', () => {
      input.size = Math.max(4, input.value.length + 1);
      designer.updateHeaderPart(part.id, { label: input.value });
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    const tool = (label: string, icon: string, run: () => void) => {
      const button = el('button', { type: 'button', class: 'fd-bar-button', 'aria-label': label, title: label }, designerIcon(doc, icon));
      button.addEventListener('click', run);
      return button;
    };
    const left = tool(w.moveLeft, 'left', () => designer.moveHeaderPart(part.id, -1));
    const right = tool(w.moveRight, 'right', () => designer.moveHeaderPart(part.id, 1));
    const bar = el('div', { class: 'fd-field-bar fd-part-bar', role: 'toolbar', 'aria-label': part.label }, left, right, tool(w.delete, 'delete', () => designer.removeHeaderPart(part.id)));
    const words = kind === 'stat' ? el('span', { class: 'fd-stat-words' }, el('span', { class: 'fd-stat-value' }, (part as StatButton).field ? '12' : ''), input) : input;
    const element = el('span', { class: `${looks(kind, part)} fd-canvas-part fd-editing`, 'data-part': part.id }, bar, words);
    return { element, key: '', input, left, right };
  }

  function drawPart(kind: HeaderPartKind, part: ButtonNode | StatButton | Badge, index: number, count: number, page: Page, selected: string | null): HTMLElement {
    const editing = selected === part.id;
    const key = `${editing}:${JSON.stringify(part)}`;
    let view = views.get(part.id);
    // The part being typed in stays the same box, focused; anything else is drawn again when it changes.
    const keep = view && (editing ? view.input !== null : view.key === key);
    if (!keep) {
      view = editing ? openPart(kind, part) : { element: closedPart(kind, part, page), key, input: null, left: null, right: null };
      views.set(part.id, view);
    }
    const shown = view as PartView;
    shown.key = key;
    if (shown.input && doc.activeElement !== shown.input) shown.input.value = part.label;
    if (shown.input) shown.element.className = `${looks(kind, part)} fd-canvas-part fd-editing`;
    if (shown.left) shown.left.hidden = index === 0;
    if (shown.right) shown.right.hidden = index === count - 1;
    return shown.element;
  }

  // ---- the status steps ---------------------------------------------------------------
  let statusWidget: Widget | null = null;
  let statusKey = '';
  const statusPart = el('div', { class: 'fd-canvas-part fd-canvas-statusbar', 'data-part': '#statusbar', role: 'button', tabindex: '0', 'aria-label': w.statusSteps });
  const statusBox = el('div', { class: 'fd-canvas-widget', inert: '' });
  statusPart.append(statusBox);
  statusPart.addEventListener('click', () => designer.select('#statusbar'));
  statusPart.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      designer.select('#statusbar');
    }
  });

  function drawSteps(root: SheetNode, page: Page, form: () => Form): HTMLElement {
    const config = root.statusbar as NonNullable<SheetNode['statusbar']>;
    const def = page.fields[config.field];
    // The record on the canvas, made up or empty, stands on one of the steps.
    const key = JSON.stringify([config, def, form().getState().values[config.field] ?? null]);
    if (key !== statusKey) {
      statusKey = key;
      statusWidget?.destroy?.();
      const f = form();
      const node: FieldNode = { type: 'field', id: '#statusbar', field: config.field, widget: 'statusbar', options: { clickable: config.clickable === true } };
      statusWidget = createWidget({ form: f, name: config.field, field: def, node, id: 'fd-canvas-statusbar', document: doc });
      statusWidget.update({ value: f.getState().values[config.field], values: f.getState().values, readonly: false, required: false, invalid: false });
      statusBox.replaceChildren(statusWidget.element);
    }
    return statusPart;
  }

  /** Put these children in this order, moving only what is out of place. */
  function arrange(parent: HTMLElement, children: HTMLElement[]) {
    children.forEach((child, index) => {
      if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] ?? null);
    });
    while (parent.children.length > children.length) parent.lastElementChild?.remove();
  }

  function focus(id: string, selectAll = true) {
    const input = views.get(id)?.input;
    if (!input) return;
    input.focus();
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }

  return {
    top,
    card,
    focus,
    update(page, selected, form) {
      const root = page.layout;
      setHidden(top, root.type !== 'sheet');
      setHidden(card, root.type !== 'sheet');
      if (root.type !== 'sheet') return;
      const live = new Set<string>();
      const row = (kind: HeaderPartKind, parts: (ButtonNode | StatButton | Badge)[] | undefined) =>
        (parts ?? []).map((part, i, all) => {
          live.add(part.id);
          return drawPart(kind, part, i, all.length, page, selected);
        });
      arrange(actions, [...row('button', root.buttons), adders.button]);
      statusPart.classList.toggle('fd-editing', selected === '#statusbar');
      arrange(steps, [root.statusbar ? drawSteps(root, page, form) : adders.statusbar]);
      arrange(stats, [...row('stat', root.statButtons), adders.stat]);
      arrange(badges, [...row('badge', root.badges), adders.badge]);
      for (const id of [...views.keys()]) if (!live.has(id)) views.delete(id);
    },
    destroy() {
      statusWidget?.destroy?.();
      views.clear();
    },
  };
}
