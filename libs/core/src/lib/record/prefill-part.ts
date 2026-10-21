/**
 * The prefill part (joins.ts): a link's parameters read as the fields they fill, and its side of a form — those fields
 * laid where it starts, the hidden ones sent with the answers (link-values.ts). In the one-tag script it comes as
 * fieldia.prefill.js, with the page checks of a page's `prefill` (prefill-checks.ts), asked for by a form whose page
 * fills fields from its link.
 */
export { join, linkParams, linkValue, linkValues } from './link-values';
