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
import type { ActionRequest, Form, FormState, Locale, Value } from '@fieldia/core';
import type { Skin, ViewerHandle } from '@fieldia/viewer';
import { clicked, greeting, shout } from '../shared/custom-page';
import { optionsFromQuery, pageFromQuery, sampleDataSource, relatedPages } from '../shared/sample-data';

const params = new URLSearchParams(location.search);
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const actions: string[] = [];

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
    [relatedPages]="relatedPages"
    [keys]="options.keys"
    [showValid]="options.showValid ?? false"
    [saveStatus]="options.saveStatus ?? 'inline'"
    [readonly]="options.readonly ?? false"
    [editSwitch]="options.editSwitch ?? false"
    [translator]="options.translate"
    (ready)="ready($event)"
    (action)="pressed($event)"
  >
    <ng-template fieldiaSlot="chatter" let-form><demo-chatter [form]="form" /></ng-template>
    <ng-template fieldiaSlot="note" let-form><demo-note [form]="form" /></ng-template>
  </fieldia-form>`,
})
class DemoComponent {
  readonly page = page;
  readonly dataSource = dataSource;
  readonly recordId = page.data.kind === 'record' ? 1 : null;
  readonly skin = ((params.get('skin') as Skin) ?? 'underline') as Skin;
  readonly dir: 'ltr' | 'rtl' | undefined = params.get('dir') === 'rtl' ? 'rtl' : undefined;
  readonly locale = (params.get('locale') as Locale | null) ?? undefined;
  readonly fieldTypes = { 'char.shout': ShoutComponent };
  readonly widgets = { ...gridWidgets, ...codeWidgets };
  readonly relatedPages = relatedPages;
  readonly options = optionsFromQuery(params);
  ready(handle: ViewerHandle) {
    Object.assign(window, { fieldiaDemo: { handle, dataSource, actions, chatter } });
  }
  pressed(request: ActionRequest) {
    actions.push(request.action);
  }
}

const app = document.getElementById('app') as HTMLElement;
app.append(document.createElement('demo-root'));
bootstrapApplication(DemoComponent, { providers: [provideZonelessChangeDetection()] }).catch((error) => {
  app.textContent = `The Angular demo failed to start: ${String(error)}`;
  throw error;
});
