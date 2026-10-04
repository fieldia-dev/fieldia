import {
  createForm,
  checkPage,
  isRightToLeft,
  localizePage,
  translatePage,
  wideColumns,
  type ButtonNode,
  type FieldNode,
  type Form,
  type FormOptions,
  type FormState,
  type JsonValue,
  type LayoutNode,
  type Page,
  type RecordId,
  type SectionNode,
  type SheetNode,
  type SlotNode,
  type TabsNode,
  type TextNode,
  type DividerNode,
  type SpacerNode,
  type ImageNode,
  type WizardNode,
  type LabelPlace,
  type Locale,
  MESSAGES,
} from '@fieldia/core';
import { browserPreferences, createWidget, drawIcon, installStyles, WIDGET_LABELS, type IconSet, type PreferenceStore, type WidgetFactory } from '@fieldia/widgets';
import { pageDialogs } from './related';
import { listView } from './list';
import { applyLook } from './look';
import { labelPlace, planSection, type Place } from './place';

export type Skin = 'underline' | 'outlined';

import { ownLocale, VIEWER_LABELS, type ViewerLabels } from './labels';
export { VIEWER_LABELS, DEFAULT_LABELS, type ViewerLabels } from './labels';

/** Fill a slot with the app's own content. Return a function to clean up. */
export type SlotRenderer = (element: HTMLElement, context: { form: Form; name: string }) => void | (() => void);

export interface ViewerOptions extends Omit<FormOptions, 'page'> {
  page: Page;
  /** A form made elsewhere, to share one record between two views. */
  form?: Form;
  skin?: Skin;
  /** Widgets that replace or add to the built-in ones, by `type` or `type.widget`. */
  widgets?: Record<string, WidgetFactory>;
  slots?: Record<string, SlotRenderer>;
  /**
   * The page's language, as a language tag (`ar`, `es`, `pt-BR`): the page's
   * own words in it when the page keeps them, and the viewer's labels,
   * validation messages and widget words in it when Fieldia has them (English,
   * Arabic, German, French; English otherwise). A language written right to
   * left runs right to left. The language the page is written in unless said.
   */
  locale?: Locale | (string & {});
  /** Labels that win over the language's defaults. */
  labels?: Partial<ViewerLabels>;
  dir?: 'ltr' | 'rtl';
  /** How to ask before a button with `confirm` runs. Defaults to a small dialog. */
  confirm?: (message: string) => Promise<boolean>;
  /** Where a person's choices about the page's look are kept, such as a table's columns. The browser's storage by default. */
  preferences?: PreferenceStore;
  /** False when something around the page saves it, such as a dialog: the page's own Save, Discard and Submit stay hidden. */
  showActions?: boolean;
  /**
   * Pages for the models links point to, so a link can show its record in a
   * dialog: Create and edit…, and the button that opens the linked record.
   */
  relatedPages?: Record<string, Page> | ((model: string) => Page | null | undefined);
  /**
   * The app's own icons, or replacements for Fieldia's, by the name a page
   * gives them: the inside of a 24×24 SVG, drawn with lines in the text colour.
   */
  icons?: IconSet;
  /**
   * Keys around the fields. Ctrl+Enter (Cmd+Enter on a Mac) saves, from
   * wherever the cursor is, unless `saveWithCtrlEnter` is false. With
   * `enterMovesToNext`, Enter moves to the next field instead of sending the form.
   */
  keys?: { saveWithCtrlEnter?: boolean; enterMovesToNext?: boolean };
  /** A ✓ by a field's label once someone has filled it in and it would pass its checks. */
  showValid?: boolean;
  /** Where a save's progress shows: beside Save (the default), as a toast in a corner, or as a bar across the top. */
  saveStatus?: 'inline' | 'toast' | 'bar';
  /** Show the whole form read-only: every field locked, no Save. Buttons still run. */
  readonly?: boolean;
  /** An Edit button that unlocks a read-only form, and a Done that saves and locks it again. */
  editSwitch?: boolean;
  /**
   * The app's own translator, for apps that keep translations by text or by
   * key: every word of the page goes through it. Record data never does.
   */
  translate?: (text: string) => string;
  /** A list page: a row was opened, by a click or by Enter. The app shows the record. */
  onOpenRecord?: (id: RecordId) => void;
}

