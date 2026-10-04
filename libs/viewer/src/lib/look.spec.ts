import type { Page, PageLook } from '@fieldia/core';
import { accentShades, applyLook, contrast } from './look';
import { mountViewer, type ViewerHandle } from './viewer';

/** The page's look: an accent, a font, room, corners, labels and a colour scheme, as the form's own tokens. */

/** 12% of a colour on another, as the stylesheet mixes an accent's softer shade. */
const soft = (hex: string, on: string) => {
  const c = (h: string) => [1, 3, 5].map((at) => parseInt(h.slice(at, at + 2), 16));
  return `#${c(hex).map((v, i) => Math.round(v * 0.12 + c(on)[i] * 0.88).toString(16).padStart(2, '0')).join('')}`;
};

describe('the accent’s shades', () => {
  it('keeps an accent that already reads, and writes on it in white', () => {
    const green = accentShades('#1f7a4d');
    expect(green.accent).toBe('#1f7a4d');
    expect(green.accentText).toBe('#ffffff');
  });

  // WCAG 1.4.3: the accent is words (a tab, a link) on the page, and has words on it (a button).
  it('darkens an accent for a light page until words read in it and on it, at 4.5:1', () => {
    for (const given of ['#1677ff', '#3b82f6', '#0e7c86', '#f08c00', '#ffd60a', '#9ad0ff']) {
      const { accent, accentText } = accentShades(given);
      expect(contrast(accent, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, '#f2f3f5')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, soft(accent, '#ffffff'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, accentText)).toBeGreaterThanOrEqual(4.5);
    }
    // No darker than it has to be: the outlined skin's blue moves only a little.
    expect(accentShades('#1677ff').accent).toBe('#1365d9');
  });

  it('lightens a dark accent for a dark page until it reads on it, and leaves a light one alone', () => {
    const navy = accentShades('#002855');
    expect(contrast(navy.dark, '#1f2329')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(navy.dark, soft(navy.dark, '#1f2329'))).toBeGreaterThanOrEqual(4.5);
    expect(navy.dark).not.toBe('#002855');
    expect(contrast(navy.dark, navy.darkText)).toBeGreaterThanOrEqual(4.5);
    const pale = accentShades('#9ad0ff');
    expect(pale.dark).toBe('#9ad0ff');
  });

  it('reads #RRGGBB in either case', () => {
    expect(accentShades('#1F7A4D').accent).toBe('#1f7a4d');
  });
});

describe('the look on the form', () => {
  const root = () => document.createElement('form');

  it('names the font, the room, the corners and the scheme for the stylesheet', () => {
    const form = root();
    applyLook(form, { font: 'serif', density: 'roomy', corners: 'round', scheme: 'dark' });
    expect(form.getAttribute('data-font')).toBe('serif');
    expect(form.getAttribute('data-density')).toBe('roomy');
    expect(form.getAttribute('data-corners')).toBe('round');
    expect(form.getAttribute('data-scheme')).toBe('dark');
  });

  it('hands the accent and its shades to the form as tokens', () => {
    const form = root();
    applyLook(form, { accent: '#1f7a4d' });
    expect(form.hasAttribute('data-accent')).toBe(true);
    const shades = accentShades('#1f7a4d');
    expect(form.style.getPropertyValue('--fd-look-accent')).toBe('#1f7a4d');
    expect(form.style.getPropertyValue('--fd-look-accent-text')).toBe(shades.accentText);
    expect(form.style.getPropertyValue('--fd-look-accent-dark')).toBe(shades.dark);
    expect(form.style.getPropertyValue('--fd-look-accent-dark-text')).toBe(shades.darkText);
  });

  it('sets the width of labels beside their boxes for the whole page', () => {
    const form = root();
    applyLook(form, { labelWidth: 120 });
    expect(form.style.getPropertyValue('--fd-label-width')).toBe('120px');
  });

  it('leaves a page with no look exactly as the skin draws it', () => {
    for (const look of [undefined, {} as PageLook]) {
      const form = root();
      applyLook(form, look);
      expect(form.getAttributeNames()).toEqual([]);
    }
  });
});

describe('a page with a look, mounted', () => {
  let handle: ViewerHandle | undefined;
  afterEach(() => {
    handle?.destroy();
    document.body.replaceChildren();
  });

  it('wears it on the form, beside the skin and the page’s width', () => {
    const page: Page = {
      fieldia: '0.1',
      id: 'look',
      title: 'New employee',
      data: { kind: 'responses' },
      maxWidth: 'medium',
      look: { accent: '#1f7a4d', font: 'rounded', density: 'compact', corners: 'soft', scheme: 'auto' },
      fields: { name: { type: 'char', label: 'Name' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }] },
    };
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, skin: 'outlined' });
    const form = host.querySelector('.fd-form') as HTMLElement;
    expect(form.getAttribute('data-fd-skin')).toBe('outlined');
    expect(form.getAttribute('data-max-width')).toBe('medium');
    expect(form.getAttribute('data-font')).toBe('rounded');
    expect(form.getAttribute('data-density')).toBe('compact');
    expect(form.getAttribute('data-corners')).toBe('soft');
    expect(form.getAttribute('data-scheme')).toBe('auto');
    expect(form.style.getPropertyValue('--fd-look-accent')).toBe('#1f7a4d');
  });
});
