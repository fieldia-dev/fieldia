import { LOADING_DEFAULTS, type LoadingMoment, type PageLoading } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { lazyPart, type Part } from './parts';
import type * as LoadingModule from './loading-part';

/**
 * Waiting for an answer, the same way everywhere (docs/plans/loading.md): one timing machine that every part of a
 * page asks as it waits — a record, a list's rows, a map's places, a link's suggestions, a save — and one way of
 * resolving how it looks: Fieldia's defaults (`LOADING_DEFAULTS`), the app's (the viewer's `loading`), the page's
 * (`Page.loading`), the part's own, the most specific winning, setting by setting.
 *
 * The machine keeps the time — nothing drawn before `delay`, a loader drawn kept `minShown`, "Still loading…" after
 * `slowAfter`, the wait ended as failed past `timeout` — the region's `aria-busy`, one polite announcement, the events
 * and the clean-up. The control says where its loader goes and what shape it has (`WaitHow`): a list its rows, a page
 * its layout. A failure is said in the loader's place with Retry, in a toast, or by the app's own drawing.
 *
 * The words — `text`, a row's Loading more…, a search's Searching… — the dimming, a busy button's ring and a failure are
 * the main script's. The skeletons, the bars, the spinners and the overlay are drawn by the loading part
 * (`fieldia.loading.js`), asked for as a wait that draws from it starts (`wantLoadingPart`): until it has come,
 * a loader that draws from it says "Loading…" in words (what is drawn the first time) or is a screen reader's alone,
 * and is drawn as it says once it has.
 */

/** The loading part: the skeletons — a page's from its layout among them — the bars, the spinners and the overlay. */
export type LoadingPart = typeof LoadingModule;
export const loadingPart: Part<LoadingPart> = lazyPart('loading', () => import('./loading-part'));

/** The ways the loading part draws. */
const IN_PART = new Set(['skeleton', 'spinner', 'progress', 'keep', 'bar', 'overlay']);

/** What the app's own drawing is handed (`loading.custom`): where to draw, and how the wait stands. */
export interface LoadingDrawing {
  moment: LoadingMoment;
  /** The part that waits: a list's, a map's or a field's id; the page's id for its record. */
  part: string;
  /** Where the app draws: in the place of what waits, taken away as the wait ends. */
  container: HTMLElement;
  /** Aborts as the wait ends, however it ends. */
  signal: AbortSignal;
  /** True once the wait has gone on past `slowAfter`: the function is called again. */
  slow: boolean;
  /** True once it failed (`error: "custom"`): the function is called again, with `error` and `retry`. */
  failed: boolean;
  error?: string;
  retry?: () => void;
}

/** The app's settings for every page (the viewer's `loading`): a page's, and the app's own drawing for `custom`. */
export interface LoadingOptions extends PageLoading {
  /**
   * Draws a moment the page or the app sets to `custom`, inside `container`; may hand back its own clean-up. Called as
   * the loader shows, again as it turns slow, and again as it fails where `error` is `custom`. Fieldia keeps the time,
   * `aria-busy`, the announcement and the clean-up.
   */
  custom?: (drawing: LoadingDrawing) => void | (() => void);
}

/** What `loadingstart` and `loadingend` tell: the moment, the part, and at the end how long it took and whether it failed. */
export interface LoadingEvent {
  moment: LoadingMoment;
  part: string;
  /** Milliseconds from the ask to the answer (0 as it starts). */
  duration: number;
  failed: boolean;
}

/** Every setting resolved: each moment's technique, the looks, the timing (a timeout only where one is set), a failure's way. */
export type LoadingSettings = Required<Omit<PageLoading, 'timeout'>> & Pick<PageLoading, 'timeout'>;

/** The words a wait says. */
export type LoadingWords = Pick<WidgetLabels, 'loading' | 'loadingMore' | 'searching' | 'stillLoading' | 'cantLoad' | 'cantSearch' | 'tookTooLong' | 'loadRetry'>;

