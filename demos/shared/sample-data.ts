import { createMemoryDataSource, type Page } from '@fieldia/core';
import customer from '../../examples/pages/customer.page.json';
import fields from '../../examples/pages/fields.page.json';
import signup from '../../examples/pages/signup.page.json';
import survey from '../../examples/pages/survey.page.json';
import { customPage } from './custom-page';

/** The example pages every demo can show, by name. */
export const pages: Record<string, Page> = {
  signup: signup as Page,
  survey: survey as Page,
  customer: customer as Page,
  fields: fields as Page,
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
      employee: { 21: { name: 'Mona Adel' }, 22: { name: 'Karim Fathy' }, 23: { name: 'Salma Nabil' } },
      service: { 31: { name: 'Design' }, 32: { name: 'Project management' }, 33: { name: 'Furniture supply' }, 34: { name: 'After-care' } },
      // The "Every field" page: one record that fills every widget.
      project: {
        1: {
          name: 'Office fit-out, Nile Towers 12th floor',
          email: 'site@niletraders.example',
          phone: '+20 2 2345 6700',
          portal: 'https://portal.niletraders.example',
          portal_password: 'nile-12th-floor',
          scope: 'Strip-out of the old reception, new open-plan workspace for 48 people, two meeting rooms and a kitchen.',
          brief: '<p>Calm, daylight-first. <strong>Keep the river view</strong> from every desk.</p><ul><li>Acoustic panels in meeting rooms</li><li>Oak and white</li></ul>',
          seats: 48,
          area: 640.5,
          currency_id: { id: 1, label: 'EGP' },
          budget: 1850000,
          client_rating: 4,
          readiness: 3,
          signed: true,
          reminders: false,
          stage: 'design',
          billing: 'milestones',
          deliverables: ['drawings', 'furniture'],
          start_date: '2026-10-11',
          kickoff: '2026-10-12T10:00',
          client_id: { id: 1, label: 'Nile Traders' },
          tag_ids: [{ id: 11, label: 'VIP' }],
          team_ids: [{ id: 21, label: 'Mona Adel' }, { id: 22, label: 'Karim Fathy' }],
          service_ids: [{ id: 31, label: 'Design' }, { id: 32, label: 'Project management' }],
          source: { model: 'partner', id: 1, label: 'Nile Traders' },
          milestone_ids: [
            { key: 'm1', id: 51, values: { name: 'Site survey', due: '2026-10-15', hours: 12, amount: 45000, owner_id: { id: 21, label: 'Mona Adel' }, invoiced: true } },
            { key: 'm2', id: 52, values: { name: 'Design sign-off', due: '2026-11-05', hours: 64, amount: 380000, owner_id: { id: 22, label: 'Karim Fathy' }, invoiced: false } },
          ],
          contract: null,
          photo: null,
          settings: { badge_readers: 4, visitor_hours: '08:00-18:00', zones: ['reception', 'open-plan'] },
          extra: { floor: 12, lift_access: 'Freight lift, 08:00-10:00', parking: 6 },
        },
      },
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
