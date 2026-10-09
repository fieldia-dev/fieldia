import type { Field, FieldNode, Form, FormEvents, FormState, Value } from '@fieldia/core';
import { mountViewer, skinFor, type SlotRenderer, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import type { WidgetContext, WidgetFactory, WidgetState } from '@fieldia/widgets';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * `<FieldiaForm>` — the React shell.
 *
 * Deliberately thin, in the same sense as Quantia's React binding: every
 * decision a form makes lives in `mountViewer` and `createForm`, which are
 * framework-neutral and tested without React. This file owns four things:
 *
 *   1. a `<div>` React never renders into, handed to `mountViewer`,
 *   2. props forwarded onto the handle without mounting again,
 *   3. custom fields and slots written as React components, rendered into
 *      the viewer's own elements through portals,
 *   4. teardown.
 *
 * `mountViewer` runs only in an effect, so the component renders on a server.
 */

/** What a custom field component receives. Call `onChange` to write the value. */
export interface FieldComponentProps extends Omit<WidgetState, 'value'> {
  value: Value | undefined;
  name: string;
  field: Field;
  node: FieldNode;
  /** The id the field's label points at; put it on your input. */
  id: string;
  form: Form;
  onChange(value: Value): void;
}

export interface SlotComponentProps {
  form: Form;
  name: string;
}

export interface FieldiaFormProps extends Omit<ViewerOptions, 'slots'> {
  /** Custom fields as React components, by `type.widget` or `type`. */
  fieldTypes?: Record<string, ComponentType<FieldComponentProps>>;
  /** Slot content as React components, by slot name. */
  slots?: Record<string, ComponentType<SlotComponentProps>>;
  className?: string;
  style?: CSSProperties;
  /** Called once per mount with the viewer's handle. */
  onReady?: (handle: ViewerHandle) => void;
  /** A field was written — `by` a person, a step or the app. */
  onChange?: (event: FormEvents['change']) => void;
  /** A record was saved. */
  onSave?: (event: FormEvents['save']) => void;
  /** A page of responses sent its answers. */
  onSend?: (event: FormEvents['send']) => void;
  /** A wizard's step was entered. */
  onStep?: (event: FormEvents['step']) => void;
  /** A run of steps ended — a button's, a moment's — and how. */
  onRun?: (event: FormEvents['run']) => void;
  /** The form has its values: a record loaded — the pager moved on, a copy shown — or a new one. */
  onRecord?: (event: FormEvents['open']) => void;
  /** The record was archived or brought back by a step, such as the gear menu's Archive. */
  onArchive?: (event: FormEvents['archive']) => void;
  /** The record was copied by a step; the form shows the copy. */
  onDuplicate?: (event: FormEvents['duplicate']) => void;
  /** The record was deleted by a step. */
  onDelete?: (event: FormEvents['delete']) => void;
}

/** The form's events a prop hears, by the prop's name. */
const EVENTS = { onChange: 'change', onSave: 'save', onSend: 'send', onStep: 'step', onRun: 'run', onRecord: 'open', onArchive: 'archive', onDuplicate: 'duplicate', onDelete: 'delete' } as const;

/** A form's state as React state: the component re-renders on every change. */
export function useFormState(form: Form): FormState {
  return useSyncExternalStore(form.subscribe, form.getState, form.getState);
}

interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

function store<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface Portal {
  key: string;
  element: HTMLElement;
  node: ReactNode;
}

function CustomField(props: {
  state: Store<WidgetState>;
  context: WidgetContext;
  component: () => ComponentType<FieldComponentProps> | undefined;
}) {
  const state = useSyncExternalStore(props.state.subscribe, props.state.get, props.state.get);
  const Component = props.component();
  const { context } = props;
  if (!Component) return null;
  return (
    <Component
      {...state}
      name={context.name}
      field={context.field}
      node={context.node}
      id={context.id}
      form={context.form}
      onChange={(value) => context.form.setValue(context.name, value)}
    />
  );
}

function SlotContent(props: { name: string; form: Form; component: () => ComponentType<SlotComponentProps> | undefined }) {
  const Component = props.component();
  return Component ? <Component form={props.form} name={props.name} /> : null;
}

const EMPTY_STATE: WidgetState = { value: undefined, values: {}, readonly: false, required: false, invalid: false };

export const FieldiaForm = forwardRef<ViewerHandle | null, FieldiaFormProps>(function FieldiaForm(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [handle, setHandle] = useState<ViewerHandle | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  useImperativeHandle(ref, () => handle as ViewerHandle, [handle]);

  // Mount again only when the record or what the page is changes. Callbacks
  // and components are read through `latest`, so a new function each render
  // costs nothing.
  const fieldKeys = Object.keys(props.fieldTypes ?? {}).join('|');
  const slotKeys = Object.keys(props.slots ?? {}).join('|');
  const labelsKey = JSON.stringify(props.labels ?? {});
  // A different person may see different parts: the form is made again for them.
  const userKey = JSON.stringify(props.user ?? null);
  // Other values from the app (its context) may filter and show other things: made again for them too.
  const contextKey = JSON.stringify(props.context ?? null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const found: Portal[] = [];

    const widgets: Record<string, WidgetFactory> = { ...latest.current.widgets };
    for (const key of Object.keys(latest.current.fieldTypes ?? {})) {
      widgets[key] = (context) => {
        const box = context.document.createElement('div');
        box.className = 'fd-custom';
        const state = store<WidgetState>(EMPTY_STATE);
        found.push({
          key: `field:${context.node.id}`,
          element: box,
          node: <CustomField state={state} context={context} component={() => latest.current.fieldTypes?.[key]} />,
        });
        return {
          element: box,
          update: (next) => state.set(next),
          focus: () => box.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus(),
        };
      };
    }

    const slots: Record<string, SlotRenderer> = {};
    for (const name of Object.keys(latest.current.slots ?? {})) {
      slots[name] = (box, context) => {
        found.push({
          key: `slot:${name}:${found.length}`,
          element: box,
          node: <SlotContent name={name} form={context.form} component={() => latest.current.slots?.[name]} />,
        });
      };
    }

    const { fieldTypes: _fields, slots: _slots, className: _class, style: _style, onReady: _ready, onChange: _change, onSave: _save, onSend: _send, onStep: _step, onRun: _run, onRecord: _record, onArchive: _archive, onDuplicate: _duplicate, onDelete: _delete, ...options } = latest.current;
    const mounted = mountViewer(element, {
      ...options,
      widgets,
      slots,
      // The newest handler; what it answers — values, words, a page, a stop — the form takes.
      onAction: (request) => latest.current.onAction?.(request),
      // The newest handler, as for actions; rows look openable only when there is one.
      onOpenRecord: options.onOpenRecord && ((id) => latest.current.onOpenRecord?.(id)),
      // A page a step opens: the newest way of the app's, else the viewer's.
      onOpen: (request) => latest.current.onOpen?.(request),
    });
    // Each event through the newest handler, as for actions.
    for (const [prop, event] of Object.entries(EVENTS) as [keyof typeof EVENTS, keyof FormEvents][]) {
      mounted.on(event, (payload) => (latest.current[prop] as ((event: unknown) => void) | undefined)?.(payload));
    }
    setHandle(mounted);
    setPortals(found);
    latest.current.onReady?.(mounted);
    return () => {
      mounted.destroy();
      setHandle(null);
      setPortals([]);
    };
  }, [props.page, props.form, props.dataSource, props.recordId, userKey, contextKey, props.dir, labelsKey, fieldKeys, slotKeys]);

  // A theme and a skin switch in place: the theme brings its skin, unless one is given.
  useEffect(() => {
    if (!handle) return;
    const theme = props.theme ?? props.page.look?.theme;
    handle.setTheme(theme ?? null);
    handle.setSkin(skinFor(props.skin, theme));
  }, [handle, props.skin, props.theme]);

  // Locked or not, the same viewer: only a change of `readonly` is forwarded, so Edit inside it keeps working.
  useEffect(() => {
    if (handle && props.readonly !== undefined && handle.isReadonly() !== props.readonly) handle.setReadonly(props.readonly);
  }, [handle, props.readonly]);

  return (
    <>
      <div ref={host} className={props.className} style={props.style} />
      {portals.map((portal) => createPortal(portal.node, portal.element, portal.key))}
    </>
  );
});