/** What a part that waits is handed: its settings resolved, the app's drawing, the words, the viewer's hooks. */
export interface Loading {
  readonly settings: LoadingSettings;
  readonly custom?: LoadingOptions['custom'];
  readonly words: LoadingWords;
  /** Told at a wait's true start and end, drawn or not: the viewer's `loadingstart` and `loadingend`. */
  readonly told?: (start: boolean, event: LoadingEvent) => void;
  /** A failure said in a toast with Retry (`error: "toast"`): the viewer's. Without it, in place. */
  readonly toast?: (message: string, retry: () => void) => void;
}

/** Settings over settings: each one given wins over the one under it; `custom` (a function) is never a setting. */
export function loadingSettings(...layers: (PageLoading | undefined)[]): LoadingSettings {
  const settled: Record<string, unknown> = { ...LOADING_DEFAULTS };
  for (const layer of layers) for (const [key, value] of Object.entries(layer ?? {})) if (value !== undefined && key !== 'custom') settled[key] = value;
  return settled as LoadingSettings;
}

/** The default settings and words, for a part drawn with none. */
const PLAIN: Loading = { settings: LOADING_DEFAULTS as LoadingSettings, words: WIDGET_LABELS.en };

/** A part's own settings over those it sits in: the same hooks and words, its settings winning. */
export function loadingOver(under: Loading | undefined, over: PageLoading | undefined): Loading {
  const base = under ?? PLAIN;
  return over && Object.keys(over).length ? { ...base, settings: loadingSettings(base.settings, over) } : base;
}

/** What a moment draws: its technique, or the moment's default where it is `custom` and the app gave no drawing. */
export function loadingWay(loading: Loading | undefined, moment: LoadingMoment): string {
  const way = (loading?.settings ?? LOADING_DEFAULTS)[moment];
  return way === 'custom' && !loading?.custom ? LOADING_DEFAULTS[moment] : way;
}

/** Whether settings name a way the loading part draws for one of these moments — Fieldia's defaults do, a skeleton first. */
export const asksLoadingPart = (loading: PageLoading | undefined, moments: readonly LoadingMoment[] = ['first', 'refresh', 'more', 'search', 'action']): boolean =>
  !!loading && moments.some((moment) => IN_PART.has(loading[moment] ?? ''));

/** The loading part asked for, not waited for: a wait that draws from it has it by the time its delay is past, mostly. */
export function wantLoadingPart(): void {
  if (!loadingPart.loaded) void loadingPart.load().catch(() => undefined);
}

/** How a control waits: its name, its own shapes, where its loader goes, its words, its own failure. */
export interface WaitHow {
  /** The part's name for the events; the region's `data-node` unless said. */
  part?: string;
  /** Its own skeleton, shown where its content will be (a list's rows, a page's layout); a few bars in its place unless given. */
  shape?: { show(part: LoadingPart): void; hide(): void };
  /**
   * Puts its loader where it goes (the rows' end, the suggestions' list); in the region, over what it holds, unless given.
   * What it hands back (a row the loader went in) is taken away with the loader.
   */
  place?: (loader: HTMLElement) => HTMLElement | void;
  /** Its words: "Loading…" unless said ("Loading more…", "Searching…"). */
  words?: string;
  /** Says a failure its own way (a list's sentence and Retry), with the source's own words for why: true where it did. */
  failed?: (message: string, retry: (() => void) | undefined, why: string) => boolean;
  /** Asks again: what Retry does after a timeout, or a failure told without its own. */
  retry?: () => void;
  /** Its failure's words: "Couldn't load." unless said ("Couldn't search."). */
  failWords?: string;
  /** Drawn at once, never after the delay: a wait that goes on from one already in sight (a list after its page's). */
  now?: boolean;
}

/** A wait going on: ended by its answer, its failure, or let go. */
export interface Wait {
  /** Aborts as the wait ends, however it ends: a request may carry it. */
  readonly signal: AbortSignal;
  /** Whether its loader is in sight now. */
  readonly shown: boolean;
  /**
   * The answer came: `apply` draws it — at once where nothing was drawn or what is drawn stays (`keep`), else as the
   * loader goes, once it has been seen its minimum. Settled once it is drawn. Nothing is drawn of a wait already ended.
   */
  done(apply?: () => void): Promise<void>;
  /** It failed: said in its place with Retry, in a toast, or by the app's drawing, as its settings say. */
  fail(error: unknown, retry?: () => void): void;
  /** Let go with no answer — a newer wait in its place, the part gone: its loader goes at once. */
  stop(): void;
}

