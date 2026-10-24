import { saveRefused, type DataSource, type Page, type RecordId, type SaveProblem, type SubmitResult } from '@fieldia/core';
import type { FieldiaFormElement } from './element';
import { ownLocale, viewerWords } from './labels';
import type { mountViewer, ViewerHandle, ViewerOptions } from './viewer';

/** What draws a form: the viewer's `mountViewer`, handed over by the element (the main script's, in the one-tag script). */
export type Mount = typeof mountViewer;

/** The attributes `<fieldia-form>` reads; a change of one draws the form again (a theme or a skin, in place). */
const FORM_ATTRIBUTES = ['src', 'locale', 'theme', 'skin', 'record', 'action', 'resume', 'frame'];

/** What a `<fieldia-form>` holds once drawn: its viewer, what it was drawn from, and what stops what it listens to. */
interface Drawn {
  handle: ViewerHandle | null;
  /** The drawing on its way: a later one wins. */
  turn: number;
  stop: (() => void)[];
}

const drawn = new WeakMap<FieldiaFormElement, Drawn>();

/** The viewer drawing an element's form, once drawn. */
export const handleOf = (element: FieldiaFormElement): ViewerHandle | null => drawn.get(element)?.handle ?? null;

/** An element's attribute, or what its frame's address says for it (`locale`, `theme`, `skin`) where it has `frame`. */
function setting(element: FieldiaFormElement, name: string): string | null {
  const own = element.getAttribute(name);
  if (own !== null || !element.hasAttribute('frame')) return own;
  if (name !== 'locale' && name !== 'theme' && name !== 'skin') return null;
  const search = element.ownerDocument.defaultView?.location.search ?? '';
  return new URLSearchParams(search).get(name);
}

/** A record's id as an attribute writes it: a whole number as a number, anything else as its words. */
const recordOf = (text: string | null): RecordId | null => (text === null || text === '' ? null : /^\d+$/.test(text) ? Number(text) : text);

/** A server's answer read as JSON: nothing where it is empty or no JSON. */
function readJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * A data source for an `action`: each response posted to that address as JSON — `{ pageId, values, bot?, verified?,
 * payment?, draft? }` — and its answer read as JSON: a 2xx with the reference it gave (`{ id, values }`, or nothing); a
 * refusal with `{ message, fields? }` said as the form says any refused send (under its fields, or as the server's own
 * words); a network failure as one, its answers kept.
 */
export function actionSource(action: string, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): DataSource {
  return {
    async submit(request) {
      const answer = await fetcher(action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(request), credentials: 'same-origin' });
      const text = await answer.text();
      const body = readJson(text);
      if (answer.ok) return body && typeof body === 'object' ? (body as SubmitResult) : {};
      const said = body as { message?: unknown; fields?: unknown } | null;
      const fields = said && said.fields && typeof said.fields === 'object' ? (said.fields as Record<string, string>) : undefined;
      const message = typeof said?.message === 'string' && said.message ? said.message : `${answer.status} ${answer.statusText}`.trim();
      const problem: SaveProblem = fields ? { kind: 'fields', message, fields } : answer.status >= 500 ? { kind: 'other', message } : { kind: 'rule', message };
      throw saveRefused(problem);
    },
  };
}

/** A site as `allowed-origins` names it — "https://partner.example/" is https://partner.example — or "*". */
const originOf = (written: string) => {
  try {
    return written === '*' ? written : new URL(written).origin;
  } catch {
    return written;
  }
};

/** The frames told once that the page round them is not one the form may tell anything. */
const unheard = new WeakSet<FieldiaFormElement>();

/**
 * Say something to the page round the frame: its height, and what the form did — to the page that placed the frame
 * alone, where it said which it is (`fieldia-origin`, as fieldia-embed.js passes it), and only where that is this page's
 * own site or one the element names in `allowed-origins` ("https://partner.example https://shop.example"; "*" for any
 * site, never so unless written). Any other is told nothing, its height neither — said once in the console.
 */
