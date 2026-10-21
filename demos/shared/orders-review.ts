import type { Line, Values } from '@fieldia/core';
import { demoNow } from './calendar';

/**
 * A sales manager's orders to review (orders-review): fourteen orders of an office furniture shop this month and last,
 * each with its lines — three to nine, a section heading over some of them — and its totals worked out as the order's
 * own page works them out, so an order opened from its row reads the same. The same orders on every visit; days counted
 * from now, the reader's own or `?now=` as the browser tests pin it. Ids from 2: the order demo's own order is 1.
 */

const CUSTOMERS: [number, string][] = [
  [1, 'Nile Traders'],
  [20, 'Amira Clinics'],
  [23, 'Delta Foods'],
  [24, 'Giza Plaza'],
  [25, 'Heliopolis Dental Care'],
  [28, 'Sahel Resorts'],
];
const PRODUCTS: [number, string, number, string][] = [
  [1, 'Office chair, ergonomic', 1890, 'Black mesh back'],
  [2, 'Desk lamp, LED', 380, 'Warm white'],
  [3, 'Monitor arm, dual', 749, 'Gas spring'],
  [4, 'Standing desk 160 × 80', 6425, 'Oak top, black frame'],
  [5, 'Cable tray, 120 cm', 215, 'Under the desk'],
];
const STATES = ['sent', 'sent', 'sale', 'draft'];

/** The same numbers every time: a demo that looks the same on each visit. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}
const pad = (n: number) => String(n).padStart(2, '0');
const round = (n: number) => Math.round(n * 100) / 100;

export function reviewOrders(now = demoNow()): Record<number, Values> {
  const random = seeded(7);
  const records: Record<number, Values> = {};
  for (let i = 0; i < 14; i++) {
    const id = i + 2;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 3 - Math.floor(random() * 3));
    const [partner, customer] = CUSTOMERS[Math.floor(random() * CUSTOMERS.length)];
    const lines: Line[] = [];
    const count = 3 + Math.floor(random() * 7);
    let sequence = 10;
    let lineId = id * 100;
    // A section heading over the order's first lines, on some.
    if (count > 5) lines.push({ key: `r${lineId}`, id: lineId++, values: { sequence: (sequence += 10), display_type: 'section', name: 'Workstations' } });
    for (let n = 0; n < count; n++) {
      if (count > 5 && n === Math.ceil(count / 2)) lines.push({ key: `r${lineId}`, id: lineId++, values: { sequence: (sequence += 10), display_type: 'section', name: 'Lighting and cables' } });
      const [product, label, price, words] = PRODUCTS[Math.floor(random() * PRODUCTS.length)];
      const qty = 1 + Math.floor(random() * 12);
      const discount = random() < 0.3 ? 5 : 0;
      lines.push({ key: `r${lineId}`, id: lineId++, values: { sequence: (sequence += 10), product_id: { id: product, label }, name: words, qty, price, discount, taxed: true, subtotal: round(qty * price * (1 - discount / 100)) } });
    }
    const untaxed = round(lines.reduce((sum, line) => sum + Number(line.values['subtotal'] ?? 0), 0));
    const tax = round(untaxed * 0.14);
    records[id] = {
      name: `S00${119 + i}`,
      state: STATES[i % STATES.length],
      partner_id: { id: partner, label: customer },
      date_order: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(9 + (i % 8))}:00`,
      validity_date: null,
      payment_term: '30',
      line_ids: lines,
      amount_untaxed: untaxed,
      amount_tax: tax,
      amount_total: round(untaxed + tax),
      note: null,
      delivery_ids: [],
    };
  }
  return records;
}
