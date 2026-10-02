import {
  createForm,
  validatePage,
  type ButtonNode,
  type FieldNode,
  type Form,
  type FormOptions,
  type FormState,
  type LayoutNode,
  type Page,
  type RelatedRecord,
  type SectionNode,
  type SheetNode,
  type SlotNode,
  type TabsNode,
  type TextNode,
  type WizardNode,
  type Locale,
  MESSAGES,
} from '@fieldia/core';
import { createWidget, installStyles, WIDGET_LABELS, type WidgetFactory } from '@fieldia/widgets';

export type Skin = 'underline' | 'outlined';

/** Every word the viewer shows, so a page can be translated. `{n}`, `{total}` and `{time}` are filled in. */
export interface ViewerLabels {
  save: string;
  discard: string;
  saving: string;
  saved: string;
  submit: string;
  next: string;
  back: string;
  stepOf: string;
  submitted: string;
  submitAnother: string;
  draftFound: string;
  restore: string;
  discardDraft: string;
  ok: string;
  cancel: string;
  loading: string;
}

export const VIEWER_LABELS: Record<Locale, ViewerLabels> = {
  en: {
    save: 'Save',
    discard: 'Discard',
    saving: 'Saving…',
    saved: 'Saved',
    submit: 'Submit',
    next: 'Next',
    back: 'Back',
    stepOf: 'Step {n} of {total}',
    submitted: 'Thank you. Your answers were sent.',
    submitAnother: 'Submit another response',
    draftFound: 'You have unsaved answers from {time}.',
    restore: 'Restore',
    discardDraft: 'Discard',
    ok: 'OK',
    cancel: 'Cancel',
    loading: 'Loading…',
  },
  ar: {
    save: 'حفظ',
    discard: 'تجاهل',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ',
    submit: 'إرسال',
    next: 'التالي',
    back: 'رجوع',
    stepOf: 'الخطوة {n} من {total}',
    submitted: 'شكرًا لك. تم إرسال إجاباتك.',
    submitAnother: 'إرسال إجابة أخرى',
    draftFound: 'لديك إجابات غير محفوظة من {time}.',
    restore: 'استعادة',
    discardDraft: 'تجاهل',
    ok: 'موافق',
    cancel: 'إلغاء',
    loading: 'جارٍ التحميل…',
  },
  de: {
    save: 'Speichern',
    discard: 'Verwerfen',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    submit: 'Absenden',
    next: 'Weiter',
    back: 'Zurück',
    stepOf: 'Schritt {n} von {total}',
    submitted: 'Vielen Dank. Ihre Antworten wurden gesendet.',
    submitAnother: 'Weitere Antwort senden',
    draftFound: 'Sie haben ungespeicherte Antworten vom {time}.',
    restore: 'Wiederherstellen',
    discardDraft: 'Verwerfen',
    ok: 'OK',
    cancel: 'Abbrechen',
    loading: 'Wird geladen…',
  },
  fr: {
    save: 'Enregistrer',
    discard: 'Annuler les modifications',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    submit: 'Envoyer',
    next: 'Suivant',
    back: 'Retour',
    stepOf: 'Étape {n} sur {total}',
    submitted: 'Merci. Vos réponses ont été envoyées.',
    submitAnother: 'Envoyer une autre réponse',
    draftFound: 'Vous avez des réponses non enregistrées du {time}.',
    restore: 'Restaurer',
    discardDraft: 'Ignorer',
    ok: 'OK',
    cancel: 'Annuler',
    loading: 'Chargement…',
  },
};

/** English, kept under its old name. */
export const DEFAULT_LABELS: ViewerLabels = VIEWER_LABELS.en;

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
  /** The page's language: viewer labels, validation messages and widget words. Arabic runs right to left. */
  locale?: Locale;
  /** Labels that win over the language's defaults. */
  labels?: Partial<ViewerLabels>;
  dir?: 'ltr' | 'rtl';
  /** How to ask before a button with `confirm` runs. Defaults to a small dialog. */
  confirm?: (message: string) => Promise<boolean>;
}

