import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  TemplateRef,
  ViewContainerRef,
  contentChildren,
  createComponent,
  effect,
  inject,
  input,
  output,
  reflectComponentType,
  signal,
  untracked,
  type ComponentRef,
  type EmbeddedViewRef,
  type OnDestroy,
  type Signal,
  type Type,
} from '@angular/core';
import type { ActionRequest, DataSource, DraftStore, Form, FormEvents, FormState, FormUser, Locale, OnAction, Page, RecordId, Scheduler, Theme, Value, Values } from '@fieldia/core';
import { mountViewer, skinFor, type Skin, type SlotRenderer, type ViewerHandle, type ViewerLabels, type ViewerOptions } from '@fieldia/viewer';
import type { PreferenceStore, WidgetFactory, WidgetState } from '@fieldia/widgets';

/**
 * `<fieldia-form>` — the Angular shell. Thin like the React and Vue ones:
 * `mountViewer` makes every decision. This component mounts into its own host
 * element, forwards inputs without mounting again where it can, renders custom
 * fields (Angular components) and slots (`<ng-template fieldiaSlot>`) into the
 * viewer's elements, and tears down.
 *
 * Compiled with ngc in partial mode, the format Angular libraries ship in.
 */

export interface FieldiaSlotContext {
  $implicit: Form;
  form: Form;
  name: string;
}

/** Slot content: `<ng-template fieldiaSlot="chatter" let-form>…</ng-template>`. */
@Directive({ selector: 'ng-template[fieldiaSlot]' })
export class FieldiaSlotDirective {
  readonly name = input.required<string>({ alias: 'fieldiaSlot' });
  readonly template = inject<TemplateRef<FieldiaSlotContext>>(TemplateRef);
}

/**
 * A form's state as a signal. It stops listening when `destroyRef` (or, when
 * left out, the current injection context) is destroyed. Pass the DestroyRef
 * when calling from `ngOnInit`, where the `form` input first has its value.
 */
export function formState(form: Form, destroyRef: DestroyRef = inject(DestroyRef)): Signal<FormState> {
  const state = signal(form.getState());
  const leave = form.subscribe((next) => state.set(next));
  destroyRef.onDestroy(leave);
  return state.asReadonly();
}

const DYNAMIC_INPUTS = ['value', 'values', 'readonly', 'required', 'invalid', 'describedBy'] as const;

