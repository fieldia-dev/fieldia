import type { ActionRequest, ActionResult, Line, Page, RelatedRecord, Values } from '@fieldia/core';
import contact from '../../../examples/pages/real-contact.page.json';
import opportunity from '../../../examples/pages/real-opportunity.page.json';
import leadLost from '../../../examples/pages/real-crm-lead-lost.page.json';
import leadToOpportunity from '../../../examples/pages/real-crm-lead2opportunity.page.json';
import tender from '../../../examples/pages/real-tender.page.json';
import tenderLoss from '../../../examples/pages/real-tender-loss.page.json';
import type { RealLane } from './lane';

/**
 * The CRM lane: a contact (res.partner), a lead or opportunity (crm.lead) and
 * Sherkety's own tender (tender.opportunity), with the records they point to.
 * Ids run from 7001 so they never meet another lane's or the samples' own.
 */

/** A day counted from today, as YYYY-MM-DD, so the sample's dates stay ahead of whoever opens it. */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const at = (offset: number, time: string) => `${day(offset)}T${time}`;
const link = (id: number, label: string): RelatedRecord => ({ id, label });
const idOf = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? Number((value as RelatedRecord).id) : null);
const linesOf = (value: unknown) => (Array.isArray(value) ? (value as Line[]) : []);
/** Whole days from now until a date and time, as Python's `timedelta.days` counts them. */
const daysUntil = (when: unknown) => (typeof when === 'string' && when ? Math.floor((new Date(when).getTime() - Date.now()) / 86400000) : 0);

// ── The records links point to ────────────────────────────────────────────

const EGYPT = link(7401, 'Egypt');
const CAIRO = link(7411, 'Cairo');
const GIZA = link(7412, 'Giza');
const EGP = link(7451, 'EGP');
const SALMA = link(7101, 'Salma Nabil');
const KARIM = link(7102, 'Karim Fathy');
const MONA = link(7103, 'Mona Adel');
const YOUSSEF = link(7104, 'Youssef Kamal');
const LAILA = link(7105, 'Laila Mostafa');
const TEAM_CAIRO = link(7201, 'Real Estate — Cairo');
const TEAM_TENDERS = link(7202, 'Government & Tenders');

/** The stages of the pipeline, in order, and the probability each gives an opportunity entering it. */
const STAGES: Record<number, { name: string; sequence: number; probability: number; is_won?: boolean }> = {
  7301: { name: 'New', sequence: 1, probability: 10 },
  7302: { name: 'Qualified', sequence: 2, probability: 30 },
  7303: { name: 'Proposition', sequence: 3, probability: 70 },
  7304: { name: 'Won', sequence: 70, probability: 100, is_won: true },
};
const stage = (id: number) => link(id, STAGES[id].name);

/** Each salesperson's sales team, as Flectra works one out from the salesperson. */
const TEAM_OF: Record<number, RelatedRecord> = { 7101: TEAM_CAIRO, 7102: TEAM_CAIRO, 7103: TEAM_CAIRO, 7104: TEAM_TENDERS, 7105: TEAM_TENDERS };

/** The quotations a tender's lots are priced by: their totals, as Sales keeps them. */
const QUOTATIONS: Record<number, { name: string; amount_total: number }> = {
  7501: { name: 'S00731', amount_total: 18450000 },
  7502: { name: 'S00732', amount_total: 6900000 },
  7503: { name: 'S00733', amount_total: 2650000 },
};

const NILE_CREST_ADDRESS = {
  street: 'Plot 112, South 90th Street',
  street2: 'Fifth Settlement',
  l10n_eg_building_no: '112',
  city: 'New Cairo',
  state_id: CAIRO,
  zip: '11835',
  country_id: EGYPT,
  country_code: 'EG',
};

/** What every contact carries that the page reads, so any of them opens on the Contact page. */
const PARTNER_DEFAULTS: Values = {
  active: true,
  type: 'contact',
  active_lang_count: 2,
  lang: 'en_US',
  user_ids: [],
  category_id: [],
  child_ids: [],
  bank_ids: [],
  currency_id: EGP,
  show_credit_limit: true,
  duplicated_bank_account_partners_count: 0,
  sale_warn: 'no-message',
  invoice_warn: 'no-message',
  purchase_warn: 'no-message',
  opportunity_count: 0,
  meeting_count: 0,
  sale_order_count: 0,
  total_invoiced: 0,
  supplier_invoice_count: 0,
  purchase_order_count: 0,
};
const company = (name: string, extra: Values = {}): Values => ({ ...PARTNER_DEFAULTS, name, is_company: true, company_type: 'company', ...extra });
const person = (name: string, extra: Values = {}): Values => ({ ...PARTNER_DEFAULTS, name, is_company: false, company_type: 'person', ...extra });

