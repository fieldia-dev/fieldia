import { createMemoryDataSource, isRightToLeft, scoreOf, type DataSource, type Page, type Values } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import type { WidgetFactory } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
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
function madeUp(page: Page): Record<string, Record<string, Values>> {
  if (page.layout.type !== 'list' || page.data.kind !== 'record') return {};
  const rows = sampleRows(page.fields, Object.keys(page.fields), 36);
  return { [page.data.model]: Object.fromEntries(rows.map((values, i) => [String(i + 1), values as Values])) };
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
    const page = designer.getPage();
    const dataSource = createMemoryDataSource({ records: madeUp(page) });
    const app = options.dataSource;
    if (app?.options) dataSource.options = app.options.bind(app);
    // Sent: the answers' score, under the viewer's thanks, when the page gives points.
    const send = dataSource.submit.bind(dataSource);
    dataSource.submit = async (request) => {
      const result = await send(request);
      showScore(page, request.values);
      return result;
    };
    viewer = mountViewer(frame, {
      page,
      dataSource,
      skin: options.skin,
      widgets: options.widgets,
      ...language.viewerOptions(direction),
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
