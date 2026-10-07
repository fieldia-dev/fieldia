import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { createForm, createMemoryDataSource, type ActionRequest, type Form, type Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { defineComponent, h, nextTick, ref, type PropType } from 'vue';
import { FieldiaForm, useFormState } from './fieldia-form';

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

const Shout = defineComponent({
  props: { value: null, id: String, readonly: Boolean, onChange: { type: Function as PropType<(v: unknown) => void>, required: true } },
  setup(props) {
    return () =>
      h('span', [
        h('input', { id: props.id, 'aria-label': 'nickname', value: (props.value as string) ?? '', onInput: (e: Event) => props.onChange((e.target as HTMLInputElement).value || null) }),
        h('output', `${String(props.value ?? '').toUpperCase()}!`),
      ]);
  },
});

const Note = defineComponent({
  props: { form: { type: Object as PropType<Form>, required: true } },
  setup(props) {
    const clicks = ref(0);
    const state = useFormState(props.form);
    return () =>
      h('div', [
        h('button', { type: 'button', onClick: () => clicks.value++ }, `Clicked ${clicks.value} ${clicks.value === 1 ? 'time' : 'times'}`),
        h('span', { 'data-test': 'seen' }, String(state.value.values['nickname'] ?? '')),
      ]);
  },
});

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

const handleOf = (wrapper: { emitted: (e: string) => unknown[][] | undefined }) => (wrapper.emitted('ready')?.[0]?.[0] ?? null) as ViewerHandle | null;

describe('<FieldiaForm> for Vue', () => {
  it('mounts the viewer into its own element', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('survey') }, attachTo: document.body });
    expect(wrapper.find('.fd-form').exists()).toBe(true);
    expect(wrapper.findAll('button').some((b) => b.text() === 'Next')).toBe(true);
    wrapper.unmount();
  });

  it('hands the form the person using it: parts shown to their roles, again when they change', async () => {
    const lock: Page = { fieldia: '0.1', id: 'lock', data: { kind: 'record', model: 'sale.order' }, fields: {}, layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'lock', label: 'Lock', action: 'lock', roles: ['sales.manager'] }] } };
    const shown = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').some((b) => b.text() === 'Lock' && b.isVisible());
    const wrapper = mount(FieldiaForm, { props: { page: lock, user: { id: 4, roles: ['sales.user'] } }, attachTo: document.body });
    expect(shown(wrapper)).toBe(false);
    await wrapper.setProps({ user: { id: 5, roles: ['sales.manager'] } });
    await nextTick();
    expect(shown(wrapper)).toBe(true);
    wrapper.unmount();
  });

  it('switches skin without mounting again', async () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('survey'), skin: 'underline' }, attachTo: document.body });
    await wrapper.setProps({ skin: 'outlined' });
    expect(wrapper.find('.fd-form').attributes('data-fd-skin')).toBe('outlined');
    expect(wrapper.emitted('ready')).toHaveLength(1);
    wrapper.unmount();
  });

  it('renders a custom field written in Vue, both ways', async () => {
    const wrapper = mount(FieldiaForm, { props: { page: custom, fieldTypes: { 'char.shout': Shout } }, attachTo: document.body });
    await nextTick();
    const input = wrapper.find('input[aria-label="nickname"]');
    await input.setValue('hello');
    const handle = handleOf(wrapper)!;
    expect(handle.form.getState().values['nickname']).toBe('hello');
    expect(wrapper.find('output').text()).toBe('HELLO!');
    handle.form.setValue('nickname', 'from outside');
    await nextTick();
    expect((wrapper.find('input[aria-label="nickname"]').element as HTMLInputElement).value).toBe('from outside');
    wrapper.unmount();
  });

  it('fills a slot from a Vue named slot that keeps its own state', async () => {
    const wrapper = mount(FieldiaForm, {
      props: { page: custom, fieldTypes: { 'char.shout': Shout } },
      slots: { note: ({ form }: { form: Form }) => h(Note, { form }) },
      attachTo: document.body,
    });
    await nextTick();
    const button = () => wrapper.findAll('button').find((b) => b.text().startsWith('Clicked'))!;
    await button().trigger('click');
    expect(button().text()).toBe('Clicked 1 time');
    handleOf(wrapper)!.form.setValue('nickname', 'Sam');
    await nextTick();
    expect(wrapper.find('[data-test="seen"]').text()).toBe('Sam');
    wrapper.unmount();
  });

  it('passes button presses on to @action, and takes what it answers', async () => {
    const pressed: ActionRequest[] = [];
    const wrapper = mount(FieldiaForm, { props: { page: page('customer'), onAction: (request: ActionRequest) => void pressed.push(request) }, attachTo: document.body });
    await handleOf(wrapper)!.form.runAction('sales');
    expect(pressed[0]).toMatchObject({ action: 'open_sales' });
    wrapper.unmount();
    // Declared in a template as `@action`, an answer that sets a value.
    const Parent = defineComponent({
      setup: () => () => h(FieldiaForm, { page: pricing, dataSource: createMemoryDataSource(), onAction: () => ({ values: { price: 380 } }) }),
    });
    const parent = mount(Parent, { attachTo: document.body });
    await parent.find('[data-node="price"]').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((parent.find('[data-node="f-price"] input').element as HTMLInputElement).value).toBe('380.00');
    parent.unmount();
  });

  it('draws the pager and the breadcrumbs it is given, and emits each record the form shows', async () => {
    const wrapper = mount(FieldiaForm, { props: { page: staffPage, dataSource: staff(), recordId: 1, records: [1, 2], breadcrumbs: [{ label: 'Employees' }] }, attachTo: document.body });
    await waitFor(() => wrapper.find('.fd-crumb-current').exists() && wrapper.find('.fd-crumb-current').text() === 'Mona Adel');
    expect(wrapper.find('.fd-record-pager-text').text()).toBe('1 / 2');
    await wrapper.find('[aria-label="Next record"]').trigger('click');
    await waitFor(() => wrapper.emitted('record')?.length === 2);
    expect(wrapper.emitted('record')?.map(([event]) => (event as { recordId: unknown }).recordId)).toEqual([1, 2]);
    wrapper.unmount();
  });

  it('emits the form’s events: change, run, save, send and step', async () => {
    const wrapper = mount(FieldiaForm, { props: { page: pricing, dataSource: createMemoryDataSource(), onAction: () => ({ values: { price: 380 } }) }, attachTo: document.body });
    const product = wrapper.find('[data-node="f-product"] input');
    (product.element as HTMLInputElement).value = 'Desk lamp';
    await product.trigger('input');
    await wrapper.find('[data-node="price"]').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.emitted('change')?.map(([event]) => [(event as { field: string }).field, (event as { by: string }).by])).toEqual([
      ['product', 'person'],
      ['price', 'step'],
    ]);
    expect(wrapper.emitted('run')?.[0]?.[0]).toMatchObject({ id: 'price', result: { done: true } });
    await handleOf(wrapper)!.save();
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ values: { product: 'Desk lamp', price: 380 } });
    wrapper.unmount();
    const sending = mount(FieldiaForm, { props: { page: { ...pricing, data: { kind: 'responses' } }, dataSource: createMemoryDataSource() }, attachTo: document.body });
    await handleOf(sending)!.save();
    expect(sending.emitted('send')?.[0]?.[0]).toEqual({ values: { product: null, price: null } });
    sending.unmount();
    const survey = mount(FieldiaForm, { props: { page: page('survey') }, attachTo: document.body });
    await handleOf(survey)!.form.settled();
    expect(survey.emitted('step')?.[0]?.[0]).toEqual({ step: 'step-about' });
    survey.unmount();
  });

  it('passes a list’s opened row on as an openRecord event', async () => {
    const dataSource = createMemoryDataSource({ records: { partner: { 7: { name: 'Delta Foods' } } } });
    const wrapper = mount(FieldiaForm, { props: { page: page('customers'), dataSource }, attachTo: document.body });
    for (let waited = 0; !wrapper.find('.fd-list-row').exists() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
    await wrapper.find('.fd-list-row td:nth-child(2)').trigger('click');
    expect(wrapper.emitted('openRecord')?.[0]?.[0]).toBe(7);
    wrapper.unmount();
  });

  it('uses a form made elsewhere', async () => {
    const shared = createForm({ page: page('survey') });
    const wrapper = mount(FieldiaForm, { props: { page: shared.page, form: shared }, attachTo: document.body });
    shared.setValue('name', 'Shared');
    await nextTick();
    expect((wrapper.find('[data-node="q-name"] input').element as HTMLInputElement).value).toBe('Shared');
    wrapper.unmount();
  });

  it('hands widgets the preference store it is given', () => {
    const seen: unknown[] = [];
    const store = { get: () => null, set: () => undefined };
    const spy = (context: { preferences?: unknown; document: Document }) => {
      seen.push(context.preferences);
      return { element: context.document.createElement('div'), update: () => undefined };
    };
    const wrapper = mount(FieldiaForm, { props: { page: custom, widgets: { 'char.shout': spy as never }, preferences: store }, attachTo: document.body });
    expect(seen[0]).toBe(store);
    wrapper.unmount();
  });

  it('lets links open records of the related pages it is given', () => {
    const seen: boolean[] = [];
    const spy = (context: { dialogs?: { canOpen(model: string): boolean }; document: Document }) => {
      seen.push(context.dialogs?.canOpen('partner') ?? false);
      return { element: context.document.createElement('div'), update: () => undefined };
    };
    const wrapper = mount(FieldiaForm, { props: { page: custom, widgets: { 'char.shout': spy as never }, relatedPages: { partner: page('customer') } }, attachTo: document.body });
    expect(seen[0]).toBe(true);
    wrapper.unmount();
  });

  it('draws a saved form placed in the page from the pages it is given', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('delivery'), pages: { address: page('address') } }, attachTo: document.body });
    const part = document.querySelector('[data-node="delivery-address"]') as HTMLElement;
    expect(part.querySelector('legend')?.textContent).toBe('Delivery address');
    expect(part.querySelector('[data-node="street"] .fd-label')?.textContent).toBe('Street and number');
    wrapper.unmount();
  });

  it('draws the app’s own icons it is given', () => {
    const p = page('customer');
    (p.layout as any).statButtons[0].icon = 'rocket';
    const wrapper = mount(FieldiaForm, { props: { page: p, icons: { rocket: '<path d="M12 2v20"/>' } }, attachTo: document.body });
    expect(document.querySelector('[data-node="sales"] svg')?.getAttribute('data-icon')).toBe('rocket');
    wrapper.unmount();
  });

  it('passes its keys on: Enter moves to the next field when asked', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('signup'), keys: { enterMovesToNext: true } }, attachTo: document.body });
    const name = document.querySelector('[data-node="f-name"] input') as HTMLInputElement;
    name.focus();
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(document.querySelector('[data-node="f-email"] input'));
    wrapper.unmount();
  });

  it('locks and unlocks the form as its readonly changes', async () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('signup'), readonly: true }, attachTo: document.body });
    const name = () => document.querySelector('[data-node="f-name"] input') as HTMLInputElement;
    expect(name().readOnly).toBe(true);
    await wrapper.setProps({ readonly: false });
    expect(name().readOnly).toBe(false);
    wrapper.unmount();
  });

  it('shows the page in the app’s own words', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('signup'), translate: (text: string) => (text === 'Full name' ? 'Nom complet' : text) }, attachTo: document.body });
    expect(document.querySelector('[data-node="f-name"] .fd-label')?.textContent).toBe('Nom complet');
    wrapper.unmount();
  });

  it('cleans up when it unmounts', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('survey') }, attachTo: document.body });
    const host = wrapper.element as HTMLElement;
    wrapper.unmount();
    expect(host.querySelector?.('.fd-form') ?? null).toBeNull();
    expect(document.querySelector('.fd-form')).toBeNull();
  });
});