export interface ViewerHandle {
  readonly form: Form;
  readonly element: HTMLElement;
  setSkin(skin: Skin): void;
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
  const checked = validatePage(options.page);
  if (!checked.ok) {
    throw new Error(`This page cannot be shown:\n${checked.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`);
  }
  const page = checked.page;
  const locale = options.locale ?? 'en';
  const ownsForm = !options.form;
  const form = options.form ?? createForm({ ...options, page, messages: options.messages ?? MESSAGES[locale] });
  const labels: ViewerLabels = { ...VIEWER_LABELS[locale], ...options.labels };
  const widgetLabels = WIDGET_LABELS[locale];
  const dir = options.dir ?? (locale === 'ar' ? 'rtl' : undefined);
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

  const root = el('form', { class: 'fd-form', novalidate: '', 'data-fd-skin': options.skin ?? 'underline', dir, lang: options.locale });
  const confirm = options.confirm ?? dialogConfirm;

  // ---- the parts -------------------------------------------------------

  function fieldItem(node: FieldNode): HTMLElement {
    const def = page.fields[node.field];
    const id = uid(node.id);
    const wrapper = el('div', { class: 'fd-field', 'data-node': node.id, 'data-field': node.field });
    if (node.colspan) wrapper.style.setProperty('--fd-span', String(node.colspan));
    const label = el('label', { class: 'fd-label', id: `${id}-label`, for: id }, node.label ?? def.label);
    const widget = createWidget({ form, name: node.field, field: def, node, id, document: doc, labels: widgetLabels }, options.widgets);
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(widget.element.tagName)) {
      // `for` stays: a custom field that puts the id on its own input is
      // labelled natively. Only a wrapper with a role (a radio group, say) may
      // carry a name; ARIA forbids naming a plain div or span.
      if (widget.element.getAttribute('role')) widget.element.setAttribute('aria-labelledby', label.id);
      label.addEventListener('click', () => widget.focus());
    }
    const helpText = node.help ?? def.help;
    const help = helpText ? el('div', { class: 'fd-help', id: `${id}-help` }, helpText) : null;
    const error = el('div', { class: 'fd-error', id: `${id}-error`, role: 'alert', hidden: '' });
    wrapper.append(label, widget.element, ...(help ? [help] : []), error);
    if (widget.destroy) cleanups.push(() => widget.destroy?.());