const partners: Record<string, Values> = {
  // A developer buying from us and selling to us: every tab of the Contact page has something in it.
  7001: company('Nile Crest Developments', {
    ...NILE_CREST_ADDRESS,
    vat: '512-406-981',
    phone: '+20 2 2537 4100',
    mobile: '+20 100 537 4100',
    email: 'info@nilecrest.example',
    website: 'https://nilecrest.example',
    category_id: [link(7621, 'Real estate'), link(7622, 'Key account')],
    child_ids: [
      { key: 'c7002', id: 7002, values: { type: 'contact', name: 'Hany Saber', title: link(7631, 'Mister'), function: 'Chief Financial Officer', email: 'hany.saber@nilecrest.example', phone: '+20 2 2537 4111', mobile: '+20 100 555 2210' } },
      { key: 'c7010', id: 7010, values: { type: 'contact', name: 'Rania Fawzy', title: link(7632, 'Madam'), function: 'Procurement Manager', email: 'rania.fawzy@nilecrest.example', phone: '+20 2 2537 4120', mobile: '+20 111 230 8841' } },
      { key: 'c7011', id: 7011, values: { type: 'invoice', name: 'Accounts department', email: 'ap@nilecrest.example', street: 'Plot 112, South 90th Street', street2: 'Third floor', city: 'New Cairo', state_id: CAIRO, zip: '11835', country_id: EGYPT } },
      { key: 'c7012', id: 7012, values: { type: 'delivery', name: 'New Capital site office', phone: '+20 100 537 4190', street: 'R7 District, Plot 47', city: 'New Administrative Capital', state_id: CAIRO, country_id: EGYPT, comment: 'Gate 3. Deliveries 08:00 to 15:00, Sunday to Thursday.' } },
    ],
    user_id: SALMA,
    property_payment_term_id: link(7653, '30 Days'),
    property_product_pricelist: link(7662, 'Developers (EGP)'),
    buyer_id: KARIM,
    property_supplier_payment_term_id: link(7654, '45 Days'),
    receipt_reminder_email: true,
    reminder_date_before_receipt: 2,
    property_account_position_id: link(7671, 'Egypt — Local'),
    company_registry: 'CR 118204 Cairo',
    ref: 'NCD-001',
    industry_id: link(7641, 'Real Estate'),
    l10n_eg_tax_card_no: '512-406-981',
    l10n_eg_tax_file_no: '1-07-512-00401-5',
    l10n_eg_tax_record_no: '118204',
    bank_ids: [
      { key: 'b1', id: 7681, values: { sequence: 10, acc_number: 'EG38 0010 0001 0000 0001 2345 6789 0', bank_id: link(7691, 'Commercial International Bank (CIB)'), allow_out_payment: true } },
      { key: 'b2', id: 7682, values: { sequence: 20, acc_number: 'EG16 0003 0007 0000 0004 4211 8830 1', bank_id: link(7692, 'National Bank of Egypt'), allow_out_payment: false } },
    ],
    property_account_receivable_id: link(7701, '121000 Account Receivable'),
    property_account_payable_id: link(7702, '211000 Account Payable'),
    credit: 1840000,
    days_sales_outstanding: 38,
    use_partner_credit_limit: true,
    credit_limit: 5000000,
    comment: '<p>Buys finishing packages for their New Cairo and New Capital compounds. Prefers quotations in EGP with a 30% advance.</p>',
    sale_warn: 'warning',
    sale_warn_msg: 'Check the open balance with Hany Saber before confirming a quotation above 2,000,000 EGP.',
    opportunity_count: 3,
    meeting_count: 2,
    sale_order_count: 5,
    total_invoiced: 4250000,
    supplier_invoice_count: 1,
    purchase_order_count: 1,
  }),
  // A person at the company: the address comes from it, and Invoicing is the company's.
  7002: person('Hany Saber', {
    ...NILE_CREST_ADDRESS,
    parent_id: link(7001, 'Nile Crest Developments'),
    function: 'Chief Financial Officer',
    phone: '+20 2 2537 4111',
    mobile: '+20 100 555 2210',
    email: 'hany.saber@nilecrest.example',
    title: link(7631, 'Mister'),
    user_id: SALMA,
    property_payment_term_id: link(7653, '30 Days'),
    opportunity_count: 1,
    meeting_count: 1,
  }),
  // A person whose company is only a name yet: Create company makes it.
  7003: person('Dina El-Sherif', {
    company_name: 'Lotus Interiors',
    function: 'Founder',
    street: '14 Mohandessin Street',
    city: 'Giza',
    state_id: GIZA,
    zip: '12411',
    country_id: EGYPT,
    country_code: 'EG',
    phone: '+20 2 3761 0042',
    mobile: '+20 122 300 1144',
    email: 'dina@lotusinteriors.example',
    title: link(7632, 'Madam'),
  }),
  // The government client of the tender, and its committee's head.
  7004: company('New Capital Housing Authority', {
    street: 'Government District, Building G12',
    city: 'New Administrative Capital',
    state_id: CAIRO,
    country_id: EGYPT,
    country_code: 'EG',
    phone: '+20 2 2812 0000',
    email: 'procurement@nchousing.example',
    category_id: [link(7623, 'Government')],
    industry_id: link(7643, 'Public Administration'),
    child_ids: [{ key: 'c7005', id: 7005, values: { type: 'contact', name: 'Omar Fathy', title: link(7634, 'Engineer'), function: 'Head of the Procurement Committee', email: 'o.fathy@nchousing.example', phone: '+20 2 2812 0140' } }],
  }),
  7005: person('Omar Fathy', { parent_id: link(7004, 'New Capital Housing Authority'), function: 'Head of the Procurement Committee', title: link(7634, 'Engineer'), email: 'o.fathy@nchousing.example', phone: '+20 2 2812 0140', city: 'New Administrative Capital', state_id: CAIRO, country_id: EGYPT, country_code: 'EG' }),
  7006: company('Pyramids Contracting', { city: 'Giza', state_id: GIZA, country_id: EGYPT, country_code: 'EG', category_id: [link(7625, 'Contractor')] }),
  7007: company('Delta Build & Co.', { city: 'Mansoura', country_id: EGYPT, country_code: 'EG', category_id: [link(7625, 'Contractor')] }),
  7008: company('Sinai Engineering Group', { city: 'Cairo', state_id: CAIRO, country_id: EGYPT, country_code: 'EG', category_id: [link(7625, 'Contractor')] }),
  // The opportunity's customer: a person buying a penthouse.
  7009: person('Mostafa Kamel', {
    street: '27 Road 9',
    street2: 'Maadi',
    city: 'Cairo',
    state_id: CAIRO,
    zip: '11728',
    country_id: EGYPT,
    country_code: 'EG',
    phone: '+20 2 2358 9031',
    mobile: '+20 122 410 7788',
    email: 'mostafa.kamel@example.com',
    title: link(7631, 'Mister'),
    function: 'Consultant cardiologist',
    user_id: SALMA,
    opportunity_count: 1,
    meeting_count: 1,
  }),
  7010: person('Rania Fawzy', { ...NILE_CREST_ADDRESS, parent_id: link(7001, 'Nile Crest Developments'), function: 'Procurement Manager', email: 'rania.fawzy@nilecrest.example', title: link(7632, 'Madam') }),
};

