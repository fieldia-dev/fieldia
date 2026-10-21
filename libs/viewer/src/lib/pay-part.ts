/**
 * The pay part (parts.ts in @fieldia/widgets): the payment step a page's answers wait for — what it is for, its amount,
 * Pay through the app's own `pay`, what came of it (pay.ts) — with its stylesheet (pay-styles.ts). Loaded through
 * `payPart` with the page's other parts where the page asks for a `payment`.
 */
export { amountWords, drawPay } from './pay';
export { installPayStyles } from './pay-styles';
