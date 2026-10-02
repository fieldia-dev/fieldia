import { createMemoryDataSource, type Page } from '@fieldia/core';
import customer from '../../examples/pages/customer.page.json';
import signup from '../../examples/pages/signup.page.json';
import survey from '../../examples/pages/survey.page.json';
import { customPage } from './custom-page';

/** The example pages every demo can show, by name. */
export const pages: Record<string, Page> = {
  signup: signup as Page,
  survey: survey as Page,
  customer: customer as Page,
  custom: customPage,
};

/** A customer to edit, and the records its relations point to. Sample data. */
export function sampleDataSource() {
  return createMemoryDataSource({
    records: {
      partner: {
        1: {
          name: 'Nile Traders',
          is_company: true,
          state: 'active',
          email: 'orders@niletraders.example',
          phone: '+20 2 2345 6789',
          website: null,
          country_id: { id: 1, label: 'Egypt' },
          tag_ids: [{ id: 10, label: 'Wholesale' }],
          child_ids: [{ key: 'c1', id: 2, values: { name: 'Mona Adel', function: 'Head buyer', email: 'mona@niletraders.example', phone: null } }],
          currency_id: { id: 1, label: 'EGP' },
          credit_limit: 250000,
          over_limit: false,
          sale_order_count: 18,
          invoice_count: 12,
          notes: '<p>Pays within 30 days. Prefers deliveries on Sundays.</p>',
        },
      },
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Saudi Arabia' } },
      'country.region': {
        1: { name: 'Cairo', country_id: { id: 1, label: 'Egypt' } },
        2: { name: 'Alexandria', country_id: { id: 1, label: 'Egypt' } },
        3: { name: 'Amman', country_id: { id: 2, label: 'Jordan' } },
        4: { name: 'Riyadh', country_id: { id: 3, label: 'Saudi Arabia' } },
      },
      currency: { 1: { name: 'EGP' }, 2: { name: 'JOD' }, 3: { name: 'SAR' } },
      'partner.tag': { 10: { name: 'Wholesale' }, 11: { name: 'VIP' } },
    },
    onchange: {
      partner: {
        country_id: (values) => {
          const id = (values['country_id'] as { id: number } | null)?.id;
          const currency = id === 2 ? { id: 2, label: 'JOD' } : id === 3 ? { id: 3, label: 'SAR' } : { id: 1, label: 'EGP' };
          return { currency_id: currency, state_id: null };
        },
      },
    },
    warnings: {
      partner: {
        credit_limit: (values) =>
          Number(values['credit_limit']) > 100000 ? 'Above the 100,000 approval limit: a manager has to sign this off.' : null,
      },
    },
  });
}
