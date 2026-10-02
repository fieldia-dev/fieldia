import { FieldiaForm, useFormState } from '@fieldia/vue';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import type { Form, Locale, Value } from '@fieldia/core';
import type { Skin, ViewerHandle } from '@fieldia/viewer';
import { createApp, defineComponent, h, ref, type PropType } from 'vue';
import { clicked, greeting, shout } from '../shared/custom-page';
import { pageFromQuery, sampleDataSource, relatedPages } from '../shared/sample-data';

/** The same demo again, mounted by Vue with render functions. */
const params = new URLSearchParams(location.search);
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const actions: string[] = [];

/** The "shout" field, as a Vue component. */
const Shout = defineComponent({
  props: {
    value: { type: null as unknown as PropType<Value | undefined>, default: undefined },
    id: { type: String, required: true },
    readonly: Boolean,
    onChange: { type: Function as PropType<(value: Value) => void>, required: true },
  },
  setup(props) {
    return () =>
      h('span', { class: 'demo-shout' }, [
        h('input', {
          id: props.id,
          class: 'fd-input',
          value: String(props.value ?? ''),
          readOnly: props.readonly,
          onInput: (event: Event) => props.onChange((event.target as HTMLInputElement).value || null),
        }),
        h('output', shout(props.value)),
      ]);
  },
});

/** The "note" slot, as a Vue component with its own state. */
const Note = defineComponent({
  props: { form: { type: Object as PropType<Form>, required: true } },
  setup(props) {
    const clicks = ref(0);
    const state = useFormState(props.form);
    return () => [
      h('p', { class: 'demo-hello' }, greeting(state.value.values['nickname'])),
      h('button', { type: 'button', class: 'fd-button', onClick: () => clicks.value++ }, clicked(clicks.value)),
    ];
  },
});

const Activity = () =>
  h('div', { class: 'demo-feed' }, [
    h('h3', 'Activity'),
    h('p', [h('b', 'Mona Adel'), ' confirmed order SO0018.']),
    h('p', [h('b', 'You'), ' raised the credit limit to 250,000.']),
  ]);

createApp({
  render: () =>
    h(
      FieldiaForm,
      {
        page,
        dataSource,
        recordId: page.data.kind === 'record' ? 1 : null,
        skin: (params.get('skin') as Skin) ?? 'underline',
        dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
        locale: (params.get('locale') as Locale | null) ?? undefined,
        fieldTypes: { 'char.shout': Shout },
        widgets: { ...gridWidgets, ...codeWidgets },
        relatedPages,
        onAction: (request: { action: string }) => void actions.push(request.action),
        onReady: (handle: ViewerHandle) => Object.assign(window, { fieldiaDemo: { handle, dataSource, actions } }),
      },
      {
        chatter: () => h(Activity),
        note: ({ form }: { form: Form }) => h(Note, { form }),
      }
    ),
}).mount('#app');
