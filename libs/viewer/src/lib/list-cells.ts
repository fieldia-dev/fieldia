import { compileModifier, type ButtonNode, type CompiledModifier, type FileValue, type LineField, type ListCell, type ListNode, type Locale, type Page, type RecordId, type Tone, type Value, type Values } from '@fieldia/core';
import { cellText, drawIcon, formatNumber, phoneLinksOf, phoneSettings, phoneWritten, type IconSet, type WidgetLabels } from '@fieldia/widgets';
import type { El } from './dom';

/**
 * What a record list's cells draw beyond their words (list.ts; the list part):
 * a state's dot or its pill, links as chips, a picture's thumbnail or a
 * person's round photo — their initials where there is none — a number as a
 * bar, a phone number with a call and a WhatsApp link, hours and per cents as
 * a table's cells write them; and each row's own tone, bold and buttons, read
 * on its record. A card (list-cards.ts) draws its values with the same.
 */

const TONES = new Set<string>(['info', 'success', 'warning', 'danger', 'muted']);
const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** A link's id, or a value as it is: what a value's colour, tone or a row's parent is found by. */
export const plain = (value: Value | undefined): unknown => (value !== null && typeof value === 'object' && !Array.isArray(value) && 'id' in value ? (value as { id: unknown }).id : value);

/** Where a picture is: a file's data or its address, or text holding an address; empty for none. */
export function pictureOf(value: Value | undefined): string {
  const file = (Array.isArray(value) ? value[0] : value) as FileValue | string | null | undefined;
  if (!file) return '';
  if (typeof file === 'string') return /^(https?:|data:image\/|blob:|\/|\.\.?\/)/i.test(file.trim()) ? file.trim() : '';
  return file.data ? `data:${file.type};base64,${file.data}` : (file.url ?? '');
}

/** A person's initials, from their name's first two words: "Mona Adel" is MA. */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toLocaleUpperCase();

/** A colour for a name, the same each time: the hue of its letters. */
const hueOf = (name: string) => [...name].reduce((sum, letter) => (sum * 31 + (letter.codePointAt(0) ?? 0)) % 360, 7);

/** A value's colour, by the cell's `colours` (`#rrggbb` by value), else its tone by `tones`, else grey. */
function lookOf(cell: ListCell | undefined, value: Value | undefined): { colour: string | null; tone: Tone } {
  const key = String(plain(value));
  const colours = (cell?.options?.['colours'] ?? {}) as Record<string, unknown>;
  const tones = (cell?.options?.['tones'] ?? {}) as Record<string, unknown>;
  const colour = typeof colours[key] === 'string' && COLOUR.test(colours[key] as string) ? (colours[key] as string) : null;
  const tone = typeof tones[key] === 'string' && TONES.has(tones[key] as string) ? (tones[key] as Tone) : 'muted';
  return { colour, tone };
}

/** A handset and a speech bubble, drawn for Fieldia, unless the app's icons have their own `call` and `chat`. */
const LINK_ICONS: IconSet = {
  call: '<path d="M5.5 3h3l2 5-2.5 1.6a11 11 0 0 0 6.4 6.4L16 13.5l5 2v3a2.5 2.5 0 0 1-2.5 2.5A15.5 15.5 0 0 1 3 5.5 2.5 2.5 0 0 1 5.5 3z"/>',
  chat: '<path d="M4 20.5l1.4-4.1A8.3 8.3 0 1 1 8.6 19z"/><path d="M9 10.5h6M9 13.5h4"/>',
};

export interface CellsContext {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  locale: Locale;
  icons?: IconSet;
  /** The words of a phone's links, the phone field's own. */
  widgetLabels?: WidgetLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
}

export interface Cells {
  /** A column's value as words, as its cell writes it: a phone as people read it, hours as HH:MM, a link by its name. */
  words(name: string, values: Values): string;
  /** A column's cell, drawn: its words with what its widget draws before them, or in their place. `named` names the row's record, for its initials. */
  draw(name: string, values: Values, named?: string): Node[];
  /** A field's value as a pill, in its column's tones or colours: a card's status. Null for none. */
  pill(name: string, values: Values): HTMLElement | null;
  /** Where a field's picture is: empty for none. */
  picture(name: string, values: Values): string;
  /** A name's initials, for a picture there is none of. */
  initials(name: string): string;
}

