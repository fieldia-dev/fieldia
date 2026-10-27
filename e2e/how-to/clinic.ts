import type { Replays } from './hand';
import { replay as clinicCalendar } from './clinic/clinic-calendar';
import { replay as waitingRoom } from './clinic/waiting-room';
import { replay as templatePatientIntake } from './clinic/template-patient-intake';
import { replay as templateAppointmentBooking } from './clinic/template-appointment-booking';
import { replay as realClinicAppointment } from './clinic/real-clinic-appointment';
import { replay as clinicConsent } from './clinic/clinic-consent';
import { replay as visitFeedback } from './clinic/visit-feedback';
import { replay as clinicIntake } from './clinic/clinic-intake';
import { replay as clinicTreatment } from './clinic/clinic-treatment';
import { replay as servicePrices } from './clinic/service-prices';
import { replay as servicesLanguages } from './clinic/services-languages';
import { replay as clinicBeforeAfter } from './clinic/clinic-before-after';
import { replay as trainingCheck } from './clinic/training-check';
import { replay as faceChart } from './clinic/face-chart';
import { replay as treatmentCourse } from './clinic/treatment-course';
import { replay as clinicBranch } from './clinic/clinic-branch';

/** The clinic demos’ how-to steps, replayed by hand (e2e/how-to.spec.ts): each demo’s in e2e/how-to/clinic/<demo id>.ts, in the catalogue’s order. */
export const clinic: Replays = {
  'clinic-calendar': clinicCalendar,
  'waiting-room': waitingRoom,
  'template-patient-intake': templatePatientIntake,
  'template-appointment-booking': templateAppointmentBooking,
  'real-clinic-appointment': realClinicAppointment,
  'clinic-consent': clinicConsent,
  'visit-feedback': visitFeedback,
  'clinic-intake': clinicIntake,
  'clinic-treatment': clinicTreatment,
  'service-prices': servicePrices,
  'services-languages': servicesLanguages,
  'clinic-before-after': clinicBeforeAfter,
  'training-check': trainingCheck,
  'face-chart': faceChart,
  'treatment-course': treatmentCourse,
  'clinic-branch': clinicBranch,
};
