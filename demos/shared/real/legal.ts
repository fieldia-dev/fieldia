import type { ActionRequest, ActionResult, JsonValue, Line, Page, PropertyDefinition, RelatedRecord, Values } from '@fieldia/core';
import casePage from '../../../examples/pages/real-legal-case.page.json';
import closePage from '../../../examples/pages/real-legal-case-close.page.json';
import depositPage from '../../../examples/pages/real-legal-trust-deposit.page.json';
import surveyPage from '../../../examples/pages/real-survey.page.json';
import type { RealLane } from './lane';

/**
 * The legal lane: Sherkety ERP's largest record, the legal case (legal.case,
 * with legal_crm, legal_billing and legal_trust installed), and the survey's
 * own settings record (survey.survey). A commercial dispute at the Cairo
 * Economic Court, and a client-satisfaction survey, as sample records; the
 * server's onchange and the case's buttons answered as Flectra's Python does.
 *
 * Ids of linked records start at 7000 (contacts and users at 9000: the CRM lane's are 7001 and on), so they never meet another lane's.
 */

// ---------------------------------------------------------------------------
// Days, counted from today, so deadlines stay ahead and late tasks stay late.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** A day `n` days from today, as YYYY-MM-DD. */
function day(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return dayOf(date);
}
/** A moment `n` days from today at a local time of day, as a datetime field holds it: ISO 8601 in UTC, as Flectra keeps it. */
const at = (n: number, time: string) => new Date(`${day(n)}T${time}`).toISOString();
/** Years from a day, as YYYY-MM-DD. */
function yearsAfter(from: string, years: number): string {
  const [y, m, d] = from.split('-').map(Number);
  return `${y + years}-${pad(m)}-${pad(d)}`;
}
const round = (n: number) => Math.round(n * 100) / 100;
const egp = (n: number) => `${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

// ---------------------------------------------------------------------------
// The people and places the case links to.
// ---------------------------------------------------------------------------

const link = (id: number, label: string): RelatedRecord => ({ id, label });

const P = {
  nileMills: link(9001, 'Nile Cotton Mills S.A.E.'),
  nileExport: link(9002, 'Nile Cotton Export Co.'),
  delta: link(9003, 'Delta Logistics & Shipping S.A.E.'),
  hany: link(9004, 'Hany Mansour'),
  rana: link(9005, 'Rana Adel'),
  court: link(9006, 'Cairo Economic Court'),
  shazly: link(9007, 'El-Shazly & Partners (counsel for Delta)'),
  expert: link(9008, 'Dr. Mahmoud Fawzy (court expert)'),
  misrInsurance: link(9009, 'Misr Insurance Co.'),
};
const U = {
  hany: link(9101, 'Hany Mansour'),
  rana: link(9102, 'Rana Adel'),
  omar: link(9103, 'Omar Saeed'),
  laila: link(9104, 'Laila Hassan'),
};
const E = { hany: link(7201, 'Hany Mansour'), rana: link(7202, 'Rana Adel'), omar: link(7203, 'Omar Saeed') };
const COMPANY = link(7301, 'Sherkety Legal');
const EGP = link(7461, 'EGP'); // the demos' one EGP
const ROLE = {
  plaintiff: link(7501, 'Plaintiff'),
  defendant: link(7502, 'Defendant'),
  opposing: link(7503, 'Opposing Party'),
  opposingCounsel: link(7504, 'Opposing Counsel'),
  expert: link(7505, 'Court Expert'),
  insurer: link(7506, 'Insurer'),
};
const MATTER = { commercial: link(7601, 'Commercial litigation'), labour: link(7602, 'Labour claim'), formation: link(7603, 'Company formation') };
const STAGE = {
  intake: link(7701, 'Intake'),
  filed: link(7702, 'Filed'),
  hearings: link(7703, 'Hearings'),
  expert: link(7704, 'Expert report'),
  judgment: link(7705, 'Judgment'),
  formationDocs: link(7706, 'Formation documents'),
};
const RULE = {
  commercial: link(7801, 'Commercial obligations — 7 years'),
  civil: link(7802, 'Civil obligations — 15 years'),
  labour: link(7803, 'Employment contract claims — 1 year after it ends'),
};
const CATEGORY = { commercial: link(7851, 'Commercial disputes'), employment: link(7852, 'Employment') };
const TAG = { economic: link(7871, 'Economic Court'), supply: link(7872, 'Supply chain'), highValue: link(7873, 'High value') };
const CAT = {
  draft: link(7901, 'Drafting (DRAFT)'),
  court: link(7902, 'Court appearance (COURT)'),
  research: link(7903, 'Research (RES)'),
  call: link(7904, 'Client call (CALL)'),
};
/** Activity categories by shortcode, as legal.activity.category finds them; and each one's rate, when it sets one. */
const SHORTCODES: Record<string, { category: RelatedRecord; description: string; rate?: number }> = {
  DRAFT: { category: CAT.draft, description: 'Drafting' },
  COURT: { category: CAT.court, description: 'Court appearance', rate: 3000 },
  RES: { category: CAT.research, description: 'Legal research' },
  CALL: { category: CAT.call, description: 'Call with the client' },
};
const RATES: Record<number, number> = { 7201: 2500, 7202: 1500, 7203: 1200 };

// ---------------------------------------------------------------------------
// The case: Nile Cotton Mills v. Delta Logistics, at the Cairo Economic Court.
// ---------------------------------------------------------------------------

const line = (key: string, id: number, values: Values): Line => ({ key, id, values });

const FILED = day(-61);

/** The firm's compliance requirements (legal.compliance): a case links to those it is under. */
const COMPLIANCE: Record<number, Values & { name: string }> = {
  7071: { name: 'Client’s commercial register extract is current', regulation_reference: 'Commercial Register Law 34/1976', state: 'compliant', risk_level: 'low', review_date: day(120) },
  7072: { name: 'Know-your-client and beneficial owners on file', regulation_reference: 'Anti-Money Laundering Law 80/2002', state: 'compliant', risk_level: 'medium', review_date: day(200) },
  7073: { name: 'Filings follow the Economic Courts procedure', regulation_reference: 'Economic Courts Law 120/2008', state: 'under_review', risk_level: 'medium', review_date: day(14) },
  7074: { name: 'Data protection notice signed by the client', regulation_reference: 'Personal Data Protection Law 151/2020', state: 'active', risk_level: 'high', review_date: day(30) },
};

/** The properties each matter type keeps for its cases (legal.matter.type case_properties_definition). */
const CASE_PROPERTIES: Record<number, PropertyDefinition[]> = {
  7601: [
    { name: 'contract_value', label: 'Contract value (EGP)', type: 'float' },
    { name: 'contract_date', label: 'Contract signed on', type: 'date' },
    {
      name: 'claim_basis',
      label: 'Basis of the claim',
      type: 'selection',
      options: [
        { value: 'breach', label: 'Breach of contract' },
        { value: 'late_delivery', label: 'Late delivery' },
        { value: 'non_payment', label: 'Non-payment' },
        { value: 'defects', label: 'Defective goods' },
      ],
    },
    { name: 'expert_appointed', label: 'Court expert appointed', type: 'boolean' },
    { name: 'expert_name', label: 'Expert', type: 'char' },
  ],
  7602: [
    { name: 'employment_end', label: 'Employment ended on', type: 'date' },
    { name: 'labour_office', label: 'Labour office complaint no.', type: 'char' },
  ],
  7603: [],
};

/** The person using the demo: a legal officer, with billing and the branches. */
const LEGAL_USER = { id: 9101, name: 'Hany Mansour', roles: ['base.group_user', 'base.group_multi_company', 'legal.group_legal_user', 'legal.group_legal_officer', 'legal_billing.group_legal_billing_user'] };

const hearings = (): Line[] => [
  line('h1', 7011, { name: 'First hearing — statement of claim', hearing_type: 'initial', date_time: at(-40, '10:00'), duration: 2, location: 'Cairo Economic Court, Abbassia — Hall 3', judge_name: 'Counsellor Ahmed Ragab', state: 'completed', result: 'adjourned', reminder_days: 3 }),
  line('h2', 7012, { name: 'Appointment of the court expert', hearing_type: 'preliminary', date_time: at(-12, '09:30'), duration: 1.5, location: 'Cairo Economic Court, Abbassia — Hall 3', judge_name: 'Counsellor Ahmed Ragab', state: 'completed', result: 'partial', reminder_days: 3 }),
  line('h3', 7013, { name: 'Discussion of the expert’s report', hearing_type: 'trial', date_time: at(9, '10:00'), duration: 2, location: 'Cairo Economic Court, Abbassia — Hall 3', judge_name: 'Counsellor Ahmed Ragab', state: 'scheduled', result: 'pending', reminder_days: 5 }),
  line('h4', 7014, { name: 'Final pleadings', hearing_type: 'trial', date_time: at(37, '11:00'), duration: 3, location: 'Cairo Economic Court, Abbassia — Hall 3', judge_name: 'Counsellor Ahmed Ragab', state: 'scheduled', result: null, reminder_days: 7 }),
];

const tasks = (): Line[] => [
  line('t1', 7021, { name: 'File the defence memorandum on the expert’s preliminary findings', task_type: 'filing', assigned_to_id: U.hany, due_date: day(5), is_statutory: true, priority: '3', state: 'in_progress' }),
  line('t2', 7022, { name: 'Pay the expert’s deposit at the court treasury', task_type: 'other', assigned_to_id: U.omar, due_date: day(-3), is_statutory: true, priority: '2', state: 'pending' }),
  line('t3', 7023, { name: 'Certified translation of the 2024 supply contract annex', task_type: 'document_preparation', assigned_to_id: U.laila, due_date: day(-20), is_statutory: false, priority: '1', state: 'completed' }),
  line('t4', 7024, { name: 'Prepare the client’s CFO for the expert meeting', task_type: 'client_meeting', assigned_to_id: U.rana, due_date: day(7), is_statutory: false, priority: '1', state: 'pending' }),
  line('t5', 7025, { name: 'Research Court of Cassation rulings on penalty clauses', task_type: 'research', assigned_to_id: U.rana, due_date: day(3), is_statutory: false, priority: '2', state: 'pending' }),
];

const expenses = (): Line[] => [
  line('e1', 7031, { date: day(-60), name: 'Court fees on filing the claim', expense_type: 'court_fees', employee_id: U.omar, hours: 0, amount: 2150, is_billable: true, state: 'paid' }),
  line('e2', 7032, { date: day(-30), name: 'Certified translation, contract annex (14 pages)', expense_type: 'copying', employee_id: U.laila, hours: 0, amount: 3400, is_billable: true, state: 'approved' }),
  line('e3', 7033, { date: day(-12), name: 'Travel to Alexandria for the mill inspection', expense_type: 'travel', employee_id: U.rana, hours: 6, amount: 1200, is_billable: true, state: 'approved' }),
  line('e4', 7034, { date: day(-2), name: 'Expert’s deposit (court treasury)', expense_type: 'expert_fees', employee_id: U.omar, hours: 0, amount: 15000, is_billable: true, state: 'draft' }),
  line('e5', 7035, { date: day(-1), name: 'Copies of the exhibits for the court and the expert', expense_type: 'copying', employee_id: U.laila, hours: 0, amount: 450, is_billable: false, state: 'draft' }),
];

const timesheets = (): Line[] => [
  line('ts1', 7041, { date: day(-62), employee_id: E.hany, shortcode: null, activity_category_id: CAT.draft, name: 'Drafted the statement of claim', legal_task_id: null, unit_amount: 6.5, hourly_rate: 2500, flat_fee_amount: 0, billable_amount: 16250, is_billable: true, state: 'invoiced' }),
  line('ts2', 7042, { date: day(-41), employee_id: E.hany, shortcode: null, activity_category_id: CAT.court, name: 'First hearing, Hall 3', legal_task_id: null, unit_amount: 3, hourly_rate: 3000, flat_fee_amount: 0, billable_amount: 9000, is_billable: true, state: 'invoiced' }),
  line('ts3', 7043, { date: day(-35), employee_id: E.rana, shortcode: null, activity_category_id: CAT.research, name: 'Penalty clauses under the Trade Law', legal_task_id: null, unit_amount: 4.2, hourly_rate: 1500, flat_fee_amount: 0, billable_amount: 6300, is_billable: true, state: 'approved' }),
  line('ts4', 7044, { date: day(-20), employee_id: E.omar, shortcode: null, activity_category_id: CAT.draft, name: 'Exhibit bundle for the expert', legal_task_id: null, unit_amount: 5, hourly_rate: 1200, flat_fee_amount: 0, billable_amount: 6000, is_billable: true, state: 'approved' }),
  line('ts5', 7045, { date: day(-13), employee_id: E.hany, shortcode: null, activity_category_id: CAT.court, name: 'Expert appointment session', legal_task_id: null, unit_amount: 2, hourly_rate: 3000, flat_fee_amount: 0, billable_amount: 6000, is_billable: true, state: 'approved' }),
  line('ts6', 7046, { date: day(-8), employee_id: E.rana, shortcode: null, activity_category_id: CAT.call, name: 'Call with the client’s CFO on delivery records', legal_task_id: null, unit_amount: 0.6, hourly_rate: 1500, flat_fee_amount: 0, billable_amount: 900, is_billable: true, state: 'draft' }),
  line('ts7', 7047, { date: day(-4), employee_id: E.hany, shortcode: null, activity_category_id: CAT.draft, name: 'Defence memorandum, first draft', legal_task_id: link(7021, 'File the defence memorandum on the expert’s preliminary findings'), unit_amount: 3.5, hourly_rate: 2500, flat_fee_amount: 0, billable_amount: 8750, is_billable: true, state: 'draft' }),
  line('ts8', 7048, { date: day(-1), employee_id: E.omar, shortcode: null, activity_category_id: CAT.research, name: 'Internal know-how note (not billed)', legal_task_id: null, unit_amount: 1.5, hourly_rate: 1200, flat_fee_amount: 0, billable_amount: 0, is_billable: false, state: 'draft' }),
];

/** A short PDF with one line of text, as a file a case keeps. */
function pdf(text: string): string {
  const stream = `BT /F1 18 Tf 72 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const body = [
    '%PDF-1.4',
    '1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj',
    '2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj',
    '3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>> endobj',
    `4 0 obj <</Length ${stream.length}>>stream\n${stream}\nendstream endobj`,
    '5 0 obj <</Type/Font/Subtype/Type1/BaseFont/Helvetica>> endobj',
    'trailer <</Root 1 0 R>>',
    '%%EOF',
  ].join('\n');
  return btoa(body);
}
const file = (name: string, text: string) => {
  const data = pdf(text);
  return { name, type: 'application/pdf', size: Math.round((data.length * 3) / 4), data };
};

