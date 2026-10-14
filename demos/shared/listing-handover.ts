import type { Page } from '@fieldia/core';

/**
 * A listing's handover (the listing-handover page): the listing's title and
 * bedrooms, and the owner's consent placed in it — a saved form of its own,
 * with the owner's name, their signature drawn on a pad and a scan of the
 * title deed. Its answers are the listing's, kept under `consent`; its files
 * are the listing's too, stored as they are picked, the listing's save waiting
 * for them. For its browser gate (e2e/save-safety-files.spec.ts): no card in
 * the gallery. Sample data.
 */

/** The owner's consent, made once and placed in the handover by its id. */
export const OWNER_CONSENT: Page = {
  fieldia: '0.1',
  id: 'owner-consent',
  title: 'Owner’s consent',
  data: { kind: 'responses' },
  fields: {
    owner: { type: 'char', label: 'Owner' },
    signature: { type: 'binary', label: 'Signature' },
    deed: { type: 'binary', label: 'Title deed' },
  },
  layout: {
    type: 'sections',
    id: 'consent',
    children: [
      { type: 'field', id: 'c-owner', field: 'owner' },
      { type: 'field', id: 'c-signature', field: 'signature', widget: 'signature' },
      { type: 'field', id: 'c-deed', field: 'deed' },
    ],
  },
};

/** The handover: the listing record, the consent placed in it. */
export const LISTING_HANDOVER: Page = {
  fieldia: '0.1',
  id: 'listing-handover',
  title: 'Listing handover',
  data: { kind: 'record', model: 'listing' },
  fields: {
    name: { type: 'char', label: 'Title', required: true },
    bedrooms: { type: 'integer', label: 'Bedrooms' },
  },
  layout: {
    type: 'sections',
    id: 'handover',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-bedrooms', field: 'bedrooms' },
      { type: 'form', id: 'p-consent', page: 'owner-consent', name: 'consent', title: 'Owner’s consent' },
    ],
  },
};

export const listingHandover = { pages: { 'listing-handover': LISTING_HANDOVER }, savedForms: { 'owner-consent': OWNER_CONSENT } };
