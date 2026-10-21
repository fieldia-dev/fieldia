import {
  createForm,
  callsPartFunctions,
  checkPage,
  functionsPart,
  isRightToLeft,
  localizePage,
  translatePage,
  wideColumns,
  type ActionHost,
  type ActionStep,
  type ButtonNode,
  type FieldNode,
  type FormEvents,
  type Form,
  type FormOptions,
  type FormState,
  type JsonValue,
  type LayoutNode,
  type Page,
  type Skin,
  type Theme,
  type RecordId,
  type Facet,
  type ResolvedFilter,
  type SectionNode,
  type SectionsNode,
  type SheetNode,
  type SlotNode,
  type TabsNode,
  type TabNode,
  type TextNode,
  type DividerNode,
  type SpacerNode,
  type ImageNode,
  type FormNode,
  type MapNode,
  type RelatedNode,
  type WizardNode,
  type LabelPlace,
  type LineField,
  type Locale,
  type OpenRequest,
  type OpenResult,
  type RunContext,
  type RunResult,
  type Values,
  type WaitsFor,
  MESSAGES,
  hotkeyWords,
  labelAt,
  recordSentence,
  signedBy,
  uploadGoing,
  workAtRisk,
  type SignedBy,
} from '@fieldia/core';
import { afterPress, browserPreferences, createWidget, dateOrderOf, displayValue, drawIcon, installStyles, quietPart, readsAsText, readText, settleParts, themesPart, wearQuiet, wearsQuiet, wearTheme, WIDGET_LABELS, type IconSet, type Part, type PreferenceStore, type WidgetContext, type WidgetFactory, watchPresses } from '@fieldia/widgets';
import type { SentenceWords } from './sentence-value';
import { brokenBox, describeFailure, focusHeld, reportFailure, type ErrorHandler, type FailureStage, type PartFailure } from '@fieldia/widgets';
import { relatedInTab, upgradePage, zonedPage } from '@fieldia/core';
import { findPage, pageDialogs, type PageFinder } from './related';
import { nameFieldOf } from './name-field';
import type { ListContext, ListViewFactory, OpenRowOptions } from './list';
import type { RelatedCount, RelatedPart } from './list-related';
import { waitingList } from './list-waiting';
import type { MapPartFactory } from './map-part';
import { applyLook, skinFor, wearTokens, type Tokens } from './look';
import { labelPlace, planSection, type Place } from './place';
import { setAttr, setHidden, setText } from './dom';
import { openPage } from './open';
import { sayer } from './say';
import { tabStrip } from './tab-strip';
import { valueWords, type ValueWriter } from './value-words';
import { hotkeyOf, hotkeyOn } from './hotkeys';
import { recordBar, type Breadcrumb, type RecordPager } from './record-bar';
import { attachmentPreview } from './attachment-preview';
import { applyTracks, helpBox, keepTools, loneFieldTools, wordsWithLinks, workHeading, type HeadKit } from './section-head';
import { installRecordStyles } from './record-styles';
import type { RecordHead } from './record-head';
import { isRichButton, nothingToUndo } from './button-parts';
import { answersPart, duplicatesPart, headPart, limitsPart, listPart, owedParts, partsFor, templatesPart, type HeadPart } from './viewer-parts';
import type { LimitsKit } from './limits';
import { filesPart } from '@fieldia/widgets';
import { saveSafety } from './save-safety';
import { steadyPresses } from './steady-press';
import { paperFor, printIntent } from './print';
import { waitWords } from './waiting';
export type { Breadcrumb, RecordPager } from './record-bar';

/** The skins a form is drawn in: underline, outlined, and quiet (see `SKINS`). */
export type { Skin };

import { ownLocale, VIEWER_LABELS, viewerWords, type ViewerLabels } from './labels';
import { keepTabIn } from './focus-trap';
export { VIEWER_LABELS, DEFAULT_LABELS, type ViewerLabels } from './labels';
export type { PageFinder, PageRequest } from './related';

/**
 * Fill a slot with the app's own content. Return a function to clean up. A slot drawn from parts loaded on first use
 * (a work item's Discussion: parts.ts in @fieldia/widgets) names them in `parts`: the page is drawn once they are in.
 * A renderer that throws leaves a small box in the slot; `fail` does the same later, for content that fails after it
 * was drawn (a React or Vue component that threw as it rendered, caught by the binding).
 */
export type SlotRenderer = ((element: HTMLElement, context: SlotContext) => void | (() => void)) & { readonly parts?: readonly Part[] };

/** What a slot's renderer is given: the form, the slot's name, and `fail`, to say its content could not be shown. */
export interface SlotContext {
  form: Form;
  name: string;
  fail(error: unknown): void;
}

export interface ViewerOptions extends Omit<FormOptions, 'page' | 'host'> {
  page: Page;
  /** A form made elsewhere, to share one record between two views. */
  form?: Form;
  /**
   * The skin: `underline`, `outlined`, or `quiet`, whose values read as words
   * until pointed at or entered. The page's own (`look.skin`) when left out,
   * else its theme's (see `THEME_SKINS`), else `underline`.
   */
  skin?: Skin;
  /** A theme in the style of a known design system, over the page's own (`look.theme`). */
  theme?: Theme;
  /**
   * The host's own colours, corners and font, over the skin's, the theme's, the
   * scheme's and the page's: `{ text, surface, accent, … }` (`TOKEN_NAMES`). The
   * supported way to dress a form in an app's theme; a host's own stylesheet
   * rule on the form does the same.
   */
  tokens?: Tokens;
  /** Widgets that replace or add to the built-in ones, by `type` or `type.widget`. */
  widgets?: Record<string, WidgetFactory>;
  /** Other ways a list shows its records, by name: `map` (from @fieldia/map's `mapListViews`) for a list with `map`. */
  listViews?: Record<string, ListViewFactory>;
  /** Draws a page's maps (`type: "map"`): @fieldia/map's `mapParts`. Without it a map shows nothing. */
  maps?: MapPartFactory;
  slots?: Record<string, SlotRenderer>;
  /**
   * Told when a part of the page throws as it is drawn, brought up to date, focused or taken away: a field's widget
   * (the app's own or Fieldia's), a slot, a map, any other part. The part is then a small box that names it ("This
   * field could not be shown: Price"), and the rest of the form goes on working, saving included. The console is told
   * either way. `where` says which part, its field, and what was being done.
   */
  onError?: (error: unknown, where: PartFailure) => void;
  /**
   * The page's language, as a language tag (`ar`, `es`, `pt-BR`): the page's
   * own words in it when the page keeps them, and the viewer's labels,
   * validation messages and widget words in it when Fieldia has them (English,
   * Arabic, German, French; English otherwise — and in the one-tag script,
   * English until the language's own script is loaded: `fieldia.ar.js`, …).
   * A language written right to left runs right to left. The language the
   * page is written in unless said.
   */
  locale?: Locale | (string & {});
  /** Labels that win over the language's defaults. */
  labels?: Partial<ViewerLabels>;
  dir?: 'ltr' | 'rtl';
  /** How a question is asked: a button's `confirm`, and an `ask` step. Defaults to the viewer's own small box. */
  confirm?: (message: string) => Promise<boolean>;
  /** Where a person's choices about the page's look are kept, such as a table's columns. The browser's storage by default. */
  preferences?: PreferenceStore;
  /** False when something around the page saves it, such as a dialog: the page's own Save, Discard and Submit stay hidden. */
  showActions?: boolean;
  /**
   * The app's pages, for the parts that show another page. A saved form placed
   * in this one (a `form` part) is drawn from the page asked for by its id —
   * `{ id, version }` when it keeps to a version; and a link shows its record
   * in a dialog (Create and edit…, and the button that opens the linked
   * record) with the page asked for by the model it points to, `{ model }`.
   * Either a record of pages by key — a model, a page's id, or `id@version`
   * for a version kept to — or a function asked for each, which may answer
   * with a promise: a saved form shows a quiet placeholder until it does.
   */
  pages?: PageFinder;
  /** Pages by the models links point to: what `pages` gives by model, as earlier versions had it. Still read. */
  relatedPages?: Record<string, Page> | ((model: string) => Page | null | undefined);
  /**
   * The app's own icons, or replacements for Fieldia's, by the name a page
   * gives them: the inside of a 24×24 SVG, drawn with lines in the text colour.
   */
  icons?: IconSet;
  /**
   * Keys around the fields. Ctrl+Enter (Cmd+Enter on a Mac) saves, from
   * wherever the cursor is, unless `saveWithCtrlEnter` is false. With
   * `enterMovesToNext`, Enter moves to the next field instead of sending the form. Ctrl+Z (Cmd+Z) takes back the
   * person's last change to the record and Ctrl+Shift+Z or Ctrl+Y makes it again — inside a box typed in, the
   * browser's own undo first — unless `undo` is false.
   */
  keys?: { saveWithCtrlEnter?: boolean; enterMovesToNext?: boolean; undo?: boolean };
  /** A ✓ by a field's label once someone has filled it in and it would pass its checks. */
  showValid?: boolean;
  /** Where a save's progress shows: beside Save (the default), as a toast in a corner, or as a bar across the top. */
  saveStatus?: 'inline' | 'toast' | 'bar';
  /** Show the whole form read-only: every field locked, no Save. Buttons still run. */
  readonly?: boolean;
  /** An Edit button that unlocks a read-only form, and a Done that saves and locks it again. */
  editSwitch?: boolean;
  /**
   * The browser's own ways out — Back, Reload, a tab closed, an address typed — ask first ("Leave site? Changes you
   * made may not be saved.") while the person's work is at risk: every change not saved counts, as nothing saves it
   * on the way out (`workAtRisk` with `changes`). Off unless said, as in 0.20: an app that keeps its own
   * `beforeunload` (`unsavedWork`) goes on as it did. Listened for only while there is work at risk, and no longer
   * once the viewer is destroyed.
   */
  warnOnLeave?: boolean;
  /**
   * The app's own translator, for apps that keep translations by text or by
   * key: every word of the page goes through it. Record data never does.
   */
  translate?: (text: string) => string;
  /**
   * A list page: a row was opened, by a click or by Enter. The app shows the
   * record. When it answers with a promise — the record in a dialog, closed —
   * the list asks for its records again once it settles, and puts the focus
   * back on the row. Anything else it answers is let be.
   */
  onOpenRecord?: (id: RecordId) => unknown;
  /**
   * A list page: one of its other views asked for a new record with these values filled in — a calendar's empty slot
   * pressed, its start and its end. The app shows it; a promise answered, the list asks again once it settles. Without
   * it, the record opens in a dialog with the page `pages` gives for the list's model; with neither, no view offers to
   * make one.
   */
  onNewRecord?: (values: Values) => unknown;
  /** A list page: only the records these conditions let through, whatever is searched — the invoices of one order, opened from it. */
  listFilter?: ResolvedFilter[];
  /**
   * A list page: the search it opens with, as chips a person sees and may take away, in place of its default filters and
   * favourite — a related list's View all, "Customer: Nile Traders" (`OpenRequest.search`).
   */
  listSearch?: Facet[];
  /**
   * What the page's steps ask of the screen, the viewer does itself: a page
   * opened (in a dialog, a side panel, or this form's place, with Back), words
   * said (a toast), a question asked (its own box, or `confirm`), a tab shown.
   * Give any of these to do it your own way; the rest stay the viewer's.
   */
  host?: Partial<ActionHost>;
  /**
   * A page a step opens: answer with how it ended to open it your own way —
   * your router, your own dialog — or with undefined to let the viewer open it.
   */
  onOpen?: (request: OpenRequest) => Promise<OpenResult> | undefined;
  /**
   * The records round this one, for the pager over a record — "3 / 42",
   * Previous and Next — as the list it was opened from has them: their ids in
   * order, or how many there are, where this one is, and the id at a place.
   * Moving saves what changed first, as Flectra does; the form then shows
   * the other record (its `open` event says which). A copy joins them after
   * its record; a record deleted leaves them, the pager moving to the next.
   * Never in a dialog.
   */
  records?: readonly RecordId[] | RecordPager;
  /**
   * The trail to this record, for the breadcrumbs over it: each page before
   * it with its words and what a press does (back to it); the record itself
   * comes last, by its name. A page a step opens in this one's place adds
   * this one to the trail, as the way back. Never in a dialog.
   */
  breadcrumbs?: readonly Breadcrumb[];
}

export interface ViewerHandle {
  readonly form: Form;
  readonly element: HTMLElement;
  setSkin(skin: Skin): void;
  /** Wear another theme; the skin follows it unless the viewer was given one. */
  setTheme(theme: Theme | null): void;
  /** Wear the host's tokens in place of those given before, as when its app turns dark; null takes them off. Dialogs opened after wear them too. */
  setTokens(tokens: Tokens | null): void;
  /** Save the record, or take the focus to the first problem when the form refuses. */
  save(): Promise<boolean>;
  /** Check the form without saving, taking the focus to the first problem. */
  check(): boolean;
  /** Lock or unlock the whole form. */
  setReadonly(readonly: boolean): void;
  isReadonly(): boolean;
  /** Ask the data source again: a list page's records, keeping its page, order and search; else the record, as a reload step does. */
  reload(): Promise<void>;
  /**
   * A list page: open a record as its row's press does — the app's onOpenRecord, the row marked open (aria-current) while
   * it is, then the records again and the focus back on its row — as when the app opens one from its address; there
   * `{ lit: false }` leaves its row unmarked, as no row was pressed. A record page has no rows: nothing happens.
   */
  openRecord(id: RecordId, options?: OpenRowOptions): Promise<void>;
  /** Listen to one of the form's events — change, save, send, action, run, step, open; returns what stops listening. */
  on<E extends keyof FormEvents>(event: E, listener: (event: FormEvents[E]) => void): () => void;
  /** Write several fields at once, as the app: the page's change steps do not run for it. */
  setValues(values: Values): void;
  /** Run steps on the form, as a button would. */
  run(steps: readonly ActionStep[], context?: RunContext): Promise<RunResult>;
  /**
   * The page on paper, as a `print` step prints it: this form alone, every tab one after another under its name,
   * every step and folded part open, the values as words, the record's title and the day at the top. Settled once the
   * browser's printing is done. Ctrl+P prints it so too, with whatever else the page round it holds.
   */
  print(): Promise<void>;
  /**
   * Settled once the page is drawn: at once, unless it draws from a part not loaded yet (a record's head, a filter bar, a
   * work item's text, a path picker, its own look's theme: parts.ts), which it waits for — its element empty and busy
   * meanwhile. A theme or the quiet skin given by the app is worn as its part comes, the page drawn at once: settled
   * once that has come too. In the one-tag script, a list page's own settings are checked once its part has come: a
   * mistake there rejects this with what the mount throws for the rest, and nothing is drawn.
   */
  readonly drawn: Promise<void>;
  destroy(): void;
}

type Updater = (state: FormState) => void;

/** A part of the page as it is drawn, for its errors to be kept to it: its node, its element, its box once it failed. */
interface KeptPart {
  node: LayoutNode;
  element: HTMLElement | null;
  box: HTMLElement | null;
}

/** A part's own name, for its box: a section's or a form's title, a tab's or a button's label, a map's. */
function partName(node: LayoutNode): string | undefined {
  const named = node as { title?: unknown; label?: unknown };
  const name = typeof named.title === 'string' ? named.title : typeof named.label === 'string' ? named.label : undefined;
  return name || undefined;
}

/** What one page's parts are drawn with: the page shown, or — inside a saved form placed in it — the saved page, with its own form. */
interface Scope {
  /** The page shown, whose form is the one the viewer was given or made. */
  root: boolean;
  form: Form;
  page: Page;
  /** Before each element's id, so two copies of one saved form never share one. */
  prefix: string;
  /** The pages round it, outermost first, itself last: one of them placed again would hold itself. */
  chain: { id: string; title: string }[];
  /** Locked from outside: a saved form read-only where it is placed. */
  locked(): boolean;
  /** Before its fields' names among the outer form's problems: `home.` inside the saved form whose answers go under "home". */
  path: string;
}

let mounts = 0;

/** The inputs nothing is typed in: their change says a choice, never text to take. */
const NOT_TYPED = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'color', 'range', 'hidden']);
/** A box typed in: a tick, a choice, a file or a colour picker has nothing typed to take. */
const typedBox = (box: Element) => box.tagName === 'TEXTAREA' || (box.tagName === 'INPUT' && !NOT_TYPED.has((box as HTMLInputElement).type));

/**
 * A box's text put back as the person would type it back (the quiet look's Escape): all of it chosen and written over,
 * as typing — the box, its guard and its undo hear it as keys — or, where the browser cannot, written and told.
 */
function typeBack(box: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const doc = box.ownerDocument;
  box.select();
  let typed: boolean;
  try {
    typed = typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text);
  } catch {
    typed = false;
  }
  if (typed && box.value === text) return;
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Render a page into `host` and keep it in step with its form. Plain DOM: the
 * React, Angular and Vue bindings are thin shells around this function.
 * Throws when the page does not validate, listing every problem.
 */