const lead: Record<string, Values> = {
  // An opportunity in Cairo real estate, at Proposition.
  7701: {
    name: 'Penthouse, The Crest Residence, New Cairo',
    type: 'opportunity',
    active: true,
    stage_id: stage(7303),
    priority: 2,
    company_currency: EGP,
    expected_revenue: 14500000,
    probability: 70,
    automated_probability: 70,
    partner_id: link(7009, 'Mostafa Kamel'),
    partner_name: null,
    contact_name: 'Mostafa Kamel',
    title: link(7631, 'Mister'),
    function: 'Consultant cardiologist',
    email_from: 'mostafa.kamel@example.com',
    phone: '+20 2 2358 9031',
    mobile: '+20 122 410 7788',
    website: null,
    lang_active_count: 2,
    lang_id: link(7611, 'English (US)'),
    street: '27 Road 9',
    street2: 'Maadi',
    city: 'Cairo',
    state_id: CAIRO,
    zip: '11728',
    country_id: EGYPT,
    is_blacklisted: false,
    phone_blacklisted: false,
    mobile_blacklisted: false,
    partner_email_update: false,
    partner_phone_update: false,
    user_id: SALMA,
    team_id: TEAM_CAIRO,
    date_deadline: day(40),
    tag_ids: [link(7721, 'Residential'), link(7725, 'Installments')],
    lead_properties: { unit_type: 'penthouse', bedrooms: 3, financing_approved: false, viewing_date: day(3) },
    description:
      '<p>Wants the 3-bedroom penthouse on the 9th floor, building B, with the roof terrace. <strong>10% down, the rest over 8 years.</strong></p><ul><li>Asked for the delivery date in writing</li><li>Two parking spaces</li></ul>',
    campaign_id: link(7731, 'Autumn launch 2026'),
    medium_id: link(7741, 'Website'),
    source_id: link(7752, 'Property portal'),
    referred: null,
    date_open: '2026-09-14T10:20',
    date_closed: null,
    day_open: 0.4,
    day_close: 0,
    meeting_display_label: 'Next Meeting',
    meeting_display_date: day(3),
    duplicate_lead_count: 1,
    quotation_count: 1,
    sale_order_count: 0,
    sale_amount_total: 0,
  },
  // A lead, not yet an opportunity: Convert to Opportunity and the lead's own groups.
  7702: {
    name: 'Office floor, Smart Village — Orbit Software',
    type: 'lead',
    active: true,
    stage_id: stage(7301),
    priority: 1,
    company_currency: EGP,
    expected_revenue: 0,
    probability: 12.5,
    automated_probability: 12.5,
    partner_id: null,
    partner_name: 'Orbit Software',
    contact_name: 'Yasmin Ashraf',
    title: link(7632, 'Madam'),
    function: 'Head of Operations',
    email_from: 'yasmin.ashraf@orbitsoftware.example',
    phone: '+20 2 3539 7710',
    mobile: '+20 100 772 0931',
    website: 'https://orbitsoftware.example',
    lang_active_count: 2,
    lang_id: link(7611, 'English (US)'),
    street: 'Building B47, Smart Village',
    street2: 'Cairo–Alexandria Desert Road',
    city: 'Giza',
    state_id: GIZA,
    zip: '12577',
    country_id: EGYPT,
    is_blacklisted: false,
    phone_blacklisted: false,
    mobile_blacklisted: false,
    partner_email_update: false,
    partner_phone_update: false,
    user_id: KARIM,
    team_id: TEAM_CAIRO,
    tag_ids: [link(7722, 'Commercial')],
    lead_properties: { unit_type: 'office', financing_approved: true },
    description: '<p>Needs 1,200 m² for 140 people by March. Asked whether the floor can be split in two.</p>',
    campaign_id: null,
    medium_id: link(7742, 'Phone'),
    source_id: link(7753, 'Walk-in'),
    referred: 'Hany Saber, Nile Crest',
    date_open: '2026-10-01T09:05',
    date_closed: null,
    day_open: 0.1,
    day_close: 0,
    meeting_display_label: 'No Meeting',
    duplicate_lead_count: 0,
    quotation_count: 0,
    sale_order_count: 0,
    sale_amount_total: 0,
  },
  // The similar lead the opportunity's stat button counts.
  7703: { name: 'Penthouse inquiry — Mostafa Kamel', type: 'lead', active: true, stage_id: stage(7301), probability: 10, automated_probability: 10, email_from: 'mostafa.kamel@example.com', contact_name: 'Mostafa Kamel', user_id: SALMA, team_id: TEAM_CAIRO, lang_active_count: 2 },
};

