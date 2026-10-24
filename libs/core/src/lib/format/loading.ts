/**
 * How a page looks while it waits for an answer (docs/plans/loading.md): at each of its moments, a way to show it, its
 * looks and its timing, and what a failure shows. Set by the app for every page (the viewer's `loading`), by the page
 * (`Page.loading`), and by a part of it — a list's, a related list's or a map's `loading`, a field's `options.loading` —
 * the most specific winning, setting by setting; what nobody sets is `LOADING_DEFAULTS`.
 *
 * - `first`: a form, a list, a card, a map, a related list drawn for the first time.
 * - `refresh`: a list or a part asked again — a search, a filter, an order, a page, a record reloaded.
 * - `more`: rows under those shown — endless scroll, Show more, a tree's children, a related list's next page.
 * - `search`: a link's or a dropdown's suggestions, choices from the app's lists, a filter's values.
 * - `action`: a save, a send, a button's steps, a delete, an export.
 *
 *   { "loading": { "first": "spinner", "refresh": "dim", "skeleton": "pulse", "delay": 250, "timeout": 20000 } }
 */
export const LOADING_MOMENTS = ['first', 'refresh', 'more', 'search', 'action'] as const;
export type LoadingMoment = (typeof LOADING_MOMENTS)[number];

/** The ways each moment can be shown, its default first. `custom` is drawn by the app's own function (the viewer's `loading.custom`). */
export const LOADING_TECHNIQUES = {
  first: ['skeleton', 'spinner', 'progress', 'text', 'none', 'custom'],
  refresh: ['keep', 'dim', 'skeleton', 'spinner', 'none', 'custom'],
  more: ['row', 'spinner', 'skeleton', 'none', 'custom'],
  search: ['inline', 'spinner', 'none', 'custom'],
  action: ['button', 'bar', 'overlay', 'none', 'custom'],
} as const;
export type LoadingTechnique<M extends LoadingMoment = LoadingMoment> = (typeof LOADING_TECHNIQUES)[M][number];

/** The looks a technique comes in: a skeleton's, a spinner's, a progress bar's — the default first. */
export const LOADING_VARIANTS = {
  skeleton: ['shimmer', 'pulse', 'static'],
  spinner: ['ring', 'dots'],
  progress: ['top', 'inline'],
} as const;

/** What a failed wait shows: words and Retry in its place, a toast with Retry, or the app's own. */
export const LOADING_ERRORS = ['inline', 'toast', 'custom'] as const;

export interface PageLoading {
  /** A form, a list, a card, a map drawn for the first time: `skeleton` unless said. */
  first?: LoadingTechnique<'first'>;
  /** A list or a part asked again: `keep` — what is shown stays, a thin bar over it — unless said. */
  refresh?: LoadingTechnique<'refresh'>;
  /** Rows under those shown: `row` — "Loading more…" where they will come — unless said. */
  more?: LoadingTechnique<'more'>;
  /** Suggestions and choices asked for as a person types or opens a list: `inline` — "Searching…" in the list — unless said. */
  search?: LoadingTechnique<'search'>;
  /** A save, a send, a button's steps: `button` — the pressed button busy — unless said. */
  action?: LoadingTechnique<'action'>;
  /** How a skeleton moves: a band of light passing over it (`shimmer`), fading in and out (`pulse`), or not at all. */
  skeleton?: (typeof LOADING_VARIANTS.skeleton)[number];
  /** A spinner: a turning `ring`, or three `dots`. */
  spinner?: (typeof LOADING_VARIANTS.spinner)[number];
  /** A progress bar: along the top of what waits, or across its middle (`inline`). */
  progress?: (typeof LOADING_VARIANTS.progress)[number];
  /** Milliseconds before anything is drawn: a quicker answer shows no loader at all. 150 unless said. */
  delay?: number;
  /** Milliseconds a loader stays once drawn, so it never flickers off. 300 unless said. */
  minShown?: number;
  /** Milliseconds after which "Still loading…" is said. 5000 unless said. */
  slowAfter?: number;
  /** Milliseconds after which the wait ends as failed, with Retry. None unless said. */
  timeout?: number;
  /** What a failed wait shows: `inline` (words and Retry in its place) unless said, a `toast`, or the app's `custom`. */
  error?: (typeof LOADING_ERRORS)[number];
}

/** What nobody set: the coordinator's proposal, 23 Oct (0.33). */
export const LOADING_DEFAULTS = {
  first: 'skeleton',
  refresh: 'keep',
  more: 'row',
  search: 'inline',
  action: 'button',
  skeleton: 'shimmer',
  spinner: 'ring',
  progress: 'top',
  delay: 150,
  minShown: 300,
  slowAfter: 5000,
  error: 'inline',
} as const satisfies PageLoading;