function toFrame(element: FieldiaFormElement, message: Record<string, unknown>) {
  const win = element.ownerDocument.defaultView;
  if (!win || win.parent === win) return;
  const params = new URLSearchParams(win.location.search);
  const own = win.location.origin;
  const asked = params.get('fieldia-origin') ?? '';
  const allowed = (element.getAttribute('allowed-origins') ?? '').split(/\s+/).filter(Boolean).map(originOf);
  const to = asked || (allowed.includes('*') ? '*' : own);
  if (to !== own && !allowed.includes('*') && !allowed.includes(to)) {
    if (!unheard.has(element)) console.warn(`Fieldia: this form is framed by ${to || 'a page that did not say its site'}, which its allowed-origins does not name: that page is told nothing of it, its height neither.`);
    unheard.add(element);
    return;
  }
  const { type, ...told } = message;
  win.parent.postMessage({ fieldia: type, frame: params.get('fieldia-frame') ?? '', ...told }, to);
}

/** In a frame: the form's height told as it changes, so the frame grows and shrinks with it. */
function reportHeight(element: FieldiaFormElement): () => void {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win || win.parent === win) return () => undefined;
  let last = -1;
  const tell = () => {
    const height = Math.ceil(doc.documentElement.getBoundingClientRect().height);
    if (height === last) return;
    last = height;
    toFrame(element, { type: 'height', height });
  };
  const Observer = (win as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const observer = Observer ? new Observer(tell) : null;
  observer?.observe(doc.documentElement);
  observer?.observe(element);
  tell();
  return () => observer?.disconnect();
}

/** What the form did, told as an event that bubbles from the element — and, in a frame, to the page round it. */
function tell(element: FieldiaFormElement, type: string, detail: Record<string, unknown>) {
  element.dispatchEvent(new CustomEvent(`fieldia-${type}`, { bubbles: true, composed: true, detail }));
  // The page round a frame is told what happened — never the answers themselves: they are the app's.
  const { values: _answers, ...told } = detail;
  if (element.hasAttribute('frame')) toFrame(element, { type, ...told });
}

/** The page an element draws: given whole, or fetched from its `src` (JSON). */
async function pageOf(element: FieldiaFormElement): Promise<Page> {
  if (element.page) return element.page;
  const src = element.getAttribute('src');
  if (!src) throw new Error('<fieldia-form> needs a page: its src, or its page property');
  const answer = await fetch(new URL(src, element.ownerDocument.baseURI).href, { headers: { Accept: 'application/json' } });
  if (!answer.ok) throw new Error(`${src}: ${answer.status} ${answer.statusText}`.trim());
  return (await answer.json()) as Page;
}

/** Draw an element's form: what it was drawn from before let go; a drawing overtaken by a later one lays nothing. */
async function draw(element: FieldiaFormElement, mount: Mount) {
  const kept = drawn.get(element) ?? { handle: null, turn: 0, stop: [] };
  drawn.set(element, kept);
  const turn = ++kept.turn;
  letGo(kept);
  element.setAttribute('aria-busy', 'true');
  try {
    const page = await pageOf(element);
    if (turn !== kept.turn || !element.isConnected) return;
    element.replaceChildren();
    const action = element.getAttribute('action');
    const source = element.source ?? (action ? actionSource(new URL(action, element.ownerDocument.baseURI).href) : undefined);
    const record = recordOf(element.getAttribute('record'));
    const options: ViewerOptions = {
      ...element.options,
      page,
      ...(source ? { dataSource: source } : {}),
      ...(record !== null ? { recordId: record } : {}),
      ...(element.getAttribute('resume') ? { resume: element.getAttribute('resume') as string } : {}),
      ...(setting(element, 'locale') ? { locale: setting(element, 'locale') as string } : {}),
      ...(setting(element, 'theme') ? { theme: setting(element, 'theme') as ViewerOptions['theme'] } : {}),
      ...(setting(element, 'skin') ? { skin: setting(element, 'skin') as ViewerOptions['skin'] } : {}),
    };
    const host = element.ownerDocument.createElement('div');
    element.append(host);
    const handle = mount(host, options);
    kept.handle = handle;
    kept.stop.push(
      handle.on('send', (event) => tell(element, 'send', { id: handle.form.getState().sent?.id ?? null, values: event.values })),
      handle.on('save', (event) => tell(element, 'save', { recordId: event.recordId })),
      handle.on('step', (event) => tell(element, 'step', { step: event.step }))
    );
    if (element.hasAttribute('frame')) kept.stop.push(reportHeight(element));
    await handle.drawn;
    if (turn !== kept.turn) return;
    element.removeAttribute('aria-busy');
    tell(element, 'ready', { page: page.id });
  } catch (error) {
    if (turn !== kept.turn) return;
    element.removeAttribute('aria-busy');
    const words = viewerWords(ownLocale(setting(element, 'locale') ?? undefined), element.options.labels);
    const box = element.ownerDocument.createElement('p');
    box.className = 'fd-element-broken';
    box.setAttribute('role', 'alert');
    box.textContent = words.formNotLoaded;
    element.replaceChildren(box);
    tell(element, 'error', { message: error instanceof Error ? error.message : String(error) });
  }
}

