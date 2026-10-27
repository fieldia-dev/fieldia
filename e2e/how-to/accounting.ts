import type { Replays } from './hand';
import { replay as reading } from './accounting/reading';
import { replay as chartOfAccounts } from './accounting/chart-of-accounts';
import { replay as vendorBill } from './accounting/vendor-bill';
import { replay as purchaseApproval } from './accounting/purchase-approval';
import { replay as expenseApproval } from './accounting/expense-approval';
import { replay as templateInvoice } from './accounting/template-invoice';
import { replay as templateExpenseClaim } from './accounting/template-expense-claim';
import { replay as realInvoice } from './accounting/real-invoice';
import { replay as realRegisterPayment } from './accounting/real-register-payment';
import { replay as realExpense } from './accounting/real-expense';
import { replay as invoices } from './accounting/invoices';

/** The accounting demos' how-to steps, replayed by hand (e2e/how-to.spec.ts): one file per demo in e2e/how-to/accounting/. */
export const accounting: Replays = {
  reading,
  'chart-of-accounts': chartOfAccounts,
  'vendor-bill': vendorBill,
  'purchase-approval': purchaseApproval,
  'expense-approval': expenseApproval,
  'template-invoice': templateInvoice,
  'template-expense-claim': templateExpenseClaim,
  'real-invoice': realInvoice,
  'real-register-payment': realRegisterPayment,
  'real-expense': realExpense,
  invoices,
};
