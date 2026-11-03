import { createMemoryDataSource, isRightToLeft, scoreOf, type AppFunctions, type DataSource, type ListCalendar, type ListGantt, type MapNode, type Page, type Values } from '@fieldia/core';
import { mountViewer, type ListViewFactory, type MapPartFactory, type Skin, type ViewerHandle } from '@fieldia/viewer';
import type { WidgetFactory } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { containers } from './page-tree';
import { sampleRows } from './samples';
import { pageLanguage } from './translations';
import { tryLanguage } from './try-language';
import { tryDrawer } from './try-drawer';

/**
 * Try it: the page working as people will use it, in place of the editor —
 * at a desktop's, a tablet's or a phone's width, left to right or right to
 * left in Arabic. Nothing typed here is kept: each time it is tried, the page
 * is drawn afresh from the draft. A quiz, once sent, says its score.
 */

export interface TryItOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  skin: Skin;
  /** Trying began or ended: the editor hides or shows itself. */
  onChange(trying: boolean): void;
  /** The app's own data source: the choices of the app's lists come from it. Nothing is read or saved through it besides. */
  dataSource?: DataSource;
  /** The app's own widgets, by `type` or `type.widget`, as the viewer takes them. */
  widgets?: Record<string, WidgetFactory>;
  /** The app's other ways of showing a list's records, as the viewer takes them: a map with @fieldia/map's mapListViews. */
  listViews?: Record<string, ListViewFactory>;
  /** Draws a page's maps (`type: "map"`): @fieldia/map's mapParts. */
  maps?: MapPartFactory;
  /** Where the made-up records are, on a list's map: the middle of the app's maps. Near 0, 0 unless said. */
  sampleCentre?: { lat: number; lng: number };
}

export interface TryIt {
  /** Design or Try it, for the bar. */
  toggle: HTMLElement;
  /** Where the page is tried. */
  element: HTMLElement;
  readonly trying: boolean;
  /** Try the page, as Try it in the bar does. */
  start(): void;
  /** For Find anything: trying it, at a phone's width, in Arabic; or back to designing. */
  items(): FindItem[];
  destroy(): void;
}

type Width = 'desktop' | 'tablet' | 'phone';
type Direction = 'ltr' | 'rtl';

/** A list's records to try it with: made up, enough for a few pages. */
function madeUp(page: Page, centre = { lat: 0, lng: 0 }): Record<string, Record<string, Values>> {
  if (page.layout.type !== 'list' || page.data.kind !== 'record') return {};
  const rows = sampleRows(page.fields, Object.keys(page.fields), 36);
  // On a list's map, each made-up record somewhere around the middle of the app's maps, a few kilometres apart.
  const map = page.layout.map;
  if (map) {
    rows.forEach((values, i) => {
      const lat = Math.round((centre.lat + Math.sin(i * 2.4) * (0.01 + (i % 6) * 0.008)) * 1e6) / 1e6;
      const lng = Math.round((centre.lng + Math.cos(i * 2.4) * (0.01 + (i % 6) * 0.008)) * 1e6) / 1e6;
      if (map.point) values[map.point] = { type: 'Point', coordinates: [lng, lat] };
      if (map.latitude) values[map.latitude] = lat;
      if (map.longitude) values[map.longitude] = lng;
    });
  }
  if (page.layout.calendar) madeUpTimes(page.layout.calendar, page, rows);
  if (page.layout.gantt) madeUpPlan(page.layout.gantt, page, rows);
  return { [page.data.model]: Object.fromEntries(rows.map((values, i) => [String(i + 1), values as Values])) };
}

/**
 * On a list's calendar, each made-up record in the week round today, in the day's working hours, half an hour to
 * an hour and a half long: a calendar opens on today, and one of last January's records would show nothing.
 */
export function madeUpTimes(calendar: ListCalendar, page: Page, rows: Record<string, unknown>[], now = new Date()) {
  const date = page.fields[calendar.start]?.type === 'date';
  const pad = (n: number) => String(n).padStart(2, '0');
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  rows.forEach((values, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i % 7) - 3);
    if (date) {
      values[calendar.start] = key(day);
      if (calendar.end) values[calendar.end] = key(new Date(day.getFullYear(), day.getMonth(), day.getDate() + (i % 3)));
      return;
    }
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, ((i * 75) % 480) - (((i * 75) % 480) % 15));
    values[calendar.start] = start.toISOString();
    if (calendar.end) values[calendar.end] = new Date(start.getTime() + (30 + (i % 3) * 30) * 60000).toISOString();
  });
}

