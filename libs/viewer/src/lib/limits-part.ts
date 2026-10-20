/**
 * The limits part (parts.ts in @fieldia/widgets): a page's opening, closing and limits said in place of its questions
 * as it opens, the banner of answers a form closed on, and Continue later — its button, what it kept and the link to
 * continue from (limits.ts) — with their stylesheet (limits-styles.ts). Loaded through `limitsPart` with the page's
 * other parts — waited for before the page is drawn, so a closed form never shows its questions first — where the
 * page has `limits` or `continueLater`.
 */
export { drawLimits } from './limits';
export { installLimitsStyles } from './limits-styles';