/** How each of a list's columns draws its cells. */
export function listCells(context: CellsContext): Cells {
  const { page, node, doc, el, locale, fill } = context;
  const cellOf = (name: string) => node.cells?.[name];
  /** A phone column's numbers as people read them, where its page or its cell says so (by the phone part, which the page waited for). */
  const phones = new Map(node.columns.map((name) => [name, cellOf(name)?.widget === 'phone' && page.fields[name]?.type === 'char' ? phoneSettings(page, cellOf(name)?.options) : null]));
  function words(name: string, values: Values): string {
    const value = values[name];
    const phone = phones.get(name);
    const written = phone && typeof value === 'string' ? phoneWritten(value, phone) : undefined;
    const def = page.fields[name] as LineField | undefined;
    if (!def) return value === null || value === undefined ? '' : String(value);
    const cell = cellOf(name);
    return written ?? cellText(def, value, values, locale, undefined, cell?.widget ? { widget: cell.widget, ...(cell.options ? { options: cell.options } : {}) } : {});
  }

  /**
   * A picture's thumbnail, or a person's round photo — their initials in a colour of their name's where there is none:
   * the row's record's, for a picture of it; a link's or a name's own (an owner's), its words beside it.
   */
  function picture(name: string, values: Values, round: boolean, named: string): Node[] {
    const source = pictureOf(values[name]);
    const type = page.fields[name]?.type;
    const said = source || type === 'image' || type === 'binary' ? '' : words(name, values);
    // The picture and the words beside it, apart by the page's own direction whatever the words' own.
    const together = (picture: Element) => (said ? [el('span', { class: 'fd-list-person' }, picture, el('bdi', {}, said))] : [picture]);
    if (source) {
      const img = el('img', { class: round ? 'fd-list-avatar' : 'fd-list-thumb', alt: '', loading: 'lazy', decoding: 'async' });
      img.src = source;
      return together(img);
    }
    const whose = said || named;
    if (!round || !whose) return said ? [el('bdi', {}, said)] : [];
    // Drawn by the sheet, never in the cell's words: what is read or copied of the row is the name alone.
    const face = el('span', { class: 'fd-list-avatar fd-list-initials', 'aria-hidden': 'true', 'data-initials': initials(whose) });
    face.style.setProperty('--fd-face', String(hueOf(whose)));
    return together(face);
  }

  /** A number as a bar of its most (`options.max`, 100 unless said), and its per cent in words. */
  function bar(name: string, values: Values): Node[] {
    const value = values[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    const max = Number(cellOf(name)?.options?.['max'] ?? 100) || 100;
    const share = Math.max(0, Math.min(1, value / max));
    const fill = el('span', { class: 'fd-list-meter-fill' });
    fill.style.width = `${share * 100}%`;
    const track = el('span', {
      class: 'fd-list-meter',
      role: 'progressbar',
      'aria-label': page.fields[name]?.label ?? name,
      'aria-valuemin': '0',
      'aria-valuemax': String(max),
      'aria-valuenow': String(value),
    }, fill);
    return [track, el('span', { class: 'fd-list-meter-words' }, `${formatNumber(Math.round(share * 100), 0, locale)}\u00a0%`)];
  }

  /** A number's call and WhatsApp links, where it reads as one (the phone part's, which the page waited for). */
  function phoneLinks(value: Value | undefined): Node[] {
    const words = context.widgetLabels;
    const to = typeof value === 'string' && words ? phoneLinksOf(value) : undefined;
    if (!to || !words) return [];
    const said = to.number;
    const link = (href: string, icon: string, label: string, away: boolean) => {
      const a = el('a', { class: 'fd-list-link', href, 'aria-label': label, title: label, ...(away ? { target: '_blank', rel: 'noopener noreferrer' } : {}) });
      const drawn = drawIcon(doc, icon, { ...LINK_ICONS, ...context.icons });
      if (drawn) a.append(drawn);
      // The link is the person's, never the row's press.
      a.addEventListener('click', (event) => event.stopPropagation());
      return a;
    };
    return [
      el(
        'span',
        { class: 'fd-list-links' },
        link(to.call, 'call', fill(words.phoneCallNamed, { number: said }), false),
        link(to.whatsapp, 'chat', fill(words.phoneWhatsAppNamed, { number: said }), true)
      ),
    ];
  }

  function draw(name: string, values: Values, named = ''): Node[] {
    const cell = cellOf(name);
    const value = values[name];
    switch (cell?.widget) {
      case 'image':
      case 'avatar':
        return picture(name, values, cell.widget === 'avatar', named);
      case 'progressbar':
        return bar(name, values);
      case 'tags': {
        const links = Array.isArray(value) ? (value as { label?: string }[]) : [];
        return links.length ? [el('span', { class: 'fd-list-chips' }, ...links.map((link) => el('span', { class: 'fd-list-chip' }, el('bdi', {}, String(link?.label ?? '')))))] : [];
      }
      case 'badge': {
        const pill = pillOf(el, cell, value, words(name, values));
        return pill ? [pill] : [];
      }
    }
    const said = words(name, values);
    const before: Node[] = [];
    const look = cell?.lead?.looks[String(plain(values[cell.lead.field]))];
    const leadIcon = look ? drawIcon(doc, look.icon, context.icons) : null;
    if (leadIcon) {
      leadIcon.setAttribute('aria-hidden', 'true');
      leadIcon.classList.add('fd-list-lead');
      if (look?.colour) leadIcon.style.color = look.colour;
      before.push(leadIcon);
    }
    if (cell?.widget === 'dot' && said) {
      // Its colour by value: the page's own, else its tone, else grey.
      const { colour, tone } = lookOf(cell, value);
      const dot = el('span', { class: 'fd-list-dot', 'aria-hidden': 'true', 'data-tone': colour ? undefined : tone });
      if (colour) dot.style.setProperty('--fd-dot', colour);
      before.push(dot);
    }
    // Each value in its own direction: a phone number or an amount reads left to right on a right-to-left page.
    const after = cell?.widget === 'phone' && cell.options?.['links'] === true ? phoneLinks(value) : [];
    return [...before, el('bdi', {}, said), ...after];
  }

  return {
    words,
    draw,
    pill: (name, values) => pillOf(el, cellOf(name), values[name], words(name, values)),
    picture: (name, values) => pictureOf(values[name]),
    initials,
  };
}

/** A pill for a value, in its column's tones or colours: a card's status. */
export function pillOf(el: El, cell: ListCell | undefined, value: Value | undefined, said: string): HTMLElement | null {
  if (!said) return null;
  const { colour, tone } = lookOf(cell, value);
  const pill = el('span', { class: 'fd-value-badge fd-list-pill', 'data-tone': colour ? undefined : tone }, el('bdi', {}, said));
  if (colour) pill.style.setProperty('--fd-tone', colour);
  return pill;
}

/** A row's own rules, read on its record: its tone, its bold, which of its buttons show. */
export interface RowRules {
  /** The fields they read, which the list asks for with its columns. */
  reads: string[];
  /** Whether the list has any: none, no row is read. */
  any: boolean;
  tone(id: RecordId, values: Values): Tone | null;
  bold(id: RecordId, values: Values): boolean;
  /** Its buttons shown on this record, by their conditions (their roles the form's). */
  buttons(id: RecordId, values: Values): ButtonNode[];
}

/**
 * A list's `rowTones`, `rowBold` and `rowButtons`, each condition read once, on a row's record as `read` gives it — the
 * form's own way (`form.recordReads`): its values, its `id`, the person (`user`) and the app's `context`. `today` is
 * the page's day, for `today()`.
 */
export function rowRules(page: Page, node: ListNode, recordOf: (id: RecordId, values: Values) => Record<string, unknown>, today: () => string, shown: (button: ButtonNode) => boolean): RowRules {
  const read = (modifier: ButtonNode['invisible']): CompiledModifier | null => {
    try {
      return compileModifier(modifier);
    } catch {
      // A condition that cannot be read holds for no row: the page check says why.
      return null;
    }
  };
  const tones = (node.rowTones ?? []).map((item) => ({ tone: item.tone, when: read(item.when) }));
  const bold = node.rowBold === undefined ? null : read(node.rowBold);
  const buttons = (node.rowButtons ?? []).map((button) => ({ button, hidden: read(button.invisible) }));
  const reads = [...new Set([...tones.flatMap((item) => item.when?.fields ?? []), ...(bold?.fields ?? []), ...buttons.flatMap((item) => item.hidden?.fields ?? [])])].filter((name) => page.fields[name]);
  const context = recordOf;
  return {
    reads,
    any: tones.length > 0 || bold !== null || buttons.length > 0,
    tone: (id, values) => (tones.length ? (tones.find((item) => item.when?.evaluate(context(id, values), { today }))?.tone ?? null) : null),
    bold: (id, values) => !!bold?.evaluate(context(id, values), { today }),
    buttons: (id, values) => buttons.filter(({ button, hidden }) => shown(button) && !hidden?.evaluate(context(id, values), { today })).map(({ button }) => button),
  };
}
