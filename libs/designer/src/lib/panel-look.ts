import { PART_LOOKS, THEMES, type Page, type PageLook, type SectionNode, type Theme } from '@fieldia/core';
import { applyLook, THEME_SKINS } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';
import type { Designer, LookPatch } from './designer';
import { isSection, nodeOf } from './layout-tree';
import { lookRow } from './look-row';
import { onTab, segmented, setting, type Choice, type Segmented } from './panel-controls';
import type { DesignerWords } from './designer-words';
import { partLookSettings } from './panel-look-parts';

/**
 * The Look tab's settings: looks to start from, then the page's look — its
 * accent, font, spacing, corners, where labels sit and how wide, light or
 * dark, and each kind of part's own — and how a group is drawn. What is set
 * is worn at once by the canvas, as the viewer wears it.
 */

export interface LookSetting {
  /** Its rows, on the Look tab. */
  rows: HTMLElement[];
  update(page: Page): void;
}

/** A few accents to start from; any colour can be picked besides. */
export const SWATCHES: readonly [string, string][] = [
  ['#1677ff', 'Blue'],
  ['#002855', 'Navy'],
  ['#1f7a4d', 'Green'],
  ['#6941c6', 'Purple'],
  ['#c4320a', 'Orange'],
  ['#0e7c86', 'Teal'],
];

type Key = 'font' | 'density' | 'corners' | 'labels' | 'helpShown' | 'readonlyShown' | 'scheme';
/** The look's choices of a few, by their key, in the order they stand: their names and words are the designer's. */
const CHOICES: { key: Key; name: string; values: string[] }[] = [
  { key: 'font', name: 'Font', values: ['system', 'serif', 'rounded'] },
  { key: 'density', name: 'Spacing', values: ['compact', 'comfortable', 'roomy'] },
  { key: 'corners', name: 'Corners', values: ['square', 'soft', 'round'] },
  { key: 'labels', name: 'Labels', values: ['above', 'beside', 'hidden'] },
  { key: 'helpShown', name: 'Help', values: ['below', 'tooltip', 'both'] },
  { key: 'readonlyShown', name: 'Read-only fields', values: ['text', 'box'] },
  { key: 'scheme', name: 'Colours', values: ['light', 'dark', 'auto'] },
];

/** A choice of the look in the designer's words: its name, each value's words, a hint. */
function lookChoice(w: DesignerWords['panel'], key: Key, value: string): Choice<string> {
  switch (key) {
    case 'font':
      return { value, words: w.fonts[value as keyof typeof w.fonts] };
    case 'density':
      return { value, words: w.spacings[value as keyof typeof w.spacings] };
    case 'corners':
      return { value, words: w.cornerKinds[value as keyof typeof w.cornerKinds] };
    case 'labels':
      return value === 'hidden' ? { value, words: w.inTheBox, title: w.inBoxTitle } : { value, words: value === 'above' ? w.above : w.beside };
    case 'helpShown':
      return { value, words: w.helpWays[value as keyof typeof w.helpWays] };
    case 'readonlyShown':
      return { value, words: w.readonlyWays[value as keyof typeof w.readonlyWays] };
    default:
      return value === 'auto' ? { value, words: w.schemes.auto, title: w.schemeAutoTitle } : { value, words: w.schemes[value as 'light' | 'dark'] };
  }
}
const lookName = (w: DesignerWords['panel'], key: Key) => ({ font: w.font, density: w.spacing, corners: w.corners, labels: w.labels, helpShown: w.help, readonlyShown: w.readonlyFields, scheme: w.colours })[key];
const lookHint = (w: DesignerWords['panel'], key: Key) => (key === 'density' ? w.spacingHint : key === 'labels' ? w.labelsHint : key === 'helpShown' ? w.helpShownHint : key === 'readonlyShown' ? w.readonlyShownHint : undefined);

/** The themes by the names people know them by: names, so the same in every language. */
const THEME_NAMES: Record<Theme, string> = {
  material: 'Material', fluent: 'Fluent', apple: 'Apple', bootstrap: 'Bootstrap', shadcn: 'shadcn', ant: 'Ant Design', odoo: 'Odoo', 'google-forms': 'Google Forms',
};

