import type { Replays } from './hand';
import { replay as order } from './sales/order';
import { replay as ordersReview } from './sales/orders-review';
import { replay as rules } from './sales/rules';
import { replay as mapZones } from './sales/map-zones';
import { replay as mapHeat } from './sales/map-heat';
import { replay as testDrive } from './sales/test-drive';
import { replay as testDrives } from './sales/test-drives';
import { replay as quickOrder } from './sales/quick-order';
import { replay as contractFees } from './sales/contract-fees';
import { replay as templateQuoteRequest } from './sales/template-quote-request';
import { replay as templateProduct } from './sales/template-product';
import { replay as realSaleOrder } from './sales/real-sale-order';
import { replay as realSaleInvoiceWizard } from './sales/real-sale-invoice-wizard';
import { replay as realProduct } from './sales/real-product';
import { replay as realSaleContract } from './sales/real-sale-contract';

/** The sales demos' how-to steps, replayed by hand (e2e/how-to.spec.ts): one file each, in sales/, in the catalogue's order. */
export const sales: Replays = {
  order,
  'orders-review': ordersReview,
  rules,
  'map-zones': mapZones,
  'map-heat': mapHeat,
  'test-drive': testDrive,
  'test-drives': testDrives,
  'quick-order': quickOrder,
  'contract-fees': contractFees,
  'template-quote-request': templateQuoteRequest,
  'template-product': templateProduct,
  'real-sale-order': realSaleOrder,
  'real-sale-invoice-wizard': realSaleInvoiceWizard,
  'real-product': realProduct,
  'real-sale-contract': realSaleContract,
};