/** A wait going on in a region, which a newer one there takes over: its loader handed on where it was drawn the same way. */
interface Going {
  moment: LoadingMoment;
  way: string;
  /** Let go for a newer wait: what it drew handed on (`handOn`), else taken away. */
  end(handOn: boolean): { loader: HTMLElement | null; shownAt: number } | null;
}
const going = new WeakMap<Element, Going>();
/** A failure said in a region's place, until it is asked again — and what lets go of the app's drawing of it. */
const failures = new WeakMap<Element, { box: HTMLElement; letGo?: () => void }>();
/** Where a loader went in, taken away with it — a row of a table, an item of a list — whichever wait it was handed on to. */
const holders = new WeakMap<HTMLElement, HTMLElement>();
/** Which wait said what a live region says now: only it takes its words away, never another's said since. */
const speakers = new WeakMap<HTMLElement, object>();

/** A failure said in a region's place taken away: what failed came after all (a record answered past its timeout). */
export function letFailureGo(region: Element): void {
  const said = failures.get(region);
  failures.delete(region);
  said?.box.remove();
  said?.letGo?.();
}

/** Ways whose answer is drawn at once: what is shown stays, or nothing was drawn over it. */
const AT_ONCE = new Set(['keep', 'none', 'button', 'bar']);

/** The source's own words for why, where it gave any: not a network's, nor an abort. */
const why = (error: unknown) => (error instanceof Error && error.name !== 'TypeError' && error.name !== 'AbortError' ? error.message.trim() : '');

const span = (doc: Document, className: string, text = '') => {
  const made = Object.assign(doc.createElement('span'), { className, textContent: text });
  made.setAttribute('aria-hidden', 'true');
  return made;
};

/**
 * Wait for an answer in `region` at a `moment`, as `loading` says (Fieldia's defaults where it says nothing). The region
 * is busy from now; what it draws, it draws after the delay.
 */
