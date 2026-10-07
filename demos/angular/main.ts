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
import type { ActionRequest, Form, FormState, Locale, RecordId, Value } from '@fieldia/core';
import type { Skin, ViewerHandle } from '@fieldia/viewer';
import { clicked, greeting, shout } from '../shared/custom-page';
import { appPages, openRecord, optionsFromQuery, pageFromQuery, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { answerAction } from '../shared/order-desk';

const params = new URLSearchParams(location.search);
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const actions: string[] = [];
/** Every button press in full, with the records chosen in a list. */
const requests: ActionRequest[] = [];

/** The "shout" field, as an Angular component. */
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
    return greeting(this.state?.().values['nickname']);
  }
  label() {
    return clicked(this.clicks());
  }
}

@Component({
  selector: 'demo-root',
  imports: [FieldiaFormComponent, FieldiaSlotDirective, NoteComponent, ChatterComponent],
  template: `<fieldia-form
    [page]="page"
    [dataSource]="dataSource"
    [recordId]="recordId"
    [skin]="skin"
    [dir]="dir"
    [locale]="locale"
    [fieldTypes]="fieldTypes"
    [widgets]="widgets"
    [pages]="pages"
    [keys]="options.keys"
    [showValid]="options.showValid ?? false"
    [saveStatus]="options.saveStatus ?? 'inline'"
    [readonly]="options.readonly ?? false"
    [editSwitch]="options.editSwitch ?? false"
    [translator]="options.translate"
    [user]="options.user"
    [records]="options.records"
    [breadcrumbs]="options.breadcrumbs"
    [user]="options.user"
    (ready)="ready($event)"
    (action)="pressed($event)"
    [answer]="answer"
    (openRecord)="open($event)"
  >
    <ng-template fieldiaSlot="chatter" let-form><demo-chatter [form]="form" /></ng-template>
    <ng-template fieldiaSlot="note" let-form><demo-note [form]="form" /></ng-template>
  </fieldia-form>`,
})
class DemoComponent {
  readonly page = page;
  readonly dataSource = dataSource;
  readonly recordId = recordFromQuery(params, page);
  readonly skin = ((params.get('skin') as Skin) ?? 'underline') as Skin;
  readonly dir: 'ltr' | 'rtl' | undefined = params.get('dir') === 'rtl' ? 'rtl' : undefined;
  readonly locale = (params.get('locale') as Locale | null) ?? undefined;
  readonly fieldTypes = { 'char.shout': ShoutComponent };
  readonly widgets = { ...gridWidgets, ...codeWidgets };
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
}

const app = document.getElementById('app') as HTMLElement;
app.append(document.createElement('demo-root'));
bootstrapApplication(DemoComponent, { providers: [provideZonelessChangeDetection()] }).catch((error) => {
  app.textContent = `The Angular demo failed to start: ${String(error)}`;
  throw error;
});
