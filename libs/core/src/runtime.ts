/**
 * Everything that runs a form, without the format's schemas: the part an app
 * showing forms carries, and the script bundle's. `index.ts` adds the schemas
 * and the full `validatePage` for where pages are made and tested.
 */
export type { JsonValue } from './lib/format/json';
export { FIELD_NAME, FIELD_TYPES, type FieldType } from './lib/format/names';
export type { Field, Fields, LineField, LinkedField, LineKinds, Option, SelectionOption, OptionsFrom, OptionsFromList, OptionsFromField, DefinitionsFrom, PropertyDefinition, FilterCondition, FilterItem, SetWhen, MoneyLook, Period } from './lib/format/field';
export { changesOptions, choiceOptions, hasOptionRules, optionRulesPart, optionsField, optionsList, withCarriedOptions, type OptionRulesPart } from './lib/format/choice-options';
export type { Shrink } from './lib/format/field';
export type {
  Modifier,
  Roles,
  CellRules,
  LineOrder,
  LineForm,
  PlaceholderWhen,
  HelpShown,
  ToneWhen,
  Tone,
  FieldNode,
  ButtonNode,
  TextNode,
  SlotNode,
  SectionNode,
  TabNode,
  TabCount,
  TabsNode,
  StepNode,
  WizardNode,
  SectionsNode,
  SheetNode,
  SheetTitle,
  SheetHead,
  SheetKind,
  HeadLink,
  HeadBand,
  Statusbar,
  StatButton,
  Ribbon,
  Alert,
  Badge,
  MenuItem,
  PressUndo,
  RecordToolbar,
  AttachmentPreview,
  ColumnCount,
  ColumnsByWidth,
  LayoutNode,
  RootLayout,
  ListNode,
  ListMap,
  ListCalendar,
  CalendarView,
  ListGantt,
  GanttZoom,
  ListCell,
  ListCard,
  ListGallery,
  ListEditable,
  ListDetail,
  MapCard,
  CardLine,
  CardPart,
  PluralWords,
  MapLayer,
  MapNode,
  RelatedNode,
  MapRoute,
  MapFence,
  MapReach,
  MapRegions,
  MapTool,
  Pin,
  ListFilter,
  FilterPeriod,
  FilterRange,
  LabelPlace,
  ScreenWidth,
  AnswerRule,
  DividerNode,
  SpacerNode,
  ImageNode,
  FormNode,
  WidgetOptions,
} from './lib/format/layout';
export type { AddressSearchOptions } from './lib/format/address-search';
export type { PathPickerOptions, StateDotOptions } from './lib/format/picker-options';
export type { PagePhone, PhoneOptions } from './lib/format/phone';
export type { SlotsOptions } from './lib/format/slots-options';
export type { SignatureOptions } from './lib/format/signature-options';
export type { PhotosOptions } from './lib/format/photos-options';
export type { ScanFill, ScanFormat, ScanOption, ScanSettings } from './lib/format/scan-options';
export type { CodeOptions, PinsOptions, RecordOptions, RecordedKind } from './lib/format/media-options';
export type { PageDuplicates } from './lib/format/duplicates';
export type { PageLimits } from './lib/format/limits';
export type { PageApproval } from './lib/format/approval';
export type { PageQuiz, QuizQuestion } from './lib/format/quiz';
export type { PageReview, TimeLimit } from './lib/format/flow';
export type { PagePrefill, PrefillParam } from './lib/format/prefill';
export type { PageRecords } from './lib/format/records';
export type { PageEnding } from './lib/format/endings';
// `quotedLabel` here, not in index.ts alone: the widgets' messages read it, and a package's module taking a name only
// index.ts gives makes a bundler's split build carry index.ts's re-exports — the limits part's form code — in the main
// chunk (tools/part-words.test.mjs).
export { labelAt, quotedLabel, recordSentence } from './lib/record/record-words';
export { wideColumns } from './lib/format/columns';
export { relatedInTab } from './lib/format/head-checks';
export { BULK_KINDS, bulkEditFields, bulkSettable } from './lib/format/bulk-edit';
// Which of a list's columns its cells change in place: what a page's parts are known by before it is drawn.
export { EDIT_KINDS, cellChangeable, editableColumns } from './lib/format/list-editable';
export { IMPORT_KINDS, importFields, importable } from './lib/format/import-fields';
export { cardLines, cardLineFields, cardPart, type CardLinePart } from './lib/format/card-lines';
export type {
  ActionStep,
  PageEvents,
  ValueMap,
  OpenStep,
  PanelSide,
  SetStep,
  ClearStep,
  AddLineStep,
  CheckStep,
  SaveStep,
  ResetStep,
  GoToStep,
  SayStep,
  AskStep,
  CallStep,
  CloseStep,
  OpenUrlStep,
  ReloadStep,
  ArchiveStep,
  UnarchiveStep,
  DuplicateStep,
  DeleteStep,
  PostStep,
  PrintStep,
} from './lib/format/actions';
export { FORMAT_VERSION, FORMAT_VERSIONS, compareFormats, formatProblem, type FormatVersion } from './lib/format/version';
export { upgradePage, PAGE_UPGRADES, type FormatHistory, type PageJson, type PageUpgrade } from './lib/format/upgrade';
export type { Page, PageData, PageLook, BotCheck, PagePrint } from './lib/format/page';
export { INPUT_MODES, type InputMode } from './lib/format/autofill-group';
export { THEMES, type Theme } from './lib/format/themes';
export { SKINS, type Skin } from './lib/format/themes';
export { PART_LOOKS, type PartLook, type PartLookKind, type PartsLook } from './lib/format/part-look';
export { checkPage } from './lib/format/check-page';
export { fillValues, splitValues, valuesIn } from './lib/format/words';
export { BROWSER_HOTKEYS, HOTKEY, hotkeyWords } from './lib/format/hotkeys';
export type { PageIssue, PageValidation } from './lib/format/references';
export { translatePage, localizePage, pageWords, isRightToLeft, listComma } from './lib/format/translate';
export { firstWeekday } from './lib/format/week';
// Every Intl formatter, made once for a language and its options (0.34): the one place Fieldia makes them.
export { intlFormat, type IntlKind } from './lib/intl-format';
export { compileModifier, type CompiledModifier } from './lib/expression/modifier';
export { ANY_FUNCTION, functionInfo, functionTable, functionNameProblem, type AppFunction, type AppFunctions, type FunctionInfo, type FunctionsKnown, type ValueKind } from './lib/expression/app-functions';
export type { FunctionTable, ExpressionEnv } from './lib/expression/functions';
export { rolesAllow } from './lib/record/roles';
export type { CellState, FieldTone, LineState } from './lib/record/cells';
export { evaluateModifier, isModifierValid } from './lib/expression/evaluateModifier';
export {
  emptyValue,
  initialValues,
  isEmpty,
  expressionContext,
  lineKind,
  type RecordId,
  type RelatedRecord,
  type ReferenceValue,
  type FileValue,
  type SignatureEvidence,
  type PhotoEdit,
  type Line,
  type Value,
  type Values,
} from './lib/record/values';
// The answers a signature kept signed: locked until it is taken away (the evidence's fingerprint is the files part's).
export { evidenceOf, signedBy, signsAnswers, type SignedBy } from './lib/record/signed';
export { checkValue, checkProperties, decimalsWords, formatBytes, fileProblem, describeTypes } from './lib/record/check';
export { scoreOf, type Score } from './lib/record/score';
// A quiz's results (`quiz` on a page): worked out by the survey part as the answers are sent; their shape.
export type { QuizResults, QuizMark } from './lib/record/quiz';
export { formSurveyPart, surveyFlow, type FormSurveyPart } from './lib/record/survey';
export type { Countdown } from './lib/record/timing';
export type { DrawnOrder } from './lib/record/order';
export type {
  DataSource,
  LoadRequest,
  SaveRequest,
  SaveResult,
  OnchangeRequest,
  OnchangeResult,
  SearchRequest,
  CreateRequest,
  SubmitRequest,
  SubmitResult,
  BotReport,
  ResolvedFilterCondition,
  ResolvedFilter,
  RecordChanges,
  LineOp,
  LinkOp,
  SaveProblem,
  SortOrder,
  ListRequest,
  ListResult,
  GroupRequest,
  GroupInterval,
  Group,
  OptionsRequest,
  RecordRequest,
  ArchiveRequest,
  ListedRecord,
  ViewsRequest,
  ColumnState,
  ViewState,
  SavedView,
  SaveViewRequest,
  DeleteViewRequest,
  LoadedRecord,
  RecordVersion,
  RecordPermissions,
  SaveConflict,
  TotalKind,
  TotalsRequest,
  TotalsResult,
  TotalsGroup,
  Totals,
  UploadFile,
  UploadSignal,
  UploadRequest,
  UploadedFile,
  WriteManyRequest,
  WriteManyResult,
  ExportRequest,
  ExportedFile,
  ExportBytes,
  CreateManyRequest,
  CreateManyResult,
  ImportRequest,
  SlotsRequest,
  SlotsResult,
  SlotDay,
  SlotDayState,
  DuplicatesRequest,
  DuplicatesResult,
  DuplicateMatch,
  MergeRequest,
  MergeResult,
  NotDuplicatesRequest,
  MarkNotDuplicateRequest,
  LimitsRequest,
  LimitsResult,
  StoredDraft,
  SaveDraftRequest,
  SavedDraft,
  LoadDraftRequest,
  ApprovalsRequest,
  ApprovalDecision,
  ApprovalLevelState,
  Approver,
  ApprovalLevel,
  ApprovalChange,
  ApprovalEntry,
  Approvals,
  DecideRequest,
  SuggestRequest,
  SuggestResult,
  RewriteRequest,
  RewriteResult,
  SearchToFilterRequest,
  SearchToFilterResult,
  GeoBox,
  ClustersRequest,
  ClustersResult,
  MapCluster,
  SendCodeRequest,
  SentCode,
  CheckCodeRequest,
  CodeChecked,
  VerifiedValue,
  PayRequest,
  PayResult,
  PaymentDue,
  PaidPayment,
  RecordChange,
  PresenceRequest,
  PresentPerson,
  RecordTemplate,
  TemplatesRequest,
  TemplateRequest,
  SaveTemplateRequest,
} from './lib/record/data-source';
export { saveRefused, saveProblemOf, ConflictError, loadedRecord, loadedRecordOf, newRecordSave } from './lib/record/data-source';
export { matchesFilter } from './lib/record/filter';
export { DATE_PERIODS, DATE_INTERVALS, addDays, dayStarts, spanStart, type DatePeriod, type DateInterval, type DayCount } from './lib/record/periods';
export { suggestions, facetsToFilter, groupByFields, type Facet, type RangeDays, type Suggestion } from './lib/record/search';
export { createMemoryDataSource, type MemoryAssist, type MemoryDataSource, type MemoryDataSourceOptions } from './lib/record/memory-data-source';
export type { MemoryApprovalRoute } from './lib/record/memory-approvals';
export type { MemoryCodes, SentCodeKept } from './lib/record/memory-codes';
// Time zones: a page's or a field's `timeZone`, its clock, its day, the hour its clocks skip or repeat.
export { clocksSkip, dayIn, instantsAt, isOwnZone, isTimeZone, ownZone, wallClock, wallDay, wallOf, wallText, wallTime, zoneOffset, type WallTime } from './lib/record/zones';
export { zonedPage } from './lib/format/zoned';
// Files stored as they are picked: the form's uploads, and an upload for a plain endpoint or a signed address.
export { formUploadsPart, uploadGoing, UPLOADS_AT_ONCE, type FileUpload, type FormUploadsPart, type UploadHow } from './lib/record/uploads';
// An upload for a plain endpoint, its work in the files part (upload-to-later.ts).
export { uploadTo } from './lib/record/upload-to-later';
export type { UploadAnswer, UploadTarget, UploadToOptions } from './lib/record/upload-to';
export { hostScheduler, wait, type Scheduler } from './lib/record/scheduler';
export {
  createForm,
  unsavedWork,
  workAtRisk,
  type LeaveHow,
  type Form,
  type FormOptions,
  type FormUser,
  type FormState,
  type FormStatus,
  type NodeState,
  type Choices,
  type Definitions,
  type DraftStore,
  type ActionRequest,
  type ChangeBy,
  type FormEvents,
  type FormConflict,
  type SearchOptions,
} from './lib/record/form';
export type { HistoryStep } from './lib/record/history';
export type { WaitsFor } from './lib/record/waits';
export type { ActionFile, ActionHost, ActionResult, AppUndo, AskHow, ChosenLines, OnAction, OpenRequest, OpenResult, PostedMessage, RunContext, RunResult, RunStop, SayUndo } from './lib/record/run';
export { MESSAGES, fill, type Messages, type Locale } from './lib/record/messages';
export { tableInChunks, wordsComing, wordsInChunks, wordsNotYet, wordsReady, type WordsChunks } from './lib/record/words-chunks';
export {
  stripMarks,
  foldDigits,
  oneLine,
  charCount,
  foldForSearch,
  numberMarks,
  readNumber,
  couldBeNumber,
  numberMisfit,
  cleanPastedNumber,
  readDuration,
  readDate,
  foldTyped,
  couldBeMonth,
  monthNamed,
  readTime,
  placesOfCurrency,
  placesOf,
  MOST_DIGITS,
  type NumberMarks,
  type NumberProblem,
  type NumberReading,
  type NumberRead,
  type NumberReadOptions,
  type NumberLimits,
  type NumberRefusal,
  type PastedNumber,
  type DurationProblem,
  type DurationRead,
  type DateOrder,
  type DateProblem,
  type DateRead,
  type TimeRead,
} from './lib/record/input-rules';
export { dayOf } from './lib/record/limits';
export { dayTag, hijriWords, monthWords, precisionOf, type DatePrecision } from './lib/record/day-words';
// The parts that join a form where its page asks — an offline outbox, the fields its link fills (`prefill`), proof of an
// email or a phone by a code, a payment — each with one hook into its send, the form knowing only that its page asks.
export { formJoins, type FormInner, type FormJoin, type FormJoins, type JoinPart, type SendKind, type Sent } from './lib/record/joins';
export type { PageLink } from './lib/record/link-values';
export type { FormVerify } from './lib/record/verify-form';
export type { FormPayment, PayStep } from './lib/record/payment-form';
export type { PagePayment } from './lib/format/payment';
export type { FormOutbox, OutboxItem, OutboxStore } from './lib/record/outbox-form';
// When a page takes answers and each choice's places (`limits`, an option's `seats`): the form's state, and its words.
export { formLimitsPart, hasLimits, limitInstant, type FormLimits, type FormLimitsPart, type Seats, type TakingState } from './lib/record/taking';
// A record's approvals (`approval`): the form's state of them; asking, deciding and locking are the approvals part's.
export { formApprovalsPart, type ApprovalStatus, type FormApproval, type FormApprovalsPart } from './lib/record/approving';
// (Why a page takes no answers now, in words — `takingWords`, `whenWords` — is the limits part's: index.ts names them.)
// A text kept in several languages, typed by people (`translate`): the reader's, and its part's checks loaded on first use.
export { formLanguagesPart, hasLanguages, languagesOf, type FormLanguagesPart, type Translated } from './lib/record/languages';
export { ADDRESS_PARTS, postcodeFits, settledPostcode } from './lib/record/structures';
export { webAddress, settledText, hasPattern, EMAIL_LOCAL_STRAYS } from './lib/record/inputs';
export { fieldPattern } from './lib/format/pattern';
// Code a page loads the first time it uses it (a part): the loader the widgets' and the viewer's parts are made with.
export { lazyPart, partWith, partsOf, partsComeByScriptTag, settleParts, type Part } from './lib/parts';
// The bodies of Fieldia's functions beyond the plain ones, loaded before a page that calls one is drawn.
export { callsPartFunctions, functionsPart, type FunctionsPart } from './lib/expression/functions';
// A record made live — changes made elsewhere, who else has it open — loaded where the source tells them.
export { recordLivePart, type RecordLivePart } from './lib/record/live-later';
// A press said with Undo, and taken back: loaded with a page whose buttons offer it, or as an answer first brings one.
export { pressUndoPart, type PressUndoPart } from './lib/record/undo-later';
// The checks a page owes a part of the one-tag script (`PageValidation.later`): a map's come in a part of their own.
export { mapChecksPart } from './lib/format/later-checks';
