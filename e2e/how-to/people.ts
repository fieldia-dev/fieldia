import type { Replays } from './hand';
import { replay as layout } from './people/layout';
import { replay as templateJobApplication } from './people/template-job-application';
import { replay as templateEmployeeOnboarding } from './people/template-employee-onboarding';
import { replay as templateLeaveRequest } from './people/template-leave-request';
import { replay as realTimeOff } from './people/real-time-off';
import { replay as realEmployee } from './people/real-employee';
import { replay as staffHours } from './people/staff-hours';

/** The people demos' how-to steps, replayed by hand (e2e/how-to.spec.ts): one file per demo in e2e/how-to/people/. */
export const people: Replays = {
  layout,
  'template-job-application': templateJobApplication,
  'template-employee-onboarding': templateEmployeeOnboarding,
  'template-leave-request': templateLeaveRequest,
  'real-time-off': realTimeOff,
  'real-employee': realEmployee,
  'staff-hours': staffHours,
};
