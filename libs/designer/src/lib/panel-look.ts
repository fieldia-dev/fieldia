import type { Page, PageLook, SectionNode } from '@fieldia/core';
import { applyLook } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';
import type { Designer, LookPatch } from './designer';
import { isSection, nodeOf } from './layout-tree';
import { onTab, segmented, setting, type Choice, type Segmented } from './panel-controls';

/**
 * The Look tab's settings: the page's look — its accent, font, spacing,
 * corners, where labels sit and how wide, light or dark — and how a group is
 * drawn. What is set is worn at once by the canvas, as the viewer wears it.
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

type Key = 'font' | 'density' | 'corners' | 'labels' | 'scheme';
const CHOICES: { key: Key; name: string; choices: Choice<string>[]; hint?: string }[] = [
  { key: 'font', name: 'Font', choices: [{ value: 'system', words: 'System' }, { value: 'serif', words: 'Serif' }, { value: 'rounded', words: 'Rounded' }] },
  {
    key: 'density',
    name: 'Spacing',
    choices: [{ value: 'compact', words: 'Compact' }, { value: 'comfortable', words: 'Comfortable' }, { value: 'roomy', words: 'Roomy' }],
    hint: 'Compact suits long office forms; roomy, a short public one.',
  },
  { key: 'corners', name: 'Corners', choices: [{ value: 'square', words: 'Square' }, { value: 'soft', words: 'Soft' }, { value: 'round', words: 'Round' }] },
  {
    key: 'labels',
    name: 'Labels',
    choices: [{ value: 'above', words: 'Above' }, { value: 'beside', words: 'Beside' }, { value: 'hidden', words: 'In the box', title: 'Inside the box, as its placeholder; still read out by screen readers' }],
    hint: 'Where every label sits, unless a group or a field says otherwise.',
  },
  { key: 'scheme', name: 'Colours', choices: [{ value: 'light', words: 'Light' }, { value: 'dark', words: 'Dark' }, { value: 'auto', words: 'Auto', title: 'As the reader’s system has it' }] },
];

/** The page's look, setting by setting. Pressing what is pressed gives the setting back to the skin. */
export function pageLookSettings(el: ElementFactory, designer: Designer): LookSetting {
  // ---- the accent: a swatch, or any colour ----
  const swatches = segmented<string>(
    el,
    'Accent colour',
    SWATCHES.map(([value, name]) => ({ value, words: '', label: name })),
    (value) => designer.setLook({ accent: value }),
    { toggle: true, className: 'fd-insp-swatches' }
  );
  for (const button of swatches.element.querySelectorAll<HTMLElement>('[data-choice]')) button.style.setProperty('--fd-swatch', button.dataset['choice'] as string);
  const any = el('input', { type: 'color', class: 'fd-insp-colour', 'aria-label': 'Any accent colour', title: 'Any colour' });
  any.addEventListener('input', () => designer.setLook({ accent: any.value }));
  const skins = el('button', { type: 'button', class: 'fd-button fd-button-link fd-insp-reset', 'aria-label': 'Accent as the skin has it' }, 'As the skin');
  skins.addEventListener('click', () => designer.setLook({ accent: null }));
  const accent = setting(el, 'look', 'Accent colour', [swatches.element, el('div', { class: 'fd-insp-any' }, el('label', { class: 'fd-insp-any-colour' }, any, el('span', {}, 'Any colour')), skins)], {
    hint: 'Buttons, the tab and the box being typed in, and the band under the title.',
  });

  // ---- the choices of a few ----
  const segs = new Map<Key, Segmented<string>>();
  const rows = CHOICES.map(({ key, name, choices, hint }) => {
    const seg = segmented<string>(el, name, choices, (value) => designer.setLook({ [key]: value } as LookPatch), { toggle: true });
    segs.set(key, seg);
    return setting(el, 'look', name, seg.element, { hint });
  });

  // ---- how wide labels beside their boxes are ----
  const slider = el('input', { type: 'range', class: 'fd-insp-slider', min: '60', max: '320', step: '10', 'aria-label': 'Label width' });
  const number = el('input', { type: 'number', class: 'fd-input fd-insp-number', min: '60', max: '320', step: '1', 'aria-label': 'Label width' });
  const width = (value: string) => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 60 && n <= 320) designer.setLook({ labelWidth: n });
  };
  slider.addEventListener('input', () => width(slider.value));
  number.addEventListener('input', () => width(number.value));
  const widthRow = setting(el, 'look', 'Label width', [el('div', { class: 'fd-insp-range' }, slider, number, el('span', { class: 'fd-insp-unit' }, 'px'))]);
  const labelsAt = CHOICES.findIndex((c) => c.key === 'labels');
  rows.splice(labelsAt + 1, 0, widthRow);

  const note = onTab(el('p', { class: 'fd-properties-hint' }, 'These are the form’s own tokens: every field follows them, and a dark scheme keeps working.'), 'look');
  return {
    rows: [accent, ...rows, note],
    update(page) {
      const look: PageLook = page.look ?? {};
      swatches.set(look.accent?.toLowerCase());
      skins.hidden = !look.accent;
      if (any.ownerDocument.activeElement !== any) any.value = look.accent?.toLowerCase() ?? '#1677ff';
      for (const [key, seg] of segs) seg.set(look[key]);
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
];

/** How a group is drawn: a card, plain, a line under its title, or a frame with the title on it. */
export function groupStyleSetting(el: ElementFactory, designer: Designer, id: string): LookSetting {
  const picture = (shape: string) => {
    const box = el('span', { class: 'fd-insp-style-picture', 'aria-hidden': 'true' });
    box.innerHTML = `<svg viewBox="0 0 44 30" focusable="false">${shape}</svg>`;
    return box;
  };
  const style = segmented<string>(
    el,
    'Style',
    STYLES.map(([value, words, shape]) => ({ value, words, picture: picture(shape) })),
    (value) => {
      if (value) designer.setSectionLook(id, { style: value as NonNullable<SectionNode['style']> });
    },
    { className: 'fd-insp-styles' }
  );
  const row = setting(el, 'look', 'Style', style.element, { hint: 'Plain draws nothing round it: with no title, its parts simply sit side by side.' });
  return {
    rows: [row],
    update(page) {
      const section = nodeOf(page, id);
      if (isSection(section)) style.set(section.style ?? 'card');
    },
  };
}

const WORN = ['data-font', 'data-density', 'data-corners', 'data-scheme', 'data-accent'];
const WORN_TOKENS = ['--fd-label-width', '--fd-look-accent', '--fd-look-accent-text', '--fd-look-accent-dark', '--fd-look-accent-dark-text'];

/**
 * Wear the page's look on part of the editor — the canvas, the survey's
 * cards — as the viewer wears it on a form: a setting taken back is taken
 * off too. It wears the skin of the editor round it.
 */
export function wearLook(element: HTMLElement, look: PageLook | undefined): void {
  const skin = element.parentElement?.closest('[data-fd-skin]')?.getAttribute('data-fd-skin') ?? null;
  // The same look and skin as last time: worn already. Taken off and put on again, the whole part would be styled anew.
  const was = worn.get(element);
  if (was && was.look === look && was.skin === skin) return;
  worn.set(element, { look, skin });
  if (!element.classList.contains('fd-form') || !element.classList.contains('fd-look-worn')) element.classList.add('fd-form', 'fd-look-worn');
  if (skin && element.getAttribute('data-fd-skin') !== skin) element.setAttribute('data-fd-skin', skin);
  for (const name of WORN) element.removeAttribute(name);
  for (const token of WORN_TOKENS) element.style.removeProperty(token);
  applyLook(element, look);
}

/** The look and skin each part wears now. */
const worn = new WeakMap<HTMLElement, { look: PageLook | undefined; skin: string | null }>();
