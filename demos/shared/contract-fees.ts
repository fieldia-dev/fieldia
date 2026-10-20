import type { Values } from '@fieldia/core';

/**
 * The service agreement's record (examples/pages/contract-fees.page.json): its fees a price table as Word's would
 * be once pasted — a header row, the amounts at their cells' end, a total across three columns — and its payment
 * schedule empty, to paste one into. Sample data.
 */
const right = (words: string) => `<td style="text-align: right;">${words}</td>`;
const FEES =
  '<p>The Client pays the fees below within 30 days of each invoice. Prices are in Egyptian pounds, before VAT.</p>' +
  '<table><thead><tr><th>Service</th><th style="text-align: right;">Qty</th><th style="text-align: right;">Unit price</th><th style="text-align: right;">Amount</th></tr></thead><tbody>' +
  `<tr><td>Discovery workshop</td>${right('2')}${right('1,500.00')}${right('3,000.00')}</tr>` +
  `<tr><td>Site build, <i>three languages</i></td>${right('1')}${right('12,000.00')}${right('12,000.00')}</tr>` +
  `<tr><td>Hosting and care, a year</td>${right('1')}${right('2,400.00')}${right('2,400.00')}</tr>` +
  `<tr><td style="text-align: right;" colspan="3"><b>Total</b></td>${right('<b>17,400.00</b>')}</tr></tbody></table>` +
  '<p>Work the Client asks for beyond this is quoted first, at 650.00 an hour.</p>';

export const CONTRACT_FEES_RECORDS: Record<string, Record<number, Values>> = {
  'sales.agreement': {
    1: {
      name: 'SA-2026-014',
      customer: 'Nile Traders',
      signed_on: '2026-10-12',
      scope: '<p>Nile Digital Studio designs and builds the Client’s shop in English, Arabic and French, moves its 1,200 products over, and looks after it for a year.</p>',
      fees: FEES,
      payment: null,
    },
  },
};
