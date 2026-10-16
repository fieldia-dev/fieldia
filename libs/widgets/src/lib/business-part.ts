/**
 * The business part (parts.ts): Flectra's business widgets — a record's
 * statusbar (statusbar.ts), priority stars (priority.ts), hours and a per
 * cent typed as they are shown (duration-box.ts), an analytic distribution's
 * lines (distribution-lines.ts), tax totals (tax-totals.ts), payments
 * (payments.ts), a value with a button that copies it (copy.ts) and a live
 * timer (timer.ts) — with their stylesheet (styles-business-part.ts). Loaded the
 * first time a page shows one, through `businessPart`; its value plainly
 * meanwhile (business-plain.ts). How hours, a per cent and a distribution are
 * written and read stays in the main script (duration.ts, distribution.ts): a
 * table's cell and its total write them too. A state's dot stays there too: a
 * work item's State is one, and its list is drawn as the choice part's and the
 * path picker's are (pick-list.ts), which a part cannot carry for another.
 */
export { statusbarWidget } from './statusbar';
export { priorityWidget } from './priority';
export { durationWidget, percentageWidget } from './duration-box';
export { distributionWidget } from './distribution-lines';
export { taxTotalsWidget } from './tax-totals';
export { paymentsWidget } from './payments';
export { copyWidget } from './copy';
export { timerWidget } from './timer';
