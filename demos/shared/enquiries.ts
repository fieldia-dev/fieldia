import { assistStandIn, type MemoryAssist, type Option, type RewriteRequest, type Values } from '@fieldia/core';

/**
 * AI help in the demos (enquiry-reply, customer-from-email, homes-search): the memory source answers it with Fieldia's
 * stand-in — no model, no keys, nothing sent anywhere: words read by their patterns, the same every time — and a reply
 * to a buyer's enquiry drafted from a template of the agency's. An app answers with its own model instead; the demos'
 * pages say so, and so does each answer's why ("Stand-in AI, no model: …").
 */

/** A choice's words for its value, as the page names its options. */
const named = (request: RewriteRequest, field: string, value: unknown) => ((request.page.fields[field] as { options?: Option[] } | undefined)?.options ?? []).find((option) => option.value === value)?.label;

/** The agency's reply to a buyer, from what the enquiry holds: the stand-in's draft of its `reply`. */
export function enquiryDraft(values: Values, request: RewriteRequest): string {
  const first = String(values['partner_name'] ?? '').trim().split(/\s+/)[0];
  const kind = named(request, 'kind', values['kind'])?.toLowerCase() ?? 'home';
  const district = named(request, 'district', values['district']);
  const bedrooms = typeof values['bedrooms'] === 'number' && values['bedrooms'] > 0 ? `${values['bedrooms']} bedrooms` : '';
  const budget = typeof values['budget'] === 'number' ? `up to EGP ${values['budget'].toLocaleString('en')}` : '';
  const wants = [`a ${kind}`, district ? `in ${district}` : '', bedrooms ? `with ${bedrooms}` : ''].filter(Boolean).join(' ') + (budget ? `, ${budget}` : '');
  return [
    `Dear ${first || 'there'},`,
    '',
    `Thank you for your enquiry about ${wants}.`,
    '',
    'We have homes that match, and I would be glad to show them to you this week. Would Thursday or Saturday afternoon suit you?',
    '',
    'Kind regards,',
    'Mona Adel',
    'Riverside Realty',
  ].join('\n');
}

/** What the demos' memory source answers AI help with. */
export const demoAssist: MemoryAssist = assistStandIn({ drafts: { 'enquiry.reply': enquiryDraft } });

/** Two buyers' enquiries: Hana's as it came in, nothing read from it yet; Omar's read, a rough reply typed. */
export function sampleEnquiries(): Record<string, Values> {
  return {
    1: {
      name: 'A villa in New Cairo',
      partner_name: 'Hana Fouad',
      phone: '+201002345678',
      email: 'hana.fouad@example.com',
      received: '2026-10-19T09:12:00.000Z',
      message: 'hi, im looking for a villa in new cairo with 4 bedrooms, budget around 15M. could u send me a few options and when i can see them? thx, Hana',
      kind: null,
      district: null,
      budget: null,
      bedrooms: null,
      reply: '',
      state: 'new',
    },
    2: {
      name: 'A flat in Zamalek',
      partner_name: 'Omar Nabil',
      phone: '+201117654321',
      email: 'omar.nabil@example.com',
      received: '2026-10-18T16:40:00.000Z',
      message: 'Good morning. We are moving to Cairo in January and look for a flat in Zamalek, 3 bedrooms, up to EGP 9,000,000. A Nile view would be lovely. Best, Omar',
      kind: 'flat',
      district: 'zamalek',
      budget: 9_000_000,
      bedrooms: 3,
      reply: 'hi omar\n\nthx for ur msg. we have 2 flats in zamalek that fit ur budget , one with a nile view. can u come on thursday at 5pm? pls let me know asap\n\nregards\nmona',
      state: 'new',
    },
  };
}

/** A signature to paste, as the gallery's Try this gives it on one line. */
export const SAMPLE_SIGNATURE = 'Lina Haddad · Head of Procurement, Amman Fresh Markets · T: +962 6 461 2200 · M: +962 79 555 0142 · lina.haddad@ammanfresh.example · www.ammanfresh.example · 21 Mecca St, Shmeisani, Amman, Jordan · VAT: 4001-2210';
