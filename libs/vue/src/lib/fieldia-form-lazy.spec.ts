import { mount } from '@vue/test-utils';
import type { Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { datePart } from '@fieldia/widgets';
import { defineComponent, h, nextTick, type PropType } from 'vue';
import { FieldiaForm } from './fieldia-form';

/**
 * Before its parts have come (parts.ts in @fieldia/widgets): a page with a
 * date is drawn once the date part has come, after the component mounted —
 * and its fields written in Vue and its named slots are rendered then, never
 * left out. This file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const visit: Page = {
  fieldia: '0.1',
  id: 'visit',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' }, day: { type: 'date', label: 'Day' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname', widget: 'shout' },
      { type: 'field', id: 'f-day', field: 'day' },
      { type: 'slot', id: 'note', name: 'note' },
    ],
  },
} as Page;

const Shout = defineComponent({
  props: { value: null, id: String, onChange: { type: Function as PropType<(v: unknown) => void>, required: true } },
  setup(props) {
    return () => h('input', { id: props.id, 'aria-label': 'nickname', value: (props.value as string) ?? '', onInput: (e: Event) => props.onChange((e.target as HTMLInputElement).value || null) });
  },
});

describe('<FieldiaForm> for Vue, before its parts have come', () => {
  it('renders its Vue fields and named slots once a page that waited for its date part is drawn', async () => {
    expect(datePart.loaded).toBeUndefined();
    const wrapper = mount(FieldiaForm, {
      props: { page: visit, fieldTypes: { 'char.shout': Shout } },
      slots: { note: () => h('p', { 'data-test': 'note' }, 'A note') },
      attachTo: document.body,
    });
    await nextTick();
    const handle = wrapper.emitted('ready')?.[0]?.[0] as ViewerHandle;
    // Nothing of the page yet: it waits for the date part.
    expect(wrapper.find('[data-node]').exists()).toBe(false);
    await handle.drawn;
    await nextTick();
    expect(wrapper.find('[data-node="f-day"] .fd-date-pick').exists()).toBe(true);
    expect(wrapper.find('[data-node="note"] [data-test="note"]').exists()).toBe(true);
    expect(wrapper.find('[data-node="f-nickname"] input[aria-label="nickname"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
