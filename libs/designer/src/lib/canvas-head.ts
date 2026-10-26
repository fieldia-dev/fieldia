import type { ButtonNode, FieldNode, Form, HeadLink, LineField, Page, SheetNode, TabsNode, Values } from '@fieldia/core';
import { displayValue, drawIcon } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * A record's head on the canvas, drawn as the viewer draws it (the same
 * classes, so the same stylesheet): the kind's strip and badge, the number
 * and the title, the row's fields and counts, the buttons — split, by their
 * icon alone — the band's fields beside their labels, "Updated by" and the
 * tabs in the head. Its values are the sample record's, or each field's name
 * where it has none. A press on a button or a tab picks it; anywhere else
 * picks the sheet, whose panel holds the head's settings.
 */

export interface CanvasHead {
  element: HTMLElement;
  /** Draw it for this page: hidden when its sheet has no head. */
  update(page: Page, selected: string | null, form: () => Form): void;
}

export function canvasHead(options: { el: ElementFactory; doc: Document; designer: Designer }): CanvasHead {
  const { el, doc, designer } = options;
  const element = el('div', { class: 'fd-head fd-canvas-head', role: 'group', 'aria-label': designer.words.head.canvasHead, hidden: '' });
  element.addEventListener('click', (event) => {
    const part = (event.target as Element).closest<HTMLElement>('[data-pick]');
    designer.select(part?.dataset['pick'] || null);
  });
  let drawn = '';

  const icon = (name: string | undefined) => drawIcon(doc, name) ?? '';
  /** A part that picks something by a press: a button or a tab of the head. */
  const picker = (id: string, label: string, ...children: (Node | string)[]) => el('button', { type: 'button', class: 'fd-button', 'data-pick': id, 'aria-label': label }, ...children);

  function button(node: ButtonNode, selected: string | null): HTMLElement {
    const look = node.primaryWhenChanged ? 'subtle' : node.style ?? 'secondary';
    const face = node.iconOnly ? [icon(node.icon)] : [icon(node.icon), el('bdi', {}, node.label)];
    const main = picker(node.id, node.label, ...face);
    main.classList.add(`fd-button-${look}`);
    if (node.iconOnly) main.classList.add('fd-button-icon-only');
    if (node.pressed !== undefined) main.setAttribute('aria-pressed', 'false');
    if (selected === node.id) main.classList.add('fd-canvas-selected');
    if (!node.menu?.length) return main;
    const own = !!node.steps?.length || node.action !== undefined;
    if (!own) {
      main.append(icon(node.menuIcon ?? 'chevron-down'));
      return el('span', { class: 'fd-split fd-split-alone', 'data-look': look }, main);
    }
    const more = picker(node.id, node.menuLabel ?? node.label, icon(node.menuIcon ?? 'chevron-down'));
    more.classList.add('fd-split-more', `fd-button-${look}`);
    return el('span', { class: 'fd-split', 'data-look': look }, main, el('span', { class: 'fd-split-rule', 'aria-hidden': 'true' }), more);
  }

  return {
    element,
    update(page, selected, form) {
      const root = page.layout;
      const sheet = root.type === 'sheet' && root.head ? (root as SheetNode) : null;
      element.hidden = !sheet;
      if (!sheet) return;
      const head = sheet.head as NonNullable<SheetNode['head']>;
      const values = form().getState().values as Values;
      const key = JSON.stringify([page.fields, sheet.head, sheet.title, sheet.children.filter((c) => c.type === 'tabs'), values, selected]);
      if (key === drawn) return;
      drawn = key;
      const shown = (name: string | undefined) => {
        if (!name) return '';
        const def = page.fields[name];
        const value = def ? displayValue(def as LineField, values[name], values) : '';
        return value || (def?.label ?? name);
      };
      // The kind: its field's first value's look, else the one kind's.
      const kind = head.kind ?? {};
      const def = kind.field ? page.fields[kind.field] : undefined;
      const value = kind.field ? values[kind.field] : undefined;
      const first = def?.type === 'selection' ? def.options[0] : undefined;
      const now = value !== undefined && value !== null && value !== '' ? String(value) : first ? String(first.value) : '';
      const look = now ? kind.looks?.[now] : undefined;
      const colour = look?.colour ?? kind.colour;
      if (colour) element.style.setProperty('--fd-kind', colour);
      else element.style.removeProperty('--fd-kind');
      element.toggleAttribute('data-kind', !!colour);
      const kindWords = (def?.type === 'selection' ? def.options.find((o) => String(o.value) === now)?.label : '') || kind.label || '';
      const number = kind.numberField ? String(values[kind.numberField] ?? '') || '4127' : '4127';
      const badge = el('span', { class: 'fd-head-badge' }, el('span', { class: 'fd-head-badge-icon', 'aria-hidden': 'true' }, icon(look?.icon ?? kind.icon)), el('bdi', { class: 'fd-head-badge-words' }, `${kindWords.toLocaleUpperCase()} ${number}`.trim()));
      const top = el('div', { class: 'fd-head-top' }, el('span', { class: 'fd-head-strip', 'aria-hidden': 'true' }), el('div', { class: 'fd-head-badge-row' }, head.kind ? badge : el('span'), el('span', { class: 'fd-head-window' })));
      if (sheet.title) {
        const before = (sheet.title.before ?? []).map((part) => el('span', { class: 'fd-head-number' }, part.field === kind.numberField ? number : shown(part.field)));
        top.append(el('div', { class: 'fd-head-title' }, ...before, el('span', { class: 'fd-canvas-head-title' }, shown(sheet.title.field))));
      }
      const meta = (head.meta ?? []).map((part) => {
        if (part.type === 'link') {
          const link = part as HeadLink;
          const count = Number(values[link.field] ?? 1) || 1;
          return el('span', { class: 'fd-head-link' }, icon(link.icon), el('span', {}, `${count} ${count === 1 ? link.words.one ?? link.words.other : link.words.other}`));
        }
        const field = part as FieldNode;
        return el('span', { class: 'fd-canvas-head-meta' }, String(values[field.field] ?? '') ? shown(field.field) : field.placeholder ?? page.fields[field.field]?.label ?? field.field);
      });
      const actions = (head.actions ?? []).map((node) => button(node, selected));
      if (sheet.toolbar?.menu?.length) actions.push(el('span', { class: 'fd-button fd-head-more', 'aria-hidden': 'true' }, icon('more')));
      top.append(el('div', { class: 'fd-head-row' }, el('div', { class: 'fd-head-meta' }, ...meta), el('div', { class: 'fd-head-actions' }, ...actions)));
      // The band: each field's label, with its access key underlined, and its value.
      const fields = el('div', { class: 'fd-head-fields' });
      fields.style.setProperty('--fd-head-tracks', (head.band?.tracks ?? ['1fr', '1fr']).join(' '));
      if (head.band?.labelWidth) fields.style.setProperty('--fd-head-label', `${head.band.labelWidth}px`);
      for (const part of head.band?.children ?? []) {
        if (part.type !== 'field') continue;
        const words = part.label ?? page.fields[part.field]?.label ?? part.field;
        const at = part.hotkey ? words.toLocaleLowerCase().indexOf(part.hotkey) : -1;
        const label = at === -1 ? el('span', { class: 'fd-label' }, words) : el('span', { class: 'fd-label' }, words.slice(0, at), el('span', { class: 'fd-access-key' }, words.slice(at, at + 1)), words.slice(at + 1));
        fields.append(el('div', { class: 'fd-field', 'data-labels': 'beside' }, label, el('span', { class: 'fd-canvas-head-value' }, shown(part.field))));
      }
      const aside = el('div', { class: 'fd-head-aside' });
      if (head.updated) aside.append(el('span', { class: 'fd-head-updated' }, `${page.fields[head.updated.byField]?.label ?? head.updated.byField}: ${page.fields[head.updated.atField]?.label ?? head.updated.atField}`));
      const tabs = sheet.children.find((child): child is TabsNode => child.type === 'tabs' && child.place === 'head');
      if (tabs) {
        aside.append(
          el(
            'div',
            { class: 'fd-head-tabs' },
            el(
              'div',
              { class: 'fd-tablist' },
              ...tabs.children.map((tab, i) => {
                const face = tab.iconOnly ? [icon(tab.icon)] : [icon(tab.icon), el('bdi', {}, tab.label)];
                // Its count's pill apart from its words, and in its name, as the viewer's tab has them: "Links, 0".
                const pill = tab.count ? [' ', el('span', { class: 'fd-tab-count', 'aria-hidden': 'true' }, '0')] : [];
                return el('button', { type: 'button', class: `fd-tab${tab.iconOnly ? ' fd-tab-icon-only' : ''}`, 'data-pick': tab.id, 'aria-label': tab.count ? `${tab.label}, 0` : tab.label, 'aria-selected': String(i === 0) }, ...face, ...pill);
              })
            )
          )
        );
      }
      element.replaceChildren(top, el('div', { class: 'fd-head-band' }, fields, aside));
    },
  };
}