const documents = () => [
  file('Statement of claim, 1187-2026 Economic.pdf', 'Statement of claim - Nile Cotton Mills v. Delta Logistics'),
  file('Supply contract 2024, signed.pdf', 'Supply and transport contract, 14 March 2024'),
  file('Expert appointment order.pdf', 'Order appointing Dr. Mahmoud Fawzy as court expert'),
  file('Power of attorney, court, POA-2026-0031.pdf', 'Court power of attorney POA/2026/0031'),
];

const trustLines = (): Line[] => [
  line('tr1', 7061, { name: 'TRD/2026/00118', date: day(-58), transaction_type: 'deposit', method: 'bank_transfer', reference: 'CIB 4471-0091', amount: 100000, state: 'cleared' }),
  line('tr2', 7062, { name: 'TRT/2026/00041', date: day(-21), transaction_type: 'office_transfer', method: null, reference: 'INV/2026/00311', amount: -45000, state: 'cleared' }),
  line('tr3', 7063, { name: 'TRD/2026/00131', date: day(-2), transaction_type: 'deposit', method: 'cheque', reference: 'NBE cheque 000318', amount: 25000, state: 'pending_clearance' }),
];

/** What the server works out for a case from its lines: the computed fields Flectra stores or computes on read. */
function caseTotals(values: Values): Values {
  const rows = (name: string) => ((values[name] as Line[] | null) ?? []).map((l) => l.values);
  const today = day(0);
  const tasksNow = rows('task_ids');
  const expensesNow = rows('expense_ids');
  const sheet = rows('timesheet_ids');
  const billableAmount = (t: Values) =>
    t['is_billable'] ? (Number(t['flat_fee_amount']) || Number(t['unit_amount'] ?? 0) * Number(t['hourly_rate'] ?? 0)) : 0;
  const spent = round(expensesNow.filter((e) => e['state'] !== 'draft').reduce((sum, e) => sum + Number(e['amount'] ?? 0), 0));
  const upcoming = rows('hearing_ids')
    .filter((h) => h['state'] === 'scheduled' && typeof h['date_time'] === 'string' && new Date(h['date_time'] as string).getTime() > Date.now())
    .map((h) => h['date_time'] as string)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return {
    hearing_count: rows('hearing_ids').length,
    next_hearing_date: upcoming[0] ?? null,
    task_count: tasksNow.length,
    overdue_task_count: tasksNow.filter((t) => ['pending', 'in_progress'].includes(t['state'] as string) && t['due_date'] && (t['due_date'] as string) < today).length,
    expense_total: spent,
    budget_consumed_expenses: spent,
    total_billable_hours: round(sheet.filter((t) => t['is_billable']).reduce((sum, t) => sum + Number(t['unit_amount'] ?? 0), 0)),
    total_billed_amount: round(sheet.filter((t) => t['is_billable'] && t['state'] === 'invoiced').reduce((sum, t) => sum + billableAmount(t), 0)),
    budget_consumed_fees: round(sheet.reduce((sum, t) => sum + billableAmount(t), 0)),
    document_count: ((values['document_ids'] as unknown[] | null) ?? []).length,
    poa_count: rows('poa_ids').length,
    correspondence_count: rows('correspondence_ids').length,
  };
}

