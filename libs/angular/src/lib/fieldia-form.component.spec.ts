import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, DestroyRef, inject, input, signal, type OnInit, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActionRequest, Form, FormState, Page, Value } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { FieldiaFormComponent, FieldiaSlotDirective, formState } from './fieldia-form.component';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

const custom: Page = {
  fieldia: '0.1',
  id: 'custom-parts',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname', widget: 'shout' },
      { type: 'slot', id: 'note', name: 'note' },
    ],
  },
};

@Component({
  selector: 'test-shout',
  template: `<span>
    <input [id]="id()" aria-label="nickname" [value]="text()" (input)="onChange()($any($event.target).value || null)" />
    <output>{{ text().toUpperCase() }}!</output>
  </span>`,
})
class ShoutComponent {
  readonly id = input('');
  readonly value = input<Value | undefined>(undefined);
  readonly onChange = input<(value: Value) => void>(() => undefined);
  text() {
    return String(this.value() ?? '');
  }
}

@Component({
  selector: 'test-note',
  template: `<button type="button" (click)="clicks.set(clicks() + 1)">Clicked {{ clicks() }} {{ clicks() === 1 ? 'time' : 'times' }}</button>
    <span data-test="seen">{{ state?.().values['nickname'] ?? '' }}</span>`,
})
class NoteComponent implements OnInit {
  readonly form = input.required<Form>();
  readonly clicks = signal(0);
  state: Signal<FormState> | null = null;
  private readonly destroyRef = inject(DestroyRef);
  ngOnInit() {
    this.state = formState(this.form(), this.destroyRef);
  }
}

@Component({
  imports: [FieldiaFormComponent, FieldiaSlotDirective, NoteComponent],
  template: `<fieldia-form
    [page]="page()"
    [skin]="skin()"
    [fieldTypes]="fieldTypes"
    (ready)="onReady($event)"
    (action)="actions.push($event)"
  >
    <ng-template fieldiaSlot="note" let-form><test-note [form]="form" /></ng-template>
  </fieldia-form>`,
})
class HostComponent {
  readonly page = signal<Page>(custom);
  readonly skin = signal<'underline' | 'outlined'>('underline');
  readonly fieldTypes = { 'char.shout': ShoutComponent };
  readonly actions: ActionRequest[] = [];
  readonly ready: ViewerHandle[] = [];
  onReady(handle: ViewerHandle) {
    this.ready.push(handle);
  }
}

async function setup(start: Page = custom) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.page.set(start);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const host = fixture.componentInstance;
  return { fixture, host, el: fixture.nativeElement as HTMLElement, handle: () => host.ready[host.ready.length - 1] };
}

describe('<fieldia-form> for Angular', () => {
  it('mounts the viewer into its own element', async () => {
    const { el } = await setup(page('survey'));
    expect(el.querySelector('fieldia-form .fd-form')).not.toBeNull();
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Next')).toBe(true);
  });

  it('switches skin without mounting again', async () => {
    const { fixture, host, el } = await setup(page('survey'));
    host.skin.set('outlined');
    await fixture.whenStable();
    expect(el.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('outlined');
    expect(host.ready).toHaveLength(1);
  });

  it('renders a custom field written in Angular, both ways', async () => {
    const { fixture, el, handle } = await setup();
    const input = el.querySelector('input[aria-label="nickname"]') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(handle().form.getState().values['nickname']).toBe('hello');
    expect(el.querySelector('output')?.textContent).toBe('HELLO!');
    handle().form.setValue('nickname', 'from outside');
    await fixture.whenStable();
    expect((el.querySelector('input[aria-label="nickname"]') as HTMLInputElement).value).toBe('from outside');
  });

  it('fills a slot from an ng-template whose content keeps its own state', async () => {
    const { fixture, el, handle } = await setup();
    const slot = el.querySelector('.fd-slot[data-slot="note"]') as HTMLElement;
    const button = () => slot.querySelector('button') as HTMLButtonElement;
    button().click();
    await fixture.whenStable();
    expect(button().textContent?.trim()).toBe('Clicked 1 time');
    handle().form.setValue('nickname', 'Sam');
    await fixture.whenStable();
    expect(slot.querySelector('[data-test="seen"]')?.textContent).toBe('Sam');
  });

  it('passes button presses on as an action output', async () => {
    const { host, handle } = await setup(page('customer'));
    await handle().form.runAction('sales');
    expect(host.actions[0]).toMatchObject({ action: 'open_sales' });
  });

  it('hands widgets the preference store it is given', async () => {
    const seen: unknown[] = [];
    const store = { get: () => null, set: () => undefined };
    const spy = (context: { preferences?: unknown; document: Document }) => {
      seen.push(context.preferences);
      return { element: context.document.createElement('div'), update: () => undefined };
    };
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', custom);
    fixture.componentRef.setInput('widgets', { 'char.shout': spy as never });
    fixture.componentRef.setInput('preferences', store);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect(seen[0]).toBe(store);
    fixture.destroy();
  });

  it('lets links open records of the related pages it is given', async () => {
    const seen: boolean[] = [];
    const spy = (context: { dialogs?: { canOpen(model: string): boolean }; document: Document }) => {
      seen.push(context.dialogs?.canOpen('partner') ?? false);
      return { element: context.document.createElement('div'), update: () => undefined };
    };
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', custom);
    fixture.componentRef.setInput('widgets', { 'char.shout': spy as never });
    fixture.componentRef.setInput('relatedPages', { partner: page('customer') });
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect(seen[0]).toBe(true);
    fixture.destroy();
  });

  it('draws the app’s own icons it is given', async () => {
    const p = page('customer');
    (p.layout as any).statButtons[0].icon = 'rocket';
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', p);
    fixture.componentRef.setInput('icons', { rocket: '<path d="M12 2v20"/>' });
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect(document.querySelector('[data-node="sales"] svg')?.getAttribute('data-icon')).toBe('rocket');
    fixture.destroy();
  });

  it('passes its keys on: Enter moves to the next field when asked', async () => {
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', page('signup'));
    fixture.componentRef.setInput('keys', { enterMovesToNext: true });
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const name = document.querySelector('[data-node="f-name"] input') as HTMLInputElement;
    name.focus();
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(document.querySelector('[data-node="f-email"] input'));
    fixture.destroy();
  });

  it('locks and unlocks the form as its readonly changes', async () => {
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', page('signup'));
    fixture.componentRef.setInput('readonly', true);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const name = () => document.querySelector('[data-node="f-name"] input') as HTMLInputElement;
    expect(name().readOnly).toBe(true);
    fixture.componentRef.setInput('readonly', false);
    await fixture.whenStable();
    expect(name().readOnly).toBe(false);
    fixture.destroy();
  });

  it('shows the page in the app’s own words', async () => {
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', page('signup'));
    fixture.componentRef.setInput('translator', (text: string) => (text === 'Full name' ? 'Nom complet' : text));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect(document.querySelector('[data-node="f-name"] .fd-label')?.textContent).toBe('Nom complet');
    fixture.destroy();
  });

  it('cleans up when it is destroyed', async () => {
    const { fixture } = await setup(page('survey'));
    fixture.destroy();
    expect(document.querySelector('.fd-form')).toBeNull();
  });
});
