import { LATER_CHECKS } from './later-checks';
import type * as ListChecks from './list-checks';
import type * as EditableChecks from './editable-checks';
import type * as SheetHeadChecks from './sheet-head-checks';
import type * as LimitsChecks from './limits-checks';
import type * as ApprovalChecks from './approval-checks';
import type * as SlotsChecks from './slots-checks';
import type * as SignatureChecks from './signature-checks';
import type * as EndingsChecks from './endings-checks';
import type * as MapChecks from './map-checks';
import type * as TableChecks from './table-checks';
import type * as StatusbarChecks from './statusbar-checks';
import type * as OptionChecks from './option-checks';
import type * as LanguagesChecks from './languages-checks';
import type * as AssistChecks from './assist-checks';
import type * as ScanChecks from './scan-checks';
import type * as FlowChecks from './flow-checks';
import type * as PrefillChecks from './prefill-checks';
import type * as VerifyChecks from './verify-checks';
import type * as PaymentChecks from './payment-checks';
import type * as OutboxChecks from './outbox-checks';
import type * as ScheduleChecks from './schedule-checks';
import type * as TemplatesChecks from './templates-checks';

/**
 * The checks of a page that come with a part, called by the reference check (references.ts, head-checks.ts) through
 * these stand-ins: each runs its check where it is in (`LATER_CHECKS`, by its part's name), and where it is not, tells
 * the check it owes it (`tools.owe(part)`, the reference check's `later`) — its tools are its last argument.
 *
 * In the one-tag script each part that draws what they check puts them in as it comes (tools/script-bundle.mjs,
 * `CHECKS_IN_PARTS`, which this table matches name for name). In an app's bundle they are in one chunk of their own
 * (`formatChecksPart`, format-checks.ts), asked for by a viewer whose page's check owes one — a record with no list, no
 * map, no limits … never fetches them (0.37: 12.8 KB gzipped out of an app's first paint). `checkPage`, `validatePage`
 * and `checkPageWhole` put them all in first (all-checks.ts): those are whole at once.
 */
type Check = (...args: never[]) => void;
function owed<F extends Check>(part: string, name: string): F {
  return ((...args: unknown[]) => {
    const real = LATER_CHECKS[part]?.[name] as ((...given: unknown[]) => void) | undefined;
    return real ? real(...args) : (args[args.length - 1] as { owe(part: string): void }).owe(part);
  }) as unknown as F;
}

export const checkList = owed<typeof ListChecks.checkList>('list', 'checkList');
export const checkRelated = owed<typeof ListChecks.checkRelated>('list', 'checkRelated');
export const checkEditable = owed<typeof EditableChecks.checkEditable>('editable', 'checkEditable');
export const checkSheetHead = owed<typeof SheetHeadChecks.checkSheetHead>('head', 'checkSheetHead');
export const checkMenuOpener = owed<typeof SheetHeadChecks.checkMenuOpener>('head', 'checkMenuOpener');
export const checkLimits = owed<typeof LimitsChecks.checkLimits>('limits', 'checkLimits');
export const checkApproval = owed<typeof ApprovalChecks.checkApproval>('approvals', 'checkApproval');
export const checkSlots = owed<typeof SlotsChecks.checkSlots>('slots', 'checkSlots');
export const checkSignature = owed<typeof SignatureChecks.checkSignature>('files', 'checkSignature');
export const checkRecording = owed<typeof SignatureChecks.checkRecording>('files', 'checkRecording');
export const checkEndings = owed<typeof EndingsChecks.checkEndings>('answers', 'checkEndings');
export const checkMap = owed<typeof MapChecks.checkMap>('mapchecks', 'checkMap');
export const checkPlace = owed<typeof MapChecks.checkPlace>('mapchecks', 'checkPlace');
export const checkAddressSearch = owed<typeof MapChecks.checkAddressSearch>('mapchecks', 'checkAddressSearch');
export const checkTable = owed<typeof TableChecks.checkTable>('lines', 'checkTable');
export const checkLineKinds = owed<typeof TableChecks.checkLineKinds>('lines', 'checkLineKinds');
export const checkStatusbar = owed<typeof StatusbarChecks.checkStatusbar>('business', 'checkStatusbar');
export const checkOptionRules = owed<typeof OptionChecks.checkOptionRules>('options', 'checkOptionRules');
export const checkLanguages = owed<typeof LanguagesChecks.checkLanguages>('languages', 'checkLanguages');
export const checkSuggest = owed<typeof AssistChecks.checkSuggest>('assist', 'checkSuggest');
export const checkRewrite = owed<typeof AssistChecks.checkRewrite>('assist', 'checkRewrite');
export const checkScan = owed<typeof ScanChecks.checkScan>('scan', 'checkScan');
export const checkSurveyFlow = owed<typeof FlowChecks.checkSurveyFlow>('surveyflow', 'checkSurveyFlow');
export const checkPrefill = owed<typeof PrefillChecks.checkPrefill>('prefill', 'checkPrefill');
export const checkVerify = owed<typeof VerifyChecks.checkVerify>('verify', 'checkVerify');
export const checkPayment = owed<typeof PaymentChecks.checkPayment>('pay', 'checkPayment');
export const checkOutbox = owed<typeof OutboxChecks.checkOutbox>('outbox', 'checkOutbox');
export const checkSchedule = owed<typeof ScheduleChecks.checkSchedule>('schedule', 'checkSchedule');
export const checkTemplates = owed<typeof TemplatesChecks.checkTemplates>('templates', 'checkTemplates');
