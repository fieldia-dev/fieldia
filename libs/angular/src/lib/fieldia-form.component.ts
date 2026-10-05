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
import type { ActionRequest, DataSource, DraftStore, Form, FormState, Locale, Page, RecordId, Scheduler, Value, Values } from '@fieldia/core';
import { mountViewer, type Skin, type SlotRenderer, type ViewerHandle, type ViewerLabels, type ViewerOptions } from '@fieldia/viewer';
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
  readonly values = input<Values | undefined>(undefined);
  readonly skin = input<Skin>('underline');
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

  readonly ready = output<ViewerHandle>();
  readonly action = output<ActionRequest>();
  /** A list's row was opened: the app shows the record. */
  readonly openRecord = output<RecordId>();

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
        dir: this.dir(),
        locale: this.locale(),
        labels: this.labels(),
        fieldTypes: this.fieldTypes(),
        slotNames: this.slotTemplates().map((slot) => slot.name()).join('|'),
      };
      untracked(() => this.mount(options));
    });
    effect(() => {
      const skin = this.skin();
      untracked(() => this.handle?.setSkin(skin));
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

  private mount(options: { page: Page; form?: Form; dataSource?: DataSource; recordId: RecordId | null; dir?: 'ltr' | 'rtl'; locale?: Locale; labels?: Partial<ViewerLabels>; fieldTypes?: Record<string, Type<unknown>> }) {
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
      values: this.values(),
      skin: this.skin(),
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
      onAction: (request) => this.action.emit(request),
      onOpenRecord: (id) => this.openRecord.emit(id),
    });
    this.ready.emit(this.handle);
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