export function startLoading(region: HTMLElement, moment: LoadingMoment, loading: Loading | undefined, how: WaitHow = {}): Wait {
  const given = loading ?? PLAIN;
  const { settings, words } = given;
  const way = loadingWay(given, moment);
  const doc = region.ownerDocument;
  const part = how.part ?? region.getAttribute('data-node') ?? moment;
  const stopper = new AbortController();
  const started = Date.now();
  letFailureGo(region);
  // A wait going on here for the same moment, drawn the same way: taken over, its loader kept — never gone and back
  // between two asks (a search typed key by key). Any other is let go.
  const before = going.get(region);
  const taken = before?.end(before.moment === moment && before.way === way && way !== 'custom') ?? null;
  let loader = taken?.loader ?? null;
  let shownAt = taken?.shownAt ?? 0;
  let over = false;
  let slow = false;
  let undo: void | (() => void);
  let lingering: ReturnType<typeof setTimeout> | undefined;
  const said = how.words ?? (moment === 'more' ? words.loadingMore : moment === 'search' ? words.searching : words.loading);
  /**
   * Said once, politely, in the form's own live region (a dialog's, the page's) — there from the start where the region
   * is in the page, else from its first words — never for an action, which its form says itself.
   */
  let voice: HTMLElement | null = null;
  /** Made only now: its first words a moment later, so a screen reader hears what comes into it. */
  let fresh = false;
  const voiceOf = (): HTMLElement | null => {
    if (voice || moment === 'action' || !region.isConnected) return voice;
    const home = (region.closest('[aria-modal="true"], .fd-form') as HTMLElement | null) ?? doc.body;
    voice = home.querySelector<HTMLElement>(':scope > .fd-loading-said');
    if (!voice) {
      voice = Object.assign(doc.createElement('div'), { className: 'fd-loading-said fd-sr-only' });
      voice.setAttribute('role', 'status');
      home.append(voice);
      fresh = true;
    }
    return voice;
  };
  voiceOf();
  fresh = false;
  /** Said in the live region; taken away only where this wait said what it says now. */
  const say = (text: string) => {
    const said = text ? voiceOf() : voice;
    if (!said || (!text && speakers.get(said) !== mine)) return;
    speakers.set(said, mine);
    if (!fresh || !text) return void (said.textContent = text);
    fresh = false;
    setTimeout(() => {
      if (!over && speakers.get(said) === mine) said.textContent = text;
    }, 50);
  };
  region.setAttribute('aria-busy', 'true');
  given.told?.(true, { moment, part, duration: 0, failed: false });

  const drawCustom = (container: HTMLElement) => {
    if (typeof undo === 'function') undo();
    container.replaceChildren();
    try {
      undo = given.custom?.({ moment, part, container, signal: stopper.signal, slow, failed: false });
    } catch (error) {
      console.warn('Fieldia: the app’s loading drawing threw', error);
    }
  };
  const make = (as: string) => {
    const made = doc.createElement('div');
    made.className = 'fd-loader';
    made.setAttribute('data-moment', moment);
    made.setAttribute('data-way', as);
    // Its look: a skeleton's, a spinner's, a bar's.
    const look = as === 'skeleton' ? settings.skeleton : as === 'spinner' || as === 'overlay' ? settings.spinner : as === 'progress' ? settings.progress : '';
    if (look) made.setAttribute('data-look', look);
    return made;
  };
  const put = (made: HTMLElement) => {
    const holder = how.place ? how.place(made) : region.append(made);
    if (holder) holders.set(made, holder);
  };
  const drop = (made: HTMLElement | null) => (made && (holders.get(made) ?? made))?.remove();
  /** Its loader, drawn as it says — or, its part not come yet, in words where it is drawn the first time, else unseen. */
  const draw = () => {
    const kit = loadingPart.loaded;
    const as = IN_PART.has(way) && !kit ? (moment === 'first' ? 'text' : 'none') : way;
    region.setAttribute('data-fd-way', as);
    kit?.installLoadingStyles(doc);
    if (as === 'skeleton') region.setAttribute('data-fd-look', settings.skeleton);
    if (as === 'skeleton' && how.shape && kit) {
      region.setAttribute('data-fd-shaped', '');
      return how.shape.show(kit);
    }
    if (as === 'none' || as === 'button') return;
    loader = make(as);
    if (as === 'custom') drawCustom(loader);
    else if (as === 'overlay') region.setAttribute('inert', '');
    if (kit && IN_PART.has(as)) kit.drawLoader(loader, said);
    else if (as !== 'custom' && as !== 'dim') loader.append(span(doc, 'fd-loader-words', said));
    if (slow) loader.append(span(doc, 'fd-loader-slow', words.stillLoading));
    put(loader);
  };
  const show = () => {
    if (over || shownAt) return;
    shownAt = Date.now();
    region.setAttribute('data-fd-wait', moment);
    draw();
    say(said);
    // Drawn in words while its part came: drawn as it says once it has, while it is still waited for.
    if (IN_PART.has(way) && !loadingPart.loaded) {
      void loadingPart.load().then(
        () => {
          if (over || !shownAt) return;
          drop(loader);
          loader = null;
          draw();
        },
        () => undefined
      );
    }
  };
  const turnSlow = () => {
    if (over) return;
    slow = true;
    say(words.stillLoading);
    if (way === 'custom' && loader) drawCustom(loader);
    else loader?.append(span(doc, 'fd-loader-slow', words.stillLoading));
  };
  const timers = [setTimeout(show, taken || how.now ? 0 : settings.delay), setTimeout(turnSlow, Math.max(settings.slowAfter, settings.delay))];
  // The loading part asked for once the wait is really one — no answer in the same turn — never waited for: it has the
  // rest of its delay to come in.
  if (IN_PART.has(way)) timers.push(setTimeout(wantLoadingPart, 0));
  if (settings.timeout) timers.push(setTimeout(() => wait.fail(Object.assign(new Error(words.tookTooLong), { name: 'TimeoutError' })), settings.timeout));

  /** Everything drawn taken away: the loader, the app's drawing — and while the region is still this wait's, its marks and shapes. */
  const clear = () => {
    for (const timer of [...timers, lingering]) clearTimeout(timer);
    lingering = undefined;
    if (typeof undo === 'function') undo();
    undo = undefined;
    drop(loader);
    loader = null;
    if (going.get(region) !== mine) return;
    going.delete(region);
    if (region.hasAttribute('data-fd-shaped')) how.shape?.hide();
    for (const name of ['aria-busy', 'inert', 'data-fd-wait', 'data-fd-way', 'data-fd-look', 'data-fd-shaped']) region.removeAttribute(name);
    say('');
  };
  /** Ended: the signal aborts, the app is told. */
  const end = (failed: boolean) => {
    over = true;
    for (const timer of timers) clearTimeout(timer);
    stopper.abort();
    given.told?.(false, { moment, part, duration: Date.now() - started, failed });
  };
  const mine: Going = {
    moment,
    way,
    end(handOn) {
      // Over, its loader going by itself: handed on all the same, never gone and back.
      if (over && lingering === undefined) return null;
      if (!handOn || !shownAt) {
        if (over) clear();
        else wait.stop();
        return null;
      }
      // Its loader, its marks and its shapes stay, the newer wait's now.
      const handed = { loader, shownAt };
      if (!over) end(false);
      clearTimeout(lingering);
      lingering = undefined;
      loader = null;
      shownAt = 0;
      return handed;
    },
  };
  going.set(region, mine);
  // What a wait taken over said is this one's to take away.
  if (taken && before && moment !== 'action') {
    const said = voiceOf();
    if (said && speakers.get(said) === before) speakers.set(said, mine);
  }
  // Drawn at once where it goes on from one in sight: never after the delay, never gone and back.
  if (taken || how.now) show();

  const wait: Wait = {
    signal: stopper.signal,
    get shown() {
      return !over && !!shownAt;
    },
    done(apply) {
      if (over) return Promise.resolve();
      end(false);
      const left = shownAt ? settings.minShown - (Date.now() - shownAt) : 0;
      if (left <= 0) {
        clear();
        apply?.();
        return Promise.resolve();
      }
      // Drawn over what stays: the answer at once, the region free at once (a button pressed again), the loader going by
      // itself once seen its minimum.
      if (AT_ONCE.has(way)) {
        apply?.();
        region.removeAttribute('aria-busy');
        lingering = setTimeout(clear, left);
        return Promise.resolve();
      }
      return new Promise((resolve) =>
        setTimeout(() => {
          clear();
          apply?.();
          resolve();
        }, left)
      );
    },
    fail(error, retry = how.retry) {
      if (over) return;
      end(true);
      clear();
      const message = [how.failWords ?? words.cantLoad, why(error)].filter(Boolean).join(' ');
      const again = retry && (() => retry());
      const box = make('failed');
      if (settings.error === 'custom' && given.custom) {
        put(box);
        // The app's drawing of the failure: its own signal and clean-up, let go as the place is asked again.
        const stop = new AbortController();
        let gone: void | (() => void);
        try {
          gone = given.custom({ moment, part, container: box, signal: stop.signal, slow, failed: true, error: message, ...(again ? { retry: again } : {}) });
        } catch (error) {
          console.warn('Fieldia: the app’s loading drawing threw', error);
        }
        failures.set(region, {
          box: holders.get(box) ?? box,
          letGo: () => {
            stop.abort();
            if (typeof gone === 'function') gone();
          },
        });
        return;
      }
      if (settings.error === 'toast' && given.toast && again) {
        given.toast(message, again);
        // Never an empty place: what was there stays; drawn for the first time, there was nothing — said there too.
        if (moment !== 'first') return;
      }
      if (how.failed?.(message, again, why(error))) return;
      box.setAttribute('role', 'alert');
      box.append(Object.assign(doc.createElement('span'), { className: 'fd-loader-words', textContent: message }));
      if (again) {
        const button = Object.assign(doc.createElement('button'), { type: 'button', className: 'fd-button fd-button-link', textContent: words.loadRetry });
        button.addEventListener('click', () => {
          drop(box);
          again();
        });
        box.append(' ', button);
      }
      put(box);
      failures.set(region, { box: holders.get(box) ?? box });
    },
    stop() {
      if (over) return;
      end(false);
      clear();
    },
  };
  return wait;
}