/**
 * On a list's timeline, each made-up record a bar in the weeks round today, a day after the one before it, each third
 * waiting for the one before it: a timeline opens on today, and one of last January's records would be far off.
 */
export function madeUpPlan(gantt: ListGantt, page: Page, rows: Record<string, unknown>[], now = new Date()) {
  const date = page.fields[gantt.start]?.type === 'date';
  const pad = (n: number) => String(n).padStart(2, '0');
  const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const write = (d: Date) => (date ? key(d) : d.toISOString());
  rows.forEach((values, i) => {
    const days = 2 + (i % 4);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10 + i, date ? 0 : 9);
    values[gantt.start] = write(start);
    if (gantt.end) values[gantt.end] = write(new Date(start.getFullYear(), start.getMonth(), start.getDate() + days - (date ? 1 : 0), date ? 0 : 17));
    if (gantt.duration) values[gantt.duration] = days;
    if (gantt.dependsOn) values[gantt.dependsOn] = i > 0 && i % 3 === 0 ? [{ id: String(i), label: String(i) }] : [];
  });
}

/** On a form's maps, each place layer somewhere near the middle of the app's maps, a few hundred metres from the next: a map with nothing on it shows nothing. */
function madeUpPlaces(page: Page, centre = { lat: 0, lng: 0 }): Values {
  const values: Values = {};
  const maps = containers(page).flatMap((c) => c.children.filter((n): n is MapNode => n.type === 'map'));
  maps.flatMap((map) => map.layers.filter((l) => !l.lines && (l.point || l.latitude))).forEach((layer, k) => {
    const lat = Math.round((centre.lat + Math.sin(k * 2.1) * (0.006 + k * 0.004)) * 1e6) / 1e6;
    const lng = Math.round((centre.lng + Math.cos(k * 2.1) * (0.006 + k * 0.004)) * 1e6) / 1e6;
    if (layer.point) values[layer.point] = { type: 'Point', coordinates: [lng, lat] };
    if (layer.latitude) values[layer.latitude] = lat;
    if (layer.longitude) values[layer.longitude] = lng;
  });
  return values;
}

