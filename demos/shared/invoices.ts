import type { Values } from '@fieldia/core';
import { demoNow } from './calendar';

/**
 * The invoices list's records: a firm in Cairo billing its customers in
 * pounds, a trading house in Dubai in dollars, month by month for fifteen
 * months up to now — the reader's own, or `?now=2026-10-14T09:40` as the
 * browser tests pin it — so This month, Last month and Overdue always hold
 * some. Dubai's are all of last year: this year's total is in pounds alone,
 * and the whole list's is in two currencies, so it has none.
 */

const CUSTOMERS: [id: number, name: string, city: string][] = [
  [1, 'Nile Traders', 'cairo'],
  [20, 'Amira Clinics', 'cairo'],
  [23, 'Delta Foods', 'mansoura'],
  [24, 'Giza Plaza', 'giza'],
  [25, 'Heliopolis Dental Care', 'cairo'],
  [28, 'Sahel Resorts', 'alexandria'],
  [30, 'Zamalek Studio', 'cairo'],
];
const DUBAI: [number, string, string] = [90, 'Gulf Trading', 'dubai'];
const EGP = { id: 1, label: 'EGP' };
const USD = { id: 4, label: 'USD' };

/** The same numbers every time: a demo that looks the same on each visit. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function sampleInvoices(now = demoNow()): Record<number, Values> {
  const random = seeded(11);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const records: Record<number, Values> = {};
  let id = 1;
  for (let back = 14; back >= 0; back--) {
    const month = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const days = back === 0 ? today.getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const count = 3 + Math.floor(random() * 3);
    const lastYear = month.getFullYear() < today.getFullYear();
    for (let i = 0; i < count; i++) {
      // Dubai's: two a month for the first three months shown, all of last year.
      const dubai = lastYear && back >= 12 && i < 2;
      const [partner, name, city] = dubai ? DUBAI : CUSTOMERS[Math.floor(random() * CUSTOMERS.length)];
      const date = new Date(month.getFullYear(), month.getMonth(), 1 + Math.floor(random() * days));
      const due = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 30);
      const age = Math.round((today.getTime() - date.getTime()) / 86400000);
      // Paid within two months, mostly; a few left unpaid past their due date; this week's a draft or two.
      const state = age < 4 && random() < 0.5 ? 'draft' : age > 45 && random() < 0.8 ? 'paid' : 'sent';
      records[id] = {
        name: `INV/${date.getFullYear()}/${String(id).padStart(4, '0')}`,
        partner_id: { id: partner, label: name },
        city,
        invoice_date: dayKey(date),
        due_date: dayKey(due),
        state,
        currency_id: dubai ? USD : EGP,
        amount: dubai ? 2000 + Math.round(random() * 80) * 100 : 8000 + Math.round(random() * 8800) * 50,
      };
      id++;
    }
  }
  return records;
}
