import type { Page } from '@fieldia/core';
import contactUs from '../../examples/templates/contact-us.page.json';
import newsletter from '../../examples/templates/newsletter.page.json';
import customerFeedback from '../../examples/templates/customer-feedback.page.json';
import eventRegistration from '../../examples/templates/event-registration.page.json';
import jobApplication from '../../examples/templates/job-application.page.json';
import supportRequest from '../../examples/templates/support-request.page.json';
import appointmentBooking from '../../examples/templates/appointment-booking.page.json';
import patientIntake from '../../examples/templates/patient-intake.page.json';
import courseEvaluation from '../../examples/templates/course-evaluation.page.json';
import quoteRequest from '../../examples/templates/quote-request.page.json';
import propertyEnquiry from '../../examples/templates/property-enquiry.page.json';
import invoice from '../../examples/templates/invoice.page.json';
import purchaseOrder from '../../examples/templates/purchase-order.page.json';
import expenseClaim from '../../examples/templates/expense-claim.page.json';
import leaveRequest from '../../examples/templates/leave-request.page.json';
import customer from '../../examples/templates/customer.page.json';
import product from '../../examples/templates/product.page.json';
import employeeOnboarding from '../../examples/templates/employee-onboarding.page.json';
import task from '../../examples/templates/task.page.json';

/**
 * The template library, examples/templates: each ready page by its id. The
 * demos open one as `template-<id>`, a record's on a new record, in the
 * theme its page names.
 */
const TEMPLATES: Record<string, Page> = {
  'contact-us': contactUs as Page,
  'newsletter': newsletter as Page,
  'customer-feedback': customerFeedback as Page,
  'event-registration': eventRegistration as Page,
  'job-application': jobApplication as Page,
  'support-request': supportRequest as Page,
  'appointment-booking': appointmentBooking as Page,
  'patient-intake': patientIntake as Page,
  'course-evaluation': courseEvaluation as Page,
  'quote-request': quoteRequest as Page,
  'property-enquiry': propertyEnquiry as Page,
  'invoice': invoice as Page,
  'purchase-order': purchaseOrder as Page,
  'expense-claim': expenseClaim as Page,
  'leave-request': leaveRequest as Page,
  'customer': customer as Page,
  'product': product as Page,
  'employee-onboarding': employeeOnboarding as Page,
  'task': task as Page,
};

export const templatePages: Record<string, Page> = Object.fromEntries(Object.entries(TEMPLATES).map(([id, page]) => [`template-${id}`, page]));
