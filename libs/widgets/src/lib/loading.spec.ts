import { LOADING_DEFAULTS } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { asksLoadingPart, loadingOver, loadingPart, loadingSettings, loadingWay, startLoading, type Loading, type LoadingEvent } from './loading';
import { LOADING_CSS } from './styles-loading';
import { LOADING_PART_CSS } from './styles-loading-part';

/**
 * Waiting for an answer, the one machine (loading.ts): how its settings are resolved — Fieldia's, the app's, the
 * page's, the part's, the most specific winning — and its time, on a clock the test turns: nothing before the delay, a
 * loader kept its minimum, "Still loading…" when slow, a timeout ending it as failed; the region busy, said once,
 * told to the app; a failure said in place with Retry, in a toast, or by the app's drawing.
 */

const words = WIDGET_LABELS.en;
const loading = (over: Partial<Loading> & { set?: Parameters<typeof loadingSettings>[0] } = {}): Loading => ({ settings: loadingSettings(over.set), words, ...over });
const form = () => {
  document.body.replaceChildren();
  const root = document.createElement('form');
  root.className = 'fd-form';
  const region = document.createElement('div');
  region.setAttribute('data-node', 'customers');
  region.append(Object.assign(document.createElement('p'), { textContent: 'Nile Traders' }));
  root.append(region);
  document.body.append(root);
  return { root, region };
};
const loader = (region: HTMLElement) => region.querySelector<HTMLElement>('.fd-loader');
const said = (root: HTMLElement) => root.querySelector('.fd-loading-said')?.textContent ?? '';

