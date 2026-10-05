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

describe('a look for each kind of part', () => {
  const root = () => document.createElement('form');
  const token = (form: HTMLElement, name: string) => form.style.getPropertyValue(name);
  /** The light scheme's words, and the dark one's: text, muted words, an error. */
  const LIGHT_WORDS = ['#212529', '#636976', '#c63c3d'];
  const DARK_WORDS = ['#e8eaed', '#a3a9b2', '#ff8a7a'];

  it('names what each kind sets on the form, and hands each value over as a token of that kind', () => {
    const form = root();
    applyLook(form, {
      parts: {
        inputs: { background: '#fff7e6', border: '#c4320a', corners: 'round', textSize: 'large' },
        groups: { corners: 'soft' },
        buttons: { corners: 'square', textSize: 'small' },
        tables: { border: '#cccccc' },
      },
    });
    expect(form.getAttribute('data-inputs')?.split(' ').sort()).toEqual(['bg', 'border', 'radius', 'size']);
    expect(form.getAttribute('data-groups')).toBe('radius');
    expect(form.getAttribute('data-tables')).toBe('border');
    expect(form.hasAttribute('data-choices')).toBe(false);
    // A cream that reads already is kept as it is; an edge is drawn as given.
    expect(token(form, '--fd-inputs-bg')).toBe('#fff7e6');
    expect(token(form, '--fd-inputs-border')).toBe('#c4320a');
    // Corners: a box's as the page's boxes, a group's as the page's cards.
    expect(token(form, '--fd-inputs-radius')).toBe('12px');
    expect(token(form, '--fd-groups-radius')).toBe('10px');
    expect(token(form, '--fd-buttons-radius')).toBe('0px');
    expect([token(form, '--fd-inputs-size'), token(form, '--fd-buttons-size')]).toEqual(['16px', '13px']);
    // Nothing of the page's own look is set by it.
    expect(form.hasAttribute('data-accent')).toBe(false);
  });

  // Never a ground the page's words cannot be read on: kept light on a light page, dark on a dark one.
  it('moves a ground, only as far as it has to, until the page’s words and its accent read on it at 4.5:1', () => {
    for (const given of ['#002855', '#c4320a', '#777777', '#ffd60a', '#1f7a4d', '#000000', '#ffffff', '#fff7e6']) {
      for (const accent of [undefined, '#1677ff', '#6941c6']) {
        const light = root();
        applyLook(light, { accent, parts: { groups: { background: given } } });
        const words = [...LIGHT_WORDS, accent ? accentShades(accent).accent : '#1365d9'];
        expect(Math.min(...words.map((word) => contrast(word, token(light, '--fd-groups-bg'))))).toBeGreaterThanOrEqual(4.5);
        const dark = root();
        applyLook(dark, { accent, scheme: 'dark', parts: { groups: { background: given } } });
        const darkWords = [...DARK_WORDS, accent ? accentShades(accent).dark : '#5aa2ff'];
        expect(Math.min(...darkWords.map((word) => contrast(word, token(dark, '--fd-groups-bg'))))).toBeGreaterThanOrEqual(4.5);
      }
    }
    // No further than it has to be: a pale tint stays, navy stays navy on a dark page.
    const pale = root();
    applyLook(pale, { parts: { inputs: { background: '#f0f7ff' } } });
    expect(token(pale, '--fd-inputs-bg')).toBe('#f0f7ff');
    const navy = root();
    applyLook(navy, { scheme: 'dark', parts: { groups: { background: '#002855' } } });
    expect(token(navy, '--fd-groups-bg')).toBe('#002855');
  });

  it('moves a kind’s accent until words read in it and on it, on the page and on every ground the look gives', () => {
    for (const given of ['#ffd60a', '#9ad0ff', '#1677ff', '#002855']) {
      const light = root();
      applyLook(light, { parts: { buttons: { accent: given }, groups: { background: '#e8f0ff' }, choices: { accent: given, background: '#fff7e6' } } });
      for (const kind of ['buttons', 'choices']) {
        const accent = token(light, `--fd-${kind}-accent`);
        for (const ground of ['#ffffff', '#f2f3f5', token(light, '--fd-groups-bg'), token(light, '--fd-choices-bg')]) expect(contrast(accent, ground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accent, token(light, `--fd-${kind}-accent-text`))).toBeGreaterThanOrEqual(4.5);
      }
      const dark = root();
      applyLook(dark, { scheme: 'dark', parts: { buttons: { accent: given }, groups: { background: '#e8f0ff' } } });
      const accent = token(dark, '--fd-buttons-accent');
      for (const ground of ['#1f2329', token(dark, '--fd-groups-bg')]) expect(contrast(accent, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, token(dark, '--fd-buttons-accent-text'))).toBeGreaterThanOrEqual(4.5);
    }
    // One that reads already is kept, and written on in white.
    const green = root();
    applyLook(green, { parts: { buttons: { accent: '#1f7a4d' } } });
    expect([token(green, '--fd-buttons-accent'), token(green, '--fd-buttons-accent-text')]).toEqual(['#1f7a4d', '#ffffff']);
    expect(green.getAttribute('data-buttons')).toBe('accent');
  });

  it('wears the light and the dark value as the reader’s system has it, when the page says auto', () => {
    const form = root();
    applyLook(form, { scheme: 'auto', parts: { inputs: { background: '#fff7e6', accent: '#ffd60a' } } });
    const light = root();
    applyLook(light, { parts: { inputs: { background: '#fff7e6', accent: '#ffd60a' } } });
    const dark = root();
    applyLook(dark, { scheme: 'dark', parts: { inputs: { background: '#fff7e6', accent: '#ffd60a' } } });
    for (const name of ['--fd-inputs-bg', '--fd-inputs-accent', '--fd-inputs-accent-text']) expect(token(form, name)).toBe(`light-dark(${token(light, name)}, ${token(dark, name)})`);
    expect(token(dark, '--fd-inputs-bg')).not.toBe('#fff7e6');
  });

  it('leaves the form as the skin draws it for a kind given nothing', () => {
    for (const parts of [{}, { inputs: {} }, { buttons: { accent: undefined } }]) {
      const form = root();
      applyLook(form, { parts });
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
