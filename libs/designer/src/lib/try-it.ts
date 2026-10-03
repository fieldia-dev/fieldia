import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { sampleRows } from './samples';

/**
 * Try it: the page working as people will use it, in place of the editor —
 * at a desktop's, a tablet's or a phone's width, left to right or right to
 * left in Arabic. Nothing typed here is kept: each time it is tried, the page
 * is drawn afresh from the draft.
 */

export interface TryItOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  skin: Skin;
  /** Trying began or ended: the editor hides or shows itself. */
  onChange(trying: boolean): void;
}

export interface TryIt {
  /** Design or Try it, for the bar. */
  toggle: HTMLElement;
  /** Where the page is tried. */
  element: HTMLElement;
  readonly trying: boolean;
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
  const modeButton = (mode: string, words: string, icon: string) =>
    el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': mode, 'aria-pressed': 'false' }, designerIcon(doc, icon), words);
  const design = modeButton('design', 'Design', 'edit');
  const tryButton = modeButton('try', 'Try it', 'play');
  const toggle = el('div', { class: 'fd-mode', role: 'group', 'aria-label': 'Design or try the page' }, design, tryButton);

  const control = (name: string, words: string, icon?: string) =>
    el('button', { type: 'button', class: 'fd-try-button', 'data-try': name, 'aria-pressed': 'false', title: words, ...(icon ? { 'aria-label': words } : {}) }, ...(icon ? [designerIcon(doc, icon)] : [words]));
  const widths: Record<Width, HTMLButtonElement> = { desktop: control('desktop', 'Desktop', 'desktop'), tablet: control('tablet', 'Tablet', 'tablet'), phone: control('phone', 'Phone', 'device') };
  const directions: Record<Direction, HTMLButtonElement> = { ltr: control('ltr', 'English'), rtl: control('rtl', 'العربية') };
  directions.rtl.setAttribute('lang', 'ar');
  const frame = el('div', { class: 'fd-try-frame', 'data-width': 'desktop' });
  const element = el(
    'section',
    { class: 'fd-try', 'aria-label': 'Try the page', hidden: '' },
    el(
      'div',
      { class: 'fd-try-bar' },
      el('div', { class: 'fd-try-group', role: 'group', 'aria-label': 'Width' }, ...Object.values(widths)),
      el('p', { class: 'fd-try-note' }, 'The page works as people will use it. Nothing typed here is kept.'),
      el('div', { class: 'fd-try-group', role: 'group', 'aria-label': 'Language' }, ...Object.values(directions))
    ),
    frame
  );

  let trying = false;
  let width: Width = 'desktop';
  let direction: Direction = 'ltr';
  let viewer: ViewerHandle | null = null;

  function draw() {
    viewer?.destroy();
    viewer = null;
    frame.replaceChildren();
    if (!trying) return;
    frame.dataset['width'] = width;
    const page = designer.getPage();
    viewer = mountViewer(frame, {
      page,
      dataSource: createMemoryDataSource({ records: madeUp(page) }),
      skin: options.skin,
      dir: direction,
      ...(direction === 'rtl' ? { locale: 'ar' as const } : {}),
    });
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
    destroy() {
      viewer?.destroy();
      viewer = null;
      frame.replaceChildren();
    },
  };
}
