import { createMemoryDataSource, LOADING_DEFAULTS, LOADING_TECHNIQUES, LOADING_VARIANTS, type DataSource, type LoadingMoment, type Page, type PageLoading, type RecordId, type Theme, type Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import type { LoadingDrawing, LoadingEvent, LoadingOptions } from '@fieldia/widgets';
import customersPage from '../../examples/pages/loading-customers.page.json';
import customerPage from '../../examples/pages/loading-customer.page.json';
import { demoListViews } from '../shared/maps';

/**
 * Loading, as you like it: a wholesaler's customers beside one customer, on a data source as slow as a bad network,
 * and a panel to say how each moment waits — drawn the first time, asked again, the next rows, a search, a save — its
 * looks, its timing and what a failure shows. The panel sets the viewer's `loading` option (the app's), so every form on
 * the page waits the same way; Custom is the app's own drawing. "Fail the next answer" makes the source's next answer
 * fail, to see Retry. The same customer is shown again under two themes, each wearing its own shapes. The app's own
 * indicator — the bar along the page's top — listens to the viewer's `loadingstart` and `loadingend`.
 *
 * The query string says the starting point, for the tests and for a link: `?first=spinner&refresh=dim&more=skeleton&
 * search=spinner&action=overlay&skeleton=pulse&spinner=dots&error=toast&delay=150&minShown=300&timeout=4000&slow=1500&
 * customer=3&scheme=dark&dir=rtl`. `slow=0` answers at once; `dir=rtl` draws the forms right to left. `hold=1` holds
 * every answer until it is let go (`fieldiaDemo.release()`), so a test looks at a wait while it is certain to be one,
 * however long the page took to open. Sample data.
 */

const params = new URLSearchParams(location.search);
const scheme = params.get('scheme') === 'dark' ? 'dark' : params.get('scheme') === 'light' ? 'light' : 'auto';
const dir = params.get('dir') === 'rtl' ? 'rtl' : undefined;
const withLook = (page: unknown): Page => ({ ...(page as Page), look: { ...(page as Page).look, scheme } });
const listPage = withLook(customersPage);
const recordPage = withLook(customerPage);

// ---- the sample data: customers across Egypt, their account managers and invoices ----------------------------------

const CITIES = {
  cairo: [30.0444, 31.2357],
  giza: [30.0131, 31.2089],
  alexandria: [31.2001, 29.9187],
  mansoura: [31.0409, 31.3785],
  aswan: [24.0889, 32.8998],
} as const;
const FIRST = ['Nile', 'Delta', 'Pyramid', 'Red Sea', 'Sinai', 'Lotus', 'Horus', 'Isis', 'Memphis', 'Karnak', 'Siwa', 'Oasis'];
const SECOND = ['Traders', 'Foods', 'Pharma', 'Textiles', 'Motors'];
const MANAGERS = ['Mona Adel', 'Omar Said', 'Sara Fathy', 'Karim Nabil', 'Laila Hassan', 'Youssef Ali', 'Nour Ibrahim', 'Hana Mostafa', 'Tarek Fouad', 'Dina Samir'];
const STATUSES = ['active', 'active', 'prospect', 'active', 'paused'] as const;

const users = Object.fromEntries(MANAGERS.map((name, i) => [i + 1, { name }]));
const customers: Record<number, Values> = {};
const invoices: Record<number, Values> = {};
let invoice = 0;
FIRST.forEach((first, i) =>
  SECOND.forEach((second, j) => {
    const id = i * SECOND.length + j + 1;
    const city = (Object.keys(CITIES) as (keyof typeof CITIES)[])[(i + j) % 5];
    const [lat, lng] = CITIES[city];
    customers[id] = {
      name: `${first} ${second}`,
      city,
      status: STATUSES[(i * 3 + j) % STATUSES.length],
      manager_id: { id: (id % MANAGERS.length) + 1, label: MANAGERS[id % MANAGERS.length] },
      phone: `+20 10 ${String(1000 + id * 37).slice(-4)} ${String(2000 + id * 53).slice(-4)}`,
      // Spread round the city, as customers are.
      lat: lat + ((id * 7) % 11) / 300 - 0.015,
      lng: lng + ((id * 13) % 17) / 400 - 0.02,
      since: `20${String(15 + (id % 10)).padStart(2, '0')}-0${(id % 9) + 1}-1${id % 9}`,
      notes: id % 4 === 0 ? 'Pays on the first of the month. Prefers calls before noon.' : null,
    };
    for (let n = 0; n < id % 6; n++) {
      invoice++;
      invoices[invoice] = { number: `INV-${String(2400 + invoice).padStart(5, '0')}`, partner_id: { id, label: `${first} ${second}` }, date: `2026-${String((n % 9) + 1).padStart(2, '0')}-${String(10 + n).padStart(2, '0')}`, amount: 1200 + ((invoice * 997) % 48000), state: ['paid', 'due', 'draft'][invoice % 3] };
    }
  })
);
const memory = createMemoryDataSource({ records: { customer: customers, user: users, invoice: invoices } });

// ---- a network as slow as you like, and an answer that fails when asked to ----------------------------------------

/**
 * How slow the network is now (milliseconds a source's answer takes), whether its next answer fails, and whether its
 * answers are held until they are let go (`hold`).
 */
const net = { slow: Number(params.get('slow') ?? 1500), failNext: false, hold: params.get('hold') === '1' };
const stopped = () => Object.assign(new Error('Stopped'), { name: 'AbortError' });
/** An answer held: what was asked (the source's member and its request), and how it is let go. */
interface Held {
  member: string;
  request: unknown;
  go: () => void;
}
/** The answers held now, in the order asked. */
const held: Held[] = [];
/** An answer held until it is let go — or its request stopped meanwhile (`signal`), which ends it as aborted. */
const holding = (member: string, request: unknown, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(stopped());
    const one: Held = {
      member,
      request,
      go: () => {
        signal?.removeEventListener('abort', stop);
        resolve();
      },
    };
    const stop = () => {
      const at = held.indexOf(one);
      if (at >= 0) held.splice(at, 1);
      reject(stopped());
    };
    held.push(one);
    signal?.addEventListener('abort', stop, { once: true });
  });
