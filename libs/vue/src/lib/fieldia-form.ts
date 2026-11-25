import type { DataSource, DraftStore, Field, FieldNode, Form, FormEvents, FormState, FormUser, Locale, OnAction, Page, PageLink, RecordId, Scheduler, Theme, Value, Values } from '@fieldia/core';
import { mountViewer, newestFunctions, skinFor, type ListViewFactory, type MapPartFactory, type Skin, type SlotRenderer, type Tokens, type ViewerEvents, type ViewerHandle, type ViewerLabels, type ViewerOptions } from '@fieldia/viewer';
import { firstPaint as drawFirstPaint, type FirstPaintOptions } from '@fieldia/viewer/server';
import type { PreferenceStore, WidgetContext, WidgetFactory, WidgetState } from '@fieldia/widgets';
import {
  computed,
  defineComponent,
  getCurrentScope,
  h,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  onScopeDispose,
  onUpdated,
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
  /** Said when what it renders throws: the viewer shows the field's or the slot's box, and tells onError. */
  fail?: (error: unknown) => void;
  /** Said each time what it renders is on the page: a field's component says the value it drew. */
  drew?: () => void;
}

/**
 * An app's component kept to its place: one that throws as it renders — or a slot's content that throws as it is
 * asked for — says so through `fail`, and renders nothing more; the error goes no further up Vue's tree.
 */
const Contained = defineComponent({
  name: 'FieldiaContained',
  props: {
    render: { type: Function as PropType<() => VNodeChild>, required: true },
    fail: { type: Function as PropType<(error: unknown) => void>, default: undefined },
    drew: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const failed = ref(false);
    // Drawn, and on the page: said after Vue has patched it, unless what it rendered threw.
    const drawn = () => {
      if (!failed.value) props.drew?.();
    };
    onMounted(drawn);
    onUpdated(drawn);
    const fail = (error: unknown) => {
      if (failed.value) return;
      failed.value = true;
      props.fail?.(error);
    };
    onErrorCaptured((error) => {
      fail(error);
      return false;
    });
    return () => {
      if (failed.value) return null;
      try {
        return props.render();
      } catch (error) {
        fail(error);
        return null;
      }
    };
  },
});

/** The form's events, each emitted under its own name. */
const EVENTS = ['change', 'save', 'send', 'step', 'run', 'archive', 'duplicate', 'delete', 'draft', 'loadingstart', 'loadingend'] as const;

const EMPTY_STATE: WidgetState = { value: undefined, values: {}, readonly: false, required: false, invalid: false };

