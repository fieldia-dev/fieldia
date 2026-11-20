import { alikeRecords, createMemoryDataSource, FORMAT_VERSION, gridClusters, scheduleSlots, type AppFunctions, type Facet, type FormUser, type JsonValue, type Line, type Page, type ResolvedFilter, type Values } from '@fieldia/core';
import type { PageRequest } from '@fieldia/viewer';
import { pageFile, pageFrom, pageOf, type PageSource } from './lazy-page';
import { LEASE, LEASE_AGENTS, LEASE_SHOWS } from './lease';
import { AREAS, AREA_SHOWS } from './areas';
import { demoFunctions } from './functions';
import { customPage } from './custom-page';
import { wiHeadPage, WI_HEAD_RECORDS } from './wi-header';
import { wiMorePage, wiMoreRecords } from './wi-more';
import { BILLS, billAttachments, billNavigation, vendorBill } from './vendor-bill';
import { real } from './real';
import { wiPicker } from './wi-picker';
import { businessData, businessPage } from './business';
import { codeData, codePage, codePageFor } from './code-page';
import { templatePages } from './templates';
import { wiTextRecords } from './wi-text';
import { AMENITIES, sampleCouriers, sampleHomes, sampleOrder, sampleRound } from './homes';
import { manyHomes, manyHomesPages } from './many-homes';
import { sampleLeads } from './leads';
import { sampleKitchen, sampleWeekOrders } from './districts';
import { wiHistoryPage, wiHistoryRecord } from './wi-history';
import { CONTAINED_RECORDS, containedPage } from './contained';
import { LISTING, LISTING_STORAGE, listingUpload } from './listing-photos';
import { calendarDemo, demoNow } from './calendar';
import { ganttDemo } from './gantt';
import { sampleInvoices } from './invoices';
import { listingHandover } from './listing-handover';
import { contactPage, contactPermissions, contactsAsAsked, OWNERS, sampleContacts } from './contacts';
import { showroom, testDriveDemo, testDriveRecords } from './test-drive';
import { appointmentRecords, appointmentSlots, keepAppointment } from './appointments';
import { emptyGridsPage, emptyGridsRecords } from './empty-grids';
import { AGENTS, filterFromQuery, relatedLists, sampleQuotations, sampleViewings, searchFromQuery } from './related-lists';
import { customerCardPage, duplicateCustomers } from './duplicates';
import { keptSource } from './kept';
import { consentPage, sampleConsents } from './consents';
import { photoSetPages, photoSetRecords } from './photo-sets';
import { siteVisits } from './site-visit';
import { eventTickets } from './event-ticket';
import { treatments } from './face-chart';
import { branchSlots, clinicBranchPage, COURSE_TEMPLATES, sampleBranches, sampleCourses, treatmentCoursePage } from './treatment-course';
import { CONTRACT_FEES_RECORDS } from './contract-fees';
import { agentLists, agentRecords } from './agent-tools';
import { EVENT_COUNTS, eventSignupPage } from './event-signup';
import { standInCheckout, unitEnquiryPage } from './unit-enquiry';
import { demoOffline, viewingReportPage } from './viewing-report';
import { ENQUIRY_RECORDS } from './enquiry';
import { demoAssist, sampleEnquiries } from './enquiries';
import { draftLink, keepDrafts, keptDrafts } from './clinic-intake';
import { APPROVAL_ROUTES, approvalHistory, approvalRecords, approvalUser, claimPermissions } from './approvals';
import { CLINIC_ROLES, sampleServices, sampleStaffWeeks, sampleStages, servicePerHour, stagePermissions, staffWeekRule, stageOrder } from './editable-lists';
import { bilingualListings, bilingualServices } from './languages';
import { scanRecords, stockCountPage, treatmentPage } from './scan';
import { TEAM_VIEWS } from './saved-views';
import { reviewOrders } from './orders-review';
import { waitingPatientPage, waitingPatients } from './waiting-room';
import { activityEntries, activityEntryPage } from './activity-log';
import { accountPage, chartAccounts } from './chart-of-accounts';

// The example pages kept as JSON: each a file of its own, fetched by the demo that opens it (shared/lazy-page.ts).
const address = pageFile(() => import('../../examples/pages/address.page.json'));
const listing = pageFile(() => import('../../examples/pages/listing.page.json'));
const lease = pageFile(() => import('../../examples/pages/lease.page.json'));
const visitFeedback = pageFile(() => import('../../examples/pages/visit-feedback.page.json'));
const trainingCheck = pageFile(() => import('../../examples/pages/training-check.page.json'));
const findAHome = pageFile(() => import('../../examples/pages/find-a-home.page.json'));
const delivery = pageFile(() => import('../../examples/pages/delivery.page.json'));
const mapDelivery = pageFile(() => import('../../examples/pages/map-delivery.page.json'));
const mapAddress = pageFile(() => import('../../examples/pages/map-address.page.json'));
const mapZone = pageFile(() => import('../../examples/pages/map-zone.page.json'));
const mapHomes = pageFile(() => import('../../examples/pages/map-homes.page.json'));
const homesGallery = pageFile(() => import('../../examples/pages/homes-gallery.page.json'));
const homesSearch = pageFile(() => import('../../examples/pages/homes-search.page.json'));
const leadsQueue = pageFile(() => import('../../examples/pages/leads-queue.page.json'));
const lead = pageFile(() => import('../../examples/pages/lead.page.json'));
const mapHome = pageFile(() => import('../../examples/pages/map-home.page.json'));
const mapCouriers = pageFile(() => import('../../examples/pages/map-couriers.page.json'));
const mapCourier = pageFile(() => import('../../examples/pages/map-courier.page.json'));
const mapOrder = pageFile(() => import('../../examples/pages/map-order.page.json'));
const mapRound = pageFile(() => import('../../examples/pages/map-round.page.json'));
const mapZones = pageFile(() => import('../../examples/pages/map-zones.page.json'));
const mapHeat = pageFile(() => import('../../examples/pages/map-heat.page.json'));
const mapKitchen = pageFile(() => import('../../examples/pages/map-kitchen.page.json'));
const mapWeekOrder = pageFile(() => import('../../examples/pages/map-week-order.page.json'));
const customer = pageFile(() => import('../../examples/pages/customer.page.json'));
const fields = pageFile(() => import('../../examples/pages/fields.page.json'));
const kinds = pageFile(() => import('../../examples/pages/kinds.page.json'));
const layout = pageFile(() => import('../../examples/pages/layout.page.json'));
const lists = pageFile(() => import('../../examples/pages/lists.page.json'));
const agentTools = pageFile(() => import('../../examples/pages/agent-tools.page.json'));
const customers = pageFile(() => import('../../examples/pages/customers.page.json'));
const invoices = pageFile(() => import('../../examples/pages/invoices.page.json'));
const contacts = pageFile(() => import('../../examples/pages/contacts.page.json'));
const customerAccount = pageFile(() => import('../../examples/pages/customer-account.page.json'));
const property = pageFile(() => import('../../examples/pages/property.page.json'));
const order = pageFile(() => import('../../examples/pages/order.page.json'));
const quickOrder = pageFile(() => import('../../examples/pages/quick-order.page.json'));
const newCustomer = pageFile(() => import('../../examples/pages/new-customer.page.json'));
const rules = pageFile(() => import('../../examples/pages/rules.page.json'));
const signup = pageFile(() => import('../../examples/pages/signup.page.json'));
const survey = pageFile(() => import('../../examples/pages/survey.page.json'));
const big = pageFile(() => import('../../examples/pages/big.page.json'));
const reading = pageFile(() => import('../../examples/pages/reading.page.json'));
const workItem = pageFile(() => import('../../examples/pages/work-item.page.json'));
const contractFees = pageFile(() => import('../../examples/pages/contract-fees.page.json'));
const wiText = pageFile(() => import('../../examples/pages/wi-text.page.json'));
const listingPhotos = pageFile(() => import('../../examples/pages/listing-photos.page.json'));
const siteVisit = pageFile(() => import('../../examples/pages/site-visit.page.json'));
const eventTicket = pageFile(() => import('../../examples/pages/event-ticket.page.json'));
const faceChart = pageFile(() => import('../../examples/pages/face-chart.page.json'));
const clinicIntake = pageFile(() => import('../../examples/pages/clinic-intake.page.json'));
const enquiry = pageFile(() => import('../../examples/pages/enquiry.page.json'));
const customerFromEmail = pageFile(() => import('../../examples/pages/customer-from-email.page.json'));
const enquiryReply = pageFile(() => import('../../examples/pages/enquiry-reply.page.json'));
const purchaseApproval = pageFile(() => import('../../examples/pages/purchase-approval.page.json'));
const expenseApproval = pageFile(() => import('../../examples/pages/expense-approval.page.json'));
const servicePrices = pageFile(() => import('../../examples/pages/service-prices.page.json'));
const staffHours = pageFile(() => import('../../examples/pages/staff-hours.page.json'));
const dealStages = pageFile(() => import('../../examples/pages/deal-stages.page.json'));
const listingLanguages = pageFile(() => import('../../examples/pages/listing-languages.page.json'));
const servicesLanguages = pageFile(() => import('../../examples/pages/services-languages.page.json'));
const serviceLanguages = pageFile(() => import('../../examples/pages/service-languages.page.json'));
const ordersReview = pageFile(() => import('../../examples/pages/orders-review.page.json'));
const waitingRoom = pageFile(() => import('../../examples/pages/waiting-room.page.json'));
const activityLog = pageFile(() => import('../../examples/pages/activity-log.page.json'));
const chartOfAccounts = pageFile(() => import('../../examples/pages/chart-of-accounts.page.json'));

