import { createForm, localizePage, isRightToLeft, type Field, type FieldNode, type LayoutNode, type Page, type Skin, type Value, type Values } from '@fieldia/core';
import { displayValue, FIELDIA_STYLE_SHEETS } from '@fieldia/widgets';
import { ownLocale } from './lib/labels';
// The one-tag script's files a page draws from, for a server to write their tags before fieldia.js.
export { partFiles } from './lib/viewer-parts';

/**
 * A form's first paint on a server: `@fieldia/viewer/server`. A Next, Nuxt or any server-rendered page sends the form
 * as plain HTML with its values — its title, its sections, each field's label, its box with its value, its help — in
 * Fieldia's own classes, so it looks as the form will; the browser shows it before any script has run. Then the
 * viewer mounts over it (`mountViewer`, or the React and Vue components given `firstPaint`): it draws the live form
 * out of sight, and once that is drawn and its record in, puts it in the first paint's place in one step — what was
 * typed in the first paint meanwhile carried into the live boxes, the focus and caret where they were.
 *
 * This is a first paint, not the whole form rendered on the server: no script runs in it (a list's own search, a
 * date's calendar, a choice's own list come with the live form), and parts it does not draw — a table of lines' tools,
 * a map, a slot, a button's menu — are drawn by the live form only. No DOM is needed: it runs in Node, an edge
 * function or a worker.
 */

export interface FirstPaintOptions {
  /** The record's values as the server has them: the first paint shows them; the live form loads them through the data source. */
  values?: Values;
  /** The skin: the page's own (`look.skin`) by default, else underline — the same the viewer is given. */
  skin?: Skin;
  /** The page's language: its own words in it, a language written right to left running so. */
  locale?: string;
  dir?: 'ltr' | 'rtl';
  /**
   * Fieldia's stylesheet with it, as `<style>` elements the viewer then keeps (`firstPaintStyles`): true by default.
   * With several forms on a page, give them once — `firstPaintStyles()` in the page's head — and `false` here.
   */
  styles?: boolean;
  /** The page's Content-Security-Policy nonce, for its `<style>` elements. */
  nonce?: string;
}

