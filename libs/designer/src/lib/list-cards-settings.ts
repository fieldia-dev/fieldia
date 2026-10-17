import { cardLines, type Field, type ListCard, type ListGallery, type ListNode, type Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { openMenu } from './menu';

/**
 * A list's cards in its panel, beside its map and its calendar: each record
 * as a card on a phone, a gallery of cards on the switcher (and whether the
 * list opens on it, its cards' size), and what a card shows — its title, the
 * words under it, its picture, its status pill and its lines, the columns'
 * where it says nothing. A related list's panel has the same, but for the
 * gallery: its records on a phone as cards, of its own fields.
 */

/** Fields a card's words can come from. */
const SAYABLE = new Set(['char', 'text', 'selection', 'many2one', 'many2many', 'integer', 'float', 'monetary', 'date', 'datetime', 'boolean']);
/** Fields a card's picture can come from: a picture held, or text holding its address. */
const PICTURES = new Set(['image', 'binary', 'char']);
/** Fields a status pill can come from: values that repeat. */
const STATUSES = new Set(['selection', 'many2one', 'char', 'boolean']);
const SIZES = ['small', 'medium', 'large'] as const;

const listOf = (page: Page) => page.layout as ListNode;

/** Where a card's settings are kept: a list page's list (and its gallery), or a related list of a record's page. */
export interface CardsSource {
  /** Its card as the page holds it: none for no cards. */
  card(page: Page): ListCard | undefined;
  /** Its card changed (null: no cards); false where the change was refused. */
  setCard(card: ListCard | null): boolean;
  /** The fields a card may show, of the kinds asked: a list's page's and its model's, a related list's own. */
  fields(page: Page, kinds: ReadonlySet<string>): { name: string; field: Field }[];
  /** Its gallery, where it has one to offer: a list page's. */
  gallery?: { get(page: Page): ListGallery | undefined; set(gallery: ListGallery | null): boolean };
}

/** A list page's cards and gallery, in its panel. */
export function cardsSection(el: ElementFactory, designer: Designer) {
  return cardSettings(el, designer, {
    card: (page) => listOf(page).card,
    setCard: (card) => designer.setListOptions({ card }),
    // The page's fields first, then the model's not on it yet.
    fields: (page, kinds) => [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()].filter(({ field }) => kinds.has(field.type)),
    gallery: { get: (page) => listOf(page).gallery, set: (gallery) => designer.setListOptions({ gallery }) },
  });
}

/** A card's settings — each record as a card on a phone, and, where offered, a gallery — over where they are kept. */
export function cardSettings(el: ElementFactory, designer: Designer, source: CardsSource) {
  const w = designer.words.list.cards;
  const words = designer.words.list;
  const prop = (text: string, control: HTMLElement) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
  const select = (label: string) => el('select', { class: 'fd-input fd-select', 'aria-label': label }) as HTMLSelectElement;
  const tick = (label: string) => el('input', { type: 'checkbox', 'aria-label': label }) as HTMLInputElement;
  const onPhone = tick(w.onPhone);
  const gallery = tick(w.gallery);
  const opens = tick(w.opens);
  const size = select(w.size);
  size.append(...SIZES.map((value) => el('option', { value }, w.sizes[value])));
  const heading = select(w.heading);
  const under = select(w.under);
  const picture = select(w.picture);
  const status = select(w.status);
  const lines = el('div', { class: 'fd-chips' });
  const addLine = el('button', { type: 'button', class: 'fd-button' }, words.addToCard);
  const labels = tick(words.cardLabels);
  const lead = tick(words.cardLead);
  const galleryRows = el('div', { class: 'fd-props' }, el('label', { class: 'fd-q-required' }, opens, el('span', {}, w.opens)), prop(w.size, size));
  const details = el(
    'div',
    { class: 'fd-props' },
    prop(w.heading, heading),
    prop(w.under, under),
    prop(w.picture, picture),
    prop(w.status, status),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, words.cardShows), lines, addLine),
    el('label', { class: 'fd-q-required' }, labels, el('span', {}, words.cardLabels)),
    el('label', { class: 'fd-q-required' }, lead, el('span', {}, words.cardLead)),
    el('p', { class: 'fd-properties-hint' }, w.note)
  );
  const offersGallery = source.gallery;
  const element = el(
    'div',
    { class: 'fd-prop', 'data-part': 'cards' },
    // In a list's panel, under a heading of its own; a related list's is a setting row, named by it.
    ...(offersGallery ? [el('span', { class: 'fd-prop-name' }, w.title)] : []),
    el('label', { class: 'fd-q-required' }, onPhone, el('span', {}, w.onPhone)),
    ...(offersGallery ? [el('label', { class: 'fd-q-required' }, gallery, el('span', {}, w.gallery)), galleryRows] : []),
    details
  );

  const fieldsOf = (page: Page, kinds: ReadonlySet<string>) => source.fields(page, kinds);
  const fill = (box: HTMLSelectElement, choices: { name: string; field: Field }[], none: string) =>
    box.replaceChildren(el('option', { value: '' }, none), ...choices.map(({ name, field }) => el('option', { value: name }, field.label)));
  const card = (): ListCard => JSON.parse(JSON.stringify(source.card(designer.getPage()) ?? {})) as ListCard;
  /** The card with a change, its empty parts left out: `{}` takes it all from the columns. */
  const change = (edit: (next: ListCard) => void) => {
    const next = card();
    edit(next);
    for (const key of Object.keys(next) as (keyof ListCard)[]) if (next[key] === '' || next[key] === undefined || (Array.isArray(next[key]) && !(next[key] as unknown[]).length)) delete next[key];
    return source.setCard(next);
  };
  const galleryChange = (edit: (next: ListGallery) => void) => {
    const next = { ...offersGallery?.get(designer.getPage()) };
    edit(next);
    return offersGallery?.set(next) ?? false;
  };

  onPhone.addEventListener('change', () => source.setCard(onPhone.checked ? card() : null));
  gallery.addEventListener('change', () => offersGallery?.set(gallery.checked ? {} : null));
  opens.addEventListener('change', () => galleryChange((next) => (opens.checked ? (next.opens = 'gallery') : delete next.opens)));
  size.addEventListener('change', () => galleryChange((next) => (size.value === 'medium' ? delete next.size : (next.size = size.value as ListGallery['size']))));
  heading.addEventListener('change', () => change((next) => (next.title = heading.value || undefined)));
  under.addEventListener('change', () => change((next) => (next.subtitle = under.value || undefined)));
  picture.addEventListener('change', () => change((next) => (next.image = picture.value || undefined)));
  status.addEventListener('change', () => change((next) => (next.status = status.value || undefined)));
  // Shown unless said, as a map card's labels; the first line leads only when asked.
  labels.addEventListener('change', () => change((next) => (next.labels = labels.checked ? undefined : false)));
  lead.addEventListener('change', () => change((next) => (next.lead = lead.checked || undefined)));
  addLine.addEventListener('click', () => {
    const page = designer.getPage();
    const now = card().fields ?? [];
    const shown = new Set(cardLines({ fields: now }).flatMap((parts) => parts.map((part) => part.field)));
    openMenu({
      el,
      anchor: addLine,
      title: words.cardShows,
      items: fieldsOf(page, SAYABLE)
        .filter(({ name }) => !shown.has(name))
        .map(({ name, field }) => ({ id: name, label: field.label })),
      onPick: (name) => change((next) => (next.fields = [...now, name])),
    });
  });

  return {
    element,
    update(page: Page) {
      const shown = source.card(page);
      const galleryNow = offersGallery?.get(page);
      onPhone.checked = !!shown;
      gallery.checked = !!galleryNow;
      galleryRows.hidden = !galleryNow;
      opens.checked = galleryNow?.opens === 'gallery';
      size.value = galleryNow?.size ?? 'medium';
      // What a card shows, where the list has cards or a gallery.
      details.hidden = !shown && !galleryNow;
      const shows = shown ?? {};
      fill(heading, fieldsOf(page, SAYABLE), w.fromColumns);
      heading.value = shows.title ?? '';
      fill(under, fieldsOf(page, SAYABLE), w.nothing);
      under.value = shows.subtitle ?? '';
      fill(picture, fieldsOf(page, PICTURES), w.fromColumns);
      picture.value = shows.image ?? '';
      fill(status, fieldsOf(page, STATUSES), w.fromColumns);
      status.value = shows.status ?? '';
      // Each line a chip: a field, or several on one line, named by their labels.
      const now = shows.fields ?? [];
      lines.replaceChildren(
        ...cardLines({ fields: now }).map((parts, i) => {
          const labelled = new Map(fieldsOf(page, SAYABLE).map(({ name, field }) => [name, field.label]));
          const named = parts.map((part) => page.fields[part.field]?.label ?? labelled.get(part.field) ?? part.field).join(' · ');
          const remove = el('button', { type: 'button', class: 'fd-chip-remove', 'aria-label': words.takeOffCard(named) }, '×');
          remove.addEventListener('click', () => change((next) => (next.fields = now.filter((_, j) => j !== i))));
          return el('span', { class: 'fd-chip' }, named, remove);
        })
      );
      labels.checked = shows.labels !== false;
      lead.checked = !!shows.lead;
    },
  };
}