/** The example pages every demo can show, by name: a page kept as JSON fetched as a demo opens it. */
export const pages: Record<string, PageSource> = {
  signup: signup,
  survey: survey,
  customer: customer,
  customers: customers,
  // Invoices that add up and filter by time: a total under the list and on each heading, periods, Group By month (shared/invoices.ts).
  invoices: invoices,
  // 1,284 contacts to select all of, export and change in bulk, and the page each opens: shared/contacts.ts.
  contacts: contacts,
  // Orders whose rows open in place to their lines, and the order each opens: shared/orders-review.ts.
  'orders-review': ordersReview,
  // A clinic's waiting room, its patients carried to another place by hand: shared/waiting-room.ts.
  'waiting-room': waitingRoom,
  'waiting-patient': waitingPatientPage,
  // A team's log of 1,284 entries, loaded as it is scrolled, and the entry each opens: shared/activity-log.ts.
  'activity-log': activityLog,
  'activity-entry': activityEntryPage,
  // A chart of 240 accounts, its groups' accounts loaded as each opens, and the account each opens: shared/chart-of-accounts.ts.
  'chart-of-accounts': chartOfAccounts,
  account: accountPage,
  contact: contactPage,
  // A customer with its invoices and quotations listed inside it, and a home with its viewings: shared/related-lists.ts.
  'customer-account': customerAccount,
  property: property,
  // A listing's features by its type, its sums and dates worked out, the district's average asked of the app (shared/functions.ts).
  listing: listing,
  // A flat let in Riyadh: its days in the Hijri calendar beside the Gregorian, a month alone, a year alone (shared/lease.ts).
  lease: lease,
  // A clinic's feedback: the questions after the first offer the treatments ticked in it.
  'visit-feedback': visitFeedback,
  // A clinic's staff check: a quiz whose results the person sees once they send.
  'training-check': trainingCheck,
  // A buyer's home search, one question at a time.
  'find-a-home': findAHome,
  // A record each of their rows opens: an invoice, a quotation, a viewing.
  invoice: relatedLists.pages.invoice,
  quotation: relatedLists.pages.quotation,
  viewing: relatedLists.pages.viewing,
  // A customer's card that says the customers it may duplicate, and merges two: shared/duplicates.ts.
  'customer-card': customerCardPage,
  // A clinic's consent to treatment, signed: who, when and the answers' fingerprint kept, the answers locked (shared/consents.ts).
  'clinic-consent': consentPage,
  // A listing's photos as a set, the agent's listings showing each one's cover, and a clinic's before and after
  // (shared/photo-sets.ts).
  'listing-photo-set': photoSetPages['listing-photo-set'],
  'agent-listings': photoSetPages['agent-listings'],
  'clinic-before-after': photoSetPages['clinic-before-after'],
  // A clinic's treatment, its injectables' lots read from their boxes' DataMatrix codes, and a shelf counted by its
  // barcodes: codes scanned with the camera (shared/scan.ts).
  'clinic-treatment': treatmentPage,
  'stock-count': stockCountPage,
  // An agent's visit to a flat: its video tour and voice notes played in place (shared/site-visit.ts).
  'site-visit': siteVisit,
  // A ticket's link as a QR code and its number as a barcode, to scan from the screen (shared/event-ticket.ts).
  'event-ticket': eventTicket,
  // A treatment's injection points as pins on a face chart (shared/face-chart.ts).
  'face-chart': faceChart,
  // A clinic's treatment course — its sessions' repeat rule, templates, Undo after Mark done, Mona at the front desk
  // live — and a branch's opening hours, which booking follows (shared/treatment-course.ts).
  'treatment-course': treatmentCoursePage,
  'clinic-branch': clinicBranchPage,
  fields: fields,
  kinds: kinds,
  // The business widgets on one task: shared/business.ts.
  business: businessPage,
  // Code in its own language, in CodeMirror and in VS Code's editor: shared/code-page.ts.
  code: codePage,
  order: order,
  // A service agreement's clauses, its fees a price table pasted from an office app: shared/contract-fees.ts.
  'contract-fees': contractFees,
  rules: rules,
  layout: layout,
  lists: lists,
  // An AI agent's tools, each line's from its connection: the app's lists asked by a line's values (shared/agent-tools.ts).
  'agent-tools': agentTools,
  custom: customPage,
  // A part that fails — the app's price tag, its delivery planner — kept to its place: shared/contained.ts.
  contained: containedPage,
  // Places the saved Address form twice: see `savedForms`.
  delivery: delivery,
  // Its buttons and moments run steps: a page opened by its id (see `openedPages`), the app's answers (shared/order-desk.ts).
  'quick-order': quickOrder,
  // A work item's head: kind, title line, row, buttons, band and tabs (shared/wi-header.ts); `&open=dialog` opens it in a large popup.
  'wi-head': wiHeadPage,
  // The same bug's tags inline in its row, its ⋮ with dividers and Templates › (the app's), its Description read first
  // (shared/wi-more.ts); `&open=dialog` opens it in a large popup.
  'wi-more': wiMorePage,
  // A place and an area on a map: @fieldia/map, on OpenStreetMap (shared/maps.ts).
  'map-delivery': mapDelivery,
  'map-zone': mapZone,
  // An address on one line with the map service's suggestions, filling a place and an address's parts.
  'map-address': mapAddress,
  // The work item's pickers, for their browser test: shared/wi-picker.ts.
  ...wiPicker.pages,
  // A list's records on a map, and the record each opens: shared/homes.ts.
  'map-homes': mapHomes,
  // The same homes as a gallery: a card each, its photo large, a viewing booked from it (shared/homes.ts).
  'homes-gallery': homesGallery,
  // Those for sale in pounds, filtered as a buyer filters them: counts, ranges, bedrooms 2+, a phone's sheet (shared/homes.ts).
  'homes-search': homesSearch,
  // A sales team's buyer leads, its filters counted ("Late 5"), and each lead's own page (shared/leads.ts).
  'leads-queue': leadsQueue,
  // Lists whose cells are changed in place, each row saved as it is left: a clinic's prices, a week's hours, a
  // pipeline's stages (shared/editable-lists.ts).
  'service-prices': servicePrices,
  'staff-hours': staffHours,
  'deal-stages': dealStages,
  lead: lead,
  // A work item's body: groups with tools at their heading's end, Markdown and rich text, a discussion, links (shared/wi-text.ts).
  'wi-text': wiText,
  'map-home': mapHome,
  'map-couriers': mapCouriers,
  'map-courier': mapCourier,
  // A form's map: an order coming to its door, the courier on the way (shared/courier-ride.ts).
  'map-order': mapOrder,
  // A place for each line: a van's round through its stops, in order.
  'map-round': mapRound,
  // A bug's History tab on its own: how its State moved, then each change with its before and after (shared/wi-history.ts).
  'wi-history': wiHistoryPage,
  'map-zones': mapZones,
  'map-heat': mapHeat,
  // Twenty thousand homes across Egypt, gathered on the data source where they crowd, and the home each opens (shared/many-homes.ts).
  ...manyHomesPages,
  'map-kitchen': mapKitchen,
  'map-week-order': mapWeekOrder,
  // 500 fields, for timing: e2e/perf.spec.ts opens it; no card in the gallery (see e2e/demos-shell.spec.ts).
  big: big,
  // Tables of lines with none yet, a totals row under one: e2e/grid-empty.spec.ts opens it; no card in the gallery.
  'empty-grids': emptyGridsPage,
  // How a dense sheet reads, as Flectra's: values as words, formatted stat buttons, links with pictures, lines, alerts, keys, ribbons.
  reading: reading,
  // A bug as a work item, in the look the demo's switch picks: quiet, values plain words until pointed at or clicked.
  'work-item': workItem,
  // The same bug with its header quiet in any look, the rest as the switch says: a section choosing its own look.
  // No card in the gallery: e2e/quiet-look.spec.ts opens it.
  'work-item-mixed': pageFrom(workItem, quietHeader),
  // What sits around a record: the gear menu, the pager and breadcrumbs, the PDF beside it (shared/vendor-bill.ts).
  'vendor-bill': vendorBill,
  // Sherkety ERP's own screens, rebuilt: one file per lane in shared/real/.
  ...real.pages,
  // The template library, ready pages to start from: shared/templates.ts.
  ...templatePages,
  // A listing whose photos go to the store as each is picked: shared/listing-photos.ts.
  'listing-photos': listingPhotos,
  // A list's records on a calendar, and the record each opens: a clinic's day by doctor, the booking desk's week (shared/calendar.ts).
  ...calendarDemo.pages,
  // A café's fit-out on a timeline, its tasks by phase and what each waits for, and the task each opens (shared/gantt.ts).
  ...ganttDemo.pages,
  // A listing's handover with the owner's consent placed in it, its files the listing's: shared/listing-handover.ts.
  ...listingHandover.pages,
  // An event's sign-up with open and close dates, places for each session, one from each person: shared/event-signup.ts.
  'event-signup': eventSignupPage(),
  // A property enquiry shared as a broker's link: the unit filled from it, who sent the person in hidden fields (shared/unit-enquiry.ts).
  'unit-enquiry': unitEnquiryPage(),
  // A broker's viewing report kept on the phone without signal and sent when it comes back (shared/viewing-report.ts).
  'viewing-report': viewingReportPage(),
  // A clinic's long intake, Continue later on any device: shared/clinic-intake.ts.
  'clinic-intake': clinicIntake,
  // A buyer's property enquiry beside its conversation — WhatsApp, e-mail and notes, ticks, a follow-up at 15:30 on
  // Cairo's clock — and the buyer's phone over it (shared/enquiry.ts).
  enquiry: enquiry,
  // AI help, answered by the memory source's stand-in (no model, no keys): a customer filled from an e-mail's signature,
  // a buyer's enquiry read and answered with a drafted and polished reply (shared/enquiries.ts).
  'customer-from-email': customerFromEmail,
  'enquiry-reply': enquiryReply,
  // A test drive booked at a showroom in Berlin, on Berlin's clock, from the times its schedule has free: shared/test-drive.ts.
  'test-drive': testDriveDemo.page,
  // The showroom's week of test drives on a calendar, on Berlin's clock wherever it is looked at from.
  'test-drives': testDriveDemo.list,
  // A purchase order over its limit waiting for Finance, then the CFO; an expense rejected with why (shared/approvals.ts).
  'purchase-approval': purchaseApproval,
  'expense-approval': expenseApproval,
  // A listing's title and description typed in Arabic and English; a clinic's services named in both, and each one's
  // page: shared/languages.ts.
  'listing-languages': listingLanguages,
  'services-languages': servicesLanguages,
  'service-languages': serviceLanguages,
};

/**
 * The page the query string names, with the page-wide choices it may also make:
 * `maxWidth` (narrow, medium, wide, full), `actions` (top, bottom), `scheme`
 * (light, dark, auto) and `labels` (above, beside, hidden). The viewer shows it in the query's `locale`, in the
 * page's own words when it keeps them in that language. With no scheme named, by the query or the page, a
 * reader whose system is dark gets the reader's own (auto), as the frame round it does (demos/shell.mjs); a
 * light system leaves the page exactly as it is drawn.
 */
export async function pageFromQuery(params: URLSearchParams): Promise<Page> {
  // A record opened from a list's row: the list's own page too, at once, for its name over the record (`trailFromQuery`).
  const from = listOpening(params);
  const list = from ? pageOf(pages[from]).then((page) => (listTitles[from] = page.layout.type === 'list' ? (page.title ?? '') : ''), () => undefined) : undefined;
  // The code page in the editor the demo's switch picked.
  const named = params.get('page') === 'code' ? codePageFor(params.get('editor')) : await pageOf(pages[params.get('page') ?? 'signup'] ?? pages['signup']);
  await list;
  // A list opened for one record's records (`filter=` or `search=`, a related list's View all by the app's route) shows them all, its own default filters off.
  const page = (params.get('filter') || params.get('search')) && named.layout.type === 'list' ? { ...named, layout: { ...named.layout, defaultFilters: [] } } : named;
  const maxWidth = params.get('maxWidth');
  const actions = params.get('actions');
  const dark = !page.look?.scheme && matchMedia('(prefers-color-scheme: dark)').matches;
  const scheme = (params.get('scheme') ?? (dark ? 'auto' : null)) as NonNullable<Page['look']>['scheme'] | null;
  const labels = params.get('labels') as NonNullable<Page['look']>['labels'] | null;
  // A look for each kind of part, as JSON: `parts={"inputs":{"corners":"round"}}`.
  const parts = params.get('parts');
  // A printout's words and logo over and under it, as JSON: `print={"footer":"Confidential · {name}"}`.
  const print = params.get('print');
  // A page the address dresses in settings of its own is written in the format this Fieldia writes: a page is read by its
  // stamp, and refused stamped older than a setting it uses (a printout's words came in 0.4).
  const dressed = !!(maxWidth || actions || scheme || labels || parts || print);
  return {
    ...page,
    ...(dressed ? { fieldia: FORMAT_VERSION } : {}),
    ...(maxWidth ? { maxWidth: maxWidth as Page['maxWidth'] } : {}),
    ...(actions ? { actionsPosition: actions as Page['actionsPosition'] } : {}),
    ...(scheme || labels || parts
      ? { look: { ...page.look, ...(scheme ? { scheme } : {}), ...(labels ? { labels } : {}), ...(parts ? { parts: JSON.parse(parts) } : {}) } }
      : {}),
    ...(print ? { print: { ...page.print, ...JSON.parse(print) } } : {}),
  };
}

/**
 * The record a record's page opens: `record=…`, or its model's first sample record — one rule for every demo, so a
 * page opened without `record=` shows a record (0.33 says a load that fails: "No … record with id 1" where a model's
 * records start elsewhere). A model with no sample records opens 1, as before. A list shows many, and opens none.
 */
export function recordFromQuery(params: URLSearchParams, page: Page): number | null {
  if (page.data.kind !== 'record' || page.layout.type === 'list') return null;
  // `record=new`: a new record, as a template opens.
  const given = params.get('record');
  if (given === 'new') return null;
  return Number(given ?? firstSampleRecord(page.data.model) ?? 1);
}

