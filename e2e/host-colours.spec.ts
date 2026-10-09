import { expect, test, type Page } from '@playwright/test';
import { open } from './support';

/**
 * A form in a host page's own colours. Every field type, in the outlined skin,
 * made dark two ways: by the page's own scheme, and by a host stylesheet that
 * sets Fieldia's colour variables on the form, as an app with its own themes
 * does. Each label, value and help text reads at 4.5:1 against what is painted
 * behind it. Then the supported way to colour a form from outside, `tokens`.
 */

/** A host's dark theme, set on the form by a rule of the host's own: no more specific than it needs to be. */
const HOST_DARK = `.host-dark .fd-form {
  --fd-text: rgb(230, 237, 233); --fd-muted: rgb(168, 180, 174); --fd-page: rgb(20, 26, 24); --fd-surface: rgb(27, 35, 32);
  --fd-border: rgb(70, 80, 76); --fd-border-strong: rgb(110, 122, 116); --fd-accent: rgb(64, 196, 150); --fd-accent-text: rgb(10, 20, 16);
  --fd-focus: rgb(64, 196, 150); --fd-error: rgb(255, 138, 122); --fd-fill: rgb(36, 46, 42);
}`;

/** Every label, value and help text shown, with its colour and the colour painted behind it, and their contrast. */
async function contrasts(page: Page): Promise<{ what: string; ratio: number }[]> {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(/[,\s/]+/).filter(Boolean);
      return { r: +r, g: +g, b: +b, a: +a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    /** The colour painted behind an element: the nearest ground that is not see-through. */
    const ground = (el: Element) => {
      for (let at: Element | null = el; at; at = at.parentElement) {
        const c = parse(getComputedStyle(at).backgroundColor);
        if (c && c.a > 0.5) return c;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const out: { what: string; ratio: number }[] = [];
    const form = document.querySelector('.fd-form')!;
    for (const el of form.querySelectorAll('.fd-label, .fd-help, input.fd-input, textarea.fd-input, select.fd-input, .fd-choice-label, .fd-section-title')) {
      const box = (el as HTMLElement).getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(el).visibility === 'hidden') continue;
      if ((el as HTMLInputElement).disabled) continue;
      const fg = parse(getComputedStyle(el).color);
      if (!fg) continue;
      const bg = ground(el);
      // A see-through colour reads as itself laid over its ground.
      const over = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
      const [hi, lo] = [lum(over), lum(bg)].sort((a, b) => b - a);
      const field = el.closest('[data-field]')?.getAttribute('data-field') ?? '';
      out.push({ what: `${el.className.toString().split(' ')[0]} ${field}`.trim(), ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 });
    }
    return out;
  });
}
const unreadable = (all: { what: string; ratio: number }[]) => all.filter((c) => c.ratio < 4.5).map((c) => `${c.what}: ${c.ratio}`);

test('every field type in the outlined skin reads at 4.5:1 in the page’s own dark scheme', async ({ page }) => {
  await open(page, 'plain', 'page=fields&skin=outlined&scheme=dark');
  const all = await contrasts(page);
  expect(all.length).toBeGreaterThan(40);
  expect(unreadable(all)).toEqual([]);
});

test('every field type in the outlined skin reads at 4.5:1 in a host’s own dark colours, set on the form by the host', async ({ page }) => {
  await open(page, 'plain', 'page=fields&skin=outlined');
  // The host's stylesheet comes first in the document, as an app's does: Fieldia puts its own in when it mounts.
  await page.evaluate((css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.prepend(style);
  }, HOST_DARK);
  await page.locator('.fd-form').first().evaluate((form) => form.parentElement!.classList.add('host-dark'));
  // The host's colours, whole: its text on its surface, not Fieldia's skin over half of them.
  await expect.poll(() => page.locator('.fd-label').first().evaluate((l) => getComputedStyle(l).color)).toBe('rgb(230, 237, 233)');
  const all = await contrasts(page);
  expect(all.length).toBeGreaterThan(40);
  expect(unreadable(all)).toEqual([]);
});

test('a danger button pressed on a dark page keeps its words readable on the error’s colour', async ({ page }) => {
  await open(page, 'plain', 'page=customer&skin=underline&scheme=dark');
  const block = page.getByRole('button', { name: 'Block', exact: true });
  await block.hover();
  const ratio = await block.evaluate((b) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const style = getComputedStyle(b);
    const [hi, lo] = [lum(parse(style.color)), lum(parse(style.backgroundColor))].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('tokens: a host recolours the primary button and a focused box from outside, naming no Fieldia selector', async ({ page }) => {
  await page.goto('/script/');
  await page.waitForFunction(() => 'Fieldia' in window);
  const read = () =>
    page.evaluate(async () => {
      const host = document.getElementById('tokens-host')!;
      const button = host.querySelector('.fd-button-primary') as HTMLElement;
      const input = host.querySelector('input.fd-input') as HTMLInputElement;
      input.blur();
      input.focus();
      // The box's edge eases to its focused colour: read where it settles.
      await new Promise((done) => setTimeout(done, 500));
      return { button: getComputedStyle(button).backgroundColor, focused: getComputedStyle(input).borderBottomColor };
    });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'tokens-host';
    document.body.prepend(host);
    const W = window as any;
    W.handle = W.Fieldia.mountViewer(host, {
      page: { fieldia: '0.1', id: 't', title: 'Tokens', data: { kind: 'responses' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f', field: 'name' }] } },
      dataSource: W.Fieldia.createMemoryDataSource(),
      skin: 'outlined',
      theme: 'material',
      tokens: { accent: 'rgb(15, 118, 110)', 'accent-text': 'rgb(255, 255, 255)', focus: 'rgb(15, 118, 110)' },
    });
  });
  expect(await read()).toEqual({ button: 'rgb(15, 118, 110)', focused: 'rgb(15, 118, 110)' });
  // The app turns another colour: the same form, in place.
  await page.evaluate(() => (window as any).handle.setTokens({ accent: 'rgb(180, 83, 9)', focus: 'rgb(180, 83, 9)' }));
  expect(await read()).toEqual({ button: 'rgb(180, 83, 9)', focused: 'rgb(180, 83, 9)' });
});
