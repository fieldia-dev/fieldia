/**
 * The relations part (parts.ts): links to other records — a many2one's and a
 * reference's search-as-you-type box, a many2many's tags and checkboxes, and a
 * char field's tags (relations.ts), with the typed names' rules they share.
 * Loaded the first time a page shows one, through `relationsPart`; drawn plainly
 * meanwhile (relations-plain.ts). What a link shows of its record at rest — its
 * picture, its lines — is the main script's (link-avatar.ts), which a read-only
 * value draws too.
 */
export { charTagsWidget, linkCheckboxesWidget, many2oneWidget, referenceWidget, tagsWidget } from './relations';