/** The records of the sample source made last (`sampleDataSource`), by model, as they are now. */
let sampleRecords: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {};
/** A model's first sample record's id, or null where it has none. */
export function firstSampleRecord(model: string): string | null {
  return Object.keys(sampleRecords[model] ?? {})[0] ?? null;
}

/** Each list's record page: a home's for the homes on a map, a courier's for the couriers, an order's for the week's orders; the customer's for the rest. */
const RECORD_PAGES: Record<string, string> = {
  contacts: 'contact',
  'map-homes': 'map-home',
  'homes-gallery': 'map-home',
  'agent-listings': 'listing-photo-set',
  'homes-search': 'map-home',
  'leads-queue': 'lead',
  'orders-review': 'order',
  'waiting-room': 'waiting-patient',
  'activity-log': 'activity-entry',
  'chart-of-accounts': 'account',
  'map-couriers': 'map-courier',
  'map-zones': 'map-week-order',
  'map-heat': 'map-week-order',
  'map-many-homes': 'map-many-home',
  ...calendarDemo.recordPages,
  ...ganttDemo.recordPages,
  'test-drives': 'test-drive',
  // An invoice from the invoices list, and from a customer's (View all, by the app's route — or in its dialog, over
  // the customer, where the app has no route); a home's viewings, in View all's dialog over the home.
  invoices: 'invoice',
  'customer-account': 'invoice',
  property: 'viewing',
  'services-languages': 'service-languages',
};

/** What a portal's page of homes to buy keeps to, whatever is filtered: homes for sale, priced in pounds. */
const HOMES_TO_BUY: ResolvedFilter[] = [
  { field: 'offer', op: '=', value: 'sale' },
  { field: 'currency', op: '=', value: 'EGP' },
];

/** Lists whose rows are changed where they stand, with no page of a record to open: the app opens none of their records. */
const CHANGED_IN_PLACE = new Set(['service-prices', 'staff-hours', 'deal-stages']);
/** Whether a list's rows open a record of their own: not those changed in place, whose rows are the whole of it. */
export const opensRows = (params: URLSearchParams): boolean => !CHANGED_IN_PLACE.has(params.get('page') ?? '');

/**
 * A list's row opens its record on its own page, keeping the skin, language and direction — and the list it came
 * from (`from`), whose name the record shows over it, its way back (`trailFromQuery`).
 */
export function openRecord(params: URLSearchParams, id: string | number): void {
  if (!opensRows(params)) return;
  // The list it came from first, then the list's own address as it was — its page the record's, the record last.
  const next = new URLSearchParams([['from', params.get('page') ?? ''], ...[...params].filter(([key]) => key !== 'from')]);
  next.set('page', recordPageOf(params.get('page') ?? ''));
  // What kept the list to one record's records is the list's, not the record's.
  next.delete('filter');
  next.delete('search');
  next.delete('record');
  next.set('record', String(id));
  location.search = next.toString();
}

/** The page a list's rows open their records on: its own, else the customer's — the Customer list's among them. */
const recordPageOf = (list: string): string => RECORD_PAGES[list] ?? 'customer';

/**
 * The list a record's address says it was opened from (`from`): one whose rows open records of this page — by the one
 * rule `openRecord` opens them by (the 0.37 walk: the Customer list's customer had no way back, its list in no table).
 */
function listOpening(params: URLSearchParams): string | null {
  const from = params.get('from');
  return from && pages[from] && opensRows(new URLSearchParams({ page: from })) && recordPageOf(from) === params.get('page') ? from : null;
}

/** The titles of the lists records were opened from, as `pageFromQuery` fetched them with the record's page. */
const listTitles: Record<string, string> = {};

/**
 * A record opened from a list's row, its way back, as an app gives one (the walk of 0.36: an activity log entry had
 * only the browser's Back): the list's name over the record (`breadcrumbs`, which the viewer draws as Flectra's
 * trail, as the vendor bill's and the real pages' show theirs). Pressed, the browser's Back where the list is the page
 * before — the list where it was left, its rows and its place, as Back keeps them (the walk of 0.35) — else the list's
 * own address: a link opened in a tab of its own. Its name is the list page's title, which `pageFromQuery` (awaited
 * before the viewer's options, by every demo) fetched with the record's page; none where it could not.
 */
function trailFromQuery(params: URLSearchParams): { breadcrumbs?: { label: string; href: string; open: () => void }[] } {
  const from = listOpening(params);
  const label = from && listTitles[from];
  if (!from || !label) return {};
  const list = new URLSearchParams(params);
  list.set('page', from);
  list.delete('record');
  list.delete('from');
  const href = `?${list}`;
  const open = () => {
    const before = document.referrer ? new URL(document.referrer) : null;
    if (before?.origin === location.origin && before.pathname === location.pathname && before.searchParams.get('page') === from && history.length > 1) history.back();
    else location.assign(href);
  };
  return { breadcrumbs: [{ label, href, open }] };
}

/**
 * Viewer choices the query string may make: `enterToNext=1` makes Enter move to
 * the next field, `showValid=1` puts a ✓ by each field filled in right, and
 * `saveStatus=toast` or `bar` moves the save's progress, `readonly=1` locks the
 * whole form, `editSwitch=1` adds Edit and Done, and `translate=fr` shows the
 * sign-up in French through an app's own catalog.
 */
export function optionsFromQuery(params: URLSearchParams): {
  drafts?: { store: Storage };
  user?: FormUser;
  context?: Record<string, JsonValue>;
  records?: (string | number)[];
  breadcrumbs?: { label: string; href?: string; open?: () => void }[];
  keys?: { enterMovesToNext: boolean };
  showValid?: boolean;
  saveStatus?: 'inline' | 'toast' | 'bar';
  readonly?: boolean;
  editSwitch?: boolean;
  warnOnLeave?: boolean;
  translate?: (text: string) => string;
  user?: FormUser;
  now?: () => Date;
  resume?: string;
  listFilter?: ResolvedFilter[];
  listSearch?: Facet[];
  functions: AppFunctions;
} {
  const saveStatus = params.get('saveStatus');
  // A portal's page of homes to buy: those for sale, in pounds, whatever the buyer filters.
  const listFilter = filterFromQuery(params) ?? (params.get('page') === 'homes-search' ? HOMES_TO_BUY : undefined);
  const listSearch = searchFromQuery(params);
  return {
    // The app's own functions its pages' formulas call: a district's average price, asked of its server (shared/functions.ts).
    functions: demoFunctions,
    // A list kept to one record's records by its address: a related list's View all, by the app's route — said as chips
    // a person may take away ("Customer: Nile Traders"), or conditions kept whatever is searched.
    ...(listFilter ? { listFilter } : {}),
    ...(listSearch ? { listSearch } : {}),
    // The contacts' person signed in: Mona Adel, one of their owners — her own contacts bold (the page's rowBold).
    ...(params.get('page') === 'contacts' ? { user: { id: 9001, name: 'Mona Adel' } } : {}),
    // The viewing report's broker, signed in: what she sends without signal is kept as hers, past a closed tab.
    ...(params.get('page') === 'viewing-report' ? { user: { id: 'broker-mona', name: 'Mona Adel' } } : {}),
    // The invoices' periods counted from the demo's clock, as their records were made: `?now=` pins both; the leads'
    // follow-ups too. The sign-up opens and closes on it: `?now=` before sign-ups open, or after they close.
    ...(params.get('page') === 'invoices' || params.get('page') === 'leads-queue' || params.get('page') === 'event-signup' || params.get('page') === 'activity-log' ? { now: demoNow } : {}),
    // Who decides on a purchase order or an expense, as the address signs them in (`as=`; shared/approvals.ts).
    ...approvalUser(params),
    // A draft to continue from, by the key in the link Continue later gave (shared/clinic-intake.ts).
    ...(params.get('resume') ? { resume: params.get('resume') as string } : {}),
    // The vendor bill has the records round it and the trail to it, as an app gives them.
    ...(params.get('page') === 'vendor-bill' ? billNavigation() : {}),
    // A record opened from a list's row: the list's name over it, its way back.
    ...trailFromQuery(params),
    // A real page's person, with the roles that show its parts, and the records round it: `roles=a,b` (or none) changes the roles.
    ...realAround(params),
    ...(params.get('translate') === 'fr' ? { translate: (text: string) => APP_CATALOG_FR[text] ?? text } : {}),
    ...(params.get('readonly') === '1' ? { readonly: true } : {}),
    ...(params.get('editSwitch') === '1' ? { editSwitch: true } : {}),
    // The browser's Back or Reload asks before a change not saved goes, as an app with real users wants; `warnOnLeave=0` turns it off.
    ...(params.get('warnOnLeave') === '0' ? {} : { warnOnLeave: true }),
    ...(params.get('enterToNext') === '1' ? { keys: { enterMovesToNext: true } } : {}),
    ...(params.get('showValid') === '1' ? { showValid: true } : {}),
    ...(saveStatus === 'toast' || saveStatus === 'bar' ? { saveStatus } : {}),
    // `drafts=1`: what is typed is kept in the browser as a draft, offered again when the page opens — and always on the
    // long intake, where a person who reloads expects their answers back (the walk of 0.35: it opened empty).
    ...(params.get('drafts') === '1' || (params.get('page') === 'clinic-intake' && params.get('drafts') !== '0') ? { drafts: { store: localStorage } } : {}),
    // A test drive's today is the demos' (`?now=`, as the browser tests pin it), as its free times are, and the booking
    // template's; so is a consent's signing, an enquiry's follow-ups, and a lease's first rent's month.
    ...(['test-drive', 'template-appointment-booking', 'clinic-consent', 'enquiry', 'lease'].includes(params.get('page') ?? '') ? { now: demoNow } : {}),
    // The front desk's person, Sara, who has the course open; the courses round the one shown, on the demos' clock.
    ...(params.get('page') === 'treatment-course' ? { user: { id: 7, name: 'Sara Hassan' }, records: [1, 2], now: demoNow } : {}),
    ...(params.get('page') === 'clinic-branch' ? { now: demoNow } : {}),
    // The consents round the one shown, and the enquiries: the pager over it moves to the next.
    ...(params.get('page') === 'clinic-consent' || params.get('page') === 'enquiry' ? { records: [1, 2] } : {}),
    // The customers round the one with its invoices and quotations, and the homes round the one with its viewings: the
    // pager over the record moves to the next, its related lists that one's.
    ...(params.get('page') === 'customer-account' ? { records: [1, ...Array.from({ length: 12 }, (_, i) => 20 + i)] } : {}),
    ...(params.get('page') === 'property' ? { records: Array.from({ length: 64 }, (_, i) => i + 1) } : {}),
    // A printout's day is the demos' too where the address pins it (`?now=`, as the browser tests pin it).
    ...(params.get('page') === 'real-invoice' && params.get('now') ? { now: demoNow } : {}),
  };
}

/**
 * What the app gives a real page as it opens, by the `?page=` name: the person
 * and their roles, the pager's records, the trail back to their list — as a
 * lane's `around`, or its `users` and `navigation`. `roles=` names the roles
 * held instead, comma-separated — empty for none — to see the page as someone
 * without a manager's groups.
 */
function realAround(params: URLSearchParams): { user?: FormUser; context?: Record<string, JsonValue>; records?: (string | number)[]; breadcrumbs?: { label: string; href?: string }[] } {
  const id = params.get('page') ?? '';
  const around = { ...(real.navigation[id] ?? {}), ...(real.users[id] ? { user: real.users[id] } : {}), ...(real.around[id] ?? {}) };
  const roles = params.get('roles');
  const user = around.user && roles !== null ? { ...around.user, roles: roles.split(',').filter(Boolean) } : around.user;
  return { ...around, ...(user ? { user } : {}) };
}

