import { displayValue, drawIcon, type IconSet } from '@fieldia/widgets';
import type { ButtonNode, FieldNode, Form, FormState, HeadLink, LabelPlace, LayoutNode, LineField, Locale, MenuItem, Page, RootLayout, RunResult, SheetHead, SheetNode, Tone, Values } from '@fieldia/core';
import { setAttr, setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import type { Place } from './place';
import { recordMenu } from './record-bar';
import { installHeadStyles } from './head-styles';

/**
 * A record's head as a work tracker draws a work item's (`SheetHead`): the
 * kind's strip of colour along its start edge and the badge over the title —
 * the kind's icon, its name in capitals, the record's number — with room at
 * the badge row's end for a dialog's ⤢ and ×; the title line, the number
 * before the title, a Copy title button at its end while it is pointed at or
 * focused; the row of people and links, the record's buttons and ⋮ at its
 * end; then the band of fields, labels beside them, a lead slot before each
 * value (a state's dot, a lock), "Updated by" and the tabs placed in the head
 * at its end. Plain DOM, drawn with the viewer's own parts.
 */

export interface RecordHeadContext {
  doc: Document;
  el: El;
  form: Form;
  page: Page;
  sheet: SheetNode;
  head: SheetHead;
  labels: ViewerLabels;
  locale: Locale;
  icons?: IconSet;
  uid(id: string): string;
  fill(template: string, values: Record<string, string | number>): string;
  withIcon(name: string | undefined, text: string): (Node | string)[];
  press(button: HTMLElement, run: () => Promise<RunResult>): Promise<void>;
  say(message: string, tone: Tone): void;
  /** A field as the viewer draws one, where labels sit and what its group says of the quiet look. */
  fieldItem(node: FieldNode, place?: LabelPlace, around?: Pick<Place, 'quiet' | 'reason'>): HTMLElement;
  /** Any part, as the viewer draws one where it sits. */
  item(node: LayoutNode, place: Place): HTMLElement;
  buttonItem(node: ButtonNode): HTMLElement;
  /** Its updater, run at every change of the form. */
  watch(update: (state: FormState) => void): void;
  cleanups: (() => void)[];
  /** Show a tab by its id: false when it is hidden. */
  showTab(id: string): boolean;
  /** Unfold a folded group the part is in. */
  unfold(part: HTMLElement): void;
  /** The form's element, where its parts are found. */
  root(): HTMLElement;
}

export interface RecordHead {
  element: HTMLElement;
  /** Where the tabs placed in the head go: at the band's bottom end. */
  tabs: HTMLElement;
  /** Where a dialog puts its ⤢ and ×: the badge row's end. */
  window: HTMLElement;
}

/** The record's kind now: its look, its words, its number. */
interface KindNow {
  key: string;
  colour: string | null;
  icon: string | undefined;
  words: string;
}

export function recordHead(context: RecordHeadContext): RecordHead {
  const { el, form, page, sheet, head, labels, doc } = context;
  installHeadStyles(doc);
  const id = context.uid('head');
  const watch = context.watch;

  // ---- the white part: the strip, the badge row, the title line, the row ----
  const strip = el('span', { class: 'fd-head-strip', 'aria-hidden': 'true' });
  const badgeWords = el('bdi', { class: 'fd-head-badge-words' });
  const badgeIcon = el('span', { class: 'fd-head-badge-icon', 'aria-hidden': 'true' });
  const badge = el('span', { class: 'fd-head-badge', id: `${id}-badge`, 'data-head-name': '' }, badgeIcon, badgeWords);
  const windowSlot = el('span', { class: 'fd-head-window' });
  const badgeRow = el('div', { class: 'fd-head-badge-row' }, head.kind ? badge : el('span'), windowSlot);
  const top = el('div', { class: 'fd-head-top' }, strip, badgeRow);

  // The title line: the number and what else stands before it, the title, its Copy button.
  const title = sheet.title;
  if (title) {
    const line = el('div', { class: 'fd-head-title' });
    // The record's number stands as words, as an id does: never grouped, never a box to type in.
    const numberField = head.kind?.numberField;
    const side = (part: FieldNode) => {
      if (part.field === numberField) {
        const words = el('span', { class: 'fd-head-number', 'data-node': part.id });
        watch((state) => {
          setHidden(words, form.node(part.id).invisible);
          setText(words, numberWords(state));
        });
        return words;
      }
      const drawn = context.fieldItem(part, 'hidden');
      drawn.classList.add('fd-title-side');
      return drawn;
    };
    const name = context.fieldItem({ type: 'field', id: '#title', field: title.field, placeholder: title.placeholder, ...(title.placeholderWhen ? { placeholderWhen: title.placeholderWhen } : {}), ...(title.focus ? { focus: true } : {}) }, 'hidden');
    name.classList.add('fd-title-name');
    line.append(...(title.before ?? []).map(side), name);
    // The record's name for a dialog round it: its title's words, kept up to date, out of sight.
    const named = el('span', { class: 'fd-sr-only', id: `${id}-title`, 'data-head-name': '' });
    watch((state) => setText(named, String(state.values[title.field] ?? '')));
    if (head.copyTitle !== false) {
      const copy = el('button', { type: 'button', class: 'fd-head-copy', 'aria-label': labels.copyTitle, title: labels.copyTitle });
      const icon = drawIcon(doc, 'copy', context.icons);
      if (icon) copy.append(icon);
      copy.addEventListener('click', () => void copyTitle(String(form.getState().values[title.field] ?? '')));
      line.append(copy);
    }
    line.append(...(title.after ?? []).map(side), named);
    top.append(line);
  }

  const row = el('div', { class: 'fd-head-row' });
  const meta = el('div', { class: 'fd-head-meta' }, ...(head.meta ?? []).map((part) => (part.type === 'link' ? headLink(part) : context.fieldItem(part, 'hidden'))));
  const actions = el('div', { class: 'fd-head-actions' }, ...(head.actions ?? []).map((button) => context.buttonItem(button)));
  // The record's gear menu, as ⋮ at the end.
  const menu = sheet.toolbar?.menu ?? [];
  if (menu.length) {
    const updaters: (() => void)[] = [];
    actions.append(recordMenu({ doc, el, form, labels, uid: context.uid, withIcon: context.withIcon, press: context.press }, menu as MenuItem[], updaters, context.cleanups, 'more'));
    watch(() => updaters.forEach((update) => update()));
  }
  row.append(meta, actions);
  top.append(row);

  // ---- the band: its fields, "Updated by", the tabs ----
  const band = head.band;
  const fields = el('div', { class: 'fd-head-fields' });
  const tracks = band?.tracks ?? ['1fr', '1fr'];
  fields.style.setProperty('--fd-head-tracks', tracks.join(' '));
  if (band?.labelWidth) fields.style.setProperty('--fd-head-label', `${band.labelWidth}px`);
  fields.append(...(band?.children ?? []).map((child) => context.item(child, { columns: tracks.length, onPage: false, labels: 'beside', quiet: true })));
  const aside = el('div', { class: 'fd-head-aside' });
  const updated = head.updated ? updatedBy(head.updated) : null;
  if (updated) aside.append(updated);
  const tabs = el('div', { class: 'fd-head-tabs' });
  aside.append(tabs);
  const bandBox = el('div', { class: 'fd-head-band' }, fields, aside);
  const element = el('div', { class: 'fd-head', id }, top, bandBox);

  // The kind's look, words and number, kept up to date.
  if (head.kind) {
    let drawnIcon = '';
    watch((state) => {
      const now = kindNow(state);
      // Its kind by the field's value; one kind with a colour of its own is a kind too, its strip shown.
      setAttr(element, 'data-kind', now.key || (now.colour ? '' : null));
      if (now.colour) element.style.setProperty('--fd-kind', now.colour);
      else element.style.removeProperty('--fd-kind');
      if (now.icon !== drawnIcon) {
        drawnIcon = now.icon ?? '';
        badgeIcon.replaceChildren(...[drawIcon(doc, now.icon, context.icons)].filter((icon): icon is SVGSVGElement => !!icon));
      }
      setText(badgeWords, now.words);
    });
  }

  return { element, tabs, window: windowSlot };

  /** The kind the record is now, as its field holds it, else the one kind the head names. */
  function kindNow(state: FormState): KindNow {
    const kind = head.kind ?? {};
    const value = kind.field ? state.values[kind.field] : undefined;
    const def = kind.field ? page.fields[kind.field] : undefined;
    const key = value === null || value === undefined ? '' : typeof value === 'object' && !Array.isArray(value) && 'id' in value ? String((value as { id: unknown }).id) : String(value);
    const look = key ? kind.looks?.[key] : undefined;
    const label = def && key ? displayValue(def as LineField, value, state.values as Values, context.locale) : '';
    const words = [(label || kind.label || '').toLocaleUpperCase(context.locale), numberWords(state)].filter(Boolean).join(' ');
    return { key, colour: look?.colour ?? kind.colour ?? null, icon: look?.icon ?? kind.icon, words };
  }

  /** The record's number as an id is written: its field's value as it is, else the record's id; nothing for a new record. */
  function numberWords(state: FormState): string {
    const field = head.kind?.numberField;
    const value = field ? state.values[field] : state.recordId;
    return value === null || value === undefined || value === '' ? '' : String(value);
  }

  /** "1 Comment": the number, then its words in the plural it needs; a press takes the reader to its part, or runs its steps. */
  function headLink(link: HeadLink): HTMLElement {
    const words = el('span', { class: 'fd-head-link-words' });
    // Going nowhere and doing nothing, it is its words alone, never a button that does nothing.
    const acts = !!link.target || !!link.steps?.length;
    const button = el(acts ? 'button' : 'span', { ...(acts ? { type: 'button' } : {}), class: 'fd-head-link', 'data-node': link.id }, ...[drawIcon(doc, link.icon, context.icons)].filter((icon): icon is SVGSVGElement => !!icon), words);
    const plural = new Intl.PluralRules(context.locale);
    button.addEventListener('click', () => {
      if (link.steps?.length) void context.press(button, () => form.runAction(link.id));
      if (link.target) reveal(link.target);
    });
    watch((state) => {
      setHidden(button, form.node(link.id).invisible);
      const raw = state.values[link.field];
      const count = typeof raw === 'number' ? raw : Number(raw ?? 0) || 0;
      const form_ = plural.select(count) as keyof HeadLink['words'];
      setText(words, `${count} ${link.words[form_] ?? link.words.other}`);
    });
    return button;
  }

  /** "Updated by Mona Adel: Aug 25", from who changed it and when; a press shows the tab it opens. */
  function updatedBy(updated: NonNullable<SheetHead['updated']>): HTMLElement {
    const tag = updated.opens ? 'button' : 'span';
    const box = el(tag, { class: 'fd-head-updated', ...(tag === 'button' ? { type: 'button' } : {}) });
    if (updated.opens) {
      const opens = updated.opens;
      box.addEventListener('click', () => {
        if (!context.showTab(opens)) return;
        context.root().querySelector<HTMLElement>(`.fd-tab[data-node="${opens}"]`)?.focus();
      });
    }
    watch((state) => {
      const who = displayValue(page.fields[updated.byField] as LineField, state.values[updated.byField], state.values as Values, context.locale);
      const at = state.values[updated.atField];
      const when = typeof at === 'string' && at ? shortDate(at, context.locale) : '';
      setHidden(box, !who || !when);
      setText(box, who && when ? context.fill(labels.updatedBy, { name: who, date: when }) : '');
    });
    return box;
  }

  /** Copy the title's words, and say so; where the clipboard is out of reach, by the page's own copy. */
  async function copyTitle(words: string) {
    const clipboard = doc.defaultView?.navigator.clipboard;
    const done = clipboard ? await clipboard.writeText(words).then(() => true, () => pageCopy(words)) : pageCopy(words);
    if (done) context.say(labels.titleCopied, 'info');
  }

  /** The page's own copy, where the clipboard is out of reach: the words selected out of sight, the focus put back. */
  function pageCopy(words: string): boolean {
    const was = doc.activeElement as HTMLElement | null;
    const box = el('textarea', { class: 'fd-sr-only', 'aria-hidden': 'true', tabindex: '-1' });
    box.value = words;
    doc.body.append(box);
    box.select();
    let done = false;
    try {
      done = doc.execCommand('copy');
    } catch {
      // Not even that: nothing is said.
    }
    box.remove();
    was?.focus();
    return done;
  }

  /** Take the reader to a part: the tabs it is in shown, the groups it is in unfolded, scrolled into view, its first box focused. */
  function reveal(target: string) {
    for (const tab of tabsAround(page.layout, target)) context.showTab(tab);
    // An id is letters, digits, dots, dashes and underscores: nothing to escape in a selector's quotes.
    const part = context.root().querySelector<HTMLElement>(`[data-node="${target}"]`);
    if (!part) return;
    context.unfold(part);
    part.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    const first = part.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, [contenteditable="true"], button, [tabindex="0"]');
    (first ?? part).focus?.({ preventScroll: true });
  }
}

/** The tabs a part stands in, outermost first, by their ids; none when it stands in no tab. */
export function tabsAround(root: RootLayout, target: string): string[] {
  const search = (nodes: readonly LayoutNode[], around: string[]): string[] | null => {
    for (const node of nodes) {
      if (node.id === target) return around;
      if (node.type === 'section') {
        const found = search(node.children, around);
        if (found) return found;
      }
      if (node.type === 'tabs') {
        for (const tab of node.children) {
          if (tab.id === target) return [...around, tab.id];
          const found = search(tab.children, [...around, tab.id]);
          if (found) return found;
        }
      }
    }
    return null;
  };
  if (root.type === 'list') return [];
  if (root.type === 'tabs') return search([root], []) ?? [];
  const nodes = root.type === 'wizard' ? root.children.flatMap((step) => step.children) : root.children;
  return search(nodes, []) ?? [];
}

/** A date as a work item's head says it: "Aug 25", with its year when that is not this year's. */
export function shortDate(iso: string, locale: Locale, now = new Date()): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(day.getTime())) return iso;
  const year = day.getFullYear() !== now.getFullYear();
  // Arabic in Latin digits, as the rest of a record's dates are written.
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : locale;
  return new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }).format(day);
}
