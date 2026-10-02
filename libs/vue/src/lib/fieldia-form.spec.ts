import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { createForm, type Form, type Page } from '@fieldia/core';
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

const handleOf = (wrapper: { emitted: (e: string) => unknown[][] | undefined }) => (wrapper.emitted('ready')?.[0]?.[0] ?? null) as ViewerHandle | null;

describe('<FieldiaForm> for Vue', () => {
  it('mounts the viewer into its own element', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('survey') }, attachTo: document.body });
    expect(wrapper.find('.fd-form').exists()).toBe(true);
    expect(wrapper.findAll('button').some((b) => b.text() === 'Next')).toBe(true);
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

  it('passes button presses on as an action event', async () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('customer') }, attachTo: document.body });
    await handleOf(wrapper)!.form.runAction('sales');
    expect(wrapper.emitted('action')?.[0]?.[0]).toMatchObject({ action: 'open_sales' });
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

  it('cleans up when it unmounts', () => {
    const wrapper = mount(FieldiaForm, { props: { page: page('survey') }, attachTo: document.body });
    const host = wrapper.element as HTMLElement;
    wrapper.unmount();
    expect(host.querySelector?.('.fd-form') ?? null).toBeNull();
    expect(document.querySelector('.fd-form')).toBeNull();
  });
});
