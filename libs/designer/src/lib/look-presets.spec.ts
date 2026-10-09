import type { PageLook } from '@fieldia/core';
import { accentShades, contrast } from '@fieldia/viewer';
import { blankPage, createDesigner } from './designer';
import { LOOK_PRESETS, presetOf } from './look-presets';
import { mount, openTab } from './test-editor';

/**
 * Looks to start from, as SurveyJS and Vueform name their themes: a short
 * row on the page's Look tab, each a set of look values — accent, font,
 * spacing, corners, light or dark — put on the page as one undo step. A look
 * that is none of them is "Your own"; a page with none set is as the skin
 * draws it. Every preset reads well in a light scheme and a dark one.
 */

/** The dark scheme's surface, which an accent must read on. */
const DARK_SURFACE = '#1f2329';

describe('the presets', () => {
  it('are a short row of named looks, Night the dark one', () => {
    expect(LOOK_PRESETS.map((p) => p.name)).toEqual(['Fieldia', 'Calm', 'Compact', 'Rounded', 'Night']);
    expect(LOOK_PRESETS.map((p) => p.look.scheme)).toEqual(['light', 'light', 'light', 'light', 'dark']);
    for (const preset of LOOK_PRESETS) expect(Object.keys(preset.look).sort()).toEqual(['accent', 'corners', 'density', 'font', 'scheme']);
  });

  it.each(LOOK_PRESETS.map((p) => [p.name, p.look] as const))('%s reads well, light and dark', (_name, look) => {
    const shades = accentShades(look.accent as string);
    // Light: the accent on the page's surface, and the words on a button of it.
    expect(contrast(shades.accent, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(shades.accent, shades.accentText)).toBeGreaterThanOrEqual(4.5);
    // Dark: the accent as the dark scheme wears it, on its surface, and the words on it.
    expect(contrast(shades.dark, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(shades.dark, shades.darkText)).toBeGreaterThanOrEqual(4.5);
  });

  it('knows the preset a look is, by its five values, whatever the accent’s case, and whatever labels do', () => {
    const calm = LOOK_PRESETS[1];
    expect(presetOf(calm.look)?.name).toBe('Calm');
    expect(presetOf({ ...calm.look, accent: (calm.look.accent as string).toUpperCase() })?.name).toBe('Calm');
    expect(presetOf({ ...calm.look, labels: 'beside', labelWidth: 160 })?.name).toBe('Calm');
    for (const key of ['accent', 'font', 'density', 'corners', 'scheme'] as const) {
      const changed: PageLook = { ...calm.look };
      delete changed[key];
      expect(presetOf(changed)).toBeNull();
    }
    expect(presetOf({ ...calm.look, density: 'compact' })).toBeNull();
    expect(presetOf(undefined)).toBeNull();
    expect(presetOf({})).toBeNull();
  });
});

describe('a preset and each kind of part', () => {
  it('is a whole look: put on, it gives each kind of part back to the page, as one undo step', () => {
    const designer = createDesigner({ page: { ...blankPage('screen', 'Visit'), look: { labels: 'beside', parts: { buttons: { accent: '#6941c6' } } } } });
    expect(designer.setLookPreset('calm')).toBe(true);
    expect(designer.getPage().look).toEqual({ labels: 'beside', ...LOOK_PRESETS[1].look });
    designer.undo();
    expect(designer.getPage().look).toEqual({ labels: 'beside', parts: { buttons: { accent: '#6941c6' } } });
  });

  it('is not the look of a page whose kinds of part have looks of their own', () => {
    expect(presetOf({ ...LOOK_PRESETS[1].look, parts: { inputs: { corners: 'round' } } })).toBeNull();
    for (const preset of LOOK_PRESETS) expect(Object.keys(preset.look)).not.toContain('parts');
  });
});

describe('a preset, picked', () => {
  it('sets every value of its look as one undo step, and keeps where labels sit', () => {
    const designer = createDesigner({ page: { ...blankPage('screen', 'Visit'), look: { labels: 'beside', density: 'roomy' } } });
    expect(designer.setLookPreset('night')).toBe(true);
    expect(designer.getPage().look).toEqual({ labels: 'beside', ...LOOK_PRESETS[4].look });
    expect(designer.setLookPreset('compact')).toBe(true);
    expect(designer.getPage().look).toEqual({ labels: 'beside', ...LOOK_PRESETS[2].look });
    designer.undo();
    expect(designer.getPage().look).toEqual({ labels: 'beside', ...LOOK_PRESETS[4].look });
    designer.undo();
    expect(designer.getPage().look).toEqual({ labels: 'beside', density: 'roomy' });
  });

  it('is refused for a name it does not know', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    expect(designer.setLookPreset('neon')).toBe(false);
    expect(designer.getState().issues).toEqual(['There is no look “neon”']);
  });
});

describe('the presets on the Look tab', () => {
  function lookTab() {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Look');
    const row = () => host.querySelector('.fd-properties [data-setting="Look presets"]') as HTMLElement;
    const pressed = () => [...row().querySelectorAll('button[aria-pressed="true"]')].map((b) => b.querySelector('.fd-look-preset-name')?.textContent);
    const own = () => row().querySelector('.fd-look-own') as HTMLElement;
    const pick = (name: string) => ([...row().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.querySelector('.fd-look-preset-name')?.textContent === name) as HTMLButtonElement).click();
    const canvas = host.querySelector('.fd-canvas') as HTMLElement;
    return { designer, host, row, pressed, own, pick, canvas };
  }

  it('comes right after the theme, a button for each, and says a page with no look is as the skin draws it', () => {
    const { host, row, pressed, own } = lookTab();
    const settings = [...host.querySelectorAll('.fd-properties [role="tabpanel"]:not([hidden]) [data-setting]')];
    expect(settings[0].getAttribute('data-setting')).toBe('Theme');
    expect(settings[1]).toBe(row());
    expect([...row().querySelectorAll('.fd-look-preset-name')].map((n) => n.textContent)).toEqual(['Fieldia', 'Calm', 'Compact', 'Rounded', 'Night']);
    expect(pressed()).toEqual([]);
    expect(own().hidden).toBe(false);
    expect(own().textContent).toBe('As the skin');
  });

  it('puts a preset on the page and the canvas, shows it picked, and Undo takes it back', () => {
    const { designer, pressed, own, pick, canvas } = lookTab();
    pick('Rounded');
    expect(designer.getPage().look).toEqual(LOOK_PRESETS[3].look);
    expect(pressed()).toEqual(['Rounded']);
    expect(own().hidden).toBe(true);
    expect(canvas.getAttribute('data-corners')).toBe('round');
    designer.undo();
    expect(designer.getPage().look).toBeUndefined();
    expect(pressed()).toEqual([]);
  });

  it('shows the look as “Your own” once it is none of them', () => {
    const { designer, pressed, own, pick } = lookTab();
    pick('Calm');
    designer.setLook({ font: 'rounded' });
    expect(pressed()).toEqual([]);
    expect(own().hidden).toBe(false);
    expect(own().textContent).toBe('Your own');
    designer.undo();
    expect(pressed()).toEqual(['Calm']);
  });
});
