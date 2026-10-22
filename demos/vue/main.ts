import { FieldiaForm, useFormState } from '@fieldia/vue';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import { demoListViews, demoMaps, demoMapWidgets } from '../shared/maps';
import type { ActionRequest, Form, Locale, Theme, Value } from '@fieldia/core';
import type { Skin, ViewerHandle } from '@fieldia/viewer';
import { createApp, defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';
import { chatterSlot } from '@fieldia/chatter';
import { sampleChatter } from '../shared/sample-chatter';
import { buyerBar, enquiryChatterOptions } from '../shared/enquiry';
import { clicked, greeting, shout } from '../shared/custom-page';
import { appPages, openRecord, opensRows, optionsFromQuery, pageFromQuery, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { answerAction } from '../shared/order-desk';
import { addressFollowsRecord } from '../shared/address';
import { checkPrice, errorLog, loadPlanner, priceWords } from '../shared/contained';
import { meanwhileBar } from '../shared/test-drive';
import { lastPlacesBar } from '../shared/event-signup';
import { signedInBar } from '../shared/approvals';
import { frontDeskBar } from '../shared/treatment-course';

/** The same demo again, mounted by Vue with render functions. */
const params = new URLSearchParams(location.search);
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const actions: string[] = [];
/** Every button press in full, with the records chosen in a list. */
const requests: ActionRequest[] = [];

/** The badge field, as a Vue component. */
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
      h('p', { class: 'demo-hello' }, greeting(state.value.values['badge_name'])),
      h('button', { type: 'button', class: 'fd-button', onClick: () => clicks.value++ }, clicked(clicks.value)),
    ];
  },
});

/** The app's price tag, as a Vue component: it throws for a four-digit price, as it renders. */
const PriceTag = defineComponent({
  props: {
    value: { type: null as unknown as PropType<Value | undefined>, default: undefined },
    id: { type: String, required: true },
    readonly: Boolean,
    onChange: { type: Function as PropType<(value: Value) => void>, required: true },
  },
  setup(props) {
    return () => {
      checkPrice(props.value);
      return h('span', { class: 'demo-price' }, [
        h('input', {
          id: props.id,
          class: 'fd-input',
          inputmode: 'decimal',
          value: String(props.value ?? ''),
          readOnly: props.readonly,
          onInput: (event: Event) => {
            const text = (event.target as HTMLInputElement).value;
            props.onChange(text === '' ? null : Number(text));
          },
        }),
        h('output', priceWords(props.value)),
      ]);
    };
  },
});

/** The app's delivery planner, as a Vue component: it throws as it renders. */
const Planner = defineComponent({
  setup() {
    return () => loadPlanner();
  },
});

/** "A part that fails": what onError is told, listed under the form (shared/contained.ts). */
const failures = params.get('page') === 'contained' ? errorLog(document) : null;
if (failures) document.getElementById('app')?.after(failures.element);
// The test drive has a bar over it: someone else books a time on another screen (shared/test-drive.ts).
if (params.get('page') === 'test-drive') document.getElementById('app')?.before(meanwhileBar(dataSource));
// The sign-up has a bar over it: two people take the morning's last places on other screens (shared/event-signup.ts).
if (params.get('page') === 'event-signup') document.getElementById('app')?.before(lastPlacesBar(dataSource));
// A purchase order's and an expense's approvals: who uses the demo, and the others to sign in as (shared/approvals.ts).
const signedIn = signedInBar(params);
if (signedIn) document.getElementById('app')?.before(signedIn);
// The course has a bar over it: Mona at the front desk opens it and changes its price (shared/treatment-course.ts).
if (params.get('page') === 'treatment-course') document.getElementById('app')?.before(frontDeskBar(dataSource));

const chatter = sampleChatter();
// The enquiry has a bar over it: the buyer's phone reads what was sent and writes back (shared/enquiry.ts).
if (params.get('page') === 'enquiry') document.getElementById('app')?.before(buyerBar(chatter));

/** The chatter in a Vue slot: a box it mounts into, for as long as the slot lives. */
const Chatter = defineComponent({
  props: { form: { type: Object as PropType<Form>, required: true } },
  setup(props) {
    const box = ref<HTMLElement | null>(null);
    let done: (() => void) | undefined;
    onMounted(() => {
      if (box.value) done = chatterSlot({ source: chatter, ...enquiryChatterOptions(params), locale: (params.get('locale') as Locale | null) ?? undefined })(box.value, { form: props.form });
    });
    onBeforeUnmount(() => done?.());
    return () => h('div', { ref: box });
  },
});

createApp({
  render: () =>
    h(
      FieldiaForm,
      {
        page,
        dataSource,
        recordId: recordFromQuery(params, page),
        // A list changed in place has no record's page to open.
        ...(opensRows(params) ? { onOpenRecord: (id: string | number) => openRecord(params, id) } : {}),
        skin: (params.get('skin') as Skin | null) ?? undefined,
        theme: (params.get('theme') as Theme | null) ?? undefined,
        dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
        locale: (params.get('locale') as Locale | null) ?? undefined,
        fieldTypes: { 'char.name-badge': Shout, 'monetary.tag': PriceTag },
        onError: failures?.onError,
        widgets: { ...gridWidgets, ...codeWidgets, ...demoMapWidgets },
        listViews: demoListViews,
        maps: demoMaps,
        pages: appPages,
        ...optionsFromQuery(params),
        // `@action` in a template: what it returns — here the shop's answers to the pages' steps — the form takes.
        onAction: (request: ActionRequest) => {
          actions.push(request.action);
          requests.push(request);
          return answerAction(request, params.get('locale') ?? undefined, { page, source: dataSource });
        },
        onReady: (handle: ViewerHandle) => {
          Object.assign(window, { fieldiaDemo: { handle, dataSource, actions, requests, chatter } });
          // The address in step with the record shown (shared/address.ts).
          addressFollowsRecord(handle.form, page);
        },
      },
      {
        chatter: ({ form }: { form: Form }) => h(Chatter, { form }),
        note: ({ form }: { form: Form }) => h(Note, { form }),
        planner: () => h(Planner),
      }
    ),
}).mount('#app');
