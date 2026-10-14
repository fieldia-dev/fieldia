import { mount } from '@vue/test-utils';
import type { Form, Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { defineComponent, h, nextTick, ref } from 'vue';
import { FieldiaForm } from './fieldia-form';

/**
 * The app's own Vue components kept to their place: one that throws as it renders — a field's or a slot's — shows the
 * small box that names it, `onError` is told, and the rest of the form stays and works.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'vue-contained',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' }, price: { type: 'float', label: 'Price' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname' },
      { type: 'field', id: 'f-price', field: 'price', widget: 'fancy' },
      { type: 'slot', id: 'n-feed', name: 'feed' },
    ],
  },
};

/** Throws once its value is 13, as a component with a bug for one value would. */
const Fancy = defineComponent({
  props: { value: null, id: String },
  setup(props) {
    return () => {
      if (props.value === 13) throw new Error('thirteen');
      return h('input', { id: props.id, 'aria-label': 'price', readonly: true, value: String(props.value ?? '') });
    };
  },
});

const Feed = defineComponent({
  props: { form: { type: Object as () => Form, required: true } },
  setup() {
    const broken = ref(false);
    return () => {
      if (broken.value) throw new Error('the feed fell over');
      return h('button', { type: 'button', class: 'break', onClick: () => (broken.value = true) }, 'Break the feed');
    };
  },
});

let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  document.body.replaceChildren();
});

function show(onError: jest.Mock) {
  let handle: ViewerHandle | null = null;
  const wrapper = mount(FieldiaForm, {
    attachTo: document.body,
    props: { page, fieldTypes: { 'float.fancy': Fancy }, onError, onReady: (ready: ViewerHandle) => (handle = ready) },
    slots: { feed: ({ form }: { form: Form }) => h(Feed, { form }) },
  });
  return { wrapper, handle: () => handle as unknown as ViewerHandle };
}

describe('<FieldiaForm> with a component that throws', () => {
  it("as a field's component renders: its box takes its place, and the form stays and works", async () => {
    const onError = jest.fn();
    const { wrapper, handle } = show(onError);
    await nextTick();
    expect(document.querySelector('input[aria-label="price"]')).not.toBeNull();
    handle().form.setValue('price', 13);
    await nextTick();
    await nextTick();
    expect(document.querySelector('[data-node="f-price"] .fd-broken')?.textContent).toBe('This field could not be shown: Price');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'thirteen' }), expect.objectContaining({ stage: 'update', part: 'field', field: 'price' }));
    const nickname = document.querySelector('[data-node="f-nickname"] input') as HTMLInputElement;
    nickname.value = 'Sara';
    nickname.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handle().form.getState().values['nickname']).toBe('Sara');
    wrapper.unmount();
  });

  it("as a slot's component renders: its box shows in the slot, and the form stays", async () => {
    const onError = jest.fn();
    const { wrapper } = show(onError);
    await nextTick();
    (document.querySelector('[data-node="n-feed"] .break') as HTMLButtonElement).click();
    await nextTick();
    await nextTick();
    expect(document.querySelector('[data-node="n-feed"] .fd-broken')?.textContent).toBe('This part could not be shown');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'the feed fell over' }), expect.objectContaining({ part: 'slot', name: 'feed' }));
    expect(document.querySelector('[data-node="f-nickname"] input')).not.toBeNull();
    wrapper.unmount();
  });
});
