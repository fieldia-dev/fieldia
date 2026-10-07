import type { ActionRequest, ActionResult, MemoryDataSourceOptions, Page, PropertyDefinition } from '@fieldia/core';
import business from '../../examples/pages/business.page.json';

/**
 * The business widgets' demo: a fit-out task with priority stars and a
 * state's dot on its title's line, a live timer the app starts and stops,
 * hours as HH:MM, a range of dates, tag colours, values to copy, a PDF shown
 * inline, an analytic distribution, tax totals, payments, and properties the
 * task's project defines. Its records, its projects' definitions, and the
 * app's answers to Start and Stop.
 */

export const businessPage = business as Page;

/** A small PDF of one page: the site's instructions. */
const INSTRUCTIONS =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDcwPj5zdHJlYW0KQlQgL0YxIDIyIFRmIDcyIDc0MCBUZCAoTGlmdCBib29raW5nOiBmcmVpZ2h0IGxpZnQsIDA4OjAwLTEwOjAwKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU0IDAwMDAwIG4gCjAwMDAwMDAxMDUgMDAwMDAgbiAKMDAwMDAwMDIxNyAwMDAwMCBuIAowMDAwMDAwMzM0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzk3CiUlRU9GCg==';

/** What each project keeps for its tasks' properties: Flectra's task_properties_definition. */
const DEFINITIONS: Record<number, PropertyDefinition[]> = {
  1: [
    { name: 'floor', label: 'Floor', type: 'integer' },
    { name: 'lift_booked', label: 'Lift booked', type: 'boolean' },
    { name: 'site_contact', label: 'Site contact', type: 'char' },
    { name: 'handover', label: 'Handover', type: 'date' },
  ],
  2: [
    { name: 'clinic_rooms', label: 'Treatment rooms', type: 'integer' },
    { name: 'gas_lines', label: 'Medical gas lines', type: 'boolean' },
  ],
};

export const businessData: Pick<MemoryDataSourceOptions, 'records' | 'definitions'> = {
  records: {
    // Models of its own, so its records never mix with the real pages' (the currencies are theirs).
    'fitout.project': { 1: { name: 'Nile Towers fit-out' }, 2: { name: 'Amira Clinics, Zamalek' } },
    'fitout.analytic.account': { 1: { name: 'Cairo office' }, 2: { name: 'Alexandria branch' }, 3: { name: 'Fit-out projects' }, 4: { name: 'Marketing' } },
    'fitout.task': {
      1: {
        name: 'Lay the raised floor, 12th floor',
        priority: '2',
        kanban_state: 'normal',
        project_id: { id: 1, label: 'Nile Towers fit-out' },
        is_favourite: true,
        color: 7,
        epic_color: '#2c8397',
        date_from: '2026-10-12',
        date_to: '2026-10-16',
        visit_start: '2026-10-12T07:30:00.000Z',
        visit_end: '2026-10-12T10:00:00.000Z',
        allocated_hours: 36.5,
        duration: 12.75,
        timer_start: null,
        prepayment_percent: 0.3,
        session_link: 'https://portal.niletraders.example/s/12F-floor',
        access_note: 'Freight lift 08:00 to 10:00. Badge from reception, ask for Karim.',
        instructions: { name: 'Raised floor, method statement.pdf', type: 'application/pdf', size: 577, data: INSTRUCTIONS },
        slides: null,
        currency_id: { id: 7461, label: 'EGP' },
        analytic_distribution: { '1': 70, '3': 30 },
        tax_totals: {
          amount_untaxed: 184000,
          amount_total: 211560,
          subtotals: [{ name: 'Untaxed Amount', amount: 184000 }],
          subtotals_order: ['Untaxed Amount'],
          groups_by_subtotal: {
            'Untaxed Amount': [
              { tax_group_id: 1, tax_group_name: 'VAT 14%', tax_group_amount: 25760, tax_group_base_amount: 184000 },
              { tax_group_id: 2, tax_group_name: 'Stamp duty', tax_group_amount: 1800, tax_group_base_amount: 184000 },
            ],
          },
        },
        invoice_payments_widget: {
          title: 'Less Payment',
          outstanding: false,
          content: [
            { name: 'PBNK1/2026/0112', journal_name: 'Bank', amount: 120000, date: '2026-10-01', ref: 'INV/2026/0042', account_payment_id: 112 },
            { name: 'PCSH1/2026/0031', journal_name: 'Cash', amount: 40000, date: '2026-10-05', ref: 'Site deposit', account_payment_id: 31 },
          ],
        },
        amount_residual: 51560,
        task_properties: { floor: 12, lift_booked: true, site_contact: 'Karim Fathy', handover: '2026-10-30' },
        child_ids: [
          { key: 's1', id: 11, values: { priority: '1', name: 'Level the slab', kanban_state: 'done', allocated_hours: 8, progress: 100 } },
          { key: 's2', id: 12, values: { priority: '0', name: 'Fit the pedestals', kanban_state: 'normal', allocated_hours: 16.5, progress: 45 } },
          { key: 's3', id: 13, values: { priority: '0', name: 'Lay the panels', kanban_state: 'blocked', allocated_hours: 12, progress: 0 } },
        ],
      },
    },
  },
  definitions: {
    task_properties: (values) => DEFINITIONS[Number((values['project_id'] as { id: number } | null)?.id ?? 0)] ?? [],
  },
};

/**
 * The app's answers to Start and Stop: the timer starts now; stopped, the
 * time it ran is added to the time logged, rounded up to the minute, and said.
 */
export function answerBusiness(request: ActionRequest, locale?: string): ActionResult | undefined {
  if (request.action === 'action_timer_start') return { values: { timer_start: new Date().toISOString() } };
  if (request.action !== 'action_timer_stop') return undefined;
  const started = new Date(String(request.values['timer_start'] ?? '')).getTime();
  const minutes = Number.isNaN(started) ? 0 : Math.max(1, Math.ceil((Date.now() - started) / 60000));
  const logged = Math.round((Number(request.values['duration'] ?? 0) + minutes / 60) * 100) / 100;
  const arabic = locale?.startsWith('ar') ?? false;
  return { values: { timer_start: null, duration: logged }, say: { message: arabic ? `سُجّلت ${minutes} دقيقة.` : `${minutes} min logged.`, tone: 'success' } };
}
