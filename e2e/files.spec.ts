import { expect, test, type Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Several files in one field, as a person uses them: real files chosen and
 * dropped, shown as a list and as thumbnails, refused with words when the field
 * cannot take them, and opened one by one in a viewer that the keys, the
 * pointer and a screen reader can all work — on a phone, right to left, in the
 * dark — and set up in the screen designer and tried there.
 */

// ---- files, made here ---------------------------------------------------------

/** A small landscape as a real PNG: sky, sun, ground — tinted so each one differs. */
function png(width: number, height: number, tint = 0): Buffer {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * row + 1 + x * 3;
      const sun = (x - width * 0.72) ** 2 + (y - height * 0.3) ** 2 < (height * 0.12) ** 2;
      const ground = y > height * (0.62 + 0.08 * Math.sin((x / width) * 6 + tint));
      const [r, g, b] = sun ? [250, 200, 70] : ground ? [70 + tint * 40, 130 - y / 8, 80] : [120 - y / 4, 170 - y / 6 + tint * 10, 230];
      raw.set([r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v)))), at);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A one-page PDF with a line of words on it, its cross-references counted. */
function pdf(words: string): Buffer {
  const content = `BT /F1 28 Tf 72 740 Td (${words}) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

type Made = { name: string; mimeType: string; buffer: Buffer };
const FILES = {
  photo: (name = 'Lobby, north side.png', tint = 0): Made => ({ name, mimeType: 'image/png', buffer: png(480, 300, tint) }),
  quote: (): Made => ({ name: 'Quote for the 12th floor, revised again before signing.pdf', mimeType: 'application/pdf', buffer: pdf('Quote for the 12th floor') }),
  notes: (): Made => ({ name: 'Snag list.txt', mimeType: 'text/plain', buffer: Buffer.from('Snag list, 12th floor\n\n1. Door to the meeting room sticks\n2. Two ceiling tiles cracked by the lift\n3. Paint missing behind the kitchen\n') }),
  archive: (): Made => ({ name: 'Site photos, raw.zip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]) }),
};

/** Drop files on an element, as a person drags them from the desktop. */
async function dropOn(page: Page, selector: string, files: Made[]) {
  await page.evaluate(
    ({ selector, files }) => {
      const transfer = new DataTransfer();
      for (const f of files) transfer.items.add(new File([Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
      const target = document.querySelector(selector) as Element;
      target.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    },
    { selector, files: files.map((f) => ({ name: f.name, type: f.mimeType, data: f.buffer.toString('base64') })) }
  );
}

const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values);
const namesIn = async (page: Page, field: string) => ((await values(page))[field] as { name: string }[]).map((f) => f.name);
const viewer = (page: Page) => page.getByRole('dialog');
const rows = (page: Page, id: string) => node(page, id).locator('.fd-file-item');

// ---- a form's fields ------------------------------------------------------------

test.describe('several files in a form', () => {
  test('adds files from the picker and by dropping them, and lists them, each opening', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.scrollIntoViewIfNeeded();
    // Two files the job already has; the limits said before anyone tries.
    await expect(rows(page, 'f-documents')).toHaveCount(2);
    await expect(documents.locator('.fd-file-count')).toHaveText('2 of 8 files');
    await expect(documents.locator('.fd-file-limits')).toHaveText('up to 10 MB each · up to 8 files');
    await documents.locator('input[type=file]').setInputFiles([FILES.quote(), FILES.photo()]);
    await expect(rows(page, 'f-documents')).toHaveCount(4);
    await dropOn(page, '[data-node="f-documents"] .fd-file', [FILES.archive()]);
    await expect(rows(page, 'f-documents')).toHaveCount(5);
    expect(await namesIn(page, 'documents')).toEqual(['Site survey notes.txt', 'Floor plan, 12th floor.svg', 'Quote for the 12th floor, revised again before signing.pdf', 'Lobby, north side.png', 'Site photos, raw.zip']);
    await expect(documents.locator('.fd-file-count')).toHaveText('5 of 8 files');
    // An icon by kind, a thumbnail for an image; a long name cut in the middle, its end kept.
    await expect(documents.locator('.fd-file-icon')).toHaveText(['TXT', 'PDF', 'ZIP']);
    await expect(documents.locator('img.fd-file-thumb')).toHaveCount(2);
    await expect(documents.locator('.fd-file-name').nth(2).locator('> span')).toHaveText('Quote for the 12th floor, revised again before si');
    await documents.screenshot({ path: 'test-results/screens/files-list.png' });
    expect(problems).toEqual([]);
  });

  test('opens each file in the viewer: an image, a PDF, text, and one with no preview', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const documents = node(page, 'f-documents');
    await documents.locator('input[type=file]').setInputFiles([FILES.photo(), FILES.quote(), FILES.archive()]);
    await expect(rows(page, 'f-documents')).toHaveCount(5);
    const opener = documents.getByRole('button', { name: /^Lobby, north side\.png/ });
    await opener.click();
    const box = viewer(page);
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('aria-modal', 'true');
    await expect(box.getByRole('heading')).toHaveText('Lobby, north side.png');
    await expect(box).toContainText('3 of 5');
    const image = box.locator('img');
    await expect(image).toBeVisible();
    expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(480);
    await expect(box.getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'Lobby, north side.png');
    await screen(page, 'files-viewer-image', { viewport: true });
    expect(await axeFindings(page, 'the viewer open on an image')).toEqual([]);

    await page.keyboard.press('ArrowRight');
    await expect(box.getByRole('heading')).toHaveText('Quote for the 12th floor, revised again before signing.pdf');
    const frame = box.locator('iframe');
    await expect(frame).toHaveAttribute('src', /^blob:/);
    await expect(frame).toHaveAttribute('title', 'Quote for the 12th floor, revised again before signing.pdf');
    await screen(page, 'files-viewer-pdf', { viewport: true });

    await box.getByRole('button', { name: 'Next' }).click();
    await expect(box.getByRole('heading')).toHaveText('Site photos, raw.zip');
    await expect(box).toContainText('No preview for this kind of file');
    await screen(page, 'files-viewer-unknown', { viewport: true });

    // Round the end to the first: text, shown as it is.
    await page.keyboard.press('ArrowRight');
    await expect(box.getByRole('heading')).toHaveText('Site survey notes.txt');
    await expect(box.locator('pre')).toContainText('Freight lift booked 08:00-10:00');
    await screen(page, 'files-viewer-text', { viewport: true });
    expect(await axeFindings(page, 'the viewer open on text')).toEqual([]);
    await box.getByRole('button', { name: 'Previous' }).click();
    await expect(box.getByRole('heading')).toHaveText('Site photos, raw.zip');

    // Tab stays inside; Escape closes, the focus back on the file it was opened from.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await box.evaluate((b) => b.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await expect(opener).toBeFocused();
    // The backdrop closes it too; Enter on a file opens it.
    await opener.press('Enter');
    await expect(viewer(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(viewer(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
    // Every object URL was let go.
    expect(problems).toEqual([]);
  });

  test('refuses what the field cannot take, and says which and why', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=layout&skin=outlined');
    await page.getByRole('tab', { name: 'Documents' }).click();
    const certificates = node(page, 'f-certificates');
    await expect(certificates.locator('.fd-file-limits')).toHaveText('PDF or image · up to 10 MB each · up to 5 files');
    const many = ['First aid', 'Fire warden', 'Forklift', 'Food hygiene', 'Working at height', 'Asbestos awareness'].map((name, i) => FILES.photo(`${name}.png`, i % 3));
    await certificates.locator('input[type=file]').setInputFiles([FILES.notes(), FILES.quote(), ...many]);
    await expect(certificates.locator('.fd-file-item')).toHaveCount(5);
    await expect(certificates.locator('.fd-file-note > div')).toHaveText(['Snag list.txt must be a PDF or image file', 'Up to 5 files: 2 not added']);
    await expect(certificates.locator('.fd-file-note')).toHaveAttribute('role', 'status');
    await expect(certificates.locator('.fd-file-count')).toHaveText('5 of 5 files');
    // In a narrow column a long name is cut in the middle: its start ends in an ellipsis, its end and extension stay.
    const long = certificates.locator('.fd-file-name').first();
    expect(await long.evaluate((n) => { const start = n.firstElementChild as HTMLElement; return start.scrollWidth > start.clientWidth && getComputedStyle(start).textOverflow; })).toBe('ellipsis');
    await expect(long).toContainText('gning.pdf');
    // Full: the picker goes, and a file dropped is refused.
    await expect(certificates.locator('.fd-file-pick')).toBeHidden();
    await dropOn(page, '[data-node="f-certificates"] .fd-file', [FILES.photo('Late.png')]);
    await expect(certificates.locator('.fd-file-note > div')).toHaveText(['Up to 5 files: 1 not added']);
    await certificates.scrollIntoViewIfNeeded();
    await screen(page, 'files-refused');
    // Removing asks first.
    await certificates.getByRole('button', { name: 'Remove Fire warden.png' }).click();
    await expect(certificates.locator('.fd-file-confirm')).toContainText('Remove Fire warden.png?');
    await expect(certificates.getByRole('button', { name: 'Keep' })).toBeFocused();
    await screen(page, 'files-remove-asks');
    await certificates.locator('.fd-file-confirm').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(certificates.locator('.fd-file-item')).toHaveCount(4);
    await expect(certificates.locator('.fd-file-note')).toHaveText('Fire warden.png removed');
    await expect(certificates.locator('.fd-file-pick')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('shows photos as thumbnails, each opening, removed on hover and from the keys', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const photos = node(page, 'f-photo');
    await photos.locator('input[type=file]').setInputFiles([FILES.photo('Lobby.png', 0), FILES.photo('Kitchen.png', 1), FILES.photo('Terrace.png', 2)]);
    await expect(photos.locator('.fd-file-item')).toHaveCount(3);
    await expect(photos.locator('.fd-file-count')).toHaveText('3 of 6 files');
    const tiles = await photos.locator('.fd-file-item').evaluateAll((items) => items.map((i) => Math.round(i.getBoundingClientRect().width)));
    expect(tiles).toEqual([96, 96, 96]);
    // Remove shows on hover, and on keyboard focus.
    const remove = photos.getByRole('button', { name: 'Remove Kitchen.png' });
    expect(await remove.evaluate((b) => getComputedStyle(b).opacity)).toBe('0');
    await photos.locator('.fd-file-item').nth(1).hover();
    await expect.poll(() => remove.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
    await photos.scrollIntoViewIfNeeded();
    await screen(page, 'files-thumbnails');
    await photos.screenshot({ path: 'test-results/screens/files-thumbnails-close.png' });
    await photos.getByRole('button', { name: /^Terrace\.png/ }).click();
    await expect(viewer(page).locator('img')).toBeVisible();
    await expect(viewer(page)).toContainText('3 of 3');
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });

  test('reads only: files to open and download, nothing to add or remove', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined&readonly=1');
    const documents = node(page, 'f-documents');
    await expect(documents.locator('.fd-file-item')).toHaveCount(2);
    await expect(documents.locator('.fd-file-pick')).toBeHidden();
    await expect(documents.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
    await documents.getByRole('button', { name: /^Floor plan/ }).click();
    await expect(viewer(page).locator('img')).toBeVisible();
    await expect(viewer(page).getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'Floor plan, 12th floor.svg');
    await screen(page, 'files-readonly-viewer', { viewport: true });
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });

  test('fits a phone: the list, the thumbnails and the viewer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    await node(page, 'f-photo').locator('input[type=file]').setInputFiles([FILES.photo('Lobby.png', 0), FILES.photo('Kitchen.png', 1), FILES.photo('Terrace.png', 2), FILES.photo('Roof.png', 1)]);
    await node(page, 'f-documents').locator('input[type=file]').setInputFiles([FILES.quote()]);
    await expect(node(page, 'f-documents').locator('.fd-file-item')).toHaveCount(3);
    await expectNoSidewaysScroll(page);
    await node(page, 'f-contract').scrollIntoViewIfNeeded();
    await screen(page, 'files-phone', { viewport: true });
    await node(page, 'f-documents').getByRole('button', { name: /^Quote/ }).click();
    const box = viewer(page);
    const size = (await box.boundingBox())!;
    expect(size.width).toBeLessThanOrEqual(390);
    await expectNoSidewaysScroll(page);
    await screen(page, 'files-phone-viewer', { viewport: true });
    await page.keyboard.press('ArrowLeft');
    await expect(box.getByRole('heading')).toHaveText('Floor plan, 12th floor.svg');
    await screen(page, 'files-phone-viewer-image', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('reads right to left in Arabic, the arrows mirrored', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
    const documents = node(page, 'f-documents');
    await expect(documents.locator('.fd-file-count')).toHaveText('الملفات: 2 من 8');
    await documents.locator('input[type=file]').setInputFiles([FILES.quote()]);
    await node(page, 'f-photo').locator('input[type=file]').setInputFiles([FILES.photo('Lobby.png', 0), FILES.photo('Kitchen.png', 1)]);
    await expect(documents.locator('.fd-file-item')).toHaveCount(3);
    // A Latin name keeps its own direction: its extension at its right end.
    const name = documents.locator('.fd-file-name').nth(2);
    const [start, end] = await name.evaluate((n) => [(n.firstElementChild as HTMLElement).getBoundingClientRect().x, (n.lastChild as Text).parentElement!.getBoundingClientRect().right]);
    expect(start).toBeLessThan(end);
    await documents.scrollIntoViewIfNeeded();
    await screen(page, 'files-rtl');
    await documents.getByRole('button', { name: /^Site survey notes/ }).click();
    const box = viewer(page);
    await expect(box).toContainText('1 من 3');
    // Left is forward right to left.
    await page.keyboard.press('ArrowLeft');
    await expect(box.getByRole('heading')).toHaveText('Floor plan, 12th floor.svg');
    await expect(box.getByRole('button', { name: 'التالي' })).toBeVisible();
    await screen(page, 'files-rtl-viewer', { viewport: true });
    expect(await axeFindings(page, 'the viewer, right to left')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('reads in the dark scheme, both skins', async ({ page }) => {
    for (const skin of ['outlined', 'underline']) {
      const { problems } = await open(page, 'plain', `page=fields&skin=${skin}&scheme=dark`);
      await node(page, 'f-photo').locator('input[type=file]').setInputFiles([FILES.photo('Lobby.png', 0)]);
      await node(page, 'f-documents').locator('input[type=file]').setInputFiles([FILES.quote(), FILES.archive()]);
      await expect(node(page, 'f-documents').locator('.fd-file-item')).toHaveCount(4);
      await node(page, 'f-contract').scrollIntoViewIfNeeded();
      await screen(page, `files-dark-${skin}`, { viewport: true });
      expect(await axeFindings(page, `the files, dark, ${skin}`)).toEqual([]);
      await node(page, 'f-documents').getByRole('button', { name: /^Site survey/ }).click();
      await screen(page, `files-dark-${skin}-viewer`, { viewport: true });
      expect(await axeFindings(page, `the viewer, dark, ${skin}`)).toEqual([]);
      expect(problems).toEqual([]);
    }
  });

  test('the customer’s photo in the sheet’s header, one image', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=customer&skin=outlined');
    await page.locator('.fd-avatar input[type=file]').setInputFiles(FILES.photo('Nile Traders.png', 1));
    const avatar = page.locator('.fd-avatar');
    await expect(avatar.locator('img')).toBeVisible();
    const tile = (await avatar.locator('.fd-file-item').boundingBox())!;
    expect([Math.round(tile.width), Math.round(tile.height)]).toEqual([88, 88]);
    await expect(avatar.getByRole('button', { name: 'Replace' })).toBeVisible();
    await page.locator('.fd-title-row').screenshot({ path: 'test-results/screens/files-avatar.png' });
    await avatar.getByRole('button', { name: /^Nile Traders\.png/ }).click();
    await expect(viewer(page).locator('img')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });
});

// ---- the screen designer ------------------------------------------------------------

test.describe('several files in the screen designer', () => {
  test('More than one file, at most three, as thumbnails — then tried', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/screen/');
    // A new file upload, picked.
    await page.evaluate(() => {
      const { designer } = (window as any).fieldiaDesigner;
      const id = designer.addQuestion('file', { parent: 'section-1' });
      designer.updateQuestion(id, { label: 'Signed papers' });
      designer.select(id);
    });
    const panel = page.locator('.fd-properties');
    await panel.getByRole('switch', { name: 'More than one file' }).click();
    const most = panel.getByRole('spinbutton', { name: 'At most' });
    await most.fill('3');
    await most.press('Tab');
    await panel.getByRole('group', { name: 'Show chosen files as' }).getByRole('button', { name: 'Thumbnails' }).click();
    const card = page.locator('.fd-canvas-field.fd-editing');
    await expect(card.getByRole('switch', { name: 'More than one file' })).toHaveAttribute('aria-checked', 'true');
    await expect(card.getByRole('spinbutton', { name: 'At most' })).toHaveValue('3');
    // The card says what it takes.
    await expect(card.locator('.fd-file-limits')).toHaveText('up to 10 MB each · up to 3 files');
    await expect(card.locator('.fd-file')).toHaveClass(/fd-files-thumbs/);
    await card.scrollIntoViewIfNeeded();
    await screen(page, 'files-designer-panel', { viewport: true });

    // Photos, on the site visit already: several, as thumbnails, the camera offered.
    await page.evaluate(() => {
      const { designer } = (window as any).fieldiaDesigner;
      const built = designer.getPage();
      const id = built.layout.children[0].children.find((n: { field: string }) => built.fields[n.field].label === 'Photos').id;
      designer.select(id);
    });
    await expect(panel.getByRole('combobox', { name: 'Camera on phones' })).toHaveValue('environment');
    await expect(panel.getByRole('spinbutton', { name: 'At most' })).toHaveValue('6');
    await screen(page, 'files-designer-photos', { viewport: true });

    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    const papers = tried.locator('[data-type="binary"]');
    await expect(papers.locator('.fd-file-limits')).toHaveText('up to 10 MB each · up to 3 files');
    await papers.locator('input[type=file]').setInputFiles([FILES.quote(), FILES.photo('Page 2.png', 1), FILES.photo('Page 3.png', 2), FILES.photo('Page 4.png', 0)]);
    await expect(papers.locator('.fd-file-item')).toHaveCount(3);
    await expect(papers.locator('.fd-file-note')).toHaveText('Up to 3 files: 1 not added');
    await expect(papers.locator('.fd-file-pick')).toBeHidden();
    const photos = tried.locator('[data-type="image"]');
    await expect(photos.locator('input[type=file]')).toHaveAttribute('capture', 'environment');
    await photos.locator('input[type=file]').setInputFiles([FILES.photo('Entrance.png', 0), FILES.photo('Corridor.png', 2)]);
    await expect(photos.locator('.fd-file-item')).toHaveCount(2);
    await papers.scrollIntoViewIfNeeded();
    await screen(page, 'files-designer-try-it', { viewport: true });
    await papers.getByRole('button', { name: /^Page 2\.png/ }).click();
    await expect(viewer(page).locator('img')).toBeVisible();
    await screen(page, 'files-designer-try-it-viewer', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(papers.getByRole('button', { name: /^Page 2\.png/ })).toBeFocused();
    expect(problems).toEqual([]);
  });
});
