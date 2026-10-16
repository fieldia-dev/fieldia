// The JIT compiler links the partial-compiled @fieldia/angular package at
// runtime, and compiles this demo's own components. An Angular CLI app would
// link the package at build time instead; the package is the same.
import '@angular/compiler';
import { Component, DestroyRef, ElementRef, Input, inject, provideZonelessChangeDetection, signal, type AfterViewInit, type OnInit, type Signal } from '@angular/core';
import { chatterSlot } from '@fieldia/chatter';
import { sampleChatter } from '../shared/sample-chatter';
import { bootstrapApplication } from '@angular/platform-browser';
import { FieldiaFormComponent, FieldiaSlotDirective, formState } from '@fieldia/angular';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import { demoListViews, demoMaps, demoMapWidgets } from '../shared/maps';
import type { ActionRequest, Form, FormState, Locale, RecordId, Theme, Value } from '@fieldia/core';
import type { Skin, ViewerHandle } from '@fieldia/viewer';
import { clicked, greeting, shout } from '../shared/custom-page';
import { appPages, openRecord, optionsFromQuery, pageFromQuery, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { answerAction } from '../shared/order-desk';
import { checkPrice, errorLog, loadPlanner, priceWords } from '../shared/contained';
import type { PartFailure } from '@fieldia/widgets';

const params = new URLSearchParams(location.search);
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const actions: string[] = [];
/** Every button press in full, with the records chosen in a list. */
const requests: ActionRequest[] = [];

/** The badge field, as an Angular component. */
@Component({
  selector: 'demo-shout',
  template: `<span class="demo-shout">
    <input [id]="id" class="fd-input" [value]="text()" [readOnly]="readonly" (input)="write($event)" />
    <output>{{ preview() }}</output>
  </span>`,
})
class ShoutComponent {
  @Input() id = '';
  @Input() value: Value | undefined;
  @Input() readonly = false;
  @Input() onChange: (value: Value) => void = () => undefined;
  text() {
    return String(this.value ?? '');
  }
  preview() {
    return shout(this.value);
  }
  write(event: Event) {
    this.onChange((event.target as HTMLInputElement).value || null);
  }
}

/** The app's price tag, as an Angular component: it throws for a four-digit price, as it is given one. */
@Component({
  selector: 'demo-price-tag',
  template: `<span class="demo-price">
    <input [id]="id" class="fd-input" inputmode="decimal" [value]="text()" [readOnly]="readonly" (input)="write($event)" />
    <output>{{ words() }}</output>
  </span>`,
})
class PriceTagComponent {
  @Input() id = '';
  @Input() readonly = false;
  @Input() onChange: (value: Value) => void = () => undefined;
  private price: Value | undefined;
  @Input() set value(value: Value | undefined) {
    checkPrice(value);
    this.price = value;
  }
  text() {
    return String(this.price ?? '');
  }
  words() {
    return priceWords(this.price);
  }
  write(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.onChange(text === '' ? null : Number(text));
  }
}

/** The app's delivery planner, as an Angular component: it throws as it is made. */
@Component({ selector: 'demo-planner', template: '' })
class PlannerComponent {
  constructor() {
    loadPlanner();
  }
}

/** "A part that fails": what onError is told, listed under the form (shared/contained.ts). */
const failures = params.get('page') === 'contained' ? errorLog(document) : null;
if (failures) document.getElementById('app')?.after(failures.element);

const chatter = sampleChatter();

/** The chatter in an Angular slot: its own element it mounts into, for as long as the slot lives. */
@Component({ selector: 'demo-chatter', template: '' })
class ChatterComponent implements AfterViewInit {
  @Input() form!: Form;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  ngAfterViewInit() {
    const done = chatterSlot({ source: chatter, locale: (params.get('locale') as Locale | null) ?? undefined })(this.host.nativeElement, { form: this.form });
    this.destroyRef.onDestroy(done);
  }
}

/** The "note" slot content, as an Angular component with its own state. */
@Component({
  selector: 'demo-note',
  template: `<p class="demo-hello">{{ hello() }}</p>
    <button type="button" class="fd-button" (click)="clicks.set(clicks() + 1)">{{ label() }}</button>`,
})
class NoteComponent implements OnInit {
  @Input() form!: Form;
  readonly clicks = signal(0);
  private state: Signal<FormState> | null = null;
  private readonly destroyRef = inject(DestroyRef);
  ngOnInit() {
    this.state = formState(this.form, this.destroyRef);
  }
  hello() {
    return greeting(this.state?.().values['badge_name']);
  }
  label() {
    return clicked(this.clicks());
  }
}

@Component({
  selector: 'demo-root',
  imports: [FieldiaFormComponent, FieldiaSlotDirective, NoteComponent, ChatterComponent, PlannerComponent],
  template: `<fieldia-form
    [page]="page"
    [dataSource]="dataSource"
    [recordId]="recordId"
    [skin]="skin"
    [theme]="theme"
    [dir]="dir"
    [locale]="locale"
    [fieldTypes]="fieldTypes"
    [widgets]="widgets"
    [listViews]="listViews"
    [maps]="maps"
    [pages]="pages"
    [keys]="options.keys"
    [showValid]="options.showValid ?? false"
    [saveStatus]="options.saveStatus ?? 'inline'"
    [readonly]="options.readonly ?? false"
    [editSwitch]="options.editSwitch ?? false"
    [translator]="options.translate"
    [user]="options.user"
    [records]="options.records"
    [context]="options.context"
    [breadcrumbs]="options.breadcrumbs"
    [user]="options.user"
    (ready)="ready($event)"
    (action)="pressed($event)"
    [answer]="answer"
    (openRecord)="open($event)"
    (partError)="failed($event)"
  >
    <ng-template fieldiaSlot="chatter" let-form><demo-chatter [form]="form" /></ng-template>
    <ng-template fieldiaSlot="note" let-form><demo-note [form]="form" /></ng-template>
    <ng-template fieldiaSlot="planner"><demo-planner /></ng-template>
  </fieldia-form>`,
})
class DemoComponent {
  readonly page = page;
  readonly dataSource = dataSource;
  readonly recordId = recordFromQuery(params, page);
  readonly skin = (params.get('skin') as Skin | null) ?? undefined;
  readonly theme = (params.get('theme') as Theme | null) ?? undefined;
  readonly dir: 'ltr' | 'rtl' | undefined = params.get('dir') === 'rtl' ? 'rtl' : undefined;
  readonly locale = (params.get('locale') as Locale | null) ?? undefined;
  readonly fieldTypes = { 'char.name-badge': ShoutComponent, 'monetary.tag': PriceTagComponent };
  readonly widgets = { ...gridWidgets, ...codeWidgets, ...demoMapWidgets };
  readonly listViews = demoListViews;
  readonly maps = demoMaps;
  readonly pages = appPages;
  readonly options = optionsFromQuery(params);
  ready(handle: ViewerHandle) {
    Object.assign(window, { fieldiaDemo: { handle, dataSource, actions, requests, chatter } });
  }
  pressed(request: ActionRequest) {
    actions.push(request.action);
    requests.push(request);
  }
  /** The shop's answers to the pages' steps: the stock checked for "Order by phone". An output cannot answer, so this is an input. */
  readonly answer = (request: ActionRequest) => answerAction(request, this.locale);
  open(id: RecordId) {
    openRecord(params, id);
  }
  /** A part that failed ("A part that fails" lists them). */
  failed({ error, where }: { error: unknown; where: PartFailure }) {
    failures?.onError(error, where);
  }
}

const app = document.getElementById('app') as HTMLElement;
app.append(document.createElement('demo-root'));
bootstrapApplication(DemoComponent, { providers: [provideZonelessChangeDetection()] }).catch((error) => {
  app.textContent = `The Angular demo failed to start: ${String(error)}`;
  throw error;
});
