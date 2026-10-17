import { recordSentence, type DataSource, type Form, type FormState, type ListNode, type Locale, type OpenRequest, type OpenResult, type Page, type PageRecords, type RecordId, type RelatedNode, type ResolvedFilter, type RunResult, type Tone, type Values } from '@fieldia/core';
import { formatNumber, whileShown, type IconSet, type PreferenceStore, type WidgetDialogs } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import { listView, type ListContext, type ListView } from './list';
import { installListStyles } from './list-styles';

/** What a related list is drawn with: the viewer's, its dialogs of the app's pages and its host's way to open a page. */
export interface RelatedContext {
  /** The record's page as it is shown (its language, the app's translator): its time zone, phones and look are the list's. */
  page: Page;
  node: RelatedNode;
  form: Form;
  dataSource: DataSource | undefined;
  /** The viewer's box for it, sized and hidden by its own rules there: the list draws inside it. */
  box: HTMLElement;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  press: (button: HTMLElement, run: () => Promise<RunResult>) => Promise<void>;
  withIcon: (icon: string | undefined, text: string) => (Node | string)[];
  uid: (id: string) => string;
  icons?: IconSet | undefined;
  preferences: PreferenceStore;
  now?: (() => Date) | undefined;
  say: (message: string, tone: Tone) => void;
  /** The record shown, by its name: what a new record's link to it is labelled. */
  name(): string;
  /**
   * A record in a dialog of the page the app gives for its model: a row's record, and New's. Where it gives none for
   * the related model, rows do not open and there is no New.
   */
  dialogs: Pick<WidgetDialogs, 'canOpen' | 'openRecord'>;
  /** A page opened as an `open` step opens one — the app's own way (`onOpen`) first: View all's. */
  open: (request: OpenRequest) => Promise<OpenResult>;
  /**
   * What the app's page for a model calls its records (its `records`, in this page's language), now or once it is
   * found: "New invoice", "View all invoices", "No invoices yet". Nothing named without it.
   */
  recordsOf?: (model: string) => PageRecords | undefined | Promise<PageRecords | undefined>;
}

/** A related list drawn: told each state of the form, as a part of the page is. */
export interface RelatedPart {
  update(state: FormState): void;
  /** Ask for the records again, keeping the page, the order and the search. */
  reload(): Promise<void>;
  destroy(): void;
}

/**
 * A related list's records as a list page of their own: their model and fields, its columns, cells, cards, rows'
 * tones, bold and buttons, order and search, a page of `limit` rows (5 unless said), nothing to choose; the time zone, phones, look and language of the record's
 * page, which they are shown in.
 */
export function relatedListPage(page: Page, node: RelatedNode, records?: PageRecords): Page {
  const layout: ListNode = {
    type: 'list',
    // Its own id: the part's is its box's, which holds it.
    id: `${node.id}-list`,
    columns: node.columns,
    choose: false,
    pageSize: node.limit ?? 5,
    ...(node.sort ? { sort: node.sort } : {}),
    ...(node.cells ? { cells: node.cells } : {}),
    // On a phone its rows are cards, as a list's: the cards part draws them, its table's own rows.
    ...(node.card ? { card: node.card } : {}),
    // Its rows' tones, bold and buttons, as a list's, read on each row's record; a button runs with that record alone.
    ...(node.rowTones ? { rowTones: node.rowTones } : {}),
    ...(node.rowBold !== undefined ? { rowBold: node.rowBold } : {}),
    ...(node.rowButtons ? { rowButtons: node.rowButtons } : {}),
    ...(node.searchFields ? { searchFields: node.searchFields } : {}),
  };
  return {
    fieldia: page.fieldia,
    id: `${page.id}.${node.id}`,
    ...(node.title ? { title: node.title } : {}),
    data: { kind: 'record', model: node.model },
    fields: node.fields,
    layout,
    ...(page.language ? { language: page.language } : {}),
    ...(page.look ? { look: page.look } : {}),
    ...(page.phone ? { phone: page.phone } : {}),
    ...(page.timeZone ? { timeZone: page.timeZone } : {}),
    // Its records named as their own page names them: "5 of 23 invoices".
    ...(records ? { records } : {}),
  };
}

