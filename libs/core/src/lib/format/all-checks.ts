import { LATER_CHECKS } from './later-checks';
import * as list from './list-checks';
import * as editable from './editable-checks';
import * as head from './sheet-head-checks';
import * as limits from './limits-checks';
import * as approvals from './approval-checks';
import * as slots from './slots-checks';
import * as files from './signature-checks';
import * as answers from './endings-checks';
import * as mapchecks from './map-checks';
import * as lines from './table-checks';
import * as business from './statusbar-checks';
import * as options from './option-checks';
import * as languages from './languages-checks';
import * as assist from './assist-checks';
import * as scan from './scan-checks';
import * as surveyflow from './flow-checks';
import * as prefill from './prefill-checks';
import * as verify from './verify-checks';
import * as pay from './payment-checks';
import * as outbox from './outbox-checks';
import * as schedule from './schedule-checks';
import * as templates from './templates-checks';

/**
 * Every check of a page that comes with a part (owed-checks.ts), by its part's name: what `checkPage`, `validatePage` and
 * `checkPageWhole` put in before they run, so they are whole at once — and, in an app's bundle, the chunk a viewer asks
 * for where its page's check owes one (format-checks-part.ts). The one-tag script carries none of it here: each comes
 * with its own part (tools/script-bundle.mjs stands an empty table in for this file).
 */
export const ALL_CHECKS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = { list, editable, head, limits, approvals, slots, files, answers, mapchecks, lines, business, options, languages, assist, scan, surveyflow, prefill, verify, pay, outbox, schedule, templates };

/** Every check a part carries, put in for the checks to run at once: what a whole check calls first. */
export function wholeChecks(): void {
  for (const [part, checks] of Object.entries(ALL_CHECKS)) LATER_CHECKS[part] ??= checks;
}
