import type { Replays } from './hand';
import { replay as customer } from './crm/customer';
import { replay as customers } from './crm/customers';
import { replay as contacts } from './crm/contacts';
import { replay as leadsQueue } from './crm/leads-queue';
import { replay as dealStages } from './crm/deal-stages';
import { replay as customerAccount } from './crm/customer-account';
import { replay as customerCard } from './crm/customer-card';
import { replay as customerFromEmail } from './crm/customer-from-email';
import { replay as loading } from './crm/loading';
import { replay as templateContactUs } from './crm/template-contact-us';
import { replay as templateSupportRequest } from './crm/template-support-request';
import { replay as templateCustomer } from './crm/template-customer';
import { replay as realContact } from './crm/real-contact';
import { replay as realOpportunity } from './crm/real-opportunity';
import { replay as realTender } from './crm/real-tender';

/** The CRM demos’ how-to steps, replayed by hand (e2e/how-to.spec.ts): each demo’s in e2e/how-to/crm/<demo id>.ts, in the catalogue’s order. */
export const crm: Replays = {
  customer,
  customers,
  contacts,
  'leads-queue': leadsQueue,
  'deal-stages': dealStages,
  'customer-account': customerAccount,
  'customer-card': customerCard,
  'customer-from-email': customerFromEmail,
  loading,
  'template-contact-us': templateContactUs,
  'template-support-request': templateSupportRequest,
  'template-customer': templateCustomer,
  'real-contact': realContact,
  'real-opportunity': realOpportunity,
  'real-tender': realTender,
};
