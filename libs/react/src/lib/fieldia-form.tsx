import type { Field, FieldNode, Form, FormEvents, FormState, Value } from '@fieldia/core';
import { mountViewer, newestFunctions, skinFor, type SlotRenderer, type ViewerEvents, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import { firstPaint as drawFirstPaint, type FirstPaintOptions } from '@fieldia/viewer/server';
import type { WidgetContext, WidgetFactory, WidgetState } from '@fieldia/widgets';
import {
  Component as ReactComponent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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
 * `mountViewer` runs only in an effect, so the component renders on a server. Given `firstPaint`, it renders the form's
 * first paint there too — its values in plain HTML, styled — which the client hydrates as it is and the viewer then
 * mounts over (`@fieldia/viewer/server`): a Next page shows the form before any script has run.
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
  /**
   * The form's first paint, rendered with the component — on the server too, as Next renders a client component —
   * from the page and these values (the record as the server loaded it): plain HTML in Fieldia's look, which the viewer
   * mounts over once it is drawn, keeping what was typed in it meanwhile. `true` paints `values`. Read once, as the
   * component first renders. See `firstPaint` in `@fieldia/viewer/server`.
   */
  firstPaint?: boolean | Omit<FirstPaintOptions, 'skin' | 'locale' | 'dir' | 'nonce'>;
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
  /** A draft was kept on the app's server (`saveDraft`): its key, and whether Continue later was pressed. */
  onDraft?: (event: FormEvents['draft']) => void;
  /**
   * A wait began and ended — a record, a list's rows, a search, a save (`loading`): its moment, its part, how long it
   * took and whether it failed — for the app's own indicator. How each wait looks is the `loading` prop's, with the
   * app's own drawing in `loading.custom`.
   */
  onLoadingStart?: (event: ViewerEvents['loadingstart']) => void;
  onLoadingEnd?: (event: ViewerEvents['loadingend']) => void;
}

/** The form's events a prop hears, by the prop's name. */
const EVENTS = { onChange: 'change', onSave: 'save', onSend: 'send', onStep: 'step', onRun: 'run', onRecord: 'open', onArchive: 'archive', onDuplicate: 'duplicate', onDelete: 'delete', onDraft: 'draft', onLoadingStart: 'loadingstart', onLoadingEnd: 'loadingend' } as const;

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
  // What it drew, once React has put it on the page: a component that throws on the person's next change puts this back.
  useLayoutEffect(() => context.drew?.(state.value));
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

/**
 * An app's component kept to its place: one that throws as it renders says so through `fail` — the viewer then shows
 * the small box that names its field or slot, and tells onError — and renders nothing more. Without it React would
 * take down the whole tree under the nearest boundary: the form with it.
 */
class Contained extends ReactComponent<{ fail?: (error: unknown) => void; children?: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    this.props.fail?.(error);
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

const EMPTY_STATE: WidgetState = { value: undefined, values: {}, readonly: false, required: false, invalid: false };

export const FieldiaForm = forwardRef<ViewerHandle | null, FieldiaFormProps>(function FieldiaForm(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [handle, setHandle] = useState<ViewerHandle | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  useImperativeHandle(ref, () => handle as ViewerHandle, [handle]);
  // The first paint, drawn once — the same HTML on the server and as the client hydrates it — then the viewer's to replace.
  const [painted] = useState(() => {
    const asked = props.firstPaint;
    if (!asked) return null;
    const given = asked === true ? {} : asked;
    const skin = props.skin ?? props.page.look?.skin;
    return { __html: drawFirstPaint(props.page, { values: props.values, ...given, ...(skin ? { skin } : {}), locale: props.locale, dir: props.dir, nonce: props.nonce }) };
  });

  // Mount again only when the record or what the page is changes. Callbacks
  // and components are read through `latest`, so a new function each render
  // costs nothing.
  const fieldKeys = Object.keys(props.fieldTypes ?? {}).join('|');
  const slotKeys = Object.keys(props.slots ?? {}).join('|');
  const labelsKey = JSON.stringify(props.labels ?? {});
  // A different person may see different parts: the form is made again for them.
  const userKey = JSON.stringify(props.user ?? null);
  // The link the page is opened with (`url`, for its `prefill`): a new one starts the form from it again.
  const urlKey = JSON.stringify(props.url ?? null);
  // Other values from the app (its context) may filter and show other things: made again for them too.
  const contextKey = JSON.stringify(props.context ?? null);
  // The app's functions are called as they are each render; a function named or no longer named makes the form again.
  const functionKeys = Object.keys(props.functions ?? {}).join('|');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const found: Portal[] = [];
    let live = false;
    /** A field or slot of React's: rendered at once, or — drawn after mounting, as a page that waited for its parts is — as it comes. */
    const add = (portal: Portal) => {
      found.push(portal);
      if (live) setPortals([...found]);
    };

    const widgets: Record<string, WidgetFactory> = { ...latest.current.widgets };
    for (const key of Object.keys(latest.current.fieldTypes ?? {})) {
      widgets[key] = (context) => {
        const box = context.document.createElement('div');
        box.className = 'fd-custom';
        const state = store<WidgetState>(EMPTY_STATE);
        add({
          key: `field:${context.node.id}`,
          element: box,
          node: (
            <Contained fail={context.fail}>
              <CustomField state={state} context={context} component={() => latest.current.fieldTypes?.[key]} />
            </Contained>
          ),
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
        add({
          key: `slot:${name}:${found.length}`,
          element: box,
          node: (
            <Contained fail={context.fail}>
              <SlotContent name={name} form={context.form} component={() => latest.current.slots?.[name]} />
            </Contained>
          ),
        });
      };
    }

    const { fieldTypes: _fields, slots: _slots, className: _class, style: _style, firstPaint: _paint, onReady: _ready, onChange: _change, onSave: _save, onSend: _send, onStep: _step, onRun: _run, onRecord: _record, onArchive: _archive, onDuplicate: _duplicate, onDelete: _delete, onDraft: _draft, onLoadingStart: _started, onLoadingEnd: _ended, ...options } = latest.current;
    let mounted: ViewerHandle;
    try {
      mounted = mountViewer(element, {
        ...options,
        functions: newestFunctions(() => latest.current.functions),
        widgets,
        slots,
        // The newest handler; what it answers — values, words, a page, a stop — the form takes.
        onAction: (request) => latest.current.onAction?.(request),
        // The newest handler, as for actions: told of a part that failed.
        onError: (error, where) => latest.current.onError?.(error, where),
        // The newest handler, as for actions; rows look openable only when there is one.
        onOpenRecord: options.onOpenRecord && ((id, name) => latest.current.onOpenRecord?.(id, name)),
        // A page a step opens: the newest way of the app's, else the viewer's.
        onOpen: (request) => latest.current.onOpen?.(request),
      });
    } catch {
      // A page the viewer refused: it said why where the form would be and told `onError` (refused.ts in
      // @fieldia/viewer). The app goes on — never unmounted by it — and the next page is drawn in the words' place.
      return () => {
        for (const words of element.querySelectorAll(':scope > .fd-unshown')) words.remove();
      };
    }
    // Each event through the newest handler, as for actions.
    for (const [prop, event] of Object.entries(EVENTS) as [keyof typeof EVENTS, keyof ViewerEvents][]) {
      mounted.on(event, (payload) => (latest.current[prop] as ((event: unknown) => void) | undefined)?.(payload));
    }
    setHandle(mounted);
    setPortals([...found]);
    live = true;
    latest.current.onReady?.(mounted);
    return () => {
      live = false;
      mounted.destroy();
      // A page refused once the checks it waited for came (its `drawn` rejected): its words go with it too.
      for (const words of element.querySelectorAll(':scope > .fd-unshown')) words.remove();
      setHandle(null);
      setPortals([]);
    };
    // A draft's key (`resume`) opens that draft, as a record's id opens that record; a respondent's seed draws theirs.
  }, [props.page, props.form, props.dataSource, props.recordId, props.resume, props.seed, urlKey, userKey, contextKey, props.dir, labelsKey, fieldKeys, slotKeys, functionKeys]);

  // A theme and a skin switch in place: the theme brings its skin, unless one is given here or by the page.
  useEffect(() => {
    if (!handle) return;
    const theme = props.theme ?? props.page.look?.theme;
    handle.setTheme(theme ?? null);
    handle.setSkin(skinFor(props.skin ?? props.page.look?.skin, theme));
  }, [handle, props.skin, props.theme]);

  // The host's tokens, worn in place as its app changes them (light to dark): by their values, not the object.
  const tokensKey = JSON.stringify(props.tokens ?? null);
  useEffect(() => {
    if (handle) handle.setTokens(props.tokens ?? null);
  }, [handle, tokensKey]);

  // Locked or not, the same viewer: only a change of `readonly` is forwarded, so Edit inside it keeps working.
  useEffect(() => {
    if (handle && props.readonly !== undefined && handle.isReadonly() !== props.readonly) handle.setReadonly(props.readonly);
  }, [handle, props.readonly]);

  return (
    <>
      <div ref={host} className={props.className} style={props.style} {...(painted ? { dangerouslySetInnerHTML: painted, suppressHydrationWarning: true } : {})} />
      {portals.map((portal) => createPortal(portal.node, portal.element, portal.key))}
    </>
  );
});
