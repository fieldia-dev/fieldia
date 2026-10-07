import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, DestroyRef, inject, input, signal, type OnInit, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createMemoryDataSource, type ActionRequest, type Form, type FormState, type FormUser, type Page, type RecordId, type Value } from '@fieldia/core';
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

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [dataSource]="dataSource" (openRecord)="opened.push($event)" />`,
})
class ListHostComponent {
  readonly page = page('customers');
  readonly dataSource = createMemoryDataSource({ records: { partner: { 7: { name: 'Delta Foods' } } } });
  readonly opened: RecordId[] = [];
}

/** Two employees over a sheet with a gear menu, for the pager, the trail and the record's events. */
const staffPage: Page = {
  fieldia: '0.1',
  id: 'staff',
  data: { kind: 'record', model: 'hr.employee' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, toolbar: { menu: [{ id: 'm-dup', builtin: 'duplicate' }] }, children: [] },
};
const staff = () => createMemoryDataSource({ records: { 'hr.employee': { 1: { name: 'Mona Adel' }, 2: { name: 'Karim Fathy' } } } });
const waitFor = async (check: () => unknown) => {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
};

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [dataSource]="dataSource" [recordId]="1" [records]="records" [breadcrumbs]="trail" (record)="shown.push($event.recordId)" />`,
})
class StaffHostComponent {
  readonly page = staffPage;
  readonly dataSource = staff();
  readonly records = [1, 2];
  readonly trail = [{ label: 'Employees' }];
  readonly shown: unknown[] = [];
}

/** A product priced by the app, saved as a record. */
const pricing: Page = {
  fieldia: '0.1',
  id: 'pricing',
  data: { kind: 'record', model: 'shop.order' },
  fields: { product: { type: 'char', label: 'Product' }, price: { type: 'float', label: 'Price' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-product', field: 'product' },
      { type: 'field', id: 'f-price', field: 'price' },
      { type: 'button', id: 'price', label: 'Price it', action: 'price' },
    ],
  },
};

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form
    [page]="page"
    [dataSource]="dataSource"
    [answer]="answer"
    (action)="heard.push('action ' + $event.action)"
    (fieldChange)="heard.push('change ' + $event.field + ' by ' + $event.by)"
    (run)="heard.push('run ' + $event.id + ' ' + $event.result.done)"
    (save)="heard.push('save ' + $event.values['price'])"
    (send)="heard.push('send')"
    (step)="heard.push('step ' + $event.step)"
    (ready)="handle = $event"
  />`,
})
class EventsHostComponent {
  page: Page = pricing;
  readonly dataSource = createMemoryDataSource();
  readonly heard: string[] = [];
  handle!: ViewerHandle;
  readonly answer = (request: ActionRequest) => (request.action === 'price' ? { values: { price: 380 } } : undefined);
}

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [user]="user()" />`,
})
class PersonHostComponent {
  readonly page: Page = { fieldia: '0.1', id: 'lock', data: { kind: 'record', model: 'sale.order' }, fields: {}, layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'lock', label: 'Lock', action: 'lock', roles: ['sales.manager'] }] } };
  readonly user = signal<FormUser>({ id: 4, roles: ['sales.user'] });
}

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [context]="context()" />`,
})
class ContextHostComponent {
  readonly page: Page = { fieldia: '0.1', id: 'lock', data: { kind: 'record', model: 'sale.order' }, fields: {}, layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'lock', label: 'Lock', action: 'lock', invisible: "context.code != 'incoming'" }] } };
  readonly context = signal<Record<string, string>>({ code: 'outgoing' });
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

  it('hands the form the person using it: parts shown to their roles, again when they change', async () => {
    const fixture = TestBed.createComponent(PersonHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const lock = () => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Lock' && !b.closest('[hidden]'));
    expect(lock()).toBeUndefined();
    fixture.componentInstance.user.set({ id: 5, roles: ['sales.manager'] });
    await fixture.whenStable();
    expect(lock()).toBeDefined();
  });

  it('hands the form the values the app passes in, as context, again when they change', async () => {
    const fixture = TestBed.createComponent(ContextHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const lock = () => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Lock' && !b.closest('[hidden]'));
    expect(lock()).toBeUndefined();
    fixture.componentInstance.context.set({ code: 'incoming' });
    await fixture.whenStable();
    expect(lock()).toBeDefined();
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

  it('takes what the app answers through [answer], and tells the form’s events as outputs', async () => {
    const fixture = TestBed.createComponent(EventsHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    const product = el.querySelector('[data-node="f-product"] input') as HTMLInputElement;
    product.value = 'Desk lamp';
    product.dispatchEvent(new Event('input', { bubbles: true }));
    // A box's own change event is not the form's: it is not heard as one.
    product.dispatchEvent(new Event('change', { bubbles: true }));
    (el.querySelector('[data-node="price"]') as HTMLButtonElement).click();
    await host.handle.form.settled();
    expect((el.querySelector('[data-node="f-price"] input') as HTMLInputElement).value).toBe('380.00');
    await host.handle.save();
    expect(host.heard).toEqual(['change product by person', 'action price', 'change price by step', 'run price true', 'save 380']);
  });

  it('tells a response sent and a wizard step entered', async () => {
    const fixture = TestBed.createComponent(EventsHostComponent);
    fixture.componentInstance.page = page('survey');
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    await host.handle.form.settled();
    expect(host.heard).toEqual(['step step-about']);
    const sending = TestBed.createComponent(EventsHostComponent);
    sending.componentInstance.page = { ...pricing, data: { kind: 'responses' } };
    sending.autoDetectChanges();
    await sending.whenStable();
    await sending.componentInstance.handle.save();
    expect(sending.componentInstance.heard).toEqual(['send']);
  });

  it('passes a list’s opened row on as an openRecord output', async () => {
    const fixture = TestBed.createComponent(ListHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    for (let waited = 0; !el.querySelector('.fd-list-row') && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
    (el.querySelector('.fd-list-row td:nth-child(2)') as HTMLElement).click();
    expect(fixture.componentInstance.opened).toEqual([7]);
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

  it('draws a saved form placed in the page from the pages it is given', async () => {
    const fixture = TestBed.createComponent(FieldiaFormComponent);
    fixture.componentRef.setInput('page', page('delivery'));
    fixture.componentRef.setInput('pages', { address: page('address') });
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const part = document.querySelector('[data-node="delivery-address"]') as HTMLElement;
    expect(part.querySelector('legend')?.textContent).toBe('Delivery address');
    expect(part.querySelector('[data-node="street"] .fd-label')?.textContent).toBe('Street and number');
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

  it('draws the pager and the breadcrumbs it is given, and tells each record the form shows', async () => {
    const fixture = TestBed.createComponent(StaffHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    await waitFor(() => el.querySelector('.fd-crumb-current')?.textContent === 'Mona Adel');
    expect(el.querySelector('.fd-record-pager-text')?.textContent).toBe('1 / 2');
    (el.querySelector('[aria-label="Next record"]') as HTMLButtonElement).click();
    await waitFor(() => fixture.componentInstance.shown.length === 2);
    expect(fixture.componentInstance.shown).toEqual([1, 2]);
  });

  it('cleans up when it is destroyed', async () => {
    const { fixture } = await setup(page('survey'));
    fixture.destroy();
    expect(document.querySelector('.fd-form')).toBeNull();
  });
});
