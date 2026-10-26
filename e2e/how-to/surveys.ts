import type { Replays } from './hand';
import { replay as survey } from './surveys/survey';
import { replay as signup } from './surveys/signup';
import { replay as eventSignup } from './surveys/event-signup';
import { replay as eventTicket } from './surveys/event-ticket';
import { replay as kinds } from './surveys/kinds';
import { replay as templateNewsletter } from './surveys/template-newsletter';
import { replay as templateCustomerFeedback } from './surveys/template-customer-feedback';
import { replay as templateEventRegistration } from './surveys/template-event-registration';
import { replay as templateCourseEvaluation } from './surveys/template-course-evaluation';
import { replay as realSurvey } from './surveys/real-survey';
import { replay as designerSurvey } from './surveys/designer-survey';

/** The surveys demos' how-to steps, replayed by hand (e2e/how-to.spec.ts): each demo's in e2e/how-to/surveys/<demo id>.ts, in the catalogue's order. */
export const surveys: Replays = {
  survey,
  signup,
  'event-signup': eventSignup,
  'event-ticket': eventTicket,
  kinds,
  'template-newsletter': templateNewsletter,
  'template-customer-feedback': templateCustomerFeedback,
  'template-event-registration': templateEventRegistration,
  'template-course-evaluation': templateCourseEvaluation,
  'real-survey': realSurvey,
  'designer-survey': designerSurvey,
};