export function tryIt(options: TryItOptions): TryIt {
  const { el, doc, designer } = options;
  const w = designer.words.tryIt;
  const modeButton = (mode: string, words: string, icon: string) =>
    el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': mode, 'aria-pressed': 'false' }, designerIcon(doc, icon), words);
  const design = modeButton('design', w.design, 'edit');
  const tryButton = modeButton('try', w.tryIt, 'play');
  const toggle = el('div', { class: 'fd-mode', role: 'group', 'aria-label': w.modes }, design, tryButton);

  const control = (name: string, words: string, icon?: string) =>
    el('button', { type: 'button', class: 'fd-try-button', 'data-try': name, 'aria-pressed': 'false', title: words, ...(icon ? { 'aria-label': words } : {}) }, ...(icon ? [designerIcon(doc, icon)] : [words]));
  const widths: Record<Width, HTMLButtonElement> = { desktop: control('desktop', w.sizes.desktop, 'desktop'), tablet: control('tablet', w.sizes.tablet, 'tablet'), phone: control('phone', w.sizes.phone, 'device') };
  const directions: Record<Direction, HTMLButtonElement> = { ltr: control('ltr', 'English'), rtl: control('rtl', 'العربية') };
  // Each language by its own name, in its own language: a person finds theirs whatever the designer speaks.
  directions.ltr.setAttribute('lang', 'en');
  directions.rtl.setAttribute('lang', 'ar');
  const frame = el('div', { class: 'fd-try-frame', 'data-width': 'desktop' });
  const element = el(
    'section',
    { class: 'fd-try', 'aria-label': w.tryThePage, hidden: '' },
    el(
      'div',
      { class: 'fd-try-bar' },
      el('div', { class: 'fd-try-group', role: 'group', 'aria-label': w.width }, ...Object.values(widths)),
      el('p', { class: 'fd-try-note' }, w.note),
      el('div', { class: 'fd-try-group', role: 'group', 'aria-label': w.language }, ...Object.values(directions))
    ),
    frame
  );
  const language = tryLanguage({ el, designer, bar: element.querySelector('.fd-try-bar') as HTMLElement, redraw: () => draw() });

  let trying = false;
  let width: Width = 'desktop';
  let direction: Direction = 'ltr';
  /** Whether a direction was pressed: until one is, the page is tried the way its own language runs. */
  let pressed = false;
  let viewer: ViewerHandle | null = null;

  function draw() {
    viewer?.destroy();
    viewer = null;
    frame.replaceChildren();
    if (!trying) return;
    frame.dataset['width'] = width;
    // The last change refused (words whose braces name no field, say): the page tried is the one before it — said so,
    // never shown as if it held what the card shows (0.36's walk).
    const refused = designer.getState().issues;
    if (refused.length) frame.append(el('p', { class: 'fd-alert fd-tone-warning fd-try-refused', role: 'status' }, w.lastPassed(refused.join(' '))));
    const page = designer.getPage();
    const dataSource = createMemoryDataSource({ records: madeUp(page, options.sampleCentre) });
    const app = options.dataSource;
    if (app?.options) dataSource.options = app.options.bind(app);
    // Sent: the answers' score, under the viewer's thanks, when the page gives points — a quiz's own results say it.
    const send = dataSource.submit.bind(dataSource);
    dataSource.submit = async (request) => {
      const result = await send(request);
      if (!page.quiz) showScore(page, request.values);
      return result;
    };
    viewer = mountViewer(frame, {
      page,
      dataSource,
      // The app's functions as it gave them: those it gave calls for are called, as the form will call them.
      functions: designer.functions() as AppFunctions | undefined,
      // The page's own skin when it names one, as the form will wear it; else the editor's.
      skin: page.look?.skin ?? options.skin,
      widgets: options.widgets,
      ...(options.listViews ? { listViews: options.listViews } : {}),
      ...(options.maps ? { maps: options.maps, values: madeUpPlaces(page, options.sampleCentre) } : {}),
      ...language.viewerOptions(direction),
      // The page being made: one the viewer refuses says what is wrong with it under its visitor's words.
      development: true,
    });
    tryDrawer(el, frame, viewer, designer.words);
  }
  /** "Score: 3 of 5": the points of the questions that were asked, out of the most they could earn. */
  function showScore(page: Page, values: Values) {
    const asked = Object.fromEntries(Object.entries(page.fields).filter(([name]) => name in values));
    const result = scoreOf({ ...page, fields: asked }, values);
    const done = frame.querySelector('.fd-done');
    done?.querySelector('.fd-try-score')?.remove();
    if (!result || !done) return;
    const words = direction === 'rtl' ? `النتيجة: ${result.score} من ${result.max}` : `Score: ${result.score} of ${result.max}`;
    done.insertBefore(el('p', { class: 'fd-try-score', role: 'status' }, words), done.querySelector('button'));
  }
  function show() {
    design.setAttribute('aria-pressed', String(!trying));
    tryButton.setAttribute('aria-pressed', String(trying));
    for (const [name, button] of Object.entries(widths)) button.setAttribute('aria-pressed', String(name === width));
    for (const [name, button] of Object.entries(directions)) button.setAttribute('aria-pressed', String(name === direction));
    element.hidden = !trying;
  }
  function set(next: boolean) {
    if (next === trying) return;
    trying = next;
    if (trying && !pressed) direction = isRightToLeft(pageLanguage(designer.getPage())) ? 'rtl' : 'ltr';
    show();
    draw();
    options.onChange(trying);
  }
  design.addEventListener('click', () => set(false));
  tryButton.addEventListener('click', () => set(true));
  for (const [name, button] of Object.entries(widths)) {
    button.addEventListener('click', () => {
      width = name as Width;
      frame.dataset['width'] = width;
      show();
    });
  }
  for (const [name, button] of Object.entries(directions)) {
    button.addEventListener('click', () => {
      direction = name as Direction;
      pressed = true;
      show();
      draw();
    });
  }
  show();

  return {
    toggle,
    element,
    get trying() {
      return trying;
    },
    start: () => set(true),
    items() {
      if (trying) return [{ label: w.backToDesigning, hint: w.design, run: () => design.click() }];
      return [
        { label: w.tryIt, hint: w.asPeopleWillUseIt, run: () => tryButton.click() },
        {
          label: w.atPhoneWidth,
          hint: w.tryIt,
          run: () => {
            tryButton.click();
            widths.phone.click();
          },
        },
        {
          label: w.inArabic,
          hint: w.tryIt,
          run: () => {
            tryButton.click();
            directions.rtl.click();
          },
        },
      ];
    },
    destroy() {
      viewer?.destroy();
      viewer = null;
      frame.replaceChildren();
    },
  };
}