/** The matter ledger from the trust lines: cleared, pending, held. */
function trustTotals(values: Values): Values {
  const rows = ((values['trust_transaction_ids'] as Line[] | null) ?? []).map((l) => l.values);
  const cleared = round(rows.filter((t) => t['state'] === 'cleared').reduce((sum, t) => sum + Number(t['amount'] ?? 0), 0));
  const pending = round(rows.filter((t) => t['state'] === 'pending_clearance').reduce((sum, t) => sum + Number(t['amount'] ?? 0), 0));
  const protectedFunds = Number(values['trust_protected'] ?? 0);
  const available = round(cleared - protectedFunds);
  const minimum = Number(values['trust_minimum'] ?? 0);
  const below = !!values['evergreen_enabled'] && minimum > 0 && available < minimum;
  return {
    trust_balance: cleared,
    trust_pending: pending,
    trust_available: available,
    trust_below_minimum: below,
    trust_deposit_needed: below ? round(Math.max(Number(values['trust_replenish_to'] ?? 0) - available, 0)) : 0,
  };
}

function nileCase(): Values {
  const base: Values = {
    case_number: 'LEG/2026/LIT/0042',
    name: 'Nile Cotton Mills v. Delta Logistics — breach of the 2024 supply and transport contract',
    state: 'open',
    active: true,
    outcome: null,
    close_reason: null,
    my_timer_running: false,
    company_id: COMPANY,
    currency_id: EGP,
    conflict_check_count: 1,
    invoice_count: 2,
    lead_id: link(7951, 'Nile Cotton Mills — supply dispute with Delta'),
    payment_plan_count: 1,
    matter_type_id: MATTER.commercial,
    stage_id: STAGE.expert,
    case_type: 'litigation',
    category_id: CATEGORY.commercial,
    court_name: 'Cairo Economic Court — First Instance, Circuit 4',
    court_reference: '1187 / 2026 Economic',
    jurisdiction_id: link(7961, 'Egypt'),
    priority: '2',
    risk_level: 'medium',
    partner_id: P.nileMills,
    partner_ids: [P.nileExport],
    opposing_party_id: P.delta,
    responsible_attorney_id: U.hany,
    assigned_team_ids: [U.rana, U.omar],
    branch_id: link(7303, 'Sherkety Legal — Cairo'),
    case_properties: { contract_value: 4850000, contract_date: '2024-03-14', claim_basis: 'late_delivery', expert_appointed: true, expert_name: 'Dr. Mahmoud Fawzy' },
    date_opened: day(-72),
    date_filed: FILED,
    deadline: day(5),
    sol_date: yearsAfter('2024-03-14', 7),
    sol_rule_id: RULE.commercial,
    days_since_opened: 72,
    date_closed: null,
    estimated_value: 4850000,
    description:
      '<p>Nile Cotton Mills claims damages from Delta Logistics &amp; Shipping for <strong>late and partial delivery</strong> of 1,200 tonnes of raw cotton under the supply and transport contract of 14 March 2024.</p><ul><li>Three shipments arrived 41 to 63 days late; the mill stopped two spinning lines in September 2025.</li><li>Delta invokes force majeure (Suez Canal disruption); the contract’s clause 11 excludes it for inland legs.</li><li>The court appointed an expert on the delivery records; his report is due before the next hearing.</li></ul>',
    party_ids: [
      line('p1', 7051, { partner_id: P.nileMills, role_id: ROLE.plaintiff, is_primary: true, notes: 'Our client. Contact: the CFO, Mr. Sherif Abdelaziz.' }),
      line('p2', 7052, { partner_id: P.delta, role_id: ROLE.opposing, is_primary: false, notes: null }),
      line('p3', 7053, { partner_id: P.shazly, role_id: ROLE.opposingCounsel, is_primary: false, notes: 'Lead counsel: Ms. Dina El-Shazly.' }),
      line('p4', 7054, { partner_id: P.expert, role_id: ROLE.expert, is_primary: false, notes: 'Appointed at the second hearing; deposit 15,000 EGP.' }),
      line('p5', 7055, { partner_id: P.misrInsurance, role_id: ROLE.insurer, is_primary: false, notes: 'Insures Delta’s cargo; joined as a third party.' }),
    ],
    hearing_ids: hearings(),
    task_ids: tasks(),
    expense_ids: expenses(),
    document_ids: documents(),
    // A many2many to the firm's compliance requirements: the ids of those this case is under.
    compliance_ids: [link(7071, COMPLIANCE[7071].name), link(7072, COMPLIANCE[7072].name), link(7073, COMPLIANCE[7073].name)],
    contract_review_ids: [
      line('cr1', 7081, { name: 'CR/2026/0017', review_type: 'new_contract', reviewer_id: U.rana, risk_assessment: 'medium', state: 'in_review' }),
    ],
    poa_ids: [
      line('poa1', 7091, { name: 'POA/2026/0031', grantor_id: P.nileMills, grantee_id: P.hany, poa_type: 'court', issue_date: day(-80), expiry_date: day(285), is_notarized: true, state: 'active' }),
      line('poa2', 7092, { name: 'POA/2025/0102', grantor_id: P.nileMills, grantee_id: P.rana, poa_type: 'general', issue_date: day(-375), expiry_date: day(-10), is_notarized: true, state: 'expired' }),
    ],
    fee_arrangement: 'hourly',
    hourly_rate: 2500,
    flat_fee_amount: 180000,
    fee_recipient_id: E.hany,
    contingency_percent: 10,
    expected_settlement: 3200000,
    actual_settlement: 0,
    analytic_account_id: link(7981, 'LEG/2026/LIT/0042 Nile Cotton Mills v. Delta Logistics'),
    payment_profile_id: link(7991, 'Standard — 1.5% a month after 30 days'),
    budget_fees: 250000,
    budget_expenses: 40000,
    budget_threshold: 80,
    budget_notify_user_ids: [U.hany],
    flat_fee_line_ids: [
      line('ff1', 7101, { stage_id: STAGE.filed, description: 'Filing and the first hearing', amount: 40000, state: 'invoiced', invoice_id: link(7993, 'INV/2026/00311') }),
      line('ff2', 7102, { stage_id: STAGE.expert, description: 'Expert phase', amount: 60000, state: 'invoiceable', invoice_id: null }),
      line('ff3', 7103, { stage_id: STAGE.judgment, description: 'Judgment', amount: 80000, state: 'pending', invoice_id: null }),
    ],
    split_billing: true,
    split_line_ids: [line('sp1', 7111, { partner_id: P.nileMills, percent: 70 }), line('sp2', 7112, { partner_id: P.nileExport, percent: 30 })],
    trust_transaction_ids: trustLines(),
    trust_protected: 10000,
    evergreen_enabled: true,
    trust_minimum: 50000,
    trust_replenish_to: 120000,
    trust_last_request_date: day(-9),
    timesheet_ids: timesheets(),
    correspondence_ids: [
      line('m1', 7121, { name: 'COR/2026/0108', correspondence_type: 'client_letter', direction: 'outgoing', subject: 'Hearing schedule and what the expert phase means', sender_id: null, recipient_id: P.nileMills, date_sent: day(-11), delivery_status: 'delivered', state: 'delivered' }),
      line('m2', 7122, { name: 'COR/2026/0112', correspondence_type: 'opposing_letter', direction: 'incoming', subject: 'Without-prejudice settlement proposal', sender_id: P.shazly, recipient_id: null, date_sent: day(-6), delivery_status: 'delivered', state: 'awaiting_response' }),
      line('m3', 7123, { name: 'COR/2026/0115', correspondence_type: 'court_filing', direction: 'outgoing', subject: 'Objections to the expert’s preliminary findings', sender_id: null, recipient_id: P.court, date_sent: day(-2), delivery_status: 'in_transit', state: 'sent' }),
    ],
    notes: 'Delta’s counsel hinted at 2.4m EGP in the call of the 6th. The client will not go under 3m. Keep the expert’s site visit notes out of the client portal.',
    tag_ids: [TAG.economic, TAG.supply, TAG.highValue],
  };
  return { ...base, ...caseTotals(base), ...trustTotals(base) };
}

