import { expect, test } from './fixtures';
import { FILES } from './files-support';
import { node, open } from './support';

/**
 * A picture added to a file field shows from the file itself while it is on its way to the store (a `blob:` address
 * made for it), and that address is let go once nothing shows or loads it — once its picture has loaded or failed —
 * never while it still loads: WebKit says so in its console, "Failed to load resource". Each engine loading the
 * picture its own way, the store answering at once.
 */
test.describe('a picture on its way to the store', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('its address is let go once its picture has loaded, never while it loads: nothing failed, added again and again', async ({ page }) => {
    // The how-to replay of 0.35 ("Every field" on a phone, WebKit, 3 runs in 8): "Failed to load resource" for a blob:
    // address right after photos were added to Documents — the upload over, the picture's address let go as it loaded.
    // Watched as it happens too, in every engine: each picture drawn from a blob: address, and each address let go
    // while a picture of it had not yet loaded (which WebKit says only now and then).
    await page.addInitScript(() => {
      const pictures: HTMLImageElement[] = [];
      const early: string[] = [];
      new MutationObserver((changes) => {
        for (const change of changes)
          for (const added of change.addedNodes)
            if (added instanceof Element) pictures.push(...[added, ...added.querySelectorAll('img')].filter((one): one is HTMLImageElement => one instanceof HTMLImageElement && one.src.startsWith('blob:')));
      }).observe(document, { childList: true, subtree: true });
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url: string) => {
        if (pictures.some((picture) => picture.src === url && !picture.complete)) early.push(url);
        revoke(url);
      };
      Object.assign(window, { lettingGo: { pictures, early } });
    });
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const watched = () =>
      page.evaluate(() => {
        const { pictures, early } = (window as unknown as { lettingGo: { pictures: unknown[]; early: string[] } }).lettingGo;
        return { pictures: pictures.length, early: early.length };
      });
    let pictures = 0;
    for (let round = 0; round < 6; round++) {
      if (round) {
        await page.reload();
        await expect(page.locator('.fd-form')).toBeVisible();
      }
      const documents = node(page, 'f-documents');
      await documents.scrollIntoViewIfNeeded();
      const stored = documents.locator('.fd-file-item:not(.fd-file-going)');
      await expect(stored).toHaveCount(4);
      // As many as the field still takes, at once: each shown from its file while the store takes it.
      await documents.locator('input[type=file]').setInputFiles([0, 1, 2, 3].map((n) => FILES.photo(`Lobby ${round}-${n}.png`, n)));
      await expect(stored).toHaveCount(8);
      await expect(documents.locator('.fd-file-going')).toHaveCount(0);
      // Every one drawn from where it is stored, none in the browser's broken mark.
      await expect(documents.locator('.fd-file-item img.fd-file-thumb')).toHaveCount(5);
      // Its pictures shown from their files meanwhile, and not one of their addresses let go while it still loaded.
      const { pictures: shown, early } = await watched();
      pictures += shown;
      expect(early, `round ${round + 1}: addresses let go while their pictures loaded`).toBe(0);
    }
    expect(pictures).toBeGreaterThanOrEqual(24);
    // A failure said late, as a picture's load ends after its item has gone.
    await page.waitForTimeout(500);
    expect(problems).toEqual([]);
  });
});