/**
 * Another model's records that point at the record shown — a customer's invoices — in the viewer's box for them: a
 * heading with their title, how many there are, View all and New; then the list itself, drawn by the list part's own
 * table (list.ts) with the record's link as a condition every search keeps, a page of rows at a time, its search and
 * pager once the rows run past a page. Before the record's first save it says nothing points at it yet, with no New
 * and no View all. Each ask is for the record shown as it is asked (`form.recordShown()`): another record shown, the
 * same loaded again, the person's Discard — the answer is drawn in none, and the records are asked for again.
 */
export function relatedList(context: RelatedContext): RelatedPart {
  const { node, form, el, labels, fill, box, doc, locale, dialogs } = context;
  installListStyles(doc);
  // Its records open, and New makes one, in a dialog of the page the app gives for their model; View all opens its page.
  const opens = dialogs.canOpen(node.model);
  const openRecord = opens ? (id: RecordId, name?: string) => dialogs.openRecord(node.model, { recordId: id, title: name || node.title || node.model }) : undefined;
  /** What its model's records are called, once known: New, View all and None name them ("New invoice"). */
  let records: PageRecords | undefined;
  const ofModel = (noun: string | undefined, words: string) => recordSentence(records, noun, words, locale);
  // Kept to a part of them (its own `filter`: only posted invoices), "all" and "no" of them would be untrue: its title says which.
  const part = !!node.filter?.length;
  const newRecord =
    opens && node.create !== false
      ? async (values: Values) => (await dialogs.openRecord(node.model, { values, title: records?.one ? ofModel(labels.relatedNewNoun, labels.relatedNew) : node.title ? fill(labels.relatedNewOf, { title: node.title }) : labels.newRecord })) !== null
      : undefined;
  const { viewAll } = node;
  const showAll = viewAll ? (filter: ResolvedFilter[]) => context.open({ page: viewAll.page, as: viewAll.as ?? 'dialog', filter }) : undefined;
  let page = relatedListPage(context.page, node);
  // Its count in a pill after the title, read out with it as the group's name: "Invoices, 12".
  const count = el('span', { class: 'fd-related-count', 'aria-hidden': 'true', hidden: '' });
  const title = node.title ? el('span', { class: 'fd-related-title' }, ...context.withIcon(node.icon, node.title), count) : null;
  const named = (template: string, plain: string) => (node.title ? fill(template, { title: node.title }) : plain);
  const all = showAll ? el('button', { type: 'button', class: 'fd-button fd-button-link fd-related-all', hidden: '', 'aria-label': node.title ? named(labels.relatedAllOf, labels.relatedAll) : undefined }, labels.relatedAll) : null;
  const add = newRecord ? el('button', { type: 'button', class: 'fd-button fd-button-secondary fd-related-new', hidden: '', 'aria-label': node.title ? named(labels.relatedNewOf, labels.relatedNew) : undefined }, labels.relatedNew) : null;
  const tools = el('span', { class: 'fd-related-tools' }, ...(all ? [all] : []), ...(add ? [add] : []));
  const head = el('div', { class: 'fd-related-head' }, ...(title ? [title] : []), tools);
  // Its buttons show once the record is saved: until then, a heading only for its title.
  head.hidden = !title;
  const note = el('p', { class: 'fd-related-note', hidden: '' }, recordSentence(context.page.records, labels.relatedUnsavedNoun, labels.relatedUnsaved, locale));
  const holder = el('div', { class: 'fd-related-list' });
  box.classList.add('fd-related');
  /** The group's name: its title, and once counted how many it holds. */
  const nameAs = (n: number | null) => {
    if (!node.title) return;
    box.setAttribute('aria-label', n === null ? node.title : fill(labels.countOf, { label: node.title, count: formatNumber(n, 0, locale) }));
  };
  if (title) box.setAttribute('role', 'group');
  nameAs(null);
  box.append(head, note, holder);

  /** The list for the record shown; made again for another record, so its page, order and search start afresh. */
  let list: ListView | null = null;
  /** The record it lists for. */
  let listsFor: RecordId | null = null;
  /** What it last asked, and whether the record it asked for is still shown as it was. */
  let asked: { key: string; shown: () => boolean } | null = null;
  let gone = false;

  const listContext: ListContext = {
    page,
    node: page.layout as ListNode,
    form,
    dataSource: context.dataSource,
    doc,
    el,
    labels,
    locale,
    fill,
    press: context.press,
    withIcon: context.withIcon,
    uid: context.uid,
    preferences: context.preferences,
    inRecord: true,
    none: labels.relatedNone,
    fixedFilter: [],
    shown: () => form.recordShown(),
    onCount(total, searched) {
      // Its height held while another record's list came: let go once it has.
      holder.style.minHeight = '';
      if (searched) return;
      count.textContent = formatNumber(total, 0, locale);
      count.hidden = false;
      nameAs(total);
    },
    say: context.say,
    ...(context.icons ? { icons: context.icons } : {}),
    ...(context.now ? { now: context.now } : {}),
    ...(openRecord ? { onOpenRecord: openRecord } : {}),
  };

  /**
   * Its words in the names its model's page gives its records, once known: New and View all say them — their title
   * then needless as their name — None yet too, and the list made for the next record counts them ("5 of 23 invoices").
   */
  function nameRecords(given: PageRecords | undefined) {
    // A page that only asks for its labels small names no records.
    if (!given?.one) return;
    records = given;
    page = relatedListPage(context.page, node, given);
    listContext.page = page;
    if (!part) listContext.none = ofModel(labels.relatedNoneNoun, labels.relatedNone);
    if (add) {
      add.textContent = ofModel(labels.relatedNewNoun, labels.relatedNew);
      add.removeAttribute('aria-label');
    }
    if (all && !part) {
      all.textContent = ofModel(labels.relatedAllNoun, labels.relatedAll);
      all.removeAttribute('aria-label');
    }
  }
  const known = context.recordsOf?.(node.model);
  if (known instanceof Promise) void known.then((given) => gone || nameRecords(given), () => undefined);
  else nameRecords(known);

  /** The list for the record shown now: a new one for a record it was not listing, else its records asked again. */
  function ask(filter: ResolvedFilter[], id: RecordId) {
    listContext.fixedFilter = filter;
    if (list && listsFor === id) return void list.reload();
    // Another record: what it showed goes (its count too, never another record's), its room kept until the next has come.
    if (list) holder.style.minHeight = `${holder.offsetHeight}px`;
    list?.destroy();
    count.hidden = true;
    nameAs(null);
    list = listView(listContext);
    listsFor = id;
    holder.replaceChildren(list.element);
  }

  function update(state: FormState) {
    if (gone) return;
    // The record's values are on their way: its records are asked for once they have come.
    if (state.status === 'idle' || state.status === 'loading') return;
    const filter = form.relatedFilter(node.id);
    const saved = filter !== null && state.recordId != null;
    note.hidden = saved;
    holder.hidden = !saved;
    if (all) all.hidden = !saved;
    if (add) add.hidden = !saved;
    // A heading with nothing in it shows none: no title, and its buttons hidden before a first save.
    head.hidden = !title && !(saved && (all || add));
    if (!saved) {
      list?.destroy();
      list = null;
      listsFor = null;
      asked = null;
      count.hidden = true;
      nameAs(null);
      holder.replaceChildren();
      return;
    }
    // Hidden by its own condition, or from a person outside its roles: asked for once it shows.
    if (form.node(node.id).invisible) return;
    // Asked already for this record as it is: nothing new. Another shown, loaded again, its Discard: asked again.
    const key = JSON.stringify(filter);
    if (asked && asked.key === key && asked.shown()) return;
    asked = { key, shown: form.recordShown() };
    ask(filter, state.recordId as RecordId);
  }

  /** Its records asked again, while the record they were asked for is still the one shown. */
  const again = () => whileShown(form, () => void list?.reload());

  add?.addEventListener('click', async () => {
    const id = form.getState().recordId;
    if (id == null || !newRecord || add.hasAttribute('aria-busy')) return;
    const back = again();
    add.setAttribute('aria-busy', 'true');
    try {
      if (await newRecord({ [node.field]: { id, label: context.name() } })) back();
    } finally {
      add.removeAttribute('aria-busy');
    }
  });
  all?.addEventListener('click', async () => {
    const filter = form.relatedFilter(node.id);
    if (!filter || !showAll || all.hasAttribute('aria-busy')) return;
    const back = again();
    all.setAttribute('aria-busy', 'true');
    try {
      await showAll(filter);
    } catch (error) {
      // A page the app does not have: said, as an `open` step says it.
      context.say((error as Error).message, 'danger');
    } finally {
      all.removeAttribute('aria-busy');
    }
    back();
  });

  return {
    update,
    reload: async () => {
      await list?.reload();
    },
    destroy() {
      gone = true;
      list?.destroy();
    },
  };
}
