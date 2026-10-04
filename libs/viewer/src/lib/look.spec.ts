import type { Page, PageLook } from '@fieldia/core';
import { accentShades, applyLook, contrast } from './look';
import { mountViewer, type ViewerHandle } from './viewer';

/** The page's look: an accent, a font, room, corners, labels and a colour scheme, as the form's own tokens. */

describe('the accent’s shades', () => {
  it('keeps the colour as given, and writes on it in white unless white reads poorly there', () => {
    const blue = accentShades('#1677ff');
    expect(blue.accent).toBe('#1677ff');
    expect(blue.accentText).toBe('#ffffff');
    expect(accentShades('#1f7a4d').accentText).toBe('#ffffff');
    const yellow = accentShades('#ffd60a');
    expect(yellow.accentText).toBe('#111418');
    expect(contrast(yellow.accent, yellow.accentText)).toBeGreaterThanOrEqual(4.5);
    // Just under 3:1 with white, as #f08c00 is: ink.
    expect(contrast('#f08c00', '#ffffff')).toBeLessThan(3);
    expect(accentShades('#f08c00').accentText).toBe('#111418');
    // Between 3:1 and 4:1, as #3b82f6 is: still white, as a button's words are read.
    expect(contrast('#3b82f6', '#ffffff')).toBeGreaterThan(3);
    expect(contrast('#3b82f6', '#ffffff')).toBeLessThan(4);
    expect(accentShades('#3b82f6').accentText).toBe('#ffffff');
  });

  it('lightens a dark accent for a dark page until it reads on it, and leaves a light one alone', () => {
    const navy = accentShades('#002855');
    expect(contrast(navy.dark, '#1f2329')).toBeGreaterThanOrEqual(4.5);
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
