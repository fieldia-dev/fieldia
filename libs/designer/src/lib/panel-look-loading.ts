import { LOADING_DEFAULTS, LOADING_ERRORS, LOADING_MOMENTS, LOADING_TECHNIQUES, LOADING_VARIANTS, type LoadingMoment, type Page, type PageLoading } from '@fieldia/core';
import { loadingSettings, startLoading, WIDGET_LABELS, type Loading, type Wait } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { LookSetting } from './panel-look';
import { onTab, segmented, setting, type Segmented } from './panel-controls';
import { settingNumber, type SettingNumber } from './number-box';

/**
 * The Look tab's section on waiting (docs/plans/loading.md): how the page looks while it waits for an answer, set with
 * no JSON — each moment's way, chosen from those it has, beside a preview that waits that way for as long as it is
 * shown; the skeleton's, the spinner's and the bar's looks; the timing; what a failure shows. A choice pressed again, or
 * a time emptied, gives the setting back to the app's, else Fieldia's, default (`setLoading`).
 *
 * Each preview is a small form of its own (`fd-form`, the page's skin), hidden from a screen reader — it is a picture —
 * where the one timing machine draws the moment's way at once, with the page's settings; drawn again as they change.
 */
export function loadingLookSettings(el: ElementFactory, designer: Designer): LookSetting {
  const w = designer.words.loadingLook;
  const set = (patch: { [K in keyof PageLoading]?: PageLoading[K] | null }) => designer.setLoading(patch);
  let loading: PageLoading = {};
  let skin = 'underline';

  // ---- each moment: its way, and a preview of it, each found by its name in English ----
  const NAMES: Record<LoadingMoment, string> = {
    first: 'Loading: drawn the first time',
    refresh: 'Loading: asked again',
    more: 'Loading: the next rows',
    search: 'Loading: a search',
    action: 'Loading: a save or a button',
  };
  const previews: { moment: LoadingMoment; host: HTMLElement; wait: Wait | null }[] = [];
  const selects = new Map<LoadingMoment, HTMLSelectElement>();
  const momentRows = LOADING_MOMENTS.map((moment) => {
    const fallback = LOADING_DEFAULTS[moment];
    const select = el('select', { class: 'fd-input fd-insp-loading-way', 'aria-label': w.moments[moment] }) as HTMLSelectElement;
    for (const way of LOADING_TECHNIQUES[moment]) select.append(el('option', { value: way }, way === fallback ? w.asDefault(w.ways[way]) : w.ways[way]));
    select.addEventListener('change', () => set({ [moment]: select.value === fallback ? null : select.value }));
    selects.set(moment, select);
    const host = el('div', { class: 'fd-insp-loading-preview', 'aria-hidden': 'true', title: w.preview(w.moments[moment]) });
    previews.push({ moment, host, wait: null });
    return setting(el, 'look', NAMES[moment], [el('div', { class: 'fd-insp-loading-moment' }, select, host)], { words: w.moments[moment], hint: w.momentHints[moment] });
  });

  // ---- the looks ----
  const variant = (key: 'skeleton' | 'spinner' | 'progress', words: Record<string, string>): Segmented<string> =>
    segmented<string>(el, w[key], LOADING_VARIANTS[key].map((value) => ({ value, words: words[value] })), (value) => set({ [key]: value === LOADING_DEFAULTS[key] ? null : value }), { toggle: true });
  const looks = { skeleton: variant('skeleton', w.skeletons), spinner: variant('spinner', w.spinners), progress: variant('progress', w.progresses) };
  const looksRow = setting(
    el,
    'look',
    'Loading looks',
    (['skeleton', 'spinner', 'progress'] as const).map((key) => el('div', { class: 'fd-insp-loading-look' }, el('span', { class: 'fd-insp-loading-look-name' }, w[key]), looks[key].element)),
    { words: w.looks }
  );

  // ---- the timing, in milliseconds ----
  const numbers: SettingNumber[] = [];
  const time = (key: 'delay' | 'minShown' | 'slowAfter' | 'timeout', max: number) => {
    const box = settingNumber(el, designer, {
      label: w[key],
      attrs: { class: 'fd-input fd-insp-number' },
      integer: true,
      min: key === 'timeout' ? 1 : 0,
      max,
      step: 50,
      optional: true,
      saved: () => loading[key] ?? (key === 'timeout' ? null : LOADING_DEFAULTS[key]),
      commit: (n) => set({ [key]: n === null || n === (LOADING_DEFAULTS as PageLoading)[key] ? null : n }),
    });
    numbers.push(box);
    return el('label', { class: 'fd-insp-loading-time' }, el('span', {}, w[key]), box.input, el('span', { class: 'fd-insp-unit' }, w.ms));
  };
  const timingRow = setting(el, 'look', 'Loading times', [time('delay', 10000), time('minShown', 10000), time('slowAfter', 600000), time('timeout', 600000)], { words: w.timing, hint: w.timingHint });

  // ---- a failure ----
  const errors = segmented<string>(el, w.error, LOADING_ERRORS.map((value) => ({ value, words: w.errors[value] })), (value) => set({ error: value === LOADING_DEFAULTS.error ? null : (value as PageLoading['error']) }), { toggle: true });
  const errorRow = setting(el, 'look', 'When loading fails', errors.element, { words: w.error, hint: w.errorHint });

  const heading = onTab(el('div', { class: 'fd-prop fd-set fd-insp-loading-head' }, el('span', { class: 'fd-prop-name' }, w.section), el('p', { class: 'fd-properties-hint fd-set-hint' }, w.hint)), 'look', 'While it waits');

  /** Each preview drawn anew with the page's settings: a small form waiting the moment's way, at once and for as long as it is shown. */
  const drawPreviews = () => {
    const given: Loading = {
      settings: loadingSettings(loading, { delay: 0 }),
      words: WIDGET_LABELS[designer.locale === 'ar' ? 'ar' : 'en'] ?? WIDGET_LABELS.en,
      // The app's own drawing, which the designer cannot show: said so in its place.
      custom: ({ container }) => void container.append(el('span', { class: 'fd-insp-loading-app' }, w.appDraws)),
    };
    for (const preview of previews) {
      preview.wait?.stop();
      const form = el('div', { class: 'fd-form', 'data-fd-skin': skin });
      const region = previewRegion(preview.moment, form);
      preview.host.replaceChildren(form);
      preview.wait = startLoading(region, preview.moment, given, { now: true, part: `preview-${preview.moment}` });
    }
  };
  /** What a moment waits over, in small: a few rows, a list's end, a search's list, a Save in a form. */
  const previewRegion = (moment: LoadingMoment, form: HTMLElement): HTMLElement => {
    const rows = () => w.rows.map((words) => el('div', { class: 'fd-insp-loading-row' }, words));
    if (moment === 'action') {
      const save = el('button', { type: 'button', class: 'fd-button fd-button-primary', tabindex: '-1' }, w.save);
      const region = el('div', { class: 'fd-insp-loading-region' }, ...rows().slice(0, 1), save);
      form.append(region);
      return (loading.action ?? LOADING_DEFAULTS.action) === 'button' ? save : region;
    }
    const region = el('div', { class: 'fd-insp-loading-region', 'data-moment': moment }, ...(moment === 'search' ? [] : moment === 'more' ? rows().slice(0, 2) : rows()));
    form.append(region);
    return region;
  };

  return {
    rows: [heading, ...momentRows, looksRow, timingRow, errorRow],
    update(page: Page) {
      const before = JSON.stringify([loading, skin]);
      loading = page.loading ?? {};
      skin = page.look?.skin ?? (page.look?.theme ? 'outlined' : 'underline');
      for (const [moment, select] of selects) if (select.ownerDocument.activeElement !== select) select.value = loading[moment] ?? LOADING_DEFAULTS[moment];
      looks.skeleton.set(loading.skeleton);
      looks.spinner.set(loading.spinner);
      looks.progress.set(loading.progress);
      errors.set(loading.error);
      for (const number of numbers) number.refresh();
      if (JSON.stringify([loading, skin]) !== before || previews.some((preview) => !preview.wait)) drawPreviews();
    },
  };
}