/** A new matter, still in draft and without a cleared conflict check: Start Work refuses it, as legal_crm's gate does. */
function draftCase(): Values {
  const base: Values = {
    case_number: 'LEG/2026/LAB/0043',
    name: 'Sara Hamdy v. Giza Spinning — unpaid end-of-service gratuity',
    state: 'draft',
    active: true,
    my_timer_running: false,
    company_id: COMPANY,
    currency_id: EGP,
    conflict_check_count: 0,
    invoice_count: 0,
    payment_plan_count: 0,
    matter_type_id: MATTER.labour,
    stage_id: STAGE.intake,
    case_type: 'labor',
    category_id: CATEGORY.employment,
    priority: '1',
    risk_level: 'low',
    responsible_attorney_id: U.rana,
    assigned_team_ids: [U.laila],
    date_opened: day(-1),
    days_since_opened: 1,
    fee_arrangement: 'hourly',
    hourly_rate: 1500,
    budget_threshold: 80,
    party_ids: [],
    hearing_ids: [],
    task_ids: [],
    expense_ids: [],
    document_ids: [],
    compliance_ids: [],
    contract_review_ids: [],
    poa_ids: [],
    flat_fee_line_ids: [],
    split_line_ids: [],
    trust_transaction_ids: [],
    timesheet_ids: [],
    correspondence_ids: [],
    tag_ids: [],
  };
  return { ...base, ...caseTotals(base), ...trustTotals(base) };
}

