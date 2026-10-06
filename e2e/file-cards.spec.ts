import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { FILES } from './files-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Files as cards — a picture over each file's name and size, as the user asked
 * of the "Every field" demo — and the switch that lets the person filling the
 * form flip Documents between cards and a list: with real files chosen, by the
 * pointer and by the keys alone, right to left in Arabic, on a phone, in the
 * dark and in both skins.
 */

const viewer = (page: Page) => page.getByRole('dialog');
const files = (page: Page) => page.locator('.fd-section', { has: node(page, 'f-documents') });
const switcher = (scope: Locator, name = 'Show files as') => scope.getByRole('group', { name });
const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Each card's parts, measured: the picture, the name under it and the size under that, and the name's lines. */
const cardShapes = (scope: Locator) =>
  scope.locator('.fd-file-open').evaluateAll((cards) =>
    cards.map((card) => {
      const [picture, name, size] = [...card.children].map((part) => part.getBoundingClientRect());
      return {
        picture: Math.round(picture.height),
        width: Math.round(card.getBoundingClientRect().width),
        top: Math.round(card.getBoundingClientRect().top),
        under: name.top >= picture.bottom - 0.5 && size.top >= name.bottom - 0.5,
        lines: Math.round(name.height / parseFloat(getComputedStyle(card.children[1]).lineHeight)),
      };
    })
  );

