import { expect, test } from './fixtures';
import { node, open, screen } from './support';
import type { Locator, Page } from '@playwright/test';

/**
 * A host's tick boxes and radios, sized and drawn by its tokens (0.35, NexiBI's request): --fd-tick-size, --fd-tick-line,
 * --fd-tick-edge and --fd-tick-radius. At 14, 18 and 24 pixels — 14 as a design system's own box: 1.5px, an ink edge, a
 * 3px corner — a tick, a dot and a dash are drawn whole inside the box, in proportion to it; each is pressed anywhere in
 * 24 pixels round it however small it is; the keys ring it; forced colours give the system's own at the same size; on
 * paper the one chosen prints chosen.
 */

const INK = 'rgb(31, 35, 40)';

/** The host's tokens on every form of the page: a box of `size`, and at 14 a design system's own edge and corner. */
const wear = (page: Page, size: number) =>
  page.addStyleTag({ content: `.fd-form { --fd-tick-size: ${size}px;${size === 14 ? ` --fd-tick-line: 1.5px; --fd-tick-edge: ${INK}; --fd-tick-radius: 3px;` : ''} }` });

/**
 * A box as the person sees it: its size, edge and corner; its press target; and its mark (tick, dot or dash) laid out
 * again by the browser from the mark's own computed style in a copy of the box — a pseudo-element has no box of its
 * own to measure — whether it lies whole inside the box's edge, and how big it is.
 */
function seen(box: Locator) {
  return box.evaluate((input: HTMLInputElement) => {
    const own = getComputedStyle(input);
    const mark = getComputedStyle(input, '::before');
    const target = getComputedStyle(input, '::after');
    const rect = input.getBoundingClientRect();
    const copy = document.createElement('div');
    const glyph = document.createElement('span');
    const take = (to: HTMLElement, from: CSSStyleDeclaration, names: string[]) => {
      for (const name of names) to.style.setProperty(name, from.getPropertyValue(name));
    };
    take(copy, own, ['display', 'place-content', 'box-sizing', 'width', 'height', 'padding', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-style']);
    take(glyph, mark, ['display', 'box-sizing', 'width', 'height', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-style', 'border-radius', 'transform']);
    Object.assign(copy.style, { position: 'fixed', left: '200px', top: '200px', direction: own.direction });
    copy.append(glyph);
    document.body.append(copy);
    const outer = copy.getBoundingClientRect();
    const g = glyph.getBoundingClientRect();
    copy.remove();
    const line = parseFloat(own.borderTopWidth);
    const slack = 0.05;
    const inside = g.left >= outer.left + line - slack && g.right <= outer.right - line + slack && g.top >= outer.top + line - slack && g.bottom <= outer.bottom - line + slack;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const lands = [
      [cx - 11.5, cy],
      [cx + 11.5, cy],
      [cx, cy - 11.5],
      [cx, cy + 11.5],
    ].every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit === input || (!!hit && !!input.labels && [...input.labels].some((label) => label.contains(hit)));
    });
    // An edge as this engine draws one of the token's width (Chromium snaps 1.5px to whole device pixels).
    const probe = document.createElement('span');
    probe.style.border = `${own.getPropertyValue('--fd-tick-line').trim() || '1.5px'} solid`;
    document.body.append(probe);
    const drawnLine = parseFloat(getComputedStyle(probe).borderTopWidth);
    probe.remove();
    return {
      width: rect.width,
      height: rect.height,
      line,
      lineToken: own.getPropertyValue('--fd-tick-line').trim(),
      drawnLine,
      edge: own.borderTopColor,
      radius: own.borderTopLeftRadius,
      appearance: own.appearance,
      shown: mark.visibility === 'visible' && mark.content !== 'none',
      inside,
      mark: [g.width, g.height],
      target: [parseFloat(target.width), parseFloat(target.height)],
      lands,
      outline: `${own.outlineStyle} ${own.outlineWidth}`,
      tick: mark.borderRightColor || mark.borderBottomColor,
    };
  });
}

for (const size of [14, 18, 24]) {
  test(`at ${size}px: a tick, a dot and a dash whole inside the box, pressed in 24px round it, ringed by the keys`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined');
    await wear(page, size);
    const floor = node(page, 'q-kitchen-floor');
    await floor.scrollIntoViewIfNeeded();
    await floor.locator('.fd-choice').first().click();
    const radio = floor.getByRole('radio').first();
    const guide = node(page, 'q-guide').getByRole('checkbox');
    await guide.click();
    await expect(radio).toBeChecked();
    await expect(guide).toBeChecked();
    const marks: Record<string, Awaited<ReturnType<typeof seen>>> = { tick: await seen(guide), dot: await seen(radio) };
    // A dash: the same box as some of a list's rows chosen draws it.
    await guide.evaluate((input: HTMLInputElement) => (input.indeterminate = true));
    marks['dash'] = await seen(guide);
    for (const [kind, box] of Object.entries(marks)) {
      expect({ kind, width: box.width, height: box.height }).toEqual({ kind, width: size, height: size });
      expect({ kind, shown: box.shown, inside: box.inside }).toEqual({ kind, shown: true, inside: true });
      // In proportion to the box: as 18px draws it (a tick 6 by 11, a dot 8, a dash 10), scaled.
      expect(Math.max(...box.mark), kind).toBeGreaterThanOrEqual((size / 18) * (kind === 'tick' ? 9 : kind === 'dot' ? 8 : 10) * 0.9);
      expect({ kind, target: box.target.every((side) => side >= 24), lands: box.lands }).toEqual({ kind, target: true, lands: true });
    }
    await guide.evaluate((input: HTMLInputElement) => (input.indeterminate = false));
    if (size === 14) {
      // A design system's own box: its edge's width and colour, its corner (a radio stays round).
      const rest = await seen(page.locator('.fd-form input[type="checkbox"]:not(.fd-switch):not(:checked)').first());
      expect({ line: rest.lineToken, edge: rest.edge, radius: rest.radius }).toEqual({ line: '1.5px', edge: INK, radius: '3px' });
      expect(rest.line).toBe(rest.drawnLine);
      expect((await seen(radio)).radius).toBe('50%');
    }
    // Reached by the keys: a ring round it.
    await guide.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(guide).toBeFocused();
    expect((await seen(guide)).outline).toBe('solid 2px');
    await screen(page, `tick-tokens-${size}`);
    // On paper, the chosen one in ink; with forced colours, the system's own, the same size.
    await page.emulateMedia({ media: 'print' });
    expect((await seen(radio)).tick).toBe(await page.locator('.fd-form').first().evaluate((form) => getComputedStyle(form).color));
    await page.emulateMedia({ media: 'screen', forcedColors: 'active' });
    const forced = await seen(guide);
    expect({ appearance: forced.appearance, width: forced.width }).toEqual({ appearance: 'auto', width: size });
    await page.emulateMedia({ forcedColors: 'none' });
    expect(problems).toEqual([]);
  });
}