@Component({
  selector: 'fieldia-form',
  template: '',
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldiaFormComponent implements OnDestroy {
  readonly page = input.required<Page>();
  readonly form = input<Form | undefined>(undefined);
  readonly dataSource = input<DataSource | undefined>(undefined);
  readonly recordId = input<RecordId | null>(null);
  /** The person using the form: what `user` reads, and the roles that show parts. */
  readonly user = input<FormUser | undefined>(undefined);
  /** Values the app passes in, as Flectra's context: what conditions and filters read as `context`. */
  readonly context = input<ViewerOptions['context']>(undefined);
  readonly values = input<Values | undefined>(undefined);
  /** The skin: the theme's own when left out, else underline. */
  readonly skin = input<Skin | undefined>(undefined);
  /** A theme in the style of a known design system, over the page's own. */
  readonly theme = input<Theme | undefined>(undefined);
  readonly dir = input<'ltr' | 'rtl' | undefined>(undefined);
  readonly locale = input<Locale | undefined>(undefined);
  readonly labels = input<Partial<ViewerLabels> | undefined>(undefined);
  readonly widgets = input<Record<string, WidgetFactory> | undefined>(undefined);
  /** Custom fields as Angular components, by `type.widget` or `type`. They receive the inputs they declare. */
  readonly fieldTypes = input<Record<string, Type<unknown>> | undefined>(undefined);
  readonly drafts = input<{ store: DraftStore; restore?: 'auto' | 'ask'; delayMs?: number } | undefined>(undefined);
  readonly autosave = input<{ delayMs: number } | undefined>(undefined);
  readonly scheduler = input<Scheduler | undefined>(undefined);
  readonly confirm = input<((message: string) => Promise<boolean>) | undefined>(undefined);
  readonly preferences = input<PreferenceStore | undefined>(undefined);
  /** The app's pages: a saved form placed in the page by its id, a link's record by its model. */
  readonly pages = input<ViewerOptions['pages']>(undefined);
  readonly relatedPages = input<ViewerOptions['relatedPages']>(undefined);
  /** The app's own icons, by the names its pages give them. */
  readonly icons = input<ViewerOptions['icons']>(undefined);
  /** Ctrl+Enter saving, and Enter moving to the next field. */
  readonly keys = input<ViewerOptions['keys']>(undefined);
  /** A ✓ by each field filled in right. */
  readonly showValid = input<boolean>(false);
  /** Where a save's progress shows: beside Save, as a toast, or as a bar. */
  readonly saveStatus = input<ViewerOptions['saveStatus']>(undefined);
  /** The whole form locked; a change is forwarded without mounting again. */
  readonly readonly = input<boolean>(false);
  /** An Edit button that unlocks the form, and a Done that saves and locks it. */
  readonly editSwitch = input<boolean>(false);
  /**
   * The app's own translator: every word of the page goes through it. Named
   * `translator` here because a `[translate]` binding goes to the element's own
   * HTML `translate` attribute, never to an input.
   */
  readonly translator = input<ViewerOptions['translate']>(undefined);
  /**
   * The app's answer to a button's action or a `call` step: what `onAction` is
   * in the other bindings. What it returns — values, words, a page to open, a
   * stop — the form takes; an output cannot hand an answer back. The `action`
   * output still tells every call.
   */
  readonly answer = input<OnAction | undefined>(undefined);
  /** Your own way to open a page a step asks for (the viewer's `onOpen`); undefined lets the viewer open it. */
  readonly openPage = input<ViewerOptions['onOpen']>(undefined);
  /** Any of the viewer's host done your own way (the viewer's `host`): words said, a question asked, a page opened, a tab shown. */
  readonly actionHost = input<ViewerOptions['host']>(undefined);
  /** The records round this one, for the pager over it: their ids, or how many, where this one is, and the id at a place. */
  readonly records = input<ViewerOptions['records']>(undefined);
  /** The trail to this record, for the breadcrumbs over it. */
  readonly breadcrumbs = input<ViewerOptions['breadcrumbs']>(undefined);

  readonly ready = output<ViewerHandle>();
  readonly action = output<ActionRequest>();
  /** A list's row was opened: the app shows the record. */
  readonly openRecord = output<RecordId>();
  /**
   * A field was written — `by` a person, a step or the app. Not `change`: on a
   * component's element Angular hears the inputs' own change events under that
   * name too.
   */
  readonly fieldChange = output<FormEvents['change']>();
  /** A record was saved. */
  readonly save = output<FormEvents['save']>();
  /** A page of responses sent its answers. */
  readonly send = output<FormEvents['send']>();
  /** A wizard's step was entered. */
  readonly step = output<FormEvents['step']>();
  /** A run of steps ended — a button's, a moment's — and how. */
  readonly run = output<FormEvents['run']>();
  /** The form has its values: a record loaded — the pager moved on, a copy shown — or a new one. */
  readonly record = output<FormEvents['open']>();
  /** The record was archived or brought back, copied, or deleted, by a step such as the gear menu's. */
  readonly archive = output<FormEvents['archive']>();
  readonly duplicate = output<FormEvents['duplicate']>();
  readonly delete = output<FormEvents['delete']>();

  private readonly slotTemplates = contentChildren(FieldiaSlotDirective);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly views = inject(ViewContainerRef);
  private readonly app = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  private handle: ViewerHandle | null = null;
  private components: ComponentRef<unknown>[] = [];
  private embedded: EmbeddedViewRef<FieldiaSlotContext>[] = [];

  constructor() {
    // Mount again only when what the record is changes; the skin is forwarded.
    effect(() => {
      const options = {
        page: this.page(),
        form: this.form(),
        dataSource: this.dataSource(),
        recordId: this.recordId(),
        user: this.user(),
        context: this.context(),
        dir: this.dir(),
        locale: this.locale(),
        labels: this.labels(),
        fieldTypes: this.fieldTypes(),
        slotNames: this.slotTemplates().map((slot) => slot.name()).join('|'),
      };
      untracked(() => this.mount(options));
    });
    // A theme and a skin switch in place: the theme brings its skin, unless one is given.
    effect(() => {
      const skin = this.skin();
      const theme = this.theme();
      untracked(() => {
        if (!this.handle) return;
        const worn = theme ?? this.page().look?.theme;
        this.handle.setTheme(worn ?? null);
        this.handle.setSkin(skinFor(skin, worn));
      });
    });
    effect(() => {
      const readonly = this.readonly();
      untracked(() => {
        if (this.handle && this.handle.isReadonly() !== readonly) this.handle.setReadonly(readonly);
      });
    });
  }

  ngOnDestroy(): void {
    this.unmount();
  }

  private mount(options: { page: Page; form?: Form; dataSource?: DataSource; recordId: RecordId | null; user?: FormUser; context?: ViewerOptions['context']; dir?: 'ltr' | 'rtl'; locale?: Locale; labels?: Partial<ViewerLabels>; fieldTypes?: Record<string, Type<unknown>> }) {
    this.unmount();
    const widgets: Record<string, WidgetFactory> = { ...this.widgets() };
    for (const [key, type] of Object.entries(options.fieldTypes ?? {})) {
      const declared = new Set((reflectComponentType(type)?.inputs ?? []).map((i) => i.templateName));
      const set = (ref: ComponentRef<unknown>, name: string, value: unknown) => {
        if (declared.has(name)) ref.setInput(name, value);
      };
      widgets[key] = (context) => {
        const box = context.document.createElement('div');
        box.className = 'fd-custom';
        const ref = createComponent(type, { environmentInjector: this.injector, hostElement: box });
        this.app.attachView(ref.hostView);
        this.components.push(ref);
        set(ref, 'name', context.name);
        set(ref, 'field', context.field);
        set(ref, 'node', context.node);
        set(ref, 'id', context.id);
        set(ref, 'form', context.form);
        set(ref, 'onChange', (value: Value) => context.form.setValue(context.name, value));
        return {
          element: box,
          update: (state: WidgetState) => {
            for (const name of DYNAMIC_INPUTS) set(ref, name, state[name]);
          },
          focus: () => box.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus(),
        };
      };
    }

    const slots: Record<string, SlotRenderer> = {};
    for (const slot of this.slotTemplates()) {
      slots[slot.name()] = (box, context) => {
        const view = this.views.createEmbeddedView(slot.template, { $implicit: context.form, form: context.form, name: context.name });
        for (const node of view.rootNodes) box.append(node);
        view.detectChanges();
        this.embedded.push(view);
      };
    }

    this.handle = mountViewer(this.host.nativeElement, {
      page: options.page,
      form: options.form,
      dataSource: options.dataSource,
      recordId: options.recordId,
      user: options.user,
      context: options.context,
      values: this.values(),
      skin: this.skin(),
      theme: this.theme(),
      dir: options.dir,
      locale: options.locale,
      labels: options.labels,
      widgets,
      slots,
      drafts: this.drafts(),
      autosave: this.autosave(),
      scheduler: this.scheduler(),
      confirm: this.confirm(),
      preferences: this.preferences(),
      pages: this.pages(),
      relatedPages: this.relatedPages(),
      icons: this.icons(),
      keys: this.keys(),
      showValid: this.showValid(),
      saveStatus: this.saveStatus(),
      readonly: this.readonly(),
      editSwitch: this.editSwitch(),
      translate: this.translator(),
      onAction: (request) => {
        this.action.emit(request);
        return this.answer()?.(request);
      },
      onOpen: (request) => this.openPage()?.(request),
      host: this.actionHost(),
      onOpenRecord: (id) => this.openRecord.emit(id),
      records: this.records(),
      breadcrumbs: this.breadcrumbs(),
    });
    const handle = this.handle;
    handle.on('change', (event) => this.fieldChange.emit(event));
    handle.on('save', (event) => this.save.emit(event));
    handle.on('send', (event) => this.send.emit(event));
    handle.on('step', (event) => this.step.emit(event));
    handle.on('run', (event) => this.run.emit(event));
    handle.on('open', (event) => this.record.emit(event));
    handle.on('archive', (event) => this.archive.emit(event));
    handle.on('duplicate', (event) => this.duplicate.emit(event));
    handle.on('delete', (event) => this.delete.emit(event));
    this.ready.emit(handle);
  }

  private unmount() {
    this.handle?.destroy();
    this.handle = null;
    for (const view of this.embedded) view.destroy();
    for (const ref of this.components) {
      this.app.detachView(ref.hostView);
      ref.destroy();
    }
    this.embedded = [];
    this.components = [];
  }
}
