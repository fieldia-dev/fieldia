import type { ActionRequest, DataSource, DraftStore, Field, FieldNode, Form, FormState, Locale, Page, RecordId, Scheduler, Value, Values } from '@fieldia/core';
import { mountViewer, type Skin, type SlotRenderer, type ViewerHandle, type ViewerLabels, type ViewerOptions } from '@fieldia/viewer';
import type { PreferenceStore, WidgetContext, WidgetFactory, WidgetState } from '@fieldia/widgets';
import {
  defineComponent,
  getCurrentScope,
  h,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  Teleport,
  toRaw,
  watch,
  type Component,
  type PropType,
  type ShallowRef,
  type VNodeChild,
} from 'vue';

/**
 * `<FieldiaForm>` — the Vue shell. Thin in the same way as the React one:
 * `mountViewer` makes every decision; this component owns an element Vue
 * never renders into, prop changes forwarded without mounting again, custom
 * fields and slots rendered into the viewer through `<Teleport>`, and teardown.
 *
 * Custom fields come in as Vue components (`fieldTypes`); slot content comes
 * in as Vue named slots: `<template #chatter="{ form }">…</template>`.
 */

/** What a custom field component receives. Call `onChange` to write the value. */
export interface FieldComponentProps extends Omit<WidgetState, 'value'> {
  value: Value | undefined;
  name: string;
  field: Field;
  node: FieldNode;
  id: string;
  form: Form;
  onChange(value: Value): void;
}

/** A form's state as a Vue ref, current on every change. */
export function useFormState(form: Form): ShallowRef<FormState> {
  const state = shallowRef(form.getState());
  const leave = form.subscribe((next) => (state.value = next));
  if (getCurrentScope()) onScopeDispose(leave);
  return state;
}

interface Portal {
  key: string;
  element: HTMLElement;
  render: () => VNodeChild;
}

const EMPTY_STATE: WidgetState = { value: undefined, values: {}, readonly: false, required: false, invalid: false };

export const FieldiaForm = defineComponent({
  name: 'FieldiaForm',
  props: {
    page: { type: Object as PropType<Page>, required: true },
    form: { type: Object as PropType<Form>, default: undefined },
    dataSource: { type: Object as PropType<DataSource>, default: undefined },
    recordId: { type: [String, Number] as PropType<RecordId | null>, default: null },
    values: { type: Object as PropType<Values>, default: undefined },
    skin: { type: String as PropType<Skin>, default: 'underline' },
    dir: { type: String as PropType<'ltr' | 'rtl'>, default: undefined },
    locale: { type: String as PropType<Locale>, default: undefined },
    labels: { type: Object as PropType<Partial<ViewerLabels>>, default: undefined },
    widgets: { type: Object as PropType<Record<string, WidgetFactory>>, default: undefined },
    fieldTypes: { type: Object as PropType<Record<string, Component>>, default: undefined },
    drafts: { type: Object as PropType<{ store: DraftStore; restore?: 'auto' | 'ask'; delayMs?: number }>, default: undefined },
    autosave: { type: Object as PropType<{ delayMs: number }>, default: undefined },
    scheduler: { type: Object as PropType<Scheduler>, default: undefined },
    confirm: { type: Function as PropType<(message: string) => Promise<boolean>>, default: undefined },
    preferences: { type: Object as PropType<PreferenceStore>, default: undefined },
    relatedPages: { type: [Object, Function] as PropType<ViewerOptions['relatedPages']>, default: undefined },
  },
  emits: {
    ready: (_handle: ViewerHandle) => true,
    action: (_request: ActionRequest) => true,
  },
  setup(props, { slots, emit, expose }) {
    const host = ref<HTMLElement>();
    const portals = shallowRef<Portal[]>([]);
    let handle: ViewerHandle | null = null;

    function mount() {
      const element = host.value;
      if (!element) return;
      const found: Portal[] = [];

      const widgets: Record<string, WidgetFactory> = { ...props.widgets };
      for (const key of Object.keys(props.fieldTypes ?? {})) {
        widgets[key] = (context: WidgetContext) => {
          const box = context.document.createElement('div');
          box.className = 'fd-custom';
          const state = shallowRef<WidgetState>(EMPTY_STATE);
          found.push({
            key: `field:${context.node.id}`,
            element: box,
            render: () => {
              const component = props.fieldTypes?.[key];
              return component
                ? h(component, {
                    ...state.value,
                    name: context.name,
                    field: context.field,
                    node: context.node,
                    id: context.id,
                    form: context.form,
                    onChange: (value: Value) => context.form.setValue(context.name, value),
                  })
                : null;
            },
          });
          return {
            element: box,
            update: (next) => (state.value = next),
            focus: () => box.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus(),
          };
        };
      }

      const slotRenderers: Record<string, SlotRenderer> = {};
      for (const name of Object.keys(slots)) {
        if (name === 'default') continue;
        slotRenderers[name] = (box, context) => {
          found.push({ key: `slot:${name}:${found.length}`, element: box, render: () => slots[name]?.({ form: context.form, name }) });
        };
      }

      handle = mountViewer(element, {
        page: props.page,
        form: props.form,
        dataSource: props.dataSource,
        recordId: props.recordId,
        values: props.values,
        skin: props.skin,
        dir: props.dir,
        locale: props.locale,
        labels: props.labels,
        widgets,
        slots: slotRenderers,
        drafts: props.drafts,
        autosave: props.autosave,
        scheduler: props.scheduler,
        confirm: props.confirm,
        // The app's own store, not Vue's reactive copy of it.
        preferences: props.preferences ? toRaw(props.preferences) : undefined,
        relatedPages: props.relatedPages ? toRaw(props.relatedPages) : undefined,
        onAction: (request) => emit('action', request),
      });
      portals.value = found;
      emit('ready', handle);
    }

    function unmount() {
      handle?.destroy();
      handle = null;
      portals.value = [];
    }

    onMounted(mount);
    onBeforeUnmount(unmount);
    watch(
      () => [props.page, props.form, props.dataSource, props.recordId, props.dir, props.locale, JSON.stringify(props.labels ?? {})],
      () => {
        unmount();
        mount();
      }
    );
    watch(
      () => props.skin,
      (skin) => handle?.setSkin(skin ?? 'underline')
    );
    expose({
      get handle() {
        return handle;
      },
    });

    return () => [
      h('div', { ref: host }),
      ...portals.value.map((portal) => h(Teleport, { to: portal.element, key: portal.key }, [portal.render()])),
    ];
  },
});