/** The tender: due in two weeks, at Internal Review, so Submit Bid is the next step. */
const TENDER_DEADLINE = at(14, '11:00');
const tenders: Record<string, Values> = {
  7801: {
    name: 'Solar water heaters for 1,200 housing units, R5 district',
    tender_number: 'TND/2026/0014',
    state: 'review',
    client_id: link(7004, 'New Capital Housing Authority'),
    client_contact_id: link(7005, 'Omar Fathy'),
    tender_type: 'open',
    sales_team_id: TEAM_TENDERS,
    announcement_date: day(-21),
    clarification_deadline: at(2, '14:00'),
    submission_deadline: TENDER_DEADLINE,
    opening_date: at(15, '12:00'),
    award_date: day(40),
    days_until_submission: daysUntil(TENDER_DEADLINE),
    currency_id: EGP,
    lot_ids: [
      { key: 'l1', id: 7811, values: { sequence: 10, lot_number: 'Lot 1', name: 'Solar water heaters, 300 L, supply', participating: true, estimated_value: 21600000, quotation_id: link(7501, 'S00731'), delivery_deadline: day(145) } },
      { key: 'l2', id: 7812, values: { sequence: 20, lot_number: 'Lot 2', name: 'Installation and commissioning', participating: true, estimated_value: 7200000, quotation_id: link(7502, 'S00732'), delivery_deadline: day(175) } },
      { key: 'l3', id: 7813, values: { sequence: 30, lot_number: 'Lot 3', name: 'Five-year maintenance contract', participating: false, estimated_value: 3000000, quotation_id: null, delivery_deadline: null } },
    ],
    requirement_ids: [
      { key: 'r1', id: 7821, values: { sequence: 10, name: 'Commercial register, less than 3 months old', requirement_type: 'legal', mandatory: true, compliant: true, responsible_id: LAILA, evidence_count: 1 } },
      { key: 'r2', id: 7822, values: { sequence: 20, name: 'Tax card and VAT certificate', requirement_type: 'legal', mandatory: true, compliant: true, responsible_id: LAILA, evidence_count: 2 } },
      { key: 'r3', id: 7823, values: { sequence: 30, name: 'Bid bond, 1% of the bid, from an Egyptian bank', requirement_type: 'financial', mandatory: true, compliant: true, responsible_id: YOUSSEF, evidence_count: 1 } },
      { key: 'r4', id: 7824, values: { sequence: 40, name: 'ISO 9001 certificate', requirement_type: 'certification', mandatory: true, compliant: true, responsible_id: MONA, evidence_count: 1 } },
      { key: 'r5', id: 7825, values: { sequence: 50, name: 'Three similar projects in the last five years', requirement_type: 'experience', mandatory: true, compliant: false, responsible_id: KARIM, evidence_count: 0 } },
      { key: 'r6', id: 7826, values: { sequence: 60, name: 'Datasheets to the Egyptian standard for solar heaters', requirement_type: 'technical', mandatory: true, compliant: true, responsible_id: KARIM, evidence_count: 3 } },
      { key: 'r7', id: 7827, values: { sequence: 70, name: 'Local content statement', requirement_type: 'other', mandatory: false, compliant: false, responsible_id: MONA, evidence_count: 0 } },
    ],
    compliance_percentage: 71.43,
    lead_id: YOUSSEF,
    team_member_ids: [KARIM, MONA, LAILA],
    estimated_value: 31800000,
    our_bid_amount: 25350000,
    profit_margin: 14.5,
    bid_bond_required: true,
    bid_bond_amount: 318000,
    bid_bond_document_id: link(7601, 'Bid bond — CIB guarantee letter.pdf'),
    competitors_count: 4,
    win_probability: 45,
    competitor_ids: [link(7006, 'Pyramids Contracting'), link(7007, 'Delta Build & Co.'), link(7008, 'Sinai Engineering Group')],
    loss_reason: null,
    winning_amount: null,
    winning_competitor_id: null,
    loss_notes: null,
    document_ids: [
      { name: 'Tender booklet, R5 solar heaters.txt', type: 'text/plain', size: 118, data: btoa('Tender TND/2026/0014\nSupply, installation and maintenance of 1,200 solar water heaters, 300 L.\nBids sealed, two envelopes.\n') },
      { name: 'Clarifications, round 1.txt', type: 'text/plain', size: 96, data: btoa('Q1: Is a 250 L heater accepted? A: No, 300 L only.\nQ2: Warranty? A: Five years on the tank.\n') },
    ],
  },
};