/** An app's own catalog, as an app keeps it: the sign-up's words in French. */
const APP_CATALOG_FR: Record<string, string> = {
  'Workshop sign-up': 'Inscription à l’atelier',
  'One day on building forms that people finish. Cairo, 14 November.': 'Une journée pour construire des formulaires que l’on termine. Le Caire, 14 novembre.',
  'About you': 'À propos de vous',
  'Full name': 'Nom complet',
  Email: 'E-mail',
  'We send the joining details here.': 'Nous envoyons ici les détails pour nous rejoindre.',
  Company: 'Entreprise',
  'Your role': 'Votre rôle',
  Developer: 'Développeur',
  Designer: 'Designer',
  Manager: 'Manager',
  'Something else': 'Autre chose',
  'Mobile phone': 'Téléphone mobile',
  'Only if the day changes.': 'Seulement si la journée change.',
  'Which role?': 'Quel rôle ?',
  'People in your team': 'Personnes dans votre équipe',
  'Your work': 'Votre travail',
  'Experience with form builders': 'Expérience des outils de formulaires',
  'None yet': 'Aucune pour l’instant',
  Some: 'Un peu',
  Lots: 'Beaucoup',
  'Your hourly rate': 'Votre tarif horaire',
  'Optional. Used only for the pricing exercise.': 'Facultatif. Sert seulement à l’exercice sur les prix.',
  'The day': 'La journée',
  'Arriving on': 'Arrivée le',
  'Ticket price': 'Prix du billet',
  'Joining the dinner': 'Présent au dîner',
  'Dietary needs': 'Régime alimentaire',
  'Send me the workshop notes': 'Envoyez-moi les notes de l’atelier',
};

/** The pages records of other models open in, in a dialog: a customer from a link to it. */
export const relatedPages: Record<string, PageSource> = { partner: customer, ...real.related, 'wi.text': wiText, ...calendarDemo.related, ...ganttDemo.related, 'drive.booking': testDriveDemo.page, ...relatedLists.related };

/** The app's saved forms, placed in other pages by their id: the Address form, twice in Delivery details. */
export const savedForms: Record<string, PageSource> = { address: address, ...listingHandover.savedForms };

/** The pages a step opens by their id: a new customer in a side panel, and a customer's record in the order's place. */
export const openedPages: Record<string, PageSource> = { 'new-customer': newCustomer, customer: customer, ...real.opened, invoices: invoices, ...relatedLists.opened };

/**
 * The app's pages, as the viewer's `pages` asks for them: a linked record's
 * page at once, by its model; a saved form, or a page a step opens, by its id
 * a moment later, as an app fetching it from its server would — a saved
 * form's place shows a quiet placeholder first. `?pagesDelay=` sets the
 * moment, in ms; `?pagesDelay=hold` holds them until `releasePages()` lets
 * them go, so a test looks at the wait while it is certain to be one.
 */
export function appPages(request: PageRequest): Page | null | Promise<Page | null> {
  if ('model' in request) return pageAnswer(relatedPages[request.model]);
  const key = request.version === undefined ? request.id : `${request.id}@${request.version}`;
  const found = pageAnswer(savedForms[key] ?? openedPages[key]);
  const given = new URLSearchParams(location.search).get('pagesDelay');
  if (given === 'hold' && !pagesLetGo) return new Promise((resolve) => heldPages.push(() => resolve(found)));
  if (given === 'hold') return found;
  return new Promise((resolve) => setTimeout(() => resolve(found), Number(given ?? 150)));
}

/** A page as `pages` answers: at once where it is one, once fetched where it is a file of its own; null for none. */
const pageAnswer = (source: PageSource | undefined): Page | null | Promise<Page | null> => (typeof source === 'function' ? source() : (source ?? null));

/** Every page the demos serve, each fetched: for a browser test that reads them all. */
export const allPages = async (): Promise<Record<string, Page>> => Object.fromEntries(await Promise.all(Object.entries(pages).map(async ([name, source]) => [name, await pageOf(source)] as const)));

/** The pages held (`?pagesDelay=hold`), each let go by `releasePages()` — and whether they were, so those asked after come at once. */
const heldPages: (() => void)[] = [];
let pagesLetGo = false;
/** Every page held let go, and those asked after given at once; how many were held. */
export function releasePages(): number {
  pagesLetGo = true;
  const now = heldPages.splice(0);
  for (const go of now) go();
  return now.length;
}
/** How many pages are held now. */
export const pagesHeld = (): number => heldPages.length;

const PRODUCT_PRICES: Record<number, number> = { 1: 1890, 2: 380, 3: 749, 4: 6425, 5: 215 };
const round = (n: number) => Math.round(n * 100) / 100;

/** What a server's onchange does for a sales order, in a few lines: prices, subtotals, totals. */
export function recalculateOrder(values: Values): Values {
  const lines = ((values['line_ids'] as Line[] | null) ?? []).map((line) => {
    if (line.values['display_type']) return line; // a section or a note has nothing to price
    const v = { ...line.values };
    const product = v['product_id'] as { id: number; label: string } | null;
    if (product && !v['price']) {
      v['price'] = PRODUCT_PRICES[product.id] ?? 0;
      if (!v['name']) v['name'] = product.label;
    }
    if (v['qty'] == null && product) v['qty'] = 1;
    v['subtotal'] = round(Number(v['qty'] ?? 0) * Number(v['price'] ?? 0) * (1 - Number(v['discount'] ?? 0) / 100));
    return { ...line, values: v };
  });
  const untaxed = round(lines.reduce((sum, l) => sum + Number(l.values['subtotal'] ?? 0), 0));
  const tax = round(lines.filter((l) => l.values['taxed']).reduce((sum, l) => sum + Number(l.values['subtotal'] ?? 0) * 0.14, 0));
  return { line_ids: lines, amount_untaxed: untaxed, amount_tax: tax, amount_total: round(untaxed + tax) };
}

const COUNTRIES: Record<number, string> = { 1: 'Egypt', 2: 'Jordan', 3: 'Saudi Arabia' };

/** The app's own lists of choices, as a server keeps them: the countries delivered to, and each one's cities. */
const DELIVERY: Record<string, { label: string; cities: Record<string, string> }> = {
  eg: { label: 'Egypt', cities: { cairo: 'Cairo', giza: 'Giza', alexandria: 'Alexandria', luxor: 'Luxor' } },
  jo: { label: 'Jordan', cities: { amman: 'Amman', irbid: 'Irbid', aqaba: 'Aqaba' } },
  sa: { label: 'Saudi Arabia', cities: { riyadh: 'Riyadh', jeddah: 'Jeddah', dammam: 'Dammam' } },
  ae: { label: 'United Arab Emirates', cities: { dubai: 'Dubai', 'abu-dhabi': 'Abu Dhabi', sharjah: 'Sharjah' } },
};
/** A list answers after a moment, as one from a server does, so its loading shows. */
const LIST_DELAY_MS = 600;
const later = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LIST_DELAY_MS));
const appLists = {
  countries: () => later(Object.entries(DELIVERY).map(([value, { label }]) => ({ value, label }))),
  cities: (values: Values) => later(Object.entries(DELIVERY[values['country'] as string]?.cities ?? {}).map(([value, label]) => ({ value, label }))),
};
/** The app's lists as a designer offers them: the name the data source answers to, and the words a person picks it by. */
export const APP_LISTS = [
  { name: 'countries', label: 'Countries delivered to' },
  { name: 'cities', label: 'Cities of the country' },
];
/** The same lists, named in Arabic, for the designer demos in Arabic (`?locale=ar`). */
export const APP_LISTS_AR = [
  { name: 'countries', label: 'دول التوصيل' },
  { name: 'cities', label: 'مدن الدولة' },
];
const CURRENCIES: Record<number, string> = { 1: 'EGP', 2: 'JOD', 3: 'SAR' };

/**
 * Each home's own address, as a site keeps one for each of its listings:
 * its page in the demo's look and language, so a card's link opens it here,
 * in a new tab, or is copied, as a link is.
 */
function linkedHomes(homes: Record<number, Values>): Record<number, Values> {
  const here = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  for (const [id, home] of Object.entries(homes)) {
    const to = new URLSearchParams(here);
    to.set('page', 'map-home');
    to.set('record', id);
    home['link'] = `?${to}`;
  }
  return homes;
}

/** A page with its header section in the quiet look whatever look the form wears. */
function quietHeader(page: Page): Page {
  const copy = structuredClone(page) as Page;
  const header = (copy.layout as { children?: { id?: string; quiet?: boolean }[] }).children?.find((node) => node.id === 'header');
  if (header) header.quiet = true;
  return copy;
}

