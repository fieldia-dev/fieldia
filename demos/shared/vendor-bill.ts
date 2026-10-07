import type { ActionRequest, ActionResult, FileValue, Page, RecordId, Values } from '@fieldia/core';
import type { Breadcrumb } from '@fieldia/viewer';
import bill from '../../examples/pages/vendor-bill.page.json';

/**
 * The vendor bill demo: what sits around one record. Four bills, each with its
 * scanned PDF beside the sheet; the gear menu's Print, Debit Note, Archive,
 * Duplicate and Delete; the pager over the four and the breadcrumbs back to
 * "Vendor bills", as the app gives them; the conversation beside it on any
 * screen it fits. The same in every framework.
 */
export const vendorBill = bill as Page;

const vendor = { 1: { id: 1, label: 'Nile Traders' }, 2: { id: 2, label: 'Delta Office Supply' } } as const;

/** The bills, by id. */
export const BILLS: Record<string, Values> = {
  1: { name: 'BILL/2026/10/0001', state: 'posted', active: true, partner_id: vendor[1], ref: 'NT-8841', invoice_date: '2026-10-01', invoice_date_due: '2026-10-31', payment_reference: 'BILL/2026/10/0001', amount_untaxed: 18900, narration: 'Payable within 30 days.' },
  2: { name: 'BILL/2026/10/0002', state: 'draft', active: true, partner_id: vendor[2], ref: 'DOS-1120', invoice_date: '2026-10-03', invoice_date_due: '2026-11-02', payment_reference: null, amount_untaxed: 4380, narration: null },
  3: { name: 'BILL/2026/10/0003', state: 'posted', active: true, partner_id: vendor[1], ref: 'NT-8907', invoice_date: '2026-10-05', invoice_date_due: '2026-11-04', payment_reference: 'BILL/2026/10/0003', amount_untaxed: 64250, narration: 'Payable within 30 days.' },
  4: { name: 'BILL/2026/10/0004', state: 'draft', active: false, partner_id: vendor[2], ref: 'DOS-1187', invoice_date: '2026-10-06', invoice_date_due: '2026-11-05', payment_reference: null, amount_untaxed: 1250, narration: null },
};

/** A one-page PDF of a bill, as a vendor sends it: drawn here, so the demo needs no file. */
function billPdf(values: Values): string {
  const money = (n: number) => `EGP ${n.toLocaleString('en', { minimumFractionDigits: 2 })}`;
  const untaxed = Number(values['amount_untaxed'] ?? 0);
  const from = (values['partner_id'] as { label: string }).label;
  const text = (x: number, y: number, size: number, words: string, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${words.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj ET`;
  const lines = [
    '0.11 0.36 0.68 rg 0 762 595 80 re f 1 1 1 rg',
    text(50, 800, 24, from, true),
    text(50, 778, 11, '14 Nile Corniche, Cairo  -  VAT 300-112-448'),
    '0 0 0 rg',
    text(50, 720, 18, 'TAX INVOICE', true),
    text(50, 696, 11, `Invoice ${String(values['ref'])}   Date ${String(values['invoice_date'])}   Due ${String(values['invoice_date_due'])}`),
    text(50, 672, 11, 'Bill to: Sherkety Demo Co., Smart Village, Giza'),
    '0.85 0.85 0.85 RG 50 640 m 545 640 l S',
    text(50, 620, 11, 'Description', true),
    text(450, 620, 11, 'Amount', true),
    text(50, 596, 11, 'Office furniture and supplies, as ordered'),
    text(450, 596, 11, money(untaxed)),
    '50 570 m 545 570 l S',
    text(330, 548, 11, 'Untaxed amount'),
    text(450, 548, 11, money(untaxed)),
    text(330, 528, 11, 'VAT 14%'),
    text(450, 528, 11, money(untaxed * 0.14)),
    text(330, 502, 13, 'Total', true),
    text(450, 502, 13, money(untaxed * 1.14), true),
    text(50, 120, 9, 'Please pay by bank transfer to CIB 1002 3344 5566, quoting the invoice number.'),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return btoa(pdf);
}

/** Each bill's attachments, its scanned PDF first: what the preview beside the sheet shows. Made once, when first asked. */
export function billAttachments(): Record<string, FileValue[]> {
  const files: Record<string, FileValue[]> = {};
  for (const [id, values] of Object.entries(BILLS)) {
    if (id === '2') continue; // A bill whose PDF has not come yet: nothing beside it.
    const data = billPdf(values);
    files[`account.move:${id}`] = [{ name: `${String(values['ref'])}.pdf`, type: 'application/pdf', size: Math.round((data.length * 3) / 4), data }];
  }
  return files;
}

/** The records round the one shown and the trail to it, as the app gives them to the vendor bill. */
export function billNavigation(): { records: RecordId[]; breadcrumbs: Breadcrumb[] } {
  return { records: [1, 2, 3, 4], breadcrumbs: [{ label: 'Vendor bills', href: '#vendor-bills' }] };
}

let debitNotes = 0;

/** The app's answers to the bill's own actions: a debit note made on the server, posted in the conversation; the bill printed. */
export function answerBill(request: ActionRequest): ActionResult | undefined {
  if (request.action === 'action_debit_note') {
    const note = `DN/2026/10/${String(++debitNotes).padStart(4, '0')}`;
    return { say: { message: `Debit note ${note} made`, tone: 'success' }, post: { message: `Debit note ${note} made for ${String(request.values['name'])}`, kind: 'note' } };
  }
  if (request.action === 'print_bill') return { say: `${String(request.values['name'])} sent to the printer` };
  return undefined;
}