// ── What the server works out ─────────────────────────────────────────────

/** The fields a contact copies from its company, as Flectra's onchange_parent_id does for a contact. */
const ADDRESS_FIELDS = ['street', 'street2', 'zip', 'city', 'state_id', 'country_id'] as const;
const COUNTRY_CODES: Record<number, string> = { 7401: 'EG', 7402: 'SA', 7403: 'AE' };
const STATE_COUNTRY: Record<number, RelatedRecord> = { 7411: EGYPT, 7412: EGYPT, 7413: EGYPT, 7414: EGYPT, 7415: link(7402, 'Saudi Arabia'), 7416: link(7403, 'United Arab Emirates') };

function partnerOf(value: unknown): Values | undefined {
  const id = idOf(value);
  return id === null ? undefined : partners[String(id)];
}

const onchange: NonNullable<RealLane['onchange']> = {
  'res.partner': {
    company_type: (values) => ({ is_company: values['company_type'] === 'company' }),
    parent_id: (values) => {
      const parent = partnerOf(values['parent_id']);
      if (!parent || values['type'] !== 'contact' || !ADDRESS_FIELDS.some((f) => parent[f])) return {};
      return { ...Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, parent[f] ?? null])), country_code: parent['country_code'] ?? null, lang: parent['lang'] ?? values['lang'] };
    },
    country_id: (values) => {
      const country = idOf(values['country_id']);
      const state = idOf(values['state_id']);
      const keepState = state !== null && country !== null && STATE_COUNTRY[state]?.id === country;
      return { country_code: country === null ? null : COUNTRY_CODES[country] ?? null, ...(keepState ? {} : { state_id: null }) };
    },
    state_id: (values): Values => {
      const state = idOf(values['state_id']);
      const country = state === null ? undefined : STATE_COUNTRY[state];
      return country && idOf(values['country_id']) !== country.id ? { country_id: country, country_code: COUNTRY_CODES[Number(country.id)] } : {};
    },
  },
  'crm.lead': {
    // Flectra works the probability out from the stage (its predictive scoring); a won stage is 100.
    stage_id: (values): Values => {
      const id = idOf(values['stage_id']);
      const next = id === null ? undefined : STAGES[id];
      if (!next) return {};
      return { probability: next.probability, automated_probability: next.probability, date_closed: next.is_won ? new Date().toISOString().slice(0, 16) : null };
    },
    // A customer picked brings their contact details and address, as the lead's computed fields do.
    partner_id: (values) => {
      const partner = partnerOf(values['partner_id']);
      if (!partner) return {};
      return {
        partner_name: partner['is_company'] ? partner['name'] : (partnerOf(partner['parent_id'])?.['name'] ?? values['partner_name']),
        contact_name: partner['is_company'] ? values['contact_name'] : partner['name'],
        email_from: partner['email'] ?? values['email_from'],
        phone: partner['phone'] ?? values['phone'],
        mobile: partner['mobile'] ?? values['mobile'],
        function: partner['function'] ?? values['function'],
        title: partner['title'] ?? values['title'],
        website: partner['website'] ?? values['website'],
        ...Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, partner[f] ?? null])),
        partner_email_update: false,
        partner_phone_update: false,
      };
    },
    email_from: (values) => ({ partner_email_update: Boolean(partnerOf(values['partner_id'])) && (partnerOf(values['partner_id'])?.['email'] ?? null) !== (values['email_from'] || null) }),
    phone: (values) => ({ partner_phone_update: Boolean(partnerOf(values['partner_id'])) && (partnerOf(values['partner_id'])?.['phone'] ?? null) !== (values['phone'] || null) }),
    user_id: (values): Values => {
      const team = TEAM_OF[idOf(values['user_id']) ?? -1];
      return team ? { team_id: team } : {};
    },
  },
  'tender.opportunity': {
    submission_deadline: (values) => ({ days_until_submission: daysUntil(values['submission_deadline']) }),
    requirement_ids: (values) => {
      const rows = linesOf(values['requirement_ids']);
      const compliant = rows.filter((row) => row.values['compliant']).length;
      return { compliance_percentage: rows.length ? Math.round((compliant / rows.length) * 10000) / 100 : 0 };
    },
    lot_ids: (values) => ({
      our_bid_amount: linesOf(values['lot_ids'])
        .filter((row) => row.values['participating'])
        .reduce((total, row) => total + (QUOTATIONS[idOf(row.values['quotation_id']) ?? -1]?.amount_total ?? 0), 0),
    }),
    client_id: (values): Values => (idOf(partnerOf(values['client_contact_id'])?.['parent_id']) === idOf(values['client_id']) ? {} : { client_contact_id: null }),
  },
};