/**
 * The answers held now let go — every one, or those `which` picks (a list's first rows, not its next) — each then as
 * slow as the network is; how many. Those asked after are held too while `hold` is on.
 */
const release = (which: (ask: Omit<Held, 'go'>) => boolean = () => true) => {
  const now = held.filter((one) => which({ member: one.member, request: one.request }));
  for (const one of now) held.splice(held.indexOf(one), 1);
  for (const one of now) one.go();
  return now.length;
};
/** The source's members a person waits for: each answers after the network's delay, or fails when asked to. */
const ASKS = new Set(['load', 'list', 'search', 'groups', 'save', 'totals', 'options']);
const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Stopped'), { name: 'AbortError' }));
    });
  });
const dataSource = new Proxy(memory, {
  get(target, key, receiver) {
    const member = Reflect.get(target, key, receiver);
    if (typeof member !== 'function' || !ASKS.has(String(key))) return member;
    return async (...args: unknown[]) => {
      // A request a wait with a timeout carries a signal: honoured, as an app's own source may.
      const signal = (args[0] as { signal?: AbortSignal } | undefined)?.signal;
      if (net.hold) await holding(String(key), args[0], signal);
      if (net.slow) await pause(net.slow, signal);
      if (net.failNext) {
        net.failNext = false;
        drawNet();
        throw new Error('The server did not answer this once.');
      }
      return (member as (...given: unknown[]) => unknown).apply(target, args);
    };
  },
}) as DataSource;

// ---- how each moment waits: the panel's settings, the app's own drawing ---------------------------------------

