/**
 * The app's own PDF of an invoice, as a server's report would make it: one A4 page in Helvetica — the firm, the
 * customer, the lines and the total — made here in the browser so the demo needs no server. What the gear menu's
 * Print › Invoice shows over the record (the action answers with its bytes, `ActionResult.file`).
 */

export interface PdfLine {
  text: string;
  /** Its amount, at the line's end. */
  amount?: string;
  bold?: boolean;
  size?: number;
  /** Room before it, in points. */
  gap?: number;
}

/** Words as a PDF string holds them: its brackets and backslash escaped, anything past ASCII a question mark. */
const pdfText = (text: string) => text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?');

/** A one-page PDF of these lines, top to bottom; each amount kept to the right margin. */
export function onePagePdf(lines: readonly PdfLine[]): Uint8Array {
  let y = 790;
  const ops: string[] = [];
  for (const line of lines) {
    const size = line.size ?? 11;
    y -= (line.gap ?? 4) + size;
    const font = line.bold ? '/F2' : '/F1';
    ops.push(`BT ${font} ${size} Tf 56 ${y} Td (${pdfText(line.text)}) Tj ET`);
    // About half the size a letter, from the right margin back.
    if (line.amount) ops.push(`BT ${font} ${size} Tf ${539 - line.amount.length * size * 0.53} ${y} Td (${pdfText(line.amount)}) Tj ET`);
  }
  ops.push('0.75 w 56 70 m 539 70 l S', `BT /F1 8 Tf 56 58 Td (${pdfText('Made by the app for this demo: a server would send its own.')}) Tj ET`);
  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const at = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
