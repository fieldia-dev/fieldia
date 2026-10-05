import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { kindById, kindName as nameOfKind, kindOfField, storedAs } from './kinds';
import { across } from './layout-tree';
import { inTwelfths, percent, rowParts, TWELVE, widthsFor } from './layout-twelfths';
import { openMenu, type MenuItem } from './menu';
import { findField } from './page-tree';
import { toolboxGroups } from './toolbox';
import { chromeLanguage } from './chrome-language';
import type { DesignerWords } from './designer-words';
import { groupName } from './toolbox';

/**
 * The bar on the field being edited: what changes most, one press away — how
 * it is shown, required, how wide, when it shows — then Duplicate, Delete,
 * and More for the rest in the panel. A grip to drag it by.
 */

export interface FieldBarOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  id: string;
  /** Open the panel at a part of the field: its settings, or when it shows. */
  more(part: 'field' | 'when'): void;
}

export interface FieldBar {
  element: HTMLElement;
  update(page: Page): void;
}

/** Why a field offers the editors it does. */
export function kindsReason(designer: Designer, page: Page, id: string): string {
  const found = findField(page, id);
  if (!found) return '';
  const def = page.fields[found.node.field];
  const w = designer.words.canvas;
  if (!designer.isFromModel(id)) return w.madeHere;
  const count = designer.kindsFor(id).length;
  return w.storedIn(found.node.label ?? def.label, storedAs(def, designer.words), count === 1);
}

/** The widths a field is offered where it sits: in a group in twelfths, fractions of its row that fit, and its own; else so many columns. */
function widthItems(page: Page, id: string, words: DesignerWords): MenuItem[] {
  const w = words.canvas;
  const found = findField(page, id);
  if (!found) return [];
  if (inTwelfths(found.section)) {
    const span = Math.min(found.node.colspan ?? 1, TWELVE);
    const fits = widthsFor(page, found.section, found.node);
    const items = rowParts(words).filter((p) => p.span === span || fits(p.span)).map((p) => ({ id: String(p.span), label: p.name, checked: p.span === span }));
    if (!items.some((item) => item.checked)) items.push({ id: String(span), label: w.percent(percent(span)), checked: true });
    return items.sort((a, b) => Number(b.id) - Number(a.id));
  }
  const columns = across(page, found.section);
  const span = Math.min(found.node.colspan ?? 1, columns);
  return Array.from({ length: columns }, (_, i) => {
    const n = i + 1;
    return { id: String(n), label: n === columns ? w.fullWidth : n === 1 ? w.oneColumn : w.columns(n), checked: n === span };
  });
}

export function fieldBar(options: FieldBarOptions): FieldBar {
  const { el, doc, designer, id } = options;
  const w = designer.words.canvas;
  const icon = (name: string) => designerIcon(doc, name);
  const tool = (label: string, name: string, extra: Record<string, string> = {}) =>
    el('button', { type: 'button', class: 'fd-bar-button', 'aria-label': label, title: label, ...extra }, icon(name));

  const grip = el('button', { type: 'button', class: 'fd-bar-button fd-bar-grip', 'data-grip': '', 'aria-label': w.dragToMove, title: designer.words.options.grip }, icon('grip'));
  const kindIcon = el('span', { class: 'fd-bar-kind-icon' });
  const kindName = el('span', { class: 'fd-bar-kind-name' });
  const kind = el('button', { type: 'button', class: 'fd-bar-button fd-bar-kind', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, kindIcon, kindName, icon('chevron'));
  const required = tool(w.required, 'required', { 'aria-pressed': 'false' });
  const width = tool(w.width, 'width', { 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  const when = tool(w.showOnlyWhen, 'when', { 'aria-pressed': 'false' });
  const duplicate = tool(w.duplicate, 'duplicate');
  const remove = tool(w.delete, 'delete');
  const more = tool(w.moreSettings, 'more');
  const sep = () => el('span', { class: 'fd-bar-sep', 'aria-hidden': 'true' });
  const element = el('div', { class: 'fd-field-bar', role: 'toolbar', 'aria-label': w.field, ...chromeLanguage(designer) }, grip, kind, sep(), required, width, when, sep(), duplicate, remove, more);
  let page = designer.getPage();

  kind.addEventListener('click', () => {
    const found = findField(page, id);
    if (!found) return;
    const current = kindOfField(page.fields[found.node.field], found.node);
    const fitting = designer.kindsFor(id);
    const offered = new Set(fitting.map((k) => k.id));
    // Grouped as the toolbox groups them, when there is more than one group's worth.
    const items: MenuItem[] = designer.isFromModel(id)
      ? fitting.map((k) => ({ id: k.id, label: nameOfKind(k, designer.words), icon: k.id, checked: k.id === current }))
      : toolboxGroups(fitting).flatMap(([title, ids]) =>
          ids.filter((k) => offered.has(k)).map((k, i) => ({ id: k, label: nameOfKind(kindById(k), designer.words), icon: k, checked: k === current, ...(i === 0 ? { heading: groupName(designer.words, title) } : {}) }))
        );
    openMenu({ el, anchor: kind, title: w.showAs(found.node.label ?? page.fields[found.node.field].label), items, note: kindsReason(designer, page, id), onPick: (k) => designer.changeKind(id, k) });
  });
  required.addEventListener('click', () => designer.updateQuestion(id, { required: required.getAttribute('aria-pressed') !== 'true' }));
  width.addEventListener('click', () => {
    const items = widthItems(page, id, designer.words);
    if (items.length) openMenu({ el, anchor: width, title: w.width, items, onPick: (n) => designer.setColspan(id, Number(n)) });
  });
  when.addEventListener('click', () => options.more('when'));
  more.addEventListener('click', () => options.more('field'));
  duplicate.addEventListener('click', () => {
    const copy = designer.duplicateNode(id);
    if (copy) designer.select(copy);
  });
  remove.addEventListener('click', () => designer.removeNode(id));

  return {
    element,
    update(next) {
      page = next;
      const found = findField(page, id);
      if (!found) return;
      const def = page.fields[found.node.field];
      const current = kindOfField(def, found.node);
      const label = current ? nameOfKind(kindById(current), designer.words) : w.custom;
      kind.setAttribute('aria-label', w.showAsKind(label));
      kind.title = w.showAsKind(label);
      if (kindName.textContent !== label) {
        kindName.textContent = label;
        kindIcon.replaceChildren(icon(current ?? 'short-answer'));
      }
      required.setAttribute('aria-pressed', String(def.required === true || found.node.required === true));
      // Nothing to choose: one column, or alone in a row that stays full.
      width.hidden = widthItems(page, id, designer.words).length < 2;
      when.setAttribute('aria-pressed', String(found.node.invisible !== undefined));
    },
  };
}
