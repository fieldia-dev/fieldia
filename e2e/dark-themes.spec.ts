import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * Dark, every theme's form sits on the app's dark page as a shade of it —
 * never a pure-black slab in a grey page, as Apple's and Ant's were. Its
 * ground's lightness (CIELAB L*) is between 5 and 15, as dark pages' are, and
 * its cards stand off it, lighter.
 */

const THEMES = ['material', 'fluent', 'apple', 'bootstrap', 'shadcn', 'ant', 'odoo', 'google-forms'] as const;

for (const theme of THEMES) {
  test(`${theme}, dark: the form’s ground is a dark grey, its cards lighter`, async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'colours are the same in every engine');
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await open(page, 'plain', `page=template-contact-us&theme=${theme}&scheme=dark&skin=outlined`);
    await expect(page.locator(`.fd-form[data-fd-theme="${theme}"]`)).toBeVisible();
    const [ground, card] = await page.evaluate(() => {
      const lightness = (colour: string) => {
        const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number).map((c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
      };
      const form = document.querySelector('.fd-form') as HTMLElement;
      // A card's colour, as the theme gives it: painted on a probe, so it reads back as rgb().
      const probe = document.createElement('div');
      probe.style.background = 'var(--fd-surface)';
      form.append(probe);
      const card = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return [lightness(getComputedStyle(form).backgroundColor), lightness(card)];
    });
    expect(ground).toBeGreaterThanOrEqual(5);
    expect(ground).toBeLessThanOrEqual(15);
    expect(card).toBeGreaterThan(ground);
    await screen(page, `dark-theme-${theme}`, { viewport: true });
    expect(problems).toEqual([]);
  });
}