const MOMENTS: { moment: LoadingMoment; name: string }[] = [
  { moment: 'first', name: 'Drawn the first time' },
  { moment: 'refresh', name: 'Asked again' },
  { moment: 'more', name: 'The next rows' },
  { moment: 'search', name: 'A search' },
  { moment: 'action', name: 'A save' },
];
const WAYS: Record<string, string> = {
  skeleton: 'Skeleton',
  spinner: 'Spinner',
  progress: 'Progress bar',
  text: 'Words',
  none: 'Nothing',
  custom: 'Custom (the app’s)',
  keep: 'Keep, a bar over it',
  dim: 'Dim',
  row: 'A row: Loading more…',
  inline: 'Searching… in the list',
  button: 'The button busy',
  bar: 'A bar along the top',
  overlay: 'Cover the form',
  shimmer: 'Shimmer',
  pulse: 'Pulse',
  static: 'Still',
  ring: 'Ring',
  dots: 'Dots',
  top: 'Along the top',
  inline_: 'Across the middle',
  failedInline: 'Said in its place',
  toast: 'A toast',
  failedCustom: 'Custom (the app’s)',
};
/** The panel's settings, from the address first. */
const settings: PageLoading = {};
for (const key of [...MOMENTS.map((one) => one.moment), 'skeleton', 'spinner', 'progress', 'error'] as const) {
  const given = params.get(key);
  if (given) (settings as Record<string, string>)[key] = given;
}
for (const key of ['delay', 'minShown', 'slowAfter', 'timeout'] as const) {
  const given = params.get(key);
  if (given !== null && given !== '') settings[key] = Number(given);
}

/** The app's own drawing, for a moment set to Custom: its words and its own bar; failed, its own words and Try again. */
function custom({ container, failed, slow, retry }: LoadingDrawing) {
  const box = document.createElement('div');
  box.className = 'ld-custom';
  if (failed) {
    box.setAttribute('data-failed', '');
    box.append('The warehouse did not answer.');
    if (retry) {
      const again = Object.assign(document.createElement('button'), { type: 'button', className: 'ld-button', textContent: 'Ask the warehouse again' });
      again.addEventListener('click', retry);
      box.append(again);
    }
  } else {
    const bar = document.createElement('span');
    bar.className = 'ld-custom-bar';
    bar.setAttribute('aria-hidden', 'true');
    box.append(slow ? 'Still asking the warehouse…' : 'Asking the warehouse…', bar);
  }
  container.append(box);
}

// ---- the page: the panel, the list beside the customer, the customer in two themes ------------------------------

const app = document.getElementById('app') as HTMLElement;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) => {
  const made = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  made.append(...children);
  return made;
};
const slowBox = el('input', { type: 'checkbox', id: 'ld-slow' }) as HTMLInputElement;
slowBox.checked = net.slow > 0;
const failButton = el('button', { type: 'button', class: 'ld-button', 'aria-pressed': 'false' }, 'Fail the next answer');
const againButton = el('button', { type: 'button', class: 'ld-button' }, 'Ask again');
const heardLine = el('p', { class: 'ld-heard', role: 'status' });
function drawNet() {
  failButton.setAttribute('aria-pressed', String(net.failNext));
}
slowBox.addEventListener('change', () => {
  net.slow = slowBox.checked ? 1500 : 0;
});
failButton.addEventListener('click', () => {
  net.failNext = !net.failNext;
  drawNet();
});

/** A choice of the panel's: a moment's way, a look or a failure's way, Fieldia's default marked. */
const pick = (key: keyof PageLoading, name: string, values: readonly string[]) => {
  const fallback = LOADING_DEFAULTS[key as keyof typeof LOADING_DEFAULTS] as string;
  const select = el('select', { 'data-setting': key }) as HTMLSelectElement;
  /** A value's words: the same value is a different way in another setting (`inline`: a search's, a bar's, a failure's). */
  const words = (value: string) => WAYS[key === 'progress' && value === 'inline' ? 'inline_' : key === 'error' && value !== 'toast' ? `failed${value[0].toUpperCase()}${value.slice(1)}` : value] ?? value;
  for (const value of values) select.append(el('option', { value }, `${words(value)}${value === fallback ? ' (default)' : ''}`));
  select.value = String(settings[key] ?? fallback);
  select.addEventListener('change', () => {
    (settings as Record<string, unknown>)[key] = select.value === fallback ? undefined : select.value;
    mountAll();
  });
  return el('label', { class: 'ld-pick' }, name, select);
};
const picks = el(
  'div',
  { class: 'ld-picks' },
  ...MOMENTS.map(({ moment, name }) => pick(moment, name, LOADING_TECHNIQUES[moment])),
  pick('skeleton', 'Skeleton', LOADING_VARIANTS.skeleton),
  pick('spinner', 'Spinner', LOADING_VARIANTS.spinner),
  pick('progress', 'Progress bar', LOADING_VARIANTS.progress),
  pick('error', 'A failure', ['inline', 'toast', 'custom'])
);
const panel = el(
  'section',
  { class: 'ld-panel', 'aria-label': 'How the page waits' },
  el('div', { class: 'ld-row' }, el('h2', {}, 'How the page waits'), el('label', { class: 'ld-net' }, slowBox, 'Slow network (1.5 s)'), failButton, againButton),
  picks,
  heardLine
);
const listHost = el('div');
const recordHost = el('div');
const twinHosts = [el('div'), el('div')];
const TWINS: Theme[] = ['material', 'fluent'];
const pane = (name: string, what: string, host: HTMLElement) => el('section', { class: 'ld-pane', 'aria-label': name }, el('h2', { class: 'ld-pane-name' }, name, ' ', el('span', {}, what)), host);
app.append(
  panel,
  el('div', { class: 'ld-work' }, pane('Customers', '— open one to see it beside the list', listHost), pane('Customer', '— this record', recordHost)),
  el('div', { class: 'ld-twins' }, pane('In Material', '— the same customer', twinHosts[0]), pane('In Fluent', '— the same customer', twinHosts[1]))
);