    updaters.push((state) => {
      const shown = form.node(node.id);
      wrapper.hidden = shown.invisible;
      wrapper.classList.toggle('fd-required', shown.required);
      const message = state.errors[node.field];
      error.hidden = !message;
      error.textContent = message ?? '';
      widget.update({
        value: state.values[node.field],
        values: state.values,
        readonly: shown.readonly,
        required: shown.required,
        invalid: !!message,
        describedBy: [help?.id, message ? error.id : undefined].filter(Boolean).join(' ') || undefined,
      });
    });
    return wrapper;
  }

  function hideWhen(element: HTMLElement, id: string) {
    updaters.push(() => {
      element.hidden = form.node(id).invisible;
    });
  }

  function buttonItem(node: ButtonNode): HTMLElement {
    const button = el('button', { type: 'button', class: `fd-button fd-button-${node.style ?? 'secondary'}`, 'data-node': node.id }, node.label);
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

  function grid(children: LayoutNode[], columns = 1): HTMLElement {
    const box = el('div', { class: 'fd-grid' });
    box.style.setProperty('--fd-columns', String(columns));
    box.append(...children.map(item));
    return box;
  }

  function sectionItem(node: SectionNode): HTMLElement {
    const section = el('fieldset', { class: 'fd-section', 'data-node': node.id });
    if (node.title) section.append(el('legend', { class: 'fd-section-title' }, node.title));
    if (node.description) section.append(el('p', { class: 'fd-section-description' }, node.description));
    section.append(grid(node.children, node.columns ?? 1));
    hideWhen(section, node.id);
    return section;
  }

  function tabsItem(node: TabsNode): HTMLElement {
    const box = el('div', { class: 'fd-tabs', 'data-node': node.id });
    const list = el('div', { class: 'fd-tablist', role: 'tablist' });
    // The tab someone picked. Until they pick, the first visible tab is open —
    // a tab hidden while the record loads must not leave its neighbour open.
    let picked: string | null = null;
    let active = node.children[0].id;
    const parts = node.children.map((tab) => {
      const tabId = uid(`${tab.id}-tab`);
      const panelId = uid(`${tab.id}-panel`);
      const button = el('button', { type: 'button', class: 'fd-tab', role: 'tab', id: tabId, 'aria-controls': panelId, 'data-node': tab.id }, tab.label);
      const panel = el('div', { class: 'fd-tabpanel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId }, grid(tab.children));
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

  function item(node: LayoutNode): HTMLElement {
    switch (node.type) {
      case 'field':
        return fieldItem(node);
      case 'button':
        return buttonItem(node);
      case 'text':
        return textItem(node);
      case 'slot':
        return slotItem(node);
      case 'section':
        return sectionItem(node);
      case 'tabs':
        return tabsItem(node);
    }
  }

  // ---- shared chrome ----------------------------------------------------------

  const status = el('div', { class: 'fd-status', role: 'status', 'aria-live': 'polite' });
  updaters.push((state) => {
    const text = state.status === 'saving' ? labels.saving : state.status === 'saved' ? labels.saved : state.status === 'loading' ? labels.loading : state.status === 'error' ? state.error ?? '' : '';
    status.textContent = text;
    status.classList.toggle('fd-status-error', state.status === 'error');
    status.classList.toggle('fd-status-saved', state.status === 'saved');
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
    const box = el('div', { class: 'fd-sections', 'data-node': node.id }, ...node.children.map(item));
    const action = el('button', { type: 'submit', class: 'fd-button fd-button-primary' }, page.data.kind === 'responses' ? labels.submit : labels.save);
    const actions = el('div', { class: 'fd-actions fd-actions-end' }, status, action);
    return el('div', {}, box, actions);
  }

  function wizardLayout(node: WizardNode): HTMLElement {
    const box = el('div', { class: 'fd-wizard', 'data-node': node.id });
    const progressText = el('div', { class: 'fd-progress-text' });
    const bar = el('span');
    box.append(el('div', { class: 'fd-progress' }, progressText, el('div', { class: 'fd-progress-bar' }, bar)));
    const panels = node.children.map((step) => {
      const panel = el('section', { class: 'fd-step', 'data-node': step.id, 'aria-labelledby': uid(`${step.id}-title`) });
      panel.append(el('h2', { class: 'fd-step-title', id: uid(`${step.id}-title`) }, step.label));
      if (step.description) panel.append(el('p', { class: 'fd-section-description' }, step.description));
      panel.append(grid(step.children));
      box.append(panel);
      return { step, panel };
    });
    const back = el('button', { type: 'button', class: 'fd-button' }, labels.back);
    const forward = el('button', { type: 'submit', class: 'fd-button fd-button-primary' });
    box.append(el('div', { class: 'fd-wizard-nav' }, back, el('span', { class: 'fd-spacer' }), status, forward));
    back.addEventListener('click', () => {
      if (form.back()) focusStep();
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
      back.hidden = index === 0;
      forward.textContent = index === steps.length - 1 ? labels.submit : labels.next;
    });
    return box;
  }

  function sheetLayout(node: SheetNode): HTMLElement {
    const pageBox = el('div', { class: 'fd-sheet-page', 'data-node': node.id });
    const actions = el('div', { class: 'fd-actions' });
    const save = el('button', { type: 'submit', class: 'fd-button fd-button-primary' }, labels.save);
    const discard = el('button', { type: 'button', class: 'fd-button' }, labels.discard);
    discard.addEventListener('click', () => form.reset());
    actions.append(save, discard, ...(node.buttons ?? []).map(buttonItem), status);
    updaters.push((state) => {
      const dirty = state.dirty.length > 0 && state.status !== 'saving';
      save.hidden = !dirty;
      discard.hidden = !dirty;
    });
    const header = el('div', { class: 'fd-header' }, actions);
    if (node.statusbar) header.append(statusbar(node.statusbar));

    const card = el('div', { class: 'fd-card' });
    if (node.ribbon) {
      const ribbon = el('div', { class: `fd-ribbon fd-tone-${node.ribbon.tone ?? 'muted'}`, 'data-node': node.ribbon.id }, node.ribbon.label);
      hideWhen(ribbon, node.ribbon.id);
      card.append(ribbon);
    }
    if (node.statButtons?.length) {
      const stats = el('div', { class: 'fd-stats' });
      for (const stat of node.statButtons) {
        const value = el('span', { class: 'fd-stat-value' });
        const button = el('button', { type: 'button', class: 'fd-stat', 'data-node': stat.id }, value, el('span', { class: 'fd-stat-label' }, stat.label));
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
      const box = el('div', { class: `fd-alert fd-tone-${alert.tone ?? 'info'}`, role: 'status', 'data-node': alert.id }, alert.message);
      hideWhen(box, alert.id);
      card.append(box);
    }
    if (node.title) {
      const title = el('div', { class: 'fd-title' });
      title.append(fieldItem({ type: 'field', id: '#title', field: node.title.field, placeholder: node.title.placeholder }));
      if (node.title.subtitleField) title.append(fieldItem({ type: 'field', id: '#subtitle', field: node.title.subtitleField }));
      const row = el('div', { class: 'fd-title-row' }, title);
      if (node.title.avatarField) {
        const avatar = fieldItem({ type: 'field', id: '#avatar', field: node.title.avatarField });
        avatar.classList.add('fd-avatar');
        row.append(avatar);
      }
      card.append(row);
    }
    card.append(grid(node.children));

    const layout = el('div', { class: 'fd-sheet-layout' }, card);
    if (node.sidePanel) {
      layout.classList.add('fd-has-side');
      layout.append(el('aside', { class: 'fd-side' }, slotItem(node.sidePanel)));
    }
    pageBox.append(header, layout);
    return pageBox;
  }

  function statusbar(config: NonNullable<SheetNode['statusbar']>): HTMLElement {
    const def = page.fields[config.field];
    const list = el('ol', { class: 'fd-statusbar', 'aria-label': def.label });
    if (def.type === 'selection') {
      const states = def.options.filter((o) => !config.visibleStates || config.visibleStates.includes(o.value));
      const items = states.map((option) => {
        const inner = config.clickable ? el('button', { type: 'button' }, el('span', {}, option.label)) : el('span', {}, el('span', {}, option.label));
        if (inner instanceof HTMLButtonElement) inner.addEventListener('click', () => form.setValue(config.field, option.value));
        list.append(el('li', {}, inner));
        return { option, inner };
      });
      updaters.push((state) => {
        const readonly = form.node('#statusbar').readonly;
        for (const { option, inner } of items) {
          if (option.value === state.values[config.field]) inner.setAttribute('aria-current', 'step');
          else inner.removeAttribute('aria-current');
          if (inner instanceof HTMLButtonElement) inner.disabled = readonly;
        }
      });
    } else {
      const current = el('span', { 'aria-current': 'step' });
      list.append(el('li', {}, current));
      updaters.push((state) => {
        const value = state.values[config.field] as RelatedRecord | null;
        current.textContent = value?.label ?? '';
      });
    }
    return list;
  }

  let wizardForward: (() => Promise<void>) | null = null;

  const layout = page.layout;
  let body: HTMLElement;
  if (layout.type === 'sheet') body = sheetLayout(layout);
  else if (layout.type === 'wizard') body = wizardLayout(layout);
  else if (layout.type === 'tabs') body = sectionsLayout({ id: `${layout.id}-page`, children: [layout] });
  else body = sectionsLayout(layout);

  const head = layout.type === 'sheet' ? null : pageHead();
  content.append(...(head ? [head] : []), draft, body);
  root.append(content, done);

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (wizardForward) void wizardForward();
    else void submitOrSave();
  });

  // ---- confirmation dialog -----------------------------------------------------

  function dialogConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const text = el('p', { id: `${prefix}-confirm` }, message);
      const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
      const ok = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.ok);
      const dialog = el('div', { class: 'fd-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': text.id }, text, el('div', { class: 'fd-actions fd-actions-end' }, cancel, ok));
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
    destroy() {
      unsubscribe();
      for (const cleanup of cleanups) cleanup();
      root.remove();
      if (ownsForm) form.dispose();
    },
  };
}