export const FieldiaForm = defineComponent({
  name: 'FieldiaForm',
  props: {
    page: { type: Object as PropType<Page>, required: true },
    form: { type: Object as PropType<Form>, default: undefined },
    dataSource: { type: Object as PropType<DataSource>, default: undefined },
    recordId: { type: [String, Number] as PropType<RecordId | null>, default: null },
    /** The person using the form: what `user` reads, and the roles that show parts. */
    user: { type: Object as PropType<FormUser>, default: undefined },
    /** Values the app passes in, as Flectra's context: what conditions and filters read as `context`. */
    context: { type: Object as PropType<ViewerOptions['context']>, default: undefined },
    /** The app's own functions, which the page's expressions call by name: each call reaches the newest given. */
    functions: { type: Object as PropType<ViewerOptions['functions']>, default: undefined },
    values: { type: Object as PropType<Values>, default: undefined },
    /**
     * The form's first paint, rendered with the component — on the server too, as Nuxt renders it — from the page and
     * these values (the record as the server loaded it): plain HTML in Fieldia's look, which the viewer mounts over once
     * it is drawn, keeping what was typed in it meanwhile. `true` paints `values`. Read once, as the component is made.
     */
    firstPaint: { type: [Boolean, Object] as PropType<boolean | Omit<FirstPaintOptions, 'skin' | 'locale' | 'dir' | 'nonce'>>, default: undefined },
    /** The skin — underline, outlined or quiet: the page's own when left out, else its theme's, else underline. */
    skin: { type: String as PropType<Skin>, default: undefined },
    /** A theme in the style of a known design system, over the page's own. */
    theme: { type: String as PropType<Theme>, default: undefined },
    /** The host's own colours, corners and font, over everything else (`TOKEN_NAMES`). */
    tokens: { type: Object as PropType<Tokens>, default: undefined },
    /** The page's Content-Security-Policy nonce: every <style> Fieldia adds carries it (the viewer's `nonce`). */
    nonce: { type: String, default: undefined },
    dir: { type: String as PropType<'ltr' | 'rtl'>, default: undefined },
    locale: { type: String as PropType<Locale>, default: undefined },
    labels: { type: Object as PropType<Partial<ViewerLabels>>, default: undefined },
    widgets: { type: Object as PropType<Record<string, WidgetFactory>>, default: undefined },
    /** Other ways a list shows its records: `map` from @fieldia/map's `mapListViews`. */
    listViews: { type: Object as PropType<Record<string, ListViewFactory>>, default: undefined },
    /** Draws the page's maps: @fieldia/map's mapParts. */
    maps: { type: Function as PropType<MapPartFactory>, default: undefined },
    fieldTypes: { type: Object as PropType<Record<string, Component>>, default: undefined },
    drafts: { type: Object as PropType<{ store: DraftStore; restore?: 'auto' | 'ask'; delayMs?: number }>, default: undefined },
    /** A draft kept on the app's server to continue from, by its key: what the link Continue later gave carries. */
    resume: { type: String, default: undefined },
    /** The respondent's own seed, for a page that draws its questions' order or some of them: the same seed, the same draw. */
    seed: { type: String, default: undefined },
    /**
     * The link the page is opened with, for a page that fills fields from it (`prefill`): its address, its `?…` part, or
     * its parameters by name — what a server-rendered or embedded app knows the browser's address bar may not show. Left
     * out, the browser's own address.
     */
    url: { type: [String, Object] as PropType<PageLink>, default: undefined },
    autosave: { type: Object as PropType<{ delayMs: number }>, default: undefined },
    scheduler: { type: Object as PropType<Scheduler>, default: undefined },
    confirm: { type: Function as PropType<ViewerOptions['confirm']>, default: undefined },
    preferences: { type: Object as PropType<PreferenceStore>, default: undefined },
    /** The app's pages: a saved form placed in the page by its id, a link's record by its model. */
    pages: { type: [Object, Function] as PropType<ViewerOptions['pages']>, default: undefined },
    relatedPages: { type: [Object, Function] as PropType<ViewerOptions['relatedPages']>, default: undefined },
    icons: { type: Object as PropType<ViewerOptions['icons']>, default: undefined },
    keys: { type: Object as PropType<ViewerOptions['keys']>, default: undefined },
    showValid: { type: Boolean, default: false },
    saveStatus: { type: String as PropType<ViewerOptions['saveStatus']>, default: undefined },
    /**
     * How every wait looks — drawn the first time, asked again, the next rows, a search, a save — its looks, timing and a
     * failure's way, with the app's own drawing in `custom` (`loading`): Fieldia's defaults when left out.
     */
    loading: { type: Object as PropType<ViewerOptions['loading']>, default: undefined },
    readonly: { type: Boolean, default: false },
    editSwitch: { type: Boolean, default: false },
    /** The browser's Back, Reload or a closed tab ask first while the person's work is at risk (`warnOnLeave`). */
    warnOnLeave: { type: Boolean, default: false },
    translate: { type: Function as PropType<ViewerOptions['translate']>, default: undefined },
    /**
     * A button's app action, or a `call` step: `@action="…"` as before, and what
     * it returns — values, words, a page to open, a stop — the form takes. A
     * prop rather than an event, so its answer comes back.
     */
    onAction: { type: Function as PropType<OnAction>, default: undefined },
    /**
     * Told when a part of the page throws — a field's component, a slot's content, the app's widget, a map — which then
     * shows a small box that names it, the rest of the form working on: `@error="…"`, or `:on-error`.
     */
    onError: { type: Function as PropType<ViewerOptions['onError']>, default: undefined },
    /** Your own way to open a page a step asks for; undefined lets the viewer open it. */
    onOpen: { type: Function as PropType<ViewerOptions['onOpen']>, default: undefined },
    /** Any of the viewer's host done your own way: words said, a question asked, a page opened, a tab shown. */
    host: { type: Object as PropType<ViewerOptions['host']>, default: undefined },
    /** The records round this one, for the pager over it: their ids, or how many, where this one is, and the id at a place. */
    records: { type: [Array, Object] as PropType<ViewerOptions['records']>, default: undefined },
    /** The trail to this record, for the breadcrumbs over it. */
    breadcrumbs: { type: Array as PropType<ViewerOptions['breadcrumbs']>, default: undefined },
    /** While the app is being made: a refused page shows what is wrong under its visitor's words (ViewerOptions.development). */
    development: { type: Boolean, default: undefined },
  },
  emits: {
    ready: (_handle: ViewerHandle) => true,
    /** A list's row was opened: the app shows the record. */
    openRecord: (_id: RecordId) => true,
    /** A field was written — `by` a person, a step or the app. */
    change: (_event: FormEvents['change']) => true,
    /** A record was saved. */
    save: (_event: FormEvents['save']) => true,
    /** A page of responses sent its answers. */
    send: (_event: FormEvents['send']) => true,
    /** A wizard's step was entered. */
    step: (_event: FormEvents['step']) => true,
    /** A run of steps ended — a button's, a moment's — and how. */
    run: (_event: FormEvents['run']) => true,
    /** The form has its values: a record loaded — the pager moved on, a copy shown — or a new one. */
    record: (_event: FormEvents['open']) => true,
    /** The record was archived or brought back, copied, or deleted, by a step such as the gear menu's. */
    archive: (_event: FormEvents['archive']) => true,
    duplicate: (_event: FormEvents['duplicate']) => true,
    delete: (_event: FormEvents['delete']) => true,
    /** A draft was kept on the app's server (`saveDraft`): its key, and whether Continue later was pressed. */
    draft: (_event: FormEvents['draft']) => true,
    /** A wait began and ended (`loading`): its moment, its part, how long and whether it failed, for the app's own indicator. */
    loadingstart: (_event: ViewerEvents['loadingstart']) => true,
    loadingend: (_event: ViewerEvents['loadingend']) => true,
  },
  setup(props, { slots, emit, expose }) {
    const host = ref<HTMLElement>();
    const portals = shallowRef<Portal[]>([]);
    let handle: ViewerHandle | null = null;
    // The first paint, drawn once — the same HTML on the server and as the client hydrates it — then the viewer's to replace.
    const asked = props.firstPaint;
    const skin = props.skin ?? props.page.look?.skin;
    const painted = asked ? drawFirstPaint(toRaw(props.page), { values: props.values ? toRaw(props.values) : undefined, ...(asked === true ? {} : toRaw(asked)), ...(skin ? { skin } : {}), locale: props.locale, dir: props.dir, nonce: props.nonce }) : undefined;

    function mount() {
      const element = host.value;
      if (!element) return;
      const found: Portal[] = [];
      let mounted = false;
      /** A field or slot of Vue's: rendered at once, or — drawn after mounting, as a page that waited for its parts is — as it comes. */
      const add = (portal: Portal) => {
        found.push(portal);
        if (mounted) portals.value = [...found];
      };

      const widgets: Record<string, WidgetFactory> = { ...props.widgets };
      for (const key of Object.keys(props.fieldTypes ?? {})) {
        widgets[key] = (context: WidgetContext) => {
          const box = context.document.createElement('div');
          box.className = 'fd-custom';
          const state = shallowRef<WidgetState>(EMPTY_STATE);
          add({
            key: `field:${context.node.id}`,
            element: box,
            fail: context.fail,
            // What it drew: a component that throws on the person's next change puts this back.
            drew: () => context.drew?.(state.value.value),
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
          add({ key: `slot:${name}:${found.length}`, element: box, fail: context.fail, render: () => slots[name]?.({ form: context.form, name }) });
        };
      }

      try {
        handle = mountViewer(element, {
          page: props.page,
          form: props.form,
          dataSource: props.dataSource,
          recordId: props.recordId,
          user: props.user,
          context: props.context ? toRaw(props.context) : undefined,
          functions: newestFunctions(() => (props.functions ? toRaw(props.functions) : undefined)),
          values: props.values,
          skin: props.skin,
          theme: props.theme,
          tokens: props.tokens,
          nonce: props.nonce,
          dir: props.dir,
          locale: props.locale,
          labels: props.labels,
          widgets,
          listViews: props.listViews ? toRaw(props.listViews) : undefined,
          maps: props.maps,
          slots: slotRenderers,
          drafts: props.drafts,
          resume: props.resume,
          seed: props.seed,
          url: props.url && typeof props.url === 'object' ? toRaw(props.url) : props.url,
          autosave: props.autosave,
          scheduler: props.scheduler,
          confirm: props.confirm,
          // The app's own store, not Vue's reactive copy of it.
          preferences: props.preferences ? toRaw(props.preferences) : undefined,
          pages: props.pages ? toRaw(props.pages) : undefined,
          relatedPages: props.relatedPages ? toRaw(props.relatedPages) : undefined,
          icons: props.icons ? toRaw(props.icons) : undefined,
          keys: props.keys ? toRaw(props.keys) : undefined,
          showValid: props.showValid,
          saveStatus: props.saveStatus,
          // The app's own settings and drawing, not Vue's reactive copy of them.
          loading: props.loading ? toRaw(props.loading) : undefined,
          readonly: props.readonly,
          editSwitch: props.editSwitch,
          warnOnLeave: props.warnOnLeave,
          translate: props.translate,
          onAction: (request) => props.onAction?.(request),
          onError: (error, where) => props.onError?.(error, where),
          onOpen: props.onOpen,
          host: props.host ? toRaw(props.host) : undefined,
          onOpenRecord: (id) => emit('openRecord', id),
          records: props.records ? toRaw(props.records) : undefined,
          breadcrumbs: props.breadcrumbs ? toRaw(props.breadcrumbs) : undefined,
          development: props.development,
        });
      } catch {
        // A page the viewer refused: it said why where the form would be and told `onError` (refused.ts in
        // @fieldia/viewer); the app goes on, never unmounted by it.
        handle = null;
        return;
      }
      for (const event of EVENTS) handle.on(event, (payload) => (emit as (event: string, payload: unknown) => void)(event, payload));
      handle.on('open', (payload) => emit('record', payload));
      portals.value = [...found];
      mounted = true;
      emit('ready', handle);
    }

    function unmount() {
      handle?.destroy();
      handle = null;
      portals.value = [];
      // A refused page's words go with it: the next page is drawn in their place.
      for (const words of host.value?.querySelectorAll(':scope > .fd-unshown') ?? []) words.remove();
    }

    onMounted(mount);
    onBeforeUnmount(unmount);
    // The app's functions' names alone: a new object with the same names is called through, never mounted again.
    const functionNames = computed(() => Object.keys(props.functions ?? {}).join('|'));
    watch(
      () => [props.page, props.form, props.dataSource, props.recordId, props.resume, props.seed, JSON.stringify(props.url ?? null), JSON.stringify(props.user ?? null), JSON.stringify(props.context ?? null), props.dir, props.locale, JSON.stringify(props.labels ?? {}), functionNames.value],
      () => {
        unmount();
        mount();
      }
    );
    // The host's tokens, worn in place as its app changes them.
    watch(
      () => props.tokens,
      (tokens) => handle?.setTokens(tokens ?? null),
      { deep: true }
    );
    // A theme and a skin switch in place: the theme brings its skin, unless one is given here or by the page.
    watch(
      () => [props.skin, props.theme],
      () => {
        if (!handle) return;
        const theme = props.theme ?? props.page.look?.theme;
        handle.setTheme(theme ?? null);
        handle.setSkin(skinFor(props.skin ?? props.page.look?.skin, theme));
      }
    );
    watch(
      () => props.readonly,
      (readonly) => handle?.setReadonly(readonly)
    );
    expose({
      get handle() {
        return handle;
      },
    });

    return () => [
      h('div', painted ? { ref: host, innerHTML: painted } : { ref: host }),
      ...portals.value.map((portal) => h(Teleport, { to: portal.element, key: portal.key }, [h(Contained, { render: portal.render, fail: portal.fail, drew: portal.drew })])),
    ];
  },
});