test.describe('files as cards', () => {
  test('shows the job’s files as cards, each name under its picture, the add tile last', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.scrollIntoViewIfNeeded();
    await expect(documents.locator('.fd-file')).toHaveClass(/fd-files-cards/);
    await expect(documents.locator('.fd-file-item')).toHaveCount(4);
    // A large icon by kind where there is no picture; the floor plan's own picture.
    await expect(documents.locator('.fd-file-icon')).toHaveText(['TXT', 'PDF', 'CSV']);
    await expect(documents.locator('.fd-file-icon').first()).toHaveAttribute('data-kind', 'doc');
    await expect(documents.locator('img.fd-file-thumb')).toHaveCount(1);
    await documents.locator('input[type=file]').setInputFiles([FILES.photo(), FILES.quote(), FILES.archive()]);
    await expect(documents.locator('.fd-file-item')).toHaveCount(7);
    await expect(documents.locator('.fd-file-icon').last()).toHaveText('ZIP');

    // The picture on top, the name under it in two lines at most, the size under that; every picture the same height.
    const shapes = await cardShapes(documents);
    expect(shapes.every((s) => s.under && s.lines >= 1 && s.lines <= 2)).toBe(true);
    expect(new Set(shapes.map((s) => s.picture)).size).toBe(1);
    expect(new Set(shapes.map((s) => s.width)).size).toBe(1);
    // A long name cut in the middle: its start on the first line, its end and extension on the second.
    const quote = documents.locator('.fd-file-name').nth(5);
    await expect(quote).toHaveAttribute('title', 'Quote for the 12th floor, revised again before signing.pdf');
    const [start, end] = await quote.evaluate((name) =>
      [...name.children].map((part) => {
        const shown = part.getBoundingClientRect();
        const words = (part.lastElementChild ?? part).getBoundingClientRect();
        return { cut: part.scrollWidth > part.clientWidth, top: shown.top, endShown: Math.abs(words.right - shown.right) < 1, ellipsis: getComputedStyle(part).textOverflow };
      })
    );
    expect([start.cut, end.cut, start.ellipsis, end.ellipsis]).toEqual([true, true, 'ellipsis', 'ellipsis']);
    expect(end.top).toBeGreaterThan(start.top);
    expect(end.endShown).toBe(true);
    // The add tile is the last card, as tall as the cards in its row.
    const last = await box(documents.locator('.fd-file-item').last());
    const pick = await box(documents.locator('.fd-file-pick'));
    expect(pick.y > last.y + 1 || (Math.abs(pick.y - last.y) < 1 && pick.x > last.x)).toBe(true);
    await expect(documents.locator('.fd-file-pick')).toContainText('Add files');

    // Site photos: cards too, with their names under the pictures, and no switch.
    const photos = node(page, 'f-photo');
    await expect(photos.locator('.fd-file')).toHaveClass(/fd-files-cards/);
    await expect(photos.locator('.fd-file-name')).toHaveText(['Reception, before the strip-out.jpg', 'River view from the 12th floor.jpg']);
    expect((await cardShapes(photos)).every((s) => s.under)).toBe(true);
    await expect(photos.locator('.fd-file-views')).toHaveCount(0);
    await files(page).screenshot({ path: 'test-results/screens/file-cards.png' });
    expect(await axeFindings(page, 'files as cards')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('switches Documents to a list and back, and keeps the choice', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.scrollIntoViewIfNeeded();
    const views = switcher(documents);
    await expect(views.getByRole('button')).toHaveText(['List', 'Cards']);
    await expect(views.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');
    // Over the files, at their end, beside the count.
    const [bar, first, field] = [await box(views), await box(documents.locator('.fd-file-item').first()), await box(documents.locator('.fd-file'))];
    expect(bar.y + bar.height).toBeLessThanOrEqual(first.y);
    expect(Math.abs(bar.x + bar.width - (field.x + field.width))).toBeLessThan(2);
    expect(bar.height).toBeGreaterThanOrEqual(24);

    await views.getByRole('button', { name: 'List' }).click();
    await expect(views.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    await expect(documents.locator('.fd-file')).toHaveClass(/fd-files-list/);
    // A row each, the whole width, the drop zone over them; the names cut as a row cuts them.
    expect((await box(documents.locator('.fd-file-item').first())).width).toBeGreaterThan(field.width - 40);
    expect((await box(documents.locator('.fd-file-pick'))).y).toBeLessThan((await box(views)).y);
    await expect(documents.locator('.fd-file-name').first()).toHaveAttribute('dir', 'auto');
    await files(page).screenshot({ path: 'test-results/screens/file-cards-as-list.png' });

    // Opened again, the page shows the list the person chose.
    await page.reload();
    await expect(node(page, 'f-documents').locator('.fd-file')).toHaveClass(/fd-files-list/);
    await switcher(node(page, 'f-documents')).getByRole('button', { name: 'Cards' }).click();
    await expect(node(page, 'f-documents').locator('.fd-file')).toHaveClass(/fd-files-cards/);
    expect(problems).toEqual([]);
  });

  test('opens a file from its card, and asks before × takes one away', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.scrollIntoViewIfNeeded();
    const opener = documents.getByRole('button', { name: /^Lift booking, confirmed\.pdf/ });
    await opener.click();
    await expect(viewer(page).getByRole('heading')).toHaveText('Lift booking, confirmed.pdf');
    await expect(viewer(page).locator('iframe')).toHaveAttribute('src', /^blob:/);
    await expect(viewer(page)).toContainText('3 of 4');
    await page.keyboard.press('ArrowRight');
    await expect(viewer(page).getByRole('heading')).toHaveText('Budget, 12th floor.csv');
    await expect(viewer(page).locator('pre')).toContainText('Partitions and glass,410000');
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();

    // × on the card's top end corner, shown on hover.
    const card = documents.locator('.fd-file-item').nth(3);
    const remove = card.getByRole('button', { name: 'Remove Budget, 12th floor.csv' });
    await page.mouse.move(0, 0);
    await expect.poll(() => remove.evaluate((b) => getComputedStyle(b).opacity)).toBe('0');
    await card.hover();
    await expect.poll(() => remove.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
    const [corner, tile] = [await box(remove), await box(card)];
    expect([Math.round(tile.x + tile.width - corner.x - corner.width), Math.round(corner.y - tile.y)]).toEqual([4, 4]);
    expect(Math.min(corner.width, corner.height)).toBeGreaterThanOrEqual(24);
    await remove.click();
    await expect(documents.locator('.fd-file-confirm')).toContainText('Remove Budget, 12th floor.csv?');
    await expect(documents.getByRole('button', { name: 'Keep' })).toBeFocused();
    await files(page).screenshot({ path: 'test-results/screens/file-cards-remove-asks.png' });
    await documents.locator('.fd-file-confirm').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(documents.locator('.fd-file-item')).toHaveCount(3);
    await expect(documents.locator('.fd-file-note')).toHaveText('Budget, 12th floor.csv removed');
    expect(problems).toEqual([]);
  });

  test('works by the keys alone: the switch, each card and its ×, then the add tile', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.scrollIntoViewIfNeeded();
    const focused = () =>
      page.evaluate(() => {
        const at = document.activeElement as HTMLElement;
        return at.getAttribute('type') === 'file' ? 'add' : (at.getAttribute('aria-label') ?? at.textContent ?? '').split(',')[0];
      });
    await switcher(documents).getByRole('button', { name: 'List' }).focus();
    const went: string[] = [];
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Tab');
      went.push(await focused());
    }
    // As they are seen: the switch, then each card and its ×, then the add tile after the last, then the next section.
    expect(went).toEqual(['Cards', 'Site survey notes.txt', 'Remove Site survey notes.txt', 'Floor plan', 'Remove Floor plan', 'Lift booking', 'Remove Lift booking', 'Budget', 'Remove Budget', 'add', 'Structured data']);
    // The add tile shows the focus ring of its input.
    await page.keyboard.press('Shift+Tab');
    expect(await focused()).toBe('add');
    expect(await documents.locator('.fd-file-pick').evaluate((tile) => getComputedStyle(tile).outlineStyle)).toBe('solid');
    await files(page).screenshot({ path: 'test-results/screens/file-cards-add-focused.png' });

    // A card: its ring, Enter opens it, Escape brings the focus back; its × shows once the keys reach it.
    const opener = documents.getByRole('button', { name: /^Floor plan/ });
    await opener.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(opener).toBeFocused();
    expect(await opener.evaluate((b) => [getComputedStyle(b).outlineStyle, getComputedStyle(b).outlineWidth])).toEqual(['solid', '2px']);
    await files(page).screenshot({ path: 'test-results/screens/file-cards-focus.png' });
    await page.keyboard.press('Enter');
    await expect(viewer(page).locator('img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await page.keyboard.press('Tab');
    const remove = documents.getByRole('button', { name: /^Remove Floor plan/ });
    await expect(remove).toBeFocused();
    expect(await remove.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
    await page.keyboard.press('Enter');
    await expect(documents.getByRole('button', { name: 'Keep' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(remove).toBeFocused();
    await expect(documents.locator('.fd-file-item')).toHaveCount(4);

    // The switch flips by Space and by Enter, the focus staying on it.
    const list = switcher(documents).getByRole('button', { name: 'List' });
    await list.focus();
    await page.keyboard.press('Space');
    await expect(documents.locator('.fd-file')).toHaveClass(/fd-files-list/);
    await expect(list).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(documents.locator('.fd-file')).toHaveClass(/fd-files-cards/);
    expect(problems).toEqual([]);
  });

  test('reads only: cards to open, no × and no add tile, the switch still there', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined&readonly=1');
    const documents = node(page, 'f-documents');
    await expect(documents.locator('.fd-file-item')).toHaveCount(4);
    await expect(documents.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
    await expect(documents.locator('.fd-file-pick')).toBeHidden();
    await expect(node(page, 'f-photo').locator('.fd-file-pick')).toBeHidden();
    await switcher(documents).getByRole('button', { name: 'List' }).click();
    await expect(documents.locator('.fd-file')).toHaveClass(/fd-files-list/);
    await documents.getByRole('button', { name: /^Floor plan/ }).click();
    await expect(viewer(page).getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'Floor plan, 12th floor.svg');
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });

  test('reads right to left in Arabic: the cards from the right, × on the left corner', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
    const documents = node(page, 'f-documents');
    await documents.scrollIntoViewIfNeeded();
    const views = switcher(documents, 'عرض الملفات');
    await expect(views.getByRole('button')).toHaveText(['قائمة', 'بطاقات']);
    await expect(views.getByRole('button', { name: 'بطاقات' })).toHaveAttribute('aria-pressed', 'true');
    const [first, second] = [await box(documents.locator('.fd-file-item').nth(0)), await box(documents.locator('.fd-file-item').nth(1))];
    expect(first.x).toBeGreaterThan(second.x);
    // The switch at the end of its row: the left.
    expect((await box(views)).x).toBeLessThan((await box(documents.locator('.fd-file-count'))).x);
    const card = documents.locator('.fd-file-item').nth(2);
    await card.hover();
    const [corner, tile] = [await box(card.locator('.fd-file-remove')), await box(card)];
    expect(Math.round(corner.x - tile.x)).toBe(4);
    // A Latin name keeps its own direction, its extension at its right end.
    await expect(card.locator('.fd-file-name')).toHaveAttribute('dir', 'ltr');
    await files(page).screenshot({ path: 'test-results/screens/file-cards-rtl.png' });
    expect(await axeFindings(page, 'files as cards, right to left')).toEqual([]);
    await views.getByRole('button', { name: 'قائمة' }).click();
    await expect(documents.locator('.fd-file')).toHaveClass(/fd-files-list/);
    await files(page).screenshot({ path: 'test-results/screens/file-cards-rtl-list.png' });
    expect(problems).toEqual([]);
  });

  test('fits a phone: two or three cards to a row, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.locator('input[type=file]').setInputFiles([FILES.quote(), FILES.photo()]);
    await expect(documents.locator('.fd-file-item')).toHaveCount(6);
    const shapes = await cardShapes(documents);
    const perRow = shapes.filter((s) => s.top === shapes[0].top).length;
    expect(perRow).toBeGreaterThanOrEqual(2);
    expect(perRow).toBeLessThanOrEqual(3);
    expect(shapes.every((s) => s.under && s.lines <= 2)).toBe(true);
    await expectNoSidewaysScroll(page);
    await documents.scrollIntoViewIfNeeded();
    await screen(page, 'file-cards-phone', { viewport: true });
    await node(page, 'f-photo').scrollIntoViewIfNeeded();
    await screen(page, 'file-cards-phone-photos', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('many photos with long names, then full: the add tile goes', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const photos = node(page, 'f-photo');
    const named = ['Kitchen, the old sink and the boiler cupboard.png', 'Terrace.png', 'Meeting room 2, north wall, after the first coat of paint.png', 'IMG_20261006_093412_HDR_panorama_lobby_final_v3.png'];
    await photos.locator('input[type=file]').setInputFiles(named.map((name, i) => FILES.photo(name, i % 3)));
    await expect(photos.locator('.fd-file-item')).toHaveCount(6);
    await expect(photos.locator('.fd-file-count')).toHaveText('6 of 6 files');
    await expect(photos.locator('.fd-file-pick')).toBeHidden();
    expect((await cardShapes(photos)).every((s) => s.under && s.lines <= 2)).toBe(true);
    await photos.scrollIntoViewIfNeeded();
    await files(page).screenshot({ path: 'test-results/screens/file-cards-many.png' });
    expect(problems).toEqual([]);
  });

  test('reads in the dark and in the underline skin', async ({ page }) => {
    for (const query of ['skin=underline', 'skin=outlined&scheme=dark', 'skin=underline&scheme=dark']) {
      const { problems } = await open(page, 'plain', `page=fields&${query}`);
      const documents = node(page, 'f-documents');
      await documents.locator('input[type=file]').setInputFiles([FILES.quote(), FILES.photo()]);
      await expect(documents.locator('.fd-file-item')).toHaveCount(6);
      expect((await cardShapes(documents)).every((s) => s.under && s.lines <= 2)).toBe(true);
      await documents.scrollIntoViewIfNeeded();
      await files(page).screenshot({ path: `test-results/screens/file-cards-${query.replace(/skin=|scheme=/g, '').replace('&', '-')}.png` });
      expect(await axeFindings(page, `files as cards, ${query}`)).toEqual([]);
      expect(problems).toEqual([]);
    }
  });
});