describe('a wait’s settings', () => {
  it('are Fieldia’s where nobody says, then the app’s, the page’s and the part’s, each setting on its own', () => {
    expect(loadingSettings()).toEqual(LOADING_DEFAULTS);
    const app = { first: 'spinner', delay: 0, custom: () => undefined } as const;
    const page = { first: 'text', refresh: 'dim' } as const;
    const list = { refresh: 'skeleton', skeleton: 'pulse' } as const;
    const settled = loadingSettings(app, page, list);
    expect(settled).toMatchObject({ first: 'text', refresh: 'skeleton', skeleton: 'pulse', delay: 0, more: 'row', search: 'inline', action: 'button', minShown: 300 });
    expect('custom' in settled).toBe(false);
    expect(settled.timeout).toBeUndefined();
    // A part's over what it sits in: the same hooks and words.
    const told = jest.fn();
    const under = loading({ set: page, told });
    const own = loadingOver(under, list);
    expect(own.told).toBe(told);
    expect(own.settings.refresh).toBe('skeleton');
    expect(own.settings.first).toBe('text');
    expect(loadingOver(under, undefined)).toBe(under);
  });

  it('draws a moment’s default where it says custom and the app gave no drawing', () => {
    expect(loadingWay(loading({ set: { first: 'custom' } }), 'first')).toBe('skeleton');
    expect(loadingWay(loading({ set: { first: 'custom' }, custom: () => undefined }), 'first')).toBe('custom');
  });

  it('asks for the loading part where a way it draws is named: a skeleton, a bar, a spinner, the overlay — never for words', () => {
    expect(asksLoadingPart(undefined)).toBe(false);
    expect(asksLoadingPart({ first: 'text', refresh: 'dim', more: 'row', search: 'inline', action: 'button', delay: 0 })).toBe(false);
    expect(asksLoadingPart({ refresh: 'spinner' })).toBe(true);
    expect(asksLoadingPart({ action: 'overlay' })).toBe(true);
    expect(asksLoadingPart({ first: 'progress' })).toBe(true);
    expect(asksLoadingPart(LOADING_DEFAULTS)).toBe(true);
    expect(asksLoadingPart(LOADING_DEFAULTS, ['more', 'search', 'action'])).toBe(false);
  });

  it('draws a first wait as it says once the loading part has come — never in words first — its place as it is meanwhile', async () => {
    jest.useFakeTimers();
    try {
      await jest.isolateModulesAsync(async () => {
        const fresh = await import('./loading');
        const { region, root } = form();
        const shape = { show: jest.fn(), hide: jest.fn() };
        const wait = fresh.startLoading(region, 'first', loading(), { shape });
        // What is not there yet out of sight from the start: a form's boxes, where its own shapes will stand in them.
        expect(region.getAttribute('data-fd-coming')).toBe('boxes');
        jest.advanceTimersByTime(200);
        // Past its delay, its part still on its way: nothing drawn yet — no "Loading…" words to be swapped for shapes —
        // and a screen reader hears it.
        expect(loader(region)).toBeNull();
        expect(shape.show).not.toHaveBeenCalled();
        expect(region.hasAttribute('data-fd-wait')).toBe(false);
        expect(said(root)).toBe('Loading…');
        expect(wait.shown).toBe(false);
        await fresh.loadingPart.load();
        await Promise.resolve();
        expect(shape.show).toHaveBeenCalledTimes(1);
        expect(region.getAttribute('data-fd-way')).toBe('skeleton');
        expect(region.hasAttribute('data-fd-shaped')).toBe(true);
        expect(region.hasAttribute('data-fd-coming')).toBe(false);
        expect(wait.shown).toBe(true);
        wait.stop();
        expect(shape.hide).toHaveBeenCalledTimes(1);
        expect(said(root)).toBe('');
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('draws a first wait in words where its part is still on its way as it turns slow; an answer before then draws no loader', async () => {
    jest.useFakeTimers();
    try {
      await jest.isolateModulesAsync(async () => {
        const fresh = await import('./loading');
        const { region } = form();
        const wait = fresh.startLoading(region, 'first', loading({ set: { slowAfter: 1000 } }));
        expect(region.getAttribute('data-fd-coming')).toBe('all');
        jest.advanceTimersByTime(1000);
        expect(loader(region)?.getAttribute('data-way')).toBe('text');
        expect(loader(region)?.textContent).toBe('Loading…Still loading…');
        wait.stop();

        // Answered while its part comes: drawn at once, nothing in its place before.
        const again = form();
        const quick = fresh.startLoading(again.region, 'first', loading());
        jest.advanceTimersByTime(400);
        const apply = jest.fn();
        await quick.done(apply);
        expect(apply).toHaveBeenCalledTimes(1);
        expect(loader(again.region)).toBeNull();
        expect(again.region.hasAttribute('data-fd-coming')).toBe(false);
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('a wait, on its clock', () => {
  beforeAll(() => loadingPart.load());
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is busy at once, draws nothing before the delay, and a quick answer never flashes a loader', async () => {
    const { region, root } = form();
    const told: [boolean, LoadingEvent][] = [];
    const wait = startLoading(region, 'first', loading({ told: (start, event) => told.push([start, event]) }));
    expect(region.getAttribute('aria-busy')).toBe('true');
    jest.advanceTimersByTime(149);
    expect(loader(region)).toBeNull();
    const apply = jest.fn();
    await wait.done(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(region.hasAttribute('aria-busy')).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(loader(region)).toBeNull();
    expect(said(root)).toBe('');
    expect(told).toEqual([
      [true, { moment: 'first', part: 'customers', duration: 0, failed: false }],
      [false, { moment: 'first', part: 'customers', duration: 149, failed: false }],
    ]);
  });

  it('once drawn, stays its minimum: the answer drawn as it goes, never a flicker', async () => {
    const { region, root } = form();
    const wait = startLoading(region, 'first', loading({ set: { first: 'text' } }));
    jest.advanceTimersByTime(150);
    expect(loader(region)?.getAttribute('data-way')).toBe('text');
    expect(loader(region)?.textContent).toBe('Loading…');
    expect(region.getAttribute('data-fd-wait')).toBe('first');
    // Said once, politely, in the form's own live region.
    expect(root.querySelector('.fd-loading-said')?.getAttribute('role')).toBe('status');
    expect(said(root)).toBe('Loading…');
    jest.advanceTimersByTime(50);
    const apply = jest.fn();
    let settled = false;
    void wait.done(apply).then(() => (settled = true));
    expect(apply).not.toHaveBeenCalled();
    jest.advanceTimersByTime(249);
    expect(loader(region)).not.toBeNull();
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(settled).toBe(true);
    expect(loader(region)).toBeNull();
    expect(region.hasAttribute('data-fd-wait')).toBe(false);
    expect(said(root)).toBe('');
  });

  it('keeps what is shown as it is asked again: the answer drawn at once, the bar over it its minimum', async () => {
    const { region } = form();
    const wait = startLoading(region, 'refresh', loading());
    jest.advanceTimersByTime(160);
    expect(loader(region)?.getAttribute('data-way')).toBe('keep');
    expect(loader(region)?.querySelector('.fd-bar')).not.toBeNull();
    expect(region.querySelector('p')?.textContent).toBe('Nile Traders');
    const apply = jest.fn();
    await wait.done(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(loader(region)).not.toBeNull();
    jest.advanceTimersByTime(300);
    expect(loader(region)).toBeNull();
    expect(region.hasAttribute('aria-busy')).toBe(false);
  });

  it.each(['skeleton', 'spinner'] as const)('asked again as a %s with a popup open in its place, keeps what is shown: a bar over it, the answer at once', async (refresh) => {
    const { region } = form();
    const shape = { show: jest.fn(), hide: jest.fn() };
    // A date's calendar open in the place that waits: its opener expanded.
    const opener = Object.assign(document.createElement('button'), { type: 'button' });
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.setAttribute('aria-expanded', 'true');
    region.append(opener);
    const wait = startLoading(region, 'refresh', loading({ set: { refresh } }), { shape });
    jest.advanceTimersByTime(160);
    expect(shape.show).not.toHaveBeenCalled();
    expect(region.getAttribute('data-fd-way')).toBe('keep');
    expect(loader(region)?.querySelector('.fd-bar')).not.toBeNull();
    expect(loader(region)?.querySelector('.fd-spin')).toBeNull();
    const apply = jest.fn();
    await wait.done(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    // Closed: the next ask is drawn as it says again.
    opener.setAttribute('aria-expanded', 'false');
    const next = startLoading(region, 'refresh', loading({ set: { refresh } }), { shape });
    jest.advanceTimersByTime(160);
    expect(region.getAttribute('data-fd-way')).toBe(refresh);
    next.stop();
  });

  it('keeps a part holding an open popup out of what it hides, dims or shapes, and a ring over what is shown never in the way', () => {
    const open = ':has(:is([aria-haspopup], [role="combobox"])[aria-expanded="true"])';
    expect(LOADING_CSS).toContain(`[data-fd-way="skeleton"]):not([data-fd-shaped]) > :not(.fd-loader, ${open}) { visibility: hidden; }`);
    expect(LOADING_CSS).toContain(`[data-fd-way="dim"] > :not(.fd-loader, ${open}) { opacity`);
    expect(LOADING_PART_CSS).toContain(`[data-fd-way="spinner"] > :not(.fd-loader, ${open}) { opacity`);
    // A field holding one is marked so by the wait (`data-fd-open`, below): a :has() asked of every field made each change
    // in a form lay it all out again (0.35.1).
    expect(LOADING_PART_CSS).toContain('[data-fd-shaped] .fd-field:not([data-fd-open]) > :is(.fd-label + *, :first-child:not(.fd-label)) { min-block-size');
    expect(LOADING_CSS).toContain('[data-fd-coming="boxes"] .fd-field:not([data-fd-open]) > :is(.fd-label + *, :first-child:not(.fd-label))');
    expect(LOADING_PART_CSS).toContain('.fd-loader[data-moment="refresh"][data-way="spinner"] { pointer-events: none; }');
  });

  it('marks the fields of its place holding an open popup while it waits, as they open and close, and lets go with it', async () => {
    const { region } = form();
    const field = (open: boolean) => {
      const one = document.createElement('div');
      one.className = 'fd-field';
      const box = Object.assign(document.createElement('input'), { className: 'fd-input' });
      box.setAttribute('role', 'combobox');
      box.setAttribute('aria-expanded', String(open));
      one.append(Object.assign(document.createElement('label'), { className: 'fd-label', textContent: 'Partner' }), box);
      region.append(one);
      return { one, box };
    };
    const opened = field(true);
    const closed = field(false);
    const wait = startLoading(region, 'refresh', loading({ set: { refresh: 'skeleton', delay: 0 } }));
    expect(opened.one.hasAttribute('data-fd-open')).toBe(true);
    expect(closed.one.hasAttribute('data-fd-open')).toBe(false);
    // Opened meanwhile, and closed: said as it happens (a MutationObserver's records come in a microtask).
    closed.box.setAttribute('aria-expanded', 'true');
    opened.box.setAttribute('aria-expanded', 'false');
    await Promise.resolve();
    expect(closed.one.hasAttribute('data-fd-open')).toBe(true);
    expect(opened.one.hasAttribute('data-fd-open')).toBe(false);
    void wait.done();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(region.querySelectorAll('[data-fd-open]')).toHaveLength(0);
  });

  it('says "Still loading…" past slowAfter, once, and ends as failed past its timeout — the request’s signal aborted, Retry asking again', () => {
    const { region, root } = form();
    const retry = jest.fn();
    const told: LoadingEvent[] = [];
    const wait = startLoading(region, 'first', loading({ set: { first: 'spinner', slowAfter: 1000, timeout: 3000 }, told: (start, event) => !start && told.push(event) }), { retry });
    jest.advanceTimersByTime(1000);
    expect(loader(region)?.querySelector('.fd-loader-slow')?.textContent).toBe('Still loading…');
    expect(said(root)).toBe('Still loading…');
    expect(wait.signal.aborted).toBe(false);
    jest.advanceTimersByTime(2000);
    expect(wait.signal.aborted).toBe(true);
    const failed = region.querySelector<HTMLElement>('.fd-loader[data-way="failed"]');
    expect(failed?.getAttribute('role')).toBe('alert');
    expect(failed?.textContent).toBe('Couldn’t load. It took too long. Retry');
    expect(region.hasAttribute('aria-busy')).toBe(false);
    expect(told).toEqual([{ moment: 'first', part: 'customers', duration: 3000, failed: true }]);
    // An answer that comes after is not drawn.
    const late = jest.fn();
    void wait.done(late);
    expect(late).not.toHaveBeenCalled();
    failed?.querySelector('button')?.click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(region.querySelector('.fd-loader')).toBeNull();
  });

  it('says a failure with the source’s own words, never a network’s; or its own way, in a toast, or by the app', () => {
    const { region } = form();
    startLoading(region, 'first', loading()).fail(new Error('The archive is offline until 6.'), () => undefined);
    expect(region.querySelector('.fd-loader[data-way="failed"] .fd-loader-words')?.textContent).toBe('Couldn’t load. The archive is offline until 6.');
    startLoading(region, 'first', loading()).fail(new TypeError('Failed to fetch'), () => undefined);
    expect(region.querySelectorAll('.fd-loader[data-way="failed"]')).toHaveLength(1);
    expect(region.querySelector('.fd-loader[data-way="failed"] .fd-loader-words')?.textContent).toBe('Couldn’t load.');
    // The list's own sentence and Retry.
    const own = jest.fn(() => true);
    startLoading(region, 'refresh', loading(), { failed: own }).fail(new Error('down'), () => undefined);
    expect(own).toHaveBeenCalledWith('Couldn’t load. down', expect.any(Function), 'down');
    expect(region.querySelector('.fd-loader')).toBeNull();
    // A toast: what is shown stays.
    const toast = jest.fn();
    startLoading(region, 'refresh', loading({ set: { error: 'toast' }, toast })).fail(new Error('down'), () => undefined);
    expect(toast).toHaveBeenCalledWith('Couldn’t load. down', expect.any(Function));
    expect(region.querySelector('.fd-loader')).toBeNull();
    // A search's words.
    startLoading(region, 'search', loading(), { failWords: words.cantSearch }).fail(new Error(''), () => undefined);
    expect(region.querySelector('.fd-loader-words')?.textContent).toBe('Couldn’t search.');
  });

  it('says in a toast what failed, away from its place: a part by its own words for it, a field by its label', () => {
    const { root, region } = form();
    const toast = jest.fn();
    const by = loading({ set: { error: 'toast' }, toast });
    // A list names itself.
    startLoading(region, 'refresh', by, { failWords: 'Could not load the customers.', failed: () => true }).fail(new Error('down'), () => undefined);
    expect(toast).toHaveBeenLastCalledWith('Could not load the customers. down', expect.any(Function));
    // A record's own sentence names it already.
    startLoading(region, 'refresh', by).fail(new Error('This customer could not be loaded: down'), () => undefined, '');
    expect(toast).toHaveBeenLastCalledWith('This customer could not be loaded: down', expect.any(Function));
    // A box's search, by its field's label: one of a page's many.
    const field = Object.assign(document.createElement('div'), { className: 'fd-field' });
    const label = Object.assign(document.createElement('label'), { className: 'fd-label', textContent: 'Account manager' });
    const list = document.createElement('ul');
    field.append(label, list);
    root.append(field);
    startLoading(list, 'search', by, { failWords: words.cantSearch }).fail(new Error('down'), () => undefined);
    expect(toast).toHaveBeenLastCalledWith('Account manager: Couldn’t search. down', expect.any(Function));
  });

  it('marks a failure drawn by the app its own, none of Fieldia’s look over it; Fieldia’s reads as a failure', () => {
    const { region } = form();
    startLoading(region, 'first', loading({ set: { error: 'custom' }, custom: ({ container }) => void container.append('Ours') })).fail(new Error('down'), () => undefined);
    expect(region.querySelector('.fd-loader[data-way="failed"]')?.hasAttribute('data-fd-own')).toBe(true);
    expect(LOADING_CSS).toMatch(/\.fd-loader\[data-way="failed"\]:not\(\[data-fd-own\]\) \{ color: var\(--fd-error\); border-inline-start: 3px solid currentColor; \}/);
  });

  it('centres a loader over a place taller than the window in what of it is in view', () => {
    const { region } = form();
    // A pane from 460 px down a 900 px window, 1600 px tall: in view from its top to 440 px into it.
    region.getBoundingClientRect = () => ({ top: 460, bottom: 2060, height: 1600, left: 0, right: 400, width: 400, x: 0, y: 460, toJSON: () => ({}) });
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    const wait = startLoading(region, 'first', loading({ set: { first: 'spinner' } }));
    jest.advanceTimersByTime(150);
    const ring = loader(region) as HTMLElement;
    // The grid's middle where the part in view has its own: 220 px in, so the far end padded 1600 − 440.
    expect(ring.style.paddingBlockEnd).toBe('1160px');
    expect(ring.style.paddingBlockStart).toBe('');
    wait.stop();
    // Whole in view: centred in it, nothing padded.
    region.getBoundingClientRect = () => ({ top: 100, bottom: 500, height: 400, left: 0, right: 400, width: 400, x: 0, y: 100, toJSON: () => ({}) });
    const whole = startLoading(region, 'first', loading({ set: { first: 'spinner' } }));
    jest.advanceTimersByTime(150);
    expect((loader(region) as HTMLElement).getAttribute('style')).toBeNull();
    whole.stop();
  });

  it('hands the app’s own drawing its container and signal, again as it turns slow and as it fails; Fieldia cleans up', () => {
    const { region } = form();
    const calls: { slow: boolean; failed: boolean; error?: string; retry?: boolean }[] = [];
    const undone = jest.fn();
    let signal: AbortSignal | undefined;
    const custom = jest.fn((drawing: Parameters<NonNullable<Loading['custom']>>[0]) => {
      calls.push({ slow: drawing.slow, failed: drawing.failed, ...(drawing.error ? { error: drawing.error, retry: !!drawing.retry } : {}) });
      drawing.container.textContent = drawing.failed ? 'Our own failure' : 'Our own loader';
      signal = drawing.signal;
      return undone;
    });
    const wait = startLoading(region, 'first', loading({ set: { first: 'custom', error: 'custom', slowAfter: 500 }, custom }));
    jest.advanceTimersByTime(150);
    expect(custom).toHaveBeenCalledWith(expect.objectContaining({ moment: 'first', part: 'customers', container: loader(region) }));
    expect(loader(region)?.textContent).toBe('Our own loader');
    jest.advanceTimersByTime(350);
    expect(undone).toHaveBeenCalledTimes(1);
    const loaderSignal = signal;
    wait.fail(new Error('down'), () => undefined);
    expect(loaderSignal?.aborted).toBe(true);
    expect(calls).toEqual([{ slow: false, failed: false }, { slow: true, failed: false }, { slow: true, failed: true, error: 'Couldn’t load. down', retry: true }]);
    expect(region.querySelector('.fd-loader[data-way="failed"]')?.textContent).toBe('Our own failure');
    // The failure's drawing lives until its place is asked again: then its signal aborts, its clean-up runs.
    expect(signal?.aborted).toBe(false);
    const cleaned = undone.mock.calls.length;
    startLoading(region, 'first', loading({ set: { first: 'custom', error: 'custom' }, custom })).stop();
    expect(signal?.aborted).toBe(true);
    expect(undone.mock.calls.length).toBe(cleaned + 1);
    expect(region.querySelector('.fd-loader[data-way="failed"]')).toBeNull();
  });

  it('takes over a wait drawn the same way in its place: the loader kept, never gone and back between two asks', async () => {
    const { region } = form();
    const first = startLoading(region, 'search', loading());
    jest.advanceTimersByTime(200);
    const drawn = loader(region);
    expect(drawn?.textContent).toBe('Searching…');
    const second = startLoading(region, 'search', loading());
    expect(loader(region)).toBe(drawn);
    // The first one's answer, come late, is never drawn.
    const late = jest.fn();
    await first.done(late);
    expect(late).not.toHaveBeenCalled();
    expect(loader(region)).toBe(drawn);
    // Shown since 200: its minimum is reached at 500.
    jest.advanceTimersByTime(100);
    const apply = jest.fn();
    void second.done(apply);
    jest.advanceTimersByTime(0);
    expect(apply).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(loader(region)).toBeNull();
  });

  it('draws at once, said at once, a wait that goes on from one already in sight', () => {
    const { region, root } = form();
    const wait = startLoading(region, 'first', loading({ set: { first: 'text' } }), { now: true });
    expect(loader(region)?.textContent).toBe('Loading…');
    expect(said(root)).toBe('Loading…');
    wait.stop();
    expect(said(root)).toBe('');
  });

  it('draws a part’s own shapes where it has them, and stops at once when let go', () => {
    const { region } = form();
    const shape = { show: jest.fn(), hide: jest.fn() };
    const wait = startLoading(region, 'first', loading(), { shape });
    jest.advanceTimersByTime(150);
    expect(shape.show).toHaveBeenCalledTimes(1);
    expect(region.hasAttribute('data-fd-shaped')).toBe(true);
    expect(region.getAttribute('data-fd-look')).toBe('shimmer');
    wait.stop();
    expect(shape.hide).toHaveBeenCalledTimes(1);
    expect(region.hasAttribute('data-fd-shaped')).toBe(false);
    expect(region.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps an action’s button’s ring its minimum, the button free as its steps end, saying nothing of its own', async () => {
    const { region, root } = form();
    const button = document.createElement('button');
    region.append(button);
    const wait = startLoading(button, 'action', loading());
    jest.advanceTimersByTime(200);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('data-fd-wait')).toBe('action');
    expect(loader(region)).toBeNull();
    expect(root.querySelector('.fd-loading-said')).toBeNull();
    await wait.done();
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.getAttribute('data-fd-wait')).toBe('action');
    // Pressed again meanwhile: the ring goes on, never off and on.
    const again = startLoading(button, 'action', loading());
    jest.advanceTimersByTime(260);
    expect(button.getAttribute('data-fd-wait')).toBe('action');
    await again.done();
    jest.advanceTimersByTime(300);
    expect(button.hasAttribute('data-fd-wait')).toBe(false);
  });

  it('covers a form while it saves, where it says overlay: nothing pressed or typed under it', async () => {
    const { region } = form();
    const wait = startLoading(region, 'action', loading({ set: { action: 'overlay' } }));
    jest.advanceTimersByTime(150);
    expect(region.hasAttribute('inert')).toBe(true);
    expect(loader(region)?.querySelector('.fd-spin')).not.toBeNull();
    jest.advanceTimersByTime(300);
    await wait.done();
    expect(region.hasAttribute('inert')).toBe(false);
  });
});

describe('a wait’s looks', () => {
  it('stand still for a reader who asks for no motion, are drawn in forced colours, and never on paper', () => {
    const still = /@media \(prefers-reduced-motion: reduce\) \{([^]*?)\n\}/;
    expect(LOADING_PART_CSS.match(still)?.[1]).toMatch(/\.fd-sk, \.fd-bar, \.fd-bar::before, \.fd-spin, \.fd-form \[data-fd-wait\] \* \{ animation: none !important; \}/);
    expect(LOADING_PART_CSS).toMatch(/@media \(forced-colors: active\)/);
    expect(LOADING_CSS).toMatch(/@media print \{ \.fd-loader, \.fd-loading-said \{ display: none !important; \} \}/);
    // The shapes, the bars and the spinners are drawn on screen alone: on paper the content is as it stands.
    expect(LOADING_PART_CSS).toMatch(/@media not print \{\n\.fd-loader:is/);
  });

  it('take their tokens from the form, light and dark', () => {
    for (const token of ['--fd-skeleton', '--fd-skeleton-shine', '--fd-shimmer', '--fd-spinner', '--fd-bar']) expect(LOADING_PART_CSS).toContain(`${token}:`);
    expect(LOADING_PART_CSS).toMatch(/\[data-scheme="dark"\] \{ --fd-skeleton-shine:/);
  });
});