export interface ViewerHandle {
  readonly form: Form;
  readonly element: HTMLElement;
  setSkin(skin: Skin): void;
  /** Save the record, or take the focus to the first problem when the form refuses. */
  save(): Promise<boolean>;
  /** Check the form without saving, taking the focus to the first problem. */
  check(): boolean;
  /** Lock or unlock the whole form. */
  setReadonly(readonly: boolean): void;
  isReadonly(): boolean;
  destroy(): void;
}

type Updater = (state: FormState) => void;

let mounts = 0;

/**
 * Render a page into `host` and keep it in step with its form. Plain DOM: the
 * React, Angular and Vue bindings are thin shells around this function.
 * Throws when the page does not validate, listing every problem.
 */
export function mountViewer(host: HTMLElement, options: ViewerOptions): ViewerHandle {
  const doc = host.ownerDocument;
  // The quick check of names and conditions: the full one, with its validation library, belongs where pages are made.
  const checked = checkPage(options.page);
  if (!checked.ok) {
    throw new Error(`This page cannot be shown:\n${checked.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`);
  }
  // The page's own words in its language first; the app's translator over what is left.
  const tag = options.locale ?? checked.page.language;
  const localized = tag ? localizePage(checked.page, tag) : checked.page;
  const page = options.translate ? translatePage(localized, options.translate) : localized;
  const locale = ownLocale(tag);
  const preferences = options.preferences ?? browserPreferences();
  const dialogs = pageDialogs(options);
  const ownsForm = !options.form;
  const form = options.form ?? createForm({ ...options, page, messages: options.messages ?? MESSAGES[locale] });
  const labels: ViewerLabels = { ...VIEWER_LABELS[locale], ...options.labels };
  const widgetLabels = WIDGET_LABELS[locale];
  const dir = options.dir ?? (tag && isRightToLeft(tag) ? 'rtl' : undefined);
  const prefix = `fd${++mounts}`;
  const updaters: Updater[] = [];
  const cleanups: (() => void)[] = [];
  const uid = (id: string) => `${prefix}-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

  installStyles(doc);

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }

  /** Words with the icon a page names before them, when there is such an icon. */
  function withIcon(name: string | undefined, text: string): (Node | string)[] {
    const icon = drawIcon(doc, name, options.icons);
    return icon ? [icon, text] : [text];
  }

  const root = el('form', { class: 'fd-form', novalidate: '', 'data-fd-skin': options.skin ?? 'underline', dir, lang: tag, 'data-max-width': page.maxWidth });
  applyLook(root, page.look);
  const confirm = options.confirm ?? dialogConfirm;

  // ---- the parts -------------------------------------------------------

  /** A field with its label, help and messages. `labels` is where labels sit where it is put; the title's own fields take none. */
  function fieldItem(node: FieldNode, labels?: LabelPlace): HTMLElement {
    const def = page.fields[node.field];
    const id = uid(node.id);
    const labelsAt = labelPlace(node, def.type, labels);
    const wrapper = el('div', { class: 'fd-field', 'data-node': node.id, 'data-field': node.field, 'data-type': def.type, 'data-labels': labelsAt });
    if (node.colspan) wrapper.style.setProperty('--fd-span', String(node.colspan));
    const labelText = node.label ?? def.label;
    const label = el('label', { class: 'fd-label', id: `${id}-label`, for: id }, labelText);
    // The ✓ of a field filled in right; never on a yes/no box, a table or a file, where it would say nothing.
    const mark = options.showValid && !NO_VALID_MARK.has(def.type) ? drawIcon(doc, 'check') : null;
    if (mark) {
      mark.classList.add('fd-valid-mark');
      label.append(mark);
    }
    const widget = createWidget({ form, name: node.field, field: def, node, id, document: doc, labels: widgetLabels, preferences, locale, dialogs }, options.widgets);
    // A label kept out of sight still names the box; the empty box shows it instead, unless the page gives it words of its own.
    if (labelsAt === 'hidden' && !node.placeholder) {
      const box = widget.element.matches(TEXT_BOX) ? widget.element : widget.element.querySelector(TEXT_BOX);
      box?.setAttribute('placeholder', labelText);
    }
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(widget.element.tagName)) {
      // `for` stays: a custom field that puts the id on its own input is
      // labelled natively. Only a wrapper with a role (a radio group, say) may
      // carry a name; ARIA forbids naming a plain div or span.
      if (widget.element.getAttribute('role')) widget.element.setAttribute('aria-labelledby', label.id);
      label.addEventListener('click', () => widget.focus());
    }
    const helpText = node.help ?? def.help;
    const help = helpText ? el('div', { class: 'fd-help', id: `${id}-help` }, helpText) : null;
    // Not an alert of its own: a refused save is announced once, naming every field to look at.
    const error = el('div', { class: 'fd-error', id: `${id}-error`, hidden: '' });
    // A warning from an answer rule, and one from the data source's onchange beside the field whose change brought it.
    const warning = el('div', { class: 'fd-warning', id: `${id}-warning`, role: 'status', hidden: '' });
    wrapper.append(label, widget.element, ...(help ? [help] : []), error, warning);
    if (widget.destroy) cleanups.push(() => widget.destroy?.());
    // An answer rule's warning waits until the person leaves the field: no advice
    // mid-word. One already shown stays while they put it right, and goes once they have.
    let typing = false;
    let advice = '';
    wrapper.addEventListener('focusin', () => (typing = true));
    wrapper.addEventListener('focusout', (event) => {
      if (wrapper.contains(event.relatedTarget as Node | null)) return;
      typing = false;
      // Not at once: focus also leaves when a redraw removes the focused part
      // (a deleted line's button), and that redraw must finish first.
      queueMicrotask(() => update(form.getState()));
    });

    const update = (state: FormState) => {
      const shown = form.node(node.id);
      wrapper.hidden = shown.invisible;
      wrapper.classList.toggle('fd-required', shown.required);
      const message = state.errors[node.field];
      error.hidden = !message;
      error.textContent = message ?? '';
      const now = state.warnings[node.field] ?? '';
      if (!typing || !now) advice = now;
      // An error shown says enough: the rule's warning gives way to it.
      const warned = [message ? '' : advice, state.warning && state.warningField === node.field ? state.warning : ''].filter(Boolean).join(' ');
      warning.hidden = !warned;
      warning.textContent = warned;
      if (mark) {
        const value = state.values[node.field];
        const filled = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && !value.length);
        const valid = !shown.readonly && !message && filled && state.dirty.includes(node.field) && form.problem(node.field) === null;
        wrapper.classList.toggle('fd-valid', valid);
        mark.toggleAttribute('hidden', !valid);
      }
      widget.update({
        value: state.values[node.field],
        values: state.values,
        readonly: shown.readonly || locked,
        required: shown.required,
        invalid: !!message,
        describedBy: [help?.id, message ? error.id : undefined, warned ? warning.id : undefined].filter(Boolean).join(' ') || undefined,
      });
    };
    updaters.push(update);
    return wrapper;
  }

  function hideWhen(element: HTMLElement, id: string) {
    updaters.push(() => {
      element.hidden = form.node(id).invisible;
    });
  }

  function buttonItem(node: ButtonNode): HTMLElement {
    const button = el('button', { type: 'button', class: `fd-button fd-button-${node.style ?? 'secondary'}`, 'data-node': node.id }, ...withIcon(node.icon, node.label));
    spans(button, node.colspan);
    button.addEventListener('click', async () => {
      if (node.confirm && !(await confirm(node.confirm))) return;
      await form.runAction(node.id);
    });
    hideWhen(button, node.id);
    return button;
  }

  function textItem(node: TextNode): HTMLElement {
    const style = node.style ?? 'paragraph';
    const element = el(style === 'heading' ? 'h3' : 'p', { class: `fd-text-${style}`, 'data-node': node.id }, node.text);
    spans(element, node.colspan);
    hideWhen(element, node.id);
    return element;
  }

  function slotItem(node: SlotNode): HTMLElement {
    const element = el('div', { class: 'fd-slot', 'data-slot': node.name, 'data-node': node.id });
    const cleanup = options.slots?.[node.name]?.(element, { form, name: node.name });
    if (cleanup) cleanups.push(cleanup);
    hideWhen(element, node.id);
    return element;
  }

  /** The columns a part spans in the grid it sits in; the stylesheet keeps it within the columns there at each width. */
  function spans(element: HTMLElement, colspan: number | undefined) {
    if (colspan) element.style.setProperty('--fd-span', String(colspan));
  }

  /**
   * A grid of parts. With `columns` null, it has none of its own: it lays its
   * parts on the columns of the grid round it (an arrangement on its tracks).
   */
  function grid(children: LayoutNode[], columns: SectionNode['columns'] | null, place: Place): HTMLElement {
    const box = el('div', { class: 'fd-grid' });
    if (columns !== null) {
      box.style.setProperty('--fd-columns', String(wideColumns(columns)));
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

  /** Where the parts of a page, a tab or a step sit: one column, the page's labels. */
  const top = (onPage: boolean): Place => ({ columns: 1, onPage, labels: page.look?.labels });

  /** Folded sections, and how to open each: a problem inside one has to be seen. */
  const folds = new Map<HTMLElement, () => void>();

  function sectionItem(node: SectionNode, place: Place): HTMLElement {
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
    if (node.labelWidth) section.style.setProperty('--fd-label-width', `${node.labelWidth}px`);
    const description = node.description ? el('p', { class: 'fd-section-description' }, node.description) : null;
    const content = grid(node.children, plan.at === 'tracks' ? null : node.columns, plan.inner);
    if (node.title && node.collapsible) {
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
    const parts = node.children.map((tab) => {
      const tabId = uid(`${tab.id}-tab`);
      const panelId = uid(`${tab.id}-panel`);
      const button = el('button', { type: 'button', class: 'fd-tab', role: 'tab', id: tabId, 'aria-controls': panelId, 'data-node': tab.id }, ...withIcon(tab.icon, tab.label));
      // A tab's parts sit where the tabs do: on the page, or in the box round them.
      const panel = el('div', { class: 'fd-tabpanel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId }, grid(tab.children, 1, { columns: 1, onPage: place.onPage, labels: place.labels }));
      button.addEventListener('click', () => {
        picked = active = tab.id;
        render(form.getState());
      });
      list.append(button);
      return { tab, button, panel };
    });
    list.addEventListener('keydown', (event) => {
      const shown = parts.filter((p) => !p.button.hidden);
      const at = shown.findIndex((p) => p.tab.id === active);
      const move = { ArrowRight: 1, ArrowLeft: -1, Home: -at, End: shown.length - 1 - at }[event.key];
      if (move === undefined || at === -1) return;
      event.preventDefault();
      const rtl = root.getAttribute('dir') === 'rtl' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft');
      const next = shown[(at + (rtl ? -move : move) + shown.length) % shown.length];
      picked = active = next.tab.id;
      render(form.getState());
      next.button.focus();
    });
    box.append(list, ...parts.map((p) => p.panel));
    updaters.push(() => {
      box.hidden = form.node(node.id).invisible;
      const shown = parts.filter((p) => !form.node(p.tab.id).invisible);
      const keep = picked !== null && shown.some((p) => p.tab.id === picked);
      if (keep) active = picked as string;
      else if (shown.length) active = shown[0].tab.id;
      for (const p of parts) {
        const selected = p.tab.id === active;
        p.button.hidden = !shown.includes(p);
        p.button.setAttribute('aria-selected', String(selected));
        p.button.tabIndex = selected ? 0 : -1;
        p.panel.hidden = !selected;
      }
    });
    return box;
  }

  function item(node: LayoutNode, place: Place): HTMLElement {
    switch (node.type) {
      case 'field':
        return fieldItem(node, place.labels);
      case 'button':
        return buttonItem(node);
      case 'text':
        return textItem(node);
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
    }
  }

  /** A line across the row, empty room, or a picture: shown and hidden by its rule like any part. */
  function blockItem(node: DividerNode | SpacerNode | ImageNode): HTMLElement {
    const element =
      node.type === 'divider' ? el('hr', { class: 'fd-divider', 'data-node': node.id })
      : node.type === 'spacer' ? el('div', { class: 'fd-block fd-spacer', 'aria-hidden': 'true', 'data-node': node.id })
      : el('img', { class: 'fd-block fd-image', src: node.src, alt: node.alt, loading: 'lazy', 'data-node': node.id });
    if (node.type !== 'divider' && node.colspan) element.style.setProperty('--fd-span', String(node.colspan));
    hideWhen(element, node.id);
    return element;
  }

  // ---- shared chrome ----------------------------------------------------------

  /** The whole form locked: every field read-only, no Save; buttons still run. */
  let locked = options.readonly === true;
  // Edit unlocks; Done saves what changed first, and locks only once that is saved.
  const editSwitch = options.editSwitch ? el('button', { type: 'button', class: 'fd-button fd-edit-switch' }) : null;
  editSwitch?.addEventListener('click', async () => {
    if (!locked) {
      if (form.getState().dirty.length) {
        const saved = await form.save();
        if (!saved) {
          if (!form.getState().saveProblem) announce(checkText(form.getState()));
          focusFirstProblem();
          return;
        }
      }
      locked = true;
    } else locked = false;
    root.toggleAttribute('data-readonly', locked);
    render(form.getState());
  });
  root.toggleAttribute('data-readonly', locked);
  updaters.push(() => {
    if (!editSwitch) return;
    editSwitch.textContent = locked ? labels.edit : labels.done;
    editSwitch.classList.toggle('fd-button-primary', locked);
  });

  // The status says its words alone, so a screen reader hears them; Retry sits beside it.
  const statusText = el('div', { class: 'fd-status', role: 'status', 'aria-live': 'polite' });
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link fd-retry', hidden: '' }, labels.retry);
  retry.addEventListener('click', () => void submitOrSave());
  const status = el('div', { class: 'fd-status-box' }, statusText, retry);
  const notDone = () => (page.data.kind === 'responses' ? labels.notSent : labels.notSaved);
  /** "Not saved. Check: Email, Phone": the fields with a problem, in the order they show. */
  function checkText(state: FormState): string {
    const names: string[] = [];
    for (const key of Object.keys(state.errors)) {
      const field = key.split('.')[0];
      const shown = root.querySelector(`.fd-field[data-field="${field}"]:not([hidden]) > .fd-label`);
      const name = shown?.firstChild?.textContent ?? page.fields[field]?.label ?? field;
      if (!names.includes(name)) names.push(name);
    }
    const inOrder = [...root.querySelectorAll('.fd-field[data-field] > .fd-label')].map((label) => label.firstChild?.textContent ?? '');
    names.sort((a, b) => (inOrder.indexOf(a) + 1 || Infinity) - (inOrder.indexOf(b) + 1 || Infinity));
    return names.length ? fill(labels.checkFields, { what: notDone(), fields: names.join(', ') }) : notDone();
  }
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  updaters.push((state) => {
    const problem = state.saveProblem;
    const text =
      state.status === 'saving' ? labels.saving
      : state.status === 'saved' ? labels.saved
      : state.status === 'loading' ? labels.loading
      : state.status === 'error' && problem ? (problem.kind === 'fields' ? checkText(state) : problem.kind === 'other' ? problem.message : notDone())
      : state.status === 'error' ? state.error ?? ''
      : '';
    statusText.textContent = text;
    retry.hidden = !(state.status === 'error' && problem?.kind === 'other');
    statusText.classList.toggle('fd-status-error', state.status === 'error');
    statusText.classList.toggle('fd-status-saved', state.status === 'saved');
    // A toast shows while there is something to say, and lets "Saved" go after a moment.
    if (options.saveStatus === 'toast') {
      clearTimeout(quietTimer);
      status.hidden = !text;
      if (state.status === 'saved') quietTimer = setTimeout(() => (status.hidden = true), 2500);
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

  const draft = el('div', { class: 'fd-draft', hidden: '' });
  const draftText = el('span');
  const restore = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.restore);
  const discardDraft = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.discardDraft);
  restore.addEventListener('click', () => form.restoreDraft());
  discardDraft.addEventListener('click', () => form.discardDraft());
  draft.append(draftText, restore, discardDraft);
  updaters.push((state) => {
    draft.hidden = !state.draft;
    if (state.draft) draftText.textContent = fill(labels.draftFound, { time: new Date(state.draft.savedAt).toLocaleString() });
  });

  function focusFirstProblem() {
    const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!invalid) return;
    for (let folded = invalid.closest<HTMLElement>('.fd-section-folded'); folded; folded = folded.parentElement?.closest<HTMLElement>('.fd-section-folded') ?? null) {
      folds.get(folded)?.();
    }
    // A widget that knows where its problem is (a cell of a grid) takes the focus there itself.
    if (!invalid.dispatchEvent(new CustomEvent('fd-focus-problem', { cancelable: true }))) return;
    const target = invalid.matches('input, select, textarea, button') ? invalid : invalid.querySelector<HTMLElement>('input, select, textarea, button');
    target?.focus();
  }

  const done = el('div', { class: 'fd-done', hidden: '' }, el('p', { class: 'fd-done-title' }, labels.submitted));
  const again = el('button', { type: 'button', class: 'fd-button' }, labels.submitAnother);
  done.append(again);
  const content = el('div', { class: 'fd-content' });

  async function submitOrSave() {
    const saved = await form.save();
    if (!saved) {
      // Stopped by the page's own checks: say which fields; a refused save says so above.
      if (!form.getState().saveProblem) announce(checkText(form.getState()));
      focusFirstProblem();
      return;
    }
    if (page.data.kind === 'responses') {
      content.hidden = true;
      done.hidden = false;
    }
  }
  again.addEventListener('click', () => {
    form.reset();
    content.hidden = false;
    done.hidden = true;
  });

  function pageHead(): HTMLElement | null {
    if (!page.title && !page.description) return null;
    const head = el('header', { class: 'fd-page-head' });
    if (page.title) head.append(el('h1', { class: 'fd-page-title' }, page.title));
    if (page.description) head.append(el('p', { class: 'fd-page-description' }, page.description));
    return head;
  }

  // ---- the four page layouts ---------------------------------------------------

  function sectionsLayout(node: { id: string; children: LayoutNode[] }): HTMLElement {
    const box = el('div', { class: 'fd-sections', 'data-node': node.id }, ...node.children.map((child) => item(child, top(true))));
    const action = el('button', { type: 'submit', class: 'fd-button fd-button-primary' }, page.data.kind === 'responses' ? labels.submit : labels.save);
    const actions = el('div', { class: 'fd-actions fd-actions-end' }, status, action);
    if (page.data.kind === 'record') {
      // A record offers Save and Discard once something changes, the same as on a sheet.
      const discard = el('button', { type: 'button', class: 'fd-button' }, labels.discard);
      discard.addEventListener('click', () => form.reset());
      actions.insertBefore(discard, action);
      updaters.push((state) => {
        const dirty = state.dirty.length > 0 && state.status !== 'saving' && !locked;
        action.hidden = !dirty;
        discard.hidden = !dirty;
      });
    } else updaters.push(() => (action.hidden = locked));
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
        const go = el('button', { type: 'button', class: 'fd-step-link' }, ...withIcon(step.icon, step.label));
        go.addEventListener('click', () => {
          if (form.goTo(step.id)) focusStep();
          else focusFirstProblem();
        });
        stepButtons.set(step.id, go);
        list.append(el('li', {}, go));
      }
      box.append(el('nav', { class: 'fd-steps', 'aria-label': labels.steps }, list));
    }
    const panels = node.children.map((step) => {
      const panel = el('section', { class: 'fd-step', 'data-node': step.id, 'aria-labelledby': uid(`${step.id}-title`) });
      panel.append(el('h2', { class: 'fd-step-title', id: uid(`${step.id}-title`) }, ...withIcon(step.icon, step.label)));
      if (step.description) panel.append(el('p', { class: 'fd-section-description' }, step.description));
      // The step is the box: a card in it draws none of its own.
      panel.append(grid(step.children, 1, top(false)));
      box.append(panel);
      return { step, panel };
    });
    const back = el('button', { type: 'button', class: 'fd-button' }, node.backLabel ?? labels.back);
    const skip = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.skip);
    const forward = el('button', { type: 'submit', class: 'fd-button fd-button-primary' });
    box.append(el('div', { class: 'fd-wizard-nav' }, back, el('span', { class: 'fd-spacer' }), status, skip, forward));
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
      if (form.next()) focusStep();
      else focusFirstProblem();
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
      for (const { step, panel } of panels) panel.hidden = step.id !== state.step;
      const last = index === steps.length - 1;
      back.hidden = index === 0;
      skip.hidden = last || !node.children.find((step) => step.id === state.step)?.optional;
      forward.textContent = last ? node.finishLabel ?? labels.submit : node.nextLabel ?? labels.next;
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
    const pageBox = el('div', { class: 'fd-sheet-page', 'data-node': node.id });
    const actions = el('div', { class: 'fd-actions' });
    const save = el('button', { type: 'submit', class: 'fd-button fd-button-primary' }, labels.save);
    const discard = el('button', { type: 'button', class: 'fd-button' }, labels.discard);
    discard.addEventListener('click', () => form.reset());
    // Save and Discard lead the header bar, or close the sheet when the page puts them at its foot.
    const atFoot = page.actionsPosition === 'bottom';
    const foot = el('div', { class: 'fd-actions fd-actions-end fd-sheet-foot' });
    if (options.showActions === false) actions.append(...(node.buttons ?? []).map(buttonItem));
    else if (atFoot) {
      actions.append(...(node.buttons ?? []).map(buttonItem));
      foot.append(status, discard, save);
    } else actions.append(save, discard, ...(node.buttons ?? []).map(buttonItem), status);
    // The Edit switch leads the header bar, before Save and the record's own buttons.
    if (editSwitch && options.showActions !== false) actions.prepend(editSwitch);
    updaters.push((state) => {
      const dirty = state.dirty.length > 0 && state.status !== 'saving' && !locked;
      save.hidden = !dirty;
      discard.hidden = !dirty;
    });
    const header = el('div', { class: 'fd-header' }, actions);
    const underTitle = node.statusbar?.position === 'title';
    if (node.statusbar && !underTitle) header.append(statusbar(node.statusbar));

    const card = el('div', { class: 'fd-card' });
    if (node.ribbon) {
      const ribbon = el('div', { class: `fd-ribbon fd-tone-${node.ribbon.tone ?? 'muted'}`, 'data-node': node.ribbon.id }, node.ribbon.label);
      hideWhen(ribbon, node.ribbon.id);
      // The ribbon is clipped to the card's corner by its own frame, so the card itself never clips: lists open past it.
      card.append(el('div', { class: 'fd-ribbon-frame' }, ribbon));
    }
    if (node.statButtons?.length) {
      const stats = el('div', { class: 'fd-stats' });
      for (const stat of node.statButtons) {
        const value = el('span', { class: 'fd-stat-value' });
        const icon = drawIcon(doc, stat.icon, options.icons);
        const words = el('span', { class: 'fd-stat-words' }, value, el('span', { class: 'fd-stat-label' }, stat.label));
        const button = el('button', { type: 'button', class: 'fd-stat', 'data-node': stat.id }, ...(icon ? [icon, words] : [words]));
        button.addEventListener('click', () => void form.runAction(stat.id));
        updaters.push((state) => {
          button.hidden = form.node(stat.id).invisible;
          const count = stat.field ? state.values[stat.field] : null;
          value.textContent = count === null || count === undefined ? '' : String(count);
        });
        stats.append(button);
      }
      card.append(stats);
    }
    for (const alert of node.alerts ?? []) {
      const box = el('div', { class: `fd-alert fd-tone-${alert.tone ?? 'info'}`, role: 'status', 'data-node': alert.id }, el('span', { class: 'fd-alert-message' }, alert.message));
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
      card.append(box);
    }
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
      if (node.title.above?.length) title.append(el('div', { class: 'fd-title-above' }, ...node.title.above.map((part) => fieldItem(part))));
      title.append(fieldItem({ type: 'field', id: '#title', field: node.title.field, placeholder: node.title.placeholder }));
      if (node.title.subtitleField) title.append(fieldItem({ type: 'field', id: '#subtitle', field: node.title.subtitleField }));
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
    if (atFoot && options.showActions !== false) {
      card.append(foot);
      updaters.push((state) => {
        foot.hidden = state.dirty.length === 0 && !statusText.textContent;
      });
    }

    const layout = el('div', { class: 'fd-sheet-layout' }, card);
    if (node.sidePanel) {
      layout.classList.add('fd-has-side');
      layout.append(el('aside', { class: 'fd-side' }, slotItem(node.sidePanel)));
    }
    pageBox.append(header, layout);
    return pageBox;
  }

  /** The sheet header's statusbar: the same widget a form can place anywhere. */
  function statusbar(config: NonNullable<SheetNode['statusbar']>): HTMLElement {
    const def = page.fields[config.field];
    const barOptions: { [key: string]: JsonValue } = { clickable: config.clickable === true };
    if (config.visibleStates) barOptions['visibleStates'] = config.visibleStates;
    const node: FieldNode = { type: 'field', id: '#statusbar', field: config.field, widget: 'statusbar', options: barOptions };
    const widget = createWidget(
      { form, name: config.field, field: def, node, id: uid('statusbar'), document: doc, labels: widgetLabels, preferences, locale, dialogs },
      options.widgets
    );
    updaters.push((state) =>
      widget.update({ value: state.values[config.field], values: state.values, readonly: form.node('#statusbar').readonly || locked, required: false, invalid: false })
    );
    return widget.element;
  }

  let wizardForward: (() => Promise<void>) | null = null;

  const layout = page.layout;
  let body: HTMLElement;
  if (layout.type === 'sheet') body = sheetLayout(layout);
  else if (layout.type === 'wizard') body = wizardLayout(layout);
  else if (layout.type === 'tabs') body = sectionsLayout({ id: `${layout.id}-page`, children: [layout] });
  else if (layout.type === 'list') {
    const list = listView({
      page,
      node: layout,
      form,
      dataSource: options.dataSource,
      doc,
      el,
      labels,
      locale,
      fill,
      confirm,
      withIcon,
      uid,
      icons: options.icons,
      preferences,
      onOpenRecord: options.onOpenRecord,
    });
    cleanups.push(list.destroy);
    body = list.element;
  }
  else body = sectionsLayout(layout);

  const head = layout.type === 'sheet' ? null : pageHead();
  content.append(...(head ? [head] : []), banner, draft, body);
  root.append(content, done, announcer);
  // The status leaves its place beside Save when the page wants it in a corner or across the top.
  if (options.saveStatus === 'toast') {
    status.classList.add('fd-toast');
    root.append(status);
  } else if (options.saveStatus === 'bar') {
    status.classList.add('fd-status-bar');
    content.prepend(status);
  }

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (layout.type === 'list') return;
    if (wizardForward) void wizardForward();
    else void submitOrSave();
  });

  // ---- keys -------------------------------------------------------------------

  /** Text typed and not yet taken, such as a tag without its Enter, is taken now. */
  function commitTyping() {
    const active = doc.activeElement;
    if (active && root.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

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
      event.preventDefault();
      commitTyping();
      if (wizardForward) void wizardForward();
      else void submitOrSave();
      return;
    }
    // A plain Enter a field used itself, such as picking from an open list, is the field's.
    if (event.defaultPrevented || !keys.enterMovesToNext || event.shiftKey || event.altKey) return;
    const from = event.target as HTMLElement;
    if (from.tagName !== 'INPUT' && from.tagName !== 'SELECT') return;
    if (from.closest('[data-type="one2many"]')) return;
    if (['button', 'submit', 'reset', 'file'].includes((from as HTMLInputElement).type)) return;
    event.preventDefault();
    nextField(from)?.focus();
  });

  // ---- confirmation dialog -----------------------------------------------------

  /** A question with Cancel and OK, or with `withCancel` false a notice with OK alone. */
  function dialogConfirm(message: string, withCancel = true): Promise<boolean> {
    return new Promise((resolve) => {
      const text = el('p', { id: `${prefix}-confirm` }, message);
      const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
      const ok = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.ok);
      const dialog = el('div', { class: 'fd-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': text.id }, text, el('div', { class: 'fd-actions fd-actions-end' }, ...(withCancel ? [cancel, ok] : [ok])));
      const backdrop = el('div', { class: 'fd-dialog-backdrop' }, dialog);
      const close = (answer: boolean) => {
        backdrop.remove();
        resolve(answer);
      };
      cancel.addEventListener('click', () => close(false));
      ok.addEventListener('click', () => close(true));
      backdrop.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close(false);
      });
      root.append(backdrop);
      ok.focus();
    });
  }

  // ---- go -------------------------------------------------------------------

  function render(state: FormState) {
    for (const update of updaters) update(state);
  }

  host.append(root);
  const unsubscribe = form.subscribe(render);
  render(form.getState());
  if (form.getState().status === 'idle') void form.load();

  return {
    form,
    element: root,
    setSkin(skin) {
      root.setAttribute('data-fd-skin', skin);
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
      render(form.getState());
    },
    isReadonly: () => locked,
    destroy() {
      unsubscribe();
      for (const cleanup of cleanups) cleanup();
      root.remove();
      if (ownsForm) form.dispose();
    },
  };
}

/** The boxes a label can be shown in, as the words of an empty box. */
const TEXT_BOX = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea';

/** Fields whose ✓ would say nothing: a yes/no box is never wrong, a table or a file has its own look. */
const NO_VALID_MARK = new Set(['boolean', 'one2many', 'binary', 'image', 'html', 'json', 'properties']);
