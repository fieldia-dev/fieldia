import type { Page, Values } from '@fieldia/core';
import customerCard from '../../examples/pages/customer-card.page.json';

/**
 * Possible duplicates and Merge, on a customer's card (`duplicates` on the page): the sample customers, and a second
 * Nile Traders typed in by someone else — "Nile Traders Co.", the same email, a tax id and a website the first has
 * not — which the memory source finds (`alikeRecords`: the same phone, email or tax id as people write them apart, a
 * name close enough) and merges as a backend would. Added on the card's own page alone, so the customers list and the
 * flagship customer stay as they were.
 */
export const customerCardPage = customerCard as Page;

/** The second Nile Traders, by its id: the card opens it with `record=40`. */
export const DUPLICATE_CUSTOMER = 40;

/** The records the card's page adds to the samples' customers. */
export function duplicateCustomers(): Record<string, Values> {
  return {
    [DUPLICATE_CUSTOMER]: {
      name: 'Nile Traders Co.',
      is_company: true,
      company_type: 'company',
      state: 'draft',
      email: 'Orders@NileTraders.example',
      phone: null,
      vat: '312-645-987',
      website: 'https://niletraders.example',
      city: 'Cairo',
      country_id: { id: 1, label: 'Egypt' },
    },
  };
}