/** The page's look, setting by setting. Pressing what is pressed gives the setting back to the skin. */
export function pageLookSettings(el: ElementFactory, designer: Designer): LookSetting {
  const w = designer.words.panel;
  // ---- a theme in a known system's style: the settings below still change it ----
  const themes = el(
    'select',
    { class: 'fd-input fd-insp-theme', 'aria-label': w.theme },
    el('option', { value: '' }, w.themeNone),
    ...THEMES.map((theme) => el('option', { value: theme }, THEME_NAMES[theme]))
  ) as HTMLSelectElement;
  themes.addEventListener('change', () => designer.setLook({ theme: (themes.value || null) as Theme | null }));
  const themeRow = setting(el, 'look', 'Theme', themes, { hint: w.themeHint, words: w.theme });
  const presets = lookRow(el, designer);
  // ---- the accent: a swatch, or any colour ----
  const swatches = segmented<string>(
    el,
    w.accentColour,
    SWATCHES.map(([value, name]) => ({ value, words: '', label: w.swatches[value] ?? name })),
    (value) => designer.setLook({ accent: value }),
    { toggle: true, className: 'fd-insp-swatches' }
  );
  for (const button of swatches.element.querySelectorAll<HTMLElement>('[data-choice]')) button.style.setProperty('--fd-swatch', button.dataset['choice'] as string);
  const any = el('input', { type: 'color', class: 'fd-insp-colour', 'aria-label': w.anyAccent, title: w.anyColour });
  any.addEventListener('input', () => designer.setLook({ accent: any.value }));
  const skins = el('button', { type: 'button', class: 'fd-button fd-button-link fd-insp-reset', 'aria-label': w.accentAsSkin }, w.asTheSkin);
  skins.addEventListener('click', () => designer.setLook({ accent: null }));
  const accent = setting(el, 'look', 'Accent colour', [swatches.element, el('div', { class: 'fd-insp-any' }, el('label', { class: 'fd-insp-any-colour' }, any, el('span', {}, w.anyColour)), skins)], {
    hint: w.accentHint,
    words: w.accentColour,
  });

  // ---- the choices of a few ----
  const segs = new Map<Key, Segmented<string>>();
  const rows = CHOICES.map(({ key, name, values }) => {
    const seg = segmented<string>(el, lookName(w, key), values.map((value) => lookChoice(w, key, value)), (value) => designer.setLook({ [key]: value } as LookPatch), { toggle: true });
    segs.set(key, seg);
    return setting(el, 'look', name, seg.element, { hint: lookHint(w, key), words: lookName(w, key) });
  });

  // ---- how wide labels beside their boxes are ----
  const slider = el('input', { type: 'range', class: 'fd-insp-slider', min: '60', max: '320', step: '10', 'aria-label': w.labelWidth });
  const number = el('input', { type: 'number', class: 'fd-input fd-insp-number', min: '60', max: '320', step: '1', 'aria-label': w.labelWidth });
  const width = (value: string) => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 60 && n <= 320) designer.setLook({ labelWidth: n });
  };
  slider.addEventListener('input', () => width(slider.value));
  number.addEventListener('input', () => width(number.value));
  const widthRow = setting(el, 'look', 'Label width', [el('div', { class: 'fd-insp-range' }, slider, number, el('span', { class: 'fd-insp-unit' }, w.px))], { words: w.labelWidth });
  const readonlyRow = rows[CHOICES.findIndex((c) => c.key === 'readonlyShown')];
  const labelsAt = CHOICES.findIndex((c) => c.key === 'labels');
  rows.splice(labelsAt + 1, 0, widthRow);

  const parts = partLookSettings(el, designer);
  const note = onTab(el('p', { class: 'fd-properties-hint' }, w.tokensNote), 'look');
  return {
    rows: [themeRow, ...presets.rows, accent, ...rows, parts.row, note],
    update(page) {
      presets.update(page);
      parts.update(page);
      const look: PageLook = page.look ?? {};
      themes.value = look.theme ?? '';
      swatches.set(look.accent?.toLowerCase());
      skins.hidden = !look.accent;
      if (any.ownerDocument.activeElement !== any) any.value = look.accent?.toLowerCase() ?? '#1677ff';
      for (const [key, seg] of segs) seg.set(look[key]);
      // Read-only fields are a record's: a survey's answers are all to be given.
      readonlyRow.hidden = page.data.kind !== 'record';
      widthRow.hidden = look.labels !== 'beside';
      const value = String(look.labelWidth ?? 140);
      if (number.ownerDocument.activeElement !== number) number.value = value;
      if (number.ownerDocument.activeElement !== slider) slider.value = value;
    },
  };
}