/** Text as HTML text. */
const text = (words: string) => words.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
/** Text as an HTML attribute's value, quoted. */
const attr = (words: string) => `"${words.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)}"`;
const attrs = (all: Record<string, string | boolean | undefined>) =>
  Object.entries(all)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}=${attr(value as string)}`))
    .join('');

/**
 * Fieldia's stylesheet as `<style>` elements, for a page's head: what the first paint is drawn with, and what the
 * viewer finds there and keeps (by their ids), adding each part's sheet between them as it would. No style attribute
 * is in the first paint, so a strict policy needs only the nonce.
 */
export function firstPaintStyles(nonce?: string): string {
  return FIELDIA_STYLE_SHEETS.map(([id, css]) => `<style${attrs({ id, nonce })}>${css}</style>`).join('') + `<style${attrs({ id: 'fieldia-first-paint', nonce })}>${FIRST_PAINT_CSS}</style>`;
}

/**
 * The first paint's own rules: what the live form sets on each element as it draws it — a grid's columns, a field's
 * span — said by its attributes, so the HTML holds no style attribute; and its boxes resting until the live form comes.
 */
const FIRST_PAINT_CSS = [
  ...[1, 2, 3, 4, 6].map((n) => `[data-fd-first-paint] .fd-grid[data-columns="${n}"]{--fd-columns:${n}}`),
  ...[2, 3, 4, 6, 12].map((n) => `[data-fd-first-paint] [data-span="${n}"]{--fd-span:${n}}`),
  '[data-fd-first-paint] .fd-first-text{white-space:pre-wrap}',
].join('');

/**
 * The page's first paint, as HTML: its stylesheet (unless `styles: false`), then the form in a `div` marked
 * `data-fd-first-paint`, which the viewer mounts over. Put it inside the element the viewer is mounted in.
 */
export function firstPaint(page: Page, options: FirstPaintOptions = {}): string {
  const shown = options.locale ? localizePage(page, options.locale) : page;
  // The form's own rules, run as the browser will run them: defaults, values worked out, what is hidden, locked, required.
  const form = createForm({ page: shown, values: options.values ?? {} });
  const state = form.getState();
  const values = state.values as Values;
  const tag = options.locale ?? shown.language ?? 'en';
  const locale = ownLocale(tag);
  const dir = options.dir ?? (isRightToLeft(tag) ? 'rtl' : undefined);
  const skin = options.skin ?? shown.look?.skin ?? 'underline';
  let made = 0;
  const id = (node: string) => `fd-first-${++made}-${node.replace(/[^A-Za-z0-9_-]/g, '_')}`;

  const field = (node: FieldNode): string => {
    const at = form.node(node.id);
    if (at.invisible) return '';
    const def = shown.fields[node.field] as Field;
    const label = node.label ?? def.label;
    const box = id(node.id);
    const value = values[node.field];
    const help = node.help ?? def.help;
    const wrapper = attrs({ class: `fd-field${at.required ? ' fd-required' : ''}`, 'data-node': node.id, 'data-field': node.field, 'data-path': node.field, 'data-type': def.type, 'data-span': node.colspan ? String(node.colspan) : undefined });
    return `<div${wrapper}><label${attrs({ class: 'fd-label', for: box })}>${text(label)}</label>${control(def, node, value, box, at.readonly)}${help ? `<div class="fd-help">${text(help)}</div>` : ''}</div>`;
  };

  /** Its box with its value, as the live form draws it at rest; typed in, it is carried into the live box. */
  const control = (def: Field, node: FieldNode, value: Value | undefined, box: string, readonly: boolean): string => {
    const common = { id: box, name: node.field, readonly, 'aria-readonly': readonly ? 'true' : undefined };
    if (def.type === 'boolean') return `<input${attrs({ ...common, type: 'checkbox', class: node.widget === 'toggle' ? 'fd-switch' : 'fd-checkbox', checked: value === true, readonly: undefined, disabled: readonly })}>`;
    if (def.type === 'selection' && !def.multiple && node.widget !== 'radio') {
      const options = def.options.map((option) => `<option${attrs({ value: String(option.value), selected: option.value === value })}>${text(option.label)}</option>`).join('');
      return `<select${attrs({ ...common, class: 'fd-input fd-select', readonly: undefined, disabled: readonly })}><option value=""></option>${options}</select>`;
    }
    if (def.type === 'selection') {
      const chosen = Array.isArray(value) ? value : [value];
      const kind = def.multiple ? 'checkbox' : 'radio';
      const boxes = def.options.map((option, i) => `<label class="fd-choice"><input${attrs({ type: kind, name: node.field, value: String(option.value), id: `${box}-${i}`, checked: (chosen as unknown[]).includes(option.value), disabled: readonly })}> <span>${text(option.label)}</span></label>`).join('');
      return `<div${attrs({ class: 'fd-choices', role: kind === 'radio' ? 'radiogroup' : 'group', id: box })}>${boxes}</div>`;
    }
    if (def.type === 'text' || (def.type === 'char' && node.widget === 'textarea')) return `<textarea${attrs({ ...common, class: 'fd-input', rows: '3' })}>${text(typeof value === 'string' ? value : '')}</textarea>`;
    if (def.type === 'html') return `<div${attrs({ id: box, class: 'fd-input fd-first-text' })}>${text(htmlWords(typeof value === 'string' ? value : ''))}</div>`;
    if (def.type === 'one2many' || def.type === 'many2many') {
      const lines = Array.isArray(value) ? value : [];
      const columns = def.type === 'one2many' ? Object.entries(def.fields).slice(0, 6) : [];
      if (!columns.length) return `<div${attrs({ id: box, class: 'fd-input fd-first-text' })}>${text(lines.map((line) => linkName(line)).filter(Boolean).join(', '))}</div>`;
      const head = columns.map(([, column]) => `<th scope="col">${text(column.label)}</th>`).join('');
      const rows = lines
        .map((line) => {
          const own = ((line as { values?: Values }).values ?? {}) as Values;
          return `<tr>${columns.map(([name, column]) => `<td>${text(displayValue(column, own[name], own, locale))}</td>`).join('')}</tr>`;
        })
        .join('');
      return `<div${attrs({ id: box, class: 'fd-lines', role: 'group' })}><div class="fd-lines-scroll"><table class="fd-lines-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }
    if (def.type === 'binary' || def.type === 'image' || def.type === 'json' || def.type === 'properties' || def.type === 'matrix' || def.type === 'reference') return `<div${attrs({ id: box, class: 'fd-input fd-first-text' })}></div>`;
    const words = def.type === 'many2one' ? linkName(value) : def.type === 'char' ? (typeof value === 'string' ? value : '') : displayValue(def, value, values, locale);
    return `<input${attrs({ ...common, type: 'text', class: 'fd-input', value: words, placeholder: node.placeholder })}>`;
  };

  const nodes = (children: readonly LayoutNode[] | undefined): string => (children ?? []).map(part).join('');
  const part = (node: LayoutNode): string => {
    switch (node.type) {
      case 'field':
        return field(node);
      case 'section': {
        if (form.node(node.id).invisible) return '';
        const columns = typeof node.columns === 'number' ? node.columns : 1;
        const title = node.title ? `<legend class="fd-section-title"><bdi>${text(node.title)}</bdi></legend>` : '';
        return `<fieldset${attrs({ class: 'fd-section', 'data-node': node.id, 'data-style': node.style ?? 'card', 'data-on-page': true, 'data-span': node.colspan ? String(node.colspan) : undefined })}>${title}<div${attrs({ class: 'fd-grid', 'data-columns': String(columns) })}>${nodes(node.children)}</div></fieldset>`;
      }
      case 'tabs': {
        // The first tab shown, as the live form opens it; the others come with the live form.
        const first = node.children.find((tab) => !form.node(tab.id).invisible);
        const strip = node.children.map((tab) => `<button${attrs({ type: 'button', class: 'fd-tab', role: 'tab', 'aria-selected': tab === first ? 'true' : 'false' })}>${text(tab.label)}</button>`).join('');
        return `<div class="fd-tabs"><div class="fd-tablist" role="tablist">${strip}</div><div class="fd-tabpanel" role="tabpanel">${first ? nodes(first.children) : ''}</div></div>`;
      }
      case 'text': {
        if (form.node(node.id).invisible) return '';
        const words = text(form.words(node.text));
        return node.style === 'heading' ? `<h2 class="fd-text fd-heading">${words}</h2>` : `<p class="fd-text">${words}</p>`;
      }
      case 'divider':
        return '<hr class="fd-divider">';
      default:
        // A button, a slot, a map, a related list, a saved form, a picture: the live form draws them.
        return '';
    }
  };

  const layout = shown.layout as { type: string; id: string; children?: LayoutNode[]; title?: { field: string } };
  let body: string;
  if (layout.type === 'wizard') {
    // A survey's first step, as it opens.
    const step = (layout.children ?? []).find((one) => !form.node(one.id).invisible) as { label?: string; children?: LayoutNode[] } | undefined;
    body = `<div class="fd-wizard"><div class="fd-step">${step?.label ? `<h2 class="fd-step-title">${text(step.label)}</h2>` : ''}${nodes(step?.children)}</div></div>`;
  } else if (layout.type === 'list') body = '';
  else {
    const title = layout.type === 'sheet' && layout.title ? `<div class="fd-sheet-title">${text(String(values[layout.title.field] ?? ''))}</div>` : '';
    body = `<div${attrs({ class: layout.type === 'sheet' ? 'fd-sheet' : 'fd-sections', 'data-node': layout.id })}>${title}${nodes(layout.children)}</div>`;
  }
  const head = shown.title || shown.description ? `<header class="fd-page-head">${shown.title ? `<h1 class="fd-page-title">${text(shown.title)}</h1>` : ''}${shown.description ? `<p class="fd-page-description">${text(shown.description)}</p>` : ''}</header>` : '';
  const html = `<div${attrs({ 'data-fd-first-paint': true })}><form${attrs({ class: 'fd-form', novalidate: true, 'data-fd-skin': skin, dir, lang: options.locale })}><div class="fd-content">${head}<div>${body}</div></div></form></div>`;
  return (options.styles === false ? '' : firstPaintStyles(options.nonce)) + html;
}

/** A link's name as the server gives it: `[id, name]`, `{ id, display_name }` or `{ id, name }`. */
function linkName(value: unknown): string {
  if (Array.isArray(value)) return typeof value[1] === 'string' ? value[1] : '';
  if (value && typeof value === 'object') {
    const named = value as { display_name?: unknown; name?: unknown };
    return typeof named.display_name === 'string' ? named.display_name : typeof named.name === 'string' ? named.name : '';
  }
  return '';
}

/** Formatted text's words, its tags left out (no DOM to read it with on a server): the live form draws it whole. */
function htmlWords(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-4])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