// ---- the app's own indicator and what it heard -----------------------------------------------------------------

const indicator = document.querySelector('.ld-indicator') as HTMLElement;
/** Every loadingstart and loadingend heard (and when, by the page's clock), newest last, and the waits going on: the app's own indicator. */
const heard: { start: boolean; event: LoadingEvent; at: number }[] = [];
let going = 0;
function hear(handle: ViewerHandle) {
  handle.on('loadingstart', (event) => {
    heard.push({ start: true, event, at: Date.now() });
    going++;
    indicator.toggleAttribute('data-on', going > 0);
  });
  handle.on('loadingend', (event) => {
    heard.push({ start: false, event, at: Date.now() });
    going = Math.max(0, going - 1);
    indicator.toggleAttribute('data-on', going > 0);
    heardLine.replaceChildren('The app heard: ', el('strong', {}, `${event.moment} of ${event.part}`), ` ended after ${Math.round(event.duration)} ms${event.failed ? ', failed' : ''}.`);
  });
}

// ---- mounting, and opening a customer ------------------------------------------------------------------------

let customer: RecordId = Number(params.get('customer') ?? 1);
const handles: { list?: ViewerHandle; record?: ViewerHandle; twins: ViewerHandle[] } = { twins: [] };
function mountAll() {
  handles.list?.destroy();
  handles.record?.destroy();
  for (const twin of handles.twins) twin.destroy();
  going = 0;
  indicator.removeAttribute('data-on');
  const loading: LoadingOptions = { ...settings, custom };
  handles.list = mountViewer(listHost, { page: listPage, dataSource, loading, dir, listViews: demoListViews, onOpenRecord: (id) => void openCustomer(id) });
  handles.record = mountViewer(recordHost, { page: recordPage, dataSource, loading, dir, recordId: customer });
  handles.twins = TWINS.map((theme, i) => mountViewer(twinHosts[i], { page: recordPage, dataSource, loading, dir, recordId: customer, theme, showActions: false }));
  for (const handle of [handles.list, handles.record, ...handles.twins]) hear(handle);
}
/** A customer opened from the list: the record beside it asked for the other one, as it is asked again. */
function openCustomer(id: RecordId) {
  customer = id;
  return Promise.all([handles.record, ...handles.twins].map((handle) => handle?.form.openRecord(id)));
}
againButton.addEventListener('click', () => void Promise.all([handles.list, handles.record, ...handles.twins].map((handle) => handle?.reload())));
mountAll();

/**
 * For the browser tests: the forms, the source, the network and what the app heard — and the answers held: `hold()`
 * holds every answer from now, `held` says how many wait now, `release(which?)` lets those go — or those it picks —
 * holding going on, `hold(false)` stops holding and lets every one go.
 */
(window as unknown as { fieldiaDemo: unknown }).fieldiaDemo = {
  get list() {
    return handles.list;
  },
  get record() {
    return handles.record;
  },
  get twins() {
    return handles.twins;
  },
  dataSource,
  net,
  heard,
  hold(on = true) {
    net.hold = on;
    if (!on) release();
  },
  get held() {
    return held.length;
  },
  release,
  settings,
  remount: mountAll,
};