// ---------------------------------------------------------------------------
// The survey: a client-satisfaction survey of a Cairo company.
// ---------------------------------------------------------------------------

const SURVEY_QUESTIONS: [kind: 'section' | null, title: string, type: string | null, mandatory: boolean, trigger?: [number, string]][] = [
  ['section', 'Your experience with us', null, false],
  [null, 'How did you first hear about Nile Office Supplies?', 'simple_choice', false],
  [null, 'Overall, how satisfied are you with our service?', 'simple_choice', true],
  [null, 'Which of our services did you use this year?', 'multiple_choice', false],
  [null, 'Rate each part of your last order', 'matrix', true],
  ['section', 'Our team', null, false],
  [null, 'How quickly did we answer your requests?', 'simple_choice', true],
  [null, 'What could we do better?', 'text_box', false],
  ['section', 'About you', null, false],
  [null, 'Company name', 'char_box', false],
  [null, 'Number of employees', 'numerical_box', false],
  [null, 'May we call you about your answers?', 'simple_choice', true],
  [null, 'Best day for a follow-up call', 'date', false, [7212, 'May we call you about your answers?']],
];
const surveyLines = (): Line[] =>
  SURVEY_QUESTIONS.map(([kind, title, type, mandatory, trigger], i) =>
    line(`q${i + 1}`, 7201 + i, {
      sequence: (i + 1) * 10,
      kind,
      title,
      question_type: type,
      constr_mandatory: mandatory,
      random_questions_count: kind ? 1 : null,
      triggering_question_ids: trigger ? [link(trigger[0], trigger[1])] : [],
      description: null,
      constr_error_msg: mandatory ? 'This question requires an answer.' : null,
    })
  );

const surveyBackground =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#0f766e"/><g fill="none" stroke="#ccfbf1" stroke-width="6" stroke-linecap="round"><path d="M44 58h72M44 82h52M44 106h62"/></g><circle cx="118" cy="104" r="14" fill="#fbbf24"/></svg>'
  );

function satisfactionSurvey(): Values {
  return {
    title: 'Client satisfaction survey, autumn 2026',
    survey_type: 'survey',
    background_image: { name: 'survey.svg', type: 'image/svg+xml', size: 360, data: surveyBackground.split(',')[1] },
    user_id: U.laila,
    active: true,
    session_state: null,
    answer_count: 214,
    success_count: 0,
    answer_done_count: 187,
    slide_channel_count: 0,
    has_conditional_questions: true,
    question_and_page_ids: surveyLines(),
    questions_layout: 'page_per_section',
    progression_mode: 'percent',
    questions_selection: 'all',
    users_can_go_back: true,
    access_mode: 'public',
    users_login_required: false,
    is_attempts_limited: false,
    attempts_limit: 1,
    is_time_limited: false,
    time_limit: 10,
    scoring_type: 'no_scoring',
    scoring_success_min: 80,
    certification: false,
    certification_report_layout: 'modern_purple',
    certification_mail_template_id: null,
    certification_give_badge: false,
    certification_badge_id: null,
    exam_mode: false,
    exam_fullscreen: true,
    exam_tab_switch_limit: 3,
    exam_log_ip: true,
    session_code: '4821',
    session_link: 'https://erp.example.com/s/4821',
    session_speed_rating: false,
    description:
      '<p>Thank you for working with Nile Office Supplies this year. These questions take about <strong>four minutes</strong>; your answers go to our client-care team only.</p>',
    description_done: '<p>Thank you very much for your feedback! A member of our team reads every answer this week.</p>',
  };
}

// ---------------------------------------------------------------------------
// The app's answers: the case's and the survey's buttons, as Flectra's Python.
// ---------------------------------------------------------------------------

/** When each case's timer started, by record: the server keeps legal.timer rows. */
const timers = new Map<string, number>();
/** An answer comes after a moment, as one from a server does. */
const later = (result: ActionResult | undefined) => new Promise<ActionResult | undefined>((resolve) => setTimeout(() => resolve(result), 150));