/** Small drawings of each way a group is drawn. Constant shapes, never words from a page. */
const STYLES: [NonNullable<SectionNode['style']>, string, string][] = [
  ['card', 'Card', '<rect x="4" y="4" width="36" height="22" rx="4" fill="none" stroke="currentColor"/><path d="M9 11h14" stroke="currentColor"/>'],
  ['plain', 'Plain', '<path d="M9 11h14M9 17h26M9 21h20" stroke="currentColor" opacity=".7"/>'],
  ['line', 'Line', '<path d="M6 9h16M6 13h32" stroke="currentColor"/><path d="M6 19h26" stroke="currentColor" opacity=".5"/>'],
  ['framed', 'Framed', '<rect x="4" y="7" width="36" height="19" rx="2" fill="none" stroke="currentColor"/><path d="M8 7h12" stroke="var(--fd-surface)" stroke-width="3"/><path d="M9 7h10" stroke="currentColor"/>'],
  ['inline', 'One line', '<path d="M4 15h7" stroke="currentColor" opacity=".7"/><rect x="13" y="11" width="9" height="8" rx="1.5" fill="none" stroke="currentColor"/><path d="M24 15h4" stroke="currentColor" opacity=".7"/><rect x="30" y="11" width="10" height="8" rx="1.5" fill="none" stroke="currentColor"/>'],
];

/** How a group is drawn: a card, plain, a line under its title, or a frame with the title on it. */
export function groupStyleSetting(el: ElementFactory, designer: Designer, id: string): LookSetting {
  const w = designer.words.panel;
  const picture = (shape: string) => {
    const box = el('span', { class: 'fd-insp-style-picture', 'aria-hidden': 'true' });
    box.innerHTML = `<svg viewBox="0 0 44 30" focusable="false">${shape}</svg>`;
    return box;
  };
  const style = segmented<string>(
    el,
    w.style,
    STYLES.map(([value, , shape]) => ({ value, words: w.styles[value], picture: picture(shape) })),
    (value) => {
      if (value) designer.setSectionLook(id, { style: value as NonNullable<SectionNode['style']> });
    },
    { className: 'fd-insp-styles' }
  );
  const row = setting(el, 'look', 'Style', style.element, { hint: w.styleHint, words: w.style });
  return {
    rows: [row],
    update(page) {
      const section = nodeOf(page, id);
      if (isSection(section)) style.set(section.style ?? 'card');
    },
  };
}

const WORN = ['data-fd-theme', 'data-font', 'data-density', 'data-corners', 'data-scheme', 'data-accent'];
/** The tokens of each kind of part's look, as the viewer names them: `--fd-inputs-bg`, … */
const PART_TOKENS = ['bg', 'border', 'radius', 'size', 'accent', 'accent-text'];
const WORN_TOKENS = ['--fd-label-width', '--fd-look-accent', '--fd-look-accent-text', '--fd-look-accent-dark', '--fd-look-accent-dark-text'];

/**
 * Wear the page's look on part of the editor — the canvas, the survey's
 * cards — as the viewer wears it on a form: a setting taken back is taken
 * off too. It wears the skin of the editor round it.
 */
export function wearLook(element: HTMLElement, look: PageLook | undefined): void {
  // A theme brings its own skin; else the editor's round it.
  const skin = look?.theme ? THEME_SKINS[look.theme] : (element.parentElement?.closest('[data-fd-skin]')?.getAttribute('data-fd-skin') ?? null);
  // The same look and skin as last time: worn already. Taken off and put on again, the whole part would be styled anew.
  const was = worn.get(element);
  if (was && was.look === look && was.skin === skin) return;
  worn.set(element, { look, skin });
  if (!element.classList.contains('fd-form') || !element.classList.contains('fd-look-worn')) element.classList.add('fd-form', 'fd-look-worn');
  if (skin && element.getAttribute('data-fd-skin') !== skin) element.setAttribute('data-fd-skin', skin);
  for (const name of WORN) element.removeAttribute(name);
  for (const token of WORN_TOKENS) element.style.removeProperty(token);
  // Each kind of part's: its name on the part, and every token of that kind.
  for (const kind of Object.keys(PART_LOOKS)) {
    element.removeAttribute(`data-${kind}`);
    for (const token of PART_TOKENS) element.style.removeProperty(`--fd-${kind}-${token}`);
  }
  applyLook(element, look);
}

/** The look and skin each part wears now. */
const worn = new WeakMap<HTMLElement, { look: PageLook | undefined; skin: string | null }>();