export function mountViewer(host: HTMLElement, given: ViewerOptions): ViewerHandle {
  // Its own copy: setTokens changes what the dialogs it opens later wear, never the app's object.
  const options: ViewerOptions = { ...given };
  const doc = host.ownerDocument;
  // The quick check of names and conditions: the full one, with its validation library, belongs where pages are made.
  // A line's own form reads the record the line is on as parent.
  const checks = { ...(options.parent ? { parent: options.parent.fields } : {}), ...(options.functions ? { functions: options.functions } : {}) };
  const checked = checkPage(options.page, checks);
  if (!checked.ok) throw unshown(checked);
  // The page's own words in its language first; the app's translator over what is left.
  const tag = options.locale ?? checked.page.language;
  const localized = tag ? localizePage(checked.page, tag) : checked.page;
  // Its time zone written into each date and time field naming none, for whatever shows one from its field alone.
  const page = zonedPage(options.translate ? translatePage(localized, options.translate) : localized);
  /** Another page as this one is shown: in its language, through the app's translator. */
  const shownAs = (other: Page) => {
    const own = tag ? localizePage(other, tag) : other;
    return zonedPage(options.translate ? translatePage(own, options.translate) : own);
  };
  const locale = ownLocale(tag);
  const preferences = options.preferences ?? browserPreferences();
  const dialogs = pageDialogs(options, (message, tone) => actionHost.say(message, tone));
  const ownsForm = !options.form;
  // Read as each word is drawn: a part's words are there once it has come (the one-tag script's).
  const labels: ViewerLabels = viewerWords(locale, options.labels);
  /** One of the viewer's sentences in the words the page names its records by (`records`), else as it says them plainly. */
  const sentence = (noun: string | undefined, words: string) => recordSentence(page.records, noun, words, locale);
  /** A sentence of the viewer's filled in, each field's label at `keys` small inside it where the page asks (`labelAt`). */
  const labelled = (template: string, values: Record<string, string | number>, ...keys: string[]) => {
    const own = { ...values };
    for (const key of keys) own[key] = labelAt(template, key, page.lowerLabels, locale)(String(own[key]));
    return fill(template, own);
  };
  /**
   * What the page's steps ask of the screen: a page opened, words said, a
   * question asked, a tab shown — the viewer's own, under the app's. A form
   * made elsewhere (`form`) keeps the host it was made with.
   */
  const actionHost: ActionHost = {
    open: (request) =>
      openPage(
        {
          options,
          place: host,
          root,
          title: (other) => shownAs(other).title || other.id,
          back: labels.back,
          missing: (id) => fill(labels.pageMissing, { page: id }),
          say: (message, tone, undo) => actionHost.say(message, tone, undo),
          post: (message) => form.post(message),
          name: () => recordName() || sentence(labels.newRecordNoun, labels.newRecord),
          leave: () => form.leave(),
          leaveNow: () => form.leaveNow(),
        },
        request
      ),
    say: (message, tone, undo) => say(message, tone, undo),
    // A question that lets the person's work go is the viewer's own, worded Discard, the focus on Cancel.
    ask: (message, how) => (how?.discard ? letGoAsked(message) : confirm(message)),
    show: (target) => {
      const show = tabs.get(target);
      if (!show?.()) throw new Error(`No tab "${target}" can be shown here`);
    },
    // A new tab opened apart from this page, or this one sent there.
    openUrl: (url, newTab) => (newTab ? doc.defaultView?.open(url, '_blank', 'noopener,noreferrer') : doc.defaultView?.location.assign(url)),
    // This form on paper, alone; the app's file shown over it, or saved — by the files part, which shows a file field's.
    print: () => paper.print(),
    file: (file) => filesPart.load().then((part) => part.showAppFile({ doc, labels: widgetLabels, home: root, file })),
    ...options.host,
  };
  const widgetLabels = WIDGET_LABELS[locale];
  /** How a value reads inside the page's own words on screen (a `{field}`): a day in the page's order, a yes or no in words. */
  const sentenceWords: SentenceWords = { order: dateOrderOf({ page }), yes: widgetLabels.yes, no: widgetLabels.no };
  /** So, once the answers part has come (a page that says the answers loads it first); else as each field shows its value. */
  const asSaid: ValueWriter = (def, value, values) => answersPart.loaded?.sentenceValue(def, value, values, locale, sentenceWords) ?? displayValue(def, value, values, locale);
  const form =
    options.form ??
    createForm({
      ...options,
      page,
      host: actionHost,
      messages: options.messages ?? MESSAGES[locale],
      valueWords: options.valueWords ?? ((def, value, values) => asSaid(def as LineField, value, values as Values)),
    });
  /** A part that failed: said to the console, and to the app's onError, which may not throw the page down either. */
  const report: ErrorHandler = (error, where) => {
    console.error(`[Fieldia] ${describeFailure(where)}`, error);
    if (options.onError) reportFailure(error, where, options.onError);
  };
  const dir = options.dir ?? (tag && isRightToLeft(tag) ? 'rtl' : undefined);
  const prefix = `fd${++mounts}`;
  const updaters: Updater[] = [];
  /**
   * Where a part's updater goes as it is drawn: the form's own list, or the list
   * of the tab it is drawn in, which runs only while that tab is shown.
   */
  let sink: Updater[] = updaters;
  /** The part being drawn: what it adds to `sink` is kept to it (keptTo). */
  let drawing: KeptPart | null = null;
  const cleanups: (() => void)[] = [];
  /** A map without the app's maps to draw it: said once to the developer. */
  let warnedMaps = false;
  const ownUid = (id: string) => `${prefix}-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const uid = ownUid;
  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

  installStyles(doc);
  installRecordStyles(doc);

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }

  /**
   * Words with the icon a page names before them, when there is such an icon.
   * The words sit in a <bdi>: left as written on a page of the other direction,
   * they still run their own way, the icon still before them.
   */
  function withIcon(name: string | undefined, text: string | (Node | string)[]): (Node | string)[] {
    const icon = drawIcon(doc, name, options.icons);
    const words = el('bdi', {}, ...[text].flat());
    return icon ? [icon, words] : [words];
  }

  /**
   * A tab's face: its icon and words, or its icon alone (its words then its
   * name and tooltip), and the pill of its count after them.
   */
  function tabFace(tab: TabNode): (Node | string)[] {
    const pill = tab.count !== undefined ? [el('span', { class: 'fd-tab-count', 'aria-hidden': 'true' }, '0')] : [];
    if (!tab.iconOnly) return [...withIcon(tab.icon, tab.label), ...pill];
    const icon = drawIcon(doc, tab.icon, options.icons);
    return [...(icon ? [icon] : []), ...pill];
  }

  /**
   * A label's words with its access key's letter underlined, as a work item's
   * "Stat_e_": the first of that letter in them, whatever its case. Its words
   * stay one piece for whatever reads them; without a key, the words alone.
   */
  function accessKeyed(text: string, key: string | undefined): (Node | string)[] {
    const words = keepMarkWithWord(text);
    const at = key ? words.toLocaleLowerCase().indexOf(key) : -1;
    if (at === -1) return [words];
    return [el('span', { class: 'fd-label-words' }, words.slice(0, at), el('span', { class: 'fd-access-key' }, words.slice(at, at + 1)), words.slice(at + 1))];
  }
  /** What a group's heading and a help box draw with. */
  const headKit: HeadKit = { doc, labels: widgetLabels, icons: options.icons, withIcon, el };

  const theme = options.theme ?? page.look?.theme;
  const root = el('form', { class: 'fd-form', novalidate: '', 'data-fd-skin': skinFor(options.skin ?? page.look?.skin, theme), dir, lang: tag, 'data-max-width': page.maxWidth });
  applyLook(root, theme ? { ...page.look, theme } : page.look);
  wearTokens(root, options.tokens);
  const confirm = options.confirm ?? dialogConfirm;
  /** The "Discard your changes?" asked now, if one is: gone the moment it is answered. */
  let discarding: Promise<boolean> | null = null;
  /**
   * "Discard your changes?", or the form's words for it: Discard to let the person's work go, the focus on Cancel. One
   * at a time: every way out taken while it is asked gets its answer; one taken after it is answered asks again.
   */
  const letGoAsked = (message = sentence(labels.discardChangesNoun, labels.discardChanges)) => (discarding ??= dialogConfirm(message, true, { yes: labels.discard, ended: () => (discarding = null) }));
  const say = sayer(root, el, labels.dismiss, labels);
  /** The tabs a step can show, by id: each shows its tab, false when it is hidden. */
  const tabs = new Map<string, () => boolean>();
  /** For each field in a tab, how to show its tab: a problem there is shown before the focus goes to it. */
  const problemTabs = new Map<string, () => boolean>();
  /** A tab's count of a related list in it, by the list's id: the list, once drawn, tells it what it counts itself. */
  const relatedCounts = new Map<string, RelatedCount>();

  /**
   * A press runs its steps one run at a time: the button busy meanwhile, and
   * not pressed again. What earlier presses said goes as it starts: its own
   * words speak for what is done now. A check or a save that stops it takes
   * the focus to the first problem, and says which fields, as Save does.
   */
  async function press(button: HTMLElement, run: () => Promise<RunResult>) {
    if (button.hasAttribute('aria-busy')) return;
    say.clear();
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    try {
      const { reason } = await run();
      if (reason === 'check' || reason === 'save') {
        if (!form.getState().saveProblem) announce(checkText(form.getState()));
        focusFirstProblem();
      }
    } finally {
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
    }
  }

  // ---- the parts -------------------------------------------------------

  /** The fields that take the focus as the record opens, in the order they are drawn. */
  const focusers: { wrapper: HTMLElement; focus(): void }[] = [];
  /** The fields with an access key, in the order they are drawn: Alt with the key focuses the first shown. */
  const fieldKeys: { key: string; wrapper: HTMLElement; focus(): void }[] = [];
  /** Each field's face, put on again when the form changes skin: quiet, or in its box. */
  const faces: (() => void)[] = [];
  /** Folded sections, and how to open each: a problem inside one has to be seen. */
  const folds = new Map<HTMLElement, () => void>();
  /** What draws the parts not shown yet for paper: each tabs' own, drawing every tab shown. */
  const printers: (() => void)[] = [];
  /** Every part drawn again from the state of the page shown. */
  const renderNow = () => render(form.getState());
  /** The record's head being drawn: tabs placed in it go to its band. */
  let headNow: RecordHead | null = null;
  /** Set once the viewer is on the page; set again when it is taken away. */
  let mounted = false;
  let gone = false;
  /** Whether the form has opened a record yet (its `open` event). */
  let opened = false;

  /** The columns a part spans in the grid it sits in; the stylesheet keeps it within the columns there at each width. */
  function spans(element: HTMLElement, colspan: number | undefined) {
    if (colspan) element.style.setProperty('--fd-span', String(colspan));
  }

  /** Where the parts of a page, a tab or a step sit: one column, the page's labels. */
  const top = (onPage: boolean): Place => ({ columns: 1, onPage, labels: page.look?.labels });

  /**
   * The parts of one page, drawn with its own form: the page shown, or a saved
   * form placed in it. Inside, `form` and `page` are the scope's.
   */
  function drawer(scope: Scope) {
    const { form, page } = scope;
    const uid = (id: string) => ownUid(scope.prefix + id);
    /** The answers signatures kept signed, as the values hold them now: worked out once for each change of the values. */
    let signed: { values: Readonly<Values>; by: SignedBy } | null = null;
    const signedNow = (values: Readonly<Values>) => (signed?.values === values ? signed : (signed = { values, by: signedBy(page, values) })).by;
    /** A part's updater, handed the state of the part's own form; one that throws puts the part's box in its place. */
    const watch = (update: Updater) => sink.push(keptTo(drawing, scope.root ? update : () => update(form.getState())));
    /**
     * The page's own words — a label, a help, a button's — with the value of each field they name (`{field}`) as a
     * sentence says it, kept to the answers as they change; words that name none, as they are.
     */
    const pageWords = (text: string): (Node | string)[] => {
      if (!text.includes('{')) return [text];
      const words = valueWords(doc, page.fields, text, locale, asSaid);
      watch((state) => words.update(state.values));
      return words.nodes;
    };

    // ---- errors kept to their part (@fieldia/widgets' contain.ts) ----

    /** A part's updater kept to it: thrown, its part is a box from then on, which follows the part's condition. */
    function keptTo(part: KeptPart | null, update: Updater): Updater {
      if (!part) return update;
      return (state) => {
        if (part.box) return setHidden(part.box, form.node(part.node.id).invisible);
        try {
          update(state);
        } catch (error) {
          breakPart(part, error, 'update');
        }
      };
    }

    /** A part drawn with what it adds kept to it: one that throws as it is drawn is its box. */
    function kept(node: LayoutNode, draw: () => HTMLElement): HTMLElement {
      const part: KeptPart = { node, element: null, box: null };
      const outer = drawing;
      drawing = part;
      try {
        part.element = draw();
        return part.element;
      } catch (error) {
        return breakPart(part, error, 'draw');
      } finally {
        drawing = outer;
      }
    }

    /** A part's box in its place: said, sized and placed as the part was, hidden while the part would be. */
    function breakPart(part: KeptPart, error: unknown, stage: FailureStage): HTMLElement {
      const { node } = part;
      report(error, { stage, part: node.type, node: node.id, ...(node.type === 'field' ? { field: node.field } : {}), ...(node.type === 'slot' ? { name: node.name } : {}) });
      const name = node.type === 'field' ? (node.label ?? page.fields[node.field]?.label ?? node.field) : partName(node);
      const words = node.type === 'field' ? labelled(widgetLabels.brokenField, { label: name ?? '' }, 'label') : name ? fill(widgetLabels.brokenPartNamed, { label: name }) : widgetLabels.brokenPart;
      const box = brokenBox(doc, words);
      box.dataset['node'] = node.id;
      const drawn = part.element;
      if (drawn) {
        const span = drawn.style.getPropertyValue('--fd-span');
        if (span) box.style.setProperty('--fd-span', span);
        if (drawn.dataset['hideOn']) box.dataset['hideOn'] = drawn.dataset['hideOn'];
        if (drawn.dataset['print']) box.dataset['print'] = drawn.dataset['print'];
        // The focus it held comes to its box, which says what failed: a keyboard keeps its place.
        const focused = drawn.contains(doc.activeElement);
        drawn.replaceWith(box);
        if (focused) box.focus();
      } else spans(box, node.type === 'map' || node.type === 'related' ? (node.colspan ?? 12) : (node as { colspan?: number }).colspan);
      part.box = box;
      return box;
    }


    /**
     * A field with its label, help and messages. `place` is where labels sit where it is put; the title's own fields take none.
     * `around` says what the groups round it say of the quiet look: quiet or boxed, and why their fields are read-only.
     */
    function fieldItem(node: FieldNode, place?: LabelPlace, around: Pick<Place, 'quiet' | 'reason'> = {}): HTMLElement {
      const def = page.fields[node.field];
      const id = uid(node.id);
      const labelsAt = labelPlace(node, def.type, place);
      const wrapper = el('div', { class: 'fd-field', 'data-node': node.id, 'data-field': node.field, 'data-path': scope.path + node.field, 'data-type': def.type, 'data-labels': labelsAt, 'data-focus': node.focus && scope.root ? '' : undefined });
      if (node.colspan) wrapper.style.setProperty('--fd-span', String(node.colspan));
      const labelText = node.label ?? def.label;
      // Words that show answers given ("How was your visit to {branch}?"): drawn with them, kept to them; said so where a sentence names the field.
      const worded = labelText.includes('{');
      const labelNow = () => (worded ? form.words(labelText) : labelText);
      // Its words one piece, as an access key's are: what names the field reads them whole ("Check: How was your visit to Zamalek?").
      const label = el('label', { class: 'fd-label', id: `${id}-label`, for: id }, ...(worded ? [el('span', { class: 'fd-label-words' }, ...pageWords(labelText))] : accessKeyed(labelText, node.hotkey)));
      // The ✓ of a field filled in right; never on a yes/no box, a table or a file, where it would say nothing.
      const mark = options.showValid && !NO_VALID_MARK.has(def.type) ? drawIcon(doc, 'check') : null;
      if (mark) {
        mark.classList.add('fd-valid-mark');
        label.append(mark);
      }
      const context: WidgetContext = { form, name: node.field, field: def, node, id, document: doc, labels: widgetLabels, preferences, locale, dialogs, onError: report };
      // Choices whose words show the answers given follow them, as the answers part draws them.
      const draw = (own: WidgetContext) => createWidget(own, options.widgets);
      const widget = answersPart.loaded?.wordedWidget(context, draw) ?? draw(context);
      // Its own tools (a Markdown text's Edit and Done), for a group that holds it alone to put in its heading.
      keepTools(wrapper, widget);
      // The field that takes the focus as the record opens (Flectra's default_focus): the page's own, not a saved form's inside it.
      if (node.focus && scope.root) focusers.push({ wrapper, focus: () => widget.focus() });
      // Its access key: Alt with its letter takes the focus to it, as the letter underlined in its label says.
      if (node.hotkey) {
        fieldKeys.push({ key: node.hotkey, wrapper, focus: () => widget.focus() });
        const control = widget.element.matches(CONTROL) ? widget.element : widget.element.querySelector(CONTROL);
        control?.setAttribute('aria-keyshortcuts', hotkeyWords(node.hotkey));
      }
      // A label kept out of sight still names the box; the empty box shows it instead, unless the page gives it words of its own.
      const textBox = widget.element.matches(TEXT_BOX) ? widget.element : widget.element.querySelector(TEXT_BOX);
      if (labelsAt === 'hidden' && !node.placeholder) textBox?.setAttribute('placeholder', labelNow());
      // Words chosen by a condition (placeholderWhen), else what the box showed as it was drawn.
      let drawnPlaceholder = textBox?.getAttribute('placeholder') ?? null;
      const chosenPlaceholder = node.placeholderWhen?.length ? textBox : null;
      // The quiet look: its own word, else its group's, else the form's skin. In a quiet place its label is quiet; its value
      // wears the look (data-quiet) unless its widget keeps its own face.
      const quietOwn = node.quiet ?? around.quiet;
      const wears = wearsQuiet(def, node);
      const quietPlace = () => quietOwn ?? root.getAttribute('data-fd-skin') === 'quiet';
      // Empty and quiet, it says what to add, unless the page gives it words of its own: "Add story points", or for a
      // question "Your answer". A field of several boxes, each with its own label (an address), says it in none of them.
      const ownWords = !!node.placeholder || labelsAt === 'hidden' || def.type === 'json' || def.type === 'properties';
      // Unless the page says empty quiet fields show nothing at rest (quietHints false): then its label alone says what it is.
      const hint = page.look?.quietHints === false ? null : quietHint(labelNow(), locale, labels);
      const restWords = () => (!ownWords && wrapper.hasAttribute('data-quiet') ? hint : drawnPlaceholder);
      // Where no box can hold a placeholder (a choice's blank, a state's words), the page's own words come first.
      const blankWords = node.placeholder || (labelsAt === 'hidden' ? labelNow() : (hint ?? ''));
      const quietSelect = widget.element instanceof HTMLSelectElement ? widget.element.querySelector<HTMLOptionElement>(':scope > option[value=""]') : null;
      const richText = widget.element.matches('.fd-richtext') ? widget.element : widget.element.querySelector<HTMLElement>(':scope > .fd-richtext');
      const stateWords = widget.element.querySelector<HTMLElement>(':scope > .fd-dot-label');
      const face = () => {
        const place = quietPlace();
        const quiet = wears && place;
        // The quiet look's sheet: in already when the page named it; else boxed until it comes (look-parts.ts).
        if (place) wearQuiet(doc);
        wrapper.toggleAttribute('data-in-quiet', place);
        wrapper.toggleAttribute('data-quiet', quiet);
        if (textBox && !chosenPlaceholder) setAttr(textBox, 'placeholder', restWords());
        if (quietSelect) quietSelect.textContent = quiet ? blankWords : '';
        if (richText && !node.placeholder) {
          setAttr(richText, 'data-placeholder', quiet ? hint : null);
          setAttr(richText, 'aria-placeholder', quiet ? hint : null);
        }
        if (stateWords) setAttr(stateWords, 'data-hint', quiet ? blankWords : null);
      };
      faces.push(face);
      face();
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(widget.element.tagName)) {
        // `for` stays: a custom field that puts the id on its own input is
        // labelled natively. Only a wrapper with a role (a radio group, say) may
        // carry a name; ARIA forbids naming a plain div or span.
        // A group inside a box of its own (a radio group with "Clear selection" under it) is named too.
        // A field's box when its widget could not be drawn is named by its own words, which name the field.
        const named = widget.element.getAttribute('role') ? widget.element : widget.element.querySelector(`[id="${id}"][role]`);
        if (!named?.classList.contains('fd-broken')) named?.setAttribute('aria-labelledby', label.id);
        // Not a press on its (?) or the help bubble beside it: they show the help, and must not open a picker's list.
        label.addEventListener('click', (event) => {
          if (!(event.target as Element).closest?.('.fd-help-tip-wrap, .fd-lock-wrap')) widget.focus();
        });
      } else {
        // Once its widget has failed, a press on the label takes the focus to the box in its place, as it did to the box.
        label.addEventListener('click', (event) => {
          if (widget.element.matches('.fd-broken') && !(event.target as Element).closest?.('.fd-help-tip-wrap, .fd-lock-wrap')) widget.focus();
        });
      }
      const helpText = node.help ?? def.help;
      // Under the field, behind a (?) by its label, or both: the field's own way, else the page's.
      const helpWay = node.helpShown ?? page.look?.helpShown ?? 'below';
      const help = helpText && helpWay !== 'tooltip' ? el('div', { class: 'fd-help', id: `${id}-help` }, ...pageWords(helpText)) : null;
      const tip = helpText && helpWay !== 'below' ? helpTip(`${id}-tip`, helpText, labelled(labels.helpFor, { label: labelNow() }, 'label')) : null;
      if (tip && helpText?.includes('{')) tip.bubble.replaceChildren(...pageWords(helpText));
      // In the label, as Flectra's: a press on it does not move into the box. A label out of sight keeps it after the box.
      if (tip && labelsAt === 'hidden') widget.element.after(tip.element);
      // Its side of the words and the gap before it follow the way the words run: English on an Arabic page too.
      else if (tip) {
        label.append(tip.element);
        label.dir = 'auto';
      }
      // A rule keeping it read-only: a lock by its label (after the box when the label is out of sight) in the quiet look,
      // and in any skin when the page says why — why, it says in a bubble, as the (?) does, pointed at or focused. Made
      // the first time it is needed: a field never locked has none.
      const reason = node.readonlyReason ?? around.reason;
      // Read-only by its nature — worked out from others, or always read-only where the page puts it — a value is shown,
      // not locked: it has a lock only when the page says why.
      const fixed = node.readonly === true || def.readonly === true || def.compute !== undefined;
      let lock: ReturnType<typeof bubbleTip> | null = null;
      let lockMark: HTMLElement | null = null;
      let lockedNow = false;
      /** The words its lock says; a field locked for this person by the record's source says theirs, which come with its load. */
      let lockWords: string | undefined;
      /** Whether pointing at the value says why: once, however often its lock is drawn again. */
      let pointing = !!reason;
      const lockFor = (words: string | undefined = reason): HTMLElement => {
        if (lockMark && !!lock === !!words) {
          if (lock && words !== lockWords) setText(lock.bubble, (lockWords = words) as string);
          return lockMark;
        }
        lockMark?.remove();
        lockWords = words;
        const icon = drawIcon(doc, 'lock', options.icons) ?? '';
        lock = words ? bubbleTip(`${id}-lock`, words, labelled(labels.locked, { label: labelNow() }, 'label'), 'fd-lock', icon) : null;
        if (words && !pointing) {
          pointing = true;
          for (const [event, on] of [['mouseenter', true], ['mouseleave', false], ['focusin', true], ['focusout', false]] as const) widget.element.addEventListener(event, () => point(on));
        }
        lockMark = lock?.element ?? el('span', { class: 'fd-lock-wrap' }, el('span', { class: 'fd-lock', 'aria-hidden': 'true' }, icon));
        // At the value's start, as a work item's Reason: in a record head's band, in the room before the value.
        if (page.look?.lockAt === 'value') {
          widget.element.before(lockMark);
          wrapper.setAttribute('data-lock-at', 'value');
        } else if (labelsAt === 'hidden') widget.element.after(lockMark);
        else label.insertBefore(lockMark, tip && labelsAt !== 'after' ? tip.element : null);
        return lockMark;
      };
      // Pointing at a locked quiet value, or focusing it, says why too.
      const point = (on: boolean) => lock?.point(on && lockedNow && wrapper.hasAttribute('data-in-quiet'));
      if (reason) for (const [event, on] of [['mouseenter', true], ['mouseleave', false], ['focusin', true], ['focusout', false]] as const) widget.element.addEventListener(event, () => point(on));
      // Not an alert of its own: a refused save is announced once, naming every field to look at. A problem found as
      // the box is left (min, max, a whole number, text that does not read) is said by it, once and politely.
      const error = el('div', { class: 'fd-error', id: `${id}-error`, hidden: '' });
      // A warning from an answer rule, and one from the data source's onchange beside the field whose change brought it.
      const warning = el('div', { class: 'fd-warning', id: `${id}-warning`, role: 'status', hidden: '' });
      wrapper.append(...(labelsAt === 'after' ? [widget.element, label] : [label, widget.element]), ...(help ? [help] : []), error, warning);
      // Read-only, as words in place of the box, when the page draws them so.
      const asText = page.look?.readonlyShown === 'text' && readsAsText(def, node, page) ? readText({ document: doc, field: def, node, id, locale, labels: widgetLabels, dialogs }) : null;
      if (asText) widget.element.after(asText.element);
      if (asText && reason) for (const [event, on] of [['mouseenter', true], ['mouseleave', false]] as const) asText.element.addEventListener(event, () => point(on));
      // A value worked out from others while one of them holds text that does not read — a total from a table whose
      // line says "abc" in its Quantity, the app's Untaxed and Total — waits as the table's own total does: a dash, said
      // in words, never the amount worked out from the value that text replaced. Made the first time it waits.
      let waitMark: HTMLElement | null = null;
      const waitWords = (waits: WaitsFor) =>
        waits.failed !== undefined
          ? labelled(labels.valueNotWorkedOut, { own: labelNow(), why: waits.failed }, 'own')
          : waits.asking
            ? labelled(labels.valueAsking, { own: labelNow() }, 'own')
            : waits.line
              ? labelled(labels.valueWaitsLine, { n: waits.line, lines: page.fields[waits.field]?.label ?? waits.field, own: labelNow() }, 'lines', 'own')
              : labelled(labels.valueWaits, { field: form.words(page.fields[waits.field]?.label ?? waits.field), own: labelNow() }, 'field', 'own');
      /** `inSight`: the words in sight whatever the label does, as why an answer did not come is. */
      const drawWaiting = (words: string | null, inSight = false) => {
        if (!words && !waitMark) return;
        if (!waitMark) {
          // Why, said to a screen reader and on pointing at it — and in sight where no label names what waits (a tax totals' table).
          waitMark = el('span', { class: 'fd-value-waits', 'data-waits': '' }, el('span', { 'aria-hidden': 'true' }, '—'), el('span', {}));
          (asText?.element ?? widget.element).after(waitMark);
        }
        setHidden(waitMark, !words);
        setAttr(waitMark, 'title', words);
        const why = waitMark.lastElementChild as HTMLElement;
        setAttr(why, 'class', labelsAt === 'hidden' || inSight ? 'fd-value-waits-why' : 'fd-sr-only');
        setText(why, words ?? '');
        // Asked of the app's server: an ellipsis while it answers, the dash once it did not.
        const asking = words !== null && !inSight && !!form.waitsFor(node.field)?.asking;
        setText(waitMark.firstElementChild as HTMLElement, asking ? '…' : '—');
        setAttr(waitMark, 'data-failed', inSight ? '' : null);
        setAttr(wrapper, 'data-waits', words === null ? null : '');
        setAttr(wrapper, 'data-asking', asking ? '' : null);
      };
      if (widget.destroy) cleanups.push(() => widget.destroy?.());
      // An answer rule's warning waits until the person leaves the field: no advice
      // mid-word. One already shown stays while they put it right, and goes once they have.
      let typing = false;
      let advice = '';
      /** Leaving the field now: a problem it raises is said by its error, politely. */
      let leaving = false;
      /** The problem last said politely as the box was left: one shown while typing (a paste past the most) is said as it is left. */
      let saidLeaving = '';
      /** The box was just left: the next drawing of it says its problem, though leaving it raised none new. */
      let justLeft = false;
      wrapper.addEventListener('focusin', () => {
        typing = true;
        setAttr(error, 'aria-live', null);
      });
      wrapper.addEventListener('focusout', (event) => {
        if (wrapper.contains(event.relatedTarget as Node | null)) return;
        // Left for a press elsewhere (a tap on Submit), what leaving shows waits till that press has ended: shown as the
        // finger comes down, a message would move Submit from under it, and the tap would be lost (press.ts).
        afterPress(doc, wrapper, () => {
          // Back in the box meanwhile: still being typed in.
          if (wrapper.contains(doc.activeElement)) return;
          typing = false;
          // The field's own problem is said now, as its box is left; that it is required waits for Save.
          leaving = true;
          try {
            form.boxLeft(node.field);
          } finally {
            leaving = false;
          }
          justLeft = true;
          // Not at once: focus also leaves when a redraw removes the focused part
          // (a deleted line's button), and that redraw must finish first.
          queueMicrotask(() => update(form.getState()));
        });
      });
      // Written while the person is elsewhere — the browser's autofill filling the form from one pick: each box is read
      // at once, as one typed in and left (its change, which a browser may not send), and its problem said.
      wrapper.addEventListener('input', (event) => {
        const box = event.target as Element;
        if (wrapper.contains(doc.activeElement) || !typedBox(box)) return;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        form.boxLeft(node.field);
      });
      // Quiet, Escape puts back the value the field had as it was entered — once its own list or calendar, if open, has
      // taken the key — and only then is it left for the dialog round it. Leaving keeps the change, for Save.
      let entered: unknown;
      /** The box entered, the text it showed then (once its own focus has written it), and whether it was typed in since. */
      let enteredBox: { box: HTMLInputElement | HTMLTextAreaElement; text: string; typed: boolean } | null = null;
      wrapper.addEventListener('focusin', (event) => {
        if (!wrapper.contains(event.relatedTarget as Node | null)) entered = form.getState().values[node.field];
        const box = event.target as HTMLInputElement | HTMLTextAreaElement;
        if (typedBox(box)) queueMicrotask(() => (enteredBox = { box, text: box.value, typed: false }));
      });
      wrapper.addEventListener('input', (event) => {
        if (enteredBox && event.target === enteredBox.box) enteredBox.typed = true;
      });
      // Entered before the record came (a dialog takes the focus at once): what it held is what the record brought.
      cleanups.push(form.on('open', ({ values }) => {
        if (!wrapper.contains(doc.activeElement)) return;
        entered = values[node.field];
        // What the box shows of the record come is what it was entered with.
        queueMicrotask(() => {
          if (enteredBox && enteredBox.box === doc.activeElement && !enteredBox.typed) enteredBox.text = enteredBox.box.value;
        });
      }));
      wrapper.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !wrapper.hasAttribute('data-quiet')) return;
        // Text typed that never changed the value — a date that does not read, "31/02/2026" — is put back too, as typed
        // back by the person: the box shows what it showed as it was entered, and nothing is left unread as it is left.
        const typedBack = enteredBox && enteredBox.typed && enteredBox.box === doc.activeElement && enteredBox.box.value !== enteredBox.text ? enteredBox : null;
        if (!typedBack && JSON.stringify(form.getState().values[node.field] ?? null) === JSON.stringify(entered ?? null)) return;
        event.preventDefault();
        event.stopPropagation();
        form.setValue(node.field, (entered ?? null) as Values[string]);
        if (typedBack) {
          typeBack(typedBack.box, typedBack.text);
          typedBack.typed = false;
        }
      });

      const toned = node.tones !== undefined || node.bold !== undefined;
      const update = (state: FormState) => {
        const shown = form.node(node.id);
        setHidden(wrapper, shown.invisible);
        wrapper.classList.toggle('fd-required', shown.required);
        // Its value's tone and bold while a condition holds: Flectra's decoration-* on a field.
        if (toned) {
          const look = form.fieldTone(node.id);
          setAttr(wrapper, 'data-tone', look.tone);
          wrapper.classList.toggle('fd-value-bold', look.bold);
        }
        if (chosenPlaceholder) setAttr(chosenPlaceholder, 'placeholder', form.placeholder(node.id) ?? restWords());
        // A label out of sight that shows answers: its empty box says it as it reads now.
        if (worded && labelsAt === 'hidden' && !node.placeholder && textBox && drawnPlaceholder !== labelNow()) {
          drawnPlaceholder = labelNow();
          face();
        }
        const message = state.errors[node.field];
        // Raised by leaving the box, it is said once, politely; a refused Save's announcer says the rest, once. Shown
        // already while it was typed in (a paste past its most), it is said now, as the box is left.
        const left = leaving || justLeft;
        justLeft = false;
        if (left && message && message !== saidLeaving) {
          setAttr(error, 'aria-live', 'polite');
          if (message === error.textContent) error.textContent = '';
        }
        if (left) saidLeaving = message ?? '';
        else if (!message) saidLeaving = '';
        setHidden(error, !message);
        setText(error, message ?? '');
        const now = state.warnings[node.field] ?? '';
        if (!typing || !now) advice = now;
        // An error shown says enough: the rule's warning gives way to it.
        // Options a change no longer offers, taken out of the answer: said, whatever else is.
        const warned = [message ? '' : advice, state.warning && state.warningField === node.field ? state.warning : '', state.takenOut?.[node.field] ?? ''].filter(Boolean).join(' ');
        setHidden(warning, !warned);
        setText(warning, warned);
        if (mark) {
          const value = state.values[node.field];
          const filled = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && !value.length);
          const valid = !shown.readonly && !message && filled && state.dirty.includes(node.field) && form.problem(node.field) === null;
          wrapper.classList.toggle('fd-valid', valid);
          mark.toggleAttribute('hidden', !valid);
        }
        const readonly = shown.readonly || locked || scope.locked();
        // Locked by a rule, not by the whole form being read: its lock shows, in the quiet look or with its reason, and its words are muted.
        const quiet = wrapper.hasAttribute('data-quiet');
        // A record its source lets the person only read is read whole, as a locked form is: it says why once, over the record.
        const can = state.can;
        lockedNow = readonly && !locked && can?.edit !== false;
        const mayNot = can?.readonlyFields?.includes(node.field);
        // An answer a signature signed says how to change it — by taking the signature away — unless the source locks it
        // for this person anyway; a value worked out, never typed, says nothing.
        const why = !mayNot && !fixed && signedNow(state.values).has(node.field) ? labels.signedAnswer : (reason ?? (mayNot ? (can?.reason ?? labels.fieldNotYours) : undefined));
        const showsLock = lockedNow && (!!why || (wrapper.hasAttribute('data-in-quiet') && !fixed));
        if (showsLock || lockMark) setHidden(lockFor(why), !showsLock);
        if (!lockedNow) point(false);
        setAttr(wrapper, 'data-locked', quiet && showsLock ? '' : null);
        setAttr(wrapper, 'data-empty', quiet && isBlank(state.values[node.field]) ? '' : null);
        const waits = form.waitsFor(node.field);
        const waiting = waits ? waitWords(waits) : null;
        drawWaiting(waiting, waits?.failed !== undefined);
        if (asText) {
          setHidden(widget.element, readonly || !!waiting);
          setHidden(asText.element, !readonly || !!waiting);
          setAttr(wrapper, 'data-read-text', readonly ? '' : null);
          if (readonly) asText.update(state.values[node.field], state.values);
        } else if (waitMark) setHidden(widget.element, !!waiting);
        widget.update({
          value: state.values[node.field],
          values: state.values,
          readonly,
          required: shown.required,
          invalid: !!message,
          describedBy: [help?.id ?? tip?.bubble.id, lock && lockedNow ? lock.bubble.id : undefined, message ? error.id : undefined, warned ? warning.id : undefined].filter(Boolean).join(' ') || undefined,
        });
      };
      watch(update);
      return wrapper;
    }

    /** A (?) that shows a field's help in a bubble: on hover, on focus, or kept open by a press — a tap — and gone with Escape. */
    function helpTip(bubbleId: string, text: string, name: string): { element: HTMLElement; bubble: HTMLElement } {
      return bubbleTip(bubbleId, text, name, 'fd-help-tip', '?');
    }

    /**
     * A small button with words in a bubble — a field's help behind its (?), why it is locked behind its lock — shown
     * on hover, on focus, or kept open by a press, and gone with Escape. `point` shows it from elsewhere: its value pointed at.
     */
    function bubbleTip(bubbleId: string, text: string, name: string, kind: 'fd-help-tip' | 'fd-lock', face: Node | string): { element: HTMLElement; bubble: HTMLElement; point(on: boolean): void } {
      const bubble = el('span', { class: 'fd-help-bubble', role: 'tooltip', id: bubbleId, hidden: '' }, text);
      const button = el('button', { type: 'button', class: kind, 'aria-label': name, 'aria-expanded': 'false', 'aria-controls': bubbleId }, face);
      // A lock's reason is said as it is reached; the help waits to be asked for.
      if (kind === 'fd-lock') button.setAttribute('aria-describedby', bubbleId);
      let kept = false;
      const show = (open: boolean) => {
        bubble.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open) keepOnScreen(bubble);
      };
      button.addEventListener('mouseenter', () => show(true));
      button.addEventListener('mouseleave', () => show(kept));
      button.addEventListener('focus', () => show(true));
      button.addEventListener('blur', () => ((kept = false), show(false)));
      button.addEventListener('click', (event) => {
        event.preventDefault();
        kept = !kept;
        show(kept);
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || bubble.hidden) return;
        // Escape closes the bubble, not the dialog the form is in.
        event.stopPropagation();
        kept = false;
        show(false);
      });
      return { element: el('span', { class: kind === 'fd-lock' ? 'fd-lock-wrap' : 'fd-help-tip-wrap' }, button, bubble), bubble, point: (on) => show(on || kept) };
    }

    /** A bubble hangs from its (?): near the edge of a phone's screen it runs past it, so it is moved back in. */
    function keepOnScreen(bubble: HTMLElement) {
      bubble.style.transform = '';
      const at = bubble.getBoundingClientRect();
      const width = doc.documentElement.clientWidth;
      const margin = 8;
      const shift = at.right > width - margin ? width - margin - at.right : at.left < margin ? margin - at.left : 0;
      if (shift) bubble.style.transform = `translateX(${Math.round(shift)}px)`;
    }

    function hideWhen(element: HTMLElement, id: string) {
      watch(() => setHidden(element, form.node(id).invisible));
    }

    function buttonItem(node: ButtonNode): HTMLElement {
      // Its icon alone, a toggle, a menu beside it, a look that follows the record's changes: drawn by button-parts.ts.
      const head = isRichButton(node) ? headPart.loaded : undefined;
      if (head) {
        const rich = head.richButton({ doc, el, form, labels, icons: options.icons, uid, withIcon, press, say: (message, tone) => actionHost.say(message, tone), watch, cleanups }, node);
        spans(rich, node.colspan);
        return hiddenOn(node, rich);
      }
      // Its words, with the answers they name ("Call {branch}") kept to them.
      const button = el('button', { type: 'button', class: `fd-button fd-button-${node.style ?? 'secondary'}`, 'data-node': node.id }, ...withIcon(node.icon, pageWords(node.label)));
      if (node.hotkey) hotkeyOn(button, node.hotkey, form.words(node.label));
      // A button that prints: the print part fetched as a pointer rests on it.
      if (node.steps?.some((step) => step.do === 'print')) printIntent(button);
      spans(button, node.colspan);
      // Its confirmation, then its steps: the form asks, through the viewer. Undo with nothing to put back says so.
      button.addEventListener('click', () => {
        if (!nothingToUndo(node, form, (message, tone) => actionHost.say(message, tone), labels)) void press(button, () => form.runAction(node.id));
      });
      hideWhen(button, node.id);
      // A header's button is drawn here too, never through item(): hidden at its widths the same way.
      return hiddenOn(node, button);
    }

    function textItem(node: TextNode, inline = false): HTMLElement {
      const style = node.style ?? 'paragraph';
      // Its words, with the values of the fields they name, and its [words](address) as links.
      // As a sentence says them where the page says the answers elsewhere too (its answers part came), else as before.
      const words = valueWords(doc, page.fields, node.text, locale, answersPart.loaded && asSaid);
      const shown = wordsWithLinks(doc, words.nodes);
      const element = inline
        ? el('span', { class: `fd-oneline-words fd-text-${style}`, 'data-node': node.id }, ...shown)
        : style === 'alert'
          ? el('div', { class: `fd-alert fd-text-alert fd-tone-${node.tone ?? 'info'}`, role: 'status', 'data-node': node.id }, el('span', { class: 'fd-alert-message' }, ...shown))
          : style === 'help'
            ? helpBox(headKit, node, shown)
            : el(style === 'heading' ? 'h3' : 'p', { class: `fd-text-${style}`, 'data-node': node.id }, ...shown);
      spans(element, node.colspan);
      hideWhen(element, node.id);
      watch((state) => words.update(state.values));
      return element;
    }

    function slotItem(node: SlotNode): HTMLElement {
      const element = el('div', { class: 'fd-slot', 'data-slot': node.name, 'data-node': node.id });
      // The app's own content: one that throws leaves a box in the slot, and its clean-up is kept from throwing too.
      const where = (stage: FailureStage): PartFailure => ({ stage, part: 'slot', name: node.name, node: node.id });
      const held = focusHeld(element);
      /** Its box, beside what the app drew (a framework still owns that): once, however often it fails. */
      const broken = (error: unknown, stage: FailureStage) => {
        report(error, where(stage));
        if (element.querySelector(':scope > .fd-broken')) return;
        // The focus that was in it — on what its framework then drew as nothing — comes to the box, which says what failed.
        const focused = held();
        const box = brokenBox(doc, widgetLabels.brokenPart);
        element.append(box);
        if (focused) box.focus();
      };
      try {
        const cleanup = options.slots?.[node.name]?.(element, { form, name: node.name, fail: (error) => broken(error, 'update') });
        if (cleanup) cleanups.push(() => {
          try {
            cleanup();
          } catch (error) {
            report(error, where('remove'));
          }
        });
      } catch (error) {
        broken(error, 'draw');
      }
      hideWhen(element, node.id);
      return element;
    }

    /**
     * A grid of parts. With `columns` null, it has none of its own: it lays its
     * parts on the columns of the grid round it (an arrangement on its tracks).
     */
    function grid(children: LayoutNode[], columns: SectionNode['columns'] | null, place: Place): HTMLElement {
      const box = el('div', { class: 'fd-grid' });
      if (columns !== null) {
        box.style.setProperty('--fd-columns', String(wideColumns(columns)));
        // Twelfths: eleven gaps between them, which shrink in a narrow column rather than push past it.
        if (wideColumns(columns) === 12) box.setAttribute('data-twelfths', '');
        // Its count on a wide sheet: on paper, a grid of one column a plain block, and one of more its parts side by side
        // as boxes in lines (styles-print.ts in @fieldia/widgets), which every engine breaks between sheets.
        box.setAttribute('data-columns', String(wideColumns(columns)));
        // Counts given for the narrower widths replace the skin's own stacking there.
        if (typeof columns === 'object') {
          for (const width of ['medium', 'narrow'] as const) {
            const count = columns[width];
            if (count === undefined) continue;
            box.setAttribute(`data-columns-${width}`, String(count));
            box.style.setProperty(`--fd-columns-${width}`, String(count));
          }
        }
      }
      box.append(...children.map((child) => item(child, place)));
      return box;
    }

    /**
     * A row of twelfths led by a field whose label sits beside it, as Flectra's
     * `<label/><div class="o_row">`: that label goes with the labels round it,
     * and the parts share the room their values have.
     */
    function labelledRow(node: SectionNode, plan: ReturnType<typeof planSection>): 'skin' | 'beside' | null {
      const [first] = node.children;
      if (!plan.arrangement || plan.at === 'tracks' || wideColumns(node.columns) !== 12 || node.children.length < 2 || first?.type !== 'field') return null;
      // One line of them: parts running past twelve twelfths are a column of fields, each with its own label.
      if (node.children.reduce((sum, child) => sum + ((child as { colspan?: number }).colspan ?? 1), 0) > 12) return null;
      const type = page.fields[first.field]?.type;
      const where = type ? labelPlace(first, type, plan.inner.labels) : 'hidden';
      // The skin's place: beside in the underline skin, above in the outlined one, as the stylesheet says.
      return where === undefined ? 'skin' : where === 'beside' ? 'beside' : null;
    }

    /**
     * A line of parts, as Flectra's `<label/><div class="o_row">`: its title as
     * the line's label, where the labels round it sit, and its parts after it,
     * each as wide as it needs, its fields named for a screen reader.
     */
    function inlineItem(node: SectionNode, place: Place): HTMLElement {
      const line = el('div', { class: 'fd-field fd-oneline', 'data-node': node.id, 'data-style': 'inline', 'data-labels': place.labels });
      spans(line, node.colspan);
      const row = el('div', { class: 'fd-oneline-row', role: 'group' }, ...onelineRuns(node.children).map((run) => {
        const parts = run.map((child) => item(child, { columns: 1, onPage: false, inline: true, quiet: node.quiet ?? place.quiet, reason: node.readonlyReason ?? place.reason }));
        return parts.length === 1 ? parts[0] : el('span', { class: 'fd-oneline-pair' }, ...parts);
      }));
      if (node.title) {
        const title = el('span', { class: 'fd-label', id: uid(`${node.id}-label`) }, node.title);
        row.setAttribute('aria-labelledby', title.id);
        line.append(title);
      }
      line.append(row);
      hideWhen(line, node.id);
      // In a quiet place the line's label is quiet, as its fields' are.
      const face = () => {
        const quiet = node.quiet ?? place.quiet ?? root.getAttribute('data-fd-skin') === 'quiet';
        if (quiet) wearQuiet(doc);
        line.toggleAttribute('data-in-quiet', quiet);
      };
      faces.push(face);
      face();
      return line;
    }

    function sectionItem(node: SectionNode, place: Place): HTMLElement {
      if (node.style === 'inline') return inlineItem(node, place);
      const plan = planSection(node, place);
      // An arrangement is no group to name, and a fieldset cannot lay its parts on the columns round it.
      const section = el(plan.arrangement ? 'div' : 'fieldset', {
        class: 'fd-section',
        'data-node': node.id,
        'data-style': plan.style,
        'data-place': plan.at,
        'data-on-page': plan.style === 'card' && place.onPage ? '' : undefined,
      });
      spans(section, node.colspan);
      const row = labelledRow(node, plan);
      if (row) section.setAttribute('data-row', row);
      if (node.labelWidth) section.style.setProperty('--fd-label-width', `${node.labelWidth}px`);
      const description = node.description ? el('p', { class: 'fd-section-description' }, node.description) : null;
      const content = grid(node.children, plan.at === 'tracks' ? null : node.columns, plan.inner);
      // Its own column widths and gap; a heading with tools at its end, as a work item's group has.
      applyTracks(content, node);
      const own = loneFieldTools(node, content);
      const tools = node.title && (workHeading(node) || own.length) ? headPart.loaded : undefined;
      if (tools) {
        content.id = uid(`${node.id}-content`);
        const head = tools.sectionHeading(headKit, node, section, content, description, own);
        if (node.collapsible) folds.set(section, () => head.show(true));
        section.append(head.legend);
      } else if (node.title && node.collapsible) {
        content.id = uid(`${node.id}-content`);
        const toggle = el(
          'button',
          { type: 'button', class: 'fd-section-toggle', 'aria-controls': content.id },
          el('span', { class: 'fd-section-chevron', 'aria-hidden': 'true' }),
          ...withIcon(node.icon, node.title)
        );
        let open = node.collapsed !== true;
        const show = (next: boolean) => {
          open = next;
          toggle.setAttribute('aria-expanded', String(open));
          content.hidden = !open;
          if (description) description.hidden = !open;
          section.classList.toggle('fd-section-folded', !open);
        };
        toggle.addEventListener('click', () => show(!open));
        folds.set(section, () => show(true));
        show(open);
        section.append(el('legend', { class: 'fd-section-title' }, toggle));
      } else if (node.title) {
        section.append(el('legend', { class: 'fd-section-title' }, ...withIcon(node.icon, node.title)));
      }
      if (description) section.append(description);
      section.append(content);
      hideWhen(section, node.id);
      return section;
    }

    function tabsItem(node: TabsNode, place: Place): HTMLElement {
      const box = el('div', { class: 'fd-tabs', 'data-node': node.id });
      spans(box, node.colspan);
      const list = el('div', { class: 'fd-tablist', role: 'tablist' });
      // The tab someone picked. Until they pick, the first visible tab is open —
      // a tab hidden while the record loads must not leave its neighbour open.
      let picked: string | null = null;
      let active = node.children[0].id;
      /** A tab shown, by a person or a step: the page's steps for it run. */
      const show = (tab: string) => {
        picked = active = tab;
        renderNow();
        form.shown(tab);
      };
      const parts = node.children.map((tab) => {
        const tabId = uid(`${tab.id}-tab`);
        const panelId = uid(`${tab.id}-panel`);
        const button = el('button', { type: 'button', class: 'fd-tab', role: 'tab', id: tabId, 'aria-controls': panelId, 'data-node': tab.id }, ...tabFace(tab));
        if (tab.iconOnly) {
          button.classList.add('fd-tab-icon-only');
          button.setAttribute('aria-label', tab.label);
          button.title = tab.label;
        }
        // On paper every tab shows, one after another, under its name.
        const panel = el('div', { class: 'fd-tabpanel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, 'data-fd-tab': tab.label, ...(tab.print === false ? { 'data-print': 'off' } : {}) });
        /**
         * A tab's parts are drawn when it is first shown, and kept up to date
         * only while it is shown: a page of many tabs costs one tab's work.
         */
        const own: Updater[] = [];
        let built = false;
        const build = () => {
          if (built) return;
          built = true;
          const outer = sink;
          sink = own;
          try {
            // A tab's parts sit where the tabs do: on the page, or in the box round them.
            panel.append(grid(tab.children, 1, { columns: 1, onPage: place.onPage, labels: place.labels, quiet: place.quiet, reason: place.reason }));
          } finally {
            sink = outer;
          }
        };
        const open = () => !form.node(tab.id).invisible && (show(tab.id), true);
        button.addEventListener('click', () => show(tab.id));
        if (!tabs.has(tab.id)) tabs.set(tab.id, open);
        // The fields it holds, to mark it while one has a problem and to open it at one.
        const fields = fieldsIn(tab.children);
        if (scope.root) for (const name of fields) if (!problemTabs.has(name)) problemTabs.set(name, open);
        list.append(button);
        return { tab, button, panel, own, build, fields };
      });
      list.addEventListener('keydown', (event) => {
        const shown = parts.filter((p) => !p.button.hidden);
        const at = shown.findIndex((p) => p.tab.id === active);
        const move = { ArrowRight: 1, ArrowLeft: -1, Home: -at, End: shown.length - 1 - at }[event.key];
        if (move === undefined || at === -1) return;
        event.preventDefault();
        const rtl = root.getAttribute('dir') === 'rtl' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft');
        const next = shown[(at + (rtl ? -move : move) + shown.length) % shown.length];
        show(next.tab.id);
        next.button.focus();
      });
      // Too long for its room, the strip scrolls; the tab chosen, however, comes into sight in it.
      const strip = tabStrip(list, el);
      cleanups.push(strip.destroy);
      // Placed in a record's head: the tabs at the end of its band, the panels the sheet's body.
      const inHead = node.place === 'head' && headNow && scope.root ? headNow : null;
      if (inHead) {
        box.classList.add('fd-tabs-in-head');
        inHead.tabs.append(strip.element);
        box.append(...parts.map((p) => p.panel));
      } else box.append(strip.element, ...parts.map((p) => p.panel));
      // A tab's count in its pill, and in its name: "Links, 0".
      for (const p of parts) {
        const count = p.tab.count;
        if (count === undefined) continue;
        const pill = p.button.querySelector<HTMLElement>('.fd-tab-count') as HTMLElement;
        if (typeof count !== 'string') {
          // The records of a related list in it, counted by the list part as the record is shown: none until known.
          pill.hidden = true;
          const related = relatedInTab(p.tab, count.related);
          if (related) countRelated(related, p.tab, p.button, pill);
          continue;
        }
        watch((state) => {
          const value = state.values[count];
          const n = Array.isArray(value) ? value.length : typeof value === 'number' ? value : Number(value ?? 0) || 0;
          setText(pill, String(n));
          setAttr(p.button, 'aria-label', fill(labels.countOf, { label: p.tab.label, count: n }));
        });
      }
      // On paper, every tab shown: drawn, and brought up to date.
      printers.push(() => {
        if (form.node(node.id).invisible) return;
        const state = form.getState();
        for (const p of parts) {
          if (form.node(p.tab.id).invisible) continue;
          p.build();
          for (const update of p.own) update(state);
        }
      });
      let shownKey = '';
      let revealed = '';
      watch((state) => {
        const tabsHidden = form.node(node.id).invisible;
        setHidden(box, tabsHidden);
        // In the head, its strip is apart from its box: hidden with it.
        if (inHead) setHidden(strip.element, tabsHidden);
        const shown = parts.filter((p) => !form.node(p.tab.id).invisible);
        const keep = picked !== null && shown.some((p) => p.tab.id === picked);
        if (keep) active = picked as string;
        else if (shown.length) active = shown[0].tab.id;
        const errors = form.getState().errors;
        for (const p of parts) {
          const selected = p.tab.id === active;
          setHidden(p.button, !shown.includes(p));
          setAttr(p.button, 'aria-selected', String(selected));
          if (p.button.tabIndex !== (selected ? 0 : -1)) p.button.tabIndex = selected ? 0 : -1;
          setAttr(p.button, 'data-problem', p.fields.some((name) => errors[name]) ? '' : null);
          setHidden(p.panel, !selected);
          // A tab hidden by its condition is left off the paper too.
          setAttr(p.panel, 'data-off', shown.includes(p) ? null : '');
          // The tab shown: drawn if it is new, and brought up to date — it was left alone while out of sight.
          if (selected && !tabsHidden) {
            p.build();
            for (const update of p.own) update(state);
          }
        }
        // Measured only when it can have changed: the strip's tabs, or the one chosen.
        const key = shown.map((p) => p.tab.id).join(' ');
        if (key !== shownKey) {
          shownKey = key;
          strip.measure();
        }
        if (active !== revealed && list.clientWidth) {
          revealed = active;
          const chosen = parts.find((p) => p.tab.id === active);
          if (chosen) strip.reveal(chosen.button);
        }
      });
      return box;
    }

    /** The fields a tab holds, in its sections and tabs inside it; a saved form placed in it keeps its own. */
    function fieldsIn(children: readonly LayoutNode[]): string[] {
      return children.flatMap((child) =>
        child.type === 'field' ? [child.field]
        : child.type === 'section' ? fieldsIn(child.children)
        : child.type === 'tabs' ? child.children.flatMap((tab) => fieldsIn(tab.children))
        : []
      );
    }

    function item(node: LayoutNode, place: Place): HTMLElement {
      return hiddenOn(node, kept(node, () => partItem(node, place)));
    }

    /**
     * A part hidden at some widths of the form (`hideOn`), as a phone's: the stylesheet hides it there. And one its page
     * leaves off paper (`"print": false`): the stylesheet for paper leaves it out.
     */
    function hiddenOn(node: { hideOn?: readonly string[]; print?: boolean }, element: HTMLElement): HTMLElement {
      if (node.hideOn?.length) element.dataset['hideOn'] = node.hideOn.join(' ');
      if (node.print === false) element.dataset['print'] = 'off';
      return element;
    }

    function partItem(node: LayoutNode, place: Place): HTMLElement {
      switch (node.type) {
        case 'field':
          return fieldItem(node, place.labels, place);
        case 'button':
          return buttonItem(node);
        case 'text':
          return textItem(node, place.inline);
        case 'slot':
          return slotItem(node);
        case 'section':
          return sectionItem(node, place);
        case 'tabs':
          return tabsItem(node, place);
        case 'divider':
        case 'spacer':
        case 'image':
          return blockItem(node);
        case 'form':
          return formItem(node, place);
        case 'map':
          return mapItem(node);
        case 'related':
          return relatedItem(node);
      }
    }

    /**
     * How many records a related list lists, in its tab's pill and name: asked by the list part (list-related.ts) as the
     * record is shown, whether the tab is open or not; where the part could not come, never known, and none shown.
     */
    function countRelated(node: RelatedNode, tab: TabNode, button: HTMLElement, pill: HTMLElement) {
      let counter: RelatedCount | null = null;
      const take = (module: NonNullable<typeof listPart.loaded>) => {
        counter = module.relatedCount({ node, form, dataSource: options.dataSource, tab, button, pill, labels, locale, fill });
        relatedCounts.set(node.id, counter);
        counter.update(form.getState());
      };
      watch((state) => counter?.update(state));
      if (listPart.loaded) take(listPart.loaded);
      else void listPart.load().then((module) => gone || take(module), () => undefined);
    }

    /**
     * Another model's records that point at this record, listed inside it: drawn by the list part (list-related.ts),
     * which the page waited for, in a box of the row's width, with the dialogs of the app's pages and the host's way to
     * open a page. Not shown where the data source cannot list records.
     */
    function relatedItem(node: RelatedNode): HTMLElement {
      const box = el('div', { 'data-node': node.id });
      spans(box, node.colspan ?? 12);
      if (!options.dataSource?.list) {
        box.hidden = true;
        return box;
      }
      let part: RelatedPart | null = null;
      const take = (module: NonNullable<typeof listPart.loaded>) => {
        part = module.relatedList({
          page, node, form, box, doc, el, labels, locale, fill, press, withIcon, uid, preferences, dialogs,
          dataSource: options.dataSource,
          icons: options.icons,
          now: options.now,
          open: (request) => actionHost.open(request),
          say: (message, tone) => actionHost.say(message, tone),
          name: recordName,
          // What it counts itself — after New, a delete — is its tab's count too.
          onCount: (total) => relatedCounts.get(node.id)?.told(total),
          // A row's record and New, the app's own way where the list says so: its host's open, else its onOpen, with the
          // page it gives for the model (that page's id, else the model's own name); null where neither takes it.
          route:
            options.host?.open || options.onOpen
              ? async (model, request) => {
                  const asked = { ...request, page: (await findPage(options, { model }))?.id ?? model };
                  return (options.host?.open ? options.host.open(asked) : options.onOpen?.(asked)) ?? null;
                }
              : undefined,
          recordsOf: modelRecords,
        });
        part.update(form.getState());
      };
      watch((state) => part?.update(state));
      cleanups.push(() => part?.destroy());
      // The part has come; where it could not, it is asked for again.
      if (listPart.loaded) take(listPart.loaded);
      else void listPart.load().then((module) => gone || take(module), () => undefined);
      hideWhen(box, node.id);
      return box;
    }

    /** What the app's page for a model calls its records, as this page is shown: now, or once the app has found it. */
    function modelRecords(model: string) {
      const of = (other: Page | null) => (other?.records ? shownAs(other).records : undefined);
      try {
        const found = findPage(options, { model });
        return found instanceof Promise ? found.then(of, () => undefined) : of(found);
      } catch {
        return undefined;
      }
    }

    /** A map of the record's places, drawn by the app's maps; told of each change to the form. */
    function mapItem(node: MapNode): HTMLElement {
      if (!options.maps) {
        if (!warnedMaps) console.warn('[Fieldia] This page has a map: give the viewer `maps` (mapParts from @fieldia/map) to draw it.');
        warnedMaps = true;
        return el('div', { class: 'fd-map-part', 'data-node': node.id, hidden: '' });
      }
      const part = options.maps({ node, page, form, document: doc, locale, icons: options.icons });
      part.element.classList.add('fd-map-part');
      part.element.dataset['node'] = node.id;
      // The whole row unless its page says: a map is read across.
      spans(part.element, node.colspan ?? 12);
      watch((state) => part.update(state));
      if (part.destroy) cleanups.push(() => part.destroy?.());
      hideWhen(part.element, node.id);
      return part.element;
    }

    /** A line across the row, empty room, or a picture: shown and hidden by its rule like any part. */
    function blockItem(node: DividerNode | SpacerNode | ImageNode): HTMLElement {
      const element =
        node.type === 'divider' ? el('hr', { class: 'fd-divider', 'data-node': node.id })
        : node.type === 'spacer' ? el('div', { class: 'fd-block fd-spacer', 'aria-hidden': 'true', 'data-node': node.id })
        : figure(node);
      if (node.type !== 'divider' && node.colspan) element.style.setProperty('--fd-span', String(node.colspan));
      hideWhen(element, node.id);
      return element;
    }

    /** A picture as wide and where its page says, opening its link in a new tab — a web or mail address only — its caption under it. */
    function figure(node: ImageNode): HTMLElement {
      const image = el('img', { class: 'fd-image', src: node.src, alt: node.alt, loading: 'lazy' });
      const href = node.href && /^(https?:\/\/|mailto:)/i.test(node.href) ? node.href : undefined;
      const element = el(
        'figure',
        { class: 'fd-block fd-figure', 'data-node': node.id, 'data-align': node.align },
        href ? el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, image) : image,
        ...(node.caption ? [el('figcaption', { class: 'fd-caption' }, node.caption)] : [])
      );
      const width = typeof node.width === 'number' ? `${node.width}px` : node.width && { small: '160px', medium: '320px', large: '480px', full: '100%' }[node.width];
      if (width) element.style.setProperty('--fd-image-width', width);
      return element;
    }

    /**
     * A saved form placed here, drawn from the page the app gives for its id
     * with a form of its own inside this one. A quiet placeholder while the
     * page comes; words in its place when it cannot be found, would hold
     * itself, or cannot sit in a form.
     */
    function formItem(node: FormNode, place: Place): HTMLElement {
      const box = el('fieldset', {
        class: 'fd-section fd-form-part',
        'data-node': node.id,
        'data-style': 'card',
        'data-on-page': place.onPage ? '' : undefined,
        'aria-busy': 'true',
      });
      spans(box, node.colspan);
      const note = el('p', { class: 'fd-form-part-note' }, labels.loading);
      box.append(note);
      hideWhen(box, node.id);
      const refuse = (words: string) => {
        box.removeAttribute('aria-busy');
        note.textContent = words;
        note.classList.add('fd-form-part-problem');
      };
      const draw = (found: Page | null, waited = false) => {
        if (gone) return;
        if (!found) return refuse(fill(labels.formMissing, { page: node.page }));
        // Saved by an older Fieldia: read in the current format, as the page round it is.
        const saved = shownAs(upgradePage(found));
        const name = saved.title || found.id;
        const at = scope.chain.findIndex((p) => p.id === found.id);
        if (at !== -1) return refuse(fill(labels.formInItself, { page: name, chain: [...scope.chain.slice(at).map((p) => p.title), name].join(' → ') }));
        if (found.layout.type !== 'sections' && found.layout.type !== 'tabs') return refuse(fill(labels.formNotPlaceable, { page: name }));
        // The parts it draws from (a date's box, a path picker) in first, as for the page round it: its placeholder
        // meanwhile, then drawn whole — never plainly, then again.
        const awaited = waited ? [] : partsFor(saved, options.widgets, options.slots).filter((part) => !part.loaded);
        if (awaited.length) return void settleParts(awaited).then(() => draw(found, true));
        const checked = checkPage(saved, options.functions ? { functions: options.functions } : {});
        let inner: Form;
        try {
          if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
          inner = form.embed(node.id, saved);
        } catch (error) {
          console.warn(`Fieldia: the saved form "${found.id}" cannot be shown: ${(error as Error).message}`);
          return refuse(fill(labels.formBroken, { page: name }));
        }
        const title = node.title ?? saved.title ?? '';
        box.setAttribute('data-title', title);
        if (title) box.prepend(el('legend', { class: 'fd-section-title' }, ...withIcon(undefined, title)));
        const own = drawer({
          root: false,
          form: inner,
          page: saved,
          prefix: `${scope.prefix}${node.id}-`,
          chain: [...scope.chain, { id: found.id, title: name }],
          locked: () => scope.locked() || form.node(node.id).readonly,
          path: `${scope.path}${node.name}.`,
        });
        const layout = saved.layout as SectionsNode | TabsNode;
        // Its parts sit in the part's box: a card there draws none of its own.
        note.replaceWith(own.grid(layout.type === 'tabs' ? [layout] : layout.children, 1, { columns: 1, onPage: false, labels: place.labels, quiet: place.quiet }));
        box.removeAttribute('aria-busy');
        cleanups.push(inner.subscribe(renderNow));
        if (mounted) renderNow();
      };
      let asked: Page | null | Promise<Page | null>;
      try {
        asked = findPage(options, node.version === undefined ? { id: node.page } : { id: node.page, version: node.version });
      } catch {
        asked = null;
      }
      if (asked instanceof Promise) asked.then(draw, () => draw(null));
      else draw(asked);
      return box;
    }

    return { item, grid, fieldItem, buttonItem, hideWhen, slotItem, pageWords };
  }

  const { item, grid, fieldItem, buttonItem, hideWhen, slotItem, pageWords } = drawer({
    root: true,
    form,
    page,
    prefix: '',
    chain: [{ id: page.id, title: page.title || page.id }],
    locked: () => false,
    path: '',
  });

  // ---- shared chrome ----------------------------------------------------------

  /** The whole form locked: every field read-only, no Save; buttons still run. */
  let locked = options.readonly === true;
  // Edit unlocks; Done saves what changed first — a file on its way too, which the save waits for — and locks only once
  // nothing of the person's is left unsaved.
  const editSwitch = options.editSwitch ? el('button', { type: 'button', class: 'fd-button fd-edit-switch' }) : null;
  editSwitch?.addEventListener('click', async () => {
    if (!locked) {
      // What is still typed is read first (a name being looked up, waited for): Done never locks a record over text
      // that is not saved.
      const waiting = form.settle();
      if (form.reading()) await waiting;
      const now = form.getState();
      const saving = now.dirty.length > 0 || Object.keys(now.unread).length > 0 || (now.uploads ?? []).some(uploadGoing);
      if (saving) {
        const saved = await form.save();
        if (!saved) {
          if (!form.getState().saveProblem) announce(checkText(form.getState()));
          focusFirstProblem();
          return;
        }
      }
      // Work at risk — changed while it saved, a change set aside, a file no save sent — keeps it editable, and is
      // said, so nothing unsaved is locked away unseen.
      if (workAtRisk(form.getState())) {
        announce(saving ? labels.savedNotAll : labels.notAllSaved);
        return;
      }
      locked = true;
    } else locked = false;
    root.toggleAttribute('data-readonly', locked);
    // Conditions read `editing`: parts for editing only, or reading only, follow.
    form.setEditing(!locked);
    render(form.getState());
  });
  root.toggleAttribute('data-readonly', locked);
  form.setEditing(!locked);
  updaters.push((state) => {
    // A record its source lets the person only read is read whole, as a locked form is: its values as words.
    setAttr(root, 'data-readonly', locked || state.can?.edit === false ? '' : null);
    if (!editSwitch) return;
    // No Edit for a record its source lets the person only read.
    setHidden(editSwitch, state.can?.edit === false);
    editSwitch.textContent = locked ? labels.edit : labels.done;
    editSwitch.classList.toggle('fd-button-primary', locked);
  });

  // The status says its words alone, so a screen reader hears them; Retry sits beside it.
  const statusText = el('div', { class: 'fd-status', role: 'status', 'aria-live': 'polite' });
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link fd-retry', hidden: '' }, labels.retry);
  retry.addEventListener('click', () => void submitOrSave());
  const status = el('div', { class: 'fd-status-box' }, statusText, retry);
  const notDone = () => (page.data.kind === 'responses' ? labels.notSent : labels.notSaved);
  /**
   * "Not saved. Check: Email, Phone": the fields with a problem, in the order
   * they show; one inside a saved form with that form's title, "Street (Home address)".
   */
  function checkText(state: FormState): string {
    const fieldsShown = [...root.querySelectorAll<HTMLElement>('.fd-field[data-path]')];
    const found: { name: string; at: number }[] = [];
    for (const key of Object.keys(state.errors)) {
      // The field itself, or — for a line's — the table it is in.
      let shown: HTMLElement | undefined;
      for (let path = key; path && !shown; path = path.slice(0, Math.max(0, path.lastIndexOf('.')))) {
        shown = fieldsShown.find((field) => field.getAttribute('data-path') === path && !field.hidden);
      }
      const first = key.split('.')[0];
      const label = shown?.querySelector(':scope > .fd-label')?.firstChild?.textContent ?? page.fields[first]?.label ?? first;
      const within = shown?.closest('.fd-form-part')?.getAttribute('data-title');
      const name = within ? `${label} (${within})` : label;
      if (!found.some((f) => f.name === name)) found.push({ name, at: shown ? fieldsShown.indexOf(shown) : Infinity });
    }
    const names = found.sort((a, b) => a.at - b.at).map((f) => f.name);
    const small = labelAt(labels.checkFields, 'fields', page.lowerLabels, locale);
    return names.length ? fill(labels.checkFields, { what: notDone(), fields: names.map(small).join(', ') }) : notDone();
  }
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * A save waiting for files still on their way: how many, said where Saving… would be. Save waits, and says why. A way
   * out waiting for the save on its way, or for files on theirs, before it checks the person's work, says so too.
   */
  function waitingFor(state: FormState): string {
    return waitWords(state, labels, page.data.kind === 'responses', fill);
  }
  /** Saved, or sent — or not all of it: never "Saved" while a change of the person's is still to save, or a file on its way. */
  const savedWords = () => (!workAtRisk(form.getState()) ? labels.saved : page.data.kind === 'responses' ? labels.sentNotLatest : labels.savedNotAll);
  updaters.push((state) => {
    const problem = state.saveProblem;
    const text =
      waitingFor(state) ||
      (state.status === 'saving' ? labels.saving
      : state.status === 'saved' ? savedWords()
      : state.status === 'loading' ? labels.loading
      : state.status === 'error' && problem ? (problem.kind === 'fields' ? checkText(state) : problem.kind === 'other' ? problem.message : notDone())
      : state.status === 'error' ? state.error ?? ''
      : '');
    // A problem is said once, at once, by the announcer (or the banner, or a dialog): the status shows it and keeps quiet.
    setAttr(statusText, 'aria-live', state.status === 'error' && problem ? 'off' : 'polite');
    setText(statusText, text);
    setHidden(retry, !(state.status === 'error' && problem?.kind === 'other'));
    const allSaved = state.status === 'saved' && text === labels.saved;
    statusText.classList.toggle('fd-status-error', state.status === 'error');
    statusText.classList.toggle('fd-status-saved', allSaved);
    // A toast shows while there is something to say, and lets "Saved" go after a moment.
    if (options.saveStatus === 'toast') {
      clearTimeout(quietTimer);
      status.hidden = !text;
      if (allSaved) quietTimer = setTimeout(() => (status.hidden = true), 2500);
    }
  });

  // A save the network failed: a banner over the page, with Retry.
  const bannerRetry = el('button', { type: 'button', class: 'fd-button fd-retry' }, labels.retry);
  bannerRetry.addEventListener('click', () => void submitOrSave());
  const banner = el('div', { class: 'fd-banner fd-tone-warning', role: 'alert', hidden: '' }, el('span', { class: 'fd-banner-text' }, labels.offline), bannerRetry);
  /** Said at once to a screen reader: why a save or send did not go through. */
  const announcer = el('div', { class: 'fd-announce', role: 'alert', 'aria-live': 'assertive' });
  function announce(text: string) {
    announcer.textContent = '';
    setTimeout(() => (announcer.textContent = text), 0);
  }
  // Each new reason a save was refused, from Save or from autosave, is shown where it belongs.
  let seenProblem: FormState['saveProblem'] = null;
  updaters.push((state) => {
    if (state.saveProblem === seenProblem) return;
    seenProblem = state.saveProblem;
    banner.hidden = seenProblem?.kind !== 'network';
    if (!seenProblem) return;
    if (seenProblem.kind === 'rule') void dialogConfirm(seenProblem.message, false);
    else if (seenProblem.kind === 'fields') announce(checkText(state));
    else if (seenProblem.kind === 'other') announce(seenProblem.message);
  });

  // Save safety, over the record: someone else's save first (Reload, Keep mine), the changes Reload set aside, a record only to read.
  const safety = saveSafety({ doc, el, form, page, labels, locale, tag, icons: options.icons, fill, announce, root: () => root, discard: () => letGoAsked() });
  updaters.push(safety.update);
  // Possible duplicates (`duplicates`): records like this one, asked of the source as it is typed and saved, said under
  // the fields they matched on — in a part of their own, asked for where the page names fields and its source can
  // answer; the page is drawn meanwhile, and nothing is said before an answer comes.
  if (page.duplicates && form.canFindDuplicates()) {
    let watching: { destroy(): void } | null = null;
    duplicatesPart.load().then(
      (part) => {
        if (gone) return;
        watching = part.watchDuplicates({ form, page, root, doc, el, labels, locale, tag, icons: options.icons, preferences, fill, say: (message, tone) => actionHost.say(message, tone), editable: () => !locked });
      },
      // A part that could not come: nothing is said, as without the source's duplicates.
      () => undefined
    );
    cleanups.push(() => watching?.destroy());
  }

  const draft = el('div', { class: 'fd-draft', hidden: '' });
  const draftText = el('span');
  const restore = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.restore);
  const discardDraft = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.discardDraft);
  restore.addEventListener('click', () => form.restoreDraft());
  discardDraft.addEventListener('click', () => form.discardDraft());
  draft.append(draftText, restore, discardDraft);
  updaters.push((state) => {
    setHidden(draft, !state.draft);
    if (state.draft) draftText.textContent = fill(labels.draftFound, { time: new Date(state.draft.savedAt).toLocaleString() });
  });

  function focusFirstProblem() {
    // A problem in a tab out of sight, or not drawn yet: its tab shown first, the first such in the page's order.
    const seen = [...root.querySelectorAll<HTMLElement>('[aria-invalid="true"]')].find((e) => !e.closest('.fd-tabpanel[hidden]'));
    if (!seen) {
      const errors = form.getState().errors;
      const first = [...problemTabs.keys()].find((name) => errors[name]);
      if (first) problemTabs.get(first)?.();
    }
    const invalid = [...root.querySelectorAll<HTMLElement>('[aria-invalid="true"]')].find((e) => !e.closest('.fd-tabpanel[hidden]')) ?? null;
    if (!invalid) return;
    for (let folded = invalid.closest<HTMLElement>('.fd-section-folded'); folded; folded = folded.parentElement?.closest<HTMLElement>('.fd-section-folded') ?? null) {
      folds.get(folded)?.();
    }
    // A widget that knows where its problem is (a cell of a grid) takes the focus there itself.
    if (!invalid.dispatchEvent(new CustomEvent('fd-focus-problem', { cancelable: true }))) return;
    const target = invalid.matches('input, select, textarea, button') ? invalid : invalid.querySelector<HTMLElement>('input, select, textarea, button');
    target?.focus();
  }

  const doneTitle = el('p', { class: 'fd-done-title' }, labels.submitted);
  const done = el('div', { class: 'fd-done', hidden: '' }, doneTitle);
  // An ending's own words, under its title: a paragraph for each of its lines.
  const doneWords = page.endings?.length ? el('div', { class: 'fd-done-text' }) : null;
  if (doneWords) done.append(doneWords);
  const again = el('button', { type: 'button', class: 'fd-button' }, labels.submitAnother);
  // A page that takes one response from each person offers no other.
  if (page.limits?.onePerPerson) again.hidden = true;
  done.append(again);
  const content = el('div', { class: 'fd-content' });
  /**
   * A page's opening, closing and limits, and Continue later (`limits`, `continueLater`), from the limits part, waited
   * for with the page's parts: a closed form's words in place of its questions, under its title.
   */
  const limitsAsked = !!(page.limits || page.continueLater || options.resume);
  let limitsKit: LimitsKit | null = null;
  /** The page's questions and their buttons, once drawn: what a closed form's words, or what Continue later kept, stand in place of. */
  let questions: HTMLElement | null = null;

  /**
   * The answers sent: the page's ending for them (`form.ending()`) — its title, its words with the answers they name and
   * the id the app gave the response (`{id}`), its button to start again or none — else the plain thanks. An ending
   * takes the focus, so what it says, the reference with it, is read out.
   */
  function showDone() {
    content.hidden = true;
    done.hidden = false;
    const answers = doneWords && answersPart.loaded;
    if (!answers || !doneWords) return;
    answers.drawEnding({ doc, page, form, locale, write: asSaid, title: doneTitle, words: doneWords, again, thanks: labels.submitted, another: labels.submitAnother })?.focus();
  }

  async function submitOrSave() {
    // A record only to read has nothing to save: Ctrl+Enter there does nothing.
    if (form.getState().can?.edit === false) return;
    const saved = await form.save();
    if (!saved) {
      // Stopped by the page's own checks: say which fields; a refused save says so above.
      if (!form.getState().saveProblem) announce(checkText(form.getState()));
      focusFirstProblem();
      return;
    }
    if (page.data.kind === 'responses') {
      // An answer changed while they were on their way was not sent: the form stays, and says so, not "Thank you".
      if (workAtRisk(form.getState())) {
        announce(labels.sentNotLatest);
        return;
      }
      showDone();
    }
  }
  again.addEventListener('click', () => {
    form.reset();
    content.hidden = false;
    done.hidden = true;
  });

  /** The record's name, as the last of its breadcrumbs says it: its sheet's title field, else the page's title; empty for a new one. */
  function recordName(): string {
    const state = form.getState();
    if (state.recordId == null) return '';
    return ownName() || page.title || '';
  }

  /**
   * The record's own name: the words of the field its records are named by (`nameFieldOf`: its sheet's title field,
   * else its "name", else its first line of text), on a sheet or a page of sections alike; empty where it has none (yet).
   */
  function ownName(): string {
    const state = form.getState();
    const field = page.data.kind === 'record' ? nameFieldOf(page) : null;
    return field && page.fields[field] ? displayValue(page.fields[field] as LineField, state.values[field], state.values as Values, locale) : '';
  }

  /** The bar over a record — its breadcrumbs, its gear menu, its pager — or null when it would hold nothing. */
  function topBar(toolbar: SheetNode['toolbar']): HTMLElement | null {
    if (page.data.kind !== 'record') return null;
    // Record templates people save and name (`templates`): their menu, from the part the page waited for.
    const kit = page.templates ? templatesPart.loaded : undefined;
    const extra = kit?.templatesMenu({ doc, el, form, page, labels, locale, preferences, ...(options.dataSource ? { dataSource: options.dataSource } : {}), fill, say: (message, tone) => actionHost.say(message, tone), ask: (request) => dialogs.editValues(request) });
    const bar = recordBar({
      doc,
      el,
      form,
      toolbar,
      ...(extra ? { extra } : {}),
      records: options.records,
      breadcrumbs: options.breadcrumbs,
      labels,
      locale,
      icons: options.icons,
      uid,
      fill,
      withIcon,
      press,
      name: recordName,
      render: renderNow,
      async leave() {
        // What is still typed is read first (a name being looked up, waited for): text that does not read keeps the
        // record on screen, said, as a change does. The changes are saved first, as the pager always has; a file still
        // on its way is a change too: the save waits for it.
        const waiting = form.settle();
        if (form.reading()) await waiting;
        const state = form.getState();
        // A record its source lets the person only read — locked by its own last save, say — has nothing to save: what
        // was typed in it is asked about by the one check below, never tried again and refused for ever.
        const locked = state.can?.edit === false;
        if (!locked && (state.dirty.length || Object.keys(state.unread).length || state.uploads.some(uploadGoing))) {
          const saved = await form.save();
          if (!saved) {
            if (!form.getState().saveProblem) announce(checkText(form.getState()));
            focusFirstProblem();
            return false;
          }
        }
        // What that save could not take, and changes Reload set aside: the form's one check.
        return form.leave();
      },
    });
    if (!bar) return null;
    updaters.push(bar.update);
    cleanups.push(bar.destroy);
    return bar.element;
  }

  function pageHead(): HTMLElement | null {
    if (!page.title && !page.description) return null;
    const head = el('header', { class: 'fd-page-head' });
    if (page.title) head.append(el('h1', { class: 'fd-page-title' }, page.title));
    if (page.description) head.append(el('p', { class: 'fd-page-description' }, page.description));
    return head;
  }

  // ---- the four page layouts ---------------------------------------------------

  /**
   * A page's own buttons at its foot, as a wizard's, in place of its Save and
   * Discard; null when it has none, or when a dialog round it draws them.
   */
  function pageFooter(footer: ButtonNode[] | undefined): HTMLElement | null {
    if (!footer?.length || options.showActions === false) return null;
    return el('div', { class: 'fd-actions fd-actions-end fd-page-footer' }, status, ...footer.map(buttonItem));
  }

  function sectionsLayout(node: { id: string; children: LayoutNode[]; footer?: ButtonNode[] }): HTMLElement {
    const box = el('div', { class: 'fd-sections', 'data-node': node.id }, ...node.children.map((child) => item(child, top(true))));
    const own = pageFooter(node.footer);
    if (own) return el('div', {}, box, own);
    const action = el('button', { type: 'submit', class: 'fd-button fd-button-primary' }, page.data.kind === 'responses' ? labels.submit : labels.save);
    const actions = el('div', { class: 'fd-actions fd-actions-end' }, status, ...(limitsKit?.later ? [limitsKit.later] : []), action);
    if (page.data.kind === 'record') {
      // A record offers Save and Discard once something changes, the same as on a sheet.
      const discard = el('button', { type: 'button', class: 'fd-button' }, labels.discard);
      discard.addEventListener('click', () => form.reset());
      actions.insertBefore(discard, action);
      updaters.push((state) => {
        // A file on its way is a change coming: Save shows for it, and waits.
        const dirty = (state.dirty.length > 0 || (state.uploads ?? []).some(uploadGoing)) && state.status !== 'saving' && !locked && state.can?.edit !== false;
        setHidden(action, !dirty);
        setHidden(discard, !dirty);
      });
    } else updaters.push(() => setHidden(action, locked));
    if (editSwitch) actions.prepend(editSwitch);
    if (options.showActions === false) return el('div', {}, box);
    if (page.actionsPosition === 'top') {
      actions.classList.add('fd-actions-top');
      return el('div', {}, actions, box);
    }
    return el('div', {}, box, actions);
  }

  function wizardLayout(node: WizardNode): HTMLElement {
    const box = el('div', { class: 'fd-wizard', 'data-node': node.id });
    const progressText = el('div', { class: 'fd-progress-text' });
    const bar = el('span');
    box.append(el('div', { class: 'fd-progress' }, progressText, el('div', { class: 'fd-progress-bar' }, bar)));
    // A clickable wizard lists its steps: back to any, forward past those that are complete.
    const list = node.clickable ? el('ol', { class: 'fd-steps-list' }) : null;
    const stepButtons = new Map<string, HTMLButtonElement>();
    if (list) {
      for (const step of node.children) {
        // A step's title, its list's and its own, with the answers it names: "Your visit to {branch}".
        const go = el('button', { type: 'button', class: 'fd-step-link' }, ...withIcon(step.icon, pageWords(step.label)));
        go.addEventListener('click', async () => {
          if (form.goTo(step.id)) return focusStep();
          // Refused while a name typed is still being looked up: once it is found, or not, it is asked again — on the
          // record it was pressed on, never another shown meanwhile.
          const shown = form.recordShown();
          if (form.reading()) await form.settle();
          if (!shown()) return;
          if (form.reading() || !form.goTo(step.id)) return focusFirstProblem();
          focusStep();
        });
        stepButtons.set(step.id, go);
        list.append(el('li', {}, go));
      }
      box.append(el('nav', { class: 'fd-steps', 'aria-label': labels.steps }, list));
    }
    const panels = node.children.map((step) => {
      const panel = el('section', { class: 'fd-step', 'data-node': step.id, 'aria-labelledby': uid(`${step.id}-title`) });
      panel.append(el('h2', { class: 'fd-step-title', id: uid(`${step.id}-title`) }, ...withIcon(step.icon, pageWords(step.label))));
      if (step.description) panel.append(el('p', { class: 'fd-section-description' }, ...pageWords(step.description)));
      // The step is the box: a card in it draws none of its own.
      panel.append(grid(step.children, 1, top(false)));
      box.append(panel);
      return { step, panel };
    });
    const back = el('button', { type: 'button', class: 'fd-button' }, ...pageWords(node.backLabel ?? labels.back));
    const skip = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.skip);
    const forward = el('button', { type: 'submit', class: 'fd-button fd-button-primary' });
    box.append(el('div', { class: 'fd-wizard-nav' }, back, el('span', { class: 'fd-spacer' }), status, ...(limitsKit?.later ? [limitsKit.later] : []), skip, forward));
    back.addEventListener('click', () => {
      if (form.back()) focusStep();
    });
    skip.addEventListener('click', () => {
      if (form.skip()) focusStep();
    });
    const isLast = () => {
      const steps = form.steps();
      return steps.indexOf(form.getState().step ?? '') === steps.length - 1;
    };
    wizardForward = async () => {
      if (isLast()) return submitOrSave();
      // What is still typed is read first (form.next): a step goes on with what the boxes show. Refused while a name
      // typed is still being looked up, it waits for it, then asks again: the record it names, or why there is none.
      if (form.next()) return focusStep();
      const shown = form.recordShown();
      if (form.reading()) await form.settle();
      if (!shown()) return;
      if (!form.reading() && form.next()) return focusStep();
      focusFirstProblem();
    };
    function focusStep() {
      const current = panels.find((p) => p.step.id === form.getState().step);
      current?.panel.querySelector<HTMLElement>('input, select, textarea, [role=radio]')?.focus();
    }
    updaters.push((state) => {
      const steps = form.steps();
      const index = Math.max(0, steps.indexOf(state.step ?? ''));
      progressText.textContent = fill(labels.stepOf, { n: index + 1, total: steps.length });
      bar.style.width = `${((index + 1) / Math.max(1, steps.length)) * 100}%`;
      for (const { step, panel } of panels) {
        panel.hidden = step.id !== state.step;
        // A step its answers pass over is left off the paper too.
        setAttr(panel, 'data-off', steps.includes(step.id) ? null : '');
      }
      const last = index === steps.length - 1;
      back.hidden = index === 0;
      skip.hidden = last || !node.children.find((step) => step.id === state.step)?.optional;
      // Its words as they read now: a page's own may name the answers given ("Send to {branch}").
      const words = last ? node.finishLabel ?? labels.submit : node.nextLabel ?? labels.next;
      forward.textContent = words.includes('{') ? form.words(words) : words;
      for (const [id, go] of stepButtons) {
        const at = steps.indexOf(id);
        (go.parentElement as HTMLElement).hidden = at === -1;
        go.classList.toggle('fd-step-done', at !== -1 && at < index);
        go.classList.toggle('fd-step-skipped', state.skipped.includes(id));
        if (id === state.step) go.setAttribute('aria-current', 'step');
        else go.removeAttribute('aria-current');
      }
    });
    return box;
  }

  function sheetLayout(node: SheetNode): HTMLElement {
    // A head comes in the head part, waited for before the page is drawn; where it could not come, the sheet is drawn plainly.
    const part = node.head ? headPart.loaded : undefined;
    if (part) return headedLayout(node, part);
    const pageBox = el('div', { class: 'fd-sheet-page', 'data-node': node.id });
    const actions = el('div', { class: 'fd-actions' });
    const save = el('button', { type: 'submit', class: 'fd-button fd-button-primary' }, labels.save);
    const discard = el('button', { type: 'button', class: 'fd-button' }, labels.discard);
    discard.addEventListener('click', () => form.reset());
    // Save and Discard lead the header bar, or close the sheet when the page puts them at its foot.
    const atFoot = page.actionsPosition === 'bottom';
    const foot = el('div', { class: 'fd-actions fd-actions-end fd-sheet-foot' });
    const own = pageFooter(node.footer);
    if (options.showActions === false || own) actions.append(...(node.buttons ?? []).map(buttonItem));
    else if (atFoot) {
      actions.append(...(node.buttons ?? []).map(buttonItem));
      foot.append(status, discard, save);
    } else actions.append(save, discard, ...(node.buttons ?? []).map(buttonItem), status);
    // The Edit switch leads the header bar, before Save and the record's own buttons.
    if (editSwitch && options.showActions !== false) actions.prepend(editSwitch);
    updaters.push((state) => {
      // A file on its way is a change coming: Save shows for it, and waits.
      const dirty = (state.dirty.length > 0 || (state.uploads ?? []).some(uploadGoing)) && state.status !== 'saving' && !locked && state.can?.edit !== false;
      save.hidden = !dirty;
      discard.hidden = !dirty;
    });
    const header = el('div', { class: 'fd-header' }, actions);
    const underTitle = node.statusbar?.position === 'title';
    if (node.statusbar && !underTitle) header.append(statusbar(node.statusbar));

    const card = el('div', { class: 'fd-card' });
    const ribbons = [...(node.ribbon ? [node.ribbon] : []), ...(node.ribbons ?? [])];
    if (ribbons.length) {
      // The ribbons are clipped to the card's corner by their own frame, so the card itself never clips: lists open past it.
      const frame = el('div', { class: 'fd-ribbon-frame' });
      const drawn = ribbons.map((ribbon) => {
        const element = el('div', { class: `fd-ribbon fd-tone-${ribbon.tone ?? 'muted'}`, 'data-node': ribbon.id, title: ribbon.tooltip }, ribbon.label);
        frame.append(element);
        return { ribbon, element };
      });
      // One corner, one ribbon: the first whose condition holds; its words from a field when the field holds any.
      updaters.push((state) => {
        let shown = false;
        for (const { ribbon, element } of drawn) {
          const show: boolean = !shown && !form.node(ribbon.id).invisible;
          shown ||= show;
          setHidden(element, !show);
          if (!show) continue;
          const from = ribbon.labelField ? displayValue(page.fields[ribbon.labelField] as LineField, state.values[ribbon.labelField], state.values, locale) : '';
          setText(element, from || ribbon.label);
        }
      });
      card.append(frame);
    }
    if (node.statButtons?.length) {
      const stats = el('div', { class: 'fd-stats' });
      /** A field's value as the field shows it: money with its currency, a date, a count grouped. */
      const shownValue = (name: string | undefined, values: Values) =>
        name && page.fields[name] ? displayValue(page.fields[name] as LineField, values[name], values, locale) : '';
      for (const stat of node.statButtons) {
        const value = el('span', { class: 'fd-stat-value' });
        const label = el('span', { class: 'fd-stat-label' }, stat.label);
        // A second value with words of its own: the two one over the other, each after its words.
        const second = stat.secondField && stat.secondLabel !== undefined ? { value: el('span', { class: 'fd-stat-value' }), label: el('span', { class: 'fd-stat-label' }, stat.secondLabel) } : null;
        const icon = drawIcon(doc, stat.icon, options.icons);
        const words = second
          ? el('span', { class: 'fd-stat-words fd-stat-pair' }, el('span', { class: 'fd-stat-row' }, label, value), el('span', { class: 'fd-stat-row' }, second.label, second.value))
          : el('span', { class: 'fd-stat-words' }, value, label);
        // Its help, as Flectra's help=: its tooltip, and its description for a screen reader — never its name.
        const helpId = stat.help ? uid(`${stat.id}-help`) : undefined;
        const button = el('button', { type: 'button', class: 'fd-stat', 'data-node': stat.id, title: stat.help || undefined, 'aria-describedby': helpId }, ...(icon ? [icon, words] : [words]));
        if (helpId) stats.append(el('span', { class: 'fd-sr-only', id: helpId }, stat.help as string));
        button.addEventListener('click', () => void press(button, () => form.runAction(stat.id)));
        updaters.push((state) => {
          button.hidden = form.node(stat.id).invisible;
          const values = state.values as Values;
          const unit = shownValue(stat.unitField, values) || stat.unit || '';
          const first = shownValue(stat.field, values);
          const other = shownValue(stat.secondField, values);
          if (second) {
            setText(value, first);
            setText(second.value, [other, unit].filter(Boolean).join(' '));
          } else setText(value, [[first, other].filter(Boolean).join(' / '), first || other ? unit : ''].filter(Boolean).join(' '));
          setText(label, shownValue(stat.labelField, values) || stat.label);
        });
        stats.append(button);
      }
      // No empty row while every button is hidden, as with the badges.
      updaters.push(() => {
        stats.hidden = [...stats.querySelectorAll<HTMLElement>(':scope > .fd-stat')].every((stat) => stat.hidden);
      });
      card.append(stats);
    }
    card.append(...alertBoxes(node));
    if (node.badges?.length) {
      const badges = el('div', { class: 'fd-badges' });
      for (const badge of node.badges) {
        const chip = el('span', { class: `fd-badge fd-tone-${badge.tone ?? 'muted'}`, 'data-node': badge.id }, ...withIcon(badge.icon, badge.label));
        hideWhen(chip, badge.id);
        badges.append(chip);
      }
      updaters.push(() => {
        badges.hidden = [...badges.children].every((chip) => (chip as HTMLElement).hidden);
      });
      card.append(badges);
    }
    if (node.title) {
      const title = el('div', { class: 'fd-title' });
      // Words over the title, as Flectra's "Product Name" over its h1, naming its box.
      if (node.title.label) title.append(el('label', { class: 'fd-title-label', for: uid('#title') }, node.title.label));
      if (node.title.above?.length) title.append(el('div', { class: 'fd-title-above' }, ...node.title.above.map((part) => fieldItem(part))));
      // The record's name, and its subtitle, wrap on a narrow screen rather than be cut: a long name reads from its start.
      const name = fieldItem({ type: 'field', id: '#title', field: node.title.field, placeholder: node.title.placeholder, ...(node.title.placeholderWhen ? { placeholderWhen: node.title.placeholderWhen } : {}), ...(node.title.focus ? { focus: true } : {}), options: { wraps: true } });
      // Fields on the title's line, before and after it: a priority star, a state's dot (Flectra's <h1>).
      const before = node.title.before ?? [];
      const after = node.title.after ?? [];
      if (before.length || after.length) {
        name.classList.add('fd-title-name');
        const side = (part: FieldNode) => {
          const item = fieldItem(part);
          item.classList.add('fd-title-side');
          return item;
        };
        title.append(el('div', { class: 'fd-title-line' }, ...before.map(side), name, ...after.map(side)));
      } else title.append(name);
      if (node.title.subtitleField) title.append(fieldItem({ type: 'field', id: '#subtitle', field: node.title.subtitleField, options: { wraps: true } }));
      if (node.title.below?.length) title.append(el('div', { class: 'fd-title-below' }, ...node.title.below.map((part) => fieldItem(part))));
      const row = el('div', { class: 'fd-title-row' }, title);
      if (node.title.avatarField) {
        const avatar = fieldItem({ type: 'field', id: '#avatar', field: node.title.avatarField });
        avatar.classList.add('fd-avatar');
        row.append(avatar);
      }
      card.append(row);
    }
    if (node.statusbar && underTitle) card.append(el('div', { class: 'fd-title-statusbar' }, statusbar(node.statusbar)));
    card.append(grid(node.children, 1, top(false)));
    if (own) card.append(own);
    if (atFoot && options.showActions !== false) {
      card.append(foot);
      updaters.push((state) => {
        foot.hidden = state.dirty.length === 0 && !statusText.textContent;
      });
    }

    const layout = el('div', { class: 'fd-sheet-layout' }, card);
    if (node.attachmentPreview) {
      // Beside the sheet on a wide form, the side panel then under the sheet; under the sheet on a narrow one.
      const preview = attachmentPreview({ doc, el, form, page, node: node.attachmentPreview, dataSource: options.dataSource, labels, fill });
      layout.classList.add('fd-has-preview');
      layout.append(preview.element);
      updaters.push(preview.update);
      cleanups.push(preview.destroy);
    }
    if (node.sidePanel) {
      layout.classList.add('fd-has-side');
      if (node.sidePanelBeside) layout.setAttribute('data-side-beside', node.sidePanelBeside);
      layout.append(el('aside', { class: 'fd-side' }, slotItem(node.sidePanel)));
    }
    const bar = topBar(node.toolbar);
    pageBox.append(...(bar ? [bar] : []), header, layout);
    return pageBox;
  }

  /** The sheet's alerts: its words with the values they name, or a field's words while it holds any; its buttons after them, as links unless styled. */
  function alertBoxes(node: SheetNode): HTMLElement[] {
    return (node.alerts ?? []).map((alert) => {
      const words = valueWords(doc, page.fields, alert.message, locale, answersPart.loaded && asSaid);
      const message = el('span', { class: 'fd-alert-message' }, ...words.nodes);
      let fromField = false;
      const box = el('div', { class: `fd-alert fd-tone-${alert.tone ?? 'info'}`, role: 'status', 'data-node': alert.id }, message);
      if (alert.buttons?.length) box.append(el('span', { class: 'fd-alert-actions' }, ...alert.buttons.map((button) => buttonItem({ ...button, style: button.style ?? 'link' }))));
      updaters.push((state) => {
        words.update(state.values);
        const from = alert.messageField ? state.values[alert.messageField] : null;
        const said = typeof from === 'string' ? from.trim() : '';
        if (said) setText(message, said);
        else if (fromField) message.replaceChildren(...words.nodes);
        fromField = !!said;
      });
      if (alert.dismissible) {
        // Closed, it stays closed while the page is open, whatever its condition does.
        let dismissed = false;
        const close = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': labels.dismiss }, '×');
        close.addEventListener('click', () => {
          dismissed = true;
          box.hidden = true;
        });
        box.append(close);
        updaters.push(() => {
          box.hidden = dismissed || form.node(alert.id).invisible;
        });
      } else hideWhen(box, alert.id);
      return box;
    });
  }

  /**
   * A record with a head (`SheetHead`), as a work item: the head — its kind,
   * title, row, buttons and band, the tabs placed in it — then the body, which
   * holds its alerts and its parts (a tab's panels, when its tabs are in the
   * head). The record's breadcrumbs and pager, when the app gives them, over
   * it; its gear menu is the head's ⋮.
   */
  function headedLayout(node: SheetNode, part: HeadPart): HTMLElement {
    const pageBox = el('div', { class: 'fd-sheet-page fd-head-page', 'data-node': node.id });
    const head = part.recordHead({
      doc,
      el,
      form,
      page,
      sheet: node,
      head: node.head as NonNullable<SheetNode['head']>,
      labels,
      locale,
      icons: options.icons,
      uid,
      fill,
      withIcon,
      press,
      say: (message, tone) => actionHost.say(message, tone),
      fieldItem,
      item,
      buttonItem,
      watch: (update) => updaters.push(update),
      cleanups,
      showTab: (id) => tabs.get(id)?.() ?? false,
      unfold(part) {
        for (let folded = part.closest<HTMLElement>('.fd-section-folded'); folded; folded = folded.parentElement?.closest<HTMLElement>('.fd-section-folded') ?? null) folds.get(folded)?.();
      },
      root: () => root,
    });
    // The parts drawn now: tabs placed in the head go to its band.
    headNow = head;
    let parts: HTMLElement;
    try {
      parts = grid(node.children, 1, top(false));
    } finally {
      headNow = null;
    }
    const body = el('div', { class: 'fd-head-body' }, ...alertBoxes(node), parts);
    // The side panel beside the body on a wide page; a dialog leaves it to the full page.
    const side = node.sidePanel ? el('aside', { class: 'fd-side' }, slotItem(node.sidePanel)) : null;
    const bar = topBar(node.toolbar ? { ...node.toolbar, menu: undefined } : undefined);
    pageBox.append(...(bar ? [bar] : []), head.element, side ? el('div', { class: 'fd-head-layout' }, body, side) : body);
    return pageBox;
  }

  /** The sheet header's statusbar: the same widget a form can place anywhere. */
  function statusbar(config: NonNullable<SheetNode['statusbar']>): HTMLElement {
    const def = page.fields[config.field];
    const barOptions: { [key: string]: JsonValue } = { clickable: config.clickable === true };
    if (config.visibleStates) barOptions['visibleStates'] = config.visibleStates;
    for (const key of ['durationsField', 'fold', 'saves'] as const) if (config[key] !== undefined) barOptions[key] = config[key];
    const node: FieldNode = { type: 'field', id: '#statusbar', field: config.field, widget: 'statusbar', options: barOptions };
    const widget = createWidget(
      { form, name: config.field, field: def, node, id: uid('statusbar'), document: doc, labels: widgetLabels, preferences, locale, dialogs, onError: report },
      options.widgets
    );
    if (widget.destroy) cleanups.push(() => widget.destroy?.());
    updaters.push((state) => {
      // Hidden while its own condition holds, or from people outside its roles.
      setHidden(widget.element, form.node('#statusbar').invisible);
      widget.update({ value: state.values[config.field], values: state.values, readonly: form.node('#statusbar').readonly || locked, required: false, invalid: false });
    });
    return widget.element;
  }

  let wizardForward: (() => Promise<void>) | null = null;

  const layout = page.layout;
  /** A list page's way to ask for its records again (handle.reload). */
  let reloadList: (() => Promise<void>) | null = null;
  /** And its way to open a record as its row's press does (handle.openRecord). */
  let openInList: ((id: RecordId, options?: OpenRowOptions) => Promise<void>) | null = null;

  /**
   * The page itself — its layout, head and bar — drawn whole: at once when every part it draws from is in, else once
   * they have come (or could not, when what they would have drawn is drawn plainly). Nothing of it is shown before, so
   * nothing moves as a part arrives, and no focus is lost: there was nothing to have it.
   */
  function drawPage() {
    const limits = limitsAsked ? limitsPart.loaded : undefined;
    if (limits) {
      const kit = limits.drawLimits({ form, page, doc, el, labels, messages: options.messages ?? MESSAGES[locale], fill, content: () => questions, done: () => !done.hidden, announce });
      updaters.push((state) => kit.update(state));
      limitsKit = kit;
    }
    let body: HTMLElement;
    if (layout.type === 'sheet') body = sheetLayout(layout);
    else if (layout.type === 'wizard') body = wizardLayout(layout);
    else if (layout.type === 'tabs') body = sectionsLayout({ id: `${layout.id}-page`, children: [layout] });
    else if (layout.type === 'list') {
      const context: ListContext = {
        page,
        node: layout,
        form,
        dataSource: options.dataSource,
        doc,
        el,
        labels,
        locale,
        fill,
        press,
        withIcon,
        uid,
        icons: options.icons,
        preferences,
        onOpenRecord: options.onOpenRecord,
        ...(options.now ? { now: options.now } : {}),
        ...(options.listFilter ? { fixedFilter: options.listFilter } : {}),
        ...(options.listSearch ? { search: options.listSearch } : {}),
        ...(options.listViews ? { views: options.listViews } : {}),
        ...newListRecord(),
        // An export's end said, Edit's question asked and its value asked in a dialog, as the page's own steps are.
        say: (message, tone) => actionHost.say(message, tone),
        ask: (message) => actionHost.ask(message),
        editValues: (request) => dialogs.editValues(request),
        // A phone column's call and WhatsApp links, in the phone field's own words.
        widgetLabels,
      };
      // The list comes in its part, which the page waited for; "Loading…" in its place where it could not come.
      const list = listPart.loaded ? listPart.loaded.listView(context) : waitingList(listPart, context);
      cleanups.push(list.destroy);
      reloadList = list.reload;
      openInList = list.open;
      body = list.element;
    }
    else body = sectionsLayout(layout);

    const head = layout.type === 'sheet' ? null : pageHead();
    // A record of sections or tabs has the bar the app fills — its breadcrumbs and pager — over its title.
    const bar = layout.type === 'sections' || layout.type === 'tabs' ? topBar(undefined) : null;
    questions = body;
    const drawnParts = [...(bar ? [bar] : []), ...(head ? [head] : []), banner, ...(limitsKit?.before ?? []), ...safety.elements, draft, body, ...(limitsKit?.after ?? [])];
    // Before the printout's footer where it is in already (the page drawn once its parts came): the footer stays last.
    const end = content.querySelector(':scope > .fd-print-end');
    if (end) end.before(...drawnParts);
    else content.append(...drawnParts);
    pageDrawn = true;
  }
  /** How a list's other view makes a record: the app's way, else the model's page in a dialog, else none. */
  function newListRecord(): { onNewRecord?: (values: Values) => unknown } {
    if (options.onNewRecord) return { onNewRecord: options.onNewRecord };
    const model = page.data.kind === 'record' ? page.data.model : '';
    if (!model || (!options.pages && !options.relatedPages) || !dialogs.canOpen(model)) return {};
    return { onNewRecord: (values) => dialogs.openRecord(model, { values, title: sentence(labels.newRecordNoun, labels.newRecord) }) };
  }
  let pageDrawn = false;
  /**
   * The one-tag script's checks of what a part draws (a list page's settings, a map's) came with it: run now, before the
   * page is drawn — and those they owe in turn asked for, each once. Where they find a mistake, nothing is drawn, and what
   * is drawn settles with it, as the mount would have thrown it.
   */
  async function checkedWhole(): Promise<void> {
    const asked = new Set<Part>(awaited);
    for (let now = checkPage(options.page, checks); ; now = checkPage(options.page, checks)) {
      if (!now.ok) {
        root.remove();
        throw unshown(now);
      }
      const owed = owedParts(now.later).filter((part) => !asked.has(part));
      if (!owed.length || gone) return;
      for (const part of owed) asked.add(part);
      await settleParts(owed);
    }
  }
  /** What needs the page drawn — a list's rows to open or ask for again — at once when it is, else once it is. */
  const afterDrawing = <T>(then: () => Promise<T>): Promise<T> => (pageDrawn ? then() : drawn.then(then));
  // A draft opened by its key (`resume`) may name none: the limits part says so.
  // The parts its check owes (the one-tag script's), with the page's own: the check runs again once they came.
  // The app's own functions are called through the functions part: a page whose formulas call one waits for it.
  const appCalls = options.functions && callsPartFunctions(page, Object.keys(options.functions)) ? [functionsPart] : [];
  const awaited = [...new Set([...partsFor(page, options.widgets, options.slots), ...(options.resume && !page.limits && !page.continueLater ? [limitsPart] : []), ...appCalls, ...owedParts(checked.later)])].filter((part) => !part.loaded);
  let drawn: Promise<void> = Promise.resolve();
  if (!awaited.length) drawPage();
  else {
    root.setAttribute('aria-busy', 'true');
    const drawWaited = () => {
      if (gone) return;
      drawPage();
      // Drawn after the status took its place in a corner or across the top: the page's Save took it back beside itself.
      placeStatus();
      root.removeAttribute('aria-busy');
      render(form.getState());
      // A record that opened meanwhile: its focused field takes the focus now, as it would have then.
      if (opened) focusAsOpened(true);
    };
    drawn = settleParts(awaited).then(() => (checked.later?.length ? checkedWhole().then(drawWaited) : drawWaited()));
  }
  // A theme or the quiet skin the app gives, not the page, is worn as its part comes, the page drawn meanwhile
  // (look-parts.ts in @fieldia/widgets): what the handle says is drawn settles once they have come too.
  const worn = [...(theme ? [themesPart] : []), ...(root.getAttribute('data-fd-skin') === 'quiet' ? [quietPart] : [])].filter((part) => !part.loaded && !awaited.includes(part));
  const dressed = worn.length ? Promise.all([drawn, settleParts(worn)]).then(() => undefined) : drawn;
  // On paper, the app's logo and words, the record's title and the day over the page, its footer under it — its look
  // the print part's, as a person shows they mean to print (print.ts).
  const paper = paperFor({
    doc,
    el,
    root,
    page,
    labels,
    locale,
    fill,
    now: options.now ?? (() => new Date()),
    name: ownName,
    values: () => form.getState().values,
    drawAll: () => {
      // Each tabs' own drawing may draw tabs inside its own, which join the list as they come.
      for (const draw of printers) draw();
    },
  });
  cleanups.push(() => paper.destroy());
  // Its footer the content's last part: on paper the footer of the table the content is, under every sheet.
  if (paper.foot) content.append(paper.foot);
  root.append(paper.head, content, done, announcer);
  // A public page's bot check (`botCheck`): a box no person sees, reaches with Tab or hears read out — inert, so no
  // browser fills it in either — which a bot filling every box fills. Told to the form as it is filled, and read again
  // as the answers go; the send carries it, and the app decides.
  if (page.data.kind === 'responses' && page.botCheck && page.botCheck.honeypot !== false) {
    const trap = el('input', { type: 'text', id: uid('website'), name: 'website', tabindex: '-1', autocomplete: 'off' }) as HTMLInputElement;
    const box = el('div', { class: 'fd-trap', 'aria-hidden': 'true', inert: '' }, el('label', { for: trap.id }, labels.leaveEmpty), trap);
    const seen = () => void (trap.value !== '' && form.botCheck({ honeypot: true }));
    trap.addEventListener('input', seen);
    cleanups.push(form.settling(seen));
    content.append(box);
  }
  // The status leaves its place beside Save when the page wants it in a corner or across the top: now, and again once a
  // page that waited for its parts is drawn, its Save having put the status beside itself.
  function placeStatus() {
    if (options.saveStatus === 'toast') {
      status.classList.add('fd-toast');
      root.append(status);
    } else if (options.saveStatus === 'bar') {
      status.classList.add('fd-status-bar');
      content.prepend(status);
    }
  }
  placeStatus();

  // A value too long for its box ends in an ellipsis; the pointer over it shows all of it.
  // Set as the pointer comes, when the box's width is known, and never over a title of the box's own.
  root.addEventListener('mouseover', (event) => {
    const box = event.target as HTMLInputElement;
    if (box.tagName !== 'INPUT' || !box.classList.contains('fd-input')) return;
    if (box.title && !box.hasAttribute('data-cut-title')) return;
    const cut = box.scrollWidth > box.clientWidth && box.value !== '';
    setAttr(box, 'title', cut ? box.value : null);
    setAttr(box, 'data-cut-title', cut ? '' : null);
  });

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (layout.type === 'list') return;
    if (wizardForward) void wizardForward();
    else void submitOrSave();
  });

  // ---- keys -------------------------------------------------------------------

  /**
   * Text typed and not yet taken — a tag without its Enter, a number, a date or hours a box reads as it is left — is
   * taken now, as a change says to the box it is typed in. Every save, check and step forward of the form asks for it
   * first (`form.settling`), whatever made it: Ctrl+Enter, a button's key, the app's own save. A box whose reading
   * waits (a name looked up) gives the form its own reader too, which a save waits for.
   */
  function commitTyping() {
    const active = doc.activeElement;
    if (!active || !root.contains(active)) return;
    if (typedBox(active)) active.dispatchEvent(new Event('change', { bubbles: true }));
  }
  /**
   * The box typed in since it last read what it holds (a change: Enter, or the box left): autosave, which nobody
   * pressed, waits while the focus is still in it, and never reads "12." of "12.5" or "Office " of "Office Park" under
   * the person's keys.
   */
  let typedIn: Element | null = null;
  const onTyped = (event: Event) => {
    if (event.target instanceof Element && typedBox(event.target)) typedIn = event.target;
  };
  const onRead = (event: Event) => {
    if (event.target === typedIn) typedIn = null;
  };
  root.addEventListener('input', onTyped, true);
  root.addEventListener('change', onRead, true);
  root.addEventListener('focusout', onRead, true);
  cleanups.push(() => {
    root.removeEventListener('input', onTyped, true);
    root.removeEventListener('change', onRead, true);
    root.removeEventListener('focusout', onRead, true);
  });
  cleanups.push(form.settling(commitTyping, () => !!typedIn && typedIn === doc.activeElement && root.contains(typedIn)));

  /** The fields Enter can move between: on this page, shown, with a box to type or choose in, outside tables of lines. */
  function nextField(from: HTMLElement): HTMLElement | null {
    const fields = [...root.querySelectorAll<HTMLElement>('.fd-field')].filter(
      (field) => !field.closest('[hidden], [data-type="one2many"] .fd-field, .fd-form-dialog') && !field.parentElement?.closest('[data-type="one2many"]')
    );
    const here = from.closest('.fd-field');
    const after = fields.slice(fields.indexOf(here as HTMLElement) + 1);
    for (const field of after) {
      const control = field.querySelector<HTMLElement>('input:not([type="hidden"]):not([readonly]):not([disabled]), select:not([disabled]), textarea:not([readonly]), [contenteditable="true"]');
      if (control) return control;
    }
    return null;
  }

  root.addEventListener('keydown', (event) => {
    // A list has nothing to save, and its rows keep their own keys.
    if (event.isComposing || event.key !== 'Enter' || layout.type === 'list') return;
    // An app's own content in a slot, such as a chatter's composer, keeps its keys.
    if ((event.target as Element).closest('.fd-slot')) return;
    const keys = options.keys ?? {};
    if (event.ctrlKey || event.metaKey) {
      // Saves even after a field used the Enter (a tag box adding its tag); the grid keeps its own keys.
      if (keys.saveWithCtrlEnter === false || options.showActions === false) return;
      if ((event.target as Element).closest('.ag-root-wrapper')) return;
      // What is still typed is read first by the save itself (commitTyping, through form.settling).
      event.preventDefault();
      if (wizardForward) void wizardForward();
      else void submitOrSave();
      return;
    }
    const from = event.target as HTMLElement;
    // A one-line code editor is a text box to the form: it says it is one line, and keeps Enter only from adding one.
    const oneLine = from.getAttribute('aria-multiline') === 'false';
    // A line that wraps (a record's title) sends the form with Enter, as an input does by itself.
    if (oneLine && from.tagName === 'TEXTAREA' && !keys.enterMovesToNext && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      root.requestSubmit();
      return;
    }
    // A plain Enter a field used itself, such as picking from an open list, is the field's.
    if ((event.defaultPrevented && !oneLine) || !keys.enterMovesToNext || event.shiftKey || event.altKey) return;
    if (from.tagName !== 'INPUT' && from.tagName !== 'SELECT' && !oneLine) return;
    if (from.closest('[data-type="one2many"]')) return;
    if (['button', 'submit', 'reset', 'file'].includes((from as HTMLInputElement).type)) return;
    event.preventDefault();
    nextField(from)?.focus();
  });

  // ---- Undo and Redo while filling ----------------------------------------------

  // Ctrl+Z (⌘Z) takes back the person's last change to the record — a field, a cell, a line added, taken away or moved
  // (`form.undo()`) — and Ctrl+Shift+Z or Ctrl+Y (⌘⇧Z) makes it again. In a box whose text was changed since it was
  // entered, the browser's own undo goes through it first; once the box shows what it showed as it was entered, the
  // record's. The field taken back takes the focus, and what was done is said politely.

  /** What a box showed as it was entered, and the browser's own undos in it since its last typing: what its redo has. */
  const boxEdits = new WeakMap<EventTarget, { text: string; undone: number }>();
  const editable = (target: EventTarget | null): target is HTMLElement => target instanceof HTMLElement && (typedBox(target) || target.isContentEditable);
  const textOf = (box: HTMLElement) => (box.isContentEditable ? box.innerHTML : (box as HTMLInputElement).value);
  const onEntered = (event: Event) => {
    const box = event.target;
    // Once its own focus has written it (a value shown at rest, written for typing as it is entered).
    if (editable(box)) queueMicrotask(() => boxEdits.set(box, { text: textOf(box), undone: 0 }));
  };
  const onEdited = (event: Event) => {
    const edits = boxEdits.get(event.target as EventTarget);
    const how = (event as InputEvent).inputType ?? '';
    if (edits) edits.undone = how === 'historyUndo' ? edits.undone + 1 : how === 'historyRedo' ? Math.max(0, edits.undone - 1) : 0;
  };
  let heard: HTMLElement | null = null;
  const onUndoKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey) || options.keys?.undo === false || layout.type === 'list') return;
    const key = event.key.toLowerCase();
    const redo = key === 'y' ? !event.shiftKey && !event.metaKey : key === 'z' && event.shiftKey;
    if (!redo && (key !== 'z' || event.shiftKey)) return;
    const target = event.target as Element;
    // An app's own content in a slot keeps its keys, and so do its own boxes outside the form and a form inside this one
    // (a dialog's); pressed on nothing, the keys are the first form's on the page, as a button's key is.
    if ((editable(target) && !root.contains(target)) || target.closest('.fd-slot') || !hotkeysHere(target)) return;
    // A box whose text is not what it showed as it was entered: the browser's own undo has typing to take back there;
    // its own redo, its undos since.
    const edits = editable(target) ? boxEdits.get(target) : undefined;
    if (edits && (redo ? edits.undone > 0 : textOf(target as HTMLElement) !== edits.text)) return;
    const step = redo ? form.redo() : form.undo();
    if (!step) return;
    event.preventDefault();
    const name = page.fields[step.field]?.label ?? step.field;
    if (!heard) root.append((heard = el('div', { class: 'fd-sr-only fd-undo-heard', role: 'status', 'aria-live': 'polite' })));
    const words = fill(redo ? labels.redone : labels.undone, { field: name });
    heard.textContent = '';
    setTimeout(() => heard && (heard.textContent = words), 0);
    // The field taken back takes the focus, where it is shown and is not the one the person is in.
    const box = [...root.querySelectorAll<HTMLElement>(`.fd-field[data-field="${step.field}"]`)]
      .filter((wrapper) => !wrapper.closest('[hidden]') && wrapper.closest('.fd-form') === root)
      .flatMap((wrapper) => [...wrapper.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea, [contenteditable="true"]')])
      .find((one) => !one.closest('[hidden]'));
    if (box && !box.contains(doc.activeElement)) box.focus();
    // What the record's undo wrote in the box the person is in is what it shows as entered: the next Ctrl+Z is the record's too.
    queueMicrotask(() => {
      const active = doc.activeElement;
      if (editable(active)) boxEdits.set(active, { text: textOf(active), undone: 0 });
    });
  };
  root.addEventListener('focusin', onEntered, true);
  root.addEventListener('input', onEdited, true);
  doc.addEventListener('keydown', onUndoKey);
  cleanups.push(() => {
    root.removeEventListener('focusin', onEntered, true);
    root.removeEventListener('input', onEdited, true);
    doc.removeEventListener('keydown', onUndoKey);
  });

  // ---- a button's key, with Alt -------------------------------------------------

  /**
   * Whether a key pressed with Alt is this form's: pressed in it (not in a
   * form inside it, such as a dialog's), or — pressed outside any form — this
   * is the first form on the page, or in the question or dialog on top of it.
   */
  function hotkeysHere(target: EventTarget | null): boolean {
    const inner = target instanceof Element ? target.closest('.fd-form') : null;
    if (inner) return inner === root && !root.querySelector(':scope > .fd-dialog-backdrop');
    const modals = [...doc.querySelectorAll('[aria-modal="true"]')].filter((modal) => !modal.closest('[hidden]'));
    const top = modals[modals.length - 1];
    return (top ?? doc).querySelector('.fd-form') === root;
  }
  const onHotkey = (event: KeyboardEvent) => {
    if (event.key === 'Alt') {
      if (hotkeysHere(event.target)) root.setAttribute('data-hotkeys', '');
      return;
    }
    const key = hotkeyOf(event);
    if (!key || !hotkeysHere(event.target)) return;
    const button = [...root.querySelectorAll<HTMLButtonElement>(`button[data-hotkey="${key}"]`)].find(
      (b) => b.closest('.fd-form') === root && !b.closest('[hidden]') && !b.disabled && !b.hasAttribute('aria-busy')
    );
    // A field's access key: the first shown with it takes the focus.
    const field = button ? undefined : fieldKeys.find((one) => one.key === key && one.wrapper.isConnected && !one.wrapper.closest('[hidden]'));
    if (field) {
      event.preventDefault();
      root.removeAttribute('data-hotkeys');
      field.focus();
      return;
    }
    if (!button) return;
    event.preventDefault();
    root.removeAttribute('data-hotkeys');
    button.click();
  };
  const offHotkeys = () => root.removeAttribute('data-hotkeys');
  const altUp = (event: KeyboardEvent) => event.key === 'Alt' && offHotkeys();
  doc.addEventListener('keydown', onHotkey);
  doc.addEventListener('keyup', altUp);
  doc.defaultView?.addEventListener('blur', offHotkeys);
  cleanups.push(() => {
    doc.removeEventListener('keydown', onHotkey);
    doc.removeEventListener('keyup', altUp);
    doc.defaultView?.removeEventListener('blur', offHotkeys);
  });

  // ---- the browser's own ways out ------------------------------------------------
  // `warnOnLeave`: Back, Reload or a closed tab ask the browser's own question while the person's work is at risk —
  // every change not saved, as nothing saves it on the way out. Listened for only then: a page with nothing to lose
  // keeps the browser's quick Back.
  const browserWindow = options.warnOnLeave ? doc.defaultView : null;
  if (browserWindow) {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // What older browsers ask for besides: any words (they show their own).
      event.returnValue = '';
    };
    let warning = false;
    const follow = (state: FormState) => {
      const now = workAtRisk(state, { changes: true });
      if (now === warning) return;
      warning = now;
      if (now) browserWindow.addEventListener('beforeunload', warn);
      else browserWindow.removeEventListener('beforeunload', warn);
    };
    follow(form.getState());
    const stopFollowing = form.subscribe(follow);
    cleanups.push(() => {
      stopFollowing();
      browserWindow.removeEventListener('beforeunload', warn);
    });
  }

  // ---- confirmation dialog -----------------------------------------------------

  /**
   * A question with Cancel and OK, or with `withCancel` false a notice with OK
   * alone. A question opens with the focus on Cancel — a button's `confirm`,
   * an `ask` step, Archive, Delete and "Discard your changes?" alike — so an
   * Enter meant for the form, or a second press of the key that asked, never
   * answers Yes by itself; a notice, on OK. `how.yes` words OK as what it does
   * (Discard); `how.ended` is told the moment it is answered, before the
   * promise settles.
   */
  function dialogConfirm(message: string, withCancel = true, how: { yes?: string; ended?: () => void } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      const text = el('p', { id: `${prefix}-confirm` }, message);
      const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
      const ok = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, how.yes ?? labels.ok);
      const dialog = el('div', { class: 'fd-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': text.id }, text, el('div', { class: 'fd-actions fd-actions-end' }, ...(withCancel ? [cancel, ok] : [ok])));
      const backdrop = el('div', { class: 'fd-dialog-backdrop' }, dialog);
      const doc = root.ownerDocument;
      const opener = doc.activeElement as HTMLElement | null;
      const close = (answer: boolean) => {
        backdrop.remove();
        // Back to what had focus when it asked; or, when that let go of it — Save hides while it saves — to Save, shown again.
        const shown = (e: HTMLElement | null) => !!e && e !== doc.body && e.isConnected && !e.closest('[hidden]');
        const back = shown(opener) ? opener : root.querySelector<HTMLElement>('button[type="submit"]:not([hidden])');
        back?.focus();
        how.ended?.();
        resolve(answer);
      };
      cancel.addEventListener('click', () => close(false));
      ok.addEventListener('click', () => close(true));
      // Its keys are its own: Escape answers No here, and closes no dialog or panel under it.
      backdrop.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
        } else keepTabIn(dialog, event);
      });
      // Asked where it is seen: over a page opened in this one's place (its breadcrumb leaving this record), in that one.
      const over = root.hidden ? [...(root.parentElement?.children ?? [])].reverse().find((child): child is HTMLElement => child !== root && child.matches('form.fd-form') && !(child as HTMLElement).hidden) : undefined;
      (over ?? root).append(backdrop);
      (withCancel ? cancel : ok).focus();
    });
  }

  // ---- go -------------------------------------------------------------------

  /** The page's own updaters that threw, each said once: a part's are kept to it (keptTo), these to themselves. */
  const failedUpdaters = new WeakSet<Updater>();
  function render(state: FormState) {
    for (const update of updaters) {
      try {
        update(state);
      } catch (error) {
        if (failedUpdaters.has(update)) continue;
        failedUpdaters.add(update);
        report(error, { stage: 'update', part: 'page' });
      }
    }
  }

  host.append(root);
  // A press lands on what the person aimed at: never on a button that slid under a pointer that did not move.
  cleanups.push(steadyPresses(root));
  // And a box left for a press shows its problem once the press has ended (press.ts): watched from the first press.
  watchPresses(doc);
  const unsubscribe = form.subscribe(render);
  // A run that could not go on says why: a step that cannot run here, or what the app threw. A stop with words the form says itself.
  cleanups.push(
    form.on('run', ({ result }) => {
      if (result.reason === 'cannot' || (result.reason === 'app' && result.error !== undefined)) actionHost.say(result.message ?? '', result.reason === 'app' ? 'danger' : 'warning');
    })
  );
  render(form.getState());
  /** The form in another skin: each field's face put on again, and drawn again from the state. */
  function refaced() {
    for (const face of faces) face();
    if (mounted) renderNow();
  }

  mounted = true;
  // As the record opens, its focused field takes the focus — the first shown — unless the person is busy elsewhere:
  // only while nothing has the focus, or, the first time, while it is in this form (a dialog's first box).
  function focusAsOpened(first: boolean) {
    if (!focusers.length) return;
    queueMicrotask(() => {
      if (gone || !root.isConnected || root.closest('[hidden]') || (typeof root.checkVisibility === 'function' && !root.checkVisibility())) return;
      const active = doc.activeElement;
      const free = !active || active === doc.body || active === doc.documentElement;
      if (!free && !(first && root.contains(active))) return;
      focusers.find((one) => !one.wrapper.closest('[hidden]'))?.focus();
    });
  }
  cleanups.push(
    form.on('open', () => {
      const first = !opened;
      opened = true;
      focusAsOpened(first);
    })
  );
  if (form.getState().status === 'idle') void form.load();

  return {
    form,
    element: root,
    setSkin(skin) {
      root.setAttribute('data-fd-skin', skin);
      refaced();
    },
    setTheme(next) {
      // Worn at once when the themes part has come; else none meanwhile, and on as it comes (look-parts.ts).
      wearTheme(root, next);
      root.setAttribute('data-fd-skin', skinFor(options.skin ?? page.look?.skin, next ?? undefined));
      refaced();
    },
    setTokens(next) {
      options.tokens = next ?? undefined;
      wearTokens(root, next);
    },
    async save() {
      const saved = await form.save();
      if (!saved) focusFirstProblem();
      return saved;
    },
    check() {
      const valid = form.validate();
      if (!valid) focusFirstProblem();
      return valid;
    },
    setReadonly(readonly) {
      locked = readonly;
      root.toggleAttribute('data-readonly', locked);
      form.setEditing(!locked);
      render(form.getState());
    },
    isReadonly: () => locked,
    reload: () =>
      afterDrawing(async () => {
        if (reloadList) return reloadList();
        await form.run([{ do: 'reload' }]);
      }),
    openRecord: (id, options) =>
      afterDrawing(async () => {
        await openInList?.(id, options);
      }),
    on: (event, listener) => {
      const off = form.on(event, listener);
      cleanups.push(off);
      return off;
    },
    setValues: (values) => form.setValues(values),
    run: (steps, context) => form.run(steps, context),
    print: () => afterDrawing(() => paper.print()),
    drawn: dressed,
    destroy() {
      gone = true;
      unsubscribe();
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (error) {
          report(error, { stage: 'remove', part: 'page' });
        }
      }
      root.remove();
      if (ownsForm) form.dispose();
    },
  };
}

/** What a field is worked with: where its access key is said. */
const CONTROL = 'input:not([type="hidden"]), select, textarea, button, [contenteditable="true"], [tabindex="0"]';

/** The boxes a label can be shown in, as the words of an empty box. */
const TEXT_BOX = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea';

/** Nothing in it: no value, empty words, nothing picked. */
const isBlank = (value: unknown) => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);

/**
 * What an empty field in the quiet look says, by its label, in the viewer's
 * words for `locale`: "Add story points", or for a question "Your answer".
 */
export function quietHint(label: string, locale: Locale, labels: Pick<ViewerLabels, 'quietHint' | 'quietAnswer'> = VIEWER_LABELS[locale]): string {
  // Small inside its sentence, as it has always been — "Add story points" — by the one rule every sentence asks (labelAt).
  return /[?؟]\s*$/.test(label) ? labels.quietAnswer : labels.quietHint.replace('{label}', labelAt(labels.quietHint, 'label', true, locale)(label));
}

/** Fields whose ✓ would say nothing: a yes/no box is never wrong, a table or a file has its own look. */
const NO_VALID_MARK = new Set(['boolean', 'one2many', 'binary', 'image', 'html', 'json', 'properties']);

/**
 * A label's words with a lone mark at their end ("Completion %", "Come
 * again ?") held to the word before it, so the mark never wraps onto a line
 * of its own.
 */
function keepMarkWithWord(text: string): string {
  return text.replace(/\s+([^\p{L}\p{N}\s]{1,3})$/u, '\u00a0$1');
}

/**
 * A one-line row's parts in runs that wrap as one: words before a field
 * ("Expected:", "to") go with it, and words after it that no field follows
 * ("attempts") too, as Flectra keeps them in one span; any other part runs
 * alone.
 */
export function onelineRuns(children: readonly LayoutNode[]): LayoutNode[][] {
  const runs: LayoutNode[][] = [];
  let i = 0;
  while (i < children.length) {
    const run = [children[i]];
    let field = children[i].type === 'field';
    if (!field && children[i].type === 'text' && children[i + 1]?.type === 'field') {
      run.push(children[++i]);
      field = true;
    }
    i++;
    if (field) while (children[i]?.type === 'text' && children[i + 1]?.type !== 'field') run.push(children[i++]);
    runs.push(run);
  }
  return runs;
}

/** Why a page cannot be shown, as the viewer throws it: each problem its check found, by its path. */
function unshown(checked: { issues: readonly { path: string; message: string }[] }): Error {
  return new Error(`This page cannot be shown:\n${checked.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`);
}