/** What an element listened to and drew, let go. */
function letGo(kept: Drawn) {
  for (const stop of kept.stop.splice(0)) stop();
  kept.handle?.destroy();
  kept.handle = null;
}

/** What each element was given — its page, its source, its options — once its part came (`upgrade`). */
const given = new WeakMap<FieldiaFormElement, { page: Page | null; source: DataSource | null; options: Partial<ViewerOptions> }>();
const held = (element: FieldiaFormElement) => given.get(element) ?? given.set(element, { page: null, source: null, options: {} }).get(element)!;
/** The stubs made what they are: their prototypes, given their properties once. */
const upgraded = new WeakSet<object>();

/**
 * The element's stub (element.ts) made what it is, in place: `page`, `source` and `options` — set after, its form drawn
 * again — and `handle`; what was set on it before its part came, kept.
 */
function upgrade(element: FieldiaFormElement, mount: Mount) {
  const proto = Object.getPrototypeOf(element) as object;
  if (!upgraded.has(proto)) {
    upgraded.add(proto);
    for (const key of ['page', 'source', 'options'] as const)
      Object.defineProperty(proto, key, {
        configurable: true,
        get(this: FieldiaFormElement) {
          return held(this)[key];
        },
        set(this: FieldiaFormElement, value: never) {
          held(this)[key] = key === 'options' ? ((value ?? {}) as never) : value;
          changed(this, mount);
        },
      });
    Object.defineProperty(proto, 'handle', {
      configurable: true,
      get(this: FieldiaFormElement) {
        return handleOf(this);
      },
    });
  }
  // Set on it before its part came: an own property, taken in.
  for (const key of ['page', 'source', 'options'] as const) {
    if (!Object.prototype.hasOwnProperty.call(element, key)) continue;
    const value = element[key];
    delete (element as Partial<FieldiaFormElement>)[key];
    held(element)[key] = (key === 'options' ? (value ?? {}) : value) as never;
  }
}

/** Each element's watch on its attributes while it is on a page. */
const watching = new WeakMap<FieldiaFormElement, { disconnect(): void }>();

/** An element put on a page: made what it is, its attributes watched, its form drawn. */
export function connect(element: FieldiaFormElement, mount: Mount): void {
  upgrade(element, mount);
  if (!element.isConnected) return;
  const Observer = element.ownerDocument.defaultView?.MutationObserver;
  if (Observer && !watching.has(element)) {
    const observer = new Observer((changes) => {
      for (const name of new Set(changes.map((change) => change.attributeName as string))) changed(element, mount, name);
    });
    observer.observe(element, { attributes: true, attributeFilter: FORM_ATTRIBUTES });
    watching.set(element, observer);
  }
  void draw(element, mount);
}

/** An element taken off the page: its form let go, its attributes no longer watched. */
export function disconnect(element: FieldiaFormElement): void {
  watching.get(element)?.disconnect();
  watching.delete(element);
  const kept = drawn.get(element);
  if (!kept) return;
  kept.turn++;
  letGo(kept);
}

/** An attribute or a property changed: a theme or a skin worn in place, anything else drawn again. */
export function changed(element: FieldiaFormElement, mount: Mount, name?: string): void {
  if (!element.isConnected) return;
  const handle = handleOf(element);
  if (handle && name === 'theme') return handle.setTheme((setting(element, 'theme') as Parameters<ViewerHandle['setTheme']>[0]) ?? null);
  if (handle && name === 'skin' && setting(element, 'skin')) return handle.setSkin(setting(element, 'skin') as Parameters<ViewerHandle['setSkin']>[0]);
  void draw(element, mount);
}
