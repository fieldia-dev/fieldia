import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, DestroyRef, inject, input, signal, type OnInit, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createMemoryDataSource, type ActionRequest, type Form, type FormState, type FormUser, type Page, type RecordId, type Skin, type Theme, type Value } from '@fieldia/core';
import type { Tokens, ViewerHandle } from '@fieldia/viewer';
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
    [theme]="theme()"
    [tokens]="tokens()"
    [fieldTypes]="fieldTypes"
    (ready)="onReady($event)"
    (action)="actions.push($event)"
  >
    <ng-template fieldiaSlot="note" let-form><test-note [form]="form" /></ng-template>
  </fieldia-form>`,
})
class HostComponent {
  readonly page = signal<Page>(custom);
  readonly skin = signal<Skin | undefined>('underline');
  readonly theme = signal<Theme | undefined>(undefined);
  readonly tokens = signal<Tokens | undefined>(undefined);
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

/** A clinic's intake continued from the link Continue later gave: the draft's key, and each draft kept told. */
@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [dataSource]="dataSource" resume="abc" (draft)="heard.push('draft ' + $event.key + ($event.later ? ' later' : ''))" (ready)="handle = $event" />`,
})
class ResumeHostComponent {
  page = page('clinic-intake');
  dataSource = createMemoryDataSource({ drafts: { abc: { pageId: 'clinic-intake', values: { full_name: 'Mona Adel' }, step: 'visit', savedAt: '2026-10-19T10:42:00Z' } } });
  heard: string[] = [];
  handle!: ViewerHandle;
}

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

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [functions]="functions()" (ready)="ready.push($event)" />`,
})
class FunctionsHostComponent {
  readonly page: Page = { fieldia: '0.5', id: 'priced', data: { kind: 'responses' }, fields: { price: { type: 'float', label: 'Price' }, total: { type: 'float', label: 'Total', compute: 'withTax(price)' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-price', field: 'price' }, { type: 'field', id: 'f-total', field: 'total' }] } };
  readonly functions = signal<Record<string, (price: number) => number>>({ withTax: (price) => price * 2 });
  readonly ready: ViewerHandle[] = [];
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

  it('hands the form the app’s functions, each call reaching the newest given, mounted again only for a new name', async () => {
    const fixture = TestBed.createComponent(FunctionsHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    host.ready[0].form.setValue('price', 100);
    expect(host.ready[0].form.getState().values['total']).toBe(200);
    host.functions.set({ withTax: (price) => price * 3 });
    await fixture.whenStable();
    host.ready[host.ready.length - 1].form.setValue('price', 200);
    expect(host.ready[host.ready.length - 1].form.getState().values['total']).toBe(600);
    expect(host.ready).toHaveLength(1);
    host.functions.set({ withTax: (price) => price, other: () => 1 });
    await fixture.whenStable();
    expect(host.ready).toHaveLength(2);
  });

  it('switches skin without mounting again', async () => {
    const { fixture, host, el } = await setup(page('survey'));
    host.skin.set('outlined');
    await fixture.whenStable();
    expect(el.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('outlined');
    expect(host.ready).toHaveLength(1);
  });

  it('wears the quiet skin, the page’s own or given here, and keeps the page’s when no skin is given', async () => {
    const survey = page('survey');
    const { fixture, host, el } = await setup({ ...survey, look: { ...survey.look, skin: 'quiet' } });
    host.skin.set(undefined);
    await fixture.whenStable();
    expect(el.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('quiet');
    expect(el.querySelector('.fd-field[data-quiet]')).not.toBeNull();
    host.skin.set('outlined');
    await fixture.whenStable();
    expect(el.querySelector('.fd-field[data-quiet]')).toBeNull();
    host.skin.set('quiet');
    await fixture.whenStable();
    expect(el.querySelector('.fd-field[data-quiet]')).not.toBeNull();
    expect(host.ready).toHaveLength(1);
  });

  it('wears a theme on its own skin, and switches it without mounting again', async () => {
    const { fixture, host, el } = await setup(page('survey'));
    host.skin.set(undefined);
    host.theme.set('material');
    await fixture.whenStable();
    expect(el.querySelector('.fd-form')?.getAttribute('data-fd-theme')).toBe('material');
    expect(el.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('outlined');
    host.theme.set('odoo');
    await fixture.whenStable();
    expect(el.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('underline');
    expect(host.ready).toHaveLength(1);
  });

  it('wears the host’s tokens, and new ones in their place as they change, without mounting again', async () => {
    const { fixture, host, el } = await setup(page('survey'));
    host.tokens.set({ accent: '#0f766e' });
    await fixture.whenStable();
    const form = () => el.querySelector('.fd-form') as HTMLElement;
    expect(form().style.getPropertyValue('--fd-accent')).toBe('#0f766e');
    host.tokens.set({ accent: '#b45309', surface: '#1b2320' });
    await fixture.whenStable();
    expect(form().style.getPropertyValue('--fd-accent')).toBe('#b45309');
    expect(form().style.getPropertyValue('--fd-surface')).toBe('#1b2320');
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

  it('opens a draft by its key ([resume]) at its step, and tells each draft Continue later kept as a draft output', async () => {
    const fixture = TestBed.createComponent(ResumeHostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    await host.handle.form.settled();
    expect(host.handle.form.getState().step).toBe('visit');
    await host.handle.form.continueLater();
    expect(host.heard).toEqual(['draft abc later']);
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