/** A customer to edit, and the records its relations point to. Sample data. */
export function sampleDataSource() {
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const showroomSlots = scheduleSlots({ showroom: showroom() }, { now: demoNow });
  // The twenty thousand homes, made only for the pages that show them; their map's bubbles counted here, as a server counts them.
  const many = ['map-many-homes', 'map-many-home'].includes(params.get('page') ?? '');
  const options = withReal({
    ...(many ? { clusters: gridClusters({ models: ['home.egypt'] }) } : {}),
    // The listing's photos go to a store as slow as a phone's upload, one of them failing once (shared/listing-photos.ts).
    ...(params.get('page') === 'listing-photos' ? { storage: LISTING_STORAGE } : {}),
    lists: { ...appLists, ...agentLists },
    // A booking answered as a clinic's server answers it: kept with its bookings, so its time is no one else's now
    // (shared/appointments.ts), and with its reference, which the page's ending says ("Your booking is B-1043"); every
    // other response with its number.
    submitted: (request, count) => {
      // An enquiry that reserves a unit: its reservation's reference, which its ending says.
      if (request.pageId === 'unit-enquiry') return { id: `R-${1200 + count}` };
      if (request.pageId !== 'appointment-booking') return { id: count };
      keepAppointment(source.records, request.values);
      return { id: `B-${1042 + count}` };
    },
    // Free times: a test drive's, from the showroom's schedule (shared/test-drive.ts); the booking template's, from its
    // clinic's (shared/appointments.ts) — each on the demos' clock.
    slots: (request, records) => (request.schedule === 'appointments' ? appointmentSlots(request, records) : request.schedule === 'branch' ? branchSlots(request, records) : showroomSlots(request, records)),
    // The clinic's saved course templates; and the course live, as a server with a socket (shared/treatment-course.ts).
    templates: COURSE_TEMPLATES,
    ...(params.get('page') === 'treatment-course' ? { live: true, versions: { by: 'Sara Hassan' } } : {}),
    // Records like the one typed — the same phone, email or tax id, a name close enough — for a page with `duplicates`.
    duplicates: alikeRecords(),
    // The sign-ups already counted, as the server's limits answer (shared/event-signup.ts).
    limits: EVENT_COUNTS,
    // A text kept in several languages read in the reader's where the source says it as one — a list's order, a link's
    // name — as an app's server reads it in its person's language.
    language: params.get('locale') ?? 'en',
    // AI help — Fill from text, Draft and Polish, a search's words read as filters — answered by Fieldia's stand-in: no
    // model and no keys, words read by their patterns, a reply drafted from the agency's template (shared/enquiries.ts).
    assist: demoAssist,
    // A payment the answers wait for, through a stand-in for the app's provider's checkout (shared/unit-enquiry.ts).
    pay: (request) => standInCheckout(request),
    // No signal while the viewing report's bar says so, or the browser has no network: saves and sends fail as a network's.
    offline: demoOffline,
    // The drafts the server keeps, and the link Continue later gives (shared/clinic-intake.ts).
    drafts: keptDrafts(),
    // How a purchase order and an expense are approved, and what was decided so far — this tab's decisions kept over the
    // samples' (shared/approvals.ts, shared/kept.ts).
    approvals: APPROVAL_ROUTES,
    approvalHistory: approvalHistory(),
    draftLink,
    attachments: billAttachments(),
    // What this person may do with a contact: Karim's are his own, a blocked one's status the credit team's; an expense
    // claim is its employee's alone to change (shared/approvals.ts).
    can: { 'crm.contact': contactPermissions, 'deal.stage': stagePermissions, 'hr.expense': claimPermissions(params) },
    // The price list keeps versions: a price someone else changes meanwhile is said under its row (shared/editable-lists.ts).
    ...(params.get('page') === 'service-prices' ? { versions: { by: 'Sara Ali' } } : {}),
    // What links show of their records besides their names: an address, a picture, a colour.
    shows: { 'reading.partner': { details: ['street', 'city', 'vat'] }, 'reading.user': { avatar: 'image' }, 'reading.tag': { color: 'color' }, ...wiPicker.shows, ...LEASE_SHOWS, ...AREA_SHOWS },
    records: {
      ...READING,
      ...WI_HEAD_RECORDS,
      ...wiMoreRecords(WI_HEAD_RECORDS['wi.head'][1]),
      ...emptyGridsRecords,
      'account.move': BILLS,
      home: linkedHomes(sampleHomes()),
      ...(many ? { 'home.egypt': manyHomes(params.toString()) } : {}),
      'home.amenity': Object.fromEntries(Object.entries(AMENITIES).map(([id, name]) => [id, { name }])),
      // A sales team's buyer leads, made round now (shared/leads.ts).
      lead: sampleLeads(),
      // Buyers' enquiries to read and answer with AI help (shared/enquiries.ts): a model of their own, apart from the
      // enquiry beside its conversation (shared/enquiry.ts).
      'buyer.enquiry': sampleEnquiries(),
      // The homes' viewings and the agents who show them; the customers' quotations (shared/related-lists.ts).
      viewing: sampleViewings(sampleHomes()),
      agent: Object.fromEntries(Object.entries(AGENTS).map(([id, name]) => [id, { name }])),
      quotation: sampleQuotations(),
      ...wiPicker.records,
      courier: sampleCouriers(),
      'food.order': { 1: sampleOrder() },
      ...wiTextRecords(),
      'delivery.round': { 1: sampleRound() },
      'shop.order': sampleWeekOrders(),
      'wi.history': { 1: wiHistoryRecord() },
      ...CONTAINED_RECORDS,
      ...CONTRACT_FEES_RECORDS,
      'shop.kitchen': { 1: sampleKitchen() },
      listing: { 1: LISTING },
      lease: { 1: LEASE },
      'lease.agent': LEASE_AGENTS,
      // Areas of Greater Cairo as a tree, for a lead's areas wanted (shared/areas.ts).
      area: AREAS,
      // The contacts, and the people who own them (shared/contacts.ts).
      'crm.contact': sampleContacts(),
      // A clinic's prices, a week's hours, a pipeline's stages: lists changed in place (shared/editable-lists.ts).
      'clinic.service': sampleServices(),
      'clinic.role': CLINIC_ROLES,
      'staff.week': sampleStaffWeeks(),
      'deal.stage': sampleStages(),
      'res.users': Object.fromEntries(Object.entries(OWNERS).map(([id, name]) => [id, { name }])),
      // The calendars' appointments and bookings, made round now (shared/calendar.ts).
      ...calendarDemo.records(),
      // The fit-out's tasks, the plan two weeks under way (shared/gantt.ts).
      ...ganttDemo.records(),
      // Fifteen months of invoices up to now (shared/invoices.ts).
      invoice: sampleInvoices(),
      // An AI agent and the company's connections its tools come from (shared/agent-tools.ts).
      ...agentRecords,
      // The showroom's cars and test drives, made round now (shared/test-drive.ts).
      ...testDriveRecords(),
      // The booking template's clinic: its bookings round now (shared/appointments.ts).
      ...appointmentRecords(),
      // Two consents signed, one changed in the clinic's system after (shared/consents.ts).
      'clinic.consent': sampleConsents(),
      // Two buyers' enquiries about homes (shared/enquiry.ts).
      enquiry: ENQUIRY_RECORDS,
      // A purchase order waiting for approval, one under its limit, an expense rejected (shared/approvals.ts).
      ...approvalRecords(),
      // A portal's listings and a clinic's services, typed in Arabic and English (shared/languages.ts).
      'portal.listing': bilingualListings(),
      // A model of their own, apart from the price list's services (shared/editable-lists.ts).
      'clinic.menu': bilingualServices(),
      // The agent's listings and a clinic's treatment photos, drawn only for the pages that show them (shared/photo-sets.ts).
      ...(['listing-photo-set', 'agent-listings', 'clinic-before-after'].includes(params.get('page') ?? '') ? photoSetRecords() : {}),
      // A clinic's patients and injectables, a treatment, a shop's shelf and its count (shared/scan.ts).
      ...scanRecords(),
      // An agent's visit to a flat, with its films and voice notes (shared/site-visit.ts).
      'property.visit': siteVisits(),
      // A ticket to an event, its codes to scan (shared/event-ticket.ts).
      'event.ticket': eventTickets(),
      // A clinic's treatment, its injection points on a face chart (shared/face-chart.ts): a model of its own, apart from
      // the scanned treatment's injectables (shared/scan.ts), whose records it would replace.
      'clinic.chart': treatments(),
      // Treatment courses and a branch (shared/treatment-course.ts).
      'clinic.course': sampleCourses(),
      'clinic.branch': sampleBranches(),
      'work.item': {
        1: {
          title: 'Stock count wrong after a partial release',
          state: 'resolved',
          reason: 'fixed',
          area: 'portal-checkout',
          iteration: 's14',
          assigned_to: { id: 5, label: 'Mona Adel' },
          priority: '2',
          severity: '3',
          story_points: 3,
          activity: 'development',
          due_date: '2026-10-20',
          found_in: 'Build 2026.10.4',
          repro_steps: '<p>Release half of order 26-0847 from the warehouse.</p><p>Open the product: the stock count still shows the whole order as reserved.</p>',
          system_info: null,
          acceptance: null,
        },
      },
      partner: {
        1: {
          name: 'Nile Traders',
          is_company: true,
          company_type: 'company',
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
        // More clients than a link's list shows, so "Search more…" has the rest, and the list of customers has two pages.
        ...Object.fromEntries(
          (
            [
              ['Amira Clinics', 'info@amiraclinics.example', '+20 2 2735 1100', 1, 'active', 1, 50000, 4],
              ['Bayt Interiors', 'hello@baytinteriors.example', '+96264612200', 2, 'active', 2, 18000, 7],
              ['Cairo Coworking', 'desk@cairocowork.example', '+20 2 2794 3300', 1, 'draft', 1, 30000, 0],
              ['Delta Foods', 'orders@deltafoods.example', '+20403334400', 1, 'active', 1, 420000, 26],
              ['Giza Plaza', 'leasing@gizaplaza.example', '+20 2 3572 5500', 1, 'blocked', 1, 120000, 9],
              ['Heliopolis Dental Care', 'front@heliodental.example', '+20 2 2418 6600', 1, 'active', 1, 65000, 5],
              ['Maadi Labs', 'team@maadilabs.example', null, 1, 'draft', 1, null, 0],
              ['Nour Pharmacies', 'buying@nourpharma.example', '+966114647700', 3, 'active', 3, 90000, 14],
              ['Sahel Resorts', 'stay@sahelresorts.example', '+20 46 419 8800', 1, 'active', 1, 310000, 11],
              ['Tahrir Books', 'shop@tahrirbooks.example', '+20 2 2392 9900', 1, 'blocked', 1, 15000, 3],
              ['Zamalek Studio', 'studio@zamalek.example', '+201001234567', 1, 'active', 1, 40000, 2],
            ] as const
          ).map(([name, email, phone, country, state, currency, credit_limit, sale_order_count], i) => [
            20 + i,
            {
              name,
              is_company: true,
              company_type: 'company',
              state,
              email,
              phone,
              country_id: { id: country, label: COUNTRIES[country] },
              currency_id: { id: currency, label: CURRENCIES[currency] },
              credit_limit,
              sale_order_count,
            },
          ]),
        ),
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
      carrier: { 1: { name: 'Aramex' }, 2: { name: 'Bosta' }, 3: { name: 'Our own van' } },
      product: {
        1: { name: 'Office chair, ergonomic', price: 1890 },
        2: { name: 'Desk lamp, LED', price: 380 },
        3: { name: 'Monitor arm, dual', price: 749 },
        4: { name: 'Standing desk 160 × 80', price: 6425 },
        5: { name: 'Cable tray, 120 cm', price: 215 },
      },
      // A clinic's waiting room this morning, its patients in the order they go in (shared/waiting-room.ts).
      'clinic.waiting': waitingPatients(),
      'sale.order': {
        1: {
          name: 'S00118',
          state: 'sent',
          partner_id: { id: 1, label: 'Nile Traders' },
          // When it was ordered, as Flectra keeps a sales order's: a date and time.
          date_order: '2026-10-02T10:00',
          validity_date: '2026-11-01',
          payment_term: '30',
          line_ids: [
            { key: 's1', id: 100, values: { sequence: 10, display_type: 'section', name: 'Workstations' } },
            { key: 'l1', id: 101, values: { lead_days: 14, sequence: 20, product_id: { id: 1, label: 'Office chair, ergonomic' }, name: 'Black mesh back', qty: 12, price: 1890, discount: 5, taxed: true, subtotal: 21546 } },
            { key: 'l2', id: 102, values: { lead_days: 21, sequence: 30, product_id: { id: 4, label: 'Standing desk 160 × 80' }, name: 'Oak top, black frame', qty: 6, price: 6425, discount: 0, taxed: true, subtotal: 38550 } },
            { key: 's2', id: 104, values: { sequence: 40, display_type: 'section', name: 'Lighting' } },
            { key: 'n1', id: 105, values: { sequence: 50, display_type: 'note', name: 'Warm white only, to match the reception.\nOur electrician fits them on delivery day.' } },
            { key: 'l3', id: 103, values: { lead_days: 7, sequence: 60, product_id: { id: 2, label: 'Desk lamp, LED' }, name: 'Warm white', qty: 12, price: 380, discount: 0, taxed: false, subtotal: 4560 } },
          ],
          amount_untaxed: 64656,
          amount_tax: 8413.44,
          amount_total: 73069.44,
          note: 'Delivery to the 12th floor by the freight lift, 08:00 to 10:00.',
          delivery_ids: [
            { key: 'd1', id: 201, values: { date: '2026-10-11', place: 'Nile Towers, 12th floor', carrier_id: { id: 3, label: 'Our own van' }, boxes: 14 } },
            { key: 'd2', id: 202, values: { date: '2026-10-13', place: 'Nile Towers, 12th floor', carrier_id: { id: 1, label: 'Aramex' }, boxes: 3 } },
          ],
        },
      },
      'permit.stage': { 1: { name: 'Applied' }, 2: { name: 'Inspected' }, 3: { name: 'Approved' } },
      employee: {
        21: { name: 'Mona Adel', job: 'Head of design' },
        22: { name: 'Karim Fathy', job: 'Site engineer' },
        23: { name: 'Salma Nabil', job: 'Project manager' },
        24: { name: 'Youssef Kamal', job: 'Head of procurement' },
        25: { name: 'Laila Mostafa', job: 'Draughtsperson' },
      },
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
          materials: 'oak, glass',
          permit_id: { id: 2, label: 'Inspected' },
          progress: 64,
          spent: 1184000,
          hours_logged: 118,
          warranty_months: 24,
          cable_length: 240,
          cable_unit: 'm',
          deposit: 370000,
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
          partner_ids: [{ id: 20, label: 'Amira Clinics' }],
          service_ids: [{ id: 31, label: 'Design' }, { id: 32, label: 'Project management' }],
          source: { model: 'partner', id: 1, label: 'Nile Traders' },
          milestone_ids: [
            { key: 'm1', id: 51, values: { name: 'Site survey', due: '2026-10-15', hours: 12, amount: 45000, owner_id: { id: 21, label: 'Mona Adel' }, invoiced: true } },
            { key: 'm2', id: 52, values: { name: 'Design sign-off', due: '2026-11-05', hours: 64, amount: 380000, owner_id: { id: 22, label: 'Karim Fathy' }, invoiced: false } },
          ],
          contract: null,
          // Two photos of the site, shown as cards: each picture over its name.
          photo: [
            { name: 'Reception, before the strip-out.jpg', type: 'image/jpeg', size: 4416, data: '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39Lya1884Mnk3BAgQIECBAgQIECBAgQIECBAgQIECBAmfKDq1E5UrxyteoM4arTwZMb0RL7NvUNWmwtG5j/peqzlo8FPYYxt/V8mtRjo+sMW2aD/2gAMAwEAAgADAAAAEIigAAAAAAAAAAAAAAAAAAG8AsBQAAAAAAAAAAAAAAABs4gggkogQQQQQQQQQQQQQVcAggggglAgk8WwolSgsJ5BXAgggggglAggggvfvviQglgPggggggglAggggvv/AP8ApCCWA+CCCCCCCUCCGOOvNNNuOOWA+CCCCCCCUCCszzzzzzzzw+A+CCCCCCCUCCW99999999pWA+CCCCCCCUCCW99999999pWA+CCCCCCCSOOc/8A/wD/AP8A/wD+5ob8IIIIIIJTrLLLLLLLLLLLLb6cIIIIJL74444444444445774sIIIPz74444444444445776wIII7764IIIIIIIIIIIJb762gIRz7777777777777777777wJz777777777777777777777P8A/8QAHhEAAwACAwEBAQAAAAAAAAAAAAERIEAQMWEwIUH/2gAIAQMBAT8QmrMJpTKEIQhCEIQhCEIT5pwgbvCaRA+E0NriiT7TSw/kN49tJ68e32e14Kokix7a/bX7a/b4JNuIsso8jyPI8jyPI8jyE4sob38JLQk8rPRgx7EiaX9MP6abV/BqOcJXBfmpRXiCutJn/8QAHhEAAwABBQEBAAAAAAAAAAAAAAERMRAgMEBhIUH/2gAIAQIBAT8QT6rcLpYJ3pN7kylKUpSlKUpSlKN3icnx6bsno0+MRo0o9G3kT/dKue4Z7nue4h6bVjmz7M21Y5kU2AGNXtWONEIQhCEIP5qscazw4arHGs8OGqxwNwggSU9j2PY9j2PY9j2IiCBJjgavoNVuaLopx7m6+k/5sf8AOmvgnVo3F1Wj0avrNUf/xAAoEAACAQEGBwEBAQEAAAAAAAAAARFhICExofDxEDBAQVFxsVCBkcH/2gAIAQEAAT8QgZfJ3JA6a/KRIySqOc3C88Js/wDBHH5ARRM+CJo13hWY32HckDpr8REjJKo5zcryNtuW5dubP/BHH4QRRM+CJo13hcuN9h3JA6a65EjJKo5zcryNtuW5fNUdJtXFYVhWFYVhWFVlVlYVhWFYVhWFVldlYVhWFYVhVZVZWFYVhWFYVg0kbcc/E9Wk1OIkkrkiF4F2ECQyXFq5YCVgkQvA3YpCmf8AFhNTiJJK5IheBdhAkMl0lierWCMSV2Z6RFDdhOMBJ7yUEN/eBtty3NjBGJK7M9Iihvg9EUniQ44BW2F7oLE9cvuNA4NBjQY0GNBjQY0GNBhmjbhuIvt50Z1wzjoLE9cv4fvIzu3nRnXDOOgsT1y/h+8jO7edGdcM46CxPXL+H7yM7t50Z1wzjoLE9ctjCRw8BvzN+ZvzN+ZvzN+ZvzL8YFbZ0Z1wzjoLE9Wt4NoG0DaBtA2gbQNoG0DaBtA2gbQNoG0DaBtA2gbQE01KvRnRnXDOOgsT1ZzIqkdxvI3kbyN5G8jeRvI3kbyN5G8jeRvI3kbyN5G8jeQzbXe4/DOjOuGcdBYnqykjYNQM6mSk117KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKIdcSa4e22gkmdGdcM46CxPVr4vvRZ984Z0Z1wzjoLE9Wvi+9Fn3zhnRnXDOOgsT1a+L70WffOGdGdcM46CxPVr4vvRZ984Z0Z1wzjoLE9Wvi+9Fn3zhnRnXDOOgk9cVsTVQ1UNVDVQ1UFRHiprokRERERERERERbdMApNVBtE7ruwQ3Dbcu8qMfH2qGxeWTEiIfOvUowXljmJbS+uTaaaxQpbfi5rHx4+74oxFQqFQqFQqFQqFQqFQqFQqFQqFQqFQqFQqFQqFQSNdxY83FwghTJTvT5fpEVDF2IIIIIIIIIIIIIIIIIIIIIIIIIsz7bm95XKanCJYx83eueF+Ex+G0jcrk5L0kzG+zRvBwaSNJGkjSRpI0kaSNJGkjSRpI0kaSNJGkjSRpI0kaSNJGkjSRpI0kaSER3ysvmfHPZ8i9SjBeWOYltL/ETaaaxQpbfitsfHj7u0jEVCoVCoVCoVCoVCoVCoVCoVCoVCoVCoVCoVCoVBI11pjzcXCCFMlO9Oz6RFQxduCCCCCCCCCCCCCCCCCCCCCCCCORPtub3lWGpwiWMfN3rnhfkMfhtI3K5OL0kzG/8q+Z8c9nwvUowXljmJbS/wApNpprFClt+IN84iu8tqf+/mJ43AZez//Z' },
            { name: 'River view from the 12th floor.jpg', type: 'image/jpeg', size: 6434, data: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHCAkIBgoJCAkMCwoMDxoRDw4ODx8WGBMaJSEnJiQhJCMpLjsyKSw4LCMkM0Y0OD0/QkNCKDFITUhATTtBQj//2wBDAQsMDA8NDx4RER4/KiQqPz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz//wgARCAEOAWgDASIAAhEBAxEB/8QAGgABAAIDAQAAAAAAAAAAAAAAAAMEAgUGAf/EABkBAQADAQEAAAAAAAAAAAAAAAABAgMEBf/aAAwDAQACEAMQAAAB60xhkhTEyETIRMhEyETIRMhEyETIRMhEzyMlQiZCJkImQiZCJkImQiZCJkImQ5mYiUM0Mxrx1YAAAAAAAAD02mv2FDDWEb5AAAAAAAALtK9nawMNkM0MxQHTgAAAAAAAA989NnQv0MdYhtkAAPTxZl5dqK7XtEQ6MgAF2ldpawMNkUsUxQeunDx6PHo8ejx6PHo8ejx6PHo89DZUb1HHWJ62y8ejx6PJorPPrIPM6nnop4yx+xxePV6+PR5cqW6WsDDZFLFMUR04AAAEcVL2VZCyNKCrE2lJWbqvZtGxpXaGWmDWJrs2sGzUb16p4Pa2uI8/K6/fENojxPV4wtAC5TuUvOMNUUsUxSPOjH1gM2HpkCCGeDn2Ctrqs6MbOquUqWhGWlrZa7Zb47DX7DX0vpBncCbaazZ7ZBpTzDOlneyrKWuZRS7ZhMALdS3S04x1RSwTFWvhNpTTLjHWnb9sTW0kdGVSC7DhrB5YVtSWRWju4IoLZLZVre2V6hfpUtoVtS9RbEe0qX9co0jSsNLZVctK6wzv7Mk3xjSLRFBapUtnf1uxzvbESwzpiTl9jMbNzis9HnzNiXRtOvXbY66Gk7dqPInbNIN35pYzeudHS+abG0dJXn5+J27nkOhc8Oi90eVo27nVZ6PPnrJuGnG6911O9d60Ks76LURJ3k3O7iF4SU7lM5vY67YzGvFbM8MyQF6KWKavPfItEBHJGiIJuY5Y3r0XP9Bz9JqhIE+WOd60xS0tmtZQCbVK7SvUKWyiliQ3Gn3CbwmFK7QmOcu63PbHNgic8ohYVxso6OExsWsJvqAv4UyLCuTsfNflMdrzvRctlpGqtKWlUX8tcmLCuibk+sI2bWE7urrkxsGvROywoEX91y3R1vthlooX6E15X3x1c0vsPpK8Hrwe+AilETPAAAZY5Ha8t1PLYb0RvgAAAAAAAA6PnOjppthz7qF+hNeVHVzAM8BKilAAAI/JREBljkdry3U8thvRG+AAAAAAAADo+c6Omm2HPuoX6E15UdXMAABlnEJmGR69Hj0eYSCH2XE7Llup5bDeiN8AAAAAAAAHR850dNNsOfdRvUkcokMY0gjSCNII0gjSDFkMWQxZDHJkdhy/Uc001yQzjSCNII0gjSCNII0gjSCNII+j0HQLbQNVK7SiOYGFAAAAAAAAGWOR2HNdLzWtqQyqAAAAAAAA6Dn+gvO0Gt1K7SiOYGFAAAAAAAAGWOR2HNdLzWtqQyqAAAAAAAA6Dn+gvO0Gt2OQgTkQJxAnECcQJxAnECcQJxAnECceRykwJyIE4gTiBOIE4gTiBOIE4gTiCTMkD//EACkQAAEDAgQGAwEBAQAAAAAAAAABAgMSEwQQETIUIDEzNEAFIjAhRFD/2gAIAQEAAQUC/wCcq6JcaXGlxpcaXGlxpcaXGlxpcaXGlxpcaXGlxpcaXGlxpcaXG5K9EW40uNLjS40uNLjS40uNLjS40uNLjS40uNLjS40uNLjS40RUXOTZ6sm/04duUmz1ZN/pw7cpNnqyb/Th25SbPVk3/g1mWiKObp+EW3KTZ6sm/nYnKqaLzRbcpNnqyb+dm3kf15otuUmz1ZN/OxeV39Xmi25SbPweuhUpUpUvI+Wl18vkcla5TFxxccXHFxxG9yvzR2bnfhFtyk2fhJzzdzLD78p+WLuclwuFaCLrzxbcn7ToVtK2lbRFRc5OS6XS6S78sPvym5Yu5mvTOPpzRbcn7SbtZ4fflJzybssPvym5Ye5mvTOPpmv8S6hdQgdU3KapY6MQLHIsPDSnDSnDSkMMjXUKUKPjcpZeWXll5YkLEhYkHwSK7h5Th5SGF7XUu1JWuU4eQ4eQ4eQ4eQjgkR9ClClCisdpZeWXll4yNyJQpQpQorHaWJCxIYdqsZk5yNbxMReZTxMRxMRxMQ2ZjlrQrQWRqF5heYXmF+Mvxl+MWeNDiIjiIhszHCzxoo6ZjXcRGcRGcRGcRGJPGqumY1eJiOJiEnjUvMLzC8wSRqlbStpW0uNL8ZfjGuR6ZYrxz/LnE6lbxeH/ANTmk3ZYffL3k6Ynv8kPcxO/KLfnHtzTPC9vLFeOf5c25u2c0m7LDb5e8nTE9/kh7mJ35Rb849uaZ4Xt5Yrxz/Jm3N2zmk3ZYbfL3k6Ynv8AJD3cTvyi35x7c0zwvbyxfj6oXWcPUhUhUgjkK0K0FmZTdaXWlxpW0raVtHvRXVIVIQSNa572ulTpilTiKkKkKkKkIpGo+eRrnVIVIMeiOuNLjS40ZNGjbjS40uNEkaVtK2mDXWLLGeMiKpQpQpQpQpQpQpQpQoqafknVOmM8n0/j+zljPGypKSkpKSkpKSj8U6p0xnk+n8f2csZ42aGjTRpo00aaNNGmjTRoqJzp1TpjPJ9P4/s5YzxuVKT6H0PofQ+h9D6H0F5U6p0xnk+n8f2csZ43Pq01aatNWmrTVpq01aat5E6p0xnk+n8f2csZ434IuhWVFRUVFRUVCrrknVOmM8n0/j+zljPG/JHKhW41eavNXmrzV5q81eIi1J0xnk+n8f2csZ436auNXGrjVxq41cauEV2qdMZ5Pp/H9nLF+P6adU6YvyPTwPZyxfj+mnVOmL8j08D2csX4/pp1Tpi/I9PA9nLF+P6adU6YvyPTwPZyxfj+mnVOmL8j08D2clRFS1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWo8ljYq2oy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoy1GWoxGo3/n/wD/xAAkEQACAQQDAAICAwAAAAAAAAAAAQIQERIxEyAwAyFBQiJAUf/aAAgBAwEBPwEui6Loui6Loui6LouqXRdF0XRdF0XRdF0Xo9ec9eUd0evOeuq+JvZL43HpHdHrznrp8SvKslZ1juj11UbmDolcxZaxIwZgxqxF4u4mmSkoj+6x3R6pasdUxZFWdJbJVnukUYoe6x3XG1HosyOusl9jrLZZkKNfZZkY/wCmKVXX+Quv56fnyfRdf26ft0W+rM2cjORnIzkZyM5GcjORmbuSdkcjORmbORnIzkZmzkZyMjNt0evP5NeUN0evP5NeUN0evP5NeUN0ejExMTExMTExMTEkroxMTExMTExMTEjGz9X5L1fkv7P/xAAlEQABAwMFAQADAQEAAAAAAAABAAIREBMxAxIgMFEhBEFCIkD/2gAIAQIBAT8BUFQVBUFQVBUFQVBUGkFQVBUFQVBUFQVBUGgz16eep+KDPWzPF35TRhaf5DX/ADg/FBnrZnh+Q6GV0zuaDV+KDPEvAVwUJhbwgZTMq4FcCBlajN7YTmlpgpmmXn4gIEVfigzSVNH5pvCe4EUZhNrp4o8reUDIq/FAtwNG5UhOzxaYCbVh+KQn0afikJzowtxNR9oF/lH4eP6nh+p4fAFI4t4Ozx/nh/PA4HEfVbAVsK2FbCtgq0FaCthWgtgiE1slWgrQWwRCtBWwrQWwK0FbCcwAUbnr089Wpijc9ennq1MUbnr089Wpikx9V8+K+fFfPivnxXz4r58V8+K+fFfPivnxb9n1Xz4r58V8+K+fFfPivnxXz4r58V8+K6XfKHHW/HU3NDjrfjqbn/p//8QAJhAAAgIBBAICAgMBAAAAAAAAAAExMgIQESBAIXEwQRJQIlFgcP/aAAgBAQAGPwL9fJJJJJJJJJJJJJJJJJJJOskkkkkkkkkkkkkkkkkknj/lPn9Zv/udtiCDbbVkkkkmz5+O2+WXFdWSSTw+cEEc8uK6j6mXFdJ/hOmzX8ipUqeVrBBBBBBBBUqeUV0e2JUqVKm7XGCCCOMEG2Wu7gsflv4LFix4eskkkkkkklix4Zs3ps35LFixY2TPLLFiSSSSSSSSSSTfHXLluQQL5XxXSy+HH5XxXSy+HH5XxXSy0/HfzzXkkkkkknh5ZutMuKbZ4evkkkkkkkknV7f3rkeOmhGXUfvXLWSxYsWLFiUSvhQjLqP3rlxsWLFixYsWPD5oRl1H71y5eT7Ps+z7Ps+z7Ps8cUIy6j965fBUqVKlSpUqRwQjLqP3rl8UIqipUqVKlSNEIy6j965dSBGXUfvXLqIRl1H71y6qMuo/euXVRl1H71y6qMuo/euXVRl1H71y6qMuo/euzKIoiiKIoiiKIoiiKIoiiKIoiiKIoiiKIotN3iiiKIoiiKIoiiKIoiiKIoiiKIoiiKIoiiPC2/X/AP/EACcQAAIBAgQGAwEBAAAAAAAAAAABETFhEHHw8SAhMEBRoVCRsUGB/9oACAEBAAE/IfjkSOnbJJJJJJJJJIQRvn2iSSSSSSSSSWzir9oqioiv2lXPGv2iqhURX7SrnjX7RVFQr9pVzxrdoqioVuihc6iF4HWIrlToVs8anaKoqFTqSpMLjrZ41O0VRUKnQodTrZ41O0VRUKnQ5UcLcbWzxqdFkILxeLnBKcyMf/igqioNDdeOHbZKZyxTh8hTrXBuCTl0FTPGp0f4xVRU4lUyFUVD8OjG4Un+xo6yZwpZXHUzxr4NpJbhFiWJYjaEPH+MacADS7xqZCqKh+XR1fptTGvxSvlj/OLpwfjjVyFUVD8uiq/QWkZZZZYhrXnFEWSWcNBoM0GaDHlxqCyWSOjEk4eCSZYjqM1GNrjUENRioOVY5/prM1mazNZinyJZLJZGm5cDb5kFkslkedJYktiIc4uT4Q0EfrRoI0EaCIdOy6XSrcZJkltD9TURqIbROyozg/R0NZGsjWRrIrIkMjZoI0ENoXPwNtFK4EkaFOImeErozNwnH3l+cXTg/HGvkVMyjlx9UcsaHBVG3JLJZW8sa+fUl6GLpwfjjVyK+ZRy4/qOWP4cFUdca3ljXz6kPQxdOD8cauRXzKOXH5Ryx/DgrjrjX/mNfPFoC8fgBcLhcF/6XS6OpXOlik4+BJJIn/C4XBvcSgnJyko5C0jL5fL5fOQwEdzKC4XCaty4Ns8Jly4kl3kLxeEucJtWSyWSyWSyWSyMaH0vePW7rJpfkTNU/ZPw+yfh9k/D7J+H2T8Psn4ffTy949bvMmRN83CNRGojURqI1EaiNRGohVVOP3j1u+yblVzbogABCfDh949b4DJtRmozUZqM1GajNRmoxxcuD7x63wOTTKJ54LURPw+ifh9E/D6J+H0T8Pon4fQ7wZEPwe8et8HkySFgWPRY9Fj0WPRY9Fj0WPQ2jbVPW7nIIZDIZDIZDIZDIZDIZzLzLzLzLzLzLzLzK6dT1hAhkMhkMhkMhkMhkMhkMhkMhkMhkMh9wip5nrfGKFTzPW+MUKnmet8YoVPM9b4xQqeZ63cKIkyvDNpNpNpNpNpNpNpNpNpNpNpNpNpNpNpNpNpNpNpNhwmSPy0bSbSbSbSbSbSbSbSbSbSbSbSbSbSbSbSbSbSbSKoUlvj/AP/aAAwDAQACAAMAAAAQGOOOOOOOOOONOOOOOOOOONCWMMMMMMMMMYSMMMMMMMMMbCWOOOOOOOOOKWOOOKQiOOOLCCDDDDDDDDDFEDDDUDTJDDVCCNNNNAFNNBRpPPPMPTuNNICWOBFOiQAAAx8AAmOhhMOOOCRSw3MEY8rMVrAAHMgAvMZ2CABPIALH/wC83vQw7s6w8f3OwgBPPAA1PPwAPwAOAKwHAH6glCgkgs7PPfOJTDPDLTDPLTAl77zz3/8A/wD/AK1v/wD/AP8A/wD/AP8A/Al//wD/AP8A/wD/AL/rW/8A/wD/AP8A/wD/AP8AAl//AP8A/wDyzTXSVv8A/wD/AP8A/wD/AP8AwII444457776o84444444448IP777777776r37777777770IP777777776r37777777770IDHHHHHHHHHGDHHHHHHHHHAL//xAAfEQACAQQDAQEAAAAAAAAAAAAAAREQMVFhICFBMED/2gAIAQMBAT8QNxuNxuNxuNxuNxuG0rm43G43G43G43G4SOzpe/OVz8AsloFkrtcq59xHZ5VTUuNc4tSVWZ0RrGzQxZSrTWh00llCSWM2l8a5SRDpbpqH9lexcRTRMLDJcZqVAmZOndjQdKvaMfQVtKKq30NAjSc0c26NAhoLsKrRBA046JwOylkEUgmwRBBNhFIE220Q8iWSK+eFtfaIKro9pep6OjQmxu4fpCjj73g2ZV/unhulNuuwJ0vfne9+d7353SWRHJHJHJHJHJHJHJHJHJHJ1BHJHJHJHJHJHJHJHJHIqSjt87flfR2+dvyvrBBBBBBBBBFIIIIIIIIIr//EACERAAIBBAMBAQEBAAAAAAAAAAABERAhMWEgMEFRcUCR/9oACAECAQE/EMmo1Go1Go1Go1Go1CTeDUajUajUajUajUNGVTF15ezxdefhI5hZGErPl4uvPwdGvbUwNaerj4uLCHUSks3iElDQ1QWsomjDiCLYfRSk84uIkh9IUy02lhV83xI2kJFkOQ3xWhyNRqlim4vdqvlFXWMk3NVK43DptRRCW5uHsGpDqtxIym5H2YiJJJsSQTJJEikmxI0g36aBteCdfX5zPKPH9HVZ/tPOG8FRJJCBvN5vG1PJdhUT5rDrckvlXlSph68vY4evL2OHry9j/g65JJJJJWF1SSSSTNKmb+cs39BQiEQiEQiEQiEQiEQQiEQiEQiEQiEQiFT/xAAoEAACAQIFAwUBAQEAAAAAAAAAARGx8CAxYXGhECFAMEFRkfFQgcH/2gAIAQEAAT8Q/nOT4T3LiLiLiLiLiLiLiLiLiLiLiLiLiLiLiLiLiLiLiE9xQLupH6OntBcRcRcRcRcRcRcRcRcRcRcRcRcRcRcRcRcRcRcRIyVl49y9zjfzLF5xxv5lg5O5k7emYfwRGf8AAB5O5k7ei0m3C7tiBdz4CUoSJCjsDPeUepngggggggggggggggggggTs3Mnbp4IIIIIIF922WBpI08n0EgggggjyM+RuZO3rdZW3nJcjcyNvRPcPmu6wPsiUft7eGh7sxPVJToLJdf8ATZJbJbJI5BTMmRuZGw5+hqSLyLyLyLyJzLZqOrFNoaEKTR0ISW0jPHb3fjwXI3MjbrTYEyNzI2MmErsCHN7CRKE4nuQaIhI419QO8JI92frn65+uSoHwni283wKKisvkvk7dxKTwfkbmRsZcJWYOPgz98fIw+h9I3P2wZmymC8jcyNjLhKjBx8GfvgQxySnrmILaSh36roloF9oZ5TZqUWkLSFpCVoQmev8AmKjUssssYZVFlllllndDUL3RcQuIT5CEyOASE5poyNhFISFJQWkLSFpC0hApTNzg/wCol3tfJYZYZYY9qJz84P8AzuW1C7l9ovtEpEnE9ffzBl9j/gotMWmLTD5EFMQW0W0RPanQsosoaFNBZRZRZR2S3nmLjFxh/iCmIO0J8YE00msme5iCgtMWmLTFphDktkoF6YKYgsMWGO+/sZYRYRYR3UlsaA0BoBkZIXdl9MvpjxAHEx1oK9Fb/cHu4KILpLpOyMQmOuftgpKYL4w4opaYa7AfCdMHNZI93n8mo/s1H9jNyN5sV0Feiv8A7g92Is/bBSUwHwBxRS0w1eB8ndTBz2Zu/XnMV0Feit/uD3Yqz9sFNTA/AHFFLTDU4Pyd1MHLZm79c/ditDTy7V6RUPa4ABISL6L6Mo4H2LaLaG2VJeReReR3s1BZdUpChCYHiWyQ4OKEpA1FMIAEHJM3BCWITHVJeiwfsX0X0X0Qom38DTP5fBcRcQyN+4si6i6hkErqoakpBOM+5pvs032ab7NN9mm+zTfZpvs032R5h+lwlTjKFDTxObp1oaibWTaNR9iA459njCEIQhN3m7/R9n/QefocJU4yhQ08Tm6daGuBBWseizMzMzSKX8Rj4SpxlChp4nN060NfXCAAB3fd8Jw8JU4yhQ08Tm6daGuNZih9AZmZmZhlC/Zzg4SpxlChp4nN060NfR7lsBaQmeWMCEIQhQPbD4Go+jhKnGUKGnic3TrQ19NFYkloJjSTTb0NeNeNeNeNeNeNeJLBo321OEoUNPE5unVZj0qaDNBmgzQZoM0GaDNBmgzQZoMSRppNNH6Z+mfpn6Z+mfpn6ZoLe5wlBzjXxQ0GaDNBmgzQZoM0GaDNBmgzQZoM0GaDNBmgzQZoM0GI1L8+tJXxOCOEKSnic31pK+JwRwhSU8Tm+tJXxOCOEKSnic31pK+JwRwhSU8Tm+tJXxOCOEKSnic31akX5oleIAAAAAAAAAAAAAAABKcqQJQoWSGJl5yH4gAAAAAAAAAAAAAAAHN8OYSP5/8A/9k=' },
          ],
          // Files already with the job, one of each kind, to open and go through.
          documents: [
            { name: 'Site survey notes.txt', type: 'text/plain', size: 137, data: 'U2l0ZSBzdXJ2ZXksIE5pbGUgVG93ZXJzIDEydGggZmxvb3IKCi0gRnJlaWdodCBsaWZ0IGJvb2tlZCAwODowMC0xMDowMAotIFNwcmlua2xlcnMgZml0dGVkIG9uIGV2ZXJ5IGZsb29yCi0gTWVldGluZyByb29tcyBmYWNlIHRoZSByaXZlcgo=' },
            { name: 'Floor plan, 12th floor.svg', type: 'image/svg+xml', size: 435, data: 'PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAzMjAgMjAwJz48cmVjdCB3aWR0aD0nMzIwJyBoZWlnaHQ9JzIwMCcgZmlsbD0nI2Y0ZjFlYScvPjxnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzJmNWQ4YScgc3Ryb2tlLXdpZHRoPSc0Jz48cmVjdCB4PScyMCcgeT0nMjAnIHdpZHRoPScyODAnIGhlaWdodD0nMTYwJy8+PHBhdGggZD0nTTE0MCAyMHY5MGgtMTIwTTE0MCAxMTBoNjB2NzBNMjAwIDcwaDEwMCcvPjwvZz48ZyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPScxNCcgZmlsbD0nIzJmNWQ4YSc+PHRleHQgeD0nNDAnIHk9JzYwJz5PcGVuIHBsYW48L3RleHQ+PHRleHQgeD0nMjEyJyB5PSc1MCc+TWVldGluZzwvdGV4dD48dGV4dCB4PScyMTInIHk9JzE0MCc+S2l0Y2hlbjwvdGV4dD48L2c+PC9zdmc+' },
            { name: 'Lift booking, confirmed.pdf', type: 'application/pdf', size: 577, data: 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDcwPj5zdHJlYW0KQlQgL0YxIDIyIFRmIDcyIDc0MCBUZCAoTGlmdCBib29raW5nOiBmcmVpZ2h0IGxpZnQsIDA4OjAwLTEwOjAwKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU0IDAwMDAwIG4gCjAwMDAwMDAxMDUgMDAwMDAgbiAKMDAwMDAwMDIxNyAwMDAwMCBuIAowMDAwMDAwMzM0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzk3CiUlRU9GCg==' },
            { name: 'Budget, 12th floor.csv', type: 'text/csv', size: 131, data: 'SXRlbSxBbW91bnQgKEVHUCkKU3RyaXAtb3V0LDk1MDAwClBhcnRpdGlvbnMgYW5kIGdsYXNzLDQxMDAwMApGdXJuaXR1cmUsNjIwMDAwCktpdGNoZW4sMTgwMDAwCkFjb3VzdGljIHBhbmVscywxNDUwMDAKVG90YWwsMTQ1MDAwMAo=' },
          ],
          settings: { badge_readers: 4, visitor_hours: '08:00-18:00', zones: ['reception', 'open-plan'] },
          door_schedule: { weekdays: '07:00-20:00', weekends: 'closed', holidays: ['2026-10-06'] },
          extra: { floor: 12, lift_access: 'Freight lift, 08:00-10:00', parking: 6, sprinklers: true, zone: 'b' },
          time_on_site: 6.5,
          margin: 0.18,
        },
      },
    },
    onchange: {
      // Order lines: a picked product brings its name and price; every line gets its subtotal; the order its totals.
      'sale.order': { line_ids: recalculateOrder },
      partner: {
        // Individual or company, as Odoo keeps them: the choice over the name sets is_company.
        company_type: (values) => ({ is_company: values['company_type'] === 'company' }),
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
  // What this tab saved in the demos, in place of the samples (shared/kept.ts) — the customer typed twice's second Nile
  // Traders, someone else's, to find and merge (shared/duplicates.ts), back unless it was merged away; the orders to
  // review, on their list and on the order's page each row opens (shared/orders-review.ts).
  const extras: Record<string, () => Record<string, Record<string, Values>>> = {
    'customer-card': () => ({ partner: duplicateCustomers() }),
    'orders-review': () => ({ 'sale.order': reviewOrders() }),
    order: () => ({ 'sale.order': reviewOrders() }),
    // What the team did, 1,284 entries back from now, on its log and the entry each row opens (shared/activity-log.ts).
    'activity-log': () => ({ 'activity.entry': activityEntries() }),
    'activity-entry': () => ({ 'activity.entry': activityEntries() }),
    // A chart of 240 accounts, on its list and on the account each row opens (shared/chart-of-accounts.ts).
    'chart-of-accounts': () => ({ 'coa.account': chartAccounts() }),
    account: () => ({ 'coa.account': chartAccounts() }),
  };
  const extra = extras[params.get('page') ?? '']?.() ?? {};
  // The sales team's queue keeps its saved views on its server, the team's shared ones among them (shared/saved-views.ts).
  const views = params.get('page') === 'leads-queue' ? { views: TEAM_VIEWS } : {};
  // Over what this tab kept, and keeping what is saved — records, templates, views, properties, responses (shared/kept.ts).
  const source = keptSource({ ...options, ...views }, { extra });
  // Where a page opened without `record=` starts (`recordFromQuery`): its model's first record here.
  sampleRecords = source.records;
  // `?store=http`: the listing's photos to a real endpoint, through uploadTo, for the browser tests.
  const upload = listingUpload(params);
  if (upload) source.upload = upload;
  // `?store=none`: no store at all, as an app before 0.21 — files go inside the record as base64.
  if (params.get('store') === 'none') delete (source as { upload?: unknown }).upload;
  // The contacts' source as the address asks: ids cut short or none, no bulk writing, an export on the server.
  contactsAsAsked(params, source);
  // `?lines=40`: the posted invoice with that many lines, to see a long one on paper (e2e/print.spec.ts).
  const lines = Number(params.get('lines'));
  const posted = source.records['account.move']?.[4102];
  if (lines > 0 && posted) posted['invoice_line_ids'] = longLines(posted['invoice_line_ids'], lines);
  // Each draft kept in this browser, for the link opened in another tab (shared/clinic-intake.ts).
  keepDrafts(source);
  // The clinic's server: a week over 48 hours refused, a service's price per hour worked out again (shared/editable-lists.ts).
  staffWeekRule(source);
  servicePerHour(source);
  // The pipeline's: a new stage before Won, which stays last (shared/editable-lists.ts).
  stageOrder(source);
  return source;
}

/** A table's lines repeated to `count`, each its own: a long invoice's. */
function longLines(given: unknown, count: number): unknown[] {
  const lines = (given ?? []) as { key: string; id: number; values: Record<string, unknown> }[];
  if (!lines.length) return lines;
  return Array.from({ length: count }, (_, at) => {
    const line = lines[at % lines.length];
    return { key: `long${at}`, id: 49000 + at, values: { ...line.values, sequence: 10 * (at + 1), name: `${String(line.values['name'] ?? '')} (${at + 1})` } };
  });
}

/** The samples' data source options with the real lanes' beside them: a model's records, rules and lists added to, never replaced. */
function withReal(options: Parameters<typeof createMemoryDataSource>[0] & object): Parameters<typeof createMemoryDataSource>[0] {
  const merge = <T>(mine: Record<string, Record<string, T>> = {}, theirs: Record<string, Record<string, T>> = {}) => {
    const all = { ...mine };
    for (const [model, rows] of Object.entries(theirs)) all[model] = { ...all[model], ...rows };
    return all;
  };
  return {
    ...options,
    records: merge(merge(merge(options.records, real.records), businessData.records), codeData.records),
    onchange: merge(options.onchange, real.onchange),
    warnings: merge(options.warnings, real.warnings),
    lists: { ...options.lists, ...real.lists },
    labelField: { ...options.labelField, ...real.labelField },
    shows: { ...options.shows, ...real.shows },
    definitions: { ...options.definitions, ...businessData.definitions, ...real.definitions },
    attachments: { ...options.attachments, ...real.attachments },
  };
}

/** A face, drawn: a salesperson's picture for the reading sheet. */
const FACE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#c7a17a"/><circle cx="20" cy="15" r="8" fill="#6b4f3a"/><rect x="8" y="26" width="24" height="14" rx="7" fill="#6b4f3a"/></svg>');

/** The reading sheet's invoice and the records its links point to. Sample data. */
const READING = {
  'reading.invoice': {
    1: {
      name: 'INV/2026/00042',
      state: 'posted',
      state_times: { draft: 3 * 86400, posted: 5 * 3600 },
      active: true,
      partner_id: { id: 1, label: 'Nile Traders' },
      user_id: { id: 5, label: 'Mona Adel' },
      tag_ids: [
        { id: 1, label: 'Wholesale' },
        { id: 2, label: 'Late payer' },
        { id: 3, label: 'Export' },
      ],
      invoice_date: '2026-10-02',
      invoice_date_due: null,
      payment_term: '30',
      payment_state: 'paid',
      risk: 'high',
      currency_id: { id: 1, label: 'EGP' },
      pricelist_id: { id: 1, label: 'Public pricelist (EGP)' },
      amount_total: 73069.44,
      amount_paid: 25000,
      hours: 24.8,
      incoming: 3,
      outgoing: 5,
      days_left: 12.5,
      days_allowed: 21,
      next_meeting: '2026-10-13',
      meeting_label: 'Next Meeting',
      lock_date: '2026-09-30',
      credit_warning: 'Nile Traders owes 48,069.44 EGP past its due date, above its 40,000 EGP limit.',
      duplicate: true,
      outcome: null,
      legacy: false,
      trust_minimum: 12500,
      narration: 'Payment within 30 days of the invoice date, by bank transfer.\nLate payments carry 1.5% a month.',
    },
  },
  'reading.partner': { 1: { name: 'Nile Traders', street: '12 Nile St, Garden City', city: 'Cairo, Egypt', vat: 'Tax ID 123-456-789' } },
  'reading.user': { 5: { name: 'Mona Adel', image: FACE }, 6: { name: 'Karim Fathy' } },
  'reading.tag': { 1: { name: 'Wholesale', color: 10 }, 2: { name: 'Late payer', color: 1 }, 3: { name: 'Export', color: 4 }, 4: { name: 'VIP', color: 3 } },
  'reading.pricelist': { 1: { name: 'Public pricelist (EGP)' }, 2: { name: 'Wholesale (EGP)' } },
};