// ── The app's answers to the pages' calls ─────────────────────────────────

const name = (value: unknown) => (value && typeof value === 'object' && 'label' in value ? String((value as RelatedRecord).label) : '');
const answer = (result: ActionResult) => new Promise<ActionResult>((resolve) => setTimeout(() => resolve(result), 200));
const info = (message: string): ActionResult => ({ say: { message, tone: 'info' } });

function action(request: ActionRequest): Promise<ActionResult> | undefined {
  const v = request.values;
  switch (request.action) {
    // Contact
    case 'partner_view_opportunities':
      return answer(info(`${v['name']}: ${v['opportunity_count']} opportunities open in the CRM pipeline.`));
    case 'partner_schedule_meeting':
      return answer(info(`The calendar opens on ${v['name']}'s ${v['meeting_count']} meetings.`));
    case 'partner_view_sale_orders':
      return answer(info(`${v['sale_order_count']} sales orders of ${v['name']}.`));
    case 'partner_view_invoices':
      return answer(info(`The invoices of ${v['name']}.`));
    case 'partner_view_vendor_bills':
      return answer(info(`${v['supplier_invoice_count']} vendor bills of ${v['name']}.`));
    case 'partner_view_purchases':
      return answer(info(`${v['purchase_order_count']} purchase orders to ${v['name']}.`));
    case 'partner_create_company':
      // Flectra makes the company at once; here it opens, filled in, to be saved — then this contact is linked to it.
      return answer({
        open: {
          page: 'real-contact',
          as: 'dialog',
          title: 'Create company',
          values: { name: 'company_name', company_type: "'company'", is_company: 'True', vat: 'vat', street: 'street', street2: 'street2', city: 'city', state_id: 'state_id', zip: 'zip', country_id: 'country_id', country_code: 'country_code', active_lang_count: '2' },
          into: { parent_id: 'id' },
          then: [{ do: 'clear', field: 'company_name' }, { do: 'save' }],
        },
      });
    case 'open_commercial_entity':
      return answer({ open: { page: 'real-contact', as: 'page', record: 'parent_id' } });
    case 'mail_action_blacklist_remove':
      return answer({ values: { is_blacklisted: false }, say: { message: 'Taken off the blacklist for mass mailings.', tone: 'success' } });
    case 'phone_action_blacklist_remove':
      return answer({ values: { phone_blacklisted: false, mobile_blacklisted: false }, say: { message: 'Taken off the blacklist for SMS marketing.', tone: 'success' } });

    // Opportunity
    case 'crm_lead_set_won': {
      const won = Number(Object.keys(STAGES).find((id) => STAGES[Number(id)].is_won));
      return answer({
        values: { stage_id: stage(won), probability: 100, automated_probability: 100, active: true, date_closed: new Date().toISOString().slice(0, 16) },
        say: { message: `Boom! ${name(v['partner_id']) || 'The customer'} signed: ${v['name']} is won.`, tone: 'success' },
      });
    }
    case 'crm_lead_restore': {
      const back = STAGES[idOf(v['stage_id']) ?? -1]?.probability ?? 10;
      return answer({ values: { probability: back, automated_probability: back, date_closed: null } });
    }
    case 'crm_lead_convert':
      return answer({ values: { ...(v['stage_id'] ? {} : { stage_id: stage(7301) }), probability: v['probability'] || STAGES[7301].probability } });
    case 'crm_lead_new_quotation':
      return answer(info(`A new quotation for ${name(v['partner_id']) || v['partner_name'] || 'the customer'} opens in Sales, linked to this opportunity.`));
    case 'crm_lead_schedule_meeting':
      return answer(info(`The calendar opens with ${name(v['partner_id']) || 'the customer'} invited.`));
    case 'crm_lead_show_duplicates':
      return answer(info(`${v['duplicate_lead_count']} similar lead: same email or phone.`));
    case 'crm_lead_view_quotations':
      return answer(info(`${v['quotation_count']} quotation for this opportunity.`));
    case 'crm_lead_view_orders':
      return answer(info(`${v['sale_order_count']} confirmed sales orders.`));

    // Tender
    case 'tender_submit':
      return answer({ say: { message: `Bid submitted. A follow-up call is planned for ${name(v['lead_id']) || 'the bid leader'} on the opening date.`, tone: 'success' } });
    case 'tender_mark_won':
      return answer({ say: { message: `Great news! We won the tender: ${v['name']}. A to-do to prepare the contract is set for next week.`, tone: 'success' } });
    case 'tender_mark_lost':
      return answer({ say: { message: 'The loss analysis is posted in the chatter, and the bid team told.', tone: 'info' } });
    default:
      return undefined;
  }
}

