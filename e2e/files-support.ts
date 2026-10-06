import type { Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';

/** Real files made in the test, for the file and image fields to take: chosen with setInputFiles, or dropped. */

/** A small landscape as a real PNG: sky, sun, ground — tinted so each one differs. */
export function png(width: number, height: number, tint = 0): Buffer {
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
export function pdf(words: string): Buffer {
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

export type Made = { name: string; mimeType: string; buffer: Buffer };
export const FILES = {
  photo: (name = 'Lobby, north side.png', tint = 0): Made => ({ name, mimeType: 'image/png', buffer: png(480, 300, tint) }),
  quote: (): Made => ({ name: 'Quote for the 12th floor, revised again before signing.pdf', mimeType: 'application/pdf', buffer: pdf('Quote for the 12th floor') }),
  notes: (): Made => ({ name: 'Snag list.txt', mimeType: 'text/plain', buffer: Buffer.from('Snag list, 12th floor\n\n1. Door to the meeting room sticks\n2. Two ceiling tiles cracked by the lift\n3. Paint missing behind the kitchen\n') }),
  archive: (): Made => ({ name: 'Site photos, raw.zip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]) }),
};

/** Drop files on an element, as a person drags them from the desktop. */
export async function dropOn(page: Page, selector: string, files: Made[]) {
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