function answer(request: ActionRequest): ActionResult | undefined {
  const v = request.values;
  const label = `${v['case_number'] ?? ''} ${v['name'] ?? ''}`.trim();
  switch (request.action) {
    // legal_crm's Start Work gate: no work before a cleared conflict check.
    case 'legal.case.action_open':
      if (!Number(v['conflict_check_count'] ?? 0)) {
        return {
          stop: `Cannot start work on case '${v['name']}': no cleared conflict check is attached. Run a conflict check and have it cleared by a manager first.`,
        };
      }
      return { values: { state: 'open' } };
    // After the Close Case wizard: into has set the outcome; the server lands the case in its closing stage and cancels pending tasks.
    case 'legal.case.close_case_done': {
      const cancel = v['close_cancel_pending_tasks'] !== false;
      const lines = ((v['task_ids'] as Line[] | null) ?? []).map((l) =>
        cancel && ['pending', 'in_progress'].includes(l.values['state'] as string) ? { ...l, values: { ...l.values, state: 'cancelled', is_overdue: false } } : l
      );
      const outcome = String(v['outcome'] ?? '');
      const contingencyWin = v['fee_arrangement'] === 'contingency' && ['won', 'settled'].includes(outcome);
      const words = { won: 'Won', lost: 'Lost', settled: 'Settled', withdrawn: 'Withdrawn', dismissed: 'Dismissed' }[outcome] ?? outcome;
      const values: Values = { stage_id: STAGE.judgment, task_ids: lines, ...caseTotals({ ...v, task_ids: lines }) };
      if (contingencyWin) values['invoice_count'] = Number(v['invoice_count'] ?? 0) + 1;
      return { values, say: { message: `Case closed with outcome: ${words}.${contingencyWin ? ' The contingency fee invoice is drafted.' : ''}`, tone: 'success' } };
    }
    case 'legal.case.action_start_timer':
      timers.set(String(request.recordId), Date.now());
      return { values: { my_timer_running: true }, say: { message: `Timer started on ${v['case_number']}. Any other timer of yours was paused.`, tone: 'info' } };
    case 'legal.case.action_stop_timer': {
      const started = timers.get(String(request.recordId));
      if (started === undefined) return { stop: 'You have no timer on this case.' };
      timers.delete(String(request.recordId));
      // Rounded up to the company's 6-minute increment, at least one.
      const hours = Math.max(1, Math.ceil((Date.now() - started) / 360000)) / 10;
      const rate = Number(v['hourly_rate'] ?? 0) || RATES[E.hany.id as number];
      const logged: Line = { key: `timer-${Date.now()}`, values: {
        date: day(0),
        employee_id: E.hany,
        shortcode: null,
        activity_category_id: null,
        name: 'Timer entry',
        legal_task_id: null,
        unit_amount: hours,
        hourly_rate: rate,
        flat_fee_amount: 0,
        billable_amount: round(hours * rate),
        is_billable: v['fee_arrangement'] === 'hourly' || v['fee_arrangement'] === 'contingency',
        state: 'draft',
      } };
      const sheet = [...((v['timesheet_ids'] as Line[] | null) ?? []), logged];
      return {
        values: { my_timer_running: false, timesheet_ids: sheet, ...caseTotals({ ...v, timesheet_ids: sheet }) },
        say: { message: `Logged ${hours.toFixed(1)} h on ${v['case_number']}: adjust it in Timesheets.`, tone: 'success' },
      };
    }
    case 'legal.case.action_view_conflict_checks':
      return { say: `Opens the conflict checks of ${v['case_number']}: ${v['conflict_check_count'] ?? 0}, CC/2026/0042 cleared by the intake manager.` };
    case 'legal.case.action_view_invoices':
      return { say: `Opens the ${v['invoice_count']} invoices of ${v['case_number']}: INV/2026/00311 (paid) and INV/2026/00347 (due ${egp(38750)}).` };
    case 'legal.case.action_view_source_lead':
      return { say: `Opens the opportunity the case came from: ${(v['lead_id'] as RelatedRecord | null)?.label ?? ''}.` };
    case 'legal.case.action_view_payment_plans':
      return { say: `Opens the payment plans of ${v['case_number']}: PP/2026/0007, 6 monthly instalments of ${egp(25000)}, 2 paid.` };
    // legal_trust: a deposit made in its dialog, saved as a draft transaction for an officer to confirm.
    case 'legal.case.record_trust_deposit': {
      const amount = Number(v['deposit_amount'] ?? 0);
      const deposit: Line = { key: `dep-${Date.now()}`, values: {
        name: 'TRD/2026/00137',
        date: v['deposit_date'] ?? day(0),
        transaction_type: 'deposit',
        method: v['deposit_method'] ?? null,
        reference: v['deposit_reference'] ?? null,
        amount,
        state: 'draft',
      } };
      return {
        values: {
          trust_transaction_ids: [...((v['trust_transaction_ids'] as Line[] | null) ?? []), deposit],
          deposit_amount: null,
          deposit_method: null,
          deposit_reference: null,
          deposit_date: null,
        },
        say: { message: `Deposit TRD/2026/00137 of ${egp(amount)} saved as a draft: confirm it to post the receipt.`, tone: 'success' },
      };
    }
    case 'legal.case.action_pay_invoice_from_trust':
      return { say: `Opens Pay Invoice from Trust for ${label}: INV/2026/00347, ${egp(38750)} due; ${egp(Number(v['trust_available'] ?? 0))} available.` };
    case 'legal.case.action_trust_transfer':
      return { say: `Opens a matter transfer from ${v['case_number']} to another matter of ${(v['partner_id'] as RelatedRecord | null)?.label ?? 'the client'}.` };
    case 'legal.case.action_request_trust_deposit': {
      const needed = Number(v['trust_deposit_needed'] ?? 0);
      if (!v['partner_id']) return { stop: `Case '${label}' has no client to request a deposit from.` };
      if (needed <= 0) return { stop: `Nothing to request on '${label}': the available trust funds already cover the replenish-to target.` };
      return {
        values: { trust_last_request_date: day(0) },
        say: { message: `Deposit request sent to ${(v['partner_id'] as RelatedRecord).label}: ${egp(needed)}, with the trust account’s bank details.`, tone: 'success' },
      };
    }

    // The survey's buttons.
    case 'survey.survey.action_send_survey':
      return { say: `Opens Share: the link ${v['session_link'] ?? ''}, or invitations by email to chosen contacts.` };
    case 'survey.survey.action_result_survey':
      return { say: `Opens the results of “${v['title']}”: ${v['answer_done_count']} completed answers.` };
    case 'survey.survey.action_start_session':
      return { values: { session_state: 'ready' }, say: { message: `Live session ready: attendees join with code ${v['session_code']}.`, tone: 'success' } };
    case 'survey.survey.action_open_session_manager':
      return { say: 'Opens the session manager in a new tab.' };
    case 'survey.survey.action_test_survey':
      return { say: `Opens “${v['title']}” in test mode in a new tab: answers are not counted.` };
    case 'survey.survey.action_print_survey':
      return { say: `Opens a printable copy of “${v['title']}”.` };
    case 'survey.survey.action_survey_user_input':
      return { say: `Opens the ${v['answer_count']} registered participations.` };
    case 'survey.survey.action_survey_view_slide_channels':
      return { say: `Opens the ${v['slide_channel_count']} courses using this survey.` };
    case 'survey.survey.action_survey_user_input_certified':
      return { say: `Opens the ${v['success_count']} certified participations.` };
    case 'survey.survey.action_survey_user_input_completed':
      return { say: `Opens the ${v['answer_done_count']} completed participations.` };
    case 'survey.survey.action_survey_preview_certification_template':
      return { say: `Opens a preview of the “${v['certification_report_layout']}” certificate in a new tab.` };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Onchange: what Flectra's server works out as a field changes.
// ---------------------------------------------------------------------------

/** legal.limitation.rule's suggestion: a rule for the case type, counted from the filing date (or the opening date, or today). */
const LIMITATION: Record<string, { rule: RelatedRecord; years: number }> = {
  litigation: { rule: RULE.commercial, years: 7 },
  arbitration: { rule: RULE.commercial, years: 7 },
  real_estate: { rule: RULE.civil, years: 15 },
  labor: { rule: RULE.labour, years: 1 },
};
/** legal.matter.type's defaults: they fill only fields still empty, and the practice area always. */
const MATTER_DEFAULTS: Record<number, { practice: string; tags: RelatedRecord[]; rate: number; team: RelatedRecord[]; stage: RelatedRecord; properties: Values }> = {
  7601: { practice: 'litigation', tags: [TAG.economic], rate: 2500, team: [U.rana, U.omar], stage: STAGE.intake, properties: { contract_value: null, contract_date: null, claim_basis: null, expert_appointed: false, expert_name: null } },
  7602: { practice: 'labor', tags: [], rate: 1500, team: [U.laila], stage: STAGE.intake, properties: {} },
  7603: { practice: 'corporate', tags: [], rate: 2000, team: [U.laila], stage: STAGE.formationDocs, properties: {} },
};
const empty = (value: unknown) => value === null || value === undefined || value === '' || value === 0 || (Array.isArray(value) && !value.length);

const caseOnchange: Record<string, (values: Values) => Values> = {
  hearing_ids: caseTotals,
  task_ids: caseTotals,
  expense_ids: caseTotals,
  timesheet_ids: (values) => {
    // A shortcode typed on a line applies its category, its description when empty and its rate, then clears itself.
    // Every keystroke of a cell reaches the server here, not only the cell's last value as in Flectra, so a code is
    // applied once it is whole, and one not (yet) known is left as typed (see the gap log).
    const lines = ((values['timesheet_ids'] as Line[] | null) ?? []).map((l) => {
      const code = String(l.values['shortcode'] ?? '').trim().toUpperCase();
      const found = code ? SHORTCODES[code] : undefined;
      if (!found) return l;
      const employee = l.values['employee_id'] as RelatedRecord | null;
      const rate = found.rate ?? (Number(values['hourly_rate'] ?? 0) || RATES[Number(employee?.id)] || 0);
      return { ...l, values: { ...l.values, shortcode: null, activity_category_id: found.category, name: l.values['name'] || found.description, hourly_rate: rate } };
    });
    const changed = lines.some((l, i) => l !== ((values['timesheet_ids'] as Line[]) ?? [])[i]);
    return { ...(changed ? { timesheet_ids: lines } : {}), ...caseTotals({ ...values, timesheet_ids: lines }) };
  },
  document_ids: caseTotals,
  poa_ids: caseTotals,
  correspondence_ids: caseTotals,
  trust_transaction_ids: trustTotals,
  evergreen_enabled: trustTotals,
  trust_minimum: trustTotals,
  trust_replenish_to: trustTotals,
  case_type: (values): Values => {
    if (values['sol_date']) return {};
    const found = LIMITATION[values['case_type'] as string];
    if (!found) return {};
    const from = (values['date_filed'] as string | null) ?? (values['date_opened'] as string | null) ?? day(0);
    return { sol_date: yearsAfter(from, found.years), sol_rule_id: found.rule };
  },
  matter_type_id: (values) => {
    const type = values['matter_type_id'] as RelatedRecord | null;
    const found = type ? MATTER_DEFAULTS[Number(type.id)] : undefined;
    if (!found) return {};
    const result: Values = { case_type: found.practice, stage_id: found.stage, case_properties: { ...found.properties, ...((values['case_properties'] as Values | null) ?? {}) } as JsonValue };
    if (empty(values['jurisdiction_id'])) result['jurisdiction_id'] = link(7961, 'Egypt');
    if (empty(values['tag_ids'])) result['tag_ids'] = found.tags;
    if (empty(values['hourly_rate'])) result['hourly_rate'] = found.rate;
    if (empty(values['assigned_team_ids'])) result['assigned_team_ids'] = found.team;
    return result;
  },
  // Kept in sync with an Opposing Party row in the Parties tab (Flectra does it as the case is saved).
  opposing_party_id: (values): Values => {
    const party = values['opposing_party_id'] as RelatedRecord | null;
    if (!party) return {};
    const rows = (values['party_ids'] as Line[] | null) ?? [];
    const opposing = rows.filter((l) => (l.values['role_id'] as RelatedRecord | null)?.id === ROLE.opposing.id);
    if (opposing.some((l) => (l.values['partner_id'] as RelatedRecord | null)?.id === party.id)) return {};
    if (opposing.length) {
      return { party_ids: rows.map((l) => (l === opposing[0] ? { ...l, values: { ...l.values, partner_id: party } } : l)) };
    }
    return { party_ids: [...rows, { key: `opposing-${party.id}`, values: { partner_id: party, role_id: ROLE.opposing, is_primary: false, notes: null } }] };
  },
};

const surveyOnchange: Record<string, (values: Values) => Values> = {
  survey_type: (values): Values => {
    switch (values['survey_type']) {
      case 'survey':
        return { certification: false, is_time_limited: false, scoring_type: 'no_scoring' };
      case 'live_session':
        return {
          access_mode: 'public',
          is_attempts_limited: false,
          is_time_limited: false,
          progression_mode: 'percent',
          questions_layout: 'page_per_question',
          questions_selection: 'all',
          scoring_type: 'scoring_with_answers',
          users_can_go_back: false,
        };
      case 'assessment':
        return { access_mode: 'token', scoring_type: 'scoring_with_answers' };
      default:
        return {};
    }
  },
};

// ---------------------------------------------------------------------------
// The lane.
// ---------------------------------------------------------------------------

const named = (records: Record<number, string>, field = 'name') => Object.fromEntries(Object.entries(records).map(([id, label]) => [id, { [field]: label }]));
const labels = (list: Record<string, RelatedRecord>) => Object.fromEntries(Object.values(list).map((r) => [r.id, r.label])) as Record<number, string>;

export const lane: RealLane = {
  pages: {
    'real-legal-case': casePage as Page,
    'real-survey': surveyPage as Page,
  },
  opened: {
    'real-legal-case-close': closePage as Page,
    'real-legal-trust-deposit': depositPage as Page,
  },
  records: {
    'legal.case': { 42: nileCase(), 43: draftCase() },
    'survey.survey': { 7: satisfactionSurvey() },
    'res.partner': {
      ...named(labels(P)),
      [P.hany.id]: { name: P.hany.label, is_attorney: true },
      [P.rana.id]: { name: P.rana.label, is_attorney: true },
      9010: { name: 'Giza Spinning & Weaving Co.' },
      9011: { name: 'Sara Hamdy' },
    },
    'res.users': { ...named(labels(U)), 9105: { name: 'Portal: Nile Cotton Mills', share: true } },
    'hr.employee': named(labels(E)),
    'res.company': { 7301: { name: 'Sherkety Legal' }, 7302: { name: 'Sherkety Legal — Alexandria', parent_id: COMPANY }, 7303: { name: 'Sherkety Legal — Cairo', parent_id: COMPANY } },
    'res.currency': { 7461: { name: 'EGP' } },
    'legal.party.role': named(labels(ROLE)),
    'legal.matter.type': named(labels(MATTER)),
    // A stage serves the matter types it lists, or every one while it lists none (matter_type_ids contains).
    'legal.case.stage': {
      7701: { name: 'Intake', matter_type_ids: [] },
      7702: { name: 'Filed', matter_type_ids: [] },
      7703: { name: 'Hearings', matter_type_ids: [] },
      7704: { name: 'Expert report', matter_type_ids: [MATTER.commercial, MATTER.labour] },
      7705: { name: 'Judgment', matter_type_ids: [] },
      7706: { name: 'Formation documents', matter_type_ids: [MATTER.formation] },
    },
    'legal.limitation.rule': named(labels(RULE)),
    'legal.case.category': named(labels(CATEGORY)),
    'legal.jurisdiction': { 7961: { name: 'Egypt' }, 7962: { name: 'Saudi Arabia' }, 7963: { name: 'United Arab Emirates' } },
    'legal.tag': { 7871: { name: TAG.economic.label, color: 4 }, 7872: { name: TAG.supply.label, color: 2 }, 7873: { name: TAG.highValue.label, color: 1 } },
    'legal.compliance': COMPLIANCE,
    'legal.activity.category': named(labels(CAT)),
    // The case's tasks, each knowing its case: a time entry's Legal Task offers only this case's (case_id = parent.id).
    'legal.task': {
      ...Object.fromEntries(tasks().map((t) => [t.id, { name: t.values['name'], case_id: link(42, 'Nile Cotton Mills v. Delta Logistics') }])),
      7029: { name: 'Collect the end-of-service calculation', case_id: link(43, 'Sara Hamdy v. Giza Spinning — unpaid end-of-service gratuity') },
    },
    'legal.payment.profile': { 7991: { name: 'Standard — 1.5% a month after 30 days', company_id: COMPANY }, 7992: { name: 'Corporate — 1% a month after 45 days', company_id: COMPANY } },
    'legal.trust.account': { 7995: { name: 'Client trust account — CIB 100-447-0091' } },
    'account.move': { 7993: { name: 'INV/2026/00311' }, 7994: { name: 'INV/2026/00347' } },
    'crm.lead': { 7951: { name: 'Nile Cotton Mills — supply dispute with Delta' } },
    'account.analytic.account': { 7981: { name: 'LEG/2026/LIT/0042 Nile Cotton Mills v. Delta Logistics' } },
    'survey.question': Object.fromEntries(SURVEY_QUESTIONS.map(([, title], i) => [7201 + i, { title }])),
    'mail.template': { 7971: { name: 'Certification: Success', model: 'survey.user_input' }, 7972: { name: 'Survey: Invite', model: 'survey.user_input' } },
    'gamification.badge': { 7975: { name: 'Certified supplier contact' } },
  },
  onchange: {
    'legal.case': caseOnchange,
    'survey.survey': surveyOnchange,
  },
  warnings: {
    'legal.case': {
      // Flectra refuses the change on save; here the server says so as the arrangement is picked.
      fee_arrangement: (values) =>
        ((values['timesheet_ids'] as Line[] | null) ?? []).some((l) => l.values['state'] === 'invoiced')
          ? `You cannot change the fee arrangement of case ${values['case_number']}: it already has billed activity. Create a new matter for the new arrangement instead.`
          : null,
    },
  },
  users: { 'real-legal-case': LEGAL_USER, 'real-survey': LEGAL_USER },
  navigation: {
    'real-legal-case': { records: [42, 43], breadcrumbs: [{ label: 'Cases', href: '#cases' }] },
    'real-survey': { records: [7], breadcrumbs: [{ label: 'Surveys', href: '#surveys' }] },
  },
  shows: { 'legal.tag': { color: 'color' } },
  definitions: { case_properties: (values) => CASE_PROPERTIES[Number((values['matter_type_id'] as RelatedRecord | null)?.id ?? 0)] ?? [] },
  labelField: { 'survey.question': 'title', 'survey.survey': 'title', 'legal.case': 'name' },
  action: (request) => {
    const result = answer(request);
    return result === undefined ? undefined : later(result);
  },
};