export const lane: RealLane = {
  pages: {
    'real-contact': contact as Page,
    'real-opportunity': opportunity as Page,
    'real-tender': tender as Page,
  },
  opened: {
    'real-contact': contact as Page,
    'real-crm-lead-lost': leadLost as Page,
    'real-crm-lead2opportunity': leadToOpportunity as Page,
    'real-tender-loss': tenderLoss as Page,
  },
  related: {
    'res.partner': contact as Page,
    'crm.lead': opportunity as Page,
    'tender.opportunity': tender as Page,
  },
  records: {
    'res.partner': partners,
    'crm.lead': lead,
    'tender.opportunity': tenders,
    'crm.stage': Object.fromEntries(Object.entries(STAGES).map(([id, s]) => [id, { name: s.name, sequence: s.sequence, is_won: s.is_won ?? false, team_id: null }])),
    'crm.team': { 7201: { name: 'Real Estate — Cairo' }, 7202: { name: 'Government & Tenders' }, 7203: { name: 'Direct Sales' } },
    'crm.tag': { 7721: { name: 'Residential' }, 7722: { name: 'Commercial' }, 7723: { name: 'Off-plan' }, 7724: { name: 'VIP' }, 7725: { name: 'Installments' } },
    'crm.lost.reason': { 7761: { name: 'Too expensive' }, 7762: { name: "We don't have people/skills" }, 7763: { name: 'Not enough stock' }, 7764: { name: 'Chose another developer' }, 7765: { name: 'Financing not approved' } },
    'utm.campaign': { 7731: { name: 'Autumn launch 2026' }, 7732: { name: 'Sahel summer 2026' } },
    'utm.medium': { 7741: { name: 'Website' }, 7742: { name: 'Phone' }, 7743: { name: 'Referral' }, 7744: { name: 'Email' } },
    'utm.source': { 7751: { name: 'Facebook' }, 7752: { name: 'Property portal' }, 7753: { name: 'Walk-in' }, 7754: { name: 'Newsletter' } },
    'res.users': { 7101: { name: 'Salma Nabil' }, 7102: { name: 'Karim Fathy' }, 7103: { name: 'Mona Adel' }, 7104: { name: 'Youssef Kamal' }, 7105: { name: 'Laila Mostafa' } },
    'res.lang': { 7611: { name: 'English (US)' }, 7612: { name: 'Arabic / العربية' } },
    'res.country': { 7401: { name: 'Egypt', code: 'EG' }, 7402: { name: 'Saudi Arabia', code: 'SA' }, 7403: { name: 'United Arab Emirates', code: 'AE' } },
    'res.country.state': {
      7411: { name: 'Cairo', country_id: EGYPT },
      7412: { name: 'Giza', country_id: EGYPT },
      7413: { name: 'Alexandria', country_id: EGYPT },
      7414: { name: 'Red Sea', country_id: EGYPT },
      7415: { name: 'Riyadh', country_id: link(7402, 'Saudi Arabia') },
      7416: { name: 'Dubai', country_id: link(7403, 'United Arab Emirates') },
    },
    'res.currency': { 7451: { name: 'EGP' }, 7452: { name: 'USD' } },
    'res.partner.title': { 7631: { name: 'Mister' }, 7632: { name: 'Madam' }, 7633: { name: 'Doctor' }, 7634: { name: 'Engineer' }, 7635: { name: 'Professor' } },
    'res.partner.category': { 7621: { name: 'Real estate' }, 7622: { name: 'Key account' }, 7623: { name: 'Government' }, 7624: { name: 'Supplier' }, 7625: { name: 'Contractor' } },
    'res.partner.industry': { 7641: { name: 'Real Estate' }, 7642: { name: 'Construction' }, 7643: { name: 'Public Administration' } },
    'account.payment.term': { 7651: { name: 'Immediate Payment' }, 7652: { name: '15 Days' }, 7653: { name: '30 Days' }, 7654: { name: '45 Days' }, 7655: { name: '30% Now, Balance 60 Days' } },
    'product.pricelist': { 7661: { name: 'Public Pricelist (EGP)' }, 7662: { name: 'Developers (EGP)' } },
    'account.fiscal.position': { 7671: { name: 'Egypt — Local' }, 7672: { name: 'Egypt — Export' } },
    'account.account': { 7701: { name: '121000 Account Receivable', account_type: 'asset_receivable' }, 7702: { name: '211000 Account Payable', account_type: 'liability_payable' } },
    'res.bank': { 7691: { name: 'Commercial International Bank (CIB)' }, 7692: { name: 'National Bank of Egypt' }, 7693: { name: 'Banque Misr' }, 7694: { name: 'QNB Alahli' } },
    'sale.order': Object.fromEntries(Object.entries(QUOTATIONS).map(([id, q]) => [id, { ...q, partner_id: link(7004, 'New Capital Housing Authority') }])),
    'ir.attachment': { 7601: { name: 'Bid bond — CIB guarantee letter.pdf' } },
  },
  onchange,
  action,
};
